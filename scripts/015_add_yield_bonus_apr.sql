-- Optional extra APR (percentage points) PyMEs can add on top of the formula rate to attract investors.
alter table public.deals
  add column if not exists yield_bonus_apr numeric(5, 2) not null default 0;

comment on column public.deals.yield_bonus_apr is
  'Additional APR percentage points offered by the PyME on top of the base rate from term and amount.';
