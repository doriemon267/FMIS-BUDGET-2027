import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  Chip,
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
  Alert,
} from "@mui/material";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import api from "../../config/api";
import { useRegion } from "../../context/RegionContext";
import ActiveRegionDisplay from "../common/ActiveRegionDisplay";
import { useUser } from "../../context/UserContext";
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import FilterListIcon from '@mui/icons-material/FilterList';
import GetAppIcon from '@mui/icons-material/GetApp';
import PrintIcon from '@mui/icons-material/Print';
import { useQueryClient } from "@tanstack/react-query";

const PSPCustomPageTable = ({
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
  const { activeRegion } = useRegion();
  const [regionFilter, setRegionFilter] = useState("");
  const queryClient = useQueryClient();

  // Enhanced state management
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(null);
  const [columnVisibility, setColumnVisibility] = useState({});
  const [anchorEl, setAnchorEl] = useState(null);
  const [filterMenuAnchor, setFilterMenuAnchor] = useState(null);
  const [exportMenuAnchor, setExportMenuAnchor] = useState(null);
  const [viewDetailsDialog, setViewDetailsDialog] = useState({ open: false, data: null });
  const [currentTableData, setCurrentTableData] = useState([]);
  const [printPreviewDialog, setPrintPreviewDialog] = useState({ open: false, content: '', data: [] });

  const pageTitle = useMemo(() => title || dataListName.charAt(0).toUpperCase() + dataListName.slice(1), [title, dataListName]);
  const pageDescription = useMemo(() => description || `Manage ${dataListName}`, [description, dataListName]);
  const apiPath = useMemo(() => `/${dataListName}`, [dataListName]);

  // Define all callback functions first
  const fetchActiveSettings = useCallback(async () => {
    try {
      const response = await api.get("/settings/active");
      if (response.data) {
        setFiscalYear(response.data.fiscalYear || "");
        setBudgetType(response.data.budgetType || "");
        setPERA(response.data.PERA || 0);
        setCompensation({
          uniformALLOWANCE: response.data.uniformAllowance,
          productivityIncentive: response.data.productivityIncentive,
          medicalAllowance: response.data.medicalAllowance,
          meal: response.data.meal,
          cashGift: response.data.cashGift,
          pagibigPremium: response.data.pagibigPremium,
          gsisPremium: response.data.gsisPremium,
          employeeCompensation: response.data.employeeCompensation,
        });
      } else {
        toast.error("Active settings not found.");
      }
    } catch (error) {
      toast.error("Error fetching active settings.");
      console.error("Error fetching active settings:", error);
    }
  }, []);

  // Update region filter when active region changes
  useEffect(() => {
    if (activeRegion) {
      const regionName = activeRegion.name || activeRegion.regionName;
      setRegionFilter(regionName);
    } else {
      setRegionFilter("");
    }
  }, [activeRegion]);

  const fetchData = useCallback(async () => {
    try {
      // Build query parameters
      const params = new URLSearchParams();
      params.append('statusOfAppointment', 'PERMANENT|Permanent');
      
      // Add region filter if available
      if (regionFilter) {
        params.append('region', regionFilter);
      }
      
      const response = await api.get(`${apiPath}?${params.toString()}`);
      if (response.data && Array.isArray(response.data.personnelServices)) {
        const permanentPersonnel = response.data.personnelServices;
        setRows(permanentPersonnel);
        setFilteredRows(permanentPersonnel);
      } else {
        toast.error("Fetched data is not in the expected format.");
        console.error("Fetched data is not an array:", response.data);
      }
    } catch (error) {
      toast.error("Error fetching personnel data.");
      console.error("Error fetching data:", error);
    }
  }, [apiPath, regionFilter]);

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
      const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
      setRefreshInterval(interval);
      return () => clearInterval(interval);
    } else if (refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
    }
  }, [autoRefresh, fetchData, refreshInterval]);

  // Enhanced menu handlers
  const handleMenuClick = (event) => setAnchorEl(event.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);
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

  // Manual refresh
  const handleManualRefresh = useCallback(async () => {
    setLoading(true);
    try {
      await fetchData();
      await fetchActiveSettings();
      await fetchRATA();
      toast.success("Data refreshed successfully!");
    } catch (error) {
      toast.error("Failed to refresh data");
    } finally {
      setLoading(false);
    }
  }, [fetchData, fetchActiveSettings, fetchRATA]);

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

  // Enhanced print function with preview dialog
  const generatePrintContent = useCallback((printData) => {

    if (!printData || printData.length === 0) {
      console.error('No print data available');
      toast.error("No data available to print");
      return null;
    }

    // Define sections for better readability - split into multiple readable tables
    const printSections = [
      {
        title: "PERSONNEL INFORMATION",
        columns: [
          { field: 'employeeFullName', label: 'Employee Name', type: 'string' },
          { field: 'positionTitle', label: 'Position Title', type: 'string' },
          { field: 'department', label: 'Department', type: 'string' },
          { field: 'gradelevel_SG', label: 'SG', type: 'string' },
          { field: 'step', label: 'Step', type: 'string' },
          { field: 'gradelevel_JG', label: 'JG', type: 'string' },
          { field: 'noOfDependent', label: 'Dependents', type: 'number' }
        ]
      },
      {
        title: "BASIC SALARY & CORE BENEFITS",
        columns: [
          { field: 'employeeFullName', label: 'Employee Name', type: 'string' },
          { field: 'monthlySalary', label: 'Monthly Salary', type: 'number' },
          { field: 'annualSalary', label: 'Annual Salary', type: 'number' },
          { field: 'PERA', label: 'PERA', type: 'number' },
          { field: 'RATA', label: 'RATA', type: 'number' },
          { field: 'uniformALLOWANCE', label: 'Uniform Allowance', type: 'number' }
        ]
      },
      {
        title: "ALLOWANCES & SUBSIDIES",
        columns: [
          { field: 'employeeFullName', label: 'Employee Name', type: 'string' },
          { field: 'medical', label: 'Medical Allowance', type: 'number' },
          { field: 'childrenAllowance', label: 'Children Allowance', type: 'number' },
          { field: 'meal', label: 'Meal Allowance', type: 'number' },
          { field: 'subsistenceAllowanceMDS', label: 'Subsistence MDS', type: 'number' },
          { field: 'subsistenceAllowanceST', label: 'Subsistence ST', type: 'number' }
        ]
      },
      {
        title: "INCENTIVES & BONUSES",
        columns: [
          { field: 'employeeFullName', label: 'Employee Name', type: 'string' },
          { field: 'loyaltyAward', label: 'Loyalty Award', type: 'number' },
          { field: 'overtimePay', label: 'Overtime Pay', type: 'number' },
          { field: 'productivityIncentive', label: 'Productivity Incentive', type: 'number' },
          { field: 'honoraria', label: 'Honoraria', type: 'number' },
          { field: 'hazardPay', label: 'Hazard Pay', type: 'number' }
        ]
      },
      {
        title: "BONUSES & GIFTS",
        columns: [
          { field: 'employeeFullName', label: 'Employee Name', type: 'string' },
          { field: 'cashGift', label: 'Cash Gift', type: 'number' },
          { field: 'midyearBonus', label: 'Midyear Bonus', type: 'number' },
          { field: 'yearEndBonus', label: 'Year End Bonus', type: 'number' }
        ]
      },
      {
        title: "DEDUCTIONS & PREMIUMS",
        columns: [
          { field: 'employeeFullName', label: 'Employee Name', type: 'string' },
          { field: 'gsisPremium', label: 'GSIS Premium', type: 'number' },
          { field: 'pagibigPremium', label: 'Pag-IBIG Premium', type: 'number' },
          { field: 'philhealthPremium', label: 'PhilHealth Premium', type: 'number' }
        ]
      },
      {
        title: "OTHER BENEFITS & TOTAL",
        columns: [
          { field: 'employeeFullName', label: 'Employee Name', type: 'string' },
          { field: 'employeeCompensation', label: 'Employee Compensation', type: 'number' },
          { field: 'courtAppearance', label: 'Court Appearance', type: 'number' },
          { field: 'earnedLeaves', label: 'Earned Leaves', type: 'number' },
          { field: 'retirementBenefits', label: 'Retirement Benefits', type: 'number' },
          { field: 'terminalLeave', label: 'Terminal Leave', type: 'number' },
          { field: 'Total', label: 'TOTAL', type: 'number' }
        ]
      }
    ];

    // Calculate totals for all numeric fields across all sections
    const calculateColumnTotals = (data) => {
      const totals = {};

      // Get all unique numeric fields from all sections
      const allNumericFields = [];
      printSections.forEach(section => {
        section.columns.forEach(col => {
          if (col.type === 'number' && !allNumericFields.includes(col.field)) {
            allNumericFields.push(col.field);
          }
        });
      });

      // Calculate totals for each numeric field
      allNumericFields.forEach(field => {
        totals[field] = data.reduce((sum, row) => {
          const value = parseFloat(row[field]) || 0;
          return sum + value;
        }, 0);
      });

      return totals;
    };

    const columnTotals = calculateColumnTotals(printData);

    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Create a very simple HTML structure to avoid layout issues
    return `<!DOCTYPE html>
<html>
<head>
  <title>Personnel Services Report</title>
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

    /* Watermark */
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
  <div class="watermark">CONFIDENTIAL</div>
  <div class="header">
    <h1>NATIONAL IRRIGATION ADMINISTRATION</h1>
    <h2>REGULAR PERSONNEL SERVICES REPORT</h2>
    <h3>As of ${currentDate}</h3>
  </div>
  ${printSections.map(section => `
  <div class="section">
    <div class="section-title">${section.title}</div>
    <table>
      <thead>
        <tr>
          ${section.columns.map(col => `<th>${col.label}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${printData.map(row => `
        <tr>
          ${section.columns.map(col => `
          <td class="${col.type === 'number' ? 'number' : ''} ${col.field === 'employeeFullName' ? 'employee-name' : ''}">
            ${col.type === 'number'
              ? (row[col.field] || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              : col.type === 'date'
                ? (row[col.field] ? new Date(row[col.field]).toLocaleDateString() : '')
                : (row[col.field] || '')
            }
          </td>
          `).join('')}
        </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  `).join('')}

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
        ${Object.entries(columnTotals)
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
          }).join('')}
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

  // Initial data fetch
  useEffect(() => {
    fetchData();
    fetchActiveSettings();
    fetchRATA();
  }, [fetchData, fetchActiveSettings, fetchRATA]);

  // Update filtered rows when rows change
  useEffect(() => {
    setFilteredRows(rows);
  }, [rows]);

  const handleAddAllPersonnel = useCallback(async (statusOfAppointment) => {
    if (!fiscalYear) {
      toast.error("Active fiscal year not set. Please try again later.");
      return;
    }

    setLoading(true);

    try {
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
        fiscalYear,
        budgetType,
        PERA,
        RATA: RATA.map(item => ({ grade: item.SG, amount: item.RATA })),
        compensation,
        region // Include the active region in the request
      });

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
        
        await fetchData();
        queryClient.invalidateQueries(dataListName);
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
  }, [fiscalYear, budgetType, PERA, RATA, compensation, currentUser, fetchData, queryClient, dataListName]);

  const handleOpenDialog = () => setOpenDialog(true);
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
                ? `You can process permanent personnel within your responsibility center (${currentUser?.hierarchicalAccess?.accessibleDivisions?.[0] || 'Responsibility Center'}). Bulk operations are limited to your access scope.`
                : currentUser?.hierarchicalAccess?.scope === 'OFFICE'
                ? `You can process permanent personnel across your office (${currentUser?.hierarchicalAccess?.accessibleDepartments?.[0]?.departmentName || 'Office'}). You have oversight of all responsibility centers within your office.`
                : `You have full access to process permanent personnel across all offices and responsibility centers.`
              }
            </Typography>
          </Box>
        </Paper>
      )}

      {/* Enhanced Action Bar */}

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
              Add Personnel
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
            // Trigger the export directly using ExcelJS
            // Import and use ExcelJS directly
            import('exceljs').then(async (ExcelJS) => {
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
            }).catch(error => {
              console.error('Export error:', error);
              toast.error("Failed to export Excel file");
            });
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
            // Always fetch ALL data for printing, don't use current table data which might be paginated
            const printData = await handleExportAllData();
            // console.log('Fetched print data:', printData?.length, 'records'); // Debug log

            if (printData && printData.length > 0) {
              await handlePrintPreview(printData);
              toast.success(`Generated preview for ${printData.length} records`);
            } else {
              toast.warning("No data available to print");
            }
          } catch (error) {
            console.error('Print preview error:', error);
            toast.error("Failed to generate print preview");
          } finally {
            setLoading(false);
          }
          handleExportMenuClose();
        }}>
          <ListItemIcon>
            <PrintIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Print Table</ListItemText>
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

      <ToastContainer />

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
            <Typography variant="h6">Print Preview - Personnel Services Report</Typography>
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
        <DialogContent dividers style={{ padding: 0 }}>
          <Box
            sx={{
              width: '100%',
              height: '100%',
              overflow: 'auto',
              backgroundColor: '#f5f5f5',
              padding: 2
            }}
          >
            <Box
              sx={{
                backgroundColor: 'white',
                boxShadow: '0 0 10px rgba(0,0,0,0.1)',
                margin: '0 auto',
                maxWidth: '1200px',
                minHeight: '800px'
              }}
            >
              <iframe
                srcDoc={printPreviewDialog.content}
                style={{
                  width: '100%',
                  height: '800px',
                  border: 'none',
                  display: 'block'
                }}
                title="Print Preview"
              />
            </Box>
          </Box>
        </DialogContent>
      </Dialog>

      <CustomTable
        ROWS_PER_PAGE={ROWS_PER_PAGE}
        dataListName={dataListName}
        apiPath={apiPath}
        rows={filteredRows}
        onDataChange={setCurrentTableData}
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
                  disableEdit={row.status === "Submitted" || row.status === "Approved"}
                  disableDelete={row.status === "Submitted" || row.status === "Approved"}
                />
              );
            }

            if (fieldSchema.customRender) {
              column.render = (row) => fieldSchema.customRender(row);
            }

            return column;
          }), [schema, columnVisibility, enhancedMenuOptions, customEditElement, hasEdit, hasDelete, apiPath, dataListName])}
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
  searchable: PropTypes.bool,
  hasEdit: PropTypes.bool,
  hasDelete: PropTypes.bool,
  hasAdd: PropTypes.bool,
  customAddElement: PropTypes.element,
  customEditElement: PropTypes.element,
  additionalMenuOptions: PropTypes.array,
  ROWS_PER_PAGE: PropTypes.number,
};

export default PSPCustomPageTable;