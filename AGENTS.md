# AGENTS.md

## Project

AegisID: self-hosted, multi-tenant OIDC identity provider with passkey-only login (WebAuthn/FIDO2). Early development; almost nothing is implemented yet (Worker has only `/healthz` and `/t/:slug/api/health`; `src/web` is still the Vite starter). The scope spec is `information_en.md`, which is NOT in the repo (a copy lives outside it). The design targets NIST SP 800-63B-4 AAL2. Never write code, docs or comments that claim AAL2 compliance or OIDC conformance. License is AGPL-3.0.

## Commands

Package manager is pnpm (version pinned in `packageManager`).

- `pnpm dev`: Vite dev server at http://localhost:5173 with the Worker running inside it via `@cloudflare/vite-plugin`. Use this for daily work, not `wrangler dev`.
- `pnpm build`: `tsc -b` then `vite build`. This is the only type-check; there are no `types`/`typecheck` scripts.
- `pnpm lint`: Oxlint (config in `.oxlintrc.json`).
- `pnpm preview` / `pnpm deploy`: build, then `wrangler dev` / `wrangler deploy`.
- No test runner is configured yet.
- If `pnpm install` reports `ERR_PNPM_IGNORED_BUILDS`, run `pnpm approve-builds` and allow `esbuild` and `workerd` (`pnpm-workspace.yaml` already sets `allowBuilds`).

## Architecture

One Cloudflare Worker serves one origin; tenancy is path-based: issuer is `https://<host>/t/{slug}`.

- `src/worker/index.ts`: Hono app (Worker entry, set as `main` in `wrangler.jsonc`). Tenant routes hang off `new Hono().basePath("/t/:slug")` and are mounted on the root app.
- `src/web/`: React SPA built by Vite, served as static assets.
- Routing split lives in `wrangler.jsonc` `assets`: `run_worker_first` lists the paths the Worker must answer (`/t/*/api/*`, `/t/*/.well-known/*`, `/healthz`); everything else falls to static assets, and `not_found_handling: "single-page-application"` returns the SPA for unknown paths (`/t/{slug}/login`, `/enroll`, `/recover`). A new Worker-handled route must be added to `run_worker_first` or the SPA will swallow it.
- Database (Cloudflare D1) is planned; no binding exists yet.

## Gotchas

- `tsconfig.app.json` includes all of `src` with `lib: DOM` and `types: ["vite/client"]`, so `src/worker` is type-checked without Workers types. Add them (e.g. `wrangler types` or `@cloudflare/workers-types`) before using bindings.
- `erasableSyntaxOnly` and `verbatimModuleSyntax` are on: no enums/namespaces/parameter properties; use `import type` for types.
- Security-sensitive areas (auth, OIDC, crypto, database access, migrations) need maintainer review. Secrets use `wrangler secret put` or the gitignored `.dev.vars`; never commit them.
- Commits are SSH-signed via Secretive. If signing fails with "No private key found", set `SSH_AUTH_SOCK` to the Secretive socket for that command.
