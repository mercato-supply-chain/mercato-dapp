# MERCATO — Architecture Documentation

**Supply chain finance, transparently secured.**

This document describes the MERCATO application architecture: what it does, which tools and Stellar-based projects it uses, and how the pieces fit together. Diagrams use [Mermaid](https://mermaid.js.org/) and render in GitHub, GitLab, and most Markdown viewers.

> **AI agents:** For a concise, machine-oriented index (lifecycles, routes, signing matrix, implementation status), start with **[AGENTS.md](../AGENTS.md)**. This document provides deeper diagrams and integration detail.

---

## 1. High-Level System Overview

```mermaid
flowchart TB
  subgraph Users["Users"]
    PyME[PyME / Buyer]
    Investor[Investor]
    Supplier[Supplier]
    Admin[Admin]
  end

  subgraph App["MERCATO Application"]
    Next[Next.js App Router]
    API[API Routes]
    Middleware[Middleware\nSession refresh]
  end

  subgraph AuthAndData["Auth & Data"]
    Supabase[Supabase\nAuth + Postgres]
  end

  subgraph Stellar["Stellar Ecosystem"]
    Trustless[Trustless Work API]
    StellarNet[Stellar Network]
  end

  subgraph Ramps["Fiat On/Off Ramps"]
    Etherfuse[Etherfuse]
    AlfredPay[Alfred Pay]
    BlindPay[BlindPay]
  end

  subgraph WalletProviders["Wallet Providers"]
    SWK[Stellar Wallets Kit\nFreighter · Albedo]
    Pollar[Pollar\nEmbedded wallet]
  end

  subgraph Yield["Yield Vaults"]
    DeFindex[DeFindex\nSoroban vaults]
  end

  PyME --> Next
  Investor --> Next
  Supplier --> Next
  Admin --> Next
  Next --> Middleware --> Supabase
  Next --> API
  API --> Supabase
  Next --> SWK
  Next --> Pollar
  Next --> Trustless
  Next --> DeFindex
  DeFindex --> StellarNet
  API --> Etherfuse
  API --> AlfredPay
  API --> BlindPay
  Trustless --> StellarNet
  SWK --> StellarNet
  Pollar --> StellarNet
  Ramps -.-> StellarNet
```

MERCATO is a web app that connects **PyMEs**, **investors**, and **suppliers** through transparent Stellar settlement. Auth and deal data live in **Supabase**; **investor funding** pays the supplier directly (plus a 1% platform fee); **repayment** uses non-custodial **Trustless Work multi-release escrow** on **Stellar**. Users connect **Stellar Wallets Kit** (Freighter, Albedo) or **Pollar** embedded wallets; TW escrow signing requires SWK. Users move fiat to/from Stellar assets via configurable **ramp providers** (Etherfuse, AlfredPay, BlindPay). **DeFindex** ([documentation](https://docs.defindex.io)) supplies **Soroban yield vaults** for investor/PyME treasury at `/dashboard/vault`, with admin monitoring at `/dashboard/admin/vault`. **Blend** testnet assets appear only as helpers for DeFindex vault trustline setup — there is no direct Blend SDK integration. An **Admin** role creates repayment escrows, releases milestones, and oversees vault operations.

---

## 2. What the Application Does

### 2.1 Core Deal Flow

```mermaid
sequenceDiagram
  participant PyME
  participant App
  participant Trustless
  participant Stellar
  participant Investor
  participant Supplier

  rect rgb(240, 248, 255)
  Note over PyME,Supplier: 1 - PyME creates deal (no escrow)
  PyME->>App: Create deal (product, supplier, terms)
  App-->>PyME: Deal published seeking funding
  end

  rect rgb(245, 255, 245)
  Note over PyME,Supplier: 2 - Investor funds supplier directly
  Investor->>App: Browse marketplace and select deal
  Investor->>Stellar: Pay supplier invoice + 1% platform fee
  end

  rect rgb(255, 248, 240)
  Note over PyME,Supplier: 3 - Supplier ships (paid up front)
  Supplier->>App: Fulfill order / ship goods
  end

  rect rgb(248, 245, 255)
  Note over PyME,Supplier: 4 - Admin multi-release repayment escrow
  PyME->>App: Confirm order arrived
  App->>Trustless: Admin deploys first milestone (e.g. 50%)
  PyME->>Trustless: Micro-fund until milestone covered
  Trustless->>Stellar: Admin releases milestone to investor
  App->>Trustless: Admin adds next milestone via updateEscrow
  end
```

### 2.2 User Roles

| Role | Main actions |
|------|-------------|
| **PyME (Buyer)** | Create deal, choose supplier from catalog, confirm order arrival, micro-fund repayment escrow. |
| **Investor** | Browse marketplace, fund deals in USDC (direct to supplier + 1% platform fee). Receives principal + yield from repayment milestones to their Stellar address. Optional DeFindex vault for idle capital. |
| **Supplier** | Manage company profile and product catalog, fulfill orders. Receives full invoice payment up front (fee-free). |
| **Admin** | Create multi-release repayment escrows, approve/release milestones, add subsequent milestones, resolve disputes. |

### 2.3 Application Routes

```mermaid
flowchart LR
  subgraph Public["Public Pages"]
    Landing["/"]
    How["/how-it-works"]
    Deals["/deals"]
    Auth["/auth/*"]
    SupplierDir["/suppliers"]
    SupplierDetail["/suppliers/[id]"]
    PymeDir["/pymes"]
    PymeDetail["/pymes/[id]"]
    InvestorDir["/investors"]
    InvestorDetail["/investors/[id]"]
    Blog["/blog"]
    Events["/events/[slug]"]
  end

  subgraph DealPages["Deal Pages"]
    DealDetail["/deals/[id]"]
    DealEdit["/deals/[id]/edit"]
    CreateDeal["/create-deal"]
  end

  subgraph Dashboard["Dashboard (auth required)"]
    Dash["/dashboard"]
    Wallets["/dashboard/wallets"]
    Vault["/dashboard/vault"]
    DashDeals["/dashboard/deals"]
    DashDeliveries["/dashboard/deliveries"]
    DashInvestments["/dashboard/investments"]
    DashAdminApprovals["/dashboard/admin/approvals"]
    DashAdminReleases["/dashboard/admin/releases"]
    DashAdminVault["/dashboard/admin/vault"]
    DashAdminLeads["/dashboard/admin/leads"]
    Ramp["/dashboard/ramp"]
    BlindPaySetup["/dashboard/ramp/blindpay-setup"]
    SupplierProfile["/dashboard/supplier-profile"]
    Settings["/settings"]
  end

  Landing --> Deals
  Deals --> DealDetail
  Auth --> Dash
  Dash --> Wallets
  Dash --> Vault
  Dash --> DashDeals
  Dash --> DashInvestments
  Dash --> DashAdminApprovals
  Dash --> Ramp
  Dash --> CreateDeal
  Ramp --> BlindPaySetup
```

**Redirects:** `/marketplace` and `/orders` → `/deals`. `/dashboard/admin` → `/dashboard/admin/approvals`.

**Full route inventory:**

| Route | Type | Description |
|-------|------|-------------|
| `/` | Public | Landing page (hero, stakeholders, trust, CTA) |
| `/how-it-works` | Public | Step-by-step flow explanation |
| `/our-story` | Public | Company story |
| `/deals` | Public | **Marketplace** — browse and filter deals |
| `/marketplace`, `/orders` | Public | Redirect → `/deals` |
| `/create-deal` | Auth | Multi-step deal creation (DB only; no escrow at create) |
| `/deals/[id]` | Public | Deal detail (funding + repayment panels) |
| `/deals/[id]/edit` | Auth | Edit deal terms (pre-funding only) |
| `/auth/login` | Public | Supabase email login |
| `/auth/sign-up` | Public | Registration with role selection |
| `/auth/sign-up-success` | Public | Post-signup confirmation |
| `/auth/forgot-password` | Public | Password reset request |
| `/auth/update-password` | Public | Set new password |
| `/auth/callback` | API | OAuth / magic-link callback |
| `/dashboard` | Auth | Role-based overview (stats, quick actions, recent deals) |
| `/dashboard/wallets` | Auth | Connect SWK or Pollar; balances; Pollar activation |
| `/dashboard/vault` | Auth | DeFindex user vault (investor, PyME) |
| `/dashboard/admin/approvals` | Admin | Create repayment escrows for order-confirmed deals |
| `/dashboard/admin/releases` | Admin | Release funded repayment milestones |
| `/dashboard/admin/vault` | Admin | DeFindex vault monitor (TVL, strategies, rebalance) |
| `/dashboard/admin/leads` | Admin | Event lead submissions |
| `/dashboard/deals` | Auth | Supplier's deal list |
| `/dashboard/deliveries` | Auth | Supplier delivery management |
| `/dashboard/investments` | Auth | Investor portfolio view |
| `/dashboard/ramp` | Auth | Add funds / cash out (fiat ↔ USDC) |
| `/dashboard/ramp/blindpay-setup` | Auth | BlindPay onboarding wizard (ToS, KYC, wallet) |
| `/dashboard/supplier-profile` | Auth | Manage supplier companies and products |
| `/investors` | Public | Investor directory |
| `/investors/[id]` | Public | Investor public profile |
| `/pymes` | Public | PyME directory |
| `/pymes/[id]` | Public | PyME public profile |
| `/suppliers` | Public | Supplier directory |
| `/suppliers/[id]` | Public | Supplier public profile |
| `/blog`, `/blog/[slug]` | Public | Blog index and articles |
| `/events/[slug]` | Public | Event landing pages + lead capture |
| `/settings` | Auth | User profile and Stellar address |
| `/api/catalog` | API | Supplier product catalog |
| `/api/ramp/*` | API | Ramp provider proxy (14 routes) |
| `/api/defindex/*` | API | DeFindex vault (10 routes) |
| `/api/stellar/*` | API | Tx submit, SAC balance, trustline, vault activity |
| `/api/auth/pollar-sync` | API | Sync Pollar session to Supabase |
| `/api/pollar/activate` | API | Activate Pollar embedded wallet |
| `/api/reputation/*` | API | Reputation stake and refresh |
| `/api/referral/*` | API | Supplier referral program |
| `/api/leads` | API | Event lead form submissions |
| `/api/notifications/create` | API | Manual notification creation |

### 2.4 Deal and Repayment Lifecycles

MERCATO tracks **two parallel lifecycles** on each deal: `deals.status` (business progress) and `deals.repayment_status` (Trustless Work escrow). See also [AGENTS.md](../AGENTS.md#end-to-end-deal-flow-authoritative).

**Deal status (`deals.status`):**

| DB value | App `DealStatus` | Trigger |
|----------|------------------|---------|
| `seeking_funding` | `awaiting_funding` | Deal created |
| `funded` | `funded` | Investor funds supplier |
| `in_progress` | `in_progress` | Supplier ships (tracking added) |
| `completed` | `completed` | All repayment milestones released |

**Repayment status (`deals.repayment_status`):**

```
none → order_confirmed → escrow_initialized → funding → ready_to_release
     → partially_released → released
```

| Status | Meaning |
|--------|---------|
| `none` | Default at deal creation |
| `order_confirmed` | PyME confirmed delivery |
| `escrow_initialized` | Admin deployed TW multi-release escrow |
| `funding` | PyME micro-funding in progress |
| `ready_to_release` | Milestone fully funded, awaiting admin release |
| `partially_released` | At least one milestone released, more remain |
| `released` | All milestones released; deal can complete |

Investor payout address is resolved from `profiles.address` or `profiles.stellar_public_key` via `lib/deals/investor-wallet.ts`.

---

## 3. Tech Stack

```mermaid
flowchart TB
  subgraph Frontend["Frontend"]
    Next["Next.js 16"]
    React["React 19"]
    Tailwind["Tailwind CSS"]
    Shadcn["shadcn/ui (Radix)"]
    Themes["next-themes"]
    Recharts["Recharts"]
  end

  subgraph Backend["Backend"]
    NextAPI["API Routes"]
    Middleware["Middleware\n(Supabase session)"]
    Zod["Zod validation"]
  end

  subgraph AuthDB["Auth & Database"]
    Supabase["Supabase"]
    Postgres["Postgres"]
    Supabase --> Postgres
  end

  subgraph StellarStack["Stellar Stack"]
    TrustlessPkg["@trustless-work/escrow"]
    StellarSDK["@stellar/stellar-sdk"]
    WalletKit["@creit.tech/stellar-wallets-kit"]
    PollarSDK["@pollar/react"]
    DeFindexSDK["@defindex/sdk"]
  end

  subgraph RampLib["Ramp Integration"]
    AnchorFactory["anchor-factory.ts"]
    Anchors["Anchor clients\n(Etherfuse, AlfredPay, BlindPay)"]
    SEP["SEP protocol modules\n(1, 6, 10, 12, 24, 31, 38)"]
  end

  Next --> React
  Next --> Tailwind
  Next --> Shadcn
  Next --> NextAPI
  NextAPI --> Middleware
  Middleware --> Supabase
  NextAPI --> AnchorFactory
  AnchorFactory --> Anchors
  Anchors --> SEP
  Next --> TrustlessPkg
  Next --> StellarSDK
  Next --> WalletKit
  Next --> PollarSDK
  Next --> DeFindexSDK
```

| Layer | Technology | Version |
|-------|-----------|---------|
| **Framework** | Next.js (App Router, Turbopack) | 16.1 |
| **UI** | React, Tailwind CSS, shadcn/ui (Radix primitives), Recharts | React 19.2 |
| **Theming** | next-themes (light / dark) | 0.4 |
| **Auth & DB** | Supabase (Auth, Postgres, SSR client) | 2.47 |
| **Escrow** | Trustless Work API (@trustless-work/escrow) | 3.0 |
| **Wallets** | Stellar Wallets Kit (Freighter, Albedo) + Pollar embedded | 1.9 / 0.6 |
| **Stellar** | @stellar/stellar-sdk | 14.5 |
| **Yield vaults (Soroban)** | [DeFindex](https://docs.defindex.io) (@defindex/sdk) — user vault + admin monitor | 0.3 |
| **i18n** | en/es dictionaries, locale cookie | — |
| **Validation** | Zod, react-hook-form | 3.24 / 7.54 |
| **Ramps** | Custom anchor clients + SEP modules (lib/anchors) | — |

---

## 4. Project Structure

```
mercato-dapp/
├── AGENTS.md                     # AI agent orientation (start here for agents)
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout (providers, fonts, theme, i18n)
│   ├── page.tsx                  # Landing page
│   ├── deals/                    # Marketplace (/deals) + [id] detail + edit
│   ├── auth/                     # Login, sign-up, password reset, callback
│   ├── create-deal/              # Multi-step deal creation
│   ├── dashboard/
│   │   ├── page.tsx              # Role-based overview
│   │   ├── wallets/              # SWK + Pollar connect, balances
│   │   ├── vault/                # DeFindex user vault
│   │   ├── admin/
│   │   │   ├── approvals/        # Create repayment escrows
│   │   │   ├── releases/         # Release funded milestones
│   │   │   ├── vault/            # DeFindex admin monitor
│   │   │   └── leads/            # Event lead submissions
│   │   ├── deals/                # Supplier deal list
│   │   ├── deliveries/           # Delivery management
│   │   ├── investments/          # Investor portfolio
│   │   ├── ramp/                 # Fiat on/off ramp + blindpay-setup
│   │   └── supplier-profile/     # Company & product management
│   ├── blog/, events/, investors/, pymes/, suppliers/
│   ├── settings/
│   └── api/
│       ├── ramp/                 # Ramp proxy (14 routes)
│       ├── defindex/             # Vault API (10 routes)
│       ├── stellar/              # Submit, SAC, trustline, vault activity
│       ├── auth/pollar-sync/     # Pollar → Supabase sync
│       └── pollar/activate/      # Pollar wallet activation
│
├── components/
│   ├── deals/                    # Funding, repayment, delivery panels
│   ├── ramp/                     # Ramp UI (provider + variant composition)
│   ├── wallet/                   # Wallet status card
│   ├── dashboard/, admin/
│   └── ui/                       # shadcn/ui primitives
│
├── lib/
│   ├── deals.ts, deals/          # Mapping, fees, investor-wallet, repayment helpers
│   ├── mercato-wallet.ts         # Unified wallet types, storage, balance parsing
│   ├── stellar/                  # USDC split payment, submit, vault trustline helpers
│   ├── trustless/                # TW config, wallet-kit, trustlines
│   ├── defindex/                 # Vault config, monitor, math, route helpers
│   ├── anchor-factory.ts, ramp-api.ts
│   ├── anchors/                  # Etherfuse, AlfredPay, BlindPay + SEP modules
│   ├── admin/, dashboard/, investments/
│   ├── i18n/                     # en/es dictionaries, locale
│   └── supabase/                 # Client, server, service, proxy
│
├── hooks/                        # use-wallet, use-repayment-escrow, use-deal-detail, useDefindex, …
├── providers/                    # wallet-provider, pollar-provider
├── middleware.ts                 # Supabase session + locale cookie
└── supabase/migrations/          # Database schema (source of truth)
```

---

## 5. Stellar, Direct Funding, and Trustless Work (Repayment Escrow)

**Funding is not escrowed.** Investors pay the supplier (principal) and Mercato (1% platform fee) with a classic Stellar USDC payment built in `lib/stellar/build-usdc-split-payment.ts`.

**Repayment is escrowed and non-custodial.** After the PyME confirms order arrival, an **admin** deploys a Trustless Work **multi-release** repayment escrow. The PyME micro-funds; the platform wallet approves and releases each milestone to the investor. Further milestones are added with `updateEscrow` so investors can receive early payouts (e.g. first 50%) without waiting for the full grossed amount.

### 5.1 Trustless Work Integration

```mermaid
flowchart LR
  subgraph App["MERCATO App"]
    Config["TrustlessWorkProvider\n(config)"]
    Hook["useRepaymentEscrow\ndeploy / fund / release / update"]
    Wallet["signTransaction\n(wallet-kit)"]
  end

  subgraph Trustless["Trustless Work"]
    API["Trustless Work API"]
  end

  subgraph Stellar["Stellar"]
    Contract["Multi-release\nrepayment escrow"]
    USDC["USDC trustline"]
  end

  Config --> Hook
  Hook --> API
  Hook --> Wallet
  Wallet --> Stellar
  API --> Contract
  Contract --> USDC
```

### 5.2 Escrow Configuration

| Env var | Purpose |
|---------|---------|
| `NEXT_PUBLIC_MERCATO_PLATFORM_ADDRESS` | Platform Stellar address — `approver`, `releaseSigner`, `disputeResolver`, `platformAddress`; also receives 1% at investor funding |
| `NEXT_PUBLIC_TRUSTLESSLINE_ADDRESS` | USDC trustline contract address for repayment escrow |
| `NEXT_PUBLIC_TRUSTLESS_NETWORK` | `testnet` or `mainnet` |
| `NEXT_PUBLIC_TRUSTLESS_WORK_API_KEY` | Trustless Work API key |
| `NEXT_PUBLIC_USDC_ISSUER` | Classic USDC issuer for investor→supplier direct payments |

### 5.3 Repayment Escrow Sequence

```mermaid
sequenceDiagram
  participant PyME
  participant Admin
  participant Hook as useRepaymentEscrow
  participant TW as TrustlessAPI
  participant Wallet
  participant Investor

  PyME->>PyME: Confirm order arrived
  Admin->>Hook: deployRepaymentEscrow first milestone e.g. 50 percent
  Hook->>TW: deployEscrow multi-release
  TW-->>Hook: Unsigned XDR
  Hook->>Wallet: Admin signs
  loop Micro-fund
    PyME->>Hook: fundRepaymentEscrow partial amount
    Hook->>TW: fundEscrow multi-release
  end
  Admin->>Hook: approveAndReleaseMilestone
  Hook->>TW: approve + release milestone
  TW->>Investor: Milestone payout net of fees
  Admin->>Hook: addRepaymentMilestone via updateEscrow
  Note over PyME,Investor: Repeat fund / release until full grossed total paid
```

**Fee math:** PyME funds a **grossed** amount so that after platform **1%** + Trustless Work **0.3%** on release, the investor nets principal + interest. See `lib/deals/fees.ts` (`repaymentEscrowAmount`, `repaymentMilestoneAmount`).

**Repayment status lifecycle:** `none` → `order_confirmed` → `escrow_initialized` → `funding` → `ready_to_release` → `partially_released` → `released` (deal completed).

### 5.4 Wallet Providers (Stellar Wallets Kit + Pollar)

```mermaid
flowchart TB
  subgraph UI["Wallet UI"]
    WalletsPage["/dashboard/wallets"]
    WalletCard["wallet-status-card"]
    NavWallet["Header wallet connect"]
  end

  subgraph Providers["Provider stack"]
    WP["wallet-provider.tsx"]
    PP["pollar-provider.tsx"]
    SWK["use-external-wallet.ts\nFreighter · Albedo"]
    Pollar["use-pollar-wallet.ts\n@pollar/react"]
  end

  subgraph Persist["Persistence"]
    LS["localStorage mercato_wallet"]
    Profile["profiles.wallet_provider\npollar_wallet_id\nstellar_public_key\nwallet_status"]
  end

  WalletsPage --> WP
  NavWallet --> WP
  WP --> SWK
  WP --> PP
  WP --> LS
  Pollar --> Profile
```

| Provider | ID | Signing | TW escrow | Deal funding |
|----------|-----|---------|-----------|--------------|
| Stellar Wallets Kit | `stellar-wallets-kit` | `signTransaction` via `lib/trustless/wallet-kit.ts` | ✅ Required | ✅ |
| Pollar embedded | `pollar` | `signAndSubmitTx` via `@pollar/react` | ❌ Shows limitation message | ✅ |

Pollar sync: `POST /api/auth/pollar-sync`. Activation: `POST /api/pollar/activate`. Limitation text: `PollarWalletKitLimitations` in `lib/mercato-wallet.ts`.

### 5.5 DeFindex Yield Vaults

DeFindex provides Soroban tokenized yield vaults for investor/PyME treasury, separate from deal escrow.

```mermaid
flowchart LR
  subgraph User["User flows"]
    VaultDash["/dashboard/vault"]
    Hook["useDefindex.ts"]
    Submit["POST /api/defindex/submit"]
  end

  subgraph Admin["Admin flows"]
    VaultMon["/dashboard/admin/vault"]
    Create["POST /api/defindex/admin/create-vault"]
    Rebalance["POST /api/defindex/admin/rebalance"]
    Monitor["GET /api/defindex/admin/monitor"]
  end

  subgraph DeFindex["DeFindex API + Soroban"]
  SDK["@defindex/sdk"]
  Contract["Vault contract on Stellar"]
  end

  VaultDash --> Hook --> Submit --> SDK --> Contract
  VaultMon --> Monitor --> SDK
  Create --> SDK
  Rebalance --> SDK
```

| Env var | Purpose |
|---------|---------|
| `DEFINDEX_API_KEY` | Server-only DeFindex API key |
| `NEXT_PUBLIC_DEFINDEX_VAULT_ADDRESS` | Public vault contract address |
| `MERCATO_DEFINDEX_VAULT_ADDRESS` | Server override for vault address |
| `NEXT_PUBLIC_DEFINDEX_ASSET_DECIMALS` | Asset decimals (default 7) |

User signs deposit/withdraw XDR client-side; server submits via `api/defindex/submit`. Admin can create vaults, deposit, rebalance, and monitor TVL/strategies. Blend testnet SAC helpers in `lib/stellar/vault-asset-trustline.ts` support vault asset trustline setup only.

---

## 6. Ramp Providers (Fiat On/Off)

MERCATO supports **multiple ramp providers**. Users choose one in the UI; the app proxies all anchor calls through **API routes** so API keys stay server-side.

### 6.1 Architecture

```mermaid
flowchart TB
  subgraph UI["Ramp UI (components/ramp/)"]
    Page["page.tsx\nOrchestrator"]
    Provider["RampProvider\nShared context"]
    OnRamp["OnRampForm\nFiat → USDC"]
    OffRamp["OffRampForm\nUSDC → Fiat"]
    Bank["BankAccountSelector"]
    Shared["QuoteCard · StepIndicator\nCopyButton · ProviderBadges\nWalletBanner · ProviderSelector"]
  end

  subgraph API["API Routes (server)"]
    ConfigAPI["/api/ramp/config"]
    CustomerAPI["/api/ramp/customer"]
    QuoteAPI["/api/ramp/quote"]
    OnRampAPI["/api/ramp/on-ramp"]
    OffRampAPI["/api/ramp/off-ramp"]
    FiatAPI["/api/ramp/fiat-accounts"]
    BlindPayAPIs["/api/ramp/blindpay/*"]
  end

  subgraph Factory["Anchor Factory (lib/)"]
    AnchorFactory["anchor-factory.ts\ngetConfiguredProviders()\ngetAnchor(providerId)"]
    RampAPI["ramp-api.ts\nrequireAuthAndAnchor()"]
  end

  subgraph Anchors["Anchor Clients (lib/anchors/)"]
    Etherfuse["EtherfuseClient"]
    AlfredPay["AlfredPayClient"]
    BlindPay["BlindPayClient"]
    AnchorInterface["Anchor interface\n(types.ts)"]
  end

  Page --> Provider
  Provider --> OnRamp
  Provider --> OffRamp
  OffRamp --> Bank
  OnRamp --> Shared
  OffRamp --> Shared

  OnRamp --> CustomerAPI
  OnRamp --> QuoteAPI
  OnRamp --> OnRampAPI
  OffRamp --> OffRampAPI
  OffRamp --> FiatAPI

  ConfigAPI --> AnchorFactory
  CustomerAPI --> RampAPI --> AnchorFactory
  QuoteAPI --> RampAPI
  OnRampAPI --> RampAPI
  OffRampAPI --> RampAPI
  FiatAPI --> RampAPI
  BlindPayAPIs --> BlindPay

  AnchorFactory --> Etherfuse
  AnchorFactory --> AlfredPay
  AnchorFactory --> BlindPay
  Etherfuse --> AnchorInterface
  AlfredPay --> AnchorInterface
  BlindPay --> AnchorInterface
```

### 6.2 Ramp Component Architecture

The ramp UI follows a **provider + variant** composition pattern:

| Component | Lines | Responsibility |
|-----------|-------|---------------|
| `ramp-provider.tsx` | ~280 | Context provider — shared state (`config`, `customer`, `action`), actions (`ensureCustomer`, `fetchQuote`), and meta (`walletInfo`, `isConnected`) |
| `on-ramp-form.tsx` | ~340 | On-ramp variant — amount entry, quote review, payment instructions display |
| `off-ramp-form.tsx` | ~370 | Off-ramp variant — quote, confirm, sign & submit transaction |
| `bank-account-selector.tsx` | ~210 | Bank account CRUD with collapsible add form |
| `page.tsx` | ~120 | Thin orchestrator — layout, tabs, Suspense boundary |

Shared presentational components: `QuoteCard`, `StepIndicator`, `CopyButton`, `ProviderBadges`, `ProviderSelector`, `WalletBanner`.

### 6.3 Provider Capabilities

| Provider | Region | Fiat rail | Stellar asset | KYC flow | Off-ramp signing |
|----------|--------|-----------|---------------|----------|-----------------|
| **Etherfuse** | Mexico | SPEI | USDC, CETES | Iframe | Deferred (poll for XDR, then sign) |
| **Alfred Pay** | Latin America | SPEI | USDC | Form | Standard |
| **BlindPay** | Global | Multiple | USDB | Redirect | Anchor payout submission |

**Etherfuse, Alfred Pay, and BlindPay:** availability is driven by **environment variables**; `getConfiguredProviders()` in `anchor-factory.ts` returns only anchors with all required env vars set. All three implement the shared `Anchor` interface from `lib/anchors/types.ts`.

### 6.4 On-Ramp Data Flow

```mermaid
sequenceDiagram
  participant User
  participant RampUI
  participant API
  participant Anchor
  participant External

  User->>RampUI: Enter amount and request quote
  RampUI->>API: POST /api/ramp/customer
  API->>Anchor: createCustomer()
  Anchor->>External: Provider API
  External-->>Anchor: customer data
  Anchor-->>API: customer
  API-->>RampUI: customer

  RampUI->>API: GET /api/ramp/quote
  API->>Anchor: getQuote()
  Anchor->>External: Quote API
  External-->>Anchor: quote data
  Anchor-->>API: quote
  API-->>RampUI: quote (rate, fee, expiry)

  User->>RampUI: Confirm on-ramp
  RampUI->>API: POST /api/ramp/on-ramp
  API->>Anchor: createOnRamp()
  Anchor->>External: Create order
  External-->>Anchor: order details
  Anchor-->>API: payment instructions
  API-->>RampUI: CLABE and reference

  User->>External: Send fiat via SPEI
  External->>Stellar: Credit USDC to user wallet
```

### 6.5 Off-Ramp Data Flow (with deferred signing)

```mermaid
sequenceDiagram
  participant User
  participant RampUI
  participant API
  participant Anchor
  participant Wallet
  participant Stellar

  User->>RampUI: Select bank, enter USDC amount
  RampUI->>API: GET /api/ramp/quote
  API->>Anchor: getQuote()
  Anchor-->>RampUI: quote

  User->>RampUI: Confirm cash out
  RampUI->>API: POST /api/ramp/off-ramp
  API->>Anchor: createOffRamp()
  Anchor-->>RampUI: off-ramp transaction (pending)

  loop Poll for signable transaction
    RampUI->>API: GET /api/ramp/off-ramp/[id]
    API->>Anchor: getOffRampTransaction()
    Anchor-->>RampUI: signableTransaction (XDR)
  end

  User->>RampUI: Sign and submit
  RampUI->>Wallet: signTransaction(XDR)
  User->>Wallet: Approve in wallet
  Wallet-->>RampUI: Signed XDR
  RampUI->>Stellar: submitSignedTransaction()
  Stellar-->>RampUI: Transaction confirmed
  Note over User,Stellar: Provider detects on-chain transfer, sends fiat
```

---

## 7. Data and Responsibility Split

```mermaid
flowchart LR
  subgraph Supabase["Supabase (Postgres)"]
    Profiles["profiles\n(id, role, name, company, address,\nwallet_provider, pollar_wallet_id,\nstellar_public_key, wallet_status)"]
    Deals["deals\n(amount, funding_tx_hash, repayment_status,\nrepayment_total_amount, repayment_milestones,\nescrow_contract_address, tracking_id,\nshipped_at, delivered_at)"]
    Notifications["notifications"]
    SupplierCompanies["supplier_companies\n(owner_id, name, country, sector)"]
    SupplierProducts["supplier_products"]
    Reputations["reputations\n(trust scores, stake signals)"]
    Leads["leads\n(event form submissions)"]
  end

  subgraph Stellar["Stellar Network"]
    DirectPay["Investor direct USDC\n(supplier + platform fee)"]
    EscrowState["Repayment multi-release escrow"]
    Balances["USDC / asset balances"]
    TxHistory["Transaction history"]
  end

  App["MERCATO App"] --> Supabase
  App --> Stellar
```

| Store | Owns | Source of truth for |
|-------|------|-------------------|
| **Supabase** | Users, profiles, roles, deal metadata, repayment status cache, supplier companies/products, reputations, leads, notifications | Who created what, funding tx hash, repayment lifecycle, supplier catalog, wallet metadata |
| **Stellar** | Direct funding payments, repayment escrow contracts, USDC balances | Funds movement, on-chain escrow milestones, payment receipts |

The app reads both stores and reconciles: `repayment_status` / `repayment_milestones` in Supabase mirror Trustless Work indexer state after fund / release / update.

### 7.1 In-App Notifications

A `notifications` table stores lifecycle events. **DB triggers** create notifications automatically for:

| Event | Recipients |
|-------|-----------|
| Deal created | All investors |
| Deal funded | Supplier (company owner), PyME |
| PyME × Investor deal created | PyME, Investor (when repayment escrow exists) |
| PyME × Investor deal complete | PyME, Investor (when repayment escrow exists) |

The bell icon in the nav shows unread count; clicking opens a dropdown with recent notifications and links to deals. Apply the tracked Supabase migrations in `supabase/migrations/` to enable.

---

## 8. Authentication and Middleware

```mermaid
sequenceDiagram
  participant Browser
  participant Middleware
  participant Supabase
  participant AppRoute

  Browser->>Middleware: Every request
  Middleware->>Supabase: updateSession() via SSR client
  Supabase-->>Middleware: Refreshed session cookies
  Middleware->>AppRoute: Forward request
  AppRoute->>Supabase: getUser() / queries
```

- **`middleware.ts`** runs on every request to keep the Supabase session alive (refreshes tokens via `lib/supabase/proxy.ts`).
- **Server components** use `lib/supabase/server.ts` (cookie-based SSR client).
- **API routes** use `requireAuth()` / `requireAuthAndAnchor()` from `lib/ramp-api.ts` for auth checks.
- **Client components** use `lib/supabase/client.ts` (browser client).

---

## 9. Environment Variables

| Variable | Scope | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Supabase service role key |
| `NEXT_PUBLIC_TRUSTLESS_WORK_API_KEY` | Public | Trustless Work API key |
| `NEXT_PUBLIC_TRUSTLESS_NETWORK` | Public | `testnet` or `mainnet` |
| `NEXT_PUBLIC_MERCATO_PLATFORM_ADDRESS` | Public | Platform Stellar address (fee recipient + repayment escrow roles) |
| `NEXT_PUBLIC_TRUSTLESSLINE_ADDRESS` | Public | USDC trustline contract address for repayment escrow |
| `NEXT_PUBLIC_USDC_ISSUER` | Public | Classic USDC issuer for direct investor→supplier payments |
| `DEFINDEX_API_KEY` | Server | DeFindex API key (never `NEXT_PUBLIC_*`) |
| `DEFINDEX_API_URL` | Server | DeFindex API base URL (optional) |
| `NEXT_PUBLIC_DEFINDEX_VAULT_ADDRESS` | Public | DeFindex vault contract address |
| `MERCATO_DEFINDEX_VAULT_ADDRESS` | Server | Server override for vault address |
| `NEXT_PUBLIC_DEFINDEX_ASSET_DECIMALS` | Public | Vault asset decimals (default 7) |
| `NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY` | Public | Pollar publishable key |
| `POLLAR_PUBLISHABLE_KEY` | Server | Duplicate for server routes (optional) |
| `POLLAR_SECRET_KEY` | Server | Pollar secret key |
| `POLLAR_WEBHOOK_SECRET` | Server | Pollar webhook signing secret |
| `NEXT_PUBLIC_POLLAR_NETWORK` | Public | `testnet` or `mainnet` for embedded wallets |
| `NEXT_PUBLIC_APP_URL` | Public | Canonical site URL (QR codes, links) |
| `ETHERFUSE_API_KEY` | Server | Etherfuse API key |
| `ETHERFUSE_BASE_URL` | Server | Etherfuse API base URL |
| `ALFREDPAY_API_KEY` | Server | AlfredPay API key |
| `ALFREDPAY_API_SECRET` | Server | AlfredPay API secret |
| `ALFREDPAY_BASE_URL` | Server | AlfredPay API base URL |
| `BLINDPAY_API_KEY` | Server | BlindPay API key |
| `BLINDPAY_INSTANCE_ID` | Server | BlindPay instance ID |
| `BLINDPAY_BASE_URL` | Server | BlindPay API base URL |

Ramp providers are **opt-in**: only those with all required env vars appear in `/api/ramp/config`. Setting zero ramp env vars disables the ramp UI gracefully.

---

## 10. Summary

```mermaid
flowchart TB
  subgraph What["What MERCATO does"]
    D1["PyMEs get working capital\nvia investor direct funding"]
    D2["Investors fund supplier invoices\nin USDC for short-term yield"]
    D3["Suppliers receive full payment\nup front fee-free"]
    D4["Users ramp fiat ↔ USDC\nvia chosen anchor provider"]
    D5["Admins create and release\nmulti-release repayment escrows"]
  end

  subgraph How["How it's built"]
    T1["Next.js 16 + React 19\nTailwind + shadcn/ui"]
    T2["Supabase\nAuth + Postgres"]
    T3["Trustless Work\nmulti-release repayment escrow"]
    T3c["DeFindex\nSoroban yield vaults"]
    T4["Stellar Wallets Kit\n+ Pollar embedded"]
    T5["Ramps\nEtherfuse · Alfred Pay · BlindPay"]
    T6["SEP modules\n1 · 6 · 10 · 12 · 24 · 31 · 38"]
  end

  What --> How
```

---

## References

- [Trustless Work](https://docs.trustlesswork.com/) — Escrow API and Stellar integration
- [Stellar](https://stellar.org) — Network and assets
- [Stellar Wallets Kit](https://stellarwalletskit.dev/) — Wallet connection (Freighter, Albedo)
- [Supabase](https://supabase.com) — Auth and database
- [lib/anchors/README.md](../lib/anchors/README.md) — Anchor interface and ramp provider details (Etherfuse, Alfred Pay, BlindPay)
- [AGENTS.md](../AGENTS.md) — AI-oriented index: lifecycles, routes, signing matrix, file map
- [DeFindex](https://docs.defindex.io) — Soroban yield vaults, strategies, SDKs, and operations
