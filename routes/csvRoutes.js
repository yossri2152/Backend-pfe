const express = require("express");
const router = express.Router();
const csvController = require("../controllers/csvController");
const { authenticateUser, verifyRole } = require("../middleware/authMiddleware");
const upload = require("../middlewares/upload");
const CSVFile = require("../models/CSVFile");

// ==================== MIDDLEWARE DE VÉRIFICATION ====================

/**
 * Middleware pour vérifier que l'utilisateur est propriétaire du fichier
 * Uniquement pour les opérations de modification (PUT, DELETE, manipulation de lignes)
 */
const checkFileOwnership = async (req, res, next) => {
  try {
    const file = await CSVFile.findById(req.params.id);
    
    if (!file) {
      return res.status(404).json({
        success: false,
        message: "Fichier non trouvé"
      });
    }

    // Admin ne peut pas modifier les fichiers des autres
    if (req.user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: "Les administrateurs ne peuvent pas modifier les fichiers. Ils ont un accès en lecture seule."
      });
    }

    // Responsable ne peut modifier que ses propres fichiers
    if (file.createdBy.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: "Vous n'avez pas les droits pour modifier ce fichier. Seul le propriétaire peut le modifier."
      });
    }

    // Stocker le propriétaire pour usage ultérieur
    req.fileOwner = file.createdBy.toString();
    next();
  } catch (error) {
    console.error('❌ Erreur checkFileOwnership:', error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la vérification des droits"
    });
  }
};

/**
 * Middleware pour vérifier que l'utilisateur peut voir le fichier
 * Admin voit tout, responsable ne voit que ses fichiers
 */
const checkFileAccess = async (req, res, next) => {
  try {
    const file = await CSVFile.findById(req.params.id);
    
    if (!file) {
      return res.status(404).json({
        success: false,
        message: "Fichier non trouvé"
      });
    }

    // Admin peut voir tous les fichiers
    if (req.user.role === 'admin') {
      return next();
    }

    // Responsable ne voit que ses fichiers
    if (file.createdBy.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: "Vous n'avez pas accès à ce fichier"
      });
    }

    next();
  } catch (error) {
    console.error('❌ Erreur checkFileAccess:', error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la vérification des droits"
    });
  }
};

// ==================== TOUTES LES ROUTES NÉCESSITENT UNE AUTHENTIFICATION ====================
router.use(authenticateUser);

// ==================== ROUTES SPÉCIFIQUES (doivent être avant les routes avec paramètres) ====================

/**
 * GET /csv/all - Obtenir tous les fichiers CSV (admin uniquement)
 * Permet à l'admin de voir tous les fichiers uploadés par tous les utilisateurs
 */
router.get("/all", verifyRole("admin"), csvController.getAllCSVFiles);

/**
 * GET /csv/ - Obtenir ses propres fichiers
 * Responsable : voit ses fichiers
 * Admin : utilise /all pour tout voir
 */
router.get("/", verifyRole("responsable", "admin"), csvController.getUserCSVFiles);

// ==================== ROUTES DE LECTURE (accessibles à responsable et admin) ====================

/**
 * GET /csv/:id/info - Obtenir les informations d'un fichier
 * Accessible à : responsable (ses fichiers), admin (tous)
 */
router.get(
  "/:id/info",
  verifyRole("responsable", "admin"),
  checkFileAccess,
  csvController.getCSVFileInfo
);

/**
 * GET /csv/:id/data - Obtenir les données paginées d'un fichier
 * Accessible à : responsable (ses fichiers), admin (tous)
 */
router.get(
  "/:id/data",
  verifyRole("responsable", "admin"),
  checkFileAccess,
  csvController.getCSVFileData
);

/**
 * GET /csv/:id/download - Télécharger un fichier
 * Accessible à : responsable (ses fichiers), admin (tous)
 */
router.get(
  "/:id/download",
  verifyRole("responsable", "admin"),
  checkFileAccess,
  csvController.downloadCSVFile
);

// ==================== ROUTES D'UPLOAD (accessibles à responsable et admin) ====================

/**
 * POST /csv/upload - Uploader un nouveau fichier (CSV ou Excel)
 * Accessible à : responsable, admin
 * Admin peut uploader des fichiers qui seront visibles par tous
 */
router.post(
  "/upload",
  verifyRole("responsable", "admin"),
  upload.single("file"),
  csvController.uploadCSVFile
);

// ==================== ROUTES DE MODIFICATION (uniquement responsable et propriétaire) ====================

/**
 * PUT /csv/:id - Mettre à jour un fichier (remplacer)
 * Uniquement : responsable et propriétaire du fichier
 */
router.put(
  "/:id",
  verifyRole("responsable"),
  checkFileOwnership,
  upload.single("file"),
  csvController.updateCSVFile
);

/**
 * DELETE /csv/:id - Supprimer un fichier
 * Uniquement : responsable et propriétaire du fichier
 */
router.delete(
  "/:id",
  verifyRole("responsable"),
  checkFileOwnership,
  csvController.deleteCSVFile
);

// ==================== ROUTES DE MANIPULATION DES LIGNES (uniquement responsable et propriétaire) ====================

/**
 * POST /csv/:id/rows - Ajouter une nouvelle ligne
 * Uniquement : responsable et propriétaire du fichier
 */
router.post(
  "/:id/rows",
  verifyRole("responsable"),
  checkFileOwnership,
  csvController.addRow
);

/**
 * PUT /csv/:id/rows/:rowIndex - Modifier une ligne existante
 * Uniquement : responsable et propriétaire du fichier
 */
router.put(
  "/:id/rows/:rowIndex",
  verifyRole("responsable"),
  checkFileOwnership,
  csvController.updateRow
);

/**
 * DELETE /csv/:id/rows/:rowIndex - Supprimer une ligne
 * Uniquement : responsable et propriétaire du fichier
 */
router.delete(
  "/:id/rows/:rowIndex",
  verifyRole("responsable"),
  checkFileOwnership,
  csvController.deleteRow
);

module.exports = router;