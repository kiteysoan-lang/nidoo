-- =====================================================
-- NIDOO – Logique serveur (à exécuter APRÈS schema.sql)
-- =====================================================

-- ---------- Réglages modifiables par l'admin ----------
create table if not exists app_settings (key text primary key, value jsonb not null);
insert into app_settings (key, value) values
  ('prices', '{"mensuel": 10, "annuel": 100}'),
  ('delivery_fee', '{"default": 2}')
on conflict do nothing;
alter table app_settings enable row level security;
create policy "reglages: lecture publique" on app_settings for select using (true);
create policy "reglages: admin ecrit" on app_settings for all using (is_admin()) with check (is_admin());

-- ---------- Colonnes et table de paiements ----------
alter table orders add column if not exists delivery_fee numeric(10,2) not null default 0;

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  order_ids uuid[] not null,
  provider text not null,
  method pay_method not null,
  amount numeric(10,2) not null,
  currency text not null default 'USD',
  tx_ref text not null unique,
  provider_ref text,
  status text not null default 'pending' check (status in ('pending', 'successful', 'failed')),
  created_at timestamptz not null default now()
);
alter table payments enable row level security;
create policy "paiements: lecture soi-meme ou admin" on payments for select using (user_id = auth.uid() or is_admin());
-- Aucune policy d'écriture : seules les Edge Functions (service_role) écrivent.

-- ---------- Prix d'abonnement fixés côté serveur ----------
create or replace function set_sub_amount() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select (value ->> new.plan)::numeric into new.amount_usd from app_settings where key = 'prices';
  return new;
end $$;
drop trigger if exists trg_sub_amount on subscription_payments;
create trigger trg_sub_amount before insert on subscription_payments for each row execute function set_sub_amount();

-- ---------- Passer commande (total, stock et prix calculés par le serveur) ----------
create or replace function place_order(
  p_items jsonb, p_commune text, p_quartier text, p_address text, p_phone text, p_method pay_method
) returns table (o_id uuid, o_store uuid, o_total numeric)
language plpgsql security definer set search_path = public as $$
declare
  sid uuid; oid uuid; it jsonb; prod products; qty int; sub numeric;
  fee numeric := coalesce((select (value ->> 'default')::numeric from app_settings where key = 'delivery_fee'), 0);
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Panier vide'; end if;

  for sid in
    select distinct pr.store_id from products pr
    join jsonb_array_elements(p_items) j on pr.id = (j ->> 'id')::uuid
  loop
    if not exists (select 1 from stores s where s.id = sid and s.is_active) then
      raise exception 'Une boutique de votre panier est indisponible';
    end if;
    insert into orders (customer_id, store_id, status, total, payment_method, delivery_commune, delivery_quartier, delivery_address, contact_phone, delivery_fee)
    values (auth.uid(), sid, 'en_attente', 0, p_method, p_commune, p_quartier, p_address, p_phone, fee)
    returning id into oid;
    sub := 0;
    for it in select j from jsonb_array_elements(p_items) j
              where (select store_id from products where id = (j ->> 'id')::uuid) = sid
    loop
      qty := (it ->> 'qty')::int;
      if qty is null or qty <= 0 then raise exception 'Quantité invalide'; end if;
      select * into prod from products where id = (it ->> 'id')::uuid for update;
      if not prod.is_published then raise exception '« % » n''est plus disponible', prod.title; end if;
      if prod.stock < qty then raise exception 'Stock insuffisant pour « % » (reste %)', prod.title, prod.stock; end if;
      update products set stock = stock - qty where id = prod.id;
      insert into order_items (order_id, product_id, title, size, unit_price, quantity)
      values (oid, prod.id, prod.title, it ->> 'size', prod.price, qty);
      sub := sub + prod.price * qty;
    end loop;
    update orders set total = sub + fee where id = oid;
    o_id := oid; o_store := sid; o_total := sub + fee;
    return next;
  end loop;
end $$;
revoke all on function place_order from public, anon;
grant execute on function place_order to authenticated;

-- ---------- Annulation : le client annule tant que la commande n'est pas payée ----------
create or replace function cancel_order(oid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update orders set status = 'annulee'
  where id = oid and customer_id = auth.uid() and status = 'en_attente';
  if not found then raise exception 'Annulation impossible pour cette commande'; end if;
end $$;
revoke all on function cancel_order from public, anon;
grant execute on function cancel_order to authenticated;

-- Remise en stock automatique à l'annulation (client, vendeur ou admin)
create or replace function restore_stock_on_cancel() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'annulee' and old.status <> 'annulee' then
    update products p set stock = p.stock + i.quantity
    from order_items i where i.order_id = new.id and i.product_id = p.id;
  end if;
  return new;
end $$;
drop trigger if exists trg_restore_stock on orders;
create trigger trg_restore_stock after update of status on orders for each row execute function restore_stock_on_cancel();

-- ---------- Confirmation de paiement (appelée uniquement par les Edge Functions) ----------
create or replace function confirm_payment(p_tx_ref text, p_provider_ref text) returns void
language plpgsql security definer set search_path = public as $$
declare pay payments;
begin
  select * into pay from payments where tx_ref = p_tx_ref for update;
  if not found then raise exception 'Paiement inconnu'; end if;
  if pay.status = 'successful' then return; end if;
  update payments set status = 'successful', provider_ref = p_provider_ref where id = pay.id;
  update orders set status = 'payee' where id = any (pay.order_ids) and status = 'en_attente';
end $$;
revoke all on function confirm_payment from public, anon, authenticated;
grant execute on function confirm_payment to service_role;

-- ---------- Statistiques admin ----------
create or replace function admin_stats() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Réservé à l''administrateur'; end if;
  return json_build_object(
    'stores_total', (select count(*) from stores),
    'stores_essai', (select count(*) from stores where subscription_status = 'essai'),
    'stores_actif', (select count(*) from stores where subscription_status = 'actif'),
    'stores_expire', (select count(*) from stores where subscription_status = 'expire'),
    'orders_total', (select count(*) from orders),
    'sales_paid', (select coalesce(sum(total), 0) from orders where status in ('payee', 'confirmee', 'en_livraison', 'livree')),
    'clients', (select count(*) from profiles where role = 'client'));
end $$;
revoke all on function admin_stats from public, anon;
grant execute on function admin_stats to authenticated;

-- ---------- Planification quotidienne de l'expiration (pg_cron) ----------
do $$ begin
  create extension if not exists pg_cron;
  perform cron.schedule('nidoo-expire-subscriptions', '0 1 * * *', 'select public.expire_subscriptions()');
exception when others then
  raise notice 'pg_cron indisponible : activez-le (Database > Extensions) puis relancez ce bloc.';
end $$;

-- ---------- Temps réel sur les commandes ----------
do $$ begin
  alter publication supabase_realtime add table orders;
exception when others then raise notice 'Realtime : ajoutez la table orders à la publication manuellement.';
end $$;
