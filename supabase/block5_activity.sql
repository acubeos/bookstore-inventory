-- Block 5: activity log (who did what). Run in Supabase SQL Editor.
create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  actor_name text default '',
  action text not null,
  detail text default '',
  created_at timestamptz default now()
);

alter table activity_log enable row level security;

drop policy if exists "read activity" on activity_log;
create policy "read activity" on activity_log
  for select using (auth.role() = 'authenticated');

-- Log sales automatically via trigger on sales
create or replace function log_sale_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_actor text; v_book text; v_cust text;
begin
  select coalesce(name, '') into v_actor from profiles where user_id = new.sold_by;
  select title into v_book from books where id = new.book_id;
  select name into v_cust from customers where id = new.customer_id;
  insert into activity_log (actor_id, actor_name, action, detail)
  values (new.sold_by, v_actor, 'sale',
    new.qty || 'x ' || coalesce(v_book, 'book') || ' to ' || coalesce(v_cust, 'customer')
    || ' — total ' || new.total || ', paid ' || new.amount_paid);
  return new;
end $$;

drop trigger if exists sales_activity on sales;
create trigger sales_activity after insert on sales
  for each row execute function log_sale_activity();

-- Log payments automatically via trigger on payments
create or replace function log_payment_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_actor text; v_cust text;
begin
  select coalesce(name, '') into v_actor from profiles where user_id = new.recorded_by;
  select name into v_cust from customers where id = new.customer_id;
  insert into activity_log (actor_id, actor_name, action, detail)
  values (new.recorded_by, v_actor, 'payment',
    'Received ' || new.amount || ' from ' || coalesce(v_cust, 'customer'));
  return new;
end $$;

drop trigger if exists payments_activity on payments;
create trigger payments_activity after insert on payments
  for each row execute function log_payment_activity();
