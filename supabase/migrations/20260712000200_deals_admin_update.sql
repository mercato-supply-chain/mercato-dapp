-- Allow admins to update deals (repayment escrow deploy, releases, etc.)

drop policy if exists "deals_update_admin" on public.deals;
create policy "deals_update_admin" on public.deals
  for update using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.user_type = 'admin'
    )
  );
