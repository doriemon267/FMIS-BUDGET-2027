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

// Import icons
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import ClearIcon from "@mui/icons-material/Clear";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import RefreshIcon from "@mui/icons-material/Refresh";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import HomeIcon from "@mui/icons-material/Home";
import AssessmentIcon from "@mui/icons-material/Assessment";

// Custom component for numeric input formatting
const NumberFormatCustom = React.memo(React.forwardRef(function NumberFormatCustom(props, ref) {
  const { onChange, ...other } = props;

  const handleValueChange = React.useCallback((values, sourceInfo) => {
    if (sourceInfo.source !== 'prop') {
      const numericValue = values.value === undefined || values.value === "" ? "" : values.value;
      onChange({
        target: {
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

const ConsolidatedReportsPage = () => {
  const { currentUser } = useUser();
  const { activeRegion } = useRegion();
  const queryClient = useQueryClient();

  // State management (Moved up to avoid ReferenceError in hooks below)
  const [expandedRows, setExpandedRows] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterAnchorEl, setFilterAnchorEl] = useState(null);
  const [selectedFilters, setSelectedFilters] = useState({
    dataTypes: [], // MOOE, Corporate Income, etc.
    regions: [],
    amountRange: { min: "", max: "" },
    hasValues: false,
    emptyValues: false
  });
  const [selectedRegions, setSelectedRegions] = useState([]);
  const [selectedCurrentRegion, setSelectedCurrentRegion] = useState(""); // single region when consolidationType === "current"
  const [consolidationType, setConsolidationType] = useState("current"); // current, all, custom
  const [organizationStructure, setOrganizationStructure] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedDivision, setSelectedDivision] = useState("");
  
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
      
      const userRegion = hierarchical.accessibleRegions?.[0]?.regionName || activeRegion?.name || activeRegion?.Region;
      if (userRegion && selectedCurrentRegion !== userRegion) {
        setSelectedCurrentRegion(userRegion);
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
  }, [isRestricted, scope, consolidationType, hierarchical, activeRegion, selectedCurrentRegion, selectedDepartment, selectedDivision]);
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    return () => {
      if (pdfPreviewUrl) {
        window.URL.revokeObjectURL(pdfPreviewUrl);
      }
    };
  }, [pdfPreviewUrl]);

  // Fetch active settings
  const { data: activeSettings } = useQuery({
    queryKey: ["activeSettings"],
    queryFn: async () => {
      const response = await api.get("/settings/active");
      return response.data;
    },
  });

  // Fetch all regions for selection
  const { data: regions = [] } = useQuery({
    queryKey: ["availableRegions"],
    queryFn: async () => {
      const response = await api.get("/api/consolidated-reports/available-regions");
      return response.data?.regions || [];
    },
    onSuccess: (data) => {
      // When regions first load and we're on "current", default to active region or first region
      if (data?.length && consolidationType === "current" && !selectedCurrentRegion) {
        const name = activeRegion?.name || activeRegion?.Region;
        const match = data.find(r => (r.name || r.Region) === name) ? name : (data[0]?.name || data[0]?.Region || "");
        setSelectedCurrentRegion(match);
      }
    },
    onError: (err) => {
      console.error('Error fetching available regions:', err);
    }
  });

  // Resolve which single region to use for "current" (dropdown selection or active region)
  const effectiveCurrentRegion = selectedCurrentRegion || activeRegion?.name || (regions?.length ? regions[0]?.name : "");
  const selectedDepartmentName = selectedDepartment
    ? (departments.find((d) => String(d._id) === String(selectedDepartment))?.Department || selectedDepartment)
    : "";
  const selectedDivisionName = selectedDivision
    ? (divisions.find((d) => d.name === selectedDivision || String(d._id) === String(selectedDivision))?.name ?? selectedDivision)
    : "";

  useEffect(() => {
    const fetchOrgStructure = async () => {
      try {
        const res = await api.get("/api/hierarchical-rbac/organization-structure", { params: { structure: "old" } });
        setOrganizationStructure(res.data?.data || res.data);
      } catch (_) {}
    };
    fetchOrgStructure();
  }, []);

  useEffect(() => {
    if (consolidationType !== "current" || !organizationStructure) {
      setDepartments([]);
      setDivisions([]);
      setSelectedDepartment("");
      setSelectedDivision("");
      return;
    }

    const selectedRegionObj = (regions || []).find(
      (r) => (r.name || r.Region || "") === effectiveCurrentRegion
    ) || activeRegion;
    const regionId = String(selectedRegionObj?._id || selectedRegionObj?.id || "");
    const selectedRegionName = (selectedRegionObj?.name || selectedRegionObj?.regionName || selectedRegionObj?.Region || "").trim();
    if (!selectedRegionName) {
      setDepartments([]);
      setSelectedDepartment("");
      setSelectedDivision("");
      return;
    }

    const data = organizationStructure;
    const allDepts = data?.availableUnits?.departments || [];
    const mappings = data?.mappings || [];
    const orgRegions = data?.availableUnits?.regions || [];
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
  }, [organizationStructure, consolidationType, effectiveCurrentRegion, activeRegion, regions]);

  useEffect(() => {
    if (consolidationType !== "current" || !selectedDepartment) {
      setDivisions([]);
      setSelectedDivision("");
      return;
    }
    const selectedRegionObj = (regions || []).find(
      (r) => (r.name || r.Region || "") === effectiveCurrentRegion
    ) || activeRegion;
    const regionId = String(selectedRegionObj?._id || selectedRegionObj?.id || "");
    const params = new URLSearchParams({ departmentId: selectedDepartment });
    if (regionId) params.set("regionId", regionId);
    api.get(`/api/hierarchical-rbac/divisions?${params.toString()}`)
      .then((res) => setDivisions(res.data?.data || res.data || []))
      .catch(() => setDivisions([]));
    setSelectedDivision("");
  }, [selectedDepartment, consolidationType, effectiveCurrentRegion, activeRegion, regions]);

  // Fetch consolidated data
  const { data: consolidatedData, isLoading: consolidatedLoading } = useQuery({
    queryKey: ["consolidatedReports", effectiveCurrentRegion, selectedRegions, consolidationType, activeSettings?.fiscalYear, activeSettings?.budgetType, selectedDepartmentName, selectedDivisionName],
    queryFn: async () => {
      try {
        let regionsToFetch;
        if (consolidationType === "current") {
          regionsToFetch = [effectiveCurrentRegion].filter(Boolean);
        } else if (consolidationType === "all") {
          regionsToFetch = null; // Don't filter by regions - get all data
        } else {
          regionsToFetch = selectedRegions;
        }

        if (consolidationType !== "all" && (!regionsToFetch || regionsToFetch.length === 0)) {
          return [];
        }

        // Use the consolidated reports API endpoint
        const apiParams = {
          fiscalYear: activeSettings?.fiscalYear || new Date().getFullYear(),
          budgetType: activeSettings?.budgetType || 'INITIAL',
        };
        
        // Only add regions parameter if we have specific regions to fetch
        if (regionsToFetch) {
          apiParams.regions = regionsToFetch;
        }
        if (consolidationType === "current" && selectedDepartmentName) {
          apiParams.department = selectedDepartmentName;
        }
        if (consolidationType === "current" && selectedDivisionName) {
          apiParams.division = selectedDivisionName;
        }

        const response = await api.get("/api/consolidated-reports/consolidated-data", {
          params: apiParams,
          withCredentials: true
        });

        const rawData = response.data?.data || [];

        // Transform and aggregate data based on consolidation type
        let transformedData;
        
        if (consolidationType === "all" && rawData.length > 0) {
          // Aggregate data from all regions
          const categoryMap = new Map();
          
          rawData.forEach(item => {
            const category = item.category;
            
            if (!categoryMap.has(category)) {
              categoryMap.set(category, {
                id: `all-regions-${category}`,
                region: "ALL REGIONS",
                category: category,
                dataType: 'MOOE',
                total: 0,
                children: new Map() // Use Map to aggregate children by accounting title
              });
            }
            
            const categoryData = categoryMap.get(category);
            categoryData.total += parseFloat(item.total || 0);
            
            // Aggregate children/items
            if (Array.isArray(item.items)) {
              item.items.forEach(child => {
                const key = child.accountingTitle || child.name || child.uacsCode || `${child.id}`;
                
                if (!categoryData.children.has(key)) {
                  categoryData.children.set(key, {
                    id: `all-${key}-${child.id}`,
                    accountingTitle: child.accountingTitle,
                    name: child.name,
                    uacsCode: child.uacsCode,
                    particulars: child.particulars,
                    income: 0,
                    subsidy: 0,
                    amount: 0,
                    total: 0
                  });
                }
                
                const aggregatedChild = categoryData.children.get(key);
                aggregatedChild.income += parseFloat(child.income || 0);
                aggregatedChild.subsidy += parseFloat(child.subsidy || 0);
                aggregatedChild.amount += parseFloat(child.amount || 0);
                aggregatedChild.total += parseFloat(child.total || 0);
              });
            }
          });
          
          // Convert Maps back to arrays
          transformedData = Array.from(categoryMap.values()).map(category => ({
            ...category,
            children: Array.from(category.children.values())
          }));
        } else {
          // Regular transformation for current region or custom selection
          transformedData = rawData.map((item, index) => ({
            id: `${item.region}-${item.category}-${index}`,
            region: item.region,
            category: item.category,
            dataType: 'MOOE',
            total: item.total,
            children: Array.isArray(item.items) ? item.items : []
          }));
        }

        return transformedData;
      } catch (err) {
        console.error("Error fetching consolidated data:", err);
        throw err;
      }
    },
    enabled: (() => {
      const enabled = Boolean(
        activeSettings && (
          (consolidationType === "current" && effectiveCurrentRegion) ||
          (consolidationType === "all") ||
          (consolidationType === "custom" && selectedRegions.length > 0)
        )
      );
      return enabled;
    })(),
    onError: (err) => {
      console.error("Error fetching consolidated data:", err);
      console.error("Full error details:", {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      console.error("Full error details:", {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      toast.error("Failed to load consolidated data");
    },
  });

  // Calculate MOOE totals for all financial columns
  const grandTotals = useMemo(() => {
    try {
      if (!consolidatedData || !Array.isArray(consolidatedData)) {
        return { income: 0, subsidy: 0, amount: 0, nis: 0, cis: 0, total: 0 };
      }
      
      let income = 0, subsidy = 0, amount = 0, nis = 0, cis = 0;

      consolidatedData.forEach(row => {
        if (row && row.children && Array.isArray(row.children)) {
          row.children.forEach(child => {
            if (child) {
              income += parseFloat(child.income || 0);
              subsidy += parseFloat(child.subsidy || 0);
              amount += parseFloat(child.amount || 0);
              // nis += parseFloat(child.nis || 0);
              // cis += parseFloat(child.cis || 0);
            }
          });
        }
      });

      const total = income + subsidy + amount;

      return { income, subsidy, amount, total };
    } catch (error) {
      console.error('Error calculating grandTotals:', error);
      return { income: 0, subsidy: 0, amount: 0, total: 0 };
    }
  }, [consolidatedData]);

  // Filter and sort data
  const filteredData = useMemo(() => {
    if (!consolidatedData) return [];

    const filtered = consolidatedData.filter(row => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesCategory = row.category?.toLowerCase().includes(searchLower);
        const matchesDataType = row.dataType?.toLowerCase().includes(searchLower);
        const matchesRegion = row.region?.toLowerCase().includes(searchLower);
        const matchesChildren = (row.children || []).some(child =>
          child.accountingTitle?.toLowerCase().includes(searchLower) ||
          child.name?.toLowerCase().includes(searchLower) ||
          child.uacsCode?.toLowerCase().includes(searchLower) ||
          child.particulars?.toLowerCase().includes(searchLower)
        );
        if (!matchesCategory && !matchesDataType && !matchesRegion && !matchesChildren) return false;
      }

      // Data type filter
      if (selectedFilters.dataTypes.length > 0) {
        if (!selectedFilters.dataTypes.includes(row.dataType)) return false;
      }

      return true;
    });

    // Sort each row's children by UACS code, with IAs O&M Cost at the end
    filtered.forEach(row => {
      if (row.children && Array.isArray(row.children)) {
        row.children.sort((a, b) => {
          const aIsIAs = a.accountingTitle && a.accountingTitle.toLowerCase().includes("irrigators' associations") && 
                         a.accountingTitle.toLowerCase().includes("operation") && 
                         a.accountingTitle.toLowerCase().includes("maintenance");
          const bIsIAs = b.accountingTitle && b.accountingTitle.toLowerCase().includes("irrigators' associations") && 
                         b.accountingTitle.toLowerCase().includes("operation") && 
                         b.accountingTitle.toLowerCase().includes("maintenance");
          
          // If one is IAs O&M and the other is not, put IAs O&M at the end
          if (aIsIAs && !bIsIAs) return 1;
          if (!aIsIAs && bIsIAs) return -1;
          
          // If both are IAs O&M or both are not, sort by UACS code
          const aUacs = a.uacsCode || '';
          const bUacs = b.uacsCode || '';
          return aUacs.localeCompare(bUacs);
        });
      }
    });

    // Sort category groups by their minimum UACS code
    filtered.sort((a, b) => {
      const getMinUacs = (row) => {
        if (!row.children || !Array.isArray(row.children) || row.children.length === 0) return '';
        return row.children.reduce((min, child) => {
          const u = (child.uacsCode || '').toString();
          return (!min || u.padStart(20, '0') < min.padStart(20, '0')) ? u : min;
        }, '');
      };
      const aMinUacs = getMinUacs(a);
      const bMinUacs = getMinUacs(b);
      const uacsCompare = aMinUacs.padStart(20, '0').localeCompare(bMinUacs.padStart(20, '0'));
      if (uacsCompare !== 0) return uacsCompare;
      return (a.category || '').localeCompare(b.category || '');
    });

    return filtered;
  }, [consolidatedData, searchTerm, selectedFilters]);

  // Toggle expand row
  const toggleExpandRow = useCallback((rowId) => {
    setExpandedRows(prev => 
      prev.includes(rowId) 
        ? prev.filter(id => id !== rowId)
        : [...prev, rowId]
    );
  }, []);

  // Handle region selection
  const handleRegionChange = (event) => {
    setSelectedRegions(event.target.value);
  };

  // Handle consolidation type change
  const handleConsolidationTypeChange = (event) => {
    const value = event.target.value;
    setConsolidationType(value);
    if (value !== "custom") {
      setSelectedRegions([]);
    }
    if (value === "current" && regions?.length && !selectedCurrentRegion) {
      const name = activeRegion?.name || activeRegion?.Region;
      const match = regions.find(r => (r.name || r.Region) === name);
      setSelectedCurrentRegion(match ? (match.name || match.Region) : (regions[0]?.name || regions[0]?.Region || ""));
    }
  };

  const handleCurrentRegionChange = (event) => {
    setSelectedCurrentRegion(event.target.value);
  };

  // Refresh data
  const handleRefresh = () => {
    queryClient.invalidateQueries(["consolidatedReports"]);
    toast.info("Data refreshed");
  };

  // Expand/Collapse all
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

  const closePdfDialog = () => {
    setPdfDialogOpen(false);
    if (pdfPreviewUrl) {
      window.URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl("");
    }
  };

  const handlePreviewPdf = async () => {
    try {
      setPdfLoading(true);
      let regionsToFetch;
      if (consolidationType === "current") {
        regionsToFetch = [effectiveCurrentRegion].filter(Boolean);
      } else if (consolidationType === "all") {
        regionsToFetch = null;
      } else {
        regionsToFetch = selectedRegions;
      }
      const params = new URLSearchParams();
      const fy = activeSettings?.fiscalYear || new Date().getFullYear();
      const bt = activeSettings?.budgetType || "INITIAL";
      if (fy) params.append("fiscalYear", fy);
      if (bt) params.append("budgetType", bt);
      if (regionsToFetch && regionsToFetch.length) {
        regionsToFetch.forEach((r) => params.append("regions", r));
      }
      if (consolidationType === "current" && selectedDepartmentName) params.append("department", selectedDepartmentName);
      if (consolidationType === "current" && selectedDivisionName) params.append("division", selectedDivisionName);

      const response = await api.get(`/api/consolidated-reports/consolidated-data-pdf?${params.toString()}`, {
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      if (pdfPreviewUrl) window.URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(url);
      setPdfDialogOpen(true);
    } catch (err) {
      toast.error("Failed to generate PDF preview.");
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <ReportPageLayout
      title="CONSOLIDATED MAINTENANCE AND OTHER OPERATING EXPENSES (MOOE)"
      subtitle={
        consolidationType === "current" && effectiveCurrentRegion
          ? `MOOE data for ${effectiveCurrentRegion}`
          : consolidationType === "all"
          ? "Consolidated MOOE data from all regions"
          : consolidationType === "custom" && selectedRegions.length > 0
          ? `MOOE data for selected regions: ${selectedRegions.join(", ")}`
          : "Select a region or consolidation type above"
      }
      showNiaBranding={true}
      breadcrumbLabel="Consolidated MOOE"
      fiscalYear={activeSettings?.fiscalYear || new Date().getFullYear()}
    >
      <ToastContainer position="top-right" autoClose={3000} />
      <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
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

          {consolidationType === "current" && (
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Region</InputLabel>
                <Select
                  value={selectedCurrentRegion || effectiveCurrentRegion || ""}
                  onChange={handleCurrentRegionChange}
                  label="Region"
                  disabled={isRestricted}
                >
                  {(regions || []).map((region) => {
                    const name = region.name || region.Region || "";
                    return (
                      <MenuItem key={region.id || region._id || name} value={name}>
                        {name}
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            </Grid>
          )}

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
                  {regions.map((region, idx) => {
                    const regionName = region.name || region.Region || (typeof region === 'string' ? region : '');
                    const key = region.id || region._id || regionName || idx;
                    return (
                      <MenuItem key={key} value={regionName}>
                        <Checkbox checked={selectedRegions.indexOf(regionName) > -1} />
                        {regionName}
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            </Grid>
          )}

          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Department</InputLabel>
              <Select
                value={String(selectedDepartment ?? "")}
                onChange={(e) => {
                  setSelectedDepartment(e.target.value || "");
                  setSelectedDivision("");
                }}
                label="Department"
                disabled={consolidationType !== "current" || !effectiveCurrentRegion || departments.length === 0 || isRestricted}
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

          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Division</InputLabel>
              <Select
                value={String(selectedDivision ?? "")}
                onChange={(e) => setSelectedDivision(e.target.value || "")}
                label="Division"
                disabled={consolidationType !== "current" || !selectedDepartment || divisions.length === 0 || (isRestricted && scope === 'DIVISION')}
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
              placeholder="Search categories, titles, regions, or codes..."
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
                    <IconButton size="small" onClick={() => setSearchTerm("")}>
                      <ClearIcon />
                    </IconButton>
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
                color="error"
                startIcon={pdfLoading ? <CircularProgress size={16} color="inherit" /> : <PictureAsPdfIcon />}
                onClick={handlePreviewPdf}
                disabled={!canPreviewPdf}
                size="small"
              >
                PDF Preview
              </Button>
            </Box>
          </Grid>
        </Grid>

        {/* Action buttons */}
        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
          <Button
            variant="outlined"
            onClick={toggleExpandAll}
            size="small"
          >
            {expandedRows.length === filteredData.length ? "Collapse All" : "Expand All"}
          </Button>
          <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center', ml: 2 }}>
            Showing {filteredData.length} categories
          </Typography>
        </Box>
      </Paper>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={2}>
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
        <Grid item xs={12} md={2}>
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
        <Grid item xs={12} md={2}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Income
              </Typography>
              <Typography variant="h6" component="div" sx={{ color: "#375e38" }}>
                ₱{(grandTotals && typeof grandTotals.income === 'number' ? grandTotals.income : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={2}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Subsidy
              </Typography>
              <Typography variant="h6" component="div" sx={{ color: "#375e38" }}>
                ₱{(grandTotals && typeof grandTotals.subsidy === 'number' ? grandTotals.subsidy : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={2}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Amount
              </Typography>
              <Typography variant="h6" component="div" sx={{ color: "#375e38" }}>
                ₱{(grandTotals && typeof grandTotals.amount === 'number' ? grandTotals.amount : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={2}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Grand Total
              </Typography>
              <Typography variant="h6" component="div" sx={{ color: "#375e38" }}>
                ₱{(grandTotals && typeof grandTotals.total === 'number' ? grandTotals.total : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Table */}
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
                ? "No consolidated data found for all regions. Please check if regions have data."
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
                <col style={{ width: '18%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '30%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '11%' }} />
              </colgroup>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ 
                    backgroundColor: "#375e38", 
                    color: "#fff",
                    fontWeight: "bold",
                    padding: "8px 12px",
                    border: "1px solid white",
                    textAlign: "center",
                    fontSize: "0.875rem"
                  }}></TableCell>
                  <TableCell sx={{ 
                    backgroundColor: "#375e38", 
                    color: "#fff",
                    fontWeight: "bold",
                    padding: "8px 12px",
                    border: "1px solid white",
                    textAlign: "center",
                    fontSize: "0.875rem"
                  }}>REGION</TableCell>
                  <TableCell sx={{ 
                    backgroundColor: "#375e38", 
                    color: "#fff",
                    fontWeight: "bold",
                    padding: "8px 12px",
                    border: "1px solid white",
                    textAlign: "center",
                    fontSize: "0.875rem"
                  }}>UACS CODE</TableCell>
                  <TableCell sx={{ 
                    backgroundColor: "#375e38", 
                    color: "#fff",
                    fontWeight: "bold",
                    padding: "8px 12px",
                    border: "1px solid white",
                    textAlign: "center",
                    fontSize: "0.875rem"
                  }}>ACCOUNTING TITLE / LINE ITEM</TableCell>
                  <TableCell sx={{ 
                    backgroundColor: "#375e38", 
                    color: "#fff",
                    fontWeight: "bold",
                    padding: "8px 12px",
                    border: "1px solid white",
                    textAlign: "center",
                    fontSize: "0.875rem"
                  }}>INCOME</TableCell>
                  <TableCell sx={{ 
                    backgroundColor: "#375e38", 
                    color: "#fff",
                    fontWeight: "bold",
                    padding: "8px 12px",
                    border: "1px solid white",
                    textAlign: "center",
                    fontSize: "0.875rem"
                  }}>SUBSIDY</TableCell>
                  <TableCell sx={{ 
                    backgroundColor: "#375e38", 
                    color: "#fff",
                    fontWeight: "bold",
                    padding: "8px 12px",
                    border: "1px solid white",
                    textAlign: "center",
                    fontSize: "0.875rem"
                  }}>AMOUNT</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredData?.map((row, index) => {
                  // Debug: Check if row and children exist
                  
                  if (!row) return null;
                  
                  return (
                  <React.Fragment key={row.id}>
                    {/* Parent row */}
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
                        <Chip 
                          label="MOOE" 
                          size="small" 
                          color="primary"
                          sx={{ fontSize: "0.75rem" }}
                        />
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
                        ₱{(row.children || []).reduce((sum, child) => sum + parseFloat(child.amount || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>

                    {/* Child rows */}
                    {expandedRows.includes(row.id) && (row.children || []).map((child) => (
                      <TableRow key={child.id} sx={{ '&:hover': { backgroundColor: "rgba(55, 94, 56, 0.04)" } }}>
                        <TableCell sx={{ padding: "6px 12px" }}></TableCell>
                        <TableCell sx={{ textAlign: "center", fontSize: "0.8rem", color: "#666", padding: "6px 12px" }}>
                          {child.region || row.region}
                        </TableCell>
                        <TableCell sx={{ textAlign: "center", fontSize: "0.8rem", color: "#666", padding: "6px 12px" }}>
                          {child.uacsCode || ""}
                        </TableCell>
                        <TableCell sx={{ fontSize: "0.8rem", paddingLeft: "20px", padding: "6px 12px 6px 20px" }}>
                          {child.accountingTitle || child.lineItem || child.name}
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: "0.8rem", padding: "6px 12px", color: "#333" }}>
                          ₱{parseFloat(child.income || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: "0.8rem", padding: "6px 12px", color: "#333" }}>
                          ₱{parseFloat(child.subsidy || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: "0.8rem", padding: "6px 12px", color: "#333" }}>
                          ₱{parseFloat(child.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

        {/* Footer with totals */}
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
              <col style={{ width: '18%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '30%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '11%' }} />
            </colgroup>
            <TableFooter>
              <TableRow>
                {/* Empty cells for first 4 columns */}
                <TableCell sx={{ backgroundColor: "#375e38", border: "1px solid white" }} />
                <TableCell sx={{ backgroundColor: "#375e38", border: "1px solid white" }} />
                <TableCell sx={{ backgroundColor: "#375e38", border: "1px solid white" }} />
                
                {/* GRAND TOTAL label */}
                <TableCell 
                  sx={{ 
                    backgroundColor: "#375e38", 
                    color: "#fff",
                    fontWeight: "bold",
                    padding: "8px 12px",
                    border: "1px solid white",
                    textAlign: "right",
                    fontSize: "0.875rem"
                  }}
                >
                  GRAND TOTAL:
                </TableCell>
                
                {/* Income total - nakatapat sa INCOME column */}
                <TableCell 
                  sx={{ 
                    backgroundColor: "#375e38", 
                    color: "#fff",
                    fontWeight: "bold",
                    padding: "8px 12px",
                    border: "1px solid white",
                    textAlign: "right",
                    fontSize: "0.875rem"
                  }}
                >
                  ₱{(grandTotals && typeof grandTotals.income === 'number' ? grandTotals.income : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </TableCell>
                
                {/* Subsidy total - nakatapat sa SUBSIDY column */}
                <TableCell 
                  sx={{ 
                    backgroundColor: "#375e38", 
                    color: "#fff",
                    fontWeight: "bold",
                    padding: "8px 12px",
                    border: "1px solid white",
                    textAlign: "right",
                    fontSize: "0.875rem"
                  }}
                >
                  ₱{(grandTotals && typeof grandTotals.subsidy === 'number' ? grandTotals.subsidy : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </TableCell>
                
                {/* Amount total - nakatapat sa AMOUNT column */}
                <TableCell 
                  sx={{ 
                    backgroundColor: "#375e38", 
                    color: "#fff",
                    fontWeight: "bold",
                    padding: "8px 12px",
                    border: "1px solid white",
                    textAlign: "right",
                    fontSize: "0.875rem"
                  }}
                >
                  ₱{(grandTotals && typeof grandTotals.amount === 'number' ? grandTotals.amount : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </Fade>
      </Paper>

      <Dialog open={pdfDialogOpen} onClose={closePdfDialog} fullScreen>
        <DialogTitle>Consolidated MOOE PDF Preview</DialogTitle>
        <DialogContent dividers sx={{ p: 0, height: "100vh" }}>
          {pdfPreviewUrl ? (
            <iframe
              title="Consolidated MOOE PDF Preview"
              src={pdfPreviewUrl}
              style={{ width: "100%", height: "100%", border: "none" }}
            />
          ) : (
            <Box sx={{ p: 3 }}>
              <Typography variant="body2">No PDF preview available.</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closePdfDialog}>Close</Button>
        </DialogActions>
      </Dialog>

    </ReportPageLayout>
  );
};

export default ConsolidatedReportsPage;