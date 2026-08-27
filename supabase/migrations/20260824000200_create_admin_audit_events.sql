-- Append-only audit trail for privileged administrative changes.
create table if not exists public.admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.profiles (id),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  before jsonb,
  after jsonb,
  reason text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_events enable row level security;

-- Admins may read the trail. There are intentionally NO insert/update/delete
-- policies: rows are written only by security-definer functions (or the
-- service role), which keeps the log append-only for every app client.
drop policy if exists admin_audit_events_select_admin on public.admin_audit_events;
create policy admin_audit_events_select_admin
  on public.admin_audit_events
  for select
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.user_type = 'admin'
    )
  );

create index if not exists idx_admin_audit_events_created
  on public.admin_audit_events (created_at desc);
create index if not exists idx_admin_audit_events_entity
  on public.admin_audit_events (entity_type, entity_id);
create index if not exists idx_admin_audit_events_admin
  on public.admin_audit_events (admin_user_id, created_at desc);
