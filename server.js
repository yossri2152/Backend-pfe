require("dotenv").config();
const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const { Server } = require("socket.io");
const path = require("path");
const analysisRoutes = require("./routes/analysis.routes");
const purchaseRoutes = require("./routes/purchase.routes"); 
// Import des routes
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const csvRoutes = require("./routes/csvRoutes");

const app = express();
const server = http.createServer(app);

// ==================== CONFIGURATION CORS ====================
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174"
];

const corsOptions = {
  origin: function (origin, callback) {
    // Permettre les requêtes sans origin (comme les apps mobiles)
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('❌ Origine non autorisée:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 204,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
};

app.use(cors(corsOptions));

// Gérer les preflight requests OPTIONS
app.options('*', cors(corsOptions));

// ==================== MIDDLEWARES ====================
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Middleware de logging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} - ${req.ip}`);
  next();
});

// ==================== CONFIGURATION SOCKET.IO ====================
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"]
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling']
});

// Middleware pour injecter io dans les requêtes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ==================== CONNEXION MONGODB ====================
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log("✅ MongoDB local connecté - Base:", mongoose.connection.name);
    console.log("📦 Hôte:", mongoose.connection.host);
    console.log("🔌 Port:", mongoose.connection.port);
    
    // Créer les index si nécessaire
    await createIndexes();
  } catch (error) {
    console.error("❌ Erreur de connexion MongoDB:", error.message);
    console.log("🔄 Tentative de reconnexion dans 5 secondes...");
    setTimeout(connectDB, 5000);
  }
};

// Création des index pour optimiser les performances
const createIndexes = async () => {
  try {
    const db = mongoose.connection.db;
    
    // Vérifier si la collection users existe et créer des index
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    if (collectionNames.includes('users')) {
      const users = db.collection('users');
      await users.createIndex({ email: 1 }, { unique: true });
      await users.createIndex({ role: 1 });
      await users.createIndex({ isApproved: 1 });
      console.log("✅ Index utilisateurs créés");
    }
    
    if (collectionNames.includes('csvfiles')) {
      const csvfiles = db.collection('csvfiles');
      await csvfiles.createIndex({ createdBy: 1 });
      await csvfiles.createIndex({ createdAt: -1 });
      console.log("✅ Index CSV créés");
    }
  } catch (error) {
    console.error("❌ Erreur création index:", error.message);
  }
};

connectDB();

// ==================== GESTION WEBSOCKET ====================
// Map pour suivre les utilisateurs connectés
const connectedUsers = new Map();

io.on('connection', (socket) => {
  const clientId = socket.id;
  console.log(`🟢 Nouveau client connecté: ${clientId}`);
  
  // Authentification via token (optionnel)
  const token = socket.handshake.auth.token;
  if (token) {
    // Vérifier le token ici si nécessaire
    console.log(`🔑 Token présent pour ${clientId}`);
  }

  // Rejoindre des rooms basées sur le rôle
  socket.on('join', (data) => {
    try {
      const { userId, role, email } = data;
      
      if (!userId || !role) {
        console.log(`⚠️ Données de join incomplètes pour ${clientId}`);
        return;
      }
      
      // Stocker les informations de l'utilisateur
      connectedUsers.set(clientId, { userId, role, email, connectedAt: new Date() });
      
      // Quitter toutes les rooms existantes
      const rooms = Array.from(socket.rooms);
      rooms.forEach(room => {
        if (room !== socket.id) {
          socket.leave(room);
        }
      });
      
      // Rejoindre une room personnelle
      socket.join(`user_${userId}`);
      console.log(`👤 Utilisateur ${userId} (${role}) rejoint sa room personnelle`);
      
      // Rejoindre une room basée sur le rôle
      if (role === 'admin') {
        socket.join('admins');
        console.log(`👑 Admin ${email || userId} rejoint la room admins`);
      }
      
      // Rejoindre la room de tous les utilisateurs
      socket.join('all_users');
      
      // Envoyer la confirmation au client
      socket.emit('joined', {
        success: true,
        message: 'Connecté aux rooms',
        userId,
        role,
        rooms: ['all_users', `user_${userId}`, role === 'admin' ? 'admins' : null].filter(Boolean)
      });
      
      // Broadcast aux admins qu'un nouvel utilisateur s'est connecté
      if (role !== 'admin') {
        io.to('admins').emit('user:connected', {
          userId,
          role,
          email,
          timestamp: new Date()
        });
      }
      
      // Afficher le nombre total d'utilisateurs connectés
      console.log(`📊 Utilisateurs connectés: ${connectedUsers.size}`);
      
    } catch (error) {
      console.error(`❌ Erreur dans join pour ${clientId}:`, error);
      socket.emit('error', { message: 'Erreur lors de la connexion aux rooms' });
    }
  });

  // Écouter les événements personnalisés
  socket.on('file:viewing', (data) => {
    // Notifier les autres utilisateurs qu'un fichier est consulté
    socket.to('all_users').emit('file:viewed', {
      ...data,
      viewerId: connectedUsers.get(clientId)?.userId,
      timestamp: new Date()
    });
  });

  // Gérer la déconnexion
  socket.on('disconnect', (reason) => {
    const userInfo = connectedUsers.get(clientId);
    const userIdentifier = userInfo ? `${userInfo.email || userInfo.userId} (${userInfo.role})` : 'inconnu';
    
    console.log(`🔴 Client déconnecté: ${clientId} - ${userIdentifier} - Raison: ${reason}`);
    
    // Notifier les admins de la déconnexion
    if (userInfo && userInfo.role !== 'admin') {
      io.to('admins').emit('user:disconnected', {
        userId: userInfo.userId,
        role: userInfo.role,
        email: userInfo.email,
        timestamp: new Date()
      });
    }
    
    // Supprimer des utilisateurs connectés
    connectedUsers.delete(clientId);
    console.log(`📊 Utilisateurs connectés: ${connectedUsers.size}`);
  });

  // Gérer les erreurs
  socket.on('error', (error) => {
    console.error(`❌ Erreur WebSocket pour ${clientId}:`, error);
  });

  // Heartbeat pour garder la connexion active
  socket.on('ping', () => {
    socket.emit('pong');
  });
});

// ==================== ROUTES API ====================
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/csv", csvRoutes);
app.use("/api/lots", require("./routes/lot.routes"));
app.use("/api/analysis", analysisRoutes);
app.use("/api/purchases", purchaseRoutes); 
// Route pour les statistiques en temps réel (admin)
app.get("/api/stats/online", (req, res) => {
  try {
    const stats = {
      totalConnected: connectedUsers.size,
      admins: Array.from(connectedUsers.values()).filter(u => u.role === 'admin').length,
      responsables: Array.from(connectedUsers.values()).filter(u => u.role === 'responsable').length,
      clients: Array.from(connectedUsers.values()).filter(u => u.role === 'client').length,
      users: Array.from(connectedUsers.entries()).map(([socketId, user]) => ({
        socketId,
        ...user,
        connectedAt: user.connectedAt.toISOString()
      }))
    };
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Route de test
app.get("/", (req, res) => {
  res.json({ 
    success: true,
    message: "API ExportChain - Système de fichiers CSV",
    version: "1.0.0",
    status: "online",
    db: mongoose.connection.readyState === 1 ? "connecté" : "déconnecté",
    websocket: "activé",
    timestamp: new Date().toISOString(),
    stats: {
      usersConnected: connectedUsers.size
    }
  });
});

// ==================== GESTION DES ERREURS ====================

// Middleware pour les routes non trouvées (404)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route non trouvée",
    path: req.path,
    method: req.method
  });
});

// Gestionnaire d'erreurs global
app.use((err, req, res, next) => {
  console.error('❌ Erreur serveur:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Gestion des erreurs spécifiques
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: "Erreur de validation",
      errors: Object.values(err.errors).map(e => e.message)
    });
  }

  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "Conflit de données - élément déjà existant"
    });
  }

  if (err.message.includes('CORS')) {
    return res.status(403).json({
      success: false,
      message: "Origine non autorisée"
    });
  }

  res.status(500).json({
    success: false,
    message: "Erreur interne du serveur",
    ...(process.env.NODE_ENV === 'development' && { detail: err.message })
  });
});

// ==================== DÉMARRAGE DU SERVEUR ====================
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Serveur démarré sur http://localhost:${PORT}`);
  console.log(`📡 Serveur WebSocket actif sur ws://localhost:${PORT}`);
  console.log(`🌍 Environnement: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⏰ ${new Date().toLocaleString()}\n`);
});

// ==================== GESTION DE L'ARRÊT PROPRE ====================
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} reçu - Arrêt gracieux du serveur...`);

  // Fermer toutes les connexions WebSocket
  io.close(() => {
    console.log("✅ Serveur WebSocket arrêté");
  });

  // Fermer la connexion MongoDB
  try {
    await mongoose.connection.close();
    console.log("✅ Déconnexion MongoDB réussie");
  } catch (err) {
    console.error("❌ Erreur lors de la déconnexion MongoDB:", err.message);
  }

  // Fermer le serveur HTTP
  server.close(() => {
    console.log("✅ Serveur HTTP arrêté");
    process.exit(0);
  });

  // Forcer l'arrêt après 10 secondes si nécessaire
  setTimeout(() => {
    console.error("❌ Arrêt forcé après timeout");
    process.exit(1);
  }, 10000);
};

// Gestion des signaux d'arrêt
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

// Gestion des exceptions non capturées
process.on("uncaughtException", (err) => {
  console.error("❌ Exception non capturée:", err);
  gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Rejet non géré:", reason);
});

// ==================== EXPORTS POUR LES TESTS ====================
module.exports = { app, server, io };