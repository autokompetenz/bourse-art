-- 0005_fix_demo_account.sql
-- À exécuter dans le SQL Editor Supabase (ou via supabase db push) pour :
--   1. réparer le compte de démo artiste@demo.com / artist123,
--   2. supprimer les doublons de la table orders,
--   3. re-créer l'œuvre de démonstration si le tableau artworks est vide.

-- 1. Compte de démo : reset du mot de passe + profil cohérent.
do $$
declare
  v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = 'artiste@demo.com' limit 1;

  if v_id is not null then
    update auth.users
    set encrypted_password = extensions.crypt('artist123', extensions.gen_salt('bf')),
        raw_app_meta_data = jsonb_build_object(
          'provider', 'email',
          'providers', array['email'],
          'role', 'artist'
        ),
        raw_user_meta_data = jsonb_build_object('name', 'Artiste Démo'),
        updated_at = now()
    where id = v_id;

    insert into public.users (id, name, email, role)
    values (v_id, 'Artiste Démo', 'artiste@demo.com', 'artist')
    on conflict (id) do update set name = 'Artiste Démo', role = 'artist';

    -- Au cas où un compte en attente existerait encore pour cet email.
    delete from public.pending_users where lower(email) = 'artiste@demo.com';
  else
    raise notice 'artiste@demo.com introuvable : relancer le seed de schema.sql.';
  end if;
end $$;

-- 2. Dedup des commandes seed : on garde la plus ancienne occurrence par
--    (client_name, client_email, description).
delete from public.orders a
using public.orders b
where a.id <> b.id
  and a.client_name = b.client_name
  and a.client_email = b.client_email
  and a.description = b.description
  and a.created_at > b.created_at;

-- 3. Œuvre de démo manquante.
insert into public.artworks (artist_id, title, description, status, buyer_name, negotiation_date, price)
select u.id, 'Coucher de soleil', 'Huile sur toile, 60x80cm', 'negotiation', null, null, null
from public.users u
where u.email = 'artiste@demo.com'
  and not exists (select 1 from public.artworks);
