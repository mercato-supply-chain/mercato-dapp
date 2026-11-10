-- Join the canonical credit obligation to the funding-pool projection.
--
-- rwa_credit_assets remains the issuance record. rwa_assets remains the row
-- the contribution APIs already reconcile against. One deal uses rwa_opted_in;
-- funding_mode is set to rwa only by this server path, and investor_id stays
-- null for that deal.

alter table public.rwa_credit_assets
  add column if not exists pool_asset_row_id uuid;

alter table public.rwa_assets
  add column if not exists credit_asset_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'rwa_credit_assets_pool_asset_row_id_fkey'
  ) then
    alter table public.rwa_credit_assets
      add constraint rwa_credit_assets_pool_asset_row_id_fkey
      foreign key (pool_asset_row_id) references public.rwa_assets (id) on delete restrict;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'rwa_assets_credit_asset_id_fkey'
  ) then
    alter table public.rwa_assets
      add constraint rwa_assets_credit_asset_id_fkey
      foreign key (credit_asset_id) references public.rwa_credit_assets (id) on delete restrict;
  end if;
end $$;

create unique index if not exists uq_rwa_credit_assets_pool_asset_row
  on public.rwa_credit_assets (pool_asset_row_id)
  where pool_asset_row_id is not null;

create unique index if not exists uq_rwa_assets_credit_asset
  on public.rwa_assets (credit_asset_id)
  where credit_asset_id is not null;

alter table public.rwa_assets drop constraint if exists rwa_assets_network_check;
alter table public.rwa_assets
  add constraint rwa_assets_network_check
  check (network in ('testnet', 'futurenet', 'mainnet'));

-- Attempts that exist before a credit-asset row, so a submitted-but-unknown
-- issuance can be reconciled without minting a second asset id.
create table if not exists public.rwa_issuance_attempts (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete restrict,
  idempotency_key text not null check (length(btrim(idempotency_key)) between 8 and 200),
  network text not null check (network in ('testnet', 'futurenet', 'mainnet')),
  registry_contract text not null,
  asset_id text not null check (asset_id ~ '^[0-9a-f]{64}$'),
  deal_hash text not null check (deal_hash ~ '^[0-9a-f]{64}$'),
  snapshot_hash text not null check (snapshot_hash ~ '^[0-9a-f]{64}$'),
  document_root text not null check (document_root ~ '^[0-9a-f]{64}$'),
  phase text not null check (phase in ('register_asset', 'create_funding_pool')),
  status text not null check (status in ('prepared', 'submitted', 'unknown', 'confirmed', 'failed')),
  unsigned_xdr text not null,
  signing_wallet text not null,
  tx_hash text,
  ledger_seq bigint,
  pool_contract_id text,
  credit_asset_id uuid references public.rwa_credit_assets (id) on delete restrict,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rwa_issuance_attempts_key unique (deal_id, idempotency_key, phase)
);

alter table public.rwa_issuance_attempts enable row level security;

create index if not exists idx_rwa_issuance_attempts_open
  on public.rwa_issuance_attempts (status, updated_at)
  where status in ('prepared', 'submitted', 'unknown');

-- Commit a verified issuance and its pool projection in one transaction.
-- Replaying the same issuance identity returns the existing credit asset and
-- fills a missing pool row instead of inserting another one.
create or replace function public.rwa_commit_verified_issuance(
  p_actor_id uuid,
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
  p_documents jsonb,
  p_pool_contract_id text,
  p_token_contract_id text,
  p_supplier_address text,
  p_fee_recipient_address text,
  p_excess_recipient_address text,
  p_funding_fee_bps integer,
  p_fee_policy_version integer,
  p_deadline_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deal public.deals%rowtype;
  v_asset_id uuid;
  v_pool_id uuid;
  v_identity text := p_network || ':' || p_registry_contract || ':' || p_asset_id;
  v_doc jsonb;
  v_pyme_verified boolean;
  v_supplier_verified boolean;
begin
  perform public.rwa_assert_backend_actor();

  if p_actor_id is null or not exists (
    select 1 from public.profiles where id = p_actor_id and user_type = 'admin'
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select id into v_asset_id
  from public.rwa_credit_assets
  where issuance_identity = v_identity;

  if v_asset_id is null then
    select * into v_deal from public.deals where id = p_deal_id for update;
    if not found then
      raise exception 'deal_not_found' using errcode = 'P0002';
    end if;
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

    select p.verified into v_pyme_verified from public.profiles p where p.id = v_deal.pyme_id;
    if not coalesce(v_pyme_verified, false) then
      raise exception 'pyme_not_verified' using errcode = '23514';
    end if;
    select sc.verified into v_supplier_verified
    from public.supplier_companies sc where sc.id = v_deal.supplier_id;
    if not coalesce(v_supplier_verified, false) then
      raise exception 'supplier_not_verified' using errcode = '23514';
    end if;

    if (p_financial_snapshot ->> 'principal_atomic') is distinct from p_principal_atomic::text
       or (p_financial_snapshot ->> 'term_days') is distinct from p_term_days::text
       or (p_financial_snapshot ->> 'return_numerator') is distinct from p_return_numerator::text
       or (p_financial_snapshot ->> 'return_denominator') is distinct from p_return_denominator::text
       or (p_financial_snapshot ->> 'asset_code') is distinct from p_asset_code
       or (p_financial_snapshot ->> 'network') is distinct from p_network then
      raise exception 'snapshot_terms_mismatch' using errcode = '23514';
    end if;
    if p_documents is null or jsonb_typeof(p_documents) <> 'array' or jsonb_array_length(p_documents) < 1 then
      raise exception 'documents_required' using errcode = '23514';
    end if;

    insert into public.rwa_credit_assets (
      deal_id, network, registry_contract, asset_id, asset_code, asset_issuer,
      asset_decimals, principal_atomic, return_numerator, return_denominator,
      display_yield_bps, term_days, financial_snapshot, financial_snapshot_hash,
      fees, state, issuance_receipt_tx, issuance_operation_id, issuance_ledger_seq, issued_at
    ) values (
      p_deal_id, p_network, p_registry_contract, p_asset_id, p_asset_code, p_asset_issuer,
      p_asset_decimals, p_principal_atomic, p_return_numerator, p_return_denominator,
      p_display_yield_bps, p_term_days, p_financial_snapshot, p_financial_snapshot_hash,
      p_fees, 'issued', p_issuance_receipt_tx, p_issuance_operation_id, p_issuance_ledger_seq, now()
    )
    returning id into v_asset_id;

    for v_doc in select * from jsonb_array_elements(p_documents) loop
      insert into public.rwa_document_commitments (
        credit_asset_id, doc_kind, opaque_ref, content_hash, hash_algorithm, canonicalization, byte_length
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
      v_asset_id, 'issued', p_actor_id,
      jsonb_build_object(
        'financial_snapshot_hash', p_financial_snapshot_hash,
        'issuance_receipt_tx', p_issuance_receipt_tx
      )
    );
  end if;

  select id into v_pool_id from public.rwa_assets where credit_asset_id = v_asset_id;
  if v_pool_id is null then
    insert into public.rwa_assets (
      asset_id, network, registry_contract_id, funding_pool_contract_id, token_contract_id,
      token_decimals, target_principal_units, supplier_address, fee_recipient_address,
      excess_recipient_address, funding_fee_bps, fee_policy_version, deadline_at,
      lifecycle, deal_id, credit_asset_id
    ) values (
      p_asset_id, p_network, p_registry_contract, p_pool_contract_id, p_token_contract_id,
      p_asset_decimals, p_principal_atomic, p_supplier_address, p_fee_recipient_address,
      p_excess_recipient_address, p_funding_fee_bps, p_fee_policy_version, p_deadline_at,
      'open', p_deal_id, v_asset_id
    )
    returning id into v_pool_id;
  end if;

  update public.rwa_credit_assets
  set pool_asset_row_id = v_pool_id
  where id = v_asset_id and pool_asset_row_id is null;

  update public.deals
  set funding_mode = 'rwa',
      rwa_asset_row_id = v_pool_id,
      updated_at = now()
  where id = p_deal_id
    and investor_id is null;

  return v_asset_id;
end;
$$;

revoke all on function public.rwa_commit_verified_issuance(
  uuid, uuid, text, text, text, text, text, smallint, bigint, bigint, bigint, integer, integer,
  jsonb, jsonb, text, text, text, bigint, jsonb, text, text, text, text, text, integer, integer, timestamptz
) from public, anon, authenticated;
grant execute on function public.rwa_commit_verified_issuance(
  uuid, uuid, text, text, text, text, text, smallint, bigint, bigint, bigint, integer, integer,
  jsonb, jsonb, text, text, text, bigint, jsonb, text, text, text, text, text, integer, integer, timestamptz
) to service_role;

-- Mirror a confirmed pool position into the credit-asset ledger.
-- Pool status "settled" means the supplier was paid, not that the investor was redeemed.
create or replace function public.rwa_mirror_pool_position()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credit uuid;
  v_state text;
  v_target bigint;
  v_funded bigint;
  v_position_state text := 'active';
begin
  select credit_asset_id, target_principal_units, funded_principal_units
  into v_credit, v_target, v_funded
  from public.rwa_assets
  where id = new.asset_row_id;

  if v_credit is null then
    return new;
  end if;

  if new.principal_units <= 0 or new.ownership_units <= 0 then
    return new;
  end if;

  if new.status = 'refunded' then
    v_position_state := 'cancelled';
  end if;

  insert into public.rwa_investor_positions (
    credit_asset_id, investor_profile_id, investor_wallet,
    committed_principal_atomic, confirmed_principal_atomic, units_atomic, unit_decimals, state,
    reconciliation_state
  ) values (
    v_credit, new.investor_id, new.investor_address,
    new.principal_units, new.principal_units, new.ownership_units, 0,
    v_position_state, 'matched'
  )
  on conflict (credit_asset_id, investor_profile_id) do update
  set committed_principal_atomic = excluded.committed_principal_atomic,
      confirmed_principal_atomic = excluded.confirmed_principal_atomic,
      units_atomic = excluded.units_atomic,
      state = case
        when public.rwa_investor_positions.state = 'settled' then 'settled'
        else excluded.state
      end,
      reconciliation_state = 'matched';

  select state into v_state from public.rwa_credit_assets where id = v_credit;
  -- `issued` cannot jump straight to `fully_funded`. Step through the allowed edge.
  if v_funded >= v_target and v_state = 'issued' then
    update public.rwa_credit_assets set state = 'partially_funded' where id = v_credit;
    update public.rwa_credit_assets set state = 'fully_funded' where id = v_credit;
  elsif v_funded >= v_target and v_state in ('active', 'partially_funded') then
    update public.rwa_credit_assets set state = 'fully_funded' where id = v_credit;
  elsif v_funded > 0 and v_state in ('issued', 'active') then
    update public.rwa_credit_assets set state = 'partially_funded' where id = v_credit;
  end if;

  return new;
end;
$$;

drop trigger if exists rwa_positions_mirror_credit on public.rwa_positions;
create trigger rwa_positions_mirror_credit
  after insert or update on public.rwa_positions
  for each row
  execute function public.rwa_mirror_pool_position();

-- Record a repayment and close the credit asset once every position is redeemed.
create or replace function public.rwa_redeem_position(
  p_position_id uuid,
  p_amount_atomic bigint,
  p_network text,
  p_registry_contract text,
  p_tx_hash text,
  p_operation_or_event_id text,
  p_ledger_seq bigint
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settlement uuid;
  v_credit uuid;
  v_open integer;
  v_state text;
begin
  perform public.rwa_assert_backend_actor();

  v_settlement := public.rwa_record_position_settlement(
    p_position_id, 'principal', p_amount_atomic, p_network, p_registry_contract,
    p_tx_hash, p_operation_or_event_id, p_ledger_seq, now()
  );

  update public.rwa_investor_positions
  set state = 'settled', reconciliation_state = 'reconciled'
  where id = p_position_id
  returning credit_asset_id into v_credit;

  select count(*) into v_open
  from public.rwa_investor_positions
  where credit_asset_id = v_credit and state = 'active';

  if v_open = 0 then
    select state into v_state from public.rwa_credit_assets where id = v_credit for update;
    if v_state = 'fully_funded' then
      update public.rwa_credit_assets set state = 'settling' where id = v_credit;
      v_state := 'settling';
    end if;
    if v_state = 'settling' then
      update public.rwa_credit_assets set state = 'settled' where id = v_credit;
      insert into public.rwa_issuance_events (credit_asset_id, event_type, payload)
      values (v_credit, 'settled', jsonb_build_object('tx_hash', p_tx_hash));
    end if;
  end if;

  return v_settlement;
end;
$$;

revoke all on function public.rwa_redeem_position(uuid, bigint, text, text, text, text, bigint)
  from public, anon, authenticated;
grant execute on function public.rwa_redeem_position(uuid, bigint, text, text, text, text, bigint)
  to service_role;
