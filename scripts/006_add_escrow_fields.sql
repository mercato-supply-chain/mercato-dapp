-- Add escrow-related fields to deals table
alter table public.deals
add column if not exists escrow_id text,
add column if not exists escrow_contract_address text,
add column if not exists escrow_transaction_hash text,
add column if not exists escrow_status text default 'pending',
add column if not exists platform_fee numeric default 2.5;

-- Add comment
comment on column public.deals.escrow_id is 'Unique identifier for the TrustlessWork escrow';
comment on column public.deals.escrow_contract_address is 'Stellar smart contract address for the escrow';
comment on column public.deals.escrow_transaction_hash is 'Transaction hash of escrow initialization';
comment on column public.deals.escrow_status is 'Status of escrow: pending, initialized, active, completed, disputed';
comment on column public.deals.platform_fee is 'Platform fee percentage (e.g., 2.5 for 2.5%)';
