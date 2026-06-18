drop policy if exists "supplier_products_select_all" on public.supplier_products;

create policy "supplier_products_select_all"
  on public.supplier_products
  for select
  using (true);
