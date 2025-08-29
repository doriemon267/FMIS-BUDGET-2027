import React, { createContext, useState, useContext, useEffect } from 'react';
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
        // If user already has regions from UserContext, use those immediately
        if (currentUser.regions && currentUser.regions.length > 0) {
          const userRegions = currentUser.regions;
          setAvailableRegions(userRegions);
          
          // AUTOMATICALLY set the user to their first assigned region
          // No manual selection needed - user can only access their assigned regions
          setActiveRegion(userRegions[0]);
          localStorage.setItem('activeRegion', JSON.stringify(userRegions[0]));
          
          const regionName = userRegions[0].name || userRegions[0].Region;
          
          // Only show toast if this is a new assignment
          const savedRegion = localStorage.getItem('activeRegion');
          if (!savedRegion || JSON.parse(savedRegion).name !== regionName) {
            toast.success(`Automatically assigned to ${regionName} region`);
          }
          
        } else {
          // Try to fetch user regions from server
          const profileRes = await api.get("/api/user-profile");
          
          if (profileRes.data && profileRes.data.regions && profileRes.data.regions.length > 0) {
            const userRegions = profileRes.data.regions;
            setAvailableRegions(userRegions);
            
            // AUTOMATICALLY assign to first region - no manual selection
            setActiveRegion(userRegions[0]);
            localStorage.setItem('activeRegion', JSON.stringify(userRegions[0]));
            
            const regionName = userRegions[0].name || userRegions[0].Region;
            toast.success(`Automatically assigned to ${regionName} region`);
            
          } else {
            // No assignments found - this user has no region access
            setAvailableRegions([]);
            setActiveRegion(null);
            localStorage.removeItem('activeRegion');
            
            toast.error("No region assignments found. Please contact your administrator.");
            setError("You don't have access to any regions. Please contact your administrator to assign you to a region.");
          }
        }
      } catch (err) {
        console.error('Error loading user regions:', err);
        setError('Failed to load region assignments. Please ensure you are properly logged in.');
        
        // On error, clear everything - user cannot access any regions
        setAvailableRegions([]);
        setActiveRegion(null);
        localStorage.removeItem('activeRegion');
        
        toast.error("Failed to load region assignments. Please try logging in again.");
      } finally {
        setLoading(false);
      }
    };
    
    assignUserRegions();
  }, [currentUser]); // Only depend on currentUser changes

  // Function to switch between assigned regions (if user has multiple)
  const changeActiveRegion = (region) => {
    if (!region) {
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
  };

  // Function to get a region by its name or ID
  const getRegionByNameOrId = (identifier) => {
    return availableRegions.find(region => 
      region.name === identifier || 
      region.regionName === identifier || 
      region.Region === identifier ||
      region._id === identifier ||
      region.id === identifier
    );
  };

  // Function to check if user has access to a specific region
  const hasRegionAccess = (regionId) => {
    if (!availableRegions || availableRegions.length === 0) return false; // No access if no assignments
    return availableRegions.some(region => 
      region._id === regionId || 
      region.id === regionId ||
      region.name === regionId ||
      region.Region === regionId
    );
  };

  // Function to check if user has multiple regions (for UI display)
  const hasMultipleRegions = () => {
    return availableRegions && availableRegions.length > 1;
  };

  const value = {
    activeRegion,
    availableRegions,
    loading,
    error,
    changeActiveRegion,
    getRegionByNameOrId,
    hasRegionAccess,
    hasMultipleRegions,
    
    // Legacy compatibility
    selectedRegion: activeRegion,
    setSelectedRegion: changeActiveRegion,
    regions: availableRegions
  };

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
