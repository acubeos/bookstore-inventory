-- Block 1: profiles + roles. Run in Supabase SQL Editor.
create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role text not null check (role in ('manager', 'worker')),
  created_at timestamptz default now()
);

alter table profiles enable row level security;

-- Users can read their own profile; managers read all (service role manages the rest for now)
create policy "read own profile" on profiles
  for select using (auth.uid() = user_id);
