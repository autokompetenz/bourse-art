-- Migration : création de comptes artistes par l'admin (nom + email).
-- Le client reçoit un magic link (Supabase Auth) et définit lui-même
-- son mot de passe. Aucune Edge Function n'est requise.

-- 1. Table des comptes en attente d'inscription
create table if not exists public.pending_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  name text not null,
  email text unique not null,
  created_at timestamptz default now()
);

alter table public.pending_users add column if not exists user_id uuid;

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

-- 2. RPC : l'admin crée un compte (nom + email uniquement).
-- L'utilisateur Supabase Auth est créé avec un mot de passe temporaire
-- (jamais communiqué) ; le client reçoit un magic link pour définir
-- lui-même son mot de passe.
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

-- 3. RPC : fin d'activation. Le client (déjà connecté via magic link)
-- a défini son mot de passe côté Supabase Auth (auth.updateUser).
-- Cette fonction retire simplement le compte de la liste d'attente.
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

-- 4. Grants pour la lecture par l'admin (listArtists)
grant select, insert, delete on public.pending_users to authenticated;
