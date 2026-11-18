-- Deal aggregates for the public investor / PyME profile pages.
--
-- Those pages render a capped list of recent deals but previously loaded every
-- matching row to compute totals, counts and reputation inputs in application
-- memory. Aggregating in Postgres keeps both response size and server work
-- bounded regardless of how much history an account has accumulated.
--
-- Both functions are SECURITY INVOKER on purpose: they run with the caller's
-- privileges so the existing `deals_select_all` RLS policy still applies. That
-- policy is `using (true)`, so exposing these aggregates to anon is not a new
-- data exposure — the underlying rows were already publicly readable.

create or replace function public.investor_profile_deal_summary(p_investor_id uuid)
returns table (
  total_deals integer,
  total_deployed numeric,
  active_deals integer,
  active_volume numeric,
  completed_deals integer
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    count(*)::int,
    coalesce(sum(d.amount), 0),
    count(*) filter (where d.status in ('funded', 'in_progress'))::int,
    coalesce(sum(d.amount) filter (where d.status in ('funded', 'in_progress')), 0),
    count(*) filter (where d.status = 'completed')::int
  from public.deals d
  where d.investor_id = p_investor_id;
$$;

comment on function public.investor_profile_deal_summary(uuid) is
  'Deal counts and volume for an investor profile page, aggregated in the database.';

create or replace function public.pyme_profile_deal_summary(p_pyme_id uuid)
returns table (
  total_deals integer,
  active_deals integer,
  completed_deals integer,
  total_repaid numeric,
  funded_deals integer,
  reputation_deals_funded integer,
  reputation_current_debt numeric,
  cancelled_deals integer
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    count(*)::int,
    count(*) filter (where d.status in ('funded', 'in_progress', 'milestone_pending'))::int,
    count(*) filter (where d.status = 'completed')::int,
    coalesce(sum(d.amount) filter (where d.status = 'completed'), 0),
    count(*) filter (where d.status in ('funded', 'in_progress', 'milestone_pending', 'completed'))::int,
    count(*) filter (where d.status in ('funded', 'in_progress', 'completed'))::int,
    coalesce(sum(d.amount) filter (where d.status in ('funded', 'in_progress')), 0),
    count(*) filter (where d.status = 'cancelled')::int
  from public.deals d
  where d.pyme_id = p_pyme_id;
$$;

comment on function public.pyme_profile_deal_summary(uuid) is
  'Deal counts, repaid volume and reputation inputs for a PyME profile page, aggregated in the database.';

-- `funded_deals` and `reputation_deals_funded` are intentionally separate.
-- The profile page completion rate has always counted `milestone_pending` as
-- funded, while lib/pyme-reputation.ts scores only funded/in_progress/completed.
-- `milestone_pending` is a UI-only status and is not allowed by the `deals.status`
-- check constraint, so the two currently agree — keeping both preserves the
-- existing behaviour of each computation if that ever changes.

grant execute on function public.investor_profile_deal_summary(uuid) to anon, authenticated;
grant execute on function public.pyme_profile_deal_summary(uuid) to anon, authenticated;
