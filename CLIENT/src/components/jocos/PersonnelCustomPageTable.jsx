import React, { useState, useEffect, useMemo, useCallback } from "react";
import CustomMenu from "./PersonnelCustomMenu";
import CustomTable from "./PersonnelCustomTable";
import PropTypes from "prop-types";
import {
  Button,
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  CircularProgress,
  Paper,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
  Chip,
  Menu,
  MenuItem,
  Typography,
  Divider,
  Checkbox,
  FormControlLabel as MuiFormControlLabel,
} from "@mui/material";
import {
  PersonAdd as PersonAddIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
  GetApp as GetAppIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
} from "@mui/icons-material";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import api from "../../config/api";
import { useUser } from "../../context/UserContext";
import { useQueryClient } from "@tanstack/react-query";
import * as XLSX from 'xlsx';

// Define allowed columns for COS (adjust as needed)
const allowedCOSColumns = [
  "department",
  "region",
  // "budgetType",
  // "processBy",
  // "processDate",
  // "fiscalYear",
  "positionTitle",
  "gradelevel_SG",
  "step",
  "gradelevel_JG",
  "employeeFullName",
  "employeeNumber",
  "division",
  "statusOfAppointment",
  "monthlySalary",
  "annualSalary",
  "Total",
];

const PSCOSCustomPageTable = ({
  dataListName,
  schema,
  title = "",
  description = "",
  searchable = true,
  hasEdit = true,
  hasDelete = true,
  hasAdd = true,
  customAddElement = null,
  customEditElement = null,
  additionalMenuOptions = [],
  ROWS_PER_PAGE = 20,
}) => {
  const [openDialog, setOpenDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fiscalYear, setFiscalYear] = useState("");
  const [budgetType, setBudgetType] = useState("");
  const apiPath = `/${dataListName}`;
  const { currentUser } = useUser();
  const queryClient = useQueryClient();

  // New state for enhanced features
  const [selectedPersonnel, setSelectedPersonnel] = useState(null);
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [viewData, setViewData] = useState([]);
  const [grandTotal, setGrandTotal] = useState(0);

  // Enhanced UI state
  const [selectedRows, setSelectedRows] = useState([]);
  const [columnVisibility, setColumnVisibility] = useState({});
  const [filterMenuAnchor, setFilterMenuAnchor] = useState(null);
  const [exportMenuAnchor, setExportMenuAnchor] = useState(null);
  const [bulkActionAnchor, setBulkActionAnchor] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Fetch active settings
  const fetchActiveSettings = async () => {
    try {
      const response = await api.get("/settings/active");
      if (response.data) {
        setFiscalYear(response.data.fiscalYear || "");
        setBudgetType(response.data.budgetType || "");
      }
    } catch (error) {
      console.error("Error fetching active settings:", error);
    }
  };

  useEffect(() => {
    fetchActiveSettings();
  }, []);

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      queryClient.invalidateQueries([dataListName]);
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, queryClient, dataListName]);

  // Bulk add COS personnel – gamit ang react-query invalidation para mag-refetch agad
  const handleAddAllPersonnel = async (statusOfAppointment) => {
    if (!fiscalYear) {
      toast.error("Active fiscal year not set. Please try again later.");
      return;
    }
    setLoading(true);
    try {
      const processBy = `${currentUser.FirstName} ${currentUser.LastName}`;
      const response = await api.post(`/cos-personnel/bulk-add`, {
        processBy,
        statusOfAppointment,
        fiscalYear,
        budgetType,
        region: currentUser?.organizationalAssignment?.regions?.[0]?.regionName || 'CENTRAL OFFICE'
      });

      // Check for successful response - server returns different structures
      if (response.data && (response.data.addedRecords || response.data.message)) {
        if (response.data.addedRecords && response.data.count > 0) {
          toast.success(`${response.data.count} personnel successfully added!`);
        } else if (response.data.message) {
          toast.info(response.data.message);
        } else {
          toast.success("Bulk add operation completed!");
        }
        // Invalidate query para mapilitang mag-refetch ang table data
        queryClient.invalidateQueries([dataListName]);
      } else {
        toast.error("Error: Bulk add response invalid");
      }
    } catch (error) {
      if (error.response?.status === 403) {
        toast.error(error.response.data.message || "Submission is locked.");
      } else {
        toast.error("Error bulk adding personnel: " + error.message);
      }
    } finally {
      setLoading(false);
      setOpenDialog(false);
    }
  };

  const handleOpenDialog = () => setOpenDialog(true);
  const handleCloseDialog = () => setOpenDialog(false);

  // Enhanced functionality handlers
  const handleManualRefresh = useCallback(() => {
    queryClient.invalidateQueries([dataListName]);
    toast.info("Data refreshed");
  }, [queryClient, dataListName]);

  const handleViewDetails = useCallback(async (personnelId) => {
    try {
      const response = await api.get(`/cos-personnel/${personnelId}/details`);
      setViewData(response.data);
      setSelectedPersonnel(personnelId);
      setOpenViewDialog(true);
    } catch (error) {
      toast.error("Error fetching personnel details");
      console.error("Error fetching details:", error);
    }
  }, []);

  const handleFilterMenuClick = (event) => setFilterMenuAnchor(event.currentTarget);
  const handleFilterMenuClose = () => setFilterMenuAnchor(null);
  const handleExportMenuClick = (event) => setExportMenuAnchor(event.currentTarget);
  const handleExportMenuClose = () => setExportMenuAnchor(null);
  const handleBulkActionClick = (event) => setBulkActionAnchor(event.currentTarget);

  const toggleColumnVisibility = (columnKey) => {
    setColumnVisibility(prev => ({
      ...prev,
      [columnKey]: !prev[columnKey]
    }));
  };

  // Enhanced additional menu options
  const enhancedMenuOptions = useMemo(() => {
    const options = [...additionalMenuOptions];

    // Add view details option
    options.push((props) => (
      <MenuItem
        key="view-details"
        onClick={() => {
          handleViewDetails(props.row._id);
          props.parentClose();
        }}
        sx={{ display: "flex", gap: 1 }}
      >
        <VisibilityIcon fontSize="small" />
        View Details
      </MenuItem>
    ));

    // Add duplicate record option
    options.push((props) => (
      <MenuItem
        key="duplicate-record"
        onClick={() => {
          const duplicateData = { ...props.row };
          delete duplicateData._id;
          delete duplicateData.createdAt;
          delete duplicateData.updatedAt;
          toast.info("Duplicate functionality to be implemented");
          props.parentClose();
        }}
        sx={{ display: "flex", gap: 1 }}
      >
        <EditIcon fontSize="small" />
        Duplicate Record
      </MenuItem>
    ));

    return options;
  }, [additionalMenuOptions, handleViewDetails]);

  // Export functionality
  const handleExportExcel = useCallback(async () => {
    try {
      const response = await api.get(`${apiPath}?limit=10000`);
      const data = response.data.data || response.data;

      if (!Array.isArray(data) || data.length === 0) {
        toast.warning("No data to export");
        return;
      }

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(data);

      // Auto-size columns
      const colWidths = Object.keys(data[0]).map(key => ({
        wch: Math.max(key.length, 15)
      }));
      worksheet['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(workbook, worksheet, "COS Personnel");
      XLSX.writeFile(workbook, `cos_personnel_${new Date().toISOString().split('T')[0]}.xlsx`);

      toast.success("Excel file exported successfully");
    } catch (error) {
      toast.error("Error exporting to Excel");
      console.error("Export error:", error);
    }
    handleExportMenuClose();
  }, [apiPath]);

  return (
    <>
      {/* Header Section with Title and User Access Info */}
      <Paper sx={{ p: 3, mb: 2, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
        <Box>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            {title || "COS Personnel Management"}
          </Typography>
          <Typography variant="h6" sx={{ opacity: 0.9, mb: 2 }}>
            {description || "Manage COS personnel data and processing"}
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.8, mb: 1 }}>
            Access Level: {currentUser?.hierarchicalAccess?.scope || 'REGION'}
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.7 }}>
            {currentUser?.hierarchicalAccess?.scope === 'DIVISION' 
              ? `You can process COS personnel within your division (${currentUser?.hierarchicalAccess?.accessibleDivisions?.[0] || 'Division'}). Bulk operations are limited to your access scope.`
              : currentUser?.hierarchicalAccess?.scope === 'DEPARTMENT'
              ? `You can process COS personnel across your department (${currentUser?.hierarchicalAccess?.accessibleDepartments?.[0]?.departmentName || 'Department'}). You have oversight of all divisions within your department.`
              : `You have full access to process COS personnel across all departments and divisions in your region.`
            }
          </Typography>
        </Box>
      </Paper>

      {/* Enhanced Action Bar */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
          <Box display="flex" alignItems="center" gap={2}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleOpenDialog}
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
              disabled={!fiscalYear}
            >
              Add COS Personnel
            </Button>

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

          <Box display="flex" alignItems="center" gap={1}>
            {selectedRows.length > 0 && (
              <Chip
                label={`${selectedRows.length} selected`}
                color="primary"
                variant="outlined"
              />
            )}

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

            {selectedRows.length > 0 && (
              <Tooltip title="Bulk Actions">
                <IconButton onClick={handleBulkActionClick}>
                  <MoreVertIcon />
                </IconButton>
              </Tooltip>
            )}
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
              <MuiFormControlLabel
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
        <MenuItem onClick={handleExportExcel}>
          <GetAppIcon sx={{ mr: 1 }} />
          Export to Excel
        </MenuItem>
        <MenuItem onClick={() => {
          toast.info("PDF export functionality to be implemented");
          handleExportMenuClose();
        }}>
          <GetAppIcon sx={{ mr: 1 }} />
          Export to PDF
        </MenuItem>
      </Menu>

      {/* Bulk Actions Menu */}
      <Menu
        anchorEl={bulkActionAnchor}
        open={Boolean(bulkActionAnchor)}
        onClose={() => setBulkActionAnchor(null)}
      >
        <MenuItem onClick={() => {
          toast.info("Bulk delete functionality to be implemented");
          setBulkActionAnchor(null);
        }}>
          Delete Selected
        </MenuItem>
        <MenuItem onClick={() => {
          toast.info("Bulk update functionality to be implemented");
          setBulkActionAnchor(null);
        }}>
          Update Selected
        </MenuItem>
      </Menu>

      <Dialog open={openDialog} onClose={handleCloseDialog}>
        <DialogTitle>Confirm Bulk Add</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to add all personnel with a status of
            appointment as COS?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} color="primary">
            Cancel
          </Button>
          <Button
            onClick={() => handleAddAllPersonnel("COS")}
            color="primary"
            autoFocus
          >
            {loading ? <CircularProgress size={24} /> : "Yes"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog
        open={openViewDialog}
        onClose={() => setOpenViewDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Personnel Details</DialogTitle>
        <DialogContent>
          {viewData && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6" gutterBottom>
                Employee Information
              </Typography>
              <Typography><strong>Name:</strong> {viewData.employeeFullName}</Typography>
              <Typography><strong>Position:</strong> {viewData.positionTitle}</Typography>
              <Typography><strong>Department:</strong> {viewData.department}</Typography>
              <Typography><strong>Monthly Salary:</strong> ₱{viewData.monthlySalary?.toLocaleString()}</Typography>
              <Typography><strong>Annual Salary:</strong> ₱{viewData.annualSalary?.toLocaleString()}</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenViewDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <ToastContainer />

      <CustomTable
        ROWS_PER_PAGE={ROWS_PER_PAGE}
        dataListName={dataListName}
        apiPath={apiPath}
        selectedRows={selectedRows}
        onSelectionChange={setSelectedRows}
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={setColumnVisibility}
        columns={useMemo(() => Object.keys(schema)
          .filter((key) => (columnVisibility[key] !== false && (allowedCOSColumns.includes(key) || key === "action")))
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
                  activeFiscalYear={fiscalYear}
                  disableEdit={row.status === "Submitted" || row.status === "Approved"}
                  disableDelete={row.status === "Submitted" || row.status === "Approved"}
                />
              );
            }
            if (fieldSchema.customRender) {
              column.render = (row) => fieldSchema.customRender(row);
            }
            return column;
          }), [schema, enhancedMenuOptions, customEditElement, hasEdit, hasDelete, apiPath, dataListName, fiscalYear, columnVisibility])}
      />
    </>
  );
};

PSCOSCustomPageTable.propTypes = {
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
  searchable: PropTypes.bool,
  hasEdit: PropTypes.bool,
  hasDelete: PropTypes.bool,
  hasAdd: PropTypes.bool,
  customAddElement: PropTypes.element,
  customEditElement: PropTypes.element,
  additionalMenuOptions: PropTypes.array,
  ROWS_PER_PAGE: PropTypes.number,
};

export default PSCOSCustomPageTable;
