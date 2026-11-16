# 0003. Where OIDC endpoints live

- Status: Proposed
- Date: 2026-11-16

## Context

`wrangler.jsonc` sets `assets.run_worker_first` to `/t/*/api/*`, `/t/*/.well-known/*`, `/healthz` and `/api/dev/*`. Only these paths reach the Worker. Every other path falls through to static assets, and `not_found_handling: "single-page-application"` serves the SPA's `index.html`.

OIDC needs server endpoints: authorization, token, userinfo, JWKS and end-session. Discovery at `/t/{slug}/.well-known/openid-configuration` is already covered by `/t/*/.well-known/*`, although no handler exists yet. If a server endpoint is not covered by `run_worker_first`, the request gets HTML from the SPA with a success status. Clients then fail with confusing parse errors instead of a clear 404.

The authorization endpoint may need to render a login page or redirect to the SPA login route `/t/{slug}/login`. That is an SPA route, so the authorization flow crosses the Worker/SPA boundary.

## Options

- **A. All under `/t/{slug}/api/oidc/*`.** Already covered by `run_worker_first`, so no configuration change is needed. Pros: no config drift, and the discovery document advertises these paths anyway. Cons: less conventional URLs than most OIDC deployments use.
- **B. Conventional paths such as `/t/{slug}/authorize` and `/t/{slug}/token`, each added to `run_worker_first`.** Pros: familiar URLs for clients and operators. Cons: every new endpoint needs a config change, and it is easy to forget one, which produces the silent HTML failure described above.
- **C. A dedicated prefix `/t/{slug}/oidc/*`, added once to `run_worker_first`.** Pros: one routing rule covers all endpoints, and the OIDC surface is clearly separated from the dev and app API. Cons: adds a new prefix and a config change; the SPA login route still sits outside it.

## Open question

Which option? The maintainer decides before OIDC endpoints are implemented. This ADR does not pick one. Whichever is chosen, the chosen paths must be added to `run_worker_first` in the same change that adds the first endpoint, and the authorization flow's hand-off to `/t/{slug}/login` must be specified.
