-- Delivery confirmation fields + repayment/escrow notification types

alter table public.deals
  add column if not exists tracking_id text,
  add column if not exists shipped_at timestamptz,
  add column if not exists delivered_at timestamptz;

comment on column public.deals.tracking_id is
  'Carrier tracking ID provided by the supplier when goods are shipped';
comment on column public.deals.shipped_at is
  'When the supplier confirmed shipment';
comment on column public.deals.delivered_at is
  'When the SMB confirmed goods received; repayment period starts here';

-- Clear premature due dates for deals that have not entered repayment yet
update public.deals
set repayment_due_at = null
where repayment_status = 'none'
  and delivered_at is null;

-- Expand notification type check constraint
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
    'goods_shipped'
  ));

-- Update funded notification copy for direct-pay + delivery flow
create or replace function public.notify_deal_funded()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  supplier_owner_id uuid;
begin
  if old.status != 'funded' and new.status = 'funded' then
    insert into public.notifications (user_id, type, title, body, link_url, link_label, metadata)
    values (
      new.pyme_id,
      'deal_funded',
      'Deal funded',
      'Your deal "' || coalesce(new.product_name, new.title) || '" has been funded. The supplier will ship the goods and share a tracking ID.',
      '/deals/' || new.id,
      'View deal',
      jsonb_build_object('deal_id', new.id, 'product_name', new.product_name)
    );

    if new.supplier_id is not null then
      select owner_id into supplier_owner_id
      from public.supplier_companies
      where id = new.supplier_id;

      if supplier_owner_id is not null then
        insert into public.notifications (user_id, type, title, body, link_url, link_label, metadata)
        values (
          supplier_owner_id,
          'deal_funded',
          'Deal funded – ship the goods',
          'A deal "' || coalesce(new.product_name, new.title) || '" has been funded. Confirm shipment and add a tracking ID so the buyer can verify delivery.',
          '/deals/' || new.id || '?action=ship',
          'Confirm shipment',
          jsonb_build_object('deal_id', new.id, 'product_name', new.product_name)
        );
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- Notify admins when SMB confirms delivery (repayment escrow needed)
create or replace function public.notify_repayment_escrow_needed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.repayment_status is distinct from new.repayment_status
     and new.repayment_status = 'order_confirmed' then
    insert into public.notifications (user_id, type, title, body, link_url, link_label, metadata)
    select
      p.id,
      'repayment_escrow_needed',
      'Create repayment escrow',
      'Deal "' || coalesce(new.product_name, new.title) || '" delivery was confirmed. Create the multi-release repayment escrow.',
      '/dashboard/admin/approvals',
      'Open approvals',
      jsonb_build_object('deal_id', new.id, 'product_name', new.product_name)
    from public.profiles p
    where p.user_type = 'admin';
  end if;

  return new;
end;
$$;

drop trigger if exists deals_notify_repayment_escrow_needed on public.deals;
create trigger deals_notify_repayment_escrow_needed
  after update on public.deals
  for each row
  when (old.repayment_status is distinct from new.repayment_status)
  execute function public.notify_repayment_escrow_needed();

-- Notify investor + PyME when repayment escrow is created
create or replace function public.notify_repayment_escrow_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.repayment_status is distinct from new.repayment_status
     and new.repayment_status = 'escrow_initialized' then
    insert into public.notifications (user_id, type, title, body, link_url, link_label, metadata)
    values (
      new.pyme_id,
      'repayment_escrow_created',
      'Repayment escrow ready',
      'The repayment escrow for "' || coalesce(new.product_name, new.title) || '" is ready. You can start funding repayments.',
      '/deals/' || new.id || '?action=repayment',
      'Fund repayment',
      jsonb_build_object('deal_id', new.id, 'product_name', new.product_name)
    );

    if new.investor_id is not null then
      insert into public.notifications (user_id, type, title, body, link_url, link_label, metadata)
      values (
        new.investor_id,
        'repayment_escrow_created',
        'Repayment escrow created',
        'Mercato created the repayment escrow for "' || coalesce(new.product_name, new.title) || '". Milestone releases will appear here.',
        '/deals/' || new.id || '?action=repayment',
        'View deal',
        jsonb_build_object('deal_id', new.id, 'product_name', new.product_name)
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists deals_notify_repayment_escrow_created on public.deals;
create trigger deals_notify_repayment_escrow_created
  after update on public.deals
  for each row
  when (old.repayment_status is distinct from new.repayment_status)
  execute function public.notify_repayment_escrow_created();

-- Notify PyME when supplier ships (optional awareness)
create or replace function public.notify_goods_shipped()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.shipped_at is null and new.shipped_at is not null then
    insert into public.notifications (user_id, type, title, body, link_url, link_label, metadata)
    values (
      new.pyme_id,
      'goods_shipped',
      'Goods shipped',
      'The supplier marked "' || coalesce(new.product_name, new.title) || '" as shipped'
        || case
             when new.tracking_id is not null and length(trim(new.tracking_id)) > 0
               then ' (tracking: ' || trim(new.tracking_id) || '). Confirm when the order arrives.'
             else '. Confirm when the order arrives.'
           end,
      '/deals/' || new.id || '?action=delivery',
      'Confirm delivery',
      jsonb_build_object(
        'deal_id', new.id,
        'product_name', new.product_name,
        'tracking_id', new.tracking_id
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists deals_notify_goods_shipped on public.deals;
create trigger deals_notify_goods_shipped
  after update on public.deals
  for each row
  when (old.shipped_at is distinct from new.shipped_at)
  execute function public.notify_goods_shipped();
