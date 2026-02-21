require('dotenv').config();
const nodemailer = require('nodemailer');

async function testGmail() {
  console.log('📧 Test de configuration Gmail...');
  console.log('Email:', process.env.EMAIL_USER);
  console.log('Mot de passe:', process.env.EMAIL_PASS ? '✅ Présent' : '❌ Manquant');

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS.replace(/\s/g, '') // Enlève les espaces si présents
    }
  });

  try {
    const info = await transporter.sendMail({
      from: `"ExportChain" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER, // Envoi à vous-même
      subject: '✅ Test réussi - ExportChain',
      html: `
        <h1>Configuration email réussie !</h1>
        <p>Votre mot de passe d'application Gmail fonctionne parfaitement.</p>
        <p>Code test : <strong>${Math.floor(100000 + Math.random() * 900000)}</strong></p>
        <p>Vous pouvez maintenant utiliser la fonction "Mot de passe oublié".</p>
      `
    });

    console.log('✅ Email envoyé avec succès!');
    console.log('Message ID:', info.messageId);
    console.log('📬 Vérifiez votre boîte email !');
  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

testGmail();