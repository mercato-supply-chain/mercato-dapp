-- Fix CTE scope bugs in referral dashboard RPCs.
-- Postgres WITH clauses only apply to the immediately following statement;
-- the second SELECT could not see "combined" / "events".

create or replace function public.get_supplier_referred_pymes_page(
  p_owner_id uuid,
  p_company_id uuid default null,
  p_limit int default 20,
  p_offset int default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_companies uuid[];
  v_total int;
  v_rows jsonb;
begin
  if p_owner_id is distinct from auth.uid() then
    raise exception 'forbidden';
  end if;

  v_companies := public.get_supplier_owned_company_ids(p_owner_id, p_company_id);

  with referred as (
    select
      p.id as profile_id,
      p.referred_by_supplier_id as supplier_company_id,
      sc.company_name as supplier_company_name,
      p.referral_invitation_id,
      case when p.referral_invitation_id is null then 'legacy' else 'invitation' end as attribution_source,
      p.company_name,
      p.full_name,
      p.contact_name,
      p.bio,
      p.country,
      p.sector,
      p.user_type,
      p.verified,
      coalesce(dc.deal_count, 0) as deal_count,
      coalesce(dc.requested_volume, 0) as requested_volume,
      coalesce(dc.funded_volume, 0) as funded_volume,
      p.created_at
    from public.profiles p
    join public.supplier_companies sc on sc.id = p.referred_by_supplier_id
    left join lateral (
      select
        count(*)::int as deal_count,
        coalesce(sum(d.amount) filter (where d.status <> 'cancelled'), 0) as requested_volume,
        coalesce(sum(d.amount) filter (where d.status in ('funded','in_progress','completed')), 0) as funded_volume
      from public.deals d
      where d.pyme_id = p.id
    ) dc on true
    where p.referred_by_supplier_id = any(v_companies)
  ),
  invited_only as (
    select
      i.converted_profile_id as profile_id,
      i.supplier_company_id,
      sc.company_name as supplier_company_name,
      i.id as referral_invitation_id,
      'invitation' as attribution_source,
      null::text as company_name,
      null::text as full_name,
      null::text as contact_name,
      null::text as bio,
      null::text as country,
      null::text as sector,
      null::text as user_type,
      null::boolean as verified,
      0 as deal_count,
      0::numeric as requested_volume,
      0::numeric as funded_volume,
      i.created_at
    from public.supplier_referral_invitations i
    join public.supplier_companies sc on sc.id = i.supplier_company_id
    where i.supplier_company_id = any(v_companies)
      and i.converted_profile_id is null
      and i.status in ('active', 'expired')
  ),
  combined as (
    select * from referred
    union all
    select * from invited_only
  )
  select
    (select count(*)::int from combined),
    coalesce(
      (
        select jsonb_agg(row_to_json(t))
        from (
          select *
          from combined
          order by created_at desc nulls last, profile_id nulls last, referral_invitation_id nulls last
          limit greatest(p_limit, 1)
          offset greatest(p_offset, 0)
        ) t
      ),
      '[]'::jsonb
    )
  into v_total, v_rows;

  return jsonb_build_object('total', v_total, 'rows', v_rows);
end;
$$;

create or replace function public.get_supplier_referral_activity_page(
  p_owner_id uuid,
  p_company_id uuid default null,
  p_limit int default 30,
  p_offset int default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_companies uuid[];
  v_total int;
  v_rows jsonb;
begin
  if p_owner_id is distinct from auth.uid() then
    raise exception 'forbidden';
  end if;

  v_companies := public.get_supplier_owned_company_ids(p_owner_id, p_company_id);

  with events as (
    select
      e.id,
      e.event_type,
      e.created_at,
      e.profile_id,
      e.invitation_id,
      e.metadata
    from public.referral_events e
    where e.supplier_company_id = any(v_companies)
  )
  select
    (select count(*)::int from events),
    coalesce(
      (
        select jsonb_agg(row_to_json(t))
        from (
          select *
          from events
          order by created_at desc, id
          limit greatest(p_limit, 1)
          offset greatest(p_offset, 0)
        ) t
      ),
      '[]'::jsonb
    )
  into v_total, v_rows;

  return jsonb_build_object('total', v_total, 'rows', v_rows);
end;
$$;
