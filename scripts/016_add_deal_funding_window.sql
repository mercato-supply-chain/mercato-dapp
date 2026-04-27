-- Add funding window and extension metadata for deal lifecycle state
alter table public.deals
add column if not exists funding_expires_at timestamp with time zone,
add column if not exists funding_window_days integer,
add column if not exists extension_count integer not null default 0,
add column if not exists extended_at timestamp with time zone;

-- Backfill existing open deals so they do not remain open indefinitely.
-- Existing funded/completed records keep nullable values for historical compatibility.
update public.deals
set funding_window_days = coalesce(funding_window_days, 14)
where status = 'seeking_funding'
  and funding_window_days is null;

update public.deals
set funding_expires_at = coalesce(
  funding_expires_at,
  created_at + make_interval(days => coalesce(funding_window_days, 14))
)
where status = 'seeking_funding'
  and funding_expires_at is null;

alter table public.deals
  drop constraint if exists deals_funding_window_days_positive,
  add constraint deals_funding_window_days_positive
    check (funding_window_days is null or funding_window_days > 0);

alter table public.deals
  drop constraint if exists deals_extension_count_non_negative,
  add constraint deals_extension_count_non_negative
    check (extension_count >= 0);

create index if not exists idx_deals_funding_expires_at on public.deals(funding_expires_at);

comment on column public.deals.funding_window_days is 'Funding window in days selected by the PyME';
comment on column public.deals.funding_expires_at is 'Timestamp when the funding window closes';
comment on column public.deals.extension_count is 'How many times the funding window has been extended';
comment on column public.deals.extended_at is 'Most recent extension timestamp';
