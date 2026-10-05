import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Tooltip,
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  GetApp as GetAppIcon,
  CompareArrows as CompareIcon,
  Home as HomeIcon,
  Assessment as AssessmentIcon,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import api from '../config/api';
import { useRegion } from '../context/RegionContext';
import { useUser } from '../context/UserContext';
import { isBRDLevelUser, hasApproverRole, isHighLevelAccess } from '../constants/roles';
import ReportPageLayout from '../components/reports/ReportPageLayout';

const ComparativeReportPage = () => {
  const { selectedRegion } = useRegion();
  const { currentUser } = useUser();
  const [regions, setRegions] = useState([]);
  const [selectedRegionForReport, setSelectedRegionForReport] = useState(selectedRegion || '');
  const [currentFiscalYear, setCurrentFiscalYear] = useState('');
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState(null);

  const isHighLevel = React.useMemo(() => isHighLevelAccess(currentUser), [currentUser]);
  const isBRD = React.useMemo(() => isBRDLevelUser(currentUser), [currentUser]);
  const scope = React.useMemo(() => String(currentUser?.hierarchicalAccess?.scope || currentUser?.hierarchicalAccess?.assignmentLevel || "").toUpperCase(), [currentUser]);

  // Unified restriction check: Preparers or unit-restricted Approvers
  const isRestricted = React.useMemo(() => {
    if (!isHighLevel) return true; // Preparers are always restricted
    if (isBRD) return false; // BRD Level (Analyst/Super Admin) is never restricted
    // Non-BRD high levels are restricted if they have unit-level scope
    return ['DEPARTMENT', 'DIVISION', 'OFFICE', 'RESPONSIBILITY_CENTER'].includes(scope);
  }, [isHighLevel, isBRD, scope]);

  // Enforce restrictions based on role/scope
  useEffect(() => {
    if (isRestricted) {
      const userRegion = currentUser?.hierarchicalAccess?.accessibleRegions?.[0]?.regionName || selectedRegion;
      if (userRegion && selectedRegionForReport !== userRegion) {
        setSelectedRegionForReport(userRegion);
      }
    }
  }, [isRestricted, currentUser, selectedRegion, selectedRegionForReport]);

  // Fetch regions on component mount
  useEffect(() => {
    fetchRegions();
    fetchCurrentFiscalYear();
  }, []);

  // Update selected region when context changes
  useEffect(() => {
    if (selectedRegion && !selectedRegionForReport) {
      setSelectedRegionForReport(selectedRegion);
    }
  }, [selectedRegion]);

  const fetchRegions = async () => {
    try {
      const response = await api.get('/api/tier-comparison/regions');
      if (response.data.success) {
        setRegions(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching regions:', error);
      toast.error('Failed to fetch regions');
    }
  };

  const fetchCurrentFiscalYear = async () => {
    try {
      const response = await api.get('/settings/active');
      if (response.data && response.data.fiscalYear) {
        setCurrentFiscalYear(response.data.fiscalYear);
      }
    } catch (error) {
      console.error('Error fetching current fiscal year:', error);
      // Fallback to current year
      setCurrentFiscalYear(new Date().getFullYear().toString());
    }
  };

  const fetchComparativeReport = async () => {
    if (!selectedRegionForReport || !currentFiscalYear) {
      toast.error('Please select a region and ensure fiscal year is set');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.get('/api/tier-comparison/comparative-report', {
        params: {
          region: selectedRegionForReport,
          currentFiscalYear
        }
      });

      if (response.data.success) {
        setReportData(response.data.data);
        toast.success('Comparative report generated successfully');
      } else {
        setError(response.data.message || 'Failed to generate report');
      }
    } catch (error) {
      console.error('Error fetching comparative report:', error);
      setError(error.response?.data?.message || 'Failed to fetch comparative report');
      toast.error('Failed to generate comparative report');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  const exportToCSV = () => {
    if (!reportData) return;

    const headers = ['PARTICULAR', ...Object.keys(reportData[0]).filter(key => key !== 'particular' && key !== 'isHeader')];
    const csvContent = [
      headers.join(','),
      ...reportData.map(row => {
        if (row.isHeader) {
          return `"${row.particular}",${headers.slice(1).map(() => '').join(',')}`;
        }
        return [
          `"${row.particular}"`,
          ...headers.slice(1).map(header => row[header] || 0)
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `comparative_report_${selectedRegionForReport}_${currentFiscalYear}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <ReportPageLayout
        title="COMPARATIVE BUDGET REPORT"
        subtitle={
          selectedRegionForReport
            ? `Compare current proposals with historical GAA for ${selectedRegionForReport}`
            : 'Select a region and fiscal year, then generate the report'
        }
        showNiaBranding={true}
        breadcrumbLabel="Comparative Budget Report"
        fiscalYear={currentFiscalYear || new Date().getFullYear()}
      >
      <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Region</InputLabel>
              <Select
                value={selectedRegionForReport}
                onChange={(e) => setSelectedRegionForReport(e.target.value)}
                label="Region"
                disabled={isRestricted}
              >
                {regions.map((region) => (
                  <MenuItem key={region} value={region}>
                    {region}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Current Fiscal Year</InputLabel>
              <Select
                value={currentFiscalYear}
                onChange={(e) => setCurrentFiscalYear(e.target.value)}
                label="Current Fiscal Year"
              >
                <MenuItem value="2024">2024</MenuItem>
                <MenuItem value="2025">2025</MenuItem>
                <MenuItem value="2026">2026</MenuItem>
                <MenuItem value="2027">2027</MenuItem>
                <MenuItem value="2028">2028</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                onClick={fetchComparativeReport}
                disabled={loading || !selectedRegionForReport || !currentFiscalYear}
                startIcon={loading ? <CircularProgress size={20} /> : <CompareIcon />}
                size="small"
              >
                {loading ? 'Generating...' : 'Generate Report'}
              </Button>
              <Button
                variant="outlined"
                onClick={exportToCSV}
                disabled={!reportData}
                startIcon={<GetAppIcon />}
                size="small"
              >
                Export CSV
              </Button>
              <Tooltip title="Refresh data">
                <IconButton
                  size="small"
                  onClick={() => {
                    fetchRegions();
                    fetchCurrentFiscalYear();
                  }}
                >
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Report Table */}
      {reportData && (
        <Paper elevation={1}>
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography variant="h6" component="div" sx={{ color: '#375e38', fontWeight: 'bold' }}>
              Comparative Report for {selectedRegionForReport} - FY {currentFiscalYear}
            </Typography>
            <Chip label={`Generated: ${new Date().toLocaleDateString()}`} variant="outlined" size="small" />
          </Box>
          <TableContainer sx={{ maxHeight: 'calc(100vh - 400px)' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell
                    sx={{
                      fontWeight: 'bold',
                      backgroundColor: '#375e38',
                      color: '#fff',
                      minWidth: 300,
                      padding: '8px 12px',
                      border: '1px solid #fff',
                      fontSize: '0.875rem',
                    }}
                  >
                    PARTICULAR
                  </TableCell>
                  {Object.keys(reportData[0] || {}).filter(key => key !== 'particular' && key !== 'isHeader').map((header) => (
                    <TableCell
                      key={header}
                      align="right"
                      sx={{
                        fontWeight: 'bold',
                        backgroundColor: '#375e38',
                        color: '#fff',
                        minWidth: 120,
                        padding: '8px 12px',
                        border: '1px solid #fff',
                        fontSize: '0.875rem',
                      }}
                    >
                      {header}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {reportData.map((row, index) => (
                  <TableRow
                    key={index}
                    sx={{
                      backgroundColor: row.isHeader ? 'grey.100' : 'inherit',
                      '&:hover': { backgroundColor: 'action.hover' },
                    }}
                  >
                    <TableCell
                      sx={{
                        fontWeight: row.isHeader ? 'bold' : 'normal',
                        paddingLeft: row.isHeader ? 2 : 3,
                        padding: '8px 12px',
                      }}
                    >
                      {row.particular}
                    </TableCell>
                    {Object.keys(row).filter(key => key !== 'particular' && key !== 'isHeader').map((header) => (
                      <TableCell
                        key={header}
                        align="right"
                        sx={{
                          fontWeight: row.isHeader ? 'bold' : 'normal',
                          fontSize: '0.875rem',
                          padding: '8px 12px',
                        }}
                      >
                        {row.isHeader ? '' : formatCurrency(row[header])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* No Data Message */}
      {!reportData && !loading && !error && (
        <Paper elevation={1} sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CompareIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              No Report Generated
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Select a region and fiscal year, then click &quot;Generate Report&quot; to view comparative data.
            </Typography>
          </Box>
        </Paper>
      )}
    </ReportPageLayout>
  );
};

export default ComparativeReportPage;