import React, { useState } from 'react';
import { 
  Button, 
  Dialog, 
  DialogActions, 
  DialogContent, 
  DialogContentText, 
  DialogTitle,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Paper,
  Divider,
  useTheme,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import BuildIcon from '@mui/icons-material/Build';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import api from '../../config/api';
import { useRegion } from '../../context/RegionContext';
import { toast } from 'react-hot-toast';

const EmployeeRegionFixer = ({ onFixComplete }) => {
  const theme = useTheme();
  const { activeRegion } = useRegion();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResults, setCheckResults] = useState(null);
  const [fixResults, setFixResults] = useState(null);
  const [error, setError] = useState(null);
  const [selectedSourceRegion, setSelectedSourceRegion] = useState("");

  const handleOpen = () => {
    setOpen(true);
    checkRegions();
  };

  const handleClose = () => {
    setOpen(false);
    setCheckResults(null);
    setFixResults(null);
    setError(null);
  };

  const checkRegions = async () => {
    if (!activeRegion) {
      setError("Please select a region first");
      return;
    }

    setChecking(true);
    setError(null);
    setCheckResults(null);
    
    try {
      const regionName = activeRegion.name || activeRegion.regionName;
      const response = await api.get('/employees/check-regions', {
        params: { region: regionName }
      });
      
      setCheckResults(response.data);
    } catch (error) {
      console.error("Error checking regions:", error);
      setError(error.response?.data?.error || "Failed to check employee regions");
      toast.error("Failed to check employee regions");
    } finally {
      setChecking(false);
    }
  };

  const fixRegions = async () => {
    if (!activeRegion) {
      setError("Please select a region first");
      return;
    }

    setLoading(true);
    setError(null);
    setFixResults(null);
    
    try {
      const regionName = activeRegion.name || activeRegion.regionName;
      const requestData = {
        region: regionName
      };
      
      // If a source region is selected, include it in the request
      if (selectedSourceRegion) {
        requestData.sourceRegion = selectedSourceRegion;
      }
      
      const response = await api.post('/employees/fix-regions', requestData);
      
      setFixResults(response.data);
      
      // Refresh the check results
      await checkRegions();
      
      // Notify parent component
      if (onFixComplete) {
        onFixComplete();
      }
      
      toast.success("Employee regions fixed successfully");
    } catch (error) {
      console.error("Error fixing regions:", error);
      setError(error.response?.data?.error || "Failed to fix employee regions");
      toast.error("Failed to fix employee regions");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="outlined"
        color="warning"
        startIcon={<BuildIcon />}
        onClick={handleOpen}
        size="small"
        sx={{ ml: 1 }}
      >
        Fix Regions
      </Button>
      
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Employee Region Fixer
        </DialogTitle>
        
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          
          <DialogContentText paragraph>
            This utility helps fix employee records that don't have the correct region assigned.
            It will assign the currently active region ({activeRegion?.name || activeRegion?.regionName || 'None selected'}) to employees with missing region data.
          </DialogContentText>
          
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Current Region Status:
            </Typography>
            
            {checking ? (
              <Box sx={{ display: 'flex', alignItems: 'center', my: 2 }}>
                <CircularProgress size={24} sx={{ mr: 2 }} />
                <Typography>Checking employee regions...</Typography>
              </Box>
            ) : checkResults ? (
              <Paper elevation={1} sx={{ p: 2, bgcolor: theme.palette.background.default }}>
                <Typography variant="body2" paragraph>
                  Total employees: <strong>{checkResults.totalEmployees}</strong>
                </Typography>
                <Divider sx={{ my: 1 }} />
                <Typography variant="body2" paragraph>
                  Employees with region "{checkResults.region}": <strong>{checkResults.employeesWithRegion}</strong>
                </Typography>
                <Typography variant="body2" paragraph>
                  Employees with no region field: <strong>{checkResults.employeesWithoutRegion}</strong>
                </Typography>
                <Typography variant="body2" paragraph>
                  Employees with empty region: <strong>{checkResults.employeesWithEmptyRegion}</strong>
                </Typography>
                <Typography variant="body2" paragraph>
                  Employees with null region: <strong>{checkResults.employeesWithNullRegion}</strong>
                </Typography>
                
                {/* Display unique regions */}
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" gutterBottom>
                  Unique Regions in Database:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                  {checkResults.uniqueRegions && checkResults.uniqueRegions.map((region, index) => (
                    <Chip 
                      key={index} 
                      label={region || 'null/undefined'} 
                      size="small"
                      color={region === checkResults.region ? "primary" : "default"}
                    />
                  ))}
                </Box>
                
                {/* Region counts */}
                <Typography variant="subtitle2" gutterBottom>
                  Employee Counts by Region:
                </Typography>
                <Box sx={{ mb: 2 }}>
                  {checkResults.regionCounts && checkResults.regionCounts.map((item, index) => (
                    <Typography key={index} variant="body2">
                      • {item.region}: <strong>{item.count}</strong> employees
                    </Typography>
                  ))}
                </Box>
                
                {/* Source region selector */}
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" gutterBottom>
                  Fix Employees from Another Region:
                </Typography>
                <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                  <InputLabel id="source-region-label">Source Region</InputLabel>
                  <Select
                    labelId="source-region-label"
                    value={selectedSourceRegion}
                    label="Source Region"
                    onChange={(e) => setSelectedSourceRegion(e.target.value)}
                  >
                    <MenuItem value="">
                      <em>None (fix missing regions only)</em>
                    </MenuItem>
                    {checkResults.uniqueRegions && checkResults.uniqueRegions
                      .filter(r => r && r !== checkResults.region) // Filter out null and current region
                      .map((region, index) => (
                        <MenuItem key={index} value={region}>
                          {region}
                        </MenuItem>
                      ))
                    }
                  </Select>
                </FormControl>
                
                {selectedSourceRegion ? (
                  <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 2 }}>
                    This will move all employees from <strong>{selectedSourceRegion}</strong> to <strong>{checkResults.region}</strong>.
                  </Alert>
                ) : (
                  checkResults.employeesWithoutRegion === 0 && 
                  checkResults.employeesWithEmptyRegion === 0 && 
                  checkResults.employeesWithNullRegion === 0 ? (
                    <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mt: 2 }}>
                      All employees have a region assigned.
                    </Alert>
                  ) : (
                    <Alert severity="warning" icon={<WarningIcon />} sx={{ mt: 2 }}>
                      Some employees are missing region data. Click "Fix Regions" to assign them to the current region.
                    </Alert>
                  )
                )}
              </Paper>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Click "Check Regions" to analyze employee data.
              </Typography>
            )}
          </Box>
          
          {fixResults && (
            <Alert severity="success" sx={{ mb: 2 }}>
              <Typography variant="subtitle2">Fix Results:</Typography>
              {fixResults.updatedFromSourceRegion !== undefined && (
                <Typography variant="body2">
                  • Moved employees from {selectedSourceRegion}: {fixResults.updatedFromSourceRegion}
                </Typography>
              )}
              <Typography variant="body2">
                • Updated employees without region: {fixResults.updatedWithoutRegion}
              </Typography>
              <Typography variant="body2">
                • Updated employees with empty region: {fixResults.updatedEmptyRegion}
              </Typography>
              <Typography variant="body2">
                • Updated employees with null region: {fixResults.updatedNullRegion}
              </Typography>
              {fixResults.updatedCaseSensitivity !== undefined && (
                <Typography variant="body2">
                  • Fixed case sensitivity issues: {fixResults.updatedCaseSensitivity}
                </Typography>
              )}
            </Alert>
          )}
        </DialogContent>
        
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button 
            onClick={checkRegions} 
            disabled={checking || !activeRegion}
            variant="outlined"
          >
            {checking ? <CircularProgress size={24} sx={{ mr: 1 }} /> : null}
            Check Regions
          </Button>
          
          <Button 
            onClick={fixRegions} 
            disabled={loading || !activeRegion || !checkResults || (
              !selectedSourceRegion && 
              checkResults && 
              checkResults.employeesWithoutRegion === 0 && 
              checkResults.employeesWithEmptyRegion === 0 && 
              checkResults.employeesWithNullRegion === 0
            )}
            variant="contained" 
            color="warning"
          >
            {loading ? <CircularProgress size={24} sx={{ mr: 1 }} /> : null}
            {selectedSourceRegion 
              ? `Move Employees from ${selectedSourceRegion}` 
              : "Fix Missing Regions"}
          </Button>
          
          <Button onClick={handleClose} color="primary">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default EmployeeRegionFixer;