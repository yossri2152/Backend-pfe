const jwt = require("jsonwebtoken");
const User = require('../models/User');

/**
 * Middleware pour vérifier le token JWT et authentifier l'utilisateur
 */
const verifyToken = async (req, res, next) => {
  try {
    // 1. Vérifier la présence du header Authorization
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: "Token manquant ou invalide",
        code: "AUTH_HEADER_MISSING"
      });
    }

    // 2. Extraire et vérifier le token
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3. Vérifier que l'utilisateur existe toujours
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Utilisateur non trouvé",
        code: "USER_NOT_FOUND"
      });
    }

    // 4. Ajouter l'utilisateur à la requête
    req.user = {
      userId: user._id.toString(),
      id: user._id.toString(),
      _id: user._id,
      nom: user.nom,
      prenom: user.prenom,
      email: user.email,
      role: user.role,
      isApproved: user.isApproved
    };

    // 5. Vérification optionnelle de l'approbation du compte
    // (décommentez si vous voulez forcer cette vérification pour toutes les routes)
    /*
    if (!user.isApproved && user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: "Compte en attente d'approbation",
        code: "ACCOUNT_PENDING"
      });
    }
    */

    next();
  } catch (err) {
    console.error("❌ Erreur d'authentification:", err);
    
    // Gestion des différentes erreurs JWT
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: "Token expiré",
        code: "TOKEN_EXPIRED"
      });
    }
    
    if (err.name === 'JsonWebTokenError') {
      return res.status(403).json({
        success: false,
        message: "Token invalide",
        code: "INVALID_TOKEN"
      });
    }

    // Erreur serveur inattendue
    return res.status(500).json({
      success: false,
      message: "Erreur d'authentification",
      code: "AUTH_ERROR"
    });
  }
};

/**
 * Middleware pour vérifier que l'utilisateur a un rôle autorisé
 * @param {...string} allowedRoles - Rôles autorisés (ex: "admin", "responsable")
 */
const verifyRole = (...allowedRoles) => {
  return (req, res, next) => {
    // Vérifier que l'utilisateur est bien authentifié
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        message: "Authentification requise",
        code: "AUTH_REQUIRED"
      });
    }

    // Vérifier que l'utilisateur a un rôle
    if (!req.user.role) {
      return res.status(403).json({ 
        success: false,
        message: "Rôle utilisateur manquant",
        code: "ROLE_MISSING"
      });
    }

    // Normaliser les rôles (minuscules, sans espaces)
    const userRole = req.user.role.toLowerCase().trim();
    const normalizedAllowed = allowedRoles.map(r => r.toLowerCase().trim());

    // Vérifier si le rôle de l'utilisateur est dans la liste autorisée
    if (!normalizedAllowed.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `Accès refusé. Rôle requis: ${allowedRoles.join(' ou ')}`,
        yourRole: req.user.role,
        code: "INSUFFICIENT_ROLE"
      });
    }

    next();
  };
};

/**
 * Middleware pour vérifier que l'utilisateur est admin
 * (Raccourci pour verifyRole("admin"))
 */
const isAdmin = (req, res, next) => {
  return verifyRole("admin")(req, res, next);
};

/**
 * Middleware pour vérifier que l'utilisateur a accès à son propre profil
 * ou est admin (pour les routes comme PUT /users/:id)
 */
const canAccessUser = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentification requise",
      code: "AUTH_REQUIRED"
    });
  }

  // L'utilisateur peut accéder à son propre profil
  const targetUserId = req.params.id;
  const isSelf = targetUserId === req.user.userId || targetUserId === req.user.id;
  
  // Les admins peuvent tout faire
  const isAdmin = req.user.role === 'admin';

  if (isSelf || isAdmin) {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: "Accès non autorisé à cet utilisateur",
      code: "UNAUTHORIZED_USER_ACCESS"
    });
  }
};

/**
 * Middleware pour logger les tentatives d'accès (debug)
 */
const logAccess = (req, res, next) => {
  console.log(`📝 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  if (req.user) {
    console.log(`   Utilisateur: ${req.user.email} (${req.user.role})`);
  }
  next();
};

// Alias pour compatibilité avec l'ancien code
const authenticateUser = verifyToken;

module.exports = {
  // Authentification de base
  verifyToken,
  authenticateUser,
  
  // Vérification des rôles
  verifyRole,
  isAdmin,
  
  // Utilitaires
  canAccessUser,
  logAccess
};