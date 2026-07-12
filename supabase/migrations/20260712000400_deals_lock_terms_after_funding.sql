-- Guard commercial deal-term edits:
-- 1) After funding: terms are immutable (funding / delivery / repayment updates still OK).
-- 2) Before funding: only the PyME creator or an admin may change terms.
-- Investor funding (investor_id / funded_at / status / funding_tx_hash) does not
-- touch commercial columns, so it remains allowed via the seeking_funding policy.

create or replace function public.enforce_deal_terms_edit_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  was_funded boolean;
  terms_changed boolean;
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
