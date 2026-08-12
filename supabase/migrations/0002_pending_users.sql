-- Migration : création de comptes artistes par l'admin (nom + email)
-- Le client définit lui-même son mot de passe lors de l'activation (activate_artist).

-- 1. Table des comptes en attente d'inscription
create table if not exists public.pending_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  created_at timestamptz default now()
);

alter table public.pending_users enable row level security;

drop policy if exists pending_users_select_admin on public.pending_users;
drop policy if exists pending_users_insert_admin on public.pending_users;
drop policy if exists pending_users_delete_admin on public.pending_users;
create policy pending_users_select_admin on public.pending_users
  for select using (public.is_admin());
create policy pending_users_insert_admin on public.pending_users
  for insert with check (public.is_admin());
create policy pending_users_delete_admin on public.pending_users
  for delete using (public.is_admin());

-- 2. RPC : l'admin crée un compte (nom + email uniquement)
create or replace function public.admin_create_artist(p_name text, p_email text)
returns json
language plpgsql security definer set search_path = public
as $$
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
  insert into public.pending_users (name, email)
  values (btrim(p_name), lower(btrim(p_email)));
  return json_build_object('ok', true);
end;
$$;

grant execute on function public.admin_create_artist(text, text) to authenticated;

-- 3. RPC : le client active son compte en choisissant son mot de passe
create or replace function public.activate_artist(p_email text, p_password text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_pending record;
  v_uid uuid;
begin
  if p_email is null or p_password is null then
    return json_build_object('ok', false, 'error', 'Email et mot de passe requis.');
  end if;
  if length(p_password) < 6 then
    return json_build_object('ok', false, 'error', 'Le mot de passe doit contenir au moins 6 caractères.');
  end if;
  select * into v_pending from public.pending_users
  where lower(email) = lower(btrim(p_email)) limit 1;
  if not found then
    return json_build_object('ok', false, 'error', 'Aucun compte en attente pour cet email.');
  end if;
  if exists (select 1 from auth.users where lower(email) = lower(btrim(p_email))) then
    return json_build_object('ok', false, 'error', 'Un compte existe déjà avec cet email.');
  end if;
  v_uid := public.create_auth_user(v_pending.name, lower(btrim(p_email)), p_password, 'artist');
  delete from public.pending_users where id = v_pending.id;
  return json_build_object('ok', true, 'id', v_uid);
end;
$$;

grant execute on function public.activate_artist(text, text) to anon, authenticated;

-- 4. Grants pour la lecture par l'admin (listArtists)
grant select, insert, delete on public.pending_users to authenticated;
