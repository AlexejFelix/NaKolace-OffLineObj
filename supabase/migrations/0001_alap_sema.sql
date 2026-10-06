-- =========================================================
-- Na Koláče – telefonické objednávky: alapséma
-- =========================================================

-- Típusok
create type public.user_role as enum ('admin', 'user');
create type public.fulfillment_type as enum ('odber', 'dorucenie');
create type public.payment_method as enum ('hotovost', 'karta', 'prevod', 'qr');
create type public.order_status as enum ('prijata', 'skontrolovana', 'hotova', 'zrusena');
create type public.item_origin as enum ('cerstve', 'mrazene');

-- Felhasználók
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role public.user_role not null default 'user',
  created_at timestamptz not null default now()
);

-- Termékek (a nakolace.sk katalógus másolata)
create table public.products (
  id uuid primary key default gen_random_uuid(),
  payload_id text unique,
  name text not null,
  price numeric(10,2),
  allergens smallint[] not null default '{}',
  active boolean not null default true,
  synced_at timestamptz,
  constraint products_allergens_range
    check (allergens <@ '{1,2,3,4,5,6,7,8,9,10,11,12,13,14}'::smallint[])
);

-- Rendelések
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  scheduled_at timestamptz,
  fulfillment public.fulfillment_type,
  customer_name text,
  phone text,
  email text,
  home_address text,
  delivery_address text,
  ico text,
  note text,
  delivery_fee numeric(10,2) not null default 0,
  discount numeric(10,2) not null default 0,
  payment_method public.payment_method,
  status public.order_status not null default 'prijata',
  completed_by uuid references public.profiles(id)
);
create index orders_scheduled_at_idx on public.orders (scheduled_at);
create index orders_status_idx on public.orders (status);

-- Tételek
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  position int not null default 0,
  name text not null default '',
  quantity numeric(10,2) not null default 1,
  unit_price numeric(10,2),
  configuration text,
  allergens smallint[] not null default '{}',
  status public.order_status,
  made_by uuid references public.profiles(id),
  origin public.item_origin,
  constraint order_items_allergens_range
    check (allergens <@ '{1,2,3,4,5,6,7,8,9,10,11,12,13,14}'::smallint[])
);
create index order_items_order_id_idx on public.order_items (order_id);

-- Státuszváltások naplója
create table public.order_status_log (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  item_id uuid references public.order_items(id) on delete cascade,
  old_status public.order_status,
  new_status public.order_status not null,
  changed_by uuid references public.profiles(id),
  changed_at timestamptz not null default now()
);
create index order_status_log_order_id_idx on public.order_status_log (order_id);

-- =========================================================
-- Segédfüggvények és triggerek
-- =========================================================

-- Admin-e a bejelentkezett felhasználó
create function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Új felhasználó → profil automatikusan
create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Rendelés státuszváltás: napló + "ki készítette"
create function public.on_order_update()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  new.updated_at := now();
  if new.status is distinct from old.status then
    if new.status = 'hotova' then
      new.completed_by := auth.uid();
    end if;
    insert into public.order_status_log (order_id, old_status, new_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;
create trigger orders_before_update
  before update on public.orders
  for each row execute function public.on_order_update();

-- Tétel státuszváltás: napló + "ki készítette"
create function public.on_item_update()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'hotova' then
      new.made_by := auth.uid();
    end if;
    insert into public.order_status_log (order_id, item_id, old_status, new_status, changed_by)
    values (new.order_id, new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;
create trigger order_items_before_update
  before update on public.order_items
  for each row execute function public.on_item_update();

-- Felhasználói műveletek (nem admin): csak "Hotová" állítás
create function public.mark_order_done(p_order_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Neprihlásený používateľ';
  end if;
  update public.orders set status = 'hotova'
  where id = p_order_id and status <> 'zrusena';
end;
$$;

create function public.mark_item_done(p_item_id uuid, p_origin public.item_origin default null)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Neprihlásený používateľ';
  end if;
  update public.order_items
  set status = 'hotova', origin = coalesce(p_origin, origin)
  where id = p_item_id;
end;
$$;

revoke execute on function public.mark_order_done(uuid) from public, anon;
revoke execute on function public.mark_item_done(uuid, public.item_origin) from public, anon;
grant execute on function public.mark_order_done(uuid) to authenticated;
grant execute on function public.mark_item_done(uuid, public.item_origin) to authenticated;

-- =========================================================
-- Jogosultságok (Row Level Security)
-- =========================================================
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_log enable row level security;

-- Olvasás: minden bejelentkezett felhasználó
create policy profiles_select on public.profiles for select to authenticated using (true);
create policy products_select on public.products for select to authenticated using (true);
create policy orders_select on public.orders for select to authenticated using (true);
create policy order_items_select on public.order_items for select to authenticated using (true);
create policy status_log_select on public.order_status_log for select to authenticated using (true);

-- Írás: csak admin
create policy profiles_admin_update on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy products_admin_all on public.products for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy orders_admin_all on public.orders for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy order_items_admin_all on public.order_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Élő frissítés
alter publication supabase_realtime add table public.orders, public.order_items;
