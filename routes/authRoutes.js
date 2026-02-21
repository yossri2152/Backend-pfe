const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

// Routes publiques
router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/verify-email", authController.verifyEmail);

// Routes de réinitialisation de mot de passe
router.post("/forgot-password", authController.forgotPassword);
router.post("/verify-reset-code", authController.verifyResetCode);
router.post("/reset-password", authController.resetPassword);

module.exports = router;