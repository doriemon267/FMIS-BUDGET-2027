import React, { useState, useCallback, useMemo } from "react";
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
import GetAppIcon from "@mui/icons-material/GetApp";
import ClearIcon from "@mui/icons-material/Clear";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import RefreshIcon from "@mui/icons-material/Refresh";
import PrintIcon from "@mui/icons-material/Print";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import HomeIcon from "@mui/icons-material/Home";
import AssessmentIcon from "@mui/icons-material/Assessment";
import PeopleIcon from "@mui/icons-material/People";

const ConsolidatedPersonnelServicesReportsPage = () => {
  const { currentUser } = useUser();
  const { activeRegion } = useRegion();
  const queryClient = useQueryClient();
  const [expandedRows, setExpandedRows] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [selectedRegions, setSelectedRegions] = useState([]);
  const [consolidationType, setConsolidationType] = useState("current");

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

  // Fetch consolidated personnel services data
  const { data: consolidatedData, isLoading: consolidatedLoading } = useQuery({
    queryKey: ["consolidatedPersonnelServicesReports", activeRegion?.name, selectedRegions, consolidationType, activeSettings?.fiscalYear, activeSettings?.budgetType],
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
  };

  const handleExport = () => {
    setExportDialogOpen(true);
  };

  const handleExportConfirm = (format) => {
    toast.success(`Exporting consolidated personnel services report as ${format}`);
    setExportDialogOpen(false);
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
                startIcon={<GetAppIcon />}
                onClick={handleExport}
                size="small"
              >
                Export
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
                ₱{(grandTotals.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                          ₱{(region.categories || []).reduce((sum, cat) => sum + (cat.total || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                              ₱{(category.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                                ₱{(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                  ₱{(grandTotals.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </Fade>
      </Paper>

      <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)}>
        <DialogTitle>Export Consolidated Personnel Services Report</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Choose the export format for your consolidated personnel services report:
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
            <Button
              variant="outlined"
              startIcon={<PrintIcon />}
              onClick={() => handleExportConfirm('Print')}
            >
              Print Report
            </Button>
          </FormGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </ReportPageLayout>
  );
};

export default ConsolidatedPersonnelServicesReportsPage;