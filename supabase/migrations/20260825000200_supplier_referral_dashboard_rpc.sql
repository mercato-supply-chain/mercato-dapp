-- Referral milestone notification types + dashboard reporting RPCs.

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check check (type in (
    'deal_created',
    'deal_funded',
    'milestone_1_approved',
    'milestone_2_approved',
    'pyme_investor_deal_created',
    'pyme_investor_deal_complete',
    'repayment_escrow_needed',
    'repayment_escrow_created',
    'goods_shipped',
    'pyme_referred',
    'pyme_referral_onboarded',
    'pyme_referral_first_deal',
    'pyme_referral_first_funded'
  ));

create or replace function public.get_supplier_owned_company_ids(
  p_owner_id uuid,
  p_company_id uuid default null
)
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(id), '{}'::uuid[])
  from public.supplier_companies
  where owner_id = p_owner_id
    and (p_company_id is null or id = p_company_id);
$$;

create or replace function public.get_supplier_referral_summary(
  p_owner_id uuid,
  p_company_id uuid default null,
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_companies uuid[];
  v_invitations_created int;
  v_valid_invitations int;
  v_link_opens int;
  v_accounts_created int;
  v_onboarded_pymes int;
  v_referred_pymes int;
  v_active_referred int;
  v_requested_volume numeric;
  v_funded_volume numeric;
begin
  if p_owner_id is distinct from auth.uid() then
    raise exception 'forbidden';
  end if;

  v_companies := public.get_supplier_owned_company_ids(p_owner_id, p_company_id);
  if cardinality(v_companies) = 0 then
    return jsonb_build_object(
      'invitationsCreated', 0,
      'validInvitations', 0,
      'linkOpens', 0,
      'accountsCreated', 0,
      'onboardedPymes', 0,
      'conversionRate', 0,
      'referredPymes', 0,
      'activeReferredPymes', 0,
      'requestedVolume', 0,
      'fundedVolume', 0
    );
  end if;

  select count(*)::int into v_invitations_created
  from public.supplier_referral_invitations i
  where i.supplier_company_id = any(v_companies)
    and (p_from is null or i.created_at >= p_from)
    and (p_to is null or i.created_at <= p_to);

  select count(*)::int into v_valid_invitations
  from public.supplier_referral_invitations i
  where i.supplier_company_id = any(v_companies)
    and i.status in ('active', 'converted', 'expired')
    and (p_from is null or i.created_at >= p_from)
    and (p_to is null or i.created_at <= p_to);

  select count(*)::int into v_link_opens
  from public.referral_events e
  where e.supplier_company_id = any(v_companies)
    and e.event_type = 'link_opened'
    and (p_from is null or e.created_at >= p_from)
    and (p_to is null or e.created_at <= p_to);

  select count(*)::int into v_accounts_created
  from public.referral_events e
  where e.supplier_company_id = any(v_companies)
    and e.event_type = 'account_created'
    and (p_from is null or e.created_at >= p_from)
    and (p_to is null or e.created_at <= p_to);

  select count(*)::int into v_onboarded_pymes
  from public.profiles p
  where p.referred_by_supplier_id = any(v_companies)
    and p.user_type = 'pyme'
    and p.company_name is not null and trim(p.company_name) <> ''
    and p.country is not null and trim(p.country) <> ''
    and p.sector is not null and trim(p.sector) <> '';

  select count(*)::int into v_referred_pymes
  from public.profiles p
  where p.referred_by_supplier_id = any(v_companies)
    and p.user_type = 'pyme';

  select count(distinct p.id)::int into v_active_referred
  from public.profiles p
  join public.deals d on d.pyme_id = p.id
  where p.referred_by_supplier_id = any(v_companies)
    and p.user_type = 'pyme'
    and d.status <> 'cancelled';

  select coalesce(sum(d.amount), 0) into v_requested_volume
  from public.deals d
  join public.profiles p on p.id = d.pyme_id
  where p.referred_by_supplier_id = any(v_companies)
    and d.status <> 'cancelled'
    and (p_from is null or d.created_at >= p_from)
    and (p_to is null or d.created_at <= p_to);

  select coalesce(sum(d.amount), 0) into v_funded_volume
  from public.deals d
  join public.profiles p on p.id = d.pyme_id
  where p.referred_by_supplier_id = any(v_companies)
    and d.status in ('funded', 'in_progress', 'completed')
    and (p_from is null or d.funded_at >= p_from or (d.funded_at is null and d.created_at >= p_from))
    and (p_to is null or d.funded_at <= p_to or (d.funded_at is null and d.created_at <= p_to));

  return jsonb_build_object(
    'invitationsCreated', v_invitations_created,
    'validInvitations', v_valid_invitations,
    'linkOpens', v_link_opens,
    'accountsCreated', v_accounts_created,
    'onboardedPymes', v_onboarded_pymes,
    'conversionRate', case when v_valid_invitations > 0
      then round(v_onboarded_pymes::numeric / v_valid_invitations, 4) else 0 end,
    'referredPymes', v_referred_pymes,
    'activeReferredPymes', v_active_referred,
    'requestedVolume', v_requested_volume,
    'fundedVolume', v_funded_volume
  );
end;
$$;

create or replace function public.get_supplier_referral_invitations_page(
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

  select count(*)::int into v_total
  from public.supplier_referral_invitations i
  where i.supplier_company_id = any(v_companies);

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_rows
  from (
    select
      i.id,
      i.supplier_company_id,
      sc.company_name,
      i.label,
      i.recipient_email,
      i.status,
      i.expires_at,
      i.converted_profile_id,
      i.revoked_at,
      i.created_at,
      (
        select count(*)::int from public.referral_events e
        where e.invitation_id = i.id and e.event_type = 'link_opened'
      ) as link_open_count
    from public.supplier_referral_invitations i
    join public.supplier_companies sc on sc.id = i.supplier_company_id
    where i.supplier_company_id = any(v_companies)
    order by i.created_at desc
    limit greatest(p_limit, 1)
    offset greatest(p_offset, 0)
  ) t;

  return jsonb_build_object('total', v_total, 'rows', v_rows);
end;
$$;

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
  select count(*)::int into v_total from combined;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_rows
  from (
    select * from combined
    order by created_at desc nulls last
    limit greatest(p_limit, 1)
    offset greatest(p_offset, 0)
  ) t;

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
  select count(*)::int into v_total from events;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_rows
  from (
    select * from events
    order by created_at desc
    limit greatest(p_limit, 1)
    offset greatest(p_offset, 0)
  ) t;

  return jsonb_build_object('total', v_total, 'rows', v_rows);
end;
$$;

create or replace function public.get_supplier_referral_network_breakdown(
  p_owner_id uuid,
  p_company_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_companies uuid[];
  v_by_country jsonb;
  v_by_sector jsonb;
begin
  if p_owner_id is distinct from auth.uid() then
    raise exception 'forbidden';
  end if;

  v_companies := public.get_supplier_owned_company_ids(p_owner_id, p_company_id);

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_by_country
  from (
    select coalesce(p.country, 'unknown') as key, count(*)::int as count
    from public.profiles p
    where p.referred_by_supplier_id = any(v_companies)
      and p.user_type = 'pyme'
    group by coalesce(p.country, 'unknown')
    order by count desc
  ) t;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_by_sector
  from (
    select coalesce(p.sector, 'unknown') as key, count(*)::int as count
    from public.profiles p
    where p.referred_by_supplier_id = any(v_companies)
      and p.user_type = 'pyme'
    group by coalesce(p.sector, 'unknown')
    order by count desc
  ) t;

  return jsonb_build_object(
    'byCountry', v_by_country,
    'bySector', v_by_sector
  );
end;
$$;

grant execute on function public.get_supplier_owned_company_ids(uuid, uuid) to authenticated;
grant execute on function public.get_supplier_referral_summary(uuid, uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.get_supplier_referral_invitations_page(uuid, uuid, int, int) to authenticated;
grant execute on function public.get_supplier_referred_pymes_page(uuid, uuid, int, int) to authenticated;
grant execute on function public.get_supplier_referral_activity_page(uuid, uuid, int, int) to authenticated;
grant execute on function public.get_supplier_referral_network_breakdown(uuid, uuid) to authenticated;
