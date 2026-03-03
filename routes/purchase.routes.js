// routes/purchase.routes.js

const express = require("express");
const router = express.Router();
const purchaseController = require("../controllers/purchase.controller");
const { authenticateUser, verifyRole } = require("../middleware/authMiddleware");

// Toutes les routes nécessitent une authentification
router.use(authenticateUser);

// ==================== ROUTES PUBLIQUES (après authentification) ====================

/**
 * GET /purchase/price-range - Récupérer la fourchette de prix pour un produit
 * Accessible à tous les utilisateurs authentifiés
 * Query params: productType, tradeType
 */
router.get("/price-range", purchaseController.getPriceRange);

// ==================== ROUTES POUR CLIENTS ====================

/**
 * GET /purchase/lot/:lotId - Récupérer les informations d'achat d'un lot spécifique
 * Accessible uniquement aux clients
 * Permet de voir le poids disponible et les fourchettes de prix
 */
router.get("/lot/:lotId", verifyRole("client"), purchaseController.getLotPurchaseInfo);

/**
 * GET /purchase/requests/my - Récupérer ses propres demandes d'achat
 * Accessible uniquement aux clients
 * Query params optionnels: status (en_attente, approuve, refuse)
 */
router.get("/requests/my", verifyRole("client"), purchaseController.getClientRequests);

/**
 * POST /purchase/requests - Créer une nouvelle demande d'achat
 * Accessible uniquement aux clients
 * Body: { lotId, productType, quantity, tradeType, proposedPrice }
 */
router.post("/requests", verifyRole("client"), purchaseController.createRequest);

/**
 * PUT /purchase/requests/:requestId - Modifier une demande existante
 * Accessible uniquement aux clients (seulement si en attente)
 * Body: champs à modifier (quantity, proposedPrice)
 */
router.put("/requests/:requestId", verifyRole("client"), purchaseController.updateRequest);

/**
 * DELETE /purchase/requests/:requestId - Supprimer une demande
 * Accessible uniquement aux clients (seulement si en attente)
 */
router.delete("/requests/:requestId", verifyRole("client"), purchaseController.deleteRequest);

// ==================== ROUTES POUR ADMINISTRATEURS ====================

/**
 * GET /purchase/requests/all - Récupérer toutes les demandes d'achat
 * Accessible uniquement aux administrateurs
 * Query params optionnels: status (en_attente, approuve, refuse)
 */
router.get("/requests/all", verifyRole("admin"), purchaseController.getAllRequests);

/**
 * PUT /purchase/requests/:requestId/approve - Approuver une demande
 * Accessible uniquement aux administrateurs
 * Met à jour le stock du lot automatiquement
 */
router.put("/requests/:requestId/approve", verifyRole("admin"), purchaseController.approveRequest);

/**
 * PUT /purchase/requests/:requestId/reject - Refuser une demande
 * Accessible uniquement aux administrateurs
 * Body optionnel: { comment }
 */
router.put("/requests/:requestId/reject", verifyRole("admin"), purchaseController.rejectRequest);

// ==================== ROUTES POUR RESPONSABLES (optionnel) ====================

/**
 * Si vous voulez que les responsables puissent aussi voir les demandes
 * Décommentez ces routes si nécessaire
 */
// router.get("/requests/all", verifyRole("responsable", "admin"), purchaseController.getAllRequests);
// router.put("/requests/:requestId/approve", verifyRole("responsable", "admin"), purchaseController.approveRequest);
// router.put("/requests/:requestId/reject", verifyRole("responsable", "admin"), purchaseController.rejectRequest);

module.exports = router;