const express = require("express");
const router = express.Router();
const purchaseController = require("../controllers/purchase.controller");
const { authenticateUser, verifyRole } = require("../middleware/authMiddleware");

// Toutes les routes nécessitent une authentification
router.use(authenticateUser);

// IMPORTANT: Les routes spécifiques doivent être avant les routes avec paramètres
// Récupérer la fourchette de prix
router.get("/price-range", purchaseController.getPriceRange);

// Récupérer ses propres demandes (client)
router.get("/requests/my", verifyRole("client"), purchaseController.getClientRequests);

// Récupérer toutes les demandes (admin)
router.get("/requests/all", verifyRole("admin"), purchaseController.getAllRequests);

// Créer une demande (client)
router.post("/requests", verifyRole("client"), purchaseController.createRequest);

// Modifier une demande (client)
router.put("/requests/:requestId", verifyRole("client"), purchaseController.updateRequest);

// Supprimer une demande (client)
router.delete("/requests/:requestId", verifyRole("client"), purchaseController.deleteRequest);

// Approuver une demande (admin)
router.put("/requests/:requestId/approve", verifyRole("admin"), purchaseController.approveRequest);

// Refuser une demande (admin)
router.put("/requests/:requestId/reject", verifyRole("admin"), purchaseController.rejectRequest);

module.exports = router;