-- Add pyme_referred to the notifications type CHECK constraint
alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check check (type in (
    'deal_created',
    'deal_funded',
    'milestone_1_approved',
    'milestone_2_approved',
    'pyme_investor_deal_created',
    'pyme_investor_deal_complete',
    'pyme_referred'
  ));
