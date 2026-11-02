# RWA repayment capability boundary

This document records the Trustless Work capability boundary used by the RWA
position payout servicing in `lib/trustless/repayment-position-payout.ts` and
`lib/trustless/repayment-position-payout-deploy.ts`.

## Verified from the installed SDK

`@trustless-work/escrow` 3.0.5 exposes multi-release escrows whose milestones
carry an individual `receiver`, `amount`, and `description`. The initialize
payload accepts a milestone array, and release funds are addressed by milestone
index.

## Implemented position servicing

The current implementation consumes a frozen position/entitlement ledger and:

- requires every position `receiver` to equal its immutable `fundingWallet`;
- binds every tranche to an asset id, position id, tranche index and milestone
  index;
- keeps exact integer atomic gross, net and fee amounts for every tranche;
- reconciles each position's scheduled net against its frozen entitlement and
  the complete schedule against the frozen gross/net totals;
- rejects receiver overrides, duplicate tranches, incomplete positions and
  changed profile wallets;
- assigns pro-rata remainder units deterministically (the final position in
  input order absorbs dust);
- produces a canonical reviewed commitment over the whole schedule;
- prepares recoverable `prepared → submitted → unknown → failed → confirmed`
  intents, makes prepare/submit/confirm idempotent, and refuses a second intent
  claiming the same on-chain transfer;
- verifies network, escrow contract, SAC, receiver, net amount, transaction hash,
  operation/event id and ledger before settling a position;
- never closes a position short of its exact frozen net entitlement;
- persists every intent in `rwa_repayment_payout_intents` through a service-role
  repository, with one row per asset/position/tranche and unique confirmed
  evidence per network/transaction/event;
- exposes the position, tranche, receiver, net amount and schedule commitment on
  the admin approval/release queue items and the append-only escrow audit
  payload.

`lib/trustless/repayment-position-payout-deploy.ts` maps the frozen schedule to a
Trustless Work initialize payload and persists position, tranche, receiver, net
amount and schedule commitment on every cached milestone. The existing
`deployRepaymentEscrow` command uses this path only when `payoutSchedule` is
provided; legacy single-investor deploys are unchanged.

The additive migration is
`supabase/migrations/20261022000100_rwa_repayment_payout_intents.sql`. The table
has no client write policy; the service role is the only writer and admins can
read it through RLS.

## Not verified

The repository does not yet contain evidence from a deployed multi-release
contract for:

- updating receivers or amounts after funding or partial release;
- milestone-count limits and minimum escrow balances;
- exact Trustless Work fee rounding for multiple receivers;
- two distinct receivers receiving payouts on Testnet.

No on-chain evidence is claimed by this change. The accounting layer pins the
frozen gross/net pair and rejects any unverified underpayment, but it does not
assert that the deployed contract's fee rounding matches the local fixture math.

## Why #251 is not closed by this change

The acceptance criteria require Testnet balance changes, release receipts and
position-level records for two distinct receivers. Those require funded Testnet
accounts, a deployed escrow and admin signing keys that are not present in this
workspace. Full completion therefore still needs a Testnet evidence run. Do not
fabricate receipts or substitute a platform wallet for an investor receiver.
