# MERCATO

**Supply chain finance, transparently secured.**

### What MERCATO is

MERCATO is a **supply chain finance** application: it helps **small and medium businesses** (we use the Latin American term **PyME** — *pequeñas y medianas empresas*) buy inventory with **investor capital**, pays **suppliers in full up front**, and settles repayment to investors via **Trustless Work multi-release escrow** in **USDC** on the [Stellar](https://stellar.org) network. The goal is short-term working capital with **clear rules and on-chain transparency**, not opaque balance-sheet lending.

### Who benefits

| Stakeholder | What they get |
|--------------|----------------|
| **PyME (buyer)** | Capital to cover supplier invoices for a defined term (for example 30–90 days), repaid after their sales cycle, with repayment terms agreed up front. |
| **Investor** | A way to allocate capital to **specific, disclosed deals** instead of a black box; returns are **contractually tied** to the deal (for example mid-single-digit to low-teens APR in illustrative deal terms). Principal + yield are returned through staged repayment escrow releases. |
| **Supplier** | **Full invoice payment up front** (fee-free) when an investor funds the deal, so they are not stuck financing the buyer’s payment delay. |

### Why Stellar (and this ecosystem)

MERCATO is built **on and around Stellar** by composing **many Stellar-focused products**, not a single integration. That matters for reviewers: the app is intentionally **modular**—settlement and assets on Stellar, specialized vendors for distinct jobs—so each concern (escrow logic, wallet UX, lending liquidity, **yield vaults**, fiat access, anchor-style SEP flows) can use **mature tooling** instead of reinventing it.

**Examples wired into MERCATO today** (each is summarized in [Stellar ecosystem](#stellar-ecosystem) below):

- **[Trustless Work](https://docs.trustlesswork.com/)** — non-custodial **multi-release escrow** on Stellar for **investor repayment** (staged milestones; not the platform’s bank account).
- **[Stellar Wallets Kit](https://stellarwalletskit.dev/)** — one wallet layer for **connect + sign** (e.g. Freighter, Albedo) across escrow and ramp flows.
- **[Blend](https://www.blend.capital/)** — **Soroban** lending pools as the Stellar-native **liquidity** layer alongside deal escrow ([docs](https://docs.blend.capital/)).
- **[DeFindex](https://docs.defindex.io)** — **Soroban yield vaults**: tokenized vaults, **multi-strategy** allocation, rebalancing, auto-compounding, and emergency-style **rescue** patterns for optimizing yield alongside other Stellar DeFi ([documentation](https://docs.defindex.io)).
- **Fiat ramps** — **[Etherfuse](https://etherfuse.com)**, **[Alfred Pay](https://alfredpay.io)**, **[BlindPay](https://blindpay.com)** (anchor-style server clients + UI), **[MoneyGram](https://developer.moneygram.com/moneygram-developer/docs/access-to-moneygram-ramps)** Stellar on/off-ramp APIs.
- **SEP building blocks** — shared modules under `lib/anchors/sep/` for **SEP 1, 6, 10, 12, 24, 31, 38** alongside provider APIs (see [`doc/architecture.md`](doc/architecture.md)).

Together, these choices keep **repayment funds non-custodial** where escrow applies, while still giving users **real-world on- and off-ramps** and a **consistent wallet** experience on the same network.

---

## How it works (end-to-end)

1. **Deal setup** — The PyME describes the purchase (product, supplier, price, term, yield). The deal is published to the marketplace **without** deploying escrow yet.
2. **Funding** — An investor pays the **supplier invoice in full** plus a **1% platform fee** in one classic Stellar USDC transaction (direct payment, not escrow).
3. **Fulfillment** — The supplier ships; they already hold the invoice amount. The PyME later **confirms the order arrived**.
4. **Repayment escrow** — An **admin** deploys a Trustless Work **multi-release** repayment escrow (first milestone default **50%** of the grossed repayment). The PyME **micro-funds** as cash arrives. Admin **approves and releases** each funded milestone to the investor, then **adds** further milestones via `updateEscrow` until principal + yield are fully paid (platform takes **1%** on each release; Trustless Work protocol fee **0.3%**).

### Roles and data (for technical reviewers)

Four roles — **pyme**, **investor**, **supplier**, **admin** — map to the flows above. **Authentication and business metadata** (profiles, deal records, marketplace listings, repayment status) live in **[Supabase](https://supabase.com)** (Postgres + Auth). **Repayment escrow balances, releases, and settlement** live on **Stellar** via Trustless Work and are visible as on-chain activity tied to the escrow contract.

---

## Tech Stack

| Layer        | Technology |
|-------------|------------|
| Frontend    | [Next.js](https://nextjs.org) 16, [React](https://react.dev) 19, [Tailwind CSS](https://tailwindcss.com), [shadcn/ui](https://ui.shadcn.com) |
| Auth & DB   | [Supabase](https://supabase.com) (Auth, Postgres) |
| Escrow      | [Trustless Work](https://docs.trustlesswork.com/) — see [Stellar ecosystem](#stellar-ecosystem) |
| Wallets     | [Stellar Wallets Kit](https://stellarwalletskit.dev/) — see [Stellar ecosystem](#stellar-ecosystem) |
| Lending     | [Blend](https://www.blend.capital/) (Stellar Soroban) — see [Stellar ecosystem](#stellar-ecosystem) |
| Yield vaults | [DeFindex](https://docs.defindex.io) (Stellar Soroban) — see [Stellar ecosystem](#stellar-ecosystem) |
| Styling     | Tailwind, next-themes (light/dark) |

---

## Stellar ecosystem

MERCATO runs on the [Stellar](https://stellar.org) network. The items below match **[`doc/architecture.md`](doc/architecture.md)** (diagrams, flows, env reference in §5–6 and §9), including **MoneyGram** Stellar ramps, **[Blend](https://www.blend.capital/)** Soroban lending, and **[DeFindex](https://docs.defindex.io)** Soroban yield vaults.

| Product | Role in this application |
|--------|---------------------------|
| [Trustless Work](https://docs.trustlesswork.com/) | **Repayment escrow** — Non-custodial **multi-release** contracts for SMB→investor repayment: admin deploys the first milestone, PyME micro-funds, admin approves/releases and can add milestones via update escrow. The app uses `@trustless-work/escrow` and the configured USDC trustline. |
| [Stellar Wallets Kit](https://stellarwalletskit.dev/) | **Wallets** — Single integration for connecting and signing (e.g. **Freighter**, **Albedo**) with `@creit.tech/stellar-wallets-kit`, including escrow deployment and ramp flows that require a signed Stellar transaction. |
| [Blend](https://www.blend.capital/) | **Soroban lending** — [Blend Capital](https://www.blend.capital/)’s **Blend** protocol: decentralized lending pools on **Stellar Soroban**, created by users, DAOs, and institutions (see their site). Protocol reference: **[Blend v2 docs](https://docs.blend.capital/)**. MERCATO uses Blend as the Stellar-native **liquidity / lending** layer alongside Trustless Work escrow (see [`doc/architecture.md`](doc/architecture.md)). |
| [DeFindex](https://docs.defindex.io) | **Soroban yield & vaults** — A **decentralized yield** layer on Soroban: **tokenized vaults** expose users to **one or more assets** and **multiple underlying strategies** (lending, liquidity, tokenized bonds, and other listed strategies). Vault managers can **rebalance** safely on-chain, earnings can be **auto-compounded**, and the protocol includes **fee** rails (users, vault managers, and DeFindex) plus **emergency / rescue** flows when a strategy misbehaves. MERCATO treats DeFindex as the **yield-optimization / vault** complement to **Blend** lending pools and Trustless Work **deal escrow**—see [DeFindex documentation](https://docs.defindex.io) for vault creation, SDK integration, deposits, withdrawals, and strategy plug-ins. |
| [Etherfuse](https://etherfuse.com) | **Fiat ramp** — Mexico (SPEI) ↔ Stellar **USDC** (and **CETES** where the deployment exposes them). KYC via iframe; off-ramp uses deferred signing (poll for XDR, then sign in-wallet). Server-side `EtherfuseClient` in `lib/anchors/etherfuse/`. |
| [Alfred Pay](https://alfredpay.io) | **Fiat ramp** — Latin America, SPEI ↔ **USDC**; form-based KYC. Server-side `AlfredPayClient` in `lib/anchors/alfredpay/`. |
| [BlindPay](https://blindpay.com) | **Fiat ramp** — Global rails ↔ Stellar stablecoins (e.g. **USDB** in configured flows). ToS, redirect KYC, wallet registration, and payout submission; dedicated onboarding at `/dashboard/ramp/blindpay-setup`. Server-side `BlindPayClient` in `lib/anchors/blindpay/`. |
| [MoneyGram (Stellar ramps)](https://developer.moneygram.com/moneygram-developer/docs/access-to-moneygram-ramps) | **Fiat ramp (Stellar)** — MoneyGram’s **Stellar**-based on/off-ramp (developer docs cover acquiring **XLM** and **USDC**, **SEP-10** authentication, **SEP-9** customer info, and transaction lifecycle). Production access uses **Ramps Instant Access** (wallet/domain allowlisting via the same developer portal). |
| **SEP modules** (`lib/anchors/sep/`) | Shared **Stellar Ecosystem Proposal** building blocks used with the anchor layer (SEP **1, 6, 10, 12, 24, 31, 38** per the architecture doc), alongside each provider’s REST API. |

**Etherfuse**, **Alfred Pay**, and **BlindPay** share the `Anchor` interface; behavior and env-driven availability are summarized in [`lib/anchors/README.md`](lib/anchors/README.md). Those anchors appear in `/dashboard/ramp` only when their server env vars are set. **MoneyGram** follows MoneyGram’s Stellar ramp documentation (not the same `lib/anchors` factory path). **Blend** ([blend.capital](https://www.blend.capital/), [docs](https://docs.blend.capital/)) is Soroban **lending-pool** infrastructure; **DeFindex** ([documentation](https://docs.defindex.io)) is Soroban **multi-strategy yield vault** infrastructure. Both sit outside fiat ramps and outside the Trustless Work escrow SDK path.

---

## Documentation

Architecture and design docs (with diagrams) live in the **[`doc/`](doc/)** folder:

- **[Contributing](CONTRIBUTING.md)** — How to contribute (including [Drips Wave — Stellar](https://www.drips.network/wave/stellar)), local checks, and PR / commit expectations.
- **[Architecture](doc/architecture.md)** — System overview, application flows, tech stack, Stellar/Trustless Work escrow, Blend and DeFindex (Soroban lending and yield vaults), ramp providers (Etherfuse, Alfred Pay, BlindPay, MoneyGram), SEP usage, data split, and environment variables. Includes Mermaid diagrams.

---

## Project Structure

```
app/
  page.tsx              # Landing (hero, stakeholders, trust, CTA)
  how-it-works/         # Flow explanation
  marketplace/          # Browse and filter deals
  create-deal/          # PyME flow: deal basics → supplier & terms (DB only; no escrow at create)
  auth/login, sign-up/  # Supabase auth
  dashboard/            # User dashboard (role-based)
  dashboard/admin/      # Approvals: create repayment escrow, release milestones
  deals/[id]/           # Deal detail (funding + repayment panels)
  suppliers/            # Supplier directory
  settings/             # Profile (e.g. Stellar address)
components/
  navigation.tsx        # Header: nav links, connect wallet, user menu
  navigation/           # NavLinks, WalletNav, UserNav (composition)
  deals/                # Funding, repayment, on-chain panels
  deal-card.tsx         # Marketplace deal card
lib/
  deals/                # Fee math (platform + TW protocol gross-up)
  stellar/              # Classic USDC split payment (investor → supplier + platform)
  trustless/            # Trustless Work config, wallet kit, trustlines (USDC)
  supabase/             # Supabase client
  format.ts             # Currency / number formatting
hooks/
  use-wallet.ts         # Connect wallet, disconnect, truncated address
  use-repayment-escrow.ts  # Multi-release repayment deploy / fund / release / update
providers/
  wallet-provider.tsx   # Global Stellar wallet state (connect/disconnect)
```

---

## Getting Started

For a single step-by-step setup checklist, use [SETUP.md](SETUP.md). The summary below stays here for quick reference.

### Prerequisites

- [Bun](https://bun.sh/) 1.1+ (recommended) or [Node.js](https://nodejs.org/) 20+
- [Supabase](https://supabase.com) project
- [Trustless Work](https://docs.trustlesswork.com/) API key and Stellar addresses (platform + trustline) for escrow
- Optional: Etherfuse, Alfred Pay, and/or BlindPay credentials if you want fiat on/off-ramp — see `env.sample` and [Architecture §9](doc/architecture.md#9-environment-variables)

### 1. Clone and install

```bash
git clone <your-repo-url>
cd mercato
bun install
```

### 2. Environment variables

Copy the sample env and fill in your values:

```bash
cp env.sample .env.local
```

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key (if used) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key for server-only operations |
| `NEXT_PUBLIC_TRUSTLESS_WORK_API_KEY` | Trustless Work API key |
| `NEXT_PUBLIC_TRUSTLESS_NETWORK` | `testnet` or `mainnet` |
| `NEXT_PUBLIC_MERCATO_PLATFORM_ADDRESS` | Stellar address for the platform (1% fee recipient + repayment escrow roles) |
| `NEXT_PUBLIC_USDC_ISSUER` | Classic USDC issuer for direct investor→supplier payments (optional; defaults by network) |
| `NEXT_PUBLIC_TRUSTLESSLINE_ADDRESS` | USDC trustline contract address for repayment escrow |
| `NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY` | Pollar public/publishable key |
| `POLLAR_SECRET_KEY` | Pollar server-side secret key |
| `POLLAR_WEBHOOK_SECRET` | Pollar webhook signing secret, if webhooks are enabled |
| `NEXT_PUBLIC_POLLAR_NETWORK` | `testnet` or `mainnet` for Pollar embedded wallets |

Ramp keys (`ETHERFUSE_*`, `ALFREDPAY_*`, `BLINDPAY_*`) are optional; see `env.sample` and [Architecture §9](doc/architecture.md#9-environment-variables).
Pollar keys are required only if you want the embedded wallet onboarding path enabled.

### Supabase schema setup

If your Supabase project is empty, apply the tracked Supabase migrations instead of running ad-hoc SQL files:

```bash
npx supabase db push
```

Create future schema changes with `supabase migration new <name>` and commit the generated file under `supabase/migrations/`.

### 3. Run the app

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000). Use **auth**: `/auth/login`, `/auth/sign-up`. Connect a Stellar wallet (e.g. Freighter on testnet) to fund deals, micro-fund repayment, or (as platform/admin) deploy and release repayment escrow.

### 4. Build for production

```bash
bun build
bun start
```

---

## Main Features

- **Role-based flows**: PyME (create deal, confirm order, micro-fund repayment), Investor (browse/fund deals), Supplier (profile, catalog), Admin (create/release repayment milestones).
- **Connect Stellar wallet** in the header (Freighter, Albedo, Pollar); required to fund deals and interact with repayment escrow.
- **Create deal (no escrow at create)**: Multi-step form (deal basics → supplier & terms); deal is stored in Supabase and listed seeking funding.
- **Direct funding**: Investor pays supplier principal + 1% platform fee in one classic Stellar USDC transaction.
- **Multi-release repayment escrow**: Admin deploys Trustless Work multi-release after PyME confirms order arrival; PyME micro-funds; admin releases milestones and can add more via update escrow so investors can be paid earlier.
- **Marketplace**: Browse deals (search, status, category) backed by Supabase deals.
- **Dashboard**: Role-specific links (Create Deal, My Investments, Active Deals, Admin Approvals).
- **Settings**: Profile and Stellar address for PyMEs/suppliers/investors so payments and escrow roles use the correct addresses.

---

![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/mercato-supply-chain/mercato-dapp?utm_source=oss&utm_medium=github&utm_campaign=mercato-supply-chain%2Fmercato-dapp&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)

## License

MERCATO is released under the **[Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)** (SPDX `Apache-2.0`). See the [`LICENSE`](LICENSE) file in the repository root for the full terms.

Apache 2.0 is a permissive open-source license that includes an express **patent grant** from contributors, standard **redistribution and attribution** requirements, and **disclaimers of warranty and limitation of liability**—the usual legal framing teams want when publishing source publicly. If you need a different arrangement (for example a commercial license or CLA), that should be documented by the maintainers in addition to this default.
