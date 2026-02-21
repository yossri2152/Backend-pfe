const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { authenticateUser, verifyRole } = require("../middleware/authMiddleware");
const { sendApprovalEmail } = require('../utils/emailService');
const bcrypt = require('bcryptjs');

// ==================== ROUTES PUBLIQUES (UTILISATEUR CONNECTÉ) ====================

/**
 * GET /profile - Obtenir son propre profil
 * Accessible à tout utilisateur authentifié
 */
router.get("/profile", authenticateUser, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password -resetPasswordCode -resetPasswordExpires");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Utilisateur non trouvé"
      });
    }
    res.json({ 
      success: true,
      data: user 
    });
  } catch (error) {
    console.error('❌ Erreur profile:', error);
    res.status(500).json({ 
      success: false,
      message: "Erreur serveur" 
    });
  }
});

/**
 * PUT /profile - Mettre à jour son propre profil
 * Accessible à tout utilisateur authentifié
 * Ne permet pas de changer le rôle
 */
router.put("/profile", authenticateUser, async (req, res) => {
  try {
    const { nom, prenom, email, telephone } = req.body;
    
    // Nettoyer le téléphone (enlever les espaces)
    const cleanTelephone = telephone ? telephone.replace(/\s/g, '') : undefined;

    // Vérifier si l'email est déjà utilisé par un autre utilisateur
    if (email) {
      const existingUser = await User.findOne({ 
        email: email.toLowerCase().trim(),
        _id: { $ne: req.user.userId }
      });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Cet email est déjà utilisé"
        });
      }
    }

    // Validation du format téléphone si fourni
    if (cleanTelephone) {
      // Format français: 0612345678 ou +33612345678
      const phoneRegex = /^(?:(?:\+|00)33|0)[1-9](?:\d{2}){4}$/;
      if (!phoneRegex.test(cleanTelephone)) {
        return res.status(400).json({
          success: false,
          message: "Format de téléphone invalide. Utilisez: 0612345678 ou +33612345678"
        });
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { 
        nom: nom?.trim(),
        prenom: prenom?.trim(),
        email: email?.toLowerCase().trim(),
        telephone: cleanTelephone
      },
      { new: true, runValidators: true }
    ).select("-password -resetPasswordCode -resetPasswordExpires");

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: "Utilisateur non trouvé" 
      });
    }

    console.log(`✅ Profil mis à jour pour: ${user.email}`);

    res.json({
      success: true,
      message: "Profil mis à jour avec succès",
      data: user
    });
  } catch (error) {
    console.error('❌ Erreur mise à jour profil:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: "Erreur de validation",
        errors
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Cet email est déjà utilisé"
      });
    }

    res.status(500).json({ 
      success: false,
      message: "Erreur serveur" 
    });
  }
});

/**
 * POST /change-password - Changer son mot de passe
 * Accessible à tout utilisateur authentifié
 * Vérifie l'ancien mot de passe avant de changer
 */
router.post("/change-password", authenticateUser, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validations
    if (!currentPassword) {
      return res.status(400).json({
        success: false,
        message: "Le mot de passe actuel est requis"
      });
    }

    if (!newPassword) {
      return res.status(400).json({
        success: false,
        message: "Le nouveau mot de passe est requis"
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Le nouveau mot de passe doit contenir au moins 6 caractères"
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: "Le nouveau mot de passe doit être différent de l'ancien"
      });
    }

    // Récupérer l'utilisateur avec son mot de passe
    const user = await User.findById(req.user.userId).select('+password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Utilisateur non trouvé"
      });
    }

    // Vérifier l'ancien mot de passe
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Mot de passe actuel incorrect"
      });
    }

    // Mettre à jour le mot de passe
    user.password = newPassword;
    await user.save();

    console.log(`✅ Mot de passe changé pour: ${user.email}`);

    res.json({
      success: true,
      message: "Mot de passe changé avec succès"
    });
  } catch (error) {
    console.error('❌ Erreur changement mot de passe:', error);
    res.status(500).json({ 
      success: false,
      message: "Erreur serveur" 
    });
  }
});

/**
 * DELETE /profile - Supprimer son propre compte
 * Accessible à tout utilisateur authentifié
 */
router.delete("/profile", authenticateUser, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: "Utilisateur non trouvé" 
      });
    }

    console.log(`✅ Compte supprimé: ${user.email} (${user.prenom} ${user.nom})`);

    res.json({ 
      success: true,
      message: "Votre compte a été supprimé avec succès"
    });
  } catch (error) {
    console.error('❌ Erreur suppression compte:', error);
    res.status(500).json({ 
      success: false,
      message: "Erreur serveur" 
    });
  }
});

// ==================== ROUTES ADMIN SEULEMENT ====================

/**
 * GET / - Obtenir tous les utilisateurs
 * Accessible uniquement aux administrateurs
 */
router.get("/", authenticateUser, verifyRole("admin"), async (req, res) => {
  try {
    const users = await User.find()
      .select("-password -resetPasswordCode -resetPasswordExpires")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    console.error('❌ Erreur get all users:', error);
    res.status(500).json({ 
      success: false, 
      message: "Erreur serveur" 
    });
  }
});

/**
 * GET /pending - Obtenir les utilisateurs en attente d'approbation
 * Accessible uniquement aux administrateurs
 */
router.get("/pending", authenticateUser, verifyRole("admin"), async (req, res) => {
  try {
    const pendingUsers = await User.find({ 
      isApproved: false
    })
      .select("-password -resetPasswordCode -resetPasswordExpires")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: pendingUsers.length,
      data: pendingUsers
    });
  } catch (error) {
    console.error('❌ Erreur get pending:', error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur"
    });
  }
});

/**
 * PUT /:id/approve - Approuver un utilisateur
 * Accessible uniquement aux administrateurs
 * Envoie un email de confirmation à l'utilisateur
 */
router.put("/:id/approve", authenticateUser, verifyRole("admin"), async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isApproved: true },
      { new: true }
    ).select("-password -resetPasswordCode -resetPasswordExpires");

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: "Utilisateur non trouvé" 
      });
    }

    // Envoyer email de confirmation d'approbation
    try {
      const userName = `${user.prenom} ${user.nom}`.trim();
      await sendApprovalEmail(user.email, userName);
      console.log(`✅ Email d'approbation envoyé à ${user.email}`);
    } catch (emailError) {
      console.error('❌ Erreur envoi email:', emailError.message);
      // On continue même si l'email échoue, l'utilisateur est déjà approuvé
    }

    res.json({ 
      success: true,
      message: "Utilisateur approuvé avec succès",
      data: user
    });
  } catch (error) {
    console.error('❌ Erreur approbation:', error);
    res.status(500).json({ 
      success: false,
      message: "Erreur serveur"
    });
  }
});

/**
 * DELETE /:id - Supprimer un utilisateur (admin)
 * Accessible uniquement aux administrateurs
 */
router.delete("/:id", authenticateUser, verifyRole("admin"), async (req, res) => {
  try {
    // Empêcher l'admin de se supprimer lui-même
    if (req.params.id === req.user.userId) {
      return res.status(400).json({
        success: false,
        message: "Vous ne pouvez pas supprimer votre propre compte. Utilisez la page de profil."
      });
    }

    const user = await User.findByIdAndDelete(req.params.id);
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: "Utilisateur non trouvé" 
      });
    }

    console.log(`✅ Utilisateur ${user.email} (${user.prenom} ${user.nom}) supprimé par admin`);

    res.json({ 
      success: true,
      message: "Utilisateur supprimé avec succès"
    });
  } catch (error) {
    console.error('❌ Erreur suppression:', error);
    res.status(500).json({ 
      success: false,
      message: "Erreur serveur"
    });
  }
});

/**
 * GET /:id - Obtenir un utilisateur par ID
 * Accessible uniquement aux administrateurs
 */
router.get("/:id", authenticateUser, verifyRole("admin"), async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-password -resetPasswordCode -resetPasswordExpires");
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: "Utilisateur non trouvé" 
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('❌ Erreur get user by id:', error);
    res.status(500).json({ 
      success: false,
      message: "Erreur serveur" 
    });
  }
});

/**
 * PUT /:id - Mettre à jour un utilisateur (admin)
 * Accessible uniquement aux administrateurs
 * Permet de modifier tous les champs y compris le rôle
 */
router.put("/:id", authenticateUser, verifyRole("admin"), async (req, res) => {
  try {
    const { nom, prenom, email, telephone, role } = req.body;
    
    // Nettoyer le téléphone
    const cleanTelephone = telephone ? telephone.replace(/\s/g, '') : undefined;

    // Vérifier si l'email est déjà utilisé par un autre utilisateur
    if (email) {
      const existingUser = await User.findOne({ 
        email: email.toLowerCase().trim(),
        _id: { $ne: req.params.id }
      });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Cet email est déjà utilisé"
        });
      }
    }

    // Validation du rôle
    const validRoles = ["admin", "responsable", "client"];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Rôle invalide. Les rôles valides sont: admin, responsable, client"
      });
    }

    // Validation du téléphone si fourni
    if (cleanTelephone) {
      const phoneRegex = /^(?:(?:\+|00)33|0)[1-9](?:\d{2}){4}$/;
      if (!phoneRegex.test(cleanTelephone)) {
        return res.status(400).json({
          success: false,
          message: "Format de téléphone invalide. Utilisez: 0612345678 ou +33612345678"
        });
      }
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { 
        nom: nom?.trim(),
        prenom: prenom?.trim(),
        email: email?.toLowerCase().trim(),
        telephone: cleanTelephone,
        role
      },
      { new: true, runValidators: true }
    ).select("-password -resetPasswordCode -resetPasswordExpires");

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: "Utilisateur non trouvé" 
      });
    }

    console.log(`✅ Utilisateur ${user.email} mis à jour par admin`);

    res.json({
      success: true,
      message: "Utilisateur mis à jour avec succès",
      data: user
    });
  } catch (error) {
    console.error('❌ Erreur mise à jour:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Cet email est déjà utilisé"
      });
    }

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: "Erreur de validation",
        errors
      });
    }

    res.status(500).json({ 
      success: false,
      message: "Erreur serveur" 
    });
  }
});

module.exports = router;