# AegisID

A self-hosted, multi-tenant OpenID Connect identity provider with passkey-only login (WebAuthn/FIDO2).

> **Early development. Not production-ready. Not security-audited.**
> Do not use it to protect real accounts.

## Goals and scope

The list below is **planned**. Today the repo has a health endpoint, a public home page at `/`, and dev-only tooling: tenant and user lists, a passkey register and sign-in test backed by D1, and an email send test. None of this is real authentication. See [Project structure](#project-structure).

- Multi-tenant organizations, with tenant isolation (planned)
- OpenID Connect (OIDC) Authorization Code flow with PKCE (planned)
- Single Sign-On across registered applications (planned)
- Passkey-only login. There is no password login (planned)
- User, role and application management, with Admin and Standard User roles (planned)
- First-time enrollment: identity check, enrollment magic link, passkey and TOTP registration (planned)
- Account recovery: email magic link plus a previously enrolled TOTP code (planned)
- Audit logs and automated tests (planned)

### Compliance

The design targets NIST SP 800-63B-4 AAL2 (an assurance level for multi-factor authentication). AegisID does **not** claim AAL2 compliance, certification or OIDC conformance. Using passkeys alone does not make a system compliant.

## Tech stack

Only what the code uses today:

- [Cloudflare Workers](https://developers.cloudflare.com/workers/): runs the server code
- [Hono](https://hono.dev): web framework for the Worker routes
- [React](https://react.dev) 19 and [react-router-dom](https://reactrouter.com): single-page app, built with [Vite](https://vite.dev) and served as Worker static assets
- [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite): database, bound as `DB`
- [Cloudflare Email Sending](https://developers.cloudflare.com/email-service/): bound as `EMAIL`
- [SimpleWebAuthn](https://simplewebauthn.dev) (`@simplewebauthn/server` and `@simplewebauthn/browser`, v14): passkey registration and sign-in
- [DataTables](https://datatables.net) (`datatables.net-react`, `datatables.net-dt`): tables on the dev pages
- [TypeScript](https://www.typescriptlang.org), [Oxlint](https://oxc.rs) and [Wrangler](https://developers.cloudflare.com/workers/wrangler/)
- [pnpm](https://pnpm.io): package manager

## Architecture

One Worker serves one origin. Tenants are separated by path: `/t/{slug}/...`. The issuer URL format is `https://<host>/t/{slug}`.

| Route | Handled by | Status |
| --- | --- | --- |
| `/healthz` | Worker | Returns `ok` |
| `/t/{slug}/api/health` | Worker | Returns `{ "ok": true, "tenant": "<slug>" }` |
| `/t/{slug}/api/email/*`, `/t/{slug}/api/auth/*`, `/api/dev/tenants*` | Worker | Dev-only. See [Dev routes](#dev-routes) |
| `/t/{slug}/.well-known/*` | Worker | Planned. Returns 404 today |
| `/`, `/dev/*` | SPA (static assets) | Home page and dev pages |
| Any other path | SPA (static assets) | Falls back to the SPA page |

In [wrangler.jsonc](wrangler.jsonc), `run_worker_first` lists the paths that go to the Worker before the static-assets lookup. `not_found_handling: "single-page-application"` returns the SPA for every other unknown path. A new Worker route must be added to `run_worker_first`, or the SPA will answer it.

## Local development

Prerequisites:

- Node.js. Verified with v26.8.1. `package.json` has no `engines` field.
- pnpm 12.21.0, from the `packageManager` field in `package.json`. Corepack can install it: `corepack enable`.

```sh
git clone https://github.com/lmnfrs/AegisID.git
cd AegisID
pnpm install
cp .dev.vars.example .dev.vars
pnpm exec wrangler d1 migrations apply DB --local
pnpm dev
```

Then open <http://localhost:5173/dev>.

- `pnpm install` may fail with `ERR_PNPM_IGNORED_BUILDS`. If it does, run `pnpm approve-builds` and allow `esbuild` and `workerd`. This is already set in `pnpm-workspace.yaml`. Both packages need native binaries. esbuild is the JavaScript bundler. workerd is the Workers runtime used locally.
- `.dev.vars` sets `RP_NAME`, `RP_ID` and `RP_ORIGIN` for local work. Values in `.dev.vars` override the `vars` in `wrangler.jsonc`. `.dev.vars` is gitignored. `.dev.vars.example` is not secret and is committed.
- Passkeys work locally only at <http://localhost:5173>. Do not use `127.0.0.1` or a LAN IP. The passkey origin must match `RP_ORIGIN`.
- `pnpm dev` is the daily command. Do not use `wrangler dev` for daily work.
- The `EMAIL` binding is set to `remote: true`. The email test sends real mail, even in local development.

### Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` | Start the Vite dev server with the Worker at <http://localhost:5173> |
| `pnpm build` | Type-check with `tsc -b`, then build with Vite. This is the only type-check. |
| `pnpm lint` | Run Oxlint (config in `.oxlintrc.json`) |
| `pnpm cf-typegen` | Run `wrangler types` to regenerate `worker-configuration.d.ts`. Run it after you change bindings or `vars` |
| `pnpm preview` | Build, then run `wrangler dev` on the build |
| `pnpm deploy` | Build, then run `wrangler deploy` |

No test runner is configured yet.

## Dev routes

> **Dev routes have no authentication.** They can create tenants, list users, run a passkey test and send email. They must never be enabled in production.

The routes are mounted only when `import.meta.env.DEV` is true (the dev server) or when the build sets `VITE_SHOW_DEV=true`. A build with `VITE_SHOW_DEV=true` exposes them. Do not set it for a production build.

The dev pages are at `/dev/*`. The Worker routes are in `src/worker/dev/`.

## Project structure

```text
src/
  worker/
    index.ts      Hono app and route mounting
    dev/          Dev-only routes: tenants.ts, webauthn.ts, email.ts
  web/
    App.tsx       Routes: home page and the /dev shell
    main.tsx      React entry point
    pages/        Home.tsx and the dev pages (lazy-loaded), devPages.ts
    components/   ui.tsx (shared UI), DataTable.tsx
    lib/          Client helpers (tenants.ts)
migrations/       D1 SQL migrations (0001_init.sql)
docs/             Design decisions. See docs/README.md
public/           Static files
wrangler.jsonc    Worker, assets, D1, email and vars config
vite.config.ts    Vite with the React and Cloudflare plugins
```

<!-- TODO(maintainer): list planned folders (routes, db, tests, ...) once the layout is decided. -->

## Design decisions

Design decisions are recorded in [docs/README.md](docs/README.md).

## Deployment

The target is Cloudflare Workers Builds from the `main` branch. <!-- TODO(maintainer): document the exact build and deploy commands set in the Cloudflare dashboard. They are not recorded in this repo. -->

Secrets are set with `wrangler secret put <NAME>` and are never committed. Local secrets go in `.dev.vars`, which is gitignored.

## Contributing

Changes to security-sensitive areas need maintainer review. These are auth, OIDC, crypto, database access and migrations.

## Security

Report vulnerabilities privately to the maintainers. Do not open public issues.

## License

[AGPL-3.0](LICENSE). If you run a modified version as a network service, you must offer the source code of your version to its users.
