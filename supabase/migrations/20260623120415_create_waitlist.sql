create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  role text,
  referral_source text,
  position bigint generated always as identity,
  notified_at timestamptz,
  created_at timestamptz default now()
);

alter table public.waitlist enable row level security;

create policy "Anyone can join waitlist"
on public.waitlist
for insert
with check (true);

create policy "Anyone can view waitlist"
on public.waitlist
for select
using (true);
