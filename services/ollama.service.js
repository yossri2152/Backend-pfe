// services/ollama.service.js

const axios = require('axios');

class OllamaService {
  constructor() {
    this.baseURL = 'http://localhost:11434';
    this.model = 'mistral';
  }

  /**
   * Génère un rapport d'analyse pour un lot avec Ollama
   * Version corrigée - SANS émissions WebSocket (c'est analysis.service.js qui s'en charge)
   */
  async generateLotReport(lotData, analysisResult, productType = "tomate", io = null, userId = null, fileId = null, lotIndex = null, totalLots = null) {
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
          
          // NE PAS ÉMETTRE D'ÉVÉNEMENT ICI
          // Retourner simplement le rapport
          
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
        
        // NE PAS ÉMETTRE D'ÉVÉNEMENT ICI
        
        return parsed;
      } catch (e) {
        console.log('⚠️ Nettoyage n\'a pas produit de JSON valide');
      }
      
      // Fallback
      const fallbackReport = this.generateFallbackReport(lotData, analysisResult);
      console.log('⚠️ Utilisation du rapport fallback');
      
      // NE PAS ÉMETTRE D'ÉVÉNEMENT ICI
      
      return fallbackReport;

    } catch (error) {
      console.error('❌ Erreur Ollama:', error.message);
      
      const fallbackReport = this.generateFallbackReport(lotData, analysisResult);
      
      // NE PAS ÉMETTRE D'ÉVÉNEMENT ICI
      
      return fallbackReport;
    }
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