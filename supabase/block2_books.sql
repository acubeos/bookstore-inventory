-- Block 2: books table + RLS. Run in Supabase SQL Editor.
create table if not exists books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text not null default '',
  isbn text default '',
  cost_price numeric(12,2) not null default 0,
  sale_price numeric(12,2) not null default 0,
  stock_qty integer not null default 0 check (stock_qty >= 0),
  low_stock_threshold integer not null default 5,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table books enable row level security;

-- Everyone signed in can read books
drop policy if exists "read books" on books;
create policy "read books" on books
  for select using (auth.role() = 'authenticated');

-- Only managers can insert/update/delete
drop policy if exists "manager write books" on books;
create policy "manager write books" on books
  for all using (
    exists (select 1 from profiles where user_id = auth.uid() and role = 'manager')
  );

-- Keep updated_at fresh
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists books_touch on books;
create trigger books_touch before update on books
  for each row execute function touch_updated_at();
