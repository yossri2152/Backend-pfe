const File = require("../models/CSVFile"); // Le modèle reste CSVFile pour compatibilité
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { Parser } = require('json2csv');
const readline = require('readline');
const excelReader = require('../services/excelReader.service');

// ==================== FONCTIONS UTILITAIRES ====================

/**
 * Détecte le type de fichier
 */
const getFileType = (filename) => {
  return excelReader.detectFileType(filename);
};

/**
 * Lire un fichier en streaming (CSV ou Excel)
 */
const streamFile = async (filePath, fileType, startLine = 0, limit = 100) => {
  if (fileType === 'csv') {
    return streamCSVFile(filePath, startLine, limit);
  } else if (fileType === 'excel') {
    return await excelReader.readExcelFile(filePath, startLine, limit);
  } else {
    throw new Error('Type de fichier non supporté');
  }
};

/**
 * Lire tout le fichier
 */
const readFullFile = async (filePath, fileType) => {
  if (fileType === 'csv') {
    return readFullCSVFile(filePath);
  } else if (fileType === 'excel') {
    return await excelReader.readFullExcelFile(filePath);
  } else {
    throw new Error('Type de fichier non supporté');
  }
};

/**
 * Écrire des données dans un fichier
 */
const writeFile = async (filePath, data, headers, fileType) => {
  if (fileType === 'csv') {
    await writeCSVFile(filePath, data, headers);
  } else if (fileType === 'excel') {
    await excelReader.writeExcelFile(filePath, data, headers);
  } else {
    throw new Error('Type de fichier non supporté');
  }
};

/**
 * Compter les lignes
 */
const countFileLines = async (filePath, fileType) => {
  if (fileType === 'csv') {
    return countCSVLines(filePath);
  } else if (fileType === 'excel') {
    return await excelReader.countExcelLines(filePath);
  } else {
    return 0;
  }
};

/**
 * Lire les en-têtes
 */
const readFileHeaders = async (filePath, fileType) => {
  if (fileType === 'csv') {
    return readCSVHeaders(filePath);
  } else if (fileType === 'excel') {
    return await excelReader.readExcelHeaders(filePath);
  } else {
    return [];
  }
};

// ==================== FONCTIONS CSV EXISTANTES ====================

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

const writeCSVFile = async (filePath, data, headers) => {
  const json2csvParser = new Parser({ fields: headers });
  const csv = json2csvParser.parse(data);
  fs.writeFileSync(filePath, csv);
};

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

// ==================== CRUD FICHIERS ====================

/**
 * GET /csv - Obtenir les fichiers de l'utilisateur connecté
 */
exports.getUserCSVFiles = async (req, res) => {
  try {
    const files = await File.find({ createdBy: req.user.userId })
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
        fileType: f.fileType,
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
    console.error('❌ Erreur get files:', error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur"
    });
  }
};

/**
 * GET /csv/all - Obtenir tous les fichiers (admin uniquement)
 */
exports.getAllCSVFiles = async (req, res) => {
  try {
    const files = await File.find()
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
        fileType: f.fileType,
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
    console.error('❌ Erreur get all files:', error);
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
    
    if (req.user.role !== 'admin') {
      query.createdBy = req.user.userId;
    }

    const file = await File.findOne(query)
      .select('-__v')
      .populate('createdBy', 'email nom prenom');

    if (!file) {
      return res.status(404).json({
        success: false,
        message: "Fichier non trouvé"
      });
    }

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
        fileType: file.fileType,
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
    console.error('❌ Erreur get file info:', error);
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
    
    if (req.user.role !== 'admin') {
      query.createdBy = req.user.userId;
    }

    const file = await File.findOne(query);

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
    const result = await streamFile(file.path, file.fileType, startLine, limitNum);

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
        canEdit,
        fileType: file.fileType
      }
    });
  } catch (error) {
    console.error('❌ Erreur get file data:', error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur"
    });
  }
};

/**
 * POST /csv/upload - Uploader un nouveau fichier (CSV ou Excel)
 */
exports.uploadCSVFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Aucun fichier fourni"
      });
    }

    const fileType = getFileType(req.file.originalname);
    
    if (fileType === 'unknown') {
      return res.status(400).json({
        success: false,
        message: "Type de fichier non supporté. Utilisez CSV ou Excel (.xlsx, .xls)"
      });
    }

    const headers = await readFileHeaders(req.file.path, fileType);
    const rowCount = await countFileLines(req.file.path, fileType);
    const chunkSize = 1000;
    const totalChunks = Math.ceil(rowCount / chunkSize);

    const file = new File({
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      size: req.file.size,
      mimeType: req.file.mimetype,
      fileType: fileType,
      headers: headers,
      rowCount: rowCount,
      chunkSize: chunkSize,
      totalChunks: totalChunks,
      createdBy: req.user.userId
    });

    await file.save();

    const savedFile = await File.findById(file._id)
      .populate('createdBy', 'email nom prenom');

    if (req.io) {
      req.io.emit('file:uploaded', {
        file: {
          _id: savedFile._id,
          filename: savedFile.filename,
          originalName: savedFile.originalName,
          size: savedFile.size,
          rowCount: savedFile.rowCount,
          headers: savedFile.headers,
          fileType: savedFile.fileType,
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

    console.log(`✅ Fichier ${fileType.toUpperCase()} uploadé: ${file.originalName} par ${req.user.email}`);

    res.status(201).json({
      success: true,
      message: `Fichier ${fileType.toUpperCase()} uploadé avec succès`,
      data: {
        _id: file._id,
        filename: file.filename,
        originalName: file.originalName,
        headers: file.headers,
        rowCount: file.rowCount,
        fileType: file.fileType,
        totalChunks: file.totalChunks,
        createdAt: file.createdAt
      }
    });
  } catch (error) {
    console.error('❌ Erreur upload:', error);
    
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
 * PUT /csv/:id - Mettre à jour un fichier (remplacer)
 */
exports.updateCSVFile = async (req, res) => {
  try {
    const file = await File.findOne({
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

    const fileType = getFileType(req.file.originalname);
    
    if (fileType === 'unknown') {
      return res.status(400).json({
        success: false,
        message: "Type de fichier non supporté"
      });
    }

    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    const headers = await readFileHeaders(req.file.path, fileType);
    const rowCount = await countFileLines(req.file.path, fileType);

    file.filename = req.file.filename;
    file.originalName = req.file.originalname;
    file.path = req.file.path;
    file.size = req.file.size;
    file.fileType = fileType;
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
        fileType: file.fileType,
        updatedAt: file.updatedAt
      }
    });
  } catch (error) {
    console.error('❌ Erreur update:', error);
    
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
 * DELETE /csv/:id - Supprimer un fichier
 */
exports.deleteCSVFile = async (req, res) => {
  try {
    const file = await File.findOne({
      _id: req.params.id,
      createdBy: req.user.userId
    }).populate('createdBy', 'email nom prenom');

    if (!file) {
      return res.status(404).json({
        success: false,
        message: "Fichier non trouvé"
      });
    }

    const fileInfo = {
      _id: file._id,
      originalName: file.originalName,
      fileType: file.fileType,
      createdBy: file.createdBy ? {
        _id: file.createdBy._id,
        email: file.createdBy.email,
        nom: file.createdBy.nom,
        prenom: file.createdBy.prenom
      } : null
    };

    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    await file.deleteOne();

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
    console.error('❌ Erreur delete:', error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur"
    });
  }
};

/**
 * GET /csv/:id/download - Télécharger un fichier
 */
exports.downloadCSVFile = async (req, res) => {
  try {
    let query = { _id: req.params.id };
    
    if (req.user.role !== 'admin') {
      query.createdBy = req.user.userId;
    }

    const file = await File.findOne(query);

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

    console.log(`📥 Téléchargement: ${file.originalName} (${file.fileType}) par ${req.user.email}`);

    res.download(file.path, file.originalName);
  } catch (error) {
    console.error('❌ Erreur download:', error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur"
    });
  }
};

// ==================== CRUD LIGNES ====================

/**
 * POST /csv/:id/rows - Ajouter une nouvelle ligne
 */
exports.addRow = async (req, res) => {
  try {
    const file = await File.findOne({
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
    
    const missingHeaders = file.headers.filter(h => !(h in newRow));
    if (missingHeaders.length > 0) {
      return res.status(400).json({
        success: false,
        message: `En-têtes manquants: ${missingHeaders.join(', ')}`
      });
    }

    const allData = await readFullFile(file.path, file.fileType);
    
    allData.push(newRow);
    
    await writeFile(file.path, allData, file.headers, file.fileType);
    
    file.rowCount = allData.length;
    file.updatedAt = new Date();
    await file.save();

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
 * PUT /csv/:id/rows/:rowIndex - Modifier une ligne
 */
exports.updateRow = async (req, res) => {
  try {
    const file = await File.findOne({
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

    const allData = await readFullFile(file.path, file.fileType);
    
    if (rowIndex < 0 || rowIndex >= allData.length) {
      return res.status(400).json({
        success: false,
        message: "Index de ligne invalide"
      });
    }

    const missingHeaders = file.headers.filter(h => !(h in updatedRow));
    if (missingHeaders.length > 0) {
      return res.status(400).json({
        success: false,
        message: `En-têtes manquants: ${missingHeaders.join(', ')}`
      });
    }

    const oldRow = { ...allData[rowIndex] };
    allData[rowIndex] = updatedRow;
    
    await writeFile(file.path, allData, file.headers, file.fileType);
    
    file.updatedAt = new Date();
    await file.save();

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
    const file = await File.findOne({
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

    const allData = await readFullFile(file.path, file.fileType);
    
    if (rowIndex < 0 || rowIndex >= allData.length) {
      return res.status(400).json({
        success: false,
        message: "Index de ligne invalide"
      });
    }

    const deletedRow = allData[rowIndex];
    allData.splice(rowIndex, 1);
    
    await writeFile(file.path, allData, file.headers, file.fileType);
    
    file.rowCount = allData.length;
    file.updatedAt = new Date();
    await file.save();

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