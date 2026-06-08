const socketIo = require("socket.io");
const { registerSocketAuth } = require("./auth");
const { registerPresenceHandlers } = require("./presence");
const { registerChatHandlers } = require("./chat");

function initializeSocket(server, { debugMode = false } = {}) {
  // Nilinis na ang array para sa specific domain mo at local testing
  const allowedSocketOrigins = [
    "https://budget.nia.gov.ph",
    "http://localhost:3000",
    "http://localhost:3005"
  ];

  const io = socketIo(server, {
    cors: {
      origin: allowedSocketOrigins, // Ginagamit na ang array dito imbes na 'true'
      methods: ["GET", "POST", "OPTIONS", "PUT", "PATCH", "DELETE"],
      allowedHeaders: [
        "Authorization", 
        "Content-Type", 
        "X-Requested-With", 
        "Accept", 
        "Origin", 
        "X-Workflow-Ref", 
        "X-Dev-User-Id", 
        "X-User-Object"
      ],
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