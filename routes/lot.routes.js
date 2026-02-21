const express = require("express");
const router = express.Router();
const lotController = require("../controllers/lot.controller");
const { authenticateUser, verifyRole } = require("../middleware/authMiddleware");

// Toutes les routes nécessitent authentification
router.use(authenticateUser);

/**
 * GET /lots/results - Voir tous les résultats d'analyse
 */
router.get("/results", authenticateUser, async (req, res) => {
  try {
    const { page = 1, limit = 20, productType, decision } = req.query;
    const query = {};
    
    if (productType) query.productType = productType;
    if (decision) query.decision = decision;

    const results = await Lot.find(query)
      .sort({ analyzedAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Lot.countDocuments(query);

    res.json({
      success: true,
      data: {
        results,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error("❌ Erreur get results:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des résultats"
    });
  }
});

/**
 * GET /lots/results/:id - Voir un résultat spécifique
 */
router.get("/results/:id", authenticateUser, async (req, res) => {
  try {
    const result = await Lot.findById(req.params.id);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Résultat non trouvé"
      });
    }

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error("❌ Erreur get result:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération du résultat"
    });
  }
});

/**
 * POST /lots/analyze-uploads - Analyser tous les fichiers CSV du dossier uploads
 */
router.post("/analyze-uploads", authenticateUser, verifyRole("responsable", "admin"), async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const csv = require('csv-parser');
    const AnalysisService = require("../services/analysis.service");
    const OpenAIService = require("../services/openai.service");
    const Lot = require("../models/Lot");

    const uploadsDir = path.join(__dirname, '../../uploads');
    
    // Lire tous les fichiers CSV du dossier
    const files = fs.readdirSync(uploadsDir).filter(f => f.endsWith('.csv'));
    
    if (files.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Aucun fichier CSV trouvé dans le dossier uploads"
      });
    }

    const results = [];
    const errors = [];

    for (const file of files) {
      const filePath = path.join(uploadsDir, file);
      console.log(`📄 Analyse du fichier: ${file}`);
      
      // Lire le CSV
      const lots = await new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (data) => results.push(data))
          .on('end', () => resolve(results))
          .on('error', reject);
      });

      console.log(`   ${lots.length} lots trouvés`);

      // Analyser chaque lot
      for (const [index, lot] of lots.entries()) {
        try {
          // Déterminer le type de produit depuis le nom du fichier
          let productType = 'tomate';
          if (file.toLowerCase().includes('agrume')) productType = 'agrume';
          else if (file.toLowerCase().includes('fraise')) productType = 'fraise';
          else if (file.toLowerCase().includes('datte')) productType = 'datte';

          // Convertir les données (adapté à ton format CSV)
          const lotData = {
            temperature: parseFloat(lot.Température || lot.temperature || 0),
            duration: parseFloat(lot.Durée || lot.duration || 0),
            pressure: parseFloat(lot.Pression || lot.pressure || 1013),
            rain: parseFloat(lot.Pluie || lot.rain || 0),
            humidity: parseFloat(lot.Humidité || lot.humidity || 0),
            ventilation: lot.Ventilation || lot.ventilation || "moyenne",
            shock: lot.Choc || lot.shock || "non",
            sunExposure: parseFloat(lot.Soleil || lot.sunExposure || 0)
          };

          // Analyse métier
          const analysis = AnalysisService.analyzeLot(lotData, productType);
          
          // Rapport IA
          const aiReport = await OpenAIService.generateTomatoLotReport(lotData, analysis);

          // Sauvegarder dans MongoDB
          const lotDocument = new Lot({
            productType,
            fileName: file,
            lineNumber: index + 2,
            originalData: lot,
            ...lotData,
            issues: analysis.issues,
            decision: analysis.decision,
            severity: analysis.severity,
            aiReport,
            analyzedAt: new Date()
          });

          await lotDocument.save();

          results.push({
            fileName: file,
            line: index + 2,
            productType,
            decision: analysis.decision,
            issues: analysis.issues,
            severity: analysis.severity,
            aiReport: aiReport.resume,
            id: lotDocument._id
          });

        } catch (err) {
          errors.push({
            fileName: file,
            line: index + 2,
            error: err.message
          });
        }
      }
    }

    // Statistiques
    const stats = {
      totalFichiers: files.length,
      totalLots: results.length,
      lotsSains: results.filter(r => r.decision === "Lot Sain").length,
      lotsEndommages: results.filter(r => r.decision === "Lot Endommagé").length,
      success: results.length,
      errors: errors.length
    };

    res.json({
      success: true,
      data: {
        stats,
        results: results.slice(0, 100), // Limiter à 100 résultats pour la réponse
        errors: errors.slice(0, 50)
      }
    });

  } catch (error) {
    console.error("❌ Erreur analyse uploads:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de l'analyse des fichiers"
    });
  }
});

// Analyse d'un lot
router.post("/analyze", lotController.analyzeLotWithAI);
router.post("/analyze-basic", lotController.analyzeLot);
router.post("/analyze-csv", lotController.analyzeLotFromCSV);

module.exports = router;