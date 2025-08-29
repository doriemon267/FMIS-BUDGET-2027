import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  Container,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  AlertTitle,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
  Card,
  CardContent,
  TextField,
  Tab,
  Tabs,
  Chip,
  Stack,
  Switch,
  FormControlLabel,
  Collapse,
  IconButton,
} from '@mui/material';
import { 
  Download, 
  Refresh, 
  PictureAsPdf, 
  ExpandMore,
  ExpandLess,
  Summarize,
  ViewList,
  Analytics
} from '@mui/icons-material';
import api from '../config/api';
import { useRegion } from '../context/RegionContext';
import IncomeReportSummary from '../components/reports/IncomeReportSummary';
import PDFPreviewDialog from '../components/PDFPreviewDialog';
// Import xlsx with named exports
import * as XLSX from 'xlsx';

const ConsolidatedCorporateIncomePage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [fiscalYear, setFiscalYear] = useState('');
  const [budgetType, setBudgetType] = useState('INITIAL');
  const [fiscalYears, setFiscalYears] = useState([]);
  const [budgetTypes] = useState(['INITIAL', 'NEP', 'GAA']);
  const [activeTab, setActiveTab] = useState(0); // 0 for summary, 1 for categories, 2 for subcategories
  const [selectedRegions, setSelectedRegions] = useState('all'); // 'all' or specific region
  const { activeRegion } = useRegion();
  const activeRegionName = activeRegion?.name || activeRegion?.regionName || activeRegion?.Region || '';
  const [showPercentages, setShowPercentages] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState(new Set());
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  
  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  // Toggle category expansion
  const toggleCategoryExpansion = (categoryId) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  // Fetch available fiscal years on component mount
  useEffect(() => {
    const fetchFiscalYears = async () => {
      try {
        // Try to get fiscal years from settings/active endpoint first
        try {
          const activeResponse = await api.get('/settings/active');
          if (activeResponse.data && activeResponse.data.fiscalYear) {
            // Use the active fiscal year and also include a few years before and after
            const activeYear = parseInt(activeResponse.data.fiscalYear);
            const years = [
              (activeYear - 2).toString(),
              (activeYear - 1).toString(),
              activeYear.toString(),
              (activeYear + 1).toString(),
              (activeYear + 2).toString()
            ];
            setFiscalYears(years);
            setFiscalYear(activeYear.toString());
            return; // Exit if we successfully got the active fiscal year
          }
        } catch (activeErr) {
          // Continue to try other methods
        }
        
        // Try to get all settings
        try {
          const response = await api.get('/settings');
          if (response.data && response.data.data && Array.isArray(response.data.data)) {
            const years = response.data.data.map(setting => setting.fiscalYear);
            const uniqueYears = [...new Set(years)]; // Remove duplicates
            
            if (uniqueYears.length > 0) {
              setFiscalYears(uniqueYears);
              
              // Set default fiscal year to the most recent one
              const sortedYears = [...uniqueYears].sort((a, b) => b - a);
              setFiscalYear(sortedYears[0]);
              return; // Exit if we successfully got fiscal years
            }
          }
        } catch (settingsErr) {
          // Continue to try other methods
        }
        
        // If we're still here, use default years
        const currentYear = new Date().getFullYear();
        const defaultYears = [
          (currentYear - 2).toString(),
          (currentYear - 1).toString(),
          currentYear.toString(),
          (currentYear + 1).toString(),
          (currentYear + 2).toString()
        ];
        setFiscalYears(defaultYears);
        setFiscalYear(currentYear.toString());
        
      } catch (err) {
        console.error('Error in fiscal year fetching process:', err);
        // Final fallback
        const currentYear = new Date().getFullYear();
        const defaultYears = [
          (currentYear - 2).toString(),
          (currentYear - 1).toString(),
          currentYear.toString(),
          (currentYear + 1).toString(),
          (currentYear + 2).toString()
        ];
        setFiscalYears(defaultYears);
        setFiscalYear(currentYear.toString());
      }
    };

    fetchFiscalYears();
  }, []);

  // Fetch report data
  const fetchReportData = async () => {
    if (!fiscalYear) {
      setError('Please select a fiscal year');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Make sure we're using the correct endpoint path and only sending required parameters
      const params = {
        fiscalYear,
        budgetType,
        // Ensure 'all' to bypass region interceptor filter when viewing all regions
        ...(selectedRegions === 'all' ? { region: 'all' } : {})
      };

      const response = await api.get('reports/consolidated-corporate-income', {
        params
      });

      if (response.data) {
        setReportData(response.data);
        setLoading(false);
      } else {
        setError('No data returned from the server. The report may be empty for the selected fiscal year and budget type.');
        setLoading(false);
      }
    } catch (err) {
      console.error('Error fetching report data:', err);
      // More detailed error logging
      if (err.response) {
        console.error('Response data:', err.response.data);
        console.error('Response status:', err.response.status);
      } else if (err.request) {
        console.error('No response received:', err.request);
      }
      
      let errorMessage = 'Failed to fetch report data. Please try again.';
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.message) {
        errorMessage = `Error: ${err.message}`;
      }
      
      setError(errorMessage);
      setLoading(false);
    }
  };

  // Export to Excel
  const handleExportToExcel = () => {
    if (!reportData) return;

    try {
      // Create workbook
      const wb = XLSX.utils.book_new();
      
      // Export hierarchical worksheet (categories with subcategories)
      const hierarchicalWsData = [];
      
      // Add title row
      hierarchicalWsData.push([`Consolidated Corporate Income Report - Fiscal Year ${reportData.fiscalYear} - ${reportData.budgetType}`]);
      hierarchicalWsData.push([]); // Empty row
      
      // Add header row with regions
      const hierarchicalHeaderRow = ['Income Category / Subcategory'];
      reportData.regions.forEach(region => {
        hierarchicalHeaderRow.push(region);
      });
      hierarchicalHeaderRow.push('Total');
      hierarchicalWsData.push(hierarchicalHeaderRow);
      
      // Add data rows with hierarchical structure
      reportData.hierarchicalData.forEach(category => {
        // Add category row
        const categoryRow = [category.name];
        let categoryTotal = 0;
        
        reportData.regions.forEach(region => {
          const amount = reportData.regionData[region]?.categoryAmounts[category.id] || 0;
          // Use actual number values for Excel
          categoryRow.push(amount);
          categoryTotal += amount;
        });
        
        // Use actual number value for the total
        categoryRow.push(categoryTotal);
        hierarchicalWsData.push(categoryRow);
        
        // Add subcategory rows
        category.subcategories.forEach(subcategory => {
          const subcategoryRow = [`    ${subcategory.name}`]; // Indent with spaces
          let subcategoryTotal = 0;
          
          reportData.regions.forEach(region => {
            const amount = reportData.regionData[region]?.subcategoryAmounts[subcategory.id] || 0;
            // Use actual number values for Excel
            subcategoryRow.push(amount);
            subcategoryTotal += amount;
          });
          
          // Use actual number value for the total
          subcategoryRow.push(subcategoryTotal);
          hierarchicalWsData.push(subcategoryRow);
        });
      });
      
      // Add total row
      const totalRow = ['TOTAL'];
      reportData.regions.forEach(region => {
        // Use actual number values for Excel
        totalRow.push(reportData.regionData[region]?.total || 0);
      });
      totalRow.push(reportData.grandTotal);
      hierarchicalWsData.push(totalRow);
      
      // Create hierarchical worksheet
      const hierarchicalWs = XLSX.utils.aoa_to_sheet(hierarchicalWsData);
      
      // Set column widths
      const hierarchicalColWidths = [
        { wch: 40 }, // Income Category / Subcategory
        ...reportData.regions.map(() => ({ wch: 15 })), // Region columns
        { wch: 15 }, // Total column
      ];
      hierarchicalWs['!cols'] = hierarchicalColWidths;
      
      // Apply number formatting to cells (starting from row 3, which is the data rows)
      const hierarchicalRange = XLSX.utils.decode_range(hierarchicalWs['!ref']);
      for (let R = 3; R <= hierarchicalRange.e.r; R++) {
        for (let C = 1; C <= hierarchicalRange.e.c; C++) {
          const cell_address = { c: C, r: R };
          const cell_ref = XLSX.utils.encode_cell(cell_address);
          if (hierarchicalWs[cell_ref] && typeof hierarchicalWs[cell_ref].v === 'number') {
            hierarchicalWs[cell_ref].z = '#,##0.00'; // Apply number format with 2 decimal places
          }
        }
      }
      
      // Add hierarchical worksheet to workbook
      XLSX.utils.book_append_sheet(wb, hierarchicalWs, 'Consolidated Income');
      
      // Export subcategories worksheet with tree view
      // Group subcategories by parent category for tree view
      const categoriesWithSubcategories = [];
      if (reportData.hierarchicalData) {
        reportData.hierarchicalData.forEach(category => {
          if (category.subcategories && category.subcategories.length > 0) {
            categoriesWithSubcategories.push({
              ...category,
              subcategories: category.subcategories
            });
          }
        });
      }
      
      if (categoriesWithSubcategories.length > 0) {
        const subcategoryWsData = [];
        
        // Add title row
        subcategoryWsData.push([`Consolidated Corporate Income Report - Subcategory Details (Tree View) - Fiscal Year ${reportData.fiscalYear} - ${reportData.budgetType}`]);
        subcategoryWsData.push([]); // Empty row
        
        // Add header row with regions
        const subcategoryHeaderRow = ['Income Category / Subcategory (Tree View)'];
        reportData.regions.forEach(region => {
          subcategoryHeaderRow.push(region);
        });
        subcategoryHeaderRow.push('Total');
        subcategoryWsData.push(subcategoryHeaderRow);
        
        // Add data rows with tree structure
        categoriesWithSubcategories
          .sort((a, b) => a.name.localeCompare(b.name))
          .forEach(category => {
            // Add parent category row
            const categoryRow = [`📁 ${category.name}`];
            let categoryTotal = 0;
            
            reportData.regions.forEach(region => {
              const amount = reportData.regionData[region]?.categoryAmounts[category.id] || 0;
              categoryRow.push(amount);
              categoryTotal += amount;
            });
            
            categoryRow.push(categoryTotal);
            subcategoryWsData.push(categoryRow);
            
            // Add subcategory rows
            category.subcategories
              .sort((a, b) => a.name.localeCompare(b.name))
              .forEach(subcategory => {
                const subcategoryRow = [`    └── 📄 ${subcategory.name}`];
                let subcategoryTotal = 0;
                
                reportData.regions.forEach(region => {
                  const amount = reportData.regionData[region]?.subcategoryAmounts[subcategory.id] || 0;
                  subcategoryRow.push(amount);
                  subcategoryTotal += amount;
                });
                
                subcategoryRow.push(subcategoryTotal);
                subcategoryWsData.push(subcategoryRow);
              });
          });
        
        // Add total row
        const subcategoryTotalRow = ['🏆 GRAND TOTAL'];
        reportData.regions.forEach(region => {
          // Use actual number values for Excel
          subcategoryTotalRow.push(reportData.regionData[region]?.total || 0);
        });
        subcategoryTotalRow.push(reportData.grandTotal);
        subcategoryWsData.push(subcategoryTotalRow);
        
        // Create subcategory worksheet
        const subcategoryWs = XLSX.utils.aoa_to_sheet(subcategoryWsData);
        
        // Set column widths
        const subcategoryColWidths = [
          { wch: 40 }, // Tree view column (wider for indentation)
          ...reportData.regions.map(() => ({ wch: 15 })), // Region columns
          { wch: 15 }, // Total column
        ];
        subcategoryWs['!cols'] = subcategoryColWidths;
        
        // Apply number formatting to cells (starting from row 3, which is the data rows)
        const subcategoryRange = XLSX.utils.decode_range(subcategoryWs['!ref']);
        for (let R = 3; R <= subcategoryRange.e.r; R++) {
          for (let C = 1; C <= subcategoryRange.e.c; C++) { // Start from column 1 (after tree view column)
            const cell_address = { c: C, r: R };
            const cell_ref = XLSX.utils.encode_cell(cell_address);
            if (subcategoryWs[cell_ref] && typeof subcategoryWs[cell_ref].v === 'number') {
              subcategoryWs[cell_ref].z = '#,##0.00'; // Apply number format with 2 decimal places
            }
          }
        }
        
        // Add subcategory worksheet to workbook
        XLSX.utils.book_append_sheet(wb, subcategoryWs, 'Subcategory Details');
      }
      
      // Generate Excel file and trigger download
      XLSX.writeFile(wb, `Consolidated_Corporate_Income_${reportData.fiscalYear}_${reportData.budgetType}.xlsx`);
    } catch (err) {
      console.error('Error exporting to Excel:', err);
      setError('Failed to export to Excel. Please try again.');
    }
  };
  
  // Open PDF Preview Dialog
  const handleExportToPDF = () => {
    if (!reportData) return;
    setPdfPreviewOpen(true);
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Paper elevation={3} sx={{ p: 4, backgroundColor: '#fafafa' }}>
        {/* Header Section */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" gutterBottom sx={{ color: '#1976d2', fontWeight: 'bold' }}>
            📊 Consolidated Corporate Income Report
          </Typography>
          <Typography variant="body1" paragraph sx={{ color: '#666' }}>
            Comprehensive income analysis across all regions with detailed breakdown by categories and subcategories.
          </Typography>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Control Panel */}
        <Card sx={{ mb: 3, backgroundColor: '#f8f9fa' }} elevation={2}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ color: '#1976d2', mb: 2 }}>
              Report Configuration
            </Typography>
            
            <Grid container spacing={3} alignItems="center">
              {/* Filter Controls */}
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel id="fiscal-year-label">Fiscal Year</InputLabel>
                  <Select
                    labelId="fiscal-year-label"
                    id="fiscal-year"
                    value={fiscalYear}
                    label="Fiscal Year"
                    onChange={(e) => setFiscalYear(e.target.value)}
                  >
                    {fiscalYears.map((year) => (
                      <MenuItem key={year} value={year}>
                        {year}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel id="budget-type-label">Budget Type</InputLabel>
                  <Select
                    labelId="budget-type-label"
                    id="budget-type"
                    value={budgetType}
                    label="Budget Type"
                    onChange={(e) => setBudgetType(e.target.value)}
                  >
                    {budgetTypes.map((type) => (
                      <MenuItem key={type} value={type}>
                        {type}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Region Toggle and Filter */}
              <Grid item xs={12} md={3}>
                <Stack spacing={1}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={selectedRegions === 'all'}
                        onChange={(e) => {
                          const isAll = e.target.checked;
                          setSelectedRegions(isAll ? 'all' : (activeRegionName || 'all'));
                        }}
                        size="small"
                      />
                    }
                    label={selectedRegions === 'all' ? 'Viewing: All Regions' : `Viewing: Current Region (${activeRegionName || 'N/A'})`}
                  />
                  <FormControl fullWidth size="small">
                    <InputLabel id="region-filter-label">Region View</InputLabel>
                    <Select
                      labelId="region-filter-label"
                      id="region-filter"
                      value={selectedRegions}
                      label="Region View"
                      onChange={(e) => setSelectedRegions(e.target.value)}
                    >
                      <MenuItem value="all">All Regions</MenuItem>
                      {reportData?.regions?.map((region) => (
                        <MenuItem key={region} value={region}>
                          {region}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>
              </Grid>

              {/* View Options */}
              <Grid item xs={12} md={3}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={showPercentages}
                      onChange={(e) => setShowPercentages(e.target.checked)}
                      size="small"
                    />
                  }
                  label="Show Percentages"
                />
              </Grid>

              {/* Action Buttons */}
              <Grid item xs={12}>
                <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={fetchReportData}
                    disabled={loading || !fiscalYear}
                    startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <Refresh />}
                    sx={{ minWidth: 140 }}
                  >
                    {loading ? 'Loading...' : 'Generate Report'}
                  </Button>
                  
                  {reportData && (
                    <>
                      <Button
                        variant="outlined"
                        color="primary"
                        onClick={handleExportToExcel}
                        startIcon={<Download />}
                        sx={{ minWidth: 140 }}
                      >
                        Export Excel
                      </Button>
                      
                      <Button
                        variant="outlined"
                        color="secondary"
                        onClick={handleExportToPDF}
                        startIcon={<PictureAsPdf />}
                        sx={{ minWidth: 140 }}
                      >
                        PDF Preview
                      </Button>
                    </>
                  )}
                </Stack>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Error Message */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} elevation={2}>
            <AlertTitle>Error</AlertTitle>
            {error}
          </Alert>
        )}

        {/* Report Data */}
        {reportData && (
          <Card elevation={3}>
            <CardContent>
              {/* Report Header */}
              <Box sx={{ mb: 3, textAlign: 'center' }}>
                <Typography variant="h5" gutterBottom sx={{ color: '#1976d2', fontWeight: 'bold' }}>
                  Corporate Income Analysis - FY {reportData.fiscalYear} ({reportData.budgetType})
                </Typography>
                
                {/* Summary Stats */}
                <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 2, mb: 3 }}>
                  <Chip 
                    icon={<Analytics />}
                    label={`Total Income: ₱${reportData.grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                    color="primary"
                    variant="filled"
                    sx={{ fontSize: '1rem', py: 2 }}
                  />
                  <Chip 
                    label={`${reportData.regions?.length || 0} Regions`}
                    color="secondary"
                    variant="outlined"
                  />
                  <Chip 
                    label={`${reportData.hierarchicalData?.length || 0} Categories`}
                    color="info"
                    variant="outlined"
                  />
                </Stack>
              </Box>
              
              {reportData.message ? (
                <Alert severity="info" sx={{ mt: 2 }}>
                  <AlertTitle>No Data Available</AlertTitle>
                  {reportData.message}
                </Alert>
              ) : !reportData.hierarchicalData || reportData.hierarchicalData.length === 0 ? (
                <Alert severity="info" sx={{ mt: 2 }}>
                  <AlertTitle>No Categories Found</AlertTitle>
                  No income categories are defined in the system. Please add income categories first.
                </Alert>
              ) : !reportData.regions || reportData.regions.length === 0 ? (
                <Alert severity="info" sx={{ mt: 2 }}>
                  <AlertTitle>No Regions Found</AlertTitle>
                  No regions are defined in the system. Please add regions first.
                </Alert>
              ) : reportData.grandTotal === 0 ? (
                <Alert severity="info" sx={{ mt: 2 }}>
                  <AlertTitle>No Income Data</AlertTitle>
                  No income data found for the selected fiscal year ({reportData.fiscalYear}) and budget type ({reportData.budgetType}).
                </Alert>
              ) : (
                <>
                  {/* Tab Navigation */}
                  <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                    <Tabs 
                      value={activeTab} 
                      onChange={handleTabChange}
                      aria-label="report tabs"
                      variant="fullWidth"
                    >
                      <Tab 
                        icon={<Summarize />} 
                        label="Executive Summary" 
                        iconPosition="start"
                      />
                      <Tab 
                        icon={<ViewList />} 
                        label="Category Breakdown" 
                        iconPosition="start"
                      />
                      <Tab 
                        icon={<Analytics />} 
                        label="Subcategory Details" 
                        iconPosition="start"
                      />
                    </Tabs>
                  </Box>
                      
                  {/* Executive Summary Tab */}
                  {activeTab === 0 && (
                    <IncomeReportSummary 
                      reportData={reportData} 
                      showPercentages={showPercentages}
                    />
                  )}
                      
                  {/* Category Breakdown Tab */}
                  {activeTab === 1 && (
                    <TableContainer component={Paper} sx={{ backgroundColor: '#fafafa' }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow sx={{ backgroundColor: '#e3f2fd' }}>
                            <TableCell sx={{ fontWeight: 'bold', width: '300px' }}>
                              Income Category / Subcategory
                            </TableCell>
                            {reportData.regions
                              .filter(region => selectedRegions === 'all' || selectedRegions === region)
                              .map((region) => (
                                <TableCell 
                                  key={region} 
                                  align="right"
                                  sx={{ fontWeight: 'bold' }}
                                >
                                  {region}
                                </TableCell>
                              ))}
                            <TableCell 
                              align="right"
                              sx={{ fontWeight: 'bold', backgroundColor: '#c8e6c9' }}
                            >
                              Total
                            </TableCell>
                            {showPercentages && (
                              <TableCell 
                                align="right"
                                sx={{ fontWeight: 'bold', backgroundColor: '#c8e6c9' }}
                              >
                                %
                              </TableCell>
                            )}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {reportData.hierarchicalData.map((category) => {
                            const categoryTotal = reportData.categoryTotals[category.id] || 0;
                            const categoryPercentage = reportData.grandTotal > 0 ? (categoryTotal / reportData.grandTotal * 100) : 0;
                            const isExpanded = expandedCategories.has(category.id);
                            
                            const categoryRows = [];
                            
                            // Add the category row with expand/collapse functionality
                            categoryRows.push(
                              <TableRow key={`category-${category.id}`} sx={{ backgroundColor: '#f8f9fa' }}>
                                <TableCell sx={{ fontWeight: 'bold' }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    {category.subcategories && category.subcategories.length > 0 && (
                                      <IconButton 
                                        size="small" 
                                        onClick={() => toggleCategoryExpansion(category.id)}
                                        sx={{ mr: 1 }}
                                      >
                                        {isExpanded ? <ExpandLess /> : <ExpandMore />}
                                      </IconButton>
                                    )}
                                    {category.name}
                                  </Box>
                                </TableCell>
                                {reportData.regions
                                  .filter(region => selectedRegions === 'all' || selectedRegions === region)
                                  .map((region) => (
                                    <TableCell key={`${region}-${category.id}`} align="right">
                                      ₱{(reportData.regionData[region]?.categoryAmounts[category.id] || 0)
                                        .toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </TableCell>
                                  ))}
                                <TableCell align="right" sx={{ fontWeight: 'bold', color: '#2e7d32' }}>
                                  ₱{categoryTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </TableCell>
                                {showPercentages && (
                                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                                    {categoryPercentage.toFixed(1)}%
                                  </TableCell>
                                )}
                              </TableRow>
                            );
                            
                            // Add subcategory rows (collapsed/expanded based on state)
                            if (isExpanded && category.subcategories && category.subcategories.length > 0) {
                              category.subcategories.forEach((subcategory) => {
                                const subcategoryTotal = reportData.subcategoryTotals[subcategory.id] || 0;
                                const subcategoryPercentage = reportData.grandTotal > 0 ? (subcategoryTotal / reportData.grandTotal * 100) : 0;
                                
                                categoryRows.push(
                                  <TableRow key={`subcategory-${category.id}-${subcategory.id}`}>
                                    <TableCell sx={{ paddingLeft: '60px', color: '#666' }}>
                                      {subcategory.name}
                                    </TableCell>
                                    {reportData.regions
                                      .filter(region => selectedRegions === 'all' || selectedRegions === region)
                                      .map((region) => (
                                        <TableCell key={`${region}-${subcategory.id}`} align="right">
                                          ₱{(reportData.regionData[region]?.subcategoryAmounts[subcategory.id] || 0)
                                            .toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </TableCell>
                                      ))}
                                    <TableCell align="right" sx={{ color: '#2e7d32' }}>
                                      ₱{subcategoryTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </TableCell>
                                    {showPercentages && (
                                      <TableCell align="right">
                                        {subcategoryPercentage.toFixed(1)}%
                                      </TableCell>
                                    )}
                                  </TableRow>
                                );
                              });
                            }
                            
                            return categoryRows;
                          })}
                          
                          {/* Total Row */}
                          <TableRow sx={{ backgroundColor: '#e8f5e8', fontWeight: 'bold' }}>
                            <TableCell sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                              GRAND TOTAL
                            </TableCell>
                            {reportData.regions
                              .filter(region => selectedRegions === 'all' || selectedRegions === region)
                              .map((region) => (
                                <TableCell key={`total-${region}`} align="right" sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                                  ₱{(reportData.regionData[region]?.total || 0)
                                    .toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </TableCell>
                              ))}
                            <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#1976d2' }}>
                              ₱{reportData.grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                            {showPercentages && (
                              <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                                100.0%
                              </TableCell>
                            )}
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                      
                  {/* Subcategory Details Tab - Tree View */}
                  {activeTab === 2 && (
                    <>
                      {(() => {
                        // Group subcategories by parent category for tree view
                        const categoriesWithSubcategories = [];
                        if (reportData.hierarchicalData) {
                          reportData.hierarchicalData.forEach(category => {
                            if (category.subcategories && category.subcategories.length > 0) {
                              categoriesWithSubcategories.push({
                                ...category,
                                subcategories: category.subcategories
                              });
                            }
                          });
                        }
                        
                        return categoriesWithSubcategories.length > 0 ? (
                          <TableContainer component={Paper} sx={{ backgroundColor: '#fafafa' }}>
                            <Table size="small" stickyHeader>
                              <TableHead>
                                <TableRow sx={{ backgroundColor: '#e3f2fd' }}>
                                  <TableCell sx={{ fontWeight: 'bold', width: '300px' }}>
                                    Income Category / Subcategory (Tree View)
                                  </TableCell>
                                  {reportData.regions
                                    .filter(region => selectedRegions === 'all' || selectedRegions === region)
                                    .map((region) => (
                                      <TableCell 
                                        key={region} 
                                        align="right"
                                        sx={{ fontWeight: 'bold' }}
                                      >
                                        {region}
                                      </TableCell>
                                    ))}
                                  <TableCell 
                                    align="right"
                                    sx={{ fontWeight: 'bold', backgroundColor: '#c8e6c9' }}
                                  >
                                    Total
                                  </TableCell>
                                  {showPercentages && (
                                    <TableCell 
                                      align="right"
                                      sx={{ fontWeight: 'bold', backgroundColor: '#c8e6c9' }}
                                    >
                                      %
                                  </TableCell>
                                  )}
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {categoriesWithSubcategories
                                  .sort((a, b) => a.name.localeCompare(b.name))
                                  .map((category) => {
                                    const categoryTotal = reportData.categoryTotals[category.id] || 0;
                                    const categoryPercentage = reportData.grandTotal > 0 ? (categoryTotal / reportData.grandTotal * 100) : 0;
                                    
                                    return (
                                      <React.Fragment key={category.id}>
                                        {/* Parent Category Row */}
                                        <TableRow sx={{ 
                                          backgroundColor: '#e1f5fe',
                                          '&:hover': { backgroundColor: '#b3e5fc' }
                                        }}>
                                          <TableCell sx={{ 
                                            fontWeight: 'bold', 
                                            fontSize: '1rem',
                                            color: '#0277bd',
                                            borderLeft: '4px solid #0288d1'
                                          }}>
                                            📁 {category.name}
                                          </TableCell>
                                          {reportData.regions
                                            .filter(region => selectedRegions === 'all' || selectedRegions === region)
                                            .map((region) => (
                                              <TableCell key={`${region}-${category.id}`} align="right" sx={{ fontWeight: 'bold' }}>
                                                ₱{(reportData.regionData[region]?.categoryAmounts[category.id] || 0)
                                                  .toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                              </TableCell>
                                            ))}
                                          <TableCell align="right" sx={{ fontWeight: 'bold', color: '#0277bd' }}>
                                            ₱{categoryTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                          </TableCell>
                                          {showPercentages && (
                                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                                              {categoryPercentage.toFixed(1)}%
                                            </TableCell>
                                          )}
                                        </TableRow>
                                        
                                        {/* Subcategory Rows */}
                                        {category.subcategories
                                          .sort((a, b) => a.name.localeCompare(b.name))
                                          .map((subcategory) => {
                                            const subcategoryTotal = reportData.subcategoryTotals[subcategory.id] || 0;
                                            const subcategoryPercentage = reportData.grandTotal > 0 ? (subcategoryTotal / reportData.grandTotal * 100) : 0;
                                            
                                            return (
                                              <TableRow key={subcategory.id} sx={{ 
                                                '&:hover': { backgroundColor: '#f5f5f5' },
                                                backgroundColor: '#fafafa'
                                              }}>
                                                <TableCell sx={{ 
                                                  fontWeight: 'medium',
                                                  paddingLeft: '2rem',
                                                  color: '#424242',
                                                  borderLeft: '2px solid #e0e0e0'
                                                }}>
                                                  └── 📄 {subcategory.name}
                                                </TableCell>
                                                {reportData.regions
                                                  .filter(region => selectedRegions === 'all' || selectedRegions === region)
                                                  .map((region) => (
                                                    <TableCell key={`${region}-${subcategory.id}`} align="right">
                                                      ₱{(reportData.regionData[region]?.subcategoryAmounts[subcategory.id] || 0)
                                                        .toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </TableCell>
                                                  ))}
                                                <TableCell align="right" sx={{ fontWeight: 'bold', color: '#2e7d32' }}>
                                                  ₱{subcategoryTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </TableCell>
                                                {showPercentages && (
                                                  <TableCell align="right">
                                                    {subcategoryPercentage.toFixed(1)}%
                                                  </TableCell>
                                                )}
                                              </TableRow>
                                            );
                                          })}
                                      </React.Fragment>
                                    );
                                  })}
                                
                                {/* Total Row */}
                                <TableRow sx={{ backgroundColor: '#e8f5e8', borderTop: '2px solid #4caf50' }}>
                                  <TableCell sx={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#2e7d32' }}>
                                    🏆 GRAND TOTAL
                                  </TableCell>
                                  {reportData.regions
                                    .filter(region => selectedRegions === 'all' || selectedRegions === region)
                                    .map((region) => (
                                      <TableCell key={`total-${region}`} align="right" sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                                        ₱{(reportData.regionData[region]?.total || 0)
                                          .toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </TableCell>
                                    ))}
                                  <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#1976d2' }}>
                                    ₱{reportData.grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </TableCell>
                                  {showPercentages && (
                                    <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                                      100.0%
                                    </TableCell>
                                  )}
                                </TableRow>
                              </TableBody>
                            </Table>
                          </TableContainer>
                        ) : (
                          <Alert severity="info" sx={{ mt: 2 }}>
                            <AlertTitle>No Subcategories Found</AlertTitle>
                            No income subcategories are defined in the system or no income data is associated with subcategories.
                          </Alert>
                        );
                      })()}
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}
      </Paper>

      {/* PDF Preview Dialog */}
      <PDFPreviewDialog
        open={pdfPreviewOpen}
        onClose={() => setPdfPreviewOpen(false)}
        reportData={reportData}
        activeTab={activeTab}
        selectedRegions={selectedRegions}
        showPercentages={showPercentages}
      />
    </Container>
  );
};

export default ConsolidatedCorporateIncomePage;