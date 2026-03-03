// controllers/csvController.js

const csv = require('csv-parser');
const { parse } = require('csv-parse');
const fs = require('fs');
const path = require('path');
const { Parser } = require('json2csv');
const readline = require('readline');
const excelReader = require('../services/excelReader.service');

// Le modèle reste CSVFile pour compatibilité
const File = require("../models/CSVFile");

// Liste des colonnes obligatoires
const REQUIRED_COLUMNS = [
    'lot_id',
    'category',
    'annee',
    'trimestre',
    'mois',
    'qualite_initiale',
    'national',
    'international',
    'region_origine',
    'region_destination',
    'mode_transport',
    'distance_km',
    'duree_voyage',
    'temperature_mesuree_min',
    'temperature_mesuree_max',
    'temperature_max',
    'temperature_min',
    'humidityMin',
    'humidityMax',
    'humidite_%_min',
    'humidite_%_max',
    'choc_transport',
    'pression_hpa',
    'pluie_mm',
    'temps_exposition_soleil_h',
    'ventilation',
    'poids_kg',
    'prix_achat_unitaire',
    'prix_vente_unitaire',
    'cout_transport_total',
    'marge_brute',
    'marge_%',
    'decision_automatique'
];

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
 * Lire tout le fichier - VERSION CORRIGÉE
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
 * Écrire des données dans un fichier - VERSION CORRIGÉE
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
 * Lire les en-têtes (version avec csv-parser)
 */
const readFileHeaders = async (filePath, fileType) => {
    try {
        if (fileType === 'csv') {
            return new Promise((resolve, reject) => {
                const headers = [];
                let headersRead = false;
                
                const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
                
                stream.pipe(csv({
                    mapHeaders: ({ header, index }) => {
                        let cleanHeader = header;
                        
                        if (index === 0) {
                            cleanHeader = cleanHeader.replace(/^\uFEFF/, '');
                        }
                        
                        cleanHeader = cleanHeader.replace(/[^\x20-\x7E]/g, '');
                        cleanHeader = cleanHeader.trim();
                        
                        if (index === 0 && header !== cleanHeader) {
                            console.log(`Header original: "${header}" -> nettoyé: "${cleanHeader}"`);
                        }
                        
                        return cleanHeader;
                    }
                }))
                .on('headers', (headerList) => {
                    headersRead = true;
                    console.log(`📋 Headers lus depuis ${filePath}:`, headerList);
                    resolve(headerList);
                })
                .on('end', () => {
                    if (!headersRead) {
                        const content = fs.readFileSync(filePath, 'utf8');
                        const firstLine = content.split('\n')[0];
                        const rawHeaders = firstLine.split(',').map(h => h.trim());
                        console.log('📋 Headers lus (fallback):', rawHeaders);
                        resolve(rawHeaders);
                    }
                })
                .on('error', (error) => {
                    console.error('❌ Erreur lecture headers CSV:', error);
                    reject(error);
                });
            });
        } else if (fileType === 'excel') {
            return await excelReader.readExcelHeaders(filePath);
        } else {
            return [];
        }
    } catch (error) {
        console.error('❌ Erreur dans readFileHeaders:', error);
        throw error;
    }
};

/**
 * Valider que le fichier contient toutes les colonnes requises
 */
const validateRequiredColumns = (headers) => {
    const missingColumns = REQUIRED_COLUMNS.filter(col => !headers.includes(col));
    return {
        isValid: missingColumns.length === 0,
        missingColumns,
        requiredColumns: REQUIRED_COLUMNS
    };
};

// ==================== FONCTIONS CSV ====================

/**
 * Stream CSV avec csv-parse - VERSION CORRIGÉE
 */
const streamCSVFile = (filePath, startLine = 0, limit = 100) => {
    return new Promise((resolve, reject) => {
        const results = [];
        let headers = [];
        let currentLine = 0;
        
        const parser = parse({
            delimiter: [',', ';'],
            trim: true,
            skip_empty_lines: true,
            bom: true,
            columns: false
        });
        
        const stream = fs.createReadStream(filePath)
            .pipe(parser);
        
        stream.on('data', (row) => {
            if (currentLine === 0) {
                headers = row;
                console.log('📋 Headers CSV:', headers);
                currentLine++;
                return;
            }
            
            if (currentLine - 1 >= startLine && results.length < limit) {
                const rowData = {};
                headers.forEach((header, index) => {
                    rowData[header] = row[index] || '';
                });
                results.push(rowData);
            }
            
            currentLine++;
        });
        
        stream.on('end', () => {
            const totalDataLines = currentLine - 1;
            console.log(`📊 ${results.length} lignes retournées sur ${totalDataLines} totales`);
            resolve({
                data: results,
                total: totalDataLines,
                hasMore: totalDataLines > startLine + limit
            });
        });
        
        stream.on('error', (error) => {
            console.error('❌ Erreur lecture CSV:', error);
            reject(error);
        });
    });
};

/**
 * Lecture complète CSV - VERSION CORRIGÉE
 */
const readFullCSVFile = (filePath) => {
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
                firstLineStream.destroy();
            }
        });
        
        firstLineStream.on('close', () => {
            // Lire tout le fichier avec le bon séparateur
            const readStream = fs.createReadStream(filePath, { encoding: 'utf8' });
            let headers = [];
            let lineNumber = 0;
            
            const rl = readline.createInterface({
                input: readStream,
                crlfDelay: Infinity
            });
            
            rl.on('line', (line) => {
                if (lineNumber === 0) {
                    // Headers
                    headers = line.split(separator).map(h => h.trim());
                    headers[0] = headers[0].replace(/^\uFEFF/, '');
                    lineNumber++;
                    return;
                }
                
                if (!line.trim()) {
                    lineNumber++;
                    return;
                }
                
                // Données
                const values = line.split(separator).map(v => v.trim());
                const row = {};
                headers.forEach((header, index) => {
                    row[header] = values[index] || '';
                });
                results.push(row);
                lineNumber++;
            });
            
            rl.on('close', () => {
                console.log(`📖 ${results.length} lignes lues depuis ${filePath}`);
                resolve(results);
            });
            
            rl.on('error', reject);
        });
        
        firstLineStream.on('error', reject);
    });
};

/**
 * Écriture CSV - VERSION CORRIGÉE
 */
const writeCSVFile = async (filePath, data, headers) => {
    return new Promise((resolve, reject) => {
        try {
            // Détecter le séparateur du fichier original
            const firstLineStream = fs.createReadStream(filePath, { encoding: 'utf8', start: 0, end: 1000 });
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
                    firstLineStream.destroy();
                }
            });
            
            firstLineStream.on('close', () => {
                // Construire le contenu CSV avec le bon séparateur
                let content = '';
                
                // Ajouter les headers
                content += headers.join(separator) + '\n';
                
                // Ajouter les données
                data.forEach(row => {
                    const rowValues = headers.map(header => {
                        let value = row[header] !== undefined ? row[header] : '';
                        // Convertir les nombres avec virgule en points si nécessaire
                        if (typeof value === 'string' && value.includes(',')) {
                            value = value.replace(',', '.');
                        }
                        // Échapper les guillemets et les séparateurs si nécessaire
                        if (typeof value === 'string' && (value.includes(separator) || value.includes('"'))) {
                            value = `"${value.replace(/"/g, '""')}"`;
                        }
                        return value;
                    });
                    content += rowValues.join(separator) + '\n';
                });
                
                // Écrire le fichier
                fs.writeFileSync(filePath, content, 'utf8');
                console.log(`✅ Fichier CSV réécrit avec ${data.length} lignes (séparateur: "${separator}")`);
                resolve();
            });
            
            firstLineStream.on('error', (error) => {
                console.error('❌ Erreur détection séparateur:', error);
                reject(error);
            });
            
        } catch (error) {
            console.error('❌ Erreur écriture CSV:', error);
            reject(error);
        }
    });
};

/**
 * Compter les lignes CSV
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
 * Lecture des headers CSV avec détection automatique - VERSION ROBUSTE
 */
const readCSVHeaders = (filePath) => {
    return new Promise((resolve, reject) => {
        const rl = readline.createInterface({
            input: fs.createReadStream(filePath, { encoding: 'utf8' }),
            crlfDelay: Infinity
        });
        
        let firstLine = '';
        let lineCount = 0;
        
        rl.on('line', (line) => {
            if (lineCount === 0) {
                firstLine = line;
                rl.close();
            }
            lineCount++;
        });
        
        rl.on('close', () => {
            if (!firstLine) {
                console.log('⚠️ Fichier vide ou première ligne manquante');
                resolve([]);
                return;
            }
            
            console.log('📄 Première ligne brute:', JSON.stringify(firstLine));
            
            // Nettoyer le BOM
            let cleanFirstLine = firstLine.replace(/^\uFEFF/, '');
            
            // Détecter le séparateur
            const commaCount = (cleanFirstLine.match(/,/g) || []).length;
            const semicolonCount = (cleanFirstLine.match(/;/g) || []).length;
            
            let separator = ',';
            
            if (semicolonCount > commaCount) {
                separator = ';';
                console.log(`🔍 Séparateur détecté: ";" (${semicolonCount} points-virgules)`);
            } else {
                console.log(`🔍 Séparateur détecté: "," (${commaCount} virgules)`);
            }
            
            // Séparer les headers
            let rawHeaders = cleanFirstLine.split(separator).map(h => h.trim());
            
            console.log(`📋 Headers bruts (${rawHeaders.length}):`, rawHeaders);
            
            // Nettoyer chaque header
            const headers = rawHeaders.map((header, index) => {
                let cleanHeader = header
                    .replace(/^["']|["']$/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();
                
                return cleanHeader;
            });
            
            console.log(`✅ Headers finaux (${headers.length}):`, headers);
            
            // Vérification de cohérence
            const expectedCount = 33;
            if (headers.length !== expectedCount) {
                console.log(`⚠️ Attention: ${headers.length} headers trouvés, ${expectedCount} attendus`);
                
                if (headers.length === 1 && headers[0].includes(';')) {
                    console.log('🔄 Tentative de séparation forcée...');
                    const corrected = headers[0].split(';').map(h => h.trim());
                    console.log(`✅ Après correction: ${corrected.length} headers`);
                    resolve(corrected);
                    return;
                }
            }
            
            resolve(headers);
        });
        
        rl.on('error', (error) => {
            console.error('❌ Erreur lecture première ligne:', error);
            reject(error);
        });
    });
};

// ==================== MÉTHODES DE VALIDATION ====================

/**
 * POST /csv/validate - Valider les colonnes d'un fichier sans le sauvegarder
 */
exports.validateCSVColumns = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Aucun fichier téléchargé'
            });
        }

        const filePath = req.file.path;
        const fileType = getFileType(req.file.originalname);

        if (fileType === 'unknown') {
            fs.unlinkSync(filePath);
            return res.status(400).json({
                success: false,
                message: "Type de fichier non supporté. Utilisez CSV ou Excel (.xlsx, .xls)"
            });
        }

        let headers = [];

        try {
            headers = await readCSVHeaders(filePath);
        } catch (error) {
            fs.unlinkSync(filePath);
            throw error;
        }

        const validation = validateRequiredColumns(headers);

        fs.unlinkSync(filePath);

        if (validation.isValid) {
            res.json({
                success: true,
                valid: true,
                message: 'Le fichier contient toutes les colonnes requises',
                columns: headers,
                fileType: fileType
            });
        } else {
            res.status(400).json({
                success: false,
                valid: false,
                message: 'Colonnes manquantes',
                missingColumns: validation.missingColumns,
                requiredColumns: validation.requiredColumns,
                fileType: fileType
            });
        }

    } catch (error) {
        console.error('❌ Erreur validation CSV:', error);

        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (e) {
                console.error('Erreur suppression fichier:', e);
            }
        }

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la validation du fichier'
        });
    }
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
 * POST /csv/upload - Uploader un nouveau fichier avec validation des colonnes
 */
exports.uploadCSVFile = async (req, res) => {
    try {
        console.log('📤 Requête upload reçue');
        console.log('📁 Fichier:', {
            originalname: req.file?.originalname,
            size: req.file?.size,
            mimetype: req.file?.mimetype,
            path: req.file?.path
        });
        
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Aucun fichier fourni"
            });
        }

        const fileType = getFileType(req.file.originalname);
        console.log('📁 Type de fichier détecté:', fileType);

        if (fileType === 'unknown') {
            console.log('❌ Type de fichier non supporté');
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
                success: false,
                message: "Type de fichier non supporté. Utilisez CSV ou Excel (.xlsx, .xls)"
            });
        }

        let headers = [];
        
        try {
            if (fileType === 'csv') {
                headers = await readCSVHeaders(req.file.path);
                console.log('📋 Headers lus avec readCSVHeaders (détection auto):', headers);
            } else {
                headers = await readFileHeaders(req.file.path, fileType);
                console.log('📋 Headers lus avec readFileHeaders (Excel):', headers);
            }
        } catch (headerError) {
            console.error('❌ Erreur lecture headers:', headerError);
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
                success: false,
                message: "Erreur lors de la lecture des en-têtes du fichier: " + headerError.message
            });
        }

        const validation = validateRequiredColumns(headers);
        console.log('✅ Résultat validation (upload):', {
            isValid: validation.isValid,
            missingColumns: validation.missingColumns,
            found: headers.length,
            required: validation.requiredColumns.length
        });

        if (!validation.isValid) {
            console.log('❌ Validation échouée - colonnes manquantes:', validation.missingColumns);
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
                success: false,
                message: `Colonnes manquantes : ${validation.missingColumns.join(', ')}`,
                missingColumns: validation.missingColumns,
                requiredColumns: validation.requiredColumns,
                fileType: fileType
            });
        }

        const rowCount = await countFileLines(req.file.path, fileType);
        console.log(`📊 Nombre de lignes: ${rowCount}`);
        
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
            createdBy: req.user.userId,
            status: 'validated'
        });

        await file.save();
        console.log('💾 Fichier sauvegardé avec ID:', file._id);

        const savedFile = await File.findById(file._id)
            .populate('createdBy', 'email nom prenom');

        if (req.io) {
            const fileData = {
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
            };
            
            req.io.emit('file:uploaded', {
                file: fileData,
                uploadedBy: {
                    email: req.user.email,
                    nom: req.user.nom,
                    prenom: req.user.prenom,
                    role: req.user.role
                },
                timestamp: new Date()
            });
            
            console.log('📡 Événement WebSocket émis: file:uploaded');
        }

        console.log(`✅ Fichier ${fileType.toUpperCase()} uploadé avec succès: ${file.originalName} par ${req.user.email}`);

        let preview = { data: [] };
        try {
            preview = await streamFile(file.path, fileType, 0, 5);
        } catch (previewError) {
            console.log('⚠️ Impossible de générer l\'aperçu:', previewError.message);
        }

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
                createdAt: file.createdAt,
                preview: preview.data
            }
        });

    } catch (error) {
        console.error('❌ Erreur upload:', error);

        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
            try {
                fs.unlinkSync(req.file.path);
                console.log('🧹 Fichier temporaire supprimé');
            } catch (e) {
                console.error('Erreur suppression fichier:', e);
            }
        }

        res.status(500).json({
            success: false,
            message: "Erreur lors de l'upload",
            error: error.message
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
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
                success: false,
                message: "Type de fichier non supporté"
            });
        }

        const headers = await readFileHeaders(req.file.path, fileType);
        const validation = validateRequiredColumns(headers);

        if (!validation.isValid) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
                success: false,
                message: `Colonnes manquantes : ${validation.missingColumns.join(', ')}`,
                missingColumns: validation.missingColumns,
                requiredColumns: validation.requiredColumns
            });
        }

        if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
        }

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

        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
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

// ==================== CRUD LIGNES (VERSIONS CORRIGÉES) ====================

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
        console.log('➕ Ajout nouvelle ligne:', newRow);

        const missingHeaders = file.headers.filter(h => !(h in newRow));
        if (missingHeaders.length > 0) {
            return res.status(400).json({
                success: false,
                message: `En-têtes manquants: ${missingHeaders.join(', ')}`
            });
        }

        const allData = await readFullFile(file.path, file.fileType);
        console.log(`📊 Données actuelles: ${allData.length} lignes`);

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

        console.log(`✅ Ligne ajoutée, nouveau total: ${allData.length} lignes`);

        res.json({
            success: true,
            message: "Ligne ajoutée avec succès",
            data: newRow
        });
    } catch (error) {
        console.error('❌ Erreur add row:', error);
        res.status(500).json({
            success: false,
            message: "Erreur serveur",
            error: error.message
        });
    }
};

/**
 * PUT /csv/:id/rows/:rowIndex - Modifier une ligne - VERSION CORRIGÉE
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

        console.log(`📝 Mise à jour ligne ${rowIndex}:`, updatedRow);

        // Lire toutes les données
        const allData = await readFullFile(file.path, file.fileType);
        console.log(`📊 Données lues: ${allData.length} lignes`);

        if (rowIndex < 0 || rowIndex >= allData.length) {
            return res.status(400).json({
                success: false,
                message: "Index de ligne invalide"
            });
        }

        // Vérifier les en-têtes manquants
        const missingHeaders = file.headers.filter(h => !(h in updatedRow));
        if (missingHeaders.length > 0) {
            return res.status(400).json({
                success: false,
                message: `En-têtes manquants: ${missingHeaders.join(', ')}`
            });
        }

        // Sauvegarder l'ancienne ligne pour log
        const oldRow = { ...allData[rowIndex] };
        
        // Mettre à jour la ligne
        allData[rowIndex] = updatedRow;

        // Écrire toutes les données dans le fichier
        await writeFile(file.path, allData, file.headers, file.fileType);

        // Mettre à jour les métadonnées
        file.updatedAt = new Date();
        await file.save();

        console.log(`✅ Ligne ${rowIndex} mise à jour:`, {
            avant: oldRow,
            après: updatedRow
        });

        // Émettre l'événement WebSocket
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
            message: "Erreur serveur",
            error: error.message
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
        console.log(`🗑️ Suppression ligne ${rowIndex}`);

        const allData = await readFullFile(file.path, file.fileType);
        console.log(`📊 Données avant suppression: ${allData.length} lignes`);

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

        console.log(`✅ Ligne supprimée, nouveau total: ${allData.length} lignes`);

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
            message: "Erreur serveur",
            error: error.message
        });
    }
};