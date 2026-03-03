// routes/csvRoutes.js

const express = require("express");
const router = express.Router();
const multer = require('multer');
const path = require('path');
const csvController = require("../controllers/csvController");
const { authenticateUser, verifyRole } = require("../middleware/authMiddleware");
const upload = require("../middlewares/upload");
const CSVFile = require("../models/CSVFile");

// Configuration de multer pour l'upload (fallback si upload middleware n'existe pas)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'file-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// Filtrer pour n'accepter que les fichiers CSV
const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
        cb(null, true);
    } else {
        cb(new Error('Seuls les fichiers CSV sont autorisés'), false);
    }
};

const uploadMulter = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // Limite à 10MB
    }
});

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

/**
 * POST /csv/validate - Valider la structure d'un fichier CSV sans le sauvegarder
 * Accessible à tous les utilisateurs authentifiés
 */
router.post(
  "/validate",
  verifyRole("responsable", "admin"),
  upload.single("file"),
  csvController.validateCSVColumns
);

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
 * AVEC VALIDATION DES COLONNES REQUISES
 */
router.post(
  "/upload",
  verifyRole("responsable", "admin"),
  upload.single("file"),
  csvController.uploadCSVFile
);

/**
 * Alternative avec multer direct si le middleware upload ne fonctionne pas
 * POST /csv/upload-direct - Upload avec validation des colonnes
 
router.post(
  "/upload-direct",
  verifyRole("responsable", "admin"),
  uploadMulter.single("file"),
  csvController.uploadCSV // Assurez-vous que cette fonction existe dans csvController
);*/

// ==================== ROUTES DE MODIFICATION (uniquement responsable et propriétaire) ====================

/**
 * PUT /csv/:id - Mettre à jour un fichier (remplacer)
 * Uniquement : responsable et propriétaire du fichier
 * AVEC VALIDATION DES COLONNES REQUISES
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

// ==================== ROUTES POUR COMPATIBILITÉ AVEC LE FRONTEND ====================
// Ces routes sont des alias des routes existantes pour correspondre à ce que le frontend attend

/**
 * GET /csv/files - Alias pour getUserCSVFiles (compatibilité frontend)
 * Responsable : voit ses fichiers
 */
router.get(
  "/files", 
  verifyRole("responsable", "admin"), 
  csvController.getUserCSVFiles
);

/**
 * GET /csv/files/:id - Alias pour getCSVFileInfo
 */
router.get(
  "/files/:id", 
  verifyRole("responsable", "admin"), 
  checkFileAccess, 
  csvController.getCSVFileInfo
);

/**
 * GET /csv/files/:id/data - Alias pour getCSVFileData
 */
router.get(
  "/files/:id/data", 
  verifyRole("responsable", "admin"), 
  checkFileAccess, 
  csvController.getCSVFileData
);

/**
 * GET /csv/files/:id/download - Alias pour downloadCSVFile
 */
router.get(
  "/files/:id/download", 
  verifyRole("responsable", "admin"), 
  checkFileAccess, 
  csvController.downloadCSVFile
);

/**
 * DELETE /csv/files/:id - Alias pour deleteCSVFile
 */
router.delete(
  "/files/:id", 
  verifyRole("responsable"), 
  checkFileOwnership, 
  csvController.deleteCSVFile
);

/**
 * POST /csv/files/:id/rows - Alias pour addRow
 */
router.post(
  "/files/:id/rows", 
  verifyRole("responsable"), 
  checkFileOwnership, 
  csvController.addRow
);

/**
 * PUT /csv/files/:id/rows/:rowIndex - Alias pour updateRow
 */
router.put(
  "/files/:id/rows/:rowIndex", 
  verifyRole("responsable"), 
  checkFileOwnership, 
  csvController.updateRow
);

/**
 * DELETE /csv/files/:id/rows/:rowIndex - Alias pour deleteRow
 */
router.delete(
  "/files/:id/rows/:rowIndex", 
  verifyRole("responsable"), 
  checkFileOwnership, 
  csvController.deleteRow
);

// ==================== ROUTE DE TEST (optionnelle) ====================

/**
 * GET /csv/test - Route de test pour vérifier que le routeur fonctionne
 */
router.get("/test", (req, res) => {
  res.json({
    success: true,
    message: "Route CSV fonctionnelle",
    user: req.user ? req.user.email : "Non authentifié",
    role: req.user ? req.user.role : "Aucun"
  });
});


// routes/csvRoutes.js - Ajoutez cette route temporaire

router.post("/debug-headers", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Aucun fichier' });
        }

        const filePath = req.file.path;
        
        // Lire le fichier en mode binaire
        const buffer = fs.readFileSync(filePath);
        const content = buffer.toString('utf8');
        const lines = content.split('\n');
        const firstLine = lines[0];
        
        // Analyser chaque caractère du premier header
        const firstHeader = firstLine.split(',')[0];
        const charAnalysis = [];
        
        for (let i = 0; i < firstHeader.length; i++) {
            charAnalysis.push({
                index: i,
                char: firstHeader[i],
                charCode: firstHeader.charCodeAt(i),
                hex: '0x' + firstHeader.charCodeAt(i).toString(16).padStart(4, '0'),
                isBOM: firstHeader.charCodeAt(i) === 0xFEFF,
                isSpace: firstHeader[i] === ' ',
                isPrintable: firstHeader.charCodeAt(i) >= 32 && firstHeader.charCodeAt(i) <= 126
            });
        }
        
        // Nettoyer le fichier
        fs.unlinkSync(filePath);
        
        res.json({
            fileName: req.file.originalname,
            fileSize: req.file.size,
            firstLine: firstLine,
            firstHeader: firstHeader,
            headers: firstLine.split(',').map(h => ({
                raw: h,
                cleaned: h.replace(/^\uFEFF/, '').trim(),
                charCode0: h.charCodeAt(0),
                hex0: '0x' + h.charCodeAt(0).toString(16)
            })),
            charAnalysis,
            bufferPreview: buffer.slice(0, 50).toString('hex')
        });
        
    } catch (error) {
        console.error('Debug error:', error);
        res.status(500).json({ error: error.message });
    }
});


module.exports = router;