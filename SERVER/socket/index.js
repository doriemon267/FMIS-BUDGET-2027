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
    "http://budget.fmis.local:3005",
    "https://budget.nia.gov.ph",
    "https://budget-server.nia.gov.ph",
  ].filter(Boolean);

  const io = socketIo(server, {
    cors: {
      origin: allowedSocketOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
    path: "/socket.io/",
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
