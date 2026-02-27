const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class PDFService {
  
  /**
   * Génère un PDF de rapport pour un lot
   */
  async generateLotPDF(lot, analysis, detailedReport) {
    return new Promise((resolve, reject) => {
      try {
        // Créer un document PDF avec des options avancées
        const doc = new PDFDocument({
          size: 'A4',
          margin: 50,
          info: {
            Title: `Rapport d'analyse - Lot ${lot.lotId}`,
            Author: 'ExportChain AI',
            Subject: 'Analyse de qualité',
            Keywords: 'export, qualité, logistique',
            CreationDate: new Date()
          },
          bufferPages: true // Important pour éviter les pages blanches
        });

        // Collecter les données dans un buffer
        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // ========== PAGE DE GARDE ==========
        // En-tête avec logo
        doc.rect(0, 0, doc.page.width, 150)
          .fillColor('#2c3e50')
          .fill();

        doc.fillColor('#FFD700')
          .fontSize(36)
          .font('Helvetica-Bold')
          .text('EXPORTCHAIN', 50, 40);

        doc.fillColor('#FFFFFF')
          .fontSize(18)
          .font('Helvetica')
          .text('Rapport d\'analyse de lot', 50, 90);

        // Informations du lot
        doc.fillColor('#ECF0F1')
          .fontSize(14)
          .font('Helvetica')
          .text(`Lot: ${lot.lotId || 'N/A'}`, 400, 40, { align: 'right' })
          .text(`Date: ${new Date().toLocaleDateString('fr-FR')}`, 400, 65, { align: 'right' })
          .text(`Heure: ${new Date().toLocaleTimeString('fr-FR')}`, 400, 90, { align: 'right' });

        // Décision
        doc.y = 180;
        
        const isSain = analysis?.decision === "SAIN";
        const decisionColor = isSain ? '#27ae60' : '#e74c3c';
        const decisionText = isSain ? '✓ LOT SAIN' : '✗ LOT ENDOMMAGÉ';

        doc.roundedRect(50, doc.y, doc.page.width - 100, 70, 10)
          .fillColor(decisionColor)
          .fill();

        doc.fillColor('#FFFFFF')
          .fontSize(28)
          .font('Helvetica-Bold')
          .text(decisionText, 70, doc.y + 20, { align: 'center', width: doc.page.width - 140 });

        doc.y += 100;

        // ========== INFORMATIONS GÉNÉRALES ==========
        doc.fillColor('#2c3e50')
          .fontSize(20)
          .font('Helvetica-Bold')
          .text('📋 Informations générales', 50, doc.y);

        doc.y += 30;

        // Créer un tableau d'informations sur 2 colonnes
        const infoItems = [
          { label: 'Catégorie:', value: lot.category || 'Non spécifié' },
          { label: 'Mode de transport:', value: lot.transportMode || 'Non spécifié' },
          { label: 'Région d\'origine:', value: lot.originRegion || 'Non spécifié' },
          { label: 'Région destination:', value: lot.destinationRegion || 'Non spécifié' },
          { label: 'Distance:', value: lot.distance ? `${lot.distance} km` : 'Non spécifié' },
          { label: 'Poids:', value: lot.weight ? `${lot.weight} kg` : 'Non spécifié' },
          { label: 'Durée du voyage:', value: lot.duration ? `${lot.duration} jours` : 'Non spécifié' }
        ];

        // Dessiner le tableau
        const col1X = 70;
        const col2X = 300;
        const rowHeight = 25;

        infoItems.forEach((item, index) => {
          const y = doc.y + (index * rowHeight);
          
          // Fond alterné
          if (index % 2 === 0) {
            doc.rect(50, y - 5, doc.page.width - 100, rowHeight)
              .fillColor('#f8f9fa')
              .fill();
          }

          doc.fillColor('#2c3e50')
            .fontSize(11)
            .font('Helvetica')
            .text(item.label, col1X, y);

          doc.fillColor('#2c3e50')
            .fontSize(11)
            .font('Helvetica-Bold')
            .text(item.value.toString(), col2X, y);
        });

        doc.y += (infoItems.length * rowHeight) + 30;

        // ========== VÉRIFICATION DES SEUILS ==========
        doc.fillColor('#2c3e50')
          .fontSize(20)
          .font('Helvetica-Bold')
          .text('🔍 Vérification des seuils', 50, doc.y);

        doc.y += 30;

        // Créer un tableau des seuils
        const thresholds = [
          { param: 'Année', required: '2026', value: lot.year || 'N/A', unit: '' },
          { param: 'Qualité initiale', required: 'excellente', value: lot.initialQuality || 'N/A', unit: '' },
          { param: 'Durée max', required: this.getDurationRequired(lot.productType), value: lot.duration ? `${lot.duration} jours` : 'N/A', unit: '' },
          { param: 'Température min', required: this.getTempMinRequired(lot.productType), value: lot.temperatureMin ? `${lot.temperatureMin}°C` : 'N/A', unit: '°C' },
          { param: 'Température max', required: this.getTempMaxRequired(lot.productType), value: lot.temperatureMax ? `${lot.temperatureMax}°C` : 'N/A', unit: '°C' },
          { param: 'Humidité min', required: this.getHumidityMinRequired(lot.productType), value: lot.humidityMin ? `${lot.humidityMin}%` : 'N/A', unit: '%' },
          { param: 'Humidité max', required: this.getHumidityMaxRequired(lot.productType), value: lot.humidityMax ? `${lot.humidityMax}%` : 'N/A', unit: '%' },
          { param: 'Pression', required: this.getPressureRequired(lot.productType), value: lot.pressure ? `${lot.pressure} hPa` : 'N/A', unit: 'hPa' },
          { param: 'Pluie max', required: this.getRainRequired(lot.productType), value: lot.rain ? `${lot.rain} mm` : 'N/A', unit: 'mm' },
          { param: 'Choc', required: this.getShockRequired(lot.productType), value: lot.shock ? lot.shock.toFixed(2) : 'N/A', unit: '' },
          { param: 'Exposition soleil', required: this.getSunRequired(lot.productType), value: lot.sunExposure ? `${lot.sunExposure} min` : 'N/A', unit: 'min' },
          { param: 'Ventilation', required: 'Oui', value: lot.ventilation || 'N/A', unit: '' }
        ];

        // En-tête du tableau
        const headerY = doc.y;
        doc.rect(50, headerY - 5, doc.page.width - 100, 30)
          .fillColor('#34495e')
          .fill();

        doc.fillColor('#FFFFFF')
          .fontSize(11)
          .font('Helvetica-Bold')
          .text('Paramètre', 60, headerY)
          .text('Seuil requis', 200, headerY)
          .text('Valeur mesurée', 350, headerY)
          .text('Statut', 480, headerY);

        doc.y = headerY + 35;

        // Lignes du tableau
        thresholds.forEach((item, index) => {
          const y = doc.y + (index * 25);
          
          // Vérifier si on doit ajouter une nouvelle page
          if (y > doc.page.height - 100) {
            doc.addPage();
            doc.y = 50;
            // Réafficher l'en-tête sur la nouvelle page
            doc.rect(50, doc.y - 5, doc.page.width - 100, 30)
              .fillColor('#34495e')
              .fill();
            doc.fillColor('#FFFFFF')
              .fontSize(11)
              .font('Helvetica-Bold')
              .text('Paramètre', 60, doc.y)
              .text('Seuil requis', 200, doc.y)
              .text('Valeur mesurée', 350, doc.y)
              .text('Statut', 480, doc.y);
            doc.y += 35;
          }

          // Fond alterné
          if (index % 2 === 0) {
            doc.rect(50, y - 3, doc.page.width - 100, 20)
              .fillColor('#f8f9fa')
              .fill();
          }

          // Déterminer si le paramètre est conforme
          const isCompliant = this.isParamCompliant(item, lot, analysis);

          doc.fillColor('#2c3e50')
            .fontSize(10)
            .font('Helvetica')
            .text(item.param, 60, y);

          doc.text(item.required, 200, y);

          // Valeur mesurée
          doc.text(item.value.toString(), 350, y);

          // Statut avec symbole
          if (isCompliant) {
            doc.fillColor('#27ae60')
              .font('Helvetica-Bold')
              .text('✓', 490, y);
          } else {
            doc.fillColor('#e74c3c')
              .font('Helvetica-Bold')
              .text('✗', 490, y);
          }
        });

        doc.y += (thresholds.length * 25) + 30;

        // ========== PROBLÈMES DÉTECTÉS ==========
        if (analysis?.issues && analysis.issues.length > 0) {
          // Vérifier l'espace sur la page
          if (doc.y > doc.page.height - 150) {
            doc.addPage();
            doc.y = 50;
          }

          doc.fillColor('#e74c3c')
            .fontSize(18)
            .font('Helvetica-Bold')
            .text('⚠️ Points de non-conformité', 50, doc.y);

          doc.y += 30;

          analysis.issues.forEach((issue, index) => {
            doc.fillColor('#c0392b')
              .fontSize(10)
              .font('Helvetica')
              .text(`• ${issue}`, 70, doc.y);
            doc.y += 20;
          });

          doc.y += 20;
        }

        // ========== RAPPORT DÉTAILLÉ ==========
        if (detailedReport) {
          // Ajouter le rapport détaillé en nettoyant le texte
          const cleanReport = this.cleanDetailedReport(detailedReport);
          
          // Diviser le rapport en sections pour une meilleure lisibilité
          const sections = cleanReport.split('\n').filter(line => line.trim().length > 0);
          
          doc.fillColor('#2c3e50')
            .fontSize(18)
            .font('Helvetica-Bold')
            .text('📝 Rapport détaillé', 50, doc.y);

          doc.y += 30;

          sections.forEach((line, index) => {
            // Vérifier l'espace sur la page
            if (doc.y > doc.page.height - 50) {
              doc.addPage();
              doc.y = 50;
            }

            // Déterminer le style en fonction du contenu
            if (line.includes('⚠️')) {
              doc.fillColor('#e67e22')
                .fontSize(10)
                .font('Helvetica-Bold')
                .text(line, 70, doc.y);
            } else if (line.includes('✅') || line.includes('Conforme')) {
              doc.fillColor('#27ae60')
                .fontSize(10)
                .font('Helvetica')
                .text(line, 70, doc.y);
            } else if (line.includes('❌') || line.includes('Non conforme')) {
              doc.fillColor('#e74c3c')
                .fontSize(10)
                .font('Helvetica')
                .text(line, 70, doc.y);
            } else if (line.includes('━━━━')) {
              // Lignes de séparation
              doc.fillColor('#bdc3c7')
                .fontSize(8)
                .font('Helvetica')
                .text(line, 50, doc.y);
            } else {
              doc.fillColor('#34495e')
                .fontSize(10)
                .font('Helvetica')
                .text(line, 70, doc.y);
            }
            
            doc.y += 15;
          });
        }

        // ========== CONCLUSION ==========
        // Ajouter une nouvelle page pour la conclusion
        doc.addPage();
        doc.y = 100;

        doc.rect(50, doc.y - 20, doc.page.width - 100, 80)
          .fillColor(decisionColor)
          .fill();

        doc.fillColor('#FFFFFF')
          .fontSize(16)
          .font('Helvetica-Bold')
          .text(
            isSain 
              ? '✓ Ce lot est conforme à tous les critères et peut être exporté.'
              : '✗ Ce lot ne respecte pas les critères requis pour l\'exportation.',
            70,
            doc.y,
            { align: 'center', width: doc.page.width - 140 }
          );

        doc.y += 100;

        // Résumé des points clés
        doc.fillColor('#2c3e50')
          .fontSize(14)
          .font('Helvetica-Bold')
          .text('Résumé de l\'analyse', 50, doc.y);

        doc.y += 25;

        const summaryPoints = [
          `📊 ${thresholds.length} paramètres vérifiés`,
          `✅ ${analysis?.issues?.length || 0} non-conformité(s) détectée(s)`,
          `📅 Analyse effectuée le ${new Date().toLocaleDateString('fr-FR')}`,
          `🤖 Système: ExportChain AI v1.0`
        ];

        summaryPoints.forEach(point => {
          doc.fillColor('#34495e')
            .fontSize(11)
            .font('Helvetica')
            .text(`• ${point}`, 70, doc.y);
          doc.y += 20;
        });

        doc.y += 20;

        // ========== PIED DE PAGE ==========
        // Ajouter le pied de page sur chaque page
        const pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
          doc.switchToPage(i);
          
          // Pied de page
          doc.rect(0, doc.page.height - 50, doc.page.width, 50)
            .fillColor('#2c3e50')
            .fill();

          doc.fillColor('#FFFFFF')
            .fontSize(9)
            .font('Helvetica')
            .text('ExportChain AI - Module Intelligent de Validation Logistique', 50, doc.page.height - 35)
            .text(`Page ${i + 1} / ${pages.count}`, 500, doc.page.height - 35, { align: 'right' })
            .text(`Document généré le ${new Date().toLocaleDateString('fr-FR')}`, 50, doc.page.height - 20);
        }

        // Finaliser le PDF
        doc.end();

      } catch (error) {
        console.error('❌ Erreur génération PDF:', error);
        reject(error);
      }
    });
  }

  /**
   * Nettoie le rapport détaillé pour enlever les caractères spéciaux
   */
  cleanDetailedReport(report) {
    if (!report) return '';
    
    return report
      .replace(/[]/g, '') // Enlever les caractères spéciaux
      .replace(/=+/g, '━━━━━━━━━━━━━━━━━━━━━━━━━━━━') // Remplacer les = par des lignes
      .replace(/%+/g, '') // Enlever les %
      .replace(/ +/g, ' ') // Normaliser les espaces
      .replace(/\n\s*\n/g, '\n\n'); // Normaliser les sauts de ligne
  }

  /**
   * Détermine si un paramètre est conforme
   */
  isParamCompliant(item, lot, analysis) {
    if (analysis?.details && analysis.details[item.param.toLowerCase()]) {
      return analysis.details[item.param.toLowerCase()] === 'conforme';
    }
    
    // Logique par défaut basée sur les valeurs
    switch(item.param) {
      case 'Année':
        return lot.year === 2026;
      case 'Qualité initiale':
        return lot.initialQuality?.toLowerCase() === 'excellente';
      case 'Ventilation':
        return lot.ventilation?.toLowerCase() === 'oui';
      default:
        return true;
    }
  }

  // ========== FONCTIONS UTILITAIRES POUR LES SEUILS ==========
  
  getDurationRequired(productType) {
    const limits = { tomate: '≤ 7 jours', agrume: '≤ 21 jours', fraise: '≤ 3 jours', datte: '≤ 60 jours' };
    return limits[productType] || '≤ 7 jours';
  }

  getTempMinRequired(productType) {
    const limits = { tomate: '12°C', agrume: '10°C', fraise: '0°C', datte: '0°C' };
    return limits[productType] || '12°C';
  }

  getTempMaxRequired(productType) {
    const limits = { tomate: '20°C', agrume: '15°C', fraise: '2°C', datte: '5°C' };
    return limits[productType] || '20°C';
  }

  getHumidityMinRequired(productType) {
    const limits = { tomate: '80%', agrume: '85%', fraise: '90%', datte: '60%' };
    return limits[productType] || '80%';
  }

  getHumidityMaxRequired(productType) {
    const limits = { tomate: '90%', agrume: '95%', fraise: '95%', datte: '75%' };
    return limits[productType] || '90%';
  }

  getPressureRequired(productType) {
    const limits = { 
      tomate: '1008-1020 hPa', 
      agrume: '1005-1020 hPa', 
      fraise: '1010-1025 hPa', 
      datte: '1005-1025 hPa' 
    };
    return limits[productType] || '1008-1020 hPa';
  }

  getRainRequired(productType) {
    const limits = { tomate: '≤ 3 mm', agrume: '≤ 5 mm', fraise: '0 mm', datte: '0 mm' };
    return limits[productType] || '≤ 3 mm';
  }

  getShockRequired(productType) {
    const limits = { tomate: '0-0.5', agrume: '0-1', fraise: '0-0.2', datte: '0-2' };
    return limits[productType] || '0-0.5';
  }

  getSunRequired(productType) {
    const limits = { 
      tomate: '≤ 30 min', 
      agrume: '≤ 60 min', 
      fraise: '≤ 10 min', 
      datte: '≤ 120 min' 
    };
    return limits[productType] || '≤ 30 min';
  }
}

module.exports = new PDFService();