-- 0006_fix_pending_delete.sql
-- À exécuter dans le SQL Editor Supabase (ou via supabase db push) pour
-- corriger la suppression d'un compte qui demandait plusieurs clics :
--   1. la FK pending_users.user_id -> public.users(id) on delete cascade
--      manquait sur les bases existantes (la ligne d'attente survivait à la
--      suppression, d'où un second clic nécessaire),
--   2. admin_delete_artist ne dépend plus du cascade : il supprime
--      explicitement les lignes pending_users,
--   3. suppression des lignes d'attente orphelines déjà créées.

-- 1. Purge des lignes d'attente orphelines (leur utilisateur Auth a déjà
--    été supprimé : ce sont les comptes fantômes qui exigeaient plusieurs
--    clics). À faire AVANT d'ajouter la FK, sinon la contrainte échouerait.
delete from public.pending_users p
where p.user_id is not null
  and not exists (select 1 from auth.users u where u.id = p.user_id);

-- 2. Rétablir la contrainte si elle manque.
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

-- 3. Version corrigée de la RPC (nettoyage explicite de pending_users).
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
