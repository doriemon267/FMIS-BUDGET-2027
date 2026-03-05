import React, { useState, useEffect, useCallback, useMemo } from "react";
import CustomMenu from "./PersonnelCustomMenu";
import CustomTable from "./PersonnelCustomTable";
import PropTypes from "prop-types";
import {
  Button,
  Box,
  TextField,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  CircularProgress,
  FormControlLabel,
  Switch,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Typography,
  Paper,
  Checkbox,
  InputAdornment,
} from "@mui/material";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import api from "../../config/api";
import { useRegion } from "../../context/RegionContext";
import { useUser } from "../../context/UserContext";
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import GetAppIcon from '@mui/icons-material/GetApp';
import PrintIcon from '@mui/icons-material/Print';
import PesoIcon from '../icons/PesoIcon';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import { useQueryClient } from "@tanstack/react-query";
import { invalidateDataList } from "../../utils/queryClientHelpers";
import { useWorkflowRef } from "../../hooks/useWorkflowRef";
import { updatePersonnelChargedToIncome } from "../../services/personnelSubsidyService";

const PSPCustomPageTable = ({
  dataListName,
  schema,
  title = "",
  description = "",
  hasEdit = true,
  hasDelete = true,
  customEditElement = null,
  additionalMenuOptions = [],
  ROWS_PER_PAGE = 20,
  locked = false,
  proposalId = null,  // ADDED: Accept proposalId from parent (ProposalCustomPage)
}) => {
  const [openDialog, setOpenDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fiscalYear, setFiscalYear] = useState("");
  const [budgetType, setBudgetType] = useState("");
  const [PERA, setPERA] = useState(0);
  const [RATA, setRATA] = useState([]);
  const [compensation, setCompensation] = useState({});
  const { currentUser } = useUser();
  const { activeRegion = {} } = useRegion();
  const queryClient = useQueryClient();
  const { workflowRef, headerConfig } = useWorkflowRef();
  const hasWorkflowRef = Boolean(workflowRef);

  // Enhanced state management
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(null);
  const [columnVisibility, setColumnVisibility] = useState({});
  const [filterMenuAnchor, setFilterMenuAnchor] = useState(null);
  const [exportMenuAnchor, setExportMenuAnchor] = useState(null);
  const [viewDetailsDialog, setViewDetailsDialog] = useState({ open: false, data: null });
  const [filteredRows, setFilteredRows] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);
  const [chargedToIncomeDialog, setChargedToIncomeDialog] = useState({ open: false, mode: "tag", amount: "", notes: "" });
  const [chargedToIncomeLoading, setChargedToIncomeLoading] = useState(false);

  const pageTitle = useMemo(() => title || dataListName.charAt(0).toUpperCase() + dataListName.slice(1), [title, dataListName]);
  const pageDescription = useMemo(() => description || `Manage ${dataListName}`, [description, dataListName]);
  const apiPath = useMemo(() => `/${dataListName}`, [dataListName]);

  // Define all callback functions first
  const fetchActiveSettings = useCallback(async () => {
    try {
      const response = await api.get("/settings/active");
      if (response.data) {
        const settings = response.data;
        // Get compensation from populated compensationSettingsId or directly from settings (legacy)
        const comp = settings.compensationSettingsId || settings;
        setFiscalYear(settings.fiscalYear || "");
        setBudgetType(settings.budgetType || "");
        setPERA(comp.PERA || 0);
        setCompensation({
          uniformALLOWANCE: comp.uniformAllowance,
          productivityIncentive: comp.productivityIncentive,
          medicalAllowance: comp.medicalAllowance,
          meal: comp.meal,
          cashGift: comp.cashGift,
          pagibigPremium: comp.pagibigPremium,
          gsisPremium: comp.gsisPremium,
          employeeCompensation: comp.employeeCompensation,
        });
        // Return merged settings with compensation fields flattened for backward compatibility
        return { ...settings, ...comp, fiscalYear: settings.fiscalYear, budgetType: settings.budgetType };
      }
      toast.error("Active settings not found.");
      return null;
    } catch (error) {
      toast.error("Error fetching active settings.");
      console.error("Error fetching active settings:", error);
      return null;
    }
  }, []);

  // Invalidate related queries (BudgetarySupportTable, NewProposalWorkflowPage, Comprehensive Reports)
  const invalidatePersonnelRelatedQueries = useCallback(async () => {
    try {
      await queryClient.invalidateQueries({ queryKey: [dataListName, "chargedToIncome"] });
      await queryClient.invalidateQueries({ queryKey: ["proposals"] });
      await queryClient.invalidateQueries({ queryKey: ["allProposals"] });
      await queryClient.invalidateQueries({ queryKey: ["workflowProposals"] });
      await queryClient.invalidateQueries({ queryKey: ["personnel-services-combined"] });
      await queryClient.invalidateQueries({ queryKey: ["calculated-budgetary-support"] });
      await queryClient.invalidateQueries({ queryKey: ["comprehensive-report-data"] });
    } catch (e) {
      console.warn("Personnel-related invalidation error:", e);
    }
  }, [queryClient, dataListName]);

  const refreshPersonnelData = useCallback(async () => {
    try {
      await invalidateDataList(queryClient, dataListName);
      await invalidatePersonnelRelatedQueries();
      await queryClient.refetchQueries({ queryKey: ["proposals"] });
      await queryClient.refetchQueries({ queryKey: ["personnel-services-combined"] });
    } catch (error) {
      toast.error("Error refreshing personnel data.");
      console.error("Error refreshing data:", error);
    }
  }, [queryClient, dataListName, invalidatePersonnelRelatedQueries]);

  const fetchRATA = useCallback(async () => {
    try {
      const response = await api.get("/ratas");
      const payload = response.data;
      const ratas =
        Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.ratas)
            ? payload.ratas
            : Array.isArray(payload?.data)
              ? payload.data
              : null;
      if (ratas) {
        setRATA(ratas);
      } else {
        toast.error("RATA data format incorrect.");
        console.error("RATA response format incorrect:", response.data);
      }
    } catch (error) {
      toast.error("Error fetching RATA data.");
      console.error("Error fetching RATA data:", error);
    }
  }, []);

  // Initialize column visibility
  useEffect(() => {
    const initialVisibility = {};
    Object.keys(schema).forEach(key => {
      initialVisibility[key] = schema[key].show !== false;
    });
    setColumnVisibility(initialVisibility);
  }, [schema]);

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        refreshPersonnelData();
        fetchActiveSettings();
        fetchRATA();
      }, 30000); // Refresh every 30 seconds
      setRefreshInterval(interval);
      return () => clearInterval(interval);
    } else if (refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
    }
  }, [autoRefresh, refreshPersonnelData, refreshInterval, fetchActiveSettings, fetchRATA]);

  const handleFilterMenuClick = (event) => setFilterMenuAnchor(event.currentTarget);
  const handleFilterMenuClose = () => setFilterMenuAnchor(null);
  const handleExportMenuClick = (event) => setExportMenuAnchor(event.currentTarget);
  const handleExportMenuClose = () => setExportMenuAnchor(null);

  // Column visibility toggle
  const toggleColumnVisibility = (columnKey) => {
    setColumnVisibility(prev => ({
      ...prev,
      [columnKey]: !prev[columnKey]
    }));
  };

  // Charged to Income Dialog Handlers
  const handleOpenChargedToIncomeDialog = (mode) => {
    if (!selectedRows.length) {
      toast.error("Select at least one personnel record first.");
      return;
    }
    setChargedToIncomeDialog({ open: true, mode, amount: "", notes: "" });
  };

  const handleCloseChargedToIncomeDialog = () => {
    if (chargedToIncomeLoading) return;
    setChargedToIncomeDialog((prev) => ({ ...prev, open: false }));
  };

  const handleConfirmChargedToIncome = async () => {
    if (!selectedRows.length) {
      toast.error("No personnel selected.");
      return;
    }

    if (chargedToIncomeDialog.mode === "tag") {
      // No amount validation needed - just moving employees to charged to income
    }

    setChargedToIncomeLoading(true);
    try {
      const payload =
        chargedToIncomeDialog.mode === "tag"
          ? {
              items: selectedRows.map((id) => {
                // Find the personnel record to get the salary amount
                const personnel = filteredRows.find(r => r._id === id);
                const salaryAmount = personnel?.Total || personnel?.total || personnel?.amount || 0;
                // console.log("DEBUG: Marking permanent personnel as charged-to-income:", {
                  // id,
                  // name: personnel?.employeeFullName,
                  // Total: personnel?.Total,
                  // salaryAmount
                // });
                return { _id: id, chargedToIncomeAmount: salaryAmount };
              }),
              chargedToIncomeEligible: true,
              defaultAmount: 0,
            }
          : {
              items: selectedRows.map((id) => ({ _id: id })),
              chargedToIncomeEligible: false,
              defaultAmount: 0,
            };

      // console.log("DEBUG: Full payload being sent:", JSON.stringify(payload, null, 2));
      const response = await updatePersonnelChargedToIncome(payload);
      
      // Check if there were any skipped items
      if (response?.data?.skipped && response.data.skipped.length > 0) {
        const skipReason = response.data.skipped.map(s => `${s.id}: ${s.reason}`).join(", ");
        toast.warning(`${response.data.updatedCount} updated, ${response.data.skipped.length} skipped - ${skipReason}`);
      } else {
        toast.success(
          chargedToIncomeDialog.mode === "tag"
            ? `${selectedRows.length} employee(s) moved to Charged to Income`
            : `${selectedRows.length} employee(s) moved back to Personnel Services`
        );
      }
      
      setSelectedRows([]);
      setChargedToIncomeDialog({ open: false, mode: "tag", amount: "", notes: "" });
      refreshPersonnelData();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update charged to income");
    } finally {
      setChargedToIncomeLoading(false);
    }
  };

  // Manual refresh
  const handleManualRefresh = useCallback(async () => {
    setLoading(true);
    try {
      await refreshPersonnelData();
      await fetchActiveSettings();
      await fetchRATA();
      toast.success("Data refreshed successfully!");
    } catch (_error) {
      toast.error("Failed to refresh data");
    } finally {
      setLoading(false);
    }
  }, [refreshPersonnelData, fetchActiveSettings, fetchRATA]);

  // Enhanced export function that fetches all data
  const handleExportAllData = useCallback(async () => {
    try {
      setLoading(true);

      // Try the getAllPerServices endpoint first (no pagination)
      let response = await api.get('/getpersonnels');

      if (response.data && Array.isArray(response.data)) {
        // Filter for PERMANENT status since getAllPerServices returns all records
        const permanentPersonnel = response.data.filter(person =>
          person.statusOfAppointment === 'PERMANENT' || person.statusOfAppointment === 'Permanent'
        );

        if (permanentPersonnel.length > 0) {
          return permanentPersonnel;
        }
      }

      // Fallback to paginated endpoint with high limit
      response = await api.get(`${apiPath}?statusOfAppointment=${encodeURIComponent('PERMANENT|Permanent')}&limit=50000&page=1`);

      if (response.data && Array.isArray(response.data.personnelServices)) {
        return response.data.personnelServices;
      } else {
        toast.error("Failed to fetch export data");
        return [];
      }
    } catch (error) {
      toast.error("Error fetching export data");
      console.error("Error fetching export data:", error);
      return [];
    } finally {
      setLoading(false);
    }
  }, [apiPath]);

  // View details handler
  const handleViewDetails = (row) => {
    setViewDetailsDialog({ open: true, data: row });
  };

  // Initial data fetch
  useEffect(() => {
    refreshPersonnelData();
    fetchActiveSettings();
    fetchRATA();
  }, [refreshPersonnelData, fetchActiveSettings, fetchRATA]);

  const handleAddAllPersonnel = useCallback(async (statusOfAppointment) => {
    if (!workflowRef) {
      toast.error("Create a proposal first before adding personnel services.");
      setOpenDialog(false);
      return;
    }
    setLoading(true);

    try {
      let currentFiscalYear = fiscalYear;
      let currentBudgetType = budgetType;
      let currentPERA = PERA;
      let currentCompensation = compensation;

      if (!currentFiscalYear) {
        const latestSettings = await fetchActiveSettings();
        currentFiscalYear = latestSettings?.fiscalYear || "";
        currentBudgetType = latestSettings?.budgetType || "";
        currentPERA = latestSettings?.PERA || 0;
        currentCompensation = {
          uniformALLOWANCE: latestSettings?.uniformAllowance ?? compensation?.uniformALLOWANCE ?? 0,
          productivityIncentive: latestSettings?.productivityIncentive ?? compensation?.productivityIncentive ?? 0,
          medicalAllowance: latestSettings?.medicalAllowance ?? compensation?.medicalAllowance ?? 0,
          meal: latestSettings?.meal ?? compensation?.meal ?? 0,
          cashGift: latestSettings?.cashGift ?? compensation?.cashGift ?? 0,
          pagibigPremium: latestSettings?.pagibigPremium ?? compensation?.pagibigPremium ?? 0,
          gsisPremium: latestSettings?.gsisPremium ?? compensation?.gsisPremium ?? 0,
          employeeCompensation: latestSettings?.employeeCompensation ?? compensation?.employeeCompensation ?? 0,
        };

        if (!currentFiscalYear) {
          toast.error("Active fiscal year not set. Please try again later.");
          return;
        }
      }

      const processBy = `${currentUser.FirstName} ${currentUser.LastName}`;

      // Get active region from localStorage
      let region = null;
      try {
        const activeRegionStr = localStorage.getItem('activeRegion');
        if (activeRegionStr) {
          const activeRegion = JSON.parse(activeRegionStr);
          region = activeRegion.name || activeRegion.regionName;
        }
      } catch (error) {
        console.error('Error parsing active region:', error);
      }

      const response = await api.post(`/personnelServices/bulk-add`, {
        processBy,
        statusOfAppointment,
        fiscalYear: currentFiscalYear,
        budgetType: currentBudgetType,
        PERA: currentPERA,
        RATA: RATA.map(item => ({ grade: item.SG, amount: item.RATA })),
        compensation: currentCompensation,
        region, // Include the active region in the request
        proposalId: proposalId || workflowRef  // ADDED: Use prop first, then hook storage
      }, { headers: headerConfig() });

      if (response.data.added && Array.isArray(response.data.added)) {
        const addedCount = response.data.added.length;
        const duplicateCount = response.data.duplicates ? response.data.duplicates.length : 0;
        
        if (addedCount > 0) {
          toast.success(`Successfully added ${addedCount} personnel services${duplicateCount > 0 ? ` (${duplicateCount} duplicates skipped)` : ''}!`);
        } else if (duplicateCount > 0) {
          toast.warning(`No new personnel added. ${duplicateCount} employees already exist in the system.`);
        } else {
          toast.info(response.data.message || "No personnel services to add.");
  }
        
  await refreshPersonnelData();
      } else if (response.data.message) {
        toast.info(response.data.message);
        console.error("Bulk add response:", response.data);
      } else {
        toast.info("Bulk add completed");
        console.error("Bulk add response is not in expected format:", response.data);
      }

    } catch (error) {
      if (error.response?.status === 403) {
        toast.error(error.response.data.message || "Submission is locked.");
      } else {
        toast.error("Error bulk adding personnel.");
      }
      console.error("Error bulk adding personnel:", error);
    } finally {
      setLoading(false);
      setOpenDialog(false);
    }
  }, [
    fiscalYear,
    budgetType,
    PERA,
    RATA,
    compensation,
    currentUser,
    refreshPersonnelData,
    fetchActiveSettings,
    workflowRef,
    headerConfig
  ]);

  const handleOpenDialog = () => {
    if (!workflowRef) {
      toast.error("Please create a proposal first before adding personnel services.");
      return;
    }
    setOpenDialog(true);
  };
  const handleCloseDialog = () => setOpenDialog(false);

  // Enhanced additional menu options
  const enhancedMenuOptions = useMemo(() => {
    const options = [...additionalMenuOptions];

    // Add view details option
    options.push((props) => (
      <MenuItem
        key="view-details"
        onClick={() => {
          handleViewDetails(props.row);
          props.parentClose();
        }}
        sx={{ display: "flex", gap: 1 }}
      >
        <VisibilityIcon fontSize="small" />
        View Details
      </MenuItem>
    ));

    // Add duplicate record option
    // options.push((props) => (
    //   <MenuItem
    //     key="duplicate-record"
    //     onClick={() => {
    //       // Create a copy of the record without _id
    //       const duplicateData = { ...props.row };
    //       delete duplicateData._id;
    //       delete duplicateData.createdAt;
    //       delete duplicateData.updatedAt;
    //       // You can implement duplicate functionality here
    //       toast.info("Duplicate functionality to be implemented");
    //       props.parentClose();
    //     }}
    //     sx={{ display: "flex", gap: 1 }}
    //   >
    //     <EditIcon fontSize="small" />
    //     Duplicate Record
    //   </MenuItem>
    // ));

    // Add print option
    // options.push((props) => (
    //   <MenuItem
    //     key="print-record"
    //     onClick={() => {
    //       // Create a print-friendly view of the record
    //       const printWindow = window.open('', '_blank');
    //       const printContent = `
    //         <html>
    //           <head>
    //             <title>Personnel Record - ${props.row.employeeFullName}</title>
    //             <style>
    //               body { font-family: Arial, sans-serif; margin: 20px; }
    //               .header { text-align: center; margin-bottom: 30px; }
    //               .field { margin-bottom: 10px; }
    //               .label { font-weight: bold; display: inline-block; width: 200px; }
    //               .value { display: inline-block; }
    //             </style>
    //           </head>
    //           <body>
    //             <div class="header">
    //               <h2>Personnel Record</h2>
    //               <h3>${props.row.employeeFullName}</h3>
    //             </div>
    //             ${Object.keys(schema).map(key =>
    //               schema[key].label && key !== 'action' ?
    //                 `<div class="field">
    //                   <span class="label">${schema[key].label}:</span>
    //                   <span class="value">${props.row[key] || 'N/A'}</span>
    //                 </div>` : ''
    //             ).join('')}
    //           </body>
    //         </html>
    //       `;
    //       printWindow.document.write(printContent);
    //       printWindow.document.close();
    //       printWindow.print();
    //       props.parentClose();
    //     }}
    //     sx={{ display: "flex", gap: 1 }}
    //   >
    //     <PrintIcon fontSize="small" />
    //     Print Record
    //   </MenuItem>
    // ));

    return options;
  }, [additionalMenuOptions, schema]);

  return (
    <>
      {/* Header Section with Title and User Access Info (hidden via env toggle) */}
  {/* {!(String(import.meta.env.VITE_HIDE_ACCESS_INFO_BANNERS).trim() === 'true') && (
        <Paper sx={{ p: 3, mb: 2, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
          <Box>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              {pageTitle}
            </Typography>
            <Typography variant="h6" sx={{ opacity: 0.9, mb: 2 }}>
              {pageDescription}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.8, mb: 1 }}>
              Access Level: {currentUser?.hierarchicalAccess?.scope || 'REGION'}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.7, mb: 1 }}>
              Active Region: {activeRegion?.name || activeRegion?.regionName || 'All Regions'}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.7 }}>
              {currentUser?.hierarchicalAccess?.scope === 'RESPONSIBILITY_CENTER'
                ? `You can process permanent personnel within your responsibility center (${currentUser?.hierarchicalAccess?.accessibleDivisions?.[0] || 'Responsibility Center'}). Bulk operations are limited to your access scope.`
                : currentUser?.hierarchicalAccess?.scope === 'OFFICE'
                ? `You can process permanent personnel across your office (${currentUser?.hierarchicalAccess?.accessibleDepartments?.[0]?.departmentName || 'Office'}). You have oversight of all responsibility centers within your office.`
                : `You have full access to process permanent personnel across all offices and responsibility centers.`
              }
            </Typography>
          </Box>
        </Paper>
      )} */}

      {/* Enhanced Action Bar */}

      {/* Enhanced Action Bar */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
          <Box display="flex" alignItems="center" gap={2}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleOpenDialog}
              disabled={locked || !hasWorkflowRef}
              sx={{
                background: "#009688",
                color: "#fff",
                "&:hover": {
                  background: "#00796B",
                  color: "#fff",
                  textDecoration: "underline rgb(255, 255, 255)"
                },
              }}
              startIcon={<PersonAddIcon />}
            >
              Add Personnel
            </Button>
            <Button
              variant="outlined"
              color="info"
              startIcon={<PesoIcon />}
              disabled={!selectedRows.length}
              onClick={() => handleOpenChargedToIncomeDialog("tag")}
            >
              Charge to Income
            </Button>
            {/* <Button
              variant="text"
              color="error"
              startIcon={<HighlightOffIcon />}
              disabled={!selectedRows.length}
              onClick={() => handleOpenChargedToIncomeDialog("untag")}
            >
              Remove Tag
            </Button> */}
            {!hasWorkflowRef && (
              <Typography variant="caption" color="error" sx={{ maxWidth: 260 }}>
                Create a proposal first to unlock personnel entry.
              </Typography>
            )}

            <Tooltip title="Refresh Data">
              <IconButton
                onClick={handleManualRefresh}
                disabled={loading}
                color="primary"
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>

            <FormControlLabel
              control={
                <Switch
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  color="primary"
                />
              }
              label="Auto Refresh"
            />
          </Box>

          <Box display="flex" alignItems="center" gap={2}>
            <Typography variant="body2" color={selectedRows.length ? "primary" : "text.secondary"}>
              Selected: {selectedRows.length.toLocaleString("en-US")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Records loaded: {filteredRows.length.toLocaleString('en-US')}
            </Typography>
            <Tooltip title="Column Visibility">
              <IconButton onClick={handleFilterMenuClick}>
                <VisibilityIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title="Export Options">
              <IconButton onClick={handleExportMenuClick}>
                <GetAppIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Paper>

      {/* Column Visibility Menu */}
      <Menu
        anchorEl={filterMenuAnchor}
        open={Boolean(filterMenuAnchor)}
        onClose={handleFilterMenuClose}
      >
        <MenuItem disabled>
          <Typography variant="subtitle2">Toggle Columns</Typography>
        </MenuItem>
        <Divider />
        {Object.keys(schema).map((key) => (
          schema[key].label && (
            <MenuItem key={key}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={columnVisibility[key] || false}
                    onChange={() => toggleColumnVisibility(key)}
                  />
                }
                label={schema[key].label}
              />
            </MenuItem>
          )
        ))}
      </Menu>

      {/* Export Menu */}
      <Menu
        anchorEl={exportMenuAnchor}
        open={Boolean(exportMenuAnchor)}
        onClose={handleExportMenuClose}
      >
        <MenuItem onClick={async () => {
          // Always fetch ALL data for export, don't use current table data which might be paginated
          const exportData = await handleExportAllData();
          // console.log('Fetched export data:', exportData?.length, 'records'); // Debug log
          if (exportData && exportData.length > 0) {
            try {
              // Trigger the export directly using ExcelJS
              const ExcelJS = await import('exceljs');
              const { saveAs } = await import('file-saver');

              const workbook = new ExcelJS.Workbook();
              const worksheet = workbook.addWorksheet("Permanent Personnel");

              const headerFill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FF375E38" }
              };
              const headerFont = { color: { argb: "FFFFFFFF" }, bold: true };

              const exportColumns = Object.keys(schema)
                .filter((key) => (columnVisibility[key] !== false && (schema[key].show === true || key === "action")))
                .map((key) => ({
                  field: key,
                  label: schema[key].label,
                  type: schema[key].type,
                }))
                .filter(col => col.field !== 'action');

              // Add header row
              const headerRow = worksheet.addRow(exportColumns.map((col) => col.label));
              headerRow.eachCell((cell) => {
                cell.fill = headerFill;
                cell.font = headerFont;
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.border = {
                  top: { style: 'thin' },
                  left: { style: 'thin' },
                  bottom: { style: 'thin' },
                  right: { style: 'thin' }
                };
              });

              // Add data rows
              exportData.forEach((item, index) => {
                const rowData = exportColumns.map((col) => {
                  const value = item[col.field];
                  if (col.type === 'number') {
                    return typeof value === 'number' ? value : 0;
                  } else if (col.type === 'date') {
                    return value ? new Date(value) : '';
                  } else {
                    return value || '';
                  }
                });

                const dataRow = worksheet.addRow(rowData);
                dataRow.eachCell((cell, colNumber) => {
                  cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                  };

                  const column = exportColumns[colNumber - 1];
                  if (column && column.type === 'number') {
                    cell.numFmt = '#,##0.00';
                    cell.alignment = { horizontal: 'right' };
                  } else if (column && column.type === 'date') {
                    cell.numFmt = 'mm/dd/yyyy';
                    cell.alignment = { horizontal: 'center' };
                  }
                });

                if (index % 2 === 1) {
                  dataRow.eachCell((cell) => {
                    cell.fill = {
                      type: 'pattern',
                      pattern: 'solid',
                      fgColor: { argb: 'FFF5F5F5' }
                    };
                  });
                }
              });

              // Auto-fit columns
              worksheet.columns.forEach((column, index) => {
                const exportColumn = exportColumns[index];
                if (exportColumn) {
                  const headerLength = exportColumn.label.length;
                  column.width = Math.max(headerLength + 2, 15);
                  if (exportColumn.type === 'number') {
                    column.width = Math.max(column.width, 18);
                  }
                }
              });

              // Generate and download
              const buffer = await workbook.xlsx.writeBuffer();
              const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
              saveAs(new Blob([buffer]), `Permanent_Personnel_${timestamp}.xlsx`);

              toast.success("Excel file exported successfully!");
            } catch (error) {
              console.error('Export error:', error);
              toast.error("Failed to export Excel file");
            }
          } else {
            toast.warning("No data available to export");
          }
          handleExportMenuClose();
        }}>
          <ListItemIcon>
            <GetAppIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Export to Excel</ListItemText>
        </MenuItem>
        <MenuItem onClick={async () => {
          try {
            setLoading(true);
            handleExportMenuClose();

            // Call server-side PDF generation endpoint
            const exportParams = {
              fiscalYear: fiscalYear,
              region: activeRegion?.name || activeRegion?.regionName || '',
              office: headerConfig?.office || '',
              responsibilityCenter: headerConfig?.responsibilityCenter || '',
            };

            const response = await api.post(
              '/api/personnel-services-pdf/export-permanent',
              exportParams,
              {
                responseType: 'blob',
                timeout: 60000, // 60 second timeout for large datasets
              }
            );

            // Create download link
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Personnel_Permanent_FY${fiscalYear || 'N_A'}_${activeRegion?.name || 'Region'}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            toast.success('PDF report generated successfully');
          } catch (error) {
            console.error('PDF export error:', error);
            toast.error(error.response?.data?.message || 'Failed to generate PDF report');
          } finally {
            setLoading(false);
          }
        }}>
          <ListItemIcon>
            <PrintIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Export to PDF</ListItemText>
        </MenuItem>
      </Menu>



      {/* Bulk Add Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog}>
        <DialogTitle>Confirm Bulk Add</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to add all personnel with a status of appointment as PERMANENT?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} color="primary">
            Cancel
          </Button>
          <Button
            onClick={() => handleAddAllPersonnel("PERMANENT")}
            color="primary"
            autoFocus
          >
            {loading ? <CircularProgress size={24} /> : "Yes"}
          </Button>
        </DialogActions>
      </Dialog>



      {/* View Details Dialog */}
      <Dialog
        open={viewDetailsDialog.open}
        onClose={() => setViewDetailsDialog({ open: false, data: null })}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Personnel Details</DialogTitle>
        <DialogContent>
          {viewDetailsDialog.data && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {Object.keys(schema).map((key) => (
                schema[key].label && key !== 'action' && (
                  <Box key={key} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Typography variant="subtitle2" color="textSecondary">
                      {schema[key].label}
                    </Typography>
                    <Typography variant="body1">
                      {schema[key].type === 'number'
                        ? (viewDetailsDialog.data[key] || 0).toLocaleString()
                        : viewDetailsDialog.data[key] || 'N/A'
                      }
                    </Typography>
                  </Box>
                )
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDetailsDialog({ open: false, data: null })}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Charged to Income Dialog */}
      <Dialog
        open={chargedToIncomeDialog.open}
        onClose={handleCloseChargedToIncomeDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {chargedToIncomeDialog.mode === "tag" ? "Charge to Income Recipients" : "Remove Charged to Income Tags"}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {chargedToIncomeDialog.mode === "tag"
              ? `Move ${selectedRows.length.toLocaleString('en-US')} personnel to Charged to Income?`
              : `Remove ${selectedRows.length.toLocaleString('en-US')} personnel from Charged to Income?`}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseChargedToIncomeDialog} disabled={chargedToIncomeLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmChargedToIncome}
            variant="contained"
            color={chargedToIncomeDialog.mode === "tag" ? "primary" : "error"}
            disabled={chargedToIncomeLoading}
          >
            {chargedToIncomeLoading
              ? "Processing..."
              : chargedToIncomeDialog.mode === "tag"
              ? "Confirm Move"
              : "Confirm Remove"}
          </Button>
        </DialogActions>
      </Dialog>

      <ToastContainer />

      <CustomTable
        ROWS_PER_PAGE={ROWS_PER_PAGE}
        dataListName={dataListName}
        apiPath={apiPath}
        proposalId={proposalId || workflowRef}
        onDataChange={setFilteredRows}
        selectedRows={selectedRows}
        onRowSelectionChange={setSelectedRows}
        columns={useMemo(() => Object.keys(schema)
          .filter((key) => (columnVisibility[key] !== false && (schema[key].show === true || key === "action")))
          .map((key) => {
            const fieldSchema = schema[key];
            const column = {
              field: key,
              label: fieldSchema.label,
              type: fieldSchema.type,
              searchable: fieldSchema.searchable || false,
              textAlign: fieldSchema.alignRight ? "right" : "left",
            };

            if (fieldSchema.type === "action") {
              column.render = (row) => (
                <CustomMenu
                  additionalMenuOptions={enhancedMenuOptions}
                  customEditElement={customEditElement}
                  hasEdit={hasEdit}
                  hasDelete={hasDelete}
                  row={row}
                  schema={schema}
                  endpoint={apiPath}
                  dataListName={dataListName}
                  onAfterInvalidate={invalidatePersonnelRelatedQueries}
                  disableEdit={row.status === "Submitted" || row.status === "Approved"}
                  disableDelete={row.status === "Submitted" || row.status === "Approved"}
                />
              );
            }

            if (fieldSchema.customRender) {
              column.render = (row) => fieldSchema.customRender(row);
            }

            return column;
          }), [schema, columnVisibility, enhancedMenuOptions, customEditElement, hasEdit, hasDelete, apiPath, dataListName, invalidatePersonnelRelatedQueries])}
      />
    </>
  );
};

PSPCustomPageTable.propTypes = {
  dataListName: PropTypes.string.isRequired,
  schema: PropTypes.objectOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      type: PropTypes.string.isRequired,
      show: PropTypes.bool,
      searchable: PropTypes.bool,
      customRender: PropTypes.func,
      default: PropTypes.any,
      alignRight: PropTypes.bool,
    })
  ).isRequired,
  title: PropTypes.string,
  description: PropTypes.string,
  hasEdit: PropTypes.bool,
  hasDelete: PropTypes.bool,
  customEditElement: PropTypes.element,
  additionalMenuOptions: PropTypes.array,
  ROWS_PER_PAGE: PropTypes.number,
};

export default PSPCustomPageTable;
