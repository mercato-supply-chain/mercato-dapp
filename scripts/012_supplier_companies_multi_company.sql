-- One user can own multiple supplier companies.
-- supplier_companies.owner_id = auth user; supplier_products and deals point to company id.
-- Run this only if not already applied via Supabase MCP (apply_migration).

create table if not exists public.supplier_companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  company_name text,
  contact_name text,
  full_name text,
  bio text,
  categories text[],
  products text[],
  website text,
  address text,
  phone text,
  country text,
  sector text,
  verified boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.supplier_companies enable row level security;

create policy "supplier_companies_select_all" on public.supplier_companies for select using (true);
create policy "supplier_companies_insert_own" on public.supplier_companies for insert with check (auth.uid() = owner_id);
create policy "supplier_companies_update_own" on public.supplier_companies for update using (auth.uid() = owner_id);
create policy "supplier_companies_delete_own" on public.supplier_companies for delete using (auth.uid() = owner_id);

create index idx_supplier_companies_owner_id on public.supplier_companies(owner_id);
create index idx_supplier_companies_company_name on public.supplier_companies(company_name);

-- Migrate one company per supplier profile
insert into public.supplier_companies (
  owner_id, company_name, contact_name, full_name, bio, categories, products,
  website, address, phone, country, sector, verified
)
select id, company_name, contact_name, full_name, bio, categories, products,
  website, address, phone, country, sector, coalesce(verified, false)
from public.profiles where user_type = 'supplier';

-- supplier_products: point to company
drop policy if exists "Suppliers can manage own products" on public.supplier_products;
alter table public.supplier_products add column if not exists company_id uuid references public.supplier_companies(id) on delete cascade;
update public.supplier_products sp set company_id = (select id from public.supplier_companies sc where sc.owner_id = sp.supplier_id limit 1) where company_id is null;
alter table public.supplier_products drop constraint if exists supplier_products_supplier_id_fkey;
alter table public.supplier_products drop column supplier_id;
alter table public.supplier_products rename column company_id to supplier_id;
alter table public.supplier_products alter column supplier_id set not null;
create policy "Suppliers can manage own products" on public.supplier_products for all using (
  exists (select 1 from public.supplier_companies sc where sc.id = supplier_products.supplier_id and sc.owner_id = auth.uid())
);

-- deals: point to company; drop milestone policies that reference deals.supplier_id first
drop policy if exists "milestones_insert_stakeholders" on public.milestones;
drop policy if exists "milestones_update_stakeholders" on public.milestones;
drop policy if exists "deals_update_stakeholders" on public.deals;

alter table public.deals add column if not exists supplier_company_id uuid references public.supplier_companies(id) on delete set null;
update public.deals d set supplier_company_id = (select id from public.supplier_companies sc where sc.owner_id = d.supplier_id limit 1) where d.supplier_id is not null and supplier_company_id is null;
alter table public.deals drop constraint if exists deals_supplier_id_fkey;
alter table public.deals drop column supplier_id;
alter table public.deals rename column supplier_company_id to supplier_id;

create policy "deals_update_stakeholders" on public.deals for update using (
  auth.uid() = pyme_id or auth.uid() = investor_id
  or exists (select 1 from public.supplier_companies sc where sc.id = deals.supplier_id and sc.owner_id = auth.uid())
);
create policy "milestones_insert_stakeholders" on public.milestones for insert with check (
  exists (select 1 from public.deals where deals.id = milestones.deal_id and (
    deals.pyme_id = auth.uid() or deals.investor_id = auth.uid()
    or exists (select 1 from public.supplier_companies sc where sc.id = deals.supplier_id and sc.owner_id = auth.uid())
  ))
);
create policy "milestones_update_stakeholders" on public.milestones for update using (
  exists (select 1 from public.deals where deals.id = milestones.deal_id and (
    deals.pyme_id = auth.uid() or deals.investor_id = auth.uid()
    or exists (select 1 from public.supplier_companies sc where sc.id = deals.supplier_id and sc.owner_id = auth.uid())
  ))
);

create index if not exists idx_deals_supplier_id on public.deals(supplier_id);
