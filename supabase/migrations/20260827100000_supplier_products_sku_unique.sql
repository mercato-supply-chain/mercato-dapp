-- Case-insensitive uniqueness for nonempty SKU values within each supplier company.
-- Rows with sku IS NULL or sku = '' are excluded (NULLS are not equal in unique indexes).
--
-- This enforces that no two products owned by the same supplier_id share a SKU
-- (compared case-insensitively), while still allowing multiple products without SKUs.

-- Drop the previous non-unique index on supplier_id + sku so the unique one takes over.
drop index if exists public.supplier_products_sku_idx;

-- Create a partial unique index on the lower-case SKU so concurrent inserts are
-- rejected at the database level even when the application pre-checks don't catch races.
create unique index if not exists supplier_products_sku_unique_idx
  on public.supplier_products (supplier_id, lower(sku))
  where sku is not null and trim(sku) <> '';

comment on index public.supplier_products_sku_unique_idx
  is 'Enforces case-insensitive SKU uniqueness per supplier company. Rows with no SKU (null or empty) are excluded.';
