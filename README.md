# Bourse&Art

Plateforme de veille : actualités boursières + galerie de tableaux d'art. Frontend React (Vite + Tailwind), backend Supabase.

## Fonctionnalités

- **Marché en direct** : cours des actions, indices et matières premières mis à jour toutes les 3 secondes (simulation temps réel locale, remplaçable par une vraie API).
- **Commande de tableaux** : formulaire public (nom, email, description, budget).
- **Espace artiste** : ajout/suppression d'œuvres, suivi des ventes, solde, retraits.
- **Espace admin** : vente des tableaux, création de comptes artistes, gestion des retraits, IBAN de la plateforme, recherche + pagination sur les listes.
- **Comptes attribués par l'admin** : pas d'inscription publique. L'administrateur crée le compte avec le nom et l'email ; le client choisit lui-même son mot de passe lors de son inscription (plus sûr).
- **Mode démo offline** : sans clés Supabase, le site fonctionne avec des données locales (localStorage) et les comptes de démonstration.

## Démarrage local

```
npm install
cp .env.example .env   # laisser vide pour le mode démo, ou remplir Supabase
npm run dev
```

> Sans `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, le site tourne en **mode démo** (données locales). Comptes démo : `admin@bourse.com / admin123` et `artiste@demo.com / artist123`.

## Configuration Supabase

1. Créez un projet sur [supabase.com](https://supabase.com).
2. Dans le SQL Editor, exécutez le contenu de `supabase/schema.sql`, puis les migrations de `supabase/migrations/` (dans l'ordre) si le schéma est déjà en place.
   - Crée les tables `users`, `artworks`, `orders`, `withdrawals`, `settings`, `pending_users`.
   - Active la **Row Level Security** sur toutes les tables.
   - Crée les comptes de démonstration dans **Supabase Auth**.
   - Crée les fonctions RPC sécurisées : `request_withdrawal` (frais de 20 % vérifiés côté serveur), `admin_create_artist` (nom + email) et `activate_artist` (le client définit son mot de passe).
3. Copiez l'URL du projet et la clé `anon public` (Project Settings → API) dans `.env`.
4. Déployez les Edge Functions d'email (SMTP) :
   ```
   supabase login
   supabase functions deploy notify-artist-sale
   supabase functions deploy notify-pending-artist
   ```
   Les variables `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` et `SITE_URL` doivent être définies dans les secrets de la fonction.
5. Redémarrez `npm run dev`.

### Emails

- **Vente** : à l'enregistrement d'une vente par l'admin, l'artiste reçoit un email de notification (`notify-artist-sale`).
- **Invitation** : à la création d'un compte par l'admin, le client reçoit un email l'invitant à définir son mot de passe sur la page de connexion, onglet « Inscription » (`notify-pending-artist`).

### Authentification

L'authentification passe par **Supabase Auth** (JWT), plus aucun hash côté client. Le profil utilisateur (nom + rôle) est stocké dans `users`, créé automatiquement à l'inscription via un trigger. Le rôle `admin` est défini dans les métadonnées du compte (seed ou édition manuelle dans le dashboard Auth).

## Scripts

| Commande            | Rôle                          |
| ------------------- | ----------------------------- |
| `npm run dev`       | Serveur de développement      |
| `npm run build`     | Typecheck + build de prod     |
| `npm run lint`      | Typecheck (`tsc --noEmit`)    |
| `npm test`          | Tests unitaires (vitest)      |

## Déploiement Vercel

1. Poussez le projet sur GitHub et importez-le dans Vercel.
2. Ajoutez les variables d'environnement `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`.
3. Framework : Vite. Build : `npm run build`. Output : `dist`.
4. Les routes SPA (`/admin`, `/artiste`, `/commandes`, `/connexion`) sont gérées par le `vercel.json` inclus.

## Comptes de démonstration

| Rôle    | Email              | Mot de passe   |
| ------- | ------------------ | -------------- |
| Admin   | admin@bourse.com   | admin123       |
| Artiste | artiste@demo.com   | artist123      |
