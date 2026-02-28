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
    }
  });

  // Fetch consolidated capital outlay data
  const { data: consolidatedData, isLoading: consolidatedLoading } = useQuery({
    queryKey: ["consolidatedCapitalOutlayReports", activeRegion?.name, selectedRegions, consolidationType, activeSettings?.fiscalYear, activeSettings?.budgetType],
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
      activeSettings && (
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
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  {regions.map((region) => (
                    <MenuItem key={region.id} value={region.name}>
                      <Checkbox checked={selectedRegions.indexOf(region.name) > -1} />
                      {region.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          )}
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
    </ReportPageLayout>
  );
};

export default ConsolidatedCapitalOutlayReportsPage;
