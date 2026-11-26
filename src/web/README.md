# Web app (src/web)

React 19 single-page app, built by Vite and served as Cloudflare Workers static assets. It runs on the same origin as the Worker API, so pages call relative URLs like `/api/v1/dev/tenants`. Setup steps are in [../../README.md](../../README.md).

## How a page loads

- `index.html` (repo root) loads `/src/web/main.tsx`. `main.tsx` renders `<App />` inside `StrictMode`.
- `App.tsx` wraps the routes in `BrowserRouter`. Move between pages with `<Link>` or `<NavLink>`. Never use `<a href>` for an internal link.
- A refresh or a direct visit to an SPA path gets `index.html` back. `not_found_handling: "single-page-application"` in `wrangler.jsonc` does this.
- Paths listed in `assets.run_worker_first` go to the Worker instead: `/t/*/api/*`, `/t/*/.well-known/*`, `/healthz`, `/api/v1/dev/*`. A new Worker route must be added there, or the SPA answers it. See [../worker/README.md](../worker/README.md).

## Routing

- `/` renders `Home` and is always mounted.
- `/dev` is a parent route. `DevLayout` draws the nav bar and an `<Outlet />`. Its children are `index`, `components`, `email`, `webauthn`, `tenants` and `users`.
- One expression gates every dev route, in `App.tsx`:

  ```ts
  const showDev = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEV === 'true';
  ```

  Dev routes have no auth. Do not build for a public origin with `VITE_SHOW_DEV=true`.
- To add a dev page, place its component in `pages/dev/` and add an entry to `pages/dev/devPages.ts`. The router, nav, and index use that entry.

  ```ts
  {
    path: 'foo',
    title: 'Foo',
    desc: 'What it checks.',
    Component: lazy(() => import('./DevFoo').then((m) => ({ default: m.DevFoo }))),
  },
  ```

## Bundles

- Dev pages are `React.lazy` chunks, so their code and DataTables stay out of the main bundle.
- `App.tsx` imports `DevLayout` eagerly. Whatever `DevLayout` imports (`ui.tsx`, `devPages.ts`) is in the main bundle. Keep those small.
- `components/DataTable.tsx` must be imported only from lazy pages. It registers DataTables core when it loads. Importing it from `Home` or `DevLayout` would pull DataTables into the main bundle.
- Import shared components from `components/ui.tsx` in one statement. It is the only shared component module.

## Data fetching

- Pages call same-origin JSON endpoints with `fetch`. Parse with `res.json().catch(() => ({}))`, then check `res.ok` and the body's `error` field.
- Do not fetch D1-backed endpoints on mount. StrictMode runs effects twice in dev, so a mount fetch runs twice. Load on a user action instead. `DevTenants` shows its list after a button click. `DevUsers` loads tenants on the first focus of its Select.
- Show a list only after its data exists, or keep a `null` state that means "not loaded yet". The DataTable mounts once and initializes with its rows.
- `lib/tenants.ts` is the pattern for a shared load:
  - `loadTenants()` caches its promise, so pages share one request.
  - A failed request clears the cache, so the next call retries.
  - A write calls `invalidateTenants()`.
- Guard state updates after unmount with a `mounted` ref (`DevUsers.tsx`, `DevWebAuthn.tsx`).
- When a later choice can make an earlier request stale, use a sequence ref. `DevUsers.tsx` increments `requestSeq` on each tenant change and drops responses that do not match.

## Styling

- Take colors, spacing and radius from the tokens on `:root` in `index.css`, such as `--bg`, `--surface`, `--fg`, `--fg-muted`, `--border`, `--accent`, `--danger`, `--space-4` and `--radius`. Do not hardcode colors.
- Dark mode: `prefers-color-scheme: dark` redefines the tokens, unless `<html>` has `data-theme="light"`. `data-theme="dark"` forces dark. `DevShowcase` sets the attribute.
- Reuse the component classes: `.btn` (with `--primary`, `--danger` or `--block`), `.input`, `.field`, `.card` and `.alert` (with `--info`, `--success` or `--error`). `ui.tsx` already applies them.
- DataTables overrides are scoped under `.dt-container`. Add table styles there and nowhere else.
- Logos use `<picture>` with a `prefers-color-scheme: dark` source (`Home.tsx`). The `data-theme` attribute does not change the logo.
- `App.css` is leftover Vite starter CSS. No component uses its classes. Put new styles in `index.css`.

## Type checking and lint

- `tsconfig.app.json` includes `src/web` only. It uses the DOM lib and `vite/client` types.
- `pnpm build` runs `tsc -b` and then `vite build`. This is the type check. There is no separate typecheck script.
- `pnpm lint` runs Oxlint with `.oxlintrc.json`. It errors on `rules-of-hooks`. It warns on `only-export-components`, so keep component files free of other exports.
- The tsconfig enforces `verbatimModuleSyntax` (use `import type` for types) and `erasableSyntaxOnly` (no `enum`, `namespace` or parameter properties). It also rejects unused locals and parameters.

## Gotchas

- `showDev` is written twice, in `App.tsx` and `Home.tsx`. Change both together.
- Passkeys work only at `http://localhost:5173`. Do not use `127.0.0.1` or a LAN IP.
- StrictMode renders and runs effects twice in dev. Keep effects safe to repeat, and clean up in the return function.
- DataTable reads `columns` and `options` once, at mount. Later changes are ignored. A change to `data` clears the table and redraws it. Define column and options objects at module level, as `DevTenants.tsx` does.
