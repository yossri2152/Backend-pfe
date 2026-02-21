const CSVFile = require("../models/CSVFile");
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { Parser } = require('json2csv');
const readline = require('readline');

// ==================== FONCTIONS UTILITAIRES ====================

/**
 * Lire un fichier CSV en streaming
 */
const streamCSVFile = (filePath, startLine = 0, limit = 100) => {
  return new Promise((resolve, reject) => {
    const results = [];
    let currentLine = 0;
    
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => {
        if (currentLine >= startLine && results.length < limit) {
          results.push(data);
        }
        currentLine++;
      })
      .on('end', () => resolve({
        data: results,
        total: currentLine,
        hasMore: currentLine > startLine + limit
      }))
      .on('error', (error) => reject(error));
  });
};

/**
 * Lire tout le fichier CSV (pour les modifications)
 */
const readFullCSVFile = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
};

/**
 * Écrire des données dans un fichier CSV
 */
const writeCSVFile = async (filePath, data, headers) => {
  const json2csvParser = new Parser({ fields: headers });
  const csv = json2csvParser.parse(data);
  fs.writeFileSync(filePath, csv);
};

/**
 * Compter les lignes d'un fichier CSV
 */
const countCSVLines = (filePath) => {
  return new Promise((resolve, reject) => {
    let lineCount = 0;
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath),
      crlfDelay: Infinity
    });

    rl.on('line', () => {
      lineCount++;
    });

    rl.on('close', () => {
      resolve(Math.max(0, lineCount - 1));
    });

    rl.on('error', reject);
  });
};

/**
 * Lire les en-têtes d'un fichier CSV
 */
const readCSVHeaders = (filePath) => {
  return new Promise((resolve, reject) => {
    let headersRead = false;
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('headers', (headerList) => {
        headersRead = true;
        resolve(headerList);
      })
      .on('end', () => {
        if (!headersRead) {
          resolve([]);
        }
      })
      .on('error', reject);
  });
};

// ==================== CRUD FICHIERS AVEC WEBSOCKET ====================

/**
 * GET /csv - Obtenir les fichiers CSV de l'utilisateur connecté
 */
exports.getUserCSVFiles = async (req, res) => {
  try {
    const files = await CSVFile.find({ createdBy: req.user.userId })
      .select('-__v')
      .populate('createdBy', 'email nom prenom')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: files.length,
      data: files.map(f => ({
        _id: f._id,
        filename: f.filename,
        originalName: f.originalName,
        size: f.size,
        rowCount: f.rowCount,
        headers: f.headers,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
        createdBy: f.createdBy ? {
          _id: f.createdBy._id,
          email: f.createdBy.email,
          nom: f.createdBy.nom,
          prenom: f.createdBy.prenom
        } : null
      }))
    });
  } catch (error) {
    console.error('❌ Erreur get CSV files:', error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur"
    });
  }
};

/**
 * GET /csv/all - Obtenir tous les fichiers CSV (admin uniquement)
 */
exports.getAllCSVFiles = async (req, res) => {
  try {
    const files = await CSVFile.find()
      .select('-__v')
      .populate('createdBy', 'email nom prenom')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: files.length,
      data: files.map(f => ({
        _id: f._id,
        filename: f.filename,
        originalName: f.originalName,
        size: f.size,
        rowCount: f.rowCount,
        headers: f.headers,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
        createdBy: f.createdBy ? {
          _id: f.createdBy._id,
          email: f.createdBy.email,
          nom: f.createdBy.nom,
          prenom: f.createdBy.prenom
        } : null
      }))
    });
  } catch (error) {
    console.error('❌ Erreur get all CSV files:', error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur"
    });
  }
};

/**
 * GET /csv/:id/info - Obtenir les informations d'un fichier
 */
exports.getCSVFileInfo = async (req, res) => {
  try {
    let query = { _id: req.params.id };
    
    // Si ce n'est pas un admin, il ne voit que ses fichiers
    if (req.user.role !== 'admin') {
      query.createdBy = req.user.userId;
    }

    const file = await CSVFile.findOne(query)
      .select('-__v')
      .populate('createdBy', 'email nom prenom');

    if (!file) {
      return res.status(404).json({
        success: false,
        message: "Fichier non trouvé"
      });
    }

    // Déterminer si l'utilisateur peut modifier ce fichier
    const canEdit = req.user.role === 'responsable' && file.createdBy._id.toString() === req.user.userId;

    res.json({
      success: true,
      data: {
        _id: file._id,
        filename: file.filename,
        originalName: file.originalName,
        size: file.size,
        rowCount: file.rowCount,
        headers: file.headers,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
        chunkSize: file.chunkSize || 1000,
        totalChunks: Math.ceil(file.rowCount / (file.chunkSize || 1000)),
        canEdit,
        createdBy: file.createdBy ? {
          _id: file.createdBy._id,
          email: file.createdBy.email,
          nom: file.createdBy.nom,
          prenom: file.createdBy.prenom
        } : null
      }
    });
  } catch (error) {
    console.error('❌ Erreur get CSV file info:', error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur"
    });
  }
};

/**
 * GET /csv/:id/data - Obtenir les données paginées d'un fichier
 */
exports.getCSVFileData = async (req, res) => {
  try {
    const { page = 1, limit = 100 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 500);

    let query = { _id: req.params.id };
    
    // Si ce n'est pas un admin, il ne voit que ses fichiers
    if (req.user.role !== 'admin') {
      query.createdBy = req.user.userId;
    }

    const file = await CSVFile.findOne(query);

    if (!file) {
      return res.status(404).json({
        success: false,
        message: "Fichier non trouvé"
      });
    }

    if (!fs.existsSync(file.path)) {
      return res.status(404).json({
        success: false,
        message: "Fichier physique non trouvé"
      });
    }

    const startLine = (pageNum - 1) * limitNum;
    const result = await streamCSVFile(file.path, startLine, limitNum);

    // Déterminer si l'utilisateur peut modifier ce fichier
    const canEdit = req.user.role === 'responsable' && file.createdBy.toString() === req.user.userId;

    res.json({
      success: true,
      data: {
        headers: file.headers,
        rows: result.data,
        pagination: {
          currentPage: pageNum,
          limit: limitNum,
          totalRows: result.total,
          totalPages: Math.ceil(result.total / limitNum),
          hasMore: result.hasMore
        },
        canEdit
      }
    });
  } catch (error) {
    console.error('❌ Erreur get CSV file data:', error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur"
    });
  }
};

/**
 * POST /csv/upload - Uploader un nouveau fichier CSV
 */
exports.uploadCSVFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Aucun fichier fourni"
      });
    }

    const headers = await readCSVHeaders(req.file.path);
    const rowCount = await countCSVLines(req.file.path);
    const chunkSize = 1000;
    const totalChunks = Math.ceil(rowCount / chunkSize);

    const csvFile = new CSVFile({
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      size: req.file.size,
      mimeType: req.file.mimetype,
      headers: headers,
      rowCount: rowCount,
      chunkSize: chunkSize,
      totalChunks: totalChunks,
      createdBy: req.user.userId
    });

    await csvFile.save();

    // Récupérer le fichier avec les infos de l'utilisateur pour l'emit
    const savedFile = await CSVFile.findById(csvFile._id)
      .populate('createdBy', 'email nom prenom');

    // Émettre un événement WebSocket pour informer tous les clients
    if (req.io) {
      req.io.emit('file:uploaded', {
        file: {
          _id: savedFile._id,
          filename: savedFile.filename,
          originalName: savedFile.originalName,
          size: savedFile.size,
          rowCount: savedFile.rowCount,
          headers: savedFile.headers,
          createdAt: savedFile.createdAt,
          createdBy: savedFile.createdBy ? {
            _id: savedFile.createdBy._id,
            email: savedFile.createdBy.email,
            nom: savedFile.createdBy.nom,
            prenom: savedFile.createdBy.prenom
          } : null
        },
        uploadedBy: {
          email: req.user.email,
          nom: req.user.nom,
          prenom: req.user.prenom,
          role: req.user.role
        },
        timestamp: new Date()
      });
    }

    console.log(`✅ Fichier uploadé: ${csvFile.originalName} par ${req.user.email} (${req.user.role})`);

    res.status(201).json({
      success: true,
      message: "Fichier uploadé avec succès",
      data: {
        _id: csvFile._id,
        filename: csvFile.filename,
        originalName: csvFile.originalName,
        headers: csvFile.headers,
        rowCount: csvFile.rowCount,
        totalChunks: csvFile.totalChunks,
        createdAt: csvFile.createdAt
      }
    });
  } catch (error) {
    console.error('❌ Erreur upload CSV:', error);
    
    if (req.file && req.file.path) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: "Erreur lors de l'upload"
    });
  }
};

/**
 * PUT /csv/:id - Mettre à jour un fichier CSV (remplacer)
 * Uniquement pour responsable et propriétaire
 */
exports.updateCSVFile = async (req, res) => {
  try {
    const file = await CSVFile.findOne({
      _id: req.params.id,
      createdBy: req.user.userId
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        message: "Fichier non trouvé"
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Aucun fichier fourni"
      });
    }

    // Supprimer l'ancien fichier physique
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    // Lire le nouveau fichier
    const headers = await readCSVHeaders(req.file.path);
    const rowCount = await countCSVLines(req.file.path);

    // Mettre à jour l'entrée dans la base de données
    file.filename = req.file.filename;
    file.originalName = req.file.originalname;
    file.path = req.file.path;
    file.size = req.file.size;
    file.headers = headers;
    file.rowCount = rowCount;
    file.updatedAt = new Date();

    await file.save();

    console.log(`✅ Fichier mis à jour: ${file.originalName} par ${req.user.email}`);

    res.json({
      success: true,
      message: "Fichier mis à jour avec succès",
      data: {
        _id: file._id,
        filename: file.filename,
        originalName: file.originalName,
        headers: file.headers,
        rowCount: file.rowCount,
        updatedAt: file.updatedAt
      }
    });
  } catch (error) {
    console.error('❌ Erreur update CSV:', error);
    
    if (req.file && req.file.path) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: "Erreur lors de la mise à jour"
    });
  }
};

/**
 * DELETE /csv/:id - Supprimer un fichier CSV (uniquement responsable et propriétaire)
 */
exports.deleteCSVFile = async (req, res) => {
  try {
    const file = await CSVFile.findOne({
      _id: req.params.id,
      createdBy: req.user.userId
    }).populate('createdBy', 'email nom prenom');

    if (!file) {
      return res.status(404).json({
        success: false,
        message: "Fichier non trouvé"
      });
    }

    // Sauvegarder les infos pour l'événement
    const fileInfo = {
      _id: file._id,
      originalName: file.originalName,
      createdBy: file.createdBy ? {
        _id: file.createdBy._id,
        email: file.createdBy.email,
        nom: file.createdBy.nom,
        prenom: file.createdBy.prenom
      } : null
    };

    // Supprimer le fichier physique
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    // Supprimer l'entrée de la base de données
    await file.deleteOne();

    // Émettre un événement WebSocket pour informer tous les clients
    if (req.io) {
      req.io.emit('file:deleted', {
        fileId: file._id,
        fileName: file.originalName,
        fileInfo,
        deletedBy: {
          email: req.user.email,
          nom: req.user.nom,
          prenom: req.user.prenom,
          role: req.user.role
        },
        timestamp: new Date()
      });
    }

    console.log(`✅ Fichier supprimé: ${file.originalName} par ${req.user.email}`);

    res.json({
      success: true,
      message: "Fichier supprimé avec succès"
    });
  } catch (error) {
    console.error('❌ Erreur delete CSV:', error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur"
    });
  }
};

/**
 * GET /csv/:id/download - Télécharger un fichier CSV
 */
exports.downloadCSVFile = async (req, res) => {
  try {
    let query = { _id: req.params.id };
    
    // Si ce n'est pas un admin, il ne peut télécharger que ses fichiers
    if (req.user.role !== 'admin') {
      query.createdBy = req.user.userId;
    }

    const file = await CSVFile.findOne(query);

    if (!file) {
      return res.status(404).json({
        success: false,
        message: "Fichier non trouvé"
      });
    }

    if (!fs.existsSync(file.path)) {
      return res.status(404).json({
        success: false,
        message: "Fichier physique non trouvé"
      });
    }

    console.log(`📥 Téléchargement: ${file.originalName} par ${req.user.email} (${req.user.role})`);

    res.download(file.path, file.originalName);
  } catch (error) {
    console.error('❌ Erreur download CSV:', error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur"
    });
  }
};

// ==================== CRUD LIGNES AVEC WEBSOCKET (UNIQUEMENT POUR RESPONSABLE PROPRIÉTAIRE) ====================

/**
 * POST /csv/:id/rows - Ajouter une nouvelle ligne
 */
exports.addRow = async (req, res) => {
  try {
    const file = await CSVFile.findOne({
      _id: req.params.id,
      createdBy: req.user.userId
    }).populate('createdBy', 'email nom prenom');

    if (!file) {
      return res.status(404).json({
        success: false,
        message: "Fichier non trouvé"
      });
    }

    if (!fs.existsSync(file.path)) {
      return res.status(404).json({
        success: false,
        message: "Fichier physique non trouvé"
      });
    }

    const newRow = req.body;
    
    // Vérifier que la nouvelle ligne a toutes les clés nécessaires
    const missingHeaders = file.headers.filter(h => !(h in newRow));
    if (missingHeaders.length > 0) {
      return res.status(400).json({
        success: false,
        message: `En-têtes manquants: ${missingHeaders.join(', ')}`
      });
    }

    // Lire toutes les données existantes
    const allData = await readFullCSVFile(file.path);
    
    // Ajouter la nouvelle ligne
    allData.push(newRow);
    
    // Réécrire le fichier avec la nouvelle ligne
    await writeCSVFile(file.path, allData, file.headers);
    
    // Mettre à jour le compteur de lignes
    file.rowCount = allData.length;
    file.updatedAt = new Date();
    await file.save();

    // Émettre un événement WebSocket
    if (req.io) {
      req.io.emit('row:added', {
        fileId: file._id,
        fileName: file.originalName,
        newRow,
        rowIndex: allData.length - 1,
        updatedBy: {
          email: req.user.email,
          nom: req.user.nom,
          prenom: req.user.prenom,
          role: req.user.role
        },
        timestamp: new Date()
      });
    }

    console.log(`✅ Ligne ajoutée au fichier ${file.originalName} par ${req.user.email}`);

    res.json({
      success: true,
      message: "Ligne ajoutée avec succès",
      data: newRow
    });
  } catch (error) {
    console.error('❌ Erreur add row:', error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur"
    });
  }
};

/**
 * PUT /csv/:id/rows/:rowIndex - Modifier une ligne existante
 */
exports.updateRow = async (req, res) => {
  try {
    const file = await CSVFile.findOne({
      _id: req.params.id,
      createdBy: req.user.userId
    }).populate('createdBy', 'email nom prenom');

    if (!file) {
      return res.status(404).json({
        success: false,
        message: "Fichier non trouvé"
      });
    }

    if (!fs.existsSync(file.path)) {
      return res.status(404).json({
        success: false,
        message: "Fichier physique non trouvé"
      });
    }

    const rowIndex = parseInt(req.params.rowIndex);
    const updatedRow = req.body;

    // Lire toutes les données
    const allData = await readFullCSVFile(file.path);
    
    // Vérifier que l'index est valide
    if (rowIndex < 0 || rowIndex >= allData.length) {
      return res.status(400).json({
        success: false,
        message: "Index de ligne invalide"
      });
    }

    // Vérifier les en-têtes
    const missingHeaders = file.headers.filter(h => !(h in updatedRow));
    if (missingHeaders.length > 0) {
      return res.status(400).json({
        success: false,
        message: `En-têtes manquants: ${missingHeaders.join(', ')}`
      });
    }

    // Sauvegarder l'ancienne valeur pour l'événement
    const oldRow = { ...allData[rowIndex] };

    // Mettre à jour la ligne
    allData[rowIndex] = updatedRow;
    
    // Réécrire le fichier
    await writeCSVFile(file.path, allData, file.headers);
    
    // Mettre à jour la date
    file.updatedAt = new Date();
    await file.save();

    // Émettre un événement WebSocket
    if (req.io) {
      req.io.emit('row:updated', {
        fileId: file._id,
        fileName: file.originalName,
        rowIndex,
        oldRow,
        newRow: updatedRow,
        updatedBy: {
          email: req.user.email,
          nom: req.user.nom,
          prenom: req.user.prenom,
          role: req.user.role
        },
        timestamp: new Date()
      });
    }

    console.log(`✅ Ligne ${rowIndex} modifiée dans ${file.originalName} par ${req.user.email}`);

    res.json({
      success: true,
      message: "Ligne modifiée avec succès",
      data: updatedRow
    });
  } catch (error) {
    console.error('❌ Erreur update row:', error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur"
    });
  }
};

/**
 * DELETE /csv/:id/rows/:rowIndex - Supprimer une ligne
 */
exports.deleteRow = async (req, res) => {
  try {
    const file = await CSVFile.findOne({
      _id: req.params.id,
      createdBy: req.user.userId
    }).populate('createdBy', 'email nom prenom');

    if (!file) {
      return res.status(404).json({
        success: false,
        message: "Fichier non trouvé"
      });
    }

    if (!fs.existsSync(file.path)) {
      return res.status(404).json({
        success: false,
        message: "Fichier physique non trouvé"
      });
    }

    const rowIndex = parseInt(req.params.rowIndex);

    // Lire toutes les données
    const allData = await readFullCSVFile(file.path);
    
    // Vérifier l'index
    if (rowIndex < 0 || rowIndex >= allData.length) {
      return res.status(400).json({
        success: false,
        message: "Index de ligne invalide"
      });
    }

    // Sauvegarder la ligne supprimée pour l'événement
    const deletedRow = allData[rowIndex];

    // Supprimer la ligne
    allData.splice(rowIndex, 1);
    
    // Réécrire le fichier
    await writeCSVFile(file.path, allData, file.headers);
    
    // Mettre à jour le compteur
    file.rowCount = allData.length;
    file.updatedAt = new Date();
    await file.save();

    // Émettre un événement WebSocket
    if (req.io) {
      req.io.emit('row:deleted', {
        fileId: file._id,
        fileName: file.originalName,
        rowIndex,
        deletedRow,
        updatedBy: {
          email: req.user.email,
          nom: req.user.nom,
          prenom: req.user.prenom,
          role: req.user.role
        },
        timestamp: new Date()
      });
    }

    console.log(`✅ Ligne ${rowIndex} supprimée de ${file.originalName} par ${req.user.email}`);

    res.json({
      success: true,
      message: "Ligne supprimée avec succès",
      data: deletedRow
    });
  } catch (error) {
    console.error('❌ Erreur delete row:', error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur"
    });
  }
};