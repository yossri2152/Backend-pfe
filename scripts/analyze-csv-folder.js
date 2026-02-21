const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const mongoose = require('mongoose');
require('dotenv').config();

// Importer les services
const AnalysisService = require('../services/analysis.service');
const OpenAIService = require('../services/openai.service');
const Lot = require('../models/Lot');

const UPLOADS_DIR = path.join(__dirname, '../uploads');
const RESULTS_DIR = path.join(__dirname, '../results');

async function analyzeUploads() {
  console.log('🔍 Analyse des fichiers CSV dans uploads...\n');

  try {
    // Connexion MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connecté à MongoDB\n');

    // Créer dossier results s'il n'existe pas
    if (!fs.existsSync(RESULTS_DIR)) {
      fs.mkdirSync(RESULTS_DIR, { recursive: true });
    }

    // Lire tous les fichiers CSV
    const files = fs.readdirSync(UPLOADS_DIR).filter(f => f.endsWith('.csv'));
    
    if (files.length === 0) {
      console.log('❌ Aucun fichier CSV trouvé dans uploads/');
      process.exit(1);
    }

    console.log(`📂 ${files.length} fichier(s) CSV trouvé(s)\n`);

    const allResults = [];
    const summary = {
      totalLots: 0,
      lotsSains: 0,
      lotsEndommages: 0,
      parFichier: {}
    };

    for (const file of files) {
      console.log(`📄 Analyse de: ${file}`);
      const filePath = path.join(UPLOADS_DIR, file);
      
      // Déterminer le type de produit
      let productType = 'tomate';
      if (file.toLowerCase().includes('agrume')) productType = 'agrume';
      else if (file.toLowerCase().includes('fraise')) productType = 'fraise';
      else if (file.toLowerCase().includes('datte')) productType = 'datte';

      // Lire le CSV
      const lots = await readCSV(filePath);
      console.log(`   ${lots.length} lots trouvés`);

      const fileResults = [];
      
      for (const [index, lot] of lots.entries()) {
        try {
          // Convertir les données
          const lotData = {
            temperature: parseFloat(lot.Température || lot.temperature || 0),
            duration: parseFloat(lot.Durée || lot.duration || 0),
            pressure: parseFloat(lot.Pression || lot.pressure || 1013),
            rain: parseFloat(lot.Pluie || lot.rain || 0),
            humidity: parseFloat(lot.Humidité || lot.humidity || 0),
            ventilation: lot.Ventilation || lot.ventilation || "moyenne",
            shock: lot.Choc || lot.shock || "non",
            sunExposure: parseFloat(lot.Soleil || lot.sunExposure || 0)
          };

          // Analyse métier
          const analysis = AnalysisService.analyzeLot(lotData, productType);
          
          // Rapport IA
          const aiReport = await OpenAIService.generateTomatoLotReport(lotData, analysis);

          // Sauvegarder dans MongoDB
          const lotDocument = new Lot({
            productType,
            fileName: file,
            lineNumber: index + 2,
            originalData: lot,
            ...lotData,
            issues: analysis.issues,
            decision: analysis.decision,
            severity: analysis.severity,
            aiReport,
            analyzedAt: new Date()
          });

          await lotDocument.save();

          const result = {
            ligne: index + 2,
            decision: analysis.decision,
            issues: analysis.issues,
            rapport: aiReport.resume,
            id: lotDocument._id
          };

          fileResults.push(result);
          allResults.push({
            fichier: file,
            ...result
          });

          // Mettre à jour les stats
          summary.totalLots++;
          if (analysis.decision === "Lot Sain") {
            summary.lotsSains++;
          } else {
            summary.lotsEndommages++;
          }

          process.stdout.write('.');

        } catch (err) {
          console.error(`\n   ❌ Erreur lot ${index + 2}:`, err.message);
        }
      }

      // Sauvegarder les résultats du fichier
      summary.parFichier[file] = {
        total: fileResults.length,
        sains: fileResults.filter(r => r.decision === "Lot Sain").length,
        endommages: fileResults.filter(r => r.decision === "Lot Endommagé").length,
        lots: fileResults
      };

      console.log(`\n   ✅ ${fileResults.length} lots analysés\n`);
    }

    // Calculer les pourcentages
    summary.pourcentageSain = ((summary.lotsSains / summary.totalLots) * 100).toFixed(2) + '%';
    summary.pourcentageEndommage = ((summary.lotsEndommages / summary.totalLots) * 100).toFixed(2) + '%';

    // Générer un rapport HTML
    const htmlReport = generateHTMLReport(summary, allResults);
    const htmlPath = path.join(RESULTS_DIR, `rapport-${Date.now()}.html`);
    fs.writeFileSync(htmlPath, htmlReport);

    // Générer un rapport JSON
    const jsonPath = path.join(RESULTS_DIR, `resultats-${Date.now()}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify({
      summary,
      details: allResults
    }, null, 2));

    console.log('\n' + '='.repeat(50));
    console.log('📊 RÉSULTATS DE L\'ANALYSE');
    console.log('='.repeat(50));
    console.log(`📦 Total lots analysés: ${summary.totalLots}`);
    console.log(`✅ Lots sains: ${summary.lotsSains} (${summary.pourcentageSain})`);
    console.log(`❌ Lots endommagés: ${summary.lotsEndommages} (${summary.pourcentageEndommage})`);
    console.log('='.repeat(50));
    console.log(`📁 Rapport HTML: ${htmlPath}`);
    console.log(`📁 Rapport JSON: ${jsonPath}`);

    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

function readCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

function generateHTMLReport(summary, details) {
  const date = new Date().toLocaleString('fr-FR');
  
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rapport d'analyse - ExportChain</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #f5f5f5;
            margin: 0;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.1);
            padding: 30px;
        }
        h1 {
            color: #333;
            border-bottom: 3px solid #FFD700;
            padding-bottom: 10px;
            margin-top: 0;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
        }
        .date {
            color: #666;
            font-size: 14px;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }
        .stat-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 25px;
            border-radius: 15px;
            text-align: center;
            box-shadow: 0 10px 30px rgba(0,0,0,0.15);
        }
        .stat-card.sain {
            background: linear-gradient(135deg, #00b09b, #96c93d);
        }
        .stat-card.endommage {
            background: linear-gradient(135deg, #ff6b6b, #ee5253);
        }
        .stat-number {
            font-size: 48px;
            font-weight: bold;
            margin: 10px 0;
        }
        .stat-label {
            font-size: 16px;
            opacity: 0.9;
        }
        .stat-percent {
            font-size: 20px;
            margin-top: 10px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 30px;
        }
        th {
            background: #FFD700;
            color: #000;
            padding: 12px;
            text-align: left;
            font-weight: 600;
        }
        td {
            padding: 12px;
            border-bottom: 1px solid #ddd;
        }
        tr:hover {
            background: #f8f9fa;
        }
        .badge {
            display: inline-block;
            padding: 5px 10px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
        }
        .badge.sain {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        .badge.endommage {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        .issues-list {
            list-style: none;
            padding: 0;
            margin: 5px 0;
        }
        .issues-list li {
            font-size: 12px;
            color: #666;
            margin: 2px 0;
        }
        .fichier-header {
            background: #f8f9fa;
            padding: 15px;
            margin: 30px 0 10px;
            border-left: 4px solid #FFD700;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Rapport d'analyse ExportChain</h1>
            <div class="date">Généré le ${date}</div>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number">${summary.totalLots}</div>
                <div class="stat-label">Lots analysés</div>
            </div>
            <div class="stat-card sain">
                <div class="stat-number">${summary.lotsSains}</div>
                <div class="stat-label">Lots sains</div>
                <div class="stat-percent">${summary.pourcentageSain}</div>
            </div>
            <div class="stat-card endommage">
                <div class="stat-number">${summary.lotsEndommages}</div>
                <div class="stat-label">Lots endommagés</div>
                <div class="stat-percent">${summary.pourcentageEndommage}</div>
            </div>
        </div>

        ${Object.entries(summary.parFichier).map(([fichier, data]) => `
            <div class="fichier-header">
                📁 ${fichier} - ${data.total} lots (${data.sains} sains, ${data.endommages} endommagés)
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Ligne</th>
                        <th>Décision</th>
                        <th>Problèmes</th>
                        <th>Rapport IA</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.lots.map(lot => `
                        <tr>
                            <td>${lot.ligne}</td>
                            <td>
                                <span class="badge ${lot.decision === 'Lot Sain' ? 'sain' : 'endommage'}">
                                    ${lot.decision}
                                </span>
                            </td>
                            <td>
                                <ul class="issues-list">
                                    ${lot.issues.map(i => `<li>⚠️ ${i}</li>`).join('')}
                                    ${lot.issues.length === 0 ? '<li>✅ Aucun problème</li>' : ''}
                                </ul>
                            </td>
                            <td>${lot.rapport || 'Non disponible'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `).join('')}
    </div>
</body>
</html>
  `;
}

analyzeUploads();