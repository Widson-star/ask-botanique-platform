#!/usr/bin/env node
/**
 * Ask Botanique — AI-Assisted Curation Script
 * ─────────────────────────────────────────────
 * Usage:
 *   node scripts/curate.mjs --species "Prunus africana"
 *   node scripts/curate.mjs --batch scripts/batches/batch_01_indigenous.json
 *   node scripts/curate.mjs --batch scripts/batches/batch_01_indigenous.json --dry-run
 *
 * Options:
 *   --species   Single species scientific name
 *   --batch     Path to JSON file: [{ "scientific_name": "...", "source_refs": ["..."] }]
 *   --dry-run   Print output without writing to Supabase
 *   --overwrite Re-curate species that already exist (default: skip)
 */

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import fs from 'fs'
import path from 'path'

// Load .env from backend root, overriding any pre-existing shell vars
const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env'), override: true })

const args = process.argv.slice(2)
const getArg = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null }
const hasFlag = (flag) => args.includes(flag)

const DRY_RUN   = hasFlag('--dry-run')
const OVERWRITE = hasFlag('--overwrite')
const SPECIES   = getArg('--species')
const BATCH     = getArg('--batch')

if (!SPECIES && !BATCH) {
  console.error('Usage: node scripts/curate.mjs --species "Ficus sycomorus" [--dry-run]')
  console.error('       node scripts/curate.mjs --batch scripts/batches/batch_01.json [--dry-run]')
  process.exit(1)
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const supabase  = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)

// ── Prompt template ────────────────────────────────────────────────────────
const CURATION_SYSTEM = `You are a botanical data assistant producing structured plant profiles for a Kenya/East Africa landscape intelligence platform.

Your output MUST be a single valid JSON object. No markdown, no prose, only the JSON object.

Rules:
- Only fill fields from known, reliable horticultural sources. If you are uncertain about a value, use null.
- Do NOT invent values. A null is far better than a wrong number.
- Rainfall ranges should be the actual annual mm range the plant tolerates, not its native habitat range.
- Tags and functions must come from the allowed vocabularies below.
- swahili_names and local_names should only be filled if you are confident. Common Swahili plant names are generally safe; tribal names need higher confidence.
- origin: use 'indigenous' only for species truly native to East Africa; 'exotic' for introduced; 'naturalised' for long-established exotics; 'invasive' for declared invasives.

Allowed tag values:
  Broad form: tree | shrub | groundcover | grass | palm | climber | succulent | herb | aquatic | air-plant | bamboo | fern | cycad | annual | perennial | biennial
  Use/function: medicinal | fruit | herb-spice | indigenous | exotic | naturalised | invasive | hardwood | softwood | hedge | windbreak | shade | ornamental | wildlife | erosion-control | bioswale | indoor | drought-tolerant | edible | bee-friendly | dye | timber | fuel

Allowed function values (landscape functions):
  shade tree | flowering tree | screening | hedge | groundcover | lawn | indoor decor | windbreak | erosion control | water feature | bioswale | specimen tree | avenue tree | fruit tree | medicinal | wildlife habitat | boundary | container | climber`

function buildPrompt(speciesName, sourceRefs) {
  return `Produce a complete plant profile for: ${speciesName}

Source references you may draw from: ${sourceRefs?.join(', ') || 'general horticultural knowledge'}

Return ONLY this JSON object with ALL fields present (use null if unknown):

{
  "scientific_name": "${speciesName}",
  "common_names": ["string", ...],
  "swahili_names": ["string", ...] or null,
  "local_names": { "kikuyu": "...", "luo": "...", "kamba": "...", "kalenjin": "...", "meru": "..." } or null,
  "origin": "indigenous" | "exotic" | "naturalised" | "invasive",
  "native_to_region": true | false,
  "native_regions": ["Mt. Kenya", "Coast", "Rift Valley", "Aberdares", "Western Kenya", "Arid North", "Central Highlands", "Lake Victoria Basin"] or null,
  "tags": ["tag1", "tag2", ...],
  "functions": ["function1", "function2", ...],
  "min_rainfall": integer_mm or null,
  "max_rainfall": integer_mm or null,
  "altitude_min_m": integer or null,
  "altitude_max_m": integer or null,
  "sunlight": "Full sun" | "Partial shade" | "Shade",
  "soil_types": ["Clay", "Loam", "Sandy"] (include all that apply),
  "water_needs": "Low" | "Moderate" | "High",
  "maintenance_level": "Low" | "Medium" | "High",
  "max_height_cm": integer or null,
  "growth_rate": "Slow" | "Moderate" | "Fast",
  "description": "2-3 sentence practical description for a landscape architect. Mention key features, notable uses, and any Kenya-specific context.",
  "confidence_score": 0.0-1.0 (your confidence in the accuracy of this profile)
}`
}

// ── Core curation function ─────────────────────────────────────────────────
async function curateSpecies(scientificName, sourceRefs = []) {
  console.log(`\n→ Curating: ${scientificName}`)

  // Skip if already exists (unless --overwrite)
  if (!OVERWRITE) {
    const { data: existing } = await supabase
      .from('plants')
      .select('id, scientific_name')
      .ilike('scientific_name', scientificName)
      .single()

    if (existing) {
      console.log(`  ⤳ Already in DB (id: ${existing.id}) — skipping. Use --overwrite to re-curate.`)
      return null
    }
  }

  // Claude call
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1200,
    system: CURATION_SYSTEM,
    messages: [{ role: 'user', content: buildPrompt(scientificName, sourceRefs) }],
  })

  const raw = response.content[0]?.text?.trim()
  if (!raw) throw new Error('Empty response from Claude')

  let profile
  try {
    // Strip any accidental markdown fences
    const cleaned = raw.replace(/^```json\n?/i, '').replace(/\n?```$/i, '').trim()
    profile = JSON.parse(cleaned)
  } catch (err) {
    console.error(`  ✗ JSON parse failed for ${scientificName}:\n${raw}`)
    return null
  }

  // Attach curation metadata
  profile.review_status  = 'draft'
  profile.source_refs    = sourceRefs.length ? sourceRefs : ['AI-assisted curation']
  profile.curated_by     = 'curate.mjs'

  if (DRY_RUN) {
    console.log('  [DRY RUN] Would write:')
    console.log(JSON.stringify(profile, null, 2))
    return profile
  }

  // Write to Supabase
  const { data, error } = await supabase
    .from('plants')
    .insert(profile)
    .select('id')
    .single()

  if (error) {
    console.error(`  ✗ DB insert failed: ${error.message}`)
    return null
  }

  console.log(`  ✓ Draft created — id: ${data.id} | confidence: ${profile.confidence_score}`)
  return data
}

// ── Entry points ───────────────────────────────────────────────────────────
async function main() {
  if (SPECIES) {
    await curateSpecies(SPECIES, [])
    return
  }

  if (BATCH) {
    const batchPath = path.resolve(BATCH)
    if (!fs.existsSync(batchPath)) {
      console.error(`Batch file not found: ${batchPath}`)
      process.exit(1)
    }

    const batch = JSON.parse(fs.readFileSync(batchPath, 'utf8'))
    console.log(`Processing batch: ${batch.length} species from ${batchPath}`)

    let success = 0, skipped = 0, failed = 0
    for (const entry of batch) {
      try {
        const result = await curateSpecies(entry.scientific_name, entry.source_refs || [])
        if (result === null) skipped++
        else success++
      } catch (err) {
        console.error(`  ✗ Error: ${err.message}`)
        failed++
      }
      // Polite delay — avoid hammering the API
      await new Promise(r => setTimeout(r, 800))
    }

    console.log(`\n── Batch complete ──────────────────────`)
    console.log(`  Created: ${success} | Skipped: ${skipped} | Failed: ${failed}`)
  }
}

main().catch(err => { console.error(err); process.exit(1) })
