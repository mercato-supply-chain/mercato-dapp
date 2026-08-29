# MERCATO

**Supply chain finance, transparently secured.**

> **AI agents:** Start with **[AGENTS.md](AGENTS.md)** for structured orientation — lifecycles, routes, signing rules, file index, and what is / isn't implemented. This README is the human-facing product overview.

### What MERCATO is

MERCATO is a **supply chain finance** application: it helps **small and medium businesses** (we use the Latin American term **PyME** — *pequeñas y medianas empresas*) buy inventory with **investor capital**, pays **suppliers in full up front**, and settles repayment to investors via **Trustless Work multi-release escrow** in **USDC** on the [Stellar](https://stellar.org) network. The current model supports one investor per order; the planned multi-investor model aggregates independently tracked contributions before supplier settlement. DeFindex extends the financing engine so investor capital can remain productive in Stellar DeFi until the investor allocates it to a purchase order.

### Who benefits

| Stakeholder | What they get |
|--------------|----------------|
| **PyME (buyer)** | Capital to cover supplier invoices for a defined term, repaid after the sales cycle. Planned DeFindex access is earned through reliable repayment behavior. |
| **Investor** | Allocate capital to disclosed deals directly or through independently tracked multi-investor contributions. Idle capital can remain in supported DeFindex vaults until the investor chooses a financing opportunity. Investors are not reputation-gated. |
| **Supplier** | **Full invoice payment up front** (fee-free) after the financing target is reached. Planned DeFindex access is earned through reliable fulfillment behavior. |

### Why Stellar (and this ecosystem)

MERCATO is built **on and around Stellar** by composing **many Stellar-focused products**, not a single integration. The app is intentionally **modular**—settlement and assets on Stellar, specialized vendors for distinct jobs—so each concern (escrow logic, wallet UX, yield vaults, fiat access, anchor-style SEP flows) can use **mature tooling** instead of reinventing it.

**Current integration foundations:**

- **[Trustless Work](https://docs.trustlesswork.com/)** — non-custodial **multi-release escrow** on Stellar for **investor repayment** (staged milestones; not the platform's bank account).
- **[Stellar Wallets Kit](https://stellarwalletskit.dev/)** — connect + sign with Freighter, Albedo (required for Trustless Work escrow operations).
- **[Pollar](https://pollar.xyz)** — optional **embedded wallet** onboarding (balances, simple payments); TW escrow signing still requires Stellar Wallets Kit.
- **[DeFindex](https://docs.defindex.io)** — Soroban vault discovery, positions, deposit/withdraw, signed submission, investor vault-to-deal withdrawal UI, and admin vault operations.
- **Reputation** — existing off-chain application scores and signals, which form the migration base for the planned Soroban reputation layer.

**Planned architecture:**

- **Multi-investor financing** — Stellar escrow coordinates independently tracked contributions and prevents supplier settlement until the locked financing target is reached. The initial dual-investor release can later generalize to more participants.
- **DeFindex capital allocation** — connect a confirmed investor vault withdrawal to either full-order direct funding or an individual multi-investor escrow contribution.
- **Soroban reputation eligibility** — role-specific on-chain scores gate new DeFindex deposits and other risk-increasing actions for PyMEs and suppliers. Investors remain ungated, and withdrawals are always available.
- **[MoneyGram Ramps](https://developers.stellar.org/docs/tools/ramps/moneygram)** — the sole planned fiat ramp, using SEP-10 and SEP-24 for USDC cash-in/cash-out. Partner onboarding and corridor validation for Costa Rica and Argentina are required.
- **[Privy](https://docs.privy.io/)** — planned additive embedded-wallet option, enabled only after classic XDR, SEP-10, and Soroban signing capabilities pass validation.

**Not in the target architecture:** Etherfuse was a Mexico-expansion proof of concept and is discontinued. Alfred Pay and BlindPay are also not planned. Legacy ramp code may remain temporarily during cleanup but must not be treated as an available production integration.

Together, these choices preserve MERCATO's **non-custodial model**: users authorize vault, funding, escrow, and ramp transactions from supported wallets, while MERCATO coordinates intent, validation, reconciliation, and recovery.

---

## How it works (end-to-end)

1. **Deal setup** — The PyME describes the purchase (product, supplier, price, term, yield). The deal is published to the marketplace **without** deploying escrow yet.
2. **Funding** — In the current direct model, one investor pays the **supplier invoice in full** plus a **1% platform fee** in one classic Stellar USDC transaction. In the planned multi-investor model, each contribution is tracked in a Stellar funding escrow and the supplier is paid only after the target is reached.
3. **Fulfillment** — The supplier ships (tracking ID); they already hold the invoice amount. The PyME later **confirms the order arrived**.
4. **Repayment escrow** — For a single investor, an **admin** deploys a Trustless Work **multi-release** repayment escrow and the PyME micro-funds staged repayment milestones. In the planned multi-investor flow, each investor becomes a repayment milestone whose principal and profit are proportional to that investor's confirmed contribution.

### DeFindex capital allocation

Investors can keep idle capital productive in supported DeFindex vaults and later allocate it to a selected deal. MERCATO coordinates two separately authorized transactions:

1. Withdraw the requested capital from the investor's DeFindex position to the investor's wallet.
2. Revalidate the deal and sign either the direct-funding payment or a multi-investor escrow contribution.

A successful vault withdrawal does not by itself mark a deal funded. If the financing transaction does not complete, the capital remains in the investor's wallet and can be retried, allocated elsewhere, or redeposited. MERCATO never redirects it automatically.

For state machines, signing rules, and file paths, see **[AGENTS.md](AGENTS.md)**.

### Roles and data

Four roles — **pyme**, **investor**, **supplier**, **admin** — map to the flows above. **Authentication and workflow metadata** live in **[Supabase](https://supabase.com)**. Stellar remains authoritative for payments, vault ownership, funding and repayment escrows, and the planned on-chain reputation scores.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | [Next.js](https://nextjs.org) 16, [React](https://react.dev) 19, [Tailwind CSS](https://tailwindcss.com), [shadcn/ui](https://ui.shadcn.com) |
| Auth & DB | [Supabase](https://supabase.com) (Auth, Postgres) |
| Escrow | [Trustless Work](https://docs.trustlesswork.com/) |
| Wallets | [Stellar Wallets Kit](https://stellarwalletskit.dev/) + [Pollar](https://pollar.xyz); Privy planned |
| Capital management | [DeFindex](https://docs.defindex.io) vaults + investor financing allocation |
| Reputation | Existing Supabase signals; role-specific Soroban eligibility planned |
| Fiat ramp | MoneyGram SEP-10/SEP-24 planned; no other ramp is in the target architecture |
| i18n | English + Spanish (`lib/i18n/`) |
| Styling | Tailwind, next-themes (light/dark) |

---

## Stellar ecosystem

| Product | Role in this application |
|---------|--------------------------|
| [Trustless Work](https://docs.trustlesswork.com/) | **Repayment escrow** — multi-release contracts for PyME→investor repayment. Uses `@trustless-work/escrow` and configured USDC trustline. |
| [Stellar Wallets Kit](https://stellarwalletskit.dev/) | **External wallets** — Freighter, Albedo for signing (funding, escrow deploy/release). |
| [Pollar](https://pollar.xyz) | **Embedded wallet** — onboarding, balances, deal funding; TW escrow still needs SWK. |
| Privy (planned) | **Embedded wallet** — additive provider subject to Stellar classic and Soroban signing validation. |
| [DeFindex](https://docs.defindex.io) | **Capital management** — supported vault positions and user-authorized transactions; investor liquidity can be withdrawn into direct or multi-investor financing. |
| Soroban reputation (planned) | **Eligibility** — PyME repayment and supplier fulfillment scores govern new DeFindex deposits and gated actions; investors are not gated. |
| [MoneyGram Ramps](https://developers.stellar.org/docs/tools/ramps/moneygram) (planned) | **Sole target fiat ramp** — SEP-10 authentication and SEP-24 interactive USDC cash-in/cash-out. |

MoneyGram requires partner allowlisting, certification, KYB/legal completion, and confirmation of intended Costa Rica and Argentina corridors. MoneyGram are not planned integrations. **Blend** appears only as a testnet asset helper for DeFindex vault setup—there is no direct Blend SDK or pool integration.

---

## Documentation

| Document | Audience | Contents |
|----------|----------|----------|
| **[AGENTS.md](AGENTS.md)** | AI agents | Lifecycles, routes, API index, signing matrix, file map, implementation status |
| **[doc/architecture.md](doc/architecture.md)** | Engineers | Mermaid diagrams, deep flows, env reference |
| **[SETUP.md](SETUP.md)** | Developers | Local setup checklist |
| **[CONTRIBUTING.md](CONTRIBUTING.md)** | Contributors | Branch policy, PR expectations, Drips Wave |
| **[env.sample](env.sample)** | Everyone | Environment variables |

---

## Project Structure

```
app/
  page.tsx                    # Landing
  deals/                      # Marketplace (/deals) + deal detail + edit
  create-deal/                # PyME multi-step deal creation (DB only)
  dashboard/
    wallets/                  # Connect SWK or Pollar, balances
    vault/                    # DeFindex positions and capital management
    investments/              # Investor portfolio
    ramp/                     # Legacy ramp UI; MoneyGram is the target integration
    admin/                    # Escrow approvals, releases, vault monitor, leads
  api/
    ramp/                     # Ramp proxy (14 routes)
    defindex/                 # Vault API (10 routes)
    stellar/                  # Tx submit, SAC, vault activity
components/
  deals/                      # Funding, repayment, delivery, on-chain panels
  vault-to-deal-allocator.tsx # Investor vault withdrawal toward deal funding
  ramp/                       # Ramp UI (provider + variant composition)
  wallet/                     # Wallet status card
lib/
  deals/                      # Fees, investor wallet, repayment helpers
  stellar/                    # USDC split payment, submit
  trustless/                  # TW config, wallet kit, trustlines
  defindex/                   # Vault config, monitor, math
  anchors/                    # Legacy ramp POC clients + SEP modules
  mercato-wallet.ts           # Unified wallet types and storage
hooks/
  use-wallet.ts               # Unified wallet API
  use-repayment-escrow.ts     # TW multi-release repayment
  use-deal-detail.ts          # Deal + TW indexer
providers/
  wallet-provider.tsx         # Merges SWK + Pollar; Privy planned
  pollar-provider.tsx         # Pollar SDK wrapper
supabase/migrations/          # Database schema (source of truth)
```

---

## Getting Started

For a step-by-step checklist, use **[SETUP.md](SETUP.md)**.

### Prerequisites

- [Bun](https://bun.sh/) 1.1+ (recommended) or Node.js 20+
- [Supabase](https://supabase.com) project
- [Trustless Work](https://docs.trustlesswork.com/) API key and Stellar addresses for escrow
- Optional current integrations: Pollar and DeFindex — see `env.sample`
- Planned integrations require separate partner/configuration work: MoneyGram and Privy

### Quick start

```bash
git clone <your-repo-url>
cd mercato-dapp
bun install
cp env.sample .env.local
# Fill in Supabase + Trustless Work vars (see SETUP.md)
npx supabase db push
bun dev
```

Open [http://localhost:3000](http://localhost:3000). Connect a Stellar wallet (Freighter on testnet) to fund deals and interact with repayment escrow.

### Build

```bash
bun lint
bun build
bun start
```

---

## Main Features

- **Role-based flows**: PyME (create deal, confirm delivery, micro-fund repayment), Investor (browse/fund deals, manage vault capital), Supplier (profile, catalog, deliveries), Admin (escrow queue, releases, vault monitor).
- **Wallet architecture**: Stellar Wallets Kit (Freighter, Albedo) and Pollar today; Privy is planned as an additive provider after capability validation.
- **Create deal (no escrow at create)**: Multi-step form; deal stored in Supabase seeking funding.
- **Direct funding**: One investor pays supplier principal + 1% platform fee in classic Stellar USDC.
- **Multi-investor funding (planned)**: Independently tracked contributions accumulate in Stellar escrow; supplier settlement waits for the complete financing target.
- **Multi-release repayment escrow**: Admin deploys TW escrow after delivery confirmation; PyME micro-funds; admin releases milestones to investor.
- **DeFindex capital management**: View supported vaults and positions, deposit/withdraw with user authorization, and monitor vault activity.
- **Vault-to-financing allocation**: Existing withdrawal UI foundation with planned durable allocation into direct or multi-investor funding.
- **Marketplace**: Browse deals at `/deals` (search, status, category).
- **MoneyGram ramp (planned)**: Sole target fiat ramp using SEP-10/SEP-24 cash-in and cash-out; existing legacy ramp providers are not planned for production.
- **i18n**: English and Spanish.
- **Reputation**: Current profile signals plus planned Soroban scores. Investors remain ungated; qualifying PyMEs and suppliers gain DeFindex access, while withdrawals always remain available.

---

![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/mercato-supply-chain/mercato-dapp?utm_source=oss&utm_medium=github&utm_campaign=mercato-supply-chain%2Fmercato-dapp&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)

## License

MERCATO is released under the **[Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)**. See [`LICENSE`](LICENSE).
