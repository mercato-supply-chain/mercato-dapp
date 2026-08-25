-- Repayment lifecycle timestamps (set once by trigger, never backfilled) and
-- admin analytics aggregates computed server-side.

alter table public.deals
  add column if not exists repayment_escrow_created_at timestamptz,
  add column if not exists repayment_ready_at timestamptz,
  add column if not exists repayment_first_release_at timestamptz;

create or replace function public.stamp_repayment_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.repayment_escrow_created_at is null
     and old.escrow_contract_address is null
     and new.escrow_contract_address is not null then
    new.repayment_escrow_created_at := now();
  end if;

  if new.repayment_ready_at is null
     and coalesce(old.repayment_status, 'none') not in ('ready_to_release', 'funded')
     and new.repayment_status in ('ready_to_release', 'funded') then
    new.repayment_ready_at := now();
  end if;

  if new.repayment_first_release_at is null
     and coalesce(old.repayment_status, 'none') not in ('partially_released', 'released')
     and new.repayment_status in ('partially_released', 'released') then
    new.repayment_first_release_at := now();
  end if;

  -- Set-once: keep earlier stamps even if a sync writes the row again.
  if old.repayment_escrow_created_at is not null then
    new.repayment_escrow_created_at := old.repayment_escrow_created_at;
  end if;
  if old.repayment_ready_at is not null then
    new.repayment_ready_at := old.repayment_ready_at;
  end if;
  if old.repayment_first_release_at is not null then
    new.repayment_first_release_at := old.repayment_first_release_at;
  end if;

  return new;
end;
$$;

drop trigger if exists deals_stamp_repayment_lifecycle on public.deals;
create trigger deals_stamp_repayment_lifecycle
  before update on public.deals
  for each row
  execute function public.stamp_repayment_lifecycle();

-- User growth and onboarding funnel metrics.
create or replace function public.admin_user_metrics(
  p_from timestamptz,
  p_to timestamptz,
  p_prev_from timestamptz,
  p_prev_to timestamptz
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_current jsonb;
  v_previous jsonb;
  v_snapshot jsonb;
  v_companies jsonb;
begin
  perform assert_admin();

  select jsonb_build_object(
    'new_users', count(*) filter (where created_at >= p_from and created_at < p_to),
    'new_pymes', count(*) filter (where created_at >= p_from and created_at < p_to and user_type = 'pyme'),
    'new_investors', count(*) filter (where created_at >= p_from and created_at < p_to and user_type = 'investor'),
    'new_suppliers', count(*) filter (where created_at >= p_from and created_at < p_to and user_type = 'supplier'),
    'onboarding_completed', count(*) filter (where onboarding_completed_at >= p_from and onboarding_completed_at < p_to),
    'cohort_completed', count(*) filter (where created_at >= p_from and created_at < p_to and user_type is not null),
    'median_completion_seconds', percentile_cont(0.5) within group (
      order by extract(epoch from onboarding_completed_at - created_at)
    ) filter (where onboarding_completed_at >= p_from and onboarding_completed_at < p_to)
  )
  into v_current
  from profiles;

  select jsonb_build_object(
    'new_users', count(*) filter (where created_at >= p_prev_from and created_at < p_prev_to),
    'new_pymes', count(*) filter (where created_at >= p_prev_from and created_at < p_prev_to and user_type = 'pyme'),
    'new_investors', count(*) filter (where created_at >= p_prev_from and created_at < p_prev_to and user_type = 'investor'),
    'new_suppliers', count(*) filter (where created_at >= p_prev_from and created_at < p_prev_to and user_type = 'supplier'),
    'onboarding_completed', count(*) filter (where onboarding_completed_at >= p_prev_from and onboarding_completed_at < p_prev_to),
    'cohort_completed', count(*) filter (where created_at >= p_prev_from and created_at < p_prev_to and user_type is not null),
    'median_completion_seconds', percentile_cont(0.5) within group (
      order by extract(epoch from onboarding_completed_at - created_at)
    ) filter (where onboarding_completed_at >= p_prev_from and onboarding_completed_at < p_prev_to)
  )
  into v_previous
  from profiles;

  select jsonb_build_object(
    'total_users', count(*),
    'onboarding_incomplete', count(*) filter (where user_type is null),
    'onboarding_completed', count(*) filter (where user_type is not null and onboarding_completed_at is not null),
    'onboarding_completed_legacy', count(*) filter (where user_type is not null and onboarding_completed_at is null),
    'verified_users', count(*) filter (where verified),
    'pymes', count(*) filter (where user_type = 'pyme'),
    'investors', count(*) filter (where user_type = 'investor'),
    'suppliers', count(*) filter (where user_type = 'supplier')
  )
  into v_snapshot
  from profiles;

  select jsonb_build_object(
    'total_companies', count(*),
    'verified_companies', count(*) filter (where verified)
  )
  into v_companies
  from supplier_companies;

  return jsonb_build_object(
    'current', v_current,
    'previous', v_previous,
    'snapshot', v_snapshot || v_companies
  );
end;
$$;

revoke execute on function public.admin_user_metrics(timestamptz, timestamptz, timestamptz, timestamptz) from anon;

-- Deal creation, funding conversion, and volume metrics.
create or replace function public.admin_deal_metrics(
  p_from timestamptz,
  p_to timestamptz,
  p_prev_from timestamptz,
  p_prev_to timestamptz
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_current jsonb;
  v_previous jsonb;
  v_snapshot jsonb;
begin
  perform assert_admin();

  select jsonb_build_object(
    'deals_created', count(*) filter (where created_at >= p_from and created_at < p_to),
    'requested_volume', coalesce(sum(amount) filter (where created_at >= p_from and created_at < p_to), 0),
    'deals_funded', count(*) filter (where funded_at >= p_from and funded_at < p_to),
    'funded_volume', coalesce(sum(amount) filter (where funded_at >= p_from and funded_at < p_to), 0),
    'avg_time_to_funding_seconds', avg(extract(epoch from funded_at - created_at))
      filter (where funded_at >= p_from and funded_at < p_to)
  )
  into v_current
  from deals;

  select jsonb_build_object(
    'deals_created', count(*) filter (where created_at >= p_prev_from and created_at < p_prev_to),
    'requested_volume', coalesce(sum(amount) filter (where created_at >= p_prev_from and created_at < p_prev_to), 0),
    'deals_funded', count(*) filter (where funded_at >= p_prev_from and funded_at < p_prev_to),
    'funded_volume', coalesce(sum(amount) filter (where funded_at >= p_prev_from and funded_at < p_prev_to), 0),
    'avg_time_to_funding_seconds', avg(extract(epoch from funded_at - created_at))
      filter (where funded_at >= p_prev_from and funded_at < p_prev_to)
  )
  into v_previous
  from deals;

  select jsonb_build_object(
    'total_deals', count(*),
    'seeking_funding', count(*) filter (where status = 'seeking_funding'),
    'funded', count(*) filter (where status = 'funded'),
    'in_progress', count(*) filter (where status = 'in_progress'),
    'completed', count(*) filter (where status = 'completed'),
    'active_deals', count(*) filter (where status in ('funded', 'in_progress')),
    'active_volume', coalesce(sum(amount) filter (where status in ('funded', 'in_progress')), 0),
    'completed_volume', coalesce(sum(amount) filter (where status = 'completed'), 0)
  )
  into v_snapshot
  from deals;

  return jsonb_build_object(
    'current', v_current,
    'previous', v_previous,
    'snapshot', v_snapshot
  );
end;
$$;

revoke execute on function public.admin_deal_metrics(timestamptz, timestamptz, timestamptz, timestamptz) from anon;

-- Repayment operations metrics. Timing metrics rely on the lifecycle
-- timestamps stamped above, so they only cover activity after this migration.
create or replace function public.admin_repayment_metrics(
  p_from timestamptz,
  p_to timestamptz,
  p_prev_from timestamptz,
  p_prev_to timestamptz
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_current jsonb;
  v_previous jsonb;
  v_snapshot jsonb;
  v_milestones jsonb;
begin
  perform assert_admin();

  select jsonb_build_object(
    'escrows_created', count(*) filter (where repayment_escrow_created_at >= p_from and repayment_escrow_created_at < p_to),
    'first_releases', count(*) filter (where repayment_first_release_at >= p_from and repayment_first_release_at < p_to),
    'avg_delivery_to_escrow_seconds', avg(extract(epoch from repayment_escrow_created_at - delivered_at))
      filter (where repayment_escrow_created_at >= p_from and repayment_escrow_created_at < p_to and delivered_at is not null),
    'avg_ready_to_release_seconds', avg(extract(epoch from repayment_first_release_at - repayment_ready_at))
      filter (where repayment_first_release_at >= p_from and repayment_first_release_at < p_to and repayment_ready_at is not null)
  )
  into v_current
  from deals;

  select jsonb_build_object(
    'escrows_created', count(*) filter (where repayment_escrow_created_at >= p_prev_from and repayment_escrow_created_at < p_prev_to),
    'first_releases', count(*) filter (where repayment_first_release_at >= p_prev_from and repayment_first_release_at < p_prev_to),
    'avg_delivery_to_escrow_seconds', avg(extract(epoch from repayment_escrow_created_at - delivered_at))
      filter (where repayment_escrow_created_at >= p_prev_from and repayment_escrow_created_at < p_prev_to and delivered_at is not null),
    'avg_ready_to_release_seconds', avg(extract(epoch from repayment_first_release_at - repayment_ready_at))
      filter (where repayment_first_release_at >= p_prev_from and repayment_first_release_at < p_prev_to and repayment_ready_at is not null)
  )
  into v_previous
  from deals;

  select jsonb_build_object(
    'awaiting_escrow', count(*) filter (where repayment_status = 'order_confirmed'),
    'awaiting_funding', count(*) filter (where repayment_status in ('escrow_initialized', 'funding')),
    'ready_to_release', count(*) filter (where repayment_status in ('ready_to_release', 'funded')),
    'partially_released', count(*) filter (where repayment_status = 'partially_released'),
    'released', count(*) filter (where repayment_status = 'released')
  )
  into v_snapshot
  from deals;

  select jsonb_build_object(
    'milestones_released', count(*) filter (where (ms ->> 'released')::boolean),
    'milestones_open', count(*) filter (where not coalesce((ms ->> 'released')::boolean, false)),
    'released_volume', coalesce(sum((ms ->> 'amount')::numeric) filter (where (ms ->> 'released')::boolean), 0)
  )
  into v_milestones
  from deals d
  cross join lateral jsonb_array_elements(coalesce(d.repayment_milestones, '[]'::jsonb)) as ms;

  return jsonb_build_object(
    'current', v_current,
    'previous', v_previous,
    'snapshot', v_snapshot || v_milestones
  );
end;
$$;

revoke execute on function public.admin_repayment_metrics(timestamptz, timestamptz, timestamptz, timestamptz) from anon;
