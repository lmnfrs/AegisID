# 0002. Path-based tenancy and UUID keys

- Status: Accepted
- Date: 2026-11-16

## Context

AegisID is a multi-tenant identity provider. Each tenant has its own OIDC issuer. Tenant slugs and usernames may be renamed, but OIDC clients identify a user by the `sub` claim, which must stay stable across renames.

## Decision

- One origin. The tenant is in the path, and the issuer is `https://<host>/t/{slug}`. The Hono router mounts tenant routes on `basePath("/t/:slug")` in `src/worker/index.ts`.
- The D1 schema in `migrations/0001_init.sql` uses UUID values as primary keys for `tenants`, `users` and `webauthn_challenges`, generated with `crypto.randomUUID()` (see `src/worker/dev/tenants.ts` and `src/worker/dev/webauthn.ts`).
- `credentials` has a composite primary key `(tenant_id, id)`. Its `id` is the WebAuthn credential ID, which is an opaque value and not a UUID.
- `tenants.slug` is `UNIQUE`. `users` has `UNIQUE (tenant_id, username)`.
- Child rows carry `tenant_id`. `credentials` references users through the composite foreign key `(tenant_id, user_id) -> users (tenant_id, id)`, so a credential cannot point at another tenant's user.
- The WebAuthn user handle is a separate random 32-byte value (`crypto.getRandomValues`), stored in `users.user_handle`. It is not the user UUID.
- Intent, not implemented: the user UUID is the future OIDC `sub` claim.

## Consequences

- A rename of a username or other non-key field is a single-row update, and existing foreign keys do not change.
- Renaming a tenant slug changes the tenant's issuer URL. This breaks every configured client of that tenant. A slug rename must be a deliberate admin action, not a side effect of an edit.
- Usernames are case-sensitive today. `parseUsername` trims whitespace but does not lowercase, and the column has no `COLLATE NOCASE`. So `Alice` and `alice` are two users. Open follow-up: decide on normalisation before OIDC relies on usernames.
- Text UUIDs are larger than binary keys and index less compactly. They are easier to read in logs and the D1 console, which is the trade we accept.
- The `sub` stability promise depends on the user UUID never being reused or regenerated. Nothing in the schema prevents deleting and recreating a user, so the admin flows that can delete users must be designed with this in mind.
