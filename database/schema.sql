-- ============================================
-- ASK BOTANIQUE PLANT DATABASE SCHEMA v1
-- East Africa Plant Intelligence System
-- ============================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ======================
-- CATEGORIES
-- ======================
CREATE TABLE plant_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT
);

-- ======================
-- PLANTS (core table)
-- ======================
CREATE TABLE plants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    scientific_name TEXT NOT NULL,
    common_names TEXT[],

    category_id UUID REFERENCES plant_categories(id),

    water_needs TEXT,
    sunlight TEXT,
    maintenance_level TEXT,

    max_height_cm INT,
    growth_rate TEXT,

    description TEXT,

    traits JSONB,   -- flexible future attributes

    confidence_score REAL DEFAULT 0.7,

    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

-- ======================
-- CLIMATE ZONES
-- ======================
CREATE TABLE climate_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL
);

CREATE TABLE plant_climate_suitability (
    plant_id UUID REFERENCES plants(id) ON DELETE CASCADE,
    climate_zone_id UUID REFERENCES climate_zones(id),
    suitability_score REAL,
    notes TEXT,
    PRIMARY KEY (plant_id, climate_zone_id)
);

-- ======================
-- SOIL TYPES
-- ======================
CREATE TABLE soil_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL
);

CREATE TABLE plant_soil_compatibility (
    plant_id UUID REFERENCES plants(id) ON DELETE CASCADE,
    soil_type_id UUID REFERENCES soil_types(id),
    compatibility_level TEXT,
    notes TEXT,
    PRIMARY KEY (plant_id, soil_type_id)
);

-- ======================
-- USE CASES
-- ======================
CREATE TABLE uses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL
);

CREATE TABLE plant_uses (
    plant_id UUID REFERENCES plants(id) ON DELETE CASCADE,
    use_id UUID REFERENCES uses(id),
    notes TEXT,
    PRIMARY KEY (plant_id, use_id)
);

-- ======================
-- FIELD OBSERVATIONS
-- Your secret weapon (real-world experience)
-- ======================
CREATE TABLE field_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plant_id UUID REFERENCES plants(id) ON DELETE CASCADE,
    location TEXT,
    note TEXT,
    observed_by TEXT,
    observed_at DATE DEFAULT CURRENT_DATE
);

-- ======================
-- SOURCES (books, research, KHS, etc.)
-- ======================
CREATE TABLE sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT,
    type TEXT,
    year INT
);

CREATE TABLE plant_sources (
    plant_id UUID REFERENCES plants(id) ON DELETE CASCADE,
    source_id UUID REFERENCES sources(id),
    page_ref TEXT,
    confidence REAL,
    PRIMARY KEY (plant_id, source_id)
);

-- ======================
-- INDEXES (speed matters later)
-- ======================
CREATE INDEX idx_plants_name ON plants USING GIN(common_names);
CREATE INDEX idx_traits ON plants USING GIN(traits);
