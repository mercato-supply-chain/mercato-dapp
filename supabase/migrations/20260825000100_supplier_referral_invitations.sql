-- Supplier referral invitations and event log (Issue 1 infrastructure).

create table if not exists public.supplier_referral_invitations (
  id uuid primary key default gen_random_uuid(),
  supplier_company_id uuid not null references public.supplier_companies(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  label text,
  recipient_email text,
  status text not null default 'active'
    check (status in ('active', 'revoked', 'expired', 'converted')),
  token_hash text not null,
  expires_at timestamptz,
  converted_profile_id uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists supplier_referral_invitations_company_idx
  on public.supplier_referral_invitations (supplier_company_id);

create index if not exists supplier_referral_invitations_token_hash_idx
  on public.supplier_referral_invitations (token_hash);

create index if not exists supplier_referral_invitations_status_idx
  on public.supplier_referral_invitations (status);

comment on table public.supplier_referral_invitations is
  'Per-invitation referral links. Raw tokens are never stored; only token_hash.';

create table if not exists public.referral_events (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid references public.supplier_referral_invitations(id) on delete set null,
  supplier_company_id uuid not null references public.supplier_companies(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  event_type text not null
    check (event_type in (
      'invitation_created',
      'link_opened',
      'account_created',
      'onboarding_completed',
      'deal_created',
      'deal_funded'
    )),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists referral_events_company_idx
  on public.referral_events (supplier_company_id, created_at desc);

create index if not exists referral_events_invitation_idx
  on public.referral_events (invitation_id, created_at desc);

alter table public.profiles
  add column if not exists referral_invitation_id uuid
    references public.supplier_referral_invitations(id) on delete set null;

create index if not exists profiles_referred_by_supplier_id_idx
  on public.profiles (referred_by_supplier_id);

create index if not exists profiles_referral_invitation_id_idx
  on public.profiles (referral_invitation_id);

-- RLS: supplier owners can read/manage their company invitations and events.
alter table public.supplier_referral_invitations enable row level security;
alter table public.referral_events enable row level security;

drop policy if exists supplier_referral_invitations_owner_select on public.supplier_referral_invitations;
create policy supplier_referral_invitations_owner_select on public.supplier_referral_invitations
  for select using (
    exists (
      select 1 from public.supplier_companies sc
      where sc.id = supplier_referral_invitations.supplier_company_id
        and sc.owner_id = auth.uid()
    )
  );

drop policy if exists supplier_referral_invitations_owner_insert on public.supplier_referral_invitations;
create policy supplier_referral_invitations_owner_insert on public.supplier_referral_invitations
  for insert with check (
    exists (
      select 1 from public.supplier_companies sc
      where sc.id = supplier_referral_invitations.supplier_company_id
        and sc.owner_id = auth.uid()
    )
    and created_by = auth.uid()
  );

drop policy if exists supplier_referral_invitations_owner_update on public.supplier_referral_invitations;
create policy supplier_referral_invitations_owner_update on public.supplier_referral_invitations
  for update using (
    exists (
      select 1 from public.supplier_companies sc
      where sc.id = supplier_referral_invitations.supplier_company_id
        and sc.owner_id = auth.uid()
    )
  );

drop policy if exists referral_events_owner_select on public.referral_events;
create policy referral_events_owner_select on public.referral_events
  for select using (
    exists (
      select 1 from public.supplier_companies sc
      where sc.id = referral_events.supplier_company_id
        and sc.owner_id = auth.uid()
    )
  );

-- Signup attribution: extend handle_new_user for invitation tokens in metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_type text := nullif(trim(coalesce(new.raw_user_meta_data->>'user_type', '')), '');
  resolved_type text;
  v_referred_by uuid;
  v_invitation_id uuid;
  v_token_hash text;
begin
  if meta_type in ('pyme', 'investor', 'supplier', 'admin') then
    resolved_type := meta_type;
  else
    resolved_type := null;
  end if;

  -- Invitation token path (metadata carries pre-hashed token lookup key from server).
  if new.raw_user_meta_data->>'referral_invitation_id' is not null then
    begin
      v_invitation_id := (new.raw_user_meta_data->>'referral_invitation_id')::uuid;
      select i.supplier_company_id into v_referred_by
      from public.supplier_referral_invitations i
      where i.id = v_invitation_id
        and i.status = 'active'
        and (i.expires_at is null or i.expires_at > now());
    exception when others then
      v_invitation_id := null;
      v_referred_by := null;
    end;
  end if;

  if v_referred_by is null and new.raw_user_meta_data->>'referred_by_supplier_id' is not null then
    begin
      v_referred_by := (new.raw_user_meta_data->>'referred_by_supplier_id')::uuid;
      if not exists (select 1 from public.supplier_companies where id = v_referred_by) then
        v_referred_by := null;
      end if;
    exception when others then
      v_referred_by := null;
    end;
  end if;

  insert into public.profiles (
    id,
    email,
    user_type,
    company_name,
    contact_name,
    full_name,
    referred_by_supplier_id,
    referral_invitation_id
  )
  values (
    new.id,
    new.email,
    resolved_type,
    coalesce(new.raw_user_meta_data->>'company_name', null),
    coalesce(new.raw_user_meta_data->>'contact_name', new.raw_user_meta_data->>'full_name', null),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'contact_name', null),
    v_referred_by,
    v_invitation_id
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Lock referral_invitation_id after signup (same as referred_by_supplier_id).
create or replace function public.lock_referred_by_supplier_id()
returns trigger
language plpgsql
as $$
begin
  new.referred_by_supplier_id := old.referred_by_supplier_id;
  new.referral_invitation_id := old.referral_invitation_id;
  return new;
end;
$$;
