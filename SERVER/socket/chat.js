const Message = require("../models/Message");

function registerChatHandlers(io, socket) {
  socket.on("chat-send", async (data) => {
    try {
      const from = socket.user && (socket.user.Id || socket.user.id || socket.user.userId);
      const to = data.to;
      const text = data.text;
      const metadata = data.metadata || {};
      if (!from || !to || !text) return;

      const saved = await Message.create({ from, to, text, metadata });

      try {
        const HierarchicalUserAssignment = require("../models/HierarchicalUserAssignment");
        const User = require("../models/User");
        let fromName = null;
        const assign = await HierarchicalUserAssignment.findOne({ userId: String(from) }).lean();
        if (assign?.userName) fromName = assign.userName;
        if (!fromName) {
          const u = await User.findOne({ userId: String(from) }).lean();
          fromName = u?.name || null;
        }
        if (fromName) {
          saved.metadata = saved.metadata || {};
          saved.metadata.fromName = fromName;
        }
      } catch (_) {
        // ignore enrich errors
      }

      io.to(`user_${to}`).emit("chat-message", saved);
      io.to(`user_${from}`).emit("chat-message", saved);
    } catch (e) {
      console.error("Error handling chat-send socket event:", e.stack || e.message);
    }
  });

  socket.on("typing-start", (data) => {
    try {
      const from = socket.user && (socket.user.Id || socket.user.id || socket.user.userId);
      const to = data?.to;
      if (!from || !to) return;
      io.to(`user_${to}`).emit("typing-start", { from, to });
    } catch (e) {
      console.error("typing-start handler error", e.message);
    }
  });

  socket.on("typing-stop", (data) => {
    try {
      const from = socket.user && (socket.user.Id || socket.user.id || socket.user.userId);
      const to = data?.to;
      if (!from || !to) return;
      io.to(`user_${to}`).emit("typing-stop", { from, to });
    } catch (e) {
      console.error("typing-stop handler error", e.message);
    }
  });
}

module.exports = { registerChatHandlers };
