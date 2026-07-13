-- Dual-fee deal flow: platform fee 1%, funding tx hash, repayment escrow fields.

alter table public.deals
  alter column platform_fee set default 1;

update public.deals
set platform_fee = 1
where platform_fee is null or platform_fee = 2.5;

comment on column public.deals.platform_fee is
  'Platform fee percentage (1 = 1%). Charged on investment (investor) and repayment (SMB).';

alter table public.deals
  add column if not exists funding_tx_hash text,
  add column if not exists repayment_status text not null default 'none',
  add column if not exists repayment_due_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'deals_repayment_status_check'
  ) then
    alter table public.deals
      add constraint deals_repayment_status_check
      check (
        repayment_status in (
          'none',
          'escrow_initialized',
          'funded',
          'released'
        )
      );
  end if;
end $$;

comment on column public.deals.funding_tx_hash is
  'Stellar transaction hash of investor direct payment (supplier + platform fee)';
comment on column public.deals.repayment_status is
  'Repayment escrow lifecycle: none, escrow_initialized, funded, released';
comment on column public.deals.repayment_due_at is
  'When SMB repayment is due (funded_at + term_days)';
comment on column public.deals.escrow_contract_address is
  'Trustless Work repayment escrow contract address (investor payout)';
comment on column public.deals.escrow_status is
  'Repayment escrow status: pending, initialized, active, completed, disputed';
