import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "../../context/UserContext";
import { useRegion } from "../../context/RegionContext";
import { isBRDLevelUser, hasApproverRole, isHighLevelAccess } from "../../constants/roles";
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableFooter,
  CircularProgress,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  Tooltip,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  FormGroup,
  Divider,
  Alert,
  Fade,
  Card,
  CardContent,
  Grid,
  Select,
  FormControl,
  InputLabel,
  Breadcrumbs,
  Link,
} from "@mui/material";
import { ToastContainer, toast } from "react-toastify";
import api from "../../config/api";
import "react-toastify/dist/ReactToastify.css";
import { NumericFormat } from "react-number-format";
import ReportPageLayout from "./ReportPageLayout";
import GenericPdfPreviewDialog from "../GenericPdfPreviewDialog";

import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import GetAppIcon from "@mui/icons-material/GetApp";
import ClearIcon from "@mui/icons-material/Clear";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import RefreshIcon from "@mui/icons-material/Refresh";
import PrintIcon from "@mui/icons-material/Print";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import HomeIcon from "@mui/icons-material/Home";
import AssessmentIcon from "@mui/icons-material/Assessment";
import CloseIcon from "@mui/icons-material/Close";
// Removed DeleteIcon import - not used in reports

const NumberFormatCustom = React.memo(React.forwardRef(function NumberFormatCustom(props, ref) {
  const { onChange, ...other } = props;
  const handleValueChange = React.useCallback((values, sourceInfo) => {
    if (sourceInfo.source !== 'prop') {
      const numericValue = values.value === undefined || values.value === "" ? "" : values.value;
      onChange({
        target:
          {
            value: numericValue,
          },
      });
    }
  }, [onChange]);
  return (
    <NumericFormat
      {...other}
      getInputRef={ref}
      thousandSeparator
      decimalScale={2}
      fixedDecimalScale={false}
      allowNegative={false}
      onValueChange={handleValueChange}
    />
  );
}));

const ConsolidatedCapitalOutlayReportsPage = () => {
  const { currentUser } = useUser();
  const { activeRegion } = useRegion();
  const queryClient = useQueryClient();

  // State management (Moved up to avoid ReferenceError in hooks below)
  const [expandedRows, setExpandedRows] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterAnchorEl, setFilterAnchorEl] = useState(null);
  const [selectedFilters, setSelectedFilters] = useState({
    regions: [],
    amountRange: { min: "", max: "" },
    hasValues: false,
    emptyValues: false
  });
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [selectedRegions, setSelectedRegions] = useState([]);
  const [consolidationType, setConsolidationType] = useState("current");
  const [selectedFiscalYear, setSelectedFiscalYear] = useState("");
  const [selectedBudgetType, setSelectedBudgetType] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedDivision, setSelectedDivision] = useState("");
  const [organizationStructure, setOrganizationStructure] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [divisions, setDivisions] = useState([]);

  // --- ROLE-BASED SCOPING LOGIC ---
  const hierarchical = useMemo(() => currentUser?.hierarchicalAccess || {}, [currentUser?.hierarchicalAccess]);
  const scope = useMemo(() => String(hierarchical.scope || hierarchical.assignmentLevel || "").toUpperCase(), [hierarchical]);
  const isHighLevel = useMemo(() => isHighLevelAccess(currentUser), [currentUser]);
  const isBRD = useMemo(() => isBRDLevelUser(currentUser), [currentUser]);

  // Unified restriction check: Preparers or unit-restricted Approvers
  const isRestricted = useMemo(() => {
    if (!isHighLevel) return true; // Preparers are always restricted
    if (isBRD) return false; // BRD Level (Analyst/Super Admin) is never restricted
    // Non-BRD high levels are restricted if they have unit-level scope
    return ['DEPARTMENT', 'DIVISION', 'OFFICE', 'RESPONSIBILITY_CENTER'].includes(scope);
  }, [isHighLevel, isBRD, scope]);

  // Enforce restrictions based on role/scope
  useEffect(() => {
    if (isRestricted) {
      if (consolidationType !== 'current') {
        setConsolidationType('current');
      }
      
      if ((scope === 'DEPARTMENT' || scope === 'DIVISION') && hierarchical.accessibleDepartments?.[0]) {
        const userDeptId = String(hierarchical.accessibleDepartments[0]._id || hierarchical.accessibleDepartments[0].id);
        if (selectedDepartment !== userDeptId) {
          setSelectedDepartment(userDeptId);
        }
      }
      if (scope === 'DIVISION' && hierarchical.accessibleDivisions?.[0]) {
        const userDiv = hierarchical.accessibleDivisions[0];
        if (selectedDivision !== userDiv) {
          setSelectedDivision(userDiv);
        }
      }
    }
  }, [isRestricted, scope, consolidationType, hierarchical, selectedDepartment, selectedDivision]);

  // Derived names for API calls (org-structure IDs → name strings)
  const selectedDepartmentName = selectedDepartment
    ? (departments.find(d => String(d._id) === String(selectedDepartment))?.Department || selectedDepartment)
    : '';
  const selectedDivisionName = selectedDivision
    ? (divisions.find(d => d.name === selectedDivision || String(d._id) === String(selectedDivision))?.name ?? selectedDivision)
    : '';

  // PDF preview dialog
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);

  // Revoke blob URL on unmount
  React.useEffect(() => {
    return () => { if (pdfPreviewUrl) window.URL.revokeObjectURL(pdfPreviewUrl); };
  }, [pdfPreviewUrl]);

  const closePdfDialog = () => {
    setPdfDialogOpen(false);
    if (pdfPreviewUrl) { window.URL.revokeObjectURL(pdfPreviewUrl); setPdfPreviewUrl(""); }
  };

  const handlePreviewPdf = async () => {
    setPdfLoading(true);
    try {
      const params = new URLSearchParams();
      const fy = selectedFiscalYear || activeSettings?.fiscalYear;
      const bt = selectedBudgetType || activeSettings?.budgetType;
      if (fy) params.append("fiscalYear", fy);
      if (bt) params.append("budgetType", bt);
      if (consolidationType === "current" && activeRegion) {
        params.append("regions", activeRegion.name || activeRegion.Region);
      } else if (consolidationType === "custom" && selectedRegions.length > 0) {
        selectedRegions.forEach((r) => params.append("regions", r));
      }
      if (selectedDepartmentName) params.append("department", selectedDepartmentName);
      if (selectedDivisionName) params.append("division", selectedDivisionName);
      const response = await api.get(
        `/api/consolidated-reports/capital-outlay-pdf?${params.toString()}`,
        { responseType: "blob" }
      );
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      if (pdfPreviewUrl) window.URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(url);
      setPdfDialogOpen(true);
    } catch (err) {
      let message = "Failed to generate PDF preview. Please try again.";
      if (err?.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text);
          if (parsed?.message) message = parsed.message;
        } catch (_) {}
      } else if (err?.response?.data?.message) {
        message = err.response.data.message;
      }
      toast.error(message, { toastId: "co-pdf-preview-error" });
    } finally {
      setPdfLoading(false);
    }
  };

  // Fetch active settings
  const { data: activeSettings } = useQuery({
    queryKey: ["activeSettings"],
    queryFn: async () => {
      const response = await api.get("/settings/active");
      return response.data;
    },
  });

  // Initialise FY / budget type from active settings (only on first load)
  const settingsInitializedRef = React.useRef(false);
  React.useEffect(() => {
    if (!settingsInitializedRef.current && activeSettings?.fiscalYear && activeSettings?.budgetType) {
      setSelectedFiscalYear(String(activeSettings.fiscalYear));
      setSelectedBudgetType(activeSettings.budgetType);
      settingsInitializedRef.current = true;
    }
  }, [activeSettings]);

  // Fetch all regions for selection (from CapitalOutlay collection)
  const { data: regions = [] } = useQuery({
    queryKey: ["capitalOutlayAvailableRegions"],
    queryFn: async () => {
      const response = await api.get("/api/consolidated-reports/capital-outlay-regions");
      return response.data?.regions || [];
    }
  });

  // Fetch available fiscal years and budget types for the filter selectors
  const { data: availableFiscalYears = [] } = useQuery({
    queryKey: ["capitalOutlayAvailableFiscalYears"],
    queryFn: async () => {
      const response = await api.get("/api/comprehensive-reports/available-fiscal-years");
      return response.data?.fiscalYears || [];
    }
  });
  const { data: availableBudgetTypes = [] } = useQuery({
    queryKey: ["capitalOutlayAvailableBudgetTypes"],
    queryFn: async () => {
      const response = await api.get("/api/comprehensive-reports/available-budget-types");
      return response.data?.budgetTypes || [];
    }
  });

  // Fetch org structure once on mount (drives department/division cascade)
  React.useEffect(() => {
    const fetchOrgStructure = async () => {
      try {
        const res = await api.get("/api/hierarchical-rbac/organization-structure", { params: { structure: "old" } });
        setOrganizationStructure(res.data?.data || res.data);
      } catch (_) {}
    };
    fetchOrgStructure();
  }, []);

  // Derive departments from org structure whenever activeRegion changes
  React.useEffect(() => {
    if (!organizationStructure || !activeRegion) {
      setDepartments([]);
      setSelectedDepartment("");
      setSelectedDivision("");
      return;
    }
    const data = organizationStructure;
    const allDepts = data?.availableUnits?.departments || [];
    const mappings = data?.mappings || [];
    const orgRegions = data?.availableUnits?.regions || [];
    const regionId = String(activeRegion._id || activeRegion.id || "");
    const selectedRegionName = (activeRegion.regionName || activeRegion.Region || activeRegion.name || "").trim();
    const norm = (s) => String(s || "").trim().toUpperCase();
    const rn = norm(selectedRegionName);
    const isExcludeRegionalAndIMO = rn === "CENTRAL OFFICE" || rn === "MARIIS" || rn === "UPRIIS";
    const excludeNames = isExcludeRegionalAndIMO ? ["REGIONAL OFFICE", "IRRIGATION MANAGEMENT OFFICE"] : [];

    let regionMappings = mappings.filter((m) => m.regionId && String(m.regionId) === regionId);
    if (regionMappings.length === 0) {
      regionMappings = mappings.filter((m) => norm(m.regionName) === rn);
    }
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
      setSelectedDepartment("");
      setSelectedDivision("");
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
    setSelectedDepartment("");
    setSelectedDivision("");
  }, [organizationStructure, activeRegion]);

  // Fetch divisions when selectedDepartment changes
  React.useEffect(() => {
    if (!selectedDepartment) {
      setDivisions([]);
      setSelectedDivision("");
      return;
    }
    const regionId = String(activeRegion?._id || activeRegion?.id || "");
    const params = new URLSearchParams({ departmentId: selectedDepartment });
    if (regionId) params.set("regionId", regionId);
    api.get(`/api/hierarchical-rbac/divisions?${params.toString()}`)
      .then((res) => setDivisions(res.data?.data || res.data || []))
      .catch(() => setDivisions([]));
    setSelectedDivision("");
  }, [selectedDepartment, activeRegion]);

  // Fetch consolidated capital outlay data
  const { data: consolidatedData, isLoading: consolidatedLoading } = useQuery({
    queryKey: ["consolidatedCapitalOutlayReports", activeRegion?.name, selectedRegions, consolidationType, selectedFiscalYear || activeSettings?.fiscalYear, selectedBudgetType || activeSettings?.budgetType, selectedDepartmentName, selectedDivisionName],
    queryFn: async () => {
      let regionsToFetch;
      if (consolidationType === "current") {
        regionsToFetch = [activeRegion?.name].filter(Boolean);
      } else if (consolidationType === "all") {
        regionsToFetch = null;
      } else {
        regionsToFetch = selectedRegions;
      }
      if (consolidationType !== "all" && (!regionsToFetch || regionsToFetch.length === 0)) {
        return [];
      }
      const apiParams = {
        fiscalYear: selectedFiscalYear || activeSettings?.fiscalYear || new Date().getFullYear(),
        budgetType: selectedBudgetType || activeSettings?.budgetType || 'INITIAL',
      };
      if (selectedDepartmentName) apiParams.department = selectedDepartmentName;
      if (selectedDivisionName) apiParams.division = selectedDivisionName;
      if (regionsToFetch) {
        apiParams.regions = regionsToFetch;
      }
      // NOTE: Update this endpoint to your Capital Outlay consolidated endpoint
      const response = await api.get("/api/consolidated-reports/capital-outlay-data", {
        params: apiParams,
        withCredentials: true
      });
      const rawData = response.data?.data || [];
      let transformedData;
      if (consolidationType === "all" && rawData.length > 0) {
        const categoryMap = new Map();
        rawData.forEach(item => {
          const category = item.category;
          if (!categoryMap.has(category)) {
            categoryMap.set(category, {
              id: `all-regions-${category}`,
              region: "ALL REGIONS",
              category: category,
              dataType: 'CAPITAL_OUTLAY',
              total: 0,
              totalIncome: 0,
              totalSubsidy: 0,
              children: new Map()
            });
          }
          const categoryData = categoryMap.get(category);
          categoryData.total += parseFloat(item.total || 0);
          categoryData.totalIncome += parseFloat(item.totalIncome || 0);
          categoryData.totalSubsidy += parseFloat(item.totalSubsidy || 0);
          if (Array.isArray(item.items)) {
            item.items.forEach(child => {
              const key = `${child.projectTitle || child.uacsCode || child.id}-${child.uacsCode || ''}`;
              if (!categoryData.children.has(key)) {
                categoryData.children.set(key, {
                  id: `all-${key}-${child.id}`,
                  projectTitle: child.projectTitle,
                  uacsCode: child.uacsCode,
                  particulars: child.particulars,
                  cost: 0,
                  income: 0,
                  subsidy: 0,
                  amount: 0, // Keep for backward compatibility
                  total: 0
                });
              }
              const aggregatedChild = categoryData.children.get(key);
              aggregatedChild.cost += parseFloat(child.cost || 0);
              aggregatedChild.income += parseFloat(child.income || 0);
              aggregatedChild.subsidy += parseFloat(child.subsidy || 0);
              aggregatedChild.amount += parseFloat(child.cost || 0); // amount = cost for compatibility
              aggregatedChild.total += parseFloat(child.cost || 0);
            });
          }
        });
        transformedData = Array.from(categoryMap.values()).map(category => ({
          ...category,
          children: Array.from(category.children.values()),
          totalIncome: category.totalIncome || 0,
          totalSubsidy: category.totalSubsidy || 0
        }));
      } else {
        transformedData = rawData.map((item, index) => ({
          id: `${item.region}-${item.category}-${index}`,
          region: item.region,
          category: item.category,
          dataType: 'CAPITAL_OUTLAY',
          total: item.total,
          children: Array.isArray(item.items) ? item.items : []
        }));
      }
      return transformedData;
    },
    enabled: Boolean(
      (selectedFiscalYear || activeSettings?.fiscalYear) &&
      (selectedBudgetType || activeSettings?.budgetType) &&
      (
        (consolidationType === "current" && activeRegion) ||
        (consolidationType === "all") ||
        (consolidationType === "custom" && selectedRegions.length > 0)
      )
    ),
    onError: (err) => {
      toast.error("Failed to load consolidated capital outlay data");
    },
  });

  // Calculate totals
  const grandTotals = useMemo(() => {
    try {
      if (!consolidatedData || !Array.isArray(consolidatedData)) {
        return { income: 0, subsidy: 0, cost: 0, amount: 0 };
      }
      let income = 0;
      let subsidy = 0;
      let cost = 0;
      consolidatedData.forEach(row => {
        if (row && row.children && Array.isArray(row.children)) {
          row.children.forEach(child => {
            if (child) {
              income += parseFloat(child.income || 0);
              subsidy += parseFloat(child.subsidy || 0);
              cost += parseFloat(child.cost || 0);
            }
          });
        }
      });
      return { income, subsidy, cost, amount: cost }; // amount = cost for backward compatibility
    } catch (error) {
      return { income: 0, subsidy: 0, cost: 0, amount: 0 };
    }
  }, [consolidatedData]);

  // Filter and sort data
  const filteredData = useMemo(() => {
    if (!consolidatedData) return [];
    const filtered = consolidatedData.filter(row => {
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesCategory = row.category?.toLowerCase().includes(searchLower);
        const matchesRegion = row.region?.toLowerCase().includes(searchLower);
        const matchesChildren = (row.children || []).some(child =>
          child.projectTitle?.toLowerCase().includes(searchLower) ||
          child.uacsCode?.toLowerCase().includes(searchLower) ||
          child.particulars?.toLowerCase().includes(searchLower)
        );
        if (!matchesCategory && !matchesRegion && !matchesChildren) return false;
      }
      return true;
    });
    filtered.forEach(row => {
      if (row.children && Array.isArray(row.children)) {
        row.children.sort((a, b) => {
          const aUacs = a.uacsCode || '';
          const bUacs = b.uacsCode || '';
          return aUacs.localeCompare(bUacs);
        });
      }
    });
    return filtered;
  }, [consolidatedData, searchTerm]);

  const toggleExpandRow = useCallback((rowId) => {
    setExpandedRows(prev =>
      prev.includes(rowId)
        ? prev.filter(id => id !== rowId)
        : [...prev, rowId]
    );
  }, []);

  const handleRegionChange = (event) => {
    setSelectedRegions(event.target.value);
  };

  const handleConsolidationTypeChange = (event) => {
    setConsolidationType(event.target.value);
    if (event.target.value !== "custom") {
      setSelectedRegions([]);
    }
  };

  const handleExport = () => {
    setExportDialogOpen(true);
  };

  const handleExportConfirm = (format) => {
    toast.success(`Exporting consolidated capital outlay report as ${format}`);
    setExportDialogOpen(false);
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries(["consolidatedCapitalOutlayReports"]);
    toast.info("Data refreshed");
  };

  const toggleExpandAll = () => {
    if (expandedRows.length === filteredData.length) {
      setExpandedRows([]);
    } else {
      setExpandedRows(filteredData.map(row => row.id));
    }
  };

  const isLoading = consolidatedLoading;
  const hasReportData = Array.isArray(consolidatedData) && consolidatedData.length > 0;
  const canPreviewPdf = !pdfLoading && !isLoading && hasReportData;

  return (
    <ReportPageLayout
      title="CONSOLIDATED CAPITAL OUTLAY"
      subtitle={
        consolidationType === "current" && activeRegion
          ? `Capital Outlay data for ${activeRegion.name || activeRegion.Region}`
          : consolidationType === "all"
          ? "Consolidated Capital Outlay data from all regions"
          : consolidationType === "custom" && selectedRegions.length > 0
          ? `Capital Outlay data for selected regions: ${selectedRegions.join(", ")}`
          : "Comprehensive consolidation of Capital Outlay data"
      }
      showNiaBranding={true}
      breadcrumbLabel="Consolidated Capital Outlay Reports"
      fiscalYear={selectedFiscalYear || activeSettings?.fiscalYear || new Date().getFullYear()}
    >
      <ToastContainer position="top-right" autoClose={3000} />
      <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          {/* Fiscal Year filter */}
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Fiscal Year</InputLabel>
              <Select
                value={selectedFiscalYear}
                onChange={(e) => setSelectedFiscalYear(e.target.value)}
                label="Fiscal Year"
              >
                {availableFiscalYears.map((fy) => (
                  <MenuItem key={fy} value={String(fy)}>{fy}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          {/* Budget Type filter */}
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Budget Type</InputLabel>
              <Select
                value={selectedBudgetType}
                onChange={(e) => setSelectedBudgetType(e.target.value)}
                label="Budget Type"
              >
                {availableBudgetTypes.map((bt) => (
                  <MenuItem key={bt} value={bt}>{bt}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          {/* Consolidation Type */}
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Consolidation Type</InputLabel>
              <Select
                value={consolidationType}
                onChange={handleConsolidationTypeChange}
                label="Consolidation Type"
                disabled={isRestricted}
              >
                <MenuItem value="current">Current Region Only</MenuItem>
                <MenuItem value="all">All Regions</MenuItem>
                <MenuItem value="custom">Custom Selection</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          {consolidationType === "custom" && (
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Select Regions</InputLabel>
                <Select
                  multiple
                  value={selectedRegions}
                  onChange={handleRegionChange}
                  disabled={isRestricted}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  {regions.map((r) => (
                    <MenuItem key={r} value={r}>
                      <Checkbox checked={selectedRegions.indexOf(r) > -1} />
                      {r}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          )}
          {/* Department filter */}
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Department</InputLabel>
              <Select
                value={String(selectedDepartment ?? "")}
                onChange={(e) => { setSelectedDepartment(e.target.value || ""); setSelectedDivision(""); }}
                label="Department"
                disabled={!activeRegion || departments.length === 0 || isRestricted}
              >
                <MenuItem value=""><em>All Departments</em></MenuItem>
                {departments.map((dept, idx) => {
                  const val = dept._id != null ? String(dept._id) : `dept-${idx}`;
                  return (
                    <MenuItem key={val} value={val}>
                      {dept.Department || dept.name || "Unnamed Department"}
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
          </Grid>
          {/* Division filter */}
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Division</InputLabel>
              <Select
                value={String(selectedDivision ?? "")}
                onChange={(e) => setSelectedDivision(e.target.value || "")}
                label="Division"
                disabled={!selectedDepartment || divisions.length === 0 || (isRestricted && scope === 'DIVISION')}
              >
                <MenuItem value=""><em>All Divisions</em></MenuItem>
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
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search categories, project titles, regions, or codes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: searchTerm && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearchTerm("")}> <ClearIcon /> </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={handleRefresh}
                disabled={isLoading}
                size="small"
              >
                Refresh
              </Button>
              <Button
                variant="outlined"
                startIcon={<GetAppIcon />}
                onClick={handleExport}
                size="small"
              >
                Export
              </Button>
            </Box>
          </Grid>
        </Grid>

        {/* ── Second toolbar row: expand controls + PDF button on the right ── */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2, flexWrap: 'wrap', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              variant="outlined"
              onClick={toggleExpandAll}
              size="small"
            >
              {expandedRows.length === filteredData.length ? "Collapse All" : "Expand All"}
            </Button>
            <Typography variant="body2" color="text.secondary">
              Showing {filteredData.length} categories
            </Typography>
          </Box>
          <Button
            variant="contained"
            color="error"
            startIcon={pdfLoading ? <CircularProgress size={18} color="inherit" /> : <PictureAsPdfIcon />}
            onClick={handlePreviewPdf}
            disabled={!canPreviewPdf}
            size="small"
            sx={{ minWidth: 140 }}
          >
            {pdfLoading ? "Generating..." : "Preview PDF"}
          </Button>
        </Box>
      </Paper>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={2.4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Categories
              </Typography>
              <Typography variant="h6" component="div" sx={{ color: "#375e38" }}>
                {filteredData?.length || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={2.4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Line Items
              </Typography>
              <Typography variant="h6" component="div" sx={{ color: "#375e38" }}>
                {filteredData?.reduce((sum, row) => sum + (row.children?.length || 0), 0) || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={2.4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Income
              </Typography>
              <Typography variant="h6" component="div" sx={{ color: "#2e7d32" }}>
                ₱{(grandTotals && typeof grandTotals.income === 'number' ? grandTotals.income : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={2.4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Subsidy
              </Typography>
              <Typography variant="h6" component="div" sx={{ color: "#1976d2" }}>
                ₱{(grandTotals && typeof grandTotals.subsidy === 'number' ? grandTotals.subsidy : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={2.4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Cost
              </Typography>
              <Typography variant="h6" component="div" sx={{ color: "#375e38" }}>
                ₱{(grandTotals && typeof grandTotals.cost === 'number' ? grandTotals.cost : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      <Paper elevation={1}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : !filteredData || filteredData.length === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 4 }}>
            <Typography variant="h6" color="text.secondary">
              No data available
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {consolidationType === "all"
                ? "No consolidated capital outlay data found for all regions. Please check if regions have data."
                : consolidationType === "current" && !activeRegion
                ? "Please select a region first."
                : "No data found for the selected criteria."}
            </Typography>
            <Button
              variant="outlined"
              onClick={handleRefresh}
              sx={{ mt: 2 }}
              startIcon={<RefreshIcon />}
            >
              Refresh Data
            </Button>
          </Box>
        ) : (
          <TableContainer sx={{ maxHeight: 'calc(100vh - 400px)' }}>
            <Table stickyHeader>
              <colgroup>
                <col style={{ width: '5%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '35%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
              </colgroup>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ backgroundColor: "#375e38", color: "#fff", fontWeight: "bold", padding: "8px 12px", border: "1px solid white", textAlign: "center", fontSize: "0.875rem" }}></TableCell>
                  <TableCell sx={{ backgroundColor: "#375e38", color: "#fff", fontWeight: "bold", padding: "8px 12px", border: "1px solid white", textAlign: "center", fontSize: "0.875rem" }}>REGION</TableCell>
                  <TableCell sx={{ backgroundColor: "#375e38", color: "#fff", fontWeight: "bold", padding: "8px 12px", border: "1px solid white", textAlign: "center", fontSize: "0.875rem" }}>UACS CODE</TableCell>
                  <TableCell sx={{ backgroundColor: "#375e38", color: "#fff", fontWeight: "bold", padding: "8px 12px", border: "1px solid white", textAlign: "center", fontSize: "0.875rem" }}>PROJECT TITLE / PARTICULARS</TableCell>
                  <TableCell sx={{ backgroundColor: "#375e38", color: "#fff", fontWeight: "bold", padding: "8px 12px", border: "1px solid white", textAlign: "center", fontSize: "0.875rem" }}>INCOME</TableCell>
                  <TableCell sx={{ backgroundColor: "#375e38", color: "#fff", fontWeight: "bold", padding: "8px 12px", border: "1px solid white", textAlign: "center", fontSize: "0.875rem" }}>SUBSIDY</TableCell>
                  <TableCell sx={{ backgroundColor: "#375e38", color: "#fff", fontWeight: "bold", padding: "8px 12px", border: "1px solid white", textAlign: "center", fontSize: "0.875rem" }}>TOTAL COST</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredData?.map((row, index) => {
                  if (!row) return null;
                  return (
                    <React.Fragment key={row.id}>
                      <TableRow
                        sx={{
                          backgroundColor: expandedRows.includes(row.id) ? "rgba(55, 94, 56, 0.08)" : "rgba(55, 94, 56, 0.04)",
                          '&:hover': { backgroundColor: "rgba(55, 94, 56, 0.12)" }
                        }}
                      >
                        <TableCell sx={{ padding: "8px 12px" }}>
                          <IconButton
                            size="small"
                            onClick={() => toggleExpandRow(row.id)}
                            sx={{ color: "#375e38" }}
                          >
                            {expandedRows.includes(row.id) ? <RemoveCircleOutlineIcon /> : <AddCircleOutlineIcon />}
                          </IconButton>
                        </TableCell>
                        <TableCell sx={{ fontWeight: "bold", textAlign: "center", padding: "8px 12px", fontSize: "0.875rem" }}>
                          {row.region}
                        </TableCell>
                        <TableCell sx={{ fontWeight: "bold", textAlign: "center", padding: "8px 12px" }}>
                          <Chip label="CAPITAL OUTLAY" size="small" color="secondary" sx={{ fontSize: "0.75rem" }} />
                        </TableCell>
                        <TableCell sx={{ fontWeight: "bold", padding: "8px 12px", fontSize: "0.875rem" }}>
                          {row.category}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: "bold", padding: "8px 12px", fontSize: "0.875rem" }}>
                          ₱{(row.children || []).reduce((sum, child) => sum + parseFloat(child.income || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: "bold", padding: "8px 12px", fontSize: "0.875rem" }}>
                          ₱{(row.children || []).reduce((sum, child) => sum + parseFloat(child.subsidy || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: "bold", padding: "8px 12px", fontSize: "0.875rem" }}>
                          ₱{(row.children || []).reduce((sum, child) => sum + parseFloat(child.cost || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                      {expandedRows.includes(row.id) && (row.children || []).map((child) => (
                        <TableRow key={child.id} sx={{ '&:hover': { backgroundColor: "rgba(55, 94, 56, 0.04)" } }}>
                          <TableCell sx={{ padding: "6px 12px" }}>
                            {/* Remove delete icon for reports */}
                          </TableCell>
                          <TableCell sx={{ textAlign: "center", fontSize: "0.8rem", color: "#666", padding: "6px 12px" }}>
                            {child.region || row.region}
                          </TableCell>
                          <TableCell sx={{ textAlign: "center", fontSize: "0.8rem", color: "#666", padding: "6px 12px" }}>
                            {child.uacsCode || ""}
                          </TableCell>
                          <TableCell sx={{ fontSize: "0.8rem", paddingLeft: "20px", padding: "6px 12px 6px 20px" }}>
                            {child.projectTitle || child.particulars}
                          </TableCell>
                          <TableCell align="right" sx={{ fontSize: "0.8rem", padding: "6px 12px", color: "#333" }}>
                            ₱{parseFloat(child.income || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell align="right" sx={{ fontSize: "0.8rem", padding: "6px 12px", color: "#333" }}>
                            ₱{parseFloat(child.subsidy || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell align="right" sx={{ fontSize: "0.8rem", padding: "6px 12px", color: "#333" }}>
                            ₱{parseFloat(child.cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        <Fade in={true} timeout={1000}>
          <Table
            sx={{
              position: 'sticky',
              bottom: 0,
              width: '100%',
              tableLayout: 'fixed',
              borderCollapse: 'separate',
              borderSpacing: 0,
              marginTop: '-2px',
              zIndex: 2,
              boxShadow: '0 -2px 8px rgba(0,0,0,0.1)',
              transition: 'all 0.3s ease'
            }}
          >
            <colgroup>
              <col style={{ width: '5%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '35%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '10%' }} />
            </colgroup>
            <TableFooter>
              <TableRow>
                <TableCell sx={{ backgroundColor: "#375e38", border: "1px solid white" }} />
                <TableCell sx={{ backgroundColor: "#375e38", border: "1px solid white" }} />
                <TableCell sx={{ backgroundColor: "#375e38", border: "1px solid white" }} />
                <TableCell sx={{ backgroundColor: "#375e38", color: "#fff", fontWeight: "bold", padding: "8px 12px", border: "1px solid white", textAlign: "right", fontSize: "0.875rem" }}>
                  GRAND TOTAL:
                </TableCell>
                <TableCell sx={{ backgroundColor: "#375e38", color: "#fff", fontWeight: "bold", padding: "8px 12px", border: "1px solid white", textAlign: "right", fontSize: "0.875rem" }}>
                  ₱{(grandTotals && typeof grandTotals.income === 'number' ? grandTotals.income : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </TableCell>
                <TableCell sx={{ backgroundColor: "#375e38", color: "#fff", fontWeight: "bold", padding: "8px 12px", border: "1px solid white", textAlign: "right", fontSize: "0.875rem" }}>
                  ₱{(grandTotals && typeof grandTotals.subsidy === 'number' ? grandTotals.subsidy : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </TableCell>
                <TableCell sx={{ backgroundColor: "#375e38", color: "#fff", fontWeight: "bold", padding: "8px 12px", border: "1px solid white", textAlign: "right", fontSize: "0.875rem" }}>
                  ₱{(grandTotals && typeof grandTotals.cost === 'number' ? grandTotals.cost : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </Fade>
      </Paper>
      <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)}>
        <DialogTitle>Export Consolidated Capital Outlay Report</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Choose the export format for your consolidated capital outlay report:
          </Typography>
          <FormGroup>
            <Button
              variant="outlined"
              startIcon={<GetAppIcon />}
              onClick={() => handleExportConfirm('Excel')}
              sx={{ mb: 1 }}
            >
              Export as Excel
            </Button>
            <Button
              variant="outlined"
              startIcon={<PictureAsPdfIcon />}
              onClick={() => handleExportConfirm('PDF')}
              sx={{ mb: 1 }}
            >
              Export as PDF
            </Button>
          </FormGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* ── PDF Preview Dialog ─────────────────────────────────────────────── */}
      <GenericPdfPreviewDialog
        open={pdfDialogOpen}
        onClose={closePdfDialog}
        pdfUrl={pdfPreviewUrl}
        title="Consolidated Capital Outlay PDF Preview"
        downloadFilename={`Consolidated_Capital_Outlay_${selectedFiscalYear || activeSettings?.fiscalYear || new Date().getFullYear()}.pdf`}
      />
    </ReportPageLayout>
  );
};

export default ConsolidatedCapitalOutlayReportsPage;
