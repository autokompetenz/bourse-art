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
alter table public.artworks add column if not exists image_url text;

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

-- Comptes artistes créés par l'admin (nom + email) en attente d'inscription,
-- le client définit lui-même son mot de passe via le lien recovery du mail de bienvenue
create table if not exists public.pending_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  name text not null,
  email text unique not null,
  created_at timestamptz default now()
);

alter table public.pending_users add column if not exists user_id uuid;

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
alter table public.pending_users enable row level security;

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
  for insert with check (public.is_admin() or (public.is_artist() and artist_id = auth.uid()));
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

-- Images des tableaux (publiques pour la galerie, upload par les artistes authentifiés)
insert into storage.buckets (id, name, public)
values ('artwork-images', 'artwork-images', true)
on conflict (id) do nothing;

drop policy if exists artwork_images_insert_public on storage.objects;
drop policy if exists artwork_images_select_public on storage.objects;
create policy artwork_images_insert_public on storage.objects
  for insert to authenticated with check (bucket_id = 'artwork-images');
create policy artwork_images_select_public on storage.objects
  for select to anon, authenticated using (bucket_id = 'artwork-images');

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
    -- Compte déjà existant (seed rejoué, ou compte créé par l'admin) :
    -- on remet à jour mot de passe et profil pour garantir le seed de démo.
    -- admin_create_artist refuse les emails déjà utilisés, cette branche n'est
    -- donc atteinte que par le seed.
    update auth.users
    set encrypted_password = crypt(p_password, gen_salt('bf')),
        raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', array['email'], 'role', p_role),
        raw_user_meta_data = jsonb_build_object('name', p_name),
        updated_at = now()
    where id = v_exists;
    update public.users
    set name = p_name, role = p_role
    where id = v_exists;
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

-- Réservé au serveur (seed) et aux fonctions admin/activation
revoke all on function public.create_auth_user(text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_auth_user(text, text, text, text) to service_role;

-- ------------------------------------------------------------
-- RLS : comptes en attente d'inscription (visibles/gérés par l'admin)
-- ------------------------------------------------------------
drop policy if exists pending_users_select_admin on public.pending_users;
drop policy if exists pending_users_insert_admin on public.pending_users;
drop policy if exists pending_users_delete_admin on public.pending_users;
create policy pending_users_select_admin on public.pending_users
  for select using (public.is_admin());
create policy pending_users_insert_admin on public.pending_users
  for insert with check (public.is_admin());
create policy pending_users_delete_admin on public.pending_users
  for delete using (public.is_admin());

-- ------------------------------------------------------------
-- RPC : l'admin crée un compte artiste (nom + email uniquement).
-- Un utilisateur Supabase Auth est créé avec un mot de passe temporaire
-- (jamais communiqué) ; le client reçoit un lien de récupération (recovery)
-- dans le mail de bienvenue pour définir lui-même son mot de passe.
-- ------------------------------------------------------------
-- Supprime l'ancienne signature (nom, email, mot de passe) utilisée avant
-- le passage au lien recovery : seule la version (nom, email) est conservée.
drop function if exists public.admin_create_artist(text, text, text);
create or replace function public.admin_create_artist(p_name text, p_email text)
returns json
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_uid uuid;
  v_tmp text := 'tmp-' || encode(gen_random_bytes(12), 'hex');
begin
  if not public.is_admin() then
    return json_build_object('ok', false, 'error', 'Accès refusé.');
  end if;
  if p_name is null or length(btrim(p_name)) = 0 then
    return json_build_object('ok', false, 'error', 'Le nom est obligatoire.');
  end if;
  if p_email is null or position('@' in btrim(p_email)) = 0 then
    return json_build_object('ok', false, 'error', 'Email invalide.');
  end if;
  if exists (select 1 from public.pending_users where lower(email) = lower(btrim(p_email)))
     or exists (select 1 from auth.users where lower(email) = lower(btrim(p_email))) then
    return json_build_object('ok', false, 'error', 'Cet email est déjà utilisé.');
  end if;
  v_uid := public.create_auth_user(btrim(p_name), lower(btrim(p_email)), v_tmp, 'artist');
  insert into public.pending_users (user_id, name, email)
  values (v_uid, btrim(p_name), lower(btrim(p_email)));
  return json_build_object('ok', true, 'id', v_uid);
end;
$$;

grant execute on function public.admin_create_artist(text, text) to authenticated;

-- ------------------------------------------------------------
-- RPC : fin d'activation. Le client (déjà connecté via le lien recovery)
-- a défini son mot de passe côté Supabase Auth (auth.updateUser).
-- Cette fonction retire simplement le compte de la liste d'attente.
-- ------------------------------------------------------------
drop function if exists public.activate_artist(text, text);
create or replace function public.activate_artist()
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_pending record;
begin
  select * into v_pending from public.pending_users where user_id = auth.uid();
  if not found then
    return json_build_object('ok', false, 'error', 'Aucun compte en attente pour cet utilisateur.');
  end if;
  delete from public.pending_users where id = v_pending.id;
  return json_build_object('ok', true);
end;
$$;

grant execute on function public.activate_artist() to authenticated;

-- ------------------------------------------------------------
-- RPC : suppression définitive d'un artiste (ou d'un compte en attente)
-- par l'admin. Le DELETE sur auth.users supprime en cascade le profil
-- users, les œuvres, cartes et retraits (FK on delete cascade).
-- Le nettoyage de pending_users est fait explicitement : ne pas dépendre
-- du cascade (la FK peut manquer sur des bases existantes).
-- ------------------------------------------------------------
create or replace function public.admin_delete_artist(p_id uuid)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_user_id uuid;
  v_role text;
begin
  if not public.is_admin() then
    return json_build_object('ok', false, 'error', 'Accès refusé.');
  end if;

  -- Cas 1 : l'id est une ligne de la file d'attente (pending_users).
  select user_id into v_user_id from public.pending_users where id = p_id;
  if v_user_id is not null then
    delete from auth.users where id = v_user_id;
    delete from public.pending_users where id = p_id;
    return json_build_object('ok', true);
  end if;

  -- Cas 2 : l'id est un utilisateur Auth (artiste actif).
  select role into v_role from public.users where id = p_id;
  if v_role = 'admin' then
    return json_build_object('ok', false, 'error', 'Impossible de supprimer un administrateur.');
  end if;
  delete from auth.users where id = p_id;
  -- Nettoie toute ligne d'attente encore rattachée à ce compte.
  delete from public.pending_users where user_id = p_id;

  -- Cas 3 : ligne d'attente résiduelle (sans user_id) référencée par son id.
  delete from public.pending_users where id = p_id;

  return json_build_object('ok', true);
end;
$$;

grant execute on function public.admin_delete_artist(uuid) to authenticated;

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
-- Le DROP évite l'erreur "cannot change name of view column" lors de la migration.
drop view if exists public.gallery_artworks;
create view public.gallery_artworks as
select
  a.id,
  a.title,
  a.description,
  a.image_url,
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
grant select, insert, update, delete on public.users, public.artworks, public.orders, public.withdrawals, public.settings, public.cards, public.pending_users to authenticated;
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

insert into public.orders (client_name, client_email, description, budget)
select 'Jean Dupont', 'jean@example.com', 'Un portrait abstrait bleu et or, format 50x70.', '500 CHF'
where not exists (
  select 1 from public.orders
  where client_name = 'Jean Dupont'
    and client_email = 'jean@example.com'
    and description = 'Un portrait abstrait bleu et or, format 50x70.'
);

-- Dedup des commandes seed : on garde la plus ancienne occurrence par
-- (client_name, client_email, description).
delete from public.orders a
using public.orders b
where a.id <> b.id
  and a.client_name = b.client_name
  and a.client_email = b.client_email
  and a.description = b.description
  and a.created_at > b.created_at;

-- ------------------------------------------------------------
-- Maintenance (idempotente, utile sur les bases existantes) :
-- purge des lignes d'attente orphelines (leur utilisateur Auth a déjà
-- été supprimé) et rétablissement de la FK pending_users.user_id -> users
-- si elle manque, pour que la suppression d'un compte se fasse en un clic.
-- ------------------------------------------------------------
delete from public.pending_users p
where p.user_id is not null
  and not exists (select 1 from auth.users u where u.id = p.user_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'pending_users'
      and c.conname = 'pending_users_user_id_fkey'
      and c.contype = 'f'
  ) then
    alter table public.pending_users
      add constraint pending_users_user_id_fkey
      foreign key (user_id) references public.users(id) on delete cascade;
  end if;
end $$;
