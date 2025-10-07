import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  Chip,
  Divider,
  Paper
} from '@mui/material';
import { getUserInfo } from '../../utils/auth';
import { getProposalForEdit, getComparisonData } from '../../services/budgetOfficerEditService';
import BudgetOfficerEditView from './BudgetOfficerEditView';
import BudgetAnalystComparisonView from './BudgetAnalystComparisonView';

const ProposalDetailsDialog = ({ open, onClose, proposal }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [proposalData, setProposalData] = useState(null);
  const [comparisonData, setComparisonData] = useState(null);

  // Determine user role
  // Budget Officer: Can edit proposals (DEPARTMENT level or has departmentConsolidator role)
  const isBudgetOfficer = 
    userInfo?.assignmentLevel === 'DEPARTMENT' || 
    userInfo?.assignmentLevel === 'OFFICE' ||
    userInfo?.assignmentLevel === 'REGION' ||
    userInfo?.assignmentLevel === 'FULL' ||
    userInfo?.workflowRoles?.includes('departmentConsolidator') ||
    userInfo?.workflowRoles?.includes('officeConsolidator') ||
    userInfo?.workflowRoles?.includes('regionFinalVerifier');
  
  // Budget Analyst: Can view comparisons (DIVISION level or has divisionCreator role)
  const isBudgetAnalyst = 
    userInfo?.assignmentLevel === 'DIVISION' || 
    userInfo?.workflowRoles?.includes('divisionCreator');

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const info = await getUserInfo();
        setUserInfo(info);
      } catch (error) {
        console.error('Failed to get user info:', error);
      }
    };
    fetchUserInfo();
  }, []);

  useEffect(() => {
    if (open && proposal && userInfo) {
      fetchProposalData();
    }
  }, [open, proposal, userInfo]);

  const fetchProposalData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (isBudgetOfficer) {
        // Budget Officer: Fetch all 4 tables for editing
        const response = await getProposalForEdit(proposal._id);
        console.log('Proposal data response:', response);
        // Extract the nested data object from the API response
        setProposalData(response.data || response);
      } else if (isBudgetAnalyst) {
        // Budget Analyst: Fetch comparison data
        const response = await getComparisonData(proposal._id);
        console.log('Comparison data response:', response);
        // Extract the nested data object from the API response
        setComparisonData(response.data || response);
      }
    } catch (err) {
      console.error('Error fetching proposal data:', err);
      setError(err.response?.data?.message || 'Failed to load proposal data');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleClose = () => {
    setActiveTab(0);
    setProposalData(null);
    setComparisonData(null);
    setError(null);
    onClose();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Approved': return 'success';
      case 'Office Approved': return 'info';
      case 'Submitted': return 'warning';
      case 'Returned': return 'error';
      case 'Draft': return 'default';
      default: return 'default';
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="xl" 
      fullWidth
      PaperProps={{
        sx: { height: '90vh' }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h5">Proposal Details</Typography>
          <Chip 
            label={proposal?.status || 'Unknown'} 
            color={getStatusColor(proposal?.status)} 
            sx={{ fontWeight: 'bold' }}
          />
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : (
          <>
            {/* Summary Section */}
            <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
              <Typography variant="h6" gutterBottom>Summary</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">Process By:</Typography>
                  <Typography variant="body1" fontWeight="medium">{proposal?.processBy}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">Region:</Typography>
                  <Typography variant="body1" fontWeight="medium">{proposal?.region}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">Fiscal Year:</Typography>
                  <Typography variant="body1" fontWeight="medium">{proposal?.fiscalYear}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">Budget Type:</Typography>
                  <Typography variant="body1" fontWeight="medium">{proposal?.budgetType}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">Expenditure Type:</Typography>
                  <Typography variant="body1" fontWeight="medium">{proposal?.cobExpenditures}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">Total Amount:</Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {formatCurrency(proposal?.totalExpenses || 0)}
                  </Typography>
                </Box>
              </Box>
            </Paper>

            <Divider sx={{ my: 2 }} />

            {/* Detailed Records Section */}
            <Typography variant="h6" gutterBottom>Detailed Records</Typography>

            {/* Debug info - remove after testing */}
            {process.env.NODE_ENV === 'development' && (
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="caption">
                  Debug: Role={userInfo?.role}, AssignmentLevel={userInfo?.assignmentLevel}, 
                  IsBudgetOfficer={isBudgetOfficer ? 'Yes' : 'No'}, 
                  IsBudgetAnalyst={isBudgetAnalyst ? 'Yes' : 'No'},
                  HasProposalData={proposalData ? 'Yes' : 'No'},
                  HasComparisonData={comparisonData ? 'Yes' : 'No'}
                </Typography>
              </Alert>
            )}

            {isBudgetOfficer && proposalData && (
              <BudgetOfficerEditView 
                proposalData={proposalData}
                proposal={proposal}
                onSaveSuccess={handleClose}
              />
            )}

            {isBudgetAnalyst && comparisonData && (
              <BudgetAnalystComparisonView 
                comparisonData={comparisonData}
                proposal={proposal}
              />
            )}

            {isBudgetOfficer && !proposalData && !loading && (
              <Alert severity="warning">
                No proposal data available. Please try refreshing.
              </Alert>
            )}

            {isBudgetAnalyst && !comparisonData && !loading && (
              <Alert severity="warning">
                No comparison data available. The proposal may not have been edited yet.
              </Alert>
            )}

            {!isBudgetOfficer && !isBudgetAnalyst && (
              <Alert severity="info">
                You do not have permission to view detailed records for this proposal.
                <br />
                <Typography variant="caption">
                  Your role: {userInfo?.role || 'Unknown'}, Assignment Level: {userInfo?.assignmentLevel || 'Unknown'}
                </Typography>
              </Alert>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} variant="outlined">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ProposalDetailsDialog;