-- ================================================================
-- ASK BOTANIQUE — MIGRATION v6: Tags normalisation + backfill
-- Purpose: Fix filter chips returning 0 results on /explore.
-- Root cause: multi-word tags ("flowering tree"), dirty synonyms
--   ("native", "nitrogen-fixer"), and functions[] data not
--   reflected in tags[].
-- Safe to re-run: every UPDATE checks NOT tags @> ARRAY[slug].
-- ================================================================

-- ── 1. Normalise dirty / multi-word tags already in tags[] ───

-- "flowering tree" / "flowering perennial" / "flower" → "flowering"
UPDATE plants SET tags = array_append(tags, 'flowering')
WHERE review_status = 'approved'
  AND (tags && ARRAY['flowering tree','flowering perennial','flower'])
  AND NOT tags @> ARRAY['flowering'];

-- "avenue tree" (in tags) → "avenue"
UPDATE plants SET tags = array_append(tags, 'avenue')
WHERE review_status = 'approved'
  AND tags @> ARRAY['avenue tree']
  AND NOT tags @> ARRAY['avenue'];

-- "specimen tree" (in tags) → "tree"
UPDATE plants SET tags = array_append(tags, 'tree')
WHERE review_status = 'approved'
  AND tags @> ARRAY['specimen tree']
  AND NOT tags @> ARRAY['tree'];

-- "native" → "indigenous"
UPDATE plants SET tags = array_append(tags, 'indigenous')
WHERE review_status = 'approved'
  AND tags @> ARRAY['native']
  AND NOT tags @> ARRAY['indigenous'];

-- "nitrogen-fixer" → "nitrogen-fixing"
UPDATE plants SET tags = array_append(tags, 'nitrogen-fixing')
WHERE review_status = 'approved'
  AND tags @> ARRAY['nitrogen-fixer']
  AND NOT tags @> ARRAY['nitrogen-fixing'];

-- "houseplant" → "indoor"
UPDATE plants SET tags = array_append(tags, 'indoor')
WHERE review_status = 'approved'
  AND tags @> ARRAY['houseplant']
  AND NOT tags @> ARRAY['indoor'];

-- "screening" (in tags) → "hedge"
UPDATE plants SET tags = array_append(tags, 'hedge')
WHERE review_status = 'approved'
  AND tags @> ARRAY['screening']
  AND NOT tags @> ARRAY['hedge'];


-- ── 2. Derive tags from functions[] ──────────────────────────
--   Handles ALL case variants (Ornamental/ornamental etc.)

-- flowering (flowering tree, flowering shrub, flowering perennial…)
UPDATE plants SET tags = array_append(tags, 'flowering')
WHERE review_status = 'approved'
  AND EXISTS (SELECT 1 FROM unnest(functions) fn WHERE lower(fn) LIKE '%flower%')
  AND NOT tags @> ARRAY['flowering'];

-- tree (specimen tree, shade tree, flowering tree, avenue tree…)
UPDATE plants SET tags = array_append(tags, 'tree')
WHERE review_status = 'approved'
  AND EXISTS (SELECT 1 FROM unnest(functions) fn WHERE lower(fn) LIKE '%tree%')
  AND NOT tags @> ARRAY['tree'];

-- shade (shade tree, Shade…)
UPDATE plants SET tags = array_append(tags, 'shade')
WHERE review_status = 'approved'
  AND EXISTS (SELECT 1 FROM unnest(functions) fn WHERE lower(fn) LIKE '%shade%')
  AND NOT tags @> ARRAY['shade'];

-- ornamental
UPDATE plants SET tags = array_append(tags, 'ornamental')
WHERE review_status = 'approved'
  AND EXISTS (SELECT 1 FROM unnest(functions) fn WHERE lower(fn) = 'ornamental')
  AND NOT tags @> ARRAY['ornamental'];

-- wildlife (wildlife habitat…)
UPDATE plants SET tags = array_append(tags, 'wildlife')
WHERE review_status = 'approved'
  AND EXISTS (SELECT 1 FROM unnest(functions) fn WHERE lower(fn) LIKE '%wildlife%')
  AND NOT tags @> ARRAY['wildlife'];

-- indoor (container, indoor decor, houseplant)
UPDATE plants SET tags = array_append(tags, 'indoor')
WHERE review_status = 'approved'
  AND EXISTS (SELECT 1 FROM unnest(functions) fn
              WHERE lower(fn) IN ('container','indoor decor','houseplant','indoor'))
  AND NOT tags @> ARRAY['indoor'];

-- hedge (screening, hedge, Hedge)
UPDATE plants SET tags = array_append(tags, 'hedge')
WHERE review_status = 'approved'
  AND EXISTS (SELECT 1 FROM unnest(functions) fn
              WHERE lower(fn) IN ('screening','hedge'))
  AND NOT tags @> ARRAY['hedge'];

-- medicinal
UPDATE plants SET tags = array_append(tags, 'medicinal')
WHERE review_status = 'approved'
  AND EXISTS (SELECT 1 FROM unnest(functions) fn WHERE lower(fn) = 'medicinal')
  AND NOT tags @> ARRAY['medicinal'];

-- erosion-control (erosion control, erosion…)
UPDATE plants SET tags = array_append(tags, 'erosion-control')
WHERE review_status = 'approved'
  AND EXISTS (SELECT 1 FROM unnest(functions) fn WHERE lower(fn) LIKE '%erosion%')
  AND NOT tags @> ARRAY['erosion-control'];

-- fruit (fruit tree, fruiting…)
UPDATE plants SET tags = array_append(tags, 'fruit')
WHERE review_status = 'approved'
  AND EXISTS (SELECT 1 FROM unnest(functions) fn WHERE lower(fn) LIKE '%fruit%')
  AND NOT tags @> ARRAY['fruit'];

-- groundcover
UPDATE plants SET tags = array_append(tags, 'groundcover')
WHERE review_status = 'approved'
  AND EXISTS (SELECT 1 FROM unnest(functions) fn WHERE lower(fn) LIKE '%groundcover%')
  AND NOT tags @> ARRAY['groundcover'];

-- climber
UPDATE plants SET tags = array_append(tags, 'climber')
WHERE review_status = 'approved'
  AND EXISTS (SELECT 1 FROM unnest(functions) fn WHERE lower(fn) LIKE '%climber%')
  AND NOT tags @> ARRAY['climber'];

-- windbreak
UPDATE plants SET tags = array_append(tags, 'windbreak')
WHERE review_status = 'approved'
  AND EXISTS (SELECT 1 FROM unnest(functions) fn WHERE lower(fn) LIKE '%windbreak%')
  AND NOT tags @> ARRAY['windbreak'];

-- timber
UPDATE plants SET tags = array_append(tags, 'timber')
WHERE review_status = 'approved'
  AND EXISTS (SELECT 1 FROM unnest(functions) fn WHERE lower(fn) = 'timber')
  AND NOT tags @> ARRAY['timber'];

-- avenue (avenue tree, Street tree)
UPDATE plants SET tags = array_append(tags, 'avenue')
WHERE review_status = 'approved'
  AND EXISTS (SELECT 1 FROM unnest(functions) fn
              WHERE lower(fn) LIKE '%avenue%' OR lower(fn) LIKE '%street tree%')
  AND NOT tags @> ARRAY['avenue'];

-- herb-spice (herb-spice, herb-spice production)
UPDATE plants SET tags = array_append(tags, 'herb-spice')
WHERE review_status = 'approved'
  AND EXISTS (SELECT 1 FROM unnest(functions) fn WHERE lower(fn) LIKE '%herb%spice%')
  AND NOT tags @> ARRAY['herb-spice'];

-- aquatic (water feature, bioswale, aquatic)
UPDATE plants SET tags = array_append(tags, 'aquatic')
WHERE review_status = 'approved'
  AND EXISTS (SELECT 1 FROM unnest(functions) fn
              WHERE lower(fn) LIKE '%water feature%'
                 OR lower(fn) LIKE '%bioswale%'
                 OR lower(fn) LIKE '%aquatic%')
  AND NOT tags @> ARRAY['aquatic'];

-- bee-friendly (bee-friendly, Bee forage…)
UPDATE plants SET tags = array_append(tags, 'bee-friendly')
WHERE review_status = 'approved'
  AND EXISTS (SELECT 1 FROM unnest(functions) fn WHERE lower(fn) LIKE '%bee%')
  AND NOT tags @> ARRAY['bee-friendly'];

-- cut-flower (cut flower, cut-flower)
UPDATE plants SET tags = array_append(tags, 'cut-flower')
WHERE review_status = 'approved'
  AND EXISTS (SELECT 1 FROM unnest(functions) fn
              WHERE lower(fn) LIKE '%cut flower%' OR lower(fn) LIKE '%cut-flower%')
  AND NOT tags @> ARRAY['cut-flower'];

-- nitrogen-fixing (Nitrogen fixer, nitrogen-fixing…)
UPDATE plants SET tags = array_append(tags, 'nitrogen-fixing')
WHERE review_status = 'approved'
  AND EXISTS (SELECT 1 FROM unnest(functions) fn WHERE lower(fn) LIKE '%nitrogen%')
  AND NOT tags @> ARRAY['nitrogen-fixing'];

-- agroforestry
UPDATE plants SET tags = array_append(tags, 'agroforestry')
WHERE review_status = 'approved'
  AND EXISTS (SELECT 1 FROM unnest(functions) fn WHERE lower(fn) LIKE '%agrofor%')
  AND NOT tags @> ARRAY['agroforestry'];


-- ── 3. Derive tags from origin column ────────────────────────

UPDATE plants SET tags = array_append(tags, 'indigenous')
WHERE review_status = 'approved'
  AND origin = 'indigenous'
  AND NOT tags @> ARRAY['indigenous'];

UPDATE plants SET tags = array_append(tags, 'exotic')
WHERE review_status = 'approved'
  AND origin = 'exotic'
  AND NOT tags @> ARRAY['exotic'];

UPDATE plants SET tags = array_append(tags, 'naturalised')
WHERE review_status = 'approved'
  AND origin = 'naturalised'
  AND NOT tags @> ARRAY['naturalised'];

UPDATE plants SET tags = array_append(tags, 'invasive')
WHERE review_status = 'approved'
  AND origin = 'invasive'
  AND NOT tags @> ARRAY['invasive'];


-- ── 4. Rebuild search_text with enriched tags ─────────────────

UPDATE plants
SET search_text =
  scientific_name || ' ' ||
  COALESCE(array_to_string(common_names,   ' '), '') || ' ' ||
  COALESCE(array_to_string(swahili_names,  ' '), '') || ' ' ||
  COALESCE(array_to_string(tags,           ' '), '') || ' ' ||
  COALESCE(description, '')
WHERE review_status = 'approved';


-- ── 5. Verify results ─────────────────────────────────────────
SELECT tag, COUNT(*) AS species_count
FROM plants, unnest(tags) AS tag
WHERE review_status = 'approved'
  AND tag IN (
    'flowering','tree','shrub','hedge','shade','drought-tolerant',
    'ornamental','medicinal','edible','climber','perennial',
    'fast-growing','avenue','agroforestry','nitrogen-fixing',
    'invasive','indigenous','exotic','naturalised',
    'groundcover','aquatic','bee-friendly','cut-flower','timber',
    'windbreak','erosion-control','indoor','wildlife','herb-spice'
  )
GROUP BY tag
ORDER BY species_count DESC;

-- ================================================================
-- End migration v6
-- ================================================================
