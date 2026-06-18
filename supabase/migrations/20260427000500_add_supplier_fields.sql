alter table public.profiles
  add column if not exists bio text,
  add column if not exists categories text[],
  add column if not exists products text[],
  add column if not exists website text,
  add column if not exists address text,
  add column if not exists verified boolean default false;

create index if not exists profiles_categories_idx on public.profiles using gin(categories);
create index if not exists profiles_user_type_idx on public.profiles(user_type);
