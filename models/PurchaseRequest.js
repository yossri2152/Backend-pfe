// models/PurchaseRequest.js

const mongoose = require("mongoose");

const PurchaseRequestSchema = new mongoose.Schema({
  // Lien vers le lot (pour la gestion des stocks)
  lotId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lot',
    required: true // Rendre obligatoire pour lier à un lot spécifique
  },
  lotNumber: {
    type: String,
    required: true
  },
  
  // Informations client
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  clientEmail: {
    type: String,
    required: true
  },
  clientName: {
    type: String,
    required: true
  },

  // Informations produit
  productType: {
    type: String,
    enum: ["dattes", "fraises", "tomates", "agrumes"],
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  tradeType: {
    type: String,
    enum: ["national", "international"],
    required: true
  },

  // Prix
  proposedPrice: {
    type: Number,
    required: true,
    min: 0
  },
  minPrice: {
    type: Number,
    required: true
  },
  maxPrice: {
    type: Number,
    required: true
  },
  totalPrice: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    enum: ["DT", "€"],
    default: "DT"
  },

  // Statut de la demande
  status: {
    type: String,
    enum: ["en_attente", "approuve", "refuse"],
    default: "en_attente"
  },

  // Snapshot du lot au moment de la demande (pour historique)
  lotSnapshot: {
    weight: {
      type: Number,
      required: true
    },
    availableWeight: {
      type: Number,
      required: true
    },
    originalWeight: {
      type: Number,
      required: true
    },
    originRegion: String,
    quality: String,
    decision: String,
    category: String,
    analyzedBy: String
  },

  // Dates et traitement
  createdAt: {
    type: Date,
    default: Date.now
  },
  processedAt: Date,
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Commentaire (optionnel)
  adminComment: String
}, {
  timestamps: true
});

// Index pour optimiser les recherches
PurchaseRequestSchema.index({ clientId: 1, status: 1 });
PurchaseRequestSchema.index({ lotId: 1, status: 1 });
PurchaseRequestSchema.index({ status: 1, createdAt: -1 });
PurchaseRequestSchema.index({ productType: 1, status: 1 });

// Méthode pour vérifier si la demande peut être modifiée
PurchaseRequestSchema.methods.isModifiable = function() {
  return this.status === 'en_attente';
};

// Méthode pour obtenir le statut en français
PurchaseRequestSchema.methods.getStatusLabel = function() {
  const labels = {
    'en_attente': 'En attente',
    'approuve': 'Approuvée',
    'refuse': 'Refusée'
  };
  return labels[this.status] || this.status;
};

// Méthode pour obtenir le montant formaté
PurchaseRequestSchema.methods.getFormattedTotal = function() {
  return `${this.totalPrice.toFixed(2)} ${this.currency}`;
};

// Méthode pour calculer le pourcentage de la fourchette de prix
PurchaseRequestSchema.methods.getPricePercentage = function() {
  const range = this.maxPrice - this.minPrice;
  if (range === 0) return 50;
  const percentage = ((this.proposedPrice - this.minPrice) / range) * 100;
  return Math.min(100, Math.max(0, percentage));
};

// Méthode pour vérifier si le prix est dans la fourchette
PurchaseRequestSchema.methods.isPriceValid = function() {
  return this.proposedPrice >= this.minPrice && this.proposedPrice <= this.maxPrice;
};

// Middleware pre-save pour valider les données
PurchaseRequestSchema.pre('save', function(next) {
  // Valider que le prix proposé est dans la fourchette
  if (this.proposedPrice < this.minPrice || this.proposedPrice > this.maxPrice) {
    const error = new Error(`Le prix proposé (${this.proposedPrice} ${this.currency}) doit être entre ${this.minPrice} et ${this.maxPrice} ${this.currency}`);
    return next(error);
  }
  
  // Recalculer le prix total si nécessaire
  this.totalPrice = this.quantity * this.proposedPrice;
  
  next();
});

// Middleware pre-save pour s'assurer que le snapshot du lot est présent
PurchaseRequestSchema.pre('save', async function(next) {
  if (!this.lotSnapshot && this.lotId) {
    try {
      const Lot = mongoose.model('Lot');
      const lot = await Lot.findById(this.lotId);
      
      if (lot) {
        this.lotSnapshot = {
          weight: lot.weight || 0,
          availableWeight: lot.availableWeight || lot.weight || 0,
          originalWeight: lot.originalWeight || lot.weight || 0,
          originRegion: lot.originRegion,
          quality: lot.initialQuality,
          decision: lot.analysis?.decision,
          category: lot.category,
          analyzedBy: lot.analyzedBy ? lot.analyzedBy.toString() : null
        };
      }
    } catch (error) {
      console.error('❌ Erreur création snapshot:', error);
    }
  }
  next();
});

module.exports = mongoose.model("PurchaseRequest", PurchaseRequestSchema);