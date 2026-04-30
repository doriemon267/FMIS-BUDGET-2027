import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "../../context/UserContext";
import { useRegion } from "../../context/RegionContext";
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
  AppBar,
  Toolbar,
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
} from "@mui/material";
import { ToastContainer, toast } from "react-toastify";
import api from "../../config/api";
import "react-toastify/dist/ReactToastify.css";
import ReportPageLayout from "./ReportPageLayout";

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
import CloseIcon from "@mui/icons-material/Close";

const ConsolidatedPersonnelServicesReportsPage = () => {
  const { currentUser } = useUser();
  const { activeRegion } = useRegion();
  const queryClient = useQueryClient();
  const [expandedRows, setExpandedRows] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRegions, setSelectedRegions] = useState([]);
  const [consolidationType, setConsolidationType] = useState("current");
  const [organizationStructure, setOrganizationStructure] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedDivision, setSelectedDivision] = useState("");
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
                disabled={consolidationType !== "current" || !activeRegion || departments.length === 0}
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
                disabled={consolidationType !== "current" || !selectedDepartment || divisions.length === 0}
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
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Regions
              </Typography>
              <Typography variant="h6" component="div" sx={{ color: "#375e38" }}>
                {filteredData?.length || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Employees
              </Typography>
              <Typography variant="h6" component="div" sx={{ color: "#375e38" }}>
                {grandTotals.totalEmployees || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Categories
              </Typography>
              <Typography variant="h6" component="div" sx={{ color: "#375e38" }}>
                {filteredData?.reduce((sum, region) => sum + (region.categories?.length || 0), 0) || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Amount
              </Typography>
              <Typography variant="h6" component="div" sx={{ color: "#375e38" }}>
                ₱{(grandTotals.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                  <TableCell sx={{ backgroundColor: "#375e38", color: "#fff", fontWeight: "bold", padding: "8px 12px", border: "1px solid white", textAlign: "center", fontSize: "0.875rem" }}></TableCell>
                  <TableCell sx={{ backgroundColor: "#375e38", color: "#fff", fontWeight: "bold", padding: "8px 12px", border: "1px solid white", textAlign: "center", fontSize: "0.875rem" }}>REGION</TableCell>
                  <TableCell sx={{ backgroundColor: "#375e38", color: "#fff", fontWeight: "bold", padding: "8px 12px", border: "1px solid white", textAlign: "center", fontSize: "0.875rem" }}>ITEM NO.</TableCell>
                  <TableCell sx={{ backgroundColor: "#375e38", color: "#fff", fontWeight: "bold", padding: "8px 12px", border: "1px solid white", textAlign: "center", fontSize: "0.875rem" }}>PARTICULARS</TableCell>
                  <TableCell sx={{ backgroundColor: "#375e38", color: "#fff", fontWeight: "bold", padding: "8px 12px", border: "1px solid white", textAlign: "center", fontSize: "0.875rem" }}>AMOUNT</TableCell>
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
                <TableCell sx={{ backgroundColor: "#375e38", border: "1px solid white" }} />
                <TableCell sx={{ backgroundColor: "#375e38", border: "1px solid white" }} />
                <TableCell sx={{ backgroundColor: "#375e38", border: "1px solid white" }} />
                <TableCell sx={{ backgroundColor: "#375e38", color: "#fff", fontWeight: "bold", padding: "8px 12px", border: "1px solid white", textAlign: "right", fontSize: "0.875rem" }}>
                  GRAND TOTAL:
                </TableCell>
                <TableCell sx={{ backgroundColor: "#375e38", color: "#fff", fontWeight: "bold", padding: "8px 12px", border: "1px solid white", textAlign: "right", fontSize: "0.875rem" }}>
                  ₱{(grandTotals.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </Fade>
      </Paper>

      <Dialog
        fullScreen
        open={pdfDialogOpen}
        onClose={closePdfDialog}
      >
        <AppBar sx={{ position: "relative" }}>
          <Toolbar>
            <IconButton edge="start" color="inherit" onClick={closePdfDialog} aria-label="close">
              <CloseIcon />
            </IconButton>
            <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
              Consolidated Personnel Services PDF Preview
            </Typography>
          </Toolbar>
        </AppBar>
        <DialogContent sx={{ p: 0, bgcolor: "#525659", height: "100%" }}>
          {pdfPreviewUrl ? (
            <iframe
              title="Consolidated Personnel Services PDF Preview"
              src={pdfPreviewUrl}
              style={{ width: "100%", height: "100%", border: "none" }}
            />
          ) : (
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
              <CircularProgress />
            </Box>
          )}
        </DialogContent>
      </Dialog>

    </ReportPageLayout>
  );
};

export default ConsolidatedPersonnelServicesReportsPage;