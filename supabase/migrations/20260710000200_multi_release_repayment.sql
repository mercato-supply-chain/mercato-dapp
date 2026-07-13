-- Multi-release repayment escrow: expanded status lifecycle + amount/milestone cache.

alter table public.deals
  drop constraint if exists deals_repayment_status_check;

alter table public.deals
  add constraint deals_repayment_status_check
  check (
    repayment_status in (
      'none',
      'order_confirmed',
      'escrow_initialized',
      'funding',
      'ready_to_release',
      'partially_released',
      'released',
      -- legacy single-release value kept for existing rows
      'funded'
    )
  );

alter table public.deals
  add column if not exists repayment_total_amount numeric,
  add column if not exists repayment_milestones jsonb not null default '[]'::jsonb;

comment on column public.deals.repayment_status is
  'Repayment escrow lifecycle: none → order_confirmed → escrow_initialized → funding → ready_to_release → partially_released → released';

comment on column public.deals.repayment_total_amount is
  'Full grossed repayment escrow target (principal + interest / 0.987)';

comment on column public.deals.repayment_milestones is
  'Cached Trustless Work multi-release milestones for repayment [{index, description, amount, released}]';
