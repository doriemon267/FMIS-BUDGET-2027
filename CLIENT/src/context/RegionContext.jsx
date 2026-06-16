import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
import api from '../config/api';
import { toast } from 'react-toastify';
import { useUser } from './UserContext';

// Create the context
const RegionContext = createContext();

// Create a provider component
export const RegionProvider = ({ children }) => {
  const { currentUser } = useUser(); // Get user directly from UserContext
  const [activeRegion, setActiveRegion] = useState(null);
  const [availableRegions, setAvailableRegions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Automatically assign user to their regions when user data changes
  useEffect(() => {
    const assignUserRegions = async () => {
      if (!currentUser) {
        // No user logged in, clear everything
        setActiveRegion(null);
        setAvailableRegions([]);
        localStorage.removeItem('activeRegion');
        return;
      }

      setLoading(true);
      setError(null);
      
      try {
        const normRole = (r) => String(r || '').toUpperCase().replace(/\s+/g, '_').trim();
        const isSuperAdmin = currentUser.Roles?.some((r) => {
          const n = normRole(r);
          return n === 'SUPERADMIN' || n === 'SUPER_ADMIN';
        });
        const isBudgetManager = (currentUser.Roles || []).some((r) => {
          const n = normRole(r);
          return n === 'BUDGET_MANAGER' || n === 'OVERALL_BUDGET_APPROVER' || n === 'BUDGET_OFFICER';
        });
        const userScope = currentUser.hierarchicalAccess?.scope || currentUser.hierarchicalAccess?.assignmentLevel || 'REGION';

        // Check if user already has regions from UserContext
        if (currentUser.regions && currentUser.regions.length > 0) {
          const userRegions = currentUser.regions;
          setAvailableRegions(userRegions);
          
          // Check if there's a previously selected region in localStorage
          const savedRegion = localStorage.getItem('activeRegion');
          let targetRegion = null;
          
          if (savedRegion) {
            try {
              const parsedRegion = JSON.parse(savedRegion);
              // Verify the saved region is still available to the user
              const isStillAvailable = userRegions.some(r => 
                r._id === parsedRegion._id || 
                r.name === parsedRegion.name ||
                r.Region === parsedRegion.Region
              );
              
              if (isStillAvailable) {
                targetRegion = userRegions.find(r => 
                  r._id === parsedRegion._id || 
                  r.name === parsedRegion.name ||
                  r.Region === parsedRegion.Region
                );
              }
            } catch (error) {}
          }
          
          // If high-privilege user and no saved region, default to "All Regions" (null)
          if ((isSuperAdmin || isBudgetManager || userScope === 'FULL') && !targetRegion) {
            setActiveRegion(null);
            localStorage.removeItem('activeRegion');
          } else if (!targetRegion) {
            // Normal user must have a region, default to first available
            targetRegion = userRegions[0];
            setActiveRegion(targetRegion);
            localStorage.setItem('activeRegion', JSON.stringify(targetRegion));
          } else {
            setActiveRegion(targetRegion);
            localStorage.setItem('activeRegion', JSON.stringify(targetRegion));
          }
          
          return;
        }

        // Only super-admins, budget managers/overall approvers, or FULL-scope users should get the full regions list
        if (
          isSuperAdmin ||
          isBudgetManager ||
          userScope === 'FULL'
        ) {
          try {
            const res = await api.get('/api/regions');
            const rawRegions = Array.isArray(res.data) ? res.data : (res.data?.regions || []);
            const regions = rawRegions.map((r) => ({
              id: r._id || r.id,
              _id: r._id || r.id,
              name: r.regionName || r.Region || r.name,
              regionName: r.regionName || r.Region || r.name,
              Region: r.regionName || r.Region || r.name,
            }));
            setAvailableRegions(regions);

            let regionSet = false;
            const savedRegion = localStorage.getItem('activeRegion');
            if (savedRegion) {
              try {
                const parsed = JSON.parse(savedRegion);
                const verified = regions.find((r) => r._id === parsed._id || r.name === parsed.name || r.Region === parsed.Region || r.regionName === parsed.regionName);
                if (verified) {
                  setActiveRegion(verified);
                  localStorage.setItem('activeRegion', JSON.stringify(verified));
                  regionSet = true;
                }
              } catch (e) {}
            }
            // Super Admin or Budget Manager (including Officer): if no saved region (or invalid), 
            // set activeRegion to null so they see "All Regions" by default
            if ((isSuperAdmin || isBudgetManager) && !regionSet && regions.length > 0) {
              setActiveRegion(null);
              localStorage.removeItem('activeRegion');
            }
            setLoading(false);
            return;
          } catch (err) {
            console.error('Failed to fetch regions for BRD or FULL access', err);
          }
        }
        
        // Set a timeout to surface lack of assigned regions if user isn't BRD/FULL
        setTimeout(() => {
          if (!currentUser.regions || currentUser.regions.length === 0) {
            setError("No region assignments found. Please contact your administrator.");
            setLoading(false);
          }
        }, 3000); // 3 second timeout
        
      } finally {
        setLoading(false);
      }
    };
    
    assignUserRegions();
  }, [currentUser]); // Re-run when currentUser changes (including when regions are added)

  // Function to switch between assigned regions (if user has multiple)
  const changeActiveRegion = useCallback((region) => {
    if (!region) {
      // Prevent clearing region for normal users but allow FULL-scope, Budget Manager, or Super Admin
      const userScope = currentUser?.hierarchicalAccess?.scope || currentUser?.hierarchicalAccess?.assignmentLevel;
      const isBM = (currentUser?.Roles || []).some((r) => { const n = String(r).toUpperCase().replace(/\s+/g, '_'); return n === 'BUDGET_MANAGER' || n === 'OVERALL_BUDGET_APPROVER' || n === 'BUDGET_OFFICER'; });
      const isSuperAdmin = (currentUser?.Roles || []).some(r => String(r).toUpperCase().replace(/\s/g, '') === 'SUPERADMIN' || String(r).toUpperCase() === 'SUPER ADMIN');
      if (userScope === 'FULL' || isBM || isSuperAdmin) {
        setActiveRegion(null);
        localStorage.removeItem('activeRegion');
        toast.info('Active region cleared');
        return;
      }
      toast.warning('You must have an active region. Cannot clear region selection.');
      return;
    }
    
    // Verify the user has access to this region
    const hasAccess = availableRegions.some(r => 
      r._id === region._id || 
      r.name === region.name ||
      r.Region === region.Region
    );
    
    if (!hasAccess) {
      console.error('❌ User does not have access to region:', region);
      toast.error('You do not have access to this region');
      return;
    }
    
    // Make sure we have a valid region object
    if (!region.name && !region.regionName && !region.Region) {
      console.error('Invalid region object:', region);
      toast.error('Invalid region selected');
      return;
    }
    
    setActiveRegion(region);
    localStorage.setItem('activeRegion', JSON.stringify(region));
    const regionName = region.name || region.regionName || region.Region;
    toast.success(`Switched to ${regionName} region`);
  }, [currentUser, availableRegions]);

  // Clear the active region explicitly
  const clearActiveRegion = useCallback(() => {
    const userScope = currentUser?.hierarchicalAccess?.scope || currentUser?.hierarchicalAccess?.assignmentLevel;
    const isBM = (currentUser?.Roles || []).some((r) => { 
      const n = String(r).toUpperCase().replace(/\s+/g, '_'); 
      return n === 'BUDGET_MANAGER' || n === 'OVERALL_BUDGET_APPROVER' || n === 'BUDGET_OFFICER'; 
    });
    const isSuperAdmin = (currentUser?.Roles || []).some(r => String(r).toUpperCase().replace(/\s/g, '') === 'SUPERADMIN' || String(r).toUpperCase() === 'SUPER ADMIN');
    if (userScope === 'FULL' || isBM || isSuperAdmin) {
      setActiveRegion(null);
      localStorage.removeItem('activeRegion');
      toast.info('Active region cleared');
      return;
    }
    toast.warning('You cannot clear the region for your access level.');
  }, [currentUser]);

  // Function to get a region by its name or ID
  const getRegionByNameOrId = useCallback((identifier) => {
    return availableRegions.find(region => 
      region.name === identifier || 
      region.regionName === identifier || 
      region.Region === identifier ||
      region._id === identifier ||
      region.id === identifier
    );
  }, [availableRegions]);

  // Function to check if user has access to a specific region
  const hasRegionAccess = useCallback((regionId) => {
    if (!availableRegions || availableRegions.length === 0) return false; // No access if no assignments
    return availableRegions.some(region => 
      region._id === regionId || 
      region.id === regionId ||
      region.name === regionId ||
      region.Region === regionId
    );
  }, [availableRegions]);

  // Function to check if user has multiple regions (for UI display)
  const hasMultipleRegions = useCallback(() => {
    return availableRegions && availableRegions.length > 1;
  }, [availableRegions]);

  const value = useMemo(() => ({
    activeRegion,
    availableRegions,
    loading,
    error,
    changeActiveRegion,
    clearActiveRegion,
    getRegionByNameOrId,
    hasRegionAccess,
    hasMultipleRegions,
    
    // Legacy compatibility
    selectedRegion: activeRegion,
    setSelectedRegion: changeActiveRegion,
    regions: availableRegions
  }), [
    activeRegion,
    availableRegions,
    loading,
    error,
    changeActiveRegion,
    clearActiveRegion,
    getRegionByNameOrId,
    hasRegionAccess,
    hasMultipleRegions
  ]);

  return (
    <RegionContext.Provider value={value}>
      {children}
    </RegionContext.Provider>
  );
};

// Custom hook to use the RegionContext
export const useRegion = () => {
  const context = useContext(RegionContext);
  if (context === undefined) {
    throw new Error('useRegion must be used within a RegionProvider');
  }
  return context;
};

export default RegionProvider;
