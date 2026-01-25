-- ============================================
-- ASK BOTANIQUE SEED DATA v1
-- East African starter plants
-- ============================================


-- ======================
-- CATEGORIES
-- ======================
INSERT INTO plant_categories (name) VALUES
('Grass'),
('Groundcover'),
('Shrub'),
('Tree'),
('Palm'),
('Indoor');


-- ======================
-- CLIMATE ZONES
-- ======================
INSERT INTO climate_zones (name) VALUES
('Coastal'),
('Highland'),
('Urban Nairobi'),
('Semi-Arid'),
('Tropical Wet');


-- ======================
-- SOIL TYPES
-- ======================
INSERT INTO soil_types (name) VALUES
('Sandy'),
('Loamy'),
('Clay'),
('Well-drained'),
('Saline');


-- ======================
-- USE CASES
-- ======================
INSERT INTO uses (name) VALUES
('Lawn'),
('Hedge'),
('Shade'),
('Ornamental'),
('Driveway/Lattice'),
('Indoor Decor'),
('Windbreak');


-- ======================
-- PLANTS
-- ======================

-- 1 Mondo Grass
INSERT INTO plants
(scientific_name, common_names, category_id, water_needs, sunlight, maintenance_level, description)
SELECT
'Ophiopogon japonicus',
ARRAY['Mondo Grass'],
id,
'Low',
'Partial shade',
'Low',
'Dense evergreen groundcover for borders and lattice blocks'
FROM plant_categories WHERE name='Groundcover';


-- 2 Kei Apple
INSERT INTO plants
(scientific_name, common_names, category_id, water_needs, sunlight, maintenance_level, description)
SELECT
'Dovyalis caffra',
ARRAY['Kei Apple'],
id,
'Low',
'Full sun',
'Medium',
'Thorny hedge plant ideal for security fencing and boundaries'
FROM plant_categories WHERE name='Shrub';


-- 3 Italian Cypress
INSERT INTO plants
(scientific_name, common_names, category_id, water_needs, sunlight, maintenance_level, max_height_cm, description)
SELECT
'Cupressus sempervirens',
ARRAY['Italian Cypress'],
id,
'Low',
'Full sun',
'Low',
1200,
'Tall vertical evergreen used for screening and partitions'
FROM plant_categories WHERE name='Tree';


-- 4 Bottlebrush
INSERT INTO plants
(scientific_name, common_names, category_id, water_needs, sunlight, maintenance_level, description)
SELECT
'Callistemon citrinus',
ARRAY['Red Bottlebrush'],
id,
'Moderate',
'Full sun',
'Low',
'Flowering ornamental shrub attracting pollinators'
FROM plant_categories WHERE name='Shrub';


-- 5 Thika Palm
INSERT INTO plants
(scientific_name, common_names, category_id, water_needs, sunlight, maintenance_level, description)
SELECT
'Filicium decipiens',
ARRAY['Thika Palm'],
id,
'Low',
'Full sun',
'Low',
'Hardy palm suited to hot and semi-arid zones'
FROM plant_categories WHERE name='Palm';


-- 6 Araucaria
INSERT INTO plants
(scientific_name, common_names, category_id, water_needs, sunlight, maintenance_level, description)
SELECT
'Araucaria heterophylla',
ARRAY['Norfolk Pine'],
id,
'Moderate',
'Full sun',
'Low',
'Architectural evergreen tree used as ornamental focal point'
FROM plant_categories WHERE name='Tree';


-- 7 Pemba Grass (local lawn grass)
INSERT INTO plants
(scientific_name, common_names, category_id, water_needs, sunlight, maintenance_level, description)
SELECT
'Cynodon dactylon',
ARRAY['Pemba Grass', 'Bermuda Grass'],
id,
'Low',
'Full sun',
'Low',
'Durable lawn grass tolerant to traffic and drought'
FROM plant_categories WHERE name='Grass';


-- 8 Croton
INSERT INTO plants
(scientific_name, common_names, category_id, water_needs, sunlight, maintenance_level, description)
SELECT
'Codiaeum variegatum',
ARRAY['Croton'],
id,
'Moderate',
'Bright light',
'Medium',
'Colorful ornamental foliage plant used in tropical gardens'
FROM plant_categories WHERE name='Shrub';


-- ======================
-- FIELD OBSERVATIONS (your edge)
-- ======================
INSERT INTO field_observations (plant_id, location, note, observed_by)
SELECT id, 'Nairobi Estates', 'Performs well in driveway lattice blocks with minimal irrigation', 'Widson'
FROM plants WHERE scientific_name='Ophiopogon japonicus';

INSERT INTO field_observations (plant_id, location, note, observed_by)
SELECT id, 'Karen Nairobi', 'Excellent security hedge; very drought tolerant', 'Widson'
FROM plants WHERE scientific_name='Dovyalis caffra';


-- ======================
-- SOURCE
-- ======================
INSERT INTO sources (title, type, year)
VALUES ('Gardening in Eastern Africa – Kenya Horticultural Society', 'book', 2017);
