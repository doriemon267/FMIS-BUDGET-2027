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
  Grid,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  Send as SendIcon,
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Refresh as RefreshIcon,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import api from "../config/api";
import { useUser } from "../context/UserContext";
import { useRegion } from "../context/RegionContext";
import { toast } from "react-toastify";

// Workflow constants based on the provided specification
const WORKFLOW_ROLES = {
  'BUDGET PREPARER': 'Preparer',
  'BUDGET REVIEWER': 'Reviewer',
  'BUDGET APPROVER': 'Approver',
  'BUDGET PLANNING ANALYST': 'Planning Analyst',
  'BUDGET OFFICER': 'Officer',
  'BUDGET MANAGER': 'Manager'
};

const WORKFLOW_STATUSES = {
  'Draft': { label: 'Draft', color: 'default' },
  'Forwarded to Reviewer': { label: 'Forwarded to Reviewer', color: 'primary' },
  'Forwarded to Approver': { label: 'Forwarded to Approver', color: 'primary' },
  'Forwarded to Budget Planning Analyst': { label: 'Forwarded to BRD Analyst', color: 'primary' },
  'Forwarded to Budget Officer': { label: 'Forwarded to BRD Officer', color: 'primary' },
  'Forwarded to Overall Budget Approver': { label: 'Forwarded to BRD Manager', color: 'primary' },
  'Finalized': { label: 'Finalized', color: 'success' },
  'Returned': { label: 'Returned', color: 'warning' }
};

const TABS = [
  { label: 'My Proposals', value: 'my-proposals' },
  { label: 'Pending Review', value: 'pending-review' },
  { label: 'All Proposals', value: 'all-proposals' }
];

const NewProposalWorkflowPage = () => {
  const navigate = useNavigate();
  const { currentUser } = useUser();
  const { activeRegion } = useRegion();

  // State management
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [proposals, setProposals] = useState([]);
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [actionType, setActionType] = useState('');
  const [actionComment, setActionComment] = useState('');
  const [newProposalData, setNewProposalData] = useState({
    title: '',
    description: '',
    modelType: 'Initial', // mooe, capital, income, personnel
    fiscalYear: new Date().getFullYear(),
    amount: 0
  });

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Determine user's workflow role
  const userWorkflowRole = currentUser?.hierarchicalAssignment?.userRole || 
                         (currentUser?.Roles?.includes('BUDGET PREPARER') ? 'BUDGET PREPARER' : null);

  const canCreate = userWorkflowRole === 'BUDGET PREPARER';

  const fetchProposals = useCallback(async () => {
    setLoading(true);
    try {
      const activeTabView = TABS[activeTab].value;
      const params = {
        region: activeRegion,
        view: activeTabView, // Pass the active tab's value to the API
      };
      const response = await api.get('/api/proposals', { params });
      setProposals(response.data.proposals || []);
    } catch (error) {
      console.error("Error fetching proposals:", error);
      toast.error("Failed to fetch proposals. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [activeRegion, activeTab]);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    setPage(0);
  };

  // Handle pagination
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Handle create proposal
  const handleCreateProposal = async () => {
    try {
      // Only send the fields that the user can edit
      const payload = {
        title: newProposalData.title,
        description: newProposalData.description,
        modelType: newProposalData.modelType,
        fiscalYear: newProposalData.fiscalYear,
        amount: newProposalData.amount,
      };

      // Use existing proposal API endpoint
      const response = await api.post('/api/proposals', payload);

      toast.success('Proposal created successfully');
      setCreateDialogOpen(false);
      setNewProposalData({
        title: '',
        description: '',
        modelType: 'Initial',
        fiscalYear: new Date().getFullYear(),
        amount: 0
      });
      fetchProposals();
    } catch (error) {
      console.error('Error creating proposal:', error);
      toast.error('Failed to create proposal');
    }
  };

  // Handle proposal actions
  const handleProposalAction = async () => {
    if (!selectedProposal || !actionType) return;

    try {
      // Map action types to existing proposal system actions
      const actionMapping = {
        'submit-to-reviewer': 'forward',
        'submit-to-approver': 'forward',
        'submit-to-analyst': 'forward',
        'forward-to-officer': 'forward',
        'forward-to-manager': 'forward',
        'finalize': 'approve',
        'return-to-preparer': 'return',
        'return-to-reviewer': 'return',
        'return-to-approver': 'return',
        'return-to-analyst': 'return',
        'return-to-officer': 'return'
      };

      const mappedAction = actionMapping[actionType] || actionType;

      // Use existing proposal API endpoint
      const response = await api.post(`/api/proposals/${selectedProposal._id}/action`, {
        action: mappedAction,
        comment: actionComment
      });

      toast.success('Action completed successfully');
      setActionDialogOpen(false);
      setSelectedProposal(null);
      setActionType('');
      setActionComment('');
      fetchProposals();
    } catch (error) {
      console.error('Error performing action:', error);
      toast.error('Failed to perform action');
    }
  };

  // Get available actions based on user role and proposal status
  const getAvailableActions = (proposal) => {
    const userRoles = currentUser?.Roles || [];
    const currentStatus = proposal.status;
    const actions = [];

    // BUDGET PREPARER actions
    if (userRoles.includes('BUDGET PREPARER') && proposal.createdBy === currentUser?.id) {
      if (currentStatus === 'Draft') {
        actions.push({ label: 'Submit to Budget Reviewer', value: 'submit-to-reviewer', icon: <SendIcon />, color: 'primary' });
      }
    }

    // BUDGET REVIEWER actions
    if (userRoles.includes('BUDGET REVIEWER') && currentStatus === 'Forwarded to Reviewer') {
      actions.push(
        { label: 'Submit to Budget Approver', value: 'submit-to-approver', icon: <SendIcon />, color: 'primary' },
        { label: 'Return to Budget Preparer', value: 'return-to-preparer', icon: <RejectIcon />, color: 'warning' }
      );
    }

    // BUDGET APPROVER actions
    if (userRoles.includes('BUDGET APPROVER') && currentStatus === 'Forwarded to Approver') {
      actions.push(
        { label: 'Submit to Budget Planning Analyst', value: 'submit-to-analyst', icon: <SendIcon />, color: 'primary' },
        { label: 'Return to Budget Reviewer', value: 'return-to-reviewer', icon: <RejectIcon />, color: 'warning' }
      );
    }

    // BUDGET PLANNING ANALYST actions
    if (userRoles.includes('BUDGET PLANNING ANALYST') && currentStatus === 'Forwarded to Budget Planning Analyst') {
      actions.push(
        { label: 'Forward to Budget Officer', value: 'forward-to-officer', icon: <SendIcon />, color: 'primary' },
        { label: 'Return to Budget Approver', value: 'return-to-approver', icon: <RejectIcon />, color: 'warning' }
      );
    }

    // BUDGET OFFICER actions
    if (userRoles.includes('BUDGET OFFICER') && currentStatus === 'Forwarded to Budget Officer') {
      actions.push(
        { label: 'Forward to Budget Manager', value: 'forward-to-manager', icon: <SendIcon />, color: 'primary' },
        { label: 'Return to Budget Planning Analyst', value: 'return-to-analyst', icon: <RejectIcon />, color: 'warning' }
      );
    }

    // BUDGET MANAGER actions
    if (userRoles.includes('BUDGET MANAGER') && currentStatus === 'Forwarded to Overall Budget Approver') {
      actions.push(
        { label: 'Finalize Proposal', value: 'finalize', icon: <ApproveIcon />, color: 'success' },
        { label: 'Return to Budget Officer', value: 'return-to-officer', icon: <RejectIcon />, color: 'warning' }
      );
    }

    return actions;
  };

  // Render proposal status chip
  const renderStatusChip = (status) => {
    const statusInfo = WORKFLOW_STATUSES[status] || { label: status, color: 'default' };
    return (
      <Chip
        label={statusInfo.label}
        color={statusInfo.color}
        size="small"
        variant="outlined"
      />
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          New Proposal Workflow
        </Typography>
      </Box>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          {TABS.map((tab, index) => (
            <Tab key={index} label={tab.label} />
          ))}
        </Tabs>
      </Paper>

      {/* Content */}
      <Paper sx={{ p: 3 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>RESPONSIBILITY CENTER</strong></TableCell>
                    <TableCell><strong>FISCAL YEAR</strong></TableCell>
                    <TableCell><strong>BUDGET TYPE</strong></TableCell>
                    <TableCell><strong>SUBMITTED DATE</strong></TableCell>
                    <TableCell align="right"><strong>PROJECTED INCOME</strong></TableCell>
                    <TableCell align="right"><strong>PROJECTED EXPENSES</strong></TableCell>
                    <TableCell align="right"><strong>PROPOSED BUDGET</strong></TableCell>
                    <TableCell><strong>STATUS</strong></TableCell>
                    <TableCell><strong>ACTIONS</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {proposals
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((proposal) => (
                      <TableRow key={proposal._id}>
                        <TableCell>
                          <Typography variant="body2" fontWeight="bold">
                            {proposal.responsibilityCenter || proposal.division || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell>{proposal.fiscalYear}</TableCell>
                        <TableCell>
                          <Chip
                            label={proposal.budgetType.toUpperCase()}
                            size="small"
                            color="secondary"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          {new Date(proposal.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell align="right">
                          ₱{(proposal.totalIncome || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell align="right">
                          ₱{(proposal.totalExpenses || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell align="right">
                          ₱{(proposal.proposedBudget || proposal.totalExpenses + proposal.totalIncome || proposal.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          {renderStatusChip(proposal.status)}
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Tooltip title="View Details">
                              <IconButton size="small">
                                <ViewIcon />
                              </IconButton>
                            </Tooltip>
                            {getAvailableActions(proposal).map((action) => (
                              <Tooltip key={action.value} title={action.label}>
                                <IconButton
                                  size="small"
                                  color={action.color}
                                  onClick={() => {
                                    setSelectedProposal(proposal);
                                    setActionType(action.value);
                                    setActionDialogOpen(true);
                                  }}
                                >
                                  {action.icon}
                                </IconButton>
                              </Tooltip>
                            ))}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={proposals.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
            />
          </>
        )}
      </Paper>

      {/* Create Proposal Dialog - REMOVED */
      /*
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth>
        ...
      </Dialog>
      */}

      {/* Action Dialog */}
      <Dialog open={actionDialogOpen} onClose={() => setActionDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Confirm Action</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Are you sure you want to perform this action on the proposal "{selectedProposal?.title}"?
          </Typography>
          <TextField
            fullWidth
            label="Comment (Optional)"
            value={actionComment}
            onChange={(e) => setActionComment(e.target.value)}
            multiline
            rows={3}
            placeholder="Add any comments or notes for this action..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActionDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleProposalAction} variant="contained" color="primary">
            Confirm Action
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default NewProposalWorkflowPage;