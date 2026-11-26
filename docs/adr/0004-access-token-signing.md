# 0004. Access token format and signing

- Status: Accepted
- Date: 2026-11-26

## Context

After a user signs in with a passkey, AegisID needs to hand back a short-lived bearer token. The AegisID dashboard will accept it in place of a new login. Other applications are expected to verify AegisID tokens later, so they must be able to do so without holding anything that lets them mint tokens.

## Decision

- Access tokens are JWTs signed with ES256 (ECDSA P-256, SHA-256), using Web Crypto in `src/worker/jwt.ts`. No JWT library.
- One private JWK holds the signing key, in the secret `JWT_PRIVATE_JWK`. Locally it goes in `.dev.vars`, in production in `wrangler secret put`. Previews need it too. `node scripts/gen-jwt-key.mjs` generates a key. Its `kid` is the SHA-256 thumbprint of the public part.
- Header: `alg` `ES256`, `typ` `JWT`, `kid`.
- Claims: `iss` is `https://<host>/t/{slug}`, `aud` names the intended application (`aegisid-dashboard` today), `sub` is the user UUID (see ADR 0002), `preferred_username`, `iat`, `exp` (60 minutes after `iat`) and a random `jti`.
- Verification (`verifyAccessToken`) accepts only `alg` `ES256`, rejects a signature that is not in canonical base64url form, and checks `exp`, `iss` and `aud`. It derives the public key from the private JWK and never reads `d` into the verify key.
- Tokens carry no server state. Nothing is stored in D1, so a token stays valid until `exp`.

## Consequences

- A verifier needs only the public key. A client application that verifies tokens cannot forge them. With a shared secret (HS256) it could.
- The public key can later be published as a JWKS. `kid` lets keys rotate. Only one key is loaded today, so a rotation would invalidate live tokens until a key set is supported.
- A token cannot be revoked before `exp`. Logout, a disabled user and a lost device are not handled. Options when that matters: a `revoked_tokens(jti)` table or a per-user `token_version` column.
- `aud` is a constant for now. It should come from a registered client once client applications exist.
- The key is parsed and imported on every sign and verify call. Cache it if that shows up in profiles.
- `iss` is built from the request origin, so a token issued on a preview or on localhost does not verify in production.
- Today the only issuer is the dev-only `login/verify` route and `/api/v1/dev/token`. No production login route and no verification middleware exist. This ADR does not claim OIDC conformance or AAL2 compliance.
