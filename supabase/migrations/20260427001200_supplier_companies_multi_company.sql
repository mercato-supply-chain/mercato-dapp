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

drop policy if exists "supplier_companies_select_all" on public.supplier_companies;
create policy "supplier_companies_select_all" on public.supplier_companies for select using (true);

drop policy if exists "supplier_companies_insert_own" on public.supplier_companies;
create policy "supplier_companies_insert_own" on public.supplier_companies for insert with check (auth.uid() = owner_id);

drop policy if exists "supplier_companies_update_own" on public.supplier_companies;
create policy "supplier_companies_update_own" on public.supplier_companies for update using (auth.uid() = owner_id);

drop policy if exists "supplier_companies_delete_own" on public.supplier_companies;
create policy "supplier_companies_delete_own" on public.supplier_companies for delete using (auth.uid() = owner_id);

create index if not exists idx_supplier_companies_owner_id on public.supplier_companies(owner_id);
create index if not exists idx_supplier_companies_company_name on public.supplier_companies(company_name);

insert into public.supplier_companies (
  owner_id,
  company_name,
  contact_name,
  full_name,
  bio,
  categories,
  products,
  website,
  address,
  phone,
  country,
  sector,
  verified
)
select
  p.id,
  p.company_name,
  p.contact_name,
  p.full_name,
  p.bio,
  p.categories,
  p.products,
  p.website,
  p.address,
  p.phone,
  p.country,
  p.sector,
  coalesce(p.verified, false)
from public.profiles p
where p.user_type = 'supplier'
  and not exists (
    select 1
    from public.supplier_companies sc
    where sc.owner_id = p.id
  );

do $$
declare
  supplier_products_uses_profiles boolean := false;
  deals_supplier_uses_profiles boolean := false;
begin
  select exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    join pg_class rt on rt.oid = c.confrelid
    join pg_namespace rn on rn.oid = rt.relnamespace
    where c.contype = 'f'
      and n.nspname = 'public'
      and t.relname = 'supplier_products'
      and c.conname = 'supplier_products_supplier_id_fkey'
      and rn.nspname = 'public'
      and rt.relname = 'profiles'
  ) into supplier_products_uses_profiles;

  if supplier_products_uses_profiles then
    alter table public.supplier_products
      add column if not exists company_id uuid references public.supplier_companies(id) on delete cascade;

    update public.supplier_products sp
    set company_id = (
      select sc.id
      from public.supplier_companies sc
      where sc.owner_id = sp.supplier_id
      limit 1
    )
    where company_id is null;

    alter table public.supplier_products drop constraint if exists supplier_products_supplier_id_fkey;
    alter table public.supplier_products drop column if exists supplier_id;
    alter table public.supplier_products rename column company_id to supplier_id;
    alter table public.supplier_products alter column supplier_id set not null;
  end if;

  select exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    join pg_class rt on rt.oid = c.confrelid
    join pg_namespace rn on rn.oid = rt.relnamespace
    where c.contype = 'f'
      and n.nspname = 'public'
      and t.relname = 'deals'
      and c.conname = 'deals_supplier_id_fkey'
      and rn.nspname = 'public'
      and rt.relname = 'profiles'
  ) into deals_supplier_uses_profiles;

  if deals_supplier_uses_profiles then
    alter table public.deals
      add column if not exists supplier_company_id uuid references public.supplier_companies(id) on delete set null;

    update public.deals d
    set supplier_company_id = (
      select sc.id
      from public.supplier_companies sc
      where sc.owner_id = d.supplier_id
      limit 1
    )
    where d.supplier_id is not null
      and supplier_company_id is null;

    alter table public.deals drop constraint if exists deals_supplier_id_fkey;
    alter table public.deals drop column if exists supplier_id;
    alter table public.deals rename column supplier_company_id to supplier_id;
  end if;
end $$;

drop policy if exists "Suppliers can manage own products" on public.supplier_products;
create policy "Suppliers can manage own products" on public.supplier_products
  for all using (
    exists (
      select 1
      from public.supplier_companies sc
      where sc.id = supplier_products.supplier_id
        and sc.owner_id = auth.uid()
    )
  );

drop policy if exists "milestones_insert_stakeholders" on public.milestones;
create policy "milestones_insert_stakeholders" on public.milestones
  for insert with check (
    exists (
      select 1
      from public.deals
      where deals.id = milestones.deal_id
        and (
          deals.pyme_id = auth.uid()
          or deals.investor_id = auth.uid()
          or exists (
            select 1
            from public.supplier_companies sc
            where sc.id = deals.supplier_id
              and sc.owner_id = auth.uid()
          )
        )
    )
  );

drop policy if exists "milestones_update_stakeholders" on public.milestones;
create policy "milestones_update_stakeholders" on public.milestones
  for update using (
    exists (
      select 1
      from public.deals
      where deals.id = milestones.deal_id
        and (
          deals.pyme_id = auth.uid()
          or deals.investor_id = auth.uid()
          or exists (
            select 1
            from public.supplier_companies sc
            where sc.id = deals.supplier_id
              and sc.owner_id = auth.uid()
          )
        )
    )
  );

drop policy if exists "deals_update_stakeholders" on public.deals;
create policy "deals_update_stakeholders" on public.deals
  for update using (
    auth.uid() = pyme_id
    or auth.uid() = investor_id
    or exists (
      select 1
      from public.supplier_companies sc
      where sc.id = deals.supplier_id
        and sc.owner_id = auth.uid()
    )
  );

create index if not exists idx_deals_supplier_id on public.deals(supplier_id);
