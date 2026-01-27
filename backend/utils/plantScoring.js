/**
 * Calculate plant suitability score based on user conditions
 * @param {Object} plant - Plant object from database
 * @param {Object} userConditions - User's environmental conditions
 * @returns {Object} - {score, reasons, warnings}
 */
export function calculateSuitability(plant, userConditions) {
  let score = 0;
  const reasons = [];
  const warnings = [];

  // 1. RAINFALL MATCH (30 points possible)
  const rainfall = userConditions.rainfall;
  if (plant.min_rainfall && plant.max_rainfall) {
    if (rainfall >= plant.min_rainfall && rainfall <= plant.max_rainfall) {
      score += 30;
      reasons.push(`Thrives in ${rainfall}mm annual rainfall`);
    } else if (rainfall < plant.min_rainfall) {
      score += 10;
      warnings.push(`Needs supplemental irrigation (requires ${plant.min_rainfall}mm+)`);
    } else if (rainfall > plant.max_rainfall) {
      score += 15;
      warnings.push(`May need improved drainage (optimal max: ${plant.max_rainfall}mm)`);
    }
  }

  // 2. SUNLIGHT MATCH (25 points possible)
  if (plant.sunlight && userConditions.sunlight) {
    const plantSunlight = plant.sunlight.toLowerCase();
    const userSunlight = userConditions.sunlight.toLowerCase();
    
    if (plantSunlight === userSunlight) {
      score += 25;
      reasons.push(`Perfect sunlight match (${plant.sunlight})`);
    } else if (plantSunlight.includes('partial') || userSunlight.includes('partial')) {
      score += 15;
      reasons.push(`Can adapt to ${userConditions.sunlight}`);
    } else {
      score += 5;
      warnings.push(`Prefers ${plant.sunlight}, you selected ${userConditions.sunlight}`);
    }
  }

  // 3. SOIL MATCH (20 points possible)
  if (plant.soil_types && plant.soil_types.length > 0 && userConditions.soil_type) {
    const soilMatch = plant.soil_types.some(soil => 
      soil.toLowerCase() === userConditions.soil_type.toLowerCase()
    );
    
    if (soilMatch) {
      score += 20;
      reasons.push(`Thrives in ${userConditions.soil_type} soil`);
    } else {
      score += 8;
      warnings.push(`Prefers ${plant.soil_types.join(' or ')} soil`);
    }
  }

  // 4. MAINTENANCE LEVEL (15 points possible)
  if (plant.maintenance_level) {
    const maintenance = plant.maintenance_level.toLowerCase();
    if (maintenance === 'low') {
      score += 15;
      reasons.push('Low-maintenance plant');
    } else if (maintenance === 'medium') {
      score += 10;
      reasons.push('Moderate maintenance required');
    } else {
      score += 5;
      warnings.push('High-maintenance plant - requires regular care');
    }
  }

  // 5. NATIVE SPECIES BONUS (10 points possible)
  if (plant.native_to_region === true) {
    score += 10;
    reasons.push('Native East African species - well-adapted to local conditions');
  }

  return { 
    score: Math.min(score, 100), // Cap at 100
    reasons, 
    warnings 
  };
}