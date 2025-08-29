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
        // Check if user already has regions from UserContext first
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
                // Find the exact region object from current user regions
                targetRegion = userRegions.find(r => 
                  r._id === parsedRegion._id || 
                  r.name === parsedRegion.name ||
                  r.Region === parsedRegion.Region
                );
              } else {
              }
            } catch (error) {
            }
          }
          
          // If no valid saved region, use the first available region
          if (!targetRegion) {
            targetRegion = userRegions[0];
          }
          
          setActiveRegion(targetRegion);
          localStorage.setItem('activeRegion', JSON.stringify(targetRegion));
          
          const regionName = targetRegion.name || targetRegion.Region;
          return; // Exit early, no need to call API
        }

        // If no regions in UserContext, the UserContext will handle the API call
        // We just wait for it to update currentUser.regions
        
        // Set a timeout to prevent infinite loading
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
