-- Append-only audit for Trustless Work repayment escrow actions (Issue #163).
create table if not exists public.repayment_escrow_actions (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  action_type text not null check (action_type in (
    'deployment_reviewed','deployment_submitted','deployment_succeeded','deployment_failed',
    'milestone_update_reviewed','milestone_update_submitted','milestone_update_succeeded','milestone_update_failed',
    'milestone_approval_reviewed','milestone_approved','milestone_approval_failed',
    'milestone_release_reviewed','milestone_released','milestone_release_failed'
  )),
  admin_user_id uuid references public.profiles (id),
  signing_wallet text,
  contract_id text,
  generated_payload jsonb,
  reviewed_payload jsonb,
  changed_fields text[] not null default '{}',
  review_timestamp timestamptz,
  submission_timestamp timestamptz,
  completion_timestamp timestamptz,
  transaction_hash text,
  failure_message text,
  created_at timestamptz not null default now()
);

alter table public.repayment_escrow_actions enable row level security;

drop policy if exists repayment_escrow_actions_select_admin on public.repayment_escrow_actions;
create policy repayment_escrow_actions_select_admin
  on public.repayment_escrow_actions for select
  using (
    exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.user_type = 'admin')
  );

drop policy if exists repayment_escrow_actions_insert_admin on public.repayment_escrow_actions;
create policy repayment_escrow_actions_insert_admin
  on public.repayment_escrow_actions for insert
  with check (
    exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.user_type = 'admin')
  );

create index if not exists idx_repayment_escrow_actions_deal on public.repayment_escrow_actions (deal_id, created_at desc);
create index if not exists idx_repayment_escrow_actions_contract on public.repayment_escrow_actions (contract_id);
create index if not exists idx_repayment_escrow_actions_type on public.repayment_escrow_actions (action_type);
