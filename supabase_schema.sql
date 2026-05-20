-- ============================================================
-- SCHEMA SUPABASE - Système de gestion d'inventaire judiciaire
-- ============================================================

-- Extension pour UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE: profiles (comptes utilisateurs)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: items (objets)
-- ============================================================
CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  qr_code TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  description TEXT,
  storage_location TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'loaned')),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: loans (prêts)
-- ============================================================
CREATE TABLE IF NOT EXISTS loans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  loaned_to TEXT NOT NULL,
  loan_date DATE NOT NULL DEFAULT CURRENT_DATE,
  judicial_operation TEXT,
  notes TEXT,
  returned_at TIMESTAMPTZ,
  return_notes TEXT,
  returned_by UUID REFERENCES profiles(id),
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: audit_logs (logs d'audit)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  username TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: known_persons (personnes connues - autocomplétion)
-- ============================================================
CREATE TABLE IF NOT EXISTS known_persons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: judicial_operations (opérations judiciaires - autocomplétion)
-- ============================================================
CREATE TABLE IF NOT EXISTS judicial_operations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TRIGGERS: updated_at auto-update
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_items_updated_at
  BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE known_persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE judicial_operations ENABLE ROW LEVEL SECURITY;

-- Profiles: lecture pour utilisateurs connectés, écriture admin seulement
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE TO authenticated
  USING (
    id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Items: lecture/écriture pour tous les connectés
CREATE POLICY "items_all" ON items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Loans: lecture/écriture pour tous les connectés
CREATE POLICY "loans_all" ON loans
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Audit logs: insertion pour tous, lecture admin seulement
CREATE POLICY "audit_insert" ON audit_logs
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "audit_select" ON audit_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR user_id = auth.uid()
  );

-- Known persons: lecture/écriture pour tous les connectés
CREATE POLICY "persons_all" ON known_persons
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Judicial operations: lecture/écriture pour tous les connectés
CREATE POLICY "operations_all" ON judicial_operations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- FONCTION: créer un profil admin initial
-- Exécuter après avoir créé le premier utilisateur dans Auth
-- Remplacer 'USER_UUID' par l'UUID réel de l'utilisateur
-- ============================================================
-- INSERT INTO profiles (id, username, full_name, role)
-- VALUES ('USER_UUID', 'admin', 'Administrateur', 'admin');
