-- Add referral tracking to profiles.
-- No changes to supplier_companies — uses existing id (UUID) as the referral code.

alter table public.profiles
  add column if not exists referred_by_supplier_id uuid references public.supplier_companies(id) on delete set null;

-- Update the profile creation trigger to persist referred_by_supplier_id from signup metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referred_by uuid;
begin
  -- Resolve referral: validate the UUID exists in supplier_companies, ignore if invalid or not found.
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

  insert into public.profiles (id, email, user_type, company_name, contact_name, referred_by_supplier_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'user_type', null),
    coalesce(new.raw_user_meta_data->>'company_name', null),
    coalesce(new.raw_user_meta_data->>'contact_name', null),
    v_referred_by
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
