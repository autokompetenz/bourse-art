# Bourse&Art

Plateforme de veille : actualités boursières + galerie de tableaux d'art. Frontend React (Vite + Tailwind), backend Supabase.

## Fonctionnalités

- **Marché en direct** : cours des actions, indices et matières premières mis à jour toutes les 3 secondes (simulation temps réel locale, remplaçable par une vraie API).
- **Commande de tableaux** : formulaire public (nom, email, description, budget).
- **Espace artiste** : ajout/suppression d'œuvres, suivi des ventes, solde, retraits.
- **Espace admin** : vente des tableaux, création de comptes artistes, gestion des retraits, IBAN de la plateforme, recherche + pagination sur les listes.
- **Comptes attribués par l'admin** : pas d'inscription publique. L'administrateur crée le compte avec le nom, l'email et le mot de passe ; ce mot de passe est envoyé à l'artiste par email et reste visible dans l'espace admin.
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
2. Dans le SQL Editor, exécutez le contenu de `supabase/schema.sql` (fichier unique, idempotent).
   - Crée les tables `users`, `artworks`, `orders`, `withdrawals`, `settings`, `pending_users`.
   - Active la **Row Level Security** sur toutes les tables.
   - Crée les comptes de démonstration dans **Supabase Auth**.
   - Crée les fonctions RPC sécurisées : `request_withdrawal` (frais de 20 % vérifiés côté serveur), `admin_create_artist` (nom + email uniquement ; l'artiste choisit lui-même son mot de passe via le lien du mail de bienvenue), `activate_artist` (retrait de la liste d'attente après activation) et `admin_delete_artist` (suppression définitive d'un utilisateur par l'admin).
3. Copiez l'URL du projet et la clé `anon public` (Project Settings → API) dans `.env`.
4. Redémarrez `npm run dev`.

### Emails

- **Bienvenue / invitation** : à la création d'un compte par l'admin (nom + email), le mail d'accueil personnalisé est envoyé par la **fonction serverless Vercel** `/api/send-welcome-email` via le SMTP de la plateforme (Hostinger). Il contient un lien (type recovery) qui permet à l'artiste de **choisir lui-même son mot de passe**, pointant vers `SITE_URL` (jamais localhost). Aucun mail générique de Supabase n'est envoyé ; en cas d'échec de l'API, une erreur claire est affichée à l'admin (l'API n'existe qu'en production).
- **Vente** : à l'enregistrement d'une vente par l'admin, l'artiste reçoit un email de notification via la **fonction serverless Vercel** `/api/send-sale-notification` (même infrastructure SMTP que le mail de bienvenue).

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
| `SITE_URL` | `https://www.boursemarket.business` (origine du lien de récupération du mot de passe dans le mail de bienvenue) |

> En local, le `.env` ne contient que les clés publiques `VITE_*` ; les identifiants SMTP et la clé service_role ne doivent **jamais** être embarqués dans le JS du navigateur.

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
4. Les fonctions serverless `/api/send-welcome-email` et `/api/send-sale-notification` sont déployées automatiquement par Vercel (aucune configuration).
5. Les routes SPA (`/admin`, `/artiste`, `/commandes`, `/connexion`) sont gérées par le `vercel.json` inclus.

## Comptes de démonstration

| Rôle    | Email              | Mot de passe   |
| ------- | ------------------ | -------------- |
| Admin   | admin@bourse.com   | admin123       |
| Artiste | artiste@demo.com   | artist123      |
