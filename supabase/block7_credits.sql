-- Block 7: customer credit balances (advance payments). Run in Supabase SQL Editor.
alter table customers add column if not exists credit_balance numeric(12,2) not null default 0;

-- Update process_sale to apply credit first, then record any overpayment as new credit
create or replace function process_sale(
  p_book_id uuid,
  p_customer_id uuid,
  p_qty integer,
  p_unit_price numeric,
  p_amount_paid numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock integer;
  v_total numeric;
  v_credit numeric;
  v_credit_used numeric;
  v_after_credit numeric;
  v_due numeric;
  v_new_credit numeric;
  v_sale_id uuid;
begin
  if p_qty is null or p_qty < 1 then
    raise exception 'Quantity must be at least 1';
  end if;

  select stock_qty into v_stock from books where id = p_book_id for update;
  if not found then
    raise exception 'Book not found';
  end if;
  if v_stock < p_qty then
    raise exception 'Only % in stock', v_stock;
  end if;

  select credit_balance into v_credit from customers where id = p_customer_id for update;
  if not found then
    raise exception 'Customer not found';
  end if;

  v_total := p_qty * p_unit_price;
  v_credit_used := least(coalesce(v_credit, 0), v_total);
  v_after_credit := v_total - v_credit_used;
  v_due := greatest(v_after_credit - coalesce(p_amount_paid, 0), 0);
  v_new_credit := greatest(coalesce(p_amount_paid, 0) - v_after_credit, 0);

  insert into sales (book_id, customer_id, qty, unit_price, total, amount_paid, balance_due, sold_by)
  values (p_book_id, p_customer_id, p_qty, p_unit_price, v_total, coalesce(p_amount_paid, 0), v_due, auth.uid())
  returning id into v_sale_id;

  update books set stock_qty = stock_qty - p_qty where id = p_book_id;

  -- Credit after this sale: leftover credit + any overpayment
  update customers
  set credit_balance = (coalesce(v_credit, 0) - v_credit_used) + v_new_credit
  where id = p_customer_id;

  return v_sale_id;
end;
$$;

grant execute on function process_sale(uuid, uuid, integer, numeric, numeric) to authenticated;

-- Add credit to a customer (used when a payment exceeds their balance)
create or replace function add_credit(p_customer_id uuid, p_amount numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update customers set credit_balance = coalesce(credit_balance, 0) + p_amount
  where id = p_customer_id;
end;
$$;

grant execute on function add_credit(uuid, numeric) to authenticated;

-- Update balances view: credit reduces what they owe
create or replace view customer_balances as
select
  c.id as customer_id,
  coalesce(sum(s.balance_due), 0)
    - coalesce((select sum(p.amount) from payments p where p.customer_id = c.id), 0)
    - coalesce(c.credit_balance, 0) as balance
from customers c
left join sales s on s.customer_id = c.id
group by c.id, c.credit_balance;
