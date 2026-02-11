import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
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
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  TextField,
} from "@mui/material";
import TierTable from "../components/tier/TierTable";
import { useUser } from "../context/UserContext";
import SaveIcon from '@mui/icons-material/Save';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import TableChartIcon from '@mui/icons-material/TableChart';
import CloseIcon from '@mui/icons-material/Close';
import HistoryIcon from '@mui/icons-material/History';
import RestoreIcon from '@mui/icons-material/Restore';

const TierPage = () => {
  const { currentUser } = useUser();
  const { activeRegion } = useRegion();
  const [searchParams, setSearchParams] = useSearchParams();
  const appliedUrlParamsRef = useRef(false);
  const pendingDepartmentParamRef = useRef(null);
  const pendingDivisionParamRef = useRef(null);
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
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [tableKey, setTableKey] = useState(Date.now());
  const lastSavedJsonRef = useRef(null);
  const tierDataPrevRef = useRef(null);
  const [revisionsDrawerOpen, setRevisionsDrawerOpen] = useState(false);
  const [revisions, setRevisions] = useState([]);
  const [revisionsLoading, setRevisionsLoading] = useState(false);
  const [restoringId, setRestoringId] = useState(null);
  const [revisionComment, setRevisionComment] = useState('');

  // Compute dirty state without causing setState loops: only set lastSavedJson once when tierData first arrives
  useEffect(() => {
    if (!tierData) {
      setIsDirty(false);
      return;
    }
    const json = JSON.stringify(tierData);
    if (lastSavedJsonRef.current === null) {
      lastSavedJsonRef.current = json;
      setLastSavedJson(json);
      setIsDirty(false);
      tierDataPrevRef.current = json;
      return;
    }
    setIsDirty(json !== lastSavedJsonRef.current);
    tierDataPrevRef.current = json;
  }, [tierData]);

  // Keep lastSavedJson in sync when user saves (so next comparison uses updated baseline)
  useEffect(() => {
    if (lastSavedJson != null && lastSavedJson === lastSavedJsonRef.current) return;
    if (lastSavedJson != null) lastSavedJsonRef.current = lastSavedJson;
  }, [lastSavedJson]);

  useEffect(() => {
    const fyFromUrl = searchParams.get("fiscalYear");
    const fetchActiveSettings = async () => {
      try {
        const activeResponse = await api.get("/settings/active");
        if (activeResponse.data) {
          const fiscalYear = fyFromUrl || activeResponse.data.fiscalYear || "";
          setActiveFiscalYear(String(fiscalYear));
        } else if (fyFromUrl) {
          setActiveFiscalYear(fyFromUrl);
        }
      } catch (error) {
        console.error("Error fetching active settings:", error);
        if (fyFromUrl) setActiveFiscalYear(fyFromUrl);
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
  }, [searchParams]);

  // Apply scope from URL params when coming from New Proposal Workflow (e.g. "Open Tier")
  useEffect(() => {
    if (appliedUrlParamsRef.current || regions.length === 0) return;
    const regionParam = searchParams.get("region");
    const departmentParam = searchParams.get("department");
    const divisionParam = searchParams.get("division");
    if (!regionParam && !departmentParam && !divisionParam) return;
    appliedUrlParamsRef.current = true;
    if (regionParam) {
      const found = regions.find(
        (r) => String(r._id) === String(regionParam) || String(r.Region) === regionParam
      );
      if (found) setSelectedRegion(found._id);
      else setSelectedRegion(regionParam);
    }
    if (departmentParam) pendingDepartmentParamRef.current = departmentParam;
    if (divisionParam) pendingDivisionParamRef.current = divisionParam;
    const next = new URLSearchParams(searchParams);
    next.delete("fiscalYear");
    next.delete("region");
    next.delete("department");
    next.delete("division");
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [regions, searchParams, setSearchParams]);

  useEffect(() => {
    if (departments.length === 0) return;
    const departmentParam = pendingDepartmentParamRef.current;
    if (!departmentParam) return;
    const found = departments.find(
      (d) => String(d._id) === String(departmentParam) || String(d.Department) === departmentParam || String(d.name) === departmentParam
    );
    pendingDepartmentParamRef.current = null;
    if (found) setSelectedDepartment(found._id);
    else setSelectedDepartment(departmentParam);
  }, [departments]);

  useEffect(() => {
    if (divisions.length === 0) return;
    const divisionParam = pendingDivisionParamRef.current;
    if (!divisionParam) return;
    const found = divisions.find(
      (d) => String(d._id) === String(divisionParam) || String(d.name) === divisionParam
    );
    pendingDivisionParamRef.current = null;
    if (found) setSelectedDivision(found._id || found.name);
    else setSelectedDivision(divisionParam);
  }, [divisions]);

  useEffect(() => {
    if (selectedRegion && selectedRegion !== 'ALL') {
      const fetchDepartments = async () => {
        try {
          const response = await api.get(`/departments?region=${selectedRegion}`);
          setDepartments(response.data.departments || []);
        } catch (error) {
          console.error("Error fetching departments:", error);
        }
      };
      fetchDepartments();
    } else {
      setDepartments([]);
    }
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
      // Build normalizedItems array from displayedItems (preferred) or raw items
      const source = tierData.displayedItems || tierData.items || {};
      
      // Transform object to array format expected by backend
      // Key format: "CategoryName-lineItemId" (e.g. "Personnel Services-1.a", "Salaries and Wages-1.a", "Capital Outlay-5-02-01-010")
      const itemsArray = Object.entries(source).map(([key, v]) => {
        // Use full key as lineItemId (unique string; backend accepts String)
        const lineItemId = key;
        
        // Map to backend enum: Personnel | MOOE | Capital Outlay (subcategories map to parent)
        let category = v.category || '';
        if (category === 'Capital Outlay') {
          category = 'Capital Outlay';
        } else if (category === 'Maintenance and Other Operating Expenses') {
          category = 'MOOE';
        } else {
          // All personnel subcategories (Personnel Services, Salaries and Wages, Other Compensation, etc.)
          category = 'Personnel';
        }
        
        return {
          lineItemId,
          category,
          tier1: Number(v.tier1) || 0,
          tier2: Number(v.tier2) || 0,
          description: v.description || key,
        };
      });

      const saveData = {
        fiscalYear: activeFiscalYear,
        region: selectedRegion,
        department: selectedDepartment,
        division: selectedDivision,
        items: itemsArray,
        ...(revisionComment.trim() && { revisionComment: revisionComment.trim() }),
      };

      await api.post('/tier/data', saveData);
      const saved = JSON.stringify({ items: source });
      setLastSavedJson(saved);
      lastSavedJsonRef.current = saved;
      setIsDirty(false);
      setSnackbar({ open: true, message: 'Tier data saved successfully', severity: 'success' });
      setRevisionComment('');
    } catch (error) {
      console.error('Error saving tier data:', error);
      setSnackbar({ open: true, message: 'Error saving tier data. Please try again.', severity: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const fetchRevisions = async () => {
    if (!activeFiscalYear || !selectedRegion || selectedRegion === 'ALL') return;
    setRevisionsLoading(true);
    try {
      const params = new URLSearchParams({
        fiscalYear: activeFiscalYear,
        region: selectedRegion,
      });
      if (selectedDepartment) params.set('department', selectedDepartment);
      if (selectedDivision) params.set('division', selectedDivision);
      const res = await api.get(`/api/tier/revisions?${params.toString()}`);
      setRevisions(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error fetching revisions:', err);
      setRevisions([]);
      setSnackbar({ open: true, message: 'Failed to load version history', severity: 'error' });
    } finally {
      setRevisionsLoading(false);
    }
  };

  const handleOpenRevisions = () => {
    setRevisionsDrawerOpen(true);
    fetchRevisions();
  };

  const handleRestoreRevision = async (revisionId) => {
    setRestoringId(revisionId);
    try {
      await api.post(`/api/tier/revisions/${revisionId}/restore`, { saveAsNewRevision: true });
      setSnackbar({ open: true, message: 'Revision restored. Refreshing table.', severity: 'success' });
      setRevisionsDrawerOpen(false);
      setTableKey(Date.now());
      setTierData(null);
      lastSavedJsonRef.current = null;
      setLastSavedJson(null);
    } catch (err) {
      console.error('Error restoring revision:', err);
      setSnackbar({ open: true, message: err?.response?.data?.message || 'Failed to restore revision', severity: 'error' });
    } finally {
      setRestoringId(null);
    }
  };

  const formatRevisionDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('en-PH', { dateStyle: 'short', timeStyle: 'short' });
    } catch (_) {
      return dateStr;
    }
  };

  const getRegionDisplayName = () =>
    !selectedRegion || selectedRegion === 'ALL' ? 'All' : (regions.find(r => r._id === selectedRegion || String(r._id) === String(selectedRegion))?.Region ?? selectedRegion);
  const getDepartmentDisplayName = () => {
    if (!selectedDepartment) return 'All';
    const dept = departments.find(d => d._id === selectedDepartment || String(d._id) === String(selectedDepartment));
    return dept ? (dept.Department || dept.name) : selectedDepartment;
  };
  const getDivisionDisplayName = () =>
    !selectedDivision ? 'All' : (divisions.find(d => d.name === selectedDivision || d._id === selectedDivision)?.name ?? selectedDivision);

  const handleViewPDF = async () => {
    if (!tierData?.reportSummary || !activeFiscalYear) {
      setSnackbar({ open: true, message: 'Load tier data first, then view PDF.', severity: 'warning' });
      return;
    }
    setIsGeneratingPdf(true);
    try {
      setSnackbar({ open: true, message: 'Generating PDF...', severity: 'info' });
      const response = await api.post('/tier/generate-pdf', {
        fiscalYear: activeFiscalYear,
        region: selectedRegion,
        department: selectedDepartment,
        division: selectedDivision,
        regionName: getRegionDisplayName(),
        departmentName: getDepartmentDisplayName(),
        divisionName: getDivisionDisplayName(),
        reportSummary: tierData.reportSummary,
      }, { responseType: 'blob' });

      if (pdfBlobUrl) window.URL.revokeObjectURL(pdfBlobUrl);
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      setPdfBlobUrl(url);
      setPdfViewerOpen(true);
      setSnackbar({ open: true, message: 'PDF ready. View in window below.', severity: 'success' });
    } catch (error) {
      console.error('Error generating PDF:', error);
      setSnackbar({ open: true, message: 'Error generating PDF. Please try again.', severity: 'error' });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleClosePdfViewer = () => {
    setPdfViewerOpen(false);
    if (pdfBlobUrl) {
      window.URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlobUrl(null);
    }
  };

  const handleExportExcel = async () => {
    if (!tierData?.reportSummary || !activeFiscalYear) {
      setSnackbar({ open: true, message: 'Load tier data first, then export Excel.', severity: 'warning' });
      return;
    }
    setIsExportingExcel(true);
    try {
      setSnackbar({ open: true, message: 'Generating Excel...', severity: 'info' });
      const response = await api.post('/tier/export-excel', {
        fiscalYear: activeFiscalYear,
        region: selectedRegion,
        department: selectedDepartment,
        division: selectedDivision,
        regionName: getRegionDisplayName(),
        departmentName: getDepartmentDisplayName(),
        divisionName: getDivisionDisplayName(),
        reportSummary: tierData.reportSummary,
      }, { responseType: 'blob' });

      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Tier_Report_${activeFiscalYear}_${getRegionDisplayName()}_${getDepartmentDisplayName()}_${getDivisionDisplayName()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setSnackbar({ open: true, message: 'Excel report downloaded.', severity: 'success' });
    } catch (error) {
      console.error('Error exporting Excel:', error);
      setSnackbar({ open: true, message: 'Error exporting Excel. Please try again.', severity: 'error' });
    } finally {
      setIsExportingExcel(false);
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
          View and manage Tier data by Region/Department/Division. 
        </Typography>
      
      </Paper>

      <Box sx={{ mb: 3, display: "flex", gap: 2 }}>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel id="region-select-label">Region</InputLabel>
          <Select
            labelId="region-select-label"
            value={String(selectedRegion ?? "")}
            label="Region"
            onChange={(e) => setSelectedRegion(e.target.value || "")}
          >
            <MenuItem value="ALL">
              <em>ALL</em> — Consolidate all regions
            </MenuItem>
            {regions.map((region, idx) => {
              const val = region._id != null ? String(region._id) : (region.Region || `region-${idx}`);
              return (
                <MenuItem key={val} value={val}>
                  {region.Region || "Unnamed Region"}
                </MenuItem>
              );
            })}
          </Select>
        </FormControl>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel id="department-select-label">Department</InputLabel>
          <Select
            labelId="department-select-label"
            value={String(selectedDepartment ?? "")}
            label="Department"
            onChange={(e) => setSelectedDepartment(e.target.value || "")}
            disabled={!selectedRegion || selectedRegion === 'ALL'}
          >
            {departments.map((dept, idx) => {
              const val = dept._id != null ? String(dept._id) : (dept.Department || dept.name || `dept-${idx}`);
              return (
                <MenuItem key={val} value={val}>
                  {dept.Department || dept.name || "Unnamed Department"}
                </MenuItem>
              );
            })}
          </Select>
        </FormControl>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel id="division-select-label">Division</InputLabel>
          <Select
            labelId="division-select-label"
            value={String(selectedDivision ?? "")}
            label="Division"
            onChange={(e) => setSelectedDivision(e.target.value || "")}
            disabled={!selectedDepartment || selectedRegion === 'ALL'}
          >
            {divisions.map((div, idx) => {
              const val = div.name != null && div.name !== "" ? String(div.name) : (div._id != null ? String(div._id) : `div-${idx}`);
              return (
                <MenuItem key={val} value={val}>
                  {div.name || "Unnamed Division"}
                </MenuItem>
              );
            })}
          </Select>
        </FormControl>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
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
          <TextField
            size="small"
            placeholder="Revision note (optional)"
            value={revisionComment}
            onChange={(e) => setRevisionComment(e.target.value)}
            sx={{ minWidth: 200, maxWidth: 280 }}
          />
          <Button
            variant="outlined"
            color="primary"
            startIcon={<HistoryIcon />}
            onClick={handleOpenRevisions}
            disabled={!activeFiscalYear || !selectedRegion || selectedRegion === 'ALL'}
            sx={{ minWidth: 140 }}
          >
            Version history
          </Button>
          <Button
            variant="outlined"
            color="inherit"
            onClick={() => {
              if (!tierData) return;
              if (!confirm('Reset all Tier inputs? This cannot be undone.')) return;
              setTableKey(Date.now());
              setTierData(null);
              lastSavedJsonRef.current = null;
              setLastSavedJson(null);
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
            onClick={handleViewPDF}
            disabled={!tierData?.reportSummary || isGeneratingPdf}
            sx={{ minWidth: 130 }}
          >
            {isGeneratingPdf ? 'Generating...' : 'View PDF'}
          </Button>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<TableChartIcon />}
            onClick={handleExportExcel}
            disabled={!tierData?.reportSummary || isExportingExcel}
            sx={{ minWidth: 130 }}
          >
            {isExportingExcel ? 'Exporting...' : 'Export Excel'}
          </Button>
        </Box>
      </Box>

      {!activeFiscalYear ? (
        <Box sx={{ p: 3, textAlign: "center", backgroundColor: "#f5f5f5", borderRadius: 1 }}>
          <CircularProgress sx={{ mb: 2 }} />
          <Typography variant="body2" color="textSecondary">Loading Tier data...</Typography>
        </Box>
      ) : !selectedRegion ? (
        <Box sx={{ p: 4, textAlign: "center", backgroundColor: "#f5f5f5", borderRadius: 1 }}>
          <Typography variant="body1" color="textSecondary" gutterBottom>
            Select Region to view Tier data
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Please select a Region (and optionally Department/Division) from the filters above to display the Tier table.
          </Typography>
        </Box>
      ) : (
        <TierTable
          key={tableKey}
          fiscalYear={activeFiscalYear}
          region={selectedRegion}
          regionName={selectedRegion !== 'ALL' && regions?.find(r => r._id === selectedRegion || String(r._id) === String(selectedRegion))?.Region}
          department={selectedDepartment}
          division={selectedDivision}
          onTierDataChange={setTierData}
        />
      )}

      <Dialog
        open={pdfViewerOpen}
        onClose={handleClosePdfViewer}
        maxWidth={false}
        fullWidth
        PaperProps={{
          sx: {
            width: '95vw',
            maxWidth: '95vw',
            height: '92vh',
            maxHeight: '92vh',
            borderRadius: 2,
            margin: 0,
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid', borderColor: 'divider', py: 1.5 }}>
          <Typography variant="h6">Tier Report (PDF)</Typography>
          <IconButton aria-label="close" onClick={handleClosePdfViewer} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {pdfBlobUrl && (
            <iframe
              title="Tier Report PDF"
              src={pdfBlobUrl}
              style={{ width: '100%', height: '100%', border: 'none', minHeight: 480 }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Drawer
        anchor="right"
        open={revisionsDrawerOpen}
        onClose={() => setRevisionsDrawerOpen(false)}
        PaperProps={{ sx: { width: 380, maxWidth: '100%' } }}
      >
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6">Tier version history</Typography>
          <IconButton size="small" onClick={() => setRevisionsDrawerOpen(false)} aria-label="close">
            <CloseIcon />
          </IconButton>
        </Box>
        <Box sx={{ overflow: 'auto', flex: 1 }}>
          {revisionsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={32} />
            </Box>
          ) : revisions.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 3 }}>
              No revisions yet. Each time you save, the previous version is stored here.
            </Typography>
          ) : (
            <List dense>
              {revisions.map((rev) => (
                <ListItem key={rev._id} divider>
                  <ListItemText
                    primary={`Version ${rev.version}`}
                    secondary={
                      <>
                        <Typography component="span" variant="body2" color="text.secondary">
                          {formatRevisionDate(rev.createdAt)}
                        </Typography>
                        {rev.comment && (
                          <Typography component="span" variant="body2" display="block" sx={{ mt: 0.5 }}>
                            {rev.comment}
                          </Typography>
                        )}
                        {rev.createdBy && (
                          <Typography component="span" variant="caption" display="block" color="text.secondary">
                            {rev.createdBy.name || rev.createdBy.username || '—'}
                          </Typography>
                        )}
                      </>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Button
                      size="small"
                      startIcon={<RestoreIcon />}
                      onClick={() => handleRestoreRevision(rev._id)}
                      disabled={restoringId != null}
                    >
                      {restoringId === rev._id ? 'Restoring...' : 'Restore'}
                    </Button>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      </Drawer>

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
