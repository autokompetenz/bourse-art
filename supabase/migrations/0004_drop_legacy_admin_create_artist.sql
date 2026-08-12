-- Migration : suppression de l'ancienne signature admin_create_artist(text,text,text)
-- qui créait le compte avec un mot de passe fourni directement (avant le passage
-- au magic link). Seule la version (nom, email) est utilisée désormais.
drop function if exists public.admin_create_artist(text, text, text);
