-- Sync useful referral improvements from main without adopting referral_code column.
-- Keeps develop's UUID-based referral model (supplier_companies.id as referral code).

-- Prevent tampering with referral attribution after signup.
create or replace function public.lock_referred_by_supplier_id()
returns trigger
language plpgsql
as $$
begin
  new.referred_by_supplier_id := old.referred_by_supplier_id;
  return new;
end;
$$;

drop trigger if exists profiles_lock_referred_by on public.profiles;
create trigger profiles_lock_referred_by
  before update on public.profiles
  for each row
  execute function public.lock_referred_by_supplier_id();

-- Merge main's user_type validation and full_name handling with develop's UUID referral validation.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_type text := nullif(trim(coalesce(new.raw_user_meta_data->>'user_type', '')), '');
  resolved_type text;
  v_referred_by uuid;
begin
  if meta_type in ('pyme', 'investor', 'supplier', 'admin') then
    resolved_type := meta_type;
  else
    resolved_type := null;
  end if;

  if new.raw_user_meta_data->>'referred_by_supplier_id' is not null then
    begin
      v_referred_by := (new.raw_user_meta_data->>'referred_by_supplier_id')::uuid;
      if not exists (select 1 from public.supplier_companies where id = v_referred_by) then
        v_referred_by := null;
      end if;
    exception when others then
      v_referred_by := null;
    end;
  end if;

  insert into public.profiles (
    id,
    email,
    user_type,
    company_name,
    contact_name,
    full_name,
    referred_by_supplier_id
  )
  values (
    new.id,
    new.email,
    resolved_type,
    coalesce(new.raw_user_meta_data->>'company_name', null),
    coalesce(new.raw_user_meta_data->>'contact_name', new.raw_user_meta_data->>'full_name', null),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'contact_name', null),
    v_referred_by
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Unified notification types across develop and main branches.
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check check (type in (
    'deal_created',
    'deal_funded',
    'milestone_1_approved',
    'milestone_2_approved',
    'pyme_investor_deal_created',
    'pyme_investor_deal_complete',
    'repayment_escrow_needed',
    'repayment_escrow_created',
    'goods_shipped',
    'pyme_referred'
  ));
