# AegisID

A self-hosted, multi-tenant OpenID Connect identity provider with passkey-only login (WebAuthn/FIDO2).

> **Early development. Not production-ready. Not security-audited.**
> Do not use it to protect real accounts.

## Goals and scope

Everything below is **planned**. Today the repo only has a health endpoint and the default Vite page. See [Project structure](#project-structure).

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

Only what is in [package.json](package.json) today:

- [Hono](https://hono.dev): small web framework for the API
- [Cloudflare Workers](https://developers.cloudflare.com/workers/): serverless runtime that runs the API
- [Vite](https://vite.dev) and [React](https://react.dev): build tool and UI library for the web app
- [TypeScript](https://www.typescriptlang.org): typed JavaScript
- [Zod](https://zod.dev): input validation
- [Oxlint](https://oxc.rs): linter
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/): Cloudflare command-line tool

Planned: Cloudflare D1 (SQLite database). No database is configured yet.

## Architecture

One Worker serves one origin. Tenants are separated by path: `/t/{slug}/...`. The issuer URL format is `https://<host>/t/{slug}`.

| Route | Handled by | Status |
| --- | --- | --- |
| `/t/{slug}/login`, `/enroll`, `/recover` | SPA (static assets) | Served as the SPA fallback page. No real screens yet. |
| `/t/{slug}/api/*` | Worker (Hono) | Only `/t/{slug}/api/health` exists. |
| `/t/{slug}/.well-known/openid-configuration` | Worker | Planned. Returns 404 today. |
| `/healthz` | Worker | Works. |

The SPA is the single-page web app built by Vite. In [wrangler.jsonc](wrangler.jsonc), `not_found_handling: "single-page-application"` makes unknown paths return the SPA. `run_worker_first` lists paths that skip the static-asset lookup and go to the Worker first. Without it, the assets layer would answer first. These are the API, `.well-known` and `/healthz` paths.

## Project structure

```
src/
  web/        React single-page app (still the Vite starter template)
  worker/
    index.ts  Hono app: /healthz and /t/:slug/api/health
public/       Static files (icons)
wrangler.jsonc  Worker and assets config
vite.config.ts  Vite config with the React and Cloudflare plugins
```

<!-- TODO(maintainer): list planned folders (routes, db, migrations, tests, ...) once the layout is decided. -->

## Getting started

Prerequisites:

- Node.js. Verified with v26.8.1. <!-- TODO(maintainer): no "engines" field in package.json; set the supported Node version. -->
- pnpm 12.11.2 (from `packageManager` in package.json). Corepack can install it: `corepack enable`.

```sh
git clone <repository-url>
cd AegisID
pnpm install
pnpm dev
```

<!-- TODO(maintainer): add the repository URL. -->

`pnpm dev` starts Vite at http://localhost:5173/ and runs the Worker inside it. Daily development uses `pnpm dev`, not `wrangler dev`.

Verified on the dev server:

- http://localhost:5173/healthz returns `ok`
- http://localhost:5173/t/demo/api/health returns `{"ok":true,"tenant":"demo"}`
- http://localhost:5173/t/demo/login returns the SPA page (still the Vite starter content)

Troubleshooting: if pnpm reports `ERR_PNPM_IGNORED_BUILDS`, run `pnpm approve-builds` and allow `esbuild` and `workerd`. Both download or build native binaries. esbuild is a fast JavaScript bundler. workerd is the Cloudflare Workers runtime used locally.

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` | Start the Vite dev server with the Worker |
| `pnpm build` | Type-check with `tsc -b`, then build with Vite |
| `pnpm lint` | Run Oxlint |
| `pnpm preview` | Build, then run `wrangler dev` on the build |
| `pnpm deploy` | Build, then run `wrangler deploy` |

## Deployment

The target is Cloudflare Workers Builds from the `main` branch. <!-- TODO(maintainer): document the exact build and deploy commands set in the Cloudflare dashboard. They are not recorded in this repo. -->

Secrets are set with `wrangler secret put <NAME>` and are never committed. Local secrets go in `.dev.vars`, which is gitignored.

## Contributing

<!-- TODO(maintainer): add CONTRIBUTING.md and link it here. -->
Changes to security-sensitive areas need maintainer review. These are auth, OIDC, crypto, database access and migrations.

## Security

Report vulnerabilities privately to the maintainers. Do not open public issues.
<!-- TODO(maintainer): add a private contact address or enable GitHub private vulnerability reporting, and add SECURITY.md. -->

## License

[AGPL-3.0](LICENSE). If you run a modified version as a network service, you must offer the source code of your version to its users.
