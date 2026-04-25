-- ============================================================
-- ASK BOTANIQUE — SCHEMA MIGRATION v4 (MARKETPLACE LAYER)
-- Purpose: nursery directory, inventory, RFQ engine, professional directory.
-- Non-breaking: additive tables only.
-- ============================================================

-- 1) NURSERIES ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nurseries (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- set when nursery self-onboards
  name                TEXT NOT NULL,
  slug                TEXT UNIQUE NOT NULL,                               -- URL-safe: muthaiga-nurseries
  description         TEXT,
  phone               TEXT,
  whatsapp            TEXT,                                               -- primary contact in Kenya
  email               TEXT,
  website             TEXT,
  address             TEXT,
  county              TEXT,                                               -- e.g., 'Nairobi', 'Kiambu'
  geo_region_id       UUID REFERENCES geo_regions(id),
  location_lat        DOUBLE PRECISION,
  location_lng        DOUBLE PRECISION,
  specialties         TEXT[],                                             -- ['indigenous', 'succulents', 'trees', 'grasses']
  delivery_counties   TEXT[],                                             -- counties they can deliver to
  min_order_kes       INT,                                                -- minimum order value in KES
  is_verified         BOOLEAN NOT NULL DEFAULT false,                     -- admin-verified nursery
  is_active           BOOLEAN NOT NULL DEFAULT true,
  profile_image_url   TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nurseries_county     ON nurseries (county);
CREATE INDEX IF NOT EXISTS idx_nurseries_verified   ON nurseries (is_verified, is_active);
CREATE INDEX IF NOT EXISTS idx_nurseries_geo_region ON nurseries (geo_region_id);

-- 2) NURSERY INVENTORY ──────────────────────────────────────────────────────
-- Links nurseries to plants in the DB with pricing and availability.
CREATE TABLE IF NOT EXISTS nursery_inventory (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nursery_id          UUID NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  plant_id            UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  quantity_available  INT NOT NULL DEFAULT 0,
  price_kes           INT,                                                -- price per unit in KES
  price_unit          TEXT NOT NULL DEFAULT 'seedling',                  -- 'seedling'|'sapling'|'mature'|'cutting'|'per_m2'|'per_kg'
  container_size      TEXT,                                               -- '5L bag', '20L bag', '50L bag', 'ground'
  is_available        BOOLEAN NOT NULL DEFAULT true,
  lead_time_days      INT,                                                -- days to source if out of stock
  seasonal_note       TEXT,                                               -- e.g., 'Available June–Sept only'
  last_updated        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (nursery_id, plant_id, price_unit)
);

CREATE INDEX IF NOT EXISTS idx_nursery_inventory_plant    ON nursery_inventory (plant_id, is_available);
CREATE INDEX IF NOT EXISTS idx_nursery_inventory_nursery  ON nursery_inventory (nursery_id);

-- 3) PROFESSIONALS DIRECTORY ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS professionals (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES profiles(id) ON DELETE SET NULL,
  business_name       TEXT NOT NULL,
  slug                TEXT UNIQUE NOT NULL,
  professional_type   TEXT NOT NULL,                                      -- 'landscape_architect'|'contractor'|'consultant'|'botanist'|'nursery_owner'
  bio                 TEXT,
  phone               TEXT,
  whatsapp            TEXT,
  email               TEXT,
  website             TEXT,
  counties_served     TEXT[],
  geo_region_id       UUID REFERENCES geo_regions(id),
  specialties         TEXT[],                                             -- ['indigenous_planting','water_features','asal_landscapes','rooftop_gardens']
  years_experience    INT,
  profile_image_url   TEXT,
  portfolio_urls      TEXT[],                                             -- links to project photos
  certifications      TEXT[],                                             -- e.g., ['KILA member', 'Eco-certified']
  min_project_kes     INT,                                                -- minimum project size
  is_verified         BOOLEAN NOT NULL DEFAULT false,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_professionals_type     ON professionals (professional_type, is_active);
CREATE INDEX IF NOT EXISTS idx_professionals_verified ON professionals (is_verified, is_active);
CREATE INDEX IF NOT EXISTS idx_professionals_county   ON professionals USING GIN (counties_served);

-- 4) PROJECT BRIEFS ──────────────────────────────────────────────────────────
-- Posted by clients (homeowners, developers, hotels). AI-parsed, then matched to professionals.
CREATE TABLE IF NOT EXISTS project_briefs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  title               TEXT NOT NULL,
  description         TEXT,
  project_type        TEXT,                                               -- 'residential'|'commercial'|'hotel'|'municipal'|'estate'
  county              TEXT,
  geo_region_id       UUID REFERENCES geo_regions(id),
  area_sqm            INT,
  budget_kes_min      INT,
  budget_kes_max      INT,
  preferred_start     DATE,
  requirements        JSONB,                                              -- AI-parsed conditions: rainfall, soil, style, etc.
  suggested_plants    JSONB,                                              -- AI-generated preliminary plant list
  status              TEXT NOT NULL DEFAULT 'open',                       -- 'open'|'matched'|'in_progress'|'completed'|'cancelled'
  is_public           BOOLEAN NOT NULL DEFAULT false,                     -- visible to all pros vs. invited only
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_briefs_status ON project_briefs (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_briefs_county ON project_briefs (county, status);

-- 5) PROJECT APPLICATIONS ────────────────────────────────────────────────────
-- Professionals apply to project briefs.
CREATE TABLE IF NOT EXISTS project_applications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id            UUID NOT NULL REFERENCES project_briefs(id) ON DELETE CASCADE,
  professional_id     UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  cover_note          TEXT,
  proposed_budget_kes INT,
  status              TEXT NOT NULL DEFAULT 'pending',                    -- 'pending'|'shortlisted'|'accepted'|'declined'
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (brief_id, professional_id)
);

CREATE INDEX IF NOT EXISTS idx_project_applications_brief ON project_applications (brief_id, status);

-- 6) RFQ REQUESTS ────────────────────────────────────────────────────────────
-- A structured plant order request generated from a chat/recommendation session.
CREATE TABLE IF NOT EXISTS rfq_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_user_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  project_brief_id    UUID REFERENCES project_briefs(id) ON DELETE SET NULL,  -- optional link
  project_name        TEXT,
  delivery_county     TEXT,
  delivery_date       DATE,
  total_budget_kes    INT,
  status              TEXT NOT NULL DEFAULT 'draft',                     -- 'draft'|'sent'|'quoted'|'accepted'|'cancelled'
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7) RFQ LINE ITEMS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rfq_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id              UUID NOT NULL REFERENCES rfq_requests(id) ON DELETE CASCADE,
  plant_id            UUID NOT NULL REFERENCES plants(id),
  quantity            INT NOT NULL,
  price_unit          TEXT NOT NULL DEFAULT 'seedling',
  notes               TEXT
);

CREATE INDEX IF NOT EXISTS idx_rfq_items_rfq ON rfq_items (rfq_id);

-- 8) RFQ RESPONSES (per nursery) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rfq_responses (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id              UUID NOT NULL REFERENCES rfq_requests(id) ON DELETE CASCADE,
  nursery_id          UUID NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  status              TEXT NOT NULL DEFAULT 'pending',                   -- 'pending'|'quoted'|'declined'|'accepted'
  total_quoted_kes    INT,
  valid_until         DATE,
  delivery_lead_days  INT,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rfq_id, nursery_id)
);

CREATE INDEX IF NOT EXISTS idx_rfq_responses_rfq     ON rfq_responses (rfq_id, status);
CREATE INDEX IF NOT EXISTS idx_rfq_responses_nursery ON rfq_responses (nursery_id, status);

-- 9) RFQ RESPONSE LINE ITEMS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rfq_response_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_response_id     UUID NOT NULL REFERENCES rfq_responses(id) ON DELETE CASCADE,
  plant_id            UUID NOT NULL REFERENCES plants(id),
  quantity_available  INT NOT NULL,
  unit_price_kes      INT NOT NULL,
  container_size      TEXT,
  notes               TEXT
);

CREATE INDEX IF NOT EXISTS idx_rfq_response_items_response ON rfq_response_items (rfq_response_id);

-- 10) REVIEWS ────────────────────────────────────────────────────────────────
-- Clients review nurseries and professionals after a transaction.
CREATE TABLE IF NOT EXISTS reviews (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_user_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  target_type         TEXT NOT NULL,                                      -- 'nursery' | 'professional'
  target_id           UUID NOT NULL,                                      -- nursery_id or professional_id
  rating              INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title               TEXT,
  body                TEXT,
  project_brief_id    UUID REFERENCES project_briefs(id) ON DELETE SET NULL,
  is_verified         BOOLEAN NOT NULL DEFAULT false,                     -- verified purchase/project
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_target ON reviews (target_type, target_id, rating DESC);

-- ============================================================
-- RLS: enable on all new tables (policies added separately)
-- ============================================================
ALTER TABLE nurseries              ENABLE ROW LEVEL SECURITY;
ALTER TABLE nursery_inventory      ENABLE ROW LEVEL SECURITY;
ALTER TABLE professionals          ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_briefs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_applications   ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfq_requests           ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfq_items              ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfq_responses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfq_response_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews                ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- End migration v4
-- NOTE: RLS is enabled above but no policies are attached.
-- Policies are added in migration_v7_marketplace_rls.sql.
-- ============================================================
