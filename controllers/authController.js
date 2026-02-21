const User = require("../models/User");
const bcrypt = require('bcryptjs');
const jwt = require("jsonwebtoken");
const crypto = require('crypto');
const { sendPasswordResetEmail } = require('../utils/emailService');

// ==================== INSCRIPTION ====================
exports.register = async (req, res) => {
  try {
    const { nom, prenom, email, password, telephone, role } = req.body;

    // Validation de l'email
    if (!email || !/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
      return res.status(400).json({ 
        success: false,
        message: "Veuillez fournir un email valide" 
      });
    }

    // Validation du mot de passe
    if (!password || password.length < 6) {
      return res.status(400).json({ 
        success: false,
        message: "Le mot de passe doit contenir au moins 6 caractères" 
      });
    }

    // Nettoyage du téléphone (enlève les espaces et tirets)
    const cleanTelephone = telephone.replace(/[\s-]/g, '');

    // Validation du téléphone au format international (+XXX suivi de 8 chiffres)
    const phoneRegex = /^\+\d{1,4}\d{8}$/; // + code (1-4 chiffres) + 8 chiffres
    if (!phoneRegex.test(cleanTelephone)) {
      return res.status(400).json({
        success: false,
        message: "Format de téléphone invalide. Utilisez: +216 98 654 123 (code pays + 8 chiffres)"
      });
    }

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        message: "Cet email est déjà utilisé",
        code: "EMAIL_EXISTS"
      });
    }

    // Vérifier que le rôle est valide
    const validRoles = ["admin", "responsable", "client"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ 
        success: false,
        message: "Rôle invalide. Les rôles valides sont: admin, responsable, client",
        validRoles
      });
    }

    // Création de l'utilisateur
    const newUser = new User({ 
      nom: nom.trim(),
      prenom: prenom.trim(),
      email: email.toLowerCase().trim(),
      password: password,
      telephone: cleanTelephone,
      role,
      isApproved: false
    });

    await newUser.save();

    res.status(201).json({ 
      success: true,
      message: "Inscription réussie! Votre compte est en attente d'approbation.",
      data: {
        userId: newUser._id,
        nom: newUser.nom,
        prenom: newUser.prenom,
        email: newUser.email,
        telephone: newUser.telephone,
        role: newUser.role,
        requiresApproval: true
      }
    });

  } catch (error) {
    console.error("❌ Erreur d'inscription:", error);
    
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
      message: "Erreur lors de l'inscription"
    });
  }
};

// ==================== CONNEXION ====================
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const cleanEmail = email.toLowerCase().trim();

    console.log(`📧 Tentative de connexion pour: ${cleanEmail}`);

    // Trouver l'utilisateur avec le mot de passe
    const user = await User.findOne({ email: cleanEmail }).select('+password');
    
    if (!user) {
      console.log(`❌ Utilisateur non trouvé: ${cleanEmail}`);
      return res.status(401).json({ 
        success: false,
        message: "Email ou mot de passe incorrect",
        code: "INVALID_CREDENTIALS"
      });
    }

    console.log(`✅ Utilisateur trouvé: ${user.email} (${user.prenom} ${user.nom})`);

    // Vérifier l'approbation
    if (!user.isApproved) {
      console.log(`⚠️ Compte non approuvé: ${user.email}`);
      return res.status(403).json({
        success: false,
        message: "Votre compte est en attente d'approbation",
        code: "ACCOUNT_PENDING"
      });
    }

    // Vérifier le mot de passe
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      console.log(`❌ Mot de passe incorrect pour: ${user.email}`);
      return res.status(401).json({ 
        success: false,
        message: "Email ou mot de passe incorrect",
        code: "INVALID_CREDENTIALS"
      });
    }

    // Générer le token
    const token = jwt.sign(
      {
        userId: user._id,
        nom: user.nom,
        prenom: user.prenom,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Mettre à jour lastLogin
    user.lastLogin = new Date();
    await user.save();

    console.log(`✅ Connexion réussie pour: ${user.email}`);

    res.json({
      success: true,
      message: "Connexion réussie",
      token,
      user: {
        _id: user._id,
        nom: user.nom,
        prenom: user.prenom,
        email: user.email,
        telephone: user.telephone,
        role: user.role,
        isApproved: user.isApproved,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt // ← AJOUT ESSENTIEL
      }
    });

  } catch (error) {
    console.error('❌ Erreur login:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: "Erreur de validation des données",
        errors: Object.values(error.errors).map(err => err.message)
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: "Erreur de génération du token"
      });
    }

    res.status(500).json({ 
      success: false,
      message: "Erreur serveur"
    });
  }
};

// ==================== VÉRIFIER EMAIL ====================
exports.verifyEmail = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email requis"
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    
    res.json({ 
      success: true,
      exists: !!user,
      message: user ? "Email existant" : "Email disponible"
    });

  } catch (error) {
    console.error('❌ Erreur verifyEmail:', error);
    res.status(500).json({ 
      success: false,
      message: "Erreur serveur"
    });
  }
};

// ==================== MOT DE PASSE OUBLIÉ ====================
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const cleanEmail = email.toLowerCase().trim();

    console.log(`📧 Demande de reset pour: ${cleanEmail}`);

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email requis"
      });
    }

    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Aucun compte trouvé avec cet email"
      });
    }

    // Générer un code aléatoire à 6 chiffres
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    user.resetPasswordCode = resetCode;
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
    await user.save();

    console.log(`🔐 Code généré pour ${cleanEmail}: ${resetCode}`);

    // ENVOYER L'EMAIL
    try {
      console.log(`📤 Tentative d'envoi d'email à ${cleanEmail}...`);
      const emailResult = await sendPasswordResetEmail(cleanEmail, resetCode);
      console.log(`✅ Email envoyé avec succès! Message ID: ${emailResult.messageId}`);
    } catch (emailError) {
      console.error('❌ ERREUR ENVOI EMAIL:', emailError.message);
      // On continue même si l'email échoue (mode debug)
    }

    res.json({
      success: true,
      message: "Code de réinitialisation envoyé par email",
      debug: process.env.NODE_ENV === 'development' ? { 
        resetCode,
        note: "Mode développement - code affiché pour test" 
      } : undefined
    });

  } catch (error) {
    console.error('❌ Erreur forgotPassword:', error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur"
    });
  }
};

// ==================== VÉRIFIER CODE DE RÉINITIALISATION ====================
exports.verifyResetCode = async (req, res) => {
  try {
    const { email, code } = req.body;
    const cleanEmail = email.toLowerCase().trim();

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        message: "Email et code requis"
      });
    }

    const user = await User.findOne({ 
      email: cleanEmail,
      resetPasswordExpires: { $gt: Date.now() }
    }).select('+resetPasswordCode +resetPasswordExpires');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Code invalide ou expiré"
      });
    }

    // Vérifier le code
    if (user.resetPasswordCode !== code) {
      return res.status(400).json({
        success: false,
        message: "Code invalide"
      });
    }

    res.json({
      success: true,
      message: "Code vérifié avec succès"
    });

  } catch (error) {
    console.error('❌ Erreur verifyResetCode:', error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur"
    });
  }
};

// ==================== RÉINITIALISER LE MOT DE PASSE ====================
exports.resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    const cleanEmail = email.toLowerCase().trim();

    // Validations
    if (!email || !code || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, code et nouveau mot de passe requis"
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Le mot de passe doit contenir au moins 6 caractères"
      });
    }

    const user = await User.findOne({ 
      email: cleanEmail,
      resetPasswordCode: code,
      resetPasswordExpires: { $gt: Date.now() }
    }).select('+password +resetPasswordCode +resetPasswordExpires');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Code invalide ou expiré"
      });
    }

    // Mettre à jour le mot de passe
    user.password = newPassword;
    user.resetPasswordCode = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    console.log(`✅ Mot de passe réinitialisé pour: ${cleanEmail}`);

    res.json({
      success: true,
      message: "Mot de passe réinitialisé avec succès"
    });

  } catch (error) {
    console.error('❌ Erreur resetPassword:', error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur"
    });
  }
};