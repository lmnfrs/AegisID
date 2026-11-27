# Dev token API

> **DEV-ONLY. NO AUTHENTICATION.** These routes issue and verify access tokens for any existing user in any tenant, with no caller check. They are mounted only when the dev gate in `src/worker/index.ts` is open (see [Availability](#availability)). Do not expose them in production.
>
> No route verifies these tokens yet. The verify endpoint below is a development helper. No middleware or production route checks access tokens today. This page does not claim AAL2 compliance or OIDC conformance.

Source: `src/worker/dev/token.ts`. Token format: `src/worker/jwt.ts`. Design record: `docs/adr/0004-access-token-signing.md`.

## Endpoints

| Method | Full path | Purpose |
| ------ | --------- | ------- |
| `POST` | `/api/v1/dev/token` | Issue a signed access token for an existing user. |
| `POST` | `/api/v1/dev/token/verify` | Verify a token against the issuer for a tenant slug. |

Base URL in the examples: `http://localhost:5173`.

### Availability

`src/worker/index.ts` mounts the router only when:

```text
import.meta.env.DEV || import.meta.env.VITE_SHOW_DEV === "true"
```

When that condition is false, these paths are not routed to this module.

### Common request rules

- Both endpoints read the body with `c.req.json()`. If the body is missing, is not valid JSON, or parses to `null`, it is treated as `{}`. Every field is then missing and the request fails the slug check with `400`.
- Send a JSON body with `Content-Type: application/json`. The code does not check the header; the body is parsed with `c.req.json()` regardless.
- Field types are checked with `typeof`. A field that is not a string is treated as missing.
- The slug is validated with the regular expression `/^[a-z0-9-]{1,63}$/`.
- Errors that are not caught by the route's own checks return `500` with the exception message in `error`.

---

## POST /api/v1/dev/token

Issues an access token for a user who exists in the tenant identified by `slug`.

### Request body

| Field | Type | Required | Validation (as coded) |
| ----- | ---- | -------- | --------------------- |
| `slug` | string | yes | Must match `/^[a-z0-9-]{1,63}$/`. Non-string values are treated as `""` and fail. |
| `userId` | string | yes | Must be a string with length of at least 1. No format check is applied. It is compared to `users.id`. |

No other fields are read.

### Processing order

1. Validate `slug`. On failure return `400` with `"Invalid tenant slug"`.
2. Validate `userId`. On failure return `400` with `"userId is required"`.
3. Look up the tenant by `slug` in D1 (`SELECT id FROM tenants WHERE slug = ?`). If not found, return `404`.
4. Look up the user with `tenant_id` and `id` (`SELECT id, username FROM users WHERE tenant_id = ? AND id = ?`). If not found, return `404`.
5. Build the issuer as `<request origin>/t/<slug>`, where the origin comes from the request URL.
6. Sign the token (see [Access token](#access-token)). Return `200`.

### Responses

| Status | Condition | Body |
| ------ | --------- | ---- |
| `200` | Tenant and user exist and signing succeeds. | `{ "ok": true, "token": "<jwt>", "expiresAt": <number>, "username": "<string>", "userId": "<string>" }` |
| `400` | `slug` fails the pattern (including when it is missing or not a string). | `{ "ok": false, "error": "Invalid tenant slug" }` |
| `400` | `userId` is missing, not a string, or empty. | `{ "ok": false, "error": "userId is required" }` |
| `404` | No tenant row has the given `slug`. | `{ "ok": false, "error": "Unknown tenant" }` |
| `404` | No user row has the given `id` within the tenant. | `{ "ok": false, "error": "Unknown user" }` |
| `500` | Any exception in the D1 queries or in signing. Includes a missing or malformed `JWT_PRIVATE_JWK`, and a `JWT_PRIVATE_JWK` with no `kid`. | `{ "ok": false, "error": "<exception message>" }` |

Field details for `200`:

- `token`: the compact JWT string (three base64url segments separated by `.`).
- `expiresAt`: milliseconds since the Unix epoch. It equals `exp * 1000` (see [Access token](#access-token)).
- `username`: the user's `username` column.
- `userId`: the user's `id` column. It is the `sub` claim.

The route does not check any user status beyond the row existing.

### curl

```sh
curl -sS -X POST http://localhost:5173/api/v1/dev/token \
  -H 'Content-Type: application/json' \
  -d '{"slug":"<tenant-slug>","userId":"<user-id>"}'
```

Example `200` response (values are placeholders):

```json
{
  "ok": true,
  "token": "<header>.<payload>.<signature>",
  "expiresAt": 1732700000000,
  "username": "<username>",
  "userId": "<user-id>"
}
```

---

## POST /api/v1/dev/token/verify

Verifies an access token. The expected issuer is built from the request origin and the `slug`. The expected audience is `aegisid-dashboard`.

The route does not query D1. It does not check that the tenant or the user exists. It checks the token signature and the claims listed below.

### Verify request body

| Field | Type | Required | Validation (as coded) |
| ----- | ---- | -------- | --------------------- |
| `slug` | string | yes | Must match `/^[a-z0-9-]{1,63}$/`. Non-string values are treated as `""` and fail. |
| `token` | string | yes | Must be a string with length of at least 1. |

No other fields are read.

### Verify processing order

1. Validate `slug`. On failure return `400` with `"Invalid tenant slug"`.
2. Validate `token`. On failure return `400` with `"token is required"`.
3. Call `verifyAccessToken` with `issuer = <request origin>/t/<slug>` and `audience = "aegisid-dashboard"`.
4. If verification fails, return `400` with the failure reason as `error`.
5. If verification succeeds, return `200` with the claims.

### Verify responses

| Status | Condition | Body |
| ------ | --------- | ---- |
| `200` | Token passes all checks in [Verification](#verification). | `{ "ok": true, "claims": { ... } }` |
| `400` | `slug` fails the pattern. | `{ "ok": false, "error": "Invalid tenant slug" }` |
| `400` | `token` is missing, not a string, or empty. | `{ "ok": false, "error": "token is required" }` |
| `400` | Verification fails. `error` is one of the reasons in the table below. | `{ "ok": false, "error": "<reason>" }` |
| `500` | An exception outside the token checks. Includes a missing or malformed `JWT_PRIVATE_JWK`, because the verify key is derived from it before the token is parsed. | `{ "ok": false, "error": "<exception message>" }` |

Verification failure reasons (`error` values returned with `400`):

| `error` | Triggering condition |
| ------- | -------------------- |
| `Malformed token` | The token does not split on `.` into exactly three parts. |
| `Unsupported alg` | The header does not decode to an object, or its `alg` is not exactly `ES256`. |
| `Invalid signature` | The signature segment is not in canonical base64url form, or the ECDSA verification fails. |
| `Invalid claims` | The payload does not decode to an object, or any of `iss`, `aud`, `sub`, `preferred_username`, `jti` is not a string, or `iat` or `exp` is not a number. |
| `Token expired` | `exp <= floor(now / 1000)`. |
| `Issuer mismatch` | `iss` is not equal to `<request origin>/t/<slug>`. |
| `Audience mismatch` | `aud` is not equal to `aegisid-dashboard`. |
| `Invalid token` | An exception was caught inside the token checks. This includes a segment that is not valid base64url (in the header or payload, or in the signature), and a header or payload that is not valid JSON. |

The reasons are produced in this order: split (`Malformed token`), header `alg` (`Unsupported alg`), signature encoding and ECDSA verification (`Invalid signature`), claim types (`Invalid claims`), expiry (`Token expired`), `iss` (`Issuer mismatch`), `aud` (`Audience mismatch`). The `Invalid token` reason can occur at any decode step. The first failing check determines the response.

Success `200` body: `claims` is the decoded payload as sent. All seven claims are present for tokens issued by this API. Any extra claims in the payload are returned unchanged.

### Verify curl

```sh
curl -sS -X POST http://localhost:5173/api/v1/dev/token/verify \
  -H 'Content-Type: application/json' \
  -d '{"slug":"<tenant-slug>","token":"<access-token>"}'
```

Example `200` response (values are placeholders):

```json
{
  "ok": true,
  "claims": {
    "iss": "http://localhost:5173/t/<tenant-slug>",
    "aud": "aegisid-dashboard",
    "sub": "<user-id>",
    "preferred_username": "<username>",
    "iat": 1732696400,
    "exp": 1732700000,
    "jti": "<uuid>"
  }
}
```

---

## Access token

Produced by `signAccessToken` and checked by `verifyAccessToken` in `src/worker/jwt.ts`.

### Format

A compact JWS: `base64url(header) "." base64url(payload) "." base64url(signature)`.

The header and payload are JSON, encoded as base64url without padding.

### Header

| Field | Value |
| ----- | ----- |
| `alg` | `"ES256"` (ECDSA P-256 with SHA-256) |
| `typ` | `"JWT"` |
| `kid` | The `kid` of the private JWK (see [Signing key](#signing-key)). |

### Claims

| Claim | Type | Value |
| ----- | ---- | ----- |
| `iss` | string | `<request origin>/t/<slug>`, for example `http://localhost:5173/t/<slug>`. |
| `aud` | string | `aegisid-dashboard` (`DASHBOARD_AUDIENCE`). |
| `sub` | string | The user `id` (the user UUID, see ADR 0002). |
| `preferred_username` | string | The user's `username`. |
| `iat` | number | Issue time, `floor(Date.now() / 1000)`. |
| `exp` | number | `iat + 3600`. |
| `jti` | string | A random UUID from `crypto.randomUUID()`. |

### Lifetime

`ACCESS_TOKEN_TTL_SECONDS = 3600`. The token lifetime is 60 minutes from `iat`.

Tokens carry no server state. Nothing is written to D1 and there is no revocation check. A token stays valid until `exp`.

### Signature

- Algorithm: ES256. Signing uses Web Crypto `ECDSA` with `SHA-256` on a P-256 key.
- The signing input is `base64url(header) "." base64url(payload)`. The signature is the raw ECDSA signature, base64url-encoded without padding.
- No JWT library is used.

### Verification

`verifyAccessToken` performs these checks, in order:

1. Split on `.`. The token must have exactly three parts.
2. Decode the header. Its `alg` must be `ES256`.
3. The signature segment must be canonical base64url. Re-encoding the decoded bytes must give the same string.
4. Verify the ECDSA signature over `<header>.<payload>` with the public key.
5. Decode the payload. Each of `iss`, `aud`, `sub`, `preferred_username`, `jti` must be a string. `iat` and `exp` must be numbers.
6. `exp` must be greater than the current time in whole seconds.
7. `iss` must equal the expected issuer.
8. `aud` must equal the expected audience.

Not checked: `kid`, `typ`, `iat` against the current time, `nbf`, and user status.

The public key is imported from the private JWK with only `kty`, `crv`, `x` and `y` copied. The private scalar `d` is not used for verification.

### Signing key

The key is held in the secret `JWT_PRIVATE_JWK`. It is a private EC P-256 JWK as a JSON string. The JWK must include `kid`, or signing fails.

Generate a key with:

```sh
node scripts/gen-jwt-key.mjs
```

The script prints one line of JSON to standard output. Its `kid` is the SHA-256 thumbprint of the public part. Store the output as follows (from the script's own comments):

- Local development: add it to `.dev.vars` as `JWT_PRIVATE_JWK='<json>'`.
- Production: run `pnpm exec wrangler secret put JWT_PRIVATE_JWK`.

Never commit the output. Never paste a real key into documentation, issues or logs.

The key is parsed and imported on every sign and verify call.

## Known limitations

- No route verifies these tokens yet. The only verifier in the code is the dev verify endpoint on this page.
- Tokens cannot be revoked before `exp`. Logout and user disablement are not handled.
- `iss` is built from the request origin. A token issued on localhost does not verify against a production origin.
- Only one signing key is loaded. Key rotation is not supported.
- `aud` is a constant.
