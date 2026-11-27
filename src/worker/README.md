# Worker (src/worker)

One Hono app is the Worker entry (`main` in `wrangler.jsonc` points at `src/worker/index.ts`). It shares one origin with the SPA. Tenancy is by path: tenant routes hang off `new Hono().basePath("/t/:slug")`.

Scope today: the OIDC endpoints are not implemented. There is no authorize, token, userinfo, JWKS or end-session handler, and the discovery path has no handler. The passkey routes are dev-only tests. Dev `login/verify` returns an access token (see [Access tokens](#access-tokens)), but no route checks one yet and there is no session or cookie.

## Which requests reach the Worker

Only paths in `assets.run_worker_first` (`wrangler.jsonc`) reach the Worker:

- `/t/*/api/*`
- `/t/*/.well-known/*`
- `/healthz`
- `/api/v1/dev/*`

Everything else goes to static assets. Because `not_found_handling` is `"single-page-application"`, an unknown path returns `index.html` with status 200.

A new route outside these prefixes fails quietly: clients get HTML. Add its prefix to `run_worker_first` in the same change. How OIDC paths will be chosen is open in [ADR 0003](../../docs/adr/0003-oidc-endpoint-paths.md).

## Route layout

- Root app (`index.ts`): `/healthz` and, in dev builds only, `/api/v1/dev/tenants` and `/api/v1/dev/token` (issue and verify an access token, `src/worker/dev/token.ts`).
- Tenant sub-app (`t`): `/t/:slug/api/v1/health` is always on. `/t/:slug/api/v1/email` and `/t/:slug/api/v1/auth` are dev only.
- Dev routes mount only when `showDev` is true: `import.meta.env.DEV`, or `VITE_SHOW_DEV=true` at build time. Dev routes have no authentication. Never set `VITE_SHOW_DEV=true` for a production build.

To add a tenant route, export a Hono instance from a module and mount it:

```ts
// src/worker/tenant-thing.ts
import { Hono } from "hono";
export const thing = new Hono<{ Bindings: Env }>();
thing.get("/", (c) => c.json({ tenant: c.req.param("slug") }));

// src/worker/index.ts
import { thing } from "./tenant-thing";
t.route("/api/v1/thing", thing);
```

`c.req.param("slug")` works inside mounted sub-apps, and the dev modules already rely on it. The router does not check the slug or that the tenant exists. Do that yourself (see Database).

## Bindings and config

- `Env` is a global interface generated into `worker-configuration.d.ts`. Run `pnpm cf-typegen` after you change a binding or var. Do not edit that file by hand.
- `DB` is D1. `EMAIL` is `send_email` with `remote: true`, so the dev email test sends real mail, even locally.
- Vars: `RP_NAME`, `RP_ID`, `RP_ORIGIN`.
- The `previews` block does not inherit `vars`, `d1_databases` or `send_email`. Repeat each one there. Previews use a separate D1 database.
- `.dev.vars` (gitignored) overrides `vars` locally. Start from `.dev.vars.example`.
- `RP_ID` is effectively permanent. See [ADR 0001](../../docs/adr/0001-rp-id.md).

## Database

- Use `c.env.DB`. Write SQL only with `prepare(...).bind(...)`. Never interpolate values into SQL.
- The schema is `migrations/0001_init.sql`. `tenants`, `users` and `webauthn_challenges` use UUID keys; `credentials` is keyed by `(tenant_id, credential ID)` ([ADR 0002](../../docs/adr/0002-tenancy-and-keys.md)).
- Resolve the slug to `tenant_id` first and return 404 if it is unknown. Then scope every query by `tenant_id`.
- Make IDs with `crypto.randomUUID()`. WebAuthn user handles are random bytes from `crypto.getRandomValues`.
- Idempotent create: `INSERT ... ON CONFLICT DO NOTHING`, then either check `meta.changes` (409 in `dev/tenants.ts`) or `SELECT` again (`getOrCreateUser` in `dev/webauthn.ts`).
- Single-use rows: `DELETE ... RETURNING` (see `takeChallenge`).
- Never edit an applied migration. Add a new numbered file, such as `migrations/0002_*.sql`.
- Apply locally with `pnpm exec wrangler d1 migrations apply DB --local`. The repo has no remote migration step. Deploy steps are still a TODO in `README.md`.

## Responses and errors

Failures use `{ ok: false, error: "..." }`:

- 400: input validation. Validate before any D1 call. Slugs match `/^[a-z0-9-]{1,63}$/`.
- 404: `Unknown tenant`.
- 409: conflict, such as `Slug already exists`.
- 500: a caught exception.

Success bodies differ by route (`{ ok: true, ... }`, `{ tenants: [...] }`, `{ challengeId, options }`).

Dev routes put the exception message in 500 bodies so the dev pages can show it. Production routes should not do that.

## Access tokens

`jwt.ts` signs and verifies ES256 JWTs with Web Crypto. Design and trade-offs: [ADR 0004](../../docs/adr/0004-access-token-signing.md).

- Needs secret `JWT_PRIVATE_JWK` (generate with `node scripts/gen-jwt-key.mjs`). A missing or bad key makes sign and verify throw, so routes return 500.
- `signAccessToken(env, { issuer, audience, userId, username })` returns `{ token, expiresAt }`. TTL is 60 minutes. Claims: `iss`, `aud`, `sub` (user UUID), `preferred_username`, `iat`, `exp`, `jti`.
- `verifyAccessToken(env, token, { issuer, audience })` returns `{ ok: true, claims }` or `{ ok: false, error }`. It does not throw on a bad token.
- `iss` is `<request origin>/t/{slug}`. `aud` is `DASHBOARD_AUDIENCE` (`aegisid-dashboard`).
- Dev callers: `POST /t/:slug/api/v1/auth/login/verify` (returns `token` and `expiresAt` after a passkey check), `POST /api/v1/dev/token` (`{ slug, userId }`, no passkey check) and `POST /api/v1/dev/token/verify` (`{ slug, token }`). Dev page: `/dev/token`.
- Tokens cannot be revoked before `exp`.

## WebAuthn

Library: `@simplewebauthn/server` v14, used in `dev/webauthn.ts`.

- Challenges are rows in `webauthn_challenges`. They expire after 5 minutes. Expired rows are pruned when a new one is saved.
- A challenge is deleted before it is checked. It is single use even if verification fails. The lookup then checks expiry, tenant and kind. A request with the wrong tenant or kind still uses up the challenge.
- Registration and login both set user verification to required.
- Login verify checks that the presented `userHandle` matches the credential's user. It also checks that the challenge's bound user, if any, matches.
- An unknown username gets a discoverable-credential challenge (empty `allowCredentials`) that is not bound to any user.
- `expectedOrigin()` handles previews. `RP_ORIGIN = "https://*.aegis.lmnfrs.org"` resolves to the request origin only when the host is one DNS label deep. Any other host returns the pattern, so verification fails closed.

## Type-checking

- `pnpm build` runs `tsc -b`, then `vite build`. This is the only type check.
- `tsconfig.worker.json`: lib ES2023, no DOM, `types: ["vite/client"]` for `import.meta.env`. It includes `worker-configuration.d.ts`, so runtime types such as `D1Database` come from there.
- `verbatimModuleSyntax` and `erasableSyntaxOnly` are on. Use `import type` for types. No enums, namespaces or parameter properties.
- `noUnusedLocals` and `noUnusedParameters` are on.

## Gotchas

- A route missing from `run_worker_first` returns the SPA's HTML with status 200.
- `/api/v1/dev/*` always reaches the Worker. In production its routes are not mounted, so requests get a 404.
- `/t/:slug/api/v1/health` does not check that the tenant exists. Do not copy it.
- Previews need every var and binding repeated under `previews`.
- Changing `RP_ID` after users register passkeys makes those passkeys unusable.
- Auth, OIDC, crypto, database access and migrations need maintainer review ([AGENTS.md](../../AGENTS.md)).
