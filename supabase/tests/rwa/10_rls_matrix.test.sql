-- RWA access matrix: anonymous, investor A, investor B, PyME, supplier, admin.
-- Proves views/RPCs never widen what RLS + column grants allow.

begin;

create extension if not exists pgtap;

select plan(34);

-- ---------------------------------------------------------------------------
-- Seed
-- ---------------------------------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'investor-a@example.test', '{"user_type":"investor"}'),
  ('22222222-2222-4222-8222-222222222222', 'investor-b@example.test', '{"user_type":"investor"}'),
  ('33333333-3333-4333-8333-333333333333', 'pyme@example.test', '{"user_type":"pyme"}'),
  ('44444444-4444-4444-8444-444444444444', 'supplier@example.test', '{"user_type":"supplier"}'),
  ('55555555-5555-4555-8555-555555555555', 'admin@example.test', '{"user_type":"admin"}');

update public.profiles set user_type = 'investor' where id in (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222'
);
update public.profiles set user_type = 'pyme', verified = true
  where id = '33333333-3333-4333-8333-333333333333';
update public.profiles set user_type = 'supplier', verified = true
  where id = '44444444-4444-4444-8444-444444444444';
update public.profiles set user_type = 'admin'
  where id = '55555555-5555-4555-8555-555555555555';

insert into public.supplier_companies (id, owner_id, company_name, verified)
values ('66666666-6666-4666-8666-666666666666', '44444444-4444-4444-8444-444444444444', 'Supplier Co', true);

insert into public.deals (
  id, pyme_id, supplier_id, title, description, category, product_name,
  product_quantity, product_unit_price, supplier_name, amount, interest_rate,
  term_days, escrow_contract_address, delivered_at
) values (
  '77777777-7777-4777-8777-777777777777',
  '33333333-3333-4333-8333-333333333333',
  '66666666-6666-4666-8666-666666666666',
  'RWA deal', 'Access matrix deal', 'Food & Beverage', 'Coffee',
  10, 100, 'Supplier Co', 1000, 10,
  60, 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', '2026-10-01T00:00:00Z'
);

set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
set local request.jwt.claim.role = 'authenticated';

update public.deals set rwa_opted_in = true
  where id = '77777777-7777-4777-8777-777777777777';

reset role;

set local role authenticated;
set local request.jwt.claim.sub = '55555555-5555-4555-8555-555555555555';

select public.rwa_issue_credit_asset(
  '77777777-7777-4777-8777-777777777777',
  'testnet',
  'CBRWARE0000000000000000000000000000000000000000000000',
  'CRA-0001',
  'USDC',
  'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
  7::smallint, 10000000000, 1500000, 100000000, 150, 60,
  '{"platform_fee_bps":100,"tw_fee_bps":30,"rounding_policy":"half_up_atomic","charged_at":"funding"}'::jsonb,
  '{"snapshot_version":"1","deal_id":"77777777-7777-4777-8777-777777777777","network":"testnet","asset_code":"USDC","asset_issuer":"GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5","asset_decimals":"7","principal_atomic":"10000000000","return_numerator":"1500000","return_denominator":"100000000","display_yield_bps":"150","term_days":"60","maturity_policy":"delivery_relative","issued_at":"2026-10-20T12:34:56.000Z","issuance_identity":"testnet:CBRWARE0000000000000000000000000000000000000000000000:CRA-0001"}'::jsonb,
  repeat('a', 64),
  'f00dfeed00000000000000000000000000000000000000000000000000000001',
  'op-issued-0001', 101,
  ('[{"kind":"financing_agreement","opaque_ref":"doc_0001","content_hash":"'
    || repeat('b', 64) || '","byte_length":"18432"}]')::jsonb
);

reset role;

insert into public.rwa_contribution_attempts (
  id, credit_asset_id, investor_profile_id, investor_wallet, amount_atomic,
  asset_code, asset_decimals, idempotency_key
)
select '99999999-9999-4999-8999-999999999991', a.id,
  '11111111-1111-4111-8111-111111111111',
  'GINVESTORA000000000000000000000000000000000000000000000', 4000000000,
  'USDC', 7, 'idem-a'
from public.rwa_credit_assets a
where a.deal_id = '77777777-7777-4777-8777-777777777777';

insert into public.rwa_contribution_attempts (
  id, credit_asset_id, investor_profile_id, investor_wallet, amount_atomic,
  asset_code, asset_decimals, idempotency_key
)
select '99999999-9999-4999-8999-999999999992', a.id,
  '22222222-2222-4222-8222-222222222222',
  'GINVESTORB000000000000000000000000000000000000000000000', 3000000000,
  'USDC', 7, 'idem-b'
from public.rwa_credit_assets a
where a.deal_id = '77777777-7777-4777-8777-777777777777';

set local role service_role;
set local request.jwt.claim.role = 'service_role';

select public.rwa_confirm_contribution(
  '99999999-9999-4999-8999-999999999991', 'testnet',
  'CBRWARE0000000000000000000000000000000000000000000000',
  'f00dfeed00000000000000000000000000000000000000000000000000000011',
  'op-a', 102, 4000000000
);
select public.rwa_confirm_contribution(
  '99999999-9999-4999-8999-999999999992', 'testnet',
  'CBRWARE0000000000000000000000000000000000000000000000',
  'f00dfeed00000000000000000000000000000000000000000000000000000012',
  'op-b', 103, 3000000000
);

reset role;

-- ---------------------------------------------------------------------------
-- Anonymous
-- ---------------------------------------------------------------------------

set local role anon;
set local request.jwt.claim.sub = '';
set local request.jwt.claim.role = 'anon';

select throws_ok(
  $$ select count(*) from public.rwa_credit_assets $$,
  '42501',
  'permission denied for table rwa_credit_assets',
  'anonymous cannot read the credit-asset table'
);

select throws_ok(
  $$ select count(*) from public.rwa_investor_positions $$,
  '42501',
  'permission denied for table rwa_investor_positions',
  'anonymous cannot read positions'
);

select is(
  (select viewer_scope from public.get_rwa_deal_summary('77777777-7777-4777-8777-777777777777')),
  'public',
  'the public marketplace RPC answers anonymous callers with aggregates'
);

select is(
  (select confirmed_principal_atomic from public.get_rwa_deal_summary('77777777-7777-4777-8777-777777777777')),
  7000000000::bigint,
  'the public aggregate exposes confirmed principal only, not individual rows'
);

select throws_ok(
  $$ select count(*) from public.rwa_get_my_positions() $$,
  '42501',
  'permission denied for function rwa_get_my_positions',
  'anonymous cannot call the personal positions RPC'
);

reset role;

-- ---------------------------------------------------------------------------
-- Investor A
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
set local request.jwt.claim.role = 'authenticated';

select is(
  (select count(*)::int from public.rwa_investor_positions),
  1,
  'investor A reads exactly one position'
);

select is(
  (select count(*)::int from public.rwa_contribution_attempts),
  1,
  'investor A reads exactly one of their own attempts'
);

select is(
  (select count(*)::int from public.rwa_contribution_receipts),
  1,
  'investor A reads exactly one of their own receipts'
);

select is(
  (select count(*)::int from public.rwa_get_my_positions()),
  1,
  'investor A sees one position through the RPC'
);

select is(
  (select units_atomic from public.rwa_get_my_positions()),
  4000000000::bigint,
  'the positions RPC returns A units, not B units'
);

select throws_ok(
  $$
    insert into public.rwa_investor_positions (
      credit_asset_id, investor_profile_id, investor_wallet, units_atomic
    )
    select a.id, '11111111-1111-4111-8111-111111111111', 'GFAKE', 1
    from public.rwa_credit_assets a
    where a.deal_id = '77777777-7777-4777-8777-777777777777'
  $$,
  '42501',
  'permission denied for table rwa_investor_positions',
  'an investor cannot forge a position through a browser write'
);

select throws_ok(
  $$ delete from public.rwa_investor_positions $$,
  '42501',
  'permission denied for table rwa_investor_positions',
  'an investor cannot delete positions'
);

reset role;

-- ---------------------------------------------------------------------------
-- Investor B
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
set local request.jwt.claim.role = 'authenticated';

select is(
  (select count(*)::int from public.rwa_investor_positions),
  1,
  'investor B reads only their own position'
);

select is(
  (select count(*)::int from public.rwa_investor_positions
    where investor_profile_id = '11111111-1111-4111-8111-111111111111'),
  0,
  'investor B cannot read investor A position'
);

select is(
  (select units_atomic from public.rwa_get_my_positions()),
  3000000000::bigint,
  'the positions RPC is scoped to the caller'
);

select is(
  (select count(*)::int from public.rwa_contribution_receipts),
  1,
  'investor B cannot read investor A receipts'
);

reset role;

-- ---------------------------------------------------------------------------
-- PyME
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
set local request.jwt.claim.role = 'authenticated';

select is(
  (select count(*)::int from public.rwa_credit_assets),
  1,
  'the PyME reads issuance fields for their own deal'
);

select is(
  (select count(*)::int from public.rwa_document_commitments),
  1,
  'the PyME reads document commitments for their own deal'
);

select is(
  (select count(*)::int from public.rwa_investor_positions),
  0,
  'the PyME cannot read investor positions'
);

select is(
  (select count(*)::int from public.rwa_contribution_receipts),
  0,
  'the PyME cannot read contribution receipts'
);

select throws_ok(
  $$
    select public.rwa_issue_credit_asset(
      '77777777-7777-4777-8777-777777777777', 'testnet', 'CBRX', 'CRA-9',
      'USDC', 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      7::smallint, 1, 1, 100, 1, 60, '{}'::jsonb, '{}'::jsonb, repeat('a', 64),
      'tx', 'op', 1, '[]'::jsonb
    )
  $$,
  '42501',
  'forbidden',
  'a non-admin cannot issue a credit asset'
);

select throws_ok(
  $$ select financial_snapshot from public.rwa_credit_assets $$,
  '42501',
  'permission denied for table rwa_credit_assets',
  'the private financial snapshot is not readable by deal parties'
);

select throws_ok(
  $$ select * from public.admin_get_rwa_issuance((select id from public.rwa_credit_assets limit 1)) $$,
  '42501',
  'forbidden',
  'a PyME cannot use the admin issuance RPC as a read shortcut'
);

reset role;

-- ---------------------------------------------------------------------------
-- Supplier
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = '44444444-4444-4444-8444-444444444444';
set local request.jwt.claim.role = 'authenticated';

select is(
  (select count(*)::int from public.rwa_credit_assets),
  1,
  'the supplier reads issuance fields for the deal they fulfil'
);

select is(
  (select count(*)::int from public.rwa_investor_positions),
  0,
  'the supplier cannot read positions'
);

select is(
  (select count(*)::int from public.rwa_contribution_attempts),
  0,
  'the supplier cannot read contribution attempts'
);

reset role;

-- ---------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = '55555555-5555-4555-8555-555555555555';
set local request.jwt.claim.role = 'authenticated';

select is(
  (select count(*)::int from public.rwa_investor_positions),
  2,
  'the admin reads both independent positions'
);

select is(
  (select count(*)::int from public.rwa_contribution_attempts),
  2,
  'the admin reads both attempts'
);

select is(
  (select count(*)::int from public.rwa_issuance_events),
  1,
  'the admin reads issuance events'
);

select is(
  (select viewer_scope from public.get_rwa_deal_summary('77777777-7777-4777-8777-777777777777')),
  'admin',
  'the summary RPC reports the admin scope'
);

select is(
  (select jsonb_typeof(financial_snapshot)
     from public.admin_get_rwa_issuance(
       (select id from public.rwa_credit_assets limit 1))),
  'object',
  'an admin reads the frozen snapshot through the admin RPC'
);

select is(
  (select jsonb_array_length(documents)
     from public.admin_get_rwa_issuance(
       (select id from public.rwa_credit_assets limit 1))),
  1,
  'the admin RPC returns document commitments without exposing document bytes'
);

select throws_ok(
  $$
    insert into public.rwa_contribution_receipts (
      attempt_id, credit_asset_id, network, registry_contract, tx_hash,
      operation_or_event_id, ledger_seq, confirmed_amount_atomic
    )
    select at.id, at.credit_asset_id, 'testnet', 'CBRX', 'forged-tx', 'forged-op', 1, 1
    from public.rwa_contribution_attempts at
    limit 1
  $$,
  '42501',
  'permission denied for table rwa_contribution_receipts',
  'even an admin cannot fabricate confirmation evidence directly'
);

select throws_ok(
  $$
    select public.rwa_confirm_contribution(
      '99999999-9999-4999-8999-999999999991', 'testnet', 'CBRX',
      'forged-tx', 'forged-op', 1, 1
    )
  $$,
  '42501',
  'permission denied for function rwa_confirm_contribution',
  'confirmation is limited to the backend service role'
);

reset role;

select * from finish();
rollback;
