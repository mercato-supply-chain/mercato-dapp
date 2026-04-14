# MERCATO

**Supply chain finance, transparently secured.**

### What MERCATO is

MERCATO is a **supply chain finance** application: it helps **small and medium businesses** (we use the Latin American term **PyME** — *pequeñas y medianas empresas*) buy inventory with **investor-funded escrow**, pays **suppliers** in **milestones** as work is proven, and settles in **USDC** on the [Stellar](https://stellar.org) network. The goal is short-term working capital with **clear rules and on-chain transparency**, not opaque balance-sheet lending.

### Who benefits

| Stakeholder | What they get |
|--------------|----------------|
| **PyME (buyer)** | Capital to cover supplier invoices for a defined term (for example 30–90 days), repaid after their sales cycle, with repayment terms agreed up front. |
| **Investor** | A way to allocate capital to **specific, disclosed deals** instead of a black box; returns are **contractually tied** to the deal (for example mid-single-digit to low-teens APR in illustrative deal terms), and funds stay in escrow until milestones justify release. |
| **Supplier** | **Partial payment up front** and the rest when delivery milestones are approved, so they are not stuck financing the buyer’s entire payment delay. |

### Why Stellar (and this ecosystem)

MERCATO is built **on and around Stellar** by composing **many Stellar-focused products**, not a single integration. That matters for reviewers: the app is intentionally **modular**—settlement and assets on Stellar, specialized vendors for distinct jobs—so each concern (escrow logic, wallet UX, lending liquidity, fiat access, anchor-style SEP flows) can use **mature tooling** instead of reinventing it.

**Examples wired into MERCATO today** (each is summarized in [Stellar ecosystem](#stellar-ecosystem) below):

- **[Trustless Work](https://docs.trustlesswork.com/)** — non-custodial **multi-release escrow** on Stellar (deal funding stays in contract rules, not the platform’s bank account).
- **[Stellar Wallets Kit](https://stellarwalletskit.dev/)** — one wallet layer for **connect + sign** (e.g. Freighter, Albedo) across escrow and ramp flows.
- **[Blend](https://www.blend.capital/)** — **Soroban** lending pools as the Stellar-native **liquidity** layer alongside deal escrow ([docs](https://docs.blend.capital/)).
- **Fiat ramps** — **[Etherfuse](https://etherfuse.com)**, **[Alfred Pay](https://alfredpay.io)**, **[BlindPay](https://blindpay.com)** (anchor-style server clients + UI), **[MoneyGram](https://developer.moneygram.com/moneygram-developer/docs/access-to-moneygram-ramps)** Stellar on/off-ramp APIs.
- **SEP building blocks** — shared modules under `lib/anchors/sep/` for **SEP 1, 6, 10, 12, 24, 31, 38** alongside provider APIs (see [`doc/architecture.md`](doc/architecture.md)).

Together, these choices keep **deal funds non-custodial** where escrow applies, while still giving users **real-world on- and off-ramps** and a **consistent wallet** experience on the same network.

---

## How it works (end-to-end)

1. **Deal setup** — The PyME describes the purchase (product, supplier, price, term) and splits supplier pay into **milestones** (for example 50% on shipment, 50% on delivery proof). A **Stellar escrow** is created via Trustless Work; the PyME **signs with a wallet** so deployment is explicit and on-chain.
2. **Funding** — Investors commit **USDC** into that escrow from the marketplace. Capital is **locked** until the contract allows a release.
3. **Delivery and releases** — The supplier fulfills the order and provides proof. When milestones are **approved** (by the PyME and, where the product enables it, an **admin** for oversight or dispute handling), the contract **pays the supplier** to their Stellar address in stages.
4. **Repayment** — When the term ends, the PyME **repays investors** (principal and agreed yield) according to the deal.

### Roles and data (for technical reviewers)

Three primary roles — **pyme**, **investor**, **supplier** — map to the flows above. **Authentication and business metadata** (profiles, deal records, marketplace listings) live in **[Supabase](https://supabase.com)** (Postgres + Auth). **Escrow balances, releases, and settlement** live on **Stellar** and are visible as on-chain activity tied to the escrow contract.

---

## Tech Stack

| Layer        | Technology |
|-------------|------------|
| Frontend    | [Next.js](https://nextjs.org) 16, [React](https://react.dev) 19, [Tailwind CSS](https://tailwindcss.com), [shadcn/ui](https://ui.shadcn.com) |
| Auth & DB   | [Supabase](https://supabase.com) (Auth, Postgres) |
| Escrow      | [Trustless Work](https://docs.trustlesswork.com/) — see [Stellar ecosystem](#stellar-ecosystem) |
| Wallets     | [Stellar Wallets Kit](https://stellarwalletskit.dev/) — see [Stellar ecosystem](#stellar-ecosystem) |
| Lending     | [Blend](https://www.blend.capital/) (Stellar Soroban) — see [Stellar ecosystem](#stellar-ecosystem) |
| Styling     | Tailwind, next-themes (light/dark) |

---

## Stellar ecosystem

MERCATO runs on the [Stellar](https://stellar.org) network. The items below match **[`doc/architecture.md`](doc/architecture.md)** (diagrams, flows, env reference in §5–6 and §9), including **MoneyGram** Stellar ramps and **[Blend](https://www.blend.capital/)** Soroban lending.

| Product | Role in this application |
|--------|---------------------------|
| [Trustless Work](https://docs.trustlesswork.com/) | **Escrow** — Non-custodial multi-release contracts: initialize and deploy escrow via the Trustless Work API, sign with the user’s wallet, and drive milestone releases. The app uses `@trustless-work/escrow` and the configured USDC trustline for on-chain settlement. |
| [Stellar Wallets Kit](https://stellarwalletskit.dev/) | **Wallets** — Single integration for connecting and signing (e.g. **Freighter**, **Albedo**) with `@creit.tech/stellar-wallets-kit`, including escrow deployment and ramp flows that require a signed Stellar transaction. |
| [Blend](https://www.blend.capital/) | **Soroban lending** — [Blend Capital](https://www.blend.capital/)’s **Blend** protocol: decentralized lending pools on **Stellar Soroban**, created by users, DAOs, and institutions (see their site). Protocol reference: **[Blend v2 docs](https://docs.blend.capital/)**. MERCATO uses Blend as the Stellar-native **liquidity / lending** layer alongside Trustless Work escrow (see [`doc/architecture.md`](doc/architecture.md)). |
| [Etherfuse](https://etherfuse.com) | **Fiat ramp** — Mexico (SPEI) ↔ Stellar **USDC** (and **CETES** where the deployment exposes them). KYC via iframe; off-ramp uses deferred signing (poll for XDR, then sign in-wallet). Server-side `EtherfuseClient` in `lib/anchors/etherfuse/`. |
| [Alfred Pay](https://alfredpay.io) | **Fiat ramp** — Latin America, SPEI ↔ **USDC**; form-based KYC. Server-side `AlfredPayClient` in `lib/anchors/alfredpay/`. |
| [BlindPay](https://blindpay.com) | **Fiat ramp** — Global rails ↔ Stellar stablecoins (e.g. **USDB** in configured flows). ToS, redirect KYC, wallet registration, and payout submission; dedicated onboarding at `/dashboard/ramp/blindpay-setup`. Server-side `BlindPayClient` in `lib/anchors/blindpay/`. |
| [MoneyGram (Stellar ramps)](https://developer.moneygram.com/moneygram-developer/docs/access-to-moneygram-ramps) | **Fiat ramp (Stellar)** — MoneyGram’s **Stellar**-based on/off-ramp (developer docs cover acquiring **XLM** and **USDC**, **SEP-10** authentication, **SEP-9** customer info, and transaction lifecycle). Production access uses **Ramps Instant Access** (wallet/domain allowlisting via the same developer portal). |
| **SEP modules** (`lib/anchors/sep/`) | Shared **Stellar Ecosystem Proposal** building blocks used with the anchor layer (SEP **1, 6, 10, 12, 24, 31, 38** per the architecture doc), alongside each provider’s REST API. |

**Etherfuse**, **Alfred Pay**, and **BlindPay** share the `Anchor` interface; behavior and env-driven availability are summarized in [`lib/anchors/README.md`](lib/anchors/README.md). Those anchors appear in `/dashboard/ramp` only when their server env vars are set. **MoneyGram** follows MoneyGram’s Stellar ramp documentation (not the same `lib/anchors` factory path). **Blend** ([blend.capital](https://www.blend.capital/), [docs](https://docs.blend.capital/)) is Soroban lending infrastructure, separate from fiat ramps and from the Trustless Work escrow SDK path.

---

## Documentation

Architecture and design docs (with diagrams) live in the **[`doc/`](doc/)** folder:

- **[Contributing](CONTRIBUTING.md)** — How to contribute (including [Drips Wave — Stellar](https://www.drips.network/wave/stellar)), local checks, and PR / commit expectations.
- **[Architecture](doc/architecture.md)** — System overview, application flows, tech stack, Stellar/Trustless Work escrow, Blend (Soroban lending), ramp providers (Etherfuse, Alfred Pay, BlindPay, MoneyGram), SEP usage, data split, and environment variables. Includes Mermaid diagrams.

---

## Project Structure

```
app/
  page.tsx              # Landing (hero, stakeholders, trust, CTA)
  how-it-works/         # Flow explanation
  marketplace/          # Browse and filter deals
  create-deal/          # PyME flow: deal basics → supplier & terms → milestones → deploy escrow
  auth/login, sign-up/  # Supabase auth
  dashboard/            # User dashboard (role-based)
  deals/[id]/           # Deal detail
  suppliers/            # Supplier directory
  settings/             # Profile (e.g. Stellar address)
components/
  navigation.tsx        # Header: nav links, connect wallet, user menu
  navigation/           # NavLinks, WalletNav, UserNav (composition)
  deal-card.tsx         # Marketplace deal card
lib/
  trustless/            # Trustless Work config, wallet kit, trustlines (USDC)
  supabase/             # Supabase client
  format.ts             # Currency / number formatting
providers/
  wallet-provider.tsx   # Global Stellar wallet state (connect/disconnect)
hooks/
  use-wallet.ts         # Connect wallet, disconnect, truncated address
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/) (or npm / yarn)
- [Supabase](https://supabase.com) project
- [Trustless Work](https://docs.trustlesswork.com/) API key and Stellar addresses (platform + trustline) for escrow
- Optional: Etherfuse, Alfred Pay, and/or BlindPay credentials if you want fiat on/off-ramp — see `env.sample` and [Architecture §9](doc/architecture.md#9-environment-variables)

### 1. Clone and install

```bash
git clone <your-repo-url>
cd mercato
pnpm install
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
| `NEXT_PUBLIC_TRUSTLESS_WORK_API_KEY` | Trustless Work API key |
| `NEXT_PUBLIC_TRUSTLESS_NETWORK` | `testnet` or `mainnet` |
| `NEXT_PUBLIC_MERCATO_PLATFORM_ADDRESS` | Stellar address for the platform (escrow roles) |
| `NEXT_PUBLIC_TRUSTLESSLINE_ADDRESS` | USDC trustline contract address for escrow |

Ramp keys (`ETHERFUSE_*`, `ALFREDPAY_*`, `BLINDPAY_*`) are optional; see `env.sample` and [Architecture §9](doc/architecture.md#9-environment-variables).

### 3. Run the app

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Use **auth**: `/auth/login`, `/auth/sign-up`. Connect a Stellar wallet (e.g. Freighter on testnet) to create deals or interact with escrow.

### 4. Build for production

```bash
pnpm build
pnpm start
```

---

## Main Features

- **Role-based flows**: PyME (create deal, approve milestones), Investor (browse/fund deals), Supplier (profile, delivery proof).
- **Connect Stellar wallet** in the header (Freighter, Albedo); required to create a deal and sign escrow deployment.
- **Create deal & deploy escrow**: Multi-step form (deal basics → supplier & terms → milestones); then deploy multi-release escrow via Trustless Work and sign with the connected wallet.
- **Non-custodial escrow**: Funds in USDC; milestone-based release to supplier; platform as release signer and dispute resolver.
- **Marketplace**: Browse deals (search, status, category); currently backed by mock data; can be wired to Supabase deals.
- **Dashboard**: Role-specific links (e.g. Create Deal, My Investments, Active Deals, Delivery Proof).
- **Settings**: Profile and Stellar address for PyMEs/suppliers so escrow can use the correct addresses.

---

## License

Private / unlicensed unless otherwise specified.
