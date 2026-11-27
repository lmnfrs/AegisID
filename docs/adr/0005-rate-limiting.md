# 0005. Rate limiting public passkey routes

- Status: Accepted
- Date: 2026-11-27

## Context

`register/options` and `login/options` are public. Each call can insert a row into `webauthn_challenges`, and `register/options` can also create a user. Without a limit, anyone can fill D1 or scan tenant slugs and usernames.

## Decision

- Use the Workers Rate Limiting binding `AUTH_LIMITER` (`ratelimits` in `wrangler.jsonc`): 10 requests per 60 seconds. The binding is repeated under `previews` with its own `namespace_id` so counters do not mix.
- The middleware is `authRateLimit` in `src/worker/ratelimit.ts`. The key is `{slug}:{cf-connecting-ip}`. A limited request gets `429` and `Retry-After: 60`.
- It runs before any D1 access, so slug scanning is throttled too.
- Applied to `register/options` and `login/options` only. `verify` routes are not limited: challenges are single-use and expire after 5 minutes, and a shared IP should not be throttled mid-flow.
- It fails open. If the binding throws, the request proceeds and the error is logged, so a limiter outage cannot block sign-in.

## Consequences

- Counts are per Cloudflare location and eventually consistent. The limit is approximate abuse control, not an exact quota. A client spread across locations gets more than 10 per minute.
- Users behind one shared IP share a counter. A botnet with many IPs is not stopped. Next layers if needed: a WAF rate limiting rule on `/t/*/api/*` and Turnstile on `register/options`.
- Expired challenges are still only swept when a new challenge is created. A cron trigger for the sweep is not part of this decision.
- Production login and enrollment routes must apply `authRateLimit` too. Today only the dev routes use it.
- This ADR does not claim AAL2 compliance or OIDC conformance.
