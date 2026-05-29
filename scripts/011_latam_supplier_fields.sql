-- LATAM-focused fields for suppliers and PYMEs
-- Profiles: sector (e.g. Food Manufacturing), country already exists
alter table public.profiles
  add column if not exists sector text;

-- Create supplier_products table if it does not exist
create table if not exists public.supplier_products (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  category text not null,
  price_per_unit numeric not null,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Product-level: minimum order (USD), typical delivery time (e.g. "7–10 days")
alter table public.supplier_products
  add column if not exists minimum_order numeric,
  add column if not exists delivery_time text;

create index if not exists profiles_sector_idx on public.profiles(sector);
create index if not exists profiles_country_idx on public.profiles(country);
