// controllers/analysis.controller.js

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const Lot = require('../models/Lot');
const CSVFile = require('../models/CSVFile');
const analysisService = require('../services/analysis.service');
const pdfService = require('../services/pdf.service');

class AnalysisController {
  constructor() {
    // Lier les méthodes pour éviter les problèmes de contexte
    this.readCSVFile = this.readCSVFile.bind(this);
    this.analyzeCSVFile = this.analyzeCSVFile.bind(this);
    this.getAnalyzedLots = this.getAnalyzedLots.bind(this);
    this.getAnalysisStats = this.getAnalysisStats.bind(this);
    this.getDetailedReport = this.getDetailedReport.bind(this);
    this.generateLotPDF = this.generateLotPDF.bind(this);
    this.downloadLotPDF = this.downloadLotPDF.bind(this);
    this.testOllama = this.testOllama.bind(this);
    this.detectProductTypeFromCategory = this.detectProductTypeFromCategory.bind(this);
    this.debugLots = this.debugLots.bind(this);
    this.publishLotReport = this.publishLotReport.bind(this);
    this.unpublishLotReport = this.unpublishLotReport.bind(this);
    this.getPublicLots = this.getPublicLots.bind(this);
    this.debugCSVFile = this.debugCSVFile.bind(this);
  }

  /**
   * Fonction de debug pour analyser un fichier CSV
   */
  async debugCSVFile(req, res) {
    try {
      const { fileId } = req.params;
      const userId = req.user.userId;

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

      // Lire le fichier et afficher la structure
      const results = [];
      let headers = [];
      
      await new Promise((resolve, reject) => {
        fs.createReadStream(csvFile.path)
          .pipe(csv())
          .on('headers', (headerList) => {
            headers = headerList;
            console.log('📋 Headers CSV:', headerList);
          })
          .on('data', (data) => {
            if (results.length < 3) {
              results.push(data);
            }
          })
          .on('end', resolve)
          .on('error', reject);
      });

      res.json({
        success: true,
        data: {
          fileName: csvFile.originalName,
          headers: headers,
          samples: results
        }
      });

    } catch (error) {
      console.error('❌ Erreur debug:', error);
      res.status(500).json({
        success: false,
        message: "Erreur lors du debug"
      });
    }
  }

  /**
   * Lit un fichier CSV avec détection automatique du séparateur
   */
  async readCSVFile(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      
      // D'abord, détecter le séparateur
      const firstLineStream = fs.createReadStream(filePath, { encoding: 'utf8' });
      let firstLine = '';
      let separator = ',';
      
      firstLineStream.on('data', (chunk) => {
        firstLine += chunk;
        const lines = firstLine.split('\n');
        if (lines.length > 0 && lines[0].trim()) {
          const line = lines[0];
          const commaCount = (line.match(/,/g) || []).length;
          const semicolonCount = (line.match(/;/g) || []).length;
          
          separator = semicolonCount > commaCount ? ';' : ',';
          console.log(`🔍 Séparateur détecté: "${separator}" (virgules: ${commaCount}, points-virgules: ${semicolonCount})`);
          
          firstLineStream.destroy();
          
          // Lire tout le fichier avec le bon séparateur
          const readStream = fs.createReadStream(filePath, { encoding: 'utf8' });
          let headers = [];
          let lineNumber = 0;
          
          const readline = require('readline');
          const rl = readline.createInterface({
            input: readStream,
            crlfDelay: Infinity
          });
          
          rl.on('line', (line) => {
            if (lineNumber === 0) {
              let rawHeaders = line.split(separator).map(h => h.trim());
              rawHeaders[0] = rawHeaders[0].replace(/^\uFEFF/, '');
              headers = rawHeaders;
              console.log('📋 Headers détectés:', headers);
              lineNumber++;
              return;
            }
            
            if (!line.trim()) {
              lineNumber++;
              return;
            }
            
            const values = line.split(separator).map(v => v.trim());
            const row = {};
            
            headers.forEach((header, index) => {
              row[header] = values[index] || '';
            });
            
            if (results.length === 0) {
              console.log('📄 Première ligne CSV brute:', JSON.stringify(row));
              console.log('🔍 Clés disponibles:', Object.keys(row));
            }
            
            const parseFrenchNumber = (value) => {
              if (!value) return 0;
              const strValue = String(value).replace(',', '.').trim();
              const parsed = parseFloat(strValue);
              return isNaN(parsed) ? 0 : parsed;
            };
            
            const processed = {
              lotId: row.lot_id || '',
              category: row.category || '',
              year: parseInt(row.annee) || 2026,
              month: parseInt(row.mois) || 3,
              quarter: row.trimestre || '',
              initialQuality: row.qualite_initiale || 'excellente',
              originRegion: row.region_origine || '',
              destinationRegion: row.region_destination || '',
              transportMode: row.mode_transport || '',
              distance: parseFrenchNumber(row.distance_km),
              duration: parseFrenchNumber(row.duree_voyage),
              temperatureMin: parseFrenchNumber(row.temperature_mesuree_min || row['temperature_mesuree-min']),
              temperatureMax: parseFrenchNumber(row.temperature_mesuree_max || row['temperature_mesuree-max']),
              humidityMin: parseFrenchNumber(row.humidityMin),
              humidityMax: parseFrenchNumber(row.humidityMax),
              humidityThresholdMin: parseFrenchNumber(row['humidite_%_min']),
              humidityThresholdMax: parseFrenchNumber(row['humidite_%_max']),
              temperatureThresholdMin: parseFrenchNumber(row.temperature_min),
              temperatureThresholdMax: parseFrenchNumber(row.temperature_max),
              shock: parseFrenchNumber(row.choc_transport),
              pressure: parseFrenchNumber(row.pression_hpa),
              rain: parseFrenchNumber(row.pluie_mm),
              sunExposure: parseFrenchNumber(row.temps_exposition_soleil_h) * 60,
              ventilation: row.ventilation || '',
              weight: parseFrenchNumber(row.poids_kg),
              purchasePrice: parseFrenchNumber(row.prix_achat_unitaire),
              salePrice: parseFrenchNumber(row.prix_vente_unitaire),
              transportCost: parseFrenchNumber(row.cout_transport_total),
              margin: parseFrenchNumber(row.marge_brute),
              marginPercent: parseFrenchNumber(row['marge_%'] || row.marge_percent),
              automaticDecision: row.decision_automatique || ''
            };
            
            if (results.length === 0) {
              console.log('📋 Lot traité - DÉTAIL:', {
                lotId: processed.lotId,
                choc_original: row.choc_transport,
                choc_parse: processed.shock,
                pression_original: row.pression_hpa,
                pression_parse: processed.pressure,
                pluie_original: row.pluie_mm,
                pluie_parse: processed.rain,
                temperature: `${processed.temperatureMin} - ${processed.temperatureMax}°C`,
                humidity: `${processed.humidityMin} - ${processed.humidityMax}%`,
                thresholds: {
                  humidity: `${processed.humidityThresholdMin}-${processed.humidityThresholdMax}%`,
                  temperature: `${processed.temperatureThresholdMin}-${processed.temperatureThresholdMax}°C`
                }
              });
            }
            
            results.push(processed);
            lineNumber++;
          });
          
          rl.on('close', () => {
            console.log(`📊 ${results.length} lots traités avec parsing français`);
            
            if (results.length > 0) {
              const chocValues = results.map(r => r.shock).filter(v => v > 0);
              console.log('📊 Statistiques choc:', {
                min: Math.min(...chocValues),
                max: Math.max(...chocValues),
                moyenne: (chocValues.reduce((a, b) => a + b, 0) / chocValues.length).toFixed(2),
                echantillon: results.slice(0, 3).map(r => ({
                  lot: r.lotId,
                  choc: r.shock
                }))
              });
            }
            
            resolve(results);
          });
          
          rl.on('error', (error) => {
            console.error('❌ Erreur lecture CSV:', error);
            reject(error);
          });
        }
      });
      
      firstLineStream.on('error', (error) => {
        console.error('❌ Erreur lecture première ligne:', error);
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
    
    if (cat.startsWith('tom')) return 'tomate';
    if (cat.startsWith('agr')) return 'agrume';
    if (cat.startsWith('fra')) return 'fraise';
    if (cat.startsWith('dat')) return 'datte';
    
    return 'tomate';
  }

  /**
   * Analyse un fichier CSV complet - VERSION CORRIGÉE
   */
  async analyzeCSVFile(req, res) {
    try {
      const { fileId } = req.params;
      const userId = req.user.userId;
      const io = req.io;

      console.log(`📂 Début de l'analyse pour le fichier: ${fileId}`);
      console.log(`👤 Utilisateur ID: ${userId}`);

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

      const lots = await this.readCSVFile(csvFile.path);
      
      if (lots.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Le fichier CSV est vide ou mal formaté"
        });
      }

      const existingLotIds = lots.map(l => l.lotId).filter(id => id);
      if (existingLotIds.length > 0) {
        const deleteResult = await Lot.deleteMany({ 
          lotId: { $in: existingLotIds },
          analyzedBy: userId,
          csvFileId: csvFile._id
        });
        console.log(`🗑️ ${deleteResult.deletedCount} anciens lots avec IDs en conflit supprimés`);
      }

      const deletedCount = await Lot.deleteMany({ 
        csvFileId: csvFile._id,
        analyzedBy: userId 
      });
      if (deletedCount.deletedCount > 0) {
        console.log(`🗑️ ${deletedCount.deletedCount} anciens lots supprimés (tous)`);
      }

      const productType = lots[0]?.category ? 
        this.detectProductTypeFromCategory(lots[0].category) : 'tomate';

      console.log(`📦 Type de produit détecté: ${productType}`);

      if (io && userId) {
        io.to(`user_${userId}`).emit('analysis:started', {
          fileId,
          fileName: csvFile.originalName,
          totalLots: lots.length,
          productType
        });
        console.log(`📡 analysis:started émis pour user_${userId}`);
      }

      console.log(`🤖 Génération des rapports avec Ollama pour ${productType}...`);
      console.log(`📤 Appel de analyzeBatch avec userId: ${userId}`);
      
      const lotsWithReports = await analysisService.analyzeBatch(
        lots, 
        productType, 
        io, 
        userId,
        fileId
      );

      const savedLots = [];
      for (const lot of lotsWithReports) {
        try {
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
          console.log(`✅ Lot ${lot.lotId} sauvegardé`);
        } catch (saveError) {
          console.error('❌ Erreur sauvegarde lot:', saveError.message);
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

      csvFile.analyzedAt = new Date();
      csvFile.lotCount = savedLots.length;
      csvFile.productType = productType;
      await csvFile.save();

      const sains = savedLots.filter(l => l.analysis?.decision === "SAIN").length;
      const endommages = savedLots.filter(l => l.analysis?.decision === "ENDOMMAGÉ").length;
      const erreurs = savedLots.filter(l => l.analysis?.decision === "ERREUR" || !l.analysis?.decision).length;

      console.log(`✅ Analyse terminée: ${savedLots.length} lots (${sains} sains, ${endommages} endommagés, ${erreurs} erreurs)`);

      if (io && userId) {
        io.to(`user_${userId}`).emit('analysis:completed', {
          fileId,
          fileName: csvFile.originalName,
          productType,
          totalLots: savedLots.length,
          stats: { sains, endommages, erreurs },
          deletedCount: deletedCount.deletedCount,
          duration: ((Date.now() - new Date(csvFile.analyzedAt).getTime()) / 1000).toFixed(2)
        });
        console.log(`📡 analysis:completed émis pour user_${userId}`);
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

      const lots = await Lot.find({ analyzedBy: userId });
      
      const total = lots.length;
      
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

      const pdfBuffer = await pdfService.generateLotPDF(
        lot,
        lot.analysis,
        lot.detailedReport
      );

      const filename = `rapport_${lot.lotId}_${new Date().toISOString().split('T')[0]}.pdf`;
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);

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

module.exports = new AnalysisController();