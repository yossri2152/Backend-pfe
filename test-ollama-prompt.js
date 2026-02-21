const axios = require('axios');

async function testOllama() {
  const testLot = {
    temperature: 5,
    humidity: 70,
    rain: 2,
    pressure: 1010,
    duration: 5,
    shock: 'non',
    sunExposure: 15
  };

  const testAnalysis = {
    issues: ["🌡️ Froid physiologique (<10°C)", "💧 Humidité trop basse"],
    decision: "Lot Endommagé",
    riskLevel: "Moyen"
  };

  const prompt = `[INST] Tu es un expert en contrôle qualité pour l'exportation de tomates.

DONNÉES DU LOT :
- Température: 5°C
- Humidité: 70%
- Pluie: 2 mm
- Pression: 1010 hPa
- Durée transport: 5 jours
- Choc transport: non
- Exposition soleil: 15 min

ANALYSE PRÉLIMINAIRE :
- Problèmes détectés: 🌡️ Froid physiologique (<10°C), 💧 Humidité trop basse
- Décision: Lot Endommagé

INSTRUCTIONS :
Génère un rapport en français avec la structure JSON suivante. Réponds UNIQUEMENT avec le JSON, sans texte avant ou après.

{
  "resume": "Résumé court",
  "niveau_risque": "Moyen",
  "details": {
    "temperature": "Analyse température",
    "humidite": "Analyse humidité",
    "pression": "Analyse pression",
    "pluie": "Analyse pluie",
    "duree": "Analyse durée",
    "choc": "Analyse choc",
    "soleil": "Analyse soleil"
  },
  "recommandations": ["Reco1", "Reco2"],
  "conclusion": "Lot Endommagé"
}
[/INST]`;

  try {
    console.log('📤 Envoi du prompt à Ollama...');
    const response = await axios.post('http://localhost:11434/api/generate', {
      model: 'mistral',
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.2,
        num_predict: 800
      }
    });

    console.log('📥 Réponse brute:');
    console.log(response.data.response);
    
    // Essayer de parser
    try {
      const jsonMatch = response.data.response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('\n✅ JSON parsé:');
        console.log(JSON.stringify(parsed, null, 2));
      } else {
        console.log('\n❌ Aucun JSON trouvé dans la réponse');
      }
    } catch (e) {
      console.log('\n❌ Erreur parsing JSON:', e.message);
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

testOllama();