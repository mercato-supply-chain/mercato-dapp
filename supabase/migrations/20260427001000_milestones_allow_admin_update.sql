drop policy if exists "milestones_update_admin" on public.milestones;

create policy "milestones_update_admin" on public.milestones
  for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.user_type = 'admin'
    )
  );
