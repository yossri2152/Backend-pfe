// models/Lot.js

const mongoose = require("mongoose");

const LotSchema = new mongoose.Schema({
  // ========== IDENTIFIANTS ==========
  lotId: {
    type: String,
    required: true,
    unique: true
  },
  fileName: {
    type: String,
    required: true
  },
  
  // ========== INFORMATIONS DE BASE ==========
  category: {
    type: String,
    enum: ["Tomates", "Fraises", "Agrumes", "Dattes", ""],
    default: ""
  },
  year: Number,
  month: Number,
  quarter: String,
  initialQuality: {
    type: String,
    enum: ["excellente", "bonne", "moyenne", "mauvaise"],
    default: "excellente"
  },
  
  // ========== TRANSPORT ==========
  originRegion: String,
  destinationRegion: String,
  transportMode: String,
  distance: Number,
  duration: Number,
  
  // ========== PARAMÈTRES ENVIRONNEMENTAUX ==========
  // Température
  temperatureMin: Number,
  temperatureMax: Number,
  
  // Humidité
  humidityMin: Number,
  humidityMax: Number,
  
  // Autres paramètres
  shock: Number,
  pressure: Number,
  rain: Number,
  sunExposure: Number, // en minutes
  ventilation: String,
  
  // ========== DONNÉES COMMERCIALES ==========
  weight: Number,
  purchasePrice: Number,
  salePrice: Number,
  transportCost: Number,
  margin: Number,
  marginPercent: Number,
  automaticDecision: String,
  
  // ========== GESTION DES STOCKS (NOUVEAU) ==========
  availableWeight: {
    type: Number,
    default: function() {
      return this.weight; // Par défaut, tout le poids est disponible
    }
  },
  originalWeight: {
    type: Number,
    default: function() {
      return this.weight;
    }
  },
  soldWeight: {
    type: Number,
    default: 0
  },
  
  // ========== TYPE DE PRODUIT ==========
  productType: {
    type: String,
    enum: ["tomate", "agrume", "fraise", "datte", "inconnu"],
    default: "inconnu"
  },
  
  // ========== RÉSULTATS D'ANALYSE (MOTEUR DE RÈGLES) ==========
  analysis: {
    issues: [String],
    riskLevel: {
      type: String,
      enum: ["Faible", "Moyen", "Élevé", "Inconnu"]
    },
    decision: {
      type: String,
      enum: ["SAIN", "ENDOMMAGÉ", "ERREUR", "Inconnu"],
      default: "Inconnu"
    },
    isCompliant: {
      type: Boolean,
      default: false
    },
    issueCount: Number,
    details: {
      year: String,
      initialQuality: String,
      temperatureMin: String,
      temperatureMax: String,
      humidityMin: String,
      humidityMax: String,
      pressure: String,
      rain: String,
      shock: String,
      sunExposure: String,
      ventilation: String,
      duration: String
    }
  },
  
  // ========== RAPPORT DÉTAILLÉ ==========
  detailedReport: String,
  
  // ========== RAPPORT IA (OLLAMA) ==========
  aiReport: {
    resume: String,
    niveau_risque: String,
    details: {
      temperature: String,
      humidite: String,
      pression: String,
      pluie: String,
      duree: String,
      choc: String,
      soleil: String,
      ventilation: String
    },
    recommandations: [String],
    conclusion: String,
    raw: mongoose.Schema.Types.Mixed,
    fallback: Boolean
  },
  
  // ========== VISIBILITÉ CLIENT ==========
  isPublic: {
    type: Boolean,
    default: false
  },
  publishedAt: {
    type: Date
  },
  publishedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // ========== MÉTADONNÉES ==========
  analyzedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  analyzedAt: {
    type: Date,
    default: Date.now
  },
  csvFileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CSVFile'
  }
}, {
  timestamps: true
});

// ========== INDEX POUR OPTIMISER LES RECHERCHES ==========

// Index de base
LotSchema.index({ lotId: 1 });
LotSchema.index({ analyzedBy: 1 });
LotSchema.index({ analyzedAt: -1 });
LotSchema.index({ "analysis.decision": 1 });
LotSchema.index({ fileName: 1 });
LotSchema.index({ productType: 1 });

// Index pour la recherche des rapports publics
LotSchema.index({ isPublic: 1, publishedAt: -1 });

// Index composé pour les filtres clients
LotSchema.index({ isPublic: 1, productType: 1, publishedAt: -1 });

// Index pour les recherches par région
LotSchema.index({ originRegion: 1, destinationRegion: 1 });

// Index pour les paramètres environnementaux
LotSchema.index({ temperatureMin: 1, temperatureMax: 1 });
LotSchema.index({ humidityMin: 1, humidityMax: 1 });

// Index pour la gestion des stocks (NOUVEAU)
LotSchema.index({ availableWeight: 1 });
LotSchema.index({ isPublic: 1, availableWeight: { $gt: 0 } });

// ========== MÉTHODES D'INSTANCE ==========

/**
 * Vérifie si le lot est visible par les clients
 * @returns {boolean}
 */
LotSchema.methods.isVisibleToClients = function() {
  return this.isPublic === true && this.publishedAt !== null;
};

/**
 * Vérifie si le lot a du stock disponible
 * @returns {boolean}
 */
LotSchema.methods.hasAvailableStock = function() {
  const available = this.availableWeight !== undefined ? this.availableWeight : this.weight || 0;
  return available > 0;
};

/**
 * Récupère le poids disponible
 * @returns {number}
 */
LotSchema.methods.getAvailableWeight = function() {
  return this.availableWeight !== undefined ? this.availableWeight : this.weight || 0;
};

/**
 * Réserve une quantité du lot (avant approbation)
 * @param {number} quantity - Quantité à réserver
 * @returns {boolean} - true si réservation réussie
 */
LotSchema.methods.reserveQuantity = function(quantity) {
  const available = this.getAvailableWeight();
  if (quantity <= available) {
    this.availableWeight = available - quantity;
    this.soldWeight = (this.soldWeight || 0) + quantity;
    return true;
  }
  return false;
};

/**
 * Annule une réservation (si demande rejetée)
 * @param {number} quantity - Quantité à remettre en stock
 */
LotSchema.methods.cancelReservation = function(quantity) {
  this.availableWeight = (this.availableWeight || 0) + quantity;
  this.soldWeight = Math.max(0, (this.soldWeight || 0) - quantity);
};

/**
 * Publie le rapport pour les clients
 * @param {ObjectId} userId - ID de l'utilisateur qui publie
 */
LotSchema.methods.publish = function(userId) {
  this.isPublic = true;
  this.publishedAt = new Date();
  this.publishedBy = userId;
};

/**
 * Dépublie le rapport
 */
LotSchema.methods.unpublish = function() {
  this.isPublic = false;
  this.publishedAt = null;
  this.publishedBy = null;
};

/**
 * Formate les données pour l'affichage client
 * @returns {Object} - Données formatées
 */
LotSchema.methods.toClientJSON = function() {
  return {
    lotId: this.lotId,
    category: this.category,
    productType: this.productType,
    originRegion: this.originRegion,
    destinationRegion: this.destinationRegion,
    transportMode: this.transportMode,
    weight: this.weight,
    availableWeight: this.getAvailableWeight(),
    soldWeight: this.soldWeight || 0,
    analysis: {
      decision: this.analysis?.decision,
      riskLevel: this.analysis?.riskLevel,
      isCompliant: this.analysis?.isCompliant
    },
    detailedReport: this.detailedReport,
    publishedAt: this.publishedAt,
    analyzedAt: this.analyzedAt
  };
};

// ========== MÉTHODES STATIQUES ==========

/**
 * Récupère tous les rapports publics avec stock disponible
 * @param {Object} filter - Filtres supplémentaires
 * @returns {Promise<Array>}
 */
LotSchema.statics.findPublicWithStock = function(filter = {}) {
  const query = { 
    isPublic: true, 
    ...filter,
    $expr: { $gt: [{ $ifNull: ["$availableWeight", "$weight"] }, 0] }
  };
  return this.find(query)
    .populate('publishedBy', 'nom prenom email')
    .populate('analyzedBy', 'nom prenom email')
    .sort({ publishedAt: -1 });
};

/**
 * Récupère tous les rapports publics
 * @param {Object} filter - Filtres supplémentaires
 * @returns {Promise<Array>}
 */
LotSchema.statics.findPublic = function(filter = {}) {
  const query = { isPublic: true, ...filter };
  return this.find(query)
    .populate('publishedBy', 'nom prenom email')
    .populate('analyzedBy', 'nom prenom email')
    .sort({ publishedAt: -1 });
};

/**
 * Récupère les rapports publics par type de produit
 * @param {string} productType - Type de produit
 * @returns {Promise<Array>}
 */
LotSchema.statics.findPublicByProduct = function(productType) {
  return this.findPublic({ productType });
};

/**
 * Récupère les rapports publics par décision
 * @param {string} decision - SAIN ou ENDOMMAGÉ
 * @returns {Promise<Array>}
 */
LotSchema.statics.findPublicByDecision = function(decision) {
  return this.findPublic({ "analysis.decision": decision });
};

/**
 * Compte les rapports publics par statut
 * @returns {Promise<Object>}
 */
LotSchema.statics.countPublicStats = async function() {
  const stats = await this.aggregate([
    { $match: { isPublic: true } },
    {
      $group: {
        _id: "$analysis.decision",
        count: { $sum: 1 }
      }
    }
  ]);

  const result = {
    total: 0,
    sains: 0,
    endommages: 0
  };

  stats.forEach(stat => {
    result.total += stat.count;
    if (stat._id === "SAIN") result.sains = stat.count;
    if (stat._id === "ENDOMMAGÉ") result.endommages = stat.count;
  });

  return result;
};

/**
 * Récupère les statistiques détaillées pour le dashboard
 * @param {ObjectId} userId - ID de l'utilisateur
 * @returns {Promise<Object>}
 */
LotSchema.statics.getDashboardStats = async function(userId) {
  const total = await this.countDocuments({ analyzedBy: userId });
  
  const byDecision = await this.aggregate([
    { $match: { analyzedBy: userId } },
    {
      $group: {
        _id: "$analysis.decision",
        count: { $sum: 1 }
      }
    }
  ]);

  const byProduct = await this.aggregate([
    { $match: { analyzedBy: userId } },
    {
      $group: {
        _id: "$productType",
        count: { $sum: 1 }
      }
    }
  ]);

  const public = await this.countDocuments({ 
    analyzedBy: userId,
    isPublic: true 
  });

  // Statistiques de stock (NOUVEAU)
  const stockStats = await this.aggregate([
    { $match: { analyzedBy: userId, isPublic: true } },
    {
      $group: {
        _id: null,
        totalWeight: { $sum: "$weight" },
        totalAvailable: { $sum: { $ifNull: ["$availableWeight", "$weight"] } },
        totalSold: { $sum: { $ifNull: ["$soldWeight", 0] } }
      }
    }
  ]);

  const stats = {
    total,
    sains: 0,
    endommages: 0,
    erreurs: 0,
    public,
    produits: {},
    stock: stockStats[0] || { totalWeight: 0, totalAvailable: 0, totalSold: 0 }
  };

  byDecision.forEach(stat => {
    if (stat._id === "SAIN") stats.sains = stat.count;
    if (stat._id === "ENDOMMAGÉ") stats.endommages = stat.count;
    if (stat._id === "ERREUR") stats.erreurs = stat.count;
  });

  byProduct.forEach(stat => {
    stats.produits[stat._id] = stat.count;
  });

  return stats;
};

// ========== MIDDLEWARES ==========

/**
 * Middleware pre-save pour valider les données
 */
LotSchema.pre('save', function(next) {
  // S'assurer que productType est défini à partir de category si nécessaire
  if (!this.productType || this.productType === "inconnu") {
    if (this.category) {
      const cat = this.category.toLowerCase();
      if (cat.includes('tomate')) this.productType = 'tomate';
      else if (cat.includes('agrume')) this.productType = 'agrume';
      else if (cat.includes('fraise')) this.productType = 'fraise';
      else if (cat.includes('datte')) this.productType = 'datte';
    }
  }

  // Initialiser les champs de stock si nécessaire (NOUVEAU)
  if (this.weight && this.availableWeight === undefined) {
    this.availableWeight = this.weight;
    this.originalWeight = this.weight;
    this.soldWeight = this.soldWeight || 0;
  }

  // S'assurer que availableWeight n'est jamais négatif
  if (this.availableWeight < 0) {
    this.availableWeight = 0;
  }

  next();
});

/**
 * Middleware post-save pour loguer les changements de stock
 */
LotSchema.post('save', function(doc) {
  if (doc.isModified('availableWeight')) {
    console.log(`📦 Stock mis à jour pour lot ${doc.lotId}: ${doc.availableWeight} kg disponibles`);
  }
});

module.exports = mongoose.model("Lot", LotSchema);