const socketIo = require("socket.io");
const { registerSocketAuth } = require("./auth");
const { registerPresenceHandlers } = require("./presence");
const { registerChatHandlers } = require("./chat");

function initializeSocket(server, { debugMode = false } = {}) {
  const allowedSocketOrigins = [
    process.env.CLIENT1,
    process.env.CLIENT2,
    process.env.CLIENT3,
    "http://localhost:3005",
    "http://localhost:3000",
    "http://budget.fmis.local:3005",
    "https://budget.nia.gov.ph",
    "https://budget-server.nia.gov.ph",
  ].filter(Boolean);

  const io = socketIo(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);

        const originStr = String(origin).toLowerCase();

        const allowedOrigins = [
          process.env.CLIENT1,
          process.env.CLIENT2,
          process.env.CLIENT3,
          "https://budget.nia.gov.ph",
          "https://budget-server.nia.gov.ph",
          "http://localhost:3005",
          "http://localhost:3000",
          "http://budget.fmis.local:3005",
        ].filter(Boolean).map(o => o.toLowerCase());

        const isAllowed = allowedOrigins.includes(originStr);
        const isNia = originStr.includes("nia.gov.ph");
        const isLocal = originStr.includes("localhost") || originStr.includes("127.0.0.1") || originStr.includes("fmis.local");

        if (isAllowed || isNia || isLocal) {
          return callback(null, true);
        }

        console.warn(`[Socket.IO] CORS blocked for origin: ${origin}`);
        return callback(null, false);
      },
      methods: ["GET", "POST", "OPTIONS", "PUT", "PATCH", "DELETE"],
      allowedHeaders: ["Authorization", "Content-Type", "X-Requested-With", "Accept", "Origin", "X-Workflow-Ref", "X-Dev-User-Id", "X-User-Object"],
      credentials: true,
    },
    allowEIO3: true,
    connectTimeout: 45000,
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  registerSocketAuth(io, { debugMode });

  // Presence map for online users: Map<userId, count>
  // global.onlineUsers maps userId => { count: number, lastConnectedAt: number }
  global.onlineUsers = global.onlineUsers || new Map();

  // WebSocket connection handling
  io.on("connection", (socket) => {
    registerPresenceHandlers(io, socket, { debugMode });
    registerChatHandlers(io, socket);
  });

  // Export io for use in other modules
  global.io = io;

  return io;
}

module.exports = { initializeSocket };
