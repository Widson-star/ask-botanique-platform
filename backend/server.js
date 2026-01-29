import express from 'express'
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
// START SERVER
// =============================
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})