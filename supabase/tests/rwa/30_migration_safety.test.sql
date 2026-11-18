-- Migration safety: additive schema, legacy rows preserved, no fabricated evidence.

begin;

create extension if not exists pgtap;

select plan(16);

-- A legacy deal that existed before this migration.
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'investor-a@example.test', '{"user_type":"investor"}'),
  ('33333333-3333-4333-8333-333333333333', 'pyme@example.test', '{"user_type":"pyme"}');

update public.profiles set user_type = 'investor'
  where id = '11111111-1111-4111-8111-111111111111';
update public.profiles set user_type = 'pyme'
  where id = '33333333-3333-4333-8333-333333333333';

insert into public.deals (
  id, pyme_id, title, description, category, product_name,
  product_quantity, product_unit_price, supplier_name, amount, interest_rate,
  term_days, status, investor_id, funded_at, funding_tx_hash
) values (
  '77777777-7777-4777-8777-777777777771',
  '33333333-3333-4333-8333-333333333333',
  'Legacy funded deal', 'Predates RWA', 'Food & Beverage', 'Coffee',
  10, 100, 'Legacy Supplier', 1000, 10, 60, 'funded',
  '11111111-1111-4111-8111-111111111111', '2026-05-01T00:00:00Z', 'legacy-tx-hash'
);

-- ---------------------------------------------------------------------------
-- Additive schema
-- ---------------------------------------------------------------------------

select has_column('public', 'deals', 'investor_id', 'the legacy single-investor column still exists');
select has_column('public', 'deals', 'funding_tx_hash', 'the legacy funding hash column still exists');
select has_column('public', 'deals', 'rwa_opted_in', 'the RWA routing flag was added additively');

select is(
  (select column_default from information_schema.columns
    where table_schema = 'public' and table_name = 'deals' and column_name = 'rwa_opted_in'),
  'false',
  'RWA is opt-in: the routing flag defaults to false'
);

select is(
  (select count(*)::int from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'rwa_credit_assets', 'rwa_document_commitments', 'rwa_contribution_attempts',
        'rwa_contribution_receipts', 'rwa_investor_positions',
        'rwa_position_settlements', 'rwa_issuance_events'
      )
      and c.relrowsecurity),
  7,
  'row level security is enabled on all seven RWA tables'
);

select is(
  (select count(*)::int from pg_constraint c
    where c.contype = 'f'
      and (c.conrelid::regclass::text like 'rwa\_%'
        or c.confrelid::regclass::text like 'rwa\_%')
      and c.confdeltype not in ('r', 'a')),
  0,
  'no RWA foreign key cascade-deletes evidence'
);

-- ---------------------------------------------------------------------------
-- Legacy rows preserved, nothing fabricated
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int from public.deals),
  1,
  'existing deal rows are preserved'
);

select is(
  (select investor_id from public.deals where id = '77777777-7777-4777-8777-777777777771'),
  '11111111-1111-4111-8111-111111111111'::uuid,
  'the legacy investor assignment is untouched'
);

select is(
  (select funding_tx_hash from public.deals where id = '77777777-7777-4777-8777-777777777771'),
  'legacy-tx-hash',
  'the legacy funding hash is untouched'
);

select is(
  (select rwa_opted_in from public.deals where id = '77777777-7777-4777-8777-777777777771'),
  false,
  'legacy deals are not silently routed to RWA'
);

select is(
  (select count(*)::int from public.rwa_credit_assets),
  0,
  'no issuance was invented for a legacy deal'
);

select is(
  (select count(*)::int from public.rwa_issuance_events),
  0,
  'no issuance events were fabricated'
);

select is(
  (select count(*)::int from public.rwa_contribution_receipts)
  + (select count(*)::int from public.rwa_position_settlements),
  0,
  'no on-chain settlement evidence was fabricated'
);

select is(
  (select count(*)::int from public.rwa_investor_positions),
  0,
  'no investor positions were backfilled'
);

-- Legacy payment flow still works on legacy rows.
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
set local request.jwt.claim.role = 'authenticated';

select lives_ok(
  $$
    update public.deals
    set status = 'in_progress'
    where id = '77777777-7777-4777-8777-777777777771'
  $$,
  'legacy deals still follow the legacy lifecycle'
);

reset role;

-- Issuance requires explicit opt-in.
select throws_ok(
  $$
    insert into public.rwa_credit_assets (
      deal_id, network, registry_contract, asset_id, asset_code, asset_issuer,
      asset_decimals, principal_atomic, return_numerator, return_denominator,
      display_yield_bps, term_days, financial_snapshot, financial_snapshot_hash, fees, state
    ) values (
      '77777777-7777-4777-8777-777777777771', 'testnet', 'CBRX', 'A1', 'USDC',
      'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      7, 1, 1, 100, 1, 60, '{}'::jsonb, repeat('a', 64),
      '{"platform_fee_bps":100,"tw_fee_bps":30,"rounding_policy":"half_up_atomic","charged_at":"funding"}'::jsonb,
      'draft'
    )
  $$,
  '23514',
  'Deal is not opted in to RWA funding',
  'a credit asset cannot be created for a deal that did not opt in'
);

select * from finish();
rollback;
