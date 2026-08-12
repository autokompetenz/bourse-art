-- Migration : l'admin peut supprimer définitivement un utilisateur
-- (artiste actif ou compte en attente). Le DELETE sur auth.users supprime
-- en cascade le profil users, les œuvres, cartes et retraits (FK on delete cascade).

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

  -- Cas 1 : compte en attente (p_id = id de pending_users)
  select user_id into v_user_id from public.pending_users where id = p_id;
  if v_user_id is not null then
    delete from auth.users where id = v_user_id;
    if found then
      return json_build_object('ok', true);
    end if;
    -- L'utilisateur auth a déjà été supprimé : nettoie la ligne orpheline
    delete from public.pending_users where id = p_id;
    if found then
      return json_build_object('ok', true);
    end if;
  else
    delete from public.pending_users where id = p_id;
    if found then
      return json_build_object('ok', true);
    end if;
  end if;

  -- Cas 2 : artiste actif (p_id = id du user dans auth.users)
  select role into v_role from public.users where id = p_id;
  if v_role = 'admin' then
    return json_build_object('ok', false, 'error', 'Impossible de supprimer un administrateur.');
  end if;
  delete from auth.users where id = p_id;
  if found then
    return json_build_object('ok', true);
  end if;

  return json_build_object('ok', false, 'error', 'Utilisateur introuvable.');
end;
$$;

grant execute on function public.admin_delete_artist(uuid) to authenticated;
