import { useState, useEffect } from 'react';
import { useRegion } from '../context/RegionContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

/**
 * Custom hook to handle active region in forms and components
 * @param {Object} options - Configuration options
 * @param {boolean} options.required - Whether a region is required (will redirect to region selection if none is active)
 * @param {boolean} options.showToast - Whether to show toast messages
 * @param {string} options.redirectPath - Path to redirect to if no region is selected and required is true
 * @returns {Object} Region-related utilities
 */
const useActiveRegion = ({
  required = false,
  showToast = true,
  redirectPath = '/region-selection'
} = {}) => {
  const navigate = useNavigate();
  const { activeRegion, availableRegions, changeActiveRegion } = useRegion();
  const [regionField, setRegionField] = useState(activeRegion ? (activeRegion.name || activeRegion.regionName) : '');
  
  // Update the region field when activeRegion changes
  useEffect(() => {
    if (activeRegion) {
      setRegionField(activeRegion.name || activeRegion.regionName);
    } else {
      setRegionField('');
    }
  }, [activeRegion]);
  
  // Check if a region is required but not selected
  useEffect(() => {
    if (required && !activeRegion) {
      if (showToast) {
        toast.info('Please select a region to continue');
      }
      navigate(redirectPath);
    }
  }, [required, activeRegion, navigate, redirectPath, showToast]);
  
  // Function to handle region field changes in forms
  const handleRegionChange = (event) => {
    const regionValue = event.target.value;
    setRegionField(regionValue);
    
    // Find the region object that matches the selected value
    const selectedRegion = availableRegions.find(
      region => region.name === regionValue || region.regionName === regionValue
    );
    
    if (selectedRegion) {
      changeActiveRegion(selectedRegion);
    }
  };
  
  return {
    regionField,
    setRegionField,
    handleRegionChange,
    activeRegion,
    availableRegions,
    changeActiveRegion
  };
};

export default useActiveRegion;