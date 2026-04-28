-- Create reputations table for participant trust tracking
create table if not exists public.reputations (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  capital_committed numeric not null default 0,
  deals_completed integer not null default 0,
  repayment_performance numeric not null default 0,
  reputation_score numeric not null default 0,
  trust_label text,
  stake_amount numeric not null default 0,
  stake_currency text not null default 'USDC',
  updated_at timestamp with time zone default now(),

  constraint repayment_performance_range check (repayment_performance >= 0),
  constraint reputation_score_range check (reputation_score >= 0),
  constraint capital_committed_nonnegative check (capital_committed >= 0),
  constraint deals_completed_nonnegative check (deals_completed >= 0),
  constraint stake_amount_nonnegative check (stake_amount >= 0)
);

-- Enable RLS
alter table public.reputations enable row level security;

-- Policies
create policy "reputations_select_all" on public.reputations
  for select using (true);

create policy "reputations_insert_own" on public.reputations
  for insert with check (auth.uid() = user_id);

create policy "reputations_update_own" on public.reputations
  for update using (auth.uid() = user_id);

-- Trigger to update updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger on_reputations_updated
  before update on public.reputations
  for each row
  execute function public.handle_updated_at();

-- Comments
comment on table public.reputations is 'Stores trust-related signals and scores for investors and PyMEs.';
comment on column public.reputations.capital_committed is 'Total capital committed by the user across all deals.';
comment on column public.reputations.repayment_performance is 'Score or percentage representing how reliably a PyME repays.';
comment on column public.reputations.reputation_score is 'Overall platform trust score calculated by the sync engine.';
