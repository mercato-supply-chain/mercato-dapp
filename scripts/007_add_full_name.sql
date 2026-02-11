-- Add full_name column to profiles (app uses full_name, schema had contact_name)
alter table public.profiles
  add column if not exists full_name text;

-- Migrate existing contact_name data to full_name
update public.profiles
  set full_name = contact_name
  where full_name is null and contact_name is not null;

-- Update trigger to populate full_name from signup metadata (full_name or contact_name)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, user_type, company_name, contact_name, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'user_type', 'pyme'),
    coalesce(new.raw_user_meta_data->>'company_name', null),
    coalesce(new.raw_user_meta_data->>'contact_name', new.raw_user_meta_data->>'full_name', null),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'contact_name', null)
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
