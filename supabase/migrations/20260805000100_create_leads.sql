create table leads (
  id uuid primary key default gen_random_uuid(),
  event_slug text not null,
  name text not null,
  email text not null,
  company text,
  role text check (role in ('pyme', 'investor', 'supplier', 'other')),
  country text,
  phone text,
  current_financing text,
  funding_timeline text,
  supplier_payment_process text,
  biggest_challenge text,
  last_financing_experience text,
  locale text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  referrer text,
  created_at timestamptz not null default now()
);

create index leads_event_slug_idx on leads (event_slug);
create index leads_created_at_idx on leads (created_at desc);
create index leads_email_event_slug_idx on leads (email, event_slug);

alter table leads enable row level security;

create policy "leads_select_admin" on public.leads
  for select using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.user_type = 'admin'
    )
  );
