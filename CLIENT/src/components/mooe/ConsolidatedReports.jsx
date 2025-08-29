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
} from "@mui/material";
import { ToastContainer, toast } from "react-toastify";
import api from "../../config/api";
import "react-toastify/dist/ReactToastify.css";
import { NumericFormat } from "react-number-format";

// Import icons
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import GetAppIcon from "@mui/icons-material/GetApp";
import ClearIcon from "@mui/icons-material/Clear";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import RefreshIcon from "@mui/icons-material/Refresh";
import PrintIcon from "@mui/icons-material/Print";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";

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

const ConsolidatedReports = () => {
  const { currentUser } = useUser();
  const { activeRegion } = useRegion();
  const queryClient = useQueryClient();
  
  // State management
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
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [selectedRegions, setSelectedRegions] = useState([]);
  const [consolidationType, setConsolidationType] = useState("current"); // current, all, custom

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
  });

  // Fetch consolidated data
  const { data: consolidatedData, isLoading: consolidatedLoading } = useQuery({
    queryKey: ["consolidatedReports", activeRegion?.name, selectedRegions, consolidationType, activeSettings?.fiscalYear, activeSettings?.budgetType],
    queryFn: async () => {
      try {
        const regionsToFetch = consolidationType === "current" 
          ? [activeRegion?.name].filter(Boolean)
          : consolidationType === "all" 
          ? regions.map(r => r.name)
          : selectedRegions;

        if (regionsToFetch.length === 0) {
          return [];
        }

        // Use the consolidated reports API endpoint
        const response = await api.get("/api/consolidated-reports/consolidated-data", {
          params: {
            regions: regionsToFetch,
            fiscalYear: activeSettings?.fiscalYear || new Date().getFullYear(),
            budgetType: activeSettings?.budgetType || 'INITIAL',
          },
          withCredentials: true
        });

        return response.data?.data || [];
      } catch (err) {
        console.error("Error fetching consolidated data:", err);
        throw err;
      }
    },
    enabled: Boolean(
      activeSettings && (
        (consolidationType === "current" && activeRegion) || 
        (consolidationType === "all" && regions.length > 0) ||
        (consolidationType === "custom" && selectedRegions.length > 0)
      )
    ),
    onError: (err) => {
      console.error("Error fetching consolidated data:", err);
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
              nis += parseFloat(child.nis || 0);
              cis += parseFloat(child.cis || 0);
            }
          });
        }
      });

      const total = income + subsidy + amount + nis + cis;

      return { income, subsidy, amount, nis, cis, total };
    } catch (error) {
      console.error('Error calculating grandTotals:', error);
      return { income: 0, subsidy: 0, amount: 0, nis: 0, cis: 0, total: 0 };
    }
  }, [consolidatedData]);

  // Filter data
  const filteredData = useMemo(() => {
    if (!consolidatedData) return [];

    // Sort each row's children by uacsCode ascending ONLY (remove any accountingTitle sort)
    consolidatedData.forEach(row => {
      if (row.children && Array.isArray(row.children)) {
        row.children = [...row.children].sort((a, b) => {
          const aUacs = a.uacsCode || '';
          const bUacs = b.uacsCode || '';
          return aUacs.localeCompare(bUacs);
        });
      }
    });

    return consolidatedData.filter(row => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesCategory = row.category?.toLowerCase().includes(searchLower);
        const matchesDataType = row.dataType?.toLowerCase().includes(searchLower);
        const matchesRegion = row.region?.toLowerCase().includes(searchLower);
        const matchesChildren = row.children.some(child =>
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
    setConsolidationType(event.target.value);
    if (event.target.value !== "custom") {
      setSelectedRegions([]);
    }
  };

  // Export functionality
  const handleExport = () => {
    setExportDialogOpen(true);
  };

  const handleExportConfirm = (format) => {
    // Implementation for export functionality
    toast.success(`Exporting consolidated report as ${format}`);
    setExportDialogOpen(false);
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

  return (
    <Box sx={{ p: 3 }}>
      <ToastContainer position="top-right" autoClose={3000} />
      
      {/* Header */}
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h4" gutterBottom sx={{ color: "#375e38", fontWeight: "bold", textAlign: "center" }}>
          NATIONAL IRRIGATION ADMINISTRATION
        </Typography>
        <Typography variant="h5" gutterBottom sx={{ color: "#375e38", fontWeight: "bold", textAlign: "center" }}>
          CONSOLIDATED MAINTENANCE AND OTHER OPERATING EXPENSES (MOOE)
        </Typography>
        <Typography variant="h6" gutterBottom sx={{ color: "#375e38", textAlign: "center" }}>
          BUDGET PROPOSAL FOR FISCAL YEAR {activeSettings?.fiscalYear || new Date().getFullYear()}
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" sx={{ textAlign: "center", mt: 2 }}>
          Comprehensive consolidation of MOOE data across all regions
        </Typography>
      </Paper>

      {/* Controls */}
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
                startIcon={<GetAppIcon />}
                onClick={handleExport}
                size="small"
              >
                Export
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
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Categories
              </Typography>
              <Typography variant="h5" component="div" sx={{ color: "#375e38" }}>
                {filteredData?.length || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Line Items
              </Typography>
              <Typography variant="h5" component="div" sx={{ color: "#375e38" }}>
                {filteredData?.reduce((sum, row) => sum + (row.children?.length || 0), 0) || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total MOOE Amount
              </Typography>
              <Typography variant="h5" component="div" sx={{ color: "#375e38" }}>
                ₱{(grandTotals && typeof grandTotals.total === 'number' ? grandTotals.total : 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
        ) : (
          <TableContainer sx={{ maxHeight: 'calc(100vh - 400px)' }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell width="5%" sx={{ 
                    backgroundColor: "#375e38", 
                    color: "#fff",
                    fontWeight: "bold",
                    padding: "12px 16px",
                    borderRight: "1px solid white",
                    borderBottom: "1px solid white",
                    borderTop: "1px solid white",
                    borderLeft: "1px solid white",
                  }}></TableCell>
                  <TableCell width="20%" sx={{ 
                    backgroundColor: "#375e38", 
                    color: "#fff",
                    fontWeight: "bold",
                    padding: "12px 16px",
                    borderRight: "1px solid white",
                    borderBottom: "1px solid white",
                    borderTop: "1px solid white",
                    textAlign: "center"
                  }}>REGION</TableCell>
                  <TableCell width="15%" sx={{ 
                    backgroundColor: "#375e38", 
                    color: "#fff",
                    fontWeight: "bold",
                    padding: "12px 16px",
                    borderRight: "1px solid white",
                    borderBottom: "1px solid white",
                    borderTop: "1px solid white",
                    textAlign: "center"
                  }}>UACS CODE</TableCell>
                  <TableCell width="45%" sx={{ 
                    backgroundColor: "#375e38", 
                    color: "#fff",
                    fontWeight: "bold",
                    padding: "12px 16px",
                    borderRight: "1px solid white",
                    borderBottom: "1px solid white",
                    borderTop: "1px solid white",
                    textAlign: "center"
                  }}>ACCOUNTING TITLE / LINE ITEM</TableCell>
                  <TableCell width="20%" sx={{ 
                    backgroundColor: "#375e38", 
                    color: "#fff",
                    fontWeight: "bold",
                    padding: "12px 16px",
                    borderBottom: "1px solid white",
                    borderTop: "1px solid white",
                    borderRight: "1px solid white",
                    textAlign: "center"
                  }}>AMOUNT</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredData?.map((row, index) => (
                  <React.Fragment key={row.id}>
                    {/* Parent row */}
                    <TableRow
                      sx={{
                        backgroundColor: expandedRows.includes(row.id) ? "rgba(55, 94, 56, 0.08)" : "rgba(55, 94, 56, 0.04)",
                        '&:hover': { backgroundColor: "rgba(55, 94, 56, 0.12)" }
                      }}
                    >
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => toggleExpandRow(row.id)}
                          sx={{ color: "#375e38" }}
                        >
                          {expandedRows.includes(row.id) ? <RemoveCircleOutlineIcon /> : <AddCircleOutlineIcon />}
                        </IconButton>
                      </TableCell>
                      <TableCell sx={{ fontWeight: "bold", textAlign: "center" }}>
                        {row.region || "ALL REGIONS"}
                      </TableCell>
                      <TableCell sx={{ fontWeight: "bold", textAlign: "center" }}>
                        <Chip 
                          label="MOOE" 
                          size="small" 
                          color="primary"
                        />
                      </TableCell>
                      <TableCell sx={{ fontWeight: "bold" }}>
                        {row.category}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: "bold" }}>
                        ₱{row.children.reduce((sum, child) => sum + parseFloat(child.amount || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>

                    {/* Child rows */}
                    {expandedRows.includes(row.id) && row.children.map((child) => (
                      <TableRow key={child.id}>
                        <TableCell></TableCell>
                        <TableCell sx={{ textAlign: "center", fontSize: "0.875rem", color: "#666" }}>
                          {child.region || row.region}
                        </TableCell>
                        <TableCell sx={{ textAlign: "center", fontSize: "0.875rem", color: "#666" }}>
                          {child.uacsCode || ""}
                        </TableCell>
                        <TableCell sx={{ fontSize: "0.875rem", paddingLeft: "20px" }}>
                          {child.accountingTitle || child.lineItem || child.name}
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: "0.875rem" }}>
                          ₱{parseFloat(child.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </React.Fragment>
                ))}
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
            <TableFooter>
              <TableRow>
                <TableCell 
                  colSpan={4} 
                  sx={{ 
                    backgroundColor: "#375e38", 
                    color: "#fff",
                    fontWeight: "bold",
                    padding: "12px 16px",
                    borderRight: "1px solid white",
                    borderTop: "1px solid white",
                    borderLeft: "1px solid white",
                    borderBottom: "1px solid white",
                    textAlign: "right",
                    fontSize: "1.1rem"
                  }}
                >
                  GRAND TOTAL MOOE:
                </TableCell>
                <TableCell 
                  sx={{ 
                    backgroundColor: "#375e38", 
                    color: "#fff",
                    fontWeight: "bold",
                    padding: "12px 16px",
                    borderTop: "1px solid white",
                    borderRight: "1px solid white",
                    borderBottom: "1px solid white",
                    textAlign: "right",
                    fontSize: "1.1rem"
                  }}
                >
                  ₱{(grandTotals && typeof grandTotals.total === 'number' ? grandTotals.total : 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </Fade>
      </Paper>

      {/* Export Dialog */}
      <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)}>
        <DialogTitle>Export Consolidated Report</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Choose the export format for your consolidated report:
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
    </Box>
  );
};

export default ConsolidatedReports;