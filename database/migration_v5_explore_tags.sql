-- ============================================================
-- ASK BOTANIQUE — SCHEMA MIGRATION v5 (EXPLORE / TAG VOCABULARY)
-- Purpose: add ecological_zone column + seed vocab_terms with
--          the full tag vocabulary used by /explore filter bar.
-- Non-breaking: additive only.
-- ============================================================

-- 1) Ecological zone — primary zone for filter chips ──────────
--    Derive from native_regions[] or set explicitly per species.
--    Values: 'highland' | 'coastal' | 'savanna' | 'semi-arid' | 'arid' | 'lakeside' | 'general'
ALTER TABLE plants ADD COLUMN IF NOT EXISTS ecological_zone TEXT;
CREATE INDEX IF NOT EXISTS idx_plants_ecological_zone ON plants (ecological_zone);

-- 2) Seed vocab_terms with the canonical tag vocabulary ───────
--    term_type = 'tag' covers the tags[] array values.
--    All slugs must match exactly what is stored in tags[].

INSERT INTO vocab_terms (term_type, slug, label, sort_order) VALUES
  -- Habit / form
  ('tag', 'tree',         'Tree',          10),
  ('tag', 'shrub',        'Shrub',         11),
  ('tag', 'groundcover',  'Groundcover',   12),
  ('tag', 'grass',        'Grass',         13),
  ('tag', 'palm',         'Palm',          14),
  ('tag', 'climber',      'Climber',       15),
  ('tag', 'succulent',    'Succulent',     16),
  ('tag', 'herb',         'Herb',          17),
  ('tag', 'aquatic',      'Aquatic',       18),
  ('tag', 'bamboo',       'Bamboo',        19),
  ('tag', 'fern',         'Fern',          20),
  ('tag', 'annual',       'Annual',        21),
  ('tag', 'perennial',    'Perennial',     22),
  -- Use / function
  ('tag', 'medicinal',       'Medicinal',       30),
  ('tag', 'fruit',           'Fruit-bearing',   31),
  ('tag', 'herb-spice',      'Herb & Spice',    32),
  ('tag', 'hedge',           'Hedge',           33),
  ('tag', 'windbreak',       'Windbreak',       34),
  ('tag', 'shade',           'Shade',           35),
  ('tag', 'ornamental',      'Ornamental',      36),
  ('tag', 'wildlife',        'Wildlife',        37),
  ('tag', 'erosion-control', 'Erosion Control', 38),
  ('tag', 'indoor',          'Indoor',          39),
  ('tag', 'edible',          'Edible',          40),
  ('tag', 'bee-friendly',    'Bee-friendly',    41),
  ('tag', 'timber',          'Timber',          42),
  ('tag', 'avenue',          'Avenue tree',     43),
  ('tag', 'flowering',       'Flowering',       44),
  ('tag', 'fragrant',        'Fragrant',        45),
  ('tag', 'cut-flower',      'Cut flower',      46),
  ('tag', 'drought-tolerant','Drought-tolerant',47),
  ('tag', 'fast-growing',    'Fast-growing',    48),
  ('tag', 'nitrogen-fixing', 'Nitrogen-fixing', 49),
  ('tag', 'agroforestry',    'Agroforestry',    50),
  -- Status / origin (mirrors origin column but searchable via tags too)
  ('tag', 'indigenous',   'Indigenous',    60),
  ('tag', 'exotic',       'Exotic',        61),
  ('tag', 'naturalised',  'Naturalised',   62),
  ('tag', 'invasive',     'Invasive',      63),
  ('tag', 'endangered',   'Endangered',    64)
ON CONFLICT (term_type, slug) DO NOTHING;

-- 3) Seed vocab_terms for ecological zones ────────────────────
INSERT INTO vocab_terms (term_type, slug, label, sort_order) VALUES
  ('ecological_zone', 'highland',   'Highlands',      1),
  ('ecological_zone', 'coastal',    'Coastal',        2),
  ('ecological_zone', 'savanna',    'Savanna',        3),
  ('ecological_zone', 'semi-arid',  'Semi-arid',      4),
  ('ecological_zone', 'arid',       'Arid / ASAL',    5),
  ('ecological_zone', 'lakeside',   'Lakeside',       6),
  ('ecological_zone', 'general',    'General / Wide', 7)
ON CONFLICT (term_type, slug) DO NOTHING;

-- 4) Seed vocab_terms for origin values ───────────────────────
INSERT INTO vocab_terms (term_type, slug, label, sort_order) VALUES
  ('origin', 'indigenous',  'Indigenous',   1),
  ('origin', 'exotic',      'Exotic',       2),
  ('origin', 'naturalised', 'Naturalised',  3),
  ('origin', 'invasive',    'Invasive',     4)
ON CONFLICT (term_type, slug) DO NOTHING;

-- 5) Backfill ecological_zone from native_regions where obvious ─
UPDATE plants SET ecological_zone = 'coastal'
WHERE ecological_zone IS NULL
  AND native_regions && ARRAY['Coast', 'Coastal', 'Mombasa', 'Kilifi', 'Kwale', 'Lamu', 'Tana River'];

UPDATE plants SET ecological_zone = 'highland'
WHERE ecological_zone IS NULL
  AND native_regions && ARRAY['Mt. Kenya', 'Aberdares', 'Nyandarua', 'Central Highlands', 'Nyeri', 'Meru', 'Kirinyaga', 'Limuru'];

UPDATE plants SET ecological_zone = 'arid'
WHERE ecological_zone IS NULL
  AND native_regions && ARRAY['Arid North', 'Turkana', 'Marsabit', 'Mandera', 'Wajir', 'Garissa'];

UPDATE plants SET ecological_zone = 'semi-arid'
WHERE ecological_zone IS NULL
  AND native_regions && ARRAY['Machakos', 'Kitui', 'Makueni', 'Kajiado', 'Narok', 'Rift Valley'];

UPDATE plants SET ecological_zone = 'lakeside'
WHERE ecological_zone IS NULL
  AND native_regions && ARRAY['Lake Victoria', 'Lake Basin', 'Western Kenya', 'Kisumu', 'Homa Bay', 'Siaya'];

UPDATE plants SET ecological_zone = 'savanna'
WHERE ecological_zone IS NULL
  AND native_regions && ARRAY['Savanna', 'Tsavo', 'Amboseli', 'Maasai Mara', 'Laikipia'];

-- Anything still unset gets 'general'
UPDATE plants SET ecological_zone = 'general'
WHERE ecological_zone IS NULL;

-- 6) Expose plant count to frontend via a simple stats view ───
-- Note: nurseries excluded — that table has RLS with no public policy.
-- security_invoker = true is set in migration_v5b_security.sql.
CREATE OR REPLACE VIEW public_stats AS
SELECT
  (SELECT COUNT(*)::INT FROM plants WHERE review_status = 'approved') AS approved_species_count,
  (SELECT COUNT(*)::INT FROM plants)                                   AS total_species_count;

-- ============================================================
-- End migration v5
-- ============================================================
