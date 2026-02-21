const { MongoClient } = require('mongodb');

const uri = "mongodb://localhost:27017";

const client = new MongoClient(uri);

async function run() {
  try {
    console.log("🔄 Connexion à MongoDB local...");
    await client.connect();
    console.log("✅ Connecté à MongoDB local!");
    
    // Lister les bases de données
    const dbs = await client.db().admin().listDatabases();
    console.log("📊 Bases de données disponibles:");
    dbs.databases.forEach(db => console.log(`   - ${db.name}`));
    
    // Tester la création de la base Exportchain
    const db = client.db("Exportchain");
    await db.collection("test").insertOne({ test: "Connexion réussie", date: new Date() });
    console.log("✅ Collection 'test' créée dans Exportchain");
    
    // Vérifier que les données ont été insérées
    const result = await db.collection("test").findOne({ test: "Connexion réussie" });
    console.log("📝 Document inséré:", result);
    
  } catch (err) {
    console.error("❌ Erreur de connexion:", err.message);
    console.log("\n🔧 Vérifiez que MongoDB est bien lancé:");
    console.log("   - Service MongoDB doit être démarré");
    console.log("   - Port 27017 doit être accessible");
    console.log("   - Si vous utilisez Docker: docker ps");
  } finally {
    await client.close();
  }
}

run();