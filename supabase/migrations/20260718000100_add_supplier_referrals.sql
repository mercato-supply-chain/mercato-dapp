-- Add referral_code to supplier_companies and referred_by_supplier_id to profiles

alter table public.supplier_companies
  add column if not exists referral_code text;

create or replace function public.generate_supplier_referral_code()
returns text
language plpgsql
as $$
declare
  candidate text;
  exists_already boolean;
begin
  loop
    candidate := upper(substr(md5(gen_random_uuid()::text), 1, 8));
    select exists(
      select 1 from public.supplier_companies where referral_code = candidate
    ) into exists_already;
    exit when not exists_already;
  end loop;
  return candidate;
end;
$$;

update public.supplier_companies
set referral_code = public.generate_supplier_referral_code()
where referral_code is null;

alter table public.supplier_companies
  alter column referral_code set not null;

create unique index if not exists idx_supplier_companies_referral_code
  on public.supplier_companies(referral_code);

create or replace function public.set_supplier_referral_code()
returns trigger
language plpgsql
as $$
begin
  if new.referral_code is null then
    new.referral_code := public.generate_supplier_referral_code();
  end if;
  return new;
end;
$$;

drop trigger if exists supplier_companies_set_referral_code on public.supplier_companies;
create trigger supplier_companies_set_referral_code
  before insert on public.supplier_companies
  for each row
  execute function public.set_supplier_referral_code();

alter table public.profiles
  add column if not exists referred_by_supplier_id uuid references public.supplier_companies(id);

create or replace function public.lock_referred_by_supplier_id()
returns trigger
language plpgsql
as $$
begin
  new.referred_by_supplier_id := old.referred_by_supplier_id;
  return new;
end;
$$;

drop trigger if exists profiles_lock_referred_by on public.profiles;
create trigger profiles_lock_referred_by
  before update on public.profiles
  for each row
  execute function public.lock_referred_by_supplier_id();
