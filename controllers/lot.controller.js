const AnalysisService = require('../services/analysis.service');

/**
 * Contrôleur pour les lots (compatible avec Ollama)
 */
class LotController {
  
  /**
   * Analyse un lot avec IA (via Ollama)
   * POST /api/lots/analyze
   */
  async analyzeLotWithAI(req, res) {
    try {
      const { lotData, productType = "tomate" } = req.body;
      
      if (!lotData) {
        return res.status(400).json({
          success: false,
          message: "Données du lot manquantes"
        });
      }

      console.log(`📊 Analyse lot avec IA (produit: ${productType})...`);
      
      const result = await AnalysisService.analyzeLot(lotData, productType);
      
      res.json({
        success: true,
        data: result
      });
      
    } catch (error) {
      console.error('❌ Erreur analyse lot avec IA:', error);
      res.status(500).json({
        success: false,
        message: error.message || "Erreur lors de l'analyse du lot"
      });
    }
  }

  /**
   * Analyse basique d'un lot (sans IA, seulement les règles)
   * POST /api/lots/analyze-basic
   */
  async analyzeLot(req, res) {
    try {
      const { lotData, productType = "tomate" } = req.body;
      
      if (!lotData) {
        return res.status(400).json({
          success: false,
          message: "Données du lot manquantes"
        });
      }

      console.log(`📊 Analyse basique lot (produit: ${productType})...`);
      
      const analysis = AnalysisService.analyzeLotByRules(lotData, productType);
      
      res.json({
        success: true,
        data: {
          ...lotData,
          analysis
        }
      });
      
    } catch (error) {
      console.error('❌ Erreur analyse basique:', error);
      res.status(500).json({
        success: false,
        message: error.message || "Erreur lors de l'analyse basique"
      });
    }
  }

  /**
   * Analyse un lot depuis un CSV (une seule ligne)
   * POST /api/lots/analyze-csv
   */
  async analyzeLotFromCSV(req, res) {
    try {
      const { csvData, productType = "tomate" } = req.body;
      
      if (!csvData || !Array.isArray(csvData)) {
        return res.status(400).json({
          success: false,
          message: "Données CSV manquantes ou invalides"
        });
      }

      console.log(`📊 Analyse CSV: ${csvData.length} lignes (produit: ${productType})...`);
      
      const results = [];
      
      for (const [index, row] of csvData.entries()) {
        try {
          // Convertir les données (adapté au format de votre CSV)
          const lotData = {
            temperature: parseFloat(row.Température || row.temperature || row.temp || 0),
            duration: parseFloat(row.Durée || row.duration || row.days || 0),
            pressure: parseFloat(row.Pression || row.pressure || 1013),
            rain: parseFloat(row.Pluie || row.rain || 0),
            humidity: parseFloat(row.Humidité || row.humidity || 0),
            ventilation: row.Ventilation || row.ventilation || "moyenne",
            shock: row.Choc || row.shock || "non",
            sunExposure: parseFloat(row.Soleil || row.sunExposure || 0)
          };

          // Analyse par règles
          const analysis = AnalysisService.analyzeLotByRules(lotData, productType);
          
          results.push({
            line: index + 2, // +2 car ligne 1 = en-têtes
            originalData: row,
            normalizedData: lotData,
            analysis
          });
        } catch (rowError) {
          console.error(`❌ Erreur sur ligne ${index + 2}:`, rowError.message);
          results.push({
            line: index + 2,
            originalData: row,
            error: rowError.message,
            analysis: {
              issues: ["Erreur de parsing"],
              decision: "Erreur d'analyse",
              riskLevel: "Inconnu"
            }
          });
        }
      }
      
      // Statistiques
      const stats = {
        total: results.length,
        sains: results.filter(r => r.analysis?.decision === "Lot Sain").length,
        endommages: results.filter(r => r.analysis?.decision === "Lot Endommagé").length,
        erreurs: results.filter(r => r.error || r.analysis?.decision === "Erreur d'analyse").length
      };

      res.json({
        success: true,
        count: results.length,
        stats,
        data: results
      });
      
    } catch (error) {
      console.error('❌ Erreur analyse CSV:', error);
      res.status(500).json({
        success: false,
        message: error.message || "Erreur lors de l'analyse CSV"
      });
    }
  }

  /**
   * Analyse complète d'un lot avec IA (version simplifiée)
   * POST /api/lots/analyze-full
   */
  async analyzeLotFull(req, res) {
    try {
      const { lotData, productType = "tomate" } = req.body;
      
      if (!lotData) {
        return res.status(400).json({
          success: false,
          message: "Données du lot manquantes"
        });
      }

      console.log(`📊 Analyse complète lot avec IA (produit: ${productType})...`);
      
      // 1. Analyse par règles
      const ruleAnalysis = AnalysisService.analyzeLotByRules(lotData, productType);
      
      // 2. Génération rapport Ollama
      const ollamaReport = await AnalysisService.generateReportWithOllama(lotData, ruleAnalysis, productType);
      
      // 3. Résultat combiné
      const result = {
        ...lotData,
        analysis: ruleAnalysis,
        aiReport: ollamaReport,
        metadata: {
          analyzedAt: new Date().toISOString(),
          productType,
          version: "1.0",
          source: "ollama-mistral"
        }
      };

      res.json({
        success: true,
        data: result
      });
      
    } catch (error) {
      console.error('❌ Erreur analyse complète:', error);
      
      // Fallback: retourner au moins l'analyse par règles
      try {
        const ruleAnalysis = AnalysisService.analyzeLotByRules(lotData, productType);
        return res.json({
          success: true,
          warning: "Rapport IA non disponible, analyse par règles uniquement",
          data: {
            ...lotData,
            analysis: ruleAnalysis,
            aiReport: { fallback: true, error: error.message }
          }
        });
      } catch (fallbackError) {
        res.status(500).json({
          success: false,
          message: error.message || "Erreur lors de l'analyse complète"
        });
      }
    }
  }

  /**
   * Teste la connexion à Ollama
   * GET /api/lots/test-ollama
   */
  async testOllama(req, res) {
    try {
      const result = await AnalysisService.testConnection();
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Erreur test Ollama",
        error: error.message
      });
    }
  }

  /**
   * Récupère les informations sur Ollama
   * GET /api/lots/ollama-info
   */
  async getOllamaInfo(req, res) {
    try {
      const info = await AnalysisService.getOllamaInfo();
      res.json({
        success: true,
        data: info
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new LotController();