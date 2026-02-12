-- Allow 'admin' in profiles.user_type for platform admins who approve milestones
alter table public.profiles
  drop constraint if exists profiles_user_type_check;

alter table public.profiles
  add constraint profiles_user_type_check
  check (user_type in ('pyme', 'investor', 'supplier', 'admin'));
