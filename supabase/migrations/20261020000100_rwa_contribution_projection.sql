-- RWA investor contribution projection.
--
-- The Soroban funding pool (contracts/credit-funding) owns capacity, transfers
-- and on-chain position registration. This schema stores the *verified
-- projection* of that on-chain state, plus the server-authorised operations
-- that maintain it.
--
-- Design rules enforced here:
--   * A confirmed contribution is projected from a verified receipt, never from
--     a browser-supplied claim. The browser can only ever ask the server to
--     reconcile.
--   * A receipt is identified by (network, tx_hash, event_index) and is unique
--     across every asset, so one receipt can never be counted twice or be
--     attributed to two assets.
--   * Every financial write goes through a SECURITY DEFINER operation that
--     re-checks the reserved intent. The `deals` broad update policies are
--     closed for RWA-mode deals so a browser cannot bypass these invariants.
--   * Expiring a reservation releases *capacity* only. It never invalidates a
--     contribution that already succeeded on chain: confirming an expired
--     attempt is still allowed.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.rwa_assets (
  id uuid primary key default gen_random_uuid(),
  -- Registry asset id (32-byte hex) as published by contracts/credit-registry.
  asset_id text not null,
  network text not null check (network in ('testnet', 'mainnet')),
  registry_contract_id text not null,
  funding_pool_contract_id text not null,
  token_contract_id text not null,
  token_decimals integer not null check (token_decimals between 0 and 18),
  target_principal_units bigint not null check (target_principal_units > 0),
  supplier_address text not null,
  fee_recipient_address text not null,
  excess_recipient_address text not null,
  funding_fee_bps integer not null check (funding_fee_bps >= 0 and funding_fee_bps < 10000),
  fee_policy_version integer not null check (fee_policy_version > 0),
  deadline_at timestamptz not null,
  -- open -> ready_to_settle (target reached) -> settled (supplier paid).
  -- Cancelled is terminal after the funding deadline.
  lifecycle text not null default 'open'
    check (lifecycle in ('open', 'ready_to_settle', 'settled', 'cancelled')),
  funded_principal_units bigint not null default 0 check (funded_principal_units >= 0),
  funding_fee_units bigint not null default 0 check (funding_fee_units >= 0),
  position_count integer not null default 0 check (position_count >= 0),
  target_reached_at timestamptz,
  supplier_paid_at timestamptz,
  deal_id uuid references public.deals(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint rwa_assets_network_asset_unique unique (network, asset_id),
  constraint rwa_assets_pool_unique unique (network, funding_pool_contract_id)
);

create index if not exists idx_rwa_assets_deal_id on public.rwa_assets(deal_id);

-- Contribution attempts. A row here is an *intent* until a verified receipt
-- promotes it to 'confirmed'. Prepared / submitted / unknown attempts never
-- count as funded principal.
create table if not exists public.rwa_contributions (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null unique,
  -- Reusing an idempotency key for the same investor returns the same attempt.
  idempotency_key text not null,
  asset_row_id uuid not null references public.rwa_assets(id) on delete cascade,
  network text not null,
  asset_id text not null,
  funding_pool_contract_id text not null,
  investor_id uuid not null references public.profiles(id) on delete cascade,
  investor_address text not null,
  principal_units bigint not null check (principal_units > 0),
  -- Per-investor, per-asset, strictly increasing. The contract rejects a
  -- nonce that is not greater than the position's last nonce.
  nonce bigint not null check (nonce > 0),
  -- 32-byte hex contribution reference echoed by the contract event.
  contribution_ref text not null,
  status text not null default 'prepared'
    check (status in ('prepared', 'submitted', 'confirmed', 'failed', 'expired')),
  tx_hash text,
  receipt_id text,
  ledger integer,
  reservation_expires_at timestamptz,
  confirmed_at timestamptz,
  failure_code text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint rwa_contributions_investor_idempotency_unique unique (investor_id, idempotency_key),
  constraint rwa_contributions_ref_unique unique (network, funding_pool_contract_id, contribution_ref)
);

create index if not exists idx_rwa_contributions_attempt on public.rwa_contributions(attempt_id);
create index if not exists idx_rwa_contributions_asset_investor
  on public.rwa_contributions(asset_row_id, investor_id);
create index if not exists idx_rwa_contributions_status on public.rwa_contributions(status);

-- Confirmed positions. One row per (asset, investor), mirroring the contract's
-- PositionForInvestor index.
create table if not exists public.rwa_positions (
  id uuid primary key default gen_random_uuid(),
  asset_row_id uuid not null references public.rwa_assets(id) on delete cascade,
  network text not null,
  asset_id text not null,
  position_id integer not null check (position_id >= 0),
  investor_id uuid not null references public.profiles(id) on delete cascade,
  investor_address text not null,
  principal_units bigint not null check (principal_units >= 0),
  ownership_units bigint not null check (ownership_units >= 0),
  funding_fee_units bigint not null check (funding_fee_units >= 0),
  contribution_count integer not null default 0 check (contribution_count >= 0),
  last_nonce bigint not null default 0,
  last_contribution_ref text not null,
  status text not null default 'open' check (status in ('open', 'settled', 'refunded')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint rwa_positions_position_id_unique unique (network, asset_id, position_id),
  constraint rwa_positions_investor_unique unique (network, asset_id, investor_id)
);

create index if not exists idx_rwa_positions_investor on public.rwa_positions(investor_id);

-- Receipt ledger. The unique constraint is deliberately *not* scoped by asset:
-- a receipt may be attributed to exactly one asset across the whole platform.
create table if not exists public.rwa_receipts (
  id uuid primary key default gen_random_uuid(),
  network text not null,
  tx_hash text not null,
  event_index integer not null check (event_index >= 0),
  receipt_id text not null,
  funding_pool_contract_id text not null,
  asset_row_id uuid not null references public.rwa_assets(id) on delete cascade,
  asset_id text not null,
  investor_id uuid not null references public.profiles(id) on delete cascade,
  investor_address text not null,
  principal_units bigint not null check (principal_units > 0),
  funding_fee_units bigint not null check (funding_fee_units >= 0),
  ownership_units bigint not null check (ownership_units >= 0),
  nonce bigint not null check (nonce > 0),
  contribution_ref text not null,
  position_id integer not null,
  ledger integer,
  created_at timestamptz default now(),
  constraint rwa_receipts_identity_unique unique (network, tx_hash, event_index),
  constraint rwa_receipts_receipt_id_unique unique (network, receipt_id)
);

create index if not exists idx_rwa_receipts_attempt_ref on public.rwa_receipts(contribution_ref);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.rwa_assets enable row level security;
alter table public.rwa_contributions enable row level security;
alter table public.rwa_positions enable row level security;
alter table public.rwa_receipts enable row level security;

-- Public read of pool terms/state, no browser writes.
drop policy if exists "rwa_assets_select_public" on public.rwa_assets;
create policy "rwa_assets_select_public" on public.rwa_assets
  for select using (true);

-- Investors may read their own attempts and positions. Everything else is
-- written exclusively through the SECURITY DEFINER operations below.
drop policy if exists "rwa_contributions_select_own" on public.rwa_contributions;
create policy "rwa_contributions_select_own" on public.rwa_contributions
  for select using (auth.uid() = investor_id);

drop policy if exists "rwa_positions_select_own" on public.rwa_positions;
create policy "rwa_positions_select_own" on public.rwa_positions
  for select using (auth.uid() = investor_id);

drop policy if exists "rwa_receipts_select_own" on public.rwa_receipts;
create policy "rwa_receipts_select_own" on public.rwa_receipts
  for select using (auth.uid() = investor_id);

-- ---------------------------------------------------------------------------
-- Deal mode: legacy direct funding vs. RWA pool funding
-- ---------------------------------------------------------------------------

alter table public.deals
  add column if not exists funding_mode text not null default 'legacy'
    check (funding_mode in ('legacy', 'rwa')),
  add column if not exists rwa_asset_row_id uuid references public.rwa_assets(id) on delete set null;

create index if not exists idx_deals_rwa_asset_row_id on public.deals(rwa_asset_row_id);

-- The browser must not be able to write the funding columns of an RWA-mode
-- deal. Only the protected RWA operations (service role) may do so.
create or replace function public.enforce_rwa_funding_authority()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_service_role boolean :=
    coalesce(auth.jwt() ->> 'role', '') = 'service_role';
  funding_changed boolean;
begin
  -- Both sides are checked on purpose. Looking only at `new` would let a
  -- browser flip the deal out of RWA mode and set the funding columns in the
  -- same statement, which would slip past the guard below.
  if old.funding_mode is distinct from 'rwa' and new.funding_mode is distinct from 'rwa' then
    return new;
  end if;

  -- The mode itself is server-owned: a deal issued into the RWA path stays
  -- there, and only the platform server can issue it in the first place.
  if new.funding_mode is distinct from old.funding_mode and not is_service_role then
    raise exception 'RWA funding mode is server-authorised'
      using errcode = '42501';
  end if;

  funding_changed :=
    (new.investor_id is distinct from old.investor_id)
    or (new.status is distinct from old.status)
    or (new.funded_at is distinct from old.funded_at)
    or (new.funding_tx_hash is distinct from old.funding_tx_hash)
    or (new.rwa_asset_row_id is distinct from old.rwa_asset_row_id);

  if not funding_changed then
    return new;
  end if;

  if is_service_role then
    return new;
  end if;

  raise exception 'RWA funding columns are server-authorised'
    using errcode = '42501';
end;
$$;

drop trigger if exists deals_enforce_rwa_funding_authority on public.deals;
create trigger deals_enforce_rwa_funding_authority
  before update on public.deals
  for each row
  execute function public.enforce_rwa_funding_authority();

-- RWA-mode deals have frozen financial terms: the pool was created from terms
-- that are already frozen on chain, so the deal cannot drift from them.
create or replace function public.enforce_rwa_terms_locked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Both sides are checked, so a deal cannot be flipped out of RWA mode in
  -- the same statement that changes its terms.
  if old.funding_mode is distinct from 'rwa' and new.funding_mode is distinct from 'rwa' then
    return new;
  end if;

  if coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
    return new;
  end if;

  if (
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
    or (new.platform_fee is distinct from old.platform_fee)
    or (new.funding_window_days is distinct from old.funding_window_days)
    or (new.funding_expires_at is distinct from old.funding_expires_at)
  ) then
    raise exception 'RWA deal terms are locked'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists deals_enforce_rwa_terms_locked on public.deals;
create trigger deals_enforce_rwa_terms_locked
  before update on public.deals
  for each row
  execute function public.enforce_rwa_terms_locked();

-- ---------------------------------------------------------------------------
-- Protected operations
-- ---------------------------------------------------------------------------

-- Only the platform server (service role) or an admin may run the RWA
-- financial operations. A browser session is never sufficient.
create or replace function public.assert_rwa_writer()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
    return;
  end if;

  if auth.uid() is not null and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.user_type = 'admin'
  ) then
    return;
  end if;

  raise exception 'forbidden' using errcode = '42501';
end;
$$;

revoke execute on function public.assert_rwa_writer() from anon, authenticated;

-- Reserve capacity and create the contribution intent.
--
-- The nonce is allocated here (never by the client) and is strictly increasing
-- per (asset, investor). Capacity accounts for live reservations so two
-- investors cannot both reserve the last unit of the target.
create or replace function public.rwa_reserve_contribution(
  p_attempt_id uuid,
  p_idempotency_key text,
  p_asset_row_id uuid,
  p_investor_id uuid,
  p_investor_address text,
  p_principal_units bigint,
  p_reservation_seconds integer default 900
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asset public.rwa_assets%rowtype;
  v_attempt public.rwa_contributions%rowtype;
  v_reserved bigint;
  v_available bigint;
  v_nonce bigint;
  v_ref text;
  v_expires_at timestamptz;
begin
  perform public.assert_rwa_writer();

  if p_principal_units is null or p_principal_units <= 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception 'invalid_idempotency_key' using errcode = '22023';
  end if;

  -- Idempotent replay: the same key returns the same attempt, unchanged.
  select * into v_attempt
  from public.rwa_contributions
  where investor_id = p_investor_id and idempotency_key = p_idempotency_key;

  if found then
    return jsonb_build_object(
      'attempt_id', v_attempt.attempt_id,
      'status', v_attempt.status,
      'nonce', v_attempt.nonce,
      'contribution_ref', v_attempt.contribution_ref,
      'principal_units', v_attempt.principal_units,
      'asset_id', v_attempt.asset_id,
      'network', v_attempt.network,
      'funding_pool_contract_id', v_attempt.funding_pool_contract_id,
      'investor_address', v_attempt.investor_address,
      'reservation_expires_at', v_attempt.reservation_expires_at,
      'replayed', true
    );
  end if;

  -- Lock the asset row: serialises reservation and nonce allocation per asset.
  select * into v_asset
  from public.rwa_assets
  where id = p_asset_row_id
  for update;

  if not found then
    raise exception 'asset_not_found' using errcode = 'P0002';
  end if;

  if v_asset.lifecycle <> 'open' then
    raise exception 'asset_not_open' using errcode = '22023';
  end if;

  if v_asset.deadline_at <= now() then
    raise exception 'funding_expired' using errcode = '22023';
  end if;

  -- Capacity that is funded, or held by a live reservation, is not available.
  -- Expired reservations release their capacity but keep their attempt row so
  -- an already-successful on-chain contribution can still be confirmed.
  select coalesce(sum(c.principal_units), 0) into v_reserved
  from public.rwa_contributions c
  where c.asset_row_id = p_asset_row_id
    and c.status in ('prepared', 'submitted')
    and (c.reservation_expires_at is null or c.reservation_expires_at > now());

  v_available := v_asset.target_principal_units - v_asset.funded_principal_units - v_reserved;

  if p_principal_units > v_available then
    raise exception 'insufficient_capacity:%', v_available using errcode = '22023';
  end if;

  -- Strictly increasing nonce per (asset, investor).
  select greatest(
    coalesce((select max(p.last_nonce) from public.rwa_positions p
      where p.asset_row_id = p_asset_row_id and p.investor_id = p_investor_id), 0),
    coalesce((select max(c.nonce) from public.rwa_contributions c
      where c.asset_row_id = p_asset_row_id and c.investor_id = p_investor_id), 0)
  ) + 1 into v_nonce;

  v_ref := encode(sha256(convert_to(p_idempotency_key || ':' || p_attempt_id::text, 'UTF8')), 'hex');
  v_expires_at := now() + make_interval(secs => greatest(coalesce(p_reservation_seconds, 900), 60));

  insert into public.rwa_contributions (
    attempt_id, idempotency_key, asset_row_id, network, asset_id,
    funding_pool_contract_id, investor_id, investor_address, principal_units,
    nonce, contribution_ref, status, reservation_expires_at
  ) values (
    p_attempt_id, p_idempotency_key, p_asset_row_id, v_asset.network, v_asset.asset_id,
    v_asset.funding_pool_contract_id, p_investor_id, p_investor_address, p_principal_units,
    v_nonce, v_ref, 'prepared', v_expires_at
  )
  returning * into v_attempt;

  return jsonb_build_object(
    'attempt_id', v_attempt.attempt_id,
    'status', v_attempt.status,
    'nonce', v_attempt.nonce,
    'contribution_ref', v_attempt.contribution_ref,
    'principal_units', v_attempt.principal_units,
    'asset_id', v_attempt.asset_id,
    'network', v_attempt.network,
    'funding_pool_contract_id', v_attempt.funding_pool_contract_id,
    'investor_address', v_attempt.investor_address,
    'reservation_expires_at', v_attempt.reservation_expires_at,
    'replayed', false
  );
end;
$$;

revoke execute on function public.rwa_reserve_contribution(uuid, text, uuid, uuid, text, bigint, integer) from anon, authenticated;

-- Record that the browser submitted the transaction. The hash is recorded but
-- nothing is treated as confirmed: only a verified receipt confirms.
create or replace function public.rwa_record_submission(
  p_attempt_id uuid,
  p_tx_hash text,
  p_ledger integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.rwa_contributions%rowtype;
begin
  perform public.assert_rwa_writer();

  select * into v_attempt
  from public.rwa_contributions
  where attempt_id = p_attempt_id
  for update;

  if not found then
    raise exception 'attempt_not_found' using errcode = 'P0002';
  end if;

  if v_attempt.status = 'confirmed' then
    return jsonb_build_object('attempt_id', v_attempt.attempt_id, 'status', v_attempt.status);
  end if;

  update public.rwa_contributions
  set status = 'submitted',
      tx_hash = coalesce(p_tx_hash, tx_hash),
      ledger = coalesce(p_ledger, ledger),
      updated_at = now()
  where id = v_attempt.id;

  return jsonb_build_object('attempt_id', v_attempt.attempt_id, 'status', 'submitted');
end;
$$;

revoke execute on function public.rwa_record_submission(uuid, text, integer) from anon, authenticated;

-- Project a verified contribution into the database, atomically.
--
-- The attempt row is the reserved intent; every observed value must match it
-- exactly. The receipt is unique platform-wide, so a duplicate confirmation
-- replays into the same projection instead of double counting.
create or replace function public.rwa_confirm_contribution(
  p_attempt_id uuid,
  p_tx_hash text,
  p_receipt_id text,
  p_event_index integer,
  p_ledger integer default null,
  p_observed_investor_address text,
  p_observed_principal_units bigint,
  p_observed_funding_fee_units bigint,
  p_observed_ownership_units bigint,
  p_observed_nonce bigint,
  p_observed_contribution_ref text,
  p_observed_position_id integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.rwa_contributions%rowtype;
  v_asset public.rwa_assets%rowtype;
  v_receipt public.rwa_receipts%rowtype;
  v_position public.rwa_positions%rowtype;
  v_position_exists boolean := false;
  v_replayed boolean := false;
  v_target_reached boolean := false;
begin
  perform public.assert_rwa_writer();

  if p_tx_hash is null or p_receipt_id is null or p_event_index is null then
    raise exception 'invalid_receipt' using errcode = '22023';
  end if;

  select * into v_attempt
  from public.rwa_contributions
  where attempt_id = p_attempt_id
  for update;

  if not found then
    raise exception 'attempt_not_found' using errcode = 'P0002';
  end if;

  -- The observed receipt must match the reserved intent exactly. A mismatch is
  -- a rejected contribution, not a partial one.
  if v_attempt.investor_address <> p_observed_investor_address
     or v_attempt.principal_units <> p_observed_principal_units
     or v_attempt.nonce <> p_observed_nonce
     or v_attempt.contribution_ref <> p_observed_contribution_ref then
    raise exception 'receipt_mismatch' using errcode = '22023';
  end if;

  -- Already projected: replay the same result.
  if v_attempt.status = 'confirmed' then
    select * into v_receipt from public.rwa_receipts where id = (
      select r.id from public.rwa_receipts r
      where r.network = v_attempt.network
        and r.tx_hash = p_tx_hash
        and r.event_index = p_event_index
    );
    select * into v_position
    from public.rwa_positions
    where network = v_attempt.network
      and asset_id = v_attempt.asset_id
      and investor_id = v_attempt.investor_id;

    return jsonb_build_object(
      'replayed', true,
      'receipt_id', v_attempt.receipt_id,
      'position_id', v_position.position_id,
      'principal_units', v_position.principal_units,
      'ownership_units', v_position.ownership_units,
      'funding_fee_units', v_position.funding_fee_units,
      'contribution_count', v_position.contribution_count
    );
  end if;

  -- The receipt is unique platform-wide: it may never be attributed to a
  -- second asset, a second investor or a second contribution.
  select * into v_receipt
  from public.rwa_receipts
  where network = v_attempt.network
    and tx_hash = p_tx_hash
    and event_index = p_event_index;

  if found then
    if v_receipt.asset_row_id <> v_attempt.asset_row_id
       or v_receipt.investor_id <> v_attempt.investor_id
       or v_receipt.principal_units <> v_attempt.principal_units
       or v_receipt.nonce <> v_attempt.nonce
       or v_receipt.contribution_ref <> v_attempt.contribution_ref then
      raise exception 'receipt_conflict' using errcode = '23505';
    end if;

    -- Same receipt, same contribution: idempotent replay.
    v_replayed := true;
  else
    select * into v_asset
    from public.rwa_assets
    where id = v_attempt.asset_row_id
    for update;

    if not found then
      raise exception 'asset_not_found' using errcode = 'P0002';
    end if;

    if v_asset.funded_principal_units + v_attempt.principal_units > v_asset.target_principal_units then
      raise exception 'target_exceeded' using errcode = '22023';
    end if;

    insert into public.rwa_receipts (
      network, tx_hash, event_index, receipt_id, funding_pool_contract_id,
      asset_row_id, asset_id, investor_id, investor_address, principal_units,
      funding_fee_units, ownership_units, nonce, contribution_ref, position_id, ledger
    ) values (
      v_attempt.network, p_tx_hash, p_event_index, p_receipt_id,
      v_attempt.funding_pool_contract_id, v_attempt.asset_row_id, v_attempt.asset_id,
      v_attempt.investor_id, v_attempt.investor_address, v_attempt.principal_units,
      coalesce(p_observed_funding_fee_units, 0), coalesce(p_observed_ownership_units, 0),
      v_attempt.nonce, v_attempt.contribution_ref, p_observed_position_id, p_ledger
    );
  end if;

  -- Project the position.
  select * into v_position
  from public.rwa_positions
  where network = v_attempt.network
    and asset_id = v_attempt.asset_id
    and investor_id = v_attempt.investor_id
  for update;

  if found then
    if v_position.position_id <> p_observed_position_id then
      raise exception 'position_mismatch' using errcode = '22023';
    end if;
    if p_observed_nonce <= v_position.last_nonce then
      raise exception 'nonce_regression' using errcode = '22023';
    end if;

    update public.rwa_positions
    set principal_units = principal_units + v_attempt.principal_units,
        ownership_units = ownership_units + coalesce(p_observed_ownership_units, 0),
        funding_fee_units = funding_fee_units + coalesce(p_observed_funding_fee_units, 0),
        contribution_count = contribution_count + 1,
        last_nonce = p_observed_nonce,
        last_contribution_ref = v_attempt.contribution_ref,
        updated_at = now()
    where id = v_position.id
    returning * into v_position;
  else
    insert into public.rwa_positions (
      asset_row_id, network, asset_id, position_id, investor_id, investor_address,
      principal_units, ownership_units, funding_fee_units, contribution_count,
      last_nonce, last_contribution_ref, status
    ) values (
      v_attempt.asset_row_id, v_attempt.network, v_attempt.asset_id,
      p_observed_position_id, v_attempt.investor_id, v_attempt.investor_address,
      v_attempt.principal_units, coalesce(p_observed_ownership_units, 0),
      coalesce(p_observed_funding_fee_units, 0), 1,
      p_observed_nonce, v_attempt.contribution_ref, 'open'
    )
    returning * into v_position;

    v_position_exists := true;
  end if;

  -- Aggregate the pool. The asset row was locked above, so concurrent
  -- confirmations serialise here and the totals stay exact.
  if not v_replayed then
    update public.rwa_assets
    set funded_principal_units = funded_principal_units + v_attempt.principal_units,
        funding_fee_units = funding_fee_units + coalesce(p_observed_funding_fee_units, 0),
        position_count = position_count + case when v_position_exists then 1 else 0 end,
        updated_at = now()
    where id = v_attempt.asset_row_id
    returning * into v_asset;

    -- The asset is ready to settle only at the exact confirmed target.
    if v_asset.funded_principal_units = v_asset.target_principal_units
       and v_asset.lifecycle = 'open' then
      update public.rwa_assets
      set lifecycle = 'ready_to_settle',
          target_reached_at = now(),
          updated_at = now()
      where id = v_asset.id
      returning * into v_asset;

      v_target_reached := true;
    end if;
  end if;

  update public.rwa_contributions
  set status = 'confirmed',
      tx_hash = p_tx_hash,
      receipt_id = p_receipt_id,
      ledger = coalesce(p_ledger, ledger),
      confirmed_at = now(),
      reservation_expires_at = null,
      updated_at = now()
  where id = v_attempt.id;

  return jsonb_build_object(
    'replayed', v_replayed,
    'target_reached', v_target_reached,
    'receipt_id', p_receipt_id,
    'position_id', v_position.position_id,
    'principal_units', v_position.principal_units,
    'ownership_units', v_position.ownership_units,
    'funding_fee_units', v_position.funding_fee_units,
    'contribution_count', v_position.contribution_count,
    'lifecycle', v_asset.lifecycle
  );
end;
$$;

revoke execute on function public.rwa_confirm_contribution(uuid, text, text, integer, integer, text, bigint, bigint, bigint, bigint, text, integer) from anon, authenticated;

-- Record that the supplier has been paid. Only after this does the legacy
-- deal become ready for shipment. Target-reached and supplier-paid stay
-- distinguishable: ready_to_settle is not settled.
create or replace function public.rwa_mark_supplier_paid(
  p_asset_row_id uuid,
  p_tx_hash text,
  p_ledger integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asset public.rwa_assets%rowtype;
begin
  perform public.assert_rwa_writer();

  select * into v_asset
  from public.rwa_assets
  where id = p_asset_row_id
  for update;

  if not found then
    raise exception 'asset_not_found' using errcode = 'P0002';
  end if;

  if v_asset.lifecycle = 'settled' then
    return jsonb_build_object('lifecycle', 'settled', 'replayed', true);
  end if;

  if v_asset.lifecycle <> 'ready_to_settle' then
    raise exception 'target_not_reached' using errcode = '22023';
  end if;

  if v_asset.funded_principal_units <> v_asset.target_principal_units then
    raise exception 'target_not_reached' using errcode = '22023';
  end if;

  update public.rwa_assets
  set lifecycle = 'settled',
      supplier_paid_at = now(),
      updated_at = now()
  where id = v_asset.id
  returning * into v_asset;

  update public.rwa_positions
  set status = 'settled', updated_at = now()
  where asset_row_id = v_asset.id and status = 'open';

  -- The legacy-facing deal only becomes fundable-for-shipment now that the
  -- supplier has actually been paid.
  if v_asset.deal_id is not null then
    update public.deals
    set status = 'funded',
        funded_at = coalesce(funded_at, now()),
        funding_tx_hash = coalesce(p_tx_hash, funding_tx_hash),
        rwa_asset_row_id = v_asset.id,
        updated_at = now()
    where id = v_asset.deal_id;
  end if;

  return jsonb_build_object(
    'lifecycle', v_asset.lifecycle,
    'replayed', false,
    'funded_principal_units', v_asset.funded_principal_units,
    'target_principal_units', v_asset.target_principal_units
  );
end;
$$;

revoke execute on function public.rwa_mark_supplier_paid(uuid, text, integer) from anon, authenticated;

-- Record a refund. The contract pays the recorded wallet only; this records
-- the outcome and releases the position.
create or replace function public.rwa_record_refund(
  p_asset_row_id uuid,
  p_position_id integer,
  p_tx_hash text,
  p_refund_units bigint,
  p_ledger integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asset public.rwa_assets%rowtype;
  v_position public.rwa_positions%rowtype;
begin
  perform public.assert_rwa_writer();

  select * into v_asset
  from public.rwa_assets
  where id = p_asset_row_id
  for update;

  if not found then
    raise exception 'asset_not_found' using errcode = 'P0002';
  end if;

  select * into v_position
  from public.rwa_positions
  where asset_row_id = p_asset_row_id and position_id = p_position_id
  for update;

  if not found then
    raise exception 'position_not_found' using errcode = 'P0002';
  end if;

  if v_position.status = 'refunded' then
    return jsonb_build_object('status', 'refunded', 'replayed', true);
  end if;

  update public.rwa_positions
  set status = 'refunded', updated_at = now()
  where id = v_position.id;

  update public.rwa_assets
  set funded_principal_units = greatest(funded_principal_units - coalesce(p_refund_units, 0), 0),
      funding_fee_units = greatest(funding_fee_units - coalesce(p_refund_units, 0), 0),
      updated_at = now()
  where id = v_asset.id
  returning * into v_asset;

  return jsonb_build_object(
    'status', 'refunded',
    'replayed', false,
    'lifecycle', v_asset.lifecycle
  );
end;
$$;

revoke execute on function public.rwa_record_refund(uuid, integer, text, bigint, integer) from anon, authenticated;

-- Mark a prepared attempt as failed when the transaction definitively failed.
create or replace function public.rwa_mark_attempt_failed(
  p_attempt_id uuid,
  p_failure_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.rwa_contributions%rowtype;
begin
  perform public.assert_rwa_writer();

  select * into v_attempt
  from public.rwa_contributions
  where attempt_id = p_attempt_id
  for update;

  if not found then
    raise exception 'attempt_not_found' using errcode = 'P0002';
  end if;

  -- A confirmed contribution is never downgraded.
  if v_attempt.status = 'confirmed' then
    return jsonb_build_object('attempt_id', v_attempt.attempt_id, 'status', 'confirmed');
  end if;

  update public.rwa_contributions
  set status = 'failed',
      failure_code = coalesce(p_failure_code, 'unknown'),
      updated_at = now()
  where id = v_attempt.id;

  return jsonb_build_object('attempt_id', v_attempt.attempt_id, 'status', 'failed');
end;
$$;

revoke execute on function public.rwa_mark_attempt_failed(uuid, text) from anon, authenticated;

-- Current pool view for an asset, including live capacity. Used by the API to
-- return actionable state on a conflict.
create or replace function public.rwa_get_asset_state(p_asset_row_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'asset_id', a.asset_id,
    'network', a.network,
    'funding_pool_contract_id', a.funding_pool_contract_id,
    'lifecycle', a.lifecycle,
    'token_contract_id', a.token_contract_id,
    'token_decimals', a.token_decimals,
    'target_principal_units', a.target_principal_units,
    'funded_principal_units', a.funded_principal_units,
    'funding_fee_units', a.funding_fee_units,
    'position_count', a.position_count,
    'deadline_at', a.deadline_at,
    'target_reached_at', a.target_reached_at,
    'supplier_paid_at', a.supplier_paid_at,
    'available_principal_units', greatest(
      a.target_principal_units - a.funded_principal_units - coalesce((
        select sum(c.principal_units)
        from public.rwa_contributions c
        where c.asset_row_id = a.id
          and c.status in ('prepared', 'submitted')
          and (c.reservation_expires_at is null or c.reservation_expires_at > now())
      ), 0), 0)
  )
  from public.rwa_assets a
  where a.id = p_asset_row_id;
$$;

grant execute on function public.rwa_get_asset_state(uuid) to anon, authenticated;
