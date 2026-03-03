// services/analysis.service.js

const axios = require('axios');
const ollamaService = require('./ollama.service');

class AnalysisService {
  
  /**
   * Valide l'année (doit être 2026)
   */
  validateYear(year) {
    return year === 2026;
  }

  /**
   * Valide la qualité initiale (doit être excellente)
   */
  validateInitialQuality(quality) {
    return quality && quality.toLowerCase() === 'excellente';
  }

  /**
   * Analyse un lot d'agrumes avec les nouveaux seuils
   */
  analyzeCitrusLot(lot) {
    const issues = [];
    const details = {};

    // Année
    if (!this.validateYear(lot.year)) {
      issues.push(`📅 Année incorrecte (${lot.year} au lieu de 2026)`);
      details.year = "non_conforme";
    } else {
      details.year = "conforme";
    }

    // Qualité initiale
    if (!this.validateInitialQuality(lot.initialQuality)) {
      issues.push(`⭐ Qualité initiale insuffisante (${lot.initialQuality} au lieu de 'excellente')`);
      details.initialQuality = "non_conforme";
    } else {
      details.initialQuality = "conforme";
    }

    // Durée ≤ 21 jours
    if (lot.duration > 21) {
      issues.push(`⏱️ Durée excessive (${lot.duration} jours > 21 jours)`);
      details.duration = "non_conforme";
    } else {
      details.duration = "conforme";
    }

    // Température min 10°C, max 15°C
    if (lot.temperatureMin < 10) {
      issues.push(`🌡️ Température minimale trop basse (${lot.temperatureMin}°C < 10°C)`);
      details.temperatureMin = "non_conforme";
    } else {
      details.temperatureMin = "conforme";
    }
    
    if (lot.temperatureMax > 15) {
      issues.push(`🌡️ Température maximale trop élevée (${lot.temperatureMax}°C > 15°C)`);
      details.temperatureMax = "non_conforme";
    } else {
      details.temperatureMax = "conforme";
    }

    // Humidité 85-95%
    if (lot.humidityMin < 85) {
      issues.push(`💧 Humidité minimale trop basse (${lot.humidityMin}% < 85%)`);
      details.humidityMin = "non_conforme";
    } else {
      details.humidityMin = "conforme";
    }
    
    if (lot.humidityMax > 95) {
      issues.push(`💧 Humidité maximale trop élevée (${lot.humidityMax}% > 95%)`);
      details.humidityMax = "non_conforme";
    } else {
      details.humidityMax = "conforme";
    }

    // Pression 1005-1020 hPa
    if (lot.pressure < 1005 || lot.pressure > 1020) {
      issues.push(`📊 Pression hors normes (${lot.pressure} hPa) - doit être entre 1005 et 1020 hPa`);
      details.pressure = "non_conforme";
    } else {
      details.pressure = "conforme";
    }

    // Pluie ≤ 5 mm
    if (lot.rain > 5) {
      issues.push(`🌧️ Pluie excessive (${lot.rain} mm > 5 mm)`);
      details.rain = "non_conforme";
    } else {
      details.rain = "conforme";
    }

    // Choc entre 0 et 1
    if (lot.shock < 0 || lot.shock > 1) {
      issues.push(`🚛 Niveau de choc hors limites (${lot.shock}) - doit être entre 0 et 1`);
      details.shock = "non_conforme";
    } else {
      details.shock = "conforme";
    }

    // Exposition soleil ≤ 1 heure (60 minutes)
    if (lot.sunExposure > 60) {
      issues.push(`☀️ Exposition soleil excessive (${lot.sunExposure} min > 60 min)`);
      details.sunExposure = "non_conforme";
    } else {
      details.sunExposure = "conforme";
    }

    // Ventilation doit être présente
    if (!lot.ventilation || lot.ventilation.toLowerCase() === 'non') {
      issues.push(`🌀 Ventilation absente ou insuffisante`);
      details.ventilation = "non_conforme";
    } else {
      details.ventilation = "conforme";
    }

    const decision = issues.length === 0 ? "SAIN" : "ENDOMMAGÉ";
    const riskLevel = issues.length >= 3 ? "Élevé" : issues.length >= 1 ? "Moyen" : "Faible";

    return {
      issues,
      decision,
      riskLevel,
      details,
      issueCount: issues.length,
      isCompliant: issues.length === 0
    };
  }

  /**
   * Analyse un lot de tomates avec les nouveaux seuils
   */
  analyzeTomatoLot(lot) {
    console.log('🍅 Analyse lot tomate:', {
      lotId: lot.lotId,
      humidityMesuree: `${lot.humidityMin} - ${lot.humidityMax}%`,
      temperatureMesuree: `${lot.temperatureMin} - ${lot.temperatureMax}°C`
    });

    const issues = [];
    const details = {};

    // Année
    if (!this.validateYear(lot.year)) {
      issues.push(`📅 Année incorrecte (${lot.year} au lieu de 2026)`);
      details.year = "non_conforme";
    } else {
      details.year = "conforme";
    }

    // Qualité initiale
    if (!this.validateInitialQuality(lot.initialQuality)) {
      issues.push(`⭐ Qualité initiale insuffisante (${lot.initialQuality} au lieu de 'excellente')`);
      details.initialQuality = "non_conforme";
    } else {
      details.initialQuality = "conforme";
    }

    // Durée ≤ 7 jours
    if (lot.duration > 7) {
      issues.push(`⏱️ Durée excessive (${lot.duration} jours > 7 jours)`);
      details.duration = "non_conforme";
    } else {
      details.duration = "conforme";
    }

    // Température mesurée vs seuils
    const tempThresholdMin = 12;
    const tempThresholdMax = 20;
    
    if (lot.temperatureMin < tempThresholdMin) {
      issues.push(`🌡️ Température minimale trop basse (${lot.temperatureMin}°C < ${tempThresholdMin}°C)`);
      details.temperatureMin = "non_conforme";
    } else {
      details.temperatureMin = "conforme";
    }
    
    if (lot.temperatureMax > tempThresholdMax) {
      issues.push(`🌡️ Température maximale trop élevée (${lot.temperatureMax}°C > ${tempThresholdMax}°C)`);
      details.temperatureMax = "non_conforme";
    } else {
      details.temperatureMax = "conforme";
    }

    // Humidité mesurée vs seuils
    const humidityThresholdMin = 80;
    const humidityThresholdMax = 90;
    
    if (lot.humidityMin < humidityThresholdMin) {
      issues.push(`💧 Humidité minimale trop basse (${lot.humidityMin}% < ${humidityThresholdMin}%)`);
      details.humidityMin = "non_conforme";
    } else {
      details.humidityMin = "conforme";
    }
    
    if (lot.humidityMax > humidityThresholdMax) {
      issues.push(`💧 Humidité maximale trop élevée (${lot.humidityMax}% > ${humidityThresholdMax}%)`);
      details.humidityMax = "non_conforme";
    } else {
      details.humidityMax = "conforme";
    }

    // Pression 1008-1020 hPa
    if (lot.pressure < 1008 || lot.pressure > 1020) {
      issues.push(`📊 Pression hors normes (${lot.pressure} hPa) - doit être entre 1008 et 1020 hPa`);
      details.pressure = "non_conforme";
    } else {
      details.pressure = "conforme";
    }

    // Pluie ≤ 3 mm
    if (lot.rain > 3) {
      issues.push(`🌧️ Pluie excessive (${lot.rain} mm > 3 mm)`);
      details.rain = "non_conforme";
    } else {
      details.rain = "conforme";
    }

    // Choc entre 0 et 0.5
    if (lot.shock < 0 || lot.shock > 0.5) {
      issues.push(`🚛 Niveau de choc hors limites (${lot.shock}) - doit être entre 0 et 0.5`);
      details.shock = "non_conforme";
    } else {
      details.shock = "conforme";
    }

    // Exposition soleil ≤ 0.5 heure (30 minutes)
    if (lot.sunExposure > 30) {
      issues.push(`☀️ Exposition soleil excessive (${lot.sunExposure} min > 30 min)`);
      details.sunExposure = "non_conforme";
    } else {
      details.sunExposure = "conforme";
    }

    // Ventilation doit être présente
    if (!lot.ventilation || lot.ventilation.toLowerCase() === 'non') {
      issues.push(`🌀 Ventilation absente ou insuffisante`);
      details.ventilation = "non_conforme";
    } else {
      details.ventilation = "conforme";
    }

    const decision = issues.length === 0 ? "SAIN" : "ENDOMMAGÉ";
    const riskLevel = issues.length >= 3 ? "Élevé" : issues.length >= 1 ? "Moyen" : "Faible";

    console.log('📊 Résultat analyse:', {
      lotId: lot.lotId,
      issues: issues.length,
      decision,
      details: {
        temperature: `${lot.temperatureMin}-${lot.temperatureMax}°C ${details.temperatureMin === 'conforme' && details.temperatureMax === 'conforme' ? '✅' : '❌'}`,
        humidity: `${lot.humidityMin}-${lot.humidityMax}% ${details.humidityMin === 'conforme' && details.humidityMax === 'conforme' ? '✅' : '❌'}`
      }
    });

    return {
      issues,
      decision,
      riskLevel,
      details,
      issueCount: issues.length,
      isCompliant: issues.length === 0
    };
  }

  /**
   * Analyse un lot de fraises avec les nouveaux seuils
   */
  analyzeStrawberryLot(lot) {
    const issues = [];
    const details = {};

    // Année
    if (!this.validateYear(lot.year)) {
      issues.push(`📅 Année incorrecte (${lot.year} au lieu de 2026)`);
      details.year = "non_conforme";
    } else {
      details.year = "conforme";
    }

    // Qualité initiale
    if (!this.validateInitialQuality(lot.initialQuality)) {
      issues.push(`⭐ Qualité initiale insuffisante (${lot.initialQuality} au lieu de 'excellente')`);
      details.initialQuality = "non_conforme";
    } else {
      details.initialQuality = "conforme";
    }

    // Durée ≤ 3 jours
    if (lot.duration > 3) {
      issues.push(`⏱️ Durée excessive (${lot.duration} jours > 3 jours)`);
      details.duration = "non_conforme";
    } else {
      details.duration = "conforme";
    }

    // Température min 0°C, max 2°C
    if (lot.temperatureMin < 0) {
      issues.push(`🌡️ Température minimale trop basse (${lot.temperatureMin}°C < 0°C) - risque de gel`);
      details.temperatureMin = "non_conforme";
    } else {
      details.temperatureMin = "conforme";
    }
    
    if (lot.temperatureMax > 2) {
      issues.push(`🌡️ Température maximale trop élevée (${lot.temperatureMax}°C > 2°C)`);
      details.temperatureMax = "non_conforme";
    } else {
      details.temperatureMax = "conforme";
    }

    // Humidité 90-95%
    if (lot.humidityMin < 90) {
      issues.push(`💧 Humidité minimale trop basse (${lot.humidityMin}% < 90%)`);
      details.humidityMin = "non_conforme";
    } else {
      details.humidityMin = "conforme";
    }
    
    if (lot.humidityMax > 95) {
      issues.push(`💧 Humidité maximale trop élevée (${lot.humidityMax}% > 95%)`);
      details.humidityMax = "non_conforme";
    } else {
      details.humidityMax = "conforme";
    }

    // Pression 1010-1025 hPa
    if (lot.pressure < 1010 || lot.pressure > 1025) {
      issues.push(`📊 Pression hors normes (${lot.pressure} hPa) - doit être entre 1010 et 1025 hPa`);
      details.pressure = "non_conforme";
    } else {
      details.pressure = "conforme";
    }

    // Pluie = 0 mm
    if (lot.rain > 0) {
      issues.push(`🌧️ Pluie détectée (${lot.rain} mm) - doit être à 0 mm pour les fraises`);
      details.rain = "non_conforme";
    } else {
      details.rain = "conforme";
    }

    // Choc entre 0 et 0.2
    if (lot.shock < 0 || lot.shock > 0.2) {
      issues.push(`🚛 Niveau de choc hors limites (${lot.shock}) - doit être entre 0 et 0.2`);
      details.shock = "non_conforme";
    } else {
      details.shock = "conforme";
    }

    // Exposition soleil ≤ 0.17 heure (10 minutes)
    if (lot.sunExposure > 10) {
      issues.push(`☀️ Exposition soleil excessive (${lot.sunExposure} min > 10 min)`);
      details.sunExposure = "non_conforme";
    } else {
      details.sunExposure = "conforme";
    }

    // Ventilation doit être présente
    if (!lot.ventilation || lot.ventilation.toLowerCase() === 'non') {
      issues.push(`🌀 Ventilation absente ou insuffisante`);
      details.ventilation = "non_conforme";
    } else {
      details.ventilation = "conforme";
    }

    const decision = issues.length === 0 ? "SAIN" : "ENDOMMAGÉ";
    const riskLevel = issues.length >= 2 ? "Élevé" : issues.length >= 1 ? "Moyen" : "Faible";

    return {
      issues,
      decision,
      riskLevel,
      details,
      issueCount: issues.length,
      isCompliant: issues.length === 0
    };
  }

  /**
   * Analyse un lot de dattes avec les nouveaux seuils
   */
  analyzeDateLot(lot) {
    const issues = [];
    const details = {};

    // Année
    if (!this.validateYear(lot.year)) {
      issues.push(`📅 Année incorrecte (${lot.year} au lieu de 2026)`);
      details.year = "non_conforme";
    } else {
      details.year = "conforme";
    }

    // Qualité initiale
    if (!this.validateInitialQuality(lot.initialQuality)) {
      issues.push(`⭐ Qualité initiale insuffisante (${lot.initialQuality} au lieu de 'excellente')`);
      details.initialQuality = "non_conforme";
    } else {
      details.initialQuality = "conforme";
    }

    // Durée ≤ 60 jours
    if (lot.duration > 60) {
      issues.push(`⏱️ Durée excessive (${lot.duration} jours > 60 jours)`);
      details.duration = "non_conforme";
    } else {
      details.duration = "conforme";
    }

    // Température min 0°C, max 5°C
    if (lot.temperatureMin < 0) {
      issues.push(`🌡️ Température minimale trop basse (${lot.temperatureMin}°C < 0°C)`);
      details.temperatureMin = "non_conforme";
    } else {
      details.temperatureMin = "conforme";
    }
    
    if (lot.temperatureMax > 5) {
      issues.push(`🌡️ Température maximale trop élevée (${lot.temperatureMax}°C > 5°C)`);
      details.temperatureMax = "non_conforme";
    } else {
      details.temperatureMax = "conforme";
    }

    // Humidité 60-75%
    if (lot.humidityMin < 60) {
      issues.push(`💧 Humidité minimale trop basse (${lot.humidityMin}% < 60%) - risque dessèchement`);
      details.humidityMin = "non_conforme";
    } else {
      details.humidityMin = "conforme";
    }
    
    if (lot.humidityMax > 75) {
      issues.push(`💧 Humidité maximale trop élevée (${lot.humidityMax}% > 75%) - risque moisissure`);
      details.humidityMax = "non_conforme";
    } else {
      details.humidityMax = "conforme";
    }

    // Pression 1005-1025 hPa
    if (lot.pressure < 1005 || lot.pressure > 1025) {
      issues.push(`📊 Pression hors normes (${lot.pressure} hPa) - doit être entre 1005 et 1025 hPa`);
      details.pressure = "non_conforme";
    } else {
      details.pressure = "conforme";
    }

    // Pluie = 0 mm
    if (lot.rain > 0) {
      issues.push(`🌧️ Pluie détectée (${lot.rain} mm) - doit être à 0 mm pour les dattes`);
      details.rain = "non_conforme";
    } else {
      details.rain = "conforme";
    }

    // Choc entre 0 et 2
    if (lot.shock < 0 || lot.shock > 2) {
      issues.push(`🚛 Niveau de choc hors limites (${lot.shock}) - doit être entre 0 et 2`);
      details.shock = "non_conforme";
    } else {
      details.shock = "conforme";
    }

    // Exposition soleil ≤ 2 heures (120 minutes)
    if (lot.sunExposure > 120) {
      issues.push(`☀️ Exposition soleil excessive (${lot.sunExposure} min > 120 min)`);
      details.sunExposure = "non_conforme";
    } else {
      details.sunExposure = "conforme";
    }

    // Ventilation doit être présente
    if (!lot.ventilation || lot.ventilation.toLowerCase() === 'non') {
      issues.push(`🌀 Ventilation absente ou insuffisante`);
      details.ventilation = "non_conforme";
    } else {
      details.ventilation = "conforme";
    }

    const decision = issues.length === 0 ? "SAIN" : "ENDOMMAGÉ";
    const riskLevel = issues.length >= 3 ? "Élevé" : issues.length >= 1 ? "Moyen" : "Faible";

    return {
      issues,
      decision,
      riskLevel,
      details,
      issueCount: issues.length,
      isCompliant: issues.length === 0
    };
  }

  /**
   * Calcule le niveau de risque
   */
  calculateRiskLevel(issueCount) {
    if (issueCount === 0) return "Faible";
    if (issueCount <= 2) return "Moyen";
    return "Élevé";
  }

  /**
   * Détermine le type de produit à partir de la catégorie
   */
  detectProductType(category) {
    const cat = category.toLowerCase();
    if (cat.includes('tomate')) return 'tomate';
    if (cat.includes('agrume') || cat.includes('orange') || cat.includes('citron')) return 'agrume';
    if (cat.includes('fraise')) return 'fraise';
    if (cat.includes('datte')) return 'datte';
    return 'tomate';
  }

  /**
   * Génère un rapport détaillé formaté pour un lot
   */
  generateDetailedReport(lot, analysisResult, productType) {
    const productNames = {
      tomate: "Tomates",
      agrume: "Agrumes",
      fraise: "Fraises",
      datte: "Dattes"
    };

    const productName = productNames[productType] || productType;

    let report = `📄 Rapport d'analyse – Lot ${lot.lotId}\n\n`;
    report += `Catégorie : ${productName}\n`;
    report += `Décision automatique : `;
    
    if (analysisResult.decision === "SAIN") {
      report += `✅ SAIN\n\n`;
    } else {
      report += `❌ ENDOMMAGÉ\n\n`;
    }

    report += `📋 Informations générales (issues du fichier CSV)\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    report += `lot_id : ${lot.lotId || 'N/A'}\n`;
    report += `category : ${productName}\n`;
    report += `mode_transport : ${lot.transportMode || 'non spécifié'}\n`;
    report += `region_origine : ${lot.originRegion || 'non spécifiée'}\n`;
    report += `region_destination : ${lot.destinationRegion || 'non spécifiée'}\n`;
    report += `distance_km : ${lot.distance || 0} km\n`;
    report += `poids_kg : ${lot.weight || 0} kg\n\n`;

    report += `🔍 Vérification des seuils obligatoires 2026 – ${productName}\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

    // Année
    report += `✔ année fixe = 2026\n`;
    report += `→ Valeur mesurée : ${lot.year || 2026} `;
    report += lot.year === 2026 ? `✅ Conforme\n` : `❌ Non conforme\n`;

    // Qualité initiale
    report += `✔ qualité initiale = excellente\n`;
    report += `→ Valeur mesurée : ${lot.initialQuality || 'non spécifiée'} `;
    report += lot.initialQuality?.toLowerCase() === 'excellente' ? `✅ Conforme\n` : `❌ Non conforme\n`;

    // Durée
    const durationLimits = { tomate: 7, agrume: 21, fraise: 3, datte: 60 };
    report += `✔ durée de voyage ≤ ${durationLimits[productType]} jours\n`;
    report += `→ Valeur mesurée : ${lot.duration || 0} jours `;
    report += lot.duration <= durationLimits[productType] ? `✅ Conforme\n` : `❌ Non conforme\n`;

    // Température
    const tempLimits = {
      tomate: { min: 12, max: 20 },
      agrume: { min: 10, max: 15 },
      fraise: { min: 0, max: 2 },
      datte: { min: 0, max: 5 }
    };
    report += `✔ température minimale autorisée = ${tempLimits[productType].min} °C\n`;
    report += `✔ température maximale autorisée = ${tempLimits[productType].max} °C\n`;
    report += `→ temperature_mesuree-min : ${lot.temperatureMin?.toFixed(2) || 0} °C\n`;
    report += `→ temperature_mesuree-max : ${lot.temperatureMax?.toFixed(2) || 0} °C\n`;
    const tempOk = lot.temperatureMin >= tempLimits[productType].min && 
                   lot.temperatureMax <= tempLimits[productType].max;
    report += `→ Résultat : ${tempOk ? `✅ Conforme` : `❌ Non conforme`}\n`;

    // Humidité
    const humidityLimits = {
      tomate: { min: 80, max: 90 },
      agrume: { min: 85, max: 95 },
      fraise: { min: 90, max: 95 },
      datte: { min: 60, max: 75 }
    };
    report += `✔ humidité minimale autorisée = ${humidityLimits[productType].min} %\n`;
    report += `✔ humidité maximale autorisée = ${humidityLimits[productType].max} %\n`;
    report += `→ humidite_%_mesure_min : ${lot.humidityMin?.toFixed(2) || 0} %\n`;
    report += `→ humidite_%_mesure_max : ${lot.humidityMax?.toFixed(2) || 0} %\n`;
    const humidityOk = lot.humidityMin >= humidityLimits[productType].min && 
                       lot.humidityMax <= humidityLimits[productType].max;
    report += `→ Résultat : ${humidityOk ? `✅ Conforme` : `❌ Non conforme`}\n`;

    // Pression
    const pressureLimits = {
      tomate: { min: 1008, max: 1020 },
      agrume: { min: 1005, max: 1020 },
      fraise: { min: 1010, max: 1025 },
      datte: { min: 1005, max: 1025 }
    };
    report += `✔ pression minimale autorisée = ${pressureLimits[productType].min} hPa\n`;
    report += `✔ pression maximale autorisée = ${pressureLimits[productType].max} hPa\n`;
    report += `→ pression_hpa : ${lot.pressure?.toFixed(2) || 0} hPa\n`;
    const pressureOk = lot.pressure >= pressureLimits[productType].min && 
                       lot.pressure <= pressureLimits[productType].max;
    report += `→ Résultat : ${pressureOk ? `✅ Conforme` : `❌ Non conforme`}\n`;

    // Pluie
    const rainLimits = { tomate: 3, agrume: 5, fraise: 0, datte: 0 };
    report += `✔ pluie maximale autorisée = ${rainLimits[productType]} mm\n`;
    report += `→ pluie_mm : ${lot.rain?.toFixed(2) || 0} mm\n`;
    report += `→ Résultat : ${lot.rain <= rainLimits[productType] ? `✅ Conforme` : `❌ Non conforme`}\n`;

    // Choc
    const shockLimits = {
      tomate: { min: 0, max: 0.5 },
      agrume: { min: 0, max: 1 },
      fraise: { min: 0, max: 0.2 },
      datte: { min: 0, max: 2 }
    };
    report += `✔ choc transport autorisé entre ${shockLimits[productType].min} et ${shockLimits[productType].max}\n`;
    report += `→ choc_transport : ${lot.shock?.toFixed(4) || 0}\n`;
    const shockOk = lot.shock >= shockLimits[productType].min && 
                    lot.shock <= shockLimits[productType].max;
    report += `→ Résultat : ${shockOk ? `✅ Conforme` : `❌ Non conforme`}\n`;

    // Exposition soleil
    const sunLimits = { tomate: 30, agrume: 60, fraise: 10, datte: 120 };
    report += `✔ temps d’exposition au soleil ≤ ${sunLimits[productType]} minutes (${(sunLimits[productType]/60).toFixed(2)} heure)\n`;
    report += `→ temps_exposition_soleil_h : ${(lot.sunExposure/60).toFixed(2)} h (${lot.sunExposure} minutes)\n`;
    report += `→ Résultat : ${lot.sunExposure <= sunLimits[productType] ? `✅ Conforme` : `❌ Non conforme`}\n`;

    // Ventilation
    report += `✔ ventilation = oui\n`;
    report += `→ ventilation : ${lot.ventilation || 'non spécifié'}\n`;
    const ventOk = lot.ventilation && lot.ventilation.toLowerCase() !== 'non';
    report += `→ Résultat : ${ventOk ? `✅ Conforme` : `❌ Non conforme`}\n\n`;

    if (analysisResult.issues.length > 0) {
      report += `⚠️ Cause(s) de non-conformité\n`;
      report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      analysisResult.issues.forEach(issue => {
        report += `${issue}\n`;
      });
      report += `\n`;
    }

    report += `📌 Conclusion finale\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    
    if (analysisResult.decision === "SAIN") {
      report += `✅ Tous les paramètres sont conformes. Le lot est SAIN.\n`;
    } else {
      const mainIssue = analysisResult.issues[0] || "Non-conformité détectée";
      report += `➡ ${mainIssue}\n\n`;
      if (analysisResult.issues.length > 0) {
        report += `Bien que certains paramètres environnementaux soient conformes,\n`;
        report += `➡ le dépassement des seuils rend le lot ENDOMMAGÉ selon les règles strictes 2026.\n`;
      }
    }

    report += `\n`;
    report += `Analysé automatiquement par ExportChain AI\n`;
    report += `Date d’analyse : ${new Date().toLocaleDateString('fr-FR')}\n`;
    report += `Système : Module Intelligent de Validation Logistique\n`;

    return report;
  }

  /**
   * Analyse un lot selon son type avec les nouveaux seuils
   */
  analyzeLotByRules(lotData, productType = "tomate") {
    switch(productType.toLowerCase()) {
      case "tomate":
        return this.analyzeTomatoLot(lotData);
      case "agrume":
        return this.analyzeCitrusLot(lotData);
      case "fraise":
        return this.analyzeStrawberryLot(lotData);
      case "datte":
        return this.analyzeDateLot(lotData);
      default:
        return this.analyzeTomatoLot(lotData);
    }
  }

  /**
   * Analyse un lot avec Ollama et génère un rapport détaillé
   * Version corrigée avec événement analysis:new-report
   */
  async analyzeLot(lotData, productType = "tomate", io = null, userId = null, fileId = null, lotIndex = null, totalLots = null) {
    try {
      const ruleAnalysis = this.analyzeLotByRules(lotData, productType);
      const detailedReport = this.generateDetailedReport(lotData, ruleAnalysis, productType);
      
      let ollamaReport = {};
      try {
        ollamaReport = await ollamaService.generateLotReport(
          lotData, 
          ruleAnalysis, 
          productType,
          io,
          userId,
          fileId,
          lotIndex,
          totalLots
        );
      } catch (error) {
        console.log('⚠️ Ollama non disponible, utilisation du rapport détaillé uniquement');
        ollamaReport = { fallback: true };
      }
      
      const result = {
        ...lotData,
        analysis: ruleAnalysis,
        detailedReport,
        ollamaReport,
        productType,
        analyzedAt: new Date()
      };

      // Émettre le résultat individuel via WebSocket - CORRECTION
      if (io && userId) {
        const reportData = {
          lotId: lotData.lotId || `LOT-${Date.now()}`,
          productType,
          analysis: ruleAnalysis,
          lotData,
          detailedReport,
          aiReport: ollamaReport,
          fileName: fileId,
          progress: {
            current: lotIndex,
            total: totalLots,
            completed: true
          },
          timestamp: new Date()
        };
        
        io.to(`user_${userId}`).emit('analysis:new-report', reportData);
        
        console.log(`📡 analysis:new-report émis pour lot ${reportData.lotId} (${lotIndex}/${totalLots})`);
      }

      return result;

    } catch (error) {
      console.error('❌ Erreur analyse lot:', error.message);
      
      const ruleAnalysis = this.analyzeLotByRules(lotData, productType);
      const detailedReport = this.generateDetailedReport(lotData, ruleAnalysis, productType);
      
      if (io && userId) {
        io.to(`user_${userId}`).emit('analysis:lot-error', {
          lotId: lotData.lotId || `LOT-${Date.now()}`,
          error: error.message,
          progress: {
            current: lotIndex,
            total: totalLots
          }
        });
      }

      return {
        ...lotData,
        analysis: ruleAnalysis,
        detailedReport,
        ollamaReport: { error: error.message, fallback: true },
        productType,
        analyzedAt: new Date()
      };
    }
  }

  /**
   * Analyse plusieurs lots avec mise à jour progressive
   * Version corrigée avec événements cohérents
   */
  async analyzeBatch(lots, productType = "tomate", io = null, userId = null, fileId = null) {
    console.log(`📦 Analyse progressive de ${lots.length} lots (produit: ${productType})...`);
    
    const results = [];
    const startTime = Date.now();

    if (io && userId) {
      io.to(`user_${userId}`).emit('analysis:started', {
        fileId,
        totalLots: lots.length,
        productType,
        startTime
      });
    }

    for (let i = 0; i < lots.length; i++) {
      try {
        console.log(`📊 Lot ${i + 1}/${lots.length} en cours...`);
        
        if (io && userId) {
          io.to(`user_${userId}`).emit('analysis:batch-progress', {
            current: i + 1,
            total: lots.length,
            percentage: Math.round(((i + 1) / lots.length) * 100),
            status: 'processing',
            currentLot: lots[i].lotId || `Lot ${i + 1}`
          });
        }
        console.log(`📤 Envoi lot ${i+1} avec userId:`, userId); // AJOUTER CE LOG
        const result = await this.analyzeLot(
          lots[i], 
          productType, 
          io, 
          userId, 
          fileId, 
          i + 1, 
          lots.length
        );
        
        results.push(result);
        await new Promise(resolve => setTimeout(resolve, 50));
        
      } catch (error) {
        console.error(`❌ Erreur sur lot ${i + 1}:`, error.message);
        
        const ruleAnalysis = this.analyzeLotByRules(lots[i], productType);
        const detailedReport = this.generateDetailedReport(lots[i], ruleAnalysis, productType);
        
        const fallbackResult = {
          ...lots[i],
          analysis: { 
            issues: ["Erreur d'analyse"], 
            decision: "ERREUR",
            isCompliant: false
          },
          detailedReport: `❌ Erreur d'analyse pour ce lot: ${error.message}\n\n${detailedReport}`,
          ollamaReport: { error: error.message, fallback: true },
          productType,
          analyzedAt: new Date()
        };
        results.push(fallbackResult);

        if (io && userId) {
          io.to(`user_${userId}`).emit('analysis:lot-error', {
            lotId: lots[i].lotId || `LOT-${Date.now()}`,
            error: error.message,
            progress: {
              current: i + 1,
              total: lots.length
            }
          });
        }
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Analyse batch terminée : ${results.length} lots traités en ${duration}s`);
    
    const sains = results.filter(r => r.analysis?.decision === "SAIN").length;
    const endommages = results.filter(r => r.analysis?.decision === "ENDOMMAGÉ").length;
    const erreurs = results.filter(r => r.analysis?.decision === "ERREUR").length;

    if (io && userId) {
      io.to(`user_${userId}`).emit('analysis:completed', {
        fileId,
        totalLots: results.length,
        duration,
        stats: { sains, endommages, erreurs }
      });
    }
    
    return results;
  }

  /**
   * Teste la connexion à Ollama
   */
  async testConnection() {
    try {
      const response = await axios.get('http://localhost:11434/api/tags');
      return {
        success: true,
        models: response.data.models || [],
        message: "✅ Ollama connecté"
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: "❌ Ollama non disponible - lancez 'ollama serve'"
      };
    }
  }

  /**
   * Récupère les informations sur Ollama
   */
  async getOllamaInfo() {
    try {
      const response = await axios.get('http://localhost:11434/api/tags');
      return {
        available: true,
        models: response.data.models,
        version: "Ollama détecté"
      };
    } catch (error) {
      return {
        available: false,
        error: error.message,
        version: "Ollama non disponible"
      };
    }
  }
}

module.exports = new AnalysisService();