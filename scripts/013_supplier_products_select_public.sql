-- Allow anyone to read supplier_products so PyMEs can load the catalog on Create Deal.
-- Suppliers still manage their own rows via "Suppliers can manage own products" (insert/update/delete).
-- Run in Supabase Dashboard SQL Editor or via CLI.

create policy "supplier_products_select_all"
  on public.supplier_products
  for select
  using (true);
