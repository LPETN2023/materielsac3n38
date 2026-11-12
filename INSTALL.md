# Installation — Gestion de Matériels

Application web installable (PWA) hébergée sur GitHub Pages, base de données Supabase.

## Fichiers

```
index.html            structure de l'application, fenêtres (modales)
manifest.json         configuration PWA (installation sur PC / Android)
sw.js                 service worker (réseau d'abord, cache hors connexion)
css/style.css         styles
js/config.js          connexion Supabase + accès aux données
js/pages.js           pages et formulaires
js/app.js             interface, scanner QR, navigation
js/pwa.js             enregistrement du service worker, bannière d'installation
icons/                icônes
schema.sql            schéma COMPLET pour une installation neuve
supabase/migrations/  modifications appliquées à la base en service (historique)
supabase/functions/creer-compte/   fonction serveur de création de comptes
```

## 1. Supabase (installation neuve)

1. Créer un projet sur supabase.com et noter l'**URL** et la **clé anon** (Settings > API).
2. **SQL Editor** : coller tout `schema.sql`, puis **Run**.
3. **Edge Functions** : créer la fonction `creer-compte` avec le contenu de
   `supabase/functions/creer-compte/index.ts` (« Verify JWT » activé).
4. **Authentication > Sign In / Providers** : désactiver **Allow new users to sign up**
   et **Confirm email**.
5. **Authentication > URL Configuration** : Site URL et Redirect URL =
   `https://lpetn2023.github.io/materielsac3n38`.
6. Premier administrateur : **Authentication > Users > Add user** (adresse
   `@gendarmerie.interieur.gouv.fr`), puis dans le SQL Editor :
   ```sql
   insert into public.profiles (id, username, full_name, role)
   values ('UUID_DU_COMPTE', 'prenom.nom', 'Prénom NOM', 'admin');
   ```
   Les comptes suivants se créent depuis la page **Comptes** du site.

## 2. Site

1. Dans `js/config.js`, renseigner `SUPABASE_URL` et `SUPABASE_ANON_KEY`
   (la clé *anon* est publique par conception ; **jamais** la clé `service_role`).
2. Pousser le dépôt sur GitHub et activer **Settings > Pages** (branche `main`, dossier racine).

## 3. Sécurité (résumé)

- Seuls les comptes **actifs** ont accès aux données (règles RLS de la base).
- Seul un admin peut changer un rôle ou désactiver un compte ; personne ne peut
  modifier son propre rôle.
- Les comptes sont créés par la fonction serveur `creer-compte` (contrôle admin +
  domaine email) : aucune inscription publique.
- Prêts et retours passent par les fonctions `preter_objet` / `rendre_objet` :
  un objet ne peut pas être prêté deux fois.
- Le journal d'audit est écrit par la base elle-même.

## 4. Mise à jour du site

Pousser les fichiers modifiés sur GitHub. Grâce au service worker « réseau d'abord »,
les utilisateurs reçoivent la nouvelle version au prochain chargement, sans vider le cache.
Exception : la toute première mise à jour vers cette version (ancien service worker encore actif)
peut demander un rechargement forcé (Ctrl+Maj+R) ou de rouvrir l'application.
