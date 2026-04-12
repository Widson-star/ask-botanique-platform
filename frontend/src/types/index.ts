// ============================
// ASK BOTANIQUE — SHARED TYPES
// ============================

export interface Plant {
  id: string
  scientific_name: string
  common_names: string[]
  category: string | null
  description: string | null
  max_height_cm: number | null
  water_needs: string | null
  sunlight: string | null
  maintenance_level: string | null
  image_url: string | null
  thumbnail_url: string | null
  functions: string[] | null
  image_credits: string | null
}

export interface PlantRecommendation {
  plant: Plant
  suitability_score: number
  match_reasons: string[]
  warnings: string[]
}

export interface RecommendationResponse {
  total_analyzed: number
  recommendations: PlantRecommendation[]
  user_conditions: {
    rainfall: number
    soil_type: string
    sunlight: string
    function: string | null
  }
}

// ============================
// CHAT TYPES
// ============================

export type MessageRole = 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  plants?: PlantRecommendation[]
  timestamp: Date
}

export interface ChatRequest {
  message: string
  history: { role: MessageRole; content: string }[]
}

export interface ChatResponse {
  reply: string
  plants?: PlantRecommendation[]
}

// ============================
// AUTH TYPES
// ============================

export interface AuthUser {
  id: string
  email: string | undefined
}
