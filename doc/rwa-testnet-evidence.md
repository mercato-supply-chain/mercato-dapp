# RWA Testnet lifecycle evidence

> **Status: contracts deployed; lifecycle not verified.** The credit-funding WASM and credit-registry are on Stellar Testnet. No Testnet issuance, two-investor funding, supplier settlement, or two-receiver release has been recorded. Do not treat the tables below as receipts. They are the template a future harness fills from a real run. `scripts/rwa/testnet-lifecycle.ts` is not in the repo.

### Deployed 2026-11-10

| Item | Value |
| --- | --- |
| Toolchain | stellar-cli 28.1.0, soroban-sdk 29.0.1, rustc 1.96.1, target `wasm32v1-none` |
| credit-funding WASM hash | `7f6e0cc81619d4851c5effd0409fe94eb8924d9f1f00780720323aab2b44b083` |
| Funding WASM upload | [607f71451b3bfcd67280a3b9af8b98d2d294a1381c933f0891239e5b14f9b3d8](https://stellar.expert/explorer/testnet/tx/607f71451b3bfcd67280a3b9af8b98d2d294a1381c933f0891239e5b14f9b3d8) |
| credit-registry WASM hash | `71aa592aab81b29f51077be1aaf0076f62d307c072f3a57af81c12d9edf6136a` |
| Registry WASM upload | [950c33f6ed841d3e9bf7adec19e97524593925c1d7b67a78f394b8d56c0c59e4](https://stellar.expert/explorer/testnet/tx/950c33f6ed841d3e9bf7adec19e97524593925c1d7b67a78f394b8d56c0c59e4) |
| Registry deploy | [4d30a4b1a4f51ff83878092ba3620c064ef15077eb42fcfebc0f4ef3fc3d40f1](https://stellar.expert/explorer/testnet/tx/4d30a4b1a4f51ff83878092ba3620c064ef15077eb42fcfebc0f4ef3fc3d40f1) |
| Registry contract | `CD5G343KUP7KN3O22FRH43MMMLEMZKU2DQBHHCGVAPT7S3IUUMMWHXSF` |
| Registry admin | `GAGZSSVI7IJ7G4B57SCOPHFYV3YSS76ONOC22XOOEF47SP4OZJPG4BXS` (CLI identity `mercato-rwa-testnet`; secret not in the repo) |
| USDC SAC | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` (Circle testnet USDC, issuer `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`, decimals 7) |

`assets(0, 1)` on the registry returned `[]` after deploy, so the constructor ran and the registry is empty. This is not a verified-build attestation. The lifecycle tables underneath stay placeholders.

The product sequence that the run has to prove, in order:

1. An admin issues an opted-in deal: `register_asset` then `create_funding_pool`. The registry record stores the deal hash, financial snapshot hash, and document root. The database writes one `rwa_credit_assets` row and the `rwa_assets` pool row the contribution API already uses. `deals.investor_id` stays null.
2. Two investors call `contribute`. A third new investor is refused. Overfunding is refused by the pool. The supplier is not paid while the pool is `open`.
3. After the target is met, an admin calls `settle` and `POST /api/rwa/settlements/supplier`. The deal becomes `funded` only then.
4. Repayment uses the position schedule. Each Trustless Work milestone pays one investor wallet. Confirming a release writes `rwa_position_settlements` and, when every position is redeemed, moves the credit asset through `settling` to `settled`.
5. `POST /api/rwa/reconcile` re-reads submitted issuance and contribution transactions. A replay uses the same asset id and the same position.

SOS names map onto persisted states: `FUNDED` is `fully_funded`, `ACTIVE` stays `active`, `REPAYING` is `settling`, and `REPAID` / `REDEEMED` are `settled`. Those states live on `rwa_credit_assets`. The Soroban pool stops at supplier settlement (`open` → `ready_to_settle` → `settled`).

Trust assumptions: the registry admin signs issuance; each investor authorizes `contribute`; the pool authorizes the registry settle/cancel transition; a platform admin releases Trustless Work milestones. Documents, delivery-relative maturity, and pro-rata repayment stay off-chain. Positions are not SEP-41 tokens. The first release accepts two investors.

---

## 1. Source revision and artifacts

| Item | Value |
| --- | --- |
| Git revision | `665e532d2eefeafb8714f7534532bb444d7f6c8f` |
| Network | Stellar Testnet (`stellar-testnet`) |
| RPC endpoint | `https://soroban-testnet.stellar.org/soroban/rpc` |
| Network passphrase | `Test SDF Network ; September 2015` |
| Soroban CLI version | recorded in `run-manifest.json` `toolchain.soroban-cli` |
| Rust toolchain | recorded in `run-manifest.json` `toolchain.rust` |
| Bun version | recorded in `run-manifest.json` `toolchain.bun` |

### WASM hashes

The contract WASM artifacts are built from this revision and hashed with `sha256`. The manifest commits the full digest; the table below is filled from `run-manifest.json`.

| Contract | WASM SHA256 |
| --- | --- |
| credit-asset-registry | `${WASM_HASH_REGISTRY}` |
| position-ledger | `${WASM_HASH_POSITION_LEDGER}` |

The command that produces these hashes is documented in Section 7. A run whose WASM hash differs from the deployed contract id advertised in the manifest is rejected by the harness before any transaction is submitted.

## 2. Deployed contracts and assets

| Role | Contract ID | Asset Issuer | Asset Code |
| --- | --- | --- | --- |
| Credit asset registry | `${CONTRACT_ID_REGISTRY}` | `${REGISTRY_ISSUER_ADDR}` | `${CREDIT_ASSET_CODE}` |
| Position ledger | `${CONTRACT_ID_POSITION_LEDGER}` | `${REGISTRY_ISSUER_ADDR}` | `${CREDIT_ASSET_CODE}` |

The credit asset is a Stellar asset issued by the registry issuer account. The asset code is frozen at issuance time and cannot be redefined by a later deal.

## 3. Participants and wallets

All addresses are Testnet public keys. Secret keys are supplied only through the documented environment variables and are never committed, logged or written to fixtures.

| Role | Public key |
| --- | --- |
| Originator / admin | `${ORIGINATOR_ADDR}` |
| PyME (borrower) | `${PME_ADDR}` |
| Supplier | `${SUPPLIER_ADDR}` |
| Investor A | `${INVESTOR_A_ADDR}` |
| Investor B | `${INVESTOR_B_ADDR}` |

The harness asserts that all five addresses are distinct and that the issuer and signer addresses match the configured roles before submitting any transaction.

## 4. Frozen economic example

The example is frozen for this evidence package and is used by both the local integration harness and the Testnet run.

| Item | Value |
| --- | --- |
| Principal | 1,000.00 USDC |
| Flat-term return | 50.00 USDC |
| Investor A contribution | 600.00 USDC |
| Investor B contribution | 400.00 USDC |
| Investor A ownership units | 600 |
| Investor B ownership units | 400 |
| Investor A net entitlement | 630.00 USDC |
| Investor B net entitlement | 420.00 USDC |
| Funding fee policy | flat, deducted from gross repayment proportionally by units |

Expected per-investor results are recorded in `run-manifest.json` under `expected` and compared to the actual on-chain and database values after each step. The residual (dust) handling is exact: the sum of investor net entitlements must equal the gross repayment minus the flat return, and any integer-unit remainder is assigned to the last unit holder by deterministic ordering and asserted explicitly.

## 5. Transaction sequence and receipts

The table below is filled from `run-manifest.json`. Each row is a real Testnet transaction confirmed via Stellar RPC `getTransaction`; the ledger is the confirmed ledger number and the explorer link is stable for that hash.

| # | Step | Tx hash | Ledger | Explorer |
| --- | --- | --- | --- | --- |
| 1 | Deploy credit-asset registry | `${TX_DEPLOY_REGISTRY}` | `${LEDGER_DEPLOY_REGISTRY}` | `${EXPLORER_DEPLOY_REGISTRY}` |
| 2 | Deploy position ledger | `${TX_DEPLOY_POSITION_LEDGER}` | `${LEDGER_DEPLOY_POSITION_LEDGER}` | `${EXPLORER_DEPLOY_POSITION_LEDGER}` |
| 3 | Issue approved deal (registry issuance) | `${TX_ISSUE}` | `${LEDGER_ISSUE}` | `${EXPLORER_ISSUE}` |
| 4 | Investor A contribution (600) | `${TX_CONTRIB_A}` | `${LEDGER_CONTRIB_A}` | `${EXPLORER_CONTRIB_A}` |
| 5 | Investor B contribution (400) | `${TX_CONTRIB_B}` | `${LEDGER_CONTRIB_B}` | `${EXPLORER_CONTRIB_B}` |
| 6 | Funding target reached; supplier payment release | `${TX_SUPPLIER_PAYMENT}` | `${LEDGER_SUPPLIER_PAYMENT}` | `${EXPLORER_SUPPLIER_PAYMENT}` |
| 7 | Partial repayment | `${TX_PARTIAL_REPAYMENT}` | `${LEDGER_PARTIAL_REPAYMENT}` | `${EXPLORER_PARTIAL_REPAYMENT}` |
| 8 | Final repayment and proportional settlement | `${TX_FINAL_REPAYMENT}` | `${LEDGER_FINAL_REPAYMENT}` | `${EXPLORER_FINAL_REPAYMENT}` |
| 9 | Redeem investor A position | `${TX_REDEEM_A}` | `${LEDGER_REDEEM-A}` | `${EXPLORER_REDEEM_A}` |
| 10 | Redeem investor B position | `${TX_REDEEM_B}` | `${LEDGER_REDEEM_B}` | `${EXPLORER_REDEEM_B}` |
| 11 | Close credit asset | `${TX_CLOSE_ASSET}` | `${LEDGER_CLOSE_ASSET}` | `${EXPLORER_CLOSE_ASSET}` |

Explorer links follow the format `https://stellarchain.org/testnet/tx/<tx_hash>`. The harness verifies that each hash returns `SUCCESS` from `getTransaction` before writing it here.

## 6. Authoritative state assertions

Each step asserts both the authoritative chain state and the database projection. The manifest records the observed values and the expected values side by side.

### 6.1 Issuance metadata and commitments

- Registry contract returns the issued asset code, issuer, and immutable terms (principal, 50 USDC flat return, funding target).
- Database `deals` row has `status = 'issued'` and `on_chain_asset_code` matching the registry response.
- commitment records for investor A and investor B are created with distinct contribution references.

### 6.2 Separate A/B contribution references and positions

- Investor A contribution reference is distinct from investor B's and each is linked to its own wallet address.
- Position ledger returns units 600 for A and 400 for B.
- Database `positions` rows match the ledger units and owner addresses.

### 6.3 No supplier payment before target

- Before the funding target is reached, the supplier payment release is rejected by the contract and no supplier payment transaction is submitted.
- The harness asserts the rejection returns the documented error code and that the supplier balance is unchanged.

### 6.4 One exact invoice payment

- After the target is reached, exactly one supplier payment is released.
- The supplier balance increases by the invoice amount and the escrow balance decreases by the same amount.
- A second release attempt is rejected as a duplicate release.

### 6.5 Partial repayment

- A partial repayment is recorded with its own transaction hash and ledger.
- Database `repayments` row is created with the partial amount and the deal remains open.
- No investor settlement is paid out at this step.

### 6.6 No premature completion

- The deal status is not `completed` after the partial repayment.
- Attempting to close the asset or redeem positions before the final repayment is rejected.

### 6.7 Final net payouts

- The final repayment settles investor A at 630.00 USDC net and investor B at 420.00 USDC net.
- The sum of net payouts equals the gross repayment minus the flat return; the residual assignment is asserted exactly.
- Database `settlements` rows match the on-chain payouts and the deal status is `completed`.

### 6.8 Redemption and asset closure

- Investor A and investor B positions are redeemed on-chain and marked redeemed in the database.
- The credit asset is closed and the registry returns the closed status.
- No further contribution, repayment or redemption is accepted after closure.

## 7. Reproducible commands

### 7.1 Local deterministic integration harness

The local harness under `__tests__/rwa/` runs the full lifecycle against a deterministic fixture set with no external vendor access. It covers the failure paths listed in Section 8.

```bash
bun test __tests__/rwa
```

### 7.2 Testnet lifecycle script

The Testnet script is opt-in and requires the environment variables documented in `env.sample`. It reports an explicit result manifest and exits non-zero on any unmet invariant.

```bash
bun run scripts/rwa/testnet-lifecycle.ts
```

The script writes `run-manifest.json` next to the run and regenerates this document from that manifest. It rejects a run whose WASM hash or contract ID does not match the configured artifacts.

### 7.3 Rust, Bun and migration/RLS verification

```bash
cargo test --workspace
cargo fmt --workspace --check
cargo clippy --workspace --all-targets - -D warnings
cargo build --workspace --target wasm32-unknown-unknown
bun test
bun lint
bunx tsc --noEmit
bun build
supabase test db
```

The RLS migration tests establish investor isolation (investor A cannot read investor B's positions) and protected financial writes (only the server role can insert contributions, repayments and settlements).

## 8. Negative and recovery scenarios

Each scenario is automated in the local harness with explicit assertions. Critical chain behaviors are recorded with Testnet receipts in `run-manifest.json`.

| Scenario | Assertion |
| --- | --- |
| Overfunding race | The second contribution that would exceed the target is rejected; total units never exceed the funding target. |
| Wrong network/asset | A transaction signed for the wrong network or asset is rejected before submission. |
| Unauthorized issuer/signer | A transaction signed by a non-issuer key is rejected; the contract returns the authorization error. |
| Duplicate contribution/release | A repeated contribution or supplier release is rejected as a duplicate. |
| Rejected wallet signature | A transaction with an invalid signature is rejected and no state change occurs. |
| Timeout/unknown outcome | A transaction whose confirmation times out is reconciled by querying the hash; the database is not marked complete without confirmation. |
| Chain success + DB failure | A confirmed chain transaction whose DB write fails is replayed from chain evidence without double-spending. |
| Indexer lag | The projection is eventually consistent; the harness waits for the indexer to catch up and asserts the final values. |
| Job restart | A restarted job resumes from persisted checkpoints without duplicating payouts. |
| Expired partial funding/refund | An expired partial funding is refunded to investors and the deal is marked failed. |
| Unpaid-position closure attempt | Closing the asset while a position is unpaid is rejected. |

## 9. SOW deliverable mapping

### Deliverable 1 - Registry issuance

- Evidence: transactions 1-3 in Section 5; issuance metadata assertions in Section 6.1.
- Readable snapshot: `run-manifest.json` `steps.issue.registry_state` and `steps.issue.db_deal`.

### Deliverable 2 - Investor positions and funding

- Evidence: transactions 4-6 in Section 5; contribution and target-gating assertions in Sections 6.2-6.4.
- Readable snapshot: `run-manifest.json` `steps.contribution_a`, `steps.contribution_b` and `steps.supplier_payment`.

### Deliverable 3 - Repayment, settlement, redemption and closure

> Deliverable 3 is labelled optional in one SOW table but is included in the SOW budget, timeline and evidence. This backlog implements the full described lifecycle.

- Evidence: transactions 7-11 in Section 5; repayment, settlement, redemption and closure assertions in Sections 6.5-6.8.
- Readable snapshot: `run-manifest.json` `steps.partial_repayment`, `steps.final_repayment`, `steps.redeem_a`,
