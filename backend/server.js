import express from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import 'dotenv/config'

import { calculateSuitability } from './utils/plantScoring.js'

const app = express()
const PORT = process.env.PORT || 3000

// =============================
// SECURITY HEADERS
// =============================
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  next()
})

// =============================
// CORS — restricted to known origins
// =============================
const ALLOWED_ORIGINS = [
  'https://ask-botanique-platform.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
]

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server (no origin) and known origins
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true)
    callback(new Error('Not allowed by CORS'))
  },
}))

// =============================
// BODY PARSING — size-limited
// =============================
app.use(express.json({ limit: '10kb' }))

// =============================
// SUPABASE + ANTHROPIC CLIENTS
// =============================
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
)

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('FATAL: ANTHROPIC_API_KEY is not set')
  process.exit(1)
}
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// =============================
// RATE LIMITER — 20 req / 10 min per IP on chat
// =============================
const chatRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a few minutes.' },
})

// =============================
// ANONYMOUS QUERY TRACKER (server-side free tier)
// IP → { count, resetAt }  — resets after 24 h
// =============================
const anonQueryMap = new Map()
const ANON_LIMIT = 5
const ANON_RESET_MS = 24 * 60 * 60 * 1000

function checkAndIncrementAnon(ip) {
  const now = Date.now()
  const rec = anonQueryMap.get(ip)

  if (!rec || now > rec.resetAt) {
    anonQueryMap.set(ip, { count: 1, resetAt: now + ANON_RESET_MS })
    return true
  }
  if (rec.count >= ANON_LIMIT) return false
  rec.count++
  return true
}

// =============================
// AUTH HELPER — optional JWT verification
// =============================
async function getAuthUser(req) {
  try {
    const auth = req.headers['authorization']
    if (!auth?.startsWith('Bearer ')) return null
    const token = auth.slice(7)
    const { data: { user }, error } = await supabase.auth.getUser(token)
    return (!error && user) ? user : null
  } catch {
    return null
  }
}

// =============================
// INPUT SANITISER
// =============================
function sanitiseMessage(raw) {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (trimmed.length > 2000) return null
  return trimmed
}

function sanitiseHistory(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .slice(-20)
    .filter(m => m && ['user', 'assistant'].includes(m?.role) && typeof m?.content === 'string')
    .map(m => ({ role: m.role, content: m.content.slice(0, 2000) }))
}

// =============================
// ROOT
// =============================
app.get('/', (req, res) => {
  res.send('Ask Botanique API running')
})

// =============================
// EXPLORE — filter + search
// GET /api/explore?q=flowering&tags=tree,indigenous&origin=indigenous&ecological_zone=highland&sunlight=full+sun&maintenance=low&limit=48&offset=0
// =============================
app.get('/api/explore', async (req, res) => {
  const {
    q,
    tags,
    origin,
    ecological_zone,
    sunlight,
    maintenance,
    limit: rawLimit = '48',
    offset: rawOffset = '0',
  } = req.query

  const limit = Math.min(Math.max(parseInt(rawLimit, 10) || 48, 1), 100)
  const offset = Math.max(parseInt(rawOffset, 10) || 0, 0)

  try {
    let query = supabase
      .from('plants')
      .select(
        'id, scientific_name, common_names, tags, origin, ecological_zone, sunlight, maintenance_level, min_rainfall, max_rainfall, image_url, thumbnail_url, description',
        { count: 'exact' }
      )
      .eq('review_status', 'approved')

    if (q) {
      const safe = String(q).replace(/[^a-zA-Z0-9 '\-]/g, '').slice(0, 100)
      query = query.or(
        `scientific_name.ilike.%${safe}%,search_text.ilike.%${safe}%`
      )
    }

    if (tags) {
      const tagList = String(tags)
        .split(',')
        .map(t => t.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 10)
      if (tagList.length > 0) query = query.overlaps('tags', tagList)
    }

    if (origin) query = query.eq('origin', String(origin))
    if (ecological_zone) query = query.eq('ecological_zone', String(ecological_zone))
    if (sunlight) query = query.eq('sunlight', String(sunlight))
    if (maintenance) query = query.eq('maintenance_level', String(maintenance))

    query = query
      .order('confidence_score', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data, error, count } = await query
    if (error) throw error

    res.json({ plants: data ?? [], total: count ?? 0 })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' })
  }
})

// =============================
// STATS — live species count
// GET /api/stats
// =============================
app.get('/api/stats', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('public_stats')
      .select('*')
      .single()
    if (error) throw error
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// =============================
// NURSERIES — marketplace public + authed endpoints
// =============================

// Per-request Supabase client scoped to the caller's JWT (so RLS auth.uid() works)
function supabaseAsUser(req) {
  const auth = req.headers['authorization']
  if (!auth?.startsWith('Bearer ')) return null
  const token = auth.slice(7)
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

// GET /api/nurseries — public listing (filter by county, specialty, q)
app.get('/api/nurseries', async (req, res) => {
  const { q, county, specialty, verified, limit: rawLimit = '24', offset: rawOffset = '0' } = req.query
  const limit = Math.min(Math.max(parseInt(rawLimit, 10) || 24, 1), 60)
  const offset = Math.max(parseInt(rawOffset, 10) || 0, 0)

  try {
    let query = supabase
      .from('nurseries')
      .select('id, slug, name, description, county, specialties, delivery_counties, min_order_kes, is_verified, profile_image_url, whatsapp, phone', { count: 'exact' })
      .eq('is_active', true)

    if (q) {
      const safe = String(q).replace(/[^a-zA-Z0-9 '\-]/g, '').slice(0, 100)
      query = query.or(`name.ilike.%${safe}%,description.ilike.%${safe}%,county.ilike.%${safe}%`)
    }
    if (county) query = query.eq('county', String(county))
    if (specialty) query = query.contains('specialties', [String(specialty)])
    if (verified === 'true') query = query.eq('is_verified', true)

    query = query.order('is_verified', { ascending: false }).order('name', { ascending: true }).range(offset, offset + limit - 1)
    const { data, error, count } = await query
    if (error) throw error
    res.json({ nurseries: data ?? [], total: count ?? 0 })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/nurseries/me — authed: returns the caller's nursery (or null)
app.get('/api/nurseries/me', async (req, res) => {
  const userClient = supabaseAsUser(req)
  if (!userClient) return res.status(401).json({ error: 'Auth required' })
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Auth required' })
  const { data, error } = await userClient
    .from('nurseries')
    .select('*')
    .eq('owner_user_id', user.id)
    .maybeSingle()
  if (error) return res.status(500).json({ error: error.message })
  res.json({ nursery: data })
})

// GET /api/nurseries/:slug — public detail + inventory
app.get('/api/nurseries/:slug', async (req, res) => {
  const slug = String(req.params.slug || '').slice(0, 80)
  try {
    const { data: nursery, error: nErr } = await supabase
      .from('nurseries')
      .select('id, slug, name, description, county, address, location_lat, location_lng, specialties, delivery_counties, min_order_kes, is_verified, profile_image_url, phone, whatsapp, email, website, created_at')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle()
    if (nErr) throw nErr
    if (!nursery) return res.status(404).json({ error: 'Nursery not found' })

    const { data: inventory, error: iErr } = await supabase
      .from('nursery_inventory')
      .select('id, quantity_available, price_kes, price_unit, container_size, is_available, lead_time_days, seasonal_note, last_updated, plants:plant_id (id, scientific_name, common_names, tags, image_url, thumbnail_url, ecological_zone, origin)')
      .eq('nursery_id', nursery.id)
      .eq('is_available', true)
      .order('last_updated', { ascending: false })
    if (iErr) throw iErr

    res.json({ nursery, inventory: inventory ?? [] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/nurseries — authed: create my nursery
app.post('/api/nurseries', async (req, res) => {
  const userClient = supabaseAsUser(req)
  if (!userClient) return res.status(401).json({ error: 'Auth required' })
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Auth required' })

  const b = req.body || {}
  const name = typeof b.name === 'string' ? b.name.trim().slice(0, 120) : ''
  if (!name) return res.status(400).json({ error: 'name required' })

  // Generate unique-ish slug
  let baseSlug = slugify(b.slug || name)
  if (!baseSlug) baseSlug = `nursery-${user.id.slice(0, 8)}`
  let slug = baseSlug
  let n = 1
  // collision check (small race tolerated; UNIQUE constraint is the real guard)
  while (true) {
    const { data: existing } = await supabase.from('nurseries').select('id').eq('slug', slug).maybeSingle()
    if (!existing) break
    n += 1
    slug = `${baseSlug}-${n}`
    if (n > 50) { slug = `${baseSlug}-${Date.now().toString(36)}`; break }
  }

  const payload = {
    owner_user_id: user.id,
    name,
    slug,
    description: typeof b.description === 'string' ? b.description.slice(0, 2000) : null,
    phone: typeof b.phone === 'string' ? b.phone.slice(0, 40) : null,
    whatsapp: typeof b.whatsapp === 'string' ? b.whatsapp.slice(0, 40) : null,
    email: typeof b.email === 'string' ? b.email.slice(0, 200) : null,
    website: typeof b.website === 'string' ? b.website.slice(0, 300) : null,
    address: typeof b.address === 'string' ? b.address.slice(0, 300) : null,
    county: typeof b.county === 'string' ? b.county.slice(0, 60) : null,
    specialties: Array.isArray(b.specialties) ? b.specialties.slice(0, 20).map(s => String(s).slice(0, 40)) : null,
    delivery_counties: Array.isArray(b.delivery_counties) ? b.delivery_counties.slice(0, 47).map(s => String(s).slice(0, 60)) : null,
    min_order_kes: Number.isFinite(Number(b.min_order_kes)) ? parseInt(b.min_order_kes, 10) : null,
    profile_image_url: typeof b.profile_image_url === 'string' ? b.profile_image_url.slice(0, 500) : null,
  }

  const { data, error } = await userClient.from('nurseries').insert(payload).select('*').single()
  if (error) return res.status(400).json({ error: error.message })
  res.status(201).json({ nursery: data })
})

// PATCH /api/nurseries/:id — authed owner: update fields
app.patch('/api/nurseries/:id', async (req, res) => {
  const userClient = supabaseAsUser(req)
  if (!userClient) return res.status(401).json({ error: 'Auth required' })

  const id = String(req.params.id)
  const b = req.body || {}
  const allow = ['name', 'description', 'phone', 'whatsapp', 'email', 'website', 'address', 'county', 'specialties', 'delivery_counties', 'min_order_kes', 'profile_image_url', 'is_active']
  const patch = {}
  for (const k of allow) if (k in b) patch[k] = b[k]
  if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'no fields to update' })

  const { data, error } = await userClient.from('nurseries').update(patch).eq('id', id).select('*').single()
  if (error) return res.status(400).json({ error: error.message })
  res.json({ nursery: data })
})

// =============================
// NURSERY INVENTORY
// =============================

// GET /api/nurseries/:id/inventory — authed owner view (full, incl. unavailable)
app.get('/api/nurseries/:id/inventory', async (req, res) => {
  const userClient = supabaseAsUser(req)
  if (!userClient) return res.status(401).json({ error: 'Auth required' })
  const id = String(req.params.id)
  const { data, error } = await userClient
    .from('nursery_inventory')
    .select('id, plant_id, quantity_available, price_kes, price_unit, container_size, is_available, lead_time_days, seasonal_note, last_updated, plants:plant_id (id, scientific_name, common_names, image_url, thumbnail_url)')
    .eq('nursery_id', id)
    .order('last_updated', { ascending: false })
  if (error) return res.status(400).json({ error: error.message })
  res.json({ inventory: data ?? [] })
})

// POST /api/nurseries/:id/inventory — authed owner: add item
app.post('/api/nurseries/:id/inventory', async (req, res) => {
  const userClient = supabaseAsUser(req)
  if (!userClient) return res.status(401).json({ error: 'Auth required' })

  const nurseryId = String(req.params.id)
  const b = req.body || {}
  if (!b.plant_id) return res.status(400).json({ error: 'plant_id required' })

  const payload = {
    nursery_id: nurseryId,
    plant_id: String(b.plant_id),
    quantity_available: Number.isFinite(Number(b.quantity_available)) ? parseInt(b.quantity_available, 10) : 0,
    price_kes: Number.isFinite(Number(b.price_kes)) ? parseInt(b.price_kes, 10) : null,
    price_unit: typeof b.price_unit === 'string' ? b.price_unit.slice(0, 30) : 'seedling',
    container_size: typeof b.container_size === 'string' ? b.container_size.slice(0, 40) : null,
    lead_time_days: Number.isFinite(Number(b.lead_time_days)) ? parseInt(b.lead_time_days, 10) : null,
    seasonal_note: typeof b.seasonal_note === 'string' ? b.seasonal_note.slice(0, 200) : null,
    is_available: b.is_available !== false,
  }

  const { data, error } = await userClient.from('nursery_inventory').insert(payload).select('*').single()
  if (error) return res.status(400).json({ error: error.message })
  res.status(201).json({ item: data })
})

// PATCH /api/inventory/:itemId — authed owner: update an inventory row
app.patch('/api/inventory/:itemId', async (req, res) => {
  const userClient = supabaseAsUser(req)
  if (!userClient) return res.status(401).json({ error: 'Auth required' })
  const itemId = String(req.params.itemId)
  const b = req.body || {}
  const allow = ['quantity_available', 'price_kes', 'price_unit', 'container_size', 'is_available', 'lead_time_days', 'seasonal_note']
  const patch = { last_updated: new Date().toISOString() }
  for (const k of allow) if (k in b) patch[k] = b[k]

  const { data, error } = await userClient.from('nursery_inventory').update(patch).eq('id', itemId).select('*').single()
  if (error) return res.status(400).json({ error: error.message })
  res.json({ item: data })
})

// DELETE /api/inventory/:itemId
app.delete('/api/inventory/:itemId', async (req, res) => {
  const userClient = supabaseAsUser(req)
  if (!userClient) return res.status(401).json({ error: 'Auth required' })
  const itemId = String(req.params.itemId)
  const { error } = await userClient.from('nursery_inventory').delete().eq('id', itemId)
  if (error) return res.status(400).json({ error: error.message })
  res.json({ ok: true })
})

// =============================
// CATEGORY
// GET /plants/category/:category
// =============================
app.get('/plants/category/:category', async (req, res) => {
  const { category } = req.params

  try {
    const { data: categoryData, error: categoryError } = await supabase
      .from('plant_categories')
      .select('id')
      .eq('name', category)
      .single()

    if (categoryError || !categoryData) {
      return res.status(404).json({ error: 'Category not found' })
    }

    const { data, error } = await supabase
      .from('plants')
      .select('*, plant_categories(name)')
      .eq('category_id', categoryData.id)

    if (error) return res.status(500).json(error)
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// =============================
// SINGLE PLANT
// GET /plants/:id
// =============================
app.get('/plants/:id', async (req, res) => {
  const { id } = req.params

  try {
    const { data, error } = await supabase
      .from('plants')
      .select('*, plant_categories(name)')
      .eq('id', id)
      .single()

    if (error || !data) {
      return res.status(404).json({ error: 'Plant not found' })
    }

    res.json(data)
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// =============================
// LIST + SEARCH
// GET /plants?search=grass
// =============================
app.get('/plants', async (req, res) => {
  const { search, sunlight, water, category } = req.query

  try {
    const tableName = search ? 'plants_searchable' : 'plants'

    let query = supabase
      .from(tableName)
      .select('*, plant_categories(name)')

    if (search) {
      // Sanitise search string — strip special characters, cap length
      const safeSearch = String(search).replace(/[^a-zA-Z0-9 \-]/g, '').slice(0, 100)
      query = query.or(
        `scientific_name.ilike.%${safeSearch}%,common_names_text.ilike.%${safeSearch}%`
      )
    }

    if (sunlight) query = query.eq('sunlight', sunlight)
    if (water) query = query.eq('water_needs', water)
    if (category) query = query.eq('category', category)

    const { data, error } = await query

    if (error) return res.status(500).json(error)
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// =============================
// RECOMMENDATION ENGINE
// GET /api/recommend
// =============================
app.get('/api/recommend', async (req, res) => {
  try {
    const { rainfall, soil_type, sunlight, category, function: plantFunction } = req.query

    if (!rainfall || !soil_type || !sunlight) {
      return res.status(400).json({
        error: 'Missing required parameters: rainfall, soil_type, sunlight',
      })
    }

    let query = supabase.from('plants').select('*, plant_categories(name)')

    if (category) {
      const { data: categoryData } = await supabase
        .from('plant_categories')
        .select('id')
        .eq('name', category)
        .single()
      if (categoryData) query = query.eq('category_id', categoryData.id)
    }

    if (plantFunction && plantFunction !== '') {
      query = query.contains('functions', [plantFunction])
    }

    const { data: plants, error } = await query
    if (error) throw error

    const userConditions = {
      rainfall: parseInt(rainfall),
      soil_type,
      sunlight,
    }

    const scoredPlants = plants
      .map(plant => {
        const { score, reasons, warnings } = calculateSuitability(plant, userConditions)
        return {
          plant: {
            id: plant.id,
            scientific_name: plant.scientific_name,
            common_names: plant.common_names,
            category: plant.plant_categories?.name,
            description: plant.description,
            max_height_cm: plant.max_height_cm,
            water_needs: plant.water_needs,
            sunlight: plant.sunlight,
            maintenance_level: plant.maintenance_level,
            image_url: plant.image_url,
            thumbnail_url: plant.thumbnail_url,
            functions: plant.functions,
            image_credits: plant.image_credits,
          },
          suitability_score: score,
          match_reasons: reasons,
          warnings,
        }
      })
      .sort((a, b) => b.suitability_score - a.suitability_score)

    res.json({
      total_analyzed: plants.length,
      recommendations: scoredPlants.slice(0, 10),
      user_conditions: { ...userConditions, function: plantFunction || null },
    })
  } catch (error) {
    console.error('Recommendation error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// =============================
// ADMIN — NURSERY MANAGEMENT
// All routes below require the caller to be widsonnambaisi@gmail.com
// =============================

const ADMIN_EMAIL = 'widsonnambaisi@gmail.com'

async function requireAdmin(req, res) {
  const user = await getAuthUser(req)
  if (!user || user.email !== ADMIN_EMAIL) {
    res.status(403).json({ error: 'Admin access only.' })
    return null
  }
  return user
}

// GET /api/admin/nurseries — all nurseries with owner email
app.get('/api/admin/nurseries', async (req, res) => {
  if (!await requireAdmin(req, res)) return
  const { data, error } = await supabase
    .from('nurseries')
    .select('id, name, slug, county, specialties, is_verified, is_active, created_at, owner_user_id, profiles:owner_user_id(email)')
    .order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.json({ nurseries: data ?? [] })
})

// PATCH /api/admin/nurseries/:id — toggle is_verified and/or is_active
app.patch('/api/admin/nurseries/:id', async (req, res) => {
  if (!await requireAdmin(req, res)) return
  const id = String(req.params.id)
  const b = req.body || {}
  const patch = {}
  if (typeof b.is_verified === 'boolean') patch.is_verified = b.is_verified
  if (typeof b.is_active  === 'boolean') patch.is_active   = b.is_active
  if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'no fields to update' })
  const { data, error } = await supabase.from('nurseries').update(patch).eq('id', id).select('*').single()
  if (error) return res.status(400).json({ error: error.message })
  res.json({ nursery: data })
})

// =============================
// AI CHAT ENDPOINT
// POST /api/chat
// Body: { message: string, history: [{role, content}] }
// =============================

const SYSTEM_PROMPT = `You are the Ask Botanique AI assistant — a plant specification tool for East African landscapers, not a general horticulture chatbot.

## Hard rules — these override everything else

1. **Only recommend plants that appear in the GROUNDING DATA block of the user's message.** Never name a species, cultivar, or common name that is not in that block. If a user asks about a plant that isn't there, say you don't have it in the database yet and offer to recommend similar plants that are.
2. **Never invent suitability scores, rainfall tolerances, or soil preferences.** Only cite the scores and reasons provided in the GROUNDING DATA. If a field is missing, say so.
3. **If the GROUNDING DATA block is empty or labelled "NO MATCHES", do not improvise a list from memory.** Instead, ask for the missing site conditions — rainfall (mm/year), soil type (clay / loam / sandy), sunlight (full sun / partial shade / shade) — or ask the user to name a plant they're considering.
4. **Do not reason from generic plant knowledge learned in training.** If the user asks "what grows in Nairobi?", the answer comes from the GROUNDING DATA, not from training data about jacarandas and bougainvillea.

## How to respond when GROUNDING DATA has matches

- Lead with 2–4 top-ranked species, scientific name first, then common name in parentheses.
- Cite the suitability score and the match reasons exactly as given.
- Flag any warnings plainly ("note: prefers better drainage than clay provides").
- Keep it under ~180 words unless the user asks for more depth.

## Tone

You're talking to working landscape architects and nursery professionals in Kenya. Be direct, specific, and practical. No filler ("Great question!"). No emojis. No hedging like "you might consider" — if the scoring engine ranked it, recommend it.`

// Approx. mean annual rainfall (mm) for common Kenyan locations where
// landscapers operate. Used as a fallback when the user mentions a place
// but not a number. Values are rough — the scoring engine tolerates this.
const LOCATION_RAINFALL = {
  nairobi: 950, karen: 1000, runda: 1000, westlands: 950, kilimani: 950,
  nanyuki: 700, kitale: 1200, eldoret: 1050, nakuru: 900, naivasha: 650,
  mombasa: 1050, malindi: 950, diani: 1100, kilifi: 1050,
  kisumu: 1200, kakamega: 1800,
  machakos: 750, makueni: 600, kitui: 650,
  marsabit: 400, turkana: 250, lodwar: 200,
}

// Maps natural-language words → known tag slugs in the plants.tags[] column.
// Used when a user types a category keyword without site conditions.
const INTENT_TAG_MAP = {
  'fruit':          'fruit',
  'fruits':         'fruit',
  'fruit tree':     'fruit',
  'fruit trees':    'fruit',
  'edible':         'edible',
  'flowering':      'flowering',
  'flower':         'flowering',
  'flowers':        'flowering',
  'hedge':          'hedge',
  'hedging':        'hedge',
  'hedges':         'hedge',
  'shade':          'shade',
  'shade tree':     'shade',
  'shade trees':    'shade',
  'indigenous':     'indigenous',
  'native':         'indigenous',
  'medicinal':      'medicinal',
  'herb':           'herb-spice',
  'herbs':          'herb-spice',
  'groundcover':    'groundcover',
  'ground cover':   'groundcover',
  'climber':        'climber',
  'climbers':       'climber',
  'indoor':         'indoor',
  'indoor plant':   'indoor',
  'indoor plants':  'indoor',
  'succulent':      'succulent',
  'succulents':     'succulent',
  'drought':        'drought-tolerant',
  'drought tolerant': 'drought-tolerant',
  'invasive':       'invasive',
  'timber':         'timber',
  'avenue':         'avenue',
  'avenue tree':    'avenue',
  'windbreak':      'windbreak',
  'agroforestry':   'agroforestry',
  'ornamental':     'ornamental',
  'tree':           'tree',
  'trees':          'tree',
  'grass':          'grasses',
  'grasses':        'grasses',
  'bamboo':         'bamboo',
  'palm':           'palms',
  'palms':          'palms',
  'aquatic':        'aquatic',
  'water plant':    'aquatic',
  'perennial':      'perennial',
  'bee':            'bee-friendly',
  'bee friendly':   'bee-friendly',
  'wildlife':       'wildlife',
  'erosion':        'erosion-control',
  'erosion control':'erosion-control',
  'cut flower':     'cut-flower',
  'cut flowers':    'cut-flower',
}

function extractIntentTag(message) {
  const text = message.toLowerCase().trim()
  // Try longest match first (prevents "shade" matching inside "partial shade")
  const sorted = Object.keys(INTENT_TAG_MAP).sort((a, b) => b.length - a.length)
  for (const phrase of sorted) {
    const re = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?\\b`)
    if (re.test(text)) return INTENT_TAG_MAP[phrase]
  }
  return null
}

function extractConditions(message) {
  const text = message.toLowerCase()
  const conditions = {}

  // ── Rainfall — explicit mm, then location fallback ──
  const rainfallMatch = text.match(/(\d{3,4})\s*mm/)
  if (rainfallMatch) {
    conditions.rainfall = parseInt(rainfallMatch[1])
  } else {
    for (const [place, mm] of Object.entries(LOCATION_RAINFALL)) {
      if (text.includes(place)) { conditions.rainfall = mm; break }
    }
    // Qualitative fallbacks
    if (!conditions.rainfall) {
      if (/\b(arid|very dry|semi[- ]?arid|drylands?)\b/.test(text)) conditions.rainfall = 400
      else if (/\b(dry area|low rainfall)\b/.test(text)) conditions.rainfall = 600
      else if (/\b(high rainfall|wet area|highlands?)\b/.test(text)) conditions.rainfall = 1300
    }
  }

  // ── Soil ──
  if (/\b(black cotton|heavy clay|heavy soil|sticky soil|clay)\b/.test(text)) conditions.soil_type = 'clay'
  else if (/\b(sandy|sand|light soil|coastal sand)\b/.test(text)) conditions.soil_type = 'sandy'
  else if (/\b(loam|well[- ]?drained|rich soil|garden soil)\b/.test(text)) conditions.soil_type = 'loam'

  // ── Sunlight ──
  if (/\b(full sun|sunny|exposed|open (site|area|ground)|all day sun)\b/.test(text)) conditions.sunlight = 'Full sun'
  else if (/\b(partial shade|part shade|dappled|filtered light|morning sun)\b/.test(text)) conditions.sunlight = 'Partial shade'
  else if (/\b(shade|shaded|shady|under trees|deep shade|north[- ]?facing)\b/.test(text)) conditions.sunlight = 'Shade'

  return conditions
}

app.post('/api/chat', chatRateLimit, async (req, res) => {
  try {
    // ── Input validation ──
    const message = sanitiseMessage(req.body?.message)
    if (!message) {
      return res.status(400).json({ error: 'message is required and must be under 2000 characters' })
    }

    const history = sanitiseHistory(req.body?.history)

    // ── Auth check → anonymous enforcement ──
    const user = await getAuthUser(req)
    if (!user) {
      const ip = req.ip || req.socket?.remoteAddress || 'unknown'
      if (!checkAndIncrementAnon(ip)) {
        return res.status(429).json({
          error: 'Free query limit reached. Create a free account to continue.',
        })
      }
    }

    // ── Plant context ──
    const conditions = extractConditions(message)
    let plantContext = ''
    let topPlants = []

    const hasConditions = conditions.rainfall && conditions.soil_type && conditions.sunlight

    if (hasConditions) {
      const { data: plants, error } = await supabase
        .from('plants')
        .select('*, plant_categories(name)')

      if (!error && plants) {
        const userConditions = {
          rainfall: conditions.rainfall,
          soil_type: conditions.soil_type,
          sunlight: conditions.sunlight,
        }
        const scored = plants
          .map(p => {
            const { score, reasons, warnings } = calculateSuitability(p, userConditions)
            return {
              plant: {
                id: p.id,
                scientific_name: p.scientific_name,
                common_names: p.common_names,
                category: p.plant_categories?.name,
                description: p.description,
                max_height_cm: p.max_height_cm,
                water_needs: p.water_needs,
                sunlight: p.sunlight,
                maintenance_level: p.maintenance_level,
                image_url: p.image_url,
                thumbnail_url: p.thumbnail_url,
                functions: p.functions,
                image_credits: p.image_credits,
              },
              suitability_score: score,
              match_reasons: reasons,
              warnings,
            }
          })
          .sort((a, b) => b.suitability_score - a.suitability_score)
          .slice(0, 8)

        topPlants = scored
        plantContext = `\n\n===== GROUNDING DATA =====\nThe ONLY plants you may recommend in this turn are the ones listed below. Do not name any other species.\nSite conditions: rainfall=${conditions.rainfall}mm, soil=${conditions.soil_type}, sunlight=${conditions.sunlight}\n`
        plantContext += scored.map(r =>
          `• ${r.plant.scientific_name} (${r.plant.common_names?.[0] ?? '—'}) | Score: ${r.suitability_score}/100 | Category: ${r.plant.category ?? 'Unknown'} | Height: ${r.plant.max_height_cm ? r.plant.max_height_cm / 100 + 'm' : '?'} | Maintenance: ${r.plant.maintenance_level ?? '?'}\n  Reasons: ${r.match_reasons.join('; ')}\n  Warnings: ${r.warnings.join('; ') || 'None'}`
        ).join('\n')
        plantContext += '\n===== END GROUNDING DATA ====='
      }
    } else {
      // No full site conditions — try tag-based intent match first, then name search.
      const intentTag = extractIntentTag(message)
      const safeQuery = message.replace(/[^a-zA-Z0-9 \-]/g, '').slice(0, 100)

      let tagMatches = []
      let nameMatches = []

      if (intentTag) {
        // For 'fruit' queries, require BOTH fruit+edible tags to surface true food trees
        // (Mango, Avocado, Guava) over plants that merely produce edible fruits (Baobab).
        const tagFilter = intentTag === 'fruit' ? ['fruit', 'edible'] : [intentTag]
        const queryLimit = intentTag === 'fruit' ? 20 : 12
        const { data } = await supabase
          .from('plants')
          .select('id, scientific_name, common_names, tags, origin, ecological_zone, sunlight, maintenance_level, min_rainfall, max_rainfall, description, image_url, thumbnail_url, functions, confidence_score')
          .eq('review_status', 'approved')
          .contains('tags', tagFilter)
          .order('confidence_score', { ascending: false })
          .limit(queryLimit)
        tagMatches = data ?? []

        // Fallback: if fruit+edible combo returns < 4 results, relax to fruit-only
        if (intentTag === 'fruit' && tagMatches.length < 4) {
          const { data: fruitOnly } = await supabase
            .from('plants')
            .select('id, scientific_name, common_names, tags, origin, ecological_zone, sunlight, maintenance_level, min_rainfall, max_rainfall, description, image_url, thumbnail_url, functions, confidence_score')
            .eq('review_status', 'approved')
            .contains('tags', ['fruit'])
            .order('confidence_score', { ascending: false })
            .limit(20)
          tagMatches = fruitOnly ?? []
        }
      }

      if (tagMatches.length === 0) {
        // Fall back to scientific / common name search
        const { data } = await supabase
          .from('plants')
          .select('id, scientific_name, common_names, tags, origin, ecological_zone, sunlight, maintenance_level, min_rainfall, max_rainfall, description, image_url, thumbnail_url, functions, confidence_score')
          .eq('review_status', 'approved')
          .or(`scientific_name.ilike.%${safeQuery}%,search_text.ilike.%${safeQuery}%`)
          .order('confidence_score', { ascending: false })
          .limit(6)
        nameMatches = data ?? []
      }

      const allMatches = tagMatches.length > 0 ? tagMatches : nameMatches
      // Cap at 8 so GROUNDING DATA and frontend plant cards stay in sync.
      // Claude will only mention plants it can see — no "I have 20 options" mismatch.
      const matches = allMatches.slice(0, 8)
      const searchLabel = intentTag ? `"${intentTag}" category` : `name search for "${safeQuery}"`

      if (matches.length > 0) {
        topPlants = matches.map(p => ({
          plant: {
            id: p.id,
            scientific_name: p.scientific_name,
            common_names: p.common_names,
            category: null,
            description: p.description,
            max_height_cm: null,
            water_needs: null,
            sunlight: p.sunlight,
            maintenance_level: p.maintenance_level,
            image_url: p.image_url,
            thumbnail_url: p.thumbnail_url,
            functions: p.functions,
            image_credits: null,
          },
          suitability_score: null,   // no conditions → no score
          match_reasons: intentTag ? [`Tagged as ${intentTag}`] : [],
          warnings: [],
        }))

        plantContext = `\n\n===== GROUNDING DATA =====\nTop database results for ${searchLabel}. The ONLY plants you may reference are the ones below. Do not name any other species.\nNote: no site conditions were provided — do not invent suitability scores. Briefly introduce each plant and ask the user for their rainfall, soil, and sunlight so you can give ranked recommendations.\n`
        plantContext += matches.map(p =>
          `• ${p.scientific_name} (${p.common_names?.[0] ?? '—'}) | Sunlight: ${p.sunlight ?? '?'} | Rainfall: ${p.min_rainfall ?? '?'}–${p.max_rainfall ?? '?'}mm | Maintenance: ${p.maintenance_level ?? '?'} | Origin: ${p.origin ?? '?'}\n  Description: ${(p.description ?? '').slice(0, 200)}`
        ).join('\n')
        plantContext += '\n===== END GROUNDING DATA ====='
      } else {
        plantContext = `\n\n===== GROUNDING DATA =====\nNO MATCHES. The database returned no plants for this query.\n⛔ Do NOT recommend any species from memory or training data.\nInstead, ask the user for:\n  • rainfall (mm/year) or location (e.g. Karen, Nanyuki, Mombasa)\n  • soil type (clay / loam / sandy)\n  • sunlight (full sun / partial shade / shade)\nOr ask them to name a specific plant they're considering.\n===== END GROUNDING DATA =====`
      }
    }

    // ── Build Claude messages ──
    const claudeHistory = [
      ...history.slice(-10),
      { role: 'user', content: message + plantContext },
    ]

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: claudeHistory,
    })

    const reply = response.content[0]?.text ?? 'Sorry, I could not generate a response.'

    // ── Audit log ──
    console.log(JSON.stringify({
      event: 'chat',
      ts: new Date().toISOString(),
      user: user?.id ?? 'anon',
      msgLen: message.length,
      hasConditions,
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
    }))

    res.json({
      reply,
      plants: topPlants.length > 0 ? topPlants : undefined,
    })
  } catch (error) {
    console.error('Chat error:', error.message)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// =============================
// RFQ — REQUEST FOR QUOTE
// All routes require authentication (Bearer JWT)
// =============================

// Helper: get nursery owned by auth user, or null
async function getNurseryForUser(userId) {
  const { data } = await supabase
    .from('nurseries')
    .select('id, name, slug')
    .eq('owner_user_id', userId)
    .eq('is_active', true)
    .single()
  return data ?? null
}

// POST /api/rfq — create a new RFQ with line items
app.post('/api/rfq', async (req, res) => {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Authentication required.' })

  const b = req.body ?? {}
  const { project_name, delivery_county, delivery_date, total_budget_kes, notes, items } = b

  if (!project_name || typeof project_name !== 'string' || !project_name.trim()) {
    return res.status(400).json({ error: 'project_name is required.' })
  }
  if (!delivery_county || typeof delivery_county !== 'string') {
    return res.status(400).json({ error: 'delivery_county is required.' })
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items array is required and must not be empty.' })
  }

  // Validate items
  const cleanItems = items
    .filter(it => it?.plant_id && Number.isInteger(Number(it.quantity)) && Number(it.quantity) > 0)
    .map(it => ({
      plant_id: String(it.plant_id),
      quantity: Math.min(Math.max(Math.floor(Number(it.quantity)), 1), 100000),
      price_unit: it.price_unit ? String(it.price_unit).slice(0, 50) : null,
      notes: it.notes ? String(it.notes).slice(0, 500) : null,
    }))

  if (cleanItems.length === 0) {
    return res.status(400).json({ error: 'No valid items provided.' })
  }

  try {
    // Create RFQ
    const { data: rfq, error: rfqErr } = await supabase
      .from('rfq_requests')
      .insert({
        requester_user_id: user.id,
        project_name: String(project_name).trim().slice(0, 200),
        delivery_county: String(delivery_county).trim().slice(0, 100),
        delivery_date: delivery_date ?? null,
        total_budget_kes: total_budget_kes ? Number(total_budget_kes) : null,
        notes: notes ? String(notes).slice(0, 2000) : null,
        status: 'sent',
      })
      .select('*')
      .single()

    if (rfqErr) throw rfqErr

    // Insert line items
    const { error: itemsErr } = await supabase
      .from('rfq_items')
      .insert(cleanItems.map(it => ({ rfq_id: rfq.id, ...it })))

    if (itemsErr) throw itemsErr

    res.status(201).json({ rfq })
  } catch (err) {
    console.error('RFQ create error:', err)
    res.status(500).json({ error: err.message ?? 'Internal server error' })
  }
})

// GET /api/rfq — list RFQs for the authenticated user (requester view)
app.get('/api/rfq', async (req, res) => {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Authentication required.' })

  try {
    const { data, error } = await supabase
      .from('rfq_requests')
      .select(`
        id, project_name, delivery_county, delivery_date, total_budget_kes, status, notes, created_at,
        rfq_items(id, plant_id, quantity, price_unit),
        rfq_responses(id, status, total_quoted_kes, nursery_id, nurseries:nursery_id(name, slug))
      `)
      .eq('requester_user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json({ rfqs: data ?? [] })
  } catch (err) {
    console.error('RFQ list error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/rfq/:id — RFQ detail (requester or invited nursery)
app.get('/api/rfq/:id', async (req, res) => {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Authentication required.' })

  const rfqId = String(req.params.id)

  try {
    const { data: rfq, error } = await supabase
      .from('rfq_requests')
      .select(`
        id, project_name, delivery_county, delivery_date, total_budget_kes, status, notes, created_at, requester_user_id,
        rfq_items(id, plant_id, quantity, price_unit, notes, plants:plant_id(id, scientific_name, common_names, thumbnail_url)),
        rfq_responses(
          id, status, total_quoted_kes, valid_until, delivery_lead_days, notes,
          nursery_id, nurseries:nursery_id(id, name, slug, county, is_verified),
          rfq_response_items(id, plant_id, quantity_available, unit_price_kes, container_size, notes)
        )
      `)
      .eq('id', rfqId)
      .single()

    if (error || !rfq) return res.status(404).json({ error: 'RFQ not found.' })

    // Access check: requester or nursery that has a response row
    const isRequester = rfq.requester_user_id === user.id
    const nursery = await getNurseryForUser(user.id)
    const isInvitedNursery = nursery && rfq.rfq_responses?.some(r => r.nursery_id === nursery.id)

    if (!isRequester && !isInvitedNursery) {
      return res.status(403).json({ error: 'Access denied.' })
    }

    res.json({ rfq })
  } catch (err) {
    console.error('RFQ detail error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/rfq/:id/respond — nursery submits a quote response
app.post('/api/rfq/:id/respond', async (req, res) => {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Authentication required.' })

  const nursery = await getNurseryForUser(user.id)
  if (!nursery) return res.status(403).json({ error: 'You must own an active nursery to submit quotes.' })

  const rfqId = String(req.params.id)
  const b = req.body ?? {}
  const { total_quoted_kes, valid_until, delivery_lead_days, notes, response_items } = b

  if (!total_quoted_kes || isNaN(Number(total_quoted_kes))) {
    return res.status(400).json({ error: 'total_quoted_kes is required.' })
  }

  try {
    // Verify RFQ exists and is in sent state
    const { data: rfq, error: rfqErr } = await supabase
      .from('rfq_requests')
      .select('id, status')
      .eq('id', rfqId)
      .single()

    if (rfqErr || !rfq) return res.status(404).json({ error: 'RFQ not found.' })
    if (!['sent', 'quoted'].includes(rfq.status)) {
      return res.status(400).json({ error: `Cannot respond to an RFQ with status '${rfq.status}'.` })
    }

    // Upsert response (nursery may update their quote)
    const { data: response, error: respErr } = await supabase
      .from('rfq_responses')
      .upsert(
        {
          rfq_id: rfqId,
          nursery_id: nursery.id,
          status: 'quoted',
          total_quoted_kes: Number(total_quoted_kes),
          valid_until: valid_until ?? null,
          delivery_lead_days: delivery_lead_days ? Math.floor(Number(delivery_lead_days)) : null,
          notes: notes ? String(notes).slice(0, 2000) : null,
        },
        { onConflict: 'rfq_id,nursery_id' }
      )
      .select('id')
      .single()

    if (respErr) throw respErr

    // Insert/replace line-item responses if provided
    if (Array.isArray(response_items) && response_items.length > 0) {
      // Delete old items for this response first
      await supabase
        .from('rfq_response_items')
        .delete()
        .eq('rfq_response_id', response.id)

      const cleanRespItems = response_items
        .filter(it => it?.plant_id && it?.unit_price_kes)
        .map(it => ({
          rfq_response_id: response.id,
          plant_id: String(it.plant_id),
          quantity_available: it.quantity_available ? Math.floor(Number(it.quantity_available)) : null,
          unit_price_kes: Number(it.unit_price_kes),
          container_size: it.container_size ? String(it.container_size).slice(0, 100) : null,
          notes: it.notes ? String(it.notes).slice(0, 500) : null,
        }))

      if (cleanRespItems.length > 0) {
        const { error: riErr } = await supabase
          .from('rfq_response_items')
          .insert(cleanRespItems)
        if (riErr) throw riErr
      }
    }

    // Update RFQ status to quoted
    await supabase
      .from('rfq_requests')
      .update({ status: 'quoted', updated_at: new Date().toISOString() })
      .eq('id', rfqId)
      .eq('status', 'sent')  // only promote sent → quoted; leave already-quoted as is

    res.status(201).json({ response_id: response.id })
  } catch (err) {
    console.error('RFQ respond error:', err)
    res.status(500).json({ error: err.message ?? 'Internal server error' })
  }
})

// PATCH /api/rfq/responses/:responseId — requester accepts/declines a response
app.patch('/api/rfq/responses/:responseId', async (req, res) => {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Authentication required.' })

  const responseId = String(req.params.responseId)
  const b = req.body ?? {}
  const { action } = b // 'accept' | 'decline'

  if (!['accept', 'decline'].includes(action)) {
    return res.status(400).json({ error: "action must be 'accept' or 'decline'." })
  }

  try {
    // Fetch response + its parent RFQ
    const { data: resp, error: respErr } = await supabase
      .from('rfq_responses')
      .select('id, rfq_id, status, rfq_requests:rfq_id(requester_user_id, status)')
      .eq('id', responseId)
      .single()

    if (respErr || !resp) return res.status(404).json({ error: 'Response not found.' })

    // Only the original requester can accept/decline
    if (resp.rfq_requests?.requester_user_id !== user.id) {
      return res.status(403).json({ error: 'Only the requester can accept or decline quotes.' })
    }

    const newStatus = action === 'accept' ? 'accepted' : 'declined'

    const { error: updateErr } = await supabase
      .from('rfq_responses')
      .update({ status: newStatus })
      .eq('id', responseId)

    if (updateErr) throw updateErr

    // If accepted, move the parent RFQ to accepted too
    if (action === 'accept') {
      await supabase
        .from('rfq_requests')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', resp.rfq_id)
    }

    res.json({ ok: true, status: newStatus })
  } catch (err) {
    console.error('RFQ accept/decline error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/nursery/rfq — nursery sees incoming RFQs they have been invited to respond to
// For Phase 8c: nurseries are sent RFQs that already have a response row for them,
// OR discover open RFQs in their county (for a future "marketplace" tab).
// For now: return RFQs where a response row exists for this nursery.
app.get('/api/nursery/rfq', async (req, res) => {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Authentication required.' })

  const nursery = await getNurseryForUser(user.id)
  if (!nursery) return res.status(403).json({ error: 'No active nursery found for this account.' })

  try {
    const { data, error } = await supabase
      .from('rfq_responses')
      .select(`
        id, status, total_quoted_kes, valid_until, delivery_lead_days, notes,
        rfq_requests:rfq_id(
          id, project_name, delivery_county, delivery_date, total_budget_kes, status, created_at,
          rfq_items(id, plant_id, quantity, plants:plant_id(scientific_name, common_names))
        )
      `)
      .eq('nursery_id', nursery.id)
      .order('id', { ascending: false })

    if (error) throw error
    res.json({ nursery, rfqs: data ?? [] })
  } catch (err) {
    console.error('Nursery RFQ list error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/nursery/rfq/:rfqId/invite — allow a requester to invite a specific nursery to quote
// Creates a 'pending' response row so the nursery can see the RFQ
app.post('/api/nursery/rfq/:rfqId/invite', async (req, res) => {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Authentication required.' })

  const rfqId = String(req.params.rfqId)
  const b = req.body ?? {}
  const { nursery_id } = b

  if (!nursery_id) return res.status(400).json({ error: 'nursery_id is required.' })

  try {
    // Verify the RFQ belongs to this user
    const { data: rfq, error: rfqErr } = await supabase
      .from('rfq_requests')
      .select('id, requester_user_id, status')
      .eq('id', rfqId)
      .single()

    if (rfqErr || !rfq) return res.status(404).json({ error: 'RFQ not found.' })
    if (rfq.requester_user_id !== user.id) return res.status(403).json({ error: 'Access denied.' })
    if (!['sent', 'quoted'].includes(rfq.status)) {
      return res.status(400).json({ error: `Cannot invite nurseries to an RFQ with status '${rfq.status}'.` })
    }

    // Insert a pending response row (idempotent via upsert)
    const { error: respErr } = await supabase
      .from('rfq_responses')
      .upsert(
        { rfq_id: rfqId, nursery_id: String(nursery_id), status: 'pending', total_quoted_kes: 0 },
        { onConflict: 'rfq_id,nursery_id', ignoreDuplicates: true }
      )

    if (respErr) throw respErr

    res.status(201).json({ ok: true })
  } catch (err) {
    console.error('Nursery invite error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// =============================
// PROFESSIONALS DIRECTORY
// =============================

const PRO_TYPES = [
  'landscape_architect',
  'landscape_designer',
  'gardener',
  'pest_control',
  'irrigation',
  'garden_contractor',
  'florist',
  'horticulturist',
]

// GET /api/professionals — public directory listing
// ?q=&type=florist&county=Nairobi&limit=24&offset=0
app.get('/api/professionals', async (req, res) => {
  const { q, type, county, limit: rawLimit = '24', offset: rawOffset = '0' } = req.query
  const limit = Math.min(Math.max(parseInt(rawLimit, 10) || 24, 1), 60)
  const offset = Math.max(parseInt(rawOffset, 10) || 0, 0)

  try {
    let query = supabase
      .from('professionals')
      .select(
        'id, business_name, slug, professional_type, bio, counties_served, specialties, years_experience, profile_image_url, certifications, min_project_kes, is_verified, phone, whatsapp',
        { count: 'exact' }
      )
      .eq('is_active', true)

    if (type && PRO_TYPES.includes(String(type))) {
      query = query.eq('professional_type', String(type))
    }

    if (q) {
      const safe = String(q).replace(/[^a-zA-Z0-9 '\-]/g, '').slice(0, 100)
      query = query.or(`business_name.ilike.%${safe}%,bio.ilike.%${safe}%`)
    }

    if (county) {
      query = query.contains('counties_served', [String(county).trim()])
    }

    query = query
      .order('is_verified', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data, error, count } = await query
    if (error) throw error

    res.json({ professionals: data ?? [], total: count ?? 0 })
  } catch (err) {
    console.error('Professionals list error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/professionals/me — own professional profile (auth required)
app.get('/api/professionals/me', async (req, res) => {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Authentication required.' })

  try {
    const { data, error } = await supabase
      .from('professionals')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error?.code === 'PGRST116') return res.json({ professional: null })
    if (error) throw error

    res.json({ professional: data })
  } catch (err) {
    console.error('Professional me error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/professionals — create professional profile (auth required)
app.post('/api/professionals', async (req, res) => {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Authentication required.' })

  // Check no existing profile
  const { data: existing } = await supabase
    .from('professionals')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (existing) return res.status(409).json({ error: 'You already have a professional profile. Use PATCH to update it.' })

  const b = req.body ?? {}
  const { business_name, professional_type, bio, phone, whatsapp, email, website,
          counties_served, specialties, years_experience, certifications, min_project_kes } = b

  if (!business_name?.trim()) return res.status(400).json({ error: 'business_name is required.' })
  if (!professional_type || !PRO_TYPES.includes(professional_type)) {
    return res.status(400).json({ error: `professional_type must be one of: ${PRO_TYPES.join(', ')}` })
  }
  if (!Array.isArray(counties_served) || counties_served.length === 0) {
    return res.status(400).json({ error: 'At least one county is required.' })
  }

  // Generate unique slug
  let baseSlug = slugify(business_name.trim())
  let slug = baseSlug
  for (let n = 1; n <= 50; n++) {
    const { data: ex } = await supabase.from('professionals').select('id').eq('slug', slug).maybeSingle()
    if (!ex) break
    slug = `${baseSlug}-${n}`
    if (n === 50) { slug = `${baseSlug}-${Date.now().toString(36)}`; break }
  }

  try {
    const { data, error } = await supabase
      .from('professionals')
      .insert({
        user_id: user.id,
        business_name: String(business_name).trim().slice(0, 200),
        slug,
        professional_type: String(professional_type),
        bio: bio ? String(bio).slice(0, 2000) : null,
        phone: phone ? String(phone).slice(0, 30) : null,
        whatsapp: whatsapp ? String(whatsapp).slice(0, 30) : null,
        email: email ? String(email).slice(0, 200) : null,
        website: website ? String(website).slice(0, 300) : null,
        counties_served: counties_served.map(c => String(c).trim()).filter(Boolean).slice(0, 20),
        specialties: Array.isArray(specialties)
          ? specialties.map(s => String(s).trim()).filter(Boolean).slice(0, 20)
          : [],
        years_experience: years_experience ? Math.min(Math.max(parseInt(years_experience, 10) || 0, 0), 80) : null,
        certifications: Array.isArray(certifications)
          ? certifications.map(c => String(c).trim()).filter(Boolean).slice(0, 10)
          : [],
        min_project_kes: min_project_kes ? Math.max(parseInt(min_project_kes, 10) || 0, 0) : null,
        is_verified: false,
        is_active: true,
      })
      .select('*')
      .single()

    if (error) throw error
    res.status(201).json({ professional: data })
  } catch (err) {
    console.error('Professional create error:', err)
    res.status(500).json({ error: err.message ?? 'Internal server error' })
  }
})

// PATCH /api/professionals/me — update own professional profile
app.patch('/api/professionals/me', async (req, res) => {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Authentication required.' })

  const b = req.body ?? {}
  const allowed = ['bio','phone','whatsapp','email','website','counties_served','specialties','years_experience','certifications','min_project_kes','is_active']
  const patch = {}

  if (b.bio !== undefined) patch.bio = b.bio ? String(b.bio).slice(0, 2000) : null
  if (b.phone !== undefined) patch.phone = b.phone ? String(b.phone).slice(0, 30) : null
  if (b.whatsapp !== undefined) patch.whatsapp = b.whatsapp ? String(b.whatsapp).slice(0, 30) : null
  if (b.email !== undefined) patch.email = b.email ? String(b.email).slice(0, 200) : null
  if (b.website !== undefined) patch.website = b.website ? String(b.website).slice(0, 300) : null
  if (Array.isArray(b.counties_served)) patch.counties_served = b.counties_served.map(c => String(c).trim()).filter(Boolean).slice(0, 20)
  if (Array.isArray(b.specialties)) patch.specialties = b.specialties.map(s => String(s).trim()).filter(Boolean).slice(0, 20)
  if (b.years_experience !== undefined) patch.years_experience = b.years_experience ? Math.min(Math.max(parseInt(b.years_experience, 10) || 0, 0), 80) : null
  if (Array.isArray(b.certifications)) patch.certifications = b.certifications.map(c => String(c).trim()).filter(Boolean).slice(0, 10)
  if (b.min_project_kes !== undefined) patch.min_project_kes = b.min_project_kes ? Math.max(parseInt(b.min_project_kes, 10) || 0, 0) : null
  if (typeof b.is_active === 'boolean') patch.is_active = b.is_active

  if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'No updatable fields provided.' })

  try {
    const { data, error } = await supabase
      .from('professionals')
      .update(patch)
      .eq('user_id', user.id)
      .select('*')
      .single()

    if (error) throw error
    res.json({ professional: data })
  } catch (err) {
    console.error('Professional update error:', err)
    res.status(500).json({ error: err.message ?? 'Internal server error' })
  }
})

// GET /api/professionals/:slug — public profile detail
app.get('/api/professionals/:slug', async (req, res) => {
  const slug = String(req.params.slug || '').slice(0, 80)
  if (!slug) return res.status(400).json({ error: 'slug required' })

  try {
    const { data, error } = await supabase
      .from('professionals')
      .select('id, business_name, slug, professional_type, bio, counties_served, specialties, years_experience, profile_image_url, portfolio_urls, certifications, min_project_kes, is_verified, phone, whatsapp, email, website, created_at')
      .eq('slug', slug)
      .eq('is_active', true)
      .single()

    if (error || !data) return res.status(404).json({ error: 'Professional not found.' })
    res.json({ professional: data })
  } catch (err) {
    console.error('Professional detail error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// =============================
// START SERVER
// =============================
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
