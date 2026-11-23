-- Block 4: atomic sale processing. Run in Supabase SQL Editor.
-- Workers can't directly edit books (manager-only), so sales go through this
-- SECURITY DEFINER function which checks stock, inserts the sale, and decrements stock.

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
  v_due numeric;
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

  v_total := p_qty * p_unit_price;
  v_due := greatest(v_total - coalesce(p_amount_paid, 0), 0);

  insert into sales (book_id, customer_id, qty, unit_price, total, amount_paid, balance_due, sold_by)
  values (p_book_id, p_customer_id, p_qty, p_unit_price, v_total, coalesce(p_amount_paid, 0), v_due, auth.uid())
  returning id into v_sale_id;

  update books set stock_qty = stock_qty - p_qty where id = p_book_id;

  return v_sale_id;
end;
$$;

grant execute on function process_sale(uuid, uuid, integer, numeric, numeric) to authenticated;
