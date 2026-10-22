-- Position-level repayment payout intents for RWA servicing (Issue #251).
--
-- One row per (asset, position, tranche). The row binds the reviewed schedule
-- commitment, the exact atomic obligation, the immutable receiver and every
-- confirmed on-chain evidence field. Writes are service-role only; admins can
-- read the audit trail through RLS.

create table if not exists public.rwa_repayment_payout_intents (
  idempotency_key text primary key,
  deal_id uuid references public.deals (id) on delete restrict,
  asset_id text not null check (asset_id ~ '^[0-9a-f]{64}$'),
  position_id text not null check (length(btrim(position_id)) between 1 and 128),
  tranche_index integer not null check (tranche_index >= 0),
  milestone_index integer not null check (milestone_index >= 0),
  network text not null check (network in ('testnet', 'futurenet', 'mainnet')),
  escrow_contract text not null check (length(btrim(escrow_contract)) between 1 and 128),
  sac_contract text not null check (length(btrim(sac_contract)) between 1 and 128),
  release_signer text not null check (length(btrim(release_signer)) between 1 and 128),
  receiver text not null check (length(btrim(receiver)) between 1 and 128),
  gross_atomic bigint not null check (gross_atomic > 0),
  net_atomic bigint not null check (net_atomic > 0),
  fee_atomic bigint not null check (fee_atomic >= 0),
  schedule_commitment text not null,
  state text not null default 'prepared' check (
    state in ('prepared', 'submitted', 'unknown', 'failed', 'confirmed')
  ),
  submission_hash text,
  confirmation_tx_hash text,
  confirmation_operation_or_event_id text,
  confirmation_ledger_seq bigint
    check (confirmation_ledger_seq is null or confirmation_ledger_seq > 0),
  confirmed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rwa_repayment_payout_intents_position_tranche_key
    unique (asset_id, position_id, tranche_index),
  constraint rwa_repayment_payout_intents_confirmation_complete check (
    state <> 'confirmed' or (
      confirmation_tx_hash is not null
      and confirmation_operation_or_event_id is not null
      and confirmation_ledger_seq is not null
      and confirmed_at is not null
    )
  )
);

comment on table public.rwa_repayment_payout_intents is
  'Recoverable position/tranche payout intents. Never a substitute for on-chain evidence.';

create index if not exists idx_rwa_repayment_payout_intents_position
  on public.rwa_repayment_payout_intents (asset_id, position_id, tranche_index);

create unique index if not exists uq_rwa_repayment_payout_intents_confirmation
  on public.rwa_repayment_payout_intents (
    network,
    confirmation_tx_hash,
    confirmation_operation_or_event_id
  )
  where state = 'confirmed';

create or replace function public.touch_rwa_repayment_payout_intent()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists rwa_repayment_payout_intents_touch on public.rwa_repayment_payout_intents;
create trigger rwa_repayment_payout_intents_touch
  before update on public.rwa_repayment_payout_intents
  for each row execute function public.touch_rwa_repayment_payout_intent();

alter table public.rwa_repayment_payout_intents enable row level security;

drop policy if exists rwa_repayment_payout_intents_select_admin
  on public.rwa_repayment_payout_intents;
create policy rwa_repayment_payout_intents_select_admin
  on public.rwa_repayment_payout_intents for select
  using (public.rwa_is_admin());

revoke all on public.rwa_repayment_payout_intents from public, anon, authenticated;
grant select on public.rwa_repayment_payout_intents to authenticated;
grant select, insert, update on public.rwa_repayment_payout_intents to service_role;
