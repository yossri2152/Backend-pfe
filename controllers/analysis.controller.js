const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const Lot = require('../models/Lot');
const CSVFile = require('../models/CSVFile');
const analysisService = require('../services/analysis.service');
const pdfService = require('../services/pdf.service'); // IMPORTANT: Ajouter cette ligne

class AnalysisController {
  constructor() {
    // Lier les méthodes pour éviter les problèmes de contexte
    this.readCSVFile = this.readCSVFile.bind(this);
    this.analyzeCSVFile = this.analyzeCSVFile.bind(this);
    this.getAnalyzedLots = this.getAnalyzedLots.bind(this);
    this.getAnalysisStats = this.getAnalysisStats.bind(this);
    this.getDetailedReport = this.getDetailedReport.bind(this);
    this.generateLotPDF = this.generateLotPDF.bind(this);
    this.downloadLotPDF = this.downloadLotPDF.bind(this); // AJOUT: Lier la nouvelle méthode
    this.testOllama = this.testOllama.bind(this);
    this.detectProductTypeFromCategory = this.detectProductTypeFromCategory.bind(this);
    this.debugLots = this.debugLots.bind(this);
    this.publishLotReport = this.publishLotReport.bind(this);
    this.unpublishLotReport = this.unpublishLotReport.bind(this);
    this.getPublicLots = this.getPublicLots.bind(this);
  }

  /**
   * Lit un fichier CSV avec le nouveau format de colonnes
   */
  async readCSVFile(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => {
          // Afficher les premières lignes pour debug
          if (results.length === 0) {
            console.log('📄 Première ligne CSV brute:', JSON.stringify(data));
          }

          // CORRECTION IMPORTANTE: Utiliser les noms exacts des colonnes du CSV
          const processed = {
            // Identifiants
            lotId: data.lot_id || '',
            category: data.category || '',
            
            // Métadonnées temporelles
            year: parseInt(data.annee) || 2026,
            month: parseInt(data.mois) || 3,
            quarter: data.trimestre || '',
            
            // Qualité
            initialQuality: data.qualite_initiale || 'excellente',
            
            // Transport
            originRegion: data.region_origine || '',
            destinationRegion: data.region_destination || '',
            transportMode: data.mode_transport || '',
            distance: parseFloat(data.distance_km) || 0,
            duration: parseFloat(data.duree_voyage) || 0,
            
            // Température
            temperatureMin: parseFloat(data['temperature_mesuree-min'] || data.temperature_min) || 0,
            temperatureMax: parseFloat(data['temperature_mesuree-max'] || data.temperature_max) || 0,

            // HUMIDITÉ - CORRECTION: Utiliser les noms exacts des colonnes
            humidityMin: parseFloat(data['humidite_%_mesure_min'] || data['humidite_%_min']) || 0,
            humidityMax: parseFloat(data['humidite_%_mesure_max'] || data['humidite_%_max']) || 0,
            
            // Autres paramètres environnementaux
            shock: parseFloat(data.choc_transport) || 0,
            pressure: parseFloat(data.pression_hpa) || 0,
            rain: parseFloat(data.pluie_mm) || 0,
            sunExposure: (parseFloat(data.temps_exposition_soleil_h) || 0) * 60, // Conversion heures → minutes
            ventilation: data.ventilation || '',
            
            // Données commerciales
            weight: parseFloat(data.poids_kg) || 0,
            purchasePrice: parseFloat(data.prix_achat_unitaire) || 0,
            salePrice: parseFloat(data.prix_vente_unitaire) || 0,
            transportCost: parseFloat(data.cout_transport_total) || 0,
            margin: parseFloat(data.marge_brute) || 0,
            marginPercent: parseFloat(data['marge_%'] || data.marge_percent) || 0,
            
            // Décision préexistante (optionnelle)
            automaticDecision: data.decision_automatique || ''
          };
          
          results.push(processed);
        })
        .on('end', () => {
          console.log(`📊 ${results.length} lots traités avec le nouveau format`);
          if (results.length > 0) {
            console.log('📋 Exemple de lot traité:', {
              lotId: results[0].lotId,
              humidityMin: results[0].humidityMin,
              humidityMax: results[0].humidityMax,
              temperatureMin: results[0].temperatureMin,
              temperatureMax: results[0].temperatureMax
            });
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
   * Détecte le type de produit à partir de la catégorie
   */
  detectProductTypeFromCategory(category) {
    if (!category) return 'tomate';
    
    const cat = category.toLowerCase();
    if (cat.includes('tomate')) return 'tomate';
    if (cat.includes('agrume')) return 'agrume';
    if (cat.includes('fraise')) return 'fraise';
    if (cat.includes('datte')) return 'datte';
    
    // Détection par préfixe
    if (cat.startsWith('tom')) return 'tomate';
    if (cat.startsWith('agr')) return 'agrume';
    if (cat.startsWith('fra')) return 'fraise';
    if (cat.startsWith('dat')) return 'datte';
    
    return 'tomate'; // Par défaut
  }

  /**
   * Analyse un fichier CSV complet
   */
  async analyzeCSVFile(req, res) {
    try {
      const { fileId } = req.params;
      const userId = req.user.userId;
      const io = req.io;

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

      console.log(`📂 Analyse du fichier: ${csvFile.originalName}`);
      console.log(`📁 Chemin: ${csvFile.path}`);

      // Lire le CSV avec le mapping
      const lots = await this.readCSVFile(csvFile.path);
      
      if (lots.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Le fichier CSV est vide ou mal formaté"
        });
      }

      // ========== CORRECTION DOUBLONS ==========
      // Supprimer les anciens lots avec les mêmes IDs pour ce fichier
      const existingLotIds = lots.map(l => l.lotId).filter(id => id);
      if (existingLotIds.length > 0) {
        const deleteResult = await Lot.deleteMany({ 
          lotId: { $in: existingLotIds },
          analyzedBy: userId,
          csvFileId: csvFile._id
        });
        console.log(`🗑️ ${deleteResult.deletedCount} anciens lots avec IDs en conflit supprimés`);
      }

      // Supprimer les anciens résultats pour ce fichier (au cas où)
      const deletedCount = await Lot.deleteMany({ 
        csvFileId: csvFile._id,
        analyzedBy: userId 
      });
      if (deletedCount.deletedCount > 0) {
        console.log(`🗑️ ${deletedCount.deletedCount} anciens lots supprimés (tous)`);
      }
      // =========================================

      // Déterminer le type de produit à partir de la catégorie du premier lot
      const productType = lots[0]?.category ? 
        this.detectProductTypeFromCategory(lots[0].category) : 'tomate';

      console.log(`📦 Type de produit détecté: ${productType}`);

      // Informer le client que l'analyse commence
      if (io) {
        io.to(`user_${userId}`).emit('analysis:started', {
          fileId,
          fileName: csvFile.originalName,
          totalLots: lots.length,
          productType
        });
      }

      // Analyser avec le service
      console.log(`🤖 Génération des rapports avec Ollama pour ${productType}...`);
      const lotsWithReports = await analysisService.analyzeBatch(lots, productType);

      // Sauvegarder dans MongoDB
      const savedLots = [];
      for (const lot of lotsWithReports) {
        try {
          // Générer un ID unique si le lot n'en a pas
          const uniqueLotId = lot.lotId || `LOT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          const lotDoc = new Lot({
            lotId: uniqueLotId,
            fileName: csvFile.originalName,
            productType: productType,
            category: lot.category,
            year: lot.year,
            month: lot.month,
            quarter: lot.quarter,
            initialQuality: lot.initialQuality,
            originRegion: lot.originRegion,
            destinationRegion: lot.destinationRegion,
            transportMode: lot.transportMode,
            distance: lot.distance,
            duration: lot.duration,
            temperatureMin: lot.temperatureMin,
            temperatureMax: lot.temperatureMax,
            humidityMin: lot.humidityMin,
            humidityMax: lot.humidityMax,
            shock: lot.shock,
            pressure: lot.pressure,
            rain: lot.rain,
            sunExposure: lot.sunExposure,
            ventilation: lot.ventilation,
            weight: lot.weight,
            purchasePrice: lot.purchasePrice,
            salePrice: lot.salePrice,
            transportCost: lot.transportCost,
            margin: lot.margin,
            marginPercent: lot.marginPercent,
            analysis: lot.analysis || { 
              issues: [], 
              decision: "ERREUR", 
              issueCount: 0,
              riskLevel: "Inconnu",
              isCompliant: false,
              details: {}
            },
            detailedReport: lot.detailedReport || '',
            isPublic: false,
            analyzedBy: userId,
            csvFileId: csvFile._id,
            analyzedAt: new Date()
          });
          
          await lotDoc.save();
          savedLots.push(lotDoc);
        } catch (saveError) {
          console.error('❌ Erreur sauvegarde lot:', saveError.message);
          // Si erreur de duplication, essayer avec un ID unique
          if (saveError.code === 11000) {
            try {
              const lotDoc = new Lot({
                lotId: `LOT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                fileName: csvFile.originalName,
                productType: productType,
                category: lot.category,
                year: lot.year,
                month: lot.month,
                quarter: lot.quarter,
                initialQuality: lot.initialQuality,
                originRegion: lot.originRegion,
                destinationRegion: lot.destinationRegion,
                transportMode: lot.transportMode,
                distance: lot.distance,
                duration: lot.duration,
                temperatureMin: lot.temperatureMin,
                temperatureMax: lot.temperatureMax,
                humidityMin: lot.humidityMin,
                humidityMax: lot.humidityMax,
                shock: lot.shock,
                pressure: lot.pressure,
                rain: lot.rain,
                sunExposure: lot.sunExposure,
                ventilation: lot.ventilation,
                weight: lot.weight,
                purchasePrice: lot.purchasePrice,
                salePrice: lot.salePrice,
                transportCost: lot.transportCost,
                margin: lot.margin,
                marginPercent: lot.marginPercent,
                analysis: lot.analysis || { 
                  issues: [], 
                  decision: "ERREUR", 
                  issueCount: 0,
                  riskLevel: "Inconnu",
                  isCompliant: false,
                  details: {}
                },
                detailedReport: lot.detailedReport || '',
                isPublic: false,
                analyzedBy: userId,
                csvFileId: csvFile._id,
                analyzedAt: new Date()
              });
              await lotDoc.save();
              savedLots.push(lotDoc);
              console.log('✅ Lot sauvegardé avec ID unique');
            } catch (retryError) {
              console.error('❌ Échec seconde tentative:', retryError.message);
            }
          }
        }
      }

      // Mettre à jour le fichier CSV
      csvFile.analyzedAt = new Date();
      csvFile.lotCount = savedLots.length;
      csvFile.productType = productType;
      await csvFile.save();

      const sains = savedLots.filter(l => l.analysis?.decision === "SAIN").length;
      const endommages = savedLots.filter(l => l.analysis?.decision === "ENDOMMAGÉ").length;
      const erreurs = savedLots.filter(l => l.analysis?.decision === "ERREUR" || !l.analysis?.decision).length;

      console.log(`✅ Analyse terminée: ${savedLots.length} lots (${sains} sains, ${endommages} endommagés, ${erreurs} erreurs)`);

      // Informer le client que l'analyse est terminée
      if (io) {
        io.to(`user_${userId}`).emit('analysis:completed', {
          fileId,
          fileName: csvFile.originalName,
          productType,
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
          productType,
          totalLots: savedLots.length,
          stats: { sains, endommages, erreurs },
          deletedCount: deletedCount.deletedCount
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
   * Récupère les lots analysés
   */
  async getAnalyzedLots(req, res) {
    try {
      const { fileId } = req.params;
      const userId = req.user.userId;
      const { limit = 100 } = req.query;

      const query = { analyzedBy: userId };
      if (fileId) {
        query.csvFileId = fileId;
      }

      const lots = await Lot.find(query)
        .sort({ analyzedAt: -1 })
        .limit(parseInt(limit));

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
   * Récupère les statistiques d'analyse
   */
  async getAnalysisStats(req, res) {
    try {
      const userId = req.user.userId;

      // Récupérer tous les lots de l'utilisateur
      const lots = await Lot.find({ analyzedBy: userId });
      
      const total = lots.length;
      
      // Compter manuellement
      let sains = 0;
      let endommages = 0;
      let erreurs = 0;
      
      lots.forEach(lot => {
        const decision = lot.analysis?.decision;
        if (decision === "SAIN") {
          sains++;
        } else if (decision === "ENDOMMAGÉ") {
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

      console.log('📊 Statistiques calculées:', result);

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
   * Récupère un rapport détaillé pour un lot spécifique
   */
  async getDetailedReport(req, res) {
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

      res.json({
        success: true,
        data: {
          detailedReport: lot.detailedReport,
          analysis: lot.analysis,
          lot: {
            _id: lot._id,
            lotId: lot.lotId,
            productType: lot.productType,
            category: lot.category,
            analyzedAt: lot.analyzedAt
          }
        }
      });

    } catch (error) {
      console.error('❌ Erreur récupération rapport:', error);
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
        .select('lotId analysis.decision fileName productType analyzedAt');
      
      const decisions = lots.map(l => ({
        lotId: l.lotId,
        decision: l.analysis?.decision,
        productType: l.productType,
        analyzedAt: l.analyzedAt
      }));
      
      const counts = {
        total: lots.length,
        sains: lots.filter(l => l.analysis?.decision === "SAIN").length,
        endommages: lots.filter(l => l.analysis?.decision === "ENDOMMAGÉ").length,
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
   * Génère un PDF de rapport pour un lot
   * Note: Cette méthode est conservée pour compatibilité
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

      // Utiliser la nouvelle méthode de téléchargement
      return this.downloadLotPDF(req, res);

    } catch (error) {
      console.error('❌ Erreur génération PDF:', error);
      res.status(500).json({
        success: false,
        message: "Erreur serveur"
      });
    }
  }

  /**
   * Télécharge un rapport PDF pour un lot
   * NOUVELLE MÉTHODE
   */
  async downloadLotPDF(req, res) {
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

      console.log(`📄 Génération PDF pour le lot ${lot.lotId}...`);

      // Générer le PDF
      const pdfBuffer = await pdfService.generateLotPDF(
        lot,
        lot.analysis,
        lot.detailedReport
      );

      // Configurer les headers pour le téléchargement
      const filename = `rapport_${lot.lotId}_${new Date().toISOString().split('T')[0]}.pdf`;
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);

      // Envoyer le PDF
      res.send(pdfBuffer);

      console.log(`✅ PDF généré et envoyé: ${filename}`);

    } catch (error) {
      console.error('❌ Erreur génération PDF:', error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la génération du PDF"
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

  // ==================== MÉTHODES DE PUBLICATION ====================

  /**
   * Publie un rapport pour le rendre visible aux clients
   */
  async publishLotReport(req, res) {
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
        category: lot.category,
        analysis: {
          decision: lot.analysis?.decision,
          riskLevel: lot.analysis?.riskLevel,
          issueCount: lot.analysis?.issueCount
        },
        detailedReport: lot.detailedReport,
        publishedAt: lot.publishedAt,
        publishedBy: lot.publishedBy ? `${lot.publishedBy.prenom} ${lot.publishedBy.nom}` : 'Responsable',
        analyzedAt: lot.analyzedAt
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