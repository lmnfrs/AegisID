import { Hono } from "hono";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
  WebAuthnCredential,
} from "@simplewebauthn/server";

// DEV-ONLY passkey register / sign-in test. Mounted under /t/:slug/api/auth
// by src/worker/index.ts.
//
// - State lives in module-level in-memory Maps: it is lost whenever the isolate
//   restarts and is NOT shared across isolates.
// - No session or token is issued; sign-in only reports which username matched.
// - TODO: replace with real storage in D1 (users, credentials, challenges).
export const auth = new Hono<{ Bindings: Env }>();

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

type ChallengeKind = "register" | "login";

type StoredChallenge = {
  slug: string;
  challenge: string;
  kind: ChallengeKind;
  username?: string;
  expires: number;
};

type StoredCredential = {
  username: string;
  credential: WebAuthnCredential;
};

// challengeId -> challenge
const challenges = new Map<string, StoredChallenge>();
// slug -> credential id -> credential
const credentialsByTenant = new Map<string, Map<string, StoredCredential>>();
// slug -> username -> stable WebAuthn user handle
const userHandlesByTenant = new Map<string, Map<string, Uint8Array<ArrayBuffer>>>();

function tenantMap<T>(store: Map<string, Map<string, T>>, slug: string): Map<string, T> {
  let m = store.get(slug);
  if (!m) {
    m = new Map();
    store.set(slug, m);
  }
  return m;
}

function credentialsOf(slug: string, username: string): WebAuthnCredential[] {
  const out: WebAuthnCredential[] = [];
  for (const stored of tenantMap(credentialsByTenant, slug).values()) {
    if (stored.username === username) out.push(stored.credential);
  }
  return out;
}

function saveChallenge(
  slug: string,
  challenge: string,
  kind: ChallengeKind,
  username?: string,
): string {
  const now = Date.now();
  for (const [id, c] of challenges) {
    if (c.expires <= now) challenges.delete(id);
  }
  const challengeId = crypto.randomUUID();
  challenges.set(challengeId, { slug, challenge, kind, username, expires: now + CHALLENGE_TTL_MS });
  return challengeId;
}

// Single use: removed before verification whether or not it is valid.
function takeChallenge(id: unknown, slug: string, kind: ChallengeKind): StoredChallenge | null {
  if (typeof id !== "string") return null;
  const c = challenges.get(id);
  if (!c) return null;
  challenges.delete(id);
  if (c.expires <= Date.now() || c.slug !== slug || c.kind !== kind) return null;
  return c;
}

function validSlug(slug: string): boolean {
  return /^[a-z0-9-]{1,63}$/.test(slug);
}

function parseUsername(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const username = value.trim();
  return username.length >= 1 && username.length <= 64 ? username : null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function readBody(req: Request): Promise<Record<string, unknown>> {
  const body: unknown = await req.json().catch(() => null);
  return isObject(body) ? body : {};
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

auth.post("/register/options", async (c) => {
  const slug = c.req.param("slug") ?? "";
  if (!validSlug(slug)) return c.json({ ok: false, error: "Invalid tenant slug" }, 400);

  const body = await readBody(c.req.raw);
  const username = parseUsername(body.username);
  if (!username) return c.json({ ok: false, error: "username must be 1-64 characters" }, 400);

  try {
    const handles = tenantMap(userHandlesByTenant, slug);
    let userID = handles.get(username);
    if (!userID) {
      userID = crypto.getRandomValues(new Uint8Array(32));
      handles.set(username, userID);
    }

    const options = await generateRegistrationOptions({
      rpName: c.env.RP_NAME,
      rpID: c.env.RP_ID,
      userName: username,
      userID,
      attestationType: "none",
      authenticatorSelection: { residentKey: "required", userVerification: "required" },
      excludeCredentials: credentialsOf(slug, username).map((cred) => ({
        id: cred.id,
        transports: cred.transports,
      })),
    });

    const challengeId = saveChallenge(slug, options.challenge, "register", username);
    return c.json({ challengeId, options });
  } catch (error) {
    return c.json({ ok: false, error: errorMessage(error) }, 500);
  }
});

auth.post("/register/verify", async (c) => {
  const slug = c.req.param("slug") ?? "";
  if (!validSlug(slug)) return c.json({ ok: false, error: "Invalid tenant slug" }, 400);

  const body = await readBody(c.req.raw);
  if (!isObject(body.response)) return c.json({ ok: false, error: "response is required" }, 400);
  const response = body.response as unknown as RegistrationResponseJSON;

  const stored = takeChallenge(body.challengeId, slug, "register");
  if (!stored || !stored.username) {
    return c.json({ ok: false, error: "Unknown, expired or already used challenge" }, 400);
  }

  try {
    const result = await verifyRegistrationResponse({
      response,
      expectedChallenge: stored.challenge,
      expectedOrigin: c.env.RP_ORIGIN,
      expectedRPID: c.env.RP_ID,
      requireUserVerification: true,
    });
    if (!result.verified) return c.json({ ok: false, error: "Registration not verified" }, 400);

    const { credential } = result.registrationInfo;
    tenantMap(credentialsByTenant, slug).set(credential.id, {
      username: stored.username,
      credential,
    });
    return c.json({ ok: true, credentialId: credential.id });
  } catch (error) {
    return c.json({ ok: false, error: errorMessage(error) }, 500);
  }
});

auth.post("/login/options", async (c) => {
  const slug = c.req.param("slug") ?? "";
  if (!validSlug(slug)) return c.json({ ok: false, error: "Invalid tenant slug" }, 400);

  const body = await readBody(c.req.raw);
  let username: string | undefined;
  if (body.username !== undefined && body.username !== null && body.username !== "") {
    const parsed = parseUsername(body.username);
    if (!parsed) return c.json({ ok: false, error: "username must be 1-64 characters" }, 400);
    username = parsed;
  }

  try {
    // Empty allowCredentials = discoverable credential flow.
    const allowCredentials = username
      ? credentialsOf(slug, username).map((cred) => ({
          id: cred.id,
          transports: cred.transports,
        }))
      : [];

    const options = await generateAuthenticationOptions({
      rpID: c.env.RP_ID,
      allowCredentials,
      userVerification: "required",
    });

    const challengeId = saveChallenge(slug, options.challenge, "login", username);
    return c.json({ challengeId, options });
  } catch (error) {
    return c.json({ ok: false, error: errorMessage(error) }, 500);
  }
});

auth.post("/login/verify", async (c) => {
  const slug = c.req.param("slug") ?? "";
  if (!validSlug(slug)) return c.json({ ok: false, error: "Invalid tenant slug" }, 400);

  const body = await readBody(c.req.raw);
  if (!isObject(body.response)) return c.json({ ok: false, error: "response is required" }, 400);
  const response = body.response as unknown as AuthenticationResponseJSON;

  const stored = takeChallenge(body.challengeId, slug, "login");
  if (!stored) {
    return c.json({ ok: false, error: "Unknown, expired or already used challenge" }, 400);
  }

  const known = typeof response.id === "string"
    ? tenantMap(credentialsByTenant, slug).get(response.id)
    : undefined;
  if (!known) return c.json({ ok: false, error: "Unknown credential" }, 400);
  if (stored.username && stored.username !== known.username) {
    return c.json({ ok: false, error: "Credential does not belong to this username" }, 400);
  }

  try {
    const result = await verifyAuthenticationResponse({
      response,
      expectedChallenge: stored.challenge,
      expectedOrigin: c.env.RP_ORIGIN,
      expectedRPID: c.env.RP_ID,
      credential: known.credential,
      requireUserVerification: true,
    });
    if (!result.verified) return c.json({ ok: false, error: "Authentication not verified" }, 400);

    known.credential.counter = result.authenticationInfo.newCounter;
    return c.json({ ok: true, username: known.username });
  } catch (error) {
    return c.json({ ok: false, error: errorMessage(error) }, 500);
  }
});
