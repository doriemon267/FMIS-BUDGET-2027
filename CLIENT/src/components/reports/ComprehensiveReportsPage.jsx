import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  AlertTitle,
  Paper,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TableRow,
  List,
  ListItem,
  ListItemText,
  useTheme,
  alpha,
  Stack,
  Avatar,
} from "@mui/material";
import {
  AccountBalance,
  Group,
  Business,
  Construction,
  Category,
  Assessment,
  FileDownload,
  Summarize,
  ExpandMore,
  ExpandLess,
} from "@mui/icons-material";
import PesoIcon from "../icons/PesoIcon";
import api from "../../config/api";
import ReportPageLayout from "./ReportPageLayout";
import GenericPdfPreviewDialog from "../GenericPdfPreviewDialog";
import { toast } from "react-toastify";
import { isBRDLevelUser, isHighLevelAccess } from "../../constants/roles";


// Custom hook for user restrictions
import { useUserRestrictions } from "../../hooks/useUserRestrictions";
import { AccessStatusIndicator } from "../common/AccessStatusIndicator";
import { useUser } from "../../context/UserContext";

const REPORT_CELL_SX = {
  px: 1.25,
  py: 0.85,
  fontSize: '0.8rem',
  lineHeight: 1.35,
  verticalAlign: 'top',
  borderColor: 'divider',
  overflowWrap: 'anywhere',
};

const REPORT_MONEY_CELL_SX = {
  ...REPORT_CELL_SX,
  textAlign: 'right',
  whiteSpace: 'nowrap',
  fontVariantNumeric: 'tabular-nums',
};

const FinancialTable = ({ columns, children, footer }) => (
  <TableContainer className="report-table-container" sx={{ overflowX: 'auto' }}>
    <Table
      className="report-financial-table"
      size="small"
      sx={{ minWidth: 820, tableLayout: 'fixed', fontVariantNumeric: 'tabular-nums' }}
    >
      <colgroup>
        {columns.map((column) => <col key={column.label} style={{ width: column.width }} />)}
      </colgroup>
      <TableHead>
        <TableRow className="report-column-header">
          {columns.map((column) => (
            <TableCell
              key={column.label}
              align={column.numeric ? 'right' : 'left'}
              sx={{
                ...REPORT_CELL_SX,
                bgcolor: '#f4f7f5',
                color: '#475569',
                fontSize: '0.72rem',
                fontWeight: 800,
                letterSpacing: '0.045em',
                textTransform: 'uppercase',
                borderTop: '1px solid',
                borderTopColor: 'divider',
                borderBottom: '2px solid',
                borderBottomColor: '#94a3b8',
              }}
            >
              {column.label}
            </TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>{children}</TableBody>
      {footer}
    </Table>
  </TableContainer>
);

const FinancialTotalRow = ({ label = 'GRAND TOTAL', labelColSpan = 2, values }) => (
  <TableFooter>
    <TableRow className="report-total-row">
      <TableCell
        colSpan={labelColSpan}
        sx={{
          ...REPORT_CELL_SX,
          py: 1.15,
          bgcolor: '#f4f7f5',
          color: '#1e293b',
          fontWeight: 800,
          letterSpacing: '0.035em',
          borderTop: '2px solid #64748b',
        }}
      >
        {label}
      </TableCell>
      {values.map((value, index) => (
        <TableCell
          key={`${label}-${index}`}
          align="right"
          sx={{
            ...REPORT_MONEY_CELL_SX,
            py: 1.15,
            bgcolor: '#f4f7f5',
            color: index === values.length - 1 ? 'primary.dark' : '#1e293b',
            fontWeight: 800,
            borderTop: '2px solid #64748b',
          }}
        >
          {value}
        </TableCell>
      ))}
    </TableRow>
  </TableFooter>
);



const ComprehensiveReportsPage = () => {
  const theme = useTheme();
  const { getFilteredOptions } = useUserRestrictions();
  const { currentUser } = useUser();

  // State management (Moved up to avoid ReferenceError in hooks below)
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [availableRegions, setAvailableRegions] = useState([]);
  const [availableFiscalYears, setAvailableFiscalYears] = useState([]);
  const [availableBudgetTypes, setAvailableBudgetTypes] = useState([]);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loadingInitialData, setLoadingInitialData] = useState(true);
  const [selectedFiscalYear, setSelectedFiscalYear] = useState("");
  const [selectedBudgetType, setSelectedBudgetType] = useState("");
  const [viewBy, setViewBy] = useState("region");
  const [availableOffices, setAvailableOffices] = useState([]);
  const [availableResponsibilityCenters, setAvailableResponsibilityCenters] = useState([]);
  const [selectedOffice, setSelectedOffice] = useState("all");
  const [selectedResponsibilityCenter, setSelectedResponsibilityCenter] = useState("all");
  const [autoGenerated, setAutoGenerated] = useState(false);
  const [expandedMooeCoKeys, setExpandedMooeCoKeys] = useState(() => new Set());
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState("");
  const [pdfFilename, setPdfFilename] = useState("");
  const showWorkflowSignatories = false;

  // --- ROLE-BASED SCOPING LOGIC ---
  const isHighLevel = React.useMemo(() => isHighLevelAccess(currentUser), [currentUser]);
  const isBRD = React.useMemo(() => isBRDLevelUser(currentUser), [currentUser]);
  const userScope = React.useMemo(() => String(currentUser?.hierarchicalAccess?.scope || currentUser?.hierarchicalAccess?.assignmentLevel || "").toUpperCase(), [currentUser]);
  
  // Enforce restriction: restricted roles (Preparer, Reviewer, Approver) are locked to their assignment.
  // Only BRD-level roles (Analyst, Officer, Manager, SuperAdmin) have full system access.
  const isRestricted = React.useMemo(() => {
    if (!currentUser) return true;
    const roles = (currentUser.Roles || []).map(r => String(r || '').replace(/\s+/g, '_').toUpperCase());
    const hasRestrictedRole = roles.some(r => [
      'BUDGET_PREPARER', 'BUDGET_REVIEWER', 'BUDGET_APPROVER', 
      'REVIEWER', 'APPROVER', 'BUDGET_COORDINATOR'
    ].includes(r));
    const hasBRDRole = roles.some(r => [
      'SUPER_ADMIN', 'SUPERADMIN', 'BUDGET_MANAGER', 
      'BUDGET_OFFICER', 'BUDGET_PLANNING_ANALYST', 
      'OVERALL_BUDGET_APPROVER', 'BUDGET_ADMIN'
    ].includes(r));

    if (hasBRDRole) return false;
    if (hasRestrictedRole) return true;
    return !isBRD || !isHighLevel || (userScope === 'DEPARTMENT' || userScope === 'DIVISION' || userScope === 'OFFICE' || userScope === 'RESPONSIBILITY_CENTER');
  }, [currentUser, isBRD, isHighLevel, userScope]);
  
  // Get user's assigned office/department or responsibility center/division
  const userDepartmentObj = currentUser?.hierarchicalAccess?.accessibleDepartments?.[0];
  const userDepartment = userDepartmentObj?.departmentName || userDepartmentObj?.name || userDepartmentObj;
  const userDivisionObj = currentUser?.hierarchicalAccess?.accessibleDivisions?.[0];
  const userDivision = userDivisionObj?.name || userDivisionObj;

  // Enforce restrictions based on role/scope
  useEffect(() => {
    if (isRestricted) {
      // Auto-set viewBy for non-BRD users based on their assignment
      let initialViewBy = "region";
      if (userScope === "DEPARTMENT" || userScope === "OFFICE" || userDepartment) {
        initialViewBy = "office";
      } else if (userScope === "DIVISION" || userScope === "RESPONSIBILITY_CENTER" || userDivision) {
        initialViewBy = "responsibilityCenter";
      }
      
      if (viewBy !== initialViewBy && !autoGenerated) {
        setViewBy(initialViewBy);
      }

      // Pre-select user's assignment
      if (userDepartment && selectedOffice === "all") {
        setSelectedOffice(String(userDepartment));
      }
      if (userDivision && selectedResponsibilityCenter === "all") {
        setSelectedResponsibilityCenter(String(userDivision));
      }
    }
  }, [isRestricted, userScope, userDepartment, userDivision, selectedOffice, selectedResponsibilityCenter, viewBy, autoGenerated]);

  useEffect(() => {
    return () => {
      if (pdfPreviewUrl) {
        window.URL.revokeObjectURL(pdfPreviewUrl);
      }
    };
  }, [pdfPreviewUrl]);

  const closePdfDialog = () => {
    setPdfDialogOpen(false);
    if (pdfPreviewUrl) {
      window.URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl("");
    }
  };

  useEffect(() => {
    if (!reportData?.sections) return;
    const keys = new Set();
    reportData.sections.forEach((sec) => {
      if (sec.sectionCode === "B.1.2" || sec.sectionCode === "B.2") {
        Object.values(sec.categories || {}).forEach((cat) => {
          if (cat?.name) keys.add(`${sec.sectionCode}-${cat.name}`);
        });
      }
    });
    if (keys.size > 0) setExpandedMooeCoKeys(keys);
  }, [reportData]);

  const toggleMooeCoExpand = (key) => {
    setExpandedMooeCoKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [regionsResponse, fiscalYearsResponse, budgetTypesResponse, activeSettingsResponse] = await Promise.all([
          api.get("/api/comprehensive-reports/available-regions-comprehensive"),
          api.get("/api/comprehensive-reports/available-fiscal-years"),
          api.get("/api/comprehensive-reports/available-budget-types"),
          api.get("/api/comprehensive-reports/active-settings"),
        ]);
        setAvailableRegions(regionsResponse.data.regions || []);
        setAvailableFiscalYears(fiscalYearsResponse.data.fiscalYears || []);
        setAvailableBudgetTypes(budgetTypesResponse.data.budgetTypes || []);
        if (activeSettingsResponse.data.settings) {
          const { fiscalYear, budgetType } = activeSettingsResponse.data.settings;
          setSelectedFiscalYear(fiscalYear || "");
          setSelectedBudgetType(budgetType || "");
        }
      } catch (err) {
        console.error("Error fetching initial data:", err);
        setError(err.response?.data?.message || "Failed to load initial data.");
      } finally {
        setLoadingInitialData(false);
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (viewBy !== "office" && viewBy !== "responsibilityCenter") return;
    const params = new URLSearchParams();
    if (selectedRegion && selectedRegion !== "all") params.append("region", selectedRegion);
    if (selectedFiscalYear) params.append("fiscalYear", selectedFiscalYear);
    const q = params.toString() ? `?${params}` : "";
    const urls = {
      office: `/api/comprehensive-reports/available-offices-comprehensive${q}`,
      responsibilityCenter: `/api/comprehensive-reports/available-responsibility-centers-comprehensive${q}`,
    };
    const url = urls[viewBy];
    if (!url) return;
    api.get(url)
      .then((res) => {
        if (viewBy === "office") {
          const offices = res.data?.offices || [];
          // Ensure user's assigned office is in the list (for non-BRD users)
          if (isRestricted && userDepartment && !offices.includes(String(userDepartment))) {
            offices.unshift(String(userDepartment));
          }
          setAvailableOffices(offices);
        } else {
          const rcs = res.data?.responsibilityCenters || [];
          // Ensure user's assigned RC is in the list (for non-BRD users)
          if (isRestricted && userDivision && !rcs.includes(String(userDivision))) {
            rcs.unshift(String(userDivision));
          }
          setAvailableResponsibilityCenters(rcs);
        }
      })
      .catch(() => {
        if (viewBy === "office") {
          // Even on error, include user's assignment for non-BRD users
          setAvailableOffices(isRestricted && userDepartment ? [String(userDepartment)] : []);
        } else {
          setAvailableResponsibilityCenters(isRestricted && userDivision ? [String(userDivision)] : []);
        }
      });
  }, [viewBy, selectedRegion, selectedFiscalYear, isRestricted, userDepartment, userDivision]);

  // Auto-generate report for non-BRD users when their assignment is loaded
  useEffect(() => {
    if (!isRestricted || autoGenerated || loadingInitialData) return;
    if (!selectedFiscalYear || !selectedBudgetType) return;
    
    // Wait a bit for offices/RCs to load if needed
    const timer = setTimeout(async () => {
      // For non-BRD users: auto-generate if they have office or RC assignment
      if (viewBy === "office" && selectedOffice && selectedOffice !== "all") {
        setLoading(true);
        setError(null);
        try {
          const params = new URLSearchParams({ fiscalYear: selectedFiscalYear, budgetType: selectedBudgetType });
          if (viewBy) params.append("groupBy", viewBy);
          if (selectedRegion && selectedRegion !== "all") params.append("regions", selectedRegion);
          if (selectedOffice && selectedOffice !== "all") params.append("offices", selectedOffice);
          const response = await api.get(`/api/comprehensive-reports/comprehensive-data?${params}`);
          setReportData(response.data.data);
          setAutoGenerated(true);
        } catch (err) {
          console.error("Error auto-generating report:", err);
          setError(err.response?.data?.message || "Failed to generate report.");
        } finally {
          setLoading(false);
        }
      } else if (viewBy === "responsibilityCenter" && selectedResponsibilityCenter && selectedResponsibilityCenter !== "all") {
        setLoading(true);
        setError(null);
        try {
          const params = new URLSearchParams({ fiscalYear: selectedFiscalYear, budgetType: selectedBudgetType });
          if (viewBy) params.append("groupBy", viewBy);
          if (selectedRegion && selectedRegion !== "all") params.append("regions", selectedRegion);
          if (selectedResponsibilityCenter && selectedResponsibilityCenter !== "all") params.append("responsibilityCenters", selectedResponsibilityCenter);
          const response = await api.get(`/api/comprehensive-reports/comprehensive-data?${params}`);
          setReportData(response.data.data);
          setAutoGenerated(true);
        } catch (err) {
          console.error("Error auto-generating report:", err);
          setError(err.response?.data?.message || "Failed to generate report.");
        } finally {
          setLoading(false);
        }
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [selectedFiscalYear, selectedBudgetType, viewBy, selectedOffice, selectedResponsibilityCenter, selectedRegion, isHighLevel, isRestricted, loadingInitialData, autoGenerated]);

  const fetchReportData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ fiscalYear: selectedFiscalYear, budgetType: selectedBudgetType });
      if (viewBy) params.append("groupBy", viewBy);
      if (selectedRegion && selectedRegion !== "all") params.append("regions", selectedRegion);
      if (viewBy === "office" && selectedOffice && selectedOffice !== "all") params.append("offices", selectedOffice);
      if (viewBy === "responsibilityCenter" && selectedResponsibilityCenter && selectedResponsibilityCenter !== "all") params.append("responsibilityCenters", selectedResponsibilityCenter);
      const response = await api.get(`/api/comprehensive-reports/comprehensive-data?${params}`);
      const data = response.data.data;
      
      // Add A.2 - BUDGETARY SUPPORT using backend summary so it matches Grand Total (no double-count / wrong sum)
      if (data.sections && !data.sections.find(s => s.sectionCode === "A.2")) {
        const summarySubsidy = data.summary && (Number(data.summary.totalSubsidy) >= 0 || Number(data.summary.grandTotal) >= 0)
          ? (Number(data.summary.totalSubsidy) || Number(data.summary.grandTotal) || 0)
          : 0;

        if (summarySubsidy > 0) {
          const budgetarySupportSection = {
            sectionCode: "A.2",
            sectionName: "BUDGETARY SUPPORT",
            sectionDescription: "Government subsidies and budgetary support allocations from all regions",
            sectionTotal: summarySubsidy,
            consolidatedData: true,
            categories: {
              government_subsidies: {
                name: "Government Subsidies & Support",
                description: "Total government funding across all budget categories",
                totalSubsidy: summarySubsidy,
                total: summarySubsidy
              }
            }
          };
          const a1Index = data.sections.findIndex((s) => s.sectionCode === "A.1");
          if (a1Index >= 0) {
            data.sections.splice(a1Index + 1, 0, budgetarySupportSection);
          } else {
            data.sections.unshift(budgetarySupportSection);
          }
        }
      }
      
      setReportData(data);
    } catch (err) {
      console.error("Error fetching report data:", err);
      setError(err.response?.data?.message || "Failed to fetch report data.");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    const rounded = Math.round(Number(amount || 0) * 100) / 100;
    return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(rounded);
  };

  const formatSignedDate = (value) => {
    if (!value) return "N/A";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "N/A";
    return date.toLocaleString("en-US");
  };

  const getSectionIcon = (sectionCode) => {
    switch (sectionCode) {
      case "A.1": return <AccountBalance />;
      case "A.2": return <PesoIcon />;
      case "B.1.1": return <Group />;
      case "B.1.2": return <Business />;
      case "B.2": return <Construction />;
      default: return <Category />;
    }
  };

  const getApiErrorMessage = async (err, fallbackMessage) => {
    const directMessage = err?.response?.data?.message;
    if (typeof directMessage === "string" && directMessage.trim()) {
      return directMessage;
    }

    const responseData = err?.response?.data;
    if (responseData instanceof Blob) {
      try {
        const text = await responseData.text();
        if (text) {
          try {
            const parsed = JSON.parse(text);
            const parsedMessage = parsed?.message;
            if (typeof parsedMessage === "string" && parsedMessage.trim()) {
              return parsedMessage;
            }
          } catch (_parseErr) {
            // Fall back to the raw response text below.
          }

          if (text.trim()) {
            return text.trim();
          }
        }
      } catch (_blobErr) {
        // Keep the caller-provided fallback message.
      }
    }

    return fallbackMessage;
  };

  const handlePreviewPdf = async () => {
    setPdfLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        fiscalYear: selectedFiscalYear,
        budgetType: selectedBudgetType,
      });

      if (selectedRegion && selectedRegion !== "all") params.append("regions", selectedRegion);
      if (viewBy) params.append("groupBy", viewBy);
      if (viewBy === "office" && selectedOffice && selectedOffice !== "all") params.append("offices", selectedOffice);
      if (viewBy === "responsibilityCenter" && selectedResponsibilityCenter && selectedResponsibilityCenter !== "all") params.append("responsibilityCenters", selectedResponsibilityCenter);

      const response = await api.get(
        `/api/comprehensive-reports/comprehensive-pdf?${params.toString()}`,
        {
          responseType: "blob",
        }
      );

      // Extract filename from Content-Disposition header
      let filename = `Comprehensive_Report_${selectedFiscalYear}_${selectedBudgetType}.pdf`;
      const contentDisposition = response.headers['content-disposition'];
      if (contentDisposition) {
        const filenameStarMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
        if (filenameStarMatch && filenameStarMatch[1]) {
          filename = decodeURIComponent(filenameStarMatch[1]);
        } else {
          const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
          if (filenameMatch && filenameMatch[1]) {
            filename = filenameMatch[1];
          }
        }
      }
      setPdfFilename(filename);

      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      if (pdfPreviewUrl) {
        window.URL.revokeObjectURL(pdfPreviewUrl);
      }
      setPdfPreviewUrl(url);
      setPdfDialogOpen(true);
    } catch (err) {
      console.error("Error generating PDF preview:", err);
      const message = await getApiErrorMessage(
        err,
        "Failed to generate PDF preview. Please try again."
      );
      setError(message);
      toast.error(message, { toastId: "comprehensive-pdf-preview-error" });
    } finally {
      setPdfLoading(false);
    }
  };

  const reportSummary = reportData?.summary;
  const reportStatus = [
    reportSummary?.reportStatus,
    reportSummary?.workflowStatus,
    reportSummary?.proposalStatus,
    reportSummary?.dataStatus,
    reportSummary?.previewMode,
    reportSummary?.status,
  ]
    .filter(Boolean)
    .join(" ")
    .toUpperCase();
  const isDraftPreview = Boolean(
    reportSummary && (
      reportSummary.isDraftPreview ||
      reportSummary.draftPreview ||
      reportSummary.isDraft ||
      reportSummary.includesDraftData ||
      reportStatus.includes("DRAFT") ||
      (reportSummary.reportLockedUntilSubmission && reportData?.sections?.length > 0)
    )
  );
  const isEmptyReport = Boolean(
    reportData && (!Array.isArray(reportData.sections) || reportData.sections.length === 0)
  );

  return (
    <ReportPageLayout
      title="BUDGET SUMMARY REPORT"
      subtitle="Detailed budget analysis"
      showNiaBranding={true}
      breadcrumbLabel="Budget Summary Report"
      fiscalYear={selectedFiscalYear || new Date().getFullYear().toString()}
    >
      <Box className="report-no-print">
        <AccessStatusIndicator />
      </Box>
      <Card
        className="report-no-print"
        elevation={0}
        sx={{ mb: 2.5, borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}
      >
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          {loadingInitialData && <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}><CircularProgress /></Box>}
          {isRestricted && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Viewing report for your assigned {viewBy === "office" ? "Office/Department" : viewBy === "responsibilityCenter" ? "Responsibility Center" : "Region"}: <strong>{viewBy === "office" ? selectedOffice : viewBy === "responsibilityCenter" ? selectedResponsibilityCenter : selectedRegion}</strong>
            </Alert>
          )}
          <Grid container spacing={1.5} alignItems="center">
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>View by</InputLabel>
                <Select
                  value={viewBy}
                  onChange={(e) => {
                    setViewBy(e.target.value);
                    setSelectedOffice("all");
                    setSelectedResponsibilityCenter("all");
                    setAutoGenerated(false);
                  }}
                  label="View by"
                  disabled={isRestricted}
                >
                  <MenuItem value="region">Region</MenuItem>
                  <MenuItem value="office">Office / Department</MenuItem>
                  <MenuItem value="responsibilityCenter">Responsibility Center</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Region</InputLabel>
                <Select value={selectedRegion} onChange={(e) => setSelectedRegion(e.target.value)} label="Region" disabled={isRestricted}>
                  {!isRestricted && <MenuItem value="all">All Regions</MenuItem>}
                  {availableRegions.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            {viewBy === "office" && (
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Office / Department</InputLabel>
                  <Select value={selectedOffice} onChange={(e) => { setSelectedOffice(e.target.value); setAutoGenerated(false); }} label="Office / Department" disabled={isRestricted}>
                    <MenuItem value="all">All Offices</MenuItem>
                    {availableOffices.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            )}
            {viewBy === "responsibilityCenter" && (
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Responsibility Center</InputLabel>
                  <Select value={selectedResponsibilityCenter} onChange={(e) => { setSelectedResponsibilityCenter(e.target.value); setAutoGenerated(false); }} label="Responsibility Center" disabled={isRestricted}>
                    <MenuItem value="all">All RCs</MenuItem>
                    {availableResponsibilityCenters.map((rc) => <MenuItem key={rc} value={rc}>{rc}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            )}
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Fiscal Year</InputLabel>
                <Select value={selectedFiscalYear} onChange={(e) => setSelectedFiscalYear(e.target.value)} label="Fiscal Year">
                  {getFilteredOptions(availableFiscalYears, 'fiscalYear').map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Budget Type</InputLabel>
                <Select value={selectedBudgetType} onChange={(e) => setSelectedBudgetType(e.target.value)} label="Budget Type">
                  {getFilteredOptions(availableBudgetTypes, 'budgetType').map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <Button
                variant="contained"
                fullWidth
                onClick={fetchReportData}
                disabled={loading}
                size="small"
                startIcon={
                  loading ? <CircularProgress size={20} /> : <Summarize />
                }
                sx={{ minHeight: 40 }}
              >
                {loading ? <CircularProgress size={24} /> : "Generate Report"}
              </Button>
            </Grid>
            {reportData && (
              <Grid item xs={12} sm={6} md={2}>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={handlePreviewPdf}
                  disabled={pdfLoading}
                  size="small"
                  startIcon={
                    pdfLoading ? (
                      <CircularProgress size={20} />
                    ) : (
                      <FileDownload />
                    )
                  }
                  sx={{ minHeight: 40 }}
                >
                  {pdfLoading ? "Creating PDF..." : "Preview PDF"}
                </Button>
              </Grid>
            )}
          </Grid>
        </CardContent>
      </Card>
      {error && <Alert className="report-no-print" severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {isDraftPreview && (
        <Alert
          severity="info"
          className="report-summary"
          sx={{ mb: 2.5, border: '1px solid', borderColor: 'info.light', alignItems: 'flex-start' }}
        >
          <AlertTitle sx={{ mb: 0.25, fontWeight: 700 }}>Draft preview</AlertTitle>
          This report includes working budget proposal data that has not yet been submitted. Figures may change before submission.
        </Alert>
      )}

      {reportData?.summary?.approverNoProposals && (
        <Alert severity="info" sx={{ mb: 3 }}>
          No proposal data is available in your current access scope for the selected criteria.
        </Alert>
      )}

      {reportData && (
        <Box
          className="report-content"
          sx={{ '& .MuiTypography-root': { fontVariantNumeric: 'tabular-nums' } }}
        >
          {isEmptyReport && !reportData?.summary?.approverNoProposals && (
            <Paper
              elevation={0}
              sx={{ mb: 2.5, p: 3, textAlign: 'center', border: '1px dashed', borderColor: 'divider' }}
            >
              <Typography variant="h6" color="text.secondary">
                No budget data available
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                No budget entries match the selected criteria yet. Draft proposals will appear here when available within your access scope.
              </Typography>
            </Paper>
          )}
          {/* ================================================================= */}
          {/* START OF UI FIX: Pinag-isang Table para sa MOOE at Capital Outlays */}
          {/* ================================================================= */}
          {reportData.sections.map((section) => {
            const isIncomeSection = section.sectionCode === "A.1";
            const isBudgetarySupport = section.sectionCode === "A.2";
            const isPersonnelServices = section.sectionCode === "B.1.1";
            const isDetailedExpense = section.sectionCode === "B.1.2" || section.sectionCode === "B.2";
            const colIncome = "Projected Corporate Income";
            const colSubsidy = "Projected Subsidy";
            const colBudget = "Proposed Budget";

            return (
              <Paper
                className="report-section"
                key={section.sectionCode}
                elevation={0}
                sx={{ mb: 2.5, p: { xs: 1.5, md: 2.5 }, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}
              >
                <Stack
                  className="report-section-header"
                  direction={{ xs: 'column', sm: 'row' }}
                  justifyContent="space-between"
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                  gap={1.5}
                  sx={{ borderBottom: 1, borderColor: 'divider', pb: 1.5, mb: 1.5 }}
                >
                  <Stack direction="row" alignItems="center" spacing={2}>
                    {getSectionIcon(section.sectionCode)}
                    <Box>
                      <Typography variant="h6" fontWeight="bold">
                        {section.sectionCode} - {section.sectionName}
                        {section.sectionCode === "A.2" && <Chip size="small" label="NEW" color="success" sx={{ ml: 1 }} />}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">{section.sectionDescription}</Typography>
                    </Box>
                  </Stack>
                  <Chip label={formatCurrency(section.sectionTotal)} color="primary" />
                </Stack>
                
                {section.consolidatedData && (() => {
                  const standardColumns = [
                    { label: 'Category', width: '25%' },
                    { label: isDetailedExpense ? 'Subline Item' : 'Description', width: '25%' },
                    { label: colIncome, width: '17%', numeric: true },
                    { label: colSubsidy, width: '17%', numeric: true },
                    { label: colBudget, width: '16%', numeric: true },
                  ];

                  if (isIncomeSection) {
                    const categories = Object.values(section.categories || {});
                    return (
                      <FinancialTable
                        columns={standardColumns}
                        footer={(
                          <FinancialTotalRow
                            values={[
                              formatCurrency(section.sectionTotalIncome),
                              formatCurrency(section.sectionTotalSubsidy),
                              formatCurrency(section.sectionTotal),
                            ]}
                          />
                        )}
                      >
                        {categories.map((category, index) => (
                          <TableRow key={`${category.name || 'income'}-${index}`}>
                            <TableCell sx={REPORT_CELL_SX}>{category.name}</TableCell>
                            <TableCell sx={{ ...REPORT_CELL_SX, color: 'text.secondary' }}>{category.description || '—'}</TableCell>
                            <TableCell align="right" sx={REPORT_MONEY_CELL_SX}>{formatCurrency(category.totalIncome)}</TableCell>
                            <TableCell align="right" sx={REPORT_MONEY_CELL_SX}>{formatCurrency(category.totalSubsidy)}</TableCell>
                            <TableCell align="right" sx={{ ...REPORT_MONEY_CELL_SX, fontWeight: 600 }}>{formatCurrency(category.total)}</TableCell>
                          </TableRow>
                        ))}
                      </FinancialTable>
                    );
                  }

                  if (isBudgetarySupport) {
                    const categories = Object.values(section.categories || {});
                    const totalAmount = section.sectionTotal ?? categories.reduce(
                      (sum, category) => sum + (Number(category.totalSubsidy ?? category.total) || 0),
                      0
                    );
                    const singleCategory = categories.length <= 1;
                    return (
                      <FinancialTable
                        columns={[
                          { label: 'Category', width: '40%' },
                          { label: 'Description', width: '35%' },
                          { label: colBudget, width: '25%', numeric: true },
                        ]}
                        footer={<FinancialTotalRow labelColSpan={2} values={[formatCurrency(totalAmount)]} />}
                      >
                        {categories.map((category, index) => (
                          <TableRow key={`${category.name || 'support'}-${index}`} sx={{ bgcolor: alpha(theme.palette.primary.main, 0.035) }}>
                            <TableCell sx={{ ...REPORT_CELL_SX, fontWeight: 600 }}>{category.name || 'Budgetary Support'}</TableCell>
                            <TableCell sx={{ ...REPORT_CELL_SX, color: 'text.secondary' }}>
                              {category.description || 'Total government funding across all budget categories'}
                            </TableCell>
                            <TableCell align="right" sx={REPORT_MONEY_CELL_SX}>
                              {singleCategory ? '—' : formatCurrency(category.totalSubsidy ?? category.total ?? 0)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </FinancialTable>
                    );
                  }

                  if (isPersonnelServices) {
                    const rows = [];
                    Object.values(section.categories || {}).forEach((category) => {
                      rows.push({ type: 'category', ...category });
                      const items = Array.isArray(category.items)
                        ? category.items
                        : Object.values(category.items || {});
                      items.forEach((item) => rows.push({ type: 'item', ...item }));
                    });
                    return (
                      <FinancialTable
                        columns={standardColumns}
                        footer={(
                          <FinancialTotalRow
                            values={[
                              formatCurrency(section.sectionTotalIncome),
                              formatCurrency(section.sectionTotalSubsidy),
                              formatCurrency(section.sectionTotal),
                            ]}
                          />
                        )}
                      >
                        {rows.map((row, index) => row.type === 'category' ? (
                          <TableRow key={`ps-category-${row.name || index}`} className="report-category-row" sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                            <TableCell colSpan={2} sx={{ ...REPORT_CELL_SX, fontWeight: 700 }}>{row.name}</TableCell>
                            <TableCell align="right" sx={{ ...REPORT_MONEY_CELL_SX, fontWeight: 700 }}>{formatCurrency(row.totalIncome)}</TableCell>
                            <TableCell align="right" sx={{ ...REPORT_MONEY_CELL_SX, fontWeight: 700 }}>{formatCurrency(row.totalSubsidy)}</TableCell>
                            <TableCell align="right" sx={{ ...REPORT_MONEY_CELL_SX, fontWeight: 700 }}>{formatCurrency(row.total)}</TableCell>
                          </TableRow>
                        ) : (
                          <TableRow key={`ps-item-${row.name || index}`}>
                            <TableCell sx={REPORT_CELL_SX} />
                            <TableCell sx={{ ...REPORT_CELL_SX, pl: 2.5 }}>{row.name}</TableCell>
                            <TableCell align="right" sx={REPORT_MONEY_CELL_SX}>{formatCurrency(row.income)}</TableCell>
                            <TableCell align="right" sx={REPORT_MONEY_CELL_SX}>{formatCurrency(row.subsidy)}</TableCell>
                            <TableCell align="right" sx={{ ...REPORT_MONEY_CELL_SX, fontWeight: 600 }}>{formatCurrency(row.amount)}</TableCell>
                          </TableRow>
                        ))}
                      </FinancialTable>
                    );
                  }

                  if (isDetailedExpense) {
                    const categories = Object.values(section.categories || {});
                    return (
                      <FinancialTable
                        columns={standardColumns}
                        footer={(
                          <FinancialTotalRow
                            values={[
                              formatCurrency(categories.reduce((sum, category) => sum + (parseFloat(category.totalIncome) || 0), 0)),
                              formatCurrency(categories.reduce((sum, category) => sum + (parseFloat(category.totalSubsidy) || 0), 0)),
                              formatCurrency(section.sectionTotal),
                            ]}
                          />
                        )}
                      >
                        {categories.flatMap((category) => {
                          const expandKey = `${section.sectionCode}-${category.name}`;
                          const isExpanded = expandedMooeCoKeys.has(expandKey);
                          const items = (Array.isArray(category.items)
                            ? category.items
                            : Object.values(category.items || {}))
                            .filter((item) => item && Number(item.amount || 0) > 0);
                          return [
                            <TableRow
                              key={`category-${expandKey}`}
                              className="report-category-row"
                              hover
                              onClick={() => toggleMooeCoExpand(expandKey)}
                              sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05), cursor: 'pointer' }}
                            >
                              <TableCell sx={{ ...REPORT_CELL_SX, fontWeight: 700 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <IconButton className="report-expansion-control" size="small" sx={{ p: 0.25 }}>
                                    {isExpanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                                  </IconButton>
                                  {category.name}
                                </Box>
                              </TableCell>
                              <TableCell sx={REPORT_CELL_SX} />
                              <TableCell align="right" sx={{ ...REPORT_MONEY_CELL_SX, fontWeight: 700 }}>{formatCurrency(category.totalIncome)}</TableCell>
                              <TableCell align="right" sx={{ ...REPORT_MONEY_CELL_SX, fontWeight: 700 }}>{formatCurrency(category.totalSubsidy)}</TableCell>
                              <TableCell align="right" sx={{ ...REPORT_MONEY_CELL_SX, fontWeight: 700 }}>{formatCurrency(category.total)}</TableCell>
                            </TableRow>,
                            ...items.map((item, itemIndex) => (
                              <TableRow
                                className="report-detail-row"
                                key={`detail-${expandKey}-${item._id || item.id || itemIndex}`}
                                sx={{ display: isExpanded ? 'table-row' : 'none' }}
                              >
                                <TableCell sx={REPORT_CELL_SX} />
                                <TableCell sx={{ ...REPORT_CELL_SX, pl: 2.5 }}>{item.title ?? item.name ?? '—'}</TableCell>
                                <TableCell align="right" sx={REPORT_MONEY_CELL_SX}>{formatCurrency(item.income)}</TableCell>
                                <TableCell align="right" sx={REPORT_MONEY_CELL_SX}>{formatCurrency(item.subsidy)}</TableCell>
                                <TableCell align="right" sx={{ ...REPORT_MONEY_CELL_SX, fontWeight: 600 }}>{formatCurrency(item.amount)}</TableCell>
                              </TableRow>
                            )),
                          ];
                        })}
                      </FinancialTable>
                    );
                  }

                  return Object.values(section.categories || {}).map((category, index) => (
                    <Box key={`${category.name || 'category'}-${index}`} sx={{ mb: 2 }}>
                      <Typography variant="subtitle1" fontWeight="bold">{category.name}</Typography>
                      <List dense>
                        {(Array.isArray(category.items) ? category.items : Object.values(category.items || {})).map((item, itemIndex) => (
                          <ListItem key={itemIndex} divider secondaryAction={<Typography variant="body2" fontWeight="bold">{formatCurrency(item.amount)}</Typography>}>
                            <ListItemText primary={item.name} />
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  ));
                })()}
              </Paper>
            );
          })}
          {/* Grand Total (Pangkalahatang Kabuuan) - Income, Subsidy, Proposed Budget */}
          {reportData?.summary && (
            <Paper
              className="report-summary"
              elevation={0}
              sx={{
                p: { xs: 2, md: 2.5 },
                mt: 2.5,
                bgcolor: alpha(theme.palette.primary.main, 0.07),
                border: '1px solid',
                borderColor: 'primary.light',
                borderLeft: '5px solid',
                borderLeftColor: 'primary.main',
                borderRadius: 1.5,
              }}
            >
              <Typography variant="h5" fontWeight="bold" color="primary.dark" sx={{ mb: 2 }}>Grand Total</Typography>
              <Stack spacing={1.5}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body1">Projected Corporate Income</Typography>
                  <Typography variant="h6" fontWeight="bold" color="primary.dark">{formatCurrency(reportData.summary.totalIncome)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body1">Projected Subsidy</Typography>
                  <Typography variant="h6" fontWeight="bold" color="primary.dark">{formatCurrency(reportData.summary.totalSubsidy)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ borderTop: '2px solid', borderColor: 'primary.light', pt: 1.5, mt: 0.5 }}>
                  <Typography variant="body1" fontWeight="bold">Proposed Budget</Typography>
                  <Typography variant="h5" fontWeight="bold" color="primary.dark">{formatCurrency(reportData.summary.grandTotal)}</Typography>
                </Stack>
              </Stack>
            </Paper>
          )}

          {/* TEMPORARILY HIDDEN AS PER REQUEST */}
          {showWorkflowSignatories && Array.isArray(reportData?.summary?.signatories) && reportData.summary.signatories.length > 0 && (
            <Paper elevation={2} sx={{ p: 3, mt: 3, borderRadius: '16px' }}>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
                Workflow Signatories
              </Typography>
              <Stack spacing={1.5}>
                {reportData.summary.signatories.map((signatory, index) => (
                  <Box
                    key={`${signatory.userId || signatory.fullName || 'signatory'}-${index}`}
                    sx={{
                      p: 1.5,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1.5,
                      bgcolor: alpha(theme.palette.primary.main, 0.03),
                    }}
                  >
                    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={1}>
                      <Box>
                        <Typography variant="subtitle2" fontWeight="bold">
                          {signatory.fullName || 'Unknown Signatory'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {signatory.position || 'Workflow Signatory'}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Chip size="small" label={signatory.signatureType || 'Signature'} color="primary" variant="outlined" />
                        <Chip size="small" label={signatory.workflowRole || 'Role'} variant="outlined" />
                        <Chip size="small" label={`Signed: ${formatSignedDate(signatory.signedAt)}`} variant="outlined" />
                      </Stack>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </Paper>
          )}
          {/* ================================================================= */}
          {/* END OF UI FIX                                                   */}
          {/* ================================================================= */}
        </Box>
      )}

      <GenericPdfPreviewDialog
        open={pdfDialogOpen}
        onClose={closePdfDialog}
        pdfUrl={pdfPreviewUrl}
        title="Comprehensive Report PDF Preview"
        downloadFilename={pdfFilename}
      />

      {!reportData && !loading && (
        <Card elevation={0} sx={{ borderStyle: 'dashed', borderWidth: '2px', borderColor: 'divider' }}>
          <CardContent sx={{ textAlign: "center", py: 8 }}>
            <Avatar sx={{ width: 80, height: 80, bgcolor: 'action.hover', color: 'text.secondary', mx: "auto", mb: 3 }}><Assessment sx={{ fontSize: 40 }} /></Avatar>
            <Typography variant="h5" color="text.secondary" fontWeight="bold">Ready to Generate Report</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>Select your criteria and click Generate to view the report.</Typography>
          </CardContent>
        </Card>
      )}
    </ReportPageLayout>
  );
};

export default ComprehensiveReportsPage;
