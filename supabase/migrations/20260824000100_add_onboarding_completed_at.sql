-- Record the authoritative moment a profile finishes onboarding.
-- Onboarding is complete when user_type transitions from null to a role;
-- profiles.updated_at cannot be used because later profile/wallet edits touch it.
alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz;

create or replace function public.stamp_onboarding_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Stamp once when onboarding transitions incomplete -> complete.
  if old.user_type is null
     and new.user_type is not null
     and new.onboarding_completed_at is null then
    new.onboarding_completed_at := now();
  end if;

  -- Immutable once set: ignore any attempt to change or clear it.
  if old.onboarding_completed_at is not null then
    new.onboarding_completed_at := old.onboarding_completed_at;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_stamp_onboarding on public.profiles;
create trigger profiles_stamp_onboarding
  before update on public.profiles
  for each row
  execute function public.stamp_onboarding_completed();

-- Profiles created with a role already resolved (signup metadata) never pass
-- through the null -> role transition, so stamp them at insert time.
create or replace function public.stamp_onboarding_completed_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_type is not null and new.onboarding_completed_at is null then
    new.onboarding_completed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_stamp_onboarding_insert on public.profiles;
create trigger profiles_stamp_onboarding_insert
  before insert on public.profiles
  for each row
  execute function public.stamp_onboarding_completed_on_insert();
