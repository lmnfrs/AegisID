import { Hono } from "hono";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import {
    generateAuthenticationOptions,
    generateRegistrationOptions,
    verifyAuthenticationResponse,
    verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { verifyTurnstile } from "../turnstile";
import type {
    AuthenticationResponseJSON,
    RegistrationResponseJSON,
    WebAuthnCredential,
    AuthenticatorTransport,
} from "@simplewebauthn/server";

// DEV-ONLY passkey register / sign-in test. Mounted under /t/:slug/api/auth
// by src/worker/index.ts.
//
// - State lives in D1 (tables from migrations/0001_init.sql): tenants, users,
//   credentials and webauthn_challenges, all keyed by UUID.
// - No session or token is issued; sign-in only reports which username matched.
export const auth = new Hono<{ Bindings: Env }>();

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

type ChallengeKind = "register" | "login";

type StoredChallenge = {
  challenge: string;
  userId: string | null;
};

type StoredCredential = {
  userId: string;
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

async function findTenantId(db: D1Database, slug: string): Promise<string | null> {
  const row = await db
    .prepare("SELECT id FROM tenants WHERE slug = ?")
    .bind(slug)
    .first<{ id: string }>();
  return row?.id ?? null;
}

// Returns the stored user id and handle, creating the user if needed; concurrent callers converge.
async function getOrCreateUser(
  db: D1Database,
  tenantId: string,
  username: string,
): Promise<{ id: string; userHandle: Uint8Array<ArrayBuffer> }> {
  const fresh = crypto.getRandomValues(new Uint8Array(32));
  await db
    .prepare(
      "INSERT INTO users (id, tenant_id, username, user_handle, created_at) VALUES (?, ?, ?, ?, ?) " +
        "ON CONFLICT (tenant_id, username) DO NOTHING",
    )
    .bind(crypto.randomUUID(), tenantId, username, fresh, Date.now())
    .run();
  const row = await db
    .prepare("SELECT id, user_handle FROM users WHERE tenant_id = ? AND username = ?")
    .bind(tenantId, username)
    .first<{ id: string; user_handle: unknown }>();
  if (!row) throw new Error("User row missing after insert");
  return { id: row.id, userHandle: toBytes(row.user_handle) };
}

async function credentialsOf(
  db: D1Database,
  tenantId: string,
  userId: string,
): Promise<{ id: string; transports: AuthenticatorTransport[] | undefined }[]> {
  const { results } = await db
    .prepare("SELECT id, transports FROM credentials WHERE tenant_id = ? AND user_id = ?")
    .bind(tenantId, userId)
    .all<{ id: string; transports: string | null }>();
  return results.map((r) => ({ id: r.id, transports: parseTransports(r.transports) }));
}

async function saveChallenge(
  db: D1Database,
  tenantId: string,
  challenge: string,
  kind: ChallengeKind,
  userId?: string,
): Promise<string> {
  const now = Date.now();
  const challengeId = crypto.randomUUID();
  await db.batch([
    db.prepare("DELETE FROM webauthn_challenges WHERE expires_at <= ?").bind(now),
    db
      .prepare(
        "INSERT INTO webauthn_challenges (id, tenant_id, challenge, kind, user_id, expires_at) " +
          "VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(challengeId, tenantId, challenge, kind, userId ?? null, now + CHALLENGE_TTL_MS),
  ]);
  return challengeId;
}

// Single use: deleted atomically before verification whether or not it is valid.
async function takeChallenge(
  db: D1Database,
  id: unknown,
  tenantId: string,
  kind: ChallengeKind,
): Promise<StoredChallenge | null> {
  if (typeof id !== "string") return null;
  const row = await db
    .prepare(
      "DELETE FROM webauthn_challenges WHERE id = ? " +
        "RETURNING tenant_id, challenge, kind, user_id, expires_at",
    )
    .bind(id)
    .first<{
      tenant_id: string;
      challenge: string;
      kind: string;
      user_id: string | null;
      expires_at: number;
    }>();
  if (!row) return null;
  if (row.expires_at <= Date.now() || row.tenant_id !== tenantId || row.kind !== kind) return null;
  return { challenge: row.challenge, userId: row.user_id };
}

async function findCredential(
  db: D1Database,
  tenantId: string,
  id: string,
): Promise<StoredCredential | null> {
  const row = await db
    .prepare(
      "SELECT c.id, c.user_id, c.public_key, c.counter, c.transports, u.username, u.user_handle " +
        "FROM credentials c JOIN users u ON u.tenant_id = c.tenant_id AND u.id = c.user_id " +
        "WHERE c.tenant_id = ? AND c.id = ?",
    )
    .bind(tenantId, id)
    .first<{
      id: string;
      user_id: string;
      public_key: unknown;
      counter: number;
      transports: string | null;
      username: string;
      user_handle: unknown;
    }>();
  if (!row) return null;
  return {
    userId: row.user_id,
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

// RP_ORIGIN is normally an exact origin. Previews set it to "https://*.<host>"
// because each branch runs on <branch>.<host>. The wildcard matches exactly one
// DNS label and resolves to the origin this request was served on, so the
// browser-reported origin must still equal the host the Worker is answering.
// No match returns the pattern itself, which never equals a real origin.
function expectedOrigin(configured: string, requestUrl: string): string {
  const at = configured.indexOf("://*.");
  if (at === -1) return configured;
  const scheme = configured.slice(0, at);
  const suffix = configured.slice(at + 4);
  const req = new URL(requestUrl);
  if (req.protocol !== `${scheme}:` || !req.host.endsWith(suffix)) return configured;
  const label = req.host.slice(0, -suffix.length);
  return /^[a-z0-9-]{1,63}$/.test(label) ? req.origin : configured;
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
  if (!(await verifyTurnstile(c.env, body.turnstileToken, "register", c.req.header("CF-Connecting-IP")))) {
    return c.json({ ok: false, error: "Bot check failed. Try again." }, 403);
  }
  const username = parseUsername(body.username);
  if (!username) return c.json({ ok: false, error: "username must be 1-64 characters" }, 400);

  try {
    const tenantId = await findTenantId(c.env.DB, slug);
    if (!tenantId) return c.json({ ok: false, error: "Unknown tenant" }, 404);
    const user = await getOrCreateUser(c.env.DB, tenantId, username);
    const existing = await credentialsOf(c.env.DB, tenantId, user.id);

    const options = await generateRegistrationOptions({
      rpName: c.env.RP_NAME,
      rpID: c.env.RP_ID,
      userName: username,
      userID: user.userHandle,
      attestationType: "none",
      authenticatorSelection: { residentKey: "required", userVerification: "required" },
      excludeCredentials: existing,
    });

    const challengeId = await saveChallenge(c.env.DB, tenantId, options.challenge, "register", user.id);
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

  try {
    const tenantId = await findTenantId(c.env.DB, slug);
    if (!tenantId) return c.json({ ok: false, error: "Unknown tenant" }, 404);
    const stored = await takeChallenge(c.env.DB, body.challengeId, tenantId, "register");
    if (!stored || !stored.userId) {
      return c.json({ ok: false, error: "Unknown, expired or already used challenge" }, 400);
    }

    const result = await verifyRegistrationResponse({
      response,
      expectedChallenge: stored.challenge,
      expectedOrigin: expectedOrigin(c.env.RP_ORIGIN, c.req.url),
      expectedRPID: c.env.RP_ID,
      requireUserVerification: true,
    });
    if (!result.verified) return c.json({ ok: false, error: "Registration not verified" }, 400);

    const { credential } = result.registrationInfo;
    await c.env.DB
      .prepare(
        "INSERT INTO credentials (id, tenant_id, user_id, public_key, counter, transports, created_at) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        credential.id,
        tenantId,
        stored.userId,
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
    const tenantId = await findTenantId(c.env.DB, slug);
    if (!tenantId) return c.json({ ok: false, error: "Unknown tenant" }, 404);

    let userId: string | undefined;
    if (username) {
      const row = await c.env.DB
        .prepare("SELECT id FROM users WHERE tenant_id = ? AND username = ?")
        .bind(tenantId, username)
        .first<{ id: string }>();
      userId = row?.id;
    }

    // Empty allowCredentials = discoverable credential flow. An unknown username
    // yields no userId, so the challenge is not bound to any user.
    const allowCredentials = userId ? await credentialsOf(c.env.DB, tenantId, userId) : [];

    const options = await generateAuthenticationOptions({
      rpID: c.env.RP_ID,
      allowCredentials,
      userVerification: "required",
    });

    const challengeId = await saveChallenge(c.env.DB, tenantId, options.challenge, "login", userId);
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

  try {
    const tenantId = await findTenantId(c.env.DB, slug);
    if (!tenantId) return c.json({ ok: false, error: "Unknown tenant" }, 404);
    const stored = await takeChallenge(c.env.DB, body.challengeId, tenantId, "login");
    if (!stored) {
      return c.json({ ok: false, error: "Unknown, expired or already used challenge" }, 400);
    }

    const known = typeof response.id === "string"
      ? await findCredential(c.env.DB, tenantId, response.id)
      : null;
    if (!known) return c.json({ ok: false, error: "Unknown credential" }, 400);
    if (stored.userId && stored.userId !== known.userId) {
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
      expectedOrigin: expectedOrigin(c.env.RP_ORIGIN, c.req.url),
      expectedRPID: c.env.RP_ID,
      credential: known.credential,
      requireUserVerification: true,
    });
    if (!result.verified) return c.json({ ok: false, error: "Authentication not verified" }, 400);

    await c.env.DB
      .prepare(
        "UPDATE credentials SET counter = ?, last_used_at = ? WHERE tenant_id = ? AND id = ?",
      )
      .bind(result.authenticationInfo.newCounter, Date.now(), tenantId, known.credential.id)
      .run();
    return c.json({ ok: true, username: known.username });
  } catch (error) {
    return c.json({ ok: false, error: errorMessage(error) }, 500);
  }
});
