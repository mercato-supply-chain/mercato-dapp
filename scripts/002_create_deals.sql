-- Create deals table
create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  pyme_id uuid not null references public.profiles(id) on delete cascade,
  supplier_id uuid references public.profiles(id) on delete set null,
  investor_id uuid references public.profiles(id) on delete set null,
  
  title text not null,
  description text not null,
  category text not null,
  
  -- Product details
  product_name text not null,
  product_quantity integer not null,
  product_unit_price numeric(10, 2) not null,
  
  -- Supplier details
  supplier_name text not null,
  supplier_email text,
  supplier_contact text,
  
  -- Financial details
  amount numeric(10, 2) not null,
  interest_rate numeric(5, 2) not null,
  term_days integer not null,
  
  -- Status
  status text not null default 'seeking_funding' 
    check (status in ('seeking_funding', 'funded', 'in_progress', 'completed', 'cancelled')),
  
  -- Blockchain details
  escrow_address text,
  transaction_hash text,
  
  -- Timestamps
  created_at timestamp with time zone default now(),
  funded_at timestamp with time zone,
  completed_at timestamp with time zone,
  updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.deals enable row level security;

-- Policies
-- PyMEs can insert their own deals
create policy "deals_insert_pyme" on public.deals 
  for insert with check (auth.uid() = pyme_id);

-- Users can view all deals (marketplace)
create policy "deals_select_all" on public.deals 
  for select using (true);

-- Deal stakeholders can update deals
create policy "deals_update_stakeholders" on public.deals 
  for update using (
    auth.uid() = pyme_id or 
    auth.uid() = supplier_id or 
    auth.uid() = investor_id
  );

-- Only PyMEs can delete their own unfunded deals
create policy "deals_delete_pyme" on public.deals 
  for delete using (
    auth.uid() = pyme_id and 
    status = 'seeking_funding'
  );

-- Create indexes
create index idx_deals_pyme_id on public.deals(pyme_id);
create index idx_deals_supplier_id on public.deals(supplier_id);
create index idx_deals_investor_id on public.deals(investor_id);
create index idx_deals_status on public.deals(status);
create index idx_deals_created_at on public.deals(created_at desc);
