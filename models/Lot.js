const mongoose = require("mongoose");

const LotSchema = new mongoose.Schema({
  // Identifiants
  lotId: {
    type: String,
    required: true,
    unique: true
  },
  fileName: {
    type: String,
    required: true
  },
  
  // Données du lot
  temperature: Number,
  humidity: Number,
  rain: Number,
  pressure: Number,
  duration: Number,
  shock: String,
  sunExposure: Number,
  ventilation: String,
  
  // Type de produit
  productType: {
    type: String,
    enum: ["tomate", "agrume", "fraise", "datte", "inconnu"],
    default: "inconnu"
  },
  
  // Résultats d'analyse (moteur de règles)
  analysis: {
    issues: [String],
    riskLevel: {
      type: String,
      enum: ["Faible", "Moyen", "Élevé", "Inconnu"]
    },
    decision: {
      type: String,
      enum: ["Lot Sain", "Lot Endommagé", "Erreur d'analyse", "Inconnu"]
    },
    issueCount: Number,
    details: {
      temperature: String,
      humidity: String,
      pressure: String,
      rain: String,
      duration: String,
      shock: String,
      sunExposure: String,
      ventilation: String
    }
  },
  
  // Rapport IA (Ollama)
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
  
  // ========== NOUVEAUX CHAMPS POUR LA VISIBILITÉ CLIENT ==========
  // Indique si le rapport est visible par les clients
  isPublic: {
    type: Boolean,
    default: false
  },
  // Date de publication
  publishedAt: {
    type: Date
  },
  // Qui a publié le rapport
  publishedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // ==============================================================
  
  // Métadonnées
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

// NOUVEAU : Index pour la recherche des rapports publics
LotSchema.index({ isPublic: 1, publishedAt: -1 });

// Index composé pour les filtres clients
LotSchema.index({ isPublic: 1, productType: 1, publishedAt: -1 });

// ========== MÉTHODES D'INSTANCE ==========

/**
 * Vérifie si le lot est visible par les clients
 */
LotSchema.methods.isVisibleToClients = function() {
  return this.isPublic === true && this.publishedAt !== null;
};

/**
 * Publie le rapport pour les clients
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

// ========== MÉTHODES STATIQUES ==========

/**
 * Récupère tous les rapports publics
 */
LotSchema.statics.findPublic = function(filter = {}) {
  const query = { isPublic: true, ...filter };
  return this.find(query)
    .populate('publishedBy', 'nom prenom')
    .populate('analyzedBy', 'nom prenom')
    .sort({ publishedAt: -1 });
};

/**
 * Récupère les rapports publics par type de produit
 */
LotSchema.statics.findPublicByProduct = function(productType) {
  return this.findPublic({ productType });
};

/**
 * Compte les rapports publics par statut
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
    if (stat._id === "Lot Sain") result.sains = stat.count;
    if (stat._id === "Lot Endommagé") result.endommages = stat.count;
  });

  return result;
};

module.exports = mongoose.model("Lot", LotSchema);