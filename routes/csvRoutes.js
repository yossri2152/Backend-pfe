const express = require("express");
const router = express.Router();
const csvController = require("../controllers/csvController");
const { authenticateUser, verifyRole } = require("../middleware/authMiddleware");
const upload = require("../middlewares/upload");

// Middleware pour vérifier que l'utilisateur est propriétaire du fichier (pour les modifications)
const checkFileOwnership = async (req, res, next) => {
  try {
    const CSVFile = require("../models/CSVFile");
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
        message: "Les administrateurs ne peuvent pas modifier les fichiers"
      });
    }

    // Responsable ne peut modifier que ses propres fichiers
    if (file.createdBy.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: "Vous n'avez pas les droits pour modifier ce fichier"
      });
    }

    req.fileOwner = file.createdBy.toString();
    next();
  } catch (error) {
    console.error('❌ Erreur checkFileOwnership:', error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur"
    });
  }
};

// Toutes les routes CSV nécessitent une authentification
router.use(authenticateUser);

// ==================== ROUTES SPÉCIFIQUES (doivent être avant les routes avec paramètres) ====================

// Route pour admin : obtenir tous les fichiers CSV de tous les utilisateurs
router.get("/all", verifyRole("admin"), csvController.getAllCSVFiles);

// ==================== ROUTES POUR RESPONSABLE ET ADMIN ====================

// Obtenir ses propres fichiers CSV (pour responsable) ou tous les siens (pour admin via /all)
router.get("/", verifyRole("responsable", "admin"), csvController.getUserCSVFiles);

// Obtenir les informations d'un fichier
router.get("/:id/info", verifyRole("responsable", "admin"), csvController.getCSVFileInfo);

// Obtenir les données paginées d'un fichier
router.get("/:id/data", verifyRole("responsable", "admin"), csvController.getCSVFileData);

// Uploader un nouveau fichier CSV (accessible aux deux)
router.post(
  "/upload",
  verifyRole("responsable", "admin"),
  upload.single("csvFile"),
  csvController.uploadCSVFile
);

// Télécharger un fichier CSV (accessible aux deux)
router.get("/:id/download", verifyRole("responsable", "admin"), csvController.downloadCSVFile);

// ==================== ROUTES POUR RESPONSABLE UNIQUEMENT (modification) ====================

// Mettre à jour un fichier CSV (remplacer) - uniquement responsable et propriétaire
router.put(
  "/:id",
  verifyRole("responsable"),
  checkFileOwnership,
  upload.single("csvFile"),
  csvController.updateCSVFile
);

// Supprimer un fichier CSV - uniquement responsable et propriétaire
router.delete("/:id", verifyRole("responsable"), checkFileOwnership, csvController.deleteCSVFile);

// ==================== ROUTES POUR MANIPULATION DES LIGNES (uniquement responsable et propriétaire) ====================

// Ajouter une ligne - uniquement responsable et propriétaire
router.post("/:id/rows", verifyRole("responsable"), checkFileOwnership, csvController.addRow);

// Modifier une ligne - uniquement responsable et propriétaire
router.put("/:id/rows/:rowIndex", verifyRole("responsable"), checkFileOwnership, csvController.updateRow);

// Supprimer une ligne - uniquement responsable et propriétaire
router.delete("/:id/rows/:rowIndex", verifyRole("responsable"), checkFileOwnership, csvController.deleteRow);

module.exports = router;