import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
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
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import TierTable from "../components/tier/TierTable";
import { useUser } from "../context/UserContext";
import SaveIcon from '@mui/icons-material/Save';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import TableChartIcon from '@mui/icons-material/TableChart';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import HistoryIcon from '@mui/icons-material/History';
import RestoreIcon from '@mui/icons-material/Restore';
import VisibilityIcon from '@mui/icons-material/Visibility';

const TierPage = () => {
  const queryClient = useQueryClient();
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
  const [currentVersion, setCurrentVersion] = useState(null);
  const [viewRevisionOpen, setViewRevisionOpen] = useState(false);
  const [viewRevisionDetail, setViewRevisionDetail] = useState(null);
  const [viewRevisionLoading, setViewRevisionLoading] = useState(false);

  // Budget Officer and Budget Manager: view only. Budget Planning Analyst (and Super Admin) can edit/save.
  const roles = currentUser?.Roles ?? currentUser?.workflowRoles ?? (currentUser?.hierarchicalAccess?.workflowRoles ?? []);
  const roleList = Array.isArray(roles) ? roles : [roles];
  const norm = (r) => String(r || '').toUpperCase().replace(/\s+/g, '_');
  const isAnalyst = roleList.some((r) => ['BUDGET_PLANNING_ANALYST', 'BUDGET PLANNING ANALYST', 'BUDGETANALYST', 'budgetAnalyst'].includes(norm(r)));
  const isOfficer = roleList.some((r) => ['BUDGET_OFFICER', 'BUDGET OFFICER'].includes(norm(r)));
  const isManager = roleList.some((r) => ['BUDGET_MANAGER', 'BUDGET MANAGER', 'OVERALL_BUDGET_APPROVER'].includes(norm(r)));
  const isSuperAdmin = roleList.some((r) => ['SUPER_ADMIN', 'SUPER ADMIN'].includes(norm(r)));
  const isTierViewOnly = (isOfficer || isManager) && !isAnalyst && !isSuperAdmin;

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

  const fetchCurrentVersion = useCallback(async () => {
    if (!activeFiscalYear || !selectedRegion || selectedRegion === 'ALL') {
      setCurrentVersion(null);
      return;
    }
    try {
      const params = new URLSearchParams({ fiscalYear: activeFiscalYear, region: selectedRegion });
      if (selectedDepartment) params.set('department', selectedDepartment);
      if (selectedDivision) params.set('division', selectedDivision);
      const res = await api.get(`/api/tier/current-version?${params.toString()}`);
      setCurrentVersion(res.data?.version ?? null);
    } catch (_err) {
      setCurrentVersion(null);
    }
  }, [activeFiscalYear, selectedRegion, selectedDepartment, selectedDivision]);

  useEffect(() => {
    fetchCurrentVersion();
  }, [fetchCurrentVersion]);

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
      if (found) setSelectedRegion(found._id != null ? String(found._id) : String(regionParam));
      else setSelectedRegion(String(regionParam));
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

      // Use same scope as fetchRevisions so saved TierRevision is found when loading version history
      const saveData = {
        fiscalYear: String(activeFiscalYear),
        region: String(selectedRegion),
        department: String(selectedDepartmentName ?? ''),
        division: String(selectedDivisionName ?? ''),
        items: itemsArray,
        ...(revisionComment.trim() && { revisionComment: revisionComment.trim() }),
      };

      const saveRes = await api.post('/tier/data', saveData);
      const saved = JSON.stringify({ items: source });
      setLastSavedJson(saved);
      lastSavedJsonRef.current = saved;
      setIsDirty(false);
      const version = saveRes?.data?.version ?? saveRes?.data?.versionNumber;
      setSnackbar({
        open: true,
        message: version != null ? `Tier data saved successfully (Version ${version}).` : 'Tier data saved successfully.',
        severity: 'success',
      });
      setRevisionComment('');
      queryClient.invalidateQueries({ queryKey: ['tierSavedItems', activeFiscalYear, selectedRegion, selectedDepartmentName, selectedDivisionName] });
      try { await fetchCurrentVersion(); } catch (_) { /* ignore */ }
      if (revisionsDrawerOpen) fetchRevisions();
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
      // Single region param (ID only): backend normalizes to name. Do not add region name to avoid duplicate query keys.
      const regionVal = typeof selectedRegion === 'object' ? (selectedRegion?._id != null ? String(selectedRegion._id) : '') : String(selectedRegion ?? '');
      const params = new URLSearchParams();
      params.set('fiscalYear', String(activeFiscalYear));
      params.set('region', regionVal);
      params.set('department', String(selectedDepartmentName ?? ''));
      params.set('division', String(selectedDivisionName ?? ''));
      const res = await api.get(`/api/tier/revisions?${params.toString()}`);
      const data = res.data;
      setRevisions(Array.isArray(data?.revisions) ? data.revisions : (Array.isArray(data) ? data : []));
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

  const handleViewRevision = async (revisionId) => {
    setViewRevisionOpen(true);
    setViewRevisionDetail(null);
    setViewRevisionLoading(true);
    try {
      const res = await api.get(`/api/tier/revisions/${revisionId}`);
      setViewRevisionDetail(res.data);
    } catch (err) {
      console.error('Error fetching revision:', err);
      setSnackbar({ open: true, message: err?.response?.data?.message || 'Failed to load revision', severity: 'error' });
      setViewRevisionOpen(false);
    } finally {
      setViewRevisionLoading(false);
    }
  };

  const handleCloseViewRevision = () => {
    setViewRevisionOpen(false);
    setViewRevisionDetail(null);
  };

  const handleRestoreRevision = async (revisionId) => {
    setRestoringId(revisionId);
    try {
      const res = await api.post(`/api/tier/revisions/${revisionId}/restore`, { saveAsNewRevision: true });
      setSnackbar({ open: true, message: 'Revision restored. Refreshing table.', severity: 'success' });
      setRevisionsDrawerOpen(false);
      setViewRevisionOpen(false);
      setViewRevisionDetail(null);
      // Set cache directly from restore response so table shows the exact restored data (key must match TierTable: fiscalYear, region, departmentName, divisionName)
      const restoredItems = Array.isArray(res?.data?.tier?.items) ? res.data.tier.items : [];
      const savedItemsKey = ['tierSavedItems', activeFiscalYear, selectedRegion, selectedDepartmentName, selectedDivisionName];
      // Restore creates a new revision, so get the latest version (which will be the restored one)
      // The version will be updated via onVersionChange when saved-items query refetches
      queryClient.setQueryData(savedItemsKey, { items: restoredItems });
      queryClient.invalidateQueries({ queryKey: ['tierSavedItems'] });
      setTableKey(Date.now());
      setTierData(null);
      lastSavedJsonRef.current = null;
      setLastSavedJson(null);
      // Fetch latest version (restore creates new revision, so this will be the restored version)
      try { await fetchCurrentVersion(); } catch (_) { /* ignore */ }
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

  const formatCurrency = (val) => {
    const n = Number(val);
    if (isNaN(n)) return '₱0.00';
    return `₱${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

  // Names for API scope (backend stores department/division as names). Empty string when not selected.
  const selectedDepartmentName = selectedDepartment
    ? (departments.find(d => String(d._id) === String(selectedDepartment))?.Department || departments.find(d => String(d._id) === String(selectedDepartment))?.name || '')
    : '';
  const selectedDivisionName = selectedDivision
    ? (divisions.find(d => d.name === selectedDivision || String(d._id) === String(selectedDivision))?.name ?? selectedDivision)
    : '';

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
        version: currentVersion,
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
        version: currentVersion,
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
            value={typeof selectedRegion === 'string' ? selectedRegion : (selectedRegion?._id != null ? String(selectedRegion._id) : '')}
            label="Region"
            onChange={(e) => setSelectedRegion(e.target.value || '')}
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
          {isTierViewOnly && (
            <Chip label="View only (Budget Officer / Manager)" color="default" variant="outlined" size="small" />
          )}
          {currentVersion != null && (
            <Chip label={`Version ${currentVersion}`} color="primary" variant="outlined" size="small" />
          )}
          {!isTierViewOnly && (
            <Chip label={isDirty ? 'Unsaved changes' : 'All changes saved'} color={isDirty ? 'warning' : 'success'} />
          )}
          {!isTierViewOnly && (
            <>
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
            </>
          )}

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
        <>
          {!isTierViewOnly && (
            <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip size="small" label="Modified rows are highlighted" sx={{ backgroundColor: 'warning.light', fontWeight: 500 }} />
            </Box>
          )}
          <TierTable
            key={tableKey}
            fiscalYear={activeFiscalYear}
            region={selectedRegion}
            regionName={selectedRegion !== 'ALL' && regions?.find(r => r._id === selectedRegion || String(r._id) === String(selectedRegion))?.Region}
            department={selectedDepartment}
            division={selectedDivision}
            departmentName={selectedDepartmentName}
            divisionName={selectedDivisionName}
            onTierDataChange={setTierData}
            onVersionChange={setCurrentVersion}
            readOnly={isTierViewOnly}
          />
        </>
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
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid', borderColor: 'divider', py: 1.5, backgroundColor: '#1976d2', color: 'white' }}>
          <Typography variant="h6" component="span">Tier Report (PDF)</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<OpenInNewIcon />}
              onClick={() => pdfBlobUrl && window.open(pdfBlobUrl, '_blank', 'width=1200,height=800')}
              sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.7)', '&:hover': { borderColor: 'white', backgroundColor: 'rgba(255,255,255,0.1)' } }}
            >
              Buksan sa bagong tab
            </Button>
            <IconButton aria-label="close" onClick={handleClosePdfViewer} size="small" sx={{ color: 'white' }}>
              <CloseIcon />
            </IconButton>
          </Box>
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

      <Dialog
        open={revisionsDrawerOpen}
        onClose={() => setRevisionsDrawerOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: 1, borderColor: 'divider', py: 1.5 }}>
          <Box>
            <Typography variant="h6">Version history</Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              Only the latest 3 saves are kept. Version number = save count. <strong>Restore</strong> = ilalagay sa table ang <strong>exact data ng version na iyon</strong> (hindi babalik sa &quot;original&quot; o pinakauna — makikita mo kung ano ang na-save sa version na pinili mo).
            </Typography>
          </Box>
          <IconButton onClick={() => setRevisionsDrawerOpen(false)} aria-label="close" size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, overflow: 'auto', maxHeight: '70vh' }}>
          {revisionsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={32} />
            </Box>
          ) : revisions.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 3 }}>
              No revisions yet. Each time you save, that version is stored here (latest 3 only). Add a revision note when saving so you can tell them apart when restoring.
            </Typography>
          ) : (
            <List dense>
              {revisions.map((rev, index) => (
                <ListItem key={rev._id} divider>
                  <ListItemText
                    primary={
                      <Typography variant="subtitle1" fontWeight={600}>
                        {rev.comment && rev.comment.trim() ? rev.comment : `Saved revision v${rev.version}`}
                      </Typography>
                    }
                    secondary={
                      <>
                        <Typography component="span" variant="body2" color="text.secondary">
                          Version {rev.version}
                          {rev.fiscalYear ? ` · FY ${rev.fiscalYear}` : ''}
                          {index === 0 && ' (newest)'}
                          {' · '}
                          {formatRevisionDate(rev.createdAt)}
                        </Typography>
                        {(rev.createdBy || rev.createdByName) && (
                          <Typography component="span" variant="caption" display="block" color="text.secondary" sx={{ mt: 0.25 }}>
                            By {rev.createdBy ? (rev.createdBy.name || rev.createdBy.username) : rev.createdByName || '—'}
                          </Typography>
                        )}
                      </>
                    }
                  />
                  <ListItemSecondaryAction sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<VisibilityIcon />}
                      onClick={() => handleViewRevision(rev._id)}
                      disabled={viewRevisionLoading}
                    >
                      View
                    </Button>
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
        </DialogContent>
      </Dialog>

      {/* View revision dialog — view contents before restoring */}
      <Dialog
        open={viewRevisionOpen}
        onClose={handleCloseViewRevision}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: 1, borderColor: 'divider', py: 1.5 }}>
          <Typography variant="h6">View revision</Typography>
          <IconButton onClick={handleCloseViewRevision} aria-label="close" size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {viewRevisionLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={32} />
            </Box>
          ) : viewRevisionDetail ? (
            <>
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle1" fontWeight={600}>
                  {viewRevisionDetail.comment && viewRevisionDetail.comment.trim() ? viewRevisionDetail.comment : `Saved revision v${viewRevisionDetail.version}`}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Version {viewRevisionDetail.version} · {formatRevisionDate(viewRevisionDetail.createdAt)}
                  {((viewRevisionDetail.createdBy || viewRevisionDetail.createdByName)) && ` · By ${viewRevisionDetail.createdBy ? (viewRevisionDetail.createdBy.name || viewRevisionDetail.createdBy.username) : viewRevisionDetail.createdByName || '—'}`}
                </Typography>
              </Box>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Line items (Tier 1 / Tier 2)</Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 360, overflow: 'auto' }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Line item</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Tier 1</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Tier 2</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(Array.isArray(viewRevisionDetail.items) ? viewRevisionDetail.items : []).map((it, i) => {
                      const t1 = Number(it.tier1) || 0;
                      const t2 = Number(it.tier2) || 0;
                      return (
                        <TableRow key={it.lineItemId || i}>
                          <TableCell sx={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }} title={it.lineItemId}>{it.lineItemId || it.description || '—'}</TableCell>
                          <TableCell align="right">{formatCurrency(t1)}</TableCell>
                          <TableCell align="right">{formatCurrency(t2)}</TableCell>
                          <TableCell align="right">{formatCurrency(t1 + t2)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
              {(!viewRevisionDetail.items || viewRevisionDetail.items.length === 0) && (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>No line items in this revision.</Typography>
              )}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
                <Button variant="outlined" onClick={handleCloseViewRevision}>Close</Button>
                <Button variant="contained" color="primary" startIcon={<RestoreIcon />} onClick={() => handleRestoreRevision(viewRevisionDetail._id)} disabled={restoringId != null}>
                  {restoringId === viewRevisionDetail._id ? 'Restoring...' : 'Restore this version'}
                </Button>
              </Box>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

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
