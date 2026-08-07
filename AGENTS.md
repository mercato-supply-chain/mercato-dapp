# MERCATO — Agent Guide

> **Start here if you are an AI agent** evaluating, reviewing, or modifying this repository.
> Human contributors: see [README.md](README.md) and [CONTRIBUTING.md](CONTRIBUTING.md).

## Quick facts

| Field | Value |
|-------|--------|
| **Product** | Supply chain finance on Stellar — PyMEs buy inventory with investor capital; suppliers paid up front; investors repaid via Trustless Work multi-release escrow |
| **Repository** | `mercato-dapp` (Next.js monolith) |
| **License** | Apache-2.0 |
| **Primary network** | Stellar (testnet by default) |
| **Auth & data** | Supabase (Postgres + Auth) |
| **Settlement** | Classic USDC payments (funding) + Trustless Work Soroban escrow (repayment) |
| **Package manager** | Bun (`bun install`, `bun dev`, `bun test`) |

## Documentation map

Read documents in this order depending on your task:

| Document | Use when you need… |
|----------|-------------------|
| **[AGENTS.md](AGENTS.md)** (this file) | Orientation, lifecycles, file index, signing rules, what is / isn't implemented |
| **[README.md](README.md)** | Product summary, stakeholder value, setup overview, feature list |
| **[doc/architecture.md](doc/architecture.md)** | Deep architecture, Mermaid diagrams, ramp/escrow flows, env reference |
| **[SETUP.md](SETUP.md)** | Step-by-step local setup checklist |
| **[env.sample](env.sample)** | Complete environment variable list |
| **[lib/anchors/README.md](lib/anchors/README.md)** | Fiat ramp anchor interface and provider clients |
| **[CONTRIBUTING.md](CONTRIBUTING.md)** | Branch policy (`develop`), PR expectations, Drips Wave |

## Domain glossary

| Term | Meaning |
|------|---------|
| **PyME** | Small/medium business (buyer). Creates deals, confirms delivery, micro-funds repayment escrow. |
| **Investor** | Funds supplier invoice + 1% platform fee in USDC; receives principal + yield from repayment milestones. |
| **Supplier** | Ships goods; receives full invoice amount at funding (fee-free). |
| **Admin** | Platform operator: deploys repayment escrows, approves/releases milestones, manages DeFindex vault monitor. |
| **Direct funding** | Investor → supplier (principal) + platform (1% fee) via **classic Stellar USDC** — **not escrowed**. |
| **Repayment escrow** | Trustless Work **multi-release** contract: PyME funds grossed amount; admin releases to **investor** in milestones. |
| **Grossed repayment** | Amount PyME must fund so investor nets principal + yield after platform 1% + TW 0.3% fees (`lib/deals/fees.ts`). |
| **SAC** | Stellar Asset Contract (Soroban token); used for TW escrow trustline and DeFindex vault assets. |

## User roles

`profiles.user_type`: `pyme` | `investor` | `supplier` | `admin`

Role-specific dashboard nav is defined in `lib/dashboard/dashboard-nav.ts`.

## End-to-end deal flow (authoritative)

```
1. CREATE     PyME creates deal → Supabase only (no on-chain escrow at create)
2. FUND       Investor pays supplier (principal) + platform (1%) — classic USDC tx
3. SHIP       Supplier adds tracking → deal status `in_progress`
4. DELIVER    PyME confirms arrival → repayment_status `order_confirmed`
5. ESCROW     Admin deploys TW multi-release repayment escrow (first milestone often 50%)
6. REPAY      PyME micro-funds escrow → admin approves/releases milestones → investor paid
7. COMPLETE   All milestones released → repayment_status `released`, deal status `completed`
```

### Deal status (`deals.status` → `DealStatus`)

| DB value | App type | Typical trigger |
|----------|----------|-----------------|
| `seeking_funding` | `awaiting_funding` | Deal created (`hooks/use-create-deal-submit.ts`) |
| `funded` | `funded` | Investor funds (`components/deals/deal-funding-panel.tsx`) |
| `in_progress` | `in_progress` | Supplier ships (`components/deals/deal-delivery-flow.tsx`) |
| `completed` | `completed` | Full repayment released (`hooks/use-repayment-escrow.ts`) |
| `cancelled` | `completed` (mapped) | Legacy |

Mapping: `lib/deals.ts` (`DB_STATUS_TO_DEAL_STATUS`).

**Note:** `DealStatus` also includes `milestone_pending`, `disputed`, `released` for UI labels/filters — these are **not persisted** to `deals.status`.

### Funding window (`FundingStatus` — derived, not stored)

`open` → `extended` → `expired` → `funded` — computed in `lib/deals.ts` (`getDealFundingStatus`).

### Repayment status (`deals.repayment_status` → `RepaymentStatus`)

```
none → order_confirmed → escrow_initialized → funding → ready_to_release
     → partially_released → released
```

| Transition | Code location |
|------------|---------------|
| → `order_confirmed` | `components/deals/deal-delivery-flow.tsx` |
| → `escrow_initialized` | `hooks/use-repayment-escrow.ts` (admin deploy) |
| → `funding` / `ready_to_release` / `partially_released` / `released` | Derived from TW indexer (`lib/deals/repayment-escrow-helpers.ts`) |

Types: `lib/types.ts`. Fee math: `lib/deals/fees.ts`.

### Investor wallet resolution

Repayment escrow releases go to the **funded investor's Stellar address**, resolved from `profiles.address` or `profiles.stellar_public_key` via `lib/deals/investor-wallet.ts`. On funding, the investor's address is saved to their profile (`deal-funding-panel.tsx`).

## Wallet providers and signing matrix

Two wallet providers are supported:

| Provider | ID | Connect path | Signing |
|----------|-----|--------------|---------|
| **Stellar Wallets Kit** | `stellar-wallets-kit` | Freighter, Albedo (`hooks/use-external-wallet.ts`) | `lib/trustless/wallet-kit.ts` → `signTransaction` |
| **Pollar** | `pollar` | Embedded wallet (`hooks/use-pollar-wallet.ts`, `@pollar/react`) | `signAndSubmitTx` via Pollar SDK |

Unified context: `providers/wallet-provider.tsx` → `hooks/use-wallet.ts`.

| Operation | SWK | Pollar | Notes |
|-----------|-----|--------|-------|
| Fund deal (investor → supplier) | ✅ | ✅ | `components/deals/deal-funding-panel.tsx` |
| Micro-fund repayment escrow (PyME) | ✅ | ⚠️ Limited | TW signing expects SWK |
| Deploy / release repayment escrow (admin) | ✅ | ❌ | `PollarWalletKitLimitations` in `lib/mercato-wallet.ts` |
| Ramp off-ramp (sign XDR) | ✅ | ⚠️ | Provider-dependent |
| DeFindex vault deposit/withdraw | ✅ | ✅ | User signs XDR → `api/defindex/submit` |

Pollar metadata persists on `profiles`: `wallet_provider`, `pollar_wallet_id`, `stellar_public_key`, `wallet_status` (`pending` | `active`).

Wallet UI: `/dashboard/wallets` (`app/dashboard/wallets/page.tsx`).

## Stellar integrations (what is actually wired)

| Integration | Status | Key paths |
|-------------|--------|-----------|
| **Trustless Work** | ✅ Production path | `lib/trustless/`, `hooks/use-repayment-escrow.ts` |
| **Stellar Wallets Kit** | ✅ | `lib/trustless/wallet-kit.ts` |
| **Pollar embedded wallet** | ✅ | `providers/pollar-provider.tsx`, `api/auth/pollar-sync`, `api/pollar/activate` |
| **DeFindex vault** | ✅ | `lib/defindex/`, `app/api/defindex/`, `/dashboard/vault`, `/dashboard/admin/vault` |
| **Fiat ramps** (Etherfuse, AlfredPay, BlindPay) | ✅ Opt-in via env | `lib/anchors/`, `app/api/ramp/`, `/dashboard/ramp` |
| **Blend** | ⚠️ Indirect only | Testnet SAC/trustline helpers for DeFindex vault setup (`lib/stellar/vault-asset-trustline.ts`) — **no Blend SDK or pool calls** |
| **MoneyGram** | ❌ Not implemented | Mentioned in early docs only; no code references |

## Route index

### Public pages

| Route | Purpose |
|-------|---------|
| `/` | Landing |
| `/how-it-works` | Flow explainer |
| `/our-story` | Company story |
| `/deals` | **Marketplace** (browse/filter deals) |
| `/marketplace`, `/orders` | Redirect → `/deals` |
| `/deals/[id]` | Deal detail (funding + repayment panels) |
| `/deals/[id]/edit` | Edit deal (pre-funding only) |
| `/create-deal` | Multi-step deal creation (auth) |
| `/suppliers`, `/suppliers/[id]` | Supplier directory |
| `/pymes`, `/pymes/[id]` | PyME directory |
| `/investors`, `/investors/[id]` | Investor directory |
| `/blog`, `/blog/[slug]` | Blog |
| `/events/[slug]` | Event landing + lead capture |
| `/settings` | Profile + Stellar address |
| `/auth/*` | Login, sign-up, password reset, callback |

### Dashboard (auth required)

| Route | Roles | Purpose |
|-------|-------|---------|
| `/dashboard` | All | Role-based overview |
| `/dashboard/wallets` | All | Connect wallet, balances, Pollar activation |
| `/dashboard/vault` | investor, pyme | DeFindex user vault (deposit/withdraw) |
| `/dashboard/investments` | investor | Portfolio |
| `/dashboard/deals` | supplier, admin | Supplier deal list |
| `/dashboard/deliveries` | supplier | Shipment management |
| `/dashboard/supplier-profile` | supplier | Companies + product catalog |
| `/dashboard/ramp` | investor, pyme, supplier, admin | Fiat on/off ramp |
| `/dashboard/ramp/blindpay-setup` | All (ramp users) | BlindPay onboarding |
| `/dashboard/admin/approvals` | admin | Create repayment escrows (order confirmed) |
| `/dashboard/admin/releases` | admin | Release funded milestones |
| `/dashboard/admin/vault` | admin | DeFindex vault monitor |
| `/dashboard/admin/leads` | admin | Event lead submissions |

`/dashboard/admin` redirects to `/dashboard/admin/approvals`.

## API route index

| Prefix | Count | Purpose |
|--------|-------|---------|
| `/api/ramp/*` | 14 | Fiat ramp proxy (Etherfuse, AlfredPay, BlindPay) |
| `/api/defindex/*` | 10 | Vault read/deposit/withdraw + admin create/monitor/rebalance |
| `/api/stellar/*` | 6 | Submit tx, SAC balance, trustline, vault activity cache |
| `/api/auth/pollar-sync` | 1 | Sync Pollar session to Supabase profile |
| `/api/pollar/activate` | 1 | Activate embedded wallet |
| `/api/catalog` | 1 | Supplier product catalog |
| `/api/leads` | 1 | Event lead form submissions |
| `/api/notifications/create` | 1 | Manual notification creation |
| `/api/referral`, `/api/referral/notify` | 2 | Supplier referral program |
| `/api/reputation/stake`, `/api/reputation/refresh` | 2 | Reputation scoring |

Ramp and DeFindex API keys are **server-only** — never expose secrets in `NEXT_PUBLIC_*`.

## Database tables (Supabase)

| Table | Purpose |
|-------|---------|
| `profiles` | Users, roles, Stellar/Pollar wallet metadata, referral fields |
| `deals` | Deal terms, parties, `status`, `repayment_status`, `repayment_milestones`, funding/delivery fields |
| `milestones` | Fulfillment milestones (separate from repayment milestones) |
| `supplier_companies` | Multi-company supplier profiles (`deals.supplier_id` FK) |
| `supplier_products` | Product catalog with inventory |
| `notifications` | In-app alerts (DB triggers on deal events) |
| `reputations` | Trust scores, stake signals, repayment performance |
| `leads` | Event form submissions (admin RLS) |

Migrations: `supabase/migrations/` — apply with `npx supabase db push`.

## Key source files

| Area | Path |
|------|------|
| Deal mapping & funding status | `lib/deals.ts` |
| Fee math | `lib/deals/fees.ts` |
| Repayment escrow hook | `hooks/use-repayment-escrow.ts` |
| Deal detail + TW indexer | `hooks/use-deal-detail.ts` |
| Investor wallet lookup | `lib/deals/investor-wallet.ts` |
| Direct USDC funding XDR | `lib/stellar/build-usdc-split-payment.ts` |
| Wallet types & storage | `lib/mercato-wallet.ts` |
| TW config & platform roles | `lib/trustless/config.ts` |
| DeFindex config & monitor | `lib/defindex/config.ts`, `lib/defindex/vault-monitor.ts` |
| Ramp factory | `lib/anchor-factory.ts`, `lib/ramp-api.ts` |
| Admin queues | `lib/admin/get-admin-queue-data.ts` |
| Dashboard data | `lib/dashboard/get-dashboard-data.ts` |
| Investor portfolio | `lib/investments/get-investor-portfolio.ts` |
| i18n (en/es) | `lib/i18n/` — locale cookie `mercato-locale`, `?lang=` param |
| Middleware | `middleware.ts` — Supabase session refresh + locale |

## Project layout (abbreviated)

```
app/                    # Next.js App Router (pages + API routes)
components/             # UI — deals/, ramp/, wallet/, dashboard/, admin/
hooks/                  # React hooks (wallet, escrow, defindex, deals)
lib/                    # Business logic, Stellar, anchors, defindex, supabase
providers/              # wallet-provider, pollar-provider
supabase/migrations/    # Schema (source of truth for DB)
__tests__/              # Bun tests
doc/                    # Architecture docs
```

## Environment variables (summary)

Required for core flows:

- **Supabase:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **Trustless Work:** `NEXT_PUBLIC_TRUSTLESS_WORK_API_KEY`, `NEXT_PUBLIC_TRUSTLESS_NETWORK`, `NEXT_PUBLIC_MERCATO_PLATFORM_ADDRESS`, `NEXT_PUBLIC_TRUSTLESSLINE_ADDRESS`
- **USDC (classic):** `NEXT_PUBLIC_USDC_ISSUER` (optional; network defaults)

Optional feature flags:

- **Pollar:** `NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY`, `POLLAR_SECRET_KEY`, `NEXT_PUBLIC_POLLAR_NETWORK`
- **DeFindex:** `DEFINDEX_API_KEY`, `NEXT_PUBLIC_DEFINDEX_VAULT_ADDRESS`, `MERCATO_DEFINDEX_VAULT_ADDRESS`
- **Ramps:** `ETHERFUSE_*`, `ALFREDPAY_*`, `BLINDPAY_*` — providers appear in UI only when fully configured

Full list: [env.sample](env.sample). Architecture reference: [doc/architecture.md § Environment](doc/architecture.md#9-environment-variables).

## Verification commands

```bash
bun install
bun lint
bun build
bun test
```

Before opening a PR: lint + build must pass. Schema changes: new file under `supabase/migrations/` via `supabase migration new <name>`.

## Common agent tasks

| Task | Where to look |
|------|---------------|
| Change deal creation flow | `app/create-deal/`, `hooks/use-create-deal-*.ts` |
| Change investor funding | `components/deals/deal-funding-panel.tsx`, `lib/stellar/build-usdc-split-payment.ts` |
| Change repayment escrow | `hooks/use-repayment-escrow.ts`, `components/deals/deal-repayment-panel.tsx` |
| Admin approval queue | `lib/admin/get-admin-queue-data.ts`, `app/dashboard/admin/` |
| Add ramp provider | `lib/anchors/<provider>/`, `lib/anchor-factory.ts`, `app/api/ramp/` |
| Wallet connection bug | `providers/wallet-provider.tsx`, `hooks/use-wallet.ts` |
| DeFindex vault feature | `lib/defindex/`, `app/api/defindex/`, `hooks/useDefindex.ts` |
| New DB column | `supabase/migrations/`, update `lib/deals.ts` mapping + `lib/types.ts` |

## Out of scope / do not assume

- MoneyGram integration — not in codebase
- Direct Blend lending pool integration — only testnet asset helpers for DeFindex
- Escrow at deal creation — deals are DB-only until investor funds
- Custodial platform holding of repayment funds — repayment uses non-custodial TW escrow
- `lib/mock-data.ts` — does not exist (remove references if found)
