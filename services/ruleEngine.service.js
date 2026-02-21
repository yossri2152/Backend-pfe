class RuleEngineService {
  /**
   * Analyse un lot de tomates selon les seuils définis
   * @param {Object} lot - Données du lot
   * @returns {Object} - Résultat de l'analyse
   */
  analyzeTomatoLot(lot) {
    const issues = [];
    let riskLevel = "Faible";

    // 🌡️ Température
    if (lot.temperature < 10) {
      issues.push("🌡️ Froid physiologique (<10°C)");
    } else if (lot.temperature > 25) {
      issues.push("🌡️ Ramollissement dû à la chaleur (>25°C)");
    }

    // ⏳ Durée
    if (lot.duration > 7) {
      issues.push("⏳ Durée excessive (>7 jours) - Risque de moisissure");
    }

    // 🌬️ Pression
    if (lot.pressure < 1005) {
      issues.push("🌬️ Pression trop basse (<1005 hPa) - Conditions instables");
    } else if (lot.pressure > 1025) {
      issues.push("🌬️ Pression trop haute (>1025 hPa)");
    }

    // 🌧️ Pluie
    if (lot.rain > 5) {
      issues.push("🌧️ Pluie excessive (>5 mm) - Risque de contamination");
    }

    // 💧 Humidité
    if (lot.humidity < 75) {
      issues.push("💧 Humidité trop basse (<75%) - Risque de dessèchement");
    } else if (lot.humidity > 95) {
      issues.push("💧 Humidité trop haute (>95%) - Risque de condensation");
    }

    // 🚛 Choc
    if (lot.shock && lot.shock.toLowerCase().includes("oui")) {
      issues.push("🚛 Choc détecté - Très sensible aux chocs");
    }

    // ☀️ Exposition soleil
    if (lot.sunExposure > 30) {
      issues.push("☀️ Exposition solaire excessive (>30 min)");
    }

    // Déterminer le niveau de risque
    if (issues.length >= 3) {
      riskLevel = "Élevé";
    } else if (issues.length >= 1) {
      riskLevel = "Moyen";
    }

    // Décision finale
    const decision = issues.length === 0 ? "Lot Sain" : "Lot Endommagé";

    return {
      issues,
      riskLevel,
      decision,
      issueCount: issues.length
    };
  }

  /**
   * Analyse générique pour différents types de produits
   * @param {Object} lot - Données du lot
   * @param {Object} thresholds - Seuils personnalisés
   * @returns {Object} - Résultat de l'analyse
   */
  analyzeLot(lot, thresholds) {
    const issues = [];
    
    // Utiliser les seuils fournis ou les seuils par défaut
    const t = thresholds || {
      temperature: { min: 12, max: 20 },
      duration: { max: 7 },
      pressure: { min: 1008, max: 1020 },
      rain: { max: 3 },
      humidity: { min: 80, max: 90 },
      sunExposure: { max: 30 }
    };

    // Température
    if (lot.temperature < t.temperature.min) {
      issues.push(`🌡️ Température trop basse (<${t.temperature.min}°C)`);
    } else if (lot.temperature > t.temperature.max) {
      issues.push(`🌡️ Température trop haute (>${t.temperature.max}°C)`);
    }

    // Durée
    if (lot.duration > t.duration.max) {
      issues.push(`⏳ Durée excessive (>${t.duration.max} jours)`);
    }

    // Pression
    if (lot.pressure < t.pressure.min) {
      issues.push(`🌬️ Pression trop basse (<${t.pressure.min} hPa)`);
    } else if (lot.pressure > t.pressure.max) {
      issues.push(`🌬️ Pression trop haute (>${t.pressure.max} hPa)`);
    }

    // Pluie
    if (lot.rain > t.rain.max) {
      issues.push(`🌧️ Pluie excessive (>${t.rain.max} mm)`);
    }

    // Humidité
    if (lot.humidity < t.humidity.min) {
      issues.push(`💧 Humidité trop basse (<${t.humidity.min}%)`);
    } else if (lot.humidity > t.humidity.max) {
      issues.push(`💧 Humidité trop haute (>${t.humidity.max}%)`);
    }

    // Exposition soleil
    if (lot.sunExposure > t.sunExposure.max) {
      issues.push(`☀️ Exposition solaire excessive (>${t.sunExposure.max} min)`);
    }

    const decision = issues.length === 0 ? "Lot Sain" : "Lot Endommagé";

    return {
      issues,
      decision,
      issueCount: issues.length
    };
  }
}

module.exports = new RuleEngineService();