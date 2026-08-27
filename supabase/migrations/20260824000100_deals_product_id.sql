-- Link deals to supplier catalog products for product-level analytics.
-- Snapshot fields (product_name, product_unit_price, etc.) remain authoritative for historical display.

alter table public.deals
  add column if not exists product_id uuid references public.supplier_products(id) on delete set null;

comment on column public.deals.product_id is
  'FK to supplier_products for analytics. Nullable for legacy deals. ON DELETE SET NULL preserves historical deals.';

create index if not exists deals_product_id_idx on public.deals (product_id);

create index if not exists deals_supplier_id_status_idx on public.deals (supplier_id, status);

create index if not exists deals_product_id_status_idx on public.deals (product_id, status);

-- Conservative backfill: only when exactly one catalog product matches supplier + name + unit price.
-- Name-only matching is intentionally excluded (ambiguous catalogs, renames, duplicate names).
update public.deals d
set product_id = m.product_id
from (
  select
    d2.id as deal_id,
    min(sp.id) as product_id
  from public.deals d2
  inner join public.supplier_products sp
    on sp.supplier_id = d2.supplier_id
    and sp.name = d2.product_name
    and sp.price_per_unit = d2.product_unit_price
  where d2.product_id is null
    and d2.supplier_id is not null
  group by d2.id
  having count(*) = 1
) m
where d.id = m.deal_id
  and d.product_id is null;
