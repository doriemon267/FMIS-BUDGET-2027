import React, { useState, useEffect, useCallback, useMemo } from "react";
import CustomMenu from "./PersonnelCustomMenu";
import CustomTable from "./PersonnelCustomTable";
import PropTypes from "prop-types";
import { useRegion } from "../../context/RegionContext";
import ActiveRegionDisplay from "../common/ActiveRegionDisplay";
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  MenuItem,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
  Chip,
  Menu,
  Divider,
  Checkbox,
  FormControlLabel as MuiFormControlLabel,
} from "@mui/material";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import api from "../../config/api";
import { useUser } from "../../context/UserContext";
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { useQueryClient } from "@tanstack/react-query";
import { invalidateDataList } from "../../utils/queryClientHelpers";
import VisibilityIcon from '@mui/icons-material/Visibility';
import PrintIcon from '@mui/icons-material/Print';
import RefreshIcon from '@mui/icons-material/Refresh';
import GetAppIcon from '@mui/icons-material/GetApp';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/Edit';

// Helper function to format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const PSCasualCustomPageTable = ({
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
  locked = false,
}) => {
  const [rows, setRows] = useState([]);
  const [filteredRows, setFilteredRows] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fiscalYear, setFiscalYear] = useState("");
  const [budgetType, setBudgetType] = useState("");
  const [PERA, setPERA] = useState(0);
  const [RATA, setRATA] = useState([]);
  const [compensation, setCompensation] = useState({});
  const { currentUser } = useUser();
  const queryClient = useQueryClient();

  // New state for view details
  const [selectedPersonnel, setSelectedPersonnel] = useState(null);
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [viewData, setViewData] = useState([]);
  const [grandTotal, setGrandTotal] = useState(0);

  // Print-related state
  const [printPreviewDialog, setPrintPreviewDialog] = useState({ open: false, content: '', data: [] });
  const [selectedRows, setSelectedRows] = useState([]);
  const [columnVisibility, setColumnVisibility] = useState({});
  const [filterMenuAnchor, setFilterMenuAnchor] = useState(null);
  const [exportMenuAnchor, setExportMenuAnchor] = useState(null);
  const [bulkActionAnchor, setBulkActionAnchor] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const apiPath = `/${dataListName}`;

  const pageTitle = useMemo(() => title || dataListName.charAt(0).toUpperCase() + dataListName.slice(1), [title, dataListName]);
  const pageDescription = useMemo(() => description || `Manage ${dataListName}`, [description, dataListName]);

  const fetchActiveSettings = useCallback(async () => {
    try {
      const response = await api.get("/settings/active");
      if (response.data) {
        const settings = response.data;
        setFiscalYear(settings.fiscalYear || "");
        setBudgetType(settings.budgetType || "");
        setPERA(settings.PERA || 0);
        setCompensation({
          uniformALLOWANCE: settings.uniformAllowance,
          productivityIncentive: settings.productivityIncentive,
          medicalAllowance: settings.medicalAllowance,
          meal: settings.meal,
          cashGift: settings.cashGift,
          pagibigPremium: settings.pagibigPremium,
          gsisPremium: settings.gsisPremium,
          employeeCompensation: settings.employeeCompensation,
        });
        return settings;
      }
      toast.error("Active settings not found.");
      return null;
    } catch (error) {
      toast.error("Error fetching active settings.");
      console.error("Error fetching active settings:", error);
      return null;
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const { data } = await api.get(`${apiPath}?statusOfAppointment=CASUAL`);
      if (data && Array.isArray(data.personnelServices)) {
        setRows(data.personnelServices);
        setFilteredRows(data.personnelServices);
      } else {
        toast.error("Fetched data is not in the expected format.");
        console.error("Fetched data is not an array:", data);
      }
    } catch (error) {
      toast.error("Error fetching personnel data.");
      console.error("Error fetching data:", error);
    }
  }, [apiPath]);

  const fetchRATA = useCallback(async () => {
    try {
      const response = await api.get("/ratas");
      if (response.data && Array.isArray(response.data.ratas)) {
        setRATA(response.data.ratas);
      } else {
        toast.error("RATA data format incorrect.");
        console.error("RATA response format incorrect:", response.data);
      }
    } catch (error) {
      toast.error("Error fetching RATA data.");
      console.error("Error fetching RATA data:", error);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchActiveSettings();
    fetchRATA();
  }, [fetchData, fetchActiveSettings, fetchRATA]);

  useEffect(() => {
    setFilteredRows(rows);
  }, [rows]);

  const handleAddAllPersonnel = useCallback(async () => {
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
        statusOfAppointment: "CASUAL",
        fiscalYear: currentFiscalYear,
        budgetType: currentBudgetType,
        PERA: currentPERA,
        RATA: RATA.map(item => ({ grade: item.SG, amount: item.RATA })),
        compensation: currentCompensation,
        region // Include the active region in the request
      });

      if (response.data.added && Array.isArray(response.data.added)) {
        const addedCount = response.data.added.length;
        const duplicateCount = response.data.duplicates ? response.data.duplicates.length : 0;
        
        if (addedCount > 0) {
          toast.success(`Successfully added ${addedCount} casual personnel${duplicateCount > 0 ? ` (${duplicateCount} duplicates skipped)` : ''}!`);
        } else if (duplicateCount > 0) {
          toast.warning(`No new casual personnel added. ${duplicateCount} employees already exist in the system.`);
        } else {
          toast.info(response.data.message || "No casual personnel services to add.");
        }
        
        await fetchData();
        await invalidateDataList(queryClient, dataListName);
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
    fetchData,
    queryClient,
    dataListName,
    fetchActiveSettings
  ]);

  const handleOpenDialog = () => {
    if (locked) return;
    setOpenDialog(true);
  };
  const handleCloseDialog = () => setOpenDialog(false);

  // New function to handle view details
  const handleViewDetails = useCallback(async (personnelId) => {
    try {
      const { data } = await api.get(`${apiPath}/${personnelId}`);
      if (data) {
        setSelectedPersonnel(data);
        
        // Format the data for the view table
        const formattedData = [{
          positionTitle: data.positionTitle || 'N/A',
          gradelevel_SG: data.gradelevel_JG || 'N/A',
          step: data.step || 'N/A',
          employeeFullName: data.employeeFullName || 'N/A',
          division: data.division || 'N/A',
          monthlySalary: data.monthlySalary || 0,
          annualSalary: data.annualSalary || 0,
          RATA: data.RATA || 0,
          PERA: data.PERA || 0,
          uniformALLOWANCE: data.uniformALLOWANCE || 0,
          midyearBonus: data.midyearBonus || 0,
          yearEndBonus: data.yearEndBonus || 0,
          Total: data.Total || 0,
        }];
        
        setViewData(formattedData);
        setGrandTotal(data.Total || 0);
        setOpenViewDialog(true);
      }
    } catch (error) {
      toast.error("Error fetching personnel details.");
      console.error("Error fetching personnel details:", error);
    }
  }, [apiPath]);

  // Function to close view dialog
  const handleCloseViewDialog = () => {
    setOpenViewDialog(false);
    setSelectedPersonnel(null);
  };

  // Print functionality functions
  const handleManualRefresh = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

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

  // Enhanced export function that fetches all data
  const handleExportAllData = useCallback(async () => {
    try {
      setLoading(true);
      let response = await api.get('/getcasuals');

      if (response.data && Array.isArray(response.data)) {
        // console.log('Export data fetched successfully:', response.data.length, 'records');
        return response.data;
      } else {
        console.error('Export data is not in expected format:', response.data);
        toast.error("Failed to fetch export data");
        return [];
      }
    } catch (error) {
      console.error('Error fetching all data for export:', error);
      toast.error("Error fetching data for export");
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Generate print content function
  const generatePrintContent = useCallback((printData) => {
    if (!printData || printData.length === 0) {
      console.error('No data provided for print generation');
      return '';
    }

    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Define print sections for casual personnel
    const printSections = [
      {
        title: "PERSONNEL INFORMATION",
        columns: [
          { field: 'employeeFullName', label: 'Employee Name', type: 'text' },
          { field: 'positionTitle', label: 'Position Title', type: 'text' },
          { field: 'gradelevel_JG', label: 'JG', type: 'text' },
          { field: 'step', label: 'Step', type: 'text' },
          { field: 'division', label: 'Division', type: 'text' },
          { field: 'dateOfBirth', label: 'Date of Birth', type: 'date' }
        ]
      },
      {
        title: "BASIC SALARY & BENEFITS",
        columns: [
          { field: 'employeeFullName', label: 'Employee Name', type: 'text' },
          { field: 'monthlySalary', label: 'Monthly Salary', type: 'number' },
          { field: 'annualSalary', label: 'Annual Salary', type: 'number' },
          { field: 'PERA', label: 'PERA', type: 'number' },
          { field: 'RATA', label: 'RATA', type: 'number' }
        ]
      },
      {
        title: "ALLOWANCES & SUBSIDIES",
        columns: [
          { field: 'employeeFullName', label: 'Employee Name', type: 'text' },
          { field: 'uniformALLOWANCE', label: 'Uniform Allowance', type: 'number' },
          { field: 'medical', label: 'Medical Allowance', type: 'number' },
          { field: 'childrenAllowance', label: 'Children Allowance', type: 'number' },
          { field: 'meal', label: 'Meal Allowance', type: 'number' }
        ]
      },
      {
        title: "BONUSES & GIFTS",
        columns: [
          { field: 'employeeFullName', label: 'Employee Name', type: 'text' },
          { field: 'midyearBonus', label: 'Midyear Bonus', type: 'number' },
          { field: 'yearEndBonus', label: 'Year End Bonus', type: 'number' },
          { field: 'cashGift', label: 'Cash Gift', type: 'number' }
        ]
      },
      {
        title: "TOTAL COMPENSATION",
        columns: [
          { field: 'employeeFullName', label: 'Employee Name', type: 'text' },
          { field: 'Total', label: 'Total Amount', type: 'number' }
        ]
      }
    ];

    // Calculate column totals
    const columnTotals = {};
    printData.forEach(row => {
      Object.keys(row).forEach(key => {
        if (typeof row[key] === 'number' && key !== 'step' && key !== 'gradelevel_JG') {
          columnTotals[key] = (columnTotals[key] || 0) + row[key];
        }
      });
    });

    // Create a very simple HTML structure to avoid layout issues
    const sectionsHtml = printSections.map(section => {
      const columnsHtml = section.columns.map(col => `<th>${col.label}</th>`).join('');
      const rowsHtml = printData.map(row => {
        const cellsHtml = section.columns.map(col => {
          const cellClass = `${col.type === 'number' ? 'number' : ''} ${col.field === 'employeeFullName' ? 'employee-name' : ''}`;
          let cellValue = '';
          if (col.type === 'number') {
            cellValue = (row[col.field] || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          } else if (col.type === 'date') {
            cellValue = row[col.field] ? new Date(row[col.field]).toLocaleDateString() : '';
          } else {
            cellValue = row[col.field] || '';
          }
          return `<td class="${cellClass}">${cellValue}</td>`;
        }).join('');
        return `<tr>${cellsHtml}</tr>`;
      }).join('');

      return `
      <div class="section">
        <div class="section-title">${section.title}</div>
        <table>
          <thead>
            <tr>${columnsHtml}</tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>`;
    }).join('');

    const totalsHtml = Object.entries(columnTotals)
      .filter(([field, total]) => total > 0)
      .map(([field, total]) => {
        const fieldLabels = {
          'monthlySalary': 'Monthly Salary',
          'annualSalary': 'Annual Salary',
          'PERA': 'PERA',
          'RATA': 'RATA',
          'uniformALLOWANCE': 'Uniform Allowance',
          'Total': 'GRAND TOTAL'
        };
        const label = fieldLabels[field] || field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        return `<tr><td><strong>${label}</strong></td><td class="number"><strong>${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td></tr>`;
      }).join('');

    return `<!DOCTYPE html>
            <Button
<head>
  <title>Casual Personnel Services Report</title>
  <style>
              disabled={locked}
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
    .section { margin-bottom: 15px; }
    .section-title { background-color: #4a6741; color: white; padding: 8px; text-align: center; font-weight: bold; margin-bottom: 5px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 15px; border: 1px solid #000; }
    th { background-color: #4a6741; color: white; padding: 6px; border: 1px solid #000; text-align: center; font-weight: bold; }
    td { padding: 4px; border: 1px solid #000; font-size: 9px; }
    .number { text-align: right; }
    .employee-name { font-weight: bold; }
  </style>
</head>
<body>
  <div class="watermark">CONFIDENTIAL - NIA PROPERTY</div>
  <div class="header">
    <h1>NATIONAL IRRIGATION ADMINISTRATION</h1>
    <h2>CASUAL PERSONNEL SERVICES REPORT</h2>
    <h3>As of ${currentDate}</h3>
  </div>
  ${sectionsHtml}

  <div class="section">
    <div class="section-title">SUMMARY TOTALS</div>
    <table>
      <thead>
        <tr>
          <th>Category</th>
          <th>Total Amount</th>
        </tr>
      </thead>
      <tbody>
        ${totalsHtml}
      </tbody>
    </table>
  </div>

  <div style="text-align: center; margin-top: 20px;">
    <p><strong>Total Records: ${printData.length}</strong></p>
    <p style="font-style: italic;">Generated on: ${new Date().toLocaleString()}</p>
  </div>
</body>
</html>`;
  }, []);

  // Function to handle print preview
  const handlePrintPreview = useCallback(async (printData) => {
    try {
      const content = generatePrintContent(printData);

      if (content) {
        setPrintPreviewDialog({
          open: true,
          content: content,
          data: printData
        });
      } else {
        console.error('No content generated');
        toast.error("Failed to generate print content");
      }
    } catch (error) {
      console.error('Error generating print preview:', error);
      toast.error("Failed to generate print preview");
    }
  }, [generatePrintContent]);

  // Function to actually print from preview
  const handleActualPrint = useCallback(() => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printPreviewDialog.content);
    printWindow.document.close();

    // Wait for content to load then print
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    };

    setPrintPreviewDialog({ open: false, content: '', data: [] });
  }, [printPreviewDialog.content]);

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
    // options.push((props) => (
    //   <MenuItem
    //     key="duplicate-record"
    //     onClick={() => {
    //       const duplicateData = { ...props.row };
    //       delete duplicateData._id;
    //       delete duplicateData.createdAt;
    //       delete duplicateData.updatedAt;
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
    //       const printWindow = window.open('', '_blank');
    //       const printContent = `
    //         <html>
    //           <head>
    //             <title>Casual Personnel Record - ${props.row.employeeFullName}</title>
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
    //               <h2>Casual Personnel Record</h2>
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
  }, [additionalMenuOptions, schema, handleViewDetails]);

  return (
    <>
      {/* Header Section with Title and User Access Info (hidden via env toggle) */}
  {!(String(import.meta.env.VITE_HIDE_ACCESS_INFO_BANNERS).trim() === 'true') && (
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
            <Typography variant="body2" sx={{ opacity: 0.7 }}>
              {currentUser?.hierarchicalAccess?.scope === 'RESPONSIBILITY_CENTER'
                ? `You can process casual personnel within your responsibility center (${currentUser?.hierarchicalAccess?.accessibleDivisions?.[0] || 'Responsibility Center'}). Bulk operations are limited to your access scope.`
                : currentUser?.hierarchicalAccess?.scope === 'OFFICE'
                ? `You can process casual personnel across your office (${currentUser?.hierarchicalAccess?.accessibleDepartments?.[0]?.departmentName || 'Office'}). You have oversight of all responsibility centers within your office.`
                : `You have full access to process casual personnel across all offices and responsibility centers.`
              }
            </Typography>
          </Box>
        </Paper>
      )}

      {/* Enhanced Action Bar */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
          <Box display="flex" alignItems="center" gap={2}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleOpenDialog}
              disabled={locked}
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
              Add Casual Personnel
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
        <MenuItem onClick={async () => {
          const exportData = await handleExportAllData();
          if (exportData && exportData.length > 0) {
            import('exceljs').then(async (ExcelJS) => {
              const { saveAs } = await import('file-saver');

              const workbook = new ExcelJS.Workbook();
              const worksheet = workbook.addWorksheet("Casual Personnel");

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

              const headerRow = worksheet.addRow(exportColumns.map((col) => col.label));
              headerRow.eachCell((cell) => {
                cell.fill = headerFill;
                cell.font = headerFont;
                cell.alignment = { horizontal: "center", vertical: "middle" };
                cell.border = {
                  top: { style: "thin" },
                  left: { style: "thin" },
                  bottom: { style: "thin" },
                  right: { style: "thin" }
                };
              });

              exportData.forEach((row) => {
                const dataRow = worksheet.addRow(
                  exportColumns.map((col) => {
                    const value = row[col.field];
                    if (col.type === "number") {
                      return typeof value === "number" ? value : parseFloat(value) || 0;
                    }
                    return value || "";
                  })
                );

                dataRow.eachCell((cell, colNumber) => {
                  const column = exportColumns[colNumber - 1];
                  if (column?.type === "number") {
                    cell.numFmt = "#,##0.00";
                    cell.alignment = { horizontal: "right", vertical: "middle" };
                  } else {
                    cell.alignment = { horizontal: "left", vertical: "middle" };
                  }
                  cell.border = {
                    top: { style: "thin" },
                    left: { style: "thin" },
                    bottom: { style: "thin" },
                    right: { style: "thin" }
                  };
                });
              });

              exportColumns.forEach((col, index) => {
                const column = worksheet.getColumn(index + 1);
                column.width = col.type === "number" ? 15 : 20;
              });

              const buffer = await workbook.xlsx.writeBuffer();
              const blob = new Blob([buffer], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              });
              saveAs(blob, `casual-personnel-${new Date().toISOString().split('T')[0]}.xlsx`);
              toast.success("Excel file exported successfully!");
            }).catch(error => {
              console.error('Error exporting to Excel:', error);
              toast.error("Failed to export Excel file");
            });
          } else {
            toast.error("No data available for export");
          }
          handleExportMenuClose();
        }}>
          <GetAppIcon sx={{ mr: 1 }} />
          Export to Excel
        </MenuItem>
        <MenuItem onClick={async () => {
          const printData = await handleExportAllData();
          if (printData && printData.length > 0) {
            await handlePrintPreview(printData);
          } else {
            toast.error("No data available for printing");
          }
          handleExportMenuClose();
        }}>
          <PrintIcon sx={{ mr: 1 }} />
          Print Report
        </MenuItem>
      </Menu>

      {/* Print Preview Dialog */}
      <Dialog
        open={printPreviewDialog.open}
        onClose={() => setPrintPreviewDialog({ open: false, content: '', data: [] })}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          style: {
            height: '90vh',
            maxHeight: '90vh'
          }
        }}
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Print Preview - Casual Personnel Report</Typography>
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

      <Dialog open={openDialog} onClose={handleCloseDialog}>
        <DialogTitle>Confirm Bulk Add</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to add all personnel with a status of appointment as CASUAL?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} color="primary">
            Cancel
          </Button>
          <Button
            onClick={handleAddAllPersonnel}
            color="primary"
            autoFocus
          >
            {loading ? <CircularProgress size={24} /> : "Yes"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* New View Details Dialog */}
      <Dialog
        open={openViewDialog}
        onClose={handleCloseViewDialog}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>Personnel Details</DialogTitle>
        <DialogContent>
          {selectedPersonnel && (
            <>
              <Typography variant="h6" gutterBottom>
                {selectedPersonnel.employeeFullName} - {selectedPersonnel.positionTitle}
              </Typography>
              
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 3, maxHeight: 600, overflow: 'auto' }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ color: 'white', backgroundColor: '#375e38' }}><strong>Position Title</strong></TableCell>
                      <TableCell sx={{ color: 'white', backgroundColor: '#375e38' }}><strong>SG</strong></TableCell>
                      <TableCell sx={{ color: 'white', backgroundColor: '#375e38' }}><strong>Step</strong></TableCell>
                      <TableCell sx={{ color: 'white', backgroundColor: '#375e38' }}><strong>Employee Name</strong></TableCell>
                      <TableCell sx={{ color: 'white', backgroundColor: '#375e38' }}><strong>Division</strong></TableCell>
                      <TableCell sx={{ color: 'white', backgroundColor: '#375e38' }} align="right"><strong>Monthly</strong></TableCell>
                      <TableCell sx={{ color: 'white', backgroundColor: '#375e38' }} align="right"><strong>Annual</strong></TableCell>
                      <TableCell sx={{ color: 'white', backgroundColor: '#375e38' }} align="right"><strong>RATA</strong></TableCell>
                      <TableCell sx={{ color: 'white', backgroundColor: '#375e38' }} align="right"><strong>PERA</strong></TableCell>
                      <TableCell sx={{ color: 'white', backgroundColor: '#375e38' }} align="right"><strong>Uniform</strong></TableCell>
                      <TableCell sx={{ color: 'white', backgroundColor: '#375e38' }} align="right"><strong>Mid-Year</strong></TableCell>
                      <TableCell sx={{ color: 'white', backgroundColor: '#375e38' }} align="right"><strong>Year-End</strong></TableCell>
                      <TableCell sx={{ color: 'white', backgroundColor: '#375e38' }} align="right"><strong>Total</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {viewData.map((personnel, index) => (
                      <TableRow 
                        key={index}
                        sx={{ 
                          '&:nth-of-type(odd)': { backgroundColor: '#f9f9f9' },
                          '&:hover': { backgroundColor: '#f0f0f0' }
                        }}
                      >
                        <TableCell>{personnel.positionTitle}</TableCell>
                        <TableCell>{personnel.gradelevel_SG}</TableCell>
                        <TableCell>{personnel.step}</TableCell>
                        <TableCell>{personnel.employeeFullName}</TableCell>
                        <TableCell>{personnel.division}</TableCell>
                        <TableCell align="right">{formatCurrency(parseFloat(personnel.monthlySalary))}</TableCell>
                        <TableCell align="right">{formatCurrency(parseFloat(personnel.annualSalary))}</TableCell>
                        <TableCell align="right">{formatCurrency(parseFloat(personnel.RATA))}</TableCell>
                        <TableCell align="right">{formatCurrency(parseFloat(personnel.PERA))}</TableCell>
                        <TableCell align="right">{formatCurrency(parseFloat(personnel.uniformALLOWANCE))}</TableCell>
                        <TableCell align="right">{formatCurrency(parseFloat(personnel.midyearBonus))}</TableCell>
                        <TableCell align="right">{formatCurrency(parseFloat(personnel.yearEndBonus))}</TableCell>
                        <TableCell align="right">{formatCurrency(parseFloat(personnel.Total))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 2 }}>
                <Typography variant="body1" fontWeight="bold" mr={2}>
                  GRAND TOTAL:
                </Typography>
                <Typography variant="body1" fontWeight="bold">
                  {formatCurrency(grandTotal)}
                </Typography>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseViewDialog} color="primary">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <ToastContainer />

      <CustomTable
        ROWS_PER_PAGE={ROWS_PER_PAGE}
        dataListName={dataListName}
        apiPath={apiPath}
        rows={filteredRows}
        selectedRows={selectedRows}
        onSelectionChange={setSelectedRows}
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={setColumnVisibility}
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
                  disableEdit={row.status === "Finalized"}
                  disableDelete={row.status === "Finalized"}
                />
              );
            }

            if (fieldSchema.customRender) {
              column.render = (row) => fieldSchema.customRender(row);
            }

            return column;
          }), [schema, enhancedMenuOptions, customEditElement, hasEdit, hasDelete, apiPath, dataListName, columnVisibility])}
      />
    </>
  );
};

PSCasualCustomPageTable.propTypes = {
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

export default PSCasualCustomPageTable;
