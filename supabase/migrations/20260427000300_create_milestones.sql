create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  title text not null,
  description text,
  percentage numeric(5, 2) not null check (percentage > 0 and percentage <= 100),
  amount numeric(10, 2) not null,
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'completed')),
  proof_document_url text,
  proof_notes text,
  created_at timestamp with time zone default now(),
  completed_at timestamp with time zone,
  updated_at timestamp with time zone default now()
);

alter table public.milestones enable row level security;

drop policy if exists "milestones_select_all" on public.milestones;
create policy "milestones_select_all" on public.milestones
  for select using (
    exists (
      select 1 from public.deals
      where deals.id = milestones.deal_id
    )
  );

drop policy if exists "milestones_insert_stakeholders" on public.milestones;
create policy "milestones_insert_stakeholders" on public.milestones
  for insert with check (
    exists (
      select 1 from public.deals
      where deals.id = milestones.deal_id
      and (
        deals.pyme_id = auth.uid() or
        deals.supplier_id = auth.uid() or
        deals.investor_id = auth.uid()
      )
    )
  );

drop policy if exists "milestones_update_stakeholders" on public.milestones;
create policy "milestones_update_stakeholders" on public.milestones
  for update using (
    exists (
      select 1 from public.deals
      where deals.id = milestones.deal_id
      and (
        deals.pyme_id = auth.uid() or
        deals.supplier_id = auth.uid() or
        deals.investor_id = auth.uid()
      )
    )
  );

create index if not exists idx_milestones_deal_id on public.milestones(deal_id);
create index if not exists idx_milestones_status on public.milestones(status);
