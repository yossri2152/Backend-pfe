const XLSX = require('xlsx');
const fs = require('fs');

class ExcelReaderService {
  
  /**
   * Lit un fichier Excel et retourne les données sous forme de tableau d'objets
   * @param {string} filePath - Chemin du fichier Excel
   * @param {number} startLine - Ligne de début (pour pagination)
   * @param {number} limit - Nombre de lignes à lire
   * @returns {Promise<Object>} - Données et métadonnées
   */
  async readExcelFile(filePath, startLine = 0, limit = 100) {
    return new Promise((resolve, reject) => {
      try {
        // Lire le fichier Excel
        const workbook = XLSX.readFile(filePath);
        
        // Prendre la première feuille
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convertir en JSON
        const allData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (allData.length === 0) {
          return resolve({
            data: [],
            total: 0,
            hasMore: false
          });
        }
        
        // Extraire les en-têtes (première ligne)
        const headers = allData[0].map(h => String(h).trim());
        
        // Extraire les données (lignes suivantes)
        const rows = allData.slice(1).map(row => {
          const obj = {};
          headers.forEach((header, index) => {
            obj[header] = row[index] !== undefined ? String(row[index]) : '';
          });
          return obj;
        });
        
        // Pagination
        const paginatedData = rows.slice(startLine, startLine + limit);
        
        resolve({
          data: paginatedData,
          total: rows.length,
          hasMore: rows.length > startLine + limit
        });
        
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Lit toutes les données d'un fichier Excel
   * @param {string} filePath - Chemin du fichier
   * @returns {Promise<Array>} - Toutes les données
   */
  async readFullExcelFile(filePath) {
    return new Promise((resolve, reject) => {
      try {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const allData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (allData.length === 0) {
          return resolve([]);
        }
        
        const headers = allData[0].map(h => String(h).trim());
        const rows = allData.slice(1).map(row => {
          const obj = {};
          headers.forEach((header, index) => {
            obj[header] = row[index] !== undefined ? String(row[index]) : '';
          });
          return obj;
        });
        
        resolve(rows);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Écrit des données dans un fichier Excel
   * @param {string} filePath - Chemin de sortie
   * @param {Array} data - Données à écrire
   * @param {Array} headers - En-têtes
   */
  async writeExcelFile(filePath, data, headers) {
    return new Promise((resolve, reject) => {
      try {
        // Préparer les données pour l'écriture
        const worksheetData = [headers, ...data.map(row => headers.map(h => row[h] || ''))];
        
        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
        
        XLSX.writeFile(workbook, filePath);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Lit les en-têtes d'un fichier Excel
   * @param {string} filePath - Chemin du fichier
   * @returns {Promise<Array>} - Liste des en-têtes
   */
  async readExcelHeaders(filePath) {
    return new Promise((resolve, reject) => {
      try {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const allData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (allData.length === 0) {
          return resolve([]);
        }
        
        const headers = allData[0].map(h => String(h).trim());
        resolve(headers);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Compte le nombre de lignes (hors en-têtes)
   * @param {string} filePath - Chemin du fichier
   * @returns {Promise<number>} - Nombre de lignes
   */
  async countExcelLines(filePath) {
    return new Promise((resolve, reject) => {
      try {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const allData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        resolve(Math.max(0, allData.length - 1));
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Détecte le type de fichier
   * @param {string} filename - Nom du fichier
   * @returns {string} - 'csv', 'excel', ou 'unknown'
   */
  detectFileType(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    if (ext === 'csv') return 'csv';
    if (['xlsx', 'xls', 'xlsm'].includes(ext)) return 'excel';
    return 'unknown';
  }
}

module.exports = new ExcelReaderService();