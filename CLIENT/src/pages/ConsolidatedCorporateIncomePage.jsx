import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  AlertTitle,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Card,
  CardContent,
  Tab,
  Tabs,
  Chip,
  Stack,
  Switch,
  FormControlLabel,
  IconButton,
  Dialog,
  DialogContent,
  AppBar,
  Toolbar,
} from '@mui/material';
import { 
  Refresh, 
  PictureAsPdf,
  ExpandMore,
  ExpandLess,
  Summarize,
  ViewList,
  Analytics,
} from '@mui/icons-material';
import api from '../config/api';
import { useRegion } from '../context/RegionContext';
import { useUser } from '../context/UserContext';
import { isBRDLevelUser, hasApproverRole, isHighLevelAccess } from '../constants/roles';
import IncomeReportSummary from '../components/reports/IncomeReportSummary';
import ReportPageLayout from '../components/reports/ReportPageLayout';
import GenericPdfPreviewDialog from '../components/GenericPdfPreviewDialog';

const ConsolidatedCorporateIncomePage = () => {
  const { currentUser } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [fiscalYear, setFiscalYear] = useState('');
  const [budgetType, setBudgetType] = useState('INITIAL');
  const [fiscalYears, setFiscalYears] = useState([]);
  const [budgetTypes] = useState(['INITIAL', 'NEP', 'GAA']);
  const [activeTab, setActiveTab] = useState(0); // 0 for summary, 1 for categories, 2 for subcategories
  const [selectedRegions, setSelectedRegions] = useState('');
  const [consolidationType, setConsolidationType] = useState('current'); // current | all
  const [availableRegions, setAvailableRegions] = useState([]);
  const { activeRegion: regionFromContext } = useRegion();
  const activeRegionName = regionFromContext?.name || regionFromContext?.regionName || regionFromContext?.Region || '';
  const [showPercentages, setShowPercentages] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState(new Set());
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');
  const [pdfFilename, setPdfFilename] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [lastGeneratedParamsKey, setLastGeneratedParamsKey] = useState('');
  const [organizationStructure, setOrganizationStructure] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedDivision, setSelectedDivision] = useState('');

  // --- ROLE-BASED SCOPING LOGIC ---
  const hierarchical = useMemo(() => currentUser?.hierarchicalAccess || {}, [currentUser?.hierarchicalAccess]);
  const scope = useMemo(() => String(hierarchical.scope || hierarchical.assignmentLevel || "").toUpperCase(), [hierarchical]);
  const isHighLevel = useMemo(() => isHighLevelAccess(currentUser), [currentUser]);
  const isBRD = useMemo(() => isBRDLevelUser(currentUser), [currentUser]);

  // Enforce restriction: restricted roles (Preparer, Reviewer, Approver) are locked to "Current Region Only".
  // Only BRD-level roles (Analyst, Officer, Manager, SuperAdmin) can view All Regions.
  const isRestricted = useMemo(() => {
    if (!currentUser) return true;
    const roles = (currentUser.Roles || []).map(r => String(r || '').replace(/\s+/g, '_').toUpperCase());
    const hasRestrictedRole = roles.some(r => [
      'BUDGET_PREPARER', 'BUDGET_REVIEWER', 'BUDGET_APPROVER', 
      'REVIEWER', 'APPROVER', 'BUDGET_COORDINATOR'
    ].includes(r));
    const hasBRDRole = roles.some(r => [
      'SUPER_ADMIN', 'SUPERADMIN', 'BUDGET_MANAGER', 
      'BUDGET_OFFICER', 'BUDGET_PLANNING_ANALYST', 
      'OVERALL_BUDGET_APPROVER', 'BUDGET_ADMIN'
    ].includes(r));

    if (hasBRDRole) return false;
    if (hasRestrictedRole) return true;
    return !isBRD;
  }, [currentUser, isBRD]);

  const scopeNormalized = scope.replace(/_/g, ' ').trim();
  const isDepartmentRestricted = useMemo(() => {
    if (['DEPARTMENT', 'DIVISION', 'OFFICE', 'RESPONSIBILITY CENTER'].includes(scopeNormalized)) return true;
    if (isRestricted && scopeNormalized !== 'REGION' && scopeNormalized !== 'CENTRAL') return true;
    return false;
  }, [scopeNormalized, isRestricted]);

  const isDivisionRestricted = useMemo(() => {
    if (['DIVISION', 'RESPONSIBILITY CENTER'].includes(scopeNormalized)) return true;
    if (isRestricted && scopeNormalized !== 'REGION' && scopeNormalized !== 'CENTRAL' && scopeNormalized !== 'DEPARTMENT' && scopeNormalized !== 'OFFICE') return true;
    return false;
  }, [scopeNormalized, isRestricted]);

  // Enforce restrictions based on role/scope
  useEffect(() => {
    if (isRestricted) {
      if (consolidationType !== 'current') {
        setConsolidationType('current');
      }
      const userRegion = hierarchical.accessibleRegions?.[0]?.regionName || activeRegionName;
      if (userRegion && selectedRegions !== userRegion) {
        setSelectedRegions(userRegion);
      }
      if (isDepartmentRestricted) {
        let userDeptId = '';
        if (hierarchical.accessibleDepartments?.[0]) {
          userDeptId = String(hierarchical.accessibleDepartments[0]._id || hierarchical.accessibleDepartments[0].id);
        } else if (currentUser?.department && departments?.length > 0) {
          const matchedDept = departments.find(d => 
            String(d.Department || d.name).toUpperCase() === String(currentUser.department).toUpperCase()
          );
          if (matchedDept) userDeptId = String(matchedDept._id);
        }
        if (userDeptId && selectedDepartment !== userDeptId) {
          setSelectedDepartment(userDeptId);
        }
      }
      if (isDivisionRestricted) {
        let userDiv = '';
        if (hierarchical.accessibleDivisions?.[0]) {
          userDiv = hierarchical.accessibleDivisions[0];
        } else if (currentUser?.division) {
          userDiv = currentUser.division;
        }
        if (userDiv && selectedDivision !== userDiv) {
          setSelectedDivision(userDiv);
        }
      }
    }
  }, [isRestricted, scope, consolidationType, hierarchical, activeRegionName, selectedRegions, selectedDepartment, selectedDivision, isDepartmentRestricted, isDivisionRestricted, currentUser, departments]);

  const selectedDepartmentName = selectedDepartment
    ? (departments.find((d) => String(d._id) === String(selectedDepartment))?.Department || selectedDepartment)
    : '';
  const selectedDivisionName = selectedDivision
    ? (divisions.find((d) => d.name === selectedDivision || String(d._id) === String(selectedDivision))?.name ?? selectedDivision)
    : '';
  const effectiveRegionSelection = consolidationType === 'all' ? 'all' : selectedRegions;
  const currentParamsKey = useMemo(
    () => JSON.stringify({
      fiscalYear,
      budgetType,
      consolidationType,
      region: effectiveRegionSelection || '',
      department: String(selectedDepartment || ''),
      division: String(selectedDivision || ''),
    }),
    [fiscalYear, budgetType, consolidationType, effectiveRegionSelection, selectedDepartment, selectedDivision]
  );
  const hasReportData = Boolean(reportData?.hierarchicalData?.length);
  const canPreviewPdf = hasReportData && !loading && lastGeneratedParamsKey === currentParamsKey;
  
  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  // Toggle category expansion
  const toggleCategoryExpansion = (categoryId) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  // Fetch available fiscal years on component mount
  useEffect(() => {
    const fetchFiscalYears = async () => {
      try {
        // Try to get fiscal years from settings/active endpoint first
        try {
          const activeResponse = await api.get('/settings/active');
          if (activeResponse.data && activeResponse.data.fiscalYear) {
            // Use the active fiscal year and also include a few years before and after
            const activeYear = parseInt(activeResponse.data.fiscalYear);
            const years = [
              (activeYear - 2).toString(),
              (activeYear - 1).toString(),
              activeYear.toString(),
              (activeYear + 1).toString(),
              (activeYear + 2).toString()
            ];
            setFiscalYears(years);
            setFiscalYear(activeYear.toString());
            return; // Exit if we successfully got the active fiscal year
          }
        } catch (_) {
          // Continue to try other methods
        }
        
        // Try to get all settings
        try {
          const response = await api.get('/settings');
          if (response.data && response.data.data && Array.isArray(response.data.data)) {
            const years = response.data.data.map(setting => setting.fiscalYear);
            const uniqueYears = [...new Set(years)]; // Remove duplicates
            
            if (uniqueYears.length > 0) {
              setFiscalYears(uniqueYears);
              
              // Set default fiscal year to the most recent one
              const sortedYears = [...uniqueYears].sort((a, b) => b - a);
              setFiscalYear(sortedYears[0]);
              return; // Exit if we successfully got fiscal years
            }
          }
        } catch (_) {
          // Continue to try other methods
        }
        
        // If we're still here, use default years
        const currentYear = new Date().getFullYear();
        const defaultYears = [
          (currentYear - 2).toString(),
          (currentYear - 1).toString(),
          currentYear.toString(),
          (currentYear + 1).toString(),
          (currentYear + 2).toString()
        ];
        setFiscalYears(defaultYears);
        setFiscalYear(currentYear.toString());
        
      } catch (err) {
        console.error('Error in fiscal year fetching process:', err);
        // Final fallback
        const currentYear = new Date().getFullYear();
        const defaultYears = [
          (currentYear - 2).toString(),
          (currentYear - 1).toString(),
          currentYear.toString(),
          (currentYear + 1).toString(),
          (currentYear + 2).toString()
        ];
        setFiscalYears(defaultYears);
        setFiscalYear(currentYear.toString());
      }
    };

    fetchFiscalYears();
  }, []);

  useEffect(() => {
    const fetchOrgStructure = async () => {
      try {
        const res = await api.get('/api/hierarchical-rbac/organization-structure', { params: { structure: 'old' } });
        setOrganizationStructure(res.data?.data || res.data);
      } catch (err) {
        console.warn('Failed to fetch organization structure', err);
      }
    };
    fetchOrgStructure();
  }, []);

  useEffect(() => {
    const fetchAvailableRegions = async () => {
      try {
        const response = await api.get('/api/consolidated-reports/available-regions');
        setAvailableRegions(response.data?.regions || []);
      } catch (_) {
        setAvailableRegions([]);
      }
    };
    fetchAvailableRegions();
  }, []);

  useEffect(() => {
    if (consolidationType === 'all') return;
    if (selectedRegions) return;

    const fallbackRegion =
      activeRegionName ||
      availableRegions?.[0]?.name ||
      availableRegions?.[0]?.Region ||
      '';

    if (fallbackRegion) {
      setSelectedRegions(fallbackRegion);
    }
  }, [consolidationType, selectedRegions, activeRegionName, availableRegions]);

  useEffect(() => {
    if (!organizationStructure || consolidationType === 'all') {
      setDepartments([]);
      setDivisions([]);
      setSelectedDepartment('');
      setSelectedDivision('');
      return;
    }

    const selectedRegionName = String(selectedRegions || '').trim();
    if (!selectedRegionName) {
      setDepartments([]);
      setSelectedDepartment('');
      setSelectedDivision('');
      return;
    }

    const data = organizationStructure;
    const allDepts = data?.availableUnits?.departments || [];
    const mappings = data?.mappings || [];
    const orgRegions = data?.availableUnits?.regions || [];
    const norm = (s) => String(s || '').trim().toUpperCase();
    const rn = norm(selectedRegionName);
    const isExcludeRegionalAndIMO = rn === 'CENTRAL OFFICE' || rn === 'MARIIS' || rn === 'UPRIIS';
    const excludeNames = isExcludeRegionalAndIMO ? ['REGIONAL OFFICE', 'IRRIGATION MANAGEMENT OFFICE'] : [];

    let regionMappings = mappings.filter((m) => norm(m.regionName) === rn);
    if (regionMappings.length === 0 && isExcludeRegionalAndIMO) {
      const matchedOrgRegion = orgRegions.find((r) => norm(r.name || r.Region) === rn);
      if (matchedOrgRegion) {
        const altId = String(matchedOrgRegion.id || matchedOrgRegion._id);
        regionMappings = mappings.filter((m) => m.regionId && String(m.regionId) === altId);
      }
    }
    if (regionMappings.length === 0 && isExcludeRegionalAndIMO && allDepts.length > 0) {
      const depts = allDepts
        .filter((d) => !excludeNames.includes(norm(d.name || d.Department)))
        .map((d) => ({ _id: d.id || d._id, Department: d.name || d.Department, name: d.name || d.Department }));
      setDepartments(depts);
      setSelectedDepartment('');
      setSelectedDivision('');
      return;
    }

    let regionDeptIds = [...new Set(regionMappings.map((m) => m.departmentId?.toString()).filter(Boolean))];
    if (regionDeptIds.length === 0 && allDepts.length > 0 && !isExcludeRegionalAndIMO) {
      regionDeptIds = allDepts.map((d) => String(d.id || d._id));
    }
    const regionDepts = allDepts.filter((d) => {
      const id = d.id || d._id;
      return id && regionDeptIds.includes(String(id)) && !excludeNames.includes(norm(d.name || d.Department));
    });
    const depts = regionDepts.map((d) => ({
      _id: d.id || d._id,
      Department: d.name || d.Department,
      name: d.name || d.Department,
    }));
    setDepartments(depts);
    setSelectedDepartment('');
    setSelectedDivision('');
  }, [organizationStructure, selectedRegions, consolidationType]);

  useEffect(() => {
    if (!selectedDepartment || consolidationType === 'all') {
      setDivisions([]);
      setSelectedDivision('');
      return;
    }
    const norm = (s) => String(s || '').trim().toUpperCase();
    const selectedRegionName = String(selectedRegions || '').trim();
    const orgRegions = organizationStructure?.availableUnits?.regions || [];
    const matchedOrgRegion = orgRegions.find((r) => norm(r.name || r.Region) === norm(selectedRegionName));
    const regionId = String(matchedOrgRegion?.id || matchedOrgRegion?._id || '');
    const params = new URLSearchParams({ departmentId: selectedDepartment });
    if (regionId) params.set('regionId', regionId);
    api.get(`/api/hierarchical-rbac/divisions?${params.toString()}`)
      .then((res) => setDivisions(res.data?.data || res.data || []))
      .catch(() => setDivisions([]));
    setSelectedDivision('');
  }, [selectedDepartment, selectedRegions, consolidationType, organizationStructure]);

  useEffect(() => {
    return () => {
      if (pdfPreviewUrl) {
        window.URL.revokeObjectURL(pdfPreviewUrl);
      }
    };
  }, [pdfPreviewUrl]);

  const closePdfDialog = () => {
    setPdfPreviewOpen(false);
    if (pdfPreviewUrl) {
      window.URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl('');
    }
  };

  // Fetch report data
  const fetchReportData = async () => {
    if (!fiscalYear) {
      setError('Please select a fiscal year');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Make sure we're using the correct endpoint path and only sending required parameters
      const params = {
        fiscalYear,
        budgetType,
        ...(consolidationType === 'all' ? { region: 'all' } : {}),
        ...(consolidationType === 'current' && selectedRegions ? { region: selectedRegions } : {}),
        ...(selectedDepartmentName && consolidationType === 'current' ? { department: selectedDepartmentName } : {}),
        ...(selectedDivisionName && consolidationType === 'current' ? { division: selectedDivisionName } : {})
      };

      const response = await api.get('reports/consolidated-corporate-income', {
        params
      });

      if (response.data) {
        setReportData(response.data);
        setLastGeneratedParamsKey(currentParamsKey);
        setLoading(false);
      } else {
        setError('No data returned from the server. The report may be empty for the selected fiscal year and budget type.');
        setLoading(false);
      }
    } catch (err) {
      console.error('Error fetching report data:', err);
      // More detailed error logging
      if (err.response) {
        console.error('Response data:', err.response.data);
        console.error('Response status:', err.response.status);
      } else if (err.request) {
        console.error('No response received:', err.request);
      }
      
      let errorMessage = 'Failed to fetch report data. Please try again.';
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.message) {
        errorMessage = `Error: ${err.message}`;
      }
      
      setError(errorMessage);
      setLoading(false);
    }
  };

  // Auto-fetch report data once fiscalYear and region are available
  const autoFetchedRef = React.useRef(false);
  useEffect(() => {
    if (autoFetchedRef.current) return;
    if (!fiscalYear) return;
    // For 'current' consolidation type, wait until region is resolved
    if (consolidationType === 'current' && !selectedRegions) return;
    autoFetchedRef.current = true;
    fetchReportData();
  }, [fiscalYear, consolidationType, selectedRegions]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleExportToPDF = async () => {
    if (!canPreviewPdf) return;
    
    try {
      setPdfLoading(true);
      setError(null);
      
      const params = {
        fiscalYear,
        budgetType,
        selectedRegions: consolidationType === 'all' ? 'all' : selectedRegions,
        activeTab,
        showPercentages,
        ...(selectedDepartmentName && consolidationType === 'current' ? { department: selectedDepartmentName } : {}),
        ...(selectedDivisionName && consolidationType === 'current' ? { division: selectedDivisionName } : {})
      };

      const response = await api.post(
        '/reports/consolidated-corporate-income/export-pdf',
        params,
        { responseType: 'blob' }
      );

      // Extract filename from Content-Disposition header
      let filename = `Consolidated_Corporate_Income_${fiscalYear}_${budgetType}.pdf`;
      const contentDisposition = response.headers['content-disposition'];
      if (contentDisposition) {
        // Try to match filename* (UTF-8) first, then fallback to filename
        const filenameStarMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
        if (filenameStarMatch && filenameStarMatch[1]) {
          filename = decodeURIComponent(filenameStarMatch[1]);
        } else {
          const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
          if (filenameMatch && filenameMatch[1]) {
            filename = filenameMatch[1];
          }
        }
      }
      setPdfFilename(filename);

      // Verify we actually got a PDF blob
      if (response.data.type !== 'application/pdf') {
        // Try to parse the blob as JSON to see if it's an error message
        const text = await response.data.text();
        try {
          const json = JSON.parse(text);
          setError(json.error || json.message || 'Failed to generate PDF. Server returned an invalid response.');
        } catch (_) {
          setError('Failed to generate PDF. Server returned an invalid file type.');
        }
        return;
      }

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      
      if (pdfPreviewUrl) window.URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(url);
      setPdfPreviewOpen(true);
    } catch (err) {
      console.error('Error generating PDF preview:', err);
      setError('Failed to generate PDF preview. Please try again.');
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <ReportPageLayout
      title="CONSOLIDATED CORPORATE INCOME REPORT"
      subtitle={
        consolidationType === 'all'
          ? 'Consolidated income data from all regions'
          : `Consolidated income data for ${selectedRegions || activeRegionName || 'selected region'}`
      }
      showNiaBranding={true}
      breadcrumbLabel="Consolidated Corporate Income"
      fiscalYear={fiscalYear || new Date().getFullYear().toString()}
    >
      <Paper elevation={2} sx={{ p: 3, mb: 3, bgcolor: 'background.paper' }}>
        <Card sx={{ mb: 3, bgcolor: 'grey.50' }} elevation={0} variant="outlined">
          <CardContent>
            <Typography variant="h6" gutterBottom color="primary" sx={{ mb: 2 }}>
              Report Configuration
            </Typography>
            
            <Grid container spacing={3} alignItems="center">
              {/* Filter Controls */}
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel id="consolidation-type-label">Consolidation Type</InputLabel>
                  <Select
                    labelId="consolidation-type-label"
                    value={consolidationType}
                    label="Consolidation Type"
                    disabled={isRestricted}
                    onChange={(e) => {
                      const nextType = e.target.value;
                      setConsolidationType(nextType);
                      if (nextType === 'all') {
                        setSelectedRegions('all');
                      } else {
                        setSelectedRegions(activeRegionName || '');
                      }
                      setSelectedDepartment('');
                      setSelectedDivision('');
                    }}
                  >
                    <MenuItem value="current">Current Region</MenuItem>
                    {!isRestricted && <MenuItem value="all">All Regions</MenuItem>}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel id="fiscal-year-label">Fiscal Year</InputLabel>
                  <Select
                    labelId="fiscal-year-label"
                    id="fiscal-year"
                    value={fiscalYear}
                    label="Fiscal Year"
                    onChange={(e) => setFiscalYear(e.target.value)}
                  >
                    {fiscalYears.map((year) => (
                      <MenuItem key={year} value={year}>
                        {year}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel id="budget-type-label">Budget Type</InputLabel>
                  <Select
                    labelId="budget-type-label"
                    id="budget-type"
                    value={budgetType}
                    label="Budget Type"
                    onChange={(e) => setBudgetType(e.target.value)}
                  >
                    {budgetTypes.map((type) => (
                      <MenuItem key={type} value={type}>
                        {type}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Region Selector */}
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small" disabled={consolidationType === 'all' || isRestricted}>
                  <InputLabel id="region-filter-label">Region</InputLabel>
                  <Select
                    labelId="region-filter-label"
                    id="region-filter"
                    value={consolidationType === 'all' ? 'all' : selectedRegions}
                    label="Region"
                    onChange={(e) => {
                      setSelectedRegions(e.target.value);
                      setSelectedDepartment('');
                      setSelectedDivision('');
                    }}
                  >
                    {(availableRegions || []).map((regionObj) => {
                      const region = regionObj?.name || regionObj?.Region;
                      return (
                        <MenuItem key={region} value={region}>
                          {region}
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
              </Grid>

              {/* View Options */}
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel id="department-filter-label">Department</InputLabel>
                  <Select
                    labelId="department-filter-label"
                    value={String(selectedDepartment ?? '')}
                    label="Department"
                    disabled={consolidationType === 'all' || departments.length === 0 || isDepartmentRestricted}
                    onChange={(e) => {
                      setSelectedDepartment(e.target.value || '');
                      setSelectedDivision('');
                    }}
                  >
                    <MenuItem value=""><em>All Departments</em></MenuItem>
                    {departments.map((dept, idx) => {
                      const val = dept._id != null ? String(dept._id) : `dept-${idx}`;
                      return (
                        <MenuItem key={val} value={val}>
                          {dept.Department || dept.name || 'Unnamed Department'}
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel id="division-filter-label">Division</InputLabel>
                  <Select
                    labelId="division-filter-label"
                    value={String(selectedDivision ?? '')}
                    label="Division"
                    disabled={consolidationType === 'all' || !selectedDepartment || divisions.length === 0 || isDivisionRestricted}
                    onChange={(e) => setSelectedDivision(e.target.value || '')}
                  >
                    <MenuItem value=""><em>All Divisions</em></MenuItem>
                    {divisions.map((div, idx) => {
                      const val = div.name != null && div.name !== '' ? String(div.name) : (div._id != null ? String(div._id) : `div-${idx}`);
                      return (
                        <MenuItem key={val} value={val}>
                          {div.name || 'Unnamed Division'}
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={3}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={showPercentages}
                      onChange={(e) => setShowPercentages(e.target.checked)}
                      size="small"
                    />
                  }
                  label="Show Percentages"
                />
              </Grid>

              {/* Action Buttons */}
              <Grid item xs={12}>
                <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                  <Button
                    variant="outlined"
                    color="success"
                    onClick={fetchReportData}
                    disabled={loading || !fiscalYear}
                    startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <Refresh />}
                    sx={{ minWidth: 140, fontWeight: 600 }}
                  >
                    {loading ? 'Loading...' : 'Refresh'}
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={handleExportToPDF}
                    disabled={!canPreviewPdf || pdfLoading}
                    startIcon={pdfLoading ? <CircularProgress size={20} color="inherit" /> : <PictureAsPdf />}
                    sx={{ minWidth: 140, fontWeight: 600 }}
                  >
                    {pdfLoading ? 'Preparing PDF...' : 'PDF Preview'}
                  </Button>
                </Stack>
                {hasReportData && !canPreviewPdf && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Please click Refresh first to generate report data for the current filters before opening PDF Preview.
                  </Typography>
                )}
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Error Message */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} elevation={2}>
            <AlertTitle>Error</AlertTitle>
            {error}
          </Alert>
        )}

        {/* Report Data */}
        {reportData && (
          <Card elevation={3}>
            <CardContent>
              {/* Report Header */}
              <Box sx={{ mb: 3, textAlign: 'center' }}>
                <Typography variant="h5" gutterBottom color="primary" fontWeight="bold">
                  Corporate Income Analysis - FY {reportData.fiscalYear} ({reportData.budgetType})
                </Typography>
                
                {/* Summary Stats */}
                <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 2, mb: 3 }}>
                  <Chip 
                    icon={<Analytics />}
                    label={`Total Income: ₱${reportData.grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                    color="primary"
                    variant="filled"
                    sx={{ fontSize: '1rem', py: 2 }}
                  />
                  <Chip 
                    label={`${reportData.regions?.length || 0} Regions`}
                    color="secondary"
                    variant="outlined"
                  />
                  <Chip 
                    label={`${reportData.hierarchicalData?.length || 0} Categories`}
                    color="info"
                    variant="outlined"
                  />
                </Stack>
              </Box>
              
              {reportData.message ? (
                <Alert severity="info" sx={{ mt: 2 }}>
                  <AlertTitle>No Data Available</AlertTitle>
                  {reportData.message}
                </Alert>
              ) : !reportData.hierarchicalData || reportData.hierarchicalData.length === 0 ? (
                <Alert severity="info" sx={{ mt: 2 }}>
                  <AlertTitle>No Categories Found</AlertTitle>
                  No income categories are defined in the system. Please add income categories first.
                </Alert>
              ) : !reportData.regions || reportData.regions.length === 0 ? (
                <Alert severity="info" sx={{ mt: 2 }}>
                  <AlertTitle>No Regions Found</AlertTitle>
                  No regions are defined in the system. Please add regions first.
                </Alert>
              ) : reportData.grandTotal === 0 ? (
                <Alert severity="info" sx={{ mt: 2 }}>
                  <AlertTitle>No Income Data</AlertTitle>
                  No income data found for the selected fiscal year ({reportData.fiscalYear}) and budget type ({reportData.budgetType}).
                </Alert>
              ) : (
                <>
                  {/* Tab Navigation */}
                  <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                    <Tabs 
                      value={activeTab} 
                      onChange={handleTabChange}
                      aria-label="report tabs"
                      variant="fullWidth"
                    >
                      <Tab 
                        icon={<Summarize />} 
                        label="Executive Summary" 
                        iconPosition="start"
                      />
                      <Tab 
                        icon={<ViewList />} 
                        label="Category Breakdown" 
                        iconPosition="start"
                      />
                      <Tab 
                        icon={<Analytics />} 
                        label="Subcategory Details" 
                        iconPosition="start"
                      />
                    </Tabs>
                  </Box>
                      
                  {/* Executive Summary Tab */}
                  {activeTab === 0 && (
                    <IncomeReportSummary 
                      reportData={reportData} 
                      showPercentages={showPercentages}
                    />
                  )}
                      
                  {/* Category Breakdown Tab */}
                  {activeTab === 1 && (
                    <TableContainer component={Paper} sx={{ backgroundColor: '#fafafa' }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                            <TableCell 
                              sx={{ 
                                fontWeight: 700, 
                                color: '#475569',
                                borderBottom: '2px solid #e2e8f0',
                                width: '300px',
                                textTransform: 'uppercase',
                                fontSize: '0.75rem',
                                letterSpacing: '0.5px'
                              }}
                            >
                              Income Category / Subcategory
                            </TableCell>
                            {reportData.regions
                              .filter(region => consolidationType === 'all' || selectedRegions === region)
                              .map((region) => (
                                <TableCell 
                                  key={region} 
                                  align="right"
                                  sx={{ 
                                    fontWeight: 700, 
                                    color: '#475569',
                                    borderBottom: '2px solid #e2e8f0',
                                    textTransform: 'uppercase',
                                    fontSize: '0.75rem',
                                    letterSpacing: '0.5px'
                                  }}
                                >
                                  {region}
                                </TableCell>
                              ))}
                            <TableCell 
                              align="right"
                              sx={{ 
                                fontWeight: 800, 
                                backgroundColor: '#f8fafc',
                                color: '#1e293b',
                                borderBottom: '2px solid #e2e8f0',
                                textTransform: 'uppercase',
                                fontSize: '0.75rem',
                                letterSpacing: '0.5px'
                              }}
                            >
                              Total
                            </TableCell>
                            {showPercentages && (
                              <TableCell 
                                align="right"
                                sx={{ 
                                  fontWeight: 800, 
                                  backgroundColor: '#f8fafc',
                                  color: '#1e293b',
                                  borderBottom: '2px solid #e2e8f0',
                                  textTransform: 'uppercase',
                                  fontSize: '0.75rem',
                                  letterSpacing: '0.5px'
                                }}
                              >
                                %
                              </TableCell>
                            )}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {reportData.hierarchicalData.map((category) => {
                            const categoryTotal = reportData.categoryTotals[category.id] || 0;
                            const categoryPercentage = reportData.grandTotal > 0 ? (categoryTotal / reportData.grandTotal * 100) : 0;
                            const isExpanded = expandedCategories.has(category.id);
                            
                            const categoryRows = [];
                            
                            // Add the category row with expand/collapse functionality
                            categoryRows.push(
                              <TableRow 
                                key={`category-${category.id}`} 
                                sx={{ 
                                  backgroundColor: category.isNetIsf 
                                    ? '#e8f5e9' 
                                    : category.isDiscount 
                                      ? '#ffebee' 
                                      : '#ffffff',
                                  '&:hover': { 
                                    backgroundColor: category.isNetIsf 
                                      ? '#e0f2f1' 
                                      : category.isDiscount 
                                        ? '#ffcdd2' 
                                        : 'rgba(55, 94, 56, 0.04)' 
                                  }
                                }}
                              >
                                <TableCell sx={{ 
                                  fontWeight: 600, 
                                  color: category.isDiscount ? '#d32f2f' : category.isNetIsf ? '#2e7d32' : '#1e293b',
                                  fontStyle: category.isDiscount ? 'italic' : 'normal'
                                }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    {category.subcategories && category.subcategories.length > 0 && (
                                      <IconButton 
                                        size="small" 
                                        onClick={() => toggleCategoryExpansion(category.id)}
                                        sx={{ mr: 1 }}
                                      >
                                        {isExpanded ? <ExpandLess /> : <ExpandMore />}
                                      </IconButton>
                                    )}
                                    {category.name}
                                  </Box>
                                </TableCell>
                                {reportData.regions
                                  .filter(region => consolidationType === 'all' || selectedRegions === region)
                                  .map((region) => (
                                    <TableCell key={`${region}-${category.id}`} align="right" sx={{
                                      color: category.isDiscount ? '#d32f2f' : category.isNetIsf ? '#2e7d32' : 'inherit',
                                      fontStyle: category.isDiscount ? 'italic' : 'normal'
                                    }}>
                                      {category.isDiscount ? '(' : ''}₱{(reportData.regionData[region]?.categoryAmounts[category.id] || 0)
                                        .toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{category.isDiscount ? ')' : ''}
                                    </TableCell>
                                  ))}
                                <TableCell align="right" sx={{ 
                                  fontWeight: 'bold', 
                                  color: category.isDiscount ? '#d32f2f' : '#2e7d32',
                                  fontStyle: category.isDiscount ? 'italic' : 'normal'
                                }}>
                                  {category.isDiscount ? '(' : ''}₱{categoryTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{category.isDiscount ? ')' : ''}
                                </TableCell>
                                {showPercentages && (
                                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                                    {category.isDiscount ? '' : categoryPercentage.toFixed(1) + '%'}
                                  </TableCell>
                                )}
                              </TableRow>
                            );
                            
                            // Add subcategory rows (collapsed/expanded based on state)
                            if (isExpanded && category.subcategories && category.subcategories.length > 0) {
                              category.subcategories.forEach((subcategory) => {
                                const subcategoryTotal = reportData.subcategoryTotals[subcategory.id] || 0;
                                const subcategoryPercentage = reportData.grandTotal > 0 ? (subcategoryTotal / reportData.grandTotal * 100) : 0;
                                
                                categoryRows.push(
                                  <TableRow key={`subcategory-${category.id}-${subcategory.id}`}>
                                    <TableCell sx={{ paddingLeft: '60px', color: '#666' }}>
                                      {subcategory.name}
                                    </TableCell>
                                    {reportData.regions
                                      .filter(region => consolidationType === 'all' || selectedRegions === region)
                                      .map((region) => (
                                        <TableCell key={`${region}-${subcategory.id}`} align="right">
                                          ₱{(reportData.regionData[region]?.subcategoryAmounts[subcategory.id] || 0)
                                            .toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </TableCell>
                                      ))}
                                    <TableCell align="right" sx={{ color: '#2e7d32' }}>
                                      ₱{subcategoryTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </TableCell>
                                    {showPercentages && (
                                      <TableCell align="right">
                                        {subcategoryPercentage.toFixed(1)}%
                                      </TableCell>
                                    )}
                                  </TableRow>
                                );
                              });
                            }
                            
                            return categoryRows;
                          })}
                          
                          {/* Total Row */}
                          <TableRow 
                            sx={{ 
                              backgroundColor: '#f8fafc', 
                              borderTop: '2px solid #cbd5e1'
                            }}
                          >
                            <TableCell sx={{ fontWeight: 800, fontSize: '0.875rem', color: '#1e293b', borderBottom: 'none' }}>
                              GRAND TOTAL
                            </TableCell>
                            {reportData.regions
                              .filter(region => consolidationType === 'all' || selectedRegions === region)
                              .map((region) => (
                                <TableCell 
                                  key={`total-${region}`} 
                                  align="right" 
                                  sx={{ fontWeight: 800, fontSize: '0.875rem', color: '#1e293b', borderBottom: 'none' }}
                                >
                                  ₱{(reportData.regionData[region]?.total || 0)
                                    .toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </TableCell>
                              ))}
                            <TableCell 
                              align="right" 
                              sx={{ fontWeight: 800, fontSize: '0.875rem', color: '#375e38', borderBottom: 'none' }}
                            >
                              ₱{reportData.grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                            {showPercentages && (
                              <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                                100.0%
                              </TableCell>
                            )}
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                      
                  {/* Subcategory Details Tab - Tree View */}
                  {activeTab === 2 && (
                    <>
                      {(() => {
                        // Group subcategories by parent category for tree view
                        const categoriesWithSubcategories = [];
                        if (reportData.hierarchicalData) {
                          reportData.hierarchicalData.forEach(category => {
                            if (category.subcategories && category.subcategories.length > 0) {
                              categoriesWithSubcategories.push({
                                ...category,
                                subcategories: category.subcategories
                              });
                            }
                          });
                        }
                        
                        return categoriesWithSubcategories.length > 0 ? (
                          <TableContainer component={Paper} sx={{ backgroundColor: '#fafafa' }}>
                            <Table size="small" stickyHeader>
                              <TableHead>
                                <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                                  <TableCell 
                                    sx={{ 
                                      fontWeight: 700, 
                                      color: '#475569',
                                      borderBottom: '2px solid #e2e8f0',
                                      width: '300px',
                                      textTransform: 'uppercase',
                                      fontSize: '0.75rem',
                                      letterSpacing: '0.5px'
                                    }}
                                  >
                                    Income Category / Subcategory (Tree View)
                                  </TableCell>
                                  {reportData.regions
                                    .filter(region => consolidationType === 'all' || selectedRegions === region)
                                    .map((region) => (
                                      <TableCell 
                                        key={region} 
                                        align="right"
                                        sx={{ 
                                          fontWeight: 700, 
                                          color: '#475569',
                                          borderBottom: '2px solid #e2e8f0',
                                          textTransform: 'uppercase',
                                          fontSize: '0.75rem',
                                          letterSpacing: '0.5px'
                                        }}
                                      >
                                        {region}
                                      </TableCell>
                                    ))}
                                  <TableCell 
                                    align="right"
                                    sx={{ 
                                      fontWeight: 800, 
                                      backgroundColor: '#f8fafc',
                                      color: '#1e293b',
                                      borderBottom: '2px solid #e2e8f0',
                                      textTransform: 'uppercase',
                                      fontSize: '0.75rem',
                                      letterSpacing: '0.5px'
                                    }}
                                  >
                                    Total
                                  </TableCell>
                                  {showPercentages && (
                                    <TableCell 
                                      align="right"
                                    sx={{ 
                                      fontWeight: 800, 
                                      backgroundColor: '#f8fafc',
                                      color: '#1e293b',
                                      borderBottom: '2px solid #e2e8f0',
                                      textTransform: 'uppercase',
                                      fontSize: '0.75rem',
                                      letterSpacing: '0.5px'
                                    }}
                                  >
                                    %
                                </TableCell>
                                  )}
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {categoriesWithSubcategories
                                  .sort((a, b) => a.name.localeCompare(b.name))
                                  .map((category) => {
                                    const categoryTotal = reportData.categoryTotals[category.id] || 0;
                                    const categoryPercentage = reportData.grandTotal > 0 ? (categoryTotal / reportData.grandTotal * 100) : 0;
                                    
                                    return (
                                      <React.Fragment key={category.id}>
                                        {/* Parent Category Row */}
                                        <TableRow sx={{ 
                                          backgroundColor: '#e1f5fe',
                                          '&:hover': { backgroundColor: '#b3e5fc' }
                                        }}>
                                          <TableCell sx={{ 
                                            fontWeight: 'bold', 
                                            fontSize: '1rem',
                                            color: '#0277bd',
                                            borderLeft: '4px solid #0288d1'
                                          }}>
                                            📁 {category.name}
                                          </TableCell>
                                          {reportData.regions
                                            .filter(region => consolidationType === 'all' || selectedRegions === region)
                                            .map((region) => (
                                              <TableCell key={`${region}-${category.id}`} align="right" sx={{ fontWeight: 'bold' }}>
                                                ₱{(reportData.regionData[region]?.categoryAmounts[category.id] || 0)
                                                  .toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                              </TableCell>
                                            ))}
                                          <TableCell align="right" sx={{ fontWeight: 'bold', color: '#0277bd' }}>
                                            ₱{categoryTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                          </TableCell>
                                          {showPercentages && (
                                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                                              {categoryPercentage.toFixed(1)}%
                                            </TableCell>
                                          )}
                                        </TableRow>
                                        
                                        {/* Subcategory Rows */}
                                        {category.subcategories
                                          .sort((a, b) => a.name.localeCompare(b.name))
                                          .map((subcategory) => {
                                            const subcategoryTotal = reportData.subcategoryTotals[subcategory.id] || 0;
                                            const subcategoryPercentage = reportData.grandTotal > 0 ? (subcategoryTotal / reportData.grandTotal * 100) : 0;
                                            
                                            return (
                                              <TableRow key={subcategory.id} sx={{ 
                                                '&:hover': { backgroundColor: '#f5f5f5' },
                                                backgroundColor: '#fafafa'
                                              }}>
                                                <TableCell sx={{ 
                                                  fontWeight: 'medium',
                                                  paddingLeft: '2rem',
                                                  color: '#424242',
                                                  borderLeft: '2px solid #e0e0e0'
                                                }}>
                                                  └── 📄 {subcategory.name}
                                                </TableCell>
                                                {reportData.regions
                                                  .filter(region => consolidationType === 'all' || selectedRegions === region)
                                                  .map((region) => (
                                                    <TableCell key={`${region}-${subcategory.id}`} align="right">
                                                      ₱{(reportData.regionData[region]?.subcategoryAmounts[subcategory.id] || 0)
                                                        .toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </TableCell>
                                                  ))}
                                                <TableCell align="right" sx={{ fontWeight: 'bold', color: '#2e7d32' }}>
                                                  ₱{subcategoryTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </TableCell>
                                                {showPercentages && (
                                                  <TableCell align="right">
                                                    {subcategoryPercentage.toFixed(1)}%
                                                  </TableCell>
                                                )}
                                              </TableRow>
                                            );
                                          })}
                                      </React.Fragment>
                                    );
                                  })}
                                
                                {/* Total Row */}
                                <TableRow 
                                  sx={{ 
                                    backgroundColor: '#f8fafc', 
                                    borderTop: '2px solid #cbd5e1' 
                                  }}
                                >
                                  <TableCell sx={{ fontWeight: 800, fontSize: '0.875rem', color: '#1e293b', borderBottom: 'none' }}>
                                    🏆 GRAND TOTAL
                                  </TableCell>
                                  {reportData.regions
                                    .filter(region => consolidationType === 'all' || selectedRegions === region)
                                    .map((region) => (
                                      <TableCell 
                                        key={`total-${region}`} 
                                        align="right" 
                                        sx={{ fontWeight: 800, fontSize: '0.875rem', color: '#1e293b', borderBottom: 'none' }}
                                      >
                                        ₱{(reportData.regionData[region]?.total || 0)
                                          .toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </TableCell>
                                    ))}
                                  <TableCell 
                                    align="right" 
                                    sx={{ fontWeight: 800, fontSize: '0.875rem', color: '#375e38', borderBottom: 'none' }}
                                  >
                                    ₱{reportData.grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </TableCell>
                                  {showPercentages && (
                                    <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                                      100.0%
                                    </TableCell>
                                  )}
                                </TableRow>
                              </TableBody>
                            </Table>
                          </TableContainer>
                        ) : (
                          <Alert severity="info" sx={{ mt: 2 }}>
                            <AlertTitle>No Subcategories Found</AlertTitle>
                            No income subcategories are defined in the system or no income data is associated with subcategories.
                          </Alert>
                        );
                      })()}
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}
      </Paper>

      <GenericPdfPreviewDialog
        open={pdfPreviewOpen}
        onClose={closePdfDialog}
        pdfUrl={pdfPreviewUrl}
        title="Consolidated Corporate Income PDF Preview"
        downloadFilename={pdfFilename}
      />
    </ReportPageLayout>
  );
};

export default ConsolidatedCorporateIncomePage;