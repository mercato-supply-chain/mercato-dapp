# MERCATO

**Supply chain finance, transparently secured.**

> **AI agents:** Start with **[AGENTS.md](AGENTS.md)** for structured orientation — lifecycles, routes, signing rules, file index, and what is / isn't implemented. This README is the human-facing product overview.

### What MERCATO is

MERCATO is a **supply chain finance** application: it helps **small and medium businesses** (we use the Latin American term **PyME** — *pequeñas y medianas empresas*) buy inventory with **investor capital**, pays **suppliers in full up front**, and settles repayment to investors via **Trustless Work multi-release escrow** in **USDC** on the [Stellar](https://stellar.org) network. The goal is short-term working capital with **clear rules and on-chain transparency**, not opaque balance-sheet lending.

### Who benefits

| Stakeholder | What they get |
|--------------|----------------|
| **PyME (buyer)** | Capital to cover supplier invoices for a defined term (for example 30–90 days), repaid after their sales cycle, with repayment terms agreed up front. |
| **Investor** | A way to allocate capital to **specific, disclosed deals** instead of a black box; returns are **contractually tied** to the deal (for example mid-single-digit to low-teens APR in illustrative deal terms). Principal + yield are returned through staged repayment escrow releases. |
| **Supplier** | **Full invoice payment up front** (fee-free) when an investor funds the deal, so they are not stuck financing the buyer's payment delay. |

### Why Stellar (and this ecosystem)

MERCATO is built **on and around Stellar** by composing **many Stellar-focused products**, not a single integration. The app is intentionally **modular**—settlement and assets on Stellar, specialized vendors for distinct jobs—so each concern (escrow logic, wallet UX, yield vaults, fiat access, anchor-style SEP flows) can use **mature tooling** instead of reinventing it.

**Integrations wired into MERCATO today:**

- **[Trustless Work](https://docs.trustlesswork.com/)** — non-custodial **multi-release escrow** on Stellar for **investor repayment** (staged milestones; not the platform's bank account).
- **[Stellar Wallets Kit](https://stellarwalletskit.dev/)** — connect + sign with Freighter, Albedo (required for Trustless Work escrow operations).
- **[Pollar](https://pollar.xyz)** — optional **embedded wallet** onboarding (balances, simple payments); TW escrow signing still requires Stellar Wallets Kit.
- **[DeFindex](https://docs.defindex.io)** — **Soroban yield vaults** for investor/PyME treasury (deposit/withdraw, admin monitor).
- **Fiat ramps** — **[Etherfuse](https://etherfuse.com)**, **[Alfred Pay](https://alfredpay.io)**, **[BlindPay](https://blindpay.com)** (anchor-style server clients + UI).
- **SEP building blocks** — shared modules under `lib/anchors/sep/` for **SEP 1, 6, 10, 12, 24, 31, 38** alongside provider APIs.

Together, these choices keep **repayment funds non-custodial** where escrow applies, while still giving users **real-world on- and off-ramps** and flexible **wallet** options on the same network.

---

## How it works (end-to-end)

1. **Deal setup** — The PyME describes the purchase (product, supplier, price, term, yield). The deal is published to the marketplace **without** deploying escrow yet.
2. **Funding** — An investor pays the **supplier invoice in full** plus a **1% platform fee** in one classic Stellar USDC transaction (direct payment, not escrow). The investor's Stellar address is saved for repayment.
3. **Fulfillment** — The supplier ships (tracking ID); they already hold the invoice amount. The PyME later **confirms the order arrived**.
4. **Repayment escrow** — An **admin** deploys a Trustless Work **multi-release** repayment escrow (first milestone default **50%** of the grossed repayment). The PyME **micro-funds** as cash arrives. Admin **approves and releases** each funded milestone to the **investor**, then **adds** further milestones via `updateEscrow` until principal + yield are fully paid (platform takes **1%** on each release; Trustless Work protocol fee **0.3%**).

For state machines, signing rules, and file paths, see **[AGENTS.md](AGENTS.md)**.

### Roles and data

Four roles — **pyme**, **investor**, **supplier**, **admin** — map to the flows above. **Authentication and business metadata** (profiles, deal records, marketplace listings, repayment status) live in **[Supabase](https://supabase.com)** (Postgres + Auth). **Funding payments and repayment escrow** live on **Stellar** (classic USDC for funding; Trustless Work Soroban escrow for repayment).

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | [Next.js](https://nextjs.org) 16, [React](https://react.dev) 19, [Tailwind CSS](https://tailwindcss.com), [shadcn/ui](https://ui.shadcn.com) |
| Auth & DB | [Supabase](https://supabase.com) (Auth, Postgres) |
| Escrow | [Trustless Work](https://docs.trustlesswork.com/) |
| Wallets | [Stellar Wallets Kit](https://stellarwalletskit.dev/) + optional [Pollar](https://pollar.xyz) embedded |
| Yield vaults | [DeFindex](https://docs.defindex.io) (Stellar Soroban) |
| Ramps | Etherfuse, Alfred Pay, BlindPay (`lib/anchors/`) |
| i18n | English + Spanish (`lib/i18n/`) |
| Styling | Tailwind, next-themes (light/dark) |

---

## Stellar ecosystem

| Product | Role in this application |
|---------|--------------------------|
| [Trustless Work](https://docs.trustlesswork.com/) | **Repayment escrow** — multi-release contracts for PyME→investor repayment. Uses `@trustless-work/escrow` and configured USDC trustline. |
| [Stellar Wallets Kit](https://stellarwalletskit.dev/) | **External wallets** — Freighter, Albedo for signing (funding, escrow deploy/release). |
| [Pollar](https://pollar.xyz) | **Embedded wallet** — onboarding, balances, deal funding; TW escrow still needs SWK. |
| [DeFindex](https://docs.defindex.io) | **Yield vaults** — user deposits at `/dashboard/vault`; admin monitor at `/dashboard/admin/vault`. |
| [Etherfuse](https://etherfuse.com) | **Fiat ramp** — Mexico SPEI ↔ USDC. `lib/anchors/etherfuse/`. |
| [Alfred Pay](https://alfredpay.io) | **Fiat ramp** — LATAM SPEI ↔ USDC. `lib/anchors/alfredpay/`. |
| [BlindPay](https://blindpay.com) | **Fiat ramp** — global rails ↔ Stellar stablecoins. `/dashboard/ramp/blindpay-setup`. |
| **SEP modules** (`lib/anchors/sep/`) | SEP **1, 6, 10, 12, 24, 31, 38** building blocks alongside provider REST APIs. |

Ramp providers are opt-in via environment variables; see [`lib/anchors/README.md`](lib/anchors/README.md). **Blend** appears only as a testnet asset helper for DeFindex vault setup — there is no direct Blend SDK integration.

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
    vault/                    # DeFindex user vault
    investments/              # Investor portfolio
    ramp/                     # Fiat on/off ramp
    admin/                    # Escrow approvals, releases, vault monitor, leads
  api/
    ramp/                     # Ramp proxy (14 routes)
    defindex/                 # Vault API (10 routes)
    stellar/                  # Tx submit, SAC, vault activity
components/
  deals/                      # Funding, repayment, delivery, on-chain panels
  ramp/                       # Ramp UI (provider + variant composition)
  wallet/                     # Wallet status card
lib/
  deals/                      # Fees, investor wallet, repayment helpers
  stellar/                    # USDC split payment, submit
  trustless/                  # TW config, wallet kit, trustlines
  defindex/                   # Vault config, monitor, math
  anchors/                    # Ramp clients + SEP modules
  mercato-wallet.ts           # Unified wallet types and storage
hooks/
  use-wallet.ts               # Unified wallet API
  use-repayment-escrow.ts     # TW multi-release repayment
  use-deal-detail.ts          # Deal + TW indexer
providers/
  wallet-provider.tsx         # Merges SWK + Pollar
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
- Optional: Pollar, DeFindex, ramp provider credentials — see `env.sample`

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

- **Role-based flows**: PyME (create deal, confirm delivery, micro-fund repayment), Investor (browse/fund deals, vault), Supplier (profile, catalog, deliveries), Admin (escrow queue, releases, vault monitor).
- **Dual wallet support**: Stellar Wallets Kit (Freighter, Albedo) or Pollar embedded wallet at `/dashboard/wallets`.
- **Create deal (no escrow at create)**: Multi-step form; deal stored in Supabase seeking funding.
- **Direct funding**: Investor pays supplier principal + 1% platform fee in classic Stellar USDC.
- **Multi-release repayment escrow**: Admin deploys TW escrow after delivery confirmation; PyME micro-funds; admin releases milestones to investor.
- **DeFindex vault**: Optional yield vault for investor/PyME treasury.
- **Marketplace**: Browse deals at `/deals` (search, status, category).
- **Fiat ramps**: On/off ramp at `/dashboard/ramp` when providers are configured.
- **i18n**: English and Spanish.
- **Reputation**: Trust scores and stake signals on profiles.

---

![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/mercato-supply-chain/mercato-dapp?utm_source=oss&utm_medium=github&utm_campaign=mercato-supply-chain%2Fmercato-dapp&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)

## License

MERCATO is released under the **[Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)**. See [`LICENSE`](LICENSE).
