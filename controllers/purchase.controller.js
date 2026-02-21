const PurchaseRequest = require("../models/PurchaseRequest");
const User = require("../models/User");
const { sendPurchaseApprovalEmail, sendPurchaseRejectionEmail } = require('../utils/emailService');

// Prix pour national (DT/kg) - CORRESPONDANCE EXACTE AVEC LE FRONTEND
const NATIONAL_PRICES = {
  dattes: { min: 8, max: 18 },
  fraises: { min: 4, max: 10 },
  tomates: { min: 1.5, max: 4 },
  agrumes: { min: 2, max: 6 }
};

// Prix pour international (€/kg)
const INTERNATIONAL_PRICES = {
  dattes: { min: 3, max: 8 },
  fraises: { min: 2, max: 6 },
  tomates: { min: 1.5, max: 5 },
  agrumes: { min: 2, max: 6 }
};

class PurchaseController {
  constructor() {
    this.createRequest = this.createRequest.bind(this);
    this.getClientRequests = this.getClientRequests.bind(this);
    this.getAllRequests = this.getAllRequests.bind(this);
    this.updateRequest = this.updateRequest.bind(this);
    this.deleteRequest = this.deleteRequest.bind(this);
    this.approveRequest = this.approveRequest.bind(this);
    this.rejectRequest = this.rejectRequest.bind(this);
    this.getPriceRange = this.getPriceRange.bind(this);
    this.normalizeProductType = this.normalizeProductType.bind(this);
  }

  /**
   * Normalise le type de produit (gère singulier/pluriel)
   */
  normalizeProductType(productType) {
    const type = productType.toLowerCase().trim();
    
    // Mapping des variations possibles (singulier/pluriel)
    const productMapping = {
      'datte': 'dattes',
      'dattes': 'dattes',
      'fraise': 'fraises',
      'fraises': 'fraises',
      'tomate': 'tomates',
      'tomates': 'tomates',
      'agrume': 'agrumes',
      'agrumes': 'agrumes'
    };
    
    return productMapping[type] || type;
  }

  /**
   * Récupérer la fourchette de prix pour un produit
   */
  getPriceRangeForProduct(productType, tradeType) {
    console.log('🔍 Recherche prix pour:', { productType, tradeType });
    
    // Normaliser le type de produit
    const normalizedType = this.normalizeProductType(productType);
    
    if (tradeType === 'national') {
      const range = NATIONAL_PRICES[normalizedType];
      console.log('📊 Prix national trouvé:', range);
      return range || { min: 0, max: 0 };
    } else {
      const range = INTERNATIONAL_PRICES[normalizedType];
      console.log('📊 Prix international trouvé:', range);
      return range || { min: 0, max: 0 };
    }
  }

  /**
   * API pour récupérer la fourchette de prix
   */
  async getPriceRange(req, res) {
    try {
      const { productType, tradeType } = req.query;
      
      console.log('📥 Requête prix reçue:', { productType, tradeType });
      
      if (!productType || !tradeType) {
        return res.status(400).json({
          success: false,
          message: "Paramètres manquants"
        });
      }

      const range = this.getPriceRangeForProduct(productType, tradeType);
      const currency = tradeType === 'national' ? 'DT' : '€';
      
      console.log('✅ Réponse prix:', { range, currency });
      
      res.json({
        success: true,
        data: {
          min: range.min,
          max: range.max,
          currency
        }
      });

    } catch (error) {
      console.error('❌ Erreur prix:', error);
      res.status(500).json({
        success: false,
        message: "Erreur serveur"
      });
    }
  }

  /**
   * Créer une nouvelle demande d'achat
   */
  async createRequest(req, res) {
    try {
      const { productType, quantity, tradeType, proposedPrice } = req.body;
      const clientId = req.user.userId;

      console.log('📝 Création demande:', { productType, quantity, tradeType, proposedPrice, clientId });

      // Validation des données
      if (!productType || !quantity || !tradeType || !proposedPrice) {
        return res.status(400).json({
          success: false,
          message: "Tous les champs sont requis"
        });
      }

      // Validation de la quantité
      if (quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: "La quantité doit être supérieure à 0"
        });
      }

      // Normaliser le type de produit
      const normalizedProductType = this.normalizeProductType(productType);

      // Récupérer les infos client
      const client = await User.findById(clientId);
      if (!client) {
        return res.status(404).json({
          success: false,
          message: "Client non trouvé"
        });
      }

      // Valider le prix proposé
      const priceRange = this.getPriceRangeForProduct(normalizedProductType, tradeType);
      
      // Vérifier si le type de produit est valide
      if (priceRange.min === 0 && priceRange.max === 0) {
        return res.status(400).json({
          success: false,
          message: "Type de produit invalide"
        });
      }

      if (proposedPrice < priceRange.min || proposedPrice > priceRange.max) {
        return res.status(400).json({
          success: false,
          message: `Le prix doit être entre ${priceRange.min} et ${priceRange.max} ${tradeType === 'national' ? 'DT' : '€'}`
        });
      }

      // Calculer le prix total
      const totalPrice = proposedPrice * quantity;
      const currency = tradeType === 'national' ? 'DT' : '€';

      const request = new PurchaseRequest({
        clientId,
        clientEmail: client.email,
        clientName: `${client.prenom} ${client.nom}`,
        productType: normalizedProductType,
        quantity,
        tradeType,
        proposedPrice,
        minPrice: priceRange.min,
        maxPrice: priceRange.max,
        totalPrice,
        currency,
        status: "en_attente"
      });

      await request.save();

      console.log('✅ Demande créée avec succès:', request._id);

      res.status(201).json({
        success: true,
        message: "Demande d'achat créée avec succès",
        data: request
      });

    } catch (error) {
      console.error('❌ Erreur création demande:', error);
      
      // Gestion des erreurs de validation MongoDB
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: "Erreur de validation",
          errors: Object.values(error.errors).map(err => err.message)
        });
      }

      res.status(500).json({
        success: false,
        message: "Erreur lors de la création de la demande"
      });
    }
  }

  /**
   * Récupérer toutes les demandes d'un client
   */
  async getClientRequests(req, res) {
    try {
      const clientId = req.user.userId;
      const { status } = req.query;

      console.log('📥 Récupération demandes client:', clientId);

      const query = { clientId };
      if (status && ['en_attente', 'approuve', 'refuse'].includes(status)) {
        query.status = status;
      }

      const requests = await PurchaseRequest.find(query)
        .sort({ createdAt: -1 });

      res.json({
        success: true,
        count: requests.length,
        data: requests
      });

    } catch (error) {
      console.error('❌ Erreur récupération demandes:', error);
      res.status(500).json({
        success: false,
        message: "Erreur serveur"
      });
    }
  }

  /**
   * Récupérer toutes les demandes (admin uniquement)
   */
  async getAllRequests(req, res) {
    try {
      const { status } = req.query;
      const query = {};
      
      if (status && ['en_attente', 'approuve', 'refuse'].includes(status)) {
        query.status = status;
      }

      const requests = await PurchaseRequest.find(query)
        .populate('clientId', 'nom prenom email telephone')
        .populate('processedBy', 'nom prenom')
        .sort({ createdAt: -1 });

      res.json({
        success: true,
        count: requests.length,
        data: requests
      });

    } catch (error) {
      console.error('❌ Erreur récupération demandes admin:', error);
      res.status(500).json({
        success: false,
        message: "Erreur serveur"
      });
    }
  }

  /**
   * Modifier une demande (client uniquement, seulement si en attente)
   */
  async updateRequest(req, res) {
    try {
      const { requestId } = req.params;
      const clientId = req.user.userId;
      const updates = req.body;

      const request = await PurchaseRequest.findOne({
        _id: requestId,
        clientId,
        status: "en_attente"
      });

      if (!request) {
        return res.status(404).json({
          success: false,
          message: "Demande non trouvée ou ne peut pas être modifiée"
        });
      }

      // Ne pas permettre de changer le type de produit ou le type de transaction
      delete updates.productType;
      delete updates.tradeType;
      delete updates.clientId;
      delete updates.status;

      // Recalculer le prix total si quantité ou prix changé
      if (updates.quantity || updates.proposedPrice) {
        const quantity = updates.quantity || request.quantity;
        const price = updates.proposedPrice || request.proposedPrice;
        updates.totalPrice = quantity * price;
      }

      Object.assign(request, updates);
      await request.save();

      res.json({
        success: true,
        message: "Demande modifiée avec succès",
        data: request
      });

    } catch (error) {
      console.error('❌ Erreur modification demande:', error);
      res.status(500).json({
        success: false,
        message: "Erreur serveur"
      });
    }
  }

  /**
   * Supprimer une demande (client uniquement, seulement si en attente)
   */
  async deleteRequest(req, res) {
    try {
      const { requestId } = req.params;
      const clientId = req.user.userId;

      const request = await PurchaseRequest.findOneAndDelete({
        _id: requestId,
        clientId,
        status: "en_attente"
      });

      if (!request) {
        return res.status(404).json({
          success: false,
          message: "Demande non trouvée ou ne peut pas être supprimée"
        });
      }

      res.json({
        success: true,
        message: "Demande supprimée avec succès"
      });

    } catch (error) {
      console.error('❌ Erreur suppression demande:', error);
      res.status(500).json({
        success: false,
        message: "Erreur serveur"
      });
    }
  }

  /**
   * Approuver une demande (admin uniquement)
   */
  async approveRequest(req, res) {
    try {
      const { requestId } = req.params;
      const adminId = req.user.userId;

      const request = await PurchaseRequest.findById(requestId);
      if (!request) {
        return res.status(404).json({
          success: false,
          message: "Demande non trouvée"
        });
      }

      if (request.status !== 'en_attente') {
        return res.status(400).json({
          success: false,
          message: "Cette demande a déjà été traitée"
        });
      }

      request.status = "approuve";
      request.processedAt = new Date();
      request.processedBy = adminId;
      await request.save();

      // Envoyer email au client
      try {
        await sendPurchaseApprovalEmail(request.clientEmail, {
          clientName: request.clientName,
          productType: request.productType,
          quantity: request.quantity,
          totalPrice: request.totalPrice,
          currency: request.currency
        });
        console.log(`✅ Email d'approbation envoyé à ${request.clientEmail}`);
      } catch (emailError) {
        console.error('❌ Erreur envoi email:', emailError);
        // On continue même si l'email échoue
      }

      res.json({
        success: true,
        message: "Demande approuvée avec succès",
        data: request
      });

    } catch (error) {
      console.error('❌ Erreur approbation:', error);
      res.status(500).json({
        success: false,
        message: "Erreur serveur"
      });
    }
  }

  /**
   * Refuser une demande (admin uniquement)
   */
  async rejectRequest(req, res) {
    try {
      const { requestId } = req.params;
      const adminId = req.user.userId;
      const { comment } = req.body;

      const request = await PurchaseRequest.findById(requestId);
      if (!request) {
        return res.status(404).json({
          success: false,
          message: "Demande non trouvée"
        });
      }

      if (request.status !== 'en_attente') {
        return res.status(400).json({
          success: false,
          message: "Cette demande a déjà été traitée"
        });
      }

      request.status = "refuse";
      request.processedAt = new Date();
      request.processedBy = adminId;
      request.adminComment = comment || null;
      await request.save();

      // Envoyer email au client
      try {
        await sendPurchaseRejectionEmail(request.clientEmail, {
          clientName: request.clientName,
          productType: request.productType,
          comment: comment || "Non spécifié"
        });
        console.log(`📧 Email de refus envoyé à ${request.clientEmail}`);
      } catch (emailError) {
        console.error('❌ Erreur envoi email:', emailError);
        // On continue même si l'email échoue
      }

      res.json({
        success: true,
        message: "Demande refusée",
        data: request
      });

    } catch (error) {
      console.error('❌ Erreur refus:', error);
      res.status(500).json({
        success: false,
        message: "Erreur serveur"
      });
    }
  }
}

module.exports = new PurchaseController();