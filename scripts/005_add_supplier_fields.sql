-- Add supplier-specific fields to profiles table
alter table public.profiles
  add column if not exists bio text,
  add column if not exists categories text[], -- array of categories they supply
  add column if not exists products text[], -- array of products they offer
  add column if not exists website text,
  add column if not exists address text,
  add column if not exists verified boolean default false;

-- Create an index on categories for faster filtering
create index if not exists profiles_categories_idx on public.profiles using gin(categories);

-- Create an index on user_type for faster filtering
create index if not exists profiles_user_type_idx on public.profiles(user_type);
