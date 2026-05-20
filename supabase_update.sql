-- ============================================================
-- MISE À JOUR SCHÉMA - À exécuter dans Supabase SQL Editor
-- ============================================================

-- Date de restitution prévue sur les prêts
ALTER TABLE loans ADD COLUMN IF NOT EXISTS expected_return_date DATE;

-- Types de matériels configurables
CREATE TABLE IF NOT EXISTS item_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE item_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "item_types_select" ON item_types
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "item_types_insert" ON item_types
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "item_types_update" ON item_types
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "item_types_delete" ON item_types
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Types par défaut
INSERT INTO item_types (name, sort_order) VALUES
  ('Ordinateur portable', 1),
  ('Ordinateur fixe', 2),
  ('Téléphone', 3),
  ('Tablette', 4),
  ('Appareil photo', 5),
  ('Caméra', 6),
  ('Disque dur', 7),
  ('Clé USB', 8),
  ('GPS', 9),
  ('Enregistreur audio', 10),
  ('Imprimante', 11),
  ('Scanner', 12),
  ('Autre', 99)
ON CONFLICT (name) DO NOTHING;
