-- Create function to auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, user_type, company_name, contact_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'user_type', 'pyme'),
    coalesce(new.raw_user_meta_data->>'company_name', null),
    coalesce(new.raw_user_meta_data->>'contact_name', null)
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Create trigger
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
