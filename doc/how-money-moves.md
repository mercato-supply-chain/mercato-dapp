# How money moves in Mercato

This is a walkthrough of the running app: which person clicks which screen, what that click writes, and which contract (if any) it signs. It is the practical companion to [rwa-architecture.md](./rwa-architecture.md) and the deal lifecycle in [AGENTS.md](../AGENTS.md).

The short version: a deal you create in the UI is a Supabase row. The buttons on that deal send classic USDC and, later, a Trustless Work escrow. The credit registry and funding-pool contracts in `contracts/` run only on an opt-in path the create-deal form never turns on.

## Two money paths

| | Default deal | Credit pool (opt-in) |
|---|---|---|
| How a deal enters the path | Creating a deal. `deals.rwa_opted_in` stays `false`. | Someone sets `deals.rwa_opted_in = true` in the database, and `RWA_ENABLED=true`. The create-deal form has no control for this. |
| Who pays the supplier | One investor, at the Fund click, in classic USDC. | The funding-pool contract, and only after `settle`. |
| `deals.investor_id` | Set to that investor. | Stays null. Positions live in `rwa_positions`. |
| Investor cap | One. The fund update requires `investor_id` to be null. | Two. `RWA_MAX_INVESTORS` in `lib/rwa/bindings.ts`, checked when a contribution is prepared. |
| Contract at funding | None. A Stellar payment. | `credit-funding` `contribute`. |
| Repayment contract | Trustless Work multi-release escrow, deployed after the PyME confirms delivery. | The same Trustless Work escrow. Issuance refuses to start until `deals.escrow_contract_address` already exists, so the escrow has to be deployed before investors fund. |
| Wallet that can fund | Stellar Wallets Kit (Freighter, Albedo) or Pollar. | Stellar Wallets Kit. Pollar is refused. |

Both paths share the same deal page (`/deals/[id]`). The Fund button branches on `deal.rwaOptedIn` inside `components/deals/actions/investor-fund-actions.tsx`.

## People and where they work

| Role | `profiles.user_type` | Places that move money |
|---|---|---|
| PyME | `pyme` | `/create-deal`, deal page (confirm delivery, fund the repayment escrow), `/dashboard/vault` |
| Investor | `investor` | `/deals` and the deal page (Fund), `/dashboard/investments`, `/dashboard/vault` |
| Supplier | `supplier` | Deal page (add tracking), `/dashboard/deliveries` |
| Admin | `admin` | `/dashboard/admin/approvals` (deploy escrow), `/dashboard/admin/releases` (approve and release), deal page (Settle supplier, when a pool is ready) |

Shipping, delivery confirmation, and deal creation write the database. They do not sign a transaction.

## Default deal, click by click

### 1. PyME creates the deal

Screen: `/create-deal`.

What happens: a row is inserted in `deals`. `status` is `seeking_funding`. The app maps that to the UI status `awaiting_funding` in `lib/deals.ts`. No escrow is deployed here.

### 2. Investor funds the supplier

Screen: deal page, Fund. Code: `fundRwaDeal` is skipped; `handleFundDeal` builds the payment in `lib/stellar/build-usdc-split-payment.ts`.

What the investor signs: one classic Stellar transaction. The invoice principal goes to the supplier address. One percent goes to `NEXT_PUBLIC_MERCATO_PLATFORM_ADDRESS`. Fee math is `investorFundingTotal` in `lib/deals/fees.ts` (`PLATFORM_FEE_PERCENT = 1`).

What the app writes, only if the deal is still `seeking_funding` and `investor_id` is null:

| Column | Value |
|---|---|
| `investor_id` | The signed-in investor |
| `status` | `funded` |
| `funded_at` | Now |
| `funding_tx_hash` | The payment hash |

The investor's Stellar address is also saved on `profiles.address`, because later escrow releases pay that address (`lib/deals/investor-wallet.ts`).

Pollar signs with `signAndSubmitTx`. Freighter and Albedo sign through `lib/trustless/wallet-kit.ts` and the app submits the signed XDR.

The supplier has the invoice as soon as this transaction succeeds. Repayment has not started. `repayment_status` is still `none`.

### 3. Supplier ships

Screen: deal page, delivery panel. `components/deals/actions/supplier-ship-actions.tsx`.

`deals.status` becomes `in_progress`. No chain call.

### 4. PyME confirms delivery

Screen: deal page. `components/deals/actions/pyme-confirm-delivery-actions.tsx`.

The update sets `repayment_status` to `order_confirmed`, and only if it was `none`. This is the gate for the admin queue. `lib/admin/get-admin-queue-data.ts` lists deals for escrow creation with `.eq('repayment_status', 'order_confirmed')`.

Until this click, Approvals stays empty for that deal.

### 5. Admin deploys the repayment escrow

Screen: `/dashboard/admin/approvals`. Component: `app/dashboard/admin/create-repayment-escrows.tsx`. Hook: `hooks/use-repayment-escrow.ts` (`deployRepaymentEscrow`).

Preconditions the screen enforces:

- A connected wallet.
- That wallet equals `NEXT_PUBLIC_MERCATO_PLATFORM_ADDRESS`.
- A reviewed deployment draft. Direct deploy without a draft is rejected.

What runs: the Trustless Work client builds an unsigned multi-release deploy (`deployEscrow(payload, 'multi-release')`). The admin signs it. Trustless Work deploys the escrow contract. Mercato does not contain that contract's source. The integration lives in `lib/trustless/` and `@trustless-work/*` calls inside the repayment hook.

On success the deal is updated:

| Column | Value |
|---|---|
| `escrow_id` | Engagement id |
| `escrow_contract_address` | The new contract |
| `escrow_status` | `initialized` |
| `repayment_status` | `escrow_initialized` |
| `repayment_total_amount` | Grossed amount (below) |
| `repayment_milestones` | The first milestone, usually 50% |
| `repayment_due_at` | Set from `term_days` if it was empty |

The deploy is refused if `escrow_contract_address` is already set.

If `GET /api/rwa/repayment/schedule?dealId=` returns a schedule, the deploy uses one milestone per investor position (`lib/trustless/repayment-position-payout.ts`). On a default deal that request does not change the single-investor draft.

### 6. PyME funds the escrow

Screen: deal page, repayment panel. `components/deals/actions/pyme-repay-actions.tsx` calls `fundRepaymentEscrow`.

The PyME signs a Trustless Work fund transaction that deposits USDC into `escrow_contract_address`. The amount is the grossed repayment, not the invoice.

`repaymentEscrowAmount` in `lib/deals/fees.ts` grosses principal plus yield so that after a 1% platform fee and a 0.3% Trustless Work fee the investor still receives principal plus yield. The first milestone defaults to 50% of that grossed total (`DEFAULT_FIRST_MILESTONE_PERCENT`).

`repayment_status` values `funding`, `ready_to_release`, `partially_released`, and `released` are derived from the Trustless Work indexer in `lib/deals/repayment-escrow-helpers.ts`. They are written back when the app syncs. They are not a separate on-chain enum Mercato owns.

Pollar is limited here. Trustless Work signing expects Stellar Wallets Kit (`PollarWalletKitLimitations` in `lib/mercato-wallet.ts`).

### 7. Admin approves and releases

Screen: `/dashboard/admin/releases`, and the admin actions on the deal page (`components/deals/actions/admin-release-actions.tsx`, `milestone-role-actions.tsx`).

Two Trustless Work calls, in order, both signed by the admin wallet:

1. `approveMilestone` on the multi-release escrow.
2. `releaseFunds` for that milestone.

Releases pay the investor address stored on the profile. When every milestone is released, `repayment_status` becomes `released` and `deals.status` becomes `completed` (`hooks/use-repayment-escrow.ts`).

The release queue includes deals whose `repayment_status` is `ready_to_release`, `funded`, `partially_released`, `funding`, or `escrow_initialized`, and whose `escrow_contract_address` is set.

## Status you will see

`deals.status` is the commercial status. `deals.repayment_status` is the escrow status. Funding open / extended / expired is computed in `getDealFundingStatus` and is not a column.

| `deals.status` | UI label | Set by |
|---|---|---|
| `seeking_funding` | `awaiting_funding` | Create deal |
| `funded` | `funded` | Classic fund, or a verified credit-pool settlement |
| `in_progress` | `in_progress` | Supplier ships |
| `completed` | `completed` | All repayment milestones released |
| `cancelled` | shown as completed in the legacy map | Legacy |

| `deals.repayment_status` | Meaning |
|---|---|
| `none` | No delivery confirmation yet |
| `order_confirmed` | PyME confirmed. Waiting for admin to deploy the escrow |
| `escrow_initialized` | Escrow contract exists. Waiting for the PyME to fund it |
| `funding` | Deposit is in progress, from the indexer |
| `ready_to_release` | Funded. Admin can approve and release |
| `partially_released` | At least one milestone paid |
| `released` | All milestones paid |

UI labels `milestone_pending`, `disputed`, and `released` on `DealStatus` are filters. They are not written to `deals.status`.

## Credit pool, function by function

Source:

- `contracts/credit-registry` — one registry, deployed once.
- `contracts/credit-funding` — one pool per asset, deployed by the registry.
- `contracts/credit-protocol` — shared types. Not a deployed contract.

Testnet ids already recorded in [rwa-testnet-evidence.md](./rwa-testnet-evidence.md):

| Role | Id |
|---|---|
| Registry | `CAABHTWL6HWU7GXM2LQT5BG5B7QIKEZLQTOYUBLONE6OY7XPUOJ4SC7O` |
| Registry admin | `GAGZSSVI7IJ7G4B57SCOPHFYV3YSS76ONOC22XOOEF47SP4OZJPG4BXS` |
| USDC SAC | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` |

A full two-investor fund and redeem on that deploy is not recorded. Do not treat a local click-through as that evidence.

### Registry

Constructor, once, at deploy: `(admin, funding_wasm_hash, usdc_sac)`.

| Function | Who must authorize | What it does | What in the app calls it |
|---|---|---|---|
| `register_asset(asset_id, terms)` | Registry admin | Freezes token, target, supplier, fee recipient, deadline, and the deal / snapshot / document hashes. Token must be the constructor USDC SAC. | `prepareIssuance` builds this XDR. No screen. |
| `create_funding_pool(asset_id)` | Registry admin | Deploys `credit-funding` from the stored WASM hash and stores the pool address on the asset. | Built after `register_asset` is confirmed, inside `ensurePoolAttempt`. No screen. |
| `get_asset` / `assets` | Nobody | Reads. | Issuance reconcile reads `get_asset` to check the hashes and the pool address. |
| `mark_settled` | The pool contract | Pool lifecycle `Open` → `Settled`. | Called by the pool inside `settle`. The app does not call it. |
| `mark_cancelled` | The pool contract | Pool lifecycle `Open` → `Cancelled`. | Called by the pool inside `cancel`. The app does not call it. |

`register_asset` refuses a second registration of the same asset id. `create_funding_pool` refuses unless the asset is `Open` and has no pool yet.

### Funding pool

Constructor, called by the registry during deploy: `(registry, asset_id)`. It reads the registry and panics if the asset is not open or already has a pool.

| Function | Who must authorize | When it succeeds | What in the app calls it |
|---|---|---|---|
| `contribute(investor, principal_units, nonce, contribution_ref)` | The investor | Pool is open, before the deadline, amount fits the remaining target. First nonce must be greater than 0. A repeat from the same address must use a higher nonce. USDC SAC is pulled from the investor for principal plus the incremental 1% fee. Hitting the target moves the pool to `ReadyToSettle`. | Deal page Fund, via `/api/rwa/contributions/prepare`. |
| `settle()` | Nobody (permissionless) | Lifecycle is `ReadyToSettle` and funded principal equals the target. Pays the supplier the target and the fee recipient the fees. Marks the registry settled. | Nothing builds this transaction. |
| `cancel()` | Nobody | Open, target not reached, ledger time is at or past the deadline. | Nothing builds this transaction. |
| `refund(investor, position_id)` | That investor | Pool is cancelled. Pays the wallet stored on the position. | Nothing builds this transaction. |
| `refund_to_recorded_wallet(position_id)` | Nobody | Same payout, still to the stored wallet. | Nothing builds this transaction. |
| `refund_batch(start, limit)` | Nobody | Cancelled pool. Walks positions and refunds open ones. | Nothing builds this transaction. |
| `recover_excess(amount)` | `excess_recipient` | Sends only the surplus above accounted liabilities. | Not wired. |
| `pool` / `position` / `positions` | Nobody | Reads. | Chain reconcile reads events, not these, for confirm. |

The pool holds USDC until `settle` or a refund. Reaching the target does not pay the supplier.

### Database the pool is mirrored into

Written by service-role RPCs after a transaction is verified. The browser does not insert these rows.

| Table | Holds |
|---|---|
| `rwa_assets` | Pool projection: `open` → `ready_to_settle` → `settled`, or `cancelled` |
| `rwa_credit_assets` | The issued obligation. `issued` → `partially_funded` → `fully_funded` → `settling` → `settled` |
| `rwa_contributions` | One attempt: `prepared` / `submitted` / `confirmed` / `failed` / `expired` |
| `rwa_positions` | One row per asset and investor after a confirmed contribution |
| `rwa_investor_positions` | Credit ownership, mirrored from positions |
| `rwa_receipts` | Verified chain receipts, unique on network, tx hash, and event index |
| `rwa_issuance_attempts` | `register_asset` and `create_funding_pool` attempts. No client policies. |
| `rwa_repayment_payout_intents` | Per-position repayment intents |

`rwa_assets.lifecycle = settled` means the supplier was paid. It does not mean investors have been repaid. Investor repayment still goes through the Trustless Work escrow.

Names used in older notes map like this: `FUNDED` is `fully_funded`, `REPAYING` is `settling`, `REPAID` / `REDEEMED` are `settled`.

## Issuance, the admin API with no button

Routes, all `requireAdmin`:

| Method | Path | Effect |
|---|---|---|
| POST | `/api/rwa/issuance/prepare` | Builds unsigned `register_asset` XDR and stores an attempt |
| POST | `/api/rwa/issuance/submit` | Submits the admin-signed XDR |
| GET | `/api/rwa/issuance/status` | Re-reads the transaction and, after register succeeds, prepares `create_funding_pool` |
| POST | `/api/rwa/reconcile` | Re-reads submitted or unknown issuance and contribution attempts |

`prepareIssuance` (`lib/rwa/issuance.ts`) refuses unless all of these hold:

- `RWA_ENABLED=true`
- `RWA_REGISTRY_CONTRACT_ID` and `RWA_USDC_SAC_ADDRESS` are set and look like contract ids
- `NEXT_PUBLIC_MERCATO_PLATFORM_ADDRESS` is set
- `deals.rwa_opted_in` is true
- The deal is not cancelled, has no `investor_id`, and has no `funded_at`
- `supplier_id` and `escrow_contract_address` are set
- The PyME profile is `verified`, and the supplier company is `verified` and has an address

The body is `{ dealId, idempotencyKey, signingWallet, documents }`. `documents` is one to eight `{ kind, contentHash }` objects. The content hash is SHA-256 hex. The server hashes those into `document_root`, hashes the deal id into `deal_hash`, and hashes a financial snapshot into `snapshot_hash`. The asset id is deterministic for `(network, registry, deal id)` (`assetIdForDeal` in `lib/rwa/bindings.ts`).

Signing wallet must be `RWA_REGISTRY_ADMIN_ADDRESS`. The client signs the returned `unsignedXdr` and posts it to submit. Submit checks the signed envelope against the stored unsigned XDR before broadcasting.

Status reconcile then:

1. Confirms `register_asset` by reading `get_asset` and comparing hashes.
2. Prepares `create_funding_pool` for the same idempotency key.
3. After that second transaction confirms and `get_asset` shows a pool address, calls `rwa_commit_verified_issuance`. That writes `rwa_credit_assets` and `rwa_assets` and stores the pool contract id on the attempt.

There is no page that collects documents, signs, or advances these two phases. Calling the API with curl or a script is the whole UI.

The deal page Fund button, if the deal is opted in and `deals` has no `rwaAssetId` yet, toasts: "This deal is waiting for its credit asset to be issued."

## Contribution, the one credit-pool call the deal page makes

When `rwaOptedIn` is true, Fund does this (`investor-fund-actions.tsx`):

1. Requires `deal.rwaAssetId`. Requires a non-Pollar wallet.
2. `POST /api/rwa/contributions/prepare` with `{ assetId, amount, walletAddress, idempotencyKey }`. The caller must be logged in. `prepareContribution` also requires `profiles.user_type = investor` and a wallet that belongs to that profile.
3. The response names the pool contract and the args: investor, principal units, nonce, contribution ref. The browser cannot pick the nonce or the ref.
4. The browser builds `contribute` with `lib/stellar/build-soroban-invoke.ts`, the investor signs, and the app submits.
5. `POST /api/rwa/contributions/submit` stores the hash. Nothing is confirmed yet.
6. `POST /api/rwa/contributions/confirm` re-reads the transaction, checks the contribution event, and writes the position.

Prepare also refuses a second wallet for an investor who already has a position on that asset, and refuses a third investor.

Confirm is what moves the mirrored pool toward `ready_to_settle`. The supplier is still unpaid. The toast says so.

Related reads:

| Method | Path | Who |
|---|---|---|
| GET | `/api/rwa/contributions/status` | Logged-in user, own attempts |
| POST | `/api/rwa/contributions/submit` | The investor who owns the attempt |
| POST | `/api/rwa/contributions/confirm` | The investor who owns the attempt |

## Settlement and refund, recorded after the fact

`settle`, `cancel`, and `refund*` are real contract functions. The app never assembles their XDR.

`POST /api/rwa/settlements/supplier` is admin-only. It loads the pool row, requires the lifecycle to be past `open`, fetches the transaction by hash, and accepts it only if the transaction succeeded and emitted the settlement event for that pool (`lib/rwa/settlement.ts`). Then `markSupplierPaid` moves the legacy deal to funded. That is the moment an opted-in deal becomes ready to ship.

The route body is `{ assetId, txHash }`. `txHash` is required (`app/api/rwa/settlements/supplier/route.ts`).

The button on the deal page (`components/deals/actions/admin-settle-supplier-action.tsx`) renders when `rwaLifecycle === 'ready_to_settle'` and posts `{ assetId }` only. It does not call `settle` and it does not send a hash, so that click cannot complete settlement. Someone has to submit `settle` on the pool first (any account can; the pool authorizes `mark_settled` itself), then an admin has to POST the hash.

`POST /api/rwa/refunds` is the same shape for a refund event: `{ assetId, positionId, txHash }` on the route, admin, and it records a refund that the chain already paid to the stored wallet. No screen builds `cancel` or `refund`.

## Repayment after a credit-pool settlement

Once the supplier is paid, shipping and delivery confirmation are the same database steps as the default path.

`GET /api/rwa/repayment/schedule?dealId=` (`lib/rwa/position-servicing.ts`) builds one tranche per confirmed position. Interest dust goes to the last position. Each tranche is grossed for the 1% plus 0.3% release fees. The schedule is used when the admin deploys the escrow, so each investor is a separate milestone receiver. The receiver address is the wallet stored on that position.

`POST /api/rwa/repayment/confirm` runs after a release and calls `rwa_redeem_position` so the credit position is marked repaid. The admin approvals screen calls it (`app/dashboard/admin/pending-approvals.tsx`). The USDC the investor receives still comes from the Trustless Work release, not from the funding pool. The pool already paid the supplier at `settle`.

## DeFindex vault

This is a third contract, shared by the platform, and it is not on the deal timeline.

| Who | Screen | API | Signs |
|---|---|---|---|
| Investor or PyME | `/dashboard/vault` | `/api/defindex/deposit`, `withdraw`, `withdraw-shares`, then `/api/defindex/submit` | The user, including Pollar |
| Admin | `/dashboard/admin/vault` | `/api/defindex/admin/create-vault`, monitor, rebalance | Admin, for create and rebalance |

`hooks/useDefindex.ts` builds an unsigned XDR on the server and has the wallet sign it. The vault address comes from `NEXT_PUBLIC_DEFINDEX_VAULT_ADDRESS` / `MERCATO_DEFINDEX_VAULT_ADDRESS`. Balance reads go to `/api/defindex/balance`.

Leaving USDC in the vault does not fund a deal. Funding a deal does not deposit into the vault.

## Wallets

| Action | Stellar Wallets Kit | Pollar |
|---|---|---|
| Classic USDC fund | Yes | Yes |
| `contribute` | Yes | Refused on the deal page |
| Issuance and pool deploy | The registry admin must sign. No UI. | Refused by the same rule as other RWA admin calls |
| Deploy or release the repayment escrow | Yes | Deploy can submit through Pollar and then poll the indexer. Release signing expects Stellar Wallets Kit. |
| Fund the repayment escrow | Yes | Limited |
| Vault deposit and withdraw | Yes | Yes |

Connection UI: `/dashboard/wallets`. Pollar metadata is stored on `profiles` (`wallet_provider`, `pollar_wallet_id`, `stellar_public_key`, `wallet_status`).

## Environment that gates each path

Default funding and escrow need:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_TRUSTLESS_WORK_API_KEY`, `NEXT_PUBLIC_TRUSTLESS_NETWORK`
- `NEXT_PUBLIC_MERCATO_PLATFORM_ADDRESS`
- `NEXT_PUBLIC_USDC_ISSUER` when you are not using the network default

Credit pool additionally needs `RWA_ENABLED=true`, `RWA_REGISTRY_CONTRACT_ID`, `RWA_USDC_SAC_ADDRESS`, and `RWA_REGISTRY_ADMIN_ADDRESS`. Network follows `NEXT_PUBLIC_TRUSTLESS_NETWORK`. Optional RPC override: `RWA_SOROBAN_RPC_URL`.

The full list is [env.sample](../env.sample).

## What is wired, in one list

| You can do it from a screen | You can do it only by calling an API, after signing elsewhere |
|---|---|
| Create a deal | Opt a deal into the credit pool (`rwa_opted_in`) |
| Fund with classic USDC | `register_asset` and `create_funding_pool` |
| Ship and confirm delivery | `settle`, `cancel`, `refund`, `refund_batch`, `recover_excess` |
| Deploy, fund, approve, and release the Trustless Work escrow | Record settlement or a refund, once you already have the transaction hash |
| `contribute`, once an asset id exists on the deal | |
| Deposit and withdraw the DeFindex vault | |

## Files to open next

| Question | File |
|---|---|
| Deal page decides which buttons to show | `app/deals/[id]/deal-detail-view.tsx` |
| Classic payment vs `contribute` | `components/deals/actions/investor-fund-actions.tsx` |
| Classic USDC XDR | `lib/stellar/build-usdc-split-payment.ts` |
| Soroban invoke XDR | `lib/stellar/build-soroban-invoke.ts` |
| Issuance | `lib/rwa/issuance.ts`, `app/api/rwa/issuance/` |
| Contribution reserve and confirm | `lib/rwa/contribution-intent.ts` |
| Settlement and refund checks | `lib/rwa/settlement.ts` |
| Registry and pool source | `contracts/credit-registry/src/lib.rs`, `contracts/credit-funding/src/lib.rs` |
| Escrow deploy and release | `hooks/use-repayment-escrow.ts`, `lib/deals/repayment-escrow-commands.ts` |
| Why a deal is or is not on Approvals | `lib/admin/get-admin-queue-data.ts` |
| Fee percents | `lib/deals/fees.ts` |
| Per-investor repayment tranches | `lib/rwa/position-servicing.ts` |
| Vault | `hooks/useDefindex.ts`, `app/api/defindex/` |
