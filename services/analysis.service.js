const axios = require('axios');
const ollamaService = require('./ollama.service');

class AnalysisService {
  /**
   * Analyse un lot de tomates
   */
  analyzeTomatoLot(lot) {
    const issues = [];
    const details = {};

    // Température: 12-20°C
    if (lot.temperature < 12) {
      issues.push(`🌡️ Froid physiologique (${lot.temperature}°C < 12°C)`);
      details.temperature = "critique_bas";
    } else if (lot.temperature > 20) {
      issues.push(`🌡️ Température trop élevée (${lot.temperature}°C > 20°C) - ramollissement`);
      details.temperature = "critique_haut";
    } else {
      details.temperature = "optimal";
    }

    // Humidité: 80-90%
    if (lot.humidity < 80) {
      issues.push(`💧 Humidité trop basse (${lot.humidity}% < 80%) - risque dessèchement`);
      details.humidity = "critique_bas";
    } else if (lot.humidity > 90) {
      issues.push(`💧 Humidité trop élevée (${lot.humidity}% > 90%) - risque condensation`);
      details.humidity = "critique_haut";
    } else {
      details.humidity = "optimal";
    }

    // Durée: ≤7 jours
    if (lot.duration > 7) {
      issues.push(`⏱️ Durée excessive (${lot.duration} jours > 7 jours) - moisissure`);
      details.duration = "critique";
    } else {
      details.duration = "optimal";
    }

    // Exposition soleil: ≤30 min
    if (lot.sunExposure > 30) {
      issues.push(`☀️ Exposition soleil excessive (${lot.sunExposure} min > 30 min)`);
      details.sunExposure = "critique";
    } else {
      details.sunExposure = "optimal";
    }

    // Ventilation: Moyenne (anti-condensation)
    const vent = lot.ventilation ? lot.ventilation.toLowerCase() : '';
    if (!vent.includes('moyenne') && !vent.includes('anti-condensation')) {
      issues.push(`🌀 Ventilation inadéquate (${lot.ventilation}) - risque condensation`);
      details.ventilation = "critique";
    } else {
      details.ventilation = "optimal";
    }

    // Choc: Très sensible (aucun choc fort)
    if (lot.shock && parseFloat(lot.shock) > 0.5) {
      issues.push(`🚛 Choc fort détecté (niveau ${lot.shock}) - ecchymoses internes`);
      details.shock = "critique";
    } else {
      details.shock = "optimal";
    }

    const decision = issues.length === 0 ? "Lot Sain" : "Lot Endommagé";
    const riskLevel = issues.length >= 3 ? "Élevé" : issues.length >= 1 ? "Moyen" : "Faible";

    return { issues, decision, riskLevel, details, issueCount: issues.length };
  }

  /**
   * Analyse un lot d'agrumes
   */
  analyzeCitrusLot(lot) {
    const issues = [];
    const details = {};

    // Température: 10-15°C
    if (lot.temperature < 10) {
      issues.push(`🌡️ Froid physiologique (${lot.temperature}°C < 10°C) - risque pour la peau`);
      details.temperature = "critique_bas";
    } else if (lot.temperature > 15) {
      issues.push(`🌡️ Température trop élevée (${lot.temperature}°C > 15°C) - maturation accélérée`);
      details.temperature = "critique_haut";
    } else {
      details.temperature = "optimal";
    }

    // Humidité: 85-95%
    if (lot.humidity < 85) {
      issues.push(`💧 Humidité trop basse (${lot.humidity}% < 85%) - risque dessèchement de la peau`);
      details.humidity = "critique_bas";
    } else if (lot.humidity > 95) {
      issues.push(`💧 Humidité trop élevée (${lot.humidity}% > 95%) - risque moisissure`);
      details.humidity = "critique_haut";
    } else {
      details.humidity = "optimal";
    }

    // Durée: ≤21 jours
    if (lot.duration > 21) {
      issues.push(`⏱️ Durée excessive (${lot.duration} jours > 21 jours) - risque de détérioration`);
      details.duration = "critique";
    } else {
      details.duration = "optimal";
    }

    // Exposition soleil: ≤1h (60 minutes)
    if (lot.sunExposure > 60) {
      issues.push(`☀️ Exposition soleil excessive (${lot.sunExposure} min > 60 min)`);
      details.sunExposure = "critique";
    } else {
      details.sunExposure = "optimal";
    }

    // Ventilation: Bonne (flux continu)
    const vent = lot.ventilation ? lot.ventilation.toLowerCase() : '';
    if (!vent.includes('bonne') && !vent.includes('flux')) {
      issues.push(`🌀 Ventilation inadéquate (${lot.ventilation}) - nécessite flux d'air continu`);
      details.ventilation = "critique";
    } else {
      details.ventilation = "optimal";
    }

    // Choc: Faible tolérance
    if (lot.shock && parseFloat(lot.shock) > 0.8) {
      issues.push(`🚛 Choc détecté (niveau ${lot.shock}) - peut endommager la peau`);
      details.shock = "critique";
    } else {
      details.shock = "optimal";
    }

    const decision = issues.length === 0 ? "Lot Sain" : "Lot Endommagé";
    const riskLevel = issues.length >= 3 ? "Élevé" : issues.length >= 1 ? "Moyen" : "Faible";

    return { issues, decision, riskLevel, details, issueCount: issues.length };
  }

  /**
   * Analyse un lot de fraises
   */
  analyzeStrawberryLot(lot) {
    const issues = [];
    const details = {};

    // Température: 0-2°C
    if (lot.temperature < 0) {
      issues.push(`🌡️ Gel (${lot.temperature}°C < 0°C) - destruction cellulaire`);
      details.temperature = "critique_bas";
    } else if (lot.temperature > 2) {
      issues.push(`🌡️ Température trop élevée (${lot.temperature}°C > 2°C) - ramollissement rapide`);
      details.temperature = "critique_haut";
    } else {
      details.temperature = "optimal";
    }

    // Humidité: 90-95%
    if (lot.humidity < 90) {
      issues.push(`💧 Humidité trop basse (${lot.humidity}% < 90%) - risque dessèchement`);
      details.humidity = "critique_bas";
    } else if (lot.humidity > 95) {
      issues.push(`💧 Humidité trop élevée (${lot.humidity}% > 95%) - risque moisissure`);
      details.humidity = "critique_haut";
    } else {
      details.humidity = "optimal";
    }

    // Durée: ≤3 jours
    if (lot.duration > 3) {
      issues.push(`⏱️ Durée excessive (${lot.duration} jours > 3 jours) - moisissure rapide`);
      details.duration = "critique";
    } else {
      details.duration = "optimal";
    }

    // Exposition soleil: ≤10 min
    if (lot.sunExposure > 10) {
      issues.push(`☀️ Exposition soleil excessive (${lot.sunExposure} min > 10 min)`);
      details.sunExposure = "critique";
    } else {
      details.sunExposure = "optimal";
    }

    // Ventilation: Contrôlée (réfrigérée)
    const vent = lot.ventilation ? lot.ventilation.toLowerCase() : '';
    if (!vent.includes('contrôlée') && !vent.includes('régulée')) {
      issues.push(`🌀 Ventilation inadéquate (${lot.ventilation}) - nécessite contrôle strict`);
      details.ventilation = "critique";
    } else {
      details.ventilation = "optimal";
    }

    // Choc: Extrêmement sensible
    if (lot.shock && parseFloat(lot.shock) > 0.3) {
      issues.push(`🚛 Choc détecté (niveau ${lot.shock}) - fraises extrêmement sensibles`);
      details.shock = "critique";
    } else {
      details.shock = "optimal";
    }

    const decision = issues.length === 0 ? "Lot Sain" : "Lot Endommagé";
    const riskLevel = issues.length >= 2 ? "Élevé" : issues.length >= 1 ? "Moyen" : "Faible";

    return { issues, decision, riskLevel, details, issueCount: issues.length };
  }

  /**
   * Analyse un lot de dattes
   */
  analyzeDateLot(lot) {
    const issues = [];
    const details = {};

    // Température: 0-5°C (réfrigéré) ou ≤10°C (isotherme)
    if (lot.temperature > 10) {
      issues.push(`🌡️ Température trop élevée (${lot.temperature}°C > 10°C) - risque de fermentation`);
      details.temperature = "critique_haut";
    } else if (lot.temperature > 5 && lot.temperature <= 10) {
      details.temperature = "limite"; // Mode isotherme acceptable
    } else if (lot.temperature >= 0 && lot.temperature <= 5) {
      details.temperature = "optimal";
    } else if (lot.temperature < 0) {
      issues.push(`🌡️ Température trop basse (${lot.temperature}°C < 0°C) - risque de gel`);
      details.temperature = "critique_bas";
    }

    // Humidité: 60-75%
    if (lot.humidity < 60) {
      issues.push(`💧 Humidité trop basse (${lot.humidity}% < 60%) - risque dessèchement`);
      details.humidity = "critique_bas";
    } else if (lot.humidity > 75) {
      issues.push(`💧 Humidité trop élevée (${lot.humidity}% > 75%) - risque moisissure`);
      details.humidity = "critique_haut";
    } else {
      details.humidity = "optimal";
    }

    // Durée: ≤60 jours
    if (lot.duration > 60) {
      issues.push(`⏱️ Durée excessive (${lot.duration} jours > 60 jours) - risque de détérioration`);
      details.duration = "critique";
    } else {
      details.duration = "optimal";
    }

    // Exposition soleil: ≤2h (120 minutes)
    if (lot.sunExposure > 120) {
      issues.push(`☀️ Exposition soleil excessive (${lot.sunExposure} min > 120 min)`);
      details.sunExposure = "critique";
    } else {
      details.sunExposure = "optimal";
    }

    // Ventilation: Faible à contrôlée
    const vent = lot.ventilation ? lot.ventilation.toLowerCase() : '';
    if (vent.includes('forte') || vent.includes('excessive')) {
      issues.push(`🌀 Ventilation excessive (${lot.ventilation}) - risque dessèchement`);
      details.ventilation = "critique";
    } else {
      details.ventilation = "optimal";
    }

    // Choc: Sensible
    if (lot.shock && parseFloat(lot.shock) > 1.5) {
      issues.push(`🚛 Choc important détecté (niveau ${lot.shock}) - peut endommager les dattes`);
      details.shock = "critique";
    } else {
      details.shock = "optimal";
    }

    const decision = issues.length === 0 ? "Lot Sain" : "Lot Endommagé";
    const riskLevel = issues.length >= 3 ? "Élevé" : issues.length >= 1 ? "Moyen" : "Faible";

    return { issues, decision, riskLevel, details, issueCount: issues.length };
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
   * Détermine le type de produit à partir du nom de fichier
   */
  detectProductType(fileName) {
    const name = fileName.toLowerCase();
    if (name.includes('tomate')) return 'tomate';
    if (name.includes('agrume') || name.includes('orange') || name.includes('citron')) return 'agrume';
    if (name.includes('fraise')) return 'fraise';
    if (name.includes('datte')) return 'datte';
    return 'tomate'; // par défaut
  }

  /**
   * Analyse un lot générique selon son type (Moteur de règles)
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
   * Analyse un lot avec Ollama (version progressive avec WebSockets)
   */
  async analyzeLotWithProgress(lotData, productType = "tomate", io = null, userId = null, fileId = null, lotIndex = null, totalLots = null) {
    try {
      // 1. Analyse par règles
      const ruleAnalysis = this.analyzeLotByRules(lotData, productType);
      
      // 2. Génération du rapport Ollama avec WebSockets
      const aiReport = await ollamaService.generateLotReport(
        lotData, 
        ruleAnalysis, 
        productType,
        io,
        userId,
        fileId,
        lotIndex,
        totalLots
      );
      
      const result = {
        ...lotData,
        analysis: ruleAnalysis,
        aiReport,
        productType,
        analyzedAt: new Date()
      };

      // Émettre le résultat individuel via WebSocket
      if (io && userId) {
        io.to(`user_${userId}`).emit('analysis:lot-completed', {
          lotId: lotData.lotId || `LOT-${Date.now()}`,
          productType,
          analysis: ruleAnalysis,
          aiReport,
          progress: {
            current: lotIndex,
            total: totalLots,
            completed: true
          }
        });
      }

      return result;

    } catch (error) {
      console.error('❌ Erreur analyse lot avec Ollama:', error.message);
      
      const ruleAnalysis = this.analyzeLotByRules(lotData, productType);
      
      // Émettre l'erreur via WebSocket
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
        aiReport: { 
          error: error.message,
          fallback: true,
          resume: "Rapport IA non disponible, analyse par règles uniquement",
          conclusion: ruleAnalysis.decision
        },
        productType,
        analyzedAt: new Date()
      };
    }
  }

  /**
   * Analyse plusieurs lots avec mise à jour progressive (version améliorée)
   */
  async analyzeBatch(lots, productType = "tomate", io = null, userId = null, fileId = null) {
    console.log(`📦 Analyse progressive de ${lots.length} lots (produit: ${productType})...`);
    
    const results = [];
    const startTime = Date.now();

    // Émettre le début de l'analyse
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
        
        // Émettre la progression
        if (io && userId) {
          io.to(`user_${userId}`).emit('analysis:progress', {
            current: i + 1,
            total: lots.length,
            percentage: Math.round(((i + 1) / lots.length) * 100),
            status: 'processing',
            currentLot: lots[i].lotId || `Lot ${i + 1}`
          });
        }
        
        // Analyser le lot avec progression
        const result = await this.analyzeLotWithProgress(
          lots[i], 
          productType, 
          io, 
          userId, 
          fileId, 
          i + 1, 
          lots.length
        );
        
        results.push(result);

        // Petit délai pour éviter de surcharger Ollama
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Erreur sur lot ${i + 1}:`, error.message);
        
        // Fallback
        const ruleAnalysis = this.analyzeLotByRules(lots[i], productType);
        const fallbackResult = {
          ...lots[i],
          analysis: ruleAnalysis,
          aiReport: { 
            error: error.message,
            fallback: true,
            resume: "Rapport IA non disponible",
            conclusion: ruleAnalysis.decision
          },
          productType,
          analyzedAt: new Date()
        };
        results.push(fallbackResult);

        // Émettre l'erreur
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
    
    // Émettre la fin de l'analyse
    if (io && userId) {
      io.to(`user_${userId}`).emit('analysis:completed', {
        fileId,
        totalLots: results.length,
        duration,
        stats: {
          sains: results.filter(r => r.analysis?.decision === "Lot Sain").length,
          endommages: results.filter(r => r.analysis?.decision === "Lot Endommagé").length,
          erreurs: results.filter(r => r.analysis?.decision === "Erreur d'analyse").length
        }
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
        message: "✅ Ollama connecté",
        url: "http://localhost:11434"
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