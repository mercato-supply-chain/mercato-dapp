-- Stake-based trust signal v1
-- Stores an app-level visible stake amount per profile.
-- This does not implement tokenomics or lock funds on-chain.

alter table public.profiles
  add column if not exists stake_amount numeric not null default 0,
  add column if not exists stake_updated_at timestamp with time zone;

do $$
begin
  alter table public.profiles
    add constraint profiles_stake_amount_nonnegative check (stake_amount >= 0);
exception
  when duplicate_object then null;
end $$;

comment on column public.profiles.stake_amount is
  'Visible trust commitment amount for stake signal v1 (app-level, non-tokenomic).';

comment on column public.profiles.stake_updated_at is
  'Timestamp of the latest stake_amount update.';
