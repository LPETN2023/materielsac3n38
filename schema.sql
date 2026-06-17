-- ============================================================
-- SCHÉMA BASE DE DONNÉES - Gestion matériel AC3N38
-- Généré à partir du schéma réel Supabase
-- À exécuter dans Supabase > SQL Editor
-- ============================================================


-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================
-- SÉCURITÉ : Restriction du domaine email à l'inscription
-- ============================================================
CREATE OR REPLACE FUNCTION auth.check_email_domain()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email NOT LIKE '%@gendarmerie.interieur.gouv.fr' THEN
    RAISE EXCEPTION 'Inscription non autorisée pour ce domaine email.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER enforce_email_domain
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION auth.check_email_domain();


-- ============================================================
-- FONCTIONS
-- ============================================================

-- Mise à jour automatique du champ updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Incrémente le compteur d'utilisation d'une personne connue
CREATE OR REPLACE FUNCTION public.increment_person_count(person_name TEXT)
RETURNS VOID AS $$
  UPDATE known_persons SET usage_count = usage_count + 1 WHERE name = person_name;
$$ LANGUAGE sql;


-- ============================================================
-- TABLE : profiles
-- Liée à auth.users de Supabase (même UUID)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    TEXT        NOT NULL UNIQUE,
  full_name   TEXT        NOT NULL,
  role        TEXT        NOT NULL DEFAULT 'user',
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ============================================================
-- TABLE : item_types
-- Types de matériel avec leur code diminutif (ex: SSD, PHONE)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.item_types (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT        NOT NULL UNIQUE,
  code        VARCHAR(8),
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Codes par type (appliqués après insertion de vos types)
UPDATE public.item_types SET code = 'PC'    WHERE name ILIKE '%ordinateur%';
UPDATE public.item_types SET code = 'PHONE' WHERE name ILIKE '%téléphone%' OR name ILIKE '%telephone%' OR name ILIKE '%smartphone%';
UPDATE public.item_types SET code = 'TAB'   WHERE name ILIKE '%tablette%';
UPDATE public.item_types SET code = 'CAM'   WHERE name ILIKE '%photo%' OR name ILIKE '%caméra%' OR name ILIKE '%camera%';
UPDATE public.item_types SET code = 'HDD'   WHERE name ILIKE '%disque dur%';
UPDATE public.item_types SET code = 'SSD'   WHERE name ILIKE '%ssd%';
UPDATE public.item_types SET code = 'USB'   WHERE name ILIKE '%usb%';
UPDATE public.item_types SET code = 'GPS'   WHERE name ILIKE '%gps%';
UPDATE public.item_types SET code = 'AUDIO' WHERE name ILIKE '%audio%' OR name ILIKE '%enregistreur%';
UPDATE public.item_types SET code = 'PRINT' WHERE name ILIKE '%imprimante%';
UPDATE public.item_types SET code = 'SCAN'  WHERE name ILIKE '%scanner%';
UPDATE public.item_types SET code = 'DRONE' WHERE name ILIKE '%drone%';
UPDATE public.item_types SET code = 'RADIO' WHERE name ILIKE '%radio%';
UPDATE public.item_types SET code = 'DIV'   WHERE name ILIKE '%autre%';
-- Fallback : 4 premières lettres pour les types non reconnus
UPDATE public.item_types SET code = UPPER(LEFT(REGEXP_REPLACE(name, '[^a-zA-Z]', '', 'g'), 4))
WHERE code IS NULL OR code = '';


-- ============================================================
-- TABLE : items
-- Matériels enregistrés
-- ============================================================
CREATE TABLE IF NOT EXISTS public.items (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  qr_code           TEXT        NOT NULL UNIQUE,
  type              TEXT        NOT NULL,
  brand             TEXT,
  model             TEXT,
  description       TEXT,
  storage_location  TEXT,
  status            TEXT        NOT NULL DEFAULT 'available',
  is_loanable       BOOLEAN     NOT NULL DEFAULT true,
  created_by        UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by_name   TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER trg_items_updated_at
  BEFORE UPDATE ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ============================================================
-- TABLE : loans
-- Prêts de matériel
-- ============================================================
CREATE TABLE IF NOT EXISTS public.loans (
  id                   UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id              UUID        NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  loaned_to            TEXT        NOT NULL,
  loan_date            DATE        NOT NULL DEFAULT CURRENT_DATE,
  expected_return_date DATE,
  judicial_operation   TEXT,
  notes                TEXT,
  returned_at          TIMESTAMPTZ,
  return_notes         TEXT,
  returned_by          UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  returned_by_name     TEXT,
  created_by           UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by_name      TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================
-- TABLE : audit_logs
-- Historique de toutes les actions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  username     TEXT,
  action       TEXT        NOT NULL,
  entity_type  TEXT,
  entity_id    TEXT,
  details      JSONB,
  ip_address   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================
-- TABLE : known_persons
-- Personnes connues pour l'autocomplétion des prêts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.known_persons (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT        NOT NULL UNIQUE,
  usage_count  INTEGER     NOT NULL DEFAULT 1,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================
-- TABLE : judicial_operations
-- Opérations judiciaires pour l'autocomplétion
-- ============================================================
CREATE TABLE IF NOT EXISTS public.judicial_operations (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT        NOT NULL UNIQUE,
  usage_count  INTEGER     NOT NULL DEFAULT 1,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE public.profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_types          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.known_persons       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.judicial_operations ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- profiles
-- ----------------------------------------
-- Tout le monde peut lire les profils
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (true);

-- Admin peut créer n'importe quel profil ; un utilisateur peut créer le sien (role=user uniquement)
CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT WITH CHECK (
    (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
    OR (id = auth.uid() AND role = 'user')
  );

-- Chacun peut modifier son propre profil ; admin peut modifier tous les profils
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE USING (
    (id = auth.uid())
    OR (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  );

-- ----------------------------------------
-- item_types
-- ----------------------------------------
CREATE POLICY "item_types_select" ON public.item_types
  FOR SELECT USING (true);

CREATE POLICY "item_types_insert" ON public.item_types
  FOR INSERT WITH CHECK (true);

CREATE POLICY "item_types_update" ON public.item_types
  FOR UPDATE USING (true);

CREATE POLICY "item_types_delete" ON public.item_types
  FOR DELETE USING (true);

-- ----------------------------------------
-- items
-- ----------------------------------------
CREATE POLICY "items_all" ON public.items
  FOR ALL USING (true) WITH CHECK (true);

-- ----------------------------------------
-- loans
-- ----------------------------------------
CREATE POLICY "loans_all" ON public.loans
  FOR ALL USING (true) WITH CHECK (true);

-- ----------------------------------------
-- audit_logs
-- ----------------------------------------
-- Insertion libre ; lecture pour admin ou pour ses propres logs
CREATE POLICY "audit_insert" ON public.audit_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "audit_select" ON public.audit_logs
  FOR SELECT USING (
    (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
    OR (user_id = auth.uid())
  );

-- ----------------------------------------
-- known_persons
-- ----------------------------------------
CREATE POLICY "persons_all" ON public.known_persons
  FOR ALL USING (true) WITH CHECK (true);

-- ----------------------------------------
-- judicial_operations
-- ----------------------------------------
CREATE POLICY "operations_all" ON public.judicial_operations
  FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- APRÈS INSTALLATION
-- ============================================================
-- 1. Créer le premier compte via Supabase > Authentication > Users
--    (email obligatoirement @gendarmerie.interieur.gouv.fr)
-- 2. Lui donner le rôle admin :
--    INSERT INTO profiles (id, username, full_name, role)
--    VALUES ('VOTRE_UUID_ICI', 'admin', 'Votre Nom', 'admin');
-- 3. Renseigner les item_types via l'interface Paramètres du site,
--    ou directement en SQL :
--    INSERT INTO public.item_types (name, code, sort_order) VALUES
--      ('Ordinateur portable', 'PCP',   1),
--      ('Téléphone',           'PHONE', 2),
--      ('Disque SSD',          'SSD',   3),
--      ('Divers',              'DIV',   99);
-- ============================================================
