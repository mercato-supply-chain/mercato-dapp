-- Issue #160: restore invitation attribution in handle_new_user (kept admin rejection),
-- allow one-time late attribution when columns are still null, extend referral event types,
-- and convert invitations on attribution updates as well as inserts.

-- ---------------------------------------------------------------------------
-- Event types: signup_started + invitation_revoked
-- ---------------------------------------------------------------------------
alter table public.referral_events
  drop constraint if exists referral_events_event_type_check;

alter table public.referral_events
  add constraint referral_events_event_type_check
  check (event_type in (
    'invitation_created',
    'link_opened',
    'signup_started',
    'account_created',
    'onboarding_completed',
    'invitation_revoked',
    'deal_created',
    'deal_funded'
  ));

create unique index if not exists supplier_referral_invitations_token_hash_uidx
  on public.supplier_referral_invitations (token_hash);

-- ---------------------------------------------------------------------------
-- handle_new_user: reject admin + resolve invitation / legacy referral metadata
-- ---------------------------------------------------------------------------
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
begin
  -- Onboarding roles only. 'admin' is ignored the same way as unknown values.
  if meta_type in ('pyme', 'investor', 'supplier') then
    resolved_type := meta_type;
  else
    resolved_type := null;
  end if;

  -- Opaque invitation path (signup metadata carries invitation id from resolved token).
  if new.raw_user_meta_data->>'referral_invitation_id' is not null then
    begin
      v_invitation_id := (new.raw_user_meta_data->>'referral_invitation_id')::uuid;
      select i.supplier_company_id into v_referred_by
      from public.supplier_referral_invitations i
      where i.id = v_invitation_id
        and i.status = 'active'
        and (i.expires_at is null or i.expires_at > now());
      if v_referred_by is null then
        v_invitation_id := null;
      end if;
    exception when others then
      v_invitation_id := null;
      v_referred_by := null;
    end;
  end if;

  -- Legacy UUID referral compatibility.
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

-- ---------------------------------------------------------------------------
-- Immutability: freeze attribution once set; allow null → value once (onboarding)
-- ---------------------------------------------------------------------------
create or replace function public.lock_referred_by_supplier_id()
returns trigger
language plpgsql
as $$
begin
  if old.referred_by_supplier_id is not null then
    new.referred_by_supplier_id := old.referred_by_supplier_id;
  end if;
  if old.referral_invitation_id is not null then
    new.referral_invitation_id := old.referral_invitation_id;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Conversion + account_created on insert OR first-time attribution update
-- ---------------------------------------------------------------------------
create or replace function public.after_profile_referral_attribution()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation_id uuid;
  v_supplier_id uuid;
  already_logged boolean;
begin
  if tg_op = 'UPDATE' then
    -- Only act when attribution is newly applied.
    if old.referred_by_supplier_id is not null
       or new.referred_by_supplier_id is null then
      return new;
    end if;
  end if;

  v_supplier_id := new.referred_by_supplier_id;
  v_invitation_id := new.referral_invitation_id;

  if v_supplier_id is null then
    return new;
  end if;

  if v_invitation_id is not null then
    update public.supplier_referral_invitations
    set
      status = 'converted',
      converted_profile_id = new.id,
      updated_at = now()
    where id = v_invitation_id
      and status = 'active';
  end if;

  select exists (
    select 1
    from public.referral_events re
    where re.profile_id = new.id
      and re.event_type = 'account_created'
      and (
        (v_invitation_id is not null and re.invitation_id = v_invitation_id)
        or (v_invitation_id is null and re.supplier_company_id = v_supplier_id)
      )
  ) into already_logged;

  if not already_logged then
    insert into public.referral_events (
      invitation_id,
      supplier_company_id,
      profile_id,
      event_type
    ) values (
      v_invitation_id,
      v_supplier_id,
      new.id,
      'account_created'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_referral_attribution_after_insert on public.profiles;
create trigger profiles_referral_attribution_after_insert
  after insert on public.profiles
  for each row
  execute function public.after_profile_referral_attribution();

drop trigger if exists profiles_referral_attribution_after_update on public.profiles;
create trigger profiles_referral_attribution_after_update
  after update of referred_by_supplier_id, referral_invitation_id on public.profiles
  for each row
  execute function public.after_profile_referral_attribution();
