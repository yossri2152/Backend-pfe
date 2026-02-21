const mongoose = require("mongoose");

const PurchaseRequestSchema = new mongoose.Schema({
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
  minPrice: Number,
  maxPrice: Number,
  totalPrice: {
    type: Number,
    required: true
  },

  // Statut
  status: {
    type: String,
    enum: ["en_attente", "approuve", "refuse"],
    default: "en_attente"
  },
  currency: {
    type: String,
    enum: ["DT", "€"],
    default: "DT"
  },

  // Dates
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

// Index pour les recherches
PurchaseRequestSchema.index({ clientId: 1 });
PurchaseRequestSchema.index({ status: 1 });
PurchaseRequestSchema.index({ createdAt: -1 });

module.exports = mongoose.model("PurchaseRequest", PurchaseRequestSchema);