const mongoose = require("mongoose");
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  nom: { 
    type: String, 
    required: [true, "Le nom est obligatoire"],
    trim: true
  },
  prenom: { 
    type: String, 
    required: [true, "Le prénom est obligatoire"],
    trim: true
  },
  email: { 
    type: String, 
    required: [true, "L'email est obligatoire"],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, "Email invalide"]
  },
  password: { 
    type: String, 
    required: [true, "Le mot de passe est obligatoire"],
    minlength: [6, "Le mot de passe doit contenir au moins 6 caractères"],
    select: false
  },
  telephone: {
    type: String,
    required: [true, "Le numéro de téléphone est obligatoire"],
    trim: true,
    validate: {
      validator: function(v) {
        // NETTOYAGE : enlever tous les espaces et tirets
        const cleaned = v.replace(/[\s-]/g, '');
        
        // FORMAT INTERNATIONAL : +XXX suivi de 8 chiffres
        // Exemples: +21698654123, +33612345678, +4412345678, +123456789012
        // + code pays (1-4 chiffres) + 8 chiffres
        const internationalRegex = /^\+\d{1,4}\d{8}$/;
        
        // OPTIONNEL : Accepter aussi le format local français (pour compatibilité)
        // const localFrenchRegex = /^0[1-9]\d{8}$/; // 0612345678
        
        return internationalRegex.test(cleaned);
        // return internationalRegex.test(cleaned) || localFrenchRegex.test(cleaned);
      },
      message: "Format de téléphone invalide. Utilisez: +216 98 654 123 (code pays + 8 chiffres)"
    }
  },
  role: {
    type: String,
    enum: {
      values: ["admin", "responsable", "client"],
      message: "Le rôle {VALUE} n'est pas valide"
    },
    default: "client",
    required: true
  },
  isApproved: {
    type: Boolean,
    default: false
  },
  lastLogin: {
    type: Date
  },
  // Champs pour la réinitialisation de mot de passe
  resetPasswordCode: {
    type: String,
    select: false
  },
  resetPasswordExpires: {
    type: Date,
    select: false
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function (doc, ret) {
      delete ret.password;
      delete ret.resetPasswordCode;
      delete ret.resetPasswordExpires;
      delete ret.__v;
      return ret;
    }
  }
});

// ==================== MIDDLEWARES ====================

// Hash du mot de passe avant sauvegarde
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Hash du mot de passe lors d'une mise à jour
UserSchema.pre('findOneAndUpdate', async function (next) {
  const update = this.getUpdate();
  if (update.password) {
    try {
      const salt = await bcrypt.genSalt(10);
      update.password = await bcrypt.hash(update.password, salt);
      this.setUpdate(update);
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// ==================== MÉTHODES D'INSTANCE ====================

/**
 * Comparer un mot de passe avec le hash stocké
 * @param {string} candidatePassword - Mot de passe à vérifier
 * @returns {Promise<boolean>} - true si correspond, false sinon
 */
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * Générer un code de réinitialisation de mot de passe
 * @returns {string} - Code à 6 chiffres
 */
UserSchema.methods.generateResetCode = function() {
  const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
  this.resetPasswordCode = resetCode;
  this.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
  return resetCode;
};

/**
 * Vérifier si le code de réinitialisation est valide
 * @param {string} code - Code à vérifier
 * @returns {boolean} - true si valide, false sinon
 */
UserSchema.methods.isResetCodeValid = function(code) {
  return this.resetPasswordCode === code && 
         this.resetPasswordExpires > Date.now();
};

/**
 * Effacer le code de réinitialisation après utilisation
 */
UserSchema.methods.clearResetCode = function() {
  this.resetPasswordCode = undefined;
  this.resetPasswordExpires = undefined;
};

/**
 * Mettre à jour la date de dernière connexion
 */
UserSchema.methods.updateLastLogin = function() {
  this.lastLogin = new Date();
};

// ==================== MÉTHODES STATIQUES ====================

/**
 * Trouver un utilisateur par email
 * @param {string} email - Email à rechercher
 * @returns {Promise<User>} - Utilisateur trouvé ou null
 */
UserSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase().trim() });
};

/**
 * Trouver les utilisateurs en attente d'approbation
 * @returns {Promise<Array>} - Liste des utilisateurs non approuvés
 */
UserSchema.statics.findPendingApproval = function() {
  return this.find({ isApproved: false })
    .select('-password')
    .sort({ createdAt: -1 });
};

/**
 * Compter les utilisateurs par rôle
 * @returns {Promise<Object>} - Statistiques par rôle
 */
UserSchema.statics.countByRole = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$role',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const result = {
    admin: 0,
    responsable: 0,
    client: 0,
    total: 0
  };
  
  stats.forEach(stat => {
    result[stat._id] = stat.count;
    result.total += stat.count;
  });
  
  return result;
};

// ==================== INDEX ====================

// Index pour améliorer les performances des requêtes
UserSchema.index({ email: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ isApproved: 1 });
UserSchema.index({ createdAt: -1 });

// Index TTL pour nettoyage automatique des codes expirés
UserSchema.index({ resetPasswordExpires: 1 }, { 
  expireAfterSeconds: 0,
  partialFilterExpression: { resetPasswordExpires: { $exists: true } }
});

// Index composé pour les recherches fréquentes
UserSchema.index({ nom: 1, prenom: 1 });
UserSchema.index({ role: 1, isApproved: 1 });

// ==================== VIRTUELS ====================

// Nom complet (virtuel)
UserSchema.virtual('fullName').get(function() {
  return `${this.prenom} ${this.nom}`.trim();
});

// Statut du compte (virtuel)
UserSchema.virtual('accountStatus').get(function() {
  if (this.isApproved) return 'approuvé';
  return 'en attente';
});

module.exports = mongoose.model("User", UserSchema);