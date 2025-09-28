import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../config/api';
import { toast } from 'react-toastify';
import { REGIONS } from '../constants/regions';

// Create the context
const RegionContext = createContext();

// Create a provider component
export const RegionProvider = ({ children }) => {
  const [currentUser, setCurrentUserState] = useState(null);
  const [activeRegion, setActiveRegion] = useState(null);
  const [availableRegions, setAvailableRegions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Listen for currentUser changes from UserContext
  useEffect(() => {
    // Try to get user from UserContext
    const getUserFromContext = () => {
      try {
        // This is a workaround to access UserContext data
        const userContext = JSON.parse(localStorage.getItem('currentUser') || 'null');
        return userContext;
      } catch {
        return null;
      }
    };

    const user = getUserFromContext();
    if (user && user !== currentUser) {
      setCurrentUserState(user);
    }
  }, []);

  // Fetch user's assigned regions when user changes
  useEffect(() => {
    const fetchUserRegions = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Try to get user's region assignments from FMIS server
        const profileRes = await api.get("/api/user-profile");
        if (profileRes.data && profileRes.data.regions && profileRes.data.regions.length > 0) {
          const userRegions = profileRes.data.regions;
          setAvailableRegions(userRegions);
          
          // Check if there's a saved region in localStorage
          const savedRegion = localStorage.getItem('activeRegion');
          if (savedRegion) {
            try {
              const parsedRegion = JSON.parse(savedRegion);
              // Verify the saved region is still in user's assigned regions
              const isRegionStillAssigned = userRegions.some(r => 
                r._id === parsedRegion._id || 
                r.name === parsedRegion.name ||
                r.Region === parsedRegion.Region
              );
              
              if (isRegionStillAssigned) {
                setActiveRegion(parsedRegion);
              } else {
                // Saved region is no longer assigned, clear it
                localStorage.removeItem('activeRegion');
                setActiveRegion(userRegions[0]); // Set first assigned region
                localStorage.setItem('activeRegion', JSON.stringify(userRegions[0]));
              }
            } catch (e) {
              console.error('Error parsing saved region:', e);
              localStorage.removeItem('activeRegion');
              setActiveRegion(userRegions[0]);
              localStorage.setItem('activeRegion', JSON.stringify(userRegions[0]));
            }
          } else {
            // No saved region, set first assigned region as default
            setActiveRegion(userRegions[0]);
            localStorage.setItem('activeRegion', JSON.stringify(userRegions[0]));
            const regionName = userRegions[0].name || userRegions[0].Region;
            toast.info(`Region set to ${regionName}`);
          }
        } else {
          // No user assignments found, fallback to all regions
          const response = await api.get('/api/regions');
          
          if (response.data && Array.isArray(response.data)) {
            setAvailableRegions(response.data);
            
            // Check if there's a saved region in localStorage
            const savedRegion = localStorage.getItem('activeRegion');
            if (savedRegion) {
              try {
                const parsedRegion = JSON.parse(savedRegion);
                setActiveRegion(parsedRegion);
              } catch (e) {
                console.error('Error parsing saved region:', e);
                localStorage.removeItem('activeRegion');
              }
            } else {
              // If no saved region, set default region as default
              const defaultRegion = response.data.find(region => 
                region.name === REGIONS.DEFAULT_REGION || 
                region.regionName === REGIONS.DEFAULT_REGION ||
                region.Region === REGIONS.DEFAULT_REGION
              );
              
              if (defaultRegion) {
                setActiveRegion(defaultRegion);
                localStorage.setItem('activeRegion', JSON.stringify(defaultRegion));
                toast.info(`Default region set to ${REGIONS.DEFAULT_REGION}`);
              } else if (response.data && response.data.length > 0) {
                // Fallback: select the first region if no default found
                const firstRegion = response.data[0];
                setActiveRegion(firstRegion);
                localStorage.setItem('activeRegion', JSON.stringify(firstRegion));
                toast.info(`Default region set to ${firstRegion.name || firstRegion.regionName || 'first available region'}`);
              }
            }
          }
        }
      } catch (err) {
        console.error('Error fetching user regions:', err);
        setError('Failed to load regions. Please ensure you are properly logged in.');
        // Continue without regions assignment system
        setAvailableRegions([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserRegions();
  }, [currentUser]);

  // Function to change the active region
  const changeActiveRegion = (region) => {
    if (!region) {
      // Handle clearing the region
      setActiveRegion(null);
      localStorage.removeItem('activeRegion');
      toast.info('Active region cleared');
      return;
    }
    
    // Make sure we have a valid region object with at least a name or regionName
    if (!region.name && !region.regionName && !region.Region) {
      console.error('Invalid region object:', region);
      toast.error('Invalid region selected');
      return;
    }
    
    setActiveRegion(region);
    localStorage.setItem('activeRegion', JSON.stringify(region));
    const regionName = region.name || region.regionName || region.Region;
    toast.success(`Active region changed to ${regionName}`);
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
    if (!availableRegions || availableRegions.length === 0) return true; // Allow access if no restrictions
    return availableRegions.some(region => 
      region._id === regionId || 
      region.id === regionId ||
      region.name === regionId ||
      region.Region === regionId
    );
  };

  const value = {
    activeRegion,
    availableRegions,
    loading,
    error,
    changeActiveRegion,
    getRegionByNameOrId,
    hasRegionAccess,
    
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
