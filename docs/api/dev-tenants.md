# Dev Tenants API

> **DEV-ONLY. NO AUTHENTICATION.**
>
> These endpoints are for local development only. They perform no authentication or authorization, and anyone who can reach the worker can list tenants, list users, and create tenants. Real tenant administration requires admin authentication, which is not implemented here.

Source: `src/worker/dev/tenants.ts`. Mounted by `src/worker/index.ts`.

## Overview

| Method | Path | Purpose | Success status |
|--------|------|---------|----------------|
| GET | `/api/v1/dev/tenants` | List all tenants | 200 |
| POST | `/api/v1/dev/tenants` | Create a tenant | 201 |
| GET | `/api/v1/dev/tenants/:slug/users` | List users of one tenant | 200 |

Base URL used in the examples: `http://localhost:5173`.

## Mounting and availability

- `src/worker/index.ts` mounts the router with `app.route("/api/v1/dev/tenants", devTenants)`.
- The mount is conditional: `const showDev = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEV === "true";`. When `showDev` is false, these routes are not registered. This file does not define the response for an unregistered path. `wrangler.jsonc` sets `assets.not_found_handling` to `"single-page-application"`, but that setting was not traced for these paths.
- `wrangler.jsonc` lists `"/api/v1/dev/*"` in `assets.run_worker_first`, so requests under `/api/v1/dev/` are routed to the Worker rather than served as static assets. This pattern covers both `/api/v1/dev/tenants` and `/api/v1/dev/tenants/:slug/users`.

## Storage

Database binding: `DB` (D1). Schema source: `migrations/0001_init.sql`.

| Table | Columns used | Used by |
|-------|--------------|---------|
| `tenants` | `id`, `slug`, `name`, `created_at` | GET list (read), GET users (read, slug lookup), POST create (write) |
| `users` | `id`, `tenant_id`, `username`, `created_at` | GET users (read) |
| `credentials` | `tenant_id`, `user_id`, `id`, `last_used_at` | GET users (read, `LEFT JOIN` and aggregates) |

The `tenants` table has `slug TEXT NOT NULL UNIQUE`. The `users` table has `UNIQUE (tenant_id, username)`. The `credentials` table has `PRIMARY KEY (tenant_id, id)` and `FOREIGN KEY (tenant_id, user_id) REFERENCES users (tenant_id, id)`.

The `users` query never reads `user_handle` or `public_key`. The handler does not read or write `webauthn_challenges`.

No statement in this file uses a transaction.

## Common error shape

Error responses from these routes use the JSON body:

```json
{ "ok": false, "error": "<message>" }
```

Success responses for `GET` and `POST` do not include `ok`. The response shapes are documented per endpoint below.

---

## 1. List tenants

### Request

- **Method and path:** `GET /api/v1/dev/tenants`
- **Path parameters:** none
- **Query parameters:** none (the handler does not read the query string)
- **Body:** none

### Behavior

Runs:

```sql
SELECT id, slug, name, created_at FROM tenants ORDER BY slug
```

Each row is mapped to a tenant object. Fields are renamed: `created_at` becomes `createdAt`. Rows are returned in ascending `slug` order.

### Responses

| Status | Condition | Body |
|--------|-----------|------|
| 200 | The query succeeds. An empty table yields an empty array. | `{ "tenants": [ { "id": string, "slug": string, "name": string, "createdAt": number } ] }` |
| 500 | Any error is thrown inside the `try` block, for example a D1 query failure. | `{ "ok": false, "error": string }`, where `error` is the thrown error's `message`, or `String(error)` if the thrown value is not an `Error`. |

### Tables

- Read: `tenants`.
- Written: none.

### curl

```bash
curl -i http://localhost:5173/api/v1/dev/tenants
```

Example 200 body (values are illustrative):

```json
{
  "tenants": [
    { "id": "7f1c2d3e-0000-4000-8000-000000000001", "slug": "acme", "name": "Acme Corp", "createdAt": 1764200000000 }
  ]
}
```

---

## 2. Create tenant

### Request

- **Method and path:** `POST /api/v1/dev/tenants`
- **Path parameters:** none
- **Query parameters:** none
- **Body:** JSON object with the following fields. The handler parses the body with `c.req.json()` and does not check `Content-Type`.

| Field | Type | Required | Validation as coded |
|-------|------|----------|---------------------|
| `slug` | string | yes | Must be a string (`typeof input.slug === "string"`) and must match `/^[a-z0-9-]{1,63}$/`. The value is not trimmed. A non-string value is treated as `""`, which fails the pattern. |
| `name` | string | yes | Must be a string. The value is trimmed with `String.prototype.trim()`. After trimming, its length (`.length`, UTF-16 code units) must be between 1 and 100 inclusive. A non-string value is treated as `""`, which fails the length check. |

Body parsing behavior:

- If the body is not valid JSON, or the request has no body, `c.req.json()` rejects and the handler substitutes `null`. The `?? {}` fallback then makes `input` an empty object. The slug check then fails, so the response is the `Invalid tenant slug` 400, not a parse-error message.
- If the body is valid JSON but not an object (for example a string, array, or `null`), the fields are `undefined`, so the slug check fails with the same `Invalid tenant slug` 400.
- Extra fields are ignored.

Validation order: slug is checked first, then name. Only the first failing check produces a response.

### Behavior

1. Generates `id` with `crypto.randomUUID()`.
2. Sets `createdAt` to `Date.now()` (milliseconds since epoch).
3. Runs:

   ```sql
   INSERT INTO tenants (id, slug, name, created_at) VALUES (?, ?, ?, ?)
   ON CONFLICT (slug) DO NOTHING
   ```

4. If `result.meta.changes === 0`, the slug already existed and nothing was inserted. The handler returns 409.
5. Otherwise the handler returns 201 with the new tenant.

### Responses

| Status | Condition | Body |
|--------|-----------|------|
| 201 | Slug is valid, name is valid, and the insert changed one row. | `{ "ok": true, "tenant": { "id": string, "slug": string, "name": string, "createdAt": number } }` |
| 400 | `slug` is missing, not a string, or does not match `/^[a-z0-9-]{1,63}$/`. Also returned when the body is not a JSON object. | `{ "ok": false, "error": "Invalid tenant slug" }` |
| 400 | `slug` is valid but `name`, after trimming, is missing, not a string, empty, or longer than 100 characters. | `{ "ok": false, "error": "name must be 1-100 characters" }` |
| 409 | `slug` is valid and `name` is valid, but a tenant with the same `slug` already exists (the insert changed zero rows). | `{ "ok": false, "error": "Slug already exists" }` |
| 500 | Any error is thrown inside the `try` block, for example a D1 failure. | `{ "ok": false, "error": string }` |

The `name` in the 201 response is the trimmed value. The `slug` is stored and returned exactly as sent.

### Tables

- Read: none.
- Written: `tenants` (one `INSERT`, which does nothing on slug conflict).

### curl

Create a tenant:

```bash
curl -i -X POST http://localhost:5173/api/v1/dev/tenants \
  -H "Content-Type: application/json" \
  -d '{"slug":"acme","name":"Acme Corp"}'
```

Example 201 body (values are illustrative):

```json
{
  "ok": true,
  "tenant": {
    "id": "7f1c2d3e-0000-4000-8000-000000000001",
    "slug": "acme",
    "name": "Acme Corp",
    "createdAt": 1764200000000
  }
}
```

Invalid slug (400):

```bash
curl -i -X POST http://localhost:5173/api/v1/dev/tenants \
  -H "Content-Type: application/json" \
  -d '{"slug":"Acme_Corp","name":"Acme Corp"}'
```

Duplicate slug (409): run the 201 example a second time.

---

## 3. List users of a tenant

### Request

- **Method and path:** `GET /api/v1/dev/tenants/:slug/users`
- **Path parameters:**

| Name | Type | Validation as coded |
|------|------|---------------------|
| `slug` | string | Read with `c.req.param("slug")`. Must match `/^[a-z0-9-]{1,63}$/`, otherwise the handler returns 400. |

- **Query parameters:** none
- **Body:** none

### Behavior

1. Validates `slug` against the pattern. Failure returns 400 and no database query runs.
2. Looks up the tenant:

   ```sql
   SELECT id FROM tenants WHERE slug = ?
   ```

   If no row is found, the handler returns 404.
3. Lists the tenant's users, with credential counts and the most recent credential use:

   ```sql
   SELECT u.id, u.username, u.created_at,
          COUNT(c.id) AS credential_count, MAX(c.last_used_at) AS last_used_at
   FROM users u
   LEFT JOIN credentials c ON c.tenant_id = u.tenant_id AND c.user_id = u.id
   WHERE u.tenant_id = ?
   GROUP BY u.id
   ORDER BY u.username
   ```

   The bound value is the tenant `id` from step 2.

The response never includes `user_handle` or `public_key`.

Field mapping: `created_at` becomes `createdAt`, `credential_count` becomes `credentialCount`, and `last_used_at` becomes `lastUsedAt`. `lastUsedAt` is `null` when the user has no credentials, or when none of the user's credentials has a non-null `last_used_at`. The handler applies `?? null` to the value.

Units of `createdAt` and `lastUsedAt` are whatever the writers stored. This file does not write credentials, and the users table is written by other code, so the unit is not defined here.

### Responses

| Status | Condition | Body |
|--------|-----------|------|
| 200 | Slug is valid and a tenant with that slug exists. A tenant with no users yields an empty array. | `{ "users": [ { "id": string, "username": string, "createdAt": number, "credentialCount": number, "lastUsedAt": number \| null } ] }` |
| 400 | `slug` does not match `/^[a-z0-9-]{1,63}$/`. Uppercase letters, underscores, dots, and any other characters are rejected. | `{ "ok": false, "error": "Invalid tenant slug" }` |
| 404 | The slug matches the pattern but no tenant has that slug. | `{ "ok": false, "error": "Unknown tenant" }` |
| 500 | Any error is thrown inside the `try` block, for example a D1 failure during either query. | `{ "ok": false, "error": string }` |

Rows are ordered by `username` in SQL collation order. Each user appears once because of `GROUP BY u.id`.

### Tables

- Read: `tenants` (slug lookup), `users` (listing), `credentials` (`LEFT JOIN`, `COUNT`, `MAX`).
- Written: none.

### curl

```bash
curl -i http://localhost:5173/api/v1/dev/tenants/acme/users
```

Example 200 body (values are illustrative):

```json
{
  "users": [
    {
      "id": "9a8b7c6d-0000-4000-8000-000000000002",
      "username": "alice",
      "createdAt": 1764200500000,
      "credentialCount": 1,
      "lastUsedAt": 1764201000000
    },
    {
      "id": "9a8b7c6d-0000-4000-8000-000000000003",
      "username": "bob",
      "createdAt": 1764200600000,
      "credentialCount": 0,
      "lastUsedAt": null
    }
  ]
}
```

Unknown tenant (404):

```bash
curl -i http://localhost:5173/api/v1/dev/tenants/does-not-exist/users
```

Invalid slug (400):

```bash
curl -i "http://localhost:5173/api/v1/dev/tenants/Acme/users"
```

---

## Notes and limitations

- These routes are development tools. They are not an admin API, and they do not implement the protections that a production tenant-management API would need.
- No AAL2 (multi-factor) compliance is claimed for these routes, and no OpenID Connect conformance is claimed.
- The 500 responses return the raw error message from the thrown exception. This can expose internal details, which is acceptable only for local development.
- The handler does not check that a tenant's `name` is unique. Only `slug` is unique.
- The `name` length limit counts UTF-16 code units (`String.prototype.length`), not user-perceived characters.
