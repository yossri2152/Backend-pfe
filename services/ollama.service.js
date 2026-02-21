const axios = require('axios');

class OllamaService {
  constructor() {
    this.baseURL = 'http://localhost:11434';
    this.model = 'mistral';
  }

  /**
   * Génère un rapport d'analyse pour un lot avec Ollama
   */
  async generateLotReport(lotData, analysisResult, productType = "tomate", io = null, userId = null, fileId = null) {
    try {
      const prompt = this.buildPrompt(lotData, analysisResult, productType);
      
      console.log(`📤 Envoi de la requête à Ollama (modèle: ${this.model})...`);
      
      const response = await axios.post(`${this.baseURL}/api/generate`, {
        model: this.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.2,
          num_predict: 1000,
          top_k: 20,
          top_p: 0.8
        }
      });

      const text = response.data.response;
      console.log(`📥 Réponse reçue (${text.length} caractères)`);
      
      // Essayer d'extraire le JSON
      let parsed = null;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
          console.log('✅ Rapport JSON généré avec succès');
          
          // Émettre un événement WebSocket si disponible
          if (io && userId && fileId) {
            const reportData = {
              lotId: lotData.lotId || `LOT-${Date.now()}`,
              productType,
              analysis: analysisResult,
              aiReport: parsed,
              progress: {
                current: 1,
                total: 1,
                completed: true
              }
            };
            
            // Émettre à l'utilisateur spécifique
            io.to(`user_${userId}`).emit('analysis:progress', reportData);
            
            // Émettre à tous (pour l'admin)
            io.emit('analysis:new-report', {
              ...reportData,
              userId
            });
            
            console.log(`📡 Rapport temps réel envoyé pour le lot ${reportData.lotId}`);
          }
          
          return parsed;
        } catch (e) {
          console.log('⚠️ JSON trouvé mais parsing échoué');
        }
      }
      
      // Méthode 2: Nettoyer le texte
      try {
        let cleaned = text
          .replace(/```json\s*/g, '')
          .replace(/```\s*/g, '')
          .replace(/^[^{]*/, '')
          .replace(/}[^}]*$/, '}')
          .trim();
        
        parsed = JSON.parse(cleaned);
        console.log('✅ JSON extrait après nettoyage');
        
        if (io && userId && fileId) {
          io.to(`user_${userId}`).emit('analysis:progress', {
            lotId: lotData.lotId || `LOT-${Date.now()}`,
            productType,
            analysis: analysisResult,
            aiReport: parsed,
            progress: { current: 1, total: 1, completed: true }
          });
        }
        
        return parsed;
      } catch (e) {
        console.log('⚠️ Nettoyage n\'a pas produit de JSON valide');
      }
      
      // Fallback
      const fallbackReport = this.generateFallbackReport(lotData, analysisResult);
      
      if (io && userId && fileId) {
        io.to(`user_${userId}`).emit('analysis:progress', {
          lotId: lotData.lotId || `LOT-${Date.now()}`,
          productType,
          analysis: analysisResult,
          aiReport: fallbackReport,
          progress: { current: 1, total: 1, completed: true }
        });
      }
      
      return fallbackReport;

    } catch (error) {
      console.error('❌ Erreur Ollama:', error.message);
      return this.generateFallbackReport(lotData, analysisResult);
    }
  }

  /**
   * Analyse plusieurs lots en batch avec mise à jour progressive
   */
  async analyzeBatch(lots, analyzeRuleFunction, productType = "tomate", io = null, userId = null, fileId = null) {
    console.log(`📦 Analyse progressive de ${lots.length} lots avec Ollama (produit: ${productType})...`);
    
    const results = [];
    const startTime = Date.now();

    for (let i = 0; i < lots.length; i++) {
      try {
        const lot = lots[i];
        console.log(`📊 Lot ${i + 1}/${lots.length} en cours...`);
        
        // Émettre la progression
        if (io && userId) {
          io.to(`user_${userId}`).emit('analysis:batch-progress', {
            current: i + 1,
            total: lots.length,
            percentage: Math.round(((i + 1) / lots.length) * 100),
            status: 'processing',
            currentLot: lot.lotId || `Lot ${i + 1}`
          });
        }
        
        // Analyse par règles
        const ruleAnalysis = analyzeRuleFunction(lot);
        
        // Génération du rapport Ollama avec WebSocket
        const aiReport = await this.generateLotReport(
          lot, 
          ruleAnalysis, 
          productType, 
          io, 
          userId, 
          fileId
        );
        
        const result = {
          ...lot,
          analysis: ruleAnalysis,
          aiReport,
          analyzedAt: new Date()
        };
        
        results.push(result);

        // Petit délai pour éviter de surcharger Ollama
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Erreur sur lot ${i + 1}:`, error.message);
        
        // Fallback
        const ruleAnalysis = analyzeRuleFunction(lots[i]);
        const aiReport = this.generateFallbackReport(lots[i], ruleAnalysis);
        
        const result = {
          ...lots[i],
          analysis: ruleAnalysis,
          aiReport,
          analyzedAt: new Date()
        };
        results.push(result);
        
        if (io && userId) {
          io.to(`user_${userId}`).emit('analysis:progress', {
            lotId: lots[i].lotId || `LOT-${Date.now()}`,
            productType,
            analysis: ruleAnalysis,
            aiReport,
            error: error.message
          });
        }
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Analyse batch terminée : ${results.length} lots traités en ${duration}s`);
    
    // Émettre la fin de l'analyse
    if (io && userId) {
      io.to(`user_${userId}`).emit('analysis:completed', {
        total: results.length,
        duration,
        fileId
      });
    }
    
    return results;
  }

  /**
   * Construit le prompt pour l'analyse du lot
   */
  buildPrompt(lotData, analysisResult, productType = "tomate") {
    const productNames = {
      tomate: "tomates",
      agrume: "agrumes",
      fraise: "fraises",
      datte: "dattes"
    };
    
    const productName = productNames[productType] || "produits";
    
    return `[INST] Tu es un expert en contrôle qualité pour l'exportation de ${productName}.

DONNÉES DU LOT DE ${productName.toUpperCase()} :
- Température: ${lotData.temperature || 0}°C
- Humidité: ${lotData.humidity || 0}%
- Pluie: ${lotData.rain || 0} mm
- Pression: ${lotData.pressure || 0} hPa
- Durée transport: ${lotData.duration || 0} jours
- Choc transport: ${lotData.shock || 'non'}
- Exposition soleil: ${lotData.sunExposure || 0} min

ANALYSE PRÉLIMINAIRE :
- Problèmes détectés: ${analysisResult.issues.join(', ') || 'Aucun'}
- Décision: ${analysisResult.decision}

INSTRUCTIONS IMPORTANTES :
Génère un rapport en français avec EXACTEMENT cette structure JSON. Ne mets AUCUN texte avant ou après le JSON.

{
  "resume": "Résumé court de l'analyse du lot en 1-2 phrases",
  "niveau_risque": "${analysisResult.riskLevel || 'Moyen'}",
  "details": {
    "temperature": "Analyse détaillée de la température",
    "humidite": "Analyse détaillée de l'humidité",
    "pression": "Analyse détaillée de la pression",
    "pluie": "Analyse détaillée de la pluie",
    "duree": "Analyse détaillée de la durée",
    "choc": "Analyse détaillée du choc",
    "soleil": "Analyse détaillée de l'exposition solaire"
  },
  "recommandations": ["Recommandation 1", "Recommandation 2", "Recommandation 3"],
  "conclusion": "${analysisResult.decision}"
}

Remplis les champs avec des analyses pertinentes basées sur les données fournies.
[/INST]`;
  }

  /**
   * Extrait les premières phrases d'un texte
   */
  extractSentences(text, count = 2) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    if (sentences.length > 0) {
      return sentences.slice(0, count).join('. ') + '.';
    }
    return "Analyse du lot effectuée.";
  }

  /**
   * Extrait le niveau de risque du texte
   */
  extractRiskLevel(text, analysisResult) {
    const textLower = text.toLowerCase();
    if (textLower.includes('élevé') || textLower.includes('élevée')) return "Élevé";
    if (textLower.includes('moyen')) return "Moyen";
    if (textLower.includes('faible')) return "Faible";
    return analysisResult.riskLevel || "Moyen";
  }

  /**
   * Extrait les recommandations du texte
   */
  extractRecommendations(text) {
    const recos = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
      if (line.match(/^[-*•]\s+/) || line.match(/^\d+\.\s+/) || line.match(/^[Rr]ecommandation/)) {
        const reco = line.replace(/^[-*•\d.\s]+/, '').trim();
        if (reco.length > 10 && !reco.includes('{') && !reco.includes('}')) {
          recos.push(reco);
        }
      }
    }
    
    return recos;
  }

  /**
   * Construit des détails par défaut basés sur l'analyse par règles
   */
  buildDefaultDetails(lotData, analysisResult) {
    return {
      temperature: analysisResult.details?.temperature === "optimal" 
        ? `Température optimale (${lotData.temperature}°C)` 
        : `⚠️ ${analysisResult.issues.find(i => i.includes('🌡️')) || `Température ${lotData.temperature}°C`}`,
      humidite: analysisResult.details?.humidity === "optimal"
        ? `Humidité optimale (${lotData.humidity}%)`
        : `⚠️ ${analysisResult.issues.find(i => i.includes('💧')) || `Humidité ${lotData.humidity}%`}`,
      pression: analysisResult.details?.pressure === "optimal"
        ? `Pression normale (${lotData.pressure} hPa)`
        : `⚠️ Pression anormale (${lotData.pressure} hPa)`,
      pluie: analysisResult.details?.rain === "optimal"
        ? `Pluie normale (${lotData.rain} mm)`
        : `⚠️ ${analysisResult.issues.find(i => i.includes('🌧️')) || `Pluie ${lotData.rain} mm`}`,
      duree: analysisResult.details?.duration === "optimal"
        ? `Durée acceptable (${lotData.duration} jours)`
        : `⚠️ ${analysisResult.issues.find(i => i.includes('⏱️')) || `Durée ${lotData.duration} jours`}`,
      choc: analysisResult.details?.shock === "optimal"
        ? `Pas de choc détecté`
        : `⚠️ ${analysisResult.issues.find(i => i.includes('🚛')) || 'Choc détecté'}`,
      soleil: analysisResult.details?.sunExposure === "optimal"
        ? `Exposition solaire normale (${lotData.sunExposure} min)`
        : `⚠️ ${analysisResult.issues.find(i => i.includes('☀️')) || `Exposition ${lotData.sunExposure} min`}`
    };
  }

  /**
   * Génère un rapport de fallback quand Ollama échoue
   */
  generateFallbackReport(lotData, analysisResult) {
    const riskLevel = analysisResult.issues.length >= 3 ? "Élevé" : 
                     analysisResult.issues.length >= 1 ? "Moyen" : "Faible";
    
    return {
      resume: `Lot présentant ${analysisResult.issues.length} problème(s) : ${analysisResult.issues.join(', ') || 'aucun problème détecté'}`,
      niveau_risque: riskLevel,
      details: {
        temperature: lotData.temperature < 10 ? "❌ Température trop basse - risque de froid physiologique" : 
                    lotData.temperature > 25 ? "❌ Température trop élevée - risque de ramollissement" : 
                    "✅ Température optimale",
        humidite: lotData.humidity < 75 ? "❌ Humidité trop basse - risque de dessèchement" : 
                  lotData.humidity > 95 ? "❌ Humidité trop élevée - risque de condensation" : 
                  "✅ Humidité optimale",
        pression: lotData.pressure < 1005 ? "⚠️ Pression trop basse" : 
                  lotData.pressure > 1025 ? "⚠️ Pression trop haute" : 
                  "✅ Pression normale",
        pluie: lotData.rain > 5 ? "⚠️ Pluie excessive" : "✅ Pluie normale",
        duree: lotData.duration > 7 ? "⚠️ Durée excessive" : "✅ Durée normale",
        choc: lotData.shock === 'oui' ? "⚠️ Choc détecté" : "✅ Pas de choc",
        soleil: lotData.sunExposure > 30 ? "⚠️ Exposition excessive" : "✅ Exposition normale"
      },
      recommandations: [
        "Vérifier les conditions de transport",
        "Contrôler la température à réception",
        "Maintenir la chaîne du froid"
      ],
      conclusion: analysisResult.decision
    };
  }

  /**
   * Analyse un lot avec fallback
   */
  async analyzeLot(lotData, analysisResult, productType = "tomate", io = null, userId = null, fileId = null) {
    try {
      return await this.generateLotReport(lotData, analysisResult, productType, io, userId, fileId);
    } catch (error) {
      console.log('⚠️ Utilisation du fallback pour ce lot');
      return this.generateFallbackReport(lotData, analysisResult);
    }
  }

  /**
   * Teste la connexion à Ollama
   */
  async testConnection() {
    try {
      const response = await axios.get(`${this.baseURL}/api/tags`);
      return {
        success: true,
        models: response.data.models || [],
        message: "✅ Ollama connecté",
        url: this.baseURL
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: "❌ Ollama non disponible - lancez 'ollama serve'"
      };
    }
  }
}

module.exports = new OllamaService();