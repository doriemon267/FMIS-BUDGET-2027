import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  CircularProgress,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Alert,
  Chip,
  IconButton,
  Tooltip,
  Divider,
  
} from "@mui/material";
import {
  Refresh as RefreshIcon,
  LocationOn as LocationIcon
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import api from "../config/api";
import { useUser } from "../context/UserContext";
import { useRegion } from "../context/RegionContext";
import ProposalViewModal from "../components/myproposal/ProposalViewModal";
// ActiveRegionDisplay is shown globally in the Dashboard AppBar
// import ActiveRegionDisplay from "../components/common/ActiveRegionDisplay";
import { toast } from "react-toastify";

const MyProposalPage = () => {
  const navigate = useNavigate();
  const { currentUser } = useUser();
  const { activeRegion } = useRegion();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  
  // Pagination states for each table
  const [paginationState, setPaginationState] = useState({
    personnel: { page: 0, rowsPerPage: 5 },
    mooe: { page: 0, rowsPerPage: 5 },
    capitalOutlay: { page: 0, rowsPerPage: 5 },
    income: { page: 0, rowsPerPage: 5 },
    budgetarySupport: { page: 0, rowsPerPage: 5 },
    draft: { page: 0, rowsPerPage: 5 },
    returned: { page: 0, rowsPerPage: 5 },
    approved: { page: 0, rowsPerPage: 5 }
  });

  // Function to handle page change for a specific table
  const handleChangePage = (tableType, newPage) => {
    setPaginationState(prev => ({
      ...prev,
      [tableType]: { ...prev[tableType], page: newPage }
    }));
  };

  // Function to handle rows per page change for a specific table
  const handleChangeRowsPerPage = (tableType, event) => {
    setPaginationState(prev => ({
      ...prev,
      [tableType]: { 
        page: 0, // Reset to first page
        rowsPerPage: parseInt(event.target.value, 10) 
      }
    }));
  };

  const fetchProposals = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // CRITICAL: Region is REQUIRED to view proposals
      if (!activeRegion) {
        console.warn("No active region selected - cannot fetch proposals");
        toast.warning("Please select a region to view proposals");
        setError("Please select a region to view proposals");
        setLoading(false);
        return;
      }
      
      const regionName = activeRegion.name || activeRegion.regionName;
      
      // Always include both user and region parameters
      const params = {
        processBy: `${currentUser.FirstName} ${currentUser.LastName}`,
        region: regionName
      };
      
      const response = await api.get("/myproposals/all", { params });
      setData(response.data);
      
      // Show success message with region name
      toast.success(`Viewing proposals for ${regionName} region`);
    } catch (err) {
      console.error("Error fetching proposals:", err);
      
      // Check if this is a region-related error
      if (err.response && err.response.data && err.response.data.error === "REGION_REQUIRED") {
        setError("Please select a region to view proposals.");
        toast.warning("Please select a region to view proposals");
      } else {
        setError("Failed to fetch proposals. Please try again later.");
        toast.error("Failed to load proposals. Please try again.");
      }
      
      // Clear data on error
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser?.FirstName && currentUser?.LastName && activeRegion) {
      fetchProposals();
    }
  }, [currentUser?.FirstName, currentUser?.LastName, refreshTrigger]);
  
  // Fetch proposals when region changes
  // Debug function to analyze data
  const analyzeData = useCallback(() => {
    if (!data) return;
    
    const regionName = activeRegion ? (activeRegion.name || activeRegion.regionName) : 'None';
    
    ['personnel', 'mooe', 'capitalOutlay', 'income', 'budgetarySupport'].forEach(category => {
      if (data[category]) {
        // Count items by region and status
        const regionCounts = {};
        data[category].forEach(item => {
          const itemRegion = item.region || 'Unknown';
          const itemStatus = item.status || 'Unknown';
          
          if (!regionCounts[itemRegion]) {
            regionCounts[itemRegion] = { Draft: 0, Submitted: 0, Returned: 0, Approved: 0, Unknown: 0 };
          }
          
          regionCounts[itemRegion][itemStatus]++;
        });
        
      }
    });
  }, [data, activeRegion]);

  useEffect(() => {
    if (activeRegion) {
      const regionName = activeRegion.name || activeRegion.regionName;
      fetchProposals();
    } else {
      // Clear data if no region is selected
      setData(null);
      setError("Please select a region to view proposals");
    }
  }, [activeRegion]);
  
  // Run data analysis when data changes
  useEffect(() => {
    if (data) {
      analyzeData();
    }
  }, [data, analyzeData]);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleViewProposal = (proposal) => {
    // Enhance proposal with user information if missing
    const enhancedProposal = {
      ...proposal,
      processBy: proposal.processBy || `${currentUser.FirstName} ${currentUser.LastName}`
    };
    
    setSelectedProposal(enhancedProposal);
    setViewModalOpen(true);
  };

  // Open details for merged Personnel rows by constructing a pseudo proposal
  const handleOpenMergedPersonnelDetails = (mergedRow) => {
    const regionName = activeRegion ? (activeRegion.name || activeRegion.regionName) : mergedRow.region;
    const pseudoProposal = {
      cobExpenditures: 'Personnel Services',
      fiscalYear: mergedRow.fiscalYear,
      budgetType: mergedRow.budgetType,
      region: regionName || mergedRow.region,
      status: mergedRow.status,
      processBy: `${currentUser.FirstName} ${currentUser.LastName}`,
    };
    setSelectedProposal(pseudoProposal);
    setViewModalOpen(true);
  };

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // Helper function to get proposals by status
  const getProposalsByStatus = (category, status) => {
    if (!data || !data[category]) return [];
    return data[category].filter(item => item.status === status);
  };

  // Get all proposals for a specific status across all categories
  const getAllProposalsByStatus = (status) => {
    if (!data) return {};
    if (!activeRegion) return {}; // No region selected, return empty
    
    const regionName = activeRegion.name || activeRegion.regionName;
    
    const result = {};
    ['personnel', 'mooe', 'capitalOutlay', 'income', 'budgetarySupport'].forEach(category => {
      if (data[category]) {
        // For Draft status, strictly enforce region matching
        let filtered;
        if (status === "Draft") {
          filtered = data[category].filter(item => 
            item.status === status && item.region === regionName
          );
        } else {
          filtered = data[category].filter(item => item.status === status);
        }
        
        if (filtered.length > 0) {
          result[category] = filtered;
        }
      }
    });
    
    return result;
  };

  // Get status color for chips
  const getStatusColor = (status) => {
    switch (status) {
      case "Draft": return "default";
      case "Submitted": return "primary";
      case "Returned": return "error";
      case "Approved": return "success";
      default: return "default";
    }
  };

  // Get formatted date with fallbacks
  const getFormattedDate = (proposal) => {
    const dateValue = proposal.updatedAt || proposal.submittedDate || 
                      proposal.rejectedDate || proposal.approvedDate;
    
    if (!dateValue) return "N/A";
    
    try {
      return new Date(dateValue).toLocaleDateString();
    } catch (err) {
      console.warn("Invalid date format:", dateValue);
      return "Invalid date";
    }
  };

  // Helper function to format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  // Render detailed proposals table based on category
  const renderProposalsTable = (category, proposals, tableType) => {
    // CRITICAL: Filter proposals to only show those from the active region
    // This is a client-side safety measure in addition to server-side filtering
    const regionName = activeRegion ? (activeRegion.name || activeRegion.regionName) : '';
    
    // Filter proposals by active region
    const filteredProposals = proposals.filter(proposal => {
      // For draft proposals, strictly enforce region matching
      if (proposal.status === "Draft") {
        return proposal.region === regionName;
      }
      // For other statuses, we can be more lenient if needed
      return true;
    });

    // Always merge Personnel Services rows by FY/BudgetType/Region/Status (Option 2)
    let workingProposals = filteredProposals;
    const isPersonnelCategory = String(category).toLowerCase() === 'personnel';
    if (isPersonnelCategory) {
      const calcTotal = (item) => Number(item?.Total) || 0;
      const groups = new Map();
      filteredProposals.forEach(p => {
        const key = `${p.fiscalYear || 'Unknown'}|${p.budgetType || 'Unknown'}|${p.region || 'Unknown'}|${p.status || 'Unknown'}`;
        if (!groups.has(key)) {
          groups.set(key, {
            _id: key,
            categoryLabel: 'Personnel Services',
            fiscalYear: p.fiscalYear || 'Unknown',
            budgetType: p.budgetType || 'Unknown',
            region: p.region || 'Unknown',
            status: p.status || 'Unknown',
            mergedCount: 0,
            totalAmount: 0,
          });
        }
        const agg = groups.get(key);
        agg.mergedCount += 1;
        agg.totalAmount += calcTotal(p);
      });
      workingProposals = Array.from(groups.values());
    }

    const { page, rowsPerPage } = paginationState[tableType];
    const paginatedProposals = workingProposals.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    // Format category name for display
    const getCategoryDisplayName = (cat) => {
      switch(cat.toLowerCase()) {
        case 'personnel': return 'Personnel Services';
        case 'mooe': return 'MOOE';
        case 'capitaloutlay': return 'Capital Outlay';
        case 'income': return 'Income';
        case 'budgetarysupport': return 'Budgetary Support';
        default: return cat.charAt(0).toUpperCase() + cat.slice(1);
      }
    };

    // Define columns based on category
    const getTableColumns = (category) => {
      switch (category.toLowerCase()) {
        case 'personnel':
          return [
            { key: 'categoryLabel', label: 'Expenditure', width: '160px' },
            { key: 'fiscalYear', label: 'FY', width: '80px' },
            { key: 'budgetType', label: 'Budget Type', width: '120px' },
            { key: 'region', label: 'Region', width: '120px' },
            { key: 'mergedCount', label: 'Records', width: '100px' },
            { key: 'totalAmount', label: 'Total Amount', width: '140px', type: 'currency' },
            { key: 'status', label: 'Status', width: '110px', type: 'status' }
          ];
        case 'mooe':
          return [
            { key: 'accountingTitle', label: 'Accounting Title', width: '200px' },
            { key: 'uacsCode', label: 'UACS Code', width: '120px' },
            { key: 'sublineItem', label: 'Subline Item', width: '150px' },
            { key: 'income', label: 'Income', width: '120px', type: 'currency' },
            { key: 'subsidy', label: 'Subsidy', width: '120px', type: 'currency' },
            { key: 'amount', label: 'Total Amount', width: '120px', type: 'currency' },
            { key: 'fiscalYear', label: 'FY', width: '80px' },
            { key: 'region', label: 'Region', width: '100px' },
            { key: 'status', label: 'Status', width: '100px', type: 'status' }
          ];
        case 'capitaloutlay':
        case 'capital outlay':
          return [
            { key: 'category', label: 'Category', width: '150px' },
            { key: 'sublineItem', label: 'Subline Item', width: '150px' },
            { key: 'accountingTitle', label: 'Accounting Title', width: '180px' },
            { key: 'uacsCode', label: 'UACS Code', width: '120px' },
            { key: 'particulars', label: 'Particulars', width: '200px' },
            { key: 'income', label: 'Income', width: '120px', type: 'currency' },
            { key: 'subsidy', label: 'Subsidy', width: '120px', type: 'currency' },
            { key: 'cost', label: 'Cost', width: '120px', type: 'currency' },
            { key: 'fiscalYear', label: 'FY', width: '80px' },
            { key: 'region', label: 'Region', width: '100px' },
            { key: 'status', label: 'Status', width: '100px', type: 'status' }
          ];
        case 'income':
          return [
            { key: 'accountingTitle', label: 'Accounting Title', width: '200px' },
            { key: 'uacsCode', label: 'UACS Code', width: '120px' },
            { key: 'amount', label: 'Amount', width: '120px', type: 'currency' },
            { key: 'fiscalYear', label: 'FY', width: '80px' },
            { key: 'region', label: 'Region', width: '100px' },
            { key: 'status', label: 'Status', width: '100px', type: 'status' }
          ];
        default:
          return [
            { key: 'fiscalYear', label: 'Fiscal Year', width: '100px' },
            { key: 'budgetType', label: 'Budget Type', width: '120px' },
            { key: 'region', label: 'Region', width: '100px' },
            { key: 'status', label: 'Status', width: '100px', type: 'status' }
          ];
      }
    };

  const columns = getTableColumns(category);

    const renderCellValue = (proposal, column) => {
      const value = proposal[column.key];

      if (column.type === 'currency') {
        return formatCurrency(value);
      } else if (column.type === 'status') {
        return (
          <Chip
            label={value || 'N/A'}
            size="small"
            color={getStatusColor(value)}
            sx={{ fontWeight: 600, borderRadius: 2 }}
          />
        );
      } else if (column.key === 'category' && proposal.category?.title) {
        return proposal.category.title;
      } else {
        return value || 'N/A';
      }
    };

    return (
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" gutterBottom sx={{
          color: '#375e38',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          mb: 2
        }}>
          {getCategoryDisplayName(category)}
          <Chip
            label={`${workingProposals.length} record${workingProposals.length !== 1 ? 's' : ''}`}
            size="small"
            sx={{
              ml: 1,
              backgroundColor: '#375e38',
              color: 'white',
              fontWeight: 500
            }}
          />
        </Typography>
        <TableContainer component={Paper} variant="outlined" sx={{
          boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
          borderRadius: 2,
          overflow: 'auto',
          maxHeight: '600px'
        }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell
                  sx={{
                    backgroundColor: '#375e38',
                    color: 'white',
                    fontWeight: 'bold',
                    width: '80px',
                    minWidth: '80px',
                    position: 'sticky',
                    left: 0,
                    zIndex: 1001
                  }}
                >
                  Actions
                </TableCell>
                {columns.map((column, index) => (
                  <TableCell
                    key={column.key}
                    sx={{
                      backgroundColor: '#375e38',
                      color: 'white',
                      fontWeight: 'bold',
                      width: column.width,
                      minWidth: column.width,
                      borderRight: index < columns.length - 1 ? '1px solid rgba(255,255,255,0.2)' : 'none'
                    }}
                  >
                    {column.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedProposals.length > 0 ? (
                paginatedProposals.map((proposal, index) => (
                  <TableRow
                    key={proposal._id || index}
                    sx={{
                      '&:hover': {
                        backgroundColor: 'rgba(55, 94, 56, 0.05)',
                      },
                      backgroundColor: index % 2 === 0 ? 'white' : '#fafafa',
                    }}
                  >
                    <TableCell
                      sx={{
                        position: 'sticky',
                        left: 0,
                        backgroundColor: index % 2 === 0 ? 'white' : '#fafafa',
                        zIndex: 1000,
                        borderRight: '1px solid #e0e0e0'
                      }}
                    >
                      {isPersonnelCategory ? (
                        <Tooltip title={`Show ${proposal.mergedCount || ''} personnel record(s)`}>
                          <span>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => handleOpenMergedPersonnelDetails(proposal)}
                              sx={{
                                minWidth: '60px',
                                fontSize: '0.75rem',
                                borderRadius: 1,
                                textTransform: 'none',
                                borderColor: '#375e38',
                                color: '#375e38',
                                fontWeight: 600,
                                '&:hover': {
                                  backgroundColor: '#375e38',
                                  color: 'white',
                                  borderColor: '#375e38'
                                }
                              }}
                            >
                              Details
                            </Button>
                          </span>
                        </Tooltip>
                      ) : (
                        <Tooltip title={'View proposal'}>
                          <span>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => handleViewProposal(proposal)}
                              sx={{
                                minWidth: '60px',
                                fontSize: '0.75rem',
                                borderRadius: 1,
                                textTransform: 'none',
                                borderColor: '#375e38',
                                color: '#375e38',
                                fontWeight: 600,
                                '&:hover': {
                                  backgroundColor: '#375e38',
                                  color: 'white',
                                  borderColor: '#375e38'
                                }
                              }}
                            >
                              View
                            </Button>
                          </span>
                        </Tooltip>
                      )}
                    </TableCell>
                    {columns.map((column) => (
                      <TableCell
                        key={column.key}
                        sx={{
                          fontSize: '0.875rem',
                          padding: '8px 12px',
                          maxWidth: column.width,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {renderCellValue(proposal, column)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length + 1} align="center" sx={{ py: 3 }}>
                    <Typography color="textSecondary">No records found</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Add pagination control */}
        {workingProposals.length > 0 && (
          <TablePagination
            component="div"
            count={workingProposals.length}
            page={paginationState[tableType].page}
            onPageChange={(event, newPage) => handleChangePage(tableType, newPage)}
            rowsPerPage={paginationState[tableType].rowsPerPage}
            onRowsPerPageChange={(event) => handleChangeRowsPerPage(tableType, event)}
            rowsPerPageOptions={[5, 10, 25, 50]}
            sx={{ mt: 1 }}
          />
        )}
      </Box>
    );
  };

  // Render empty state when no data is available
  const renderEmptyState = (message) => (
    <Paper
      elevation={2}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        p: 6,
        backgroundColor: '#fff',
        borderRadius: 3,
        my: 3,
        border: '2px dashed #e0e0e0'
      }}
    >
      <Typography variant="h6" color="textSecondary" gutterBottom sx={{ fontWeight: 500 }}>
        {message}
      </Typography>
      <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'center' }}>
        No records found for this category
      </Typography>
    </Paper>
  );

  if (loading && !data) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        <Button 
          variant="outlined" 
          startIcon={<RefreshIcon />} 
          onClick={handleRefresh}
        >
          Try Again
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      <Paper elevation={2} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Box sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2
        }}>
          <Typography variant="h4" gutterBottom sx={{
            fontWeight: 600,
            color: '#375e38',
            mb: 0
          }}>
            My Proposals
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Tooltip title="Refresh proposals">
              <span>
                <IconButton
                  onClick={handleRefresh}
                  disabled={loading}
                  sx={{
                    color: '#375e38',
                    '&:hover': { backgroundColor: 'rgba(55, 94, 56, 0.1)' }
                  }}
                >
                  {loading ? <CircularProgress size={24} sx={{ color: '#375e38' }} /> : <RefreshIcon />}
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>
        
        {!activeRegion && (
          <Alert 
            severity="info" 
            icon={<LocationIcon />}
            sx={{ mt: 2 }}
            action={
              <Button 
                color="inherit" 
                size="small" 
                onClick={() => navigate('/region-selection')}
              >
                Select Region
              </Button>
            }
          >
            No region selected. Select a region to filter proposals by region.
          </Alert>
        )}
      </Paper>

      <Paper elevation={1} sx={{ borderRadius: 2, overflow: 'hidden', mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          sx={{
            '& .MuiTab-root': {
              fontWeight: 600,
              textTransform: 'none',
              minWidth: 120,
              py: 2,
              color: '#666',
              '&:hover': {
                backgroundColor: 'rgba(55, 94, 56, 0.05)',
                color: '#375e38'
              }
            },
            '& .Mui-selected': {
              color: '#375e38',
              backgroundColor: 'rgba(55, 94, 56, 0.1)'
            },
            '& .MuiTabs-indicator': {
              backgroundColor: '#375e38',
              height: 3
            },
            backgroundColor: '#fff'
          }}
        >
          <Tab label="Submitted" />
          <Tab label="Draft" />
          <Tab label="Returned" />
          <Tab label="Approved" />
        </Tabs>
      </Paper>
      
      {activeTab === 0 && (
        <Box>
          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
            Submitted Proposals
          </Typography>
          
          {/* Personnel Proposals */}
          {data?.personnel && data.personnel.filter(p => p.status === "Submitted").length > 0 && (
            renderProposalsTable("Personnel", data.personnel.filter(p => p.status === "Submitted"), "personnel")
          )}
          
          {/* MOOE Proposals */}
          {data?.mooe && data.mooe.filter(p => p.status === "Submitted").length > 0 && (
            renderProposalsTable("MOOE", data.mooe.filter(p => p.status === "Submitted"), "mooe")
          )}
          
          {/* Capital Outlay Proposals */}
          {data?.capitalOutlay && data.capitalOutlay.filter(p => p.status === "Submitted").length > 0 && (
            renderProposalsTable("Capital Outlay", data.capitalOutlay.filter(p => p.status === "Submitted"), "capitalOutlay")
          )}
          
          {/* Income Proposals */}
          {data?.income && data.income.filter(p => p.status === "Submitted").length > 0 && (
            renderProposalsTable("Income", data.income.filter(p => p.status === "Submitted"), "income")
          )}
          
          {/* No submitted proposals message */}
          {(!data?.personnel || data.personnel.filter(p => p.status === "Submitted").length === 0) &&
           (!data?.mooe || data.mooe.filter(p => p.status === "Submitted").length === 0) &&
           (!data?.capitalOutlay || data.capitalOutlay.filter(p => p.status === "Submitted").length === 0) &&
           (!data?.income || data.income.filter(p => p.status === "Submitted").length === 0) && (
            renderEmptyState("No submitted proposals found")
          )}
        </Box>
      )}
      
      {activeTab === 1 && (
        <Box>
          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
            Draft Proposals {activeRegion ? `- ${activeRegion.name || activeRegion.regionName} Region` : ''}
          </Typography>
          
          {activeRegion && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Showing draft proposals for {activeRegion.name || activeRegion.regionName} region only. 
              Draft proposals from other regions are not visible.
            </Typography>
          )}
          
          {Object.entries(getAllProposalsByStatus("Draft")).map(([category, proposals]) => (
            <React.Fragment key={category}>
              {renderProposalsTable(category, proposals, "draft")}
            </React.Fragment>
          ))}
          
          {Object.keys(getAllProposalsByStatus("Draft")).length === 0 && (
            renderEmptyState("No draft proposals found")
          )}
        </Box>
      )}
      
      {activeTab === 2 && (
        <Box>
          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
            Returned Proposals
          </Typography>
          
          {Object.entries(getAllProposalsByStatus("Returned")).map(([category, proposals]) => (
            <React.Fragment key={category}>
              {renderProposalsTable(category, proposals, "returned")}
            </React.Fragment>
          ))}
          
          {Object.keys(getAllProposalsByStatus("Returned")).length === 0 && (
            renderEmptyState("No returned proposals found")
          )}
        </Box>
      )}
      
      {activeTab === 3 && (
        <Box>
          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
            Approved Proposals
          </Typography>
          
          {Object.entries(getAllProposalsByStatus("Approved")).map(([category, proposals]) => (
            <React.Fragment key={category}>
              {renderProposalsTable(category, proposals, "approved")}
            </React.Fragment>
          ))}
          
          {Object.keys(getAllProposalsByStatus("Approved")).length === 0 && (
            renderEmptyState("No approved proposals found")
          )}
        </Box>
      )}
      
      {/* Proposal View Modal */}
      <ProposalViewModal 
        open={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        proposal={selectedProposal}
        onRefresh={handleRefresh}
      />
    </Box>
  );
};

export default MyProposalPage;
