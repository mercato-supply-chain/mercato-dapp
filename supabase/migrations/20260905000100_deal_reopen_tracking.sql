alter table public.deals
  add column if not exists reopen_count integer not null default 0,
  add column if not exists last_reopened_at timestamptz,
  add column if not exists last_reopened_by uuid references public.profiles(id) on delete set null,
  add column if not exists reopen_history jsonb not null default '[]'::jsonb;

alter table public.deals
  drop constraint if exists deals_reopen_count_non_negative,
  add constraint deals_reopen_count_non_negative check (reopen_count >= 0);

create index if not exists idx_deals_expired_funding
  on public.deals (funding_expires_at)
  where status = 'seeking_funding' and investor_id is null;

comment on column public.deals.reopen_count is 'How many times an admin re-opened the funding window';
comment on column public.deals.last_reopened_at is 'Most recent admin re-open timestamp';
comment on column public.deals.last_reopened_by is 'Admin profile id that last re-opened the deal';
comment on column public.deals.reopen_history is 'Audit trail of admin funding window re-opens';
