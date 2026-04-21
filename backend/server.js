import express from 'express'
import Groq from 'groq-sdk'
import { createClient } from '@supabase/supabase-js'
import cors from 'cors'
import 'dotenv/config';

import { calculateSuitability } from './utils/plantScoring.js';


const app = express()
const PORT = process.env.PORT || 3000

// Enable CORS for frontend
app.use(cors())

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
)

if (!process.env.GROQ_API_KEY) {
  console.error('FATAL: GROQ_API_KEY is not set')
  process.exit(1)
}
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// =============================
// ROOT
// =============================
app.get('/', (req, res) => {
  res.send('Ask Botanique API running 🌱')
})

// =============================
// CATEGORY
// GET /plants/category/Groundcover
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
    res.status(500).json({ error: err.message })
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
    res.status(500).json({ error: err.message })
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
      query = query.or(
        `scientific_name.ilike.%${search}%,common_names_text.ilike.%${search}%`
      )
    }

    if (sunlight) {
      query = query.eq('sunlight', sunlight)
    }

    if (water) {
      query = query.eq('water_needs', water)
    }

    if (category) {
      query = query.eq('category', category)
    }

    const { data, error } = await query

    if (error) return res.status(500).json(error)

    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// =============================
// RECOMMENDATION ENGINE ENDPOINT
// GET /api/recommend
// =============================
app.get('/api/recommend', async (req, res) => {
  try {
    const { rainfall, soil_type, sunlight, category, function: plantFunction } = req.query;

    // Validation
    if (!rainfall || !soil_type || !sunlight) {
      return res.status(400).json({ 
        error: 'Missing required parameters: rainfall, soil_type, sunlight' 
      });
    }

    // Build query
    let query = supabase
      .from('plants')
      .select(`
        *,
        plant_categories(name)
      `);

    // Optional: filter by category first
    if (category) {
      const { data: categoryData } = await supabase
        .from('plant_categories')
        .select('id')
        .eq('name', category)
        .single();
      
      if (categoryData) {
        query = query.eq('category_id', categoryData.id);
      }
    }

    // NEW: Filter by function if provided
    if (plantFunction && plantFunction !== '') {
      query = query.contains('functions', [plantFunction]);
    }

    const { data: plants, error } = await query;

    if (error) throw error;

    // Score each plant
    const userConditions = {
      rainfall: parseInt(rainfall),
      soil_type,
      sunlight
    };

    const scoredPlants = plants.map(plant => {
      const { score, reasons, warnings } = calculateSuitability(plant, userConditions);
      
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
          // NEW: Include image and functions in response
          image_url: plant.image_url,
          thumbnail_url: plant.thumbnail_url,
          functions: plant.functions,
          image_credits: plant.image_credits
        },
        suitability_score: score,
        match_reasons: reasons,
        warnings: warnings
      };
    });

    // Sort by score (highest first)
    scoredPlants.sort((a, b) => b.suitability_score - a.suitability_score);

    // Return top 10 recommendations
    res.json({
      total_analyzed: plants.length,
      recommendations: scoredPlants.slice(0, 10),
      user_conditions: {
        ...userConditions,
        function: plantFunction || null
      }
    });

  } catch (error) {
    console.error('Recommendation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// =============================
// AI CHAT ENDPOINT
// POST /api/chat
// Body: { message: string, history: [{role, content}] }
// =============================
app.use(express.json())

const SYSTEM_PROMPT = `You are the Ask Botanique AI assistant — an expert in East African horticulture and landscaping.
You help landscapers and gardeners select the right plants based on site conditions like rainfall, soil type, sunlight exposure, and maintenance preferences.

Your knowledge covers 171+ East African plant species. When a user describes their site conditions, extract the key parameters (rainfall in mm, soil type: clay/loam/sandy, sunlight: full sun/partial shade/shade) and use the structured plant data provided to give accurate, actionable advice.

Always be specific: cite plant names (both scientific and common), explain suitability scores, highlight match reasons and any warnings.
If you cannot extract site conditions, ask clarifying questions.
Keep responses concise, friendly, and practical — you are talking to working landscapers.
Do not invent plant data; only reference plants from the database context provided.`

// Extract potential site conditions from a message to decide if we should query the DB
function extractConditions(message) {
  const text = message.toLowerCase()
  const conditions = {}

  // Rainfall hints
  const rainfallMatch = text.match(/(\d{3,4})\s*mm/)
  if (rainfallMatch) conditions.rainfall = parseInt(rainfallMatch[1])

  // Soil type
  if (text.includes('clay')) conditions.soil_type = 'clay'
  else if (text.includes('sandy') || text.includes('sand')) conditions.soil_type = 'sandy'
  else if (text.includes('loam')) conditions.soil_type = 'loam'

  // Sunlight
  if (text.includes('full sun') || text.includes('full sun')) conditions.sunlight = 'Full sun'
  else if (text.includes('partial shade') || text.includes('part shade')) conditions.sunlight = 'Partial shade'
  else if (text.includes('shade') || text.includes('shaded')) conditions.sunlight = 'Shade'

  return conditions
}

app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required' })
    }

    // Try to pull relevant plant data to ground the assistant
    const conditions = extractConditions(message)
    let plantContext = ''
    let topPlants = []

    const hasConditions = conditions.rainfall && conditions.soil_type && conditions.sunlight

    if (hasConditions) {
      // Run the recommendation engine
      let query = supabase.from('plants').select('*, plant_categories(name)')
      const { data: plants, error } = await query

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
      // Try name-based plant search before falling back to sample list
      const { data: nameMatches } = await supabase
        .from('plants_searchable')
        .select('*, plant_categories(name)')
        .or(`scientific_name.ilike.%${message}%,common_names_text.ilike.%${message}%`)
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

        plantContext = `\n\n--- PLANT DATABASE RESULTS (name search: "${message}") ---\n`
        plantContext += nameMatches.map(p =>
          `• ${p.scientific_name} (${p.common_names?.[0] ?? '—'}) | ${p.plant_categories?.name ?? 'Unknown'} | Sunlight: ${p.sunlight ?? '?'} | Water: ${p.water_needs ?? '?'} | Maintenance: ${p.maintenance_level ?? '?'}\n  Description: ${p.description ?? ''}`
        ).join('\n')
        plantContext += '\n---'
      } else {
        // Provide a broader set of plants as context
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

    // Build message history for Claude
    const claudeHistory = history.slice(-10).map(m => ({
      role: m.role,
      content: m.content,
    }))

    // Append the current user message with plant context injected
    claudeHistory.push({
      role: 'user',
      content: message + plantContext,
    })

    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1024,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...claudeHistory,
      ],
    })

    const reply = response.choices[0]?.message?.content
      ?? 'Sorry, I could not generate a response.'

    res.json({
      reply,
      plants: topPlants.length > 0 ? topPlants.slice(0, 5) : undefined,
    })
  } catch (error) {
    console.error('Chat error:', error)
    res.status(500).json({ error: error.message ?? 'Internal server error' })
  }
})

// =============================
// START SERVER
// =============================
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})