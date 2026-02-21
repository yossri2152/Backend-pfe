const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const Lot = require('../models/Lot');
const CSVFile = require('../models/CSVFile');
const analysisService = require('../services/analysis.service');

class AnalysisController {
  constructor() {
    // Lier les méthodes pour éviter les problèmes de contexte
    this.readCSVFile = this.readCSVFile.bind(this);
    this.analyzeCSVFile = this.analyzeCSVFile.bind(this);
    this.getAnalyzedLots = this.getAnalyzedLots.bind(this);
    this.getAnalysisStats = this.getAnalysisStats.bind(this);
    this.generateLotPDF = this.generateLotPDF.bind(this);
    this.testOllama = this.testOllama.bind(this);
    this.detectProductTypeFromFileName = this.detectProductTypeFromFileName.bind(this);
    
    // Nouvelles méthodes de publication
    this.publishLotReport = this.publishLotReport.bind(this);
    this.unpublishLotReport = this.unpublishLotReport.bind(this);
    this.getPublicLots = this.getPublicLots.bind(this);
    
    // Méthode de débogage
    this.debugLots = this.debugLots.bind(this);
  }

  /**
   * Lit un fichier CSV et retourne les données avec mapping spécifique aux colonnes de vos fichiers
   */
  async readCSVFile(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => {
          // Mapping spécifique aux colonnes de vos fichiers CSV
          const processed = {
            // Identifiants
            lotId: data.lot_id || '',
            category: data.category || '',
            
            // Métadonnées
            year: parseInt(data.annee) || 2026,
            month: parseInt(data.mois) || 3,
            initialQuality: data.qualite_initiale || 'excellente',
            
            // Données de transport (correspondance directe)
            duration: parseFloat(data.duree_voyage) || 0,
            temperature: parseFloat(data.temperature_mesuree) || 0,
            // Utilisation de la notation bracket pour les propriétés avec caractères spéciaux
            humidity: parseFloat(data['humidite_%'] !== undefined ? data['humidite_%'] : 0) || 0,
            shock: parseFloat(data.choc_transport) || 0,
            sunExposure: (parseFloat(data.temps_exposition_soleil_h) || 0) * 60, // Conversion heures → minutes
            ventilation: data.ventilation || '',
            
            // Données commerciales (optionnelles)
            weight: parseFloat(data.poids_kg) || 0,
            purchasePrice: parseFloat(data.prix_achat_unitaire) || 0,
            salePrice: parseFloat(data.prix_vente_unitaire) || 0,
            transportCost: parseFloat(data.cout_transport_total) || 0,
            margin: parseFloat(data.marge_brute) || 0
          };
          
          results.push(processed);
        })
        .on('end', () => {
          console.log(`📊 ${results.length} lots traités avec mapping spécifique`);
          if (results.length > 0) {
            console.log('📋 Exemple de lot traité:', JSON.stringify(results[0], null, 2));
          }
          resolve(results);
        })
        .on('error', (error) => {
          console.error('❌ Erreur lecture CSV:', error);
          reject(error);
        });
    });
  }

  /**
   * Détermine le type de produit à partir du nom du fichier
   */
  detectProductTypeFromFileName(fileName) {
    const name = fileName.toLowerCase();
    if (name.includes('tomate')) return 'tomate';
    if (name.includes('agrume') || name.includes('orange') || name.includes('citron')) return 'agrume';
    if (name.includes('fraise')) return 'fraise';
    if (name.includes('datte')) return 'datte';
    return 'tomate'; // Par défaut
  }

  /**
   * Analyse un fichier CSV complet (avec suppression des anciens résultats)
   */
  async analyzeCSVFile(req, res) {
    try {
      const { fileId } = req.params;
      const userId = req.user.userId;
      const io = req.io; // Récupérer l'instance WebSocket

      console.log(`📂 Début de l'analyse pour le fichier: ${fileId}`);

      // Récupérer le fichier CSV
      const csvFile = await CSVFile.findOne({
        _id: fileId,
        createdBy: userId
      });

      if (!csvFile) {
        return res.status(404).json({
          success: false,
          message: "Fichier CSV non trouvé"
        });
      }

      if (!fs.existsSync(csvFile.path)) {
        return res.status(404).json({
          success: false,
          message: "Fichier physique non trouvé"
        });
      }

      // Détecter le type de produit depuis le nom du fichier
      const productType = this.detectProductTypeFromFileName(csvFile.originalName);
      
      console.log(`📂 Analyse du fichier: ${csvFile.originalName} (produit détecté: ${productType})`);
      console.log(`📁 Chemin: ${csvFile.path}`);

      // 🔴 ÉTAPE IMPORTANTE : Supprimer les anciens résultats pour ce fichier
      const deletedCount = await Lot.deleteMany({ 
        csvFileId: csvFile._id,
        analyzedBy: userId 
      });
      console.log(`🗑️ ${deletedCount.deletedCount} anciens lots supprimés`);

      // Lire le fichier CSV avec le mapping spécifique
      const lots = await this.readCSVFile(csvFile.path);
      console.log(`📊 ${lots.length} lots trouvés`);

      if (lots.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Le fichier CSV est vide ou mal formaté"
        });
      }

      // Informer le client que l'analyse commence
      if (io) {
        io.to(`user_${userId}`).emit('analysis:started', {
          fileId,
          fileName: csvFile.originalName,
          totalLots: lots.length,
          productType
        });
      }

      // Analyser avec le service (moteur règles + Ollama)
      console.log(`🤖 Génération des rapports avec Ollama pour ${productType}...`);
      const lotsWithReports = await analysisService.analyzeBatch(lots, productType);

      // Sauvegarder dans MongoDB
      const savedLots = [];
      for (const lot of lotsWithReports) {
        try {
          const lotDoc = new Lot({
            lotId: lot.lotId || `LOT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            fileName: csvFile.originalName,
            productType: productType,
            category: lot.category,
            year: lot.year,
            month: lot.month,
            initialQuality: lot.initialQuality,
            temperature: lot.temperature || 0,
            humidity: lot.humidity || 0,
            duration: lot.duration || 0,
            shock: lot.shock ? lot.shock.toString() : 'non',
            sunExposure: lot.sunExposure || 0,
            ventilation: lot.ventilation || 'normale',
            weight: lot.weight || 0,
            purchasePrice: lot.purchasePrice || 0,
            salePrice: lot.salePrice || 0,
            transportCost: lot.transportCost || 0,
            margin: lot.margin || 0,
            analysis: lot.analysis || { 
              issues: [], 
              decision: "Inconnu", 
              issueCount: 0,
              riskLevel: "Inconnu",
              details: {}
            },
            aiReport: lot.aiReport || {},
            isPublic: false, // Par défaut non public
            analyzedBy: userId,
            csvFileId: csvFile._id,
            analyzedAt: new Date()
          });
          
          await lotDoc.save();
          savedLots.push(lotDoc);
        } catch (saveError) {
          console.error('❌ Erreur sauvegarde lot:', saveError.message);
        }
      }

      // Mettre à jour le fichier CSV avec le statut d'analyse
      csvFile.analyzedAt = new Date();
      csvFile.lotCount = savedLots.length;
      await csvFile.save();

      const sains = savedLots.filter(l => l.analysis?.decision === "Lot Sain").length;
      const endommages = savedLots.filter(l => l.analysis?.decision === "Lot Endommagé").length;
      const erreurs = savedLots.length - sains - endommages;

      console.log(`✅ Analyse terminée: ${savedLots.length} lots (${sains} sains, ${endommages} endommagés, ${erreurs} erreurs)`);

      // Informer le client que l'analyse est terminée
      if (io) {
        io.to(`user_${userId}`).emit('analysis:completed', {
          fileId,
          fileName: csvFile.originalName,
          totalLots: savedLots.length,
          stats: { sains, endommages, erreurs },
          deletedCount: deletedCount.deletedCount
        });
      }

      res.json({
        success: true,
        message: `Analyse terminée : ${savedLots.length} lots traités`,
        data: {
          fileId: csvFile._id,
          fileName: csvFile.originalName,
          productType: productType,
          totalLots: savedLots.length,
          stats: { sains, endommages, erreurs },
          deletedCount: deletedCount.deletedCount // Indiquer combien d'anciens lots ont été supprimés
        }
      });

    } catch (error) {
      console.error('❌ Erreur analyse CSV:', error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de l'analyse",
        error: error.message
      });
    }
  }

  /**
   * Récupère tous les lots analysés
   */
  async getAnalyzedLots(req, res) {
    try {
      const { fileId } = req.params;
      const userId = req.user.userId;

      const query = { analyzedBy: userId };
      if (fileId) {
        query.csvFileId = fileId;
      }

      const lots = await Lot.find(query)
        .sort({ analyzedAt: -1 })
        .limit(req.query.limit ? parseInt(req.query.limit) : 100);

      res.json({
        success: true,
        count: lots.length,
        data: lots
      });

    } catch (error) {
      console.error('❌ Erreur récupération lots:', error);
      res.status(500).json({
        success: false,
        message: "Erreur serveur"
      });
    }
  }

  /**
   * Récupère les statistiques d'analyse (VERSION CORRIGÉE)
   */
  async getAnalysisStats(req, res) {
    try {
      const userId = req.user.userId;

      // Récupérer tous les lots de l'utilisateur
      const lots = await Lot.find({ analyzedBy: userId });
      
      const total = lots.length;
      
      // Compter manuellement pour éviter les problèmes d'agrégation
      let sains = 0;
      let endommages = 0;
      let erreurs = 0;
      
      lots.forEach(lot => {
        const decision = lot.analysis?.decision;
        if (decision === "Lot Sain") {
          sains++;
        } else if (decision === "Lot Endommagé") {
          endommages++;
        } else {
          erreurs++;
        }
      });

      const result = {
        total,
        sains,
        endommages,
        erreurs
      };

      console.log('📊 Statistiques calculées (méthode manuelle):', result);

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('❌ Erreur stats:', error);
      res.status(500).json({
        success: false,
        message: "Erreur serveur"
      });
    }
  }

  /**
   * Route de débogage pour voir tous les lots
   */
  async debugLots(req, res) {
    try {
      const userId = req.user.userId;
      const lots = await Lot.find({ analyzedBy: userId })
        .select('lotId analysis.decision fileName productType');
      
      const decisions = lots.map(l => ({
        lotId: l.lotId,
        decision: l.analysis?.decision,
        productType: l.productType
      }));
      
      const counts = {
        total: lots.length,
        sains: lots.filter(l => l.analysis?.decision === "Lot Sain").length,
        endommages: lots.filter(l => l.analysis?.decision === "Lot Endommagé").length,
        undefined: lots.filter(l => !l.analysis?.decision).length
      };

      res.json({
        success: true,
        data: {
          counts,
          samples: decisions.slice(0, 20)
        }
      });
    } catch (error) {
      console.error('❌ Erreur debug:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
  }

  /**
   * Génère un PDF de rapport pour un lot (à implémenter)
   */
  async generateLotPDF(req, res) {
    try {
      const { lotId } = req.params;
      const userId = req.user.userId;

      const lot = await Lot.findOne({
        _id: lotId,
        analyzedBy: userId
      });

      if (!lot) {
        return res.status(404).json({
          success: false,
          message: "Lot non trouvé"
        });
      }

      // TODO: Implémenter la génération PDF avec PDFKit
      
      res.json({
        success: true,
        message: "PDF généré (à implémenter avec PDFKit)",
        data: lot
      });

    } catch (error) {
      console.error('❌ Erreur génération PDF:', error);
      res.status(500).json({
        success: false,
        message: "Erreur serveur"
      });
    }
  }

  /**
   * Teste la connexion à Ollama
   */
  async testOllama(req, res) {
    try {
      const result = await analysisService.testConnection();
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Erreur test Ollama",
        error: error.message
      });
    }
  }

  // ==================== NOUVELLES MÉTHODES DE PUBLICATION ====================

  /**
   * Publie un rapport pour le rendre visible aux clients
   */
  async publishLotReport(req, res) {
    try {
      const { lotId } = req.params;
      const userId = req.user.userId;

      const lot = await Lot.findOne({
        _id: lotId,
        analyzedBy: userId // Seul le responsable qui a analysé peut publier
      });

      if (!lot) {
        return res.status(404).json({
          success: false,
          message: "Lot non trouvé ou vous n'êtes pas autorisé"
        });
      }

      lot.isPublic = true;
      lot.publishedAt = new Date();
      lot.publishedBy = userId;
      await lot.save();

      // Notifier via WebSocket
      if (req.io) {
        req.io.emit('report:published', {
          lotId: lot._id,
          lotNumber: lot.lotId,
          productType: lot.productType,
          decision: lot.analysis?.decision,
          publishedAt: lot.publishedAt
        });
      }

      console.log(`✅ Rapport ${lot.lotId} publié par ${userId}`);

      res.json({
        success: true,
        message: "Rapport publié avec succès",
        data: {
          lotId: lot._id,
          lotNumber: lot.lotId,
          isPublic: lot.isPublic,
          publishedAt: lot.publishedAt
        }
      });

    } catch (error) {
      console.error('❌ Erreur publication:', error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la publication"
      });
    }
  }

  /**
   * Dépublie un rapport
   */
  async unpublishLotReport(req, res) {
    try {
      const { lotId } = req.params;
      const userId = req.user.userId;

      const lot = await Lot.findOne({
        _id: lotId,
        analyzedBy: userId
      });

      if (!lot) {
        return res.status(404).json({
          success: false,
          message: "Lot non trouvé"
        });
      }

      lot.isPublic = false;
      lot.publishedAt = null;
      lot.publishedBy = null;
      await lot.save();

      // Notifier via WebSocket
      if (req.io) {
        req.io.emit('report:unpublished', {
          lotId: lot._id,
          lotNumber: lot.lotId
        });
      }

      console.log(`✅ Rapport ${lot.lotId} dépublié par ${userId}`);

      res.json({
        success: true,
        message: "Rapport dépublié avec succès"
      });

    } catch (error) {
      console.error('❌ Erreur dépublier:', error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la dépublication"
      });
    }
  }

  /**
   * Récupère tous les rapports publics (pour les clients)
   */
  async getPublicLots(req, res) {
    try {
      const { page = 1, limit = 20, productType } = req.query;
      const query = { isPublic: true };
      
      if (productType && productType !== 'all') {
        query.productType = productType;
      }

      const lots = await Lot.find(query)
        .populate('analyzedBy', 'nom prenom')
        .populate('publishedBy', 'nom prenom')
        .sort({ publishedAt: -1 })
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit));

      const total = await Lot.countDocuments(query);

      const formattedLots = lots.map(lot => ({
        _id: lot._id,
        lotId: lot.lotId,
        productType: lot.productType,
        fileName: lot.fileName,
        analysis: {
          decision: lot.analysis?.decision,
          riskLevel: lot.analysis?.riskLevel,
          issueCount: lot.analysis?.issueCount
        },
        aiReport: {
          resume: lot.aiReport?.resume,
          conclusion: lot.aiReport?.conclusion,
          details: lot.aiReport?.details,
          recommandations: lot.aiReport?.recommandations
        },
        publishedAt: lot.publishedAt,
        publishedBy: lot.publishedBy ? `${lot.publishedBy.prenom} ${lot.publishedBy.nom}` : 'Responsable'
      }));

      res.json({
        success: true,
        data: {
          lots: formattedLots,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
          }
        }
      });

    } catch (error) {
      console.error('❌ Erreur récupération rapports publics:', error);
      res.status(500).json({
        success: false,
        message: "Erreur serveur"
      });
    }
  }
}

// Exporter une instance unique
module.exports = new AnalysisController();