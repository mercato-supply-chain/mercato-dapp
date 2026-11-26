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
| **Settlement** | Classic USDC for default deals. Opt-in deals use the Soroban credit registry and funding pool, then Trustless Work for repayment. |
| **Package manager** | Bun (`bun install`, `bun dev`) |

## Documentation map

Read documents in this order depending on your task:

| Document | Use when you need… |
|----------|-------------------|
| **[AGENTS.md](AGENTS.md)** (this file) | Orientation, lifecycles, file index, signing rules, what is / isn't implemented |
| **[README.md](README.md)** | Product summary, stakeholder value, setup overview, feature list |
| **[doc/architecture.md](doc/architecture.md)** | Deep architecture, Mermaid diagrams, ramp/escrow flows, env reference |
| **[doc/technical-architecture.md](doc/technical-architecture.md)** | Reviewer-grade current/target architecture, including MoneyGram and Privy coexistence plans |
| **[SETUP.md](SETUP.md)** | Step-by-step local setup checklist |
| **[env.sample](env.sample)** | Complete environment variable list |
| **[doc/rwa-architecture.md](doc/rwa-architecture.md)** | Credit-asset schema, allowed state edges, issuance → contribute → settle → redeem |
| **[doc/rwa-testnet-evidence.md](doc/rwa-testnet-evidence.md)** | Testnet contract ids and tx hashes. Lifecycle tables under that deploy record are a template. |
| **[lib/anchors/README.md](lib/anchors/README.md)** | Fiat ramp anchor interface and provider clients |
| **[CONTRIBUTING.md](CONTRIBUTING.md)** | Branch policy (`develop`), PR expectations, Drips Wave |

## Domain glossary

| Term | Meaning |
|------|---------|
| **PyME** | Small/medium business (buyer). Creates deals, confirms delivery, micro-funds repayment escrow. |
| **Investor** | Funds supplier invoice + 1% platform fee in USDC; receives principal + yield from repayment milestones. |
| **Supplier** | Ships goods; receives full invoice amount at funding (fee-free). |
| **Admin** | Platform operator: deploys repayment escrows, approves/releases milestones, manages DeFindex vault monitor. |
| **Direct funding** | Default deal. Investor → supplier (principal) + platform (1% fee) via **classic Stellar USDC**. `deals.investor_id` is set. |
| **RWA / credit pool** | Opt-in (`deals.rwa_opted_in`). Investors contribute USDC to a Soroban funding pool. Supplier is paid only at the target. `deals.investor_id` stays null. `deals.funding_mode` becomes `rwa` at verified issuance. |
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

Repayment escrow releases go to the **funded investor's Stellar address**, resolved from `profiles.address` or `profiles.stellar_public_key` via `lib/deals/investor-wallet.ts`. On direct funding, the investor's address is saved to their profile (`deal-funding-panel.tsx`). On an RWA deal, each release uses the wallet stored on that position.

## Opt-in RWA path

Use this path only when `deals.rwa_opted_in` is true and `RWA_ENABLED=true`. Default deals stay on classic USDC. Do not set `investor_id` on an RWA deal.

```
1. CREATE     PyME creates an opted-in deal (Supabase only)
2. ESCROW     A repayment escrow address must already exist before issuance
3. ISSUE      Admin signs register_asset, then create_funding_pool
              POST /api/rwa/issuance/prepare|submit|status
              Commit: rwa_commit_verified_issuance (service role + admin profile id)
4. FUND       Each investor signs contribute (Stellar Wallets Kit; Pollar is refused)
              POST /api/rwa/contributions/prepare|submit|confirm
              Cap: RWA_MAX_INVESTORS = 2 in lib/rwa/bindings.ts (checked at prepare, not in SQL)
5. SETTLE     Pool lifecycle ready_to_settle → admin POST /api/rwa/settlements/supplier
              Deal status becomes funded only here
6. REPAY      Admin deploys TW milestones from GET /api/rwa/repayment/schedule?dealId=
              Release confirm: POST /api/rwa/repayment/confirm → rwa_redeem_position
7. RECONCILE  POST /api/rwa/reconcile re-reads submitted/unknown issuance and contributions
```

| Layer | States |
|-------|--------|
| Pool `rwa_assets.lifecycle` | `open` → `ready_to_settle` → `settled` (supplier paid). `cancelled` is terminal. |
| Credit `rwa_credit_assets.state` | `issued` → `partially_funded` → `fully_funded` → `settling` → `settled`. `issued` cannot jump straight to `fully_funded`; the mirror trigger steps through `partially_funded`. |
| SOS names | `FUNDED` = `fully_funded`, `ACTIVE` = `active`, `REPAYING` = `settling`, `REPAID`/`REDEEMED` = `settled`. Pool `settled` means the supplier was paid, not that investors were redeemed. |

Issuance identity is `network:registry_contract:asset_id`. Asset id, deal hash, snapshot hash, and document root are SHA-256 values from `lib/rwa/bindings.ts` and `lib/rwa/commitment.ts`. Registry terms store `deal_hash`, `snapshot_hash`, and `document_root` (`contracts/credit-protocol`).

Signing: `RWA_REGISTRY_ADMIN_ADDRESS` must sign issuance and must be the registry constructor admin. Investors sign `contribute`. Platform fee recipient is `NEXT_PUBLIC_MERCATO_PLATFORM_ADDRESS`.

Testnet deployment (public ids; secret stays in the local Stellar CLI identity `mercato-rwa-testnet`):

| Role | Value |
|------|--------|
| Registry | `CAABHTWL6HWU7GXM2LQT5BG5B7QIKEZLQTOYUBLONE6OY7XPUOJ4SC7O` |
| Admin | `GAGZSSVI7IJ7G4B57SCOPHFYV3YSS76ONOC22XOOEF47SP4OZJPG4BXS` |
| USDC SAC | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` |
| Funding WASM | `f3e8666900cb9c0748ee04ae2261a8cea53ce96d71d0b3f1f5abe7acb01138e8` |

A full two-investor funding and redemption run is not recorded. Do not fill [doc/rwa-testnet-evidence.md](doc/rwa-testnet-evidence.md) with invented hashes.

Build and deploy contracts with `stellar contract build` (target `wasm32v1-none`, soroban-sdk 29). Each contract `build.rs` reserves a 4,096-byte WASM shadow stack. Upload `credit_funding.wasm`, then deploy `credit_registry.wasm` with constructor `(admin, funding_wasm_hash, usdc_sac)`. The 2026-11-10 registry remains on Testnet and is not the current id.

## Wallet providers and signing matrix

Two wallet providers are supported:

| Provider | ID | Connect path | Signing |
|----------|-----|--------------|---------|
| **Stellar Wallets Kit** | `stellar-wallets-kit` | Freighter, Albedo (`hooks/use-external-wallet.ts`) | `lib/trustless/wallet-kit.ts` → `signTransaction` |
| **Pollar** | `pollar` | Embedded wallet (`hooks/use-pollar-wallet.ts`, `@pollar/react` 0.12 / SDK API v3) | `signAndSubmitTx` via Pollar SDK |

Unified context: `providers/wallet-provider.tsx` → `hooks/use-wallet.ts`.

| Operation | SWK | Pollar | Notes |
|-----------|-----|--------|-------|
| Fund deal (direct USDC) | ✅ | ✅ | `components/deals/deal-funding-panel.tsx` |
| Fund deal (RWA `contribute`) | ✅ | ❌ | Pollar is refused. Prepare via `/api/rwa/contributions/prepare`. |
| Issue / settle RWA pool | ✅ | ❌ | Signer must be `RWA_REGISTRY_ADMIN_ADDRESS` |
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
| **RWA funding pool** | ✅ Opt-in. App, DB, and Testnet registry are wired. Lifecycle run is not recorded. | `contracts/credit-registry/`, `contracts/credit-funding/`, `lib/rwa/`, `app/api/rwa/` |
| **Fiat ramp code** | Present under `lib/anchors` and `/api/ramp` | Provider-dependent. MoneyGram is the stated target and is not a completed corridor. |
| **Blend** | ⚠️ Indirect only | Testnet SAC/trustline helpers for DeFindex vault setup (`lib/stellar/vault-asset-trustline.ts`). No Blend SDK or pool calls. |

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
| `/api/ramp/*` | 14 | Fiat ramp proxy (MoneyGram) |
| `/api/defindex/*` | 10 | Vault read/deposit/withdraw + admin create/monitor/rebalance |
| `/api/stellar/*` | 6 | Submit tx, SAC balance, trustline, vault activity cache |
| `/api/rwa/*` | 12 | Issuance prepare/submit/status, contributions, supplier settlement, refunds, repayment schedule/confirm, reconcile |
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
| `rwa_assets` | Pool projection the contribution APIs reconcile (`open` → `ready_to_settle` → `settled`) |
| `rwa_contributions` | Pool contribution attempts (`prepared`/`submitted`/`confirmed`/`failed`/`expired`) |
| `rwa_positions` | Confirmed pool positions, one row per (asset, investor). A trigger mirrors these into credit positions. |
| `rwa_receipts` | Verified pool receipts; unique per (network, tx hash, event index) |
| `rwa_credit_assets` | Canonical issued obligation. Linked to the pool row by `pool_asset_row_id`. |
| `rwa_investor_positions` | Credit ownership. Unique on `(credit_asset_id, investor_profile_id)`. |
| `rwa_issuance_attempts` | Pre-commit issuance attempts (`register_asset`, `create_funding_pool`). RLS on, no client policies. |
| `rwa_repayment_payout_intents` | Position/tranche repayment intents. Service role writes; admins can read. |

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
| RWA funding registry/pool | `contracts/credit-registry/`, `contracts/credit-funding/`, `contracts/credit-protocol/` |
| RWA issuance | `lib/rwa/issuance.ts`, `app/api/rwa/issuance/` |
| RWA bindings (asset id, two-investor cap, net split) | `lib/rwa/bindings.ts` |
| RWA contribution intent | `lib/rwa/contribution-intent.ts`, `lib/rwa/settlement.ts`, `lib/rwa/db.ts` |
| RWA position repayment | `lib/rwa/position-servicing.ts`, `lib/trustless/repayment-position-payout.ts` |
| RWA reconcile | `lib/rwa/reconcile.ts`, `app/api/rwa/reconcile/route.ts` |
| Soroban unsigned XDR | `lib/stellar/build-soroban-invoke.ts` |
| Credit pool link migration | `supabase/migrations/20261110120000_rwa_credit_pool_link.sql` |
| RWA chain reading & event decoding | `lib/rwa/chain.ts` |
| DeFindex config & monitor | `lib/defindex/config.ts`, `lib/defindex/vault-monitor.ts` |
| API route auth | `lib/api/route-auth.ts` |
| Admin queues | `lib/admin/get-admin-queue-data.ts` |
| Dashboard data | `lib/dashboard/get-dashboard-data.ts` |
| Investor portfolio | `lib/investments/get-investor-portfolio.ts` |
| i18n (en/es/pt-BR) | `lib/i18n/` — locale cookie `mercato-locale`, `?lang=` (`en`, `es`, `pt-BR` / `pt`) |
| Proxy | `proxy.ts` — Supabase session refresh + locale |

## Project layout (abbreviated)

```
app/                    # Next.js App Router (pages + API routes)
components/             # UI — deals/, ramp/, wallet/, dashboard/, admin/
hooks/                  # React hooks (wallet, escrow, defindex, deals)
lib/                    # Business logic, Stellar, anchors, defindex, supabase
providers/              # wallet-provider, pollar-provider
contracts/              # Soroban credit registry, funding pool, and shared types
supabase/migrations/    # Schema (source of truth for DB)
doc/                    # Architecture docs
```

## Environment variables (summary)

Required for core flows:

- **Supabase:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **Trustless Work:** `NEXT_PUBLIC_TRUSTLESS_WORK_API_KEY`, `NEXT_PUBLIC_TRUSTLESS_NETWORK`, `NEXT_PUBLIC_MERCATO_PLATFORM_ADDRESS`, `NEXT_PUBLIC_TRUSTLESSLINE_ADDRESS`
- **USDC (classic):** `NEXT_PUBLIC_USDC_ISSUER` (optional; network defaults)

Opt-in features:

- **RWA:** `RWA_ENABLED=true`, `RWA_REGISTRY_CONTRACT_ID`, `RWA_USDC_SAC_ADDRESS`, `RWA_REGISTRY_ADMIN_ADDRESS`. Network comes from `NEXT_PUBLIC_TRUSTLESS_NETWORK`. Testnet ids are commented in `env.sample` and recorded in `doc/rwa-testnet-evidence.md`.
- **Pollar:** `NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY`, `POLLAR_SECRET_KEY`, `NEXT_PUBLIC_POLLAR_NETWORK`
- **DeFindex:** `DEFINDEX_API_KEY`, `NEXT_PUBLIC_DEFINDEX_VAULT_ADDRESS`, `MERCATO_DEFINDEX_VAULT_ADDRESS`

Full list: [env.sample](env.sample). Architecture reference: [doc/architecture.md § Environment](doc/architecture.md#9-environment-variables).

## Verification commands

```bash
bun install
bun lint
bun typecheck
bun build
cargo fmt --all -- --check
cargo test --workspace
cargo clippy --workspace --all-targets -- -D warnings
```

Before opening a PR: lint + typecheck + build must pass. Schema changes: new file under `supabase/migrations/` via `supabase migration new <name>`.

## Common agent tasks

| Task | Where to look |
|------|---------------|
| Change deal creation flow | `app/create-deal/`, `hooks/use-create-deal-*.ts` |
| Change investor funding | Direct: `components/deals/deal-funding-panel.tsx`, `lib/stellar/build-usdc-split-payment.ts`. RWA: `lib/rwa/contribution-intent.ts`. |
| Change RWA issuance | `lib/rwa/issuance.ts`, `app/api/rwa/issuance/`, `supabase/migrations/20261110120000_rwa_credit_pool_link.sql` |
| Change Soroban RWA funding contracts | `contracts/credit-registry/`, `contracts/credit-funding/`, `contracts/credit-protocol/` |
| Change repayment escrow | `hooks/use-repayment-escrow.ts`, `components/deals/deal-repayment-panel.tsx` |
| Admin approval queue | `lib/admin/get-admin-queue-data.ts`, `app/dashboard/admin/` |
| Add ramp provider | `lib/anchors/<provider>/`, `lib/anchor-factory.ts`, `app/api/ramp/` |
| Wallet connection bug | `providers/wallet-provider.tsx`, `hooks/use-wallet.ts` |
| DeFindex vault feature | `lib/defindex/`, `app/api/defindex/`, `hooks/useDefindex.ts` |
| New DB column | `supabase/migrations/`, update `lib/deals.ts` mapping + `lib/types.ts` |

## Out of scope / do not assume

- Full two-investor Testnet lifecycle — registry deploy is recorded; issuance, funding, and redemption receipts are not
- SEP-41 position tokens, a second on-chain repayment ledger, or tables named `credit_positions` / `deal_investments`
- Pollar signatures for RWA contribute, issuance, or Trustless Work escrow
- MoneyGram as a completed fiat corridor — ramp code exists; do not assume a live partner integration
- Direct Blend lending pool integration — only testnet asset helpers for DeFindex
- Escrow at deal creation — deals are DB-only until funding or, for RWA, until verified issuance creates the pool
- Custodial platform holding of repayment funds — repayment uses non-custodial TW escrow
- `lib/mock-data.ts` — does not exist (remove references if found)
