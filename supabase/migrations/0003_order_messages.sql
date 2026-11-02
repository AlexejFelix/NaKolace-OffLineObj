-- =========================================================
-- Odoslané správy zákazníkovi (história objednávky)
-- Zapisuje len serverová funkcia posli-email (service role),
-- čítať môže každý prihlásený používateľ.
-- =========================================================

create table public.order_messages (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  kind text not null check (kind in ('potvrdenie', 'pripravena', 'pripomienka')),
  channel text not null default 'email' check (channel in ('email')),
  recipient text not null,
  subject text not null,
  sent_by uuid references public.profiles(id),
  sent_at timestamptz not null default now(),
  ok boolean not null,
  error text
);

create index order_messages_order_id_idx on public.order_messages (order_id);

alter table public.order_messages enable row level security;

create policy order_messages_select on public.order_messages
  for select to authenticated using (true);
