import React, { useState, useEffect } from "react";
import api from "../config/api";
import { useRegion } from "../context/RegionContext";
import {
  Box,
  CircularProgress,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Paper,
  Button,
  Snackbar,
  Alert,
  Chip,
} from "@mui/material";
import TierTable from "../components/tier/TierTable";
import { useUser } from "../context/UserContext";
import SaveIcon from '@mui/icons-material/Save';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';

const TierPage = () => {
  const { currentUser } = useUser();
  const { activeRegion } = useRegion();
  const [activeFiscalYear, setActiveFiscalYear] = useState("");
  const [regions, setRegions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedDivision, setSelectedDivision] = useState("");
  const [tierData, setTierData] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSavedJson, setLastSavedJson] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [tableKey, setTableKey] = useState(Date.now());

  useEffect(() => {
    if (!tierData) {
      setIsDirty(false);
      return;
    }

    // If we don't have a known lastSavedJson yet, treat the initial displayed data as baseline (not dirty)
    if (!lastSavedJson) {
      setLastSavedJson(JSON.stringify(tierData));
      setIsDirty(false);
      return;
    }

    const json = JSON.stringify(tierData);
    setIsDirty(json !== lastSavedJson);
  }, [tierData, lastSavedJson]);

  useEffect(() => {
    const fetchActiveSettings = async () => {
      try {
        const activeResponse = await api.get("/settings/active");
        if (activeResponse.data) {
          const fiscalYear = activeResponse.data.fiscalYear || "";
          setActiveFiscalYear(fiscalYear);
        }
      } catch (error) {
        console.error("Error fetching active settings:", error);
      }
    };

    const fetchRegions = async () => {
      try {
        const response = await api.get("/api/regions");
        setRegions(response.data);
      } catch (error) {
        console.error("Error fetching regions:", error);
      }
    };

    fetchActiveSettings();
    fetchRegions();
  }, []);

  useEffect(() => {
    if (selectedRegion) {
      const fetchDepartments = async () => {
        try {
          const response = await api.get(`/departments?region=${selectedRegion}`);
          setDepartments(response.data.departments || []);
        } catch (error) {
          console.error("Error fetching departments:", error);
        }
      };
      fetchDepartments();
    }
    // Reset dependent selections when region changes
    setSelectedDepartment("");
    setSelectedDivision("");
  }, [selectedRegion]);

  useEffect(() => {
    if (selectedDepartment) {
      const fetchDivisions = async () => {
        try {
          const response = await api.get(`/api/hierarchical-rbac/divisions?departmentId=${selectedDepartment}`);
          setDivisions(response.data.data || response.data || []);
        } catch (error) {
          console.error("Error fetching divisions:", error);
        }
      };
      fetchDivisions();
    }
    // Reset division when department changes
    setSelectedDivision("");
  }, [selectedDepartment]);


  const handleSave = async () => {
    if (!tierData || !activeFiscalYear) return;
    if (!isDirty) {
      setSnackbar({ open: true, message: 'No changes to save', severity: 'info' });
      return;
    }

    setIsSaving(true);
    try {
      // Build normalizedItems from displayedItems (preferred) or raw items
      const normalizedItems = {};
      const source = tierData.displayedItems || tierData.items || {};

      Object.entries(source).forEach(([key, v]) => {
        // v could be { tier1, tier2, category } (displayedItems) or raw stored values
        normalizedItems[key] = {
          ...v,
          tier1: Number(v.tier1) || 0,
          tier2: Number(v.tier2) || 0,
        };
      });

      const saveData = {
        fiscalYear: activeFiscalYear,
        region: selectedRegion,
        department: selectedDepartment,
        division: selectedDivision,
        items: normalizedItems,
      };

      await api.post('/tier/data', saveData);
      setLastSavedJson(JSON.stringify({ items: normalizedItems }));
      setIsDirty(false);
      setSnackbar({ open: true, message: 'Tier data saved successfully', severity: 'success' });
    } catch (error) {
      console.error('Error saving tier data:', error);
      setSnackbar({ open: true, message: 'Error saving tier data. Please try again.', severity: 'error' });
    } finally {
      setIsSaving(false);
    }
  }; 

  const handleGeneratePDF = async () => {
    if (!tierData || !activeFiscalYear) return;

    setIsGeneratingPdf(true);
    try {
      setSnackbar({ open: true, message: 'Generating PDF...', severity: 'info' });
      const response = await api.post('/tier/generate-pdf', {
        fiscalYear: activeFiscalYear,
        region: selectedRegion,
        department: selectedDepartment,
        division: selectedDivision,
        tierData: tierData
      }, { responseType: 'blob' });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Tier_Report_${activeFiscalYear}_${selectedRegion || 'All'}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      setSnackbar({ open: true, message: 'PDF generated and downloaded', severity: 'success' });
    } catch (error) {
      console.error('Error generating PDF:', error);
      setSnackbar({ open: true, message: 'Error generating PDF report. Please try again.', severity: 'error' });
    } finally {
      setIsGeneratingPdf(false);
    }
  }; 

  return (
    <Box sx={{ p: 3, bgcolor: "white", minHeight: "100vh" }}>
      <Paper
        elevation={3}
        sx={{
          p: 3,
          mb: 3,
          background: "#375e38",
          color: "white",
        }}
      >
        <Typography variant="h4" component="h1" gutterBottom>
          Tier
        </Typography>
        <Typography variant="body1">
          View and manage Tier data.
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.9, mt: 1 }}>
          Note: Original amounts from source data are shown as "Orig" beside inputs. Edit Tier values as needed and click Save.
        </Typography>
      </Paper>

      <Box sx={{ mb: 3, display: "flex", gap: 2 }}>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel id="region-select-label">Region</InputLabel>
          <Select
            labelId="region-select-label"
            value={selectedRegion || ""}
            label="Region"
            onChange={(e) => setSelectedRegion(e.target.value || "")}
          >
            {regions.map((region) => (
              <MenuItem key={region._id || region.Region} value={region.Region || ""}>
                {region.Region || "Unnamed Region"}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel id="department-select-label">Department</InputLabel>
          <Select
            labelId="department-select-label"
            value={selectedDepartment || ""}
            label="Department"
            onChange={(e) => setSelectedDepartment(e.target.value || "")}
            disabled={!selectedRegion}
          >
            {departments.map((dept) => (
              <MenuItem key={dept._id || dept.Department} value={dept._id || ""}>
                {dept.Department || dept.name || "Unnamed Department"}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel id="division-select-label">Division</InputLabel>
          <Select
            labelId="division-select-label"
            value={selectedDivision || ""}
            label="Division"
            onChange={(e) => setSelectedDivision(e.target.value || "")}
            disabled={!selectedDepartment}
          >
            {divisions.map((div) => (
              <MenuItem key={div._id || div.name} value={div.name || ""}>
                {div.name || "Unnamed Division"}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip label={isDirty ? 'Unsaved changes' : 'All changes saved'} color={isDirty ? 'warning' : 'success'} />
          <Button
            variant="contained"
            color="success"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={isSaving || !tierData || !isDirty}
            sx={{ minWidth: 120 }}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>

          <Button
            variant="outlined"
            color="inherit"
            onClick={() => {
              if (!tierData) return;
              if (!confirm('Reset all Tier inputs? This cannot be undone.')) return;
              setTableKey(Date.now());
              setTierData(null);
              setIsDirty(false);
              setSnackbar({ open: true, message: 'Inputs reset', severity: 'info' });
            }}
            sx={{ minWidth: 120 }}
          >
            Reset
          </Button>

          <Button
            variant="contained"
            color="secondary"
            startIcon={<PictureAsPdfIcon />}
            onClick={handleGeneratePDF}
            disabled={!tierData || isGeneratingPdf}
            sx={{ minWidth: 140 }}
          >
            {isGeneratingPdf ? 'Generating...' : 'Generate PDF'}
          </Button>
        </Box>
      </Box>

      {!activeFiscalYear ? (
        <Box
          sx={{
            p: 3,
            textAlign: "center",
            backgroundColor: "#f5f5f5",
            borderRadius: 1,
          }}
        >
          <CircularProgress sx={{ mb: 2 }} />
          <Typography variant="body2" color="textSecondary">
            Loading Tier data...
          </Typography>
        </Box>
      ) : (
        <TierTable
          key={tableKey}
          fiscalYear={activeFiscalYear}
          region={selectedRegion}
          department={selectedDepartment}
          division={selectedDivision}
          onTierDataChange={setTierData}
        />
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbar(s => ({ ...s, open: false }))} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default TierPage;
