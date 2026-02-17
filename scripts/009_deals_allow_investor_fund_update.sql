-- Allow any authenticated user to update a deal that is still seeking_funding.
-- This is needed so the investor can set investor_id, status, and funded_at when they fund the deal.
-- Once status is no longer seeking_funding, only stakeholders (pyme, supplier, investor) can update.
create policy "deals_update_when_seeking_funding" on public.deals
  for update
  using (status = 'seeking_funding');
