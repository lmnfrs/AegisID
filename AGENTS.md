# AGENTS.md

## Project

AegisID: self-hosted, multi-tenant OIDC identity provider with passkey-only login (WebAuthn/FIDO2). Early development.

- Implemented: Worker `/healthz` and `/t/:slug/api/v1/health`; public home page at `/`.
- Dev-only tooling under `/dev`: tenants and users lists, passkey test on D1, token issue and verify, email test. Not for production.
- `docs/adr/` holds architecture decision records; index in `docs/README.md`.
- The scope spec is `information_en.md`, which is NOT in the repo (a copy lives outside it). The design targets NIST SP 800-63B-4 AAL2. Never write code, docs or comments that claim AAL2 compliance or OIDC conformance. License is AGPL-3.0.

## Commands

Package manager is pnpm (version pinned in `packageManager`).

- `pnpm dev`: Vite dev server at http://localhost:5173 with the Worker running inside it via `@cloudflare/vite-plugin`. Use this for daily work, not `wrangler dev`.
- `pnpm build`: `tsc -b` then `vite build`. This is the only type-check; there are no `types`/`typecheck` scripts.
- `pnpm lint`: Oxlint (config in `.oxlintrc.json`).
- `pnpm cf-typegen`: `wrangler types`, regenerates `worker-configuration.d.ts`. Rerun after changing bindings or vars.
- `pnpm preview` / `pnpm deploy`: build, then `wrangler dev` / `wrangler deploy`.
- No test runner is configured yet.
- Local config: copy `.dev.vars.example` to `.dev.vars` (gitignored) before first use.
- Local D1: `pnpm exec wrangler d1 migrations apply DB --local` applies `migrations/` to the local database used by `pnpm dev`.
- If `pnpm install` reports `ERR_PNPM_IGNORED_BUILDS`, run `pnpm approve-builds` and allow `esbuild` and `workerd` (`pnpm-workspace.yaml` already sets `allowBuilds`).

## Architecture

One Cloudflare Worker serves one origin; tenancy is path-based: issuer is `https://<host>/t/{slug}`.

- `src/worker/index.ts`: Hono app (Worker entry, set as `main` in `wrangler.jsonc`). Tenant routes hang off `new Hono().basePath("/t/:slug")` and are mounted on the root app.
- Dev routes are mounted only when `showDev` (`import.meta.env.DEV || import.meta.env.VITE_SHOW_DEV === "true"`). They have NO auth:
  - `/t/:slug/api/v1/email/*`: `src/worker/dev/email.ts`
  - `/t/:slug/api/v1/auth/*`: `src/worker/dev/webauthn.ts`
  - `/api/v1/dev/tenants[/:slug/users]`: `src/worker/dev/tenants.ts`
  - `/api/v1/dev/token[/verify]`: `src/worker/dev/token.ts`
- Access tokens: ES256 JWTs from `src/worker/jwt.ts`, 60 minutes, signed with the private JWK in secret `JWT_PRIVATE_JWK` (`node scripts/gen-jwt-key.mjs`). The dev passkey `login/verify` route returns one. See `docs/adr/0004-access-token-signing.md`. Nothing verifies them on a route yet.
- Rate limiting: `authRateLimit` in `src/worker/ratelimit.ts` (binding `AUTH_LIMITER`, 10/min per tenant + IP, fails open) guards `register/options` and `login/options`. Apply it to any new public auth route. See `docs/adr/0005-rate-limiting.md`.
- Types: use the global `Env` from generated `worker-configuration.d.ts`. There is no hand-written Bindings type.
- `src/web/`: React SPA built by Vite, served as static assets.
- Routing split lives in `wrangler.jsonc` `assets`: `run_worker_first` lists the paths the Worker must answer (`/t/*/api/*`, `/t/*/.well-known/*`, `/healthz`, `/api/v1/dev/*`); everything else falls to static assets, and `not_found_handling: "single-page-application"` returns the SPA for unknown paths (`/t/{slug}/login`, `/enroll`, `/recover`). A new Worker-handled route must be added to `run_worker_first` or the SPA will swallow it.
- SPA: react-router-dom v7 `BrowserRouter` in `src/web/App.tsx`. `/` (Home) is public. All dev pages are children of the dev-gated `/dev` route, rendered in `DevLayout`'s `<Outlet />`, and each is lazy-loaded with `React.lazy`. The route, nav, and index entries come from `src/web/pages/dev/devPages.ts`. Internal links use `<Link>`/`<NavLink>`, never `<a href>`.
- UI: shared components live in `src/web/components/ui.tsx`; import them in one statement from `'../components/ui'`.
- `DataTable` lives in its own module `src/web/components/DataTable.tsx`. Keep it out of `ui.tsx`, and import it only from lazy-loaded pages so DataTables never lands in the main bundle.
- WebAuthn config: `RP_NAME`/`RP_ID`/`RP_ORIGIN` in `wrangler.jsonc` `"vars"` (production) and `"previews.vars"`. Previews run on `<branch>.aegis.lmnfrs.org`; their `RP_ORIGIN` is `https://*.aegis.lmnfrs.org`, which `expectedOrigin()` in `webauthn.ts` resolves per request to exactly one DNS label. Locally, `.dev.vars` overrides `vars`.
- Database: Cloudflare D1 is bound as `DB`; migrations live in `migrations/`. Schema is in `migrations/0001_init.sql` (tenants, users, credentials, webauthn_challenges).
  - tenants, users and webauthn_challenges use UUID TEXT ids. credentials are keyed by `(tenant_id, id)`, where `id` is the WebAuthn credential ID.
  - `tenants.slug` and `users.username` (unique per tenant) are unique columns, not keys. Tenant-scoped child rows carry `tenant_id`.
  - Challenges are single-use via `DELETE ... RETURNING`. SQL only through `prepare().bind()`.

## Gotchas

- `tsconfig.app.json` covers `src/web` only (`lib: DOM`, `types: ["vite/client"]`). `tsconfig.worker.json` covers `src/worker` and `worker-configuration.d.ts`. `pnpm build` checks both.
- `erasableSyntaxOnly` and `verbatimModuleSyntax` are on: no enums/namespaces/parameter properties; use `import type` for types.
- `previews.*` bindings and vars are NOT inherited from the top level: repeat every binding and var under `"previews"`.
- Never edit a migration that has been applied anywhere; add a new numbered one.
- `RP_ID` is effectively permanent: changing it invalidates every registered passkey.
- Dev routes have no auth: never build or deploy with `VITE_SHOW_DEV=true` on a public origin.
- New Worker paths outside `run_worker_first` get swallowed by the SPA fallback. Future OIDC endpoints must be covered too; see `docs/adr/0003-oidc-endpoint-paths.md`.
- React StrictMode (`src/web/main.tsx`) double-runs effects in dev, so pages must not fetch from D1 on mount. Dev pages load tenants on user action via the cache in `src/web/lib/tenants.ts`.
- `DataTable.use(DT)` needs an inline oxlint `rules-of-hooks` disable (false positive: `use` is not a React hook).
- Security-sensitive areas (auth, OIDC, crypto, database access, migrations) need maintainer review. Secrets use `wrangler secret put` or the gitignored `.dev.vars`; never commit them.
- Commits are SSH-signed via Secretive. If signing fails with "No private key found", set `SSH_AUTH_SOCK` to the Secretive socket for that command.
