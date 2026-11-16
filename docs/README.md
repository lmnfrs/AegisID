# Docs

This directory holds the project's design records: Architecture Decision Records (ADRs) under `adr/`, in Michael Nygard's format. They record decisions that are hard to reverse, such as RP ID, tenancy and key formats, and the context and trade-offs behind them. Each ADR states whether it is Accepted or Proposed, and an Accepted ADR is the reference for why the code is the way it is.

| Number | Title | Status | Link |
| --- | --- | --- | --- |
| 0001 | WebAuthn RP ID and origins | Accepted | [adr/0001-rp-id.md](adr/0001-rp-id.md) |
| 0002 | Path-based tenancy and UUID keys | Accepted | [adr/0002-tenancy-and-keys.md](adr/0002-tenancy-and-keys.md) |
| 0003 | Where OIDC endpoints live | Proposed | [adr/0003-oidc-endpoint-paths.md](adr/0003-oidc-endpoint-paths.md) |

## Adding an ADR

- Use the next free number, zero-padded to four digits, as `adr/NNNN-short-title.md`, and copy the format of an existing ADR.
- Never rewrite an Accepted ADR. To change a decision, write a new ADR and set the old one's Status to `Superseded by NNNN`.
- Update the index table above when you add or change an ADR.
