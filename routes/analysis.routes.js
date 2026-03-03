const express = require("express");
const router = express.Router();
const analysisController = require("../controllers/analysis.controller");
const { authenticateUser, verifyRole } = require("../middleware/authMiddleware");

// ==================== ROUTES PUBLIQUES (sans authentification) ====================

// Récupérer les rapports publics (accessible à tous, même sans login)
// Note: Cette route doit être AVANT router.use(authenticateUser)
router.get(
  "/public/lots",
  analysisController.getPublicLots
);

// ==================== ROUTES PROTÉGÉES (avec authentification) ====================

// Toutes les routes suivantes nécessitent une authentification
router.use(authenticateUser);

// Analyser un fichier CSV (responsable uniquement)
router.post(
  "/csv/:fileId/analyze",
  verifyRole("responsable", "admin"),
  analysisController.analyzeCSVFile
);

// Récupérer tous les lots analysés (responsable et admin)
router.get(
  "/lots",
  verifyRole("responsable", "admin"),
  analysisController.getAnalyzedLots
);

// Récupérer les lots d'un fichier spécifique (responsable et admin)
router.get(
  "/lots/file/:fileId",
  verifyRole("responsable", "admin"),
  analysisController.getAnalyzedLots
);

// Récupérer les statistiques d'analyse (responsable et admin)
router.get(
  "/stats",
  verifyRole("responsable", "admin"),
  analysisController.getAnalysisStats
);

// Générer un PDF pour un lot (responsable et admin)
router.get(
  "/lot/:lotId/pdf",
  verifyRole("responsable", "admin"),
  analysisController.generateLotPDF
);

// Ajouter cette route
router.get(
  "/lot/:lotId/pdf",
  authenticateUser,
  analysisController.downloadLotPDF
);
// ==================== ROUTES DE PUBLICATION (responsable uniquement) ====================

// PUBLIER un rapport pour le rendre visible aux clients
router.put(
  "/lot/:lotId/publish",
  verifyRole("responsable", "admin"),
  analysisController.publishLotReport
);

// Dépublier un rapport (le retirer de la vue client)
router.put(
  "/lot/:lotId/unpublish",
  verifyRole("responsable", "admin"),
  analysisController.unpublishLotReport
);

// ==================== ROUTES ADMIN UNIQUEMENT ====================

// (Optionnel) Route pour admin - voir tous les lots publiés/non publiés
//router.get(
  //"/admin/all-lots",
  //verifyRole("admin"),
 // analysisController.getAllLotsAdmin
//);

// routes/analysis.routes.js - Ajoutez cette route

/**
 * GET /analysis/debug/:fileId - Debug un fichier CSV
 */
router.get(
  "/debug/:fileId",
  authenticateUser,
  analysisController.debugCSVFile
);

module.exports = router;