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
  Menu,
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
  const [actionMenuAnchor, setActionMenuAnchor] = useState(null);
  const [availableActionsForMenu, setAvailableActionsForMenu] = useState([]);
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

    // VIEW DETAILS (always available)
    actions.push({ label: 'View Details', value: 'view-details', icon: <ViewIcon />, color: '#2d5016' });

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
    const statusColorMap = {
      'Draft': { bg: '#ffb74d', text: '#fff' },
      'Forwarded to Reviewer': { bg: '#42a5f5', text: '#fff' },
      'Forwarded to Approver': { bg: '#42a5f5', text: '#fff' },
      'Forwarded to Budget Planning Analyst': { bg: '#42a5f5', text: '#fff' },
      'Forwarded to Budget Officer': { bg: '#42a5f5', text: '#fff' },
      'Forwarded to Overall Budget Approver': { bg: '#42a5f5', text: '#fff' },
      'Finalized': { bg: '#66bb6a', text: '#fff' },
      'Returned': { bg: '#ef5350', text: '#fff' }
    };
    
    const colors = statusColorMap[status] || { bg: '#999', text: '#fff' };
    
    return (
      <Chip
        label={status}
        sx={{
          bgcolor: colors.bg,
          color: colors.text,
          fontWeight: 'bold',
          fontSize: '0.75rem'
        }}
        size="small"
      />
    );
  };

  return (
    <Box sx={{ p: 0, bgcolor: '#f5f5f5', minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ bgcolor: '#375e38', color: 'white', p: 3, mb: 0 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', mb: 0.5 }}>
          Proposal Workflow
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.9 }}>
          Process Budget Proposals
        </Typography>
      </Box>

      {/* Tabs and Table Container */}
      <Box sx={{ mx: 3, mt: 3, mb: 3 }}>
        {/* Tabs with green style */}
        <Box sx={{ 
          display: 'flex', 
          bgcolor: '#2d5016',
          gap: 1.5,
          px: 2,
          py: 1.5,
          borderRadius: '4px 4px 0 0'
        }}>
          {TABS.map((tab, index) => (
            <Box
              key={index}
              onClick={() => handleTabChange(null, index)}
              sx={{
                px: 3,
                py: 1.5,
                bgcolor: activeTab === index ? '#1a3d0b' : '#4a7c2c',
                color: 'white',
                cursor: 'pointer',
                fontWeight: activeTab === index ? 'bold' : 'normal',
                borderRadius: '4px',
                transition: 'all 0.3s ease',
                '&:hover': {
                  bgcolor: activeTab === index ? '#1a3d0b' : '#5a8c3c'
                }
              }}
            >
              <Typography variant="body1" sx={{ fontSize: '0.95rem' }}>{tab.label}</Typography>
            </Box>
          ))}
        </Box>

        {/* Content */}
        <Paper sx={{ 
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          mt: 0,
          borderRadius: '0 0 4px 4px'
        }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <TableContainer sx={{ p: 3 }}>
              <Table sx={{ borderCollapse: 'collapse' }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#2d5016' }}>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold', p: 2, borderBottom: '2px solid #fff' }}>
                      RESPONSIBILITY CENTER
                    </TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold', p: 2, borderBottom: '2px solid #fff' }}>
                      FISCAL YEAR
                    </TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold', p: 2, borderBottom: '2px solid #fff' }}>
                      BUDGET TYPE
                    </TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold', p: 2, borderBottom: '2px solid #fff' }}>
                      DATE
                    </TableCell>
                    <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold', p: 2, borderBottom: '2px solid #fff' }}>
                      PROJECTED INCOME
                    </TableCell>
                    <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold', p: 2, borderBottom: '2px solid #fff' }}>
                      PROJECTED EXPENSES
                    </TableCell>
                    <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold', p: 2, borderBottom: '2px solid #fff' }}>
                      PROPOSED BUDGET
                    </TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold', p: 2, borderBottom: '2px solid #fff' }}>
                      STATUS
                    </TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold', p: 2, borderBottom: '2px solid #fff' }}>
                      ACTIONS
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {proposals
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((proposal, index) => (
                      <TableRow 
                        key={proposal._id}
                        sx={{
                          bgcolor: index % 2 === 0 ? '#f9f9f9' : '#fff',
                          borderBottom: '1px solid #e0e0e0',
                          '&:hover': {
                            bgcolor: '#f0f4e8'
                          }
                        }}
                      >
                        <TableCell sx={{ p: 2 }}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {proposal.responsibilityCenter || proposal.division || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ p: 2 }}>{proposal.fiscalYear}</TableCell>
                        <TableCell sx={{ p: 2 }}>
                          <Chip
                            label={proposal.budgetType?.toUpperCase()}
                            size="small"
                            sx={{
                              bgcolor: '#012014ff',
                              color: 'white',
                              fontWeight: 'bold'
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ p: 2 }}>
                          {new Date(proposal.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit'
                          })}
                        </TableCell>
                        <TableCell align="right" sx={{ p: 2 }}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            ₱{(proposal.totalIncome || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </Typography>
                        </TableCell>
                        <TableCell align="right" sx={{ p: 2 }}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            ₱{(proposal.totalExpenses || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </Typography>
                        </TableCell>
                        <TableCell align="right" sx={{ p: 2 }}>
                          <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#2d5016' }}>
                            ₱{(proposal.proposedBudget || proposal.totalExpenses + proposal.totalIncome || proposal.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ p: 2 }}>
                          {renderStatusChip(proposal.status)}
                        </TableCell>
                        <TableCell sx={{ p: 2 }}>
                          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                            {getAvailableActions(proposal).length > 0 && (
                              <>
                                <Button
                                  size="small"
                                  variant="contained"
                                  sx={{
                                    bgcolor: '#035c28ff',
                                    color: 'white',
                                    textTransform: 'none',
                                    fontSize: '0.75rem',
                                    '&:hover': {
                                      bgcolor: '#06965fff'
                                    }
                                  }}
                                  onClick={(e) => {
                                    setSelectedProposal(proposal);
                                    setAvailableActionsForMenu(getAvailableActions(proposal));
                                    setActionMenuAnchor(e.currentTarget);
                                  }}
                                >
                                  ACTIONS ▼
                                </Button>
                                <Menu
                                  anchorEl={actionMenuAnchor}
                                  open={Boolean(actionMenuAnchor) && selectedProposal?._id === proposal._id}
                                  onClose={() => setActionMenuAnchor(null)}
                                >
                                  {availableActionsForMenu.map((action) => (
                                    <MenuItem
                                      key={action.value}
                                      onClick={() => {
                                        setActionType(action.value);
                                        setActionMenuAnchor(null);
                                        if (action.value === 'view-details') {
                                          // Handle view details - could navigate or open details dialog
                                          console.log('Viewing details for:', proposal._id);
                                        } else {
                                          setActionDialogOpen(true);
                                        }
                                      }}
                                      sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1,
                                        color: action.value === 'view-details' ? '#2d5016' : 'inherit',
                                        fontWeight: action.value === 'view-details' ? 'bold' : 'normal',
                                        '&:hover': {
                                          bgcolor: action.value === 'view-details' ? '#e8f5e9' : '#f5f5f5'
                                        }
                                      }}
                                    >
                                      <Box sx={{ 
                                        display: 'flex', 
                                        alignItems: 'center',
                                        color: action.color === 'primary' ? '#2d5016' : 
                                               action.color === 'warning' ? '#ff9800' :
                                               action.color === 'success' ? '#66bb6a' :
                                               '#2d5016'
                                      }}>
                                        {action.icon}
                                      </Box>
                                      {action.label}
                                    </MenuItem>
                                  ))}
                                </Menu>
                              </>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Box sx={{ 
              p: 3, 
              bgcolor: '#f9f9f9',
              borderTop: '1px solid #e0e0e0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <Typography variant="body2" sx={{ color: '#666' }}>
                Rows per page:
                <Select
                  value={rowsPerPage}
                  onChange={handleChangeRowsPerPage}
                  size="small"
                  sx={{ ml: 1, minWidth: 60 }}
                >
                  <MenuItem value={5}>5</MenuItem>
                  <MenuItem value={10}>10</MenuItem>
                  <MenuItem value={25}>25</MenuItem>
                </Select>
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Typography variant="body2" sx={{ color: '#666' }}>
                  {page * rowsPerPage + 1}-{Math.min((page + 1) * rowsPerPage, proposals.length)} of {proposals.length}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => handleChangePage(null, page - 1)}
                  disabled={page === 0}
                  sx={{ color: '#2d5016' }}
                >
                  <Typography sx={{ fontSize: '1.2rem' }}>‹</Typography>
                </IconButton>
                <Typography variant="body2" sx={{ color: '#666', minWidth: 30, textAlign: 'center' }}>
                  {page + 1}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => handleChangePage(null, page + 1)}
                  disabled={(page + 1) * rowsPerPage >= proposals.length}
                  sx={{ color: '#2d5016' }}
                >
                  <Typography sx={{ fontSize: '1.2rem' }}>›</Typography>
                </IconButton>
              </Box>
            </Box>
          </>
        )}
        </Paper>
      </Box>

      {/* Action Dialog */}
      <Dialog open={actionDialogOpen} onClose={() => setActionDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Confirm Action</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Are you sure you want to perform this action on the proposal {`"${selectedProposal?.title}"`}?
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