-- Allow new accounts (e.g. Pollar) to onboard without a default SMB role.
alter table public.profiles
  alter column user_type drop not null;

alter table public.profiles
  drop constraint if exists profiles_user_type_check;

alter table public.profiles
  add constraint profiles_user_type_check
  check (
    user_type is null
    or user_type in ('pyme', 'investor', 'supplier', 'admin')
  );

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_type text := nullif(trim(coalesce(new.raw_user_meta_data->>'user_type', '')), '');
  resolved_type text;
begin
  if meta_type in ('pyme', 'investor', 'supplier', 'admin') then
    resolved_type := meta_type;
  else
    resolved_type := null;
  end if;

  insert into public.profiles (id, email, user_type, company_name, contact_name, full_name)
  values (
    new.id,
    new.email,
    resolved_type,
    coalesce(new.raw_user_meta_data->>'company_name', null),
    coalesce(new.raw_user_meta_data->>'contact_name', new.raw_user_meta_data->>'full_name', null),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'contact_name', null)
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
