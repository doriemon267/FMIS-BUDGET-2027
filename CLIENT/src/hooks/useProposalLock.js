import { useEffect, useCallback, useRef, useState } from 'react';
import { useUser } from '../context/UserContext';
import api from '../config/api';
import { toast } from 'react-toastify';

/**
 * Custom hook for managing proposal locks
 * Handles acquiring, renewing, and releasing locks on proposals
 */
export function useProposalLock(proposalId, options = {}) {
  const { currentUser: user } = useUser();
  const [lockStatus, setLockStatus] = useState({
    isLocked: false,
    lockedBy: null,
    lockExpiry: null
  });
  const [error, setError] = useState(null);
  const lockRenewalIntervalRef = useRef(null);
  const hasLockRef = useRef(false);

  const {
    autoRenew = true,
    renewInterval = 600000, // Renew every 10 minutes (lock expires after 15)
    onLockConflict = null,
    showNotifications = true
  } = options;

  /**
   * Acquire a lock on the proposal
   */
  const acquireLock = useCallback(async () => {
    if (!proposalId || !user) return;

    try {
      const userId = user.Username || user.Id || user.id || user.particularID;
      const userName = user.DisplayName || (user.FirstName && user.LastName ? `${user.FirstName} ${user.LastName}` : (user.name || user.email || "Unknown User"));
      const userRole = (Array.isArray(user.Roles) ? user.Roles[0] : user.Roles) || user.role || "User";
      const userEmail = user.Email || user.email || "";

      const response = await api.post(`/proposals/${proposalId}/lock`, {
        userId,
        userName,
        userRole,
        userEmail
      });

      if (response.data.success) {
        setLockStatus({
          isLocked: true,
          lockedBy: {
            userId,
            userName,
            userRole
          },
          lockExpiry: response.data.lockExpiry
        });
        hasLockRef.current = true;
        setError(null);
        return true;
      } else {
        // Lock already held by another user
        setLockStatus({
          isLocked: true,
          lockedBy: response.data.lockedBy,
          lockExpiry: response.data.lockedAt
        });
        
        if (onLockConflict) {
          onLockConflict(response.data);
        }

        if (showNotifications) {
          toast.warning(
            `Cannot edit: Proposal is being edited by ${response.data.lockedBy?.userName} (${response.data.lockedBy?.userRole})`,
            { autoClose: 5000 }
          );
        }

        setError(response.data.error);
        return false;
      }
    } catch (err) {
      console.error('Error acquiring lock:', err);
      const errorMsg = err.response?.data?.error || 'Failed to acquire lock';
      setError(errorMsg);
      if (showNotifications) {
        toast.error(errorMsg);
      }
      return false;
    }
  }, [proposalId, user, onLockConflict, showNotifications]);

  /**
   * Release the lock on the proposal
   */
  const releaseLock = useCallback(async () => {
    if (!proposalId || !user || !hasLockRef.current) return;

    try {
      const userId = user.Username || user.Id || user.id || user.particularID;
      const response = await api.delete(`/proposals/${proposalId}/lock`, {
        data: {
          userId
        }
      });

      if (response.data.success) {
        setLockStatus({
          isLocked: false,
          lockedBy: null,
          lockExpiry: null
        });
        hasLockRef.current = false;
        setError(null);

        if (showNotifications) {
          toast.success('Lock released');
        }

        return true;
      } else {
        setError(response.data.error);
        return false;
      }
    } catch (err) {
      console.error('Error releasing lock:', err);
      const errorMsg = err.response?.data?.error || 'Failed to release lock';
      setError(errorMsg);
      if (showNotifications) {
        toast.error(errorMsg);
      }
      return false;
    }
  }, [proposalId, user, showNotifications]);

  /**
   * Renew the lock expiry time
   */
  const renewLock = useCallback(async () => {
    if (!proposalId || !user || !hasLockRef.current) return;

    try {
      const userId = user.Username || user.Id || user.id || user.particularID;
      const response = await api.post(`/proposals/${proposalId}/lock/renew`, {
        userId
      });

      if (response.data.success) {
        setLockStatus(prev => ({
          ...prev,
          lockExpiry: response.data.lockExpiry
        }));
        setError(null);
        return true;
      } else {
        setError(response.data.error);
        return false;
      }
    } catch (err) {
      console.error('Error renewing lock:', err);
      setError(err.response?.data?.error || 'Failed to renew lock');
      return false;
    }
  }, [proposalId, user]);

  /**
   * Get current lock status
   */
  const checkLockStatus = useCallback(async () => {
    if (!proposalId) return;

    try {
      const response = await api.get(`/proposals/${proposalId}/lock/status`);
      setLockStatus({
        isLocked: response.data.isLocked,
        lockedBy: response.data.lockedBy,
        lockExpiry: response.data.lockExpiry
      });
      return response.data;
    } catch (err) {
      console.error('Error checking lock status:', err);
      return null;
    }
  }, [proposalId]);

  /**
   * Setup auto-renewal of lock
   */
  useEffect(() => {
    if (!autoRenew || !hasLockRef.current) return;

    lockRenewalIntervalRef.current = setInterval(() => {
      renewLock();
    }, renewInterval);

    return () => {
      if (lockRenewalIntervalRef.current) {
        clearInterval(lockRenewalIntervalRef.current);
      }
    };
  }, [autoRenew, renewLock, renewInterval]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      // Try to release lock on unmount if we have it
      if (hasLockRef.current) {
        releaseLock().catch(err => console.error('Error releasing lock on unmount:', err));
      }

      // Clear renewal interval
      if (lockRenewalIntervalRef.current) {
        clearInterval(lockRenewalIntervalRef.current);
      }
    };
  }, [releaseLock]);

  return {
    lockStatus,
    error,
    hasLock: hasLockRef.current,
    acquireLock,
    releaseLock,
    renewLock,
    checkLockStatus
  };
}
