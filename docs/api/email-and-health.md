# API reference: dev email route and health routes

This document describes the HTTP behavior implemented in:

- `src/worker/dev/email.ts` (email test route, dev only)
- `src/worker/index.ts` (health routes and the dev-only mount of the email route)

Examples use the local development origin `http://localhost:5173`. Every response body is described from the handler code. No other behavior is documented.

## Route summary

| Method | Path | Gate | Auth | Purpose |
| --- | --- | --- | --- | --- |
| GET | `/healthz` | Always on | None | Worker liveness text |
| GET | `/t/:slug/api/v1/health` | Always on | None | Tenant health JSON |
| POST | `/t/:slug/api/v1/email/test` | **DEV-ONLY** | **None** | Sends a welcome test email |

## Dev gate

`src/worker/index.ts` computes:

```ts
const showDev =
  import.meta.env.DEV || import.meta.env.VITE_SHOW_DEV === "true";
```

The email route is mounted only when `showDev` is true:

```ts
if (showDev) t.route("/api/v1/email", devEmail);
```

When `showDev` is false, a request to `/t/:slug/api/v1/email/test` does not reach `devEmail`. The Worker's default not-found handler responds with status `404` and the plain-text body `404 Not Found`.

The health routes are registered unconditionally and are not affected by this gate.

## Authentication

**The email route has no authentication.** The handler in `src/worker/dev/email.ts` contains this comment:

```
// TODO: Require authenticated admin access.
// Do not expose this endpoint publicly.
```

No auth middleware, rate limiter, or access check is applied to the email route in the code. The health routes also perform no authentication. The health route does not check that the tenant exists.

---

## Health routes

### GET /healthz

Worker liveness check. Registered on the root application, outside the tenant sub-app.

**Request**

- No body, no query parameters, no required headers.

**Response**

| Status | Content-Type | Body | Condition |
| --- | --- | --- | --- |
| `200` | `text/plain` (set by Hono `c.text`) | `ok` | Always, for a `GET` request that reaches the Worker |

Other methods on this path are not registered (`app.get` only). They fall through to the default not-found response, `404` with body `404 Not Found`.

**Example**

```sh
curl -i http://localhost:5173/healthz
```

Expected output body: `ok`

---

### GET /t/:slug/api/v1/health

Tenant-scoped health check. Registered on the `/t/:slug` sub-app.

**Path parameters**

| Name | Type | Description |
| --- | --- | --- |
| `slug` | string | Tenant slug, read as `c.req.param("slug")`. The handler does not validate its format and does not look it up. |

**Request**

- No body, no query parameters, no required headers.

**Response**

| Status | Content-Type | Body | Condition |
| --- | --- | --- | --- |
| `200` | `application/json` | `{ "ok": true, "tenant": "<slug>" }` | Always, for a `GET` request that reaches the Worker |

Fields:

| Field | Type | Value |
| --- | --- | --- |
| `ok` | boolean | Always `true` |
| `tenant` | string | The `slug` path parameter, echoed as received by the router |

Other methods on this path are not registered. They fall through to the default not-found response, `404` with body `404 Not Found`.

**Side effects:** none.

**Example**

```sh
curl -i http://localhost:5173/t/acme/api/v1/health
```

Expected body:

```json
{"ok":true,"tenant":"acme"}
```

---

## Dev-only email route

**DEV-ONLY. NO AUTHENTICATION.** This route is mounted only when `import.meta.env.DEV` is true or `VITE_SHOW_DEV` equals `"true"`. It must not be exposed on a deployment that does not intend to serve it.

### POST /t/:slug/api/v1/email/test

Sends one fixed welcome message to the address given in the request body. The message is sent through the `EMAIL` `send_email` binding.

**Path parameters**

| Name | Type | Validation |
| --- | --- | --- |
| `slug` | string | Must match `^[a-z0-9-]{1,63}$`. Checked before the body is read. Otherwise `400`. |

**Request headers**

- `Content-Type: application/json` is recommended. The handler reads the body with `c.req.json()` and does not check the `Content-Type` header.

**Request body (JSON object)**

| Field | Type | Required | Validation as coded |
| --- | --- | --- | --- |
| `to` | string | Yes (effectively) | Read as a string only. Non-string values are treated as an empty string. The value is trimmed with `String.prototype.trim()`. It must be at most 254 characters (checked with `.length` after trimming). It must match the regular expression below. Otherwise `400`. |
| `name` | string | No | If not a string, treated as an empty string. Every character not in the allowlist is removed. The result is trimmed, truncated to 64 characters with `.slice(0, 64)`, and replaced with `AegisID` if empty. |

Regular expression applied to `to`:

```
^[^\s@,;<>()[\]\\":]+@[^\s@,;<>()[\]\\":]+\.[^\s@,;<>()[\]\\":]+$
```

In words: exactly one `@`, a non-empty local part and domain without whitespace, `@`, `,`, `;`, `<`, `>`, `(`, `)`, `[`, `]`, `\`, `"`, or `:`, and a domain that contains a `.` with non-empty text on both sides of it. Display names, lists, and quoted forms are rejected.

Allowlist applied to `name`: Unicode letters (`\p{L}`), Unicode digits (`\p{N}`), space, `.`, `'`, `_`, `-`. Any other character is removed before trimming and truncation.

The sender address is fixed. The `From` header is built as:

```
<name> <aegis@lmnfrs.org>
```

If the body is not valid JSON, the handler treats the body as `{}`. That leads to `to` being empty and a `400` response.

**Fixed message content**

| Field | Value |
| --- | --- |
| Subject | `Welcome to <slug>!` (the validated path slug) |
| HTML body | `<h1>Welcome!</h1><p>Thanks for signing up.</p>` |
| Text body | `Welcome! Thanks for signing up.` |

The request body cannot change the subject, HTML body, or text body.

**Responses**

| Status | Body | Condition |
| --- | --- | --- |
| `200` | `{ "ok": true, "messageId": "<id>" }` | `c.env.EMAIL.send(...)` resolved. `messageId` is copied from the send result. If the result has no `messageId`, the field is omitted from the JSON. |
| `400` | `{ "ok": false, "error": "Invalid tenant slug" }` | The `slug` path parameter does not match `^[a-z0-9-]{1,63}$`. Checked first. |
| `400` | `{ "ok": false, "error": "A single valid recipient 'to' is required" }` | `to` is missing, not a string, empty after trimming, longer than 254 characters, or fails the regular expression. |
| `500` | `{ "ok": false, "error": "Email sending failed: <detail>" }` | `c.env.EMAIL.send(...)` threw. `<detail>` is `error.message` when the thrown value is an `Error`, otherwise `String(error)`. The error is also logged with `console.error`. |
| `500` | `Internal Server Error` (plain text, Hono default) | The body is JSON `null`. The handler then reads a property of `null` outside the `try` block, which throws. No custom error handler is registered in `src/worker/index.ts`. |

Status codes not listed above are not produced by this handler.

**Side effects**

- Each request that passes validation calls `c.env.EMAIL.send(...)` once. This sends a real email to `to`.
- The `EMAIL` binding is declared in `wrangler.jsonc` under `send_email` with `"remote": true`, both at the top level and under `previews`. The send therefore goes to the remote binding, not a local stub, in both local development and deployed environments.
- No database writes. No rate limiting is applied in this handler.

**Examples**

Successful send:

```sh
curl -i -X POST http://localhost:5173/t/acme/api/v1/email/test \
  -H 'Content-Type: application/json' \
  -d '{"to":"user@example.com","name":"Support Team"}'
```

Response body shape (`messageId` value depends on the provider):

```json
{"ok":true,"messageId":"<id>"}
```

Invalid recipient (`400`):

```sh
curl -i -X POST http://localhost:5173/t/acme/api/v1/email/test \
  -H 'Content-Type: application/json' \
  -d '{"to":"not-an-address"}'
```

```json
{"ok":false,"error":"A single valid recipient 'to' is required"}
```

Invalid slug (`400`):

```sh
curl -i -X POST http://localhost:5173/t/Acme_Corp/api/v1/email/test \
  -H 'Content-Type: application/json' \
  -d '{"to":"user@example.com"}'
```

```json
{"ok":false,"error":"Invalid tenant slug"}
```

Route not mounted (gate off), for reference:

```
404 Not Found
```
