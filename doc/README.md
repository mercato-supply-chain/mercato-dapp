# MERCATO Documentation

This folder contains architecture and design documentation for the MERCATO application.

> **AI agents:** Start with **[AGENTS.md](../AGENTS.md)** at the repository root — it is the machine-oriented entry point with lifecycles, routes, signing rules, and implementation status.

## Documents

| Document | Audience | Description |
|----------|----------|-------------|
| **[AGENTS.md](../AGENTS.md)** | AI agents | Structured orientation: deal lifecycles, route/API index, wallet signing matrix, key files, what is / isn't implemented |
| **[architecture.md](./architecture.md)** | Engineers | System overview, Mermaid diagrams, escrow/ramp/vault flows, data model, environment variables |
| **[how-money-moves.md](./how-money-moves.md)** | Anyone using the app | Which button calls which contract, for both the default deal and the credit pool |
| **[rwa-architecture.md](./rwa-architecture.md)** | AI agents, engineers | Credit-asset schema, state machine, and the issuance → pool → redemption sequence |
| **[rwa-testnet-evidence.md](./rwa-testnet-evidence.md)** | AI agents | Deployed Testnet registry. Lifecycle tables are a template until a real run fills them. |
| **[rwa-repayment-capability.md](./rwa-repayment-capability.md)** | Engineers | Trustless Work multi-receiver repayment notes |
| **[../README.md](../README.md)** | Everyone | Product summary, stakeholder value, quick start |
| **[../SETUP.md](../SETUP.md)** | Developers | Step-by-step local setup checklist |
| **[../CONTRIBUTING.md](../CONTRIBUTING.md)** | Contributors | Branch policy, PR expectations, Drips Wave |
| **[../env.sample](../env.sample)** | Developers | Complete environment variable reference |

## Related module docs

| Path | Contents |
|------|----------|
| [lib/anchors/README.md](../lib/anchors/README.md) | Fiat ramp anchor interface, Etherfuse / AlfredPay / BlindPay clients, SEP modules |
| [lib/anchors/etherfuse/README.md](../lib/anchors/etherfuse/README.md) | Etherfuse integration detail |
| [lib/anchors/alfredpay/README.md](../lib/anchors/alfredpay/README.md) | AlfredPay integration detail |
| [lib/anchors/blindpay/README.md](../lib/anchors/blindpay/README.md) | BlindPay integration detail |
| [scripts/README.md](../scripts/README.md) | Legacy SQL → Supabase migrations mapping |

Diagrams in `architecture.md` render in GitHub, GitLab, and any Markdown viewer that supports Mermaid.

## Documentation conventions (for maintainers)

When updating code that changes user flows, routes, or integrations, update in this order:

1. **AGENTS.md** — lifecycles, routes, signing matrix, implementation status
2. **doc/rwa-architecture.md** — when the change is on the opt-in credit path
3. **doc/architecture.md** — diagrams and deep integration detail
4. **README.md** — product-facing summary if stakeholder-visible behavior changed
5. **SETUP.md** / **env.sample** — if new environment variables are required

Keep tables and state machines **explicit** (DB column names, enum values, file paths) so AI agents can reason about the codebase without spelunking.
