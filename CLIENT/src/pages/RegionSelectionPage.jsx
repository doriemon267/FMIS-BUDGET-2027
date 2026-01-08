import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  CircularProgress,
  Alert,
  Divider,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  LocationOn as LocationIcon,
  Check as CheckIcon,
  Refresh as RefreshIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useRegion } from '../context/RegionContext';
import { useUser } from '../context/UserContext';

// Helper function to check if a region is the active region
const isActiveRegion = (activeRegion, region) => {
  if (!activeRegion || !region) return false;
  
  // Check if regions match by ID
  if (activeRegion._id && region._id && activeRegion._id === region._id) {
    return true;
  }
  
  // Check if regions match by id
  if (activeRegion.id && region.id && activeRegion.id === region.id) {
    return true;
  }
  
  // Check if regions match by name
  if (activeRegion.name && region.name && activeRegion.name === region.name) {
    return true;
  }
  
  // Check if regions match by regionName
  if (activeRegion.regionName && region.regionName && activeRegion.regionName === region.regionName) {
    return true;
  }
  
  // Check if name matches regionName or vice versa
  if (activeRegion.name && region.regionName && activeRegion.name === region.regionName) {
    return true;
  }
  
  if (activeRegion.regionName && region.name && activeRegion.regionName === region.name) {
    return true;
  }
  
  // No match found
  return false;
};

const RegionSelectionPage = () => {
  const navigate = useNavigate();
  const { currentUser } = useUser();
  const { 
    activeRegion, 
    availableRegions, 
    loading, 
    error, 
    changeActiveRegion, 
    clearActiveRegion 
  } = useRegion();
  
  // Filter regions based on user access if needed
  const [userRegions, setUserRegions] = useState([]);
  
  useEffect(() => {
    // Make sure availableRegions is an array before filtering
    if (!Array.isArray(availableRegions)) {
      console.warn('availableRegions is not an array:', availableRegions);

      // No static fallback - regions must come from database only
      setUserRegions([]);
      return;
    }

    // If availableRegions is empty, show empty array (no static fallback)
    if (availableRegions.length === 0) {
      console.warn('No regions available from database');
      setUserRegions([]);
      return;
    }
    
    // If the user has region restrictions, filter the available regions
    if (currentUser?.regions && Array.isArray(currentUser.regions) && currentUser.regions.length > 0) {
      const filteredRegions = availableRegions.filter(region => 
        currentUser.regions.includes(region.id) || 
        currentUser.regions.includes(region._id) ||
        currentUser.regions.includes(region.name) ||
        currentUser.regions.includes(region.regionName)
      );
      
      // If no regions match the user's restrictions, show all available regions
      if (filteredRegions.length === 0) {
        setUserRegions(availableRegions);
      } else {
        setUserRegions(filteredRegions);
      }
    } else {
      // If no restrictions, show all available regions
      setUserRegions(availableRegions);
    }
  }, [availableRegions, currentUser]);

  const handleSelectRegion = (region) => {
    changeActiveRegion(region);
    // Optionally navigate to a specific page after selection
    // navigate('/dashboard');
  };

  const handleClearSelection = () => {
    clearActiveRegion();
  };

  const handleRefresh = () => {
    // Refresh the page to reload regions
    window.location.reload();
  };

  const handleBack = () => {
    navigate(-1);
  };

  return (
    <Box sx={{ p: 3, backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      <Paper elevation={2} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Box sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton 
              onClick={handleBack}
              sx={{ color: '#375e38' }}
            >
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h4" gutterBottom sx={{
              fontWeight: 600,
              color: '#375e38',
              mb: 0
            }}>
              Region Selection
            </Typography>
          </Box>

          <Tooltip title="Refresh regions">
            <span>
              <IconButton
                onClick={handleRefresh}
                disabled={loading}
                sx={{
                  color: '#375e38',
                  '&:hover': { backgroundColor: 'rgba(55, 94, 56, 0.1)' }
                }}
              >
                {loading ? <CircularProgress size={24} sx={{ color: '#375e38' }} /> : <RefreshIcon />}
              </IconButton>
            </span>
          </Tooltip>
        </Box>

        <Typography variant="body1" sx={{ mb: 3 }}>
          Select a region to work with. All your transactions will be associated with the selected region.
        </Typography>

        {activeRegion && (
          <Box sx={{ mb: 3 }}>
            <Alert 
              severity="info" 
              icon={<LocationIcon />}
              action={
                <Button 
                  color="inherit" 
                  size="small" 
                  onClick={handleClearSelection}
                >
                  Clear
                </Button>
              }
            >
              Currently working with region: <strong>{activeRegion.name || activeRegion.regionName}</strong>
            </Alert>
          </Box>
        )}
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
      ) : (
        <Grid container spacing={3}>
          {Array.isArray(userRegions) && userRegions.length > 0 ? (
            userRegions.map((region) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={region._id || region.id || `region-${Math.random()}`}>
                <Card 
                  sx={{ 
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: 2,
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-5px)',
                      boxShadow: '0 8px 16px rgba(0,0,0,0.1)'
                    },
                    ...(activeRegion && isActiveRegion(activeRegion, region) && {
                      border: '2px solid #375e38',
                      boxShadow: '0 4px 12px rgba(55, 94, 56, 0.2)'
                    })
                  }}
                >
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6" component="div" sx={{ fontWeight: 600, color: '#375e38' }}>
                        {region.name || region.regionName || "Unnamed Region"}
                      </Typography>
                      {activeRegion && isActiveRegion(activeRegion, region) && (
                        <Chip 
                          icon={<CheckIcon />} 
                          label="Active" 
                          size="small" 
                          color="success"
                          sx={{ fontWeight: 600 }}
                        />
                      )}
                    </Box>
                    
                    <Divider sx={{ mb: 2 }} />
                    
                    <Typography variant="body2" color="text.secondary">
                      {region.description || `All transactions will be associated with ${region.name || region.regionName || "this region"}.`}
                    </Typography>
                  </CardContent>
                  <CardActions sx={{ p: 2, pt: 0 }}>
                    <Button 
                      variant={activeRegion && isActiveRegion(activeRegion, region) ? "contained" : "outlined"}
                      fullWidth
                      onClick={() => handleSelectRegion(region)}
                      sx={{
                        color: activeRegion && isActiveRegion(activeRegion, region) ? 'white' : '#375e38',
                        backgroundColor: activeRegion && isActiveRegion(activeRegion, region) ? '#375e38' : 'transparent',
                        borderColor: '#375e38',
                        '&:hover': {
                          backgroundColor: activeRegion && isActiveRegion(activeRegion, region) ? '#2e4e2e' : 'rgba(55, 94, 56, 0.1)',
                          borderColor: '#375e38'
                        }
                      }}
                    >
                      {activeRegion && isActiveRegion(activeRegion, region) ? "Selected" : "Select Region"}
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))
          ) : (
            <Grid item xs={12}>
              <Paper sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="body1" color="text.secondary">
                  No regions available. Please contact your administrator.
                </Typography>
              </Paper>
            </Grid>
          )}
        </Grid>
      )}
    </Box>
  );
};

export default RegionSelectionPage;