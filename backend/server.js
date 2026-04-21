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
// AI CHAT ENDPOINT
// POST /api/chat
// Body: { message: string, history: [{role, content}] }
// =============================

const SYSTEM_PROMPT = `You are the Ask Botanique AI assistant — an expert in East African horticulture and landscaping.
You help landscapers and gardeners select the right plants based on site conditions like rainfall, soil type, sunlight exposure, and maintenance preferences.

Your knowledge covers 171+ East African plant species. When a user describes their site conditions, extract the key parameters (rainfall in mm, soil type: clay/loam/sandy, sunlight: full sun/partial shade/shade) and use the structured plant data provided to give accurate, actionable advice.

Always be specific: cite plant names (both scientific and common), explain suitability scores, highlight match reasons and any warnings.
If you cannot extract site conditions, ask clarifying questions.
Keep responses concise, friendly, and practical — you are talking to working landscapers.
Do not invent plant data; only reference plants from the database context provided.`

function extractConditions(message) {
  const text = message.toLowerCase()
  const conditions = {}

  const rainfallMatch = text.match(/(\d{3,4})\s*mm/)
  if (rainfallMatch) conditions.rainfall = parseInt(rainfallMatch[1])

  if (text.includes('clay')) conditions.soil_type = 'clay'
  else if (text.includes('sandy') || text.includes('sand')) conditions.soil_type = 'sandy'
  else if (text.includes('loam')) conditions.soil_type = 'loam'

  if (text.includes('full sun')) conditions.sunlight = 'Full sun'
  else if (text.includes('partial shade') || text.includes('part shade')) conditions.sunlight = 'Partial shade'
  else if (text.includes('shade') || text.includes('shaded')) conditions.sunlight = 'Shade'

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
        plantContext = `\n\n--- PLANT DATABASE RESULTS (top matches for: rainfall=${conditions.rainfall}mm, soil=${conditions.soil_type}, sunlight=${conditions.sunlight}) ---\n`
        plantContext += scored.map(r =>
          `• ${r.plant.scientific_name} (${r.plant.common_names?.[0] ?? '—'}) | Score: ${r.suitability_score}/100 | Category: ${r.plant.category ?? 'Unknown'} | Height: ${r.plant.max_height_cm ? r.plant.max_height_cm / 100 + 'm' : '?'} | Maintenance: ${r.plant.maintenance_level ?? '?'}\n  Reasons: ${r.match_reasons.join('; ')}\n  Warnings: ${r.warnings.join('; ') || 'None'}`
        ).join('\n')
        plantContext += '\n---'
      }
    } else {
      // Name-based search
      const safeQuery = message.replace(/[^a-zA-Z0-9 \-]/g, '').slice(0, 100)
      const { data: nameMatches } = await supabase
        .from('plants_searchable')
        .select('*, plant_categories(name)')
        .or(`scientific_name.ilike.%${safeQuery}%,common_names_text.ilike.%${safeQuery}%`)
        .limit(5)

      if (nameMatches && nameMatches.length > 0) {
        topPlants = nameMatches.map(p => ({
          plant: {
            id: p.id,
            scientific_name: p.scientific_name,
            common_names: p.common_names,
            category: p.plant_categories?.name,
            description: p.description,
            water_needs: p.water_needs,
            sunlight: p.sunlight,
            maintenance_level: p.maintenance_level,
            image_url: p.image_url,
            thumbnail_url: p.thumbnail_url,
          },
          suitability_score: null,
          match_reasons: [],
          warnings: [],
        }))

        plantContext = `\n\n--- PLANT DATABASE RESULTS (name search: "${safeQuery}") ---\n`
        plantContext += nameMatches.map(p =>
          `• ${p.scientific_name} (${p.common_names?.[0] ?? '—'}) | ${p.plant_categories?.name ?? 'Unknown'} | Sunlight: ${p.sunlight ?? '?'} | Water: ${p.water_needs ?? '?'} | Maintenance: ${p.maintenance_level ?? '?'}\n  Description: ${p.description ?? ''}`
        ).join('\n')
        plantContext += '\n---'
      } else {
        const { data: samplePlants } = await supabase
          .from('plants')
          .select('scientific_name, common_names, sunlight, water_needs, maintenance_level, plant_categories(name)')
          .limit(20)

        if (samplePlants) {
          plantContext = `\n\n--- SAMPLE PLANTS IN DATABASE ---\n`
          plantContext += samplePlants.map(p =>
            `• ${p.scientific_name} (${p.common_names?.[0] ?? '—'}) | ${p.plant_categories?.name ?? 'Unknown'} | Sunlight: ${p.sunlight ?? '?'} | Water: ${p.water_needs ?? '?'}`
          ).join('\n')
          plantContext += '\n---'
        }
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
      plants: topPlants.length > 0 ? topPlants.slice(0, 5) : undefined,
    })
  } catch (error) {
    console.error('Chat error:', error.message)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// =============================
// START SERVER
// =============================
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
