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
  Checkbox,
  Chip,
  Stack,
  Switch,
  FormControlLabel,
  IconButton,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  Refresh,
  PictureAsPdf,
  ExpandMore,
  ExpandLess,
  Search,
  Clear,
  Public,
  Category,
  AccountTree,
  Payments,
} from '@mui/icons-material';
import api from '../config/api';
import { useRegion } from '../context/RegionContext';
import { useUser } from '../context/UserContext';
import { isBRDLevelUser } from '../constants/roles';
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
  const [selectedRegions, setSelectedRegions] = useState('');
  const [customRegions, setCustomRegions] = useState([]);
  const [consolidationType, setConsolidationType] = useState('current'); // current | all | custom
  const [availableRegions, setAvailableRegions] = useState([]);
  const { activeRegion: regionFromContext } = useRegion();
  const activeRegionName = regionFromContext?.name || regionFromContext?.regionName || regionFromContext?.Region || '';
  const [showPercentages, setShowPercentages] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
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
  const effectiveRegionSelection = useMemo(() => {
    if (consolidationType === 'all') return 'all';
    if (consolidationType === 'custom') {
      return [...customRegions]
        .map((regionName) => String(regionName || '').trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
    }
    return selectedRegions;
  }, [consolidationType, customRegions, selectedRegions]);
  const hasValidRegionSelection =
    consolidationType !== 'custom' || customRegions.length > 0;
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
  const canPreviewPdf =
    hasReportData &&
    hasValidRegionSelection &&
    !loading &&
    lastGeneratedParamsKey === currentParamsKey;
  
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
    if (consolidationType !== 'current') return;
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
    if (!organizationStructure || consolidationType !== 'current') {
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
    if (!selectedDepartment || consolidationType !== 'current') {
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

    if (!hasValidRegionSelection) {
      setError('Select at least one region for a custom consolidated report.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.append('fiscalYear', fiscalYear);
      params.append('budgetType', budgetType);
      params.append('consolidationType', consolidationType);
      if (consolidationType === 'all') {
        params.append('region', 'all');
      } else if (consolidationType === 'custom') {
        customRegions.forEach((regionName) => params.append('regions', regionName));
      } else if (selectedRegions) {
        params.append('region', selectedRegions);
      }
      if (selectedDepartmentName && consolidationType === 'current') {
        params.append('department', selectedDepartmentName);
      }
      if (selectedDivisionName && consolidationType === 'current') {
        params.append('division', selectedDivisionName);
      }

      const response = await api.get('reports/consolidated-corporate-income', {
        params,
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
    if (consolidationType === 'custom' && customRegions.length === 0) return;
    autoFetchedRef.current = true;
    fetchReportData();
  }, [fiscalYear, consolidationType, selectedRegions, customRegions]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleExportToPDF = async () => {
    if (!canPreviewPdf) return;
    
    try {
      setPdfLoading(true);
      setError(null);
      
      const params = {
        fiscalYear,
        budgetType,
        consolidationType,
        selectedRegions:
          consolidationType === 'all'
            ? 'all'
            : consolidationType === 'custom'
              ? customRegions
              : selectedRegions,
        activeTab: 1,
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


  const availableRegionNames = useMemo(
    () =>
      (availableRegions || [])
        .map((regionObject) =>
          typeof regionObject === 'string'
            ? regionObject
            : regionObject?.name || regionObject?.Region
        )
        .filter(Boolean),
    [availableRegions]
  );

  const visibleRegions = useMemo(
    () => {
      const selectedCustomRegions = new Set(
        customRegions.map((regionName) => String(regionName || '').trim().toLowerCase())
      );
      return (reportData?.regions || []).filter((region) => {
        if (consolidationType === 'all') return true;
        if (consolidationType === 'custom') {
          return selectedCustomRegions.has(String(region || '').trim().toLowerCase());
        }
        return String(selectedRegions || '').trim().toLowerCase() ===
          String(region || '').trim().toLowerCase();
      });
    },
    [reportData?.regions, consolidationType, customRegions, selectedRegions]
  );

  const visibleCategories = useMemo(() => {
    const categories = reportData?.hierarchicalData || [];
    const query = searchTerm.trim().toLowerCase();
    if (!query) return categories;

    return categories.reduce((matches, categoryItem) => {
      const categoryMatches = String(categoryItem.name || '').toLowerCase().includes(query);
      const matchingSubcategories = (categoryItem.subcategories || []).filter((subcategory) =>
        String(subcategory.name || '').toLowerCase().includes(query)
      );
      if (categoryMatches) {
        matches.push(categoryItem);
      } else if (matchingSubcategories.length > 0) {
        matches.push({ ...categoryItem, subcategories: matchingSubcategories });
      }
      return matches;
    }, []);
  }, [reportData?.hierarchicalData, searchTerm]);

  const subcategoryCount = useMemo(
    () =>
      (reportData?.hierarchicalData || []).reduce(
        (total, categoryItem) => total + (categoryItem.subcategories?.length || 0),
        0
      ),
    [reportData?.hierarchicalData]
  );

  const expandableCategoryIds = useMemo(
    () =>
      visibleCategories
        .filter((categoryItem) => categoryItem.subcategories?.length > 0)
        .map((categoryItem) => categoryItem.id),
    [visibleCategories]
  );

  const allVisibleExpanded =
    expandableCategoryIds.length > 0 &&
    expandableCategoryIds.every((categoryId) => expandedCategories.has(categoryId));

  const toggleExpandAll = () => {
    setExpandedCategories((previous) => {
      const next = new Set(previous);
      if (allVisibleExpanded) {
        expandableCategoryIds.forEach((categoryId) => next.delete(categoryId));
      } else {
        expandableCategoryIds.forEach((categoryId) => next.add(categoryId));
      }
      return next;
    });
  };

  const metricItems = [
    {
      label: 'Regions',
      value: visibleRegions.length,
      icon: <Public sx={{ fontSize: 30, color: '#375e38' }} />,
    },
    {
      label: 'Categories',
      value: reportData?.hierarchicalData?.length || 0,
      icon: <Category sx={{ fontSize: 30, color: '#375e38' }} />,
    },
    {
      label: 'Subcategories',
      value: subcategoryCount,
      icon: <AccountTree sx={{ fontSize: 30, color: '#375e38' }} />,
    },
    {
      label: 'Total Income',
      value: '₱' + Number(reportData?.grandTotal || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      icon: <Payments sx={{ fontSize: 30, color: '#375e38' }} />,
    },
  ];

  return (
    <ReportPageLayout
      title="CONSOLIDATED CORPORATE INCOME REPORT"
      subtitle={
        consolidationType === 'all'
          ? 'Consolidated income data from all regions'
          : consolidationType === 'custom'
            ? customRegions.length > 0
              ? 'Consolidated income data for selected regions: ' + customRegions.join(', ')
              : 'Select regions to build a custom consolidated report'
            : 'Consolidated income data for ' +
              (selectedRegions || activeRegionName || 'selected region')
      }
      showNiaBranding={true}
      breadcrumbLabel="Consolidated Corporate Income"
      fiscalYear={fiscalYear || new Date().getFullYear().toString()}
    >
      <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel id="fiscal-year-label">Fiscal Year</InputLabel>
              <Select
                labelId="fiscal-year-label"
                id="fiscal-year"
                value={fiscalYear}
                label="Fiscal Year"
                onChange={(event) => setFiscalYear(event.target.value)}
              >
                {fiscalYears.map((year) => (
                  <MenuItem key={year} value={year}>{year}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel id="budget-type-label">Budget Type</InputLabel>
              <Select
                labelId="budget-type-label"
                id="budget-type"
                value={budgetType}
                label="Budget Type"
                onChange={(event) => setBudgetType(event.target.value)}
              >
                {budgetTypes.map((type) => (
                  <MenuItem key={type} value={type}>{type}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel id="consolidation-type-label">Consolidation Type</InputLabel>
              <Select
                labelId="consolidation-type-label"
                value={consolidationType}
                label="Consolidation Type"
                disabled={isRestricted}
                onChange={(event) => {
                  const nextType = event.target.value;
                  setConsolidationType(nextType);
                  if (nextType === 'all') {
                    setSelectedRegions('all');
                  } else if (nextType === 'current') {
                    setSelectedRegions(activeRegionName || '');
                  }
                  setSelectedDepartment('');
                  setSelectedDivision('');
                  setError(null);
                }}
              >
                <MenuItem value="current">Current Region</MenuItem>
                {!isRestricted && <MenuItem value="all">All Regions</MenuItem>}
                {!isRestricted && <MenuItem value="custom">Custom Selection</MenuItem>}
              </Select>
            </FormControl>
          </Grid>

          {consolidationType === 'custom' ? (
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small" error={customRegions.length === 0}>
                <InputLabel id="custom-region-filter-label">Select Regions</InputLabel>
                <Select
                  multiple
                  labelId="custom-region-filter-label"
                  id="custom-region-filter"
                  value={customRegions}
                  label="Select Regions"
                  onChange={(event) => {
                    const value = event.target.value;
                    const nextRegions = typeof value === 'string' ? value.split(',') : value;
                    setCustomRegions(nextRegions);
                    if (nextRegions.length > 0) setError(null);
                  }}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((regionName) => (
                        <Chip
                          key={regionName}
                          label={regionName}
                          size="small"
                          sx={{ height: 22, bgcolor: '#edf4ee', color: '#274d2b' }}
                        />
                      ))}
                    </Box>
                  )}
                  MenuProps={{ PaperProps: { sx: { maxHeight: 320 } } }}
                >
                  {availableRegionNames.map((regionName) => (
                    <MenuItem key={regionName} value={regionName}>
                      <Checkbox
                        size="small"
                        checked={customRegions.includes(regionName)}
                        sx={{ py: 0.25 }}
                      />
                      {regionName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          ) : (
            <Grid item xs={12} sm={6} md={3}>
              <FormControl
                fullWidth
                size="small"
                disabled={consolidationType === 'all' || isRestricted}
              >
                <InputLabel id="region-filter-label">Region</InputLabel>
                <Select
                  labelId="region-filter-label"
                  id="region-filter"
                  value={consolidationType === 'all' ? 'all' : selectedRegions}
                  label="Region"
                  onChange={(event) => {
                    setSelectedRegions(event.target.value);
                    setSelectedDepartment('');
                    setSelectedDivision('');
                  }}
                >
                  {consolidationType === 'all' && <MenuItem value="all">All Regions</MenuItem>}
                  {availableRegionNames.map((regionName) => (
                    <MenuItem key={regionName} value={regionName}>{regionName}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          )}

          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel id="department-filter-label">Department</InputLabel>
              <Select
                labelId="department-filter-label"
                value={String(selectedDepartment ?? '')}
                label="Department"
                disabled={consolidationType !== 'current' || departments.length === 0 || isDepartmentRestricted}
                onChange={(event) => {
                  setSelectedDepartment(event.target.value || '');
                  setSelectedDivision('');
                }}
              >
                <MenuItem value=""><em>All Departments</em></MenuItem>
                {departments.map((department, index) => {
                  const value = department._id != null ? String(department._id) : 'dept-' + index;
                  return (
                    <MenuItem key={value} value={value}>
                      {department.Department || department.name || 'Unnamed Department'}
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel id="division-filter-label">Division</InputLabel>
              <Select
                labelId="division-filter-label"
                value={String(selectedDivision ?? '')}
                label="Division"
                disabled={consolidationType !== 'current' || !selectedDepartment || divisions.length === 0 || isDivisionRestricted}
                onChange={(event) => setSelectedDivision(event.target.value || '')}
              >
                <MenuItem value=""><em>All Divisions</em></MenuItem>
                {divisions.map((division, index) => {
                  const value =
                    division.name != null && division.name !== ''
                      ? String(division.name)
                      : division._id != null ? String(division._id) : 'div-' + index;
                  return <MenuItem key={value} value={value}>{division.name || 'Unnamed Division'}</MenuItem>;
                })}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={8} md={4}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search categories or subcategories..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              InputProps={{
                startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment>,
                endAdornment: searchTerm ? (
                  <InputAdornment position="end">
                    <IconButton size="small" aria-label="Clear search" onClick={() => setSearchTerm('')}>
                      <Clear fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              }}
            />
          </Grid>

          <Grid item xs={12} sm={4} md={2}>
            <FormControlLabel
              control={
                <Switch
                  checked={showPercentages}
                  onChange={(event) => setShowPercentages(event.target.checked)}
                  size="small"
                />
              }
              label={<Typography variant="body2" sx={{ fontWeight: 500 }}>Show %</Typography>}
              sx={{ m: 0 }}
            />
          </Grid>
        </Grid>

        {!hasValidRegionSelection && (
          <Alert severity="info" sx={{ mt: 2, py: 0.25 }}>
            Select at least one region to generate a custom consolidated report.
          </Alert>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2, gap: 1.5, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            {hasValidRegionSelection && hasReportData && expandableCategoryIds.length > 0 && (
              <Button variant="outlined" size="small" onClick={toggleExpandAll}>
                {allVisibleExpanded ? 'Collapse All' : 'Expand All'}
              </Button>
            )}
            {hasValidRegionSelection && hasReportData && (
              <Typography variant="body2" color="text.secondary">
                Showing {visibleCategories.length} categories · {subcategoryCount} subcategories
              </Typography>
            )}
          </Box>

          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              color="success"
              size="small"
              onClick={fetchReportData}
              disabled={loading || !fiscalYear || !hasValidRegionSelection}
              startIcon={loading ? <CircularProgress size={17} color="inherit" /> : <Refresh />}
              sx={{ fontWeight: 600 }}
            >
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
            <Button
              variant="contained"
              color="error"
              size="small"
              onClick={handleExportToPDF}
              disabled={!canPreviewPdf || pdfLoading}
              startIcon={pdfLoading ? <CircularProgress size={17} color="inherit" /> : <PictureAsPdf />}
              sx={{ minWidth: 132, fontWeight: 600 }}
            >
              {pdfLoading ? 'Preparing...' : 'Preview PDF'}
            </Button>
          </Stack>
        </Box>

        {hasValidRegionSelection && hasReportData && !canPreviewPdf && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', textAlign: 'right' }}>
            Click Refresh to apply the current filters before opening PDF Preview.
          </Typography>
        )}
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} elevation={1}>
          <AlertTitle>Error</AlertTitle>
          {error}
        </Alert>
      )}

      {loading && !reportData && (
        <Paper elevation={1} sx={{ p: 5, mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5 }}>
          <CircularProgress size={24} />
          <Typography color="text.secondary">Loading corporate income report…</Typography>
        </Paper>
      )}

      {reportData && hasValidRegionSelection && (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {metricItems.map((metric) => (
              <Grid item xs={12} sm={6} md={3} key={metric.label}>
                <Card sx={{ height: '100%', bgcolor: '#fbfdfb', border: '1px solid', borderColor: 'divider', borderTop: '3px solid #557c55', borderRadius: 1.5, boxShadow: 'none' }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, mb: 0.75 }}>
                          {metric.label}
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.25, color: '#1e293b', overflowWrap: 'anywhere' }}>
                          {metric.value}
                        </Typography>
                      </Box>
                      {metric.icon}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Paper elevation={1} sx={{ borderRadius: 2, overflow: 'hidden' }}>
            <Box sx={{ px: 2, py: 1.5, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1e293b' }}>
                Corporate Income by Region
              </Typography>
              <Typography variant="caption" color="text.secondary">
                FY {reportData.fiscalYear} · {reportData.budgetType}
              </Typography>
            </Box>

            {reportData.message ? (
              <Alert severity="info" sx={{ m: 2 }}>
                <AlertTitle>No Data Available</AlertTitle>
                {reportData.message}
              </Alert>
            ) : !reportData.hierarchicalData || reportData.hierarchicalData.length === 0 ? (
              <Alert severity="info" sx={{ m: 2 }}>
                <AlertTitle>No Categories Found</AlertTitle>
                No income categories are defined in the system. Please add income categories first.
              </Alert>
            ) : visibleRegions.length === 0 ? (
              <Alert severity="info" sx={{ m: 2 }}>
                <AlertTitle>No Regions Found</AlertTitle>
                No regions are available for the selected report scope.
              </Alert>
            ) : Number(reportData.grandTotal || 0) === 0 ? (
              <Alert severity="info" sx={{ m: 2 }}>
                <AlertTitle>No Income Data</AlertTitle>
                No income data found for the selected fiscal year ({reportData.fiscalYear}) and budget type ({reportData.budgetType}).
              </Alert>
            ) : visibleCategories.length === 0 ? (
              <Alert severity="info" sx={{ m: 2 }}>
                <AlertTitle>No Matching Particulars</AlertTitle>
                No categories or subcategories match “{searchTerm}”.
              </Alert>
            ) : (
              <TableContainer sx={{ width: '100%', overflowX: 'auto' }}>
                <Table
                  size="small"
                  stickyHeader
                  aria-label="Consolidated corporate income by region"
                  sx={{
                    minWidth: Math.max(840, 360 + visibleRegions.length * 165),
                    '& .MuiTableCell-root': { borderColor: '#e2e8f0', py: 1.15 },
                  }}
                >
                  <TableHead>
                    <TableRow>
                      <TableCell
                        sx={{
                          position: 'sticky',
                          left: 0,
                          zIndex: 4,
                          minWidth: 300,
                          width: 320,
                          bgcolor: '#f4f7f5',
                          color: '#1e293b',
                          fontWeight: 800,
                          borderBottom: '2px solid #cbd5e1',
                          textTransform: 'uppercase',
                          fontSize: '0.75rem',
                          letterSpacing: '0.05em',
                          boxShadow: '3px 0 0 rgba(203, 213, 225, 0.7)',
                        }}
                      >
                        PARTICULARS
                      </TableCell>
                      {visibleRegions.map((region) => (
                        <TableCell
                          key={region}
                          align="right"
                          sx={{
                            minWidth: 165,
                            whiteSpace: 'nowrap',
                            bgcolor: '#f4f7f5',
                            color: '#1e293b',
                            fontWeight: 700,
                            borderBottom: '2px solid #cbd5e1',
                            textTransform: 'uppercase',
                            fontSize: '0.75rem',
                            letterSpacing: '0.04em',
                          }}
                        >
                          {region}
                        </TableCell>
                      ))}
                      <TableCell
                        align="right"
                        sx={{
                          minWidth: 170,
                          whiteSpace: 'nowrap',
                          bgcolor: '#edf4ee',
                          color: '#1e293b',
                          fontWeight: 800,
                          borderBottom: '2px solid #cbd5e1',
                          textTransform: 'uppercase',
                          fontSize: '0.75rem',
                          letterSpacing: '0.04em',
                        }}
                      >
                        Total
                      </TableCell>
                      {showPercentages && (
                        <TableCell
                          align="right"
                          sx={{
                            minWidth: 75,
                            bgcolor: '#edf4ee',
                            color: '#1e293b',
                            fontWeight: 800,
                            borderBottom: '2px solid #cbd5e1',
                            fontSize: '0.75rem',
                          }}
                        >
                          %
                        </TableCell>
                      )}
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {visibleCategories.map((categoryItem) => {
                      const categoryTotal = reportData.categoryTotals?.[categoryItem.id] || 0;
                      const categoryPercentage =
                        Number(reportData.grandTotal || 0) > 0
                          ? (categoryTotal / reportData.grandTotal) * 100
                          : 0;
                      const isExpanded = expandedCategories.has(categoryItem.id);
                      const rowBackground = categoryItem.isNetIsf
                        ? '#e8f5e9'
                        : categoryItem.isDiscount ? '#fff1f2' : '#ffffff';
                      const semanticColor = categoryItem.isDiscount
                        ? '#b42318'
                        : categoryItem.isNetIsf ? '#1b5e20' : '#1e293b';

                      return (
                        <React.Fragment key={categoryItem.id}>
                          <TableRow
                            hover
                            sx={{
                              bgcolor: rowBackground,
                              '&:hover': {
                                bgcolor: categoryItem.isNetIsf
                                  ? '#dff2e2'
                                  : categoryItem.isDiscount ? '#ffe4e6' : '#f8fafc',
                              },
                            }}
                          >
                            <TableCell
                              sx={{
                                position: 'sticky',
                                left: 0,
                                zIndex: 2,
                                minWidth: 300,
                                bgcolor: rowBackground,
                                color: semanticColor,
                                fontWeight: 700,
                                fontStyle: categoryItem.isDiscount ? 'italic' : 'normal',
                                boxShadow: '3px 0 0 rgba(226, 232, 240, 0.9)',
                                '.MuiTableRow-root:hover &': {
                                  bgcolor: categoryItem.isNetIsf
                                    ? '#dff2e2'
                                    : categoryItem.isDiscount ? '#ffe4e6' : '#f8fafc',
                                },
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                                {categoryItem.subcategories?.length > 0 ? (
                                  <IconButton
                                    size="small"
                                    aria-label={(isExpanded ? 'Collapse ' : 'Expand ') + categoryItem.name}
                                    onClick={() => toggleCategoryExpansion(categoryItem.id)}
                                    sx={{ mr: 0.75, color: semanticColor }}
                                  >
                                    {isExpanded ? <ExpandLess /> : <ExpandMore />}
                                  </IconButton>
                                ) : (
                                  <Box sx={{ width: 34, flexShrink: 0 }} />
                                )}
                                <Typography component="span" variant="body2" sx={{ fontWeight: 700, color: 'inherit' }}>
                                  {categoryItem.name}
                                </Typography>
                              </Box>
                            </TableCell>

                            {visibleRegions.map((region) => (
                              <TableCell
                                key={region + '-' + categoryItem.id}
                                align="right"
                                sx={{
                                  whiteSpace: 'nowrap',
                                  color: semanticColor,
                                  fontWeight: 600,
                                  fontStyle: categoryItem.isDiscount ? 'italic' : 'normal',
                                }}
                              >
                                {categoryItem.isDiscount ? '(' : ''}₱
                                {(reportData.regionData?.[region]?.categoryAmounts?.[categoryItem.id] || 0).toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                                {categoryItem.isDiscount ? ')' : ''}
                              </TableCell>
                            ))}

                            <TableCell
                              align="right"
                              sx={{
                                whiteSpace: 'nowrap',
                                bgcolor: '#fbfdfb',
                                color: semanticColor,
                                fontWeight: 800,
                                fontStyle: categoryItem.isDiscount ? 'italic' : 'normal',
                              }}
                            >
                              {categoryItem.isDiscount ? '(' : ''}₱
                              {categoryTotal.toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                              {categoryItem.isDiscount ? ')' : ''}
                            </TableCell>

                            {showPercentages && (
                              <TableCell align="right" sx={{ fontWeight: 700 }}>
                                {categoryItem.isDiscount ? '' : categoryPercentage.toFixed(1) + '%'}
                              </TableCell>
                            )}
                          </TableRow>

                          {isExpanded &&
                            (categoryItem.subcategories || []).map((subcategoryItem) => {
                              const subcategoryTotal = reportData.subcategoryTotals?.[subcategoryItem.id] || 0;
                              const subcategoryPercentage =
                                Number(reportData.grandTotal || 0) > 0
                                  ? (subcategoryTotal / reportData.grandTotal) * 100
                                  : 0;

                              return (
                                <TableRow
                                  key={'subcategory-' + categoryItem.id + '-' + subcategoryItem.id}
                                  hover
                                  sx={{ bgcolor: '#f8fafc' }}
                                >
                                  <TableCell
                                    sx={{
                                      position: 'sticky',
                                      left: 0,
                                      zIndex: 2,
                                      minWidth: 300,
                                      pl: 6.5,
                                      bgcolor: '#f8fafc',
                                      color: '#1f2937',
                                      fontWeight: 500,
                                      boxShadow: '3px 0 0 rgba(226, 232, 240, 0.9)',
                                      '.MuiTableRow-root:hover &': { bgcolor: '#f1f5f9' },
                                    }}
                                  >
                                    {subcategoryItem.name}
                                  </TableCell>

                                  {visibleRegions.map((region) => (
                                    <TableCell
                                      key={region + '-' + subcategoryItem.id}
                                      align="right"
                                      sx={{ whiteSpace: 'nowrap', color: '#334155', fontWeight: 500 }}
                                    >
                                      ₱
                                      {(reportData.regionData?.[region]?.subcategoryAmounts?.[subcategoryItem.id] || 0).toLocaleString('en-US', {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}
                                    </TableCell>
                                  ))}

                                  <TableCell
                                    align="right"
                                    sx={{ whiteSpace: 'nowrap', bgcolor: '#f3f8f4', color: '#1b5e20', fontWeight: 700 }}
                                  >
                                    ₱
                                    {subcategoryTotal.toLocaleString('en-US', {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </TableCell>

                                  {showPercentages && (
                                    <TableCell align="right" sx={{ color: '#334155', fontWeight: 500 }}>
                                      {subcategoryPercentage.toFixed(1)}%
                                    </TableCell>
                                  )}
                                </TableRow>
                              );
                            })}
                        </React.Fragment>
                      );
                    })}

                    <TableRow sx={{ bgcolor: '#edf4ee', borderTop: '2px solid #94a3b8' }}>
                      <TableCell
                        sx={{
                          position: 'sticky',
                          left: 0,
                          zIndex: 2,
                          minWidth: 300,
                          bgcolor: '#edf4ee',
                          color: '#1e293b',
                          fontWeight: 800,
                          boxShadow: '3px 0 0 rgba(148, 163, 184, 0.65)',
                        }}
                      >
                        GRAND TOTAL
                      </TableCell>
                      {visibleRegions.map((region) => (
                        <TableCell
                          key={'total-' + region}
                          align="right"
                          sx={{ whiteSpace: 'nowrap', color: '#1e293b', fontWeight: 800 }}
                        >
                          ₱
                          {Number(reportData.regionData?.[region]?.total || 0).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                      ))}
                      <TableCell
                        align="right"
                        sx={{ whiteSpace: 'nowrap', bgcolor: '#dfece1', color: '#274d2b', fontWeight: 800 }}
                      >
                        ₱
                        {Number(reportData.grandTotal || 0).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                      {showPercentages && (
                        <TableCell align="right" sx={{ fontWeight: 800, color: '#1e293b' }}>
                          100.0%
                        </TableCell>
                      )}
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </>
      )}

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
