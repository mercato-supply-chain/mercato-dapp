-- RWA schema, ownership and maturity rules.
-- Run with: npx supabase test db (against a disposable local database).

begin;

create extension if not exists pgtap;

select plan(27);

-- ---------------------------------------------------------------------------
-- Seed: people, supplier company, deal
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
  'RWA deal', 'Credit asset test deal', 'Food & Beverage', 'Coffee',
  10, 100, 'Supplier Co', 1000, 10,
  60, 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', '2026-10-01T00:00:00Z'
);

insert into public.deals (
  id, pyme_id, supplier_id, title, description, category, product_name,
  product_quantity, product_unit_price, supplier_name, amount, interest_rate,
  term_days, escrow_contract_address
) values (
  '77777777-7777-4777-8777-777777777778',
  '33333333-3333-4333-8333-333333333333',
  '66666666-6666-4666-8666-666666666666',
  'RWA deal two', 'Second deal for identity tests', 'Food & Beverage', 'Coffee',
  10, 100, 'Supplier Co', 1000, 10, 60,
  'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
);

-- Opt in as the PyME (the guard only allows the deal creator or an admin).
set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
set local request.jwt.claim.role = 'authenticated';

update public.deals set rwa_opted_in = true
  where id in (
    '77777777-7777-4777-8777-777777777777',
    '77777777-7777-4777-8777-777777777778'
  );

reset role;

-- Resolve the canonical issuance as an admin.
set local role authenticated;
set local request.jwt.claim.sub = '55555555-5555-4555-8555-555555555555';
set local request.jwt.claim.role = 'authenticated';

select lives_ok(
  $$
    select public.rwa_issue_credit_asset(
      '77777777-7777-4777-8777-777777777777',
      'testnet',
      'CBRWARE0000000000000000000000000000000000000000000000',
      'CRA-0001',
      'USDC',
      'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      7::smallint,
      10000000000,
      1500000,
      100000000,
      150,
      60,
      '{"platform_fee_bps":100,"tw_fee_bps":30,"rounding_policy":"half_up_atomic","charged_at":"funding"}'::jsonb,
      '{"snapshot_version":"1","deal_id":"77777777-7777-4777-8777-777777777777","network":"testnet","asset_code":"USDC","asset_issuer":"GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5","asset_decimals":"7","principal_atomic":"10000000000","return_numerator":"1500000","return_denominator":"100000000","display_yield_bps":"150","term_days":"60","maturity_policy":"delivery_relative","issued_at":"2026-10-20T12:34:56.000Z","issuance_identity":"testnet:CBRWARE0000000000000000000000000000000000000000000000:CRA-0001"}'::jsonb,
      repeat('a', 64),
      'f00dfeed00000000000000000000000000000000000000000000000000000001',
      'op-issued-0001',
      101,
      ('[{"kind":"financing_agreement","opaque_ref":"doc_0001","content_hash":"'
        || repeat('b', 64) || '","byte_length":"18432"}]')::jsonb
    )
  $$,
  'an admin can issue the canonical credit asset'
);

reset role;

select is(
  (select count(*)::int from public.rwa_credit_assets
    where deal_id = '77777777-7777-4777-8777-777777777777'),
  1,
  'one commercial deal maps to one canonical issuance'
);

select is(
  (select count(*)::int from public.rwa_issuance_events e
     join public.rwa_credit_assets a on a.id = e.credit_asset_id
    where a.deal_id = '77777777-7777-4777-8777-777777777777'
      and e.event_type = 'issued'),
  1,
  'issuance writes exactly one issued event'
);

select is(
  (select count(*)::int from public.rwa_document_commitments d
     join public.rwa_credit_assets a on a.id = d.credit_asset_id
    where a.deal_id = '77777777-7777-4777-8777-777777777777'),
  1,
  'issuance stores the document commitment, not the document'
);

-- Duplicate active issuance for the same deal is rejected.
select throws_ok(
  $$
    insert into public.rwa_credit_assets (
      deal_id, network, registry_contract, asset_id, asset_code, asset_issuer,
      asset_decimals, principal_atomic, return_numerator, return_denominator,
      display_yield_bps, term_days, financial_snapshot, financial_snapshot_hash, fees, state
    ) values (
      '77777777-7777-4777-8777-777777777777', 'testnet', 'CBRWARE0000000000000000000000000000000000000000000000',
      'CRA-0002', 'USDC', 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      7, 5000000000, 1500000, 100000000, 150, 60, '{}'::jsonb, repeat('c', 64),
      '{"platform_fee_bps":100,"tw_fee_bps":30,"rounding_policy":"half_up_atomic","charged_at":"funding"}'::jsonb,
      'issued'
    )
  $$,
  '23505',
  'duplicate key value violates unique constraint "uq_rwa_credit_assets_active_deal"',
  'a second active issuance for the same deal is rejected'
);

-- Duplicate issuance identity across deals is rejected.
select throws_ok(
  $$
    insert into public.rwa_credit_assets (
      deal_id, network, registry_contract, asset_id, asset_code, asset_issuer,
      asset_decimals, principal_atomic, return_numerator, return_denominator,
      display_yield_bps, term_days, financial_snapshot, financial_snapshot_hash, fees, state
    ) values (
      '77777777-7777-4777-8777-777777777778', 'testnet', 'CBRWARE0000000000000000000000000000000000000000000000',
      'CRA-0001', 'USDC', 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      7, 5000000000, 1500000, 100000000, 150, 60, '{}'::jsonb, repeat('c', 64),
      '{"platform_fee_bps":100,"tw_fee_bps":30,"rounding_policy":"half_up_atomic","charged_at":"funding"}'::jsonb,
      'issued'
    )
  $$,
  '23505',
  'duplicate key value violates unique constraint "rwa_credit_assets_identity_key"',
  'the same network/registry/asset identity cannot be issued twice'
);

-- ---------------------------------------------------------------------------
-- Contributions: attempts are separate from positions
-- ---------------------------------------------------------------------------

insert into public.rwa_contribution_attempts (
  id, credit_asset_id, investor_profile_id, investor_wallet, amount_atomic,
  asset_code, asset_decimals, idempotency_key
)
select
  '99999999-9999-4999-8999-999999999991',
  a.id, '11111111-1111-4111-8111-111111111111',
  'GINVESTORA000000000000000000000000000000000000000000000', 4000000000,
  'USDC', 7, 'idem-a-1'
from public.rwa_credit_assets a
where a.deal_id = '77777777-7777-4777-8777-777777777777';

insert into public.rwa_contribution_attempts (
  id, credit_asset_id, investor_profile_id, investor_wallet, amount_atomic,
  asset_code, asset_decimals, idempotency_key
)
select
  '99999999-9999-4999-8999-999999999992',
  a.id, '22222222-2222-4222-8222-222222222222',
  'GINVESTORB000000000000000000000000000000000000000000000', 3000000000,
  'USDC', 7, 'idem-b-1'
from public.rwa_credit_assets a
where a.deal_id = '77777777-7777-4777-8777-777777777777';

select throws_ok(
  $$
    insert into public.rwa_contribution_attempts (
      credit_asset_id, investor_profile_id, investor_wallet, amount_atomic,
      asset_code, asset_decimals, idempotency_key
    )
    select a.id, '11111111-1111-4111-8111-111111111111',
      'GINVESTORA000000000000000000000000000000000000000000000', 0,
      'USDC', 7, 'idem-zero'
    from public.rwa_credit_assets a
    where a.deal_id = '77777777-7777-4777-8777-777777777777'
  $$,
  '23514',
  'new row for relation "rwa_contribution_attempts" violates check constraint "rwa_contribution_attempts_amount_atomic_check"',
  'a zero-amount attempt is rejected at the database boundary'
);

-- Confirm both contributions as the backend service role.
set local role service_role;
set local request.jwt.claim.role = 'service_role';

select lives_ok(
  $$
    select public.rwa_confirm_contribution(
      '99999999-9999-4999-8999-999999999991', 'testnet',
      'CBRWARE0000000000000000000000000000000000000000000000',
      'f00dfeed00000000000000000000000000000000000000000000000000000011',
      'op-contrib-a', 102, 4000000000
    )
  $$,
  'the backend confirms investor A contribution'
);

select lives_ok(
  $$
    select public.rwa_confirm_contribution(
      '99999999-9999-4999-8999-999999999992', 'testnet',
      'CBRWARE0000000000000000000000000000000000000000000000',
      'f00dfeed00000000000000000000000000000000000000000000000000000012',
      'op-contrib-b', 103, 3000000000
    )
  $$,
  'the backend confirms investor B contribution'
);

reset role;

select is(
  (select count(*)::int from public.rwa_investor_positions p
     join public.rwa_credit_assets a on a.id = p.credit_asset_id
    where a.deal_id = '77777777-7777-4777-8777-777777777777'),
  2,
  'two different investors hold independent positions'
);

select isnt(
  (select id from public.rwa_investor_positions
    where investor_profile_id = '11111111-1111-4111-8111-111111111111'),
  (select id from public.rwa_investor_positions
    where investor_profile_id = '22222222-2222-4222-8222-222222222222'),
  'each investor position has its own identity'
);

select is(
  (select units_atomic from public.rwa_investor_positions
    where investor_profile_id = '11111111-1111-4111-8111-111111111111'),
  4000000000::bigint,
  'units equal confirmed atomic principal at unit_decimals = 0'
);

-- A retry/top-up must not create a duplicate ownership row.
insert into public.rwa_contribution_attempts (
  id, credit_asset_id, investor_profile_id, investor_wallet, amount_atomic,
  asset_code, asset_decimals, idempotency_key
)
select
  '99999999-9999-4999-8999-999999999993',
  a.id, '11111111-1111-4111-8111-111111111111',
  'GINVESTORA000000000000000000000000000000000000000000000', 1000000000,
  'USDC', 7, 'idem-a-2'
from public.rwa_credit_assets a
where a.deal_id = '77777777-7777-4777-8777-777777777777';

select throws_ok(
  $$
    select public.rwa_confirm_contribution(
      '99999999-9999-4999-8999-999999999993', 'testnet',
      'CBRWARE0000000000000000000000000000000000000000000000',
      'f00dfeed00000000000000000000000000000000000000000000000000000013',
      'op-contrib-a2', 104, 2000000000
    )
  $$,
  '23514',
  'invalid_amount',
  'a confirmed amount larger than the attempt is rejected'
);

set local role service_role;
set local request.jwt.claim.role = 'service_role';

select lives_ok(
  $$
    select public.rwa_confirm_contribution(
      '99999999-9999-4999-8999-999999999993', 'testnet',
      'CBRWARE0000000000000000000000000000000000000000000000',
      'f00dfeed00000000000000000000000000000000000000000000000000000014',
      'op-contrib-a2', 105, 1000000000
    )
  $$,
  'a top-up is confirmed as a separate receipt'
);

reset role;

select is(
  (select count(*)::int from public.rwa_investor_positions p
     join public.rwa_credit_assets a on a.id = p.credit_asset_id
    where a.deal_id = '77777777-7777-4777-8777-777777777777'),
  2,
  'a top-up adds units to the existing position instead of creating a new one'
);

select is(
  (select units_atomic from public.rwa_investor_positions
    where investor_profile_id = '11111111-1111-4111-8111-111111111111'),
  5000000000::bigint,
  'top-up units accumulate exactly'
);

select is(
  (select count(*)::int from public.rwa_contribution_receipts r
     join public.rwa_credit_assets a on a.id = r.credit_asset_id
    where a.deal_id = '77777777-7777-4777-8777-777777777777'),
  3,
  'every confirmation keeps its own receipt'
);

-- Settlement evidence uniqueness by network/contract/transaction/operation.
select lives_ok(
  $$
    insert into public.rwa_position_settlements (
      position_id, credit_asset_id, kind, amount_atomic, network, registry_contract,
      tx_hash, operation_or_event_id, ledger_seq
    )
    select p.id, p.credit_asset_id, 'return', 100, 'testnet',
      'CBRWARE0000000000000000000000000000000000000000000000',
      'settle-tx-1', 'settle-op-1', 200
    from public.rwa_investor_positions p
    where p.investor_profile_id = '11111111-1111-4111-8111-111111111111'
  $$,
  'a position settlement is recorded with its on-chain evidence'
);

select throws_ok(
  $$
    insert into public.rwa_position_settlements (
      position_id, credit_asset_id, kind, amount_atomic, network, registry_contract,
      tx_hash, operation_or_event_id, ledger_seq
    )
    select p.id, p.credit_asset_id, 'return', 100, 'testnet',
      'CBRWARE0000000000000000000000000000000000000000000000',
      'settle-tx-1', 'settle-op-1', 200
    from public.rwa_investor_positions p
    where p.investor_profile_id = '11111111-1111-4111-8111-111111111111'
  $$,
  '23505',
  'duplicate key value violates unique constraint "rwa_position_settlements_evidence_key"',
  'duplicate settlement evidence is rejected'
);

select throws_ok(
  $$ delete from public.rwa_position_settlements where tx_hash = 'settle-tx-1' $$,
  '23514',
  'RWA financial evidence is append-only',
  'financial evidence cannot be deleted'
);

-- ---------------------------------------------------------------------------
-- Frozen terms, invalid transitions and one-time maturity
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ update public.rwa_credit_assets set principal_atomic = 1 where deal_id = '77777777-7777-4777-8777-777777777777' $$,
  '23514',
  'RWA financial terms are frozen after issuance',
  'issued economics cannot drift'
);

select throws_ok(
  $$ update public.rwa_credit_assets set state = 'draft' where deal_id = '77777777-7777-4777-8777-777777777777' $$,
  '23514',
  'Invalid RWA state transition from partially_funded to draft',
  'invalid state transitions are rejected'
);

set local role authenticated;
set local request.jwt.claim.sub = '55555555-5555-4555-8555-555555555555';
set local request.jwt.claim.role = 'authenticated';

select is(
  (select public.rwa_activate_issuance(a.id)
     from public.rwa_credit_assets a
    where a.deal_id = '77777777-7777-4777-8777-777777777777'),
  (select delivered_at + interval '60 days' from public.deals
    where id = '77777777-7777-4777-8777-777777777777'),
  'activation sets actual_due_at to delivery time plus the frozen term'
);

select throws_ok(
  $$
    select public.rwa_activate_issuance(a.id)
    from public.rwa_credit_assets a
    where a.deal_id = '77777777-7777-4777-8777-777777777777'
  $$,
  '23505',
  'issuance_already_activated',
  'activation can only happen once'
);

reset role;

select throws_ok(
  $$ update public.rwa_credit_assets set actual_due_at = now() where deal_id = '77777777-7777-4777-8777-777777777777' $$,
  '23514',
  'RWA actual_due_at is written exactly once',
  'the contractual due date cannot be rewritten'
);

select is(
  (select count(*)::int from public.rwa_issuance_events e
     join public.rwa_credit_assets a on a.id = e.credit_asset_id
    where a.deal_id = '77777777-7777-4777-8777-777777777777'
      and e.event_type = 'activated'),
  1,
  'activation records exactly one activation event'
);

select is(
  (select count(*)::int from public.rwa_credit_assets
    where deal_id = '77777777-7777-4777-8777-777777777778'),
  0,
  'the second deal was not touched by issuance tests'
);

select * from finish();
rollback;
