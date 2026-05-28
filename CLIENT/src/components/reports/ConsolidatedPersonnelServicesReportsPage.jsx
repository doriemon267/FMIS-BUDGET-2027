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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormGroup,
  Divider,
  Alert,
  Fade,
  Card,
  CardContent,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Breadcrumbs,
  Link,
  Skeleton,
} from "@mui/material";
import { ToastContainer, toast } from "react-toastify";
import api from "../../config/api";
import "react-toastify/dist/ReactToastify.css";
import ReportPageLayout from "./ReportPageLayout";
import GenericPdfPreviewDialog from "../GenericPdfPreviewDialog";

import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import ClearIcon from "@mui/icons-material/Clear";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import RefreshIcon from "@mui/icons-material/Refresh";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import HomeIcon from "@mui/icons-material/Home";
import AssessmentIcon from "@mui/icons-material/Assessment";
import PeopleIcon from "@mui/icons-material/People";
import CategoryIcon from "@mui/icons-material/Category";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import MapIcon from "@mui/icons-material/Map";

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
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState("");
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
      } catch (_) {}
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
  const { data: consolidatedData, isLoading: consolidatedLoading } = useQuery({
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
        return [];
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
      return response.data?.data || [];
    },
    enabled: Boolean(
      activeSettings && (
        (consolidationType === "current" && activeRegion) || 
        (consolidationType === "all") ||
        (consolidationType === "custom" && selectedRegions.length > 0)
      )
    ),
    onError: (err) => {
      toast.error("Failed to load consolidated personnel services data");
    },
  });

  // Calculate totals
  const grandTotals = useMemo(() => {
    try {
      if (!consolidatedData || !Array.isArray(consolidatedData)) {
        return { totalEmployees: 0, totalAmount: 0 };
      }
      let totalEmployees = 0;
      let totalAmount = 0;
      consolidatedData.forEach(region => {
        if (region) {
          totalEmployees += region.totalEmployees || 0;
          if (region.categories && Array.isArray(region.categories)) {
            region.categories.forEach(category => {
              totalAmount += category.total || 0;
            });
          }
        }
      });
      return { totalEmployees, totalAmount };
    } catch (error) {
      return { totalEmployees: 0, totalAmount: 0 };
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
    if (expandedRows.length === filteredData.length) {
      setExpandedRows([]);
    } else {
      setExpandedRows(filteredData.map(region => region.id));
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
      if (regionsToFetch && regionsToFetch.length) {
        regionsToFetch.forEach((r) => params.append("regions", r));
      }
      if (consolidationType === "current" && selectedDepartmentName) params.append("department", selectedDepartmentName);
      if (consolidationType === "current" && selectedDivisionName) params.append("division", selectedDivisionName);

      const response = await api.get(`/api/consolidated-reports/personnel-services-pdf?${params.toString()}`, {
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
      title="CONSOLIDATED PERSONNEL SERVICES"
      subtitle={
        consolidationType === "current" && activeRegion
          ? `Personnel Services data for ${activeRegion.name || activeRegion.Region}`
          : consolidationType === "all"
          ? "Consolidated Personnel Services data from all regions"
          : consolidationType === "custom" && selectedRegions.length > 0
          ? `Personnel Services data for selected regions: ${selectedRegions.join(", ")}`
          : "Comprehensive consolidation of Personnel Services data"
      }
      showNiaBranding={true}
      breadcrumbLabel="Consolidated Personnel Services Reports"
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
                disabled={consolidationType !== "current" || !activeRegion || departments.length === 0 || isRestricted}
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
                startIcon={expandedRows.length === filteredData.length ? <RemoveCircleOutlineIcon /> : <AddCircleOutlineIcon />}
                onClick={toggleExpandAll}
                size="small"
              >
                {expandedRows.length === filteredData.length ? "Collapse All" : "Expand All"}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          {
            title: "Total Regions",
            value: filteredData?.length || 0,
            icon: <MapIcon sx={{ fontSize: 40, color: "#e2e8f0" }} />,
            bgColor: "linear-gradient(135deg, #4776E6 0%, #8E54E9 100%)",
          },
          {
            title: "Total Employees",
            value: grandTotals.totalEmployees || 0,
            icon: <PeopleIcon sx={{ fontSize: 40, color: "#e2e8f0" }} />,
            bgColor: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
          },
          {
            title: "Total Categories",
            value: filteredData?.reduce((sum, region) => sum + (region.categories?.length || 0), 0) || 0,
            icon: <CategoryIcon sx={{ fontSize: 40, color: "#e2e8f0" }} />,
            bgColor: "linear-gradient(135deg, #f2994a 0%, #f2c94c 100%)",
          },
          {
            title: "Total Amount",
            value: `₱${(grandTotals.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            icon: <AttachMoneyIcon sx={{ fontSize: 40, color: "#e2e8f0" }} />,
            bgColor: "linear-gradient(135deg, #ee0979 0%, #ff6a00 100%)",
          }
        ].map((metric, index) => (
          <Grid item xs={12} md={3} key={index}>
            <Card
              sx={{
                background: metric.bgColor,
                color: "#fff",
                borderRadius: 2,
                boxShadow: "0 4px 20px 0 rgba(0,0,0,0.1)",
                transition: "transform 0.2s",
                "&:hover": { transform: "translateY(-4px)" },
              }}
            >
              <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500, opacity: 0.9, mb: 1 }}>
                      {metric.title}
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                      {metric.value}
                    </Typography>
                  </Box>
                  <Box sx={{ opacity: 0.8 }}>{metric.icon}</Box>
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
                <col style={{ width: '50%' }} />
                <col style={{ width: '15%' }} />
              </colgroup>
              <TableHead>
                <TableRow>
                  {[
                    "",
                    "REGION",
                    "ITEM NO.",
                    "PARTICULARS",
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
                        textAlign: index === 4 ? "right" : "center",
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
                {filteredData?.map((region, regionIndex) => {
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
                        <TableCell align="right" sx={{ fontWeight: "bold", padding: "8px 12px", fontSize: "0.875rem" }}>
                          ₱{(region.categories || []).reduce((sum, cat) => sum + (cat.total || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
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
                            <TableCell align="right" sx={{ fontSize: "0.8rem", padding: "6px 12px", color: "#333", fontWeight: "bold" }}>
                              ₱{(category.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
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
                              <TableCell align="right" sx={{ fontSize: "0.75rem", padding: "6px 12px", color: "#555" }}>
                                ₱{(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </TableCell>
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
              <col style={{ width: '20%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '50%' }} />
              <col style={{ width: '15%' }} />
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
                  ₱{(grandTotals.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </Fade>
      </Paper>

      <GenericPdfPreviewDialog
        open={pdfDialogOpen}
        onClose={closePdfDialog}
        pdfUrl={pdfPreviewUrl}
        title="Consolidated Personnel Services PDF Preview"
        downloadFilename={`Consolidated_Personnel_Services_${activeSettings?.fiscalYear || new Date().getFullYear()}.pdf`}
      />

    </ReportPageLayout>
  );
};

export default ConsolidatedPersonnelServicesReportsPage;