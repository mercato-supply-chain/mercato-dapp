-- RWA funding authorization: a browser session must never be able to write
-- the financial state of a funding pool.
--
-- Run with: supabase test db

begin;

select plan(13);

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
  ('44444444-4444-4444-8444-444444444444', '33333333-3333-4333-8333-333333333333', 'RWA order', 'desc', 'goods', 'Widgets', 10, 100, 'Supplier', 1000, 5, 30, 'seeking_funding', 'rwa'),
  ('55555555-5555-4555-8555-555555555555', '33333333-3333-4333-8333-333333333333', 'Legacy order', 'desc', 'goods', 'Widgets', 10, 100, 'Supplier', 1000, 5, 30, 'seeking_funding', 'legacy');

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
  7, 1000, 'GSUPPLIER000000000000000000000000000000000000000000000000000',
  'GFEE0000000000000000000000000000000000000000000000000000000000',
  'GEXCESS0000000000000000000000000000000000000000000000000000000',
  100, 1, now() + interval '7 days', '44444444-4444-4444-8444-444444444444'
);

insert into public.rwa_contributions (
  attempt_id, idempotency_key, asset_row_id, network, asset_id,
  funding_pool_contract_id, investor_id, investor_address, principal_units,
  nonce, contribution_ref, status
)
values (
  '77777777-7777-4777-8777-777777777777', 'idem-a', '66666666-6666-4666-8666-666666666666',
  'testnet', repeat('ab', 32), 'CPOOL000000000000000000000000000000000000000000000000000000',
  '11111111-1111-4111-8111-111111111111', 'GWALLET000000000000000000000000000000000000000000000000000000',
  600, 1, repeat('cd', 32), 'submitted'
);

insert into public.rwa_positions (
  asset_row_id, network, asset_id, position_id, investor_id, investor_address,
  principal_units, ownership_units, funding_fee_units, contribution_count,
  last_nonce, last_contribution_ref
)
values (
  '66666666-6666-4666-8666-666666666666', 'testnet', repeat('ab', 32), 0,
  '11111111-1111-4111-8111-111111111111', 'GWALLET000000000000000000000000000000000000000000000000000000',
  600, 600, 6, 1, 1, repeat('cd', 32)
);

-- ---------------------------------------------------------------------------
-- A browser session cannot write the financial state
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

-- Setting confirmed units directly.
select throws_ok(
  $$ update public.rwa_positions set principal_units = 999999 where investor_id = '11111111-1111-4111-8111-111111111111' $$,
  '42501',
  'new row violates row-level security policy for table "rwa_positions"',
  'an investor cannot set confirmed units'
);

-- Rewriting a contribution attempt.
select throws_ok(
  $$ update public.rwa_contributions set status = 'confirmed', principal_units = 1 where investor_id = '11111111-1111-4111-8111-111111111111' $$,
  '42501',
  'new row violates row-level security policy for table "rwa_contributions"',
  'an investor cannot rewrite a contribution attempt'
);

-- Marking the pool as settled, or the supplier as paid, directly.
select throws_ok(
  $$ update public.rwa_assets set lifecycle = 'settled', supplier_paid_at = now() $$,
  '42501',
  'new row violates row-level security policy for table "rwa_assets"',
  'an investor cannot mark the supplier as paid'
);

-- The protected operations are not callable from a browser session.
select throws_ok(
  $$ select public.rwa_reserve_contribution(
       '88888888-8888-4888-8888-888888888888', 'browser', '66666666-6666-4666-8666-666666666666',
       '11111111-1111-4111-8111-111111111111', 'GWALLET000000000000000000000000000000000000000000000000000000',
       100::bigint, 900) $$,
  '42501',
  'forbidden',
  'a browser session cannot reserve funding capacity'
);

select throws_ok(
  $$ select public.rwa_confirm_contribution(
       '77777777-7777-4777-8777-777777777777', repeat('ef', 32), 'browser-receipt', 0,
       null, 'GWALLET000000000000000000000000000000000000000000000000000000',
       600::bigint, 6::bigint, 600::bigint, 1::bigint, repeat('cd', 32), 0) $$,
  '42501',
  'forbidden',
  'a browser session cannot confirm a contribution'
);

select throws_ok(
  $$ select public.rwa_mark_supplier_paid('66666666-6666-4666-8666-666666666666', repeat('ef', 32), null) $$,
  '42501',
  'forbidden',
  'a browser session cannot mark the supplier as paid'
);

select throws_ok(
  $$ select public.rwa_record_refund('66666666-6666-4666-8666-666666666666', 0, repeat('ef', 32), 600::bigint, null) $$,
  '42501',
  'forbidden',
  'a browser session cannot record a refund'
);

reset role;

-- The RWA trigger closes the broad deal update policies for RWA-mode deals.
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

update public.deals set investor_id = '11111111-1111-4111-8111-111111111111'
where id = '44444444-4444-4444-8444-444444444444';

select throws_ok(
  $$ update public.deals set status = 'funded', funded_at = now() where id = '44444444-4444-4444-8444-444444444444' $$,
  '42501',
  'RWA funding columns are server-authorised',
  'the funding columns of an RWA deal cannot be set from a browser session'
);

select throws_ok(
  $$ update public.deals set funding_tx_hash = 'deadbeef' where id = '44444444-4444-4444-8444-444444444444' $$,
  '42501',
  'RWA funding columns are server-authorised',
  'the funding hash of an RWA deal cannot be set from a browser session'
);

select throws_ok(
  $$ update public.deals set amount = 1 where id = '44444444-4444-4444-8444-444444444444' $$,
  '42501',
  'RWA deal terms are locked',
  'the terms of an RWA deal cannot be changed from a browser session'
);

-- A deal must not be able to slip out of RWA mode in the same statement that
-- sets its funding columns.
select throws_ok(
  $$ update public.deals
     set funding_mode = 'legacy',
         investor_id = '11111111-1111-4111-8111-111111111111',
         status = 'funded',
         funded_at = now(),
         funding_tx_hash = 'deadbeef'
   where id = '44444444-4444-4444-8444-444444444444' $$,
  '42501',
  'RWA funding mode is server-authorised',
  'an RWA deal cannot be flipped to legacy mode from a browser session'
);

select throws_ok(
  $$ update public.deals set funding_mode = 'legacy' where id = '44444444-4444-4444-8444-444444444444' $$,
  '42501',
  'RWA funding mode is server-authorised',
  'the funding mode of an RWA deal cannot be changed from a browser session'
);

reset role;

-- Legacy single-investor funding still works.
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

update public.deals
set investor_id = '11111111-1111-4111-8111-111111111111',
    status = 'funded',
    funded_at = now()
where id = '55555555-5555-4555-8555-555555555555';

select is(
  (select status from public.deals where id = '55555555-5555-4555-8555-555555555555'),
  'funded',
  'the legacy funding path still lets an investor fund a legacy deal'
);

reset role;

select * from finish();
rollback;
