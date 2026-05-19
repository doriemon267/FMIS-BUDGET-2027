/**
 * Socket.io handlers for proposal updates and locking
 */

function registerProposalHandlers(io, socket) {
  /**
   * When a user acquires a lock on a proposal, notify all other users
   * Event: proposal:locked
   */
  socket.on('proposal:lock-acquired', (data) => {
    const { proposalId, userId, userName, userRole } = data;
    
    // Broadcast to all users in the proposal room EXCEPT the sender
    socket.to(`proposal:${proposalId}`).emit('proposal:locked', {
      proposalId,
      lockedBy: {
        userId,
        userName,
        userRole
      },
      timestamp: new Date()
    });

    // Log for debugging
    if (global.debugMode) {
      console.log(`[Socket] Lock acquired on proposal ${proposalId} by ${userName}`);
    }
  });

  /**
   * When a user releases a lock on a proposal
   * Event: proposal:lock-released
   */
  socket.on('proposal:lock-released', (data) => {
    const { proposalId, userId } = data;
    
    socket.to(`proposal:${proposalId}`).emit('proposal:unlocked', {
      proposalId,
      releasedBy: userId,
      timestamp: new Date()
    });

    if (global.debugMode) {
      console.log(`[Socket] Lock released on proposal ${proposalId}`);
    }
  });

  /**
   * When a user joins a proposal editing session
   */
  socket.on('proposal:join', (data) => {
    const { proposalId, userId, userName, userRole } = data;
    const room = `proposal:${proposalId}`;
    
    socket.join(room);
    
    // Notify others that a user joined
    socket.to(room).emit('proposal:user-joined', {
      userId,
      userName,
      userRole,
      timestamp: new Date()
    });

    if (global.debugMode) {
      console.log(`[Socket] User ${userName} joined proposal ${proposalId}`);
    }
  });

  /**
   * When a user leaves a proposal editing session
   */
  socket.on('proposal:leave', (data) => {
    const { proposalId, userId, userName } = data;
    const room = `proposal:${proposalId}`;
    
    socket.leave(room);
    
    // Notify others that a user left
    socket.to(room).emit('proposal:user-left', {
      userId,
      userName,
      timestamp: new Date()
    });

    if (global.debugMode) {
      console.log(`[Socket] User ${userName} left proposal ${proposalId}`);
    }
  });

  /**
   * Broadcast real-time proposal updates to all users viewing the proposal
   * Emitted after a successful save
   * Event: proposal:updated
   */
  socket.on('proposal:update-broadcast', (data) => {
    const { proposalId, updatedFields, updatedBy, updatedAt } = data;
    const room = `proposal:${proposalId}`;
    
    // Broadcast to all users in the room EXCEPT the sender
    socket.to(room).emit('proposal:updated', {
      proposalId,
      updatedFields,
      updatedBy,
      updatedAt,
      timestamp: new Date()
    });

    if (global.debugMode) {
      console.log(`[Socket] Proposal ${proposalId} updated, broadcast to room ${room}`);
    }
  });

  /**
   * Broadcast MOOE item updates
   */
  socket.on('mooe:item-updated', (data) => {
    const { proposalId, itemId, changes, updatedBy } = data;
    const room = `proposal:${proposalId}`;
    
    socket.to(room).emit('mooe:item-changed', {
      proposalId,
      itemId,
      changes,
      updatedBy,
      timestamp: new Date()
    });

    if (global.debugMode) {
      console.log(`[Socket] MOOE item ${itemId} updated in proposal ${proposalId}`);
    }
  });

  /**
   * Broadcast Personnel Services item updates
   */
  socket.on('personnel:item-updated', (data) => {
    const { proposalId, itemId, changes, updatedBy } = data;
    const room = `proposal:${proposalId}`;
    
    socket.to(room).emit('personnel:item-changed', {
      proposalId,
      itemId,
      changes,
      updatedBy,
      timestamp: new Date()
    });
  });

  /**
   * Broadcast Capital Outlay item updates
   */
  socket.on('capital-outlay:item-updated', (data) => {
    const { proposalId, itemId, changes, updatedBy } = data;
    const room = `proposal:${proposalId}`;
    
    socket.to(room).emit('capital-outlay:item-changed', {
      proposalId,
      itemId,
      changes,
      updatedBy,
      timestamp: new Date()
    });
  });

  /**
   * Broadcast version conflict detected
   */
  socket.on('proposal:version-conflict', (data) => {
    const { proposalId, userId, serverVersion, clientVersion } = data;
    const room = `proposal:${proposalId}`;
    
    socket.to(room).emit('proposal:conflict-detected', {
      proposalId,
      message: `Version conflict detected. Server version: ${serverVersion}, Client version: ${clientVersion}`,
      timestamp: new Date()
    });
  });

  /**
   * Register user's current socket with proposal editing
   * Used to get socket room for broadcasting
   */
  socket.on('proposal:register-editor', (data) => {
    const { proposalId, userId } = data;
    const room = `proposal:${proposalId}`;
    
    if (!global.proposalEditors) {
      global.proposalEditors = {};
    }
    
    if (!global.proposalEditors[proposalId]) {
      global.proposalEditors[proposalId] = [];
    }
    
    global.proposalEditors[proposalId].push({
      socketId: socket.id,
      userId,
      room
    });

    socket.join(room);
  });
}

module.exports = { registerProposalHandlers };
