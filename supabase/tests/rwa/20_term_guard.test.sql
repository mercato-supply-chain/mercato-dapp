-- Deal-term guard eligibility: edit, delete, reopen and opt-in, for legacy and RWA deals.

begin;

create extension if not exists pgtap;

select plan(15);

-- ---------------------------------------------------------------------------
-- Seed
-- ---------------------------------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'investor-a@example.test', '{"user_type":"investor"}'),
  ('33333333-3333-4333-8333-333333333333', 'pyme@example.test', '{"user_type":"pyme"}'),
  ('44444444-4444-4444-8444-444444444444', 'supplier@example.test', '{"user_type":"supplier"}'),
  ('55555555-5555-4555-8555-555555555555', 'admin@example.test', '{"user_type":"admin"}');

update public.profiles set user_type = 'investor'
  where id = '11111111-1111-4111-8111-111111111111';
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
) values
  ('77777777-7777-4777-8777-777777777771',
   '33333333-3333-4333-8333-333333333333', '66666666-6666-4666-8666-666666666666',
   'Legacy editable', 'Legacy deal', 'Food & Beverage', 'Coffee', 10, 100, 'Supplier Co',
   1000, 10, 60, null, null),
  ('77777777-7777-4777-8777-777777777772',
   '33333333-3333-4333-8333-333333333333', '66666666-6666-4666-8666-666666666666',
   'Legacy funded', 'Legacy funded deal', 'Food & Beverage', 'Coffee', 10, 100, 'Supplier Co',
   1000, 10, 60, null, null),
  ('77777777-7777-4777-8777-777777777773',
   '33333333-3333-4333-8333-333333333333', '66666666-6666-4666-8666-666666666666',
   'Legacy delete me', 'Legacy delete deal', 'Food & Beverage', 'Coffee', 10, 100, 'Supplier Co',
   1000, 10, 60, null, null),
  ('77777777-7777-4777-8777-777777777774',
   '33333333-3333-4333-8333-333333333333', '66666666-6666-4666-8666-666666666666',
   'RWA opted in', 'RWA deal with issuance', 'Food & Beverage', 'Coffee', 10, 100, 'Supplier Co',
   1000, 10, 60, 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', '2026-10-01T00:00:00Z'),
  ('77777777-7777-4777-8777-777777777775',
   '33333333-3333-4333-8333-333333333333', '66666666-6666-4666-8666-666666666666',
   'Opted in only', 'RWA opted in, no issuance yet', 'Food & Beverage', 'Coffee', 10, 100,
   'Supplier Co', 1000, 10, 60, null, null),
  ('77777777-7777-4777-8777-777777777776',
   '33333333-3333-4333-8333-333333333333', '66666666-6666-4666-8666-666666666666',
   'Funded before opt-in', 'Cannot opt in after funding', 'Food & Beverage', 'Coffee', 10, 100,
   'Supplier Co', 1000, 10, 60, null, null);

-- Legacy funded deal keeps its single investor (legacy direct-funding path is preserved).
update public.deals
set investor_id = '11111111-1111-4111-8111-111111111111',
    funded_at = now(),
    status = 'funded'
where id = '77777777-7777-4777-8777-777777777772';

update public.deals
set investor_id = '11111111-1111-4111-8111-111111111111',
    funded_at = now(),
    status = 'funded'
where id = '77777777-7777-4777-8777-777777777776';

-- ---------------------------------------------------------------------------
-- PyME: legacy behaviour is preserved
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
set local request.jwt.claim.role = 'authenticated';

select lives_ok(
  $$ update public.deals set title = 'Legacy editable (renamed)' where id = '77777777-7777-4777-8777-777777777771' $$,
  'the PyME can still edit an unfunded legacy deal'
);

select lives_ok(
  $$ delete from public.deals where id = '77777777-7777-4777-8777-777777777773' $$,
  'an unfunded legacy deal can still be deleted'
);

select throws_ok(
  $$ update public.deals set title = 'Nope' where id = '77777777-7777-4777-8777-777777777772' $$,
  'P0001',
  'Deal terms cannot be edited after an investor has funded the deal',
  'funded legacy deals keep their existing term lock'
);

select throws_ok(
  $$ update public.deals set rwa_opted_in = true where id = '77777777-7777-4777-8777-777777777776' $$,
  '23514',
  'RWA opt-in must happen before any funding',
  'a funded deal cannot opt in to RWA afterwards'
);

select lives_ok(
  $$ update public.deals set rwa_opted_in = true where id = '77777777-7777-4777-8777-777777777774' $$,
  'the PyME can opt a deal in while it is unfunded'
);

select lives_ok(
  $$ update public.deals set rwa_opted_in = true where id = '77777777-7777-4777-8777-777777777775' $$,
  'the PyME can opt in a second unfunded deal'
);

select lives_ok(
  $$ update public.deals set title = 'Opted in only (renamed)' where id = '77777777-7777-4777-8777-777777777775' $$,
  'opt-in alone does not freeze terms'
);

reset role;

-- Supplier cannot opt a deal in.
set local role authenticated;
set local request.jwt.claim.sub = '44444444-4444-4444-8444-444444444444';
set local request.jwt.claim.role = 'authenticated';

select throws_ok(
  $$ update public.deals set rwa_opted_in = true where id = '77777777-7777-4777-8777-777777777771' $$,
  '42501',
  'Only the deal creator or an admin can opt a deal in to RWA',
  'the supplier cannot opt a deal in to RWA'
);

reset role;

-- ---------------------------------------------------------------------------
-- Admin issues the credit asset, then contributes partially
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = '55555555-5555-4555-8555-555555555555';
set local request.jwt.claim.role = 'authenticated';

select public.rwa_issue_credit_asset(
  '77777777-7777-4777-8777-777777777774',
  'testnet',
  'CBRWARE0000000000000000000000000000000000000000000000',
  'CRA-0001',
  'USDC',
  'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
  7::smallint, 10000000000, 1500000, 100000000, 150, 60,
  '{"platform_fee_bps":100,"tw_fee_bps":30,"rounding_policy":"half_up_atomic","charged_at":"funding"}'::jsonb,
  '{"snapshot_version":"1","deal_id":"77777777-7777-4777-8777-777777777774","network":"testnet","asset_code":"USDC","asset_issuer":"GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5","asset_decimals":"7","principal_atomic":"10000000000","return_numerator":"1500000","return_denominator":"100000000","display_yield_bps":"150","term_days":"60","maturity_policy":"delivery_relative","issued_at":"2026-10-20T12:34:56.000Z","issuance_identity":"testnet:CBRWARE0000000000000000000000000000000000000000000000:CRA-0001"}'::jsonb,
  repeat('a', 64),
  'f00dfeed00000000000000000000000000000000000000000000000000000001',
  'op-issued-0001', 101,
  ('[{"kind":"financing_agreement","opaque_ref":"doc_0001","content_hash":"'
    || repeat('b', 64) || '","byte_length":"18432"}]')::jsonb
);

reset role;

-- Only 40% funded: the deal is partially funded, never "fully funded".
insert into public.rwa_contribution_attempts (
  id, credit_asset_id, investor_profile_id, investor_wallet, amount_atomic,
  asset_code, asset_decimals, idempotency_key
)
select '99999999-9999-4999-8999-999999999991', a.id,
  '11111111-1111-4111-8111-111111111111',
  'GINVESTORA000000000000000000000000000000000000000000000', 4000000000,
  'USDC', 7, 'idem-a'
from public.rwa_credit_assets a
where a.deal_id = '77777777-7777-4777-8777-777777777774';

set local role service_role;
set local request.jwt.claim.role = 'service_role';

select public.rwa_confirm_contribution(
  '99999999-9999-4999-8999-999999999991', 'testnet',
  'CBRWARE0000000000000000000000000000000000000000000000',
  'f00dfeed00000000000000000000000000000000000000000000000000000011',
  'op-a', 102, 4000000000
);

reset role;

-- Move the deal out of seeking_funding through the normal lifecycle (allowed).
update public.deals set status = 'in_progress'
where id = '77777777-7777-4777-8777-777777777774';

select is(
  (select state from public.rwa_credit_assets
    where deal_id = '77777777-7777-4777-8777-777777777774'),
  'partially_funded',
  'a partially funded issuance is reflected in the credit-asset state'
);

-- ---------------------------------------------------------------------------
-- Partially funded RWA deals are locked, including through the legacy path
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
set local request.jwt.claim.role = 'authenticated';

select throws_ok(
  $$ update public.deals set title = 'Try again' where id = '77777777-7777-4777-8777-777777777774' $$,
  '23514',
  'Deal terms are frozen once an RWA issuance or contribution exists',
  'a partially funded RWA deal cannot be edited'
);

select throws_ok(
  $$ update public.deals set status = 'seeking_funding' where id = '77777777-7777-4777-8777-777777777774' $$,
  '23514',
  'RWA deals cannot be reopened',
  'a partially funded RWA deal cannot be reopened'
);

select throws_ok(
  $$ update public.deals set funding_expires_at = now() + interval '30 days' where id = '77777777-7777-4777-8777-777777777774' $$,
  '23514',
  'RWA deals cannot have their funding window extended',
  'the funding window of an RWA deal with contributions cannot be extended'
);

select throws_ok(
  $$ update public.deals set rwa_opted_in = false where id = '77777777-7777-4777-8777-777777777774' $$,
  '23514',
  'RWA opt-in cannot be disabled once issuance or contributions exist',
  'RWA routing cannot be switched off once issuance exists'
);

reset role;

-- The delete guard is independent of the delete RLS policy, so exercise it as the owner role.
select throws_ok(
  $$ delete from public.deals where id = '77777777-7777-4777-8777-777777777774' $$,
  '23514',
  'Deals with RWA issuance, positions or contributions cannot be deleted',
  'an RWA deal with evidence cannot be deleted'
);

select is(
  (select count(*)::int from public.deals where id = '77777777-7777-4777-8777-777777777774'),
  1,
  'the RWA deal survives every delete attempt'
);

select * from finish();
rollback;
