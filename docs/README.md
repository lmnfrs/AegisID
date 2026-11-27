# Docs

This directory holds the project's design records: Architecture Decision Records (ADRs) under `adr/`, in Michael Nygard's format. They record decisions that are hard to reverse, such as RP ID, tenancy and key formats, and the context and trade-offs behind them. Each ADR states whether it is Accepted or Proposed, and an Accepted ADR is the reference for why the code is the way it is.

| Number | Title | Status | Link |
| --- | --- | --- | --- |
| 0001 | WebAuthn RP ID and origins | Accepted | [adr/0001-rp-id.md](adr/0001-rp-id.md) |
| 0002 | Path-based tenancy and UUID keys | Accepted | [adr/0002-tenancy-and-keys.md](adr/0002-tenancy-and-keys.md) |
| 0003 | Where OIDC endpoints live | Proposed | [adr/0003-oidc-endpoint-paths.md](adr/0003-oidc-endpoint-paths.md) |
| 0004 | Access token format and signing | Accepted | [adr/0004-access-token-signing.md](adr/0004-access-token-signing.md) |
| 0005 | Rate limiting public passkey routes | Accepted | [adr/0005-rate-limiting.md](adr/0005-rate-limiting.md) |

## API reference

Reference pages for the routes the Worker serves today. Every route except health is dev-only and has no authentication. OIDC endpoints are not implemented.

| Page | Covers |
| --- | --- |
| [api/passkeys.md](api/passkeys.md) | Passkey register and sign-in under `/t/:slug/api/v1/auth` |
| [api/dev-tenants.md](api/dev-tenants.md) | Tenant and user listing under `/api/v1/dev/tenants` |
| [api/dev-token.md](api/dev-token.md) | Access token issue and verify under `/api/v1/dev/token`, and the token format |
| [api/email-and-health.md](api/email-and-health.md) | Dev email test route, `/healthz` and tenant health |

## Adding an ADR

- Use the next free number, zero-padded to four digits, as `adr/NNNN-short-title.md`, and copy the format of an existing ADR.
- Never rewrite an Accepted ADR. To change a decision, write a new ADR and set the old one's Status to `Superseded by NNNN`.
- Update the index table above when you add or change an ADR.
