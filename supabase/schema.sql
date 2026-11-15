-- =====================================================
-- NIDOO – Schéma Supabase (à exécuter dans SQL Editor)
-- =====================================================
create extension if not exists "pgcrypto";

-- ---------- Types ----------
create type user_role as enum ('admin', 'vendeur', 'client');
create type sub_status as enum ('essai', 'actif', 'expire');
create type order_status as enum ('en_attente', 'payee', 'confirmee', 'en_livraison', 'livree', 'annulee');
create type pay_method as enum ('mpesa', 'orange_money', 'airtel_money', 'afrimoney', 'visa', 'mastercard', 'cash_livraison');

-- ---------- Tables ----------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role user_role not null default 'client',
  commune text,
  quartier text,
  created_at timestamptz not null default now()
);

create table stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references profiles(id) on delete cascade,
  name text not null,
  description text,
  logo_url text,
  phone text,
  delivery_zones text[] not null default '{}',
  subscription_status sub_status not null default 'essai',
  trial_ends_at timestamptz not null default (now() + interval '45 days'),
  subscription_ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table subscription_payments (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  plan text not null check (plan in ('mensuel', 'annuel')),
  amount_usd numeric(10,2) not null,
  method pay_method not null,
  reference text,
  validated boolean not null default false,
  created_at timestamptz not null default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  title text not null,
  description text,
  price numeric(10,2) not null check (price >= 0),
  currency text not null default 'USD',
  category text not null,
  sizes text[] not null default '{}',
  stock integer not null default 0 check (stock >= 0),
  images text[] not null default '{}',
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles(id),
  store_id uuid not null references stores(id),
  status order_status not null default 'en_attente',
  total numeric(10,2) not null,
  payment_method pay_method not null,
  payment_ref text,
  delivery_commune text not null,
  delivery_quartier text not null,
  delivery_address text,
  contact_phone text not null,
  created_at timestamptz not null default now()
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  title text not null,
  size text,
  unit_price numeric(10,2) not null,
  quantity integer not null check (quantity > 0)
);

-- Une seule bannière active (partenaire exclusif)
create table ads_banner (
  id uuid primary key default gen_random_uuid(),
  partner_name text not null,
  image_url text not null,
  link_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index one_active_banner on ads_banner (is_active) where is_active;

-- ---------- Index ----------
create index idx_products_store on products(store_id);
create index idx_products_category on products(category);
create index idx_orders_customer on orders(customer_id);
create index idx_orders_store on orders(store_id);
create index idx_items_order on order_items(order_id);

-- ---------- Fonctions utilitaires ----------
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and role = 'admin') $$;

-- Boutique autorisée à modifier son catalogue ? (essai en cours OU abonnement payé)
create or replace function store_can_edit(sid uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from stores s
     where s.id = sid and s.owner_id = auth.uid() and s.is_active
       and ( (s.subscription_status = 'essai' and s.trial_ends_at > now())
          or (s.subscription_status = 'actif' and s.subscription_ends_at > now()) )
   ) $$;

-- Création automatique du profil à l'inscription
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, phone, role)
  values (new.id,
          new.raw_user_meta_data->>'full_name',
          new.raw_user_meta_data->>'phone',
          case when new.raw_user_meta_data->>'role' = 'vendeur' then 'vendeur'::user_role else 'client'::user_role end);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function handle_new_user();

-- Empêche un utilisateur de s'auto-attribuer le rôle admin
create or replace function protect_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and new.role is distinct from old.role and not is_admin() then new.role := old.role; end if;
  return new;
end $$;
create trigger trg_protect_role before update on profiles
for each row execute function protect_role();

-- Empêche un vendeur de modifier lui-même son statut d'abonnement
create or replace function protect_subscription() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not is_admin() then
    new.subscription_status := old.subscription_status;
    new.trial_ends_at := old.trial_ends_at;
    new.subscription_ends_at := old.subscription_ends_at;
    new.is_active := old.is_active;
  end if;
  return new;
end $$;
create trigger trg_protect_subscription before update on stores
for each row execute function protect_subscription();

-- Validation d'un paiement d'abonnement par l'admin (+1 mois ou +1 an)
create or replace function validate_subscription_payment(pid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare p subscription_payments; base timestamptz;
begin
  if not is_admin() then raise exception 'Réservé à l''administrateur'; end if;
  select * into p from subscription_payments where id = pid and not validated;
  if not found then raise exception 'Paiement introuvable ou déjà validé'; end if;
  select greatest(now(), coalesce(subscription_ends_at, now())) into base from stores where id = p.store_id;
  update stores set subscription_status = 'actif',
    subscription_ends_at = base + case when p.plan = 'annuel' then interval '1 year' else interval '1 month' end
  where id = p.store_id;
  update subscription_payments set validated = true where id = pid;
end $$;

-- Marque les essais / abonnements expirés (à planifier via pg_cron ou Edge Function)
create or replace function expire_subscriptions() returns void
language sql security definer set search_path = public as $$
  update stores set subscription_status = 'expire'
  where (subscription_status = 'essai' and trial_ends_at <= now())
     or (subscription_status = 'actif' and subscription_ends_at <= now());
$$;

-- ---------- RLS ----------
alter table profiles enable row level security;
alter table stores enable row level security;
alter table subscription_payments enable row level security;
alter table products enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table ads_banner enable row level security;

-- profiles
create policy "profil: lecture soi-même ou admin" on profiles for select using (id = auth.uid() or is_admin());
create policy "profil: modif soi-même" on profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- stores (catalogue public)
create policy "boutiques: lecture publique" on stores for select using (is_active or owner_id = auth.uid() or is_admin());
create policy "boutiques: création vendeur" on stores for insert
  with check (owner_id = auth.uid() and exists (select 1 from profiles where id = auth.uid() and role = 'vendeur'));
create policy "boutiques: modif propriétaire/admin" on stores for update using (owner_id = auth.uid() or is_admin());
create policy "boutiques: admin supprime" on stores for delete using (is_admin());

-- subscription_payments
create policy "abonnements: vendeur voit les siens" on subscription_payments for select
  using (is_admin() or exists (select 1 from stores s where s.id = store_id and s.owner_id = auth.uid()));
create policy "abonnements: vendeur déclare" on subscription_payments for insert
  with check (validated = false and exists (select 1 from stores s where s.id = store_id and s.owner_id = auth.uid()));
create policy "abonnements: admin modifie" on subscription_payments for update using (is_admin());

-- products : lecture publique, écriture seulement si abonnement/essai valide
create policy "produits: lecture publique" on products for select
  using (is_published or exists (select 1 from stores s where s.id = store_id and s.owner_id = auth.uid()) or is_admin());
create policy "produits: ajout si abonnement valide" on products for insert with check (store_can_edit(store_id));
create policy "produits: modif si abonnement valide" on products for update using (store_can_edit(store_id)) with check (store_can_edit(store_id));
create policy "produits: suppression si abonnement valide" on products for delete using (store_can_edit(store_id));

-- orders
create policy "commandes: client crée la sienne" on orders for insert with check (customer_id = auth.uid());
create policy "commandes: lecture client/vendeur/admin" on orders for select
  using (customer_id = auth.uid() or is_admin() or exists (select 1 from stores s where s.id = store_id and s.owner_id = auth.uid()));
create policy "commandes: vendeur/admin met à jour" on orders for update
  using (is_admin() or exists (select 1 from stores s where s.id = store_id and s.owner_id = auth.uid()));

-- order_items
create policy "lignes: client insère dans sa commande" on order_items for insert
  with check (exists (select 1 from orders o where o.id = order_id and o.customer_id = auth.uid()));
create policy "lignes: lecture via commande" on order_items for select
  using (exists (select 1 from orders o where o.id = order_id and
        (o.customer_id = auth.uid() or is_admin() or exists (select 1 from stores s where s.id = o.store_id and s.owner_id = auth.uid()))));

-- ads_banner
create policy "bannière: lecture publique" on ads_banner for select using (is_active or is_admin());
create policy "bannière: admin gère" on ads_banner for all using (is_admin()) with check (is_admin());

-- ---------- Storage ----------
insert into storage.buckets (id, name, public) values
  ('store-logos', 'store-logos', true),
  ('product-images', 'product-images', true),
  ('ads', 'ads', true)
on conflict do nothing;

create policy "storage: lecture publique" on storage.objects for select
  using (bucket_id in ('store-logos', 'product-images', 'ads'));
-- Convention : le 1er dossier du chemin = auth.uid() (ex. "<uid>/photo.jpg")
create policy "storage: vendeur envoie dans son dossier" on storage.objects for insert to authenticated
  with check (bucket_id in ('store-logos', 'product-images') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "storage: vendeur supprime son dossier" on storage.objects for delete to authenticated
  using (bucket_id in ('store-logos', 'product-images') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "storage: admin gère les bannières" on storage.objects for all to authenticated
  using (bucket_id = 'ads' and is_admin()) with check (bucket_id = 'ads' and is_admin());

-- ---------- Promouvoir un admin (remplacer l'email) ----------
-- update profiles set role = 'admin' where id = (select id from auth.users where email = 'admin@nidoo.cd');
