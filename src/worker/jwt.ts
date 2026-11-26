export const ACCESS_TOKEN_TTL_SECONDS = 3600;
export const DASHBOARD_AUDIENCE = "aegisid-dashboard";

export type AccessClaims = {
  iss: string;
  aud: string;
  sub: string;
  preferred_username: string;
  iat: number;
  exp: number;
  jti: string;
};

type PrivateJwk = JsonWebKey & { kid?: string };

const ECDSA_P256 = { name: "ECDSA", namedCurve: "P-256" } as const;
const ECDSA_SHA256 = { name: "ECDSA", hash: "SHA-256" } as const;

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(input: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(input)) throw new Error("Invalid base64url");
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
}

function encodeJson(value: unknown): string {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));
}

function decodeJson(segment: string): unknown {
  return JSON.parse(new TextDecoder().decode(base64UrlDecode(segment)));
}

function parsePrivateJwk(env: Env): PrivateJwk {
  return JSON.parse(env.JWT_PRIVATE_JWK) as PrivateJwk;
}

async function importPublicKey(env: Env): Promise<CryptoKey> {
  const jwk = parsePrivateJwk(env);
  // Only public members are copied, so the private scalar `d` never reaches the verify key.
  return crypto.subtle.importKey(
    "jwk",
    { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y },
    ECDSA_P256,
    false,
    ["verify"],
  );
}

export async function signAccessToken(
  env: Env,
  input: { issuer: string; audience: string; userId: string; username: string },
): Promise<{ token: string; expiresAt: number }> {
  const jwk = parsePrivateJwk(env);
  if (!jwk.kid) throw new Error("JWT_PRIVATE_JWK has no kid");

  const key = await crypto.subtle.importKey("jwk", jwk, ECDSA_P256, false, ["sign"]);

  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + ACCESS_TOKEN_TTL_SECONDS;
  const header = { alg: "ES256", typ: "JWT", kid: jwk.kid };
  const payload: AccessClaims = {
    iss: input.issuer,
    aud: input.audience,
    sub: input.userId,
    preferred_username: input.username,
    iat,
    exp,
    jti: crypto.randomUUID(),
  };

  const signingInput = `${encodeJson(header)}.${encodeJson(payload)}`;
  const signature = await crypto.subtle.sign(
    ECDSA_SHA256,
    key,
    new TextEncoder().encode(signingInput),
  );

  return {
    token: `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`,
    expiresAt: exp * 1000,
  };
}

export async function verifyAccessToken(
  env: Env,
  token: string,
  expected: { issuer: string; audience: string },
): Promise<{ ok: true; claims: AccessClaims } | { ok: false; error: string }> {
  // Key errors are configuration problems and throw; bad tokens never do.
  const publicKey = await importPublicKey(env);

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return { ok: false, error: "Malformed token" };
    const [headerPart, payloadPart, signaturePart] = parts;

    const header = decodeJson(headerPart) as { alg?: unknown } | null;
    if (!header || header.alg !== "ES256") return { ok: false, error: "Unsupported alg" };

    // Reject non-canonical base64url so each signature has exactly one accepted encoding.
    const signatureBytes = base64UrlDecode(signaturePart);
    if (base64UrlEncode(signatureBytes) !== signaturePart) return { ok: false, error: "Invalid signature" };

    const valid = await crypto.subtle.verify(
      ECDSA_SHA256,
      publicKey,
      signatureBytes,
      new TextEncoder().encode(`${headerPart}.${payloadPart}`),
    );
    if (!valid) return { ok: false, error: "Invalid signature" };

    const claims = decodeJson(payloadPart) as Partial<AccessClaims> | null;
    if (
      !claims ||
      typeof claims.iss !== "string" ||
      typeof claims.aud !== "string" ||
      typeof claims.sub !== "string" ||
      typeof claims.preferred_username !== "string" ||
      typeof claims.jti !== "string" ||
      typeof claims.iat !== "number" ||
      typeof claims.exp !== "number"
    ) {
      return { ok: false, error: "Invalid claims" };
    }

    if (claims.exp <= Math.floor(Date.now() / 1000)) return { ok: false, error: "Token expired" };
    if (claims.iss !== expected.issuer) return { ok: false, error: "Issuer mismatch" };
    if (claims.aud !== expected.audience) return { ok: false, error: "Audience mismatch" };

    return { ok: true, claims: claims as AccessClaims };
  } catch {
    return { ok: false, error: "Invalid token" };
  }
}
