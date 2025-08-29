import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormLabel,
  Grid,
  Paper,
  TextField,
  Typography,
  Autocomplete,
  Chip
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import api from '../../config/api';

// We'll fetch regions from the database

const IncomeSubCategoryRegionMapping = ({ subcategoryId, open, onClose }) => {
  const queryClient = useQueryClient();
  const [subcategoryName, setSubcategoryName] = useState('');
  const [selectedRegions, setSelectedRegions] = useState([]);
  const [isGlobal, setIsGlobal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [availableRegions, setAvailableRegions] = useState([]);

  // Fetch subcategory details
  const { data: subcategoryData, isLoading: isLoadingSubcategory } = useQuery({
    queryKey: ['income-subcategory', subcategoryId],
    queryFn: async () => {
      if (!subcategoryId) return null;
      const response = await api.get(`/income-subcategories/${subcategoryId}`);
      return response.data;
    },
    enabled: !!subcategoryId && open
  });
  
  // Fetch regions
  const { data: regionsData, isLoading: isLoadingRegions } = useQuery({
    queryKey: ['regions'],
    queryFn: async () => {
      const response = await api.get('/api/regions');
      return response.data;
    },
    enabled: open
  });
  
  // Process regions data
  useEffect(() => {
    if (regionsData) {
      if (Array.isArray(regionsData)) {
        // Extract region names
        const regionNames = regionsData.map(region => region.regionName || region.name);
        setAvailableRegions(regionNames);
      } else if (regionsData.regions && Array.isArray(regionsData.regions)) {
        // Alternative response format
        const regionNames = regionsData.regions.map(region => region.regionName || region.name);
        setAvailableRegions(regionNames);
      }
    }
  }, [regionsData]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data) => {
      return await api.put(`/income-subcategories/${subcategoryId}`, data);
    },
    onSuccess: () => {
      toast.success('Region mapping updated successfully');
      queryClient.invalidateQueries(['income-subcategories']);
      onClose();
    },
    onError: (error) => {
      toast.error(`Error updating region mapping: ${error.message}`);
    }
  });

  // Initialize form with subcategory data
  useEffect(() => {
    if (subcategoryData) {
      setSubcategoryName(subcategoryData.incomeSubcategoryName || '');
      setSelectedRegions(subcategoryData.regions || []);
      setIsGlobal(subcategoryData.isGlobal || false);
    }
  }, [subcategoryData]);

  // Handle global checkbox change
  const handleGlobalChange = (event) => {
    const checked = event.target.checked;
    setIsGlobal(checked);
    
    // If global is checked, clear all region selections
    if (checked) {
      setSelectedRegions([]);
    }
  };

  // Handle save
  const handleSave = async () => {
    setLoading(true);
    try {
      await updateMutation.mutateAsync({
        incomeSubcategoryName: subcategoryName,
        regions: selectedRegions,
        isGlobal
      });
    } catch (error) {
      console.error('Error saving region mapping:', error);
    } finally {
      setLoading(false);
    }
  };

  // Auto-detect regions from subcategory name
  const autoDetectRegions = () => {
    if (!subcategoryName || availableRegions.length === 0) return;
    
    // Create a regex pattern from available regions
    // Escape special characters in region names
    const escapedRegions = availableRegions.map(region => 
      region.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
    );
    const regexPattern = new RegExp(`\\b(${escapedRegions.join('|')})\\b`, 'g');
    
    const regionMatches = subcategoryName.match(regexPattern);
    
    if (regionMatches) {
      const newRegions = regionMatches.filter(region => 
        !selectedRegions.includes(region) && 
        availableRegions.includes(region)
      );
      
      if (newRegions.length > 0) {
        setSelectedRegions([...selectedRegions, ...newRegions]);
        toast.success(`Auto-detected regions: ${newRegions.join(', ')}`);
      } else {
        toast.info('No new regions detected in the subcategory name');
      }
    } else {
      toast.info('No regions detected in the subcategory name');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Region Mapping for Income Subcategory
      </DialogTitle>
      <DialogContent dividers>
        {isLoadingSubcategory || isLoadingRegions ? (
          <Typography>Loading data...</Typography>
        ) : (
          <Box component={Paper} p={2}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  label="Subcategory Name"
                  value={subcategoryName}
                  onChange={(e) => setSubcategoryName(e.target.value)}
                  fullWidth
                  disabled
                  margin="normal"
                />
                <Button 
                  variant="outlined" 
                  color="primary" 
                  onClick={autoDetectRegions}
                  sx={{ mt: 1 }}
                  disabled={availableRegions.length === 0}
                >
                  Auto-detect Regions from Name
                </Button>
              </Grid>
              
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={isGlobal}
                      onChange={handleGlobalChange}
                    />
                  }
                  label="Available to All Regions (Global)"
                />
              </Grid>
              
              {!isGlobal && (
                <Grid item xs={12}>
                  <FormControl component="fieldset" fullWidth margin="normal">
                    <FormLabel component="legend">Regions</FormLabel>
                    <Autocomplete
                      multiple
                      options={availableRegions}
                      value={selectedRegions}
                      onChange={(event, newValue) => {
                        setSelectedRegions(newValue);
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          variant="outlined"
                          placeholder="Select regions"
                        />
                      )}
                      renderTags={(value, getTagProps) =>
                        value.map((option, index) => (
                          <Chip
                            label={option}
                            {...getTagProps({ index })}
                            color="primary"
                            variant="outlined"
                          />
                        ))
                      }
                    />
                  </FormControl>
                </Grid>
              )}
            </Grid>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button 
          onClick={handleSave} 
          color="primary" 
          variant="contained"
          disabled={loading || isLoadingSubcategory || isLoadingRegions}
        >
          {loading ? 'Saving...' : 'Save Region Mapping'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default IncomeSubCategoryRegionMapping;