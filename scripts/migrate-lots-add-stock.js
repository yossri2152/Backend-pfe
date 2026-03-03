// scripts/migrate-lots-add-stock.js

const mongoose = require("mongoose");
const Lot = require("../models/Lot");
require("dotenv").config();

async function migrateLots() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connecté à MongoDB");
    
    // Ajouter les champs de stock à tous les lots
    const lots = await Lot.find({});
    
    let updated = 0;
    for (const lot of lots) {
      const weight = lot.weight || 0;
      
      // Mettre à jour seulement si les champs n'existent pas
      if (lot.availableWeight === undefined) {
        lot.availableWeight = weight;
        lot.originalWeight = weight;
        lot.soldWeight = 0;
        await lot.save();
        updated++;
        console.log(`📦 Lot ${lot.lotId}: ${weight} kg disponibles`);
      }
    }
    
    console.log(`✅ ${updated} lots mis à jour sur ${lots.length}`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Erreur migration:", error);
    process.exit(1);
  }
}

migrateLots();