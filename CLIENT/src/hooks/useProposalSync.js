import { useEffect, useCallback, useRef } from 'react';
import io from 'socket.io-client';
import { toast } from 'react-toastify';
import { useUser } from '../context/UserContext';
import { getAuthToken } from '../config/api';

let globalSocket = null;

/**
 * Initialize global Socket.io connection
 */
export function initializeSocket() {
  if (globalSocket && globalSocket.connected) {
    return globalSocket;
  }

  const socketUrl = process.env.REACT_APP_SOCKET_URL || window.location.origin;
  const token = getAuthToken();
  
  globalSocket = io(socketUrl, {
    auth: { token },
    query: { token },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
    transports: ['websocket', 'polling']
  });

  globalSocket.on('connect', () => {
    console.log('[Socket] Connected');
  });

  globalSocket.on('disconnect', () => {
    console.log('[Socket] Disconnected');
  });

  globalSocket.on('connect_error', (error) => {
    console.error('[Socket] Connection error:', error);
  });

  return globalSocket;
}

/**
 * Custom hook for listening to proposal locking events
 */
export function useProposalLockListener(proposalId, callbacks = {}) {
  const { currentUser: user } = useUser();
  const socketRef = useRef(null);

  const {
    onLocked = null,
    onUnlocked = null,
    onUserJoined = null,
    onUserLeft = null,
    onUpdated = null,
    onConflict = null
  } = callbacks;

  useEffect(() => {
    if (!proposalId || !user) return;

    // Initialize or reuse socket
    if (!socketRef.current) {
      socketRef.current = initializeSocket();
    }

    const socket = socketRef.current;

    const userId = user.Username || user.Id || user.id || user.particularID;
    const userName = user.DisplayName || (user.FirstName && user.LastName ? `${user.FirstName} ${user.LastName}` : (user.name || user.email || "Unknown User"));
    const userRole = (Array.isArray(user.Roles) ? user.Roles[0] : user.Roles) || user.role || "User";

    // Register user as editor
    socket.emit('proposal:register-editor', {
      proposalId,
      userId
    });

    // Join proposal room
    socket.emit('proposal:join', {
      proposalId,
      userId,
      userName,
      userRole
    });

    // Listen to lock acquired event
    const handleLocked = (data) => {
      if (data.proposalId === proposalId) {
        if (onLocked) onLocked(data);
        
        // Show notification
        toast.warning(
          `${data.lockedBy.userName} (${data.lockedBy.userRole}) is now editing this proposal`,
          { autoClose: 3000 }
        );
      }
    };

    // Listen to lock released event
    const handleUnlocked = (data) => {
      if (data.proposalId === proposalId) {
        if (onUnlocked) onUnlocked(data);
        toast.info('Lock released', { autoClose: 2000 });
      }
    };

    // Listen to user joined event
    const handleUserJoined = (data) => {
      if (onUserJoined) onUserJoined(data);
      toast.info(`${data.userName} is viewing this proposal`, { autoClose: 2000 });
    };

    // Listen to user left event
    const handleUserLeft = (data) => {
      if (onUserLeft) onUserLeft(data);
      toast.info(`${data.userName} left`, { autoClose: 2000 });
    };

    // Listen to proposal updated event
    const handleUpdated = (data) => {
      if (data.proposalId === proposalId) {
        if (onUpdated) onUpdated(data);
        toast.info('Proposal updated by another user', { autoClose: 2000 });
      }
    };

    // Listen to conflict detected event
    const handleConflict = (data) => {
      if (data.proposalId === proposalId) {
        if (onConflict) onConflict(data);
        toast.error('Version conflict detected! Please refresh the proposal.', { autoClose: 5000 });
      }
    };

    socket.on('proposal:locked', handleLocked);
    socket.on('proposal:unlocked', handleUnlocked);
    socket.on('proposal:user-joined', handleUserJoined);
    socket.on('proposal:user-left', handleUserLeft);
    socket.on('proposal:updated', handleUpdated);
    socket.on('proposal:conflict-detected', handleConflict);

    // Cleanup
    return () => {
      socket.off('proposal:locked', handleLocked);
      socket.off('proposal:unlocked', handleUnlocked);
      socket.off('proposal:user-joined', handleUserJoined);
      socket.off('proposal:user-left', handleUserLeft);
      socket.off('proposal:updated', handleUpdated);
      socket.off('proposal:conflict-detected', handleConflict);

      // Leave proposal room
      socket.emit('proposal:leave', {
        proposalId,
        userId,
        userName
      });
    };
  }, [proposalId, user, onLocked, onUnlocked, onUserJoined, onUserLeft, onUpdated, onConflict]);

  /**
   * Emit lock acquired event
   */
  const notifyLockAcquired = useCallback((data) => {
    if (socketRef.current) {
      socketRef.current.emit('proposal:lock-acquired', data);
    }
  }, []);

  /**
   * Emit lock released event
   */
  const notifyLockReleased = useCallback((data) => {
    if (socketRef.current) {
      socketRef.current.emit('proposal:lock-released', data);
    }
  }, []);

  /**
   * Broadcast proposal update
   */
  const broadcastUpdate = useCallback((data) => {
    if (socketRef.current) {
      socketRef.current.emit('proposal:update-broadcast', data);
    }
  }, []);

  /**
   * Broadcast MOOE item update
   */
  const broadcastMooeItemUpdate = useCallback((data) => {
    if (socketRef.current) {
      socketRef.current.emit('mooe:item-updated', data);
    }
  }, []);

  /**
   * Broadcast Personnel item update
   */
  const broadcastPersonnelItemUpdate = useCallback((data) => {
    if (socketRef.current) {
      socketRef.current.emit('personnel:item-updated', data);
    }
  }, []);

  /**
   * Broadcast Capital Outlay item update
   */
  const broadcastCapitalOutlayItemUpdate = useCallback((data) => {
    if (socketRef.current) {
      socketRef.current.emit('capital-outlay:item-updated', data);
    }
  }, []);

  return {
    notifyLockAcquired,
    notifyLockReleased,
    broadcastUpdate,
    broadcastMooeItemUpdate,
    broadcastPersonnelItemUpdate,
    broadcastCapitalOutlayItemUpdate
  };
}
