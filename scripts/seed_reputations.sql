-- Seed data for reputations table
-- Assumes some profiles exist (you can adjust IDs if needed)

-- Example: PyME with good performance
insert into public.reputations (user_id, capital_committed, deals_completed, repayment_performance, reputation_score, trust_label, stake_amount)
select id, 0, 5, 98.5, 95.0, 'Top Performer', 5000
from public.profiles
where user_type = 'pyme'
limit 1
on conflict (user_id) do nothing;

-- Example: Investor with some activity
insert into public.reputations (user_id, capital_committed, deals_completed, reputation_score, trust_label)
select id, 25000, 3, 85.0, 'Active Investor'
from public.profiles
where user_type = 'investor'
limit 1
on conflict (user_id) do nothing;
