-- ============================================================
-- ASK BOTANIQUE — SCHEMA MIGRATION v2
-- Extends plants table for 5,000-species scale + curation workflow
-- Run once in Supabase SQL editor
-- All changes are non-breaking (nullable columns, no drops)
-- ============================================================

-- ── Rainfall range (used by scoring engine) ──────────────────
ALTER TABLE plants ADD COLUMN IF NOT EXISTS min_rainfall      INT;
ALTER TABLE plants ADD COLUMN IF NOT EXISTS max_rainfall      INT;

-- ── Height range (replaces single max_height_cm) ─────────────
ALTER TABLE plants ADD COLUMN IF NOT EXISTS min_height_cm     INT;
-- max_height_cm already exists in original schema

-- ── Soil types array (replaces junction table for scoring) ───
ALTER TABLE plants ADD COLUMN IF NOT EXISTS soil_types        TEXT[];

-- ── Native/origin flag (scoring engine bonus) ────────────────
ALTER TABLE plants ADD COLUMN IF NOT EXISTS native_to_region  BOOLEAN DEFAULT false;
ALTER TABLE plants ADD COLUMN IF NOT EXISTS origin            TEXT;   -- 'indigenous' | 'exotic' | 'naturalised' | 'invasive'

-- ── Multi-function tags ───────────────────────────────────────
-- e.g. ['shade tree','indigenous','hardwood','medicinal','wildlife']
ALTER TABLE plants ADD COLUMN IF NOT EXISTS functions         TEXT[];

-- ── Taxonomy tags (multi-tag, not single category_id) ─────────
-- Allows a plant to be tagged as both 'tree' and 'medicinal' and 'indigenous'
ALTER TABLE plants ADD COLUMN IF NOT EXISTS tags              TEXT[];
-- Tag vocabulary (for reference — enforce in app, not DB):
--   Broad form: tree | shrub | groundcover | grass | palm | climber | succulent
--              | herb | aquatic | air-plant | bamboo | fern | cycad | annual
--              | perennial | biennial
--   Use: medicinal | fruit | herb-spice | indigenous | exotic | naturalised
--        | invasive | hardwood | softwood | hedge | windbreak | shade
--        | ornamental | wildlife | erosion-control | bioswale | indoor
--        | drought-tolerant | edible | bee-friendly | dye | timber | fuel

-- ── Local names ───────────────────────────────────────────────
ALTER TABLE plants ADD COLUMN IF NOT EXISTS swahili_names     TEXT[];
ALTER TABLE plants ADD COLUMN IF NOT EXISTS local_names       JSONB;
-- local_names format: {"kikuyu": "Mukuyu", "luo": "...", "kamba": "..."}

-- ── Images (may already exist — IF NOT EXISTS guards it) ──────
ALTER TABLE plants ADD COLUMN IF NOT EXISTS image_url         TEXT;
ALTER TABLE plants ADD COLUMN IF NOT EXISTS thumbnail_url     TEXT;
ALTER TABLE plants ADD COLUMN IF NOT EXISTS image_credits     TEXT;

-- ── Curation workflow ─────────────────────────────────────────
ALTER TABLE plants ADD COLUMN IF NOT EXISTS review_status     TEXT NOT NULL DEFAULT 'approved';
-- Values: 'draft' (AI-generated, pending review)
--         'approved' (reviewed and live)
--         'rejected' (not valid / insufficient data)

ALTER TABLE plants ADD COLUMN IF NOT EXISTS source_refs       TEXT[];
-- e.g. ['B13601 p.47', 'beyondforest.org', 'gardeningkenya.org']

ALTER TABLE plants ADD COLUMN IF NOT EXISTS curated_by        TEXT;   -- who submitted
ALTER TABLE plants ADD COLUMN IF NOT EXISTS reviewed_at       TIMESTAMPTZ;

-- ── Kenya-specific ecological data ───────────────────────────
ALTER TABLE plants ADD COLUMN IF NOT EXISTS altitude_min_m    INT;    -- minimum altitude (metres)
ALTER TABLE plants ADD COLUMN IF NOT EXISTS altitude_max_m    INT;    -- maximum altitude
ALTER TABLE plants ADD COLUMN IF NOT EXISTS native_regions     TEXT[];
-- e.g. ['Mt. Kenya', 'Aberdares', 'Coast', 'Rift Valley', 'Western Kenya',
--        'Arid North', 'Central Highlands', 'Lake Victoria Basin']

-- ── Chat/search helper (populate via trigger or manual update) ─
-- Note: GENERATED ALWAYS AS rejected for array functions in PG.
-- Populate with: UPDATE plants SET search_text = scientific_name || ' ' ||
--   COALESCE(array_to_string(common_names,' '),'') || ' ' ||
--   COALESCE(array_to_string(swahili_names,' '),'') || ' ' ||
--   COALESCE(array_to_string(tags,' '),'');
ALTER TABLE plants ADD COLUMN IF NOT EXISTS search_text       TEXT;

-- ── Indexes for new columns ───────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_plants_tags         ON plants USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_plants_functions    ON plants USING GIN(functions);
CREATE INDEX IF NOT EXISTS idx_plants_soil_types   ON plants USING GIN(soil_types);
CREATE INDEX IF NOT EXISTS idx_plants_swahili      ON plants USING GIN(swahili_names);
CREATE INDEX IF NOT EXISTS idx_plants_origin       ON plants (origin);
CREATE INDEX IF NOT EXISTS idx_plants_review       ON plants (review_status);
CREATE INDEX IF NOT EXISTS idx_plants_rainfall     ON plants (min_rainfall, max_rainfall);
CREATE INDEX IF NOT EXISTS idx_plants_search_text  ON plants USING GIN(to_tsvector('english', COALESCE(search_text, '')));

-- ── Update plants_searchable view to include new fields ───────
-- Drop and recreate the searchable view to add swahili/tags to search
DROP VIEW IF EXISTS plants_searchable;
CREATE VIEW plants_searchable AS
SELECT
  p.*,
  p.scientific_name || ' ' ||
  COALESCE(array_to_string(p.common_names, ' '), '') || ' ' ||
  COALESCE(array_to_string(p.swahili_names, ' '), '') || ' ' ||
  COALESCE(array_to_string(p.tags, ' '), '') AS common_names_text
FROM plants p
WHERE p.review_status = 'approved';

-- ── Backfill: tag existing plants from their category ─────────
-- (Converts the single category_id into the tags array for existing records)
UPDATE plants p
SET tags = ARRAY[LOWER(c.name)]
FROM plant_categories c
WHERE p.category_id = c.id
  AND (p.tags IS NULL OR p.tags = '{}');

-- ============================================================
-- DONE — all existing data intact, new columns nullable
-- ============================================================
