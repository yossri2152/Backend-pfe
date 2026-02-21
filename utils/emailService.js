const nodemailer = require('nodemailer');

// Configuration du transporteur email
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS ? process.env.EMAIL_PASS.replace(/\s/g, '') : ''
  }
});

// Vérifier la connexion au démarrage
transporter.verify(function(error, success) {
  if (error) {
    console.log('❌ Erreur de configuration email:', error);
  } else {
    console.log('✅ Serveur email prêt à envoyer des messages');
  }
});

/**
 * Envoyer un email de réinitialisation de mot de passe
 * @param {string} to - Email du destinataire
 * @param {string} resetCode - Code de réinitialisation à 6 chiffres
 */
const sendPasswordResetEmail = async (to, resetCode) => {
  console.log(`📧 Préparation de l'email de reset pour ${to}...`);
  
  try {
    const mailOptions = {
      from: `"YAHIAOUI GLOBAL EXPORT" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: '🔐 Réinitialisation de votre mot de passe - ExportChain',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
            }
            .container {
              background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%);
              padding: 2rem;
              border-radius: 10px;
            }
            .header {
              text-align: center;
              margin-bottom: 2rem;
            }
            .header h1 {
              color: #FFD700;
              margin: 0;
              font-size: 24px;
            }
            .header h2 {
              color: white;
              margin: 0;
              font-size: 18px;
            }
            .content {
              background: white;
              padding: 2rem;
              border-radius: 10px;
            }
            .code {
              background: #f5f5f5;
              font-size: 32px;
              font-weight: bold;
              text-align: center;
              padding: 1rem;
              margin: 1rem 0;
              border-radius: 5px;
              letter-spacing: 5px;
              color: #FFD700;
              border: 2px solid #FFD700;
            }
            .footer {
              text-align: center;
              margin-top: 2rem;
              color: #666;
              font-size: 12px;
            }
            .warning {
              color: #ff4444;
              font-size: 14px;
              margin-top: 1rem;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>YAHIAOUI GLOBAL EXPORT</h1>
              <h2>ExportChain</h2>
            </div>
            <div class="content">
              <h2>Réinitialisation de mot de passe</h2>
              <p>Bonjour,</p>
              <p>Vous avez demandé la réinitialisation de votre mot de passe. Voici votre code de validation :</p>
              
              <div class="code">${resetCode}</div>
              
              <p>Ce code est valable pendant <strong>15 minutes</strong>.</p>
              
              <p>Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
              
              <div class="warning">
                ⚠️ Ne partagez jamais ce code avec personne.
              </div>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} YAHIAOUI GLOBAL EXPORT - Tous droits réservés</p>
              <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        YAHIAOUI GLOBAL EXPORT - ExportChain
        
        Réinitialisation de mot de passe
        
        Votre code de réinitialisation est : ${resetCode}
        
        Ce code est valable pendant 15 minutes.
        
        Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.
        
        © ${new Date().getFullYear()} YAHIAOUI GLOBAL EXPORT
      `
    };

    console.log('📤 Envoi en cours...');
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email de reset envoyé! ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error('❌ Erreur envoi email de reset:', {
      message: error.message,
      code: error.code,
      command: error.command
    });
    throw error;
  }
};

/**
 * Envoyer un email d'approbation de compte
 * @param {string} userEmail - Email de l'utilisateur
 * @param {string} userName - Nom de l'utilisateur
 */
const sendApprovalEmail = async (userEmail, userName) => {
  console.log(`📧 Préparation de l'email d'approbation pour ${userEmail}...`);
  
  try {
    const mailOptions = {
      from: `"YAHIAOUI GLOBAL EXPORT" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: '✅ Compte approuvé - ExportChain',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
            }
            .container {
              background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%);
              padding: 2rem;
              border-radius: 10px;
            }
            .header {
              text-align: center;
              margin-bottom: 2rem;
            }
            .header h1 {
              color: #FFD700;
              margin: 0;
              font-size: 24px;
            }
            .header h2 {
              color: white;
              margin: 0;
              font-size: 18px;
            }
            .content {
              background: white;
              padding: 2rem;
              border-radius: 10px;
            }
            .button {
              display: inline-block;
              background: #FFD700;
              color: #000;
              text-decoration: none;
              padding: 1rem 2rem;
              border-radius: 5px;
              font-weight: bold;
              margin: 1rem 0;
            }
            .footer {
              text-align: center;
              margin-top: 2rem;
              color: #666;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>YAHIAOUI GLOBAL EXPORT</h1>
              <h2>ExportChain</h2>
            </div>
            <div class="content">
              <h2>Compte approuvé !</h2>
              <p>Bonjour <strong>${userName}</strong>,</p>
              <p>Votre compte a été <strong style="color: #00C851;">approuvé</strong> avec succès par l'administrateur.</p>
              <p>Vous pouvez maintenant vous connecter à la plateforme ExportChain et accéder à toutes les fonctionnalités.</p>
              
              <div style="text-align: center;">
                <a href="http://localhost:5173/login" class="button">Se connecter</a>
              </div>
              
              <p>Cordialement,<br>L'équipe ExportChain</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} YAHIAOUI GLOBAL EXPORT - Tous droits réservés</p>
              <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        YAHIAOUI GLOBAL EXPORT - ExportChain
        
        Compte approuvé !
        
        Bonjour ${userName},
        
        Votre compte a été approuvé avec succès par l'administrateur.
        
        Vous pouvez maintenant vous connecter à la plateforme ExportChain :
        http://localhost:5173/login
        
        Cordialement,
        L'équipe ExportChain
        
        © ${new Date().getFullYear()} YAHIAOUI GLOBAL EXPORT
      `
    };

    console.log('📤 Envoi en cours...');
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email d'approbation envoyé! ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error('❌ Erreur envoi email d\'approbation:', {
      message: error.message,
      code: error.code,
      command: error.command
    });
    throw error;
  }
};

/**
 * Envoyer un email d'approbation de demande d'achat
 * @param {string} to - Email du client
 * @param {Object} data - Données de la commande
 */
const sendPurchaseApprovalEmail = async (to, data) => {
  console.log(`📧 Préparation de l'email d'approbation d'achat pour ${to}...`);
  
  try {
    const mailOptions = {
      from: `"YAHIAOUI GLOBAL EXPORT" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: '✅ Demande d\'achat approuvée - ExportChain',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
            }
            .container {
              background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%);
              padding: 2rem;
              border-radius: 10px;
            }
            .header {
              text-align: center;
              margin-bottom: 2rem;
            }
            .header h1 {
              color: #FFD700;
              margin: 0;
              font-size: 24px;
            }
            .header h2 {
              color: white;
              margin: 0;
              font-size: 18px;
            }
            .content {
              background: white;
              padding: 2rem;
              border-radius: 10px;
            }
            .details {
              background: #f5f5f5;
              padding: 1.5rem;
              border-radius: 10px;
              margin: 1.5rem 0;
              border-left: 4px solid #00C851;
            }
            .price {
              font-size: 1.8rem;
              color: #00C851;
              font-weight: bold;
              text-align: center;
              margin: 1rem 0;
            }
            .footer {
              text-align: center;
              margin-top: 2rem;
              color: #666;
              font-size: 12px;
            }
            .product-icon {
              font-size: 2rem;
              text-align: center;
              margin-bottom: 1rem;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>YAHIAOUI GLOBAL EXPORT</h1>
              <h2>ExportChain</h2>
            </div>
            <div class="content">
              <div class="product-icon">${data.productType === 'dattes' ? '🍇' : 
                                          data.productType === 'fraises' ? '🍓' : 
                                          data.productType === 'tomates' ? '🍅' : '🍊'}</div>
              <h2 style="color: #00C851; text-align: center;">✓ Demande approuvée !</h2>
              <p>Bonjour <strong>${data.clientName}</strong>,</p>
              <p>Nous avons le plaisir de vous informer que votre demande d'achat a été <strong style="color: #00C851;">approuvée</strong> par notre équipe commerciale.</p>
              
              <div class="details">
                <h3 style="margin-top: 0;">Détails de votre commande :</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0;"><strong>Produit :</strong></td>
                    <td style="padding: 8px 0; text-align: right;">${data.productType.charAt(0).toUpperCase() + data.productType.slice(1)}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;"><strong>Quantité :</strong></td>
                    <td style="padding: 8px 0; text-align: right;">${data.quantity} kg</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;"><strong>Type :</strong></td>
                    <td style="padding: 8px 0; text-align: right;">${data.tradeType === 'national' ? '🇹🇳 National' : '🌍 International'}</td>
                  </tr>
                </table>
                <div class="price">
                  ${data.totalPrice} ${data.currency}
                </div>
              </div>
              
              <p><strong>Prochaines étapes :</strong></p>
              <ul style="color: #666;">
                <li>Un responsable commercial vous contactera sous 24h</li>
                <li>Vous recevrez un contrat à signer électroniquement</li>
                <li>Le paiement sera à effectuer selon les modalités convenues</li>
              </ul>
              
              <p>Nous vous remercions pour votre confiance et restons à votre disposition pour toute information complémentaire.</p>
              
              <p style="margin-top: 2rem;">Cordialement,<br><strong>L'équipe ExportChain</strong></p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} YAHIAOUI GLOBAL EXPORT - Tous droits réservés</p>
              <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        YAHIAOUI GLOBAL EXPORT - ExportChain
        
        ✅ DEMANDE D'ACHAT APPROUVÉE
        
        Bonjour ${data.clientName},
        
        Votre demande d'achat a été approuvée par notre équipe.
        
        DÉTAILS DE LA COMMANDE :
        - Produit : ${data.productType}
        - Quantité : ${data.quantity} kg
        - Type : ${data.tradeType === 'national' ? 'National' : 'International'}
        - Prix total : ${data.totalPrice} ${data.currency}
        
        PROCHAINES ÉTAPES :
        1. Un responsable commercial vous contactera sous 24h
        2. Vous recevrez un contrat à signer électroniquement
        3. Le paiement sera à effectuer selon les modalités convenues
        
        Nous vous remercions pour votre confiance.
        
        Cordialement,
        L'équipe ExportChain
        
        © ${new Date().getFullYear()} YAHIAOUI GLOBAL EXPORT
      `
    };

    console.log('📤 Envoi de l\'email d\'approbation d\'achat...');
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email d'approbation d'achat envoyé! ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error('❌ Erreur envoi email approbation achat:', {
      message: error.message,
      code: error.code,
      command: error.command
    });
    throw error;
  }
};

/**
 * Envoyer un email de refus de demande d'achat
 * @param {string} to - Email du client
 * @param {Object} data - Données de la demande
 */
const sendPurchaseRejectionEmail = async (to, data) => {
  console.log(`📧 Préparation de l'email de refus d'achat pour ${to}...`);
  
  try {
    const mailOptions = {
      from: `"YAHIAOUI GLOBAL EXPORT" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: '❌ Demande d\'achat - ExportChain',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
            }
            .container {
              background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%);
              padding: 2rem;
              border-radius: 10px;
            }
            .header {
              text-align: center;
              margin-bottom: 2rem;
            }
            .header h1 {
              color: #FFD700;
              margin: 0;
              font-size: 24px;
            }
            .header h2 {
              color: white;
              margin: 0;
              font-size: 18px;
            }
            .content {
              background: white;
              padding: 2rem;
              border-radius: 10px;
            }
            .comment-box {
              background: #f8f8f8;
              padding: 1rem;
              border-radius: 8px;
              margin: 1.5rem 0;
              border-left: 4px solid #ff4444;
              font-style: italic;
            }
            .footer {
              text-align: center;
              margin-top: 2rem;
              color: #666;
              font-size: 12px;
            }
            .button {
              display: inline-block;
              background: #FFD700;
              color: #000;
              text-decoration: none;
              padding: 0.8rem 1.5rem;
              border-radius: 5px;
              font-weight: bold;
              margin: 1rem 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>YAHIAOUI GLOBAL EXPORT</h1>
              <h2>ExportChain</h2>
            </div>
            <div class="content">
              <h2 style="color: #ff4444;">Demande d'achat</h2>
              <p>Bonjour <strong>${data.clientName}</strong>,</p>
              <p>Nous vous informons que votre demande d'achat pour <strong>${data.productType}</strong> n'a pas pu être acceptée par notre équipe commerciale.</p>
              
              ${data.comment ? `
                <div class="comment-box">
                  <strong>Motif indiqué :</strong><br>
                  "${data.comment}"
                </div>
              ` : ''}
              
              <p>Cette décision peut être due à :</p>
              <ul style="color: #666;">
                <li>Un stock insuffisant pour le moment</li>
                <li>Des conditions de prix non conformes à notre politique</li>
                <li>Des restrictions d'exportation temporaires</li>
              </ul>
              
              <p>Nous vous invitons à soumettre une nouvelle demande avec des conditions différentes ou à nous contacter directement pour discuter des possibilités.</p>
              
              <div style="text-align: center;">
                <a href="http://localhost:5173/dashboard/purchases" class="button">Nouvelle demande</a>
              </div>
              
              <p>Nous restons à votre disposition pour toute information complémentaire.</p>
              
              <p style="margin-top: 2rem;">Cordialement,<br><strong>L'équipe ExportChain</strong></p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} YAHIAOUI GLOBAL EXPORT - Tous droits réservés</p>
              <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        YAHIAOUI GLOBAL EXPORT - ExportChain
        
        DEMANDE D'ACHAT
        
        Bonjour ${data.clientName},
        
        Nous vous informons que votre demande d'achat pour ${data.productType} n'a pas pu être acceptée.
        
        ${data.comment ? `Motif : ${data.comment}` : ''}
        
        Vous pouvez soumettre une nouvelle demande avec des conditions différentes sur notre plateforme.
        
        Cordialement,
        L'équipe ExportChain
        
        © ${new Date().getFullYear()} YAHIAOUI GLOBAL EXPORT
      `
    };

    console.log('📤 Envoi de l\'email de refus d\'achat...');
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email de refus d'achat envoyé! ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error('❌ Erreur envoi email refus achat:', {
      message: error.message,
      code: error.code,
      command: error.command
    });
    throw error;
  }
};

// Exporter toutes les fonctions
module.exports = {
  sendPasswordResetEmail,
  sendApprovalEmail,
  sendPurchaseApprovalEmail,
  sendPurchaseRejectionEmail
};