drop policy if exists "deals_update_when_seeking_funding" on public.deals;

create policy "deals_update_when_seeking_funding" on public.deals
  for update
  using (status = 'seeking_funding');
