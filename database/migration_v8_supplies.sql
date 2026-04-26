-- ============================================================
-- MIGRATION v8 — Garden Supplies Marketplace
-- Ask Botanique Platform
-- Date: 2026-04-26
-- Applies: suppliers table, products table, RLS policies,
--          indexes, updated_at triggers
-- ============================================================

-- ── 1) SUPPLIERS ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS suppliers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name              TEXT NOT NULL,
  slug              TEXT UNIQUE NOT NULL,
  description       TEXT,
  county            TEXT,
  categories        TEXT[],          -- ['pots','irrigation','pesticides',...]
  phone             TEXT,
  whatsapp          TEXT,
  email             TEXT,
  website           TEXT,
  is_verified       BOOLEAN NOT NULL DEFAULT false,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_active    ON suppliers (is_active, is_verified);
CREATE INDEX IF NOT EXISTS idx_suppliers_county    ON suppliers (county) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_suppliers_categories ON suppliers USING GIN (categories);
CREATE INDEX IF NOT EXISTS idx_suppliers_slug      ON suppliers (slug);

-- ── 2) PRODUCTS ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS products (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id       UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  category          TEXT NOT NULL,
  -- category values: 'pots' | 'irrigation' | 'pesticides' | 'fertilizer' | 'tools' | 'structures'
  subcategory       TEXT,
  -- examples: 'concrete pot' | 'drip line' | 'insecticide' | 'organic compost' | 'pruner'
  description       TEXT,
  price_kes         NUMERIC CHECK (price_kes >= 0),
  price_unit        TEXT DEFAULT 'each',
  -- price_unit values: 'each' | 'per_m' | 'per_kg' | 'per_bag' | 'per_roll' | 'per_litre' | 'per_set'
  material          TEXT,
  -- for pots: 'concrete' | 'plastic' | 'ceramic' | 'terracotta' | 'wood' | 'fibreglass' | 'grow_bag' | 'hanging_basket'
  size_options      TEXT[],          -- e.g. ['6 inch','10 inch','15 inch','20 inch'] or ['5L','10L','20L']
  image_urls        TEXT[],
  in_stock          BOOLEAN NOT NULL DEFAULT true,
  sort_order        INT DEFAULT 0,   -- supplier can pin featured products
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_supplier   ON products (supplier_id, in_stock);
CREATE INDEX IF NOT EXISTS idx_products_category   ON products (category, in_stock);
CREATE INDEX IF NOT EXISTS idx_products_material   ON products (material) WHERE material IS NOT NULL;

-- ── 3) UPDATED_AT TRIGGERS ───────────────────────────────────

-- Reuse the set_updated_at function created in migration_v7
-- (safe to re-create if it doesn't exist)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_suppliers_updated_at ON suppliers;
CREATE TRIGGER trg_suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 4) ROW LEVEL SECURITY ─────────────────────────────────────

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products  ENABLE ROW LEVEL SECURITY;

-- Suppliers: anyone can read active suppliers
DROP POLICY IF EXISTS suppliers_public_read   ON suppliers;
CREATE POLICY suppliers_public_read ON suppliers
  FOR SELECT USING (is_active = true);

-- Suppliers: only owner can insert / update / delete
DROP POLICY IF EXISTS suppliers_owner_insert  ON suppliers;
CREATE POLICY suppliers_owner_insert ON suppliers
  FOR INSERT WITH CHECK (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS suppliers_owner_update  ON suppliers;
CREATE POLICY suppliers_owner_update ON suppliers
  FOR UPDATE USING (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS suppliers_owner_delete  ON suppliers;
CREATE POLICY suppliers_owner_delete ON suppliers
  FOR DELETE USING (auth.uid() = owner_user_id);

-- Products: anyone can read products belonging to active suppliers
DROP POLICY IF EXISTS products_public_read    ON products;
CREATE POLICY products_public_read ON products
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM suppliers s
      WHERE s.id = products.supplier_id
        AND s.is_active = true
    )
  );

-- Products: only the supplier owner can write
DROP POLICY IF EXISTS products_owner_insert   ON products;
CREATE POLICY products_owner_insert ON products
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM suppliers s
      WHERE s.id = products.supplier_id
        AND s.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS products_owner_update   ON products;
CREATE POLICY products_owner_update ON products
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM suppliers s
      WHERE s.id = products.supplier_id
        AND s.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS products_owner_delete   ON products;
CREATE POLICY products_owner_delete ON products
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM suppliers s
      WHERE s.id = products.supplier_id
        AND s.owner_user_id = auth.uid()
    )
  );

-- ── 5) VOCAB REFERENCE (comment only — enforced in app layer) ─
-- category:    pots | irrigation | pesticides | fertilizer | tools | structures
-- material:    concrete | plastic | ceramic | terracotta | wood | fibreglass | grow_bag | hanging_basket
-- price_unit:  each | per_m | per_kg | per_bag | per_roll | per_litre | per_set
-- ─────────────────────────────────────────────────────────────
