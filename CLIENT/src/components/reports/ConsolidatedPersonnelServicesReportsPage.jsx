import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "../../context/UserContext";
import { useRegion } from "../../context/RegionContext";
import { isBRDLevelUser } from "../../constants/roles";
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
  Fade,
  Card,
  CardContent,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Skeleton,
} from "@mui/material";
import { toast } from "react-toastify";
import api from "../../config/api";
import "react-toastify/dist/ReactToastify.css";
import ReportPageLayout from "./ReportPageLayout";
import RegionalComparisonMatrix from "./RegionalComparisonMatrix";

import { getRegionalMatrixView } from "./regionalMatrixView";
import GenericPdfPreviewDialog from "../GenericPdfPreviewDialog";

import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import RefreshIcon from "@mui/icons-material/Refresh";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import PeopleIcon from "@mui/icons-material/People";
import CategoryIcon from "@mui/icons-material/Category";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import MapIcon from "@mui/icons-material/Map";

const PS_MATRIX_COLUMNS = [{ key: 'income', label: 'Income' }, { key: 'subsidy', label: 'Subsidy' }, { key: 'amount', label: 'Amount' }];

export const PersonnelFundingCells = ({ income = 0, subsidy = 0, amount = 0, sx = {} }) => (
  <>{[income, subsidy, amount].map((value, index) => <TableCell key={index} align="right" sx={sx}>
    ₱{Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
  </TableCell>)}</>
);

const ConsolidatedPersonnelServicesReportsPage = () => {
  const { currentUser } = useUser();
  const { activeRegion } = useRegion();
  const queryClient = useQueryClient();

  // State management (Moved up to avoid ReferenceError in hooks below)
  const [expandedRows, setExpandedRows] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRegions, setSelectedRegions] = useState([]);
  const [consolidationType, setConsolidationType] = useState("current");
  const [organizationStructure, setOrganizationStructure] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedDivision, setSelectedDivision] = useState("");

  // --- ROLE-BASED SCOPING LOGIC ---
  const hierarchical = useMemo(() => currentUser?.hierarchicalAccess || {}, [currentUser?.hierarchicalAccess]);
  const scope = useMemo(() => String(hierarchical.scope || hierarchical.assignmentLevel || "").toUpperCase(), [hierarchical]);
  const isBRD = useMemo(() => isBRDLevelUser(currentUser), [currentUser]);

  // Enforce restriction: restricted roles (Preparer, Reviewer, Approver) are locked to "Current Region Only".
  // Only BRD-level roles (Analyst, Officer, Manager, SuperAdmin) can view All Regions or Custom Selection.
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
      setConsolidationType((prev) => (prev !== 'current' ? 'current' : prev));
      
      if ((scope === 'DEPARTMENT' || scope === 'DIVISION') && hierarchical.accessibleDepartments?.[0]) {
        const userDeptId = String(hierarchical.accessibleDepartments[0]._id || hierarchical.accessibleDepartments[0].id);
        setSelectedDepartment((prev) => (prev !== userDeptId ? userDeptId : prev));
      }
      if (scope === 'DIVISION' && hierarchical.accessibleDivisions?.[0]) {
        const userDiv = hierarchical.accessibleDivisions[0];
        setSelectedDivision((prev) => (prev !== userDiv ? userDiv : prev));
      }
    }
  }, [isRestricted, scope, hierarchical]);
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState("");
  const [pdfFilename, setPdfFilename] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const selectedDepartmentName = selectedDepartment
    ? (departments.find((d) => String(d._id) === String(selectedDepartment))?.Department || selectedDepartment)
    : "";
  const selectedDivisionName = selectedDivision
    ? (divisions.find((d) => d.name === selectedDivision || String(d._id) === String(selectedDivision))?.name ?? selectedDivision)
    : "";

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
    queryKey: ["availableRegionsPS"],
    queryFn: async () => {
      const response = await api.get("/api/consolidated-reports/available-regions-ps");
      return response.data?.regions || [];
    }
  });

  useEffect(() => {
    const fetchOrgStructure = async () => {
      try {
        const res = await api.get("/api/hierarchical-rbac/organization-structure", { params: { structure: "old" } });
        setOrganizationStructure(res.data?.data || res.data);
      } catch (_organizationError) {
        // Organization filters remain empty when the directory is unavailable.
      }
    };
    fetchOrgStructure();
  }, []);

  useEffect(() => {
    if (consolidationType !== "current" || !organizationStructure || !activeRegion) {
      setDepartments([]);
      setDivisions([]);
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

    let regionMappings = mappings.filter(
      (m) =>
        (m.regionId && String(m.regionId) === regionId) ||
        (m.regionIds && m.regionIds.includes(regionId)) ||
        (m.regionNames && m.regionNames.some((name) => norm(name) === rn))
    );
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
  }, [consolidationType, organizationStructure, activeRegion]);

  useEffect(() => {
    if (consolidationType !== "current" || !selectedDepartment) {
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
  }, [selectedDepartment, consolidationType, activeRegion]);

  // Fetch consolidated personnel services data
  const { data: reportResult, isLoading: consolidatedLoading } = useQuery({
    queryKey: ["consolidatedPersonnelServicesReports", activeRegion?.name, selectedRegions, consolidationType, activeSettings?.fiscalYear, activeSettings?.budgetType, selectedDepartmentName, selectedDivisionName],
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
        return { data: [], matrix: { regions: [], sections: [] } };
      }
      const apiParams = {
        fiscalYear: activeSettings?.fiscalYear || new Date().getFullYear(),
        budgetType: activeSettings?.budgetType || 'INITIAL',
      };
      if (regionsToFetch) {
        apiParams.regions = regionsToFetch;
      }
      if (consolidationType === "current" && selectedDepartmentName) {
        apiParams.department = selectedDepartmentName;
      }
      if (consolidationType === "current" && selectedDivisionName) {
        apiParams.division = selectedDivisionName;
      }
      const response = await api.get("/api/consolidated-reports/personnel-services-data", {
        params: apiParams,
        withCredentials: true
      });
      return {
        data: response.data?.data || [],
        matrix: response.data?.matrix || { regions: [], sections: [] },
        summary: response.data?.summary,
      };
    },
    enabled: Boolean(
      activeSettings && (
        (consolidationType === "current" && activeRegion) || 
        (consolidationType === "all") ||
        (consolidationType === "custom" && selectedRegions.length > 0)
      )
    ),
    onError: (_err) => {
      toast.error("Failed to load consolidated personnel services data");
    },
  });
  const consolidatedData = useMemo(() => reportResult?.data || [], [reportResult?.data]);
  const personnelMatrix = useMemo(() => reportResult?.matrix || { regions: [], sections: [] }, [reportResult?.matrix]);
  const isAllRegionsMatrix = consolidationType === 'all' && (personnelMatrix.sections || []).length > 0;
  const matrixView = useMemo(
    () => getRegionalMatrixView(personnelMatrix, PS_MATRIX_COLUMNS, searchTerm),
    [personnelMatrix, searchTerm]
  );

  useEffect(() => {
    if (isAllRegionsMatrix) setExpandedRows((personnelMatrix.sections || []).map((section) => section.id));
  }, [isAllRegionsMatrix, personnelMatrix.sections]);

  // Calculate totals
  const grandTotals = useMemo(() => {
    try {
      if (!consolidatedData || !Array.isArray(consolidatedData)) {
        return { totalEmployees: 0, totalAmount: 0, income: 0, subsidy: 0 };
      }
      let totalEmployees = 0;
      let totalAmount = 0;
      let income = 0;
      let subsidy = 0;
      consolidatedData.forEach(region => {
        if (region) {
          totalEmployees += region.totalEmployees || 0;
          if (region.categories && Array.isArray(region.categories)) {
            region.categories.forEach(category => {
              totalAmount += category.total || 0;
              income += category.income || 0;
              subsidy += category.subsidy || 0;
            });
          }
        }
      });
      return { totalEmployees, totalAmount, income, subsidy };
    } catch (_error) {
      return { totalEmployees: 0, totalAmount: 0, income: 0, subsidy: 0 };
    }
  }, [consolidatedData]);

  // Filter and sort data
  const filteredData = useMemo(() => {
    if (!consolidatedData) return [];
    const filtered = consolidatedData.filter(region => {
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesRegion = region.region?.toLowerCase().includes(searchLower);
        const matchesCategories = (region.categories || []).some(category =>
          category.name?.toLowerCase().includes(searchLower) ||
          (category.items || []).some(item => 
            item.name?.toLowerCase().includes(searchLower)
          )
        );
        if (!matchesRegion && !matchesCategories) return false;
      }
      return true;
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
    if (event.target.value !== "current") {
      setSelectedDepartment("");
      setSelectedDivision("");
    }
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries(["consolidatedPersonnelServicesReports"]);
    toast.info("Data refreshed");
  };

  const toggleExpandAll = () => {
    const visibleIds = isAllRegionsMatrix
      ? matrixView.sections.map((section) => section.id)
      : filteredData.map((region) => region.id);
    const allExpanded = visibleIds.length > 0 && visibleIds.every((id) => expandedRows.includes(id));
    if (allExpanded) {
      setExpandedRows([]);
    } else {
      setExpandedRows(visibleIds);
    }
  };

  const visibleExpansionIds = isAllRegionsMatrix
    ? matrixView.sections.map((section) => section.id)
    : filteredData.map((region) => region.id);
  const allVisibleExpanded = visibleExpansionIds.length > 0
    && visibleExpansionIds.every((id) => expandedRows.includes(id));

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
        regionsToFetch = [activeRegion?.name].filter(Boolean);
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
      params.append("consolidationType", consolidationType);
      if (regionsToFetch && regionsToFetch.length) {
        regionsToFetch.forEach((r) => params.append("regions", r));
      }
      if (consolidationType === "current" && selectedDepartmentName) params.append("department", selectedDepartmentName);
      if (consolidationType === "current" && selectedDivisionName) params.append("division", selectedDivisionName);

      const response = await api.get(`/api/consolidated-reports/personnel-services-pdf?${params.toString()}`, {
        responseType: "blob",
      });

      // Extract filename from Content-Disposition header
      let filename = `Consolidated_PS_${fy}.pdf`;
      const contentDisposition = response.headers['content-disposition'];
      if (contentDisposition) {
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

      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      if (pdfPreviewUrl) window.URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(url);
      setPdfDialogOpen(true);
    } catch (_err) {
      toast.error("Failed to generate PDF preview.");
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <ReportPageLayout
      title={`PERSONNEL SERVICES – ${String(activeSettings?.budgetType || 'INITIAL').toUpperCase()} BUDGET PROPOSAL`}
      subtitle={
        consolidationType === "current" && activeRegion
          ? `Personnel Services data for ${activeRegion.name || activeRegion.Region}`
          : consolidationType === "all"
          ? "Personnel Services data from all regions"
          : consolidationType === "custom" && selectedRegions.length > 0
          ? `Personnel Services data for selected regions: ${selectedRegions.join(", ")}`
          : "Comprehensive consolidation of Personnel Services data"
      }
      showNiaBranding={true}
      breadcrumbLabel="Personnel Services Reports"
      fiscalYear={activeSettings?.fiscalYear || new Date().getFullYear()}
    >
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
                {!isRestricted && <MenuItem value="all">All Regions</MenuItem>}
                {!isRestricted && <MenuItem value="custom">Custom Selection</MenuItem>}
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
                  label="Select Regions"
                  disabled={isRestricted}
                >
                  {regions.map((region) => (
                    <MenuItem key={region} value={region}>
                      {region}
                    </MenuItem>
                  ))}
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
                disabled={consolidationType !== "current" || !activeRegion || departments.length === 0 || isDepartmentRestricted}
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
                disabled={consolidationType !== "current" || !selectedDepartment || divisions.length === 0 || isDivisionRestricted}
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
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search categories or items..."
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
          <Grid item xs={12} md={3}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={handleRefresh}
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
              <Button
                variant="outlined"
                startIcon={allVisibleExpanded ? <RemoveCircleOutlineIcon /> : <AddCircleOutlineIcon />}
                onClick={toggleExpandAll}
                size="small"
              >
                {allVisibleExpanded ? "Collapse All" : "Expand All"}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          {
            title: "Total Regions",
            value: isAllRegionsMatrix ? matrixView.regionCount : (filteredData?.length || 0),
            icon: <MapIcon sx={{ fontSize: 32, color: "#375e38" }} />,
          },
          {
            title: isAllRegionsMatrix ? "Visible Line Items" : "Total Employees",
            value: isAllRegionsMatrix ? matrixView.rowCount : (grandTotals.totalEmployees || 0),
            icon: <PeopleIcon sx={{ fontSize: 32, color: "#375e38" }} />,
          },
          {
            title: "Total Categories",
            value: isAllRegionsMatrix ? matrixView.sectionCount : (filteredData?.reduce((sum, region) => sum + (region.categories?.length || 0), 0) || 0),
            icon: <CategoryIcon sx={{ fontSize: 32, color: "#375e38" }} />,
          },
          {
            title: "Total Amount",
            value: `₱${(isAllRegionsMatrix ? matrixView.totals.amount : grandTotals.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            icon: <AttachMoneyIcon sx={{ fontSize: 32, color: "#375e38" }} />,
          }
        ].map((metric, index) => (
          <Grid item xs={12} md={3} key={index}>
            <Card
              sx={{
                bgcolor: "#fbfdfb",
                color: "text.primary",
                borderRadius: 1.5,
                border: "1px solid",
                borderColor: "divider",
                boxShadow: "none",
                borderTop: "3px solid #557c55",
              }}
            >
              <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, mb: 1 }}>
                      {metric.title}
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                      {metric.value}
                    </Typography>
                  </Box>
                  <Box>{metric.icon}</Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Paper elevation={1} sx={{ borderRadius: 2, overflow: "hidden" }}>
        {isLoading ? (
          <Box sx={{ p: 3 }}>
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} variant="rectangular" height={40} sx={{ mb: 1, borderRadius: 1 }} />
            ))}
          </Box>
        ) : isAllRegionsMatrix ? (
          <RegionalComparisonMatrix
            matrix={personnelMatrix}
            columns={PS_MATRIX_COLUMNS}
            searchTerm={searchTerm}
            expandedSectionIds={expandedRows}
            onExpandedSectionIdsChange={setExpandedRows}
          />
        ) : filteredData.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary">
              No personnel services data found
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Try adjusting your filters or check if data exists for the selected criteria.
            </Typography>
          </Box>
        ) : (
          <TableContainer sx={{ maxHeight: 'calc(100vh - 400px)' }}>
            <Table stickyHeader>
              <colgroup>
                <col style={{ width: '5%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '26%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '13%' }} />
              </colgroup>
              <TableHead>
                <TableRow>
                  {[
                    "",
                    "REGION",
                    "ITEM NO.",
                    "PARTICULARS",
                    "INCOME",
                    "SUBSIDY",
                    "AMOUNT",
                  ].map((headCell, index) => (
                    <TableCell
                      key={index}
                      sx={{
                        backgroundColor: "#f8fafc",
                        color: "#475569",
                        fontWeight: 700,
                        padding: "12px",
                        borderBottom: "2px solid #e2e8f0",
                        textAlign: index >= 4 ? "right" : "center",
                        fontSize: "0.75rem",
                        letterSpacing: "0.5px",
                        textTransform: "uppercase",
                      }}
                    >
                      {headCell}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredData?.map((region) => {
                  if (!region) return null;
                  return (
                    <React.Fragment key={region.id}>
                      <TableRow
                        sx={{
                          backgroundColor: expandedRows.includes(region.id) ? "rgba(55, 94, 56, 0.08)" : "rgba(55, 94, 56, 0.04)",
                          '&:hover': { backgroundColor: "rgba(55, 94, 56, 0.12)" }
                        }}
                      >
                        <TableCell sx={{ padding: "8px 12px" }}>
                          <IconButton
                            size="small"
                            onClick={() => toggleExpandRow(region.id)}
                            sx={{ color: "#375e38" }}
                          >
                            {expandedRows.includes(region.id) ? <RemoveCircleOutlineIcon /> : <AddCircleOutlineIcon />}
                          </IconButton>
                        </TableCell>
                        <TableCell sx={{ fontWeight: "bold", textAlign: "center", padding: "8px 12px", fontSize: "0.875rem" }}>
                          {region.region}
                        </TableCell>
                        <TableCell sx={{ fontWeight: "bold", textAlign: "center", padding: "8px 12px" }}>
                          <Chip label="B.1.1" size="small" color="primary" sx={{ fontSize: "0.75rem" }} />
                        </TableCell>
                        <TableCell sx={{ fontWeight: "bold", padding: "8px 12px", fontSize: "0.875rem" }}>
                          Personnel Services ({region.totalEmployees} employees)
                        </TableCell>
                        <PersonnelFundingCells
                          income={(region.categories || []).reduce((sum, cat) => sum + (cat.income || 0), 0)}
                          subsidy={(region.categories || []).reduce((sum, cat) => sum + (cat.subsidy || 0), 0)}
                          amount={(region.categories || []).reduce((sum, cat) => sum + (cat.total || 0), 0)}
                          sx={{ fontWeight: 'bold', padding: '8px 12px', fontSize: '0.875rem' }}
                        />
                      </TableRow>
                      {expandedRows.includes(region.id) && (region.categories || []).map((category) => (
                        <React.Fragment key={category.id}>
                          <TableRow sx={{ backgroundColor: "rgba(55, 94, 56, 0.02)" }}>
                            <TableCell sx={{ padding: "6px 12px" }}>
                              <IconButton
                                size="small"
                                onClick={() => toggleExpandRow(category.id)}
                                sx={{ color: "#375e38", ml: 2 }}
                              >
                                {expandedRows.includes(category.id) ? <RemoveCircleOutlineIcon /> : <AddCircleOutlineIcon />}
                              </IconButton>
                            </TableCell>
                            <TableCell sx={{ textAlign: "center", fontSize: "0.8rem", color: "#666", padding: "6px 12px" }}>
                              {region.region}
                            </TableCell>
                            <TableCell sx={{ textAlign: "center", fontSize: "0.8rem", color: "#666", padding: "6px 12px" }}>
                              {category.key}
                            </TableCell>
                            <TableCell sx={{ fontSize: "0.8rem", paddingLeft: "20px", padding: "6px 12px 6px 20px", fontWeight: "bold" }}>
                              {category.name}
                            </TableCell>
                            <PersonnelFundingCells income={category.income} subsidy={category.subsidy} amount={category.total} sx={{ fontSize: '0.8rem', padding: '6px 12px', fontWeight: 'bold' }} />
                          </TableRow>
                          {expandedRows.includes(category.id) && (category.items || []).map((item) => (
                            <TableRow key={item.id} sx={{ '&:hover': { backgroundColor: "rgba(55, 94, 56, 0.04)" } }}>
                              <TableCell sx={{ padding: "6px 12px" }}>
                                {/* No action needed for items */}
                              </TableCell>
                              <TableCell sx={{ textAlign: "center", fontSize: "0.75rem", color: "#888", padding: "6px 12px" }}>
                                {region.region}
                              </TableCell>
                              <TableCell sx={{ textAlign: "center", fontSize: "0.75rem", color: "#888", padding: "6px 12px" }}>
                                {item.key}
                              </TableCell>
                              <TableCell sx={{ fontSize: "0.75rem", paddingLeft: "40px", padding: "6px 12px 6px 40px" }}>
                                {item.name}
                              </TableCell>
                            <PersonnelFundingCells income={item.income} subsidy={item.subsidy} amount={item.amount} sx={{ fontSize: '0.8rem', padding: '6px 12px', fontWeight: 'normal' }} />
                            </TableRow>
                          ))}
                        </React.Fragment>
                      ))}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        
        <Fade in={!isAllRegionsMatrix} timeout={1000} unmountOnExit>
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
              <col style={{ width: '20%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '26%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '13%' }} />
            </colgroup>
            <TableFooter>
              <TableRow>
                <TableCell sx={{ backgroundColor: "#f8fafc", borderTop: "2px solid #cbd5e1", borderBottom: "none" }} />
                <TableCell sx={{ backgroundColor: "#f8fafc", borderTop: "2px solid #cbd5e1", borderBottom: "none" }} />
                <TableCell sx={{ backgroundColor: "#f8fafc", borderTop: "2px solid #cbd5e1", borderBottom: "none" }} />
                <TableCell 
                  sx={{ 
                    backgroundColor: "#f8fafc",
                    color: "#1e293b",
                    fontWeight: 800,
                    padding: "16px 12px",
                    borderTop: "2px solid #cbd5e1",
                    borderBottom: "none",
                    textAlign: "right",
                    fontSize: "0.875rem"
                  }}
                >
                  GRAND TOTAL:
                </TableCell>
                <PersonnelFundingCells income={grandTotals.income} subsidy={grandTotals.subsidy} amount={grandTotals.totalAmount}
                  sx={{ backgroundColor: '#f8fafc', fontWeight: 800, padding: '16px 12px', borderTop: '2px solid #cbd5e1', fontSize: '0.875rem' }} />
              </TableRow>
            </TableFooter>
          </Table>
        </Fade>
      </Paper>

      <GenericPdfPreviewDialog
        open={pdfDialogOpen}
        onClose={closePdfDialog}
        pdfUrl={pdfPreviewUrl}
        title="Personnel Services PDF Preview"
        downloadFilename={pdfFilename}
      />

    </ReportPageLayout>
  );
};

export default ConsolidatedPersonnelServicesReportsPage;
