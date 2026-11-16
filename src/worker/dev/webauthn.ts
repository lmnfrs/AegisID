import { Hono } from "hono";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
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
  AuthenticatorTransport,
} from "@simplewebauthn/server";

// DEV-ONLY passkey register / sign-in test. Mounted under /t/:slug/api/auth
// by src/worker/index.ts.
//
// - State lives in D1 (tables from migrations/0001_webauthn.sql).
// - No session or token is issued; sign-in only reports which username matched.
export const auth = new Hono<{ Bindings: Env }>();

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

type ChallengeKind = "register" | "login";

type StoredChallenge = {
  challenge: string;
  username: string | null;
};

type StoredCredential = {
  username: string;
  userHandle: Uint8Array<ArrayBuffer>;
  credential: WebAuthnCredential;
};

// D1 returns BLOBs as ArrayBuffer or number[] depending on the runtime.
function toBytes(value: unknown): Uint8Array<ArrayBuffer> {
  if (value instanceof ArrayBuffer) return new Uint8Array(value.slice(0));
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(
      value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer,
    );
  }
  if (Array.isArray(value)) return Uint8Array.from(value as number[]);
  throw new Error("Unexpected BLOB value from D1");
}

function parseTransports(value: string | null): AuthenticatorTransport[] | undefined {
  if (!value) return undefined;
  const parsed: unknown = JSON.parse(value);
  return Array.isArray(parsed) ? (parsed as AuthenticatorTransport[]) : undefined;
}

// Returns the stored handle, creating one if needed; concurrent callers converge.
async function getOrCreateUserHandle(
  db: D1Database,
  slug: string,
  username: string,
): Promise<Uint8Array<ArrayBuffer>> {
  const fresh = crypto.getRandomValues(new Uint8Array(32));
  await db
    .prepare(
      "INSERT INTO users (tenant_slug, username, user_handle, created_at) VALUES (?, ?, ?, ?) " +
        "ON CONFLICT (tenant_slug, username) DO NOTHING",
    )
    .bind(slug, username, fresh, Date.now())
    .run();
  const row = await db
    .prepare("SELECT user_handle FROM users WHERE tenant_slug = ? AND username = ?")
    .bind(slug, username)
    .first<{ user_handle: unknown }>();
  if (!row) throw new Error("User row missing after insert");
  return toBytes(row.user_handle);
}

async function credentialsOf(
  db: D1Database,
  slug: string,
  username: string,
): Promise<{ id: string; transports: AuthenticatorTransport[] | undefined }[]> {
  const { results } = await db
    .prepare("SELECT id, transports FROM credentials WHERE tenant_slug = ? AND username = ?")
    .bind(slug, username)
    .all<{ id: string; transports: string | null }>();
  return results.map((r) => ({ id: r.id, transports: parseTransports(r.transports) }));
}

async function saveChallenge(
  db: D1Database,
  slug: string,
  challenge: string,
  kind: ChallengeKind,
  username?: string,
): Promise<string> {
  const now = Date.now();
  const challengeId = crypto.randomUUID();
  await db.batch([
    db.prepare("DELETE FROM webauthn_challenges WHERE expires_at <= ?").bind(now),
    db
      .prepare(
        "INSERT INTO webauthn_challenges (id, tenant_slug, challenge, kind, username, expires_at) " +
          "VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(challengeId, slug, challenge, kind, username ?? null, now + CHALLENGE_TTL_MS),
  ]);
  return challengeId;
}

// Single use: deleted atomically before verification whether or not it is valid.
async function takeChallenge(
  db: D1Database,
  id: unknown,
  slug: string,
  kind: ChallengeKind,
): Promise<StoredChallenge | null> {
  if (typeof id !== "string") return null;
  const row = await db
    .prepare(
      "DELETE FROM webauthn_challenges WHERE id = ? " +
        "RETURNING tenant_slug, challenge, kind, username, expires_at",
    )
    .bind(id)
    .first<{
      tenant_slug: string;
      challenge: string;
      kind: string;
      username: string | null;
      expires_at: number;
    }>();
  if (!row) return null;
  if (row.expires_at <= Date.now() || row.tenant_slug !== slug || row.kind !== kind) return null;
  return { challenge: row.challenge, username: row.username };
}

async function findCredential(
  db: D1Database,
  slug: string,
  id: string,
): Promise<StoredCredential | null> {
  const row = await db
    .prepare(
      "SELECT c.id, c.username, c.public_key, c.counter, c.transports, u.user_handle " +
        "FROM credentials c JOIN users u ON u.tenant_slug = c.tenant_slug AND u.username = c.username " +
        "WHERE c.tenant_slug = ? AND c.id = ?",
    )
    .bind(slug, id)
    .first<{
      id: string;
      username: string;
      public_key: unknown;
      counter: number;
      transports: string | null;
      user_handle: unknown;
    }>();
  if (!row) return null;
  return {
    username: row.username,
    userHandle: toBytes(row.user_handle),
    credential: {
      id: row.id,
      publicKey: toBytes(row.public_key),
      counter: row.counter,
      transports: parseTransports(row.transports),
    },
  };
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
    const userID = await getOrCreateUserHandle(c.env.DB, slug, username);
    const existing = await credentialsOf(c.env.DB, slug, username);

    const options = await generateRegistrationOptions({
      rpName: c.env.RP_NAME,
      rpID: c.env.RP_ID,
      userName: username,
      userID,
      attestationType: "none",
      authenticatorSelection: { residentKey: "required", userVerification: "required" },
      excludeCredentials: existing,
    });

    const challengeId = await saveChallenge(c.env.DB, slug, options.challenge, "register", username);
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

  const stored = await takeChallenge(c.env.DB, body.challengeId, slug, "register");
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
    await c.env.DB
      .prepare(
        "INSERT INTO credentials (tenant_slug, id, username, public_key, counter, transports, created_at) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        slug,
        credential.id,
        stored.username,
        credential.publicKey,
        credential.counter,
        credential.transports ? JSON.stringify(credential.transports) : null,
        Date.now(),
      )
      .run();
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
    const allowCredentials = username ? await credentialsOf(c.env.DB, slug, username) : [];

    const options = await generateAuthenticationOptions({
      rpID: c.env.RP_ID,
      allowCredentials,
      userVerification: "required",
    });

    const challengeId = await saveChallenge(c.env.DB, slug, options.challenge, "login", username);
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

  const stored = await takeChallenge(c.env.DB, body.challengeId, slug, "login");
  if (!stored) {
    return c.json({ ok: false, error: "Unknown, expired or already used challenge" }, 400);
  }

  try {
    const known = typeof response.id === "string"
      ? await findCredential(c.env.DB, slug, response.id)
      : null;
    if (!known) return c.json({ ok: false, error: "Unknown credential" }, 400);
    if (stored.username && stored.username !== known.username) {
      return c.json({ ok: false, error: "Credential does not belong to this username" }, 400);
    }
    const presentedHandle = response.response?.userHandle;
    if (presentedHandle !== undefined && presentedHandle !== null) {
      if (presentedHandle !== isoBase64URL.fromBuffer(known.userHandle)) {
        return c.json({ ok: false, error: "User handle does not match credential" }, 400);
      }
    }

    const result = await verifyAuthenticationResponse({
      response,
      expectedChallenge: stored.challenge,
      expectedOrigin: c.env.RP_ORIGIN,
      expectedRPID: c.env.RP_ID,
      credential: known.credential,
      requireUserVerification: true,
    });
    if (!result.verified) return c.json({ ok: false, error: "Authentication not verified" }, 400);

    await c.env.DB
      .prepare(
        "UPDATE credentials SET counter = ?, last_used_at = ? WHERE tenant_slug = ? AND id = ?",
      )
      .bind(result.authenticationInfo.newCounter, Date.now(), slug, known.credential.id)
      .run();
    return c.json({ ok: true, username: known.username });
  } catch (error) {
    return c.json({ ok: false, error: errorMessage(error) }, 500);
  }
});
