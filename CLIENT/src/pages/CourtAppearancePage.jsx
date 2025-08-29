import React, { useEffect, useState, useCallback, useMemo } from "react";
import CustomPage from "../components/courtofappearance/CustomPage";
import api from "../config/api";
import { toast } from "react-hot-toast";
import {
  TextField,
  Button,
  Stack,
  Switch,
  FormControlLabel,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Tooltip,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip
} from "@mui/material";
import { useUser } from "../context/UserContext";
import { useRegion } from "../context/RegionContext";
import SaveIcon from "@mui/icons-material/Save";
import { MdCancel } from "react-icons/md";
import GetAppIcon from "@mui/icons-material/GetApp";
import PrintIcon from "@mui/icons-material/Print";
import RefreshIcon from "@mui/icons-material/Refresh";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { alpha } from "@mui/material/styles";

const EmployeeCourtAppearancePage = () => {
  const { currentUser } = useUser();

  // Core data state
  const [settings, setSettings] = useState(null);
  const [tableData, setTableData] = useState([]);
  const [originalData, setOriginalData] = useState([]);
  const [inputErrors, setInputErrors] = useState({});

  // Enhanced UI state
  const [loading, setLoading] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false); // Default to false as per user preference
  const [lastSaved, setLastSaved] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle', 'saving', 'saved', 'error'
  const [validationErrors, setValidationErrors] = useState({});
  const [selectedRows, setSelectedRows] = useState([]);
  const [exportMenuAnchor, setExportMenuAnchor] = useState(null);
  const [printPreviewDialog, setPrintPreviewDialog] = useState({ open: false, content: '', data: [] });

  // 1) Load active settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get("/settings/active");
        if (res.data) {
          setSettings(res.data);
        } else {
          toast.error("No active settings found.");
        }
      } catch (err) {
        toast.error("Failed to fetch settings.");
      }
    };
    fetchSettings();
  }, []);

  // Get region context
  const { activeRegion } = useRegion();
  
  // Enhanced data fetching with loading states and region filtering
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get the active region name
      const regionName = activeRegion?.name || activeRegion?.regionName;
      
      // Include region in the API request
      const res = await api.get("/court-appearances", { 
        params: { 
          limit: 10000,
          region: regionName || '' 
        } 
      });
      
      const data = res.data.data || [];
      
      // If data is empty and there's a message, show it to the user
      if (data.length === 0 && res.data.message) {
        toast(res.data.message, {
          icon: 'ℹ️',
          style: {
            borderRadius: '10px',
            background: '#3498db',
            color: '#fff',
          },
          duration: 4000,
        });
      }
      
      // Add isModified flag
      const dataWithFlag = data.map((row) => ({ ...row, isModified: false }));
      setTableData(dataWithFlag);
      setOriginalData(JSON.parse(JSON.stringify(dataWithFlag)));
      setHasUnsavedChanges(false);
      setValidationErrors({});
    
    } catch (err) {
      console.error("Error fetching court appearances:", err);
      toast.error("Failed to load court appearances.");
    } finally {
      setLoading(false);
    }
  }, [activeRegion]);

  // Export functionality
  const handleExportToCSV = useCallback(() => {
    if (!tableData || tableData.length === 0) {
      toast.error("No data to export");
      return;
    }
    
    // Get region name for filename
    const regionName = activeRegion?.name || activeRegion?.regionName || 'All-Regions';

    const csvData = [
      ["Employee Number", "Full Name", "Position Title", "Department", "Division", "Region", "No. of Court Appearances", "Court Appearance Amount", "Fiscal Year", "Budget Type"],
      ...tableData.map(row => [
        row.employeeNumber || '',
        row.employeeFullName || '',
        row.positionTitle || '',
        row.department || '',
        row.division || '',
        row.region || '',
        row.noOfCourtAppearance || 0,
        row.courtAppearanceAmount || 0,
        row.fiscalYear || '',
        row.budgetType || ''
      ])
    ];

    const csvContent = csvData.map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `court-appearances-${regionName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast.success(`Data exported successfully for ${regionName}!`);
    setExportMenuAnchor(null);
  }, [tableData, activeRegion]);

  // Print functionality
  const generatePrintContent = useCallback((printData) => {
    if (!printData || printData.length === 0) {
      toast.error("No data available to print");
      return null;
    }

    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Get region name for display
    const regionName = activeRegion?.name || activeRegion?.regionName || 'All Regions';
    
    const grandTotal = printData.reduce((sum, row) => sum + (row.courtAppearanceAmount || 0), 0);

    return `<!DOCTYPE html>
<html>
<head>
  <title>Court Appearance Report - ${regionName}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 0.5in;
    }
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 15px;
      font-size: 10px;
    }
    .watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-45deg);
      font-size: 80px;
      color: rgba(255, 0, 0, 0.1);
      font-weight: bold;
      z-index: -1;
      pointer-events: none;
    }
    .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #4a6741; padding-bottom: 10px; }
    .header h1 { margin: 5px 0; font-size: 16px; }
    .header h2 { margin: 5px 0; font-size: 14px; }
    .header h3 { margin: 5px 0; font-size: 12px; }
    .header h4 { margin: 5px 0; font-size: 11px; color: #4a6741; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 15px; border: 1px solid #000; }
    th { background-color: #4a6741; color: white; padding: 6px; border: 1px solid #000; text-align: center; font-weight: bold; }
    td { padding: 4px; border: 1px solid #000; font-size: 9px; }
    .number { text-align: right; }
    .employee-name { font-weight: bold; }
    .total-row { background-color: #f0f0f0; font-weight: bold; }
    .department-note { font-style: italic; color: #4a6741; text-align: center; margin-top: 5px; }
  </style>
</head>
<body>
  <div class="watermark">CONFIDENTIAL</div>
  <div class="header">
    <h1>NATIONAL IRRIGATION ADMINISTRATION</h1>
    <h2>COURT APPEARANCE REPORT</h2>
    <h3>As of ${currentDate}</h3>
    <h4>Region: ${regionName}</h4>
    <div class="department-note">LEGAL SERVICES PERSONNEL ONLY</div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Employee Number</th>
        <th>Full Name</th>
        <th>Position Title</th>
        <th>Department</th>
        <th>Division</th>
        <th>Region</th>
        <th>No. of Court Appearances</th>
        <th>Court Appearance Amount</th>
      </tr>
    </thead>
    <tbody>
      ${printData.map(row => `
        <tr>
          <td>${row.employeeNumber || ''}</td>
          <td class="employee-name">${row.employeeFullName || ''}</td>
          <td>${row.positionTitle || ''}</td>
          <td>${row.department || ''}</td>
          <td>${row.division || ''}</td>
          <td>${row.region || ''}</td>
          <td class="number">${row.noOfCourtAppearance || 0}</td>
          <td class="number">₱${(row.courtAppearanceAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>
      `).join('')}
      <tr class="total-row">
        <td colspan="7" style="text-align: right; font-weight: bold;">GRAND TOTAL:</td>
        <td class="number" style="font-weight: bold;">₱${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>
    </tbody>
  </table>
  <div style="text-align: center; margin-top: 20px;">
    <p><strong>Total Records: ${printData.length}</strong></p>
    <p style="font-style: italic;">Generated on: ${new Date().toLocaleString()}</p>
    <p style="font-style: italic; color: #4a6741;">This report shows court appearances for LEGAL SERVICES personnel only.</p>
  </div>
</body>
</html>`;
  }, [activeRegion]);

  const handlePrintPreview = useCallback(async () => {
    try {
      const content = generatePrintContent(tableData);
      if (content) {
        setPrintPreviewDialog({
          open: true,
          content: content,
          data: tableData
        });
      }
    } catch (error) {
      console.error('Error generating print preview:', error);
      toast.error("Failed to generate print preview");
    }
  }, [tableData, generatePrintContent]);

  const handleActualPrint = useCallback(() => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printPreviewDialog.content);
    printWindow.document.close();

    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    };

    setPrintPreviewDialog({ open: false, content: '', data: [] });
  }, [printPreviewDialog.content]);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  // Refresh data when region changes
  useEffect(() => {
    if (activeRegion) {
      fetchData();
    }
  }, [activeRegion, fetchData]);

  // Auto-save functionality
  useEffect(() => {
    if (!autoSaveEnabled || !hasUnsavedChanges || saveStatus === 'saving') return;

    const autoSaveTimer = setTimeout(async () => {
      if (currentUser && settings) {
        setSaveStatus('saving');
        try {
          await handleSaveAll(true); // Pass true to indicate auto-save
          setLastSaved(new Date());
          setHasUnsavedChanges(false);
          setSaveStatus('saved');
          toast.success("Auto-saved successfully!");
        } catch (error) {
          console.error("Auto-save failed:", error);
          setSaveStatus('error');
          toast.error("Auto-save failed");
        }
      }
    }, 3000); // Auto-save after 3 seconds of inactivity

    return () => clearTimeout(autoSaveTimer);
  }, [autoSaveEnabled, hasUnsavedChanges, saveStatus, currentUser, settings]);

  // Enhanced handleChange with validation and change tracking
  const handleChange = useCallback((employeeNumber, value) => {
    // Validation
    if (Number(value) < 0) {
      setInputErrors((prev) => ({ ...prev, [employeeNumber]: "Value cannot be negative" }));
      setValidationErrors((prev) => ({ ...prev, [employeeNumber]: "Value cannot be negative" }));
      return;
    }

    // Clear errors
    setInputErrors((prev) => {
      const copy = { ...prev };
      delete copy[employeeNumber];
      return copy;
    });
    setValidationErrors((prev) => {
      const copy = { ...prev };
      delete copy[employeeNumber];
      return copy;
    });

    // Update data
    setTableData((prev) =>
      prev.map((row) => {
        if (row.employeeNumber === employeeNumber) {
          const num = Number(value);
          const newRow = {
            ...row,
            noOfCourtAppearance: isNaN(num) ? 0 : num,
            courtAppearanceAmount: settings ? num * settings.courtAppearance : 0,
            isModified: true,
          };
          return newRow;
        }
        return row;
      })
    );

    setHasUnsavedChanges(true);
    setSaveStatus('idle');
  }, [settings]);

  // Enhanced save function with better error handling and validation
  const handleSaveAll = useCallback(async (isAutoSave = false) => {
    if (!settings) {
      toast.error("Settings not loaded.");
      return;
    }

    // Check for validation errors
    if (Object.keys(validationErrors).length > 0) {
      toast.error("Please fix validation errors before saving.");
      return;
    }

    const processBy = `${currentUser.FirstName} ${currentUser.LastName}`;
    const processDate = new Date();
    const fiscalYear = settings.fiscalYear;
    const budgetType = settings.budgetType;

    try {
      setSaveStatus('saving');
      const modified = tableData.filter((row) => row.isModified);

      if (modified.length === 0) {
        if (!isAutoSave) {
          toast("No changes to save.");
        }
        setSaveStatus('saved');
        return;
      }

      await Promise.all(
        modified.map((row) => {
          const payload = {
            employeeNumber: row.employeeNumber,
            employeeFullName: row.employeeFullName,
            positionTitle: row.positionTitle,
            department: row.department,
            division: row.division,
            region: row.region,
            noOfCourtAppearance: row.noOfCourtAppearance,
            courtAppearanceAmount: row.noOfCourtAppearance * settings.courtAppearance,
            processBy,
            processDate,
            fiscalYear,
            budgetType,
          };
          if ((row._id || "").includes("_temp")) {
            return api.post("/court-appearances", payload);
          } else {
            return api.put(`/court-appearances/${row._id}`, payload);
          }
        })
      );

      if (!isAutoSave) {
        toast.success(`Successfully saved ${modified.length} changes.`);
      }

      setLastSaved(new Date());
      setHasUnsavedChanges(false);
      setSaveStatus('saved');
      await fetchData();
    } catch (err) {
      console.error("Batch save error:", err);
      setSaveStatus('error');
      toast.error(err.response?.data?.message || "Error saving changes.");
    }
  }, [settings, validationErrors, currentUser, tableData, fetchData]);

  // Enhanced cancel function
  const handleCancel = useCallback(() => {
    setTableData(JSON.parse(JSON.stringify(originalData)));
    setInputErrors({});
    setValidationErrors({});
    setHasUnsavedChanges(false);
    setSaveStatus('idle');
    setSelectedRows([]);
    toast("Changes discarded.");
  }, [originalData]);

  // Save status component
  const SaveStatusIndicator = () => {
    const getStatusColor = () => {
      switch (saveStatus) {
        case 'saving': return 'info';
        case 'saved': return 'success';
        case 'error': return 'error';
        default: return 'text.secondary';
      }
    };

    const getStatusText = () => {
      switch (saveStatus) {
        case 'saving': return 'Saving...';
        case 'saved': return lastSaved ? `Last saved: ${lastSaved.toLocaleTimeString()}` : 'Saved';
        case 'error': return 'Save failed';
        default: return hasUnsavedChanges ? 'Unsaved changes' : 'All changes saved';
      }
    };

    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {saveStatus === 'saving' && <CircularProgress size={16} />}
        <Typography
          variant="caption"
          color={`${getStatusColor()}.main`}
          sx={{ fontWeight: 'medium' }}
        >
          {getStatusText()}
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={autoSaveEnabled}
              onChange={(e) => {
                setAutoSaveEnabled(e.target.checked);
                toast.success(e.target.checked ? "Auto-save enabled" : "Auto-save disabled");
              }}
              size="small"
            />
          }
          label="Auto-save"
          sx={{ ml: 2 }}
        />
      </Box>
    );
  };

  // Enhanced header buttons with more functionality
  const headerButtons = useMemo(() => (
    <Stack direction="row" spacing={1} alignItems="center">
      {/* Save Status Indicator */}
      <SaveStatusIndicator />

      {/* Region Indicator */}
      {activeRegion && (
        <Chip
          label={`Region: ${activeRegion.name || activeRegion.regionName}`}
          color="primary"
          size="small"
          variant="outlined"
          sx={{ mr: 1 }}
        />
      )}

      {/* Validation Errors Alert */}
      {Object.keys(validationErrors).length > 0 && (
        <Chip
          label={`${Object.keys(validationErrors).length} validation errors`}
          color="error"
          size="small"
          variant="outlined"
        />
      )}

      {/* Save Button */}
      <Tooltip title="Save all changes">
        <Button
          onClick={() => handleSaveAll(false)}
          color="success"
          variant="contained"
          disabled={saveStatus === 'saving' || Object.keys(validationErrors).length > 0}
          sx={{
            background: "#009688",
            color: "#fff",
            "&:hover": {
              background: "#00796B",
              color: "#fff",
              textDecoration: "underline rgb(255, 255, 255)"
            },
            "&:disabled": {
              background: "#ccc",
              color: "#666"
            }
          }}
          startIcon={saveStatus === 'saving' ? <CircularProgress size={16} /> : <SaveIcon />}
        >
          {saveStatus === 'saving' ? 'Saving...' : 'Save'}
        </Button>
      </Tooltip>

      {/* Cancel Button */}
      <Tooltip title="Discard all changes">
        <Button
          onClick={handleCancel}
          color="warning"
          variant="contained"
          disabled={saveStatus === 'saving'}
          sx={{
            background: "#9E9E9E",
            color: "#fff",
            "&:hover": {
              background: "#757575",
              color: "#fff",
              textDecoration: "underline rgb(255, 255, 255)"
            },
          }}
          startIcon={<MdCancel />}
        >
          Cancel
        </Button>
      </Tooltip>

      {/* Refresh Button */}
      <Tooltip title="Refresh data">
        <IconButton
          onClick={fetchData}
          disabled={loading}
          sx={{
            color: 'white',
            '&:hover': { backgroundColor: alpha('#fff', 0.1) }
          }}
        >
          <RefreshIcon />
        </IconButton>
      </Tooltip>

      {/* Export Menu */}
      <Tooltip title="Export options">
        <IconButton
          onClick={(e) => setExportMenuAnchor(e.currentTarget)}
          sx={{
            color: 'white',
            '&:hover': { backgroundColor: alpha('#fff', 0.1) }
          }}
        >
          <MoreVertIcon />
        </IconButton>
      </Tooltip>
    </Stack>
  ), [saveStatus, lastSaved, hasUnsavedChanges, autoSaveEnabled, validationErrors, loading, handleSaveAll, handleCancel, fetchData, activeRegion]);

  // 7) Table schema
  const schema = {
    employeeNumber: { type: "text", label: "Employee Number" },
    employeeFullName: { type: "text", label: "Full Name", show: true },
    positionTitle: { type: "text", label: "Position Title", show: true },
    department: { type: "text", label: "Department" },
    division: { type: "text", label: "Division" },
    region: { type: "text", label: "Region" },
    noOfCourtAppearance: {
      type: "number",
      label: "No. of Court Appearances",
      show: true,
      customRender: (row) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TextField
            type="number"
            size="small"
            error={Boolean(inputErrors[row.employeeNumber])}
            helperText={inputErrors[row.employeeNumber]}
            slotProps={{
              htmlInput: {
                min: 0,
                step: 1
              }
            }}
            value={row.noOfCourtAppearance ?? ""}
            onChange={(e) =>
              handleChange(
                row.employeeNumber,
                e.target.value === "" ? 0 : e.target.value
              )
            }
            disabled={
              row.status === "Submitted" ||
              row.status === "Approve" ||
              row.status === "Approved"
            }
            sx={{
              minWidth: 120,
              '& .MuiOutlinedInput-root': {
                '&.Mui-focused fieldset': {
                  borderColor: '#009688',
                },
              },
            }}
          />
          {row.isModified && (
            <Chip
              label="Modified"
              size="small"
              color="warning"
              variant="outlined"
              sx={{ fontSize: '0.7rem', height: 20 }}
            />
          )}
        </Box>
      ),
    },
    
    courtAppearanceAmount: {
      type: "number",
      label: "Court Appearance Amount",
      show: true,
      customRender: (row) =>
        `₱${(row.courtAppearanceAmount || 0).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
    },
    fiscalYear: { type: "text", label: "Fiscal Year" },
    budgetType: { type: "text", label: "Budget Type" },
  };

  // Get region name for display
  const regionName = activeRegion?.name || activeRegion?.regionName;
  
  return (
    <>
      <CustomPage
        dataListName="court-appearances"
        schema={schema}
        hasAdd={false}
        tableData={tableData}
        customAddElement={headerButtons}
        title={`Court Appearance Management ${regionName ? `- ${regionName} Region` : ''}`}
        description={`Manage court appearance records and allowances for LEGAL SERVICES personnel ${regionName ? `in ${regionName} region` : ''}`}
      />

      {/* Export Menu */}
      <Menu
        anchorEl={exportMenuAnchor}
        open={Boolean(exportMenuAnchor)}
        onClose={() => setExportMenuAnchor(null)}
      >
        <MenuItem onClick={handleExportToCSV}>
          <ListItemIcon>
            <GetAppIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Export to CSV</ListItemText>
        </MenuItem>
        <MenuItem onClick={handlePrintPreview}>
          <ListItemIcon>
            <PrintIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Print Preview</ListItemText>
        </MenuItem>
      </Menu>

      {/* Print Preview Dialog */}
      <Dialog
        open={printPreviewDialog.open}
        onClose={() => setPrintPreviewDialog({ open: false, content: '', data: [] })}
        maxWidth="lg"
        fullWidth
        slotProps={{
          paper: {
            sx: { height: '90vh' }
          }
        }}
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">
              Print Preview - Court Appearance Report
              {activeRegion && (
                <Typography variant="caption" display="block" color="text.secondary">
                  Region: {activeRegion.name || activeRegion.regionName} | LEGAL SERVICES Personnel Only
                </Typography>
              )}
            </Typography>
            <Box>
              <Button
                onClick={handleActualPrint}
                variant="contained"
                color="primary"
                startIcon={<PrintIcon />}
                sx={{ mr: 1 }}
              >
                Print
              </Button>
              <Button
                onClick={() => setPrintPreviewDialog({ open: false, content: '', data: [] })}
                variant="outlined"
              >
                Close
              </Button>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <Box
            component="iframe"
            srcDoc={printPreviewDialog.content}
            sx={{
              width: '100%',
              height: '100%',
              border: 'none',
              minHeight: '70vh'
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Validation Errors Alert */}
      {Object.keys(validationErrors).length > 0 && (
        <Alert
          severity="error"
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            zIndex: 1300,
            maxWidth: 400
          }}
          onClose={() => setValidationErrors({})}
        >
          <Typography variant="body2" fontWeight="bold">
            Validation Errors ({Object.keys(validationErrors).length}):
          </Typography>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {Object.entries(validationErrors).map(([key, error]) => (
              <li key={key}>{error}</li>
            ))}
          </ul>
        </Alert>
      )}
    </>
  );
};

export default EmployeeCourtAppearancePage;
