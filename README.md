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
   - Crée les fonctions RPC sécurisées : `request_withdrawal` (frais de 20 % vérifiés côté serveur), `admin_create_artist` (nom + email), `activate_artist` (le client définit son mot de passe) et `admin_delete_artist` (suppression définitive d'un utilisateur par l'admin).
   - `0005_fix_demo_account.sql` : à exécuter sur une base existante pour réparer le compte de démo `artiste@demo.com / artist123`, supprimer les doublons de `orders` et re-créer l'œuvre de démo si elle manque. Le seed de `schema.sql` est idempotent (il ne crée plus de doublons).
3. Copiez l'URL du projet et la clé `anon public` (Project Settings → API) dans `.env`.
4. Redémarrez `npm run dev`.

### Emails

- **Bienvenue / invitation** : à la création d'un compte par l'admin, le mail d'accueil personnalisé est envoyé par la **fonction serverless Vercel** `/api/send-welcome-email` via le SMTP de la plateforme (Hostinger). Le lien de confirmation pointe vers `SITE_URL` (jamais localhost). En dev local (ou si l'API n'est pas déployée), le front retombe sur le mail Magic Link de Supabase Auth.
- **Vente** : à l'enregistrement d'une vente par l'admin, l'artiste reçoit un email de notification via l'Edge Function `notify-artist-sale`.

Variables d'environnement à configurer sur Vercel (Project Settings → Environment Variables) :

| Variable | Valeur |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://asiaqrkldaqotjttmcjd.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | clé `anon public` |
| `SUPABASE_SERVICE_ROLE_KEY` | clé `service_role` (serveur uniquement, jamais dans le `.env`) |
| `SMTP_HOST` | `smtp.hostinger.com` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | `info@boursemarket.business` |
| `SMTP_PASSWORD` | mot de passe de la boîte mail |
| `SMTP_FROM` | `Bourse&Art <info@boursemarket.business>` |
| `SITE_URL` | `https://boursemarket.business` |

> En local, le `.env` ne contient que les clés publiques `VITE_*` ; les identifiants SMTP et la clé service_role ne doivent **jamais** être embarqués dans le JS du navigateur.

Déployer l'Edge Function de vente et ses secrets :

```
supabase functions deploy notify-artist-sale
supabase secrets set SMTP_HOST=smtp.hostinger.com SMTP_PORT=465 SMTP_USER=info@boursemarket.business SMTP_PASSWORD=... SMTP_FROM="Bourse&Art <info@boursemarket.business>" SITE_URL=https://boursemarket.business
```

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
2. Ajoutez les variables d'environnement (voir « Emails ») : `VITE_*`, `SUPABASE_SERVICE_ROLE_KEY`, `SMTP_*`, `SITE_URL`.
3. Framework : Vite. Build : `npm run build`. Output : `dist`.
4. La fonction serverless `/api/send-welcome-email` est déployée automatiquement par Vercel (aucune configuration).
5. Les routes SPA (`/admin`, `/artiste`, `/commandes`, `/connexion`) sont gérées par le `vercel.json` inclus.

## Comptes de démonstration

| Rôle    | Email              | Mot de passe   |
| ------- | ------------------ | -------------- |
| Admin   | admin@bourse.com   | admin123       |
| Artiste | artiste@demo.com   | artist123      |
