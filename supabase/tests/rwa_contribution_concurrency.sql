-- RWA contribution projection: concurrency, de-duplication and the
-- target-reached / supplier-paid distinction.
--
-- Run with: supabase test db

begin;

select plan(19);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------

insert into auth.users (id, email, aud, role, raw_user_meta_data, instance_id, created_at, updated_at)
values
  ('11111111-1111-4111-8111-111111111111', 'investor-a@example.test', 'authenticated', 'authenticated', '{}'::jsonb, '00000000-0000-0000-0000-000000000000', now(), now()),
  ('22222222-2222-4222-8222-222222222222', 'investor-b@example.test', 'authenticated', 'authenticated', '{}'::jsonb, '00000000-0000-0000-0000-000000000000', now(), now()),
  ('33333333-3333-4333-8333-333333333333', 'pyme@example.test', 'authenticated', 'authenticated', '{}'::jsonb, '00000000-0000-0000-0000-000000000000', now(), now());

insert into public.profiles (id, email, user_type)
values
  ('11111111-1111-4111-8111-111111111111', 'investor-a@example.test', 'investor'),
  ('22222222-2222-4222-8222-222222222222', 'investor-b@example.test', 'investor'),
  ('33333333-3333-4333-8333-333333333333', 'pyme@example.test', 'pyme');

insert into public.deals (id, pyme_id, title, description, category, product_name, product_quantity, product_unit_price, supplier_name, amount, interest_rate, term_days, status, funding_mode)
values
  ('44444444-4444-4444-8444-444444444444', '33333333-3333-4333-8333-333333333333', 'RWA order', 'desc', 'goods', 'Widgets', 10, 100, 'Supplier', 1000, 5, 30, 'seeking_funding', 'rwa');

-- The pool the two investors contribute to.
insert into public.rwa_assets (
  id, asset_id, network, registry_contract_id, funding_pool_contract_id,
  token_contract_id, token_decimals, target_principal_units, supplier_address,
  fee_recipient_address, excess_recipient_address, funding_fee_bps,
  fee_policy_version, deadline_at, deal_id
)
values (
  '66666666-6666-4666-8666-666666666666', repeat('ab', 32), 'testnet',
  'CREGISTRY0000000000000000000000000000000000000000000000000000',
  'CPOOL000000000000000000000000000000000000000000000000000000',
  'CTOKEN00000000000000000000000000000000000000000000000000000',
  7, 1000, 'GSUPPLIER000000000000000000000000000000000000000000000000000000',
  'GFEE0000000000000000000000000000000000000000000000000000000000',
  'GEXCESS0000000000000000000000000000000000000000000000000000000',
  100, 1, now() + interval '7 days', '44444444-4444-4444-8444-444444444444'
);

-- A second pool, used for the cross-asset receipt check and the expiry case.
insert into public.rwa_assets (
  id, asset_id, network, registry_contract_id, funding_pool_contract_id,
  token_contract_id, token_decimals, target_principal_units, supplier_address,
  fee_recipient_address, excess_recipient_address, funding_fee_bps,
  fee_policy_version, deadline_at
)
values (
  '99999999-9999-4999-8999-999999999999', repeat('ee', 32), 'testnet',
  'CREGISTRY0000000000000000000000000000000000000000000000000000',
  'CPOOL2AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'CTOKEN00000000000000000000000000000000000000000000000000000',
  7, 1000, 'GSUPPLIER000000000000000000000000000000000000000000000000000000',
  'GFEE0000000000000000000000000000000000000000000000000000000000',
  'GEXCESS0000000000000000000000000000000000000000000000000000000',
  100, 1, now() + interval '7 days'
);

-- The protected operations run as the platform server.
set local request.jwt.claims = '{"role":"service_role"}';

-- ---------------------------------------------------------------------------
-- Two investors, two independently queryable positions
-- ---------------------------------------------------------------------------

select public.rwa_reserve_contribution(
  'a1111111-1111-4111-8111-111111111111', 'idem-a', '66666666-6666-4666-8666-666666666666',
  '11111111-1111-4111-8111-111111111111', 'GWALLETA0000000000000000000000000000000000000000000000000000',
  600::bigint, 900);

select public.rwa_reserve_contribution(
  'a2222222-2222-4222-8222-222222222222', 'idem-b', '66666666-6666-4666-8666-666666666666',
  '22222222-2222-4222-8222-222222222222', 'GWALLETB0000000000000000000000000000000000000000000000000000000',
  400::bigint, 900);

-- Investor B confirms first: the order of confirmation must not change the totals.
select public.rwa_confirm_contribution(
  'a2222222-2222-4222-8222-222222222222', repeat('b1', 32), 'receipt-b', 0,
  10, 'GWALLETB0000000000000000000000000000000000000000000000000000',
  400::bigint, 4::bigint, 400::bigint, 1::bigint,
  (select contribution_ref from public.rwa_contributions where attempt_id = 'a2222222-2222-4222-8222-222222222222'),
  0);

select is(
  (select count(*)::int from public.rwa_positions where asset_row_id = '66666666-6666-4666-8666-666666666666'),
  1,
  'the first confirmed contribution creates one position'
);

select is(
  (select funded_principal_units from public.rwa_assets where id = '66666666-6666-4666-8666-666666666666'),
  400::bigint,
  'the pool aggregates the confirmed principal'
);

select is(
  (select lifecycle from public.rwa_assets where id = '66666666-6666-4666-8666-666666666666'),
  'open',
  'the pool is not ready to settle before the target is reached'
);

-- The supplier cannot be marked as paid before the target is reached.
select throws_ok(
  $$ select public.rwa_mark_supplier_paid('66666666-6666-4666-8666-666666666666', repeat('c1', 32), null) $$,
  '22023',
  'target_not_reached',
  'the supplier payment is refused before the target is reached'
);

select is(
  (select status from public.deals where id = '44444444-4444-4444-8444-444444444444'),
  'seeking_funding',
  'the legacy-facing deal is not ready for shipment before the supplier is paid'
);

select public.rwa_confirm_contribution(
  'a1111111-1111-4111-8111-111111111111', repeat('a1', 32), 'receipt-a', 0,
  11, 'GWALLETA0000000000000000000000000000000000000000000000000000',
  600::bigint, 6::bigint, 600::bigint, 1::bigint,
  (select contribution_ref from public.rwa_contributions where attempt_id = 'a1111111-1111-4111-8111-111111111111'),
  1);

select is(
  (select count(*)::int from public.rwa_positions where asset_row_id = '66666666-6666-4666-8666-666666666666'),
  2,
  'two investors produce two independently queryable confirmed positions'
);

select is(
  (select funded_principal_units from public.rwa_assets where id = '66666666-6666-4666-8666-666666666666'),
  1000::bigint,
  'the pool totals both contributions'
);

select is(
  (select lifecycle from public.rwa_assets where id = '66666666-6666-4666-8666-666666666666'),
  'ready_to_settle',
  'the pool becomes ready to settle at the exact confirmed target'
);

select is(
  (select target_reached_at is not null from public.rwa_assets where id = '66666666-6666-4666-8666-666666666666'),
  true,
  'the target transition is recorded'
);

select is(
  (select principal_units from public.rwa_positions where asset_row_id = '66666666-6666-4666-8666-666666666666' and investor_id = '11111111-1111-4111-8111-111111111111'),
  600::bigint,
  'the first position holds its own principal'
);

select is(
  (select principal_units from public.rwa_positions where asset_row_id = '66666666-6666-4666-8666-666666666666' and investor_id = '22222222-2222-4222-8222-222222222222'),
  400::bigint,
  'the second position holds its own principal'
);

-- ---------------------------------------------------------------------------
-- A duplicate confirmation is a replay, not a second contribution
-- ---------------------------------------------------------------------------

select public.rwa_confirm_contribution(
  'a1111111-1111-4111-8111-111111111111', repeat('a1', 32), 'receipt-a', 0,
  11, 'GWALLETA0000000000000000000000000000000000000000000000000000',
  600::bigint, 6::bigint, 600::bigint, 1::bigint,
  (select contribution_ref from public.rwa_contributions where attempt_id = 'a1111111-1111-4111-8111-111111111111'),
  1);

select is(
  (select count(*)::int from public.rwa_receipts where tx_hash = repeat('a1', 32)),
  1,
  'a duplicate confirmation produces one receipt projection'
);

select is(
  (select funded_principal_units from public.rwa_assets where id = '66666666-6666-4666-8666-666666666666'),
  1000::bigint,
  'a duplicate confirmation does not change the totals'
);

-- The same receipt identity can never be attributed to a second asset.
select throws_ok(
  $$ insert into public.rwa_receipts (
       network, tx_hash, event_index, receipt_id, funding_pool_contract_id,
       asset_row_id, asset_id, investor_id, investor_address, principal_units,
       funding_fee_units, ownership_units, nonce, contribution_ref, position_id
     ) values (
       'testnet', repeat('a1', 32), 0, 'receipt-a-other',
       'CPOOL2AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
       '99999999-9999-4999-8999-999999999999', repeat('ee', 32),
       '11111111-1111-4111-8111-111111111111', 'GWALLETA0000000000000000000000000000000000000000000000000000',
       600::bigint, 6::bigint, 600::bigint, 1::bigint, repeat('cd', 32), 0
     ) $$,
  '23505',
  null,
  'the same receipt is never counted across assets'
);

-- ---------------------------------------------------------------------------
-- Target reached is not supplier paid
-- ---------------------------------------------------------------------------

select is(
  (select status from public.deals where id = '44444444-4444-4444-8444-444444444444'),
  'seeking_funding',
  'reaching the target alone does not release the deal for shipment'
);

select public.rwa_mark_supplier_paid(
  '66666666-6666-4666-8666-666666666666', repeat('c1', 32), 12);

select is(
  (select lifecycle from public.rwa_assets where id = '66666666-6666-4666-8666-666666666666'),
  'settled',
  'the supplier payment is recorded once it is confirmed'
);

select is(
  (select status from public.deals where id = '44444444-4444-4444-8444-444444444444'),
  'funded',
  'the legacy-facing deal becomes ready for shipment after the supplier is paid'
);

-- ---------------------------------------------------------------------------
-- An expired reservation does not invalidate a successful contribution
-- ---------------------------------------------------------------------------

select public.rwa_reserve_contribution(
  'a3333333-3333-4333-8333-333333333333', 'idem-c', '99999999-9999-4999-8999-999999999999',
  '11111111-1111-4111-8111-111111111111', 'GWALLETA0000000000000000000000000000000000000000000000000000',
  100::bigint, 900);

update public.rwa_contributions
set status = 'expired', reservation_expires_at = now() - interval '1 hour'
where attempt_id = 'a3333333-3333-4333-8333-333333333333';

select public.rwa_confirm_contribution(
  'a3333333-3333-4333-8333-333333333333', repeat('d1', 32), 'receipt-c', 0,
  13, 'GWALLETA0000000000000000000000000000000000000000000000000000',
  100::bigint, 1::bigint, 100::bigint, 1::bigint,
  (select contribution_ref from public.rwa_contributions where attempt_id = 'a3333333-3333-4333-8333-333333333333'),
  0);

select is(
  (select status from public.rwa_contributions where attempt_id = 'a3333333-3333-4333-8333-333333333333'),
  'confirmed',
  'an expired reservation can still be confirmed'
);

select is(
  (select funded_principal_units from public.rwa_assets where id = '99999999-9999-4999-8999-999999999999'),
  100::bigint,
  'the confirmed contribution is projected after the reservation expired'
);

select * from finish();
rollback;
