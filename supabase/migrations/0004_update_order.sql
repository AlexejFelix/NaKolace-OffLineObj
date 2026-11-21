-- =========================================================
-- Na Koláče – 0004: úprava existujúcej objednávky jedným volaním
-- Položky s existujúcim "id" sa aktualizujú (stav a "pripravil(a)" ostanú),
-- položky bez "id" sa pridajú, chýbajúce položky sa vymažú.
-- Stav objednávky sa tu nemení (mení sa samostatne).
-- =========================================================
create or replace function public.update_order(p_id uuid, p_order jsonb, p_items jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_items jsonb := coalesce(p_items, '[]'::jsonb);
begin
  if not public.is_admin() then
    raise exception 'Len administrátor môže upravovať objednávky';
  end if;

  update public.orders set
    scheduled_at     = nullif(p_order->>'scheduled_at', '')::timestamptz,
    fulfillment      = nullif(p_order->>'fulfillment', '')::public.fulfillment_type,
    customer_name    = nullif(p_order->>'customer_name', ''),
    phone            = nullif(p_order->>'phone', ''),
    email            = nullif(p_order->>'email', ''),
    home_address     = nullif(p_order->>'home_address', ''),
    delivery_address = nullif(p_order->>'delivery_address', ''),
    ico              = nullif(p_order->>'ico', ''),
    note             = nullif(p_order->>'note', ''),
    delivery_fee     = coalesce(nullif(p_order->>'delivery_fee', '')::numeric, 0),
    discount         = coalesce(nullif(p_order->>'discount', '')::numeric, 0),
    payment_method   = nullif(p_order->>'payment_method', '')::public.payment_method
  where id = p_id;

  if not found then
    raise exception 'Objednávka sa nenašla';
  end if;

  -- 1) vymazať položky, ktoré v novom zozname už nie sú
  delete from public.order_items oi
  where oi.order_id = p_id
    and oi.id not in (
      select (t.i->>'id')::uuid
      from jsonb_array_elements(v_items) as t(i)
      where nullif(t.i->>'id', '') is not null
    );

  -- 2) aktualizovať existujúce položky (len tie, ktoré patria tejto objednávke)
  update public.order_items oi set
    product_id    = nullif(t.i->>'product_id', '')::uuid,
    position      = (t.ord - 1)::int,
    name          = coalesce(t.i->>'name', ''),
    quantity      = coalesce(nullif(t.i->>'quantity', '')::numeric, 1),
    unit_price    = nullif(t.i->>'unit_price', '')::numeric,
    configuration = nullif(t.i->>'configuration', ''),
    allergens     = array(
      select a::smallint
      from jsonb_array_elements_text(coalesce(t.i->'allergens', '[]'::jsonb)) as a
    )
  from jsonb_array_elements(v_items) with ordinality as t(i, ord)
  where nullif(t.i->>'id', '') is not null
    and oi.id = (t.i->>'id')::uuid
    and oi.order_id = p_id;

  -- 3) pridať nové položky (bez "id")
  insert into public.order_items (
    order_id, product_id, position, name, quantity, unit_price, configuration, allergens
  )
  select
    p_id,
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
  from jsonb_array_elements(v_items) with ordinality as t(i, ord)
  where nullif(t.i->>'id', '') is null;

  return p_id;
end;
$$;

revoke execute on function public.update_order(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.update_order(uuid, jsonb, jsonb) to authenticated;
