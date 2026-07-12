-- Restrict tracking_id / shipped_at writes to supplier owner or admin

create or replace function public.enforce_deal_shipment_roles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_admin boolean := false;
  is_supplier_owner boolean := false;
begin
  -- Only gate when shipment fields are being set/changed
  if (new.tracking_id is not distinct from old.tracking_id)
     and (new.shipped_at is not distinct from old.shipped_at) then
    return new;
  end if;

  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.user_type = 'admin'
  ) into is_admin;

  if new.supplier_id is not null then
    select exists (
      select 1
      from public.supplier_companies sc
      where sc.id = new.supplier_id
        and sc.owner_id = auth.uid()
    ) into is_supplier_owner;
  end if;

  if not (is_admin or is_supplier_owner) then
    raise exception 'Only the supplier or an admin can set tracking_id / shipped_at';
  end if;

  return new;
end;
$$;

drop trigger if exists deals_enforce_shipment_roles on public.deals;
create trigger deals_enforce_shipment_roles
  before update on public.deals
  for each row
  execute function public.enforce_deal_shipment_roles();
