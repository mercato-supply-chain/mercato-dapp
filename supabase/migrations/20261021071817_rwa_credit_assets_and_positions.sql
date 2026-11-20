-- RWA: separate the commercial deal, the issued credit obligation and investor positions.
--
-- Model (final table names, documented once here and in doc/rwa-architecture.md):
--   public.deals                    commercial deal (unchanged; `rwa_opted_in` adds routing)
--   public.rwa_credit_assets        ONE canonical issuance of the obligation per asset identity
--   public.rwa_document_commitments opaque document references + cryptographic commitments
--   public.rwa_contribution_attempts one row per funding attempt/top-up (never ownership)
--   public.rwa_contribution_receipts confirmed on-chain evidence (source of confirmed principal)
--   public.rwa_investor_positions   independent ownership positions (units)
--   public.rwa_position_settlements position-level settlement records
--   public.rwa_issuance_events      append-only issuance lifecycle evidence
--
-- Money is stored as exact bigint atomic units with explicit decimals. JSON amounts are
-- decimal strings. Display basis points are presentation only and never drive entitlement:
-- entitlement is units / (principal_atomic * 10^unit_decimals).
--
-- This migration is additive. Legacy deals keep working exactly as before (`rwa_opted_in`
-- defaults to false and no historic issuance/evidence rows are backfilled).

-- ---------------------------------------------------------------------------
-- Routing flag on the commercial deal
-- ---------------------------------------------------------------------------

alter table public.deals
  add column if not exists rwa_opted_in boolean not null default false;

comment on column public.deals.rwa_opted_in is
  'Opt-in routing flag. When true the deal funds through RWA positions instead of legacy direct USDC funding.';

create index if not exists idx_deals_rwa_opted_in
  on public.deals (id)
  where rwa_opted_in;

-- ---------------------------------------------------------------------------
-- 1. Credit assets (the issued obligation)
-- ---------------------------------------------------------------------------

create table if not exists public.rwa_credit_assets (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete restrict,
  network text not null
    check (network in ('testnet', 'futurenet', 'mainnet')),
  registry_contract text not null
    check (length(btrim(registry_contract)) between 1 and 128),
  asset_id text not null
    check (length(btrim(asset_id)) between 1 and 128),
  issuance_identity text generated always as (
    network || ':' || registry_contract || ':' || asset_id
  ) stored,
  asset_code text not null
    check (length(btrim(asset_code)) between 1 and 12),
  asset_issuer text not null
    check (length(btrim(asset_issuer)) between 1 and 128),
  asset_decimals smallint not null
    check (asset_decimals between 0 and 18),
  principal_atomic bigint not null
    check (principal_atomic > 0),
  return_numerator bigint not null
    check (return_numerator > 0),
  return_denominator bigint not null
    check (return_denominator > 0 and return_numerator < return_denominator),
  display_yield_bps integer not null
    check (display_yield_bps between 0 and 9999),
  term_days integer not null
    check (term_days between 1 and 3650),
  maturity_policy text not null default 'delivery_relative'
    check (maturity_policy in ('delivery_relative')),
  scheduled_maturity_at timestamptz,
  actual_due_at timestamptz,
  snapshot_version smallint not null default 1
    check (snapshot_version >= 1),
  financial_snapshot jsonb not null
    check (jsonb_typeof(financial_snapshot) = 'object'),
  financial_snapshot_hash text not null
    check (financial_snapshot_hash ~ '^[0-9a-f]{64}$'),
  fees jsonb not null
    check (
      jsonb_typeof(fees) = 'object'
      and fees ? 'platform_fee_bps'
      and fees ? 'tw_fee_bps'
      and fees ? 'rounding_policy'
      and fees ? 'charged_at'
      and fees ->> 'rounding_policy' = 'half_up_atomic'
    ),
  state text not null default 'draft'
    check (state in (
      'draft', 'issued', 'active', 'partially_funded', 'fully_funded',
      'settling', 'settled', 'defaulted', 'cancelled', 'superseded'
    )),
  issuance_receipt_tx text,
  issuance_operation_id text,
  issuance_ledger_seq bigint
    check (issuance_ledger_seq is null or issuance_ledger_seq > 0),
  issued_at timestamptz,
  activated_at timestamptz,
  superseded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rwa_credit_assets_identity_key unique (issuance_identity),
  constraint rwa_credit_assets_due_requires_activation
    check (actual_due_at is null or activated_at is not null),
  constraint rwa_credit_assets_issue_and_activate_order
    check (activated_at is null or issued_at is not null),
  constraint rwa_credit_assets_receipt_complete
    check (
      issuance_receipt_tx is null
      or (issuance_operation_id is not null and issuance_ledger_seq is not null)
    )
);

comment on table public.rwa_credit_assets is
  'Canonical issuance of a credit obligation against one commercial deal. One active issuance per deal; issuance_identity is network:registry:asset and is globally unique.';
comment on column public.rwa_credit_assets.scheduled_maturity_at is
  'PROJECTION only, recomputed from deal delivery data. Never the contractual due date.';
comment on column public.rwa_credit_assets.actual_due_at is
  'Contractual due date, set exactly once by rwa_activate_issuance() as delivered_at + frozen term_days.';
comment on column public.rwa_credit_assets.display_yield_bps is
  'Presentation only. Entitlement is return_numerator / return_denominator.';

-- One active issuance per commercial deal; superseded versions may coexist.
create unique index if not exists uq_rwa_credit_assets_active_deal
  on public.rwa_credit_assets (deal_id)
  where superseded_at is null;

create unique index if not exists uq_rwa_credit_assets_issuance_receipt
  on public.rwa_credit_assets (network, registry_contract, issuance_receipt_tx, issuance_operation_id)
  where issuance_receipt_tx is not null;

create index if not exists idx_rwa_credit_assets_deal_id
  on public.rwa_credit_assets (deal_id);
create index if not exists idx_rwa_credit_assets_state
  on public.rwa_credit_assets (state);
create index if not exists idx_rwa_credit_assets_created_at
  on public.rwa_credit_assets (created_at desc);

-- ---------------------------------------------------------------------------
-- 2. Document commitments (opaque refs + hashes; no bytes, no signed URLs)
-- ---------------------------------------------------------------------------

create table if not exists public.rwa_document_commitments (
  id uuid primary key default gen_random_uuid(),
  credit_asset_id uuid not null
    references public.rwa_credit_assets (id) on delete restrict,
  doc_kind text not null
    check (doc_kind in (
      'financing_agreement', 'invoice', 'pyme_kyb', 'supplier_kyb', 'custody', 'other'
    )),
  opaque_ref text not null
    check (
      length(btrim(opaque_ref)) between 1 and 256
      and opaque_ref !~* '^(https?|file|data|s3|gs)://'
    ),
  content_hash text not null
    check (content_hash ~ '^[0-9a-f]{64}$'),
  hash_algorithm text not null default 'sha256'
    check (hash_algorithm in ('sha256')),
  canonicalization text not null default 'JCS-RFC8785'
    check (canonicalization in ('JCS-RFC8785', 'raw_bytes')),
  byte_length bigint
    check (byte_length is null or byte_length > 0),
  created_at timestamptz not null default now(),
  constraint rwa_document_commitments_evidence_key
    unique (credit_asset_id, doc_kind, content_hash)
);

comment on table public.rwa_document_commitments is
  'Cryptographic commitments to private documents. opaque_ref is an internal handle, never a signed or public URL.';

create index if not exists idx_rwa_document_commitments_asset
  on public.rwa_document_commitments (credit_asset_id);

-- ---------------------------------------------------------------------------
-- 3. Contribution attempts (retries/top-ups; never ownership)
-- ---------------------------------------------------------------------------

create table if not exists public.rwa_contribution_attempts (
  id uuid primary key default gen_random_uuid(),
  credit_asset_id uuid not null
    references public.rwa_credit_assets (id) on delete restrict,
  investor_profile_id uuid not null
    references public.profiles (id) on delete restrict,
  investor_wallet text not null
    check (length(btrim(investor_wallet)) between 1 and 128),
  amount_atomic bigint not null
    check (amount_atomic > 0),
  asset_code text not null,
  asset_decimals smallint not null
    check (asset_decimals between 0 and 18),
  idempotency_key text not null
    check (length(btrim(idempotency_key)) between 1 and 128),
  state text not null default 'pending'
    check (state in ('pending', 'submitted', 'confirmed', 'failed', 'expired', 'refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rwa_contribution_attempts_idempotency_key
    unique (credit_asset_id, investor_profile_id, idempotency_key)
);

comment on table public.rwa_contribution_attempts is
  'One row per funding attempt or top-up. Attempts never create ownership; only receipts do.';

create index if not exists idx_rwa_contribution_attempts_asset
  on public.rwa_contribution_attempts (credit_asset_id);
create index if not exists idx_rwa_contribution_attempts_investor
  on public.rwa_contribution_attempts (investor_profile_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 4. Contribution receipts (confirmed evidence = confirmed principal)
-- ---------------------------------------------------------------------------

create table if not exists public.rwa_contribution_receipts (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null
    references public.rwa_contribution_attempts (id) on delete restrict,
  credit_asset_id uuid not null
    references public.rwa_credit_assets (id) on delete restrict,
  network text not null,
  registry_contract text not null,
  tx_hash text not null
    check (length(btrim(tx_hash)) between 1 and 128),
  operation_or_event_id text not null
    check (length(btrim(operation_or_event_id)) between 1 and 128),
  ledger_seq bigint not null
    check (ledger_seq > 0),
  confirmed_amount_atomic bigint not null
    check (confirmed_amount_atomic > 0),
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint rwa_contribution_receipts_attempt_key unique (attempt_id),
  constraint rwa_contribution_receipts_evidence_key
    unique (network, registry_contract, tx_hash, operation_or_event_id)
);

comment on table public.rwa_contribution_receipts is
  'Confirmed on-chain contribution evidence. Unique per network/contract/transaction/operation.';

create index if not exists idx_rwa_contribution_receipts_asset
  on public.rwa_contribution_receipts (credit_asset_id);

-- ---------------------------------------------------------------------------
-- 5. Investor positions (independent ownership)
-- ---------------------------------------------------------------------------

create table if not exists public.rwa_investor_positions (
  id uuid primary key default gen_random_uuid(),
  credit_asset_id uuid not null
    references public.rwa_credit_assets (id) on delete restrict,
  investor_profile_id uuid not null
    references public.profiles (id) on delete restrict,
  investor_wallet text not null
    check (length(btrim(investor_wallet)) between 1 and 128),
  committed_principal_atomic bigint not null default 0
    check (committed_principal_atomic >= 0),
  confirmed_principal_atomic bigint not null default 0
    check (confirmed_principal_atomic >= 0),
  units_atomic bigint not null
    check (units_atomic > 0),
  unit_decimals smallint not null default 0
    check (unit_decimals between 0 and 7),
  state text not null default 'active'
    check (state in ('active', 'settled', 'defaulted', 'cancelled')),
  reconciliation_state text not null default 'pending'
    check (reconciliation_state in ('pending', 'matched', 'mismatched', 'reconciled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rwa_investor_positions_owner_key
    unique (credit_asset_id, investor_profile_id),
  constraint rwa_investor_positions_confirmed_within_committed
    check (confirmed_principal_atomic <= committed_principal_atomic)
);

comment on table public.rwa_investor_positions is
  'Independent investor ownership in one credit asset. Entitlement = units_atomic / (principal_atomic * 10^unit_decimals).';
comment on column public.rwa_investor_positions.units_atomic is
  'Exact integer units at the position scale. Never derived from display basis points.';

create index if not exists idx_rwa_investor_positions_asset
  on public.rwa_investor_positions (credit_asset_id);
create index if not exists idx_rwa_investor_positions_investor
  on public.rwa_investor_positions (investor_profile_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 6. Position-level settlement records
-- ---------------------------------------------------------------------------

create table if not exists public.rwa_position_settlements (
  id uuid primary key default gen_random_uuid(),
  position_id uuid not null
    references public.rwa_investor_positions (id) on delete restrict,
  credit_asset_id uuid not null
    references public.rwa_credit_assets (id) on delete restrict,
  kind text not null
    check (kind in ('principal', 'return', 'fee', 'refund', 'write_off')),
  amount_atomic bigint not null
    check (amount_atomic > 0),
  network text not null,
  registry_contract text not null,
  tx_hash text not null
    check (length(btrim(tx_hash)) between 1 and 128),
  operation_or_event_id text not null
    check (length(btrim(operation_or_event_id)) between 1 and 128),
  ledger_seq bigint not null
    check (ledger_seq > 0),
  settled_at timestamptz not null default now(),
  reconciliation_state text not null default 'pending'
    check (reconciliation_state in ('pending', 'matched', 'mismatched', 'reconciled')),
  created_at timestamptz not null default now(),
  constraint rwa_position_settlements_evidence_key
    unique (network, registry_contract, tx_hash, operation_or_event_id)
);

comment on table public.rwa_position_settlements is
  'Per-position principal/return/fee/refund/write-off records with unique on-chain evidence.';

create index if not exists idx_rwa_position_settlements_position
  on public.rwa_position_settlements (position_id, settled_at desc);
create index if not exists idx_rwa_position_settlements_asset
  on public.rwa_position_settlements (credit_asset_id);

-- ---------------------------------------------------------------------------
-- 7. Issuance events (append-only; activation happens exactly once)
-- ---------------------------------------------------------------------------

create table if not exists public.rwa_issuance_events (
  id uuid primary key default gen_random_uuid(),
  credit_asset_id uuid not null
    references public.rwa_credit_assets (id) on delete restrict,
  event_type text not null
    check (event_type in (
      'issued', 'terms_frozen', 'activated', 'superseded', 'cancelled', 'settled'
    )),
  actor_profile_id uuid references public.profiles (id) on delete restrict,
  occurred_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object')
);

comment on table public.rwa_issuance_events is
  'Append-only RWA issuance lifecycle evidence. issued/activated are unique per credit asset.';

create unique index if not exists uq_rwa_issuance_events_once
  on public.rwa_issuance_events (credit_asset_id, event_type)
  where event_type in ('issued', 'activated');

create index if not exists idx_rwa_issuance_events_asset
  on public.rwa_issuance_events (credit_asset_id, occurred_at desc);

-- ---------------------------------------------------------------------------
-- Immutability guards
-- ---------------------------------------------------------------------------

-- Frozen economics: once issued, the financial commitment can never drift.
create or replace function public.enforce_rwa_credit_asset_immutability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allowed text[];
begin
  -- `issuance_identity` is a generated column, so it cannot be assigned at all; in a BEFORE
  -- trigger it is still NULL, which is why only the source columns are compared here.
  if new.deal_id is distinct from old.deal_id
     or new.network is distinct from old.network
     or new.registry_contract is distinct from old.registry_contract
     or new.asset_id is distinct from old.asset_id then
    raise exception 'RWA issuance identity is immutable' using errcode = '23514';
  end if;

  if old.issued_at is not null then
    if (new.network, new.registry_contract, new.asset_id, new.asset_code, new.asset_issuer,
        new.asset_decimals, new.principal_atomic, new.return_numerator, new.return_denominator,
        new.display_yield_bps, new.term_days, new.maturity_policy, new.snapshot_version,
        new.financial_snapshot, new.financial_snapshot_hash, new.fees,
        new.issuance_receipt_tx, new.issuance_operation_id, new.issuance_ledger_seq,
        new.issued_at)
       is distinct from
       (old.network, old.registry_contract, old.asset_id, old.asset_code, old.asset_issuer,
        old.asset_decimals, old.principal_atomic, old.return_numerator, old.return_denominator,
        old.display_yield_bps, old.term_days, old.maturity_policy, old.snapshot_version,
        old.financial_snapshot, old.financial_snapshot_hash, old.fees,
        old.issuance_receipt_tx, old.issuance_operation_id, old.issuance_ledger_seq,
        old.issued_at) then
      raise exception 'RWA financial terms are frozen after issuance' using errcode = '23514';
    end if;
  end if;

  if old.actual_due_at is not null and new.actual_due_at is distinct from old.actual_due_at then
    raise exception 'RWA actual_due_at is written exactly once' using errcode = '23514';
  end if;

  if old.activated_at is not null and new.activated_at is distinct from old.activated_at then
    raise exception 'RWA activation is written exactly once' using errcode = '23514';
  end if;

  if new.actual_due_at is not null and new.activated_at is null then
    raise exception 'RWA actual_due_at requires activation' using errcode = '23514';
  end if;

  if new.state is distinct from old.state then
    v_allowed := case old.state
      when 'draft' then array['issued', 'cancelled']
      when 'issued' then array['active', 'partially_funded', 'cancelled', 'superseded']
      when 'active' then array['partially_funded', 'fully_funded', 'settling', 'defaulted', 'cancelled']
      when 'partially_funded' then array['fully_funded', 'settling', 'defaulted', 'cancelled']
      when 'fully_funded' then array['settling', 'defaulted']
      when 'settling' then array['settled', 'defaulted']
      when 'defaulted' then array['settled']
      else array[]::text[]
    end;

    if not (new.state = any (v_allowed)) then
      raise exception 'Invalid RWA state transition from % to %', old.state, new.state
        using errcode = '23514';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists rwa_credit_assets_immutability on public.rwa_credit_assets;
create trigger rwa_credit_assets_immutability
  before update on public.rwa_credit_assets
  for each row
  execute function public.enforce_rwa_credit_asset_immutability();

-- Positions: owner wallet and accumulated ownership never get rewritten downward.
create or replace function public.enforce_rwa_position_immutability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.credit_asset_id is distinct from old.credit_asset_id
     or new.investor_profile_id is distinct from old.investor_profile_id then
    raise exception 'RWA position ownership is immutable' using errcode = '23514';
  end if;

  if new.investor_wallet is distinct from old.investor_wallet then
    raise exception 'RWA position wallet is immutable' using errcode = '23514';
  end if;

  if new.unit_decimals is distinct from old.unit_decimals then
    raise exception 'RWA position unit scale is immutable' using errcode = '23514';
  end if;

  if new.units_atomic < old.units_atomic then
    raise exception 'RWA position units cannot decrease' using errcode = '23514';
  end if;

  if new.confirmed_principal_atomic < old.confirmed_principal_atomic then
    raise exception 'RWA confirmed principal cannot decrease' using errcode = '23514';
  end if;

  if new.committed_principal_atomic < old.committed_principal_atomic then
    raise exception 'RWA committed principal cannot decrease' using errcode = '23514';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists rwa_investor_positions_immutability on public.rwa_investor_positions;
create trigger rwa_investor_positions_immutability
  before update on public.rwa_investor_positions
  for each row
  execute function public.enforce_rwa_position_immutability();

-- Append-only financial evidence: no UPDATE/DELETE on receipts, settlements, events or documents.
create or replace function public.enforce_rwa_evidence_append_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'RWA financial evidence is append-only' using errcode = '23514';
end;
$$;

drop trigger if exists rwa_contribution_receipts_append_only on public.rwa_contribution_receipts;
create trigger rwa_contribution_receipts_append_only
  before update or delete on public.rwa_contribution_receipts
  for each row
  execute function public.enforce_rwa_evidence_append_only();

drop trigger if exists rwa_position_settlements_append_only on public.rwa_position_settlements;
create trigger rwa_position_settlements_append_only
  before update or delete on public.rwa_position_settlements
  for each row
  execute function public.enforce_rwa_evidence_append_only();

drop trigger if exists rwa_issuance_events_append_only on public.rwa_issuance_events;
create trigger rwa_issuance_events_append_only
  before update or delete on public.rwa_issuance_events
  for each row
  execute function public.enforce_rwa_evidence_append_only();

drop trigger if exists rwa_document_commitments_append_only on public.rwa_document_commitments;
create trigger rwa_document_commitments_append_only
  before update or delete on public.rwa_document_commitments
  for each row
  execute function public.enforce_rwa_evidence_append_only();

-- A credit asset can only exist for an opted-in deal.
create or replace function public.enforce_rwa_opt_in_before_issuance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_opted_in boolean;
begin
  select rwa_opted_in into v_opted_in
  from public.deals
  where id = new.deal_id;

  if not coalesce(v_opted_in, false) then
    raise exception 'Deal is not opted in to RWA funding' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists rwa_credit_assets_require_opt_in on public.rwa_credit_assets;
create trigger rwa_credit_assets_require_opt_in
  before insert on public.rwa_credit_assets
  for each row
  execute function public.enforce_rwa_opt_in_before_issuance();

-- ---------------------------------------------------------------------------
-- Access helpers (security definer so policies stay non-recursive)
-- ---------------------------------------------------------------------------

create or replace function public.rwa_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and user_type = 'admin'
  );
$$;

create or replace function public.rwa_is_deal_party(p_deal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.deals d
    where d.id = p_deal_id
      and (
        d.pyme_id = auth.uid()
        or d.investor_id = auth.uid()
        or exists (
          select 1
          from public.supplier_companies sc
          where sc.id = d.supplier_id and sc.owner_id = auth.uid()
        )
      )
  )
  or exists (
    select 1
    from public.rwa_investor_positions p
    join public.rwa_credit_assets a on a.id = p.credit_asset_id
    where a.deal_id = p_deal_id and p.investor_profile_id = auth.uid()
  )
  or exists (
    select 1
    from public.rwa_contribution_attempts at
    join public.rwa_credit_assets a on a.id = at.credit_asset_id
    where a.deal_id = p_deal_id and at.investor_profile_id = auth.uid()
  );
$$;

create or replace function public.rwa_is_asset_party(p_credit_asset_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.rwa_credit_assets a
    where a.id = p_credit_asset_id
      and public.rwa_is_deal_party(a.deal_id)
  );
$$;

revoke execute on function public.rwa_is_admin() from public, anon;
revoke execute on function public.rwa_is_deal_party(uuid) from public, anon;
revoke execute on function public.rwa_is_asset_party(uuid) from public, anon;
grant execute on function public.rwa_is_admin() to authenticated;
grant execute on function public.rwa_is_deal_party(uuid) to authenticated;
grant execute on function public.rwa_is_asset_party(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS + least-privilege grants
-- ---------------------------------------------------------------------------

alter table public.rwa_credit_assets enable row level security;
alter table public.rwa_document_commitments enable row level security;
alter table public.rwa_contribution_attempts enable row level security;
alter table public.rwa_contribution_receipts enable row level security;
alter table public.rwa_investor_positions enable row level security;
alter table public.rwa_position_settlements enable row level security;
alter table public.rwa_issuance_events enable row level security;

-- No client DML anywhere: writes only through the RPCs below.
revoke all on public.rwa_credit_assets from anon, authenticated;
revoke all on public.rwa_document_commitments from anon, authenticated;
revoke all on public.rwa_contribution_attempts from anon, authenticated;
revoke all on public.rwa_contribution_receipts from anon, authenticated;
revoke all on public.rwa_investor_positions from anon, authenticated;
revoke all on public.rwa_position_settlements from anon, authenticated;
revoke all on public.rwa_issuance_events from anon, authenticated;

-- Column-level reads: sensitive financial payloads and opaque document handles stay out.
grant select (
  id, deal_id, network, registry_contract, asset_id, issuance_identity, asset_code,
  asset_issuer, asset_decimals, principal_atomic, return_numerator, return_denominator,
  display_yield_bps, term_days, maturity_policy, scheduled_maturity_at, actual_due_at,
  snapshot_version, financial_snapshot_hash, state, issued_at, activated_at,
  superseded_at, created_at, updated_at
) on public.rwa_credit_assets to authenticated;

grant select (
  id, credit_asset_id, doc_kind, content_hash, hash_algorithm, canonicalization,
  byte_length, created_at
) on public.rwa_document_commitments to authenticated;

grant select (
  id, credit_asset_id, investor_profile_id, amount_atomic, asset_code, asset_decimals,
  state, created_at, updated_at
) on public.rwa_contribution_attempts to authenticated;

grant select (
  id, attempt_id, credit_asset_id, network, registry_contract, tx_hash,
  operation_or_event_id, ledger_seq, confirmed_amount_atomic, observed_at, created_at
) on public.rwa_contribution_receipts to authenticated;

grant select (
  id, credit_asset_id, investor_profile_id, investor_wallet, committed_principal_atomic,
  confirmed_principal_atomic, units_atomic, unit_decimals, state, reconciliation_state,
  created_at, updated_at
) on public.rwa_investor_positions to authenticated;

grant select (
  id, position_id, credit_asset_id, kind, amount_atomic, network, registry_contract,
  tx_hash, operation_or_event_id, ledger_seq, settled_at, reconciliation_state, created_at
) on public.rwa_position_settlements to authenticated;

grant select (
  id, credit_asset_id, event_type, actor_profile_id, occurred_at
) on public.rwa_issuance_events to authenticated;

-- Credit assets: deal parties and admins.
drop policy if exists rwa_credit_assets_select_party on public.rwa_credit_assets;
create policy rwa_credit_assets_select_party
  on public.rwa_credit_assets
  for select to authenticated
  using (public.rwa_is_admin() or public.rwa_is_deal_party(deal_id));

-- Documents: deal parties and admins (commitments only).
drop policy if exists rwa_document_commitments_select_party on public.rwa_document_commitments;
create policy rwa_document_commitments_select_party
  on public.rwa_document_commitments
  for select to authenticated
  using (public.rwa_is_admin() or public.rwa_is_asset_party(credit_asset_id));

-- Attempts: the investor's own rows, plus admins.
drop policy if exists rwa_contribution_attempts_select_own on public.rwa_contribution_attempts;
create policy rwa_contribution_attempts_select_own
  on public.rwa_contribution_attempts
  for select to authenticated
  using (public.rwa_is_admin() or investor_profile_id = auth.uid());

-- Receipts: the investor's own evidence, plus admins.
drop policy if exists rwa_contribution_receipts_select_own on public.rwa_contribution_receipts;
create policy rwa_contribution_receipts_select_own
  on public.rwa_contribution_receipts
  for select to authenticated
  using (
    public.rwa_is_admin()
    or exists (
      select 1
      from public.rwa_contribution_attempts at
      where at.id = attempt_id and at.investor_profile_id = auth.uid()
    )
  );

-- Positions: own private positions only, plus admins.
drop policy if exists rwa_investor_positions_select_own on public.rwa_investor_positions;
create policy rwa_investor_positions_select_own
  on public.rwa_investor_positions
  for select to authenticated
  using (public.rwa_is_admin() or investor_profile_id = auth.uid());

-- Settlements: own position settlements only, plus admins.
drop policy if exists rwa_position_settlements_select_own on public.rwa_position_settlements;
create policy rwa_position_settlements_select_own
  on public.rwa_position_settlements
  for select to authenticated
  using (
    public.rwa_is_admin()
    or exists (
      select 1
      from public.rwa_investor_positions p
      where p.id = position_id and p.investor_profile_id = auth.uid()
    )
  );

-- Issuance events: admins only.
drop policy if exists rwa_issuance_events_select_admin on public.rwa_issuance_events;
create policy rwa_issuance_events_select_admin
  on public.rwa_issuance_events
  for select to authenticated
  using (public.rwa_is_admin());

-- ---------------------------------------------------------------------------
-- Write RPCs (no direct table DML is granted to clients)
-- ---------------------------------------------------------------------------

create or replace function public.rwa_assert_backend_actor()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_claims text := nullif(current_setting('request.jwt.claims', true), '');
  v_role text;
begin
  v_role := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    case when v_claims is not null then (v_claims::jsonb) ->> 'role' end
  );

  if v_role is distinct from 'service_role' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.rwa_assert_backend_actor() from public, anon, authenticated;

-- Issue the canonical credit asset for a deal (admin only, audited).
create or replace function public.rwa_issue_credit_asset(
  p_deal_id uuid,
  p_network text,
  p_registry_contract text,
  p_asset_id text,
  p_asset_code text,
  p_asset_issuer text,
  p_asset_decimals smallint,
  p_principal_atomic bigint,
  p_return_numerator bigint,
  p_return_denominator bigint,
  p_display_yield_bps integer,
  p_term_days integer,
  p_fees jsonb,
  p_financial_snapshot jsonb,
  p_financial_snapshot_hash text,
  p_issuance_receipt_tx text,
  p_issuance_operation_id text,
  p_issuance_ledger_seq bigint,
  p_documents jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := assert_admin();
  v_deal public.deals%rowtype;
  v_pyme_verified boolean;
  v_supplier_verified boolean;
  v_asset_id uuid;
  v_doc jsonb;
begin
  select * into v_deal
  from public.deals
  where id = p_deal_id
  for update;

  if not found then
    raise exception 'deal_not_found' using errcode = 'P0002';
  end if;

  -- Approval rules: profile verification alone is not sufficient.
  if not v_deal.rwa_opted_in then
    raise exception 'rwa_not_opted_in' using errcode = '23514';
  end if;
  if v_deal.status = 'cancelled' then
    raise exception 'deal_cancelled' using errcode = '23514';
  end if;
  if v_deal.investor_id is not null or v_deal.funded_at is not null then
    raise exception 'deal_already_legacy_funded' using errcode = '23514';
  end if;
  if v_deal.supplier_id is null then
    raise exception 'supplier_required' using errcode = '23514';
  end if;
  if v_deal.escrow_contract_address is null then
    raise exception 'repayment_escrow_required' using errcode = '23514';
  end if;

  select p.verified into v_pyme_verified
  from public.profiles p
  where p.id = v_deal.pyme_id;
  if not coalesce(v_pyme_verified, false) then
    raise exception 'pyme_not_verified' using errcode = '23514';
  end if;

  select sc.verified into v_supplier_verified
  from public.supplier_companies sc
  where sc.id = v_deal.supplier_id;
  if not coalesce(v_supplier_verified, false) then
    raise exception 'supplier_not_verified' using errcode = '23514';
  end if;

  if p_principal_atomic is null or p_principal_atomic <= 0 then
    raise exception 'invalid_principal' using errcode = '23514';
  end if;
  if p_return_numerator is null or p_return_denominator is null
     or p_return_numerator <= 0 or p_return_denominator <= 0
     or p_return_numerator >= p_return_denominator then
    raise exception 'invalid_return_terms' using errcode = '23514';
  end if;
  if p_term_days is null or p_term_days < 1 then
    raise exception 'invalid_term' using errcode = '23514';
  end if;

  if p_financial_snapshot is null or jsonb_typeof(p_financial_snapshot) <> 'object' then
    raise exception 'invalid_snapshot' using errcode = '23514';
  end if;
  if (p_financial_snapshot ->> 'principal_atomic') is distinct from p_principal_atomic::text
     or (p_financial_snapshot ->> 'term_days') is distinct from p_term_days::text
     or (p_financial_snapshot ->> 'return_numerator') is distinct from p_return_numerator::text
     or (p_financial_snapshot ->> 'return_denominator') is distinct from p_return_denominator::text
     or (p_financial_snapshot ->> 'asset_code') is distinct from p_asset_code
     or (p_financial_snapshot ->> 'network') is distinct from p_network then
    raise exception 'snapshot_terms_mismatch' using errcode = '23514';
  end if;

  if p_financial_snapshot_hash is null or p_financial_snapshot_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_snapshot_hash' using errcode = '23514';
  end if;

  if p_documents is null or jsonb_typeof(p_documents) <> 'array'
     or jsonb_array_length(p_documents) < 1 then
    raise exception 'documents_required' using errcode = '23514';
  end if;

  insert into public.rwa_credit_assets (
    deal_id, network, registry_contract, asset_id, asset_code, asset_issuer,
    asset_decimals, principal_atomic, return_numerator, return_denominator,
    display_yield_bps, term_days, financial_snapshot, financial_snapshot_hash,
    fees, state, issuance_receipt_tx, issuance_operation_id, issuance_ledger_seq,
    issued_at
  ) values (
    p_deal_id, p_network, p_registry_contract, p_asset_id, p_asset_code, p_asset_issuer,
    p_asset_decimals, p_principal_atomic, p_return_numerator, p_return_denominator,
    p_display_yield_bps, p_term_days, p_financial_snapshot, p_financial_snapshot_hash,
    p_fees, 'issued', p_issuance_receipt_tx, p_issuance_operation_id, p_issuance_ledger_seq,
    now()
  )
  returning id into v_asset_id;

  for v_doc in select * from jsonb_array_elements(p_documents) loop
    if (v_doc ->> 'content_hash') is null
       or (v_doc ->> 'content_hash') !~ '^[0-9a-f]{64}$' then
      raise exception 'invalid_document_hash' using errcode = '23514';
    end if;

    insert into public.rwa_document_commitments (
      credit_asset_id, doc_kind, opaque_ref, content_hash, hash_algorithm,
      canonicalization, byte_length
    ) values (
      v_asset_id,
      coalesce(v_doc ->> 'kind', 'financing_agreement'),
      v_doc ->> 'opaque_ref',
      v_doc ->> 'content_hash',
      coalesce(v_doc ->> 'hash_algorithm', 'sha256'),
      coalesce(v_doc ->> 'canonicalization', 'JCS-RFC8785'),
      nullif(v_doc ->> 'byte_length', '')::bigint
    );
  end loop;

  insert into public.rwa_issuance_events (credit_asset_id, event_type, actor_profile_id, payload)
  values (
    v_asset_id,
    'issued',
    v_admin,
    jsonb_build_object(
      'snapshot_version', p_financial_snapshot ->> 'snapshot_version',
      'financial_snapshot_hash', p_financial_snapshot_hash,
      'issuance_receipt_tx', p_issuance_receipt_tx,
      'issuance_operation_id', p_issuance_operation_id
    )
  );

  insert into public.admin_audit_events
    (admin_user_id, action, entity_type, entity_id, after, reason)
  values (
    v_admin,
    'rwa_issue_credit_asset',
    'rwa_credit_asset',
    v_asset_id::text,
    jsonb_build_object(
      'deal_id', p_deal_id,
      'issuance_identity', p_network || ':' || p_registry_contract || ':' || p_asset_id,
      'principal_atomic', p_principal_atomic,
      'term_days', p_term_days,
      'financial_snapshot_hash', p_financial_snapshot_hash
    ),
    'RWA credit asset issued'
  );

  return v_asset_id;
end;
$$;

-- Start the repayment clock exactly once (delivery-relative maturity).
create or replace function public.rwa_activate_issuance(p_credit_asset_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := assert_admin();
  v_asset public.rwa_credit_assets%rowtype;
  v_delivered_at timestamptz;
  v_due_at timestamptz;
begin
  select * into v_asset
  from public.rwa_credit_assets
  where id = p_credit_asset_id
  for update;

  if not found then
    raise exception 'credit_asset_not_found' using errcode = 'P0002';
  end if;
  if v_asset.activated_at is not null then
    raise exception 'issuance_already_activated' using errcode = '23505';
  end if;
  if v_asset.state in ('cancelled', 'superseded', 'settled') then
    raise exception 'invalid_state' using errcode = '23514';
  end if;

  select d.delivered_at into v_delivered_at
  from public.deals d
  where d.id = v_asset.deal_id;

  if v_delivered_at is null then
    raise exception 'delivery_not_confirmed' using errcode = '23514';
  end if;

  v_due_at := v_delivered_at + make_interval(days => v_asset.term_days);

  -- Activation starts the repayment clock only. Funding state is tracked separately so a
  -- partially funded issuance can still activate at delivery.
  update public.rwa_credit_assets
  set activated_at = now(),
      actual_due_at = v_due_at
  where id = p_credit_asset_id;

  insert into public.rwa_issuance_events (credit_asset_id, event_type, actor_profile_id, payload)
  values (
    p_credit_asset_id,
    'activated',
    v_admin,
    jsonb_build_object(
      'delivered_at', v_delivered_at,
      'term_days', v_asset.term_days,
      'actual_due_at', v_due_at
    )
  );

  insert into public.admin_audit_events
    (admin_user_id, action, entity_type, entity_id, after, reason)
  values (
    v_admin,
    'rwa_activate_issuance',
    'rwa_credit_asset',
    p_credit_asset_id::text,
    jsonb_build_object('actual_due_at', v_due_at, 'delivered_at', v_delivered_at),
    'RWA repayment clock started'
  );

  return v_due_at;
end;
$$;

-- Confirm a contribution from verified on-chain evidence (backend/service role only).
create or replace function public.rwa_confirm_contribution(
  p_attempt_id uuid,
  p_network text,
  p_registry_contract text,
  p_tx_hash text,
  p_operation_or_event_id text,
  p_ledger_seq bigint,
  p_confirmed_amount_atomic bigint,
  p_observed_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.rwa_contribution_attempts%rowtype;
  v_asset public.rwa_credit_assets%rowtype;
  v_units bigint;
  v_confirmed_total bigint;
  v_position_id uuid;
  v_next_state text;
begin
  perform public.rwa_assert_backend_actor();

  select * into v_attempt
  from public.rwa_contribution_attempts
  where id = p_attempt_id
  for update;

  if not found then
    raise exception 'attempt_not_found' using errcode = 'P0002';
  end if;
  if v_attempt.state not in ('pending', 'submitted') then
    raise exception 'invalid_attempt_state' using errcode = '23514';
  end if;
  if p_confirmed_amount_atomic is null
     or p_confirmed_amount_atomic <= 0
     or p_confirmed_amount_atomic > v_attempt.amount_atomic then
    raise exception 'invalid_amount' using errcode = '23514';
  end if;

  select * into v_asset
  from public.rwa_credit_assets
  where id = v_attempt.credit_asset_id
  for update;

  if not found then
    raise exception 'credit_asset_not_found' using errcode = 'P0002';
  end if;
  if v_asset.state not in ('issued', 'active', 'partially_funded') then
    raise exception 'issuance_not_accepting_contributions' using errcode = '23514';
  end if;

  insert into public.rwa_contribution_receipts (
    attempt_id, credit_asset_id, network, registry_contract, tx_hash,
    operation_or_event_id, ledger_seq, confirmed_amount_atomic, observed_at
  ) values (
    p_attempt_id, v_asset.id, p_network, p_registry_contract, p_tx_hash,
    p_operation_or_event_id, p_ledger_seq, p_confirmed_amount_atomic, p_observed_at
  );

  update public.rwa_contribution_attempts
  set state = 'confirmed', updated_at = now()
  where id = p_attempt_id;

  -- Units are exact integer principal at the position scale (unit_decimals = 0 keeps a
  -- 1:1 mapping to atomic principal, so no precision or rounding is invented here).
  -- Entitlement = units_atomic / (principal_atomic * 10^unit_decimals); display bps never apply.
  v_units := p_confirmed_amount_atomic;

  insert into public.rwa_investor_positions (
    credit_asset_id, investor_profile_id, investor_wallet,
    committed_principal_atomic, confirmed_principal_atomic, units_atomic, unit_decimals, state
  ) values (
    v_asset.id, v_attempt.investor_profile_id, v_attempt.investor_wallet,
    p_confirmed_amount_atomic, p_confirmed_amount_atomic, v_units, 0, 'active'
  )
  on conflict (credit_asset_id, investor_profile_id) do update
  set committed_principal_atomic =
        public.rwa_investor_positions.committed_principal_atomic
        + excluded.confirmed_principal_atomic,
      confirmed_principal_atomic =
        public.rwa_investor_positions.confirmed_principal_atomic
        + excluded.confirmed_principal_atomic,
      units_atomic = public.rwa_investor_positions.units_atomic + excluded.units_atomic
  returning id into v_position_id;

  select coalesce(sum(p.confirmed_principal_atomic), 0) into v_confirmed_total
  from public.rwa_investor_positions p
  where p.credit_asset_id = v_asset.id;

  v_next_state := case
    when v_confirmed_total >= v_asset.principal_atomic then 'fully_funded'
    else 'partially_funded'
  end;

  update public.rwa_credit_assets
  set state = v_next_state
  where id = v_asset.id;

  return v_position_id;
end;
$$;

-- Record a position-level settlement (backend/service role only).
create or replace function public.rwa_record_position_settlement(
  p_position_id uuid,
  p_kind text,
  p_amount_atomic bigint,
  p_network text,
  p_registry_contract text,
  p_tx_hash text,
  p_operation_or_event_id text,
  p_ledger_seq bigint,
  p_settled_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_position public.rwa_investor_positions%rowtype;
  v_id uuid;
begin
  perform public.rwa_assert_backend_actor();

  select * into v_position
  from public.rwa_investor_positions
  where id = p_position_id
  for update;

  if not found then
    raise exception 'position_not_found' using errcode = 'P0002';
  end if;
  if p_amount_atomic is null or p_amount_atomic <= 0 then
    raise exception 'invalid_amount' using errcode = '23514';
  end if;

  insert into public.rwa_position_settlements (
    position_id, credit_asset_id, kind, amount_atomic, network, registry_contract,
    tx_hash, operation_or_event_id, ledger_seq, settled_at
  ) values (
    p_position_id, v_position.credit_asset_id, p_kind, p_amount_atomic, p_network,
    p_registry_contract, p_tx_hash, p_operation_or_event_id, p_ledger_seq, p_settled_at
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Read RPCs
-- ---------------------------------------------------------------------------

-- Full issuance detail for the platform operator. Column grants deliberately keep
-- `financial_snapshot`, `fees` and document `opaque_ref` away from every authenticated client,
-- so admins read them through this explicitly gated RPC instead.
create or replace function public.admin_get_rwa_issuance(p_credit_asset_id uuid)
returns table (
  credit_asset_id uuid,
  deal_id uuid,
  network text,
  registry_contract text,
  asset_id text,
  issuance_identity text,
  asset_code text,
  asset_issuer text,
  asset_decimals smallint,
  principal_atomic bigint,
  return_numerator bigint,
  return_denominator bigint,
  display_yield_bps integer,
  term_days integer,
  maturity_policy text,
  scheduled_maturity_at timestamptz,
  actual_due_at timestamptz,
  financial_snapshot jsonb,
  financial_snapshot_hash text,
  fees jsonb,
  state text,
  issued_at timestamptz,
  activated_at timestamptz,
  documents jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_documents jsonb;
begin
  perform public.assert_admin();

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'kind', d.doc_kind,
        'opaque_ref', d.opaque_ref,
        'content_hash', d.content_hash,
        'byte_length', d.byte_length,
        'canonicalization', d.canonicalization
      )
      order by d.created_at
    ),
    '[]'::jsonb
  )
  into v_documents
  from public.rwa_document_commitments d
  where d.credit_asset_id = p_credit_asset_id;

  return query
  select
    a.id, a.deal_id, a.network, a.registry_contract, a.asset_id, a.issuance_identity,
    a.asset_code, a.asset_issuer, a.asset_decimals, a.principal_atomic,
    a.return_numerator, a.return_denominator, a.display_yield_bps, a.term_days,
    a.maturity_policy, a.scheduled_maturity_at, a.actual_due_at,
    a.financial_snapshot, a.financial_snapshot_hash, a.fees, a.state,
    a.issued_at, a.activated_at, v_documents
  from public.rwa_credit_assets a
  where a.id = p_credit_asset_id;
end;
$$;

-- The caller's own positions with their settlement totals.
create or replace function public.rwa_get_my_positions()
returns table (
  position_id uuid,
  credit_asset_id uuid,
  deal_id uuid,
  asset_code text,
  asset_decimals smallint,
  principal_atomic bigint,
  confirmed_principal_atomic bigint,
  units_atomic bigint,
  unit_decimals smallint,
  position_state text,
  reconciliation_state text,
  settled_atomic bigint,
  actual_due_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.credit_asset_id,
    a.deal_id,
    a.asset_code,
    a.asset_decimals,
    a.principal_atomic,
    p.confirmed_principal_atomic,
    p.units_atomic,
    p.unit_decimals,
    p.state,
    p.reconciliation_state,
    coalesce((
      select sum(s.amount_atomic)
      from public.rwa_position_settlements s
      where s.position_id = p.id
    ), 0)::bigint,
    a.actual_due_at
  from public.rwa_investor_positions p
  join public.rwa_credit_assets a on a.id = p.credit_asset_id
  where p.investor_profile_id = auth.uid()
  order by p.created_at desc;
$$;

-- Sanitized aggregate for the marketplace and deal page. No wallets, no hashes, no per-position rows.
create or replace function public.get_rwa_deal_summary(p_deal_id uuid)
returns table (
  deal_id uuid,
  network text,
  asset_code text,
  asset_decimals smallint,
  issuance_state text,
  principal_atomic bigint,
  confirmed_principal_atomic bigint,
  units_outstanding_atomic bigint,
  investor_count integer,
  term_days integer,
  maturity_policy text,
  scheduled_maturity_at timestamptz,
  actual_due_at timestamptz,
  viewer_scope text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_scope text;
begin
  v_scope := case
    when public.rwa_is_admin() then 'admin'
    when public.rwa_is_deal_party(p_deal_id) then 'party'
    else 'public'
  end;

  return query
  select
    a.deal_id,
    a.network,
    a.asset_code,
    a.asset_decimals,
    a.state,
    a.principal_atomic,
    coalesce(sum(p.confirmed_principal_atomic), 0)::bigint,
    coalesce(sum(p.units_atomic), 0)::bigint,
    count(distinct p.investor_profile_id)::integer,
    a.term_days,
    a.maturity_policy,
    a.scheduled_maturity_at,
    a.actual_due_at,
    v_scope
  from public.rwa_credit_assets a
  left join public.rwa_investor_positions p
    on p.credit_asset_id = a.id and p.state = 'active'
  where a.deal_id = p_deal_id
    and a.superseded_at is null
  group by a.id;
end;
$$;

revoke execute on function public.rwa_issue_credit_asset(
  uuid, text, text, text, text, text, smallint, bigint, bigint, bigint, integer, integer,
  jsonb, jsonb, text, text, text, bigint, jsonb
) from public, anon;
grant execute on function public.rwa_issue_credit_asset(
  uuid, text, text, text, text, text, smallint, bigint, bigint, bigint, integer, integer,
  jsonb, jsonb, text, text, text, bigint, jsonb
) to authenticated;

revoke execute on function public.rwa_activate_issuance(uuid) from public, anon;
grant execute on function public.rwa_activate_issuance(uuid) to authenticated;

revoke execute on function public.rwa_confirm_contribution(
  uuid, text, text, text, text, bigint, bigint, timestamptz
) from public, anon, authenticated;
grant execute on function public.rwa_confirm_contribution(
  uuid, text, text, text, text, bigint, bigint, timestamptz
) to service_role;

revoke execute on function public.rwa_record_position_settlement(
  uuid, text, bigint, text, text, text, text, bigint, timestamptz
) from public, anon, authenticated;
grant execute on function public.rwa_record_position_settlement(
  uuid, text, bigint, text, text, text, text, bigint, timestamptz
) to service_role;

revoke execute on function public.rwa_get_my_positions() from public, anon;
grant execute on function public.rwa_get_my_positions() to authenticated;

revoke execute on function public.admin_get_rwa_issuance(uuid) from public, anon;
grant execute on function public.admin_get_rwa_issuance(uuid) to authenticated;

revoke execute on function public.get_rwa_deal_summary(uuid) from public;
grant execute on function public.get_rwa_deal_summary(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Deal-term guard extension (RWA issuance / first accepted contribution)
-- ---------------------------------------------------------------------------

-- Same additive checks as 20260712000400_deals_lock_terms_after_funding.sql, plus:
--   * terms freeze once an RWA issuance exists or a contribution is accepted (even partially funded);
--   * RWA deals can never be reopened (status back to seeking_funding) or have their funding window extended;
--   * RWA opt-in is one-way once evidence exists.
create or replace function public.enforce_deal_terms_edit_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  was_funded boolean;
  terms_changed boolean;
  rwa_locked boolean;
  is_admin boolean := false;
begin
  terms_changed :=
    (new.title is distinct from old.title)
    or (new.description is distinct from old.description)
    or (new.product_name is distinct from old.product_name)
    or (new.product_quantity is distinct from old.product_quantity)
    or (new.product_unit_price is distinct from old.product_unit_price)
    or (new.amount is distinct from old.amount)
    or (new.term_days is distinct from old.term_days)
    or (new.interest_rate is distinct from old.interest_rate)
    or (new.yield_bonus_apr is distinct from old.yield_bonus_apr)
    or (new.category is distinct from old.category)
    or (new.supplier_id is distinct from old.supplier_id)
    or (new.supplier_name is distinct from old.supplier_name)
    or (new.supplier_email is distinct from old.supplier_email)
    or (new.supplier_contact is distinct from old.supplier_contact)
    or (new.platform_fee is distinct from old.platform_fee)
    or (new.funding_window_days is distinct from old.funding_window_days)
    or (new.funding_expires_at is distinct from old.funding_expires_at)
    or (new.pyme_id is distinct from old.pyme_id);

  rwa_locked :=
    exists (
      select 1 from public.rwa_credit_assets a
      where a.deal_id = old.id and a.superseded_at is null
    )
    or exists (
      select 1
      from public.rwa_investor_positions p
      join public.rwa_credit_assets a on a.id = p.credit_asset_id
      where a.deal_id = old.id and p.confirmed_principal_atomic > 0
    )
    or exists (
      select 1
      from public.rwa_contribution_attempts at
      join public.rwa_credit_assets a on a.id = at.credit_asset_id
      where a.deal_id = old.id and at.state in ('pending', 'submitted', 'confirmed')
    );

  if old.rwa_opted_in and not new.rwa_opted_in then
    if exists (
      select 1 from public.rwa_credit_assets a where a.deal_id = old.id
    ) or exists (
      select 1
      from public.rwa_contribution_attempts at
      join public.rwa_credit_assets a on a.id = at.credit_asset_id
      where a.deal_id = old.id
    ) then
      raise exception 'RWA opt-in cannot be disabled once issuance or contributions exist'
        using errcode = '23514';
    end if;
  end if;

  if not old.rwa_opted_in and new.rwa_opted_in then
    select exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.user_type = 'admin'
    ) into is_admin;

    if not is_admin and auth.uid() is distinct from old.pyme_id then
      raise exception 'Only the deal creator or an admin can opt a deal in to RWA'
        using errcode = '42501';
    end if;

    if old.investor_id is not null or old.funded_at is not null then
      raise exception 'RWA opt-in must happen before any funding' using errcode = '23514';
    end if;
    if old.status is distinct from 'seeking_funding' then
      raise exception 'RWA opt-in is only allowed while seeking funding' using errcode = '23514';
    end if;
  end if;

  if rwa_locked and new.status = 'seeking_funding' and old.status is distinct from 'seeking_funding' then
    raise exception 'RWA deals cannot be reopened' using errcode = '23514';
  end if;

  if rwa_locked and new.funding_expires_at is distinct from old.funding_expires_at then
    raise exception 'RWA deals cannot have their funding window extended' using errcode = '23514';
  end if;

  if rwa_locked and terms_changed then
    raise exception 'Deal terms are frozen once an RWA issuance or contribution exists'
      using errcode = '23514';
  end if;

  if not terms_changed then
    return new;
  end if;

  was_funded :=
    old.investor_id is not null
    or old.funded_at is not null
    or old.status is distinct from 'seeking_funding';

  if was_funded then
    raise exception 'Deal terms cannot be edited after an investor has funded the deal';
  end if;

  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.user_type = 'admin'
  ) into is_admin;

  if is_admin or auth.uid() = old.pyme_id then
    return new;
  end if;

  raise exception 'Only the deal creator or an admin can edit deal terms';
end;
$$;

drop trigger if exists deals_lock_terms_after_funding on public.deals;
drop trigger if exists deals_enforce_terms_edit_rules on public.deals;
drop function if exists public.enforce_deal_terms_immutable_after_funding();

create trigger deals_enforce_terms_edit_rules
  before update on public.deals
  for each row
  execute function public.enforce_deal_terms_edit_rules();

-- Delete eligibility: RWA evidence and positions must survive the commercial deal.
create or replace function public.enforce_rwa_deal_delete_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.rwa_credit_assets a where a.deal_id = old.id
  ) or exists (
    select 1
    from public.rwa_investor_positions p
    join public.rwa_credit_assets a on a.id = p.credit_asset_id
    where a.deal_id = old.id
  ) or exists (
    select 1
    from public.rwa_contribution_attempts at
    join public.rwa_credit_assets a on a.id = at.credit_asset_id
    where a.deal_id = old.id
  ) then
    raise exception 'Deals with RWA issuance, positions or contributions cannot be deleted'
      using errcode = '23514';
  end if;

  return old;
end;
$$;

drop trigger if exists deals_rwa_delete_guard on public.deals;
create trigger deals_rwa_delete_guard
  before delete on public.deals
  for each row
  execute function public.enforce_rwa_deal_delete_rules();
