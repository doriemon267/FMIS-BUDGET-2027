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
    // Helper: some user fields (e.g. Username, Roles) are stored as arrays
    const toStr = (val) => Array.isArray(val) ? (val[0] || '') : (val || '');

    const userId   = toStr(user.Username) || toStr(user.Id) || toStr(user.id) || toStr(user.particularID);
    const userName = toStr(user.DisplayName) ||
      ((user.FirstName && user.LastName)
        ? `${toStr(user.FirstName)} ${toStr(user.LastName)}`
        : (toStr(user.name) || toStr(user.email) || 'Unknown User'));
    const userRole  = toStr(Array.isArray(user.Roles) ? user.Roles[0] : user.Roles) || toStr(user.role) || 'User';
    const userEmail = toStr(user.Email) || toStr(user.email) || '';

      const response = await api.post(`/proposals/${proposalId}/lock`, {
        userId,
        userName,
        userRole,
        userEmail
      }, { hideErrorToast: true });

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
      }
    } catch (err) {
      // Handle 409 Conflict (Lock already held by another user)
      if (err.response && err.response.status === 409 && err.response.data) {
        const data = err.response.data;
        setLockStatus({
          isLocked: true,
          lockedBy: data.lockedBy,
          lockExpiry: data.lockedAt
        });
        if (onLockConflict) {
          onLockConflict(data);
        }
        if (showNotifications) {
          let warningMsg = data.error || 'Cannot edit: Proposal is being edited by another user';
          if (warningMsg.includes('undefined')) {
            warningMsg = 'Cannot edit: Proposal is currently locked and being edited by another user.';
          }
          toast.warning(warningMsg, { autoClose: 5000 });
        }
        setError(data.error);
        return false;
      }
      // Handle 404 silently - proposal not found (stale session ref), no action needed
      if (err.response && err.response.status === 404) {
        setError(null);
        return false;
      }
      // All other errors: set error state but do NOT show toast (avoid duplicate popups)
      const errorMsg = err.response?.data?.error || 'Failed to acquire lock';
      setError(errorMsg);
      return false;
    }
  }, [proposalId, user, onLockConflict, showNotifications]);

  /**
   * Release the lock on the proposal
   */
  const releaseLock = useCallback(async () => {
    if (!proposalId || !user || !hasLockRef.current) return;

    try {
      const toStr = (val) => Array.isArray(val) ? (val[0] || '') : (val || '');
      const userId = toStr(user.Username) || toStr(user.Id) || toStr(user.id) || toStr(user.particularID);
      const response = await api.delete(`/proposals/${proposalId}/lock`, {
        data: { userId },
        hideErrorToast: true
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
      // Silent release failure — user navigated away, lock will expire automatically
      return false;
    }
  }, [proposalId, user, showNotifications]);

  /**
   * Renew the lock expiry time
   */
  const renewLock = useCallback(async () => {
    if (!proposalId || !user || !hasLockRef.current) return;

    try {
      const toStr = (val) => Array.isArray(val) ? (val[0] || '') : (val || '');
      const userId = toStr(user.Username) || toStr(user.Id) || toStr(user.id) || toStr(user.particularID);
      const response = await api.post(`/proposals/${proposalId}/lock/renew`, {
        userId
      }, { hideErrorToast: true });

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
      // Silent renew failure — lock will expire, user will be notified next interaction
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
        releaseLock().catch(() => {}); // Silent — normal on page navigation
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
