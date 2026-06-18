create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in (
    'deal_created',
    'deal_funded',
    'milestone_1_approved',
    'milestone_2_approved',
    'pyme_investor_deal_created',
    'pyme_investor_deal_complete'
  )),
  title text not null,
  body text,
  link_url text,
  link_label text,
  metadata jsonb default '{}',
  read_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_notifications_created_at on public.notifications(created_at desc);
create index if not exists idx_notifications_user_unread on public.notifications(user_id, read_at) where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
  for select using (auth.uid() = user_id);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
  for update using (auth.uid() = user_id);

create or replace function public.notify_deal_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'seeking_funding' then
    insert into public.notifications (user_id, type, title, body, link_url, link_label, metadata)
    select
      p.id,
      'deal_created',
      'New deal available',
      'A new deal has been created: ' || coalesce(new.product_name, new.title) || '. Check the marketplace to fund it.',
      '/deals/' || new.id,
      'View deal',
      jsonb_build_object('deal_id', new.id, 'product_name', new.product_name)
    from public.profiles p
    where p.user_type = 'investor';
  end if;

  return new;
end;
$$;

drop trigger if exists deals_notify_created on public.deals;
create trigger deals_notify_created
  after insert on public.deals
  for each row
  execute function public.notify_deal_created();

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
      'Your deal "' || coalesce(new.product_name, new.title) || '" has been funded. Ask the supplier to accept the initial milestone.',
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
          'Deal funded – accept initial milestone',
          'A deal "' || coalesce(new.product_name, new.title) || '" has been funded. Accept the initial milestone to unlock the first 50%.',
          '/deals/' || new.id,
          'Accept deal',
          jsonb_build_object('deal_id', new.id, 'product_name', new.product_name)
        );
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists deals_notify_funded on public.deals;
create trigger deals_notify_funded
  after update on public.deals
  for each row
  when (old.status is distinct from new.status)
  execute function public.notify_deal_funded();

create or replace function public.notify_milestone_approved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  d record;
  supplier_owner_id uuid;
  completed_count int;
  notif_type text;
  notif_title text;
  notif_body text;
begin
  if new.status != 'completed' then
    return new;
  end if;

  select * into d
  from public.deals
  where id = new.deal_id;

  if d is null then
    return new;
  end if;

  select count(*) into completed_count
  from public.milestones
  where deal_id = new.deal_id
    and status = 'completed';

  if completed_count = 1 then
    notif_type := 'milestone_1_approved';
    notif_title := 'First milestone released';
    notif_body := 'The first milestone for deal "' || coalesce(d.product_name, d.title) || '" has been released to the supplier.';
  else
    notif_type := 'milestone_2_approved';
    notif_title := 'Second milestone released';
    notif_body := 'The second milestone for deal "' || coalesce(d.product_name, d.title) || '" has been released. Deal delivery complete.';
  end if;

  if d.investor_id is not null then
    insert into public.notifications (user_id, type, title, body, link_url, link_label, metadata)
    values (
      d.investor_id,
      notif_type,
      notif_title,
      notif_body,
      '/deals/' || d.id,
      'View deal',
      jsonb_build_object('deal_id', d.id, 'milestone_id', new.id)
    );
  end if;

  insert into public.notifications (user_id, type, title, body, link_url, link_label, metadata)
  values (
    d.pyme_id,
    notif_type,
    notif_title,
    notif_body,
    '/deals/' || d.id,
    'View deal',
    jsonb_build_object('deal_id', d.id, 'milestone_id', new.id)
  );

  if d.supplier_id is not null then
    select owner_id into supplier_owner_id
    from public.supplier_companies
    where id = d.supplier_id;

    if supplier_owner_id is not null then
      insert into public.notifications (user_id, type, title, body, link_url, link_label, metadata)
      values (
        supplier_owner_id,
        notif_type,
        notif_title,
        notif_body,
        '/deals/' || d.id,
        'View deal',
        jsonb_build_object('deal_id', d.id, 'milestone_id', new.id)
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists milestones_notify_approved on public.milestones;
create trigger milestones_notify_approved
  after update on public.milestones
  for each row
  when (old.status is distinct from new.status and new.status = 'completed')
  execute function public.notify_milestone_approved();
