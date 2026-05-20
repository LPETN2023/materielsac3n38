# 📋 Guide d'installation — Inventaire Judiciaire

## 🗂 Structure des fichiers

```
inventaire-app/
├── index.html          ← Application principale
├── manifest.json       ← Config PWA (installation app)
├── sw.js               ← Service worker (offline)
├── supabase_schema.sql ← Schéma base de données
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
2. Copiez-collez tout le contenu de `supabase_schema.sql`
3. Cliquez **Run**

### 1.3 Créer les fonctions RPC (pour l'autocomplétion)
Dans le SQL Editor, exécutez également :
```sql
CREATE OR REPLACE FUNCTION increment_person_count(person_name TEXT)
RETURNS void AS $$
  UPDATE known_persons SET usage_count = usage_count + 1 WHERE name = person_name;
$$ LANGUAGE sql;
```

### 1.4 Créer le premier compte administrateur
1. Dans Supabase : **Authentication** → **Users** → **Add user**
2. Saisissez email + mot de passe → **Create user**
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

## 🔒 Sécurité

- **Authentification** : via Supabase Auth (email + mot de passe)
- **Row Level Security** : chaque table est protégée, les utilisateurs ne voient que ce qu'ils ont le droit de voir
- **Logs d'audit** : toutes les actions sont enregistrées avec l'utilisateur et la date
- **HTTPS** : obligatoire via GitHub Pages (certificat auto)
- Pas de page d'inscription publique : **seul l'admin peut créer des comptes**

---

## 🔧 Fonctionnalités principales

| Fonctionnalité | Description |
|---|---|
| 📷 Scanner QR | Caméra en temps réel + saisie manuelle |
| 📦 Enregistrement | Objet inconnu → formulaire de création |
| 🔄 Prêt | Objet libre → prêt avec autocomplétion |
| ✅ Restitution | Objet prêté → restitution avec rappel du lieu |
| 🏷 Génération QR | Page A4 imprimable, label haut/bas |
| 👤 Comptes | Création par admin uniquement |
| 📋 Logs | Journal complet des actions |
| 📱 PWA | Installable comme app native |

---

## ❓ Dépannage

**La caméra ne s'ouvre pas**
→ Le site doit être en HTTPS. GitHub Pages l'assure automatiquement.

**Erreur de connexion à Supabase**
→ Vérifiez que `SUPABASE_URL` et `SUPABASE_ANON_KEY` sont corrects dans `config.js`.

**La création de compte ne fonctionne pas**
→ La création d'utilisateurs via `auth.admin` nécessite une **Service Role Key** côté serveur. Alternative : créez les comptes directement dans le dashboard Supabase > Authentication > Users, puis insérez manuellement le profil.

**Alternative pour la création de comptes** :
```sql
-- Dans Supabase SQL Editor, après avoir créé l'utilisateur dans Auth :
INSERT INTO profiles (id, username, full_name, role)
VALUES ('UUID_DU_NOUVEL_UTILISATEUR', 'username', 'Nom Prénom', 'user');
```

---

## 📞 Support

Pour toute question, consultez :
- [Supabase Docs](https://supabase.com/docs)
- [GitHub Pages Docs](https://docs.github.com/en/pages)
