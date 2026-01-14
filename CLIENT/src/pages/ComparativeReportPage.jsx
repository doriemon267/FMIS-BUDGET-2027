import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
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
  Container
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  CompareArrows as CompareIcon
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import api from '../config/api';
import { useRegion } from '../context/RegionContext';

const ComparativeReportPage = () => {
  const { selectedRegion } = useRegion();
  const [regions, setRegions] = useState([]);
  const [selectedRegionForReport, setSelectedRegionForReport] = useState(selectedRegion || '');
  const [currentFiscalYear, setCurrentFiscalYear] = useState('');
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState(null);

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
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Paper elevation={3} sx={{ p: 4, backgroundColor: '#fafafa' }}>
        {/* Header Section */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" gutterBottom sx={{ color: '#1976d2', fontWeight: 'bold' }}>
            📊 Comparative Budget Report
          </Typography>
          <Typography variant="body1" paragraph sx={{ color: '#666' }}>
            Compare current proposals with historical GAA data across regions.
          </Typography>
        </Box>
      <Box sx={{ p: 3 }}>
        {/* Controls */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Region</InputLabel>
                  <Select
                    value={selectedRegionForReport}
                    onChange={(e) => setSelectedRegionForReport(e.target.value)}
                    label="Region"
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
                <FormControl fullWidth>
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
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    variant="contained"
                    onClick={fetchComparativeReport}
                    disabled={loading || !selectedRegionForReport || !currentFiscalYear}
                    startIcon={loading ? <CircularProgress size={20} /> : <CompareIcon />}
                  >
                    {loading ? 'Generating...' : 'Generate Report'}
                  </Button>

                  <Button
                    variant="outlined"
                    onClick={exportToCSV}
                    disabled={!reportData}
                    startIcon={<DownloadIcon />}
                  >
                    Export CSV
                  </Button>

                  <Tooltip title="Refresh data">
                    <IconButton onClick={() => {
                      fetchRegions();
                      fetchCurrentFiscalYear();
                    }}>
                      <RefreshIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Report Table */}
        {reportData && (
          <Card>
            <CardContent>
              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" component="div">
                  Comparative Report for {selectedRegionForReport} - FY {currentFiscalYear}
                </Typography>
                <Chip
                  label={`Generated: ${new Date().toLocaleDateString()}`}
                  variant="outlined"
                />
              </Box>

              <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell
                        sx={{
                          fontWeight: 'bold',
                          backgroundColor: 'primary.main',
                          color: 'primary.contrastText',
                          minWidth: 300
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
                            backgroundColor: 'primary.main',
                            color: 'primary.contrastText',
                            minWidth: 120,
                            fontSize: '0.75rem'
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
                          '&:hover': { backgroundColor: 'action.hover' }
                        }}
                      >
                        <TableCell
                          sx={{
                            fontWeight: row.isHeader ? 'bold' : 'normal',
                            paddingLeft: row.isHeader ? 2 : 3
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
                              fontSize: '0.875rem'
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
            </CardContent>
          </Card>
        )}

        {/* No Data Message */}
        {!reportData && !loading && !error && (
          <Card>
            <CardContent>
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CompareIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  No Report Generated
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Select a region and fiscal year, then click "Generate Report" to view comparative data.
                </Typography>
              </Box>
            </CardContent>
          </Card>
        )}
        </Box>
      </Paper>
    </Container>
  );
};

export default ComparativeReportPage;