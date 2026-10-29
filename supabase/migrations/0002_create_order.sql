-- =========================================================
-- Na Koláče – 0002: uloženie novej objednávky jedným volaním
-- =========================================================
create or replace function public.create_order(p_order jsonb, p_items jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Len administrátor môže vytvárať objednávky';
  end if;

  insert into public.orders (
    scheduled_at, fulfillment, customer_name, phone, email,
    home_address, delivery_address, ico, note,
    delivery_fee, discount, payment_method
  )
  values (
    nullif(p_order->>'scheduled_at', '')::timestamptz,
    nullif(p_order->>'fulfillment', '')::public.fulfillment_type,
    nullif(p_order->>'customer_name', ''),
    nullif(p_order->>'phone', ''),
    nullif(p_order->>'email', ''),
    nullif(p_order->>'home_address', ''),
    nullif(p_order->>'delivery_address', ''),
    nullif(p_order->>'ico', ''),
    nullif(p_order->>'note', ''),
    coalesce(nullif(p_order->>'delivery_fee', '')::numeric, 0),
    coalesce(nullif(p_order->>'discount', '')::numeric, 0),
    nullif(p_order->>'payment_method', '')::public.payment_method
  )
  returning id into v_id;

  insert into public.order_items (
    order_id, product_id, position, name, quantity, unit_price, configuration, allergens
  )
  select
    v_id,
    nullif(t.i->>'product_id', '')::uuid,
    (t.ord - 1)::int,
    coalesce(t.i->>'name', ''),
    coalesce(nullif(t.i->>'quantity', '')::numeric, 1),
    nullif(t.i->>'unit_price', '')::numeric,
    nullif(t.i->>'configuration', ''),
    array(
      select a::smallint
      from jsonb_array_elements_text(coalesce(t.i->'allergens', '[]'::jsonb)) as a
    )
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) with ordinality as t(i, ord);

  return v_id;
end;
$$;

revoke execute on function public.create_order(jsonb, jsonb) from public, anon;
grant execute on function public.create_order(jsonb, jsonb) to authenticated;
