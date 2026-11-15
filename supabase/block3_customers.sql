-- Block 3: customers + sales + payments + balances view. Run in Supabase SQL Editor.
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text default '',
  address text default '',
  notes text default '',
  created_at timestamptz default now()
);

create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  book_id uuid references books(id),
  customer_id uuid references customers(id),
  qty integer not null check (qty > 0),
  unit_price numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  balance_due numeric(12,2) not null default 0,
  sold_by uuid references auth.users(id),
  sold_at timestamptz default now()
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  recorded_by uuid references auth.users(id),
  recorded_at timestamptz default now()
);

alter table customers enable row level security;
alter table sales enable row level security;
alter table payments enable row level security;

-- All signed-in users: read customers/sales/payments, insert customers/sales/payments
drop policy if exists "read customers" on customers;
create policy "read customers" on customers for select using (auth.role() = 'authenticated');
drop policy if exists "add customers" on customers;
create policy "add customers" on customers for insert with check (auth.role() = 'authenticated');

drop policy if exists "read sales" on sales;
create policy "read sales" on sales for select using (auth.role() = 'authenticated');
drop policy if exists "add sales" on sales;
create policy "add sales" on sales for insert with check (auth.role() = 'authenticated');

drop policy if exists "read payments" on payments;
create policy "read payments" on payments for select using (auth.role() = 'authenticated');
drop policy if exists "add payments" on payments;
create policy "add payments" on payments for insert with check (auth.role() = 'authenticated');

-- Only managers can edit/delete customers
drop policy if exists "manager edit customers" on customers;
create policy "manager edit customers" on customers for update using (
  exists (select 1 from profiles where user_id = auth.uid() and role = 'manager')
);
drop policy if exists "manager delete customers" on customers;
create policy "manager delete customers" on customers for delete using (
  exists (select 1 from profiles where user_id = auth.uid() and role = 'manager')
);

-- Outstanding balance per customer
create or replace view customer_balances as
select
  c.id as customer_id,
  coalesce(sum(s.balance_due), 0) - coalesce((select sum(p.amount) from payments p where p.customer_id = c.id), 0) as balance
from customers c
left join sales s on s.customer_id = c.id
group by c.id;
