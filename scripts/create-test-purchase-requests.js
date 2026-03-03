// scripts/create-test-purchase-requests.js

const mongoose = require("mongoose");
const PurchaseRequest = require("../models/PurchaseRequest");
const User = require("../models/User");
require("dotenv").config();

async function createTestRequests() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connecté à MongoDB");

    // Récupérer un client existant (remplacez par l'ID de votre client)
    const client = await User.findOne({ role: 'client' });
    
    if (!client) {
      console.log("❌ Aucun client trouvé");
      process.exit(1);
    }

    console.log(`👤 Client trouvé: ${client.email}`);

    // Créer quelques demandes de test
    const testRequests = [
      {
        clientId: client._id,
        clientEmail: client.email,
        clientName: `${client.prenom} ${client.nom}`,
        productType: 'tomates',
        quantity: 500,
        tradeType: 'national',
        proposedPrice: 2.5,
        minPrice: 1.5,
        maxPrice: 4,
        totalPrice: 1250,
        currency: 'DT',
        status: 'en_attente',
        lotNumber: 'LOT-TOM-2026-001'
      },
      {
        clientId: client._id,
        clientEmail: client.email,
        clientName: `${client.prenom} ${client.nom}`,
        productType: 'fraises',
        quantity: 200,
        tradeType: 'international',
        proposedPrice: 5.5,
        minPrice: 4,
        maxPrice: 8,
        totalPrice: 1100,
        currency: '€',
        status: 'approuve',
        lotNumber: 'LOT-FRA-2026-002'
      },
      {
        clientId: client._id,
        clientEmail: client.email,
        clientName: `${client.prenom} ${client.nom}`,
        productType: 'dattes',
        quantity: 1000,
        tradeType: 'national',
        proposedPrice: 12,
        minPrice: 8,
        maxPrice: 18,
        totalPrice: 12000,
        currency: 'DT',
        status: 'refuse',
        adminComment: 'Stock insuffisant',
        lotNumber: 'LOT-DAT-2026-003'
      }
    ];

    for (const req of testRequests) {
      const existing = await PurchaseRequest.findOne({
        clientId: req.clientId,
        productType: req.productType,
        quantity: req.quantity
      });
      
      if (!existing) {
        await PurchaseRequest.create(req);
        console.log(`✅ Demande créée: ${req.productType} - ${req.quantity}kg`);
      } else {
        console.log(`⏭️ Demande existe déjà: ${req.productType}`);
      }
    }

    console.log("✅ Demandes de test créées avec succès");
    process.exit(0);
  } catch (error) {
    console.error("❌ Erreur:", error);
    process.exit(1);
  }
}

createTestRequests();