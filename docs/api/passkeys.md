# Passkey API (DEV-ONLY)

> **DEV-ONLY. NO AUTHENTICATION.** These routes exist for local passkey register and sign-in testing. They are mounted only when `showDev` is true (`import.meta.env.DEV` or `VITE_SHOW_DEV === "true"`, `src/worker/index.ts:22-26`). They have no authentication, no authorization, and no session checks beyond the WebAuthn ceremony itself. Do not expose them in a production deployment.
>
> This page describes the implementation's behavior only. It makes no claim of AAL2 (NIST SP 800-63B) compliance or OIDC conformance.

Source: `src/worker/dev/webauthn.ts`. Mounted at `/t/:slug/api/v1/auth` by `src/worker/index.ts:26`.

## Overview

All four endpoints are `POST` and accept and return JSON. The tenant is selected by the `:slug` path parameter. State is stored in D1 in the `tenants`, `users`, `credentials`, and `webauthn_challenges` tables (`migrations/0001_init.sql`).

### Flows

**Register a passkey**

1. `POST /register/options` with a `username`. The server creates the user if it does not exist and returns a `challengeId` and WebAuthn registration `options`.
2. The client passes `options` to the WebAuthn `navigator.credentials.create()` ceremony and obtains a registration response.
3. `POST /register/verify` with the `challengeId` and the registration response. The server verifies the response and stores the credential.

**Sign in with a passkey**

1. `POST /login/options`, optionally with a `username`. The server returns a `challengeId` and WebAuthn authentication `options`. An empty or omitted username requests a discoverable-credential flow.
2. The client passes `options` to `navigator.credentials.get()` and obtains an authentication response.
3. `POST /login/verify` with the `challengeId` and the authentication response. The server verifies the response, updates the credential counter, and returns a short-lived access token.

### The challengeId

`challengeId` is a random UUID that identifies a row in `webauthn_challenges`. That row holds the WebAuthn challenge string, the ceremony kind (`register` or `login`), the bound user id (if any), and an expiry time. The client does not handle the challenge string directly. It returns the `challengeId` to the matching verify endpoint, and the server looks up the stored challenge there.

- **Single use.** The verify endpoints consume the row with `DELETE ... RETURNING` before verification runs. A challenge can be used once, whether or not verification succeeds.
- **Time to live.** 5 minutes (`CHALLENGE_TTL_MS = 5 * 60 * 1000`, `webauthn.ts:26`). An expired challenge is rejected.
- **Scope.** A challenge is valid only for the tenant and ceremony kind it was created for. A mismatch is rejected with the same error as an unknown challenge.

## Common behavior

### Path parameter

`:slug` must match `^[a-z0-9-]{1,63}$` (`webauthn.ts:200-202`). Otherwise every endpoint returns `400` with `{"ok": false, "error": "Invalid tenant slug"}`. If the slug is valid but no tenant has it, the endpoint returns `404` with `{"ok": false, "error": "Unknown tenant"}`.

### Request body

The body is parsed as JSON. A body that is not valid JSON, or that is valid JSON but not an object, is treated as `{}` (`webauthn.ts:214-217`).

### Error response shape

Error responses use this shape:

```json
{ "ok": false, "error": "<message>" }
```

Success responses for `register/options` and `login/options` return `{ "challengeId", "options" }` and have no `ok` field. The other two success responses include `"ok": true`.

Any unexpected exception returns `500` with the exception message in `error` (`webauthn.ts:250`, `297`, `339`, `398`). The message is passed through as-is.

### Username validation

Applies to `register/options` and to `login/options` when a username is supplied (`webauthn.ts:204-208`):

- The value must be a string. Non-string values are rejected.
- The value is trimmed of leading and trailing whitespace.
- The trimmed length must be between 1 and 64 characters, measured in JavaScript string length (UTF-16 code units).
- Failure returns `400` with `{"ok": false, "error": "username must be 1-64 characters"}`.

The trimmed value is the value stored and matched.

### Rate limiting

| Endpoint | Rate limited |
| --- | --- |
| `POST /register/options` | Yes |
| `POST /register/verify` | No |
| `POST /login/options` | Yes |
| `POST /login/verify` | No |

The two `options` endpoints use the `authRateLimit` middleware (`webauthn.ts:223`, `301`). The middleware runs before the handler, so requests that fail slug or username validation still count against the limit.

- Limit: 10 requests per 60 seconds, keyed by tenant slug and client IP (`cf-connecting-ip`, or `unknown` if the header is absent). The limit is configured in `wrangler.jsonc` for both the default and preview environments.
- When exceeded, the response is `429` with the header `Retry-After: 60` and the body `{"ok": false, "error": "Too many requests"}` (`src/worker/ratelimit.ts:16-18`).
- Counts are kept per Cloudflare location and are eventually consistent. This is approximate abuse control, not an exact quota (`src/worker/ratelimit.ts:4-5`, [ADR 0005](../adr/0005-rate-limiting.md)).
- If the limiter binding throws, the request is allowed and the error is logged (`ratelimit.ts:20-27`).

### Expected origin

The WebAuthn origin check uses `RP_ORIGIN`. When `RP_ORIGIN` contains a wildcard (`https://*.<host>`, used by preview environments), the expected origin is the origin of the request, provided its single leading DNS label matches `^[a-z0-9-]{1,63}$` (`webauthn.ts:184-198`). Otherwise the configured value is used as-is. The RP ID comes from `RP_ID`.

## Endpoints

### POST /t/:slug/api/v1/auth/register/options

Starts a passkey registration for a username. Creates the user if needed.

**Rate limited:** yes (10 requests per 60 seconds).

**Request body**

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `username` | string | Yes | Trimmed, 1 to 64 characters (see [Username validation](#username-validation)). |

**Responses**

| Status | Condition | Body |
| --- | --- | --- |
| `200` | Options generated and challenge stored. | `{ "challengeId": "<uuid>", "options": { ... } }` |
| `400` | Slug invalid (`webauthn.ts:225`). | `{ "ok": false, "error": "Invalid tenant slug" }` |
| `400` | `username` missing or invalid (`webauthn.ts:228-229`). | `{ "ok": false, "error": "username must be 1-64 characters" }` |
| `404` | No tenant with this slug (`webauthn.ts:233`). | `{ "ok": false, "error": "Unknown tenant" }` |
| `429` | Rate limit exceeded (`ratelimit.ts:16-18`). | `{ "ok": false, "error": "Too many requests" }` with `Retry-After: 60` |
| `500` | Any other exception (`webauthn.ts:250`). | `{ "ok": false, "error": "<message>" }` |

The `options` object is the result of `generateRegistrationOptions` (`webauthn.ts:237-245`), with these inputs set by the code:

- `rpName` from `RP_NAME` and `rpID` from `RP_ID`.
- `userName` set to the trimmed username.
- `userID` set to the user's stored random handle (32 bytes, generated on first creation).
- `attestationType: "none"`.
- `authenticatorSelection`: `residentKey: "required"`, `userVerification: "required"`.
- `excludeCredentials`: the user's existing credentials, each with `id` and `transports`.

The `options.challenge` value is the challenge that `register/verify` checks against.

**Side effects (D1)**

1. `users`: inserts a row with a new UUID, the trimmed username, a new 32-byte `user_handle`, and `created_at`. The insert uses `ON CONFLICT (tenant_id, username) DO NOTHING`, so an existing user is not changed (`webauthn.ts:69-88`). This row is created even if the registration never completes.
2. `credentials`: read only (to build `excludeCredentials`).
3. `webauthn_challenges`: in one batch, deletes every row whose `expires_at` is at or before now, across all tenants, then inserts a row with `kind = 'register'`, `user_id` set to the user's id, and `expires_at = now + 5 minutes` (`webauthn.ts:102-121`).

**Example**

```sh
curl -sS -X POST http://localhost:5173/t/demo/api/v1/auth/register/options \
  -H "Content-Type: application/json" \
  -d '{"username":"alice"}'
```

### POST /t/:slug/api/v1/auth/register/verify

Verifies a registration response and stores the new credential.

**Rate limited:** no.

**Request body**

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `challengeId` | string | Yes | The `challengeId` from `register/options`. A non-string value is treated as an unknown challenge (`webauthn.ts:130`). |
| `response` | object | Yes | The WebAuthn registration response (`RegistrationResponseJSON`). Only checked to be a non-null object (`webauthn.ts:259`). |

**Responses**

| Status | Condition | Body |
| --- | --- | --- |
| `200` | Verification passed and the credential was stored (`webauthn.ts:295`). | `{ "ok": true, "credentialId": "<credential id>" }` |
| `400` | Slug invalid (`webauthn.ts:256`). | `{ "ok": false, "error": "Invalid tenant slug" }` |
| `400` | `response` is missing or not an object (`webauthn.ts:259`). | `{ "ok": false, "error": "response is required" }` |
| `400` | Challenge unknown, expired, already used, for another tenant, or not a `register` challenge (`webauthn.ts:265-268`). | `{ "ok": false, "error": "Unknown, expired or already used challenge" }` |
| `400` | Verification returned `verified: false` (`webauthn.ts:277`). | `{ "ok": false, "error": "Registration not verified" }` |
| `404` | No tenant with this slug (`webauthn.ts:264`). | `{ "ok": false, "error": "Unknown tenant" }` |
| `429` | Not applicable; this endpoint is not rate limited. | n/a |
| `500` | Exception thrown, including those raised by `verifyRegistrationResponse` for most failed checks (challenge mismatch, origin or RP ID mismatch, missing user verification) and database errors such as a duplicate credential id (`webauthn.ts:297`). | `{ "ok": false, "error": "<message>" }` |

Verification uses `expectedChallenge` from the stored row, `expectedOrigin` (see [Expected origin](#expected-origin)), `expectedRPID` from `RP_ID`, and `requireUserVerification: true` (`webauthn.ts:270-276`). The `@simplewebauthn/server` library throws for most failed checks, so those cases reach the `500` branch rather than the `400 Registration not verified` branch.

**Side effects (D1)**

1. `webauthn_challenges`: the row is deleted by `DELETE ... RETURNING` whenever it is found, even if the challenge is then rejected or verification fails (`webauthn.ts:124-147`).
2. `credentials`: on success, one row is inserted with `id` = the credential id, `tenant_id`, `user_id` = the user the challenge was bound to, `public_key`, `counter`, `transports` (JSON array string, or `NULL` if the authenticator reports none), and `created_at`. `last_used_at` is left `NULL` (`webauthn.ts:280-294`).
3. `users`: not changed.

The insert has no `ON CONFLICT` clause. Inserting a credential id that already exists for the tenant fails at the primary key `(tenant_id, id)` and returns `500`.

**Example**

Replace `<challengeId>` with the value from `register/options`, and replace the `response` placeholder with the JSON produced by the browser's registration ceremony.

```sh
curl -sS -X POST http://localhost:5173/t/demo/api/v1/auth/register/verify \
  -H "Content-Type: application/json" \
  -d '{"challengeId":"<challengeId>","response":{ ... }}'
```

### POST /t/:slug/api/v1/auth/login/options

Starts a passkey sign-in. The username is optional. When it is omitted, the flow is discoverable (usernameless).

**Rate limited:** yes (10 requests per 60 seconds).

**Request body**

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `username` | string, null, or omitted | No | If `undefined`, `null`, or the empty string `""`, no username is used (discoverable flow). Otherwise it must be a string that trims to 1 to 64 characters (see [Username validation](#username-validation)). A whitespace-only string is a non-empty value that trims to 0 characters and is rejected. |

**Responses**

| Status | Condition | Body |
| --- | --- | --- |
| `200` | Options generated and challenge stored. | `{ "challengeId": "<uuid>", "options": { ... } }` |
| `400` | Slug invalid (`webauthn.ts:303`). | `{ "ok": false, "error": "Invalid tenant slug" }` |
| `400` | `username` provided but invalid (`webauthn.ts:309`). | `{ "ok": false, "error": "username must be 1-64 characters" }` |
| `404` | No tenant with this slug (`webauthn.ts:315`). | `{ "ok": false, "error": "Unknown tenant" }` |
| `429` | Rate limit exceeded (`ratelimit.ts:16-18`). | `{ "ok": false, "error": "Too many requests" }` with `Retry-After: 60` |
| `500` | Any other exception (`webauthn.ts:339`). | `{ "ok": false, "error": "<message>" }` |

Behavior of the username lookup (`webauthn.ts:317-328`):

- If a username is given, the server looks up the user with that trimmed username in this tenant.
- If the user exists, `allowCredentials` lists that user's credentials (`id` and `transports`), and the challenge is bound to the user.
- If the user does not exist, no error is returned. `allowCredentials` is empty and the challenge is not bound to any user (`user_id` is `NULL`).
- If the user exists but has no credentials, `allowCredentials` is empty and the challenge is still bound to the user.
- If no username is given, `allowCredentials` is empty and the challenge is not bound to any user. This is the discoverable-credential flow.

`generateAuthenticationOptions` is called with `rpID` from `RP_ID`, the `allowCredentials` list above, and `userVerification: "required"` (`webauthn.ts:330-334`).

**Side effects (D1)**

1. `users`: read only. Nothing is created. Unlike `register/options`, no user is created here.
2. `credentials`: read only, to build `allowCredentials`.
3. `webauthn_challenges`: in one batch, deletes every row whose `expires_at` is at or before now, across all tenants, then inserts a row with `kind = 'login'`, `user_id` set to the matched user's id or `NULL`, and `expires_at = now + 5 minutes` (`webauthn.ts:102-121`, `336`).

**Example**

```sh
curl -sS -X POST http://localhost:5173/t/demo/api/v1/auth/login/options \
  -H "Content-Type: application/json" \
  -d '{"username":"alice"}'
```

For the discoverable flow, omit the username:

```sh
curl -sS -X POST http://localhost:5173/t/demo/api/v1/auth/login/options \
  -H "Content-Type: application/json" \
  -d '{}'
```

### POST /t/:slug/api/v1/auth/login/verify

Verifies an authentication response, updates the credential counter, and returns an access token.

**Rate limited:** no.

**Request body**

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `challengeId` | string | Yes | The `challengeId` from `login/options`. A non-string value is treated as an unknown challenge (`webauthn.ts:130`). |
| `response` | object | Yes | The WebAuthn authentication response (`AuthenticationResponseJSON`). Only checked to be a non-null object (`webauthn.ts:348`). The `response.id` field must be a string that matches a stored credential. |

**Responses**

| Status | Condition | Body |
| --- | --- | --- |
| `200` | Verification passed. See [Success response](#login-verify-success-response). | `{ "ok": true, "username": "<username>", "token": "<jwt>", "expiresAt": <ms epoch> }` |
| `400` | Slug invalid (`webauthn.ts:345`). | `{ "ok": false, "error": "Invalid tenant slug" }` |
| `400` | `response` is missing or not an object (`webauthn.ts:348`). | `{ "ok": false, "error": "response is required" }` |
| `400` | Challenge unknown, expired, already used, for another tenant, or not a `login` challenge (`webauthn.ts:355-357`). | `{ "ok": false, "error": "Unknown, expired or already used challenge" }` |
| `400` | `response.id` is not a string, or no credential with that id exists in this tenant (`webauthn.ts:362`). | `{ "ok": false, "error": "Unknown credential" }` |
| `400` | The challenge is bound to a user and the credential belongs to a different user (`webauthn.ts:363-365`). | `{ "ok": false, "error": "Credential does not belong to this username" }` |
| `400` | `response.response.userHandle` is present (not `undefined` or `null`) and does not equal the base64url encoding of the credential's user handle (`webauthn.ts:366-371`). | `{ "ok": false, "error": "User handle does not match credential" }` |
| `400` | Verification returned `verified: false` (`webauthn.ts:381`). | `{ "ok": false, "error": "Authentication not verified" }` |
| `404` | No tenant with this slug (`webauthn.ts:353`). | `{ "ok": false, "error": "Unknown tenant" }` |
| `429` | Not applicable; this endpoint is not rate limited. | n/a |
| `500` | Exception thrown, including those raised by `verifyAuthenticationResponse` for most failed checks (challenge mismatch, origin or RP ID mismatch, missing user verification, counter problems as reported by the library) and token signing errors such as a missing `kid` in `JWT_PRIVATE_JWK` (`webauthn.ts:398`, `jwt.ts:61`). | `{ "ok": false, "error": "<message>" }` |

Verification uses `expectedChallenge` from the stored row, `expectedOrigin` (see [Expected origin](#expected-origin)), `expectedRPID` from `RP_ID`, the stored credential (`id`, `publicKey`, `counter`, `transports`), and `requireUserVerification: true` (`webauthn.ts:373-380`). As with `register/verify`, the library throws for most failed checks, so those reach the `500` branch.

**Side effects (D1)**

1. `webauthn_challenges`: the row is deleted by `DELETE ... RETURNING` whenever it is found, even if a later check fails (`webauthn.ts:124-147`).
2. `credentials`: on success, `counter` is set to the authenticator's new counter and `last_used_at` to the current time, for the matching `(tenant_id, id)` (`webauthn.ts:383-388`).
3. `users`: not changed.
4. No token is stored. The token is not recorded in D1.

<a id="login-verify-success-response"></a>

**Success response**

```json
{
  "ok": true,
  "username": "alice",
  "token": "<header>.<payload>.<signature>",
  "expiresAt": 1767225600000
}
```

- `username` is the stored username of the matched user.
- `token` is an ES256-signed JWT (`webauthn.ts:390-395`, `jwt.ts:56-89`).
  - Header: `{ "alg": "ES256", "typ": "JWT", "kid": "<kid from JWT_PRIVATE_JWK>" }`.
  - Claims:
    - `iss`: `<request origin>/t/<slug>`, built from the request URL (`webauthn.ts:391`).
    - `aud`: `"aegisid-dashboard"` (`jwt.ts:2`, `webauthn.ts:392`).
    - `sub`: the user's id (UUID).
    - `preferred_username`: the stored username.
    - `iat`: issue time, in seconds since the epoch.
    - `exp`: `iat + 3600` (`jwt.ts:1`, `jwt.ts:66`).
    - `jti`: a random UUID.
  - The signing key is the private JWK in the `JWT_PRIVATE_JWK` environment binding.
- `expiresAt` is `exp * 1000`, the expiry as milliseconds since the epoch (`jwt.ts:87`).
- The token lifetime is 3600 seconds (one hour).

**Example**

Replace `<challengeId>` with the value from `login/options`, and replace the `response` placeholder with the JSON produced by the browser's authentication ceremony.

```sh
curl -sS -X POST http://localhost:5173/t/demo/api/v1/auth/login/verify \
  -H "Content-Type: application/json" \
  -d '{"challengeId":"<challengeId>","response":{ ... }}'
```

## Known limitations

- These endpoints are dev-only and unauthenticated. Anyone who can reach a host where `showDev` is enabled can create users and credentials in that tenant.
- The rate limit is approximate and is applied only to the two `options` endpoints.
- `register/options` creates a user before any credential exists, so an abandoned registration leaves a user row behind.
- Expired challenge rows are removed only when a new challenge is saved, and that cleanup covers all tenants.
