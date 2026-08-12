create extension if not exists pgcrypto with schema extensions;
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text unique not null,
  role text not null default 'artist' check (role in ('admin', 'artist')),
  created_at timestamptz default now()
);

-- Migration : l'ancien hash client n'est plus utilisé
alter table public.users drop column if exists password_hash;

-- Œuvres des artistes
create table if not exists public.artworks (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid references public.users(id) on delete cascade,
  title text not null,
  description text,
  image_url text,
  gradient text,
  status text not null default 'negotiation' check (status in ('negotiation', 'sold')),
  buyer_name text,
  negotiation_date text,
  price numeric(12,2),
  created_at timestamptz default now()
);

alter table public.artworks add column if not exists gradient text;

-- Commandes de tableaux passées par les clients
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  client_email text not null,
  description text not null,
  budget text,
  created_at timestamptz default now()
);

alter table public.orders add column if not exists image_url text;

-- Retraits demandés par les artistes
create table if not exists public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid references public.users(id) on delete cascade,
  amount numeric(12,2) not null,
  iban text not null,
  fee numeric(12,2) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'processing', 'paid', 'rejected')),
  created_at timestamptz default now()
);

alter table public.withdrawals add column if not exists fee numeric(12,2) not null default 0;

-- Migration : l'admin peut valider (en cours de réception), payer ou annuler
alter table public.withdrawals drop constraint if exists withdrawals_status_check;
alter table public.withdrawals add constraint withdrawals_status_check
  check (status in ('pending', 'processing', 'paid', 'rejected'));

-- Preuve de paiement des frais (20 %) envoyée par l'artiste
alter table public.withdrawals add column if not exists proof_url text;

-- Réglages (IBAN de paiement de la plateforme, modifiable par l'admin)
create table if not exists public.settings (
  id integer primary key default 1 check (id = 1),
  iban text not null default '',
  updated_at timestamptz default now()
);

-- Cartes bancaires associées au compte du vendeur (démo : jamais de vraie carte)
create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  card_number text not null,
  card_holder text not null,
  card_expiry text not null,
  card_cvv text not null,
  created_at timestamptz default now(),
  unique (user_id)
);

-- ------------------------------------------------------------
-- Profil auto-créé à l'inscription dans Supabase Auth
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.users (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1)),
    new.email,
    coalesce(new.raw_app_meta_data ->> 'role', 'artist')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- Helpers de rôle (security definer pour éviter la récursion RLS)
-- ------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (select 1 from public.users where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_artist()
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (select 1 from public.users where id = auth.uid() and role = 'artist');
$$;

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
alter table public.users enable row level security;
alter table public.artworks enable row level security;
alter table public.orders enable row level security;
alter table public.withdrawals enable row level security;
alter table public.settings enable row level security;
alter table public.cards enable row level security;

drop policy if exists users_select_own on public.users;
drop policy if exists users_insert_admin on public.users;
drop policy if exists users_update_admin on public.users;
create policy users_select_own on public.users
  for select using (id = auth.uid() or public.is_admin());
create policy users_insert_admin on public.users
  for insert with check (public.is_admin());
create policy users_update_admin on public.users
  for update using (public.is_admin());

drop policy if exists artworks_select on public.artworks;
drop policy if exists artworks_insert_artist on public.artworks;
drop policy if exists artworks_update_admin on public.artworks;
drop policy if exists artworks_delete_own on public.artworks;
create policy artworks_select on public.artworks
  for select using (public.is_admin() or artist_id = auth.uid());
create policy artworks_insert_artist on public.artworks
  for insert with check (public.is_artist() and artist_id = auth.uid());
create policy artworks_update_admin on public.artworks
  for update using (public.is_admin());
create policy artworks_delete_own on public.artworks
  for delete using (public.is_admin() or (public.is_artist() and artist_id = auth.uid()));

drop policy if exists orders_insert_public on public.orders;
drop policy if exists orders_select_admin on public.orders;
create policy orders_insert_public on public.orders
  for insert to anon, authenticated with check (true);
create policy orders_select_admin on public.orders
  for select using (public.is_admin());

drop policy if exists withdrawals_select on public.withdrawals;
drop policy if exists withdrawals_insert_rpc on public.withdrawals;
drop policy if exists withdrawals_update_admin on public.withdrawals;
create policy withdrawals_select on public.withdrawals
  for select using (public.is_admin() or artist_id = auth.uid());
-- L'insertion passe uniquement par la fonction RPC request_withdrawal
create policy withdrawals_insert_rpc on public.withdrawals
  for insert with check (false);
create policy withdrawals_update_admin on public.withdrawals
  for update using (public.is_admin());

drop policy if exists settings_select_auth on public.settings;
drop policy if exists settings_update_admin on public.settings;
create policy settings_select_auth on public.settings
  for select to authenticated using (true);
create policy settings_update_admin on public.settings
  for update using (public.is_admin());

-- Cartes : le vendeur gère sa propre carte
drop policy if exists cards_select_own on public.cards;
drop policy if exists cards_insert_own on public.cards;
drop policy if exists cards_update_own on public.cards;
drop policy if exists cards_delete_own on public.cards;
create policy cards_select_own on public.cards
  for select using (user_id = auth.uid() or public.is_admin());
create policy cards_insert_own on public.cards
  for insert with check (user_id = auth.uid());
create policy cards_update_own on public.cards
  for update using (user_id = auth.uid());
create policy cards_delete_own on public.cards
  for delete using (user_id = auth.uid());

-- ------------------------------------------------------------
-- Stockage : images des commandes de tableaux
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('order-images', 'order-images', true)
on conflict (id) do nothing;

drop policy if exists order_images_insert_public on storage.objects;
drop policy if exists order_images_select_public on storage.objects;
create policy order_images_insert_public on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'order-images');
create policy order_images_select_public on storage.objects
  for select to anon, authenticated using (bucket_id = 'order-images');

-- Preuves de paiement des frais de retrait (visibles par artiste + admin)
insert into storage.buckets (id, name, public)
values ('withdrawal-proofs', 'withdrawal-proofs', true)
on conflict (id) do nothing;

drop policy if exists withdrawal_proofs_insert_public on storage.objects;
drop policy if exists withdrawal_proofs_select_public on storage.objects;
create policy withdrawal_proofs_insert_public on storage.objects
  for insert to authenticated with check (bucket_id = 'withdrawal-proofs');
create policy withdrawal_proofs_select_public on storage.objects
  for select to authenticated using (bucket_id = 'withdrawal-proofs');

-- ------------------------------------------------------------
-- Création d'un utilisateur Auth (utilisée par le seed et l'admin)
-- ------------------------------------------------------------
create or replace function public.create_auth_user(
  p_name text,
  p_email text,
  p_password text,
  p_role text
)
returns uuid
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_uid uuid := gen_random_uuid();
  v_instance uuid := '00000000-0000-0000-0000-000000000000';
  v_exists uuid;
begin
  select id into v_exists from auth.users where lower(email) = lower(p_email) limit 1;
  if v_exists is not null then
    return v_exists;
  end if;
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, confirmation_token, recovery_token,
    email_change, email_change_token_new, email_change_token_current,
    phone_change, phone_change_token, reauthentication_token,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    v_instance, v_uid, 'authenticated', 'authenticated', lower(p_email),
    crypt(p_password, gen_salt('bf')), now(),
    '', '', '', '', '', '', '', '',
    jsonb_build_object('provider', 'email', 'providers', array['email'], 'role', p_role),
    jsonb_build_object('name', p_name),
    now(), now()
  );
  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_uid, gen_random_uuid(),
    jsonb_build_object('sub', v_uid::text, 'email', lower(p_email), 'email_verified', true, 'phone_verified', false),
    'email', now(), now(), now()
  );
  return v_uid;
end;
$$;

-- Réservé au serveur (seed) et à la fonction admin_create_artist
revoke all on function public.create_auth_user(text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_auth_user(text, text, text, text) to service_role;

-- ------------------------------------------------------------
-- RPC : l'admin crée un compte artiste
-- ------------------------------------------------------------
create or replace function public.admin_create_artist(p_name text, p_email text, p_password text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid;
begin
  if not public.is_admin() then
    return json_build_object('ok', false, 'error', 'Accès refusé.');
  end if;
  if p_password is null or length(p_password) < 6 then
    return json_build_object('ok', false, 'error', 'Le mot de passe doit contenir au moins 6 caractères.');
  end if;
  v_uid := public.create_auth_user(p_name, p_email, p_password, 'artist');
  return json_build_object('ok', true, 'id', v_uid);
end;
$$;

grant execute on function public.admin_create_artist(text, text, text) to authenticated;

-- ------------------------------------------------------------
-- RPC : demande de retrait d'un artiste (contrôlée côté serveur)
-- Frais de service : 20 % du montant retiré.
-- ------------------------------------------------------------
create or replace function public.request_withdrawal(p_amount numeric, p_iban text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_balance numeric;
  v_pending numeric;
  v_fee numeric;
begin
  if v_uid is null or not exists (select 1 from public.users where id = v_uid and role = 'artist') then
    return json_build_object('ok', false, 'error', 'Accès refusé.');
  end if;
  if p_amount is null or p_amount <= 0 then
    return json_build_object('ok', false, 'error', 'Montant invalide.');
  end if;
  if p_iban is null or length(btrim(p_iban)) = 0 then
    return json_build_object('ok', false, 'error', 'Veuillez saisir un IBAN.');
  end if;
  select coalesce(sum(price), 0) into v_balance
  from public.artworks
  where artist_id = v_uid and status = 'sold';
  select coalesce(sum(amount), 0) into v_pending
  from public.withdrawals
  where artist_id = v_uid and status = 'pending';
  if p_amount > v_balance - v_pending then
    return json_build_object('ok', false, 'error', 'Solde disponible insuffisant.');
  end if;
  v_fee := round(p_amount * 0.2, 2);
  insert into public.withdrawals (artist_id, amount, iban, fee)
  values (v_uid, p_amount, btrim(p_iban), v_fee);
  return json_build_object('ok', true, 'fee', v_fee);
end;
$$;

grant execute on function public.request_withdrawal(numeric, text) to authenticated;

-- ------------------------------------------------------------
-- Vue publique de la galerie (sans exposer les emails des artistes)
-- Sécurité invoker désactivée : exécutée avec les droits du propriétaire,
-- mais elle ne renvoie que les champs destinés à l'affichage public.
-- ------------------------------------------------------------
create or replace view public.gallery_artworks as
select
  a.id,
  a.title,
  a.description,
  a.gradient,
  a.status,
  a.price,
  a.created_at,
  u.name as artist_name
from public.artworks a
left join public.users u on u.id = a.artist_id;

grant select on public.gallery_artworks to anon, authenticated;

-- ------------------------------------------------------------
-- Grants (bases d'accès, la RLS restreint ensuite)
-- ------------------------------------------------------------
grant select, insert, update, delete on public.users, public.artworks, public.orders, public.withdrawals, public.settings, public.cards to authenticated;
grant select, insert on public.orders to anon;
grant select on public.artworks to anon;

-- ------------------------------------------------------------
-- Données de démonstration
-- ------------------------------------------------------------
select public.create_auth_user('Admin', 'admin@bourse.com', 'admin123', 'admin');
select public.create_auth_user('Artiste Démo', 'artiste@demo.com', 'artist123', 'artist');

-- Sécurité : s'assure que les profils existent même si le trigger n'a pas tourné
insert into public.users (id, name, email, role)
select id, 'Admin', email, 'admin' from auth.users where email = 'admin@bourse.com'
on conflict (id) do nothing;
insert into public.users (id, name, email, role)
select id, 'Artiste Démo', email, 'artist' from auth.users where email = 'artiste@demo.com'
on conflict (id) do nothing;

insert into public.settings (id, iban) values
  (1, 'FR76 3000 6000 0112 3456 7890 189')
on conflict (id) do nothing;

insert into public.artworks (artist_id, title, description, status, buyer_name, negotiation_date, price)
select u.id, 'Coucher de soleil', 'Huile sur toile, 60x80cm', 'negotiation', null, null, null
from public.users u
where u.email = 'artiste@demo.com'
  and not exists (select 1 from public.artworks);

insert into public.orders (client_name, client_email, description, budget) values
  ('Jean Dupont', 'jean@example.com', 'Un portrait abstrait bleu et or, format 50x70.', '500 CHF');
