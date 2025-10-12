
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Paper,
  Grid,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider
} from "@mui/material";
import {
  Close as CloseIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Close as CancelIcon,
  Add as AddIcon,
  LocationOn as LocationIcon
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useUser } from "../../context/UserContext";
import { useRegion } from "../../context/RegionContext";
import api from "../../config/api";
import formatCurrency from "../../utils/formatCurrency";
import { toast } from "react-toastify";

// Keep the component imports
import ProposalDetailEditableRow from './ProposalDetailEditableRow';
import ProposalDetailAddRow from './ProposalDetailAddRow';

const ProposalViewModal = ({ open, onClose, proposal, onRefresh }) => {
  const navigate = useNavigate();
  const { currentUser } = useUser();
  const { activeRegion } = useRegion();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fullProposal, setFullProposal] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Allow editing only for Draft or Returned statuses
  const isEditableStatus = (status) => status === 'Draft' || status === 'Returned';

  // Add a state for categories
  const [categories, setCategories] = useState([]);

  // Add this function to fetch detailed data based on expenditure type
  const fetchDetailedData = async (proposal) => {
    if (!proposal) {
      return proposal;
    }
    
    // If it's a draft, don't fetch detailed data
    if (proposal.status === "Draft") {
      return proposal;
    }
    
    // Determine expenditure type if not set
    const expenditureType = proposal.cobExpenditures || determineExpenditureType(proposal);
    if (!expenditureType) {
      return proposal;
    }
    
    setLoading(true);
    
    try {
      const params = {
        fiscalYear: proposal.fiscalYear,
        budgetType: proposal.budgetType,
        processBy: proposal.processBy,
        region: proposal.region || (activeRegion ? (activeRegion.name || activeRegion.regionName) : null),
        status: proposal.status
      };

      let endpoint = "";
      
      // Determine the correct endpoint based on expenditure type
      if (expenditureType.includes("Personnel")) {
        endpoint = "/personnel-services/getByParams";
      } else if (expenditureType === "MOOE") {
        endpoint = "/mooe/getByParams";
      } else if (expenditureType === "Capital Outlay") {
        endpoint = "/capital-outlay/getByParams";
      } else if (expenditureType === "Income") {
        endpoint = "/income/getByParams";
      } else {
        return {
          ...proposal,
          cobExpenditures: expenditureType,
          detailedData: [proposal] // Use the proposal itself as detailed data
        };
      }
      
      try {
        const response = await api.get(endpoint, { params });
        
        // If we got an empty array, create a single item from the proposal
        const detailedData = Array.isArray(response.data) && response.data.length === 0 
          ? [createDetailedItemFromProposal(proposal, expenditureType)]
          : response.data;
        
        // Update the proposal with detailed data
        return {
          ...proposal,
          cobExpenditures: expenditureType,
          detailedData: detailedData
        };
      } catch (error) {
        console.error(`Error fetching ${expenditureType} details:`, error);
        
        // Try alternative endpoints if the first one fails
        if (expenditureType.includes("Personnel")) {
          try {
            const altResponse = await api.get("/getpersonnels/byParams", { params });
            return {
              ...proposal,
              cobExpenditures: expenditureType,
              detailedData: altResponse.data
            };
          } catch (altError) {
            console.error("Alternative endpoint also failed:", altError);
          }
        }
        
        // If all attempts fail, create a single item from the proposal
        return {
          ...proposal,
          cobExpenditures: expenditureType,
          detailedData: [createDetailedItemFromProposal(proposal, expenditureType)]
        };
      }
    } catch (error) {
      console.error(`Error in fetchDetailedData:`, error);
      return {
        ...proposal,
        cobExpenditures: expenditureType,
        detailedData: [createDetailedItemFromProposal(proposal, expenditureType)]
      };
    } finally {
      setLoading(false);
    }
  };

  // Add this function to determine the expenditure type based on the proposal data
  const determineExpenditureType = (proposal) => {
    if (!proposal) return null;
    
    // If cobExpenditures is already set, use it
    if (proposal.cobExpenditures) return proposal.cobExpenditures;
    
    // Try to determine based on available fields
    if (proposal.particulars && proposal.cost) {
      return "Capital Outlay";
    } else if (proposal.uacsCode && proposal.amount) {
      return "MOOE";
    } else if (proposal.employeeFullName || proposal.positionTitle) {
      return "Personnel Services";
    } else if (proposal.source && proposal.amount) {
      return "Income";
    }
    
    // Check if we have any specific fields that indicate the type
    if (proposal.cost && (proposal.income !== undefined || proposal.subsidy !== undefined)) {
      return "Capital Outlay";
    }
    
    return null;
  };

  useEffect(() => {
    const fetchFullProposal = async () => {
      if (!open || !proposal) return;
      
      setLoading(true);
      setError(null);
      
      try {
        
        // For draft proposals, we may not need to fetch additional details
        if (proposal.status === "Draft") {
          const expenditureType = determineExpenditureType(proposal);
          const enhancedProposal = {
            ...proposal,
            cobExpenditures: expenditureType,
            detailedData: [createDetailedItemFromProposal(proposal, expenditureType)]
          };
          setFullProposal(enhancedProposal);
          setLoading(false);
          return;
        }
        
        // If we already have complete data, use it directly
        if (proposal.cobExpenditures) {
          const enhancedProposal = await fetchDetailedData(proposal);
          setFullProposal(enhancedProposal || proposal);
          setLoading(false);
          return;
        }
        
        // Ensure we have all required parameters
        if (!proposal.fiscalYear || !proposal.budgetType || 
            !proposal.processBy || !proposal.region) {
          console.warn("Missing required parameters for proposal details:", proposal);
          
          // Try to enhance the proposal with user information and region if missing
          const enhancedProposal = {
            ...proposal,
            processBy: proposal.processBy || 
                      (currentUser ? `${currentUser.FirstName} ${currentUser.LastName}` : "Unknown"),
            region: proposal.region || (activeRegion ? (activeRegion.name || activeRegion.regionName) : null)
          };
          
          // Determine expenditure type and create detailed data
          const expenditureType = determineExpenditureType(enhancedProposal);
          const finalProposal = {
            ...enhancedProposal,
            cobExpenditures: expenditureType,
            detailedData: [createDetailedItemFromProposal(enhancedProposal, expenditureType)]
          };
          
          setFullProposal(finalProposal);
          setLoading(false);
          return;
        }
        
        try {
          
          const response = await api.get(`/proposals/details`, {
            params: {
              fiscalYear: proposal.fiscalYear,
              budgetType: proposal.budgetType,
              processBy: proposal.processBy,
              region: proposal.region || (activeRegion ? (activeRegion.name || activeRegion.regionName) : null)
            }
          });

          // Fetch detailed data if we have an expenditure type
          if (response.data.cobExpenditures) {
            const enhancedProposal = await fetchDetailedData(response.data);
            setFullProposal(enhancedProposal || response.data);
          } else {
            setFullProposal(response.data);
          }
        } catch (mainError) {
          console.warn("Error fetching proposal details:", mainError.message);
          
          // For 404 errors (proposal not found), use the original data
          if (mainError.response?.status === 404) {
            
            // For draft proposals, this is expected behavior
            if (proposal.status === "Draft") {
              toast.info("This draft proposal is only saved locally");
            }
            
            setFullProposal(proposal);
          } else {
            // For other errors, try a fallback approach
            toast.warning("Could not load complete proposal details");
            setError("Unable to load complete details. Showing available information.");
            setFullProposal(proposal);
          }
        }
      } catch (err) {
        console.error("Unexpected error in proposal fetch process:", err);
        setError("Failed to load proposal details");
        
        // Create a fallback proposal with detailed data
        const expenditureType = determineExpenditureType(proposal);
        const fallbackProposal = {
          ...proposal,
          cobExpenditures: expenditureType,
          detailedData: [createDetailedItemFromProposal(proposal, expenditureType)]
        };
        
        setFullProposal(fallbackProposal);
      } finally {
        setLoading(false);
      }
    };
    
    fetchFullProposal();
  }, [open, proposal, currentUser]);

  // Add a debugging effect to log the fullProposal state
  useEffect(() => {
    if (fullProposal) {
      if (fullProposal.detailedData) {
      }
    }
  }, [fullProposal]);

  // Update the useEffect to set cobExpenditures if missing
  useEffect(() => {
    if (fullProposal && !fullProposal.cobExpenditures) {
      const expenditureType = determineExpenditureType(fullProposal);
      
      if (expenditureType) {
        setFullProposal(prev => ({
          ...prev,
          cobExpenditures: expenditureType
        }));
      }
    }
  }, [fullProposal]);

  // Add a function to fetch categories
  const fetchCategories = async () => {
    try {
      const response = await api.get('/categories');
      setCategories(response.data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  // Update useEffect to fetch categories
  useEffect(() => {
    if (open) {
      fetchCategories();
    }
  }, [open]);

  // Add a function to refresh data
  const refreshData = async () => {
    if (fullProposal && fullProposal._id) {
      try {
        const updatedProposal = await fetchDetailedData(fullProposal);
        setFullProposal(updatedProposal);
      } catch (error) {
        console.error('Error refreshing data:', error);
      }
    }
  };

  // Function to handle proposal deletion
  const handleDeleteProposal = async () => {
    if (!fullProposal || !fullProposal._id) {
      toast.error("Cannot delete: Missing proposal ID");
      return;
    }
    
    setDeleteLoading(true);
    
    try {
      // Different endpoint based on status
      const endpoint = fullProposal.status === "Draft" 
        ? `/proposals/draft/${fullProposal._id}`
        : `/proposals/${fullProposal._id}`;
      
      await api.delete(endpoint);
      
      toast.success(`${fullProposal.status} proposal deleted successfully`);
      onClose();
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error("Error deleting proposal:", error);
      toast.error(error.response?.data?.message || "Failed to delete proposal");
    } finally {
      setDeleteLoading(false);
      setConfirmDelete(false);
    }
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
    if (!proposal) return "N/A";
    
    const dateValue = proposal.updatedAt || proposal.lastEditedAt || 
                      proposal.submittedDate || proposal.createdAt ||
                      proposal.rejectedDate || proposal.approvedDate;
    
    if (!dateValue) return "N/A";
    
    try {
      return new Date(dateValue).toLocaleDateString();
    } catch (err) {
      console.warn("Invalid date format:", dateValue);
      return "Invalid date";
    }
  };

  // Render delete confirmation dialog
  const renderDeleteConfirmation = () => (
    <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)}>
      <DialogTitle>Confirm Deletion</DialogTitle>
      <DialogContent>
        <Typography>
          Are you sure you want to delete this {fullProposal?.status?.toLowerCase()} proposal? 
          This action cannot be undone.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setConfirmDelete(false)} disabled={deleteLoading}>
          Cancel
        </Button>
        <Button 
          onClick={handleDeleteProposal} 
          color="error" 
          disabled={deleteLoading}
          startIcon={deleteLoading ? <CircularProgress size={20} /> : null}
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
          }
        }}
      >
        <DialogTitle sx={{
          borderBottom: '2px solid #375e38',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pb: 2,
          backgroundColor: '#f8f9fa'
        }}>
          <Typography variant="h6" component="div" sx={{
            fontWeight: 600,
            color: '#375e38'
          }}>
            Proposal Details
            {fullProposal?.status && (
              <Chip
                label={fullProposal.status}
                size="small"
                color={getStatusColor(fullProposal.status)}
                sx={{
                  ml: 2,
                  fontWeight: 600,
                  borderRadius: 2
                }}
              />
            )}
          </Typography>
          <IconButton
            onClick={onClose}
            aria-label="close"
            sx={{
              color: '#375e38',
              '&:hover': { backgroundColor: 'rgba(55, 94, 56, 0.1)' }
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        
        <DialogContent sx={{ p: 3 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {error}
            </Alert>
          ) : fullProposal ? (
            <>
              {/* Display draft notice if applicable */}
              {fullProposal.status === "Draft" && (
                <Alert severity="info" sx={{ mb: 3 }}>
                  This is a draft proposal. Some details may not be available until the proposal is submitted.
                </Alert>
              )}
              
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                    <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                      Basic Information
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 2 }}>
                      <Box>
                        <Typography variant="body2" color="textSecondary">Fiscal Year</Typography>
                        <Typography variant="body1">{fullProposal.fiscalYear || 'N/A'}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" color="textSecondary">Budget Type</Typography>
                        <Typography variant="body1">{fullProposal.budgetType || 'N/A'}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" color="textSecondary">Region</Typography>
                        <Typography variant="body1">{fullProposal.region || 'N/A'}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" color="textSecondary">Created By</Typography>
                        <Typography variant="body1">{fullProposal.processBy || 'N/A'}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" color="textSecondary">Last Updated</Typography>
                        <Typography variant="body1">{getFormattedDate(fullProposal)}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" color="textSecondary">Status</Typography>
                        <Typography variant="body1">{fullProposal.status || 'N/A'}</Typography>
                      </Box>
                    </Box>
                  </Paper>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                    <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                      Summary
                    </Typography>
                    {fullProposal.totalAmount ? (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="body2" color="textSecondary">Total Amount</Typography>
                        <Typography variant="h6" color="primary">{formatCurrency(fullProposal.totalAmount)}</Typography>
                        
                        {/* Show breakdown if available */}
                        {fullProposal.breakdown && Object.keys(fullProposal.breakdown).length > 0 && (
                          <Box sx={{ mt: 2 }}>
                            <Typography variant="body2" color="textSecondary" gutterBottom>Breakdown</Typography>
                            {Object.entries(fullProposal.breakdown).map(([key, value]) => (
                              <Box key={key} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography variant="body2">{key}</Typography>
                                <Typography variant="body2" fontWeight={500}>{formatCurrency(value)}</Typography>
                              </Box>
                            ))}
                          </Box>
                        )}
                      </Box>
                    ) : (
                      <Box sx={{ mt: 2, color: 'text.secondary' }}>
                        <Typography variant="body2">
                          {fullProposal.status === "Draft" 
                            ? "Summary information will be available after submission" 
                            : "No summary information available"}
                        </Typography>
                      </Box>
                    )}
                  </Paper>
                </Grid>
                
                {/* Detailed Information section */}
                <Grid item xs={12}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                      Detailed Information
                    </Typography>
                    
                    {loading ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                        <CircularProgress size={24} />
                      </Box>
                    ) : fullProposal ? (
                      <>
                        {/* For Capital Outlay items without cobExpenditures */}
                        {!fullProposal.cobExpenditures && fullProposal.cost !== undefined && (
                          <>
                            <Typography variant="body2" color="textSecondary" gutterBottom>
                              Expenditure Type: <strong>Capital Outlay</strong>
                            </Typography>

                            <TableContainer component={Paper} variant="outlined" sx={{ mb: 3, mt: 2, boxShadow: 2 }}>
                              <Table size="small">
                                <TableHead>
                                  <TableRow sx={{ backgroundColor: '#375e38' }}>
                                    <TableCell sx={{ color: 'white', fontWeight: 'bold', borderRight: '1px solid white' }}><strong>Category</strong></TableCell>
                                    <TableCell sx={{ color: 'white', fontWeight: 'bold', borderRight: '1px solid white' }}><strong>Subline Item</strong></TableCell>
                                    <TableCell sx={{ color: 'white', fontWeight: 'bold', borderRight: '1px solid white' }}><strong>Accounting Title</strong></TableCell>
                                    <TableCell sx={{ color: 'white', fontWeight: 'bold', borderRight: '1px solid white' }}><strong>UACS Code</strong></TableCell>
                                    <TableCell sx={{ color: 'white', fontWeight: 'bold', borderRight: '1px solid white' }}><strong>Particulars</strong></TableCell>
                                    <TableCell sx={{ color: 'white', fontWeight: 'bold', borderRight: '1px solid white', textAlign: 'right' }}><strong>Income</strong></TableCell>
                                    <TableCell sx={{ color: 'white', fontWeight: 'bold', borderRight: '1px solid white', textAlign: 'right' }}><strong>Subsidy</strong></TableCell>
                                    <TableCell sx={{ color: 'white', fontWeight: 'bold', textAlign: 'right' }}><strong>Cost</strong></TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  <TableRow sx={{ '&:hover': { backgroundColor: '#f9f9f9' } }}>
                                    <TableCell>{fullProposal.category?.categoryName || fullProposal.category || 'N/A'}</TableCell>
                                    <TableCell>{fullProposal.sublineItem || 'N/A'}</TableCell>
                                    <TableCell>{fullProposal.accountingTitle || 'N/A'}</TableCell>
                                    <TableCell>{fullProposal.uacsCode || 'N/A'}</TableCell>
                                    <TableCell>{fullProposal.particulars || 'N/A'}</TableCell>
                                    <TableCell align="right">{formatCurrency(fullProposal.income || 0)}</TableCell>
                                    <TableCell align="right">{formatCurrency(fullProposal.subsidy || 0)}</TableCell>
                                    <TableCell align="right">{formatCurrency(fullProposal.cost)}</TableCell>
                                  </TableRow>
                                </TableBody>
                              </Table>
                            </TableContainer>
                          </>
                        )}
                        
                        {/* For MOOE items without cobExpenditures */}
                        {!fullProposal.cobExpenditures && fullProposal.uacsCode !== undefined && (
                          <>
                            <Typography variant="body2" color="textSecondary" gutterBottom>
                              Expenditure Type: <strong>MOOE</strong>
                            </Typography>

                            <TableContainer component={Paper} variant="outlined" sx={{ mb: 3, mt: 2, boxShadow: 2 }}>
                              <Table size="small">
                                <TableHead>
                                  <TableRow sx={{ backgroundColor: '#375e38' }}>
                                    <TableCell sx={{ color: 'white', fontWeight: 'bold', borderRight: '1px solid white' }}><strong>Subline Item</strong></TableCell>
                                    <TableCell sx={{ color: 'white', fontWeight: 'bold', borderRight: '1px solid white' }}><strong>Accounting Title</strong></TableCell>
                                    <TableCell sx={{ color: 'white', fontWeight: 'bold', borderRight: '1px solid white' }}><strong>UACS Code</strong></TableCell>
                                    <TableCell sx={{ color: 'white', fontWeight: 'bold', borderRight: '1px solid white', textAlign: 'right' }}><strong>Income</strong></TableCell>
                                    <TableCell sx={{ color: 'white', fontWeight: 'bold', borderRight: '1px solid white', textAlign: 'right' }}><strong>Subsidy</strong></TableCell>
                                    <TableCell sx={{ color: 'white', fontWeight: 'bold', textAlign: 'right' }}><strong>Amount</strong></TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  <TableRow sx={{ '&:hover': { backgroundColor: '#f9f9f9' } }}>
                                    <TableCell>{fullProposal.sublineItem || 'N/A'}</TableCell>
                                    <TableCell>{fullProposal.accountingTitle || fullProposal.description || 'N/A'}</TableCell>
                                    <TableCell>{fullProposal.uacsCode || 'N/A'}</TableCell>
                                    <TableCell align="right">{formatCurrency(fullProposal.income || 0)}</TableCell>
                                    <TableCell align="right">{formatCurrency(fullProposal.subsidy || 0)}</TableCell>
                                    <TableCell align="right">{formatCurrency(fullProposal.amount)}</TableCell>
                                  </TableRow>
                                </TableBody>
                              </Table>
                            </TableContainer>
                          </>
                        )}
                        
                        {/* For items with cobExpenditures */}
                        {fullProposal.cobExpenditures && (
                          <>
                            <Typography variant="body2" color="textSecondary" gutterBottom>
                              Expenditure Type: <strong>{fullProposal.cobExpenditures}</strong>
                            </Typography>
                            
                            {/* Personnel Services Details */}
                            {fullProposal.cobExpenditures.includes("Personnel") && (
                              <TableContainer component={Paper} variant="outlined" sx={{ mb: 3, mt: 2 }}>
                                <Table size="small">
                                  <TableHead>
                                    <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                                      <TableCell width="80px">Actions</TableCell>
                                      <TableCell><strong>Employee Name</strong></TableCell>
                                      <TableCell><strong>Position</strong></TableCell>
                                      <TableCell><strong>Status</strong></TableCell>
                                      <TableCell><strong>Monthly Salary</strong></TableCell>
                                      <TableCell><strong>Annual Salary</strong></TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {fullProposal.detailedData && fullProposal.detailedData.length > 0 ? (
                                      <>
                                        {fullProposal.detailedData.map((item, index) => (
                                          <ProposalDetailEditableRow
                                            key={item._id || index}
                                            row={item}
                                            expenditureType={fullProposal.cobExpenditures}
                                            refreshData={refreshData}
                                            disabled={fullProposal.status === "Approved" || fullProposal.status === "Rejected"}
                                          />
                                        ))}
                                        <ProposalDetailAddRow
                                          expenditureType={fullProposal.cobExpenditures}
                                          refreshData={refreshData}
                                          proposalId={fullProposal._id}
                                          disabled={fullProposal.status === "Approved" || fullProposal.status === "Rejected"}
                                        />
                                      </>
                                    ) : (
                                      <TableRow>
                                        <TableCell colSpan={6} align="center">
                                          No personnel services data available
                                        </TableCell>
                                      </TableRow>
                                    )}
                                  </TableBody>
                                </Table>
                              </TableContainer>
                            )}
                            
                            {/* MOOE Details */}
                            {fullProposal.cobExpenditures === "MOOE" && (
                              <TableContainer component={Paper} variant="outlined" sx={{ mb: 3, mt: 2, boxShadow: 2 }}>
                                <Table size="small">
                                  <TableHead>
                                    <TableRow sx={{ backgroundColor: '#375e38' }}>
                                      <TableCell width="60px" sx={{ color: 'white', fontWeight: 'bold', borderRight: '1px solid white' }}>Actions</TableCell>
                                      <TableCell sx={{ color: 'white', fontWeight: 'bold', borderRight: '1px solid white' }}><strong>Subline Item</strong></TableCell>
                                      <TableCell sx={{ color: 'white', fontWeight: 'bold', borderRight: '1px solid white' }}><strong>Accounting Title</strong></TableCell>
                                      <TableCell sx={{ color: 'white', fontWeight: 'bold', borderRight: '1px solid white' }}><strong>UACS Code</strong></TableCell>
                                      <TableCell sx={{ color: 'white', fontWeight: 'bold', borderRight: '1px solid white', textAlign: 'right' }}><strong>Income</strong></TableCell>
                                      <TableCell sx={{ color: 'white', fontWeight: 'bold', borderRight: '1px solid white', textAlign: 'right' }}><strong>Subsidy</strong></TableCell>
                                      <TableCell sx={{ color: 'white', fontWeight: 'bold', textAlign: 'right' }}><strong>Amount</strong></TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {fullProposal.detailedData && fullProposal.detailedData.length > 0 ? (
                                      <>
                                        {fullProposal.detailedData.map((item, index) => (
                                          <ProposalDetailEditableRow
                                            key={item._id || index}
                                            row={item}
                                            expenditureType={fullProposal.cobExpenditures}
                                            refreshData={refreshData}
                                            disabled={fullProposal.status === "Approved" || fullProposal.status === "Rejected"}
                                          />
                                        ))}
                                        <ProposalDetailAddRow
                                          expenditureType={fullProposal.cobExpenditures}
                                          refreshData={refreshData}
                                          proposalId={fullProposal._id}
                                          disabled={fullProposal.status === "Approved" || fullProposal.status === "Rejected"}
                                        />
                                      </>
                                    ) : (
                                      <TableRow>
                                        <TableCell colSpan={7} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                                          No MOOE data available
                                        </TableCell>
                                      </TableRow>
                                    )}
                                  </TableBody>
                                </Table>
                              </TableContainer>
                            )}
                            
                            {/* Capital Outlay Details */}
                            {fullProposal.cobExpenditures === "Capital Outlay" && (
                              <TableContainer component={Paper} variant="outlined" sx={{ mb: 3, mt: 2, boxShadow: 2 }}>
                                <Table size="small">
                                  <TableHead>
                                    <TableRow sx={{ backgroundColor: '#375e38' }}>
                                      <TableCell width="60px" sx={{ color: 'white', fontWeight: 'bold', borderRight: '1px solid white' }}>Actions</TableCell>
                                      <TableCell sx={{ color: 'white', fontWeight: 'bold', borderRight: '1px solid white' }}><strong>Category</strong></TableCell>
                                      <TableCell sx={{ color: 'white', fontWeight: 'bold', borderRight: '1px solid white' }}><strong>Subline Item</strong></TableCell>
                                      <TableCell sx={{ color: 'white', fontWeight: 'bold', borderRight: '1px solid white' }}><strong>Accounting Title</strong></TableCell>
                                      <TableCell sx={{ color: 'white', fontWeight: 'bold', borderRight: '1px solid white' }}><strong>UACS Code</strong></TableCell>
                                      <TableCell sx={{ color: 'white', fontWeight: 'bold', borderRight: '1px solid white' }}><strong>Particulars</strong></TableCell>
                                      <TableCell sx={{ color: 'white', fontWeight: 'bold', borderRight: '1px solid white', textAlign: 'right' }}><strong>Income</strong></TableCell>
                                      <TableCell sx={{ color: 'white', fontWeight: 'bold', borderRight: '1px solid white', textAlign: 'right' }}><strong>Subsidy</strong></TableCell>
                                      <TableCell sx={{ color: 'white', fontWeight: 'bold', textAlign: 'right' }}><strong>Cost</strong></TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {fullProposal.detailedData && fullProposal.detailedData.length > 0 ? (
                                      <>
                                        {fullProposal.detailedData.map((item, index) => (
                                          <ProposalDetailEditableRow
                                            key={item._id || index}
                                            row={item}
                                            expenditureType={fullProposal.cobExpenditures}
                                            refreshData={refreshData}
                                            categories={categories}
                                            disabled={fullProposal.status === "Approved" || fullProposal.status === "Rejected"}
                                          />
                                        ))}
                                        <ProposalDetailAddRow
                                          expenditureType={fullProposal.cobExpenditures}
                                          refreshData={refreshData}
                                          proposalId={fullProposal._id}
                                          categories={categories}
                                          disabled={fullProposal.status === "Approved" || fullProposal.status === "Rejected"}
                                        />
                                      </>
                                    ) : (
                                      <TableRow>
                                        <TableCell colSpan={9} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                                          No capital outlay data available
                                        </TableCell>
                                      </TableRow>
                                    )}
                                  </TableBody>
                                </Table>
                              </TableContainer>
                            )}
                            
                            {/* Income Details */}
                            {fullProposal.cobExpenditures === "Income" && (
                              <TableContainer component={Paper} variant="outlined" sx={{ mb: 3, mt: 2 }}>
                                <Table size="small">
                                  <TableHead>
                                    <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                                      <TableCell width="80px">Actions</TableCell>
                                      <TableCell><strong>Source</strong></TableCell>
                                      <TableCell><strong>Category</strong></TableCell>
                                      <TableCell><strong>Description</strong></TableCell>
                                      <TableCell><strong>Amount</strong></TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {fullProposal.detailedData && fullProposal.detailedData.length > 0 ? (
                                      <>
                                        {fullProposal.detailedData.map((item, index) => (
                                          <ProposalDetailEditableRow
                                            key={item._id || index}
                                            row={item}
                                            expenditureType={fullProposal.cobExpenditures}
                                            refreshData={refreshData}
                                            disabled={fullProposal.status === "Approved" || fullProposal.status === "Rejected"}
                                          />
                                        ))}
                                        <ProposalDetailAddRow
                                          expenditureType={fullProposal.cobExpenditures}
                                          refreshData={refreshData}
                                          proposalId={fullProposal._id}
                                          disabled={fullProposal.status === "Approved" || fullProposal.status === "Rejected"}
                                        />
                                      </>
                                    ) : (
                                      <TableRow>
                                        <TableCell colSpan={5} align="center">
                                          No income data available
                                        </TableCell>
                                      </TableRow>
                                    )}
                                  </TableBody>
                                </Table>
                              </TableContainer>
                            )}
                          </>
                        )}
                        
                        {/* If no specific expenditure type can be determined */}
                        {!fullProposal.cobExpenditures && 
                         fullProposal.cost === undefined && 
                         fullProposal.uacsCode === undefined && (
                          <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
                            <Typography variant="body2">
                              {fullProposal.status === "Draft" 
                                ? "Detailed information will be available after submission" 
                                : "No detailed information available"}
                            </Typography>
                            
                            {/* Show basic information we have */}
                            <Box sx={{ mt: 2, p: 2, border: '1px solid #eee', borderRadius: 1 }}>
                              <Grid container spacing={2}>
                                {Object.entries(fullProposal)
                                  .filter(([key, value]) => 
                                    typeof value !== 'object' && 
                                    key !== '_id' && 
                                    key !== '__v' && 
                                    value !== null && 
                                    value !== undefined)
                                  .map(([key, value]) => (
                                    <Grid item xs={6} md={4} key={key}>
                                      <Typography variant="body2" color="textSecondary">
                                        {key.charAt(0).toUpperCase() + key.slice(1)}:
                                      </Typography>
                                      <Typography variant="body2">
                                        {typeof value === 'number' ? formatCurrency(value) : value.toString()}
                                      </Typography>
                                    </Grid>
                                  ))}
                              </Grid>
                            </Box>
                          </Box>
                        )}
                      </>
                    ) : (
                      <Typography color="textSecondary">No proposal data available</Typography>
                    )}
                  </Paper>
                </Grid>
              </Grid>
            </>
          ) : (
            <Typography color="textSecondary">No proposal selected</Typography>
          )}
        </DialogContent>
        
        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #eee' }}>
          <Button onClick={onClose} color="inherit">
            Close
          </Button>
          {fullProposal?.status === "Draft" && (
            <Button 
              variant="contained" 
              color="primary"
              onClick={() => {
                onClose();
                navigate(`/proposals/edit/${fullProposal._id || 'draft'}`);
              }}
            >
              Edit Draft
            </Button>
          )}
          {fullProposal?.status === "Returned" && (
            <Button 
              variant="contained" 
              color="primary"
              onClick={() => {
                onClose();
                navigate(`/proposals/edit/${fullProposal._id}`);
              }}
            >
              Revise Proposal
            </Button>
          )}
        </DialogActions>
      </Dialog>
      {renderDeleteConfirmation()}
    </>
  );
};

export default ProposalViewModal;

// Helper function to create a detailed item from the proposal
const createDetailedItemFromProposal = (proposal, expenditureType) => {
  if (expenditureType.includes("Personnel")) {
    return {
      employeeFullName: proposal.employeeFullName || "N/A",
      positionTitle: proposal.positionTitle || "N/A",
      statusOfAppointment: proposal.statusOfAppointment || "N/A",
      monthlySalary: proposal.monthlySalary || proposal.amount || 0,
      annualSalary: proposal.annualSalary || (proposal.monthlySalary * 12) || proposal.amount || 0
    };
  } else if (expenditureType === "MOOE") {
    return {
      uacsCode: proposal.uacsCode || "N/A",
      description: proposal.description || proposal.accountingTitle || "N/A",
      amount: proposal.amount || 0,
      income: proposal.income || 0,
      subsidy: proposal.subsidy || 0
    };
  } else if (expenditureType === "Capital Outlay") {
    return {
      particulars: proposal.particulars || "N/A",
      category: proposal.category || "N/A",
      cost: proposal.cost || 0,
      income: proposal.income || 0,
      subsidy: proposal.subsidy || 0
    };
  } else if (expenditureType === "Income") {
    return {
      source: proposal.source || "N/A",
      category: proposal.category || "N/A",
      description: proposal.description || "N/A",
      amount: proposal.amount || 0
    };
  }
  
  // Default case
  return { ...proposal };
};

