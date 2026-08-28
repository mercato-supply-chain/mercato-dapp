-- Signup metadata must not be able to create administrator profiles.
-- handle_new_user() is security definer and previously accepted 'admin'
-- from raw_user_meta_data before the update-time privileged-field trigger.

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
begin
  -- Onboarding roles only. 'admin' is ignored the same way as unknown values.
  if meta_type in ('pyme', 'investor', 'supplier') then
    resolved_type := meta_type;
  else
    resolved_type := null;
  end if;

  if new.raw_user_meta_data->>'referred_by_supplier_id' is not null then
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
    referred_by_supplier_id
  )
  values (
    new.id,
    new.email,
    resolved_type,
    coalesce(new.raw_user_meta_data->>'company_name', null),
    coalesce(new.raw_user_meta_data->>'contact_name', new.raw_user_meta_data->>'full_name', null),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'contact_name', null),
    v_referred_by
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Client inserts (profiles_insert_own) can still supply user_type. Strip admin
-- unless the writer is the service role (bootstrap / authorised provisioning).
create or replace function public.enforce_profile_insert_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
    return new;
  end if;

  if new.user_type = 'admin' then
    new.user_type := null;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_enforce_insert_privileged_fields on public.profiles;
create trigger profiles_enforce_insert_privileged_fields
  before insert on public.profiles
  for each row
  execute function public.enforce_profile_insert_privileged_fields();

-- Authorised administrator provisioning. Existing admins (or SQL as service
-- role for the first admin) assign roles; signup metadata cannot.
create or replace function public.admin_set_user_type(
  p_profile_id uuid,
  p_user_type text,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := assert_admin();
  v_before text;
  v_audit uuid;
begin
  if p_user_type is null or p_user_type not in ('pyme', 'investor', 'supplier', 'admin') then
    raise exception 'invalid_user_type' using errcode = '22023';
  end if;

  select user_type into v_before from profiles where id = p_profile_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  update profiles
    set user_type = p_user_type, updated_at = now()
    where id = p_profile_id;

  insert into admin_audit_events
    (admin_user_id, action, entity_type, entity_id, before, after, reason)
  values (
    v_admin,
    'set_user_type',
    'profile',
    p_profile_id::text,
    jsonb_build_object('user_type', v_before),
    jsonb_build_object('user_type', p_user_type),
    nullif(trim(coalesce(p_reason, '')), '')
  )
  returning id into v_audit;

  return v_audit;
end;
$$;

revoke execute on function public.admin_set_user_type(uuid, text, text) from anon;
