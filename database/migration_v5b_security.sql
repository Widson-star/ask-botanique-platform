-- ============================================================
-- ASK BOTANIQUE — MIGRATION v5b (SECURITY PATCH) — REVISED
-- Fixes 8 critical errors flagged by Supabase Security Advisor.
-- SAFE TO RUN even if previous attempts partially ran.
-- Uses ALTER VIEW ... SET (security_invoker = on) to avoid
-- syntax issues with the WITH(...) AS SELECT inline form.
-- ============================================================

-- ── 1. Recreate plants_searchable (safe whether it exists or not) ──
DROP VIEW IF EXISTS public.plants_searchable;

CREATE VIEW public.plants_searchable AS
SELECT
  p.*,
  p.scientific_name || ' ' ||
  COALESCE(array_to_string(p.common_names, ' '), '') || ' ' ||
  COALESCE(array_to_string(p.swahili_names, ' '), '') || ' ' ||
  COALESCE(array_to_string(p.tags, ' '), '') AS common_names_text
FROM plants p
WHERE p.review_status = 'approved';

ALTER VIEW public.plants_searchable SET (security_invoker = on);

-- ── 2. Recreate public_stats (safe whether it exists or not) ──────
DROP VIEW IF EXISTS public.public_stats;

CREATE VIEW public.public_stats AS
SELECT
  (SELECT COUNT(*)::INT FROM plants WHERE review_status = 'approved') AS approved_species_count,
  (SELECT COUNT(*)::INT FROM plants) AS total_species_count;

ALTER VIEW public.public_stats SET (security_invoker = on);

-- ── 3. Enable RLS on 6 tables that were missing it ────────────────

ALTER TABLE public.vocab_terms             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plant_evidence          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plant_change_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plant_duplicates        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_regions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plant_region_occurrence ENABLE ROW LEVEL SECURITY;

-- ── 4. Define access policies ─────────────────────────────────────

-- vocab_terms: public read (needed for /explore filter chips), admin writes via service_role
DROP POLICY IF EXISTS "vocab_terms_public_read" ON public.vocab_terms;
CREATE POLICY "vocab_terms_public_read"
  ON public.vocab_terms FOR SELECT
  USING (is_active = true);

-- plant_evidence: public read (source citations are reference data)
DROP POLICY IF EXISTS "plant_evidence_public_read" ON public.plant_evidence;
CREATE POLICY "plant_evidence_public_read"
  ON public.plant_evidence FOR SELECT
  USING (true);

-- plant_change_log: no public policy = no access for anon/authenticated
-- (internal audit trail, service_role only)

-- plant_duplicates: no public policy = no access for anon/authenticated
-- (internal curation queue, service_role only)

-- geo_regions: public read (reference data for location filtering)
DROP POLICY IF EXISTS "geo_regions_public_read" ON public.geo_regions;
CREATE POLICY "geo_regions_public_read"
  ON public.geo_regions FOR SELECT
  USING (true);

-- plant_region_occurrence: public read (used by /explore zone filter)
DROP POLICY IF EXISTS "plant_region_occurrence_public_read" ON public.plant_region_occurrence;
CREATE POLICY "plant_region_occurrence_public_read"
  ON public.plant_region_occurrence FOR SELECT
  USING (true);

-- ============================================================
-- End migration v5b — all 8 security advisor errors resolved.
-- ============================================================
