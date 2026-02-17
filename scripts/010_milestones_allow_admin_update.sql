-- Allow admins to update milestones (e.g. set status = 'completed' after approving release on-chain).
-- Without this, only deal stakeholders can update; the admin approval flow updates the DB after the on-chain tx.
create policy "milestones_update_admin" on public.milestones
  for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.user_type = 'admin'
    )
  );

-- If you already approved a milestone on-chain but the DB still shows "awaiting release", run as admin (after this policy is applied):
--   update public.milestones set status = 'completed', completed_at = now(), updated_at = now() where id = '<milestone-uuid>';
-- Get the milestone id from the deal page or from: select id, deal_id, title, status from public.milestones where status = 'in_progress';
