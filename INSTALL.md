# 📋 Guide d'installation — Inventaire Matériels

## 🗂 Structure des fichiers

```
inventaire-app/
├── index.html          ← Application principale
├── manifest.json       ← Config PWA (installation app)
├── sw.js               ← Service worker (offline)
├── schema.sql          ← Schéma base de données
├── css/
│   └── style.css       ← Styles
├── js/
│   ├── config.js       ← Config Supabase + services
│   ├── pages.js        ← Rendus des pages
│   ├── app.js          ← Application principale
│   └── pwa.js          ← Enregistrement service worker
└── icons/
    ├── icon-192.png    ← Icône PWA (à créer)
    └── icon-512.png    ← Icône PWA (à créer)
```

---

## ⚙️ ÉTAPE 1 — Configurer Supabase

### 1.1 Créer un projet Supabase
1. Allez sur [supabase.com](https://supabase.com) → **New project**
2. Notez l'**URL** et la **clé anon** (Settings > API)

### 1.2 Importer le schéma SQL
1. Dans Supabase : **SQL Editor** → **New query**
2. Copiez-collez tout le contenu de `schema.sql`
3. Cliquez **Run**

> ⚠️ Le schéma inclut déjà toutes les fonctions, triggers, index et politiques de sécurité. Il n'y a rien d'autre à exécuter séparément.

### 1.3 Créer le premier compte administrateur
1. Dans Supabase : **Authentication** → **Users** → **Add user**
2. Saisissez un email `@gendarmerie.interieur.gouv.fr` + mot de passe → **Create user**

> ⚠️ Seuls les emails `@gendarmerie.interieur.gouv.fr` sont acceptés. Un trigger en base bloque toute inscription avec un autre domaine.

3. Copiez l'**UUID** de l'utilisateur créé
4. Dans **SQL Editor**, exécutez :
```sql
INSERT INTO profiles (id, username, full_name, role)
VALUES ('VOTRE_UUID_ICI', 'admin', 'Votre Nom', 'admin');
```

---

## ⚙️ ÉTAPE 2 — Configurer l'application

Ouvrez `js/config.js` et remplacez :
```javascript
const SUPABASE_URL = 'VOTRE_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'VOTRE_SUPABASE_ANON_KEY';
```
Par vos vraies valeurs depuis Supabase > Settings > API.

---

## ⚙️ ÉTAPE 3 — Créer les icônes PWA

Dans le dossier `icons/`, créez deux images :
- `icon-192.png` (192×192 px)
- `icon-512.png` (512×512 px)

💡 Vous pouvez utiliser un générateur en ligne comme [favicon.io](https://favicon.io) ou [realfavicongenerator.net](https://realfavicongenerator.net).

---

## ⚙️ ÉTAPE 4 — Héberger sur GitHub Pages

### 4.1 Créer le dépôt GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/VOTRE_USERNAME/VOTRE_REPO.git
git push -u origin main
```

### 4.2 Activer GitHub Pages
1. Dépôt GitHub → **Settings** → **Pages**
2. Source : **Deploy from a branch**
3. Branch : `main` / `/ (root)`
4. Cliquez **Save**

L'application sera disponible à :
`https://VOTRE_USERNAME.github.io/VOTRE_REPO/`

### 4.3 Configurer Supabase pour GitHub Pages
Dans Supabase → **Authentication** → **URL Configuration** :
- **Site URL** : `https://VOTRE_USERNAME.github.io`
- **Redirect URLs** : `https://VOTRE_USERNAME.github.io/VOTRE_REPO/`

---

## 📱 ÉTAPE 5 — Installer comme application

### Sur Android (Chrome)
1. Ouvrez l'URL du site dans Chrome
2. Menu (⋮) → **Ajouter à l'écran d'accueil**
3. Ou attendez la bannière d'installation automatique

### Sur iPhone (Safari)
1. Ouvrez l'URL dans Safari
2. Bouton partage (□↑) → **Sur l'écran d'accueil**

### Sur PC (Chrome/Edge)
1. Icône d'installation dans la barre d'adresse
2. Ou Menu → **Installer**

---

## 🔄 MISE À JOUR d'une installation existante

Si vous mettez à jour une installation déjà en place plutôt que de repartir de zéro, exécutez uniquement les migrations nécessaires selon votre version :

```sql
-- Ajout du flag "matériel de prêt" (si pas encore présent)
ALTER TABLE items ADD COLUMN IF NOT EXISTS is_loanable BOOLEAN NOT NULL DEFAULT true;

-- Ajout du code diminutif sur les types de matériel (si pas encore présent)
ALTER TABLE item_types ADD COLUMN IF NOT EXISTS code VARCHAR(8);
UPDATE item_types SET code = 'PC'    WHERE name ILIKE '%ordinateur%';
UPDATE item_types SET code = 'PHONE' WHERE name ILIKE '%téléphone%' OR name ILIKE '%telephone%' OR name ILIKE '%smartphone%';
UPDATE item_types SET code = 'TAB'   WHERE name ILIKE '%tablette%';
UPDATE item_types SET code = 'CAM'   WHERE name ILIKE '%photo%' OR name ILIKE '%caméra%' OR name ILIKE '%camera%';
UPDATE item_types SET code = 'HDD'   WHERE name ILIKE '%disque dur%';
UPDATE item_types SET code = 'SSD'   WHERE name ILIKE '%ssd%';
UPDATE item_types SET code = 'USB'   WHERE name ILIKE '%usb%';
UPDATE item_types SET code = 'GPS'   WHERE name ILIKE '%gps%';
UPDATE item_types SET code = 'AUDIO' WHERE name ILIKE '%audio%' OR name ILIKE '%enregistreur%';
UPDATE item_types SET code = 'PRINT' WHERE name ILIKE '%imprimante%';
UPDATE item_types SET code = 'SCAN'  WHERE name ILIKE '%scanner%';
UPDATE item_types SET code = 'DRONE' WHERE name ILIKE '%drone%';
UPDATE item_types SET code = 'RADIO' WHERE name ILIKE '%radio%';
UPDATE item_types SET code = 'DIV'   WHERE name ILIKE '%autre%';
UPDATE item_types SET code = UPPER(LEFT(REGEXP_REPLACE(name, '[^a-zA-Z]', '', 'g'), 4))
WHERE code IS NULL OR code = '';
```

---

## 🔒 Sécurité

- **Authentification** : via Supabase Auth (email + mot de passe)
- **Domaine email restreint** : seuls les comptes `@gendarmerie.interieur.gouv.fr` sont acceptés, contrôlé à la fois côté application et par un trigger en base de données
- **Row Level Security** : chaque table est protégée, les utilisateurs ne voient que ce qu'ils ont le droit de voir
- **Logs d'audit** : toutes les actions sont enregistrées avec l'utilisateur et la date ; à la suppression d'un compte, les logs sont conservés mais anonymisés automatiquement
- **HTTPS** : obligatoire via GitHub Pages (certificat auto)
- Pas de page d'inscription publique : **seul l'admin peut créer des comptes**

---

## 🔧 Fonctionnalités principales

| Fonctionnalité | Description |
|---|---|
| 📷 Scanner QR | Caméra en temps réel + saisie manuelle |
| 📦 Enregistrement | Objet inconnu → formulaire de création avec génération automatique du code QR selon le type |
| 🔄 Prêt | Objet libre → prêt avec autocomplétion des noms et opérations |
| ⚠️ Matériel non prêtable | Avertissement si le matériel est marqué comme non destiné au prêt |
| ✅ Restitution | Objet prêté → restitution avec notes de retour |
| 🏷 Génération QR | Codes imprimables par type, taille et position du label configurables |
| 👤 Comptes | Création par admin uniquement, domaine email restreint |
| 📋 Logs | Journal complet des actions (admin uniquement) |
| 📱 PWA | Installable comme app native sur mobile et desktop |

---

## ❓ Dépannage

**La caméra ne s'ouvre pas**
→ Le site doit être en HTTPS. GitHub Pages l'assure automatiquement.

**Erreur de connexion à Supabase**
→ Vérifiez que `SUPABASE_URL` et `SUPABASE_ANON_KEY` sont corrects dans `config.js`.

**La création de compte ne fonctionne pas**
→ Vérifiez que l'email utilisé est bien en `@gendarmerie.interieur.gouv.fr`. Si l'erreur persiste, créez le compte directement dans Supabase > Authentication > Users, puis insérez manuellement le profil :
```sql
INSERT INTO profiles (id, username, full_name, role)
VALUES ('UUID_DU_NOUVEL_UTILISATEUR', 'username', 'Nom Prénom', 'user');
```

**Le code QR généré contient "DIV" au lieu du type**
→ Vérifiez que le type de matériel saisi correspond exactement à un type existant dans la table `item_types` (sensible aux accents). Vous pouvez vérifier via Supabase > Table Editor > item_types.

---

## 📞 Support

Pour toute question, consultez :
- [Supabase Docs](https://supabase.com/docs)
- [GitHub Pages Docs](https://docs.github.com/en/pages)
