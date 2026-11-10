# RWA architecture — credit assets, positions and frozen terms

> **Status:** accepted (RWA task 01/10) · **Scope:** persistence + shared interfaces only
> **Migration:** `supabase/migrations/20261021071817_rwa_credit_assets_and_positions.sql`
> **Commitments:** `lib/rwa/commitment.ts` · **Fixtures:** `__tests__/rwa/fixtures/snapshot-v1/`
> **SQL tests:** `supabase/tests/rwa/`

This record is the contract that downstream contract and API contributors implement against.
It contains no open policy TODOs: every rule below is either enforced by the migration or
declared out of scope.

## 1. Why the model is split

`public.deals` is a **commercial** record: who buys what from whom, for how much, on what
payment schedule. It holds one legacy `investor_id` and one funding hash, which cannot express
an issued obligation with several independent owners.

Three entities are now distinct:

| Entity | Table | Answers |
|--------|-------|---------|
| Commercial deal | `public.deals` | What was bought, from whom, at what price |
| Issued credit obligation | `public.rwa_credit_assets` | What the issuer owes, on which asset/network, with which frozen terms |
| Investor ownership | `public.rwa_investor_positions` | Who owns how much, in exact units |

Supporting tables separate *intent* from *evidence* from *ownership*:

| Table | Role |
|-------|------|
| `rwa_document_commitments` | Cryptographic commitments to private documents |
| `rwa_contribution_attempts` | One row per funding attempt or top-up — never ownership |
| `rwa_contribution_receipts` | Confirmed on-chain evidence — the only source of confirmed principal |
| `rwa_position_settlements` | Position-level principal/return/fee/refund/write-off records |
| `rwa_issuance_events` | Append-only issuance lifecycle evidence |

Retries and top-ups create extra **attempts/receipts**, never extra positions: a position is
unique on `(credit_asset_id, investor_profile_id)`.

## 2. Identity

| Identity | Definition | Uniqueness |
|----------|------------|-----------|
| Issuance identity | `network:registry_contract:asset_id` (generated column `issuance_identity`) | Globally unique |
| Active issuance per deal | `rwa_credit_assets.deal_id` where `superseded_at is null` | Partial unique index |
| Position | `(credit_asset_id, investor_profile_id)` | Unique |
| Contribution attempt | `(credit_asset_id, investor_profile_id, idempotency_key)` | Unique |
| Contribution evidence | `(network, registry_contract, tx_hash, operation_or_event_id)` | Unique |
| Settlement evidence | `(network, registry_contract, tx_hash, operation_or_event_id)` | Unique |
| Issuance receipt | `(network, registry_contract, issuance_receipt_tx, issuance_operation_id)` | Unique (partial) |
| Document commitment | `(credit_asset_id, doc_kind, content_hash)` | Unique |
| Issuance event | `(credit_asset_id, event_type)` for `issued` and `activated` | Unique (partial) |

A superseded issuance keeps its row (`superseded_at` set) and a new one may be issued for the
same deal under a **different** asset identity. Re-using an identity is rejected by the database.

## 3. Field types

Rules that hold everywhere:

- Money is `bigint` **atomic units** with explicit decimals (`asset_decimals`, `unit_decimals`).
  Never `numeric`, never floats, never a formatted string in a money column.
- JSON money (`financial_snapshot`, `fees`) is a **decimal string**.
- Display basis points are `integer` and are never used to compute entitlement.
- Evidence and hashes are `text` with length/format checks (`^[0-9a-f]{64}$` for SHA-256).
- Timestamps are `timestamptz`; `created_at`/`updated_at` default to `now()`.

### `rwa_credit_assets`

| Column | Type | Notes |
|--------|------|-------|
| `deal_id` | uuid | FK → `deals(id)` `on delete restrict` |
| `network` | text | `testnet` \| `futurenet` \| `mainnet` |
| `registry_contract` | text | Registry/contract identifier |
| `asset_id` | text | Asset identifier inside the registry |
| `issuance_identity` | text | Generated `network:registry_contract:asset_id` |
| `asset_code`, `asset_issuer` | text | Asset/network identity |
| `asset_decimals` | smallint | 0–18, explicit scale for `principal_atomic` |
| `principal_atomic` | bigint | > 0 |
| `return_numerator`, `return_denominator` | bigint | Flat-term return; `0 < num < den` |
| `display_yield_bps` | integer | Presentation only, 0–9999 |
| `term_days` | integer | 1–3650, frozen at issuance |
| `maturity_policy` | text | `delivery_relative` (the only implemented rule) |
| `scheduled_maturity_at` | timestamptz | **Projection**, nullable |
| `actual_due_at` | timestamptz | Contractual due date, written once |
| `snapshot_version` | smallint | ≥ 1 |
| `financial_snapshot` | jsonb | Frozen object, canonical encoding |
| `financial_snapshot_hash` | text | SHA-256 of the canonical snapshot |
| `fees` | jsonb | `platform_fee_bps`, `tw_fee_bps`, `rounding_policy`, `charged_at` |
| `state` | text | See §4 |
| `issuance_receipt_tx`, `issuance_operation_id`, `issuance_ledger_seq` | text/bigint | Issuance receipt |
| `issued_at`, `activated_at`, `superseded_at` | timestamptz | Lifecycle stamps |

### `rwa_investor_positions`

| Column | Type | Notes |
|--------|------|-------|
| `credit_asset_id` | uuid | FK, immutable |
| `investor_profile_id` | uuid | FK → `profiles(id)`, immutable |
| `investor_wallet` | text | Immutable; changing it raises |
| `committed_principal_atomic` | bigint | ≥ 0, never decreases |
| `confirmed_principal_atomic` | bigint | ≥ 0, ≤ committed, never decreases |
| `units_atomic` | bigint | > 0, never decreases |
| `unit_decimals` | smallint | 0–7, immutable |
| `state` | text | `active` \| `settled` \| `defaulted` \| `cancelled` |
| `reconciliation_state` | text | `pending` \| `matched` \| `mismatched` \| `reconciled` |

**Entitlement.** `units_atomic / (principal_atomic * 10^unit_decimals)`. Units are exact
integers derived from confirmed principal only. The current implementation issues
`unit_decimals = 0`, so 1 unit = 1 atomic principal unit and no precision is invented.

## 4. State transitions

`rwa_credit_assets.state` (enforced by `enforce_rwa_credit_asset_immutability`):

```
draft ──▶ issued ──▶ active ──▶ partially_funded ──▶ fully_funded ──▶ settling ──▶ settled
  │          │          │              │                  │              │
  │          ├──▶ cancelled            └──▶ defaulted ◀───┴──────────────┘
  └──▶ cancelled        └──▶ superseded                             defaulted ──▶ settled
```

Allowed edges (anything else raises `23514`):

| From | To |
|------|-----|
| `draft` | `issued`, `cancelled` |
| `issued` | `active`, `partially_funded`, `cancelled`, `superseded` |
| `active` | `partially_funded`, `fully_funded`, `settling`, `defaulted`, `cancelled` |
| `partially_funded` | `fully_funded`, `settling`, `defaulted`, `cancelled` |
| `fully_funded` | `settling`, `defaulted` |
| `settling` | `settled`, `defaulted` |
| `defaulted` | `settled` |
| `settled`, `cancelled`, `superseded` | terminal |

Funding state and the **repayment clock are independent**: `rwa_activate_issuance()` only sets
`activated_at` and `actual_due_at`, so a partially funded issuance can still activate at delivery.

Contribution attempts move `pending → submitted → confirmed`, or `→ failed` / `expired` /
`refunded`. Only `confirmed` writes a receipt; only a receipt writes principal and units.

## 5. Decisions

### 5.1 What makes a deal approved for issuance

**Profile verification alone is insufficient.** `rwa_issue_credit_asset()` requires all of:

1. `deals.rwa_opted_in = true`;
2. the deal is not `cancelled` and has no legacy funding (`investor_id`, `funded_at` null);
3. a supplier is attached (`deals.supplier_id`);
4. the PyME profile is `verified`;
5. the supplier company is `verified`;
6. a repayment escrow exists (`deals.escrow_contract_address`), because the obligation must have
   a non-custodial repayment destination;
7. a positive frozen USDC principal and valid flat-term return (`0 < num < den`);
8. a financial snapshot whose amounts **equal** the arguments (mismatch rejected);
9. at least one document commitment (financing agreement and KYB evidence);
10. an issuance receipt (transaction + operation/event identity + ledger).

Only an admin may call it, and the call writes an `admin_audit_events` row.

### 5.2 When terms freeze

At the `issued` event. `financial_snapshot`, `financial_snapshot_hash`, principal, return ratio,
`term_days`, maturity policy and fees become immutable: any later attempt to change them raises
`RWA financial terms are frozen after issuance`. The snapshot hash recorded at issuance is the
one a contract verifies against.

### 5.3 Funding deadline versus repayment maturity

These are different clocks and different columns, and neither implies the other:

- **Funding deadline** — `deals.funding_expires_at`. Governs whether new contributions are
  accepted. It does not affect repayment.
- **Repayment maturity** — `rwa_credit_assets.actual_due_at`. Governs when the obligation is due.

### 5.4 Chosen maturity rule (one, implemented)

**Delivery-relative**, matching the existing delivery-based repayment clock (`deals.delivered_at`):

- `scheduled_maturity_at` is a **projection** recomputed from delivery data. It is documented and
  labelled as a projection and is **never** presented as a contractual due date.
- `actual_due_at` is the contractual due date, computed as
  `deals.delivered_at + make_interval(days => frozen term_days)`.
- It is set **exactly once**, by `rwa_activate_issuance()` — the authorized activation event —
  which also inserts the unique `activated` issuance event. A second activation raises
  `issuance_already_activated`, and the immutability trigger rejects any later change to
  `actual_due_at`.

No downstream contributor needs to invent a maturity rule.

### 5.5 Legacy versus RWA routing

- RWA is **opt-in** per deal (`deals.rwa_opted_in`, default `false`).
- Opt-in is only allowed while the deal is `seeking_funding` with no legacy funding, and cannot
  be switched off once issuance or contributions exist.
- A deal with any `rwa_credit_assets` row is routed through RWA only. A credit asset cannot be
  created for a deal that is not opted in (trigger-enforced).
- Legacy deals keep using classic USDC direct funding and are never backfilled: this migration
  fabricates no historic issuance, receipts or on-chain evidence.
- A deal with an issuance, a position, or a `pending`/`submitted`/`confirmed` attempt is locked:
  terms cannot change, it cannot return to `seeking_funding` (no reopen), `funding_expires_at`
  cannot move, and it cannot be deleted. This holds **even when only partially funded**.

### 5.6 Two-investor limit versus extensible schema

The initial product limit of **two investors per issuance** is an application/API constraint. The
schema is N-investor and uses no per-deal investor columns, so raising the limit is a product
decision, not a migration. Two investors always get independent positions.

### 5.7 Fee timing and rounding

- Fees are taken **once, at funding**, from the frozen snapshot: `platform_fee_bps` (100 = 1%)
  and `tw_fee_bps` (30 = 0.3% Trustless Work).
- `rounding_policy` is `half_up_atomic`: rounding happens only at the atomic-unit boundary, after
  the exact rational product, and the rounded result is recorded before entitlement is written.
- `charged_at` is `funding`. Fees never reduce `units_atomic`, which come from confirmed principal.
- Payout rounding is **floor** at the atomic-unit boundary; the remainder stays in the non-custodial
  escrow and appears in reconciliation, not in ownership.

### 5.8 Failure and refund

- An attempt that is not confirmed expires (`expired`) and creates **no** position.
- A confirmed contribution that cannot complete (cancelled issuance, over-funding rejected)
  is returned through the existing non-custodial path and recorded as a `refund` settlement on
  that position.
- The platform never holds contribution or repayment funds: there is no custodial fallback.

### 5.9 Money, decimals and bounds

Exact integer units with explicit decimals (`asset_decimals`, `unit_decimals`), decimal strings
in JSON, and checked bounds on every amount (`> 0` for receipts/settlements, `≥ 0` and monotonic
for position balances). Share entitlement is stored as units, not as rounded basis points;
`display_yield_bps` is a rendering hint only.

## 6. Commitment specification (v1)

**Encoding.** UTF-8 canonical JSON, RFC 8785 shape: lexicographic key order (UTF-16 code unit
order), no whitespace, no BOM, no floats. Integers used as counts are plain JSON numbers; every
money value is a decimal string.

**Hash.** `SHA-256` over `domain || "\n" || canonical_json`, lowercase hex (64 chars).
Domain separation makes a snapshot digest unusable as a document digest.

| Item | Value |
|------|-------|
| Financial snapshot domain | `mercato.rwa.financial_snapshot.v1` |
| Document commitment domain | `mercato.rwa.document.v1` |
| Snapshot version | `snapshot_version = 1` |
| Implementation | `lib/rwa/commitment.ts` |

**Ordered fields hashed in the snapshot:**

1. `snapshot_version`
2. `deal_id`
3. `network`
4. `asset_code`
5. `asset_issuer`
6. `asset_decimals`
7. `principal_atomic`
8. `return_numerator`
9. `return_denominator`
10. `display_yield_bps`
11. `term_days`
12. `maturity_policy`
13. `fees` — `platform_fee_bps`, `tw_fee_bps`, `rounding_policy`, `charged_at`
14. `issued_at`
15. `issuance_identity`

Any addition or reordering is a new snapshot version with a new fixture set.

**Flat-term return semantics.** `return_numerator / return_denominator` of `principal_atomic` is
the total return for the frozen `term_days`, not an annualized rate. `display_yield_bps` is a
presentation approximation and must never be used to compute a payout.

**Normalization.**

- Amounts: decimal string, no sign, no separators, no leading zeros (`^(0|[1-9][0-9]*)$`).
- Timestamps: RFC 3339 UTC with `Z` (`2026-10-20T12:34:56.000Z`).
- Stellar StrKey addresses/contracts: stored verbatim — Base32 is case-sensitive, so no case
  folding and no trimming beyond whitespace rejection.
- Optional fields: omitted, never `null`.
- Documents: only `doc_kind`, `content_hash`, `byte_length`, `canonicalization` are committed.
  Document bytes, customer data and signed URLs stay private; the database stores an opaque
  `opaque_ref` that rejects URL schemes.

**Cross-language fixtures.** `__tests__/rwa/fixtures/snapshot-v1/` contains the frozen vectors:

| File | Proves |
|------|--------|
| `base.json` | Canonical bytes + digest of the reference snapshot |
| `reordered-input.json` | Reordered input yields the **same** digest |
| `terms-changed.json` | A changed frozen term yields a **different** digest |
| `fees-changed.json` | A changed fee yields a **different** digest |
| `document.json` | Document commitment vector |

A Rust implementation must reproduce `expected_canonical` and `expected_hash` from the same
files; the TypeScript suite asserts exactly those values.

## 7. Actors and permissions

| Actor | Read | Write |
|-------|------|-------|
| Anonymous | Sanitized aggregates via `get_rwa_deal_summary()` only | Nothing |
| Investor A | Own positions, own attempts, own receipts, own settlements, deal-level issuance fields | Create attempt (server API) |
| Investor B | Same, **only for own rows** — never A's | Same |
| PyME | Issuance fields for own deal, document commitments, aggregates | Opt in / request issuance |
| Supplier | Same as PyME for the deal they own (via `supplier_companies.owner_id`) | Nothing |
| Admin | All rows; `financial_snapshot`, `fees`, `opaque_ref` via `admin_get_rwa_issuance()`, issuance events | Issue, activate, audit |
| Service role (server) | All rows | Confirm contribution, record settlement |

Enforcement:

- RLS enabled on all seven tables; **no** table DML granted to `anon`/`authenticated`.
- Column-level `select` grants exclude `financial_snapshot`, `fees`, `issuance_operation_id`,
  `opaque_ref` and `idempotency_key` — for admins too. Admin-only detail (snapshot, fees, document
  opaque references) is reachable only through `admin_get_rwa_issuance()`, which calls
  `assert_admin()` and is granted to `authenticated`; direct table reads of those columns are
  denied even for an admin session.
- Confirmed principal, units, recipient identity and settlement state can only be written by
  `security definer` RPCs: `rwa_confirm_contribution()` and `rwa_record_position_settlement()`
  require the `service_role` JWT claim, and `rwa_issue_credit_asset()`/`rwa_activate_issuance()`
  require an admin (`assert_admin()`).
- `rwa_contribution_receipts`, `rwa_position_settlements`, `rwa_issuance_events` and
  `rwa_document_commitments` are append-only by trigger.
- All RWA foreign keys are `on delete restrict`, so cascade deletion of a profile/deal can never
  erase financial evidence.
- Privileged changes are recorded in `admin_audit_events`.
- Views/RPCs do not widen the matrix: `get_rwa_deal_summary()` returns aggregates only (no wallets,
  no hashes, no per-position rows) and `rwa_get_my_positions()` filters on `auth.uid()`.

## 8. Source-of-truth matrix

| Fact | Source of truth | Never derived from |
|------|-----------------|--------------------|
| Commercial terms | `deals` | Client state |
| Frozen economics | `rwa_credit_assets.financial_snapshot` + `financial_snapshot_hash` | `deals` (may drift) |
| Asset/network identity | `rwa_credit_assets.(network, registry_contract, asset_id)` | UI labels |
| Confirmed principal | `rwa_contribution_receipts.confirmed_amount_atomic` | Attempts, client input |
| Ownership | `rwa_investor_positions.units_atomic` | Display basis points |
| Settlement state | `rwa_position_settlements` + `reconciliation_state` | Optimistic client flags |
| Repayment clock | `rwa_credit_assets.actual_due_at` | `scheduled_maturity_at` (projection) |
| Delivery | `deals.delivered_at` | `shipped_at` |
| Legacy funding | `deals.investor_id` / `deals.funded_at` | RWA positions |

## 9. Contract / API boundaries

**This layer provides** (all implemented here): persistence, constraints, RLS, grants, the
commitment spec, and the RPCs that gate evidence writes.

**Downstream must provide** (explicitly not in this change): Soroban registry/asset contracts,
transaction building, signing, submission, indexer confirmation feeds, marketplace UI, and the
API routes that call the RPCs. Contracts verify the snapshot hash recorded at issuance; they do
not re-derive terms from `deals`.

**Interface stability.** Table and column names in §3, the RPC signatures and the commitment
domains are the stable interface. Anything else is an implementation detail.

## 10. Dependency map

| Depends on | Why |
|------------|-----|
| `deals` (20260427000200, 20260712000400 guard) | Commercial record and the term guard being extended |
| `profiles` + `supplier_companies.verified` | Approval rules |
| `deals.escrow_contract_address` | Repayment destination must exist before issuance |
| `admin_audit_events` | Audit trail for issuance/activation |
| `#181` (reopen) | Reopen path must respect the RWA lock |
| `#179` (commercial currency) | Frozen USDC amount is consumed as-is; no FX here |
| `#73` (migration conventions) | Additive CLI-generated migration only |

Consumed by: credit-asset contract work, contribution/settlement API work, investor portfolio
and marketplace read models.

## 11. Testing this change

SQL tests live in `supabase/tests/rwa/` (pgTAP) and prove the permission matrix, constraint
behaviour and migration safety. The reproducible command against a **disposable local** database:

```bash
# one-time local setup (no shared or production database is touched)
npx supabase init          # only if supabase/config.toml is absent in your clone
npx supabase start

# apply every migration from scratch, then run the pgTAP suites
npx supabase db reset
npx supabase test db

# application checks
bun test __tests__/rwa
bun test
bun lint
bunx tsc --noEmit
bun build

npx supabase stop
```

`supabase db reset` must succeed from an empty database, and `supabase test db` must report every
`supabase/tests/rwa/*.sql` suite as passing.

### Known pre-existing blockers (not introduced here)

`supabase db reset` currently cannot reach this migration on a clean checkout because of two
unrelated earlier migrations:

- `20260824000100_deals_product_id.sql` calls `min(uuid)`; stock Postgres has no such aggregate.
- `20260827_multi_currency_support.sql` alters `purchase_orders` and `financing_opportunities`
  (no migration in this repository creates either table) and declares
  `settlement_currency VARCHAR(3) DEFAULT 'USDC'`, which cannot hold its own default.

Both need a maintainer decision (fix forward in a new migration, or repair the historical files).
The RWA schema and suites were verified on a disposable Postgres 17 instance with every other
migration applied and those two excluded, so this change is independent of them.

## 12. Out of scope

Not implemented, intentionally: secondary trading, vault collateral, equity tokenization,
SEP-57/T-REX production compliance, FX conversion, custodial holding of repayment funds,
SEP-41 position tokens, and backfilled historic issuance for legacy deals.

## 13. Unified issuance, funding and redemption

`rwa_credit_assets` is the issuance record. Confirming `create_funding_pool` also writes
the `rwa_assets` row that `/api/rwa/contributions/*` already reconciles, and sets
`deals.funding_mode = 'rwa'` without setting `investor_id`. `deals.rwa_opted_in` is the
product switch. Legacy deals keep classic USDC funding.

Registry terms now include `deal_hash`, `snapshot_hash` and `document_root`. Maturity
stays delivery-relative in Postgres (`rwa_activate_issuance`). The pool lifecycle remains
`open → ready_to_settle → settled | cancelled`. Credit-asset states
`fully_funded → settling → settled` are the repayment clock and are updated from the
position mirror and `rwa_redeem_position`.

| SOS name | Persisted state |
|----------|-----------------|
| FUNDED | `rwa_credit_assets.state = fully_funded` |
| ACTIVE | `active` (set by `rwa_activate_issuance` at delivery) |
| REPAYING | `settling` |
| REPAID / REDEEMED | `settled` |

Transaction sequence: admin `register_asset` → admin `create_funding_pool` → investor
`contribute` (at most two new investors) → pool `settle` once principal equals the target →
Trustless Work milestones, one receiver per position → `rwa_redeem_position` until the asset
is `settled`.

`POST /api/rwa/reconcile` re-reads `submitted` and `unknown` issuance attempts and submitted
contributions. Both confirmation paths are idempotent on issuance identity and on
`(network, tx hash, event)`.

No verified Testnet evidence is recorded. See [rwa-testnet-evidence.md](rwa-testnet-evidence.md).

