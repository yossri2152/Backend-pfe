// controllers/purchase.controller.js - Version complète avec gestion des stocks

const PurchaseRequest = require("../models/PurchaseRequest");
const User = require("../models/User");
const Lot = require("../models/Lot");
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
    this.getLotPurchaseInfo = this.getLotPurchaseInfo.bind(this);
    this.getLotStockInfo = this.getLotStockInfo.bind(this);
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
      'agrumes': 'agrumes',
      // Pour la compatibilité avec le modèle Lot
      'tomate': 'tomates',
      'agrume': 'agrumes',
      'fraise': 'fraises',
      'datte': 'dattes'
    };
    
    return productMapping[type] || type;
  }

  /**
   * Convertit le type de produit du format Lot vers format PurchaseRequest
   */
  convertLotProductType(lotProductType) {
    const conversion = {
      'tomate': 'tomates',
      'agrume': 'agrumes',
      'fraise': 'fraises',
      'datte': 'dattes',
      'Tomates': 'tomates',
      'Agrumes': 'agrumes',
      'Fraises': 'fraises',
      'Dattes': 'dattes'
    };
    return conversion[lotProductType] || 'tomates';
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
   * Récupérer les informations d'achat d'un lot spécifique
   */
  async getLotPurchaseInfo(req, res) {
    try {
      const { lotId } = req.params;
      
      const lot = await Lot.findById(lotId)
        .populate('analyzedBy', 'nom prenom email');
      
      if (!lot) {
        return res.status(404).json({
          success: false,
          message: "Lot non trouvé"
        });
      }
      
      // Vérifier que le lot est public
      if (!lot.isPublic) {
        return res.status(403).json({
          success: false,
          message: "Ce lot n'est pas disponible à l'achat"
        });
      }
      
      // Convertir le type de produit
      const productTypeForPrice = this.convertLotProductType(lot.productType || lot.category);
      
      // Récupérer les fourchettes de prix
      const nationalRange = this.getPriceRangeForProduct(productTypeForPrice, 'national');
      const internationalRange = this.getPriceRangeForProduct(productTypeForPrice, 'international');
      
      // Récupérer les informations de stock
      const stockInfo = await this.getLotStockInfo(lot);
      
      res.json({
        success: true,
        data: {
          lotId: lot._id,
          lotNumber: lot.lotId,
          productType: productTypeForPrice,
          originalProductType: lot.productType || lot.category,
          category: lot.category,
          originRegion: lot.originRegion,
          destinationRegion: lot.destinationRegion,
          quality: lot.initialQuality,
          decision: lot.analysis?.decision,
          weight: lot.weight || 0,
          availableWeight: stockInfo.availableWeight,
          originalWeight: stockInfo.originalWeight,
          soldWeight: stockInfo.soldWeight,
          soldPercentage: stockInfo.soldPercentage,
          priceRanges: {
            national: nationalRange,
            international: internationalRange
          },
          analyzedBy: lot.analyzedBy ? {
            nom: lot.analyzedBy.nom,
            prenom: lot.analyzedBy.prenom
          } : null,
          publishedAt: lot.publishedAt,
          analysis: lot.analysis ? {
            decision: lot.analysis.decision,
            riskLevel: lot.analysis.riskLevel,
            issues: lot.analysis.issues
          } : null
        }
      });
      
    } catch (error) {
      console.error('❌ Erreur get lot purchase info:', error);
      res.status(500).json({
        success: false,
        message: "Erreur serveur"
      });
    }
  }

  /**
   * Récupère les informations de stock d'un lot
   */
  async getLotStockInfo(lot) {
    // Initialiser les champs de stock s'ils n'existent pas
    if (lot.availableWeight === undefined) {
      lot.availableWeight = lot.weight || 0;
      lot.originalWeight = lot.weight || 0;
      lot.soldWeight = 0;
      await lot.save();
    }

    // Calculer le pourcentage vendu
    const soldPercentage = lot.originalWeight > 0 
      ? ((lot.soldWeight || 0) / lot.originalWeight * 100).toFixed(1)
      : 0;

    return {
      availableWeight: lot.availableWeight || 0,
      originalWeight: lot.originalWeight || lot.weight || 0,
      soldWeight: lot.soldWeight || 0,
      soldPercentage
    };
  }

  /**
   * Créer une nouvelle demande d'achat (liée à un lot)
   */
  async createRequest(req, res) {
    try {
      const { lotId, productType, quantity, tradeType, proposedPrice } = req.body;
      const clientId = req.user.userId;

      console.log('📝 Création demande:', { lotId, productType, quantity, tradeType, proposedPrice, clientId });

      // Validation des données
      if (!lotId || !productType || !quantity || !tradeType || !proposedPrice) {
        return res.status(400).json({
          success: false,
          message: "Tous les champs sont requis"
        });
      }

      // Récupérer le lot pour vérifier le poids disponible
      const lot = await Lot.findById(lotId);
      if (!lot) {
        return res.status(404).json({
          success: false,
          message: "Lot non trouvé"
        });
      }

      // Vérifier que le lot est public
      if (!lot.isPublic) {
        return res.status(403).json({
          success: false,
          message: "Ce lot n'est pas disponible à l'achat"
        });
      }

      // Obtenir les informations de stock
      const stockInfo = await this.getLotStockInfo(lot);
      
      // Vérifier la quantité
      if (quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: "La quantité doit être supérieure à 0"
        });
      }

      if (quantity > stockInfo.availableWeight) {
        return res.status(400).json({
          success: false,
          message: `Quantité insuffisante. Disponible: ${stockInfo.availableWeight} kg (${stockInfo.soldPercentage}% déjà vendu)`
        });
      }

      // Récupérer les infos client
      const client = await User.findById(clientId);
      if (!client) {
        return res.status(404).json({
          success: false,
          message: "Client non trouvé"
        });
      }

      // Normaliser le type de produit
      const normalizedProductType = this.normalizeProductType(productType);

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

      // Vérifier s'il y a déjà des demandes en attente pour ce lot par ce client
      const existingRequest = await PurchaseRequest.findOne({
        lotId: lot._id,
        clientId,
        status: 'en_attente'
      });

      if (existingRequest) {
        return res.status(400).json({
          success: false,
          message: "Vous avez déjà une demande en attente pour ce lot"
        });
      }

      const request = new PurchaseRequest({
        lotId: lot._id,
        lotNumber: lot.lotId,
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
        status: "en_attente",
        lotSnapshot: {
          weight: lot.weight,
          availableWeight: stockInfo.availableWeight,
          originalWeight: stockInfo.originalWeight,
          soldWeight: stockInfo.soldWeight,
          originRegion: lot.originRegion,
          quality: lot.initialQuality,
          decision: lot.analysis?.decision,
          productType: lot.productType,
          category: lot.category
        }
      });

      await request.save();

      console.log('✅ Demande créée avec succès:', request._id);

      // Émettre un événement WebSocket pour notifier les responsables
      if (req.io) {
        req.io.to('responsables').emit('purchase:new-request', {
          requestId: request._id,
          lotNumber: lot.lotId,
          clientName: request.clientName,
          productType: request.productType,
          quantity: request.quantity,
          totalPrice: request.totalPrice,
          currency: request.currency,
          createdAt: request.createdAt
        });

        // Notifier également le client
        req.io.to(`user_${clientId}`).emit('purchase:request-created', {
          requestId: request._id,
          lotNumber: lot.lotId,
          status: 'en_attente'
        });
      }

      res.status(201).json({
        success: true,
        message: "Demande d'achat créée avec succès",
        data: {
          _id: request._id,
          lotNumber: request.lotNumber,
          productType: request.productType,
          quantity: request.quantity,
          proposedPrice: request.proposedPrice,
          totalPrice: request.totalPrice,
          currency: request.currency,
          tradeType: request.tradeType,
          status: request.status,
          createdAt: request.createdAt
        }
      });

    } catch (error) {
      console.error('❌ Erreur création demande:', error);
      
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
      const { status, page = 1, limit = 20 } = req.query;

      console.log('📥 Récupération demandes client:', clientId);

      const query = { clientId };
      if (status && ['en_attente', 'approuve', 'refuse'].includes(status)) {
        query.status = status;
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const requests = await PurchaseRequest.find(query)
        .populate('lotId', 'lotId productType category originRegion weight availableWeight')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await PurchaseRequest.countDocuments(query);

      // Statistiques pour le client
      const stats = {
        total: total,
        en_attente: await PurchaseRequest.countDocuments({ clientId, status: 'en_attente' }),
        approuve: await PurchaseRequest.countDocuments({ clientId, status: 'approuve' }),
        refuse: await PurchaseRequest.countDocuments({ clientId, status: 'refuse' })
      };

      res.json({
        success: true,
        data: {
          requests,
          stats,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
          }
        }
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
      const { status, page = 1, limit = 20 } = req.query;
      const query = {};
      
      if (status && ['en_attente', 'approuve', 'refuse'].includes(status)) {
        query.status = status;
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const requests = await PurchaseRequest.find(query)
        .populate('clientId', 'nom prenom email telephone')
        .populate('lotId', 'lotId productType category originRegion weight availableWeight originalWeight soldWeight')
        .populate('processedBy', 'nom prenom email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await PurchaseRequest.countDocuments(query);

      // Statistiques globales
      const stats = {
        total: await PurchaseRequest.countDocuments(),
        en_attente: await PurchaseRequest.countDocuments({ status: 'en_attente' }),
        approuve: await PurchaseRequest.countDocuments({ status: 'approuve' }),
        refuse: await PurchaseRequest.countDocuments({ status: 'refuse' }),
        totalQuantity: await PurchaseRequest.aggregate([
          { $match: { status: 'approuve' } },
          { $group: { _id: null, total: { $sum: "$quantity" } } }
        ]).then(r => r[0]?.total || 0)
      };

      res.json({
        success: true,
        data: {
          requests,
          stats,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
          }
        }
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
      }).populate('lotId');

      if (!request) {
        return res.status(404).json({
          success: false,
          message: "Demande non trouvée ou ne peut pas être modifiée"
        });
      }

      // Ne pas permettre de changer des champs critiques
      delete updates.productType;
      delete updates.tradeType;
      delete updates.clientId;
      delete updates.status;
      delete updates.lotId;
      delete updates._id;

      // Si la quantité change, vérifier le stock disponible
      if (updates.quantity && request.lotId) {
        const lot = request.lotId;
        const stockInfo = await this.getLotStockInfo(lot);
        
        // Calculer la nouvelle quantité totale demandée
        const newQuantity = updates.quantity;
        
        if (newQuantity > stockInfo.availableWeight + request.quantity) {
          return res.status(400).json({
            success: false,
            message: `Quantité insuffisante. Disponible: ${stockInfo.availableWeight} kg`
          });
        }
      }

      // Si le prix change, vérifier la fourchette
      if (updates.proposedPrice) {
        const priceRange = this.getPriceRangeForProduct(request.productType, request.tradeType);
        if (updates.proposedPrice < priceRange.min || updates.proposedPrice > priceRange.max) {
          return res.status(400).json({
            success: false,
            message: `Le prix doit être entre ${priceRange.min} et ${priceRange.max} ${request.currency}`
          });
        }
      }

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
   * Approuver une demande (admin uniquement) - MET À JOUR LE STOCK
   */
  async approveRequest(req, res) {
    try {
      const { requestId } = req.params;
      const adminId = req.user.userId;

      const request = await PurchaseRequest.findById(requestId).populate('lotId');
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

      // Vérifier le stock disponible si lié à un lot
      if (request.lotId) {
        const lot = request.lotId;
        const stockInfo = await this.getLotStockInfo(lot);
        
        if (request.quantity > stockInfo.availableWeight) {
          return res.status(400).json({
            success: false,
            message: `Stock insuffisant pour ce lot. Disponible: ${stockInfo.availableWeight} kg`
          });
        }

        // Mettre à jour le stock du lot
        const newAvailable = stockInfo.availableWeight - request.quantity;
        const newSold = (lot.soldWeight || 0) + request.quantity;
        
        await Lot.findByIdAndUpdate(lot._id, {
          availableWeight: newAvailable,
          soldWeight: newSold
        });

        console.log(`📦 Stock mis à jour pour lot ${lot.lotId}: ${newAvailable} kg restants (${newSold} kg vendus)`);
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

      // Émettre événement WebSocket
      if (req.io) {
        req.io.to(`user_${request.clientId}`).emit('purchase:request-approved', {
          requestId: request._id,
          lotNumber: request.lotNumber,
          quantity: request.quantity,
          status: 'approuve'
        });

        // Notifier les responsables du changement de stock
        if (request.lotId) {
          req.io.to('responsables').emit('purchase:stock-updated', {
            lotId: request.lotId._id,
            lotNumber: request.lotNumber,
            availableWeight: request.lotId.availableWeight,
            soldWeight: request.lotId.soldWeight
          });
        }
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
      request.adminComment = comment || "Demande refusée";
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

      // Émettre événement WebSocket
      if (req.io) {
        req.io.to(`user_${request.clientId}`).emit('purchase:request-rejected', {
          requestId: request._id,
          lotNumber: request.lotNumber,
          comment: comment
        });
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