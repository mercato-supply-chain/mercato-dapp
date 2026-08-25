-- Server-authorized admin mutations. Each RPC verifies the caller is an admin,
-- applies the change, and records an admin_audit_events row in one transaction.

create or replace function public.assert_admin()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or not exists (
    select 1 from profiles where id = uid and user_type = 'admin'
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return uid;
end;
$$;

revoke execute on function public.assert_admin() from anon;

-- Verify or unverify a profile or supplier company, with an audit event.
create or replace function public.admin_set_verification(
  p_entity_type text,
  p_entity_id uuid,
  p_verified boolean,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := assert_admin();
  v_before jsonb;
  v_audit uuid;
begin
  if p_entity_type = 'profile' then
    select jsonb_build_object('verified', verified)
      into v_before
      from profiles
      where id = p_entity_id
      for update;
    if not found then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
    update profiles
      set verified = p_verified, updated_at = now()
      where id = p_entity_id;
  elsif p_entity_type = 'supplier_company' then
    select jsonb_build_object('verified', verified)
      into v_before
      from supplier_companies
      where id = p_entity_id
      for update;
    if not found then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
    update supplier_companies
      set verified = p_verified, updated_at = now()
      where id = p_entity_id;
  else
    raise exception 'invalid_entity_type' using errcode = '22023';
  end if;

  insert into admin_audit_events
    (admin_user_id, action, entity_type, entity_id, before, after, reason)
  values (
    v_admin,
    case when p_verified then 'verify' else 'unverify' end,
    p_entity_type,
    p_entity_id::text,
    v_before,
    jsonb_build_object('verified', p_verified),
    nullif(trim(coalesce(p_reason, '')), '')
  )
  returning id into v_audit;

  return v_audit;
end;
$$;

revoke execute on function public.admin_set_verification(text, uuid, boolean, text) from anon;

-- Correct a limited set of public-profile fields on behalf of a user.
-- Only whitelisted keys are applied; role, verification, email, and wallet
-- columns are never editable through this path.
create or replace function public.admin_update_profile(
  p_profile_id uuid,
  p_fields jsonb,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := assert_admin();
  v_allowed text[] := array[
    'full_name', 'contact_name', 'company_name', 'phone',
    'country', 'sector', 'website', 'bio'
  ];
  v_key text;
  v_before jsonb := '{}'::jsonb;
  v_after jsonb := '{}'::jsonb;
  v_row profiles%rowtype;
  v_audit uuid;
begin
  if p_fields is null or jsonb_typeof(p_fields) <> 'object' then
    raise exception 'invalid_fields' using errcode = '22023';
  end if;

  select * into v_row from profiles where id = p_profile_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  for v_key in select jsonb_object_keys(p_fields) loop
    if not v_key = any (v_allowed) then
      raise exception 'field_not_allowed: %', v_key using errcode = '22023';
    end if;
    v_before := v_before || jsonb_build_object(v_key, to_jsonb(v_row) -> v_key);
    v_after := v_after || jsonb_build_object(v_key, p_fields -> v_key);
  end loop;

  if v_after = '{}'::jsonb then
    raise exception 'invalid_fields' using errcode = '22023';
  end if;

  update profiles
    set full_name = coalesce(nullif(p_fields ->> 'full_name', ''), full_name),
        contact_name = coalesce(nullif(p_fields ->> 'contact_name', ''), contact_name),
        company_name = coalesce(nullif(p_fields ->> 'company_name', ''), company_name),
        phone = case when p_fields ? 'phone' then p_fields ->> 'phone' else phone end,
        country = case when p_fields ? 'country' then p_fields ->> 'country' else country end,
        sector = case when p_fields ? 'sector' then p_fields ->> 'sector' else sector end,
        website = case when p_fields ? 'website' then p_fields ->> 'website' else website end,
        bio = case when p_fields ? 'bio' then p_fields ->> 'bio' else bio end,
        updated_at = now()
    where id = p_profile_id;

  insert into admin_audit_events
    (admin_user_id, action, entity_type, entity_id, before, after, reason)
  values (
    v_admin, 'update_profile', 'profile', p_profile_id::text,
    v_before, v_after, nullif(trim(coalesce(p_reason, '')), '')
  )
  returning id into v_audit;

  return v_audit;
end;
$$;

revoke execute on function public.admin_update_profile(uuid, jsonb, text) from anon;

-- Admin verification is meaningless while row owners can flip their own
-- verified flag (profiles_update_own / supplier_companies_update_own have no
-- column restrictions). Follow the lock_referred_by_supplier_id pattern:
-- silently keep the previous value for non-admin writers. Service-role and
-- direct database access remain unrestricted.
create or replace function public.enforce_profile_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null
     or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
     or exists (
       select 1 from profiles p
       where p.id = v_actor and p.user_type = 'admin'
     ) then
    return new;
  end if;

  if new.verified is distinct from old.verified then
    new.verified := old.verified;
  end if;

  -- Onboarding role self-selection stays allowed; claiming admin does not.
  if new.user_type = 'admin' and old.user_type is distinct from 'admin' then
    new.user_type := old.user_type;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_enforce_privileged_fields on public.profiles;
create trigger profiles_enforce_privileged_fields
  before update on public.profiles
  for each row
  execute function public.enforce_profile_privileged_fields();

create or replace function public.enforce_company_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null
     or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
     or exists (
       select 1 from profiles p
       where p.id = v_actor and p.user_type = 'admin'
     ) then
    return new;
  end if;

  if new.verified is distinct from old.verified then
    new.verified := old.verified;
  end if;

  return new;
end;
$$;

drop trigger if exists supplier_companies_enforce_privileged_fields on public.supplier_companies;
create trigger supplier_companies_enforce_privileged_fields
  before update on public.supplier_companies
  for each row
  execute function public.enforce_company_privileged_fields();
