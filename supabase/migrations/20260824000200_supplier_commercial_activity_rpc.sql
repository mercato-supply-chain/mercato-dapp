-- Supplier commercial activity reporting (ownership-scoped via supplier_companies.owner_id).

create or replace function public.supplier_commercial_state(
  p_status text,
  p_funding_expires_at timestamptz,
  p_shipped_at timestamptz,
  p_delivered_at timestamptz,
  p_now timestamptz default now()
)
returns text
language sql
immutable
as $$
  select case
    when p_status = 'cancelled' then 'cancelled'
    when p_status = 'seeking_funding'
      and p_funding_expires_at is not null
      and p_funding_expires_at <= p_now then 'expired'
    when p_status = 'seeking_funding' then 'financing_request'
    when p_status = 'completed' then 'completed_sale'
    when p_shipped_at is not null and p_delivered_at is null then 'in_fulfillment'
    when p_status in ('funded', 'in_progress', 'completed') and p_shipped_at is null then 'needs_shipment'
    when p_status in ('funded', 'in_progress', 'completed') then 'financed_sale'
    else 'financing_request'
  end;
$$;

comment on function public.supplier_commercial_state is
  'Derives supplier-facing commercial state from deal lifecycle fields.';

create or replace function public.assert_supplier_owner_scope(
  p_owner_id uuid,
  p_company_id uuid default null,
  p_product_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or auth.uid() <> p_owner_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_company_id is not null then
    if not exists (
      select 1 from public.supplier_companies sc
      where sc.id = p_company_id and sc.owner_id = p_owner_id
    ) then
      raise exception 'invalid company filter' using errcode = '42501';
    end if;
  end if;

  if p_product_id is not null then
    if not exists (
      select 1
      from public.supplier_products sp
      inner join public.supplier_companies sc on sc.id = sp.supplier_id
      where sp.id = p_product_id and sc.owner_id = p_owner_id
    ) then
      raise exception 'invalid product filter' using errcode = '42501';
    end if;
  end if;
end;
$$;

create or replace function public.get_supplier_commercial_summary(
  p_owner_id uuid,
  p_company_id uuid default null,
  p_product_id uuid default null,
  p_category text default null,
  p_commercial_status text default null,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null
)
returns table (
  open_financing_requests bigint,
  active_financed_sales bigint,
  completed_financed_sales bigint,
  pending_shipments bigint,
  total_financed_volume numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_supplier_owner_scope(p_owner_id, p_company_id, p_product_id);

  return query
  with scoped as (
    select
      d.*,
      public.supplier_commercial_state(
        d.status,
        d.funding_expires_at,
        d.shipped_at,
        d.delivered_at
      ) as commercial_state
    from public.deals d
    inner join public.supplier_companies sc on sc.id = d.supplier_id
    where sc.owner_id = p_owner_id
      and (p_company_id is null or d.supplier_id = p_company_id)
      and (p_product_id is null or d.product_id = p_product_id)
      and (p_category is null or d.category = p_category)
      and (p_date_from is null or d.created_at >= p_date_from)
      and (p_date_to is null or d.created_at <= p_date_to)
  ),
  filtered as (
    select * from scoped
    where p_commercial_status is null or commercial_state = p_commercial_status
  )
  select
    count(*) filter (where commercial_state = 'financing_request'),
    count(*) filter (where status in ('funded', 'in_progress')),
    count(*) filter (where status = 'completed'),
    count(*) filter (where commercial_state = 'needs_shipment' and status in ('funded', 'in_progress')),
    coalesce(sum(amount) filter (where status in ('funded', 'in_progress', 'completed')), 0)
  from filtered;
end;
$$;

create or replace function public.get_supplier_commercial_activity(
  p_owner_id uuid,
  p_company_id uuid default null,
  p_product_id uuid default null,
  p_category text default null,
  p_commercial_status text default null,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null,
  p_page integer default 1,
  p_page_size integer default 20
)
returns table (
  deal_id uuid,
  product_id uuid,
  product_name text,
  product_quantity integer,
  product_unit_price numeric,
  amount numeric,
  category text,
  commercial_state text,
  supplier_company_id uuid,
  supplier_company_name text,
  pyme_id uuid,
  pyme_name text,
  investor_id uuid,
  investor_name text,
  created_at timestamptz,
  funded_at timestamptz,
  shipped_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_page integer := greatest(1, coalesce(p_page, 1));
  v_page_size integer := least(100, greatest(1, coalesce(p_page_size, 20)));
  v_offset integer := (v_page - 1) * v_page_size;
begin
  perform public.assert_supplier_owner_scope(p_owner_id, p_company_id, p_product_id);

  return query
  with scoped as (
    select
      d.id as deal_id,
      d.product_id,
      d.product_name,
      d.product_quantity,
      d.product_unit_price,
      d.amount,
      d.category,
      public.supplier_commercial_state(
        d.status,
        d.funding_expires_at,
        d.shipped_at,
        d.delivered_at
      ) as commercial_state,
      sc.id as supplier_company_id,
      coalesce(sc.company_name, sc.full_name, sc.contact_name, 'Supplier') as supplier_company_name,
      d.pyme_id,
      coalesce(p.company_name, p.full_name, p.contact_name, 'PyME') as pyme_name,
      d.investor_id,
      coalesce(inv.company_name, inv.full_name, inv.contact_name, '') as investor_name,
      d.created_at,
      d.funded_at,
      d.shipped_at
    from public.deals d
    inner join public.supplier_companies sc on sc.id = d.supplier_id
    left join public.profiles p on p.id = d.pyme_id
    left join public.profiles inv on inv.id = d.investor_id
    where sc.owner_id = p_owner_id
      and (p_company_id is null or d.supplier_id = p_company_id)
      and (p_product_id is null or d.product_id = p_product_id)
      and (p_category is null or d.category = p_category)
      and (p_date_from is null or d.created_at >= p_date_from)
      and (p_date_to is null or d.created_at <= p_date_to)
  ),
  filtered as (
    select * from scoped
    where p_commercial_status is null or commercial_state = p_commercial_status
  ),
  counted as (
    select count(*)::bigint as cnt from filtered
  )
  select
    f.deal_id,
    f.product_id,
    f.product_name,
    f.product_quantity,
    f.product_unit_price,
    f.amount,
    f.category,
    f.commercial_state,
    f.supplier_company_id,
    f.supplier_company_name,
    f.pyme_id,
    f.pyme_name,
    f.investor_id,
    f.investor_name,
    f.created_at,
    f.funded_at,
    f.shipped_at,
    c.cnt as total_count
  from filtered f
  cross join counted c
  order by f.created_at desc
  limit v_page_size offset v_offset;
end;
$$;

create or replace function public.get_supplier_product_performance(
  p_owner_id uuid,
  p_company_id uuid default null,
  p_product_id uuid default null,
  p_category text default null,
  p_commercial_status text default null,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null
)
returns table (
  product_id uuid,
  product_name text,
  category text,
  financing_request_count bigint,
  funded_request_count bigint,
  financing_conversion_rate numeric,
  financed_volume numeric,
  completed_volume numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_supplier_owner_scope(p_owner_id, p_company_id, p_product_id);

  return query
  with scoped as (
    select
      d.*,
      public.supplier_commercial_state(
        d.status,
        d.funding_expires_at,
        d.shipped_at,
        d.delivered_at
      ) as commercial_state
    from public.deals d
    inner join public.supplier_companies sc on sc.id = d.supplier_id
    where sc.owner_id = p_owner_id
      and d.product_id is not null
      and (p_company_id is null or d.supplier_id = p_company_id)
      and (p_product_id is null or d.product_id = p_product_id)
      and (p_category is null or d.category = p_category)
      and (p_date_from is null or d.created_at >= p_date_from)
      and (p_date_to is null or d.created_at <= p_date_to)
  ),
  filtered as (
    select * from scoped
    where p_commercial_status is null or commercial_state = p_commercial_status
  ),
  agg as (
    select
      f.product_id,
      max(sp.name) as product_name,
      max(sp.category) as category,
      count(*) filter (where f.commercial_state = 'financing_request') as financing_request_count,
      count(*) filter (where f.status in ('funded', 'in_progress', 'completed')) as funded_request_count,
      count(*) filter (where f.status <> 'cancelled') as eligible_count,
      coalesce(sum(f.amount) filter (where f.status in ('funded', 'in_progress', 'completed')), 0) as financed_volume,
      coalesce(sum(f.amount) filter (where f.status = 'completed'), 0) as completed_volume
    from filtered f
    inner join public.supplier_products sp on sp.id = f.product_id
    group by f.product_id
  )
  select
    a.product_id,
    a.product_name,
    a.category,
    a.financing_request_count,
    a.funded_request_count,
    case when a.eligible_count > 0
      then round(a.funded_request_count::numeric / a.eligible_count::numeric, 4)
      else 0
    end as financing_conversion_rate,
    a.financed_volume,
    a.completed_volume
  from agg a
  order by a.financed_volume desc, a.product_name;
end;
$$;

comment on function public.get_supplier_product_performance is
  'Product metrics use deals.product_id only. Conversion = funded / eligible where eligible excludes cancelled.';

create or replace function public.get_supplier_customer_activity(
  p_owner_id uuid,
  p_company_id uuid default null,
  p_product_id uuid default null,
  p_category text default null,
  p_commercial_status text default null,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null
)
returns table (
  pyme_id uuid,
  pyme_name text,
  products_requested text[],
  financing_request_count bigint,
  financing_request_value numeric,
  funded_request_count bigint,
  awaiting_funding_count bigint,
  most_recent_activity_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_supplier_owner_scope(p_owner_id, p_company_id, p_product_id);

  return query
  with scoped as (
    select
      d.*,
      public.supplier_commercial_state(
        d.status,
        d.funding_expires_at,
        d.shipped_at,
        d.delivered_at
      ) as commercial_state,
      coalesce(p.company_name, p.full_name, p.contact_name, 'PyME') as pyme_name
    from public.deals d
    inner join public.supplier_companies sc on sc.id = d.supplier_id
    left join public.profiles p on p.id = d.pyme_id
    where sc.owner_id = p_owner_id
      and (p_company_id is null or d.supplier_id = p_company_id)
      and (p_product_id is null or d.product_id = p_product_id)
      and (p_category is null or d.category = p_category)
      and (p_date_from is null or d.created_at >= p_date_from)
      and (p_date_to is null or d.created_at <= p_date_to)
  ),
  filtered as (
    select * from scoped
    where p_commercial_status is null or commercial_state = p_commercial_status
  )
  select
    f.pyme_id,
    f.pyme_name,
    array_agg(distinct f.product_name order by f.product_name) as products_requested,
    count(*)::bigint as financing_request_count,
    coalesce(sum(f.amount), 0) as financing_request_value,
    count(*) filter (where f.status in ('funded', 'in_progress', 'completed'))::bigint as funded_request_count,
    count(*) filter (where f.commercial_state = 'financing_request')::bigint as awaiting_funding_count,
    max(f.created_at) as most_recent_activity_at
  from filtered f
  group by f.pyme_id, f.pyme_name
  order by most_recent_activity_at desc nulls last;
end;
$$;

grant execute on function public.assert_supplier_owner_scope(uuid, uuid, uuid) to authenticated;
grant execute on function public.get_supplier_commercial_summary(uuid, uuid, uuid, text, text, timestamptz, timestamptz) to authenticated;
grant execute on function public.get_supplier_commercial_activity(uuid, uuid, uuid, text, text, timestamptz, timestamptz, integer, integer) to authenticated;
grant execute on function public.get_supplier_product_performance(uuid, uuid, uuid, text, text, timestamptz, timestamptz) to authenticated;
grant execute on function public.get_supplier_customer_activity(uuid, uuid, uuid, text, text, timestamptz, timestamptz) to authenticated;
