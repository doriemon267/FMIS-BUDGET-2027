function registerPresenceHandlers(io, socket, { debugMode = false } = {}) {
  if (debugMode || process.env.ALLOW_MOCK_AUTH === "true") {
    try {
      // console.debug(`[Socket] connected: ${socket.id} user=${JSON.stringify(socket.user)} onlineCount=${global.onlineUsers?.size || 0}`);
    } catch (_) {}
  }

  const uid = socket.user && (socket.user.Id || socket.user.id || socket.user.userId);
  if (uid) {
    const normalizedUid = String(uid);
    const existing = global.onlineUsers.get(normalizedUid) || {
      count: 0,
      lastConnectedAt: null,
    };
    const updated = { count: existing.count + 1, lastConnectedAt: Date.now() };
    global.onlineUsers.set(normalizedUid, updated);
    try {
      io.emit("presence-update", { userId: normalizedUid, status: "online" });
    } catch (_) {}
  }

  socket.on("join-user-room", (userId) => {
    const authUserId = socket.user && (socket.user.Id || socket.user.id || socket.user.userId);
    const allowAdminJoin =
      socket.user?.Roles?.includes("SUPER_ADMIN") ||
      socket.user?.Roles?.includes("ADMIN");
    const targetUserId = allowAdminJoin && userId ? userId : authUserId;
    if (!targetUserId) return;
    socket.join(`user_${targetUserId}`);
  });

  socket.on("join-admin-room", () => {
    socket.join("admin_room");
    console.log("User joined admin room");
  });

  socket.on("permission-updated", (data) => {
    console.log("Permission update received:", data);
  });

  socket.on("disconnect", () => {
    if (debugMode || process.env.ALLOW_MOCK_AUTH === "true") {
      try {
        // console.debug(`[Socket] disconnected: ${socket.id} user=${JSON.stringify(socket.user)} onlineCount=${global.onlineUsers?.size || 0}`);
      } catch (_) {}
    }

    const disconnectedUid =
      socket.user && (socket.user.Id || socket.user.id || socket.user.userId);
    if (!disconnectedUid) return;

    const normalizedUid = String(disconnectedUid);
    const existing = global.onlineUsers.get(normalizedUid) || {
      count: 0,
      lastConnectedAt: null,
    };
    const current = existing.count;

    if (current <= 1) {
      global.onlineUsers.delete(normalizedUid);
      try {
        io.emit("presence-update", { userId: normalizedUid, status: "offline" });
      } catch (_) {}
      return;
    }

    global.onlineUsers.set(normalizedUid, {
      count: current - 1,
      lastConnectedAt: existing.lastConnectedAt,
    });
  });
}

module.exports = { registerPresenceHandlers };
