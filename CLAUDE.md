# CLAUDE.md — Gestion de Matériels (materielsac3n38)

Fichier de reprise pour Claude. À tenir à jour à chaque livraison.
Ce dépôt est public : ne jamais y écrire de secret (la clé `service_role` reste dans Supabase).

## Projet
PWA de prêt de matériel par QR codes. HTML/CSS/JS vanilla **sans build**, hébergée sur
GitHub Pages (`https://lpetn2023.github.io/materielsac3n38/`, sous-dossier : attention aux chemins),
backend Supabase (projet `ryfjulxsknibszxlznau`, région eu-central-1).
Utilisateur francophone, non développeur, sensible à la sécurité : réponses en français, courtes, concrètes.

## Fichiers
- `index.html` : structure, sidebar, FAB, modales. Ordre des scripts : `config.js, pages.js, app.js, pwa.js`.
- `js/config.js` : clients Supabase (`db`, `dbSignup` = vérification du mot de passe actuel uniquement),
  `Auth`, `Logs`, `Items`, `Loans`, `Autocomplete`, `ItemTypes`, `Users`, `Utils`.
- `js/pages.js` : rendu des pages et gestionnaires de formulaires. `js/app.js` : `UI`, `Scanner`, routeur `App`.
- `sw.js` : service worker **réseau d'abord** (cache seulement hors connexion ; CDN en cache d'abord).
- `schema.sql` : schéma complet pour une installation neuve.
- `supabase/migrations/` : historique des changements appliqués à la base en service.
- `supabase/functions/creer-compte/` : Edge Function de création de comptes.
- CDN : `@supabase/supabase-js@2`, `jsqr@1.4.0`, `qrcodejs@1.0.0`, `jszip@3.10.1` (chargé à la demande).

## Base de données (état au 12/11/2026)
Tables : `profiles`, `items` (status `available|loaned`), `loans` (colonne `operation`),
`item_types` (name, code, sort_order), `known_persons`, `operations`, `audit_logs`.
- **RLS** : tout exige un profil **actif** (`is_active_user()`) ; `is_admin()` pour suppression d'objet,
  modification des profils, lecture du journal. `anon` n'a aucun droit.
- **Profils** : pas d'INSERT côté client ; création via l'Edge Function `creer-compte`
  (vérifie admin actif + domaine `@gendarmerie.interieur.gouv.fr`, crée auth + profil, journalise).
  Trigger `profiles_proteger` : personne ne change son propre rôle/statut ; id/username figés.
- **Prêts** : uniquement via `preter_objet(p_item_id, p_loaned_to, p_loan_date, p_expected_return,
  p_operation, p_notes)` et `rendre_objet(p_loan_id, p_return_notes)` (verrou + index unique
  `loans_un_pret_actif`). Le statut d'un objet n'est plus modifiable à la main.
- **Droits par colonne sur `items`** : `authenticated` ne peut modifier que `type, brand, model,
  description, storage_location, is_loanable` (+ `qr_code` à la création). Toute nouvelle colonne
  modifiable depuis le site doit être ajoutée au `grant` (migration `20261112_02`).
- **Journal** : écrit par la base (trigger `journaliser` sur items, loans, item_types, profiles).
  Le client ne peut insérer que `LOGIN`, `LOGOUT`, `PASSWORD_CHANGE` ; auteur et date imposés
  (`audit_imposer_auteur`). `items.created_by*` imposés (`items_imposer_createur`).
- Réglages dashboard : inscriptions publiques **désactivées**, « Confirm email » désactivé,
  Site/Redirect URL = `https://lpetn2023.github.io/materielsac3n38`.

## Règles de travail
1. `node --check` sur chaque fichier JS avant livraison (des remplacements en masse ont déjà cassé le code).
2. Préférer des modifications ciblées avec contrôle du nombre d'occurrences ; fichiers en CRLF.
3. Toute donnée insérée dans du HTML : `Utils.escapeHtml`. Dans un `onclick="..."` : `Utils.jsArg(valeur)`
   (sans guillemets autour). Recherche texte dans un filtre `.or()` : `Utils.cleanSearch`.
4. Changement de base : écrire un fichier `supabase/migrations/AAAAMMJJ_NN_nom.sql`, le tester dans une
   transaction annulée, l'appliquer, puis répercuter dans `schema.sql`. Jamais de trigger sur `auth.users`
   (permission refusée).
5. Changer `CACHE_NAME` dans `sw.js` seulement si la liste `STATIC_ASSETS` change.
6. Pièges connus : page de connexion (`marginLeft='0'` + `.main-content:has(.login-page)`), bannière
   d'installation (`pwa-banner-visible`), impression (`data-label-pos`), sous-dossier GitHub Pages
   (`./sw.js`, `BASE` calculé, manifest en `/materielsac3n38/`).
7. L'utilisateur préfère des fichiers complets avec la liste des fichiers modifiés, et qu'on lui dise
   clairement ce qu'il doit faire (pousser, exécuter un SQL, recharger).

## Pistes non réalisées
- Copier les bibliothèques CDN dans le dépôt (`js/vendor/`) et figer la version de supabase-js.
- Activer la protection contre les mots de passe divulgués (Authentication > Policies, offre payante).
