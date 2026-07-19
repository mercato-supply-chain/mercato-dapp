create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_type text := nullif(trim(coalesce(new.raw_user_meta_data->>'user_type', '')), '');
  resolved_type text;
  referred_by text := nullif(trim(coalesce(new.raw_user_meta_data->>'referred_by_supplier_id', '')), '');
  resolved_referred_by uuid;
begin
  if meta_type in ('pyme', 'investor', 'supplier', 'admin') then
    resolved_type := meta_type;
  else
    resolved_type := null;
  end if;

  begin
    resolved_referred_by := referred_by::uuid;
  exception when others then
    resolved_referred_by := null;
  end;

  insert into public.profiles (id, email, user_type, company_name, contact_name, full_name, referred_by_supplier_id)
  values (
    new.id,
    new.email,
    resolved_type,
    coalesce(new.raw_user_meta_data->>'company_name', null),
    coalesce(new.raw_user_meta_data->>'contact_name', new.raw_user_meta_data->>'full_name', null),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'contact_name', null),
    resolved_referred_by
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
