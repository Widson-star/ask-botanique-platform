import express from 'express'
import { createClient } from '@supabase/supabase-js'
import cors from 'cors'
import 'dotenv/config';

console.log('URL:', process.env.SUPABASE_URL);
console.log('KEY:', process.env.SUPABASE_KEY);

const app = express()
const PORT = process.env.PORT || 3000

// Enable CORS for frontend
app.use(cors())

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
)

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
// START SERVER
// =============================
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})