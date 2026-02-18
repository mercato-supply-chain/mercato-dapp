-- LATAM-focused fields for suppliers and PYMEs
-- Profiles: sector (e.g. Food Manufacturing), country already exists
alter table public.profiles
  add column if not exists sector text;

-- Product-level: minimum order (USD), typical delivery time (e.g. "7–10 days")
-- supplier_products table must already exist
alter table public.supplier_products
  add column if not exists minimum_order numeric,
  add column if not exists delivery_time text;

create index if not exists profiles_sector_idx on public.profiles(sector);
create index if not exists profiles_country_idx on public.profiles(country);
