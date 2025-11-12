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
  Search as SearchIcon,
  FilterList as FilterIcon,
  GetApp as ExportIcon,
  MoreVert as MoreVertIcon,
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
  'DRAFT': { label: 'Draft', color: 'default' },
  'FORWARDED_TO_REVIEWER': { label: 'Forwarded to Reviewer', color: 'primary' },
  'FORWARDED_TO_APPROVER': { label: 'Forwarded to Approver', color: 'primary' },
  'FORWARDED_TO_BRD_ANALYST': { label: 'Forwarded to Analyst', color: 'primary' },
  'FORWARDED_TO_BRD_OFFICER': { label: 'Forwarded to Officer', color: 'primary' },
  'FORWARDED_TO_BRD_MANAGER': { label: 'Forwarded to Manager', color: 'primary' },
  'FINALIZED': { label: 'Finalized', color: 'success' },
  'RETURNED_TO_PREPARER': { label: 'Returned to Preparer', color: 'warning' },
  'RETURNED_TO_REVIEWER': { label: 'Returned to Reviewer', color: 'warning' },
  'RETURNED_TO_APPROVER': { label: 'Returned to Approver', color: 'warning' },
  'RETURNED_TO_PLANNING_ANALYST': { label: 'Returned to Analyst', color: 'warning' },
  'RETURNED_TO_OFFICER': { label: 'Returned to Officer', color: 'warning' }
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

  // Check if user is BRD (Budget Revenue Division) level or SUPER ADMIN
  const isBRDUser = currentUser?.Roles?.some(role => 
    ['BUDGET_PLANNING_ANALYST', 'BUDGET PLANNING ANALYST', 'BUDGET_OFFICER', 'BUDGET OFFICER', 'BUDGET_MANAGER', 'BUDGET MANAGER', 'SUPER_ADMIN', 'SUPER ADMIN'].includes(role)
  );

  // State management - BRD users start at "Pending Review" (index 1), others at "My Proposals" (index 0)
  const [activeTab, setActiveTab] = useState(isBRDUser ? 1 : 0);
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

  // Search and filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

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
      const response = await api.get('/api/new-proposal-workflow/proposals', { params });
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
      const response = await api.post('/api/new-proposal-workflow/proposals', payload);

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
      if (currentStatus === 'DRAFT' || currentStatus === 'RETURNED_TO_PREPARER') {
        actions.push({ label: 'Submit to Budget Reviewer', value: 'submit-to-reviewer', icon: <SendIcon />, color: 'primary' });
      }
    }

    // BUDGET REVIEWER actions
    if (userRoles.includes('BUDGET REVIEWER') && (currentStatus === 'FORWARDED_TO_REVIEWER' || currentStatus === 'RETURNED_TO_REVIEWER')) {
      actions.push(
        { label: 'Submit to Budget Approver', value: 'submit-to-approver', icon: <SendIcon />, color: 'primary' },
        { label: 'Return to Budget Preparer', value: 'return-to-preparer', icon: <RejectIcon />, color: 'warning' }
      );
    }

    // BUDGET APPROVER actions
    if (userRoles.includes('BUDGET APPROVER') && (currentStatus === 'FORWARDED_TO_APPROVER' || currentStatus === 'RETURNED_TO_APPROVER')) {
      actions.push(
        { label: 'Submit to Budget Planning Analyst', value: 'submit-to-analyst', icon: <SendIcon />, color: 'primary' },
        { label: 'Return to Budget Reviewer', value: 'return-to-reviewer', icon: <RejectIcon />, color: 'warning' }
      );
    }

    // BUDGET PLANNING ANALYST actions
    if (userRoles.includes('BUDGET PLANNING ANALYST') && (currentStatus === 'FORWARDED_TO_BRD_ANALYST' || currentStatus === 'RETURNED_TO_PLANNING_ANALYST')) {
      actions.push(
        { label: 'Forward to Budget Officer', value: 'forward-to-officer', icon: <SendIcon />, color: 'primary' },
        { label: 'Return to Budget Approver', value: 'return-to-approver', icon: <RejectIcon />, color: 'warning' }
      );
    }

    // BUDGET OFFICER actions
    if (userRoles.includes('BUDGET OFFICER') && (currentStatus === 'FORWARDED_TO_BRD_OFFICER' || currentStatus === 'RETURNED_TO_OFFICER')) {
      actions.push(
        { label: 'Forward to Budget Manager', value: 'forward-to-manager', icon: <SendIcon />, color: 'primary' },
        { label: 'Return to Budget Planning Analyst', value: 'return-to-analyst', icon: <RejectIcon />, color: 'warning' }
      );
    }

    // BUDGET MANAGER actions
    if (userRoles.includes('BUDGET MANAGER') && currentStatus === 'FORWARDED_TO_BRD_MANAGER') {
      actions.push(
        { label: 'Finalize Proposal', value: 'finalize', icon: <ApproveIcon />, color: 'success' },
        { label: 'Return to Budget Officer', value: 'return-to-officer', icon: <RejectIcon />, color: 'warning' }
      );
    }

    return actions;
  };

  // Filter and search proposals
  const filteredProposals = proposals.filter(proposal => {
    const matchesSearch = searchQuery === '' || 
      proposal.responsibilityCenter?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      proposal.division?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      proposal.budgetType?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      proposal.status?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = filterStatus === 'all' || proposal.status === filterStatus;
    
    return matchesSearch && matchesFilter;
  });

  // Render proposal status chip
  const renderStatusChip = (status) => {
    const statusColorMap = {
      'DRAFT': { bg: '#ffb74d', text: '#fff' },
      'FORWARDED_TO_REVIEWER': { bg: '#42a5f5', text: '#fff' },
      'FORWARDED_TO_APPROVER': { bg: '#42a5f5', text: '#fff' },
      'FORWARDED_TO_BRD_ANALYST': { bg: '#42a5f5', text: '#fff' },
      'FORWARDED_TO_BRD_OFFICER': { bg: '#42a5f5', text: '#fff' },
      'FORWARDED_TO_BRD_MANAGER': { bg: '#42a5f5', text: '#fff' },
      'FINALIZED': { bg: '#66bb6a', text: '#fff' },
      'RETURNED_TO_PREPARER': { bg: '#ef5350', text: '#fff' },
      'RETURNED_TO_REVIEWER': { bg: '#ef5350', text: '#fff' },
      'RETURNED_TO_APPROVER': { bg: '#ef5350', text: '#fff' },
      'RETURNED_TO_PLANNING_ANALYST': { bg: '#ef5350', text: '#fff' },
      'RETURNED_TO_OFFICER': { bg: '#ef5350', text: '#fff' }
    };
    
    const colors = statusColorMap[status] || { bg: '#999', text: '#fff' };
    const label = WORKFLOW_STATUSES[status]?.label || status;
    
    return (
      <Chip
        label={label}
        sx={{
          bgcolor: colors.bg,
          color: colors.text,
          fontWeight: 'bold',
          fontSize: '0.75rem',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}
        size="small"
      />
    );
  };

  return (
    <Box sx={{ p: 0, bgcolor: '#f5f5f5', minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ 
        bgcolor: 'linear-gradient(135deg, #2d5016 0%, #375e38 100%)',
        background: 'linear-gradient(135deg, #2d5016 0%, #375e38 100%)',
        color: 'white', 
        p: 3, 
        mb: 0,
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
      }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', mb: 0.5 }}>
              Proposal Workflow
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              Manage and track budget proposals through approval stages
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Refresh">
              <IconButton 
                onClick={fetchProposals}
                sx={{ 
                  color: 'white',
                  bgcolor: 'rgba(255,255,255,0.1)',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' }
                }}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Box>

      {/* Tabs and Table Container */}
      <Box sx={{ mx: 3, mt: 3, mb: 3 }}>
        {/* Tabs with green style - separated tabs like screenshot */}
        <Box sx={{ 
          display: 'flex', 
          gap: 1.5,
          mb: 3
        }}>
          {TABS.filter(tab => {
            // Hide "My Proposals" tab for BRD users (they don't create proposals)
            if (tab.value === 'my-proposals' && isBRDUser) return false;
            return true;
          }).map((tab, index) => (
            <Box
              key={index}
              onClick={() => handleTabChange(null, TABS.findIndex(t => t.value === tab.value))}
              sx={{
                px: 3,
                py: 1.5,
                bgcolor: activeTab === TABS.findIndex(t => t.value === tab.value) ? '#4a7c2c' : '#375e38',
                color: 'white',
                cursor: 'pointer',
                fontWeight: activeTab === TABS.findIndex(t => t.value === tab.value) ? 'bold' : 'normal',
                borderRadius: '8px',
                transition: 'all 0.3s ease',
                boxShadow: activeTab === TABS.findIndex(t => t.value === tab.value) ? '0 4px 8px rgba(0,0,0,0.2)' : '0 2px 4px rgba(0,0,0,0.1)',
                transform: activeTab === TABS.findIndex(t => t.value === tab.value) ? 'translateY(-2px)' : 'none',
                '&:hover': {
                  bgcolor: activeTab === TABS.findIndex(t => t.value === tab.value) ? '#4a7c2c' : '#4a7c2c',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
                }
              }}
            >
              <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>{tab.label}</Typography>
            </Box>
          ))}
        </Box>

        {/* Search and Filter Bar */}
        <Box sx={{ 
          mb: 2, 
          display: 'flex', 
          gap: 2, 
          alignItems: 'center',
          bgcolor: 'white',
          p: 2,
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.08)'
        }}>
          <TextField
            placeholder="Search by center, division, type, or status..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size="small"
            sx={{ 
              flex: 1,
              '& .MuiOutlinedInput-root': {
                '&:hover fieldset': {
                  borderColor: '#4a7c2c',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#4a7c2c',
                }
              }
            }}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: '#666' }} />
            }}
          />
          {isBRDUser && (
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Filter by Status</InputLabel>
              <Select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                label="Filter by Status"
                sx={{
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#4a7c2c',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#4a7c2c',
                  }
                }}
              >
                <MenuItem value="all">All Statuses</MenuItem>
                <MenuItem value="DRAFT">Draft</MenuItem>
                <MenuItem value="FORWARDED_TO_REVIEWER">Forwarded to Reviewer</MenuItem>
                <MenuItem value="FORWARDED_TO_APPROVER">Forwarded to Approver</MenuItem>
                <MenuItem value="FORWARDED_TO_BRD_ANALYST">Forwarded to Analyst</MenuItem>
                <MenuItem value="FORWARDED_TO_BRD_OFFICER">Forwarded to Officer</MenuItem>
                <MenuItem value="FORWARDED_TO_BRD_MANAGER">Forwarded to Manager</MenuItem>
                <MenuItem value="FINALIZED">Finalized</MenuItem>
                <MenuItem value="RETURNED_TO_PREPARER">Returned to Preparer</MenuItem>
                <MenuItem value="RETURNED_TO_REVIEWER">Returned to Reviewer</MenuItem>
                <MenuItem value="RETURNED_TO_APPROVER">Returned to Approver</MenuItem>
                <MenuItem value="RETURNED_TO_PLANNING_ANALYST">Returned to Analyst</MenuItem>
                <MenuItem value="RETURNED_TO_OFFICER">Returned to Officer</MenuItem>
              </Select>
            </FormControl>
          )}
          <Chip 
            label={`${filteredProposals.length} Results`}
            sx={{ 
              bgcolor: '#2d5016', 
              color: 'white',
              fontWeight: 'bold',
              fontSize: '0.85rem'
            }}
          />
        </Box>

        {/* Content */}
        <Paper sx={{ 
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          borderRadius: '12px',
          overflow: 'hidden'
        }}>
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 6 }}>
            <CircularProgress sx={{ color: '#2d5016', mb: 2 }} />
            <Typography variant="body2" color="text.secondary">Loading proposals...</Typography>
          </Box>
        ) : filteredProposals.length === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 6 }}>
            <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>No proposals found</Typography>
            <Typography variant="body2" color="text.secondary">
              {searchQuery || filterStatus !== 'all' ? 'Try adjusting your search or filters' : 'No proposals available'}
            </Typography>
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table sx={{ borderCollapse: 'collapse' }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#2d5016' }}>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold', p: 2.5, fontSize: '0.85rem', letterSpacing: '0.5px' }}>
                      RESPONSIBILITY CENTER
                    </TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold', p: 2.5, fontSize: '0.85rem', letterSpacing: '0.5px' }}>
                      FISCAL YEAR
                    </TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold', p: 2.5, fontSize: '0.85rem', letterSpacing: '0.5px' }}>
                      BUDGET TYPE
                    </TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold', p: 2.5, fontSize: '0.85rem', letterSpacing: '0.5px' }}>
                      DATE
                    </TableCell>
                    <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold', p: 2.5, fontSize: '0.85rem', letterSpacing: '0.5px' }}>
                      PROJECTED INCOME
                    </TableCell>
                    <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold', p: 2.5, fontSize: '0.85rem', letterSpacing: '0.5px' }}>
                      PROJECTED EXPENSES
                    </TableCell>
                    <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold', p: 2.5, fontSize: '0.85rem', letterSpacing: '0.5px' }}>
                      PROPOSED BUDGET
                    </TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold', p: 2.5, fontSize: '0.85rem', letterSpacing: '0.5px' }}>
                      STATUS
                    </TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold', p: 2.5, fontSize: '0.85rem', letterSpacing: '0.5px' }}>
                      ACTIONS
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredProposals
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((proposal, index) => (
                      <TableRow 
                        key={proposal._id}
                        sx={{
                          bgcolor: index % 2 === 0 ? '#fafafa' : '#fff',
                          borderBottom: '1px solid #e8e8e8',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            bgcolor: '#f0f7ed',
                            transform: 'scale(1.001)',
                            boxShadow: '0 2px 8px rgba(45,80,22,0.08)'
                          }
                        }}
                      >
                        <TableCell sx={{ p: 2.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#333' }}>
                            {proposal.responsibilityCenter || proposal.division || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ p: 2.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {proposal.fiscalYear}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ p: 2.5 }}>
                          <Chip
                            label={proposal.budgetType?.toUpperCase()}
                            size="small"
                            sx={{
                              bgcolor: '#012014ff',
                              color: 'white',
                              fontWeight: 'bold',
                              fontSize: '0.75rem',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ p: 2.5 }}>
                          <Typography variant="body2" sx={{ color: '#666' }}>
                            {new Date(proposal.createdAt).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </Typography>
                        </TableCell>
                        <TableCell align="right" sx={{ p: 2.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#1976d2' }}>
                            ₱{(proposal.totalIncome || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </Typography>
                        </TableCell>
                        <TableCell align="right" sx={{ p: 2.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#d32f2f' }}>
                            ₱{(proposal.totalExpenses || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </Typography>
                        </TableCell>
                        <TableCell align="right" sx={{ p: 2.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#2d5016', fontSize: '0.95rem' }}>
                            ₱{(proposal.proposedBudget || proposal.totalExpenses + proposal.totalIncome || proposal.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ p: 2.5 }}>
                          {renderStatusChip(proposal.status)}
                        </TableCell>
                        <TableCell sx={{ p: 2.5 }}>
                          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                            {getAvailableActions(proposal).length > 0 && (
                              <>
                                <Button
                                  size="small"
                                  variant="contained"
                                  endIcon={<MoreVertIcon sx={{ fontSize: '1rem' }} />}
                                  sx={{
                                    bgcolor: '#2d5016',
                                    color: 'white',
                                    textTransform: 'none',
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                    px: 2,
                                    py: 0.75,
                                    borderRadius: '6px',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                    transition: 'all 0.2s ease',
                                    '&:hover': {
                                      bgcolor: '#4a7c2c',
                                      boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
                                      transform: 'translateY(-1px)'
                                    }
                                  }}
                                  onClick={(e) => {
                                    setSelectedProposal(proposal);
                                    setAvailableActionsForMenu(getAvailableActions(proposal));
                                    setActionMenuAnchor(e.currentTarget);
                                  }}
                                >
                                  Actions
                                </Button>
                                <Menu
                                  anchorEl={actionMenuAnchor}
                                  open={Boolean(actionMenuAnchor) && selectedProposal?._id === proposal._id}
                                  onClose={() => setActionMenuAnchor(null)}
                                  PaperProps={{
                                    sx: {
                                      mt: 1,
                                      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                                      borderRadius: '8px',
                                      minWidth: 220
                                    }
                                  }}
                                >
                                  {availableActionsForMenu.map((action) => (
                                    <MenuItem
                                      key={action.value}
                                      onClick={() => {
                                        setActionType(action.value);
                                        setActionMenuAnchor(null);
                                        if (action.value === 'view-details') {
                                          console.log('Viewing details for:', proposal._id);
                                        } else {
                                          setActionDialogOpen(true);
                                        }
                                      }}
                                      sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1.5,
                                        py: 1.5,
                                        px: 2,
                                        color: action.value === 'view-details' ? '#2d5016' : 'inherit',
                                        fontWeight: action.value === 'view-details' ? 600 : 500,
                                        fontSize: '0.9rem',
                                        transition: 'all 0.2s ease',
                                        '&:hover': {
                                          bgcolor: action.color === 'warning' ? '#fff3e0' :
                                                   action.color === 'success' ? '#e8f5e9' :
                                                   '#f0f7ed',
                                          transform: 'translateX(4px)'
                                        }
                                      }}
                                    >
                                      <Box sx={{ 
                                        display: 'flex', 
                                        alignItems: 'center',
                                        color: action.color === 'primary' ? '#2d5016' : 
                                               action.color === 'warning' ? '#f57c00' :
                                               action.color === 'success' ? '#388e3c' :
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
              bgcolor: '#fafafa',
              borderTop: '1px solid #e8e8e8',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" sx={{ color: '#666', fontWeight: 500 }}>
                  Rows per page:
                </Typography>
                <Select
                  value={rowsPerPage}
                  onChange={handleChangeRowsPerPage}
                  size="small"
                  sx={{ 
                    ml: 1, 
                    minWidth: 70,
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#e0e0e0'
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#4a7c2c'
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#4a7c2c'
                    }
                  }}
                >
                  <MenuItem value={5}>5</MenuItem>
                  <MenuItem value={10}>10</MenuItem>
                  <MenuItem value={25}>25</MenuItem>
                  <MenuItem value={50}>50</MenuItem>
                </Select>
              </Box>
              
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <Typography variant="body2" sx={{ color: '#666', fontWeight: 500 }}>
                  {page * rowsPerPage + 1}-{Math.min((page + 1) * rowsPerPage, filteredProposals.length)} of {filteredProposals.length}
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <IconButton
                    size="small"
                    onClick={() => handleChangePage(null, page - 1)}
                    disabled={page === 0}
                    sx={{ 
                      color: '#2d5016',
                      bgcolor: 'white',
                      border: '1px solid #e0e0e0',
                      borderRadius: '6px',
                      '&:hover': {
                        bgcolor: '#f0f7ed',
                        borderColor: '#4a7c2c'
                      },
                      '&.Mui-disabled': {
                        bgcolor: '#f5f5f5',
                        color: '#ccc'
                      }
                    }}
                  >
                    <Typography sx={{ fontSize: '1.2rem', fontWeight: 'bold' }}>‹</Typography>
                  </IconButton>
                  <Box sx={{ 
                    px: 2, 
                    py: 0.5, 
                    bgcolor: '#2d5016', 
                    color: 'white',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    minWidth: 40,
                    justifyContent: 'center'
                  }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {page + 1}
                    </Typography>
                  </Box>
                  <IconButton
                    size="small"
                    onClick={() => handleChangePage(null, page + 1)}
                    disabled={(page + 1) * rowsPerPage >= filteredProposals.length}
                    sx={{ 
                      color: '#2d5016',
                      bgcolor: 'white',
                      border: '1px solid #e0e0e0',
                      borderRadius: '6px',
                      '&:hover': {
                        bgcolor: '#f0f7ed',
                        borderColor: '#4a7c2c'
                      },
                      '&.Mui-disabled': {
                        bgcolor: '#f5f5f5',
                        color: '#ccc'
                      }
                    }}
                  >
                    <Typography sx={{ fontSize: '1.2rem', fontWeight: 'bold' }}>›</Typography>
                  </IconButton>
                </Box>
              </Box>
            </Box>
          </>
        )}
        </Paper>
      </Box>

      {/* Action Dialog */}
      <Dialog 
        open={actionDialogOpen} 
        onClose={() => setActionDialogOpen(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
          }
        }}
      >
        <DialogTitle sx={{ 
          bgcolor: '#2d5016', 
          color: 'white',
          fontWeight: 'bold',
          fontSize: '1.25rem'
        }}>
          Confirm Action
        </DialogTitle>
        <DialogContent sx={{ mt: 3 }}>
          <Typography variant="body1" sx={{ mb: 3, color: '#333', lineHeight: 1.6 }}>
            Are you sure you want to perform this action on the proposal?
          </Typography>
          <TextField
            fullWidth
            label="Comment (Optional)"
            value={actionComment}
            onChange={(e) => setActionComment(e.target.value)}
            multiline
            rows={4}
            placeholder="Add any comments or notes for this action..."
            sx={{
              '& .MuiOutlinedInput-root': {
                '&:hover fieldset': {
                  borderColor: '#4a7c2c',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#4a7c2c',
                }
              },
              '& .MuiInputLabel-root.Mui-focused': {
                color: '#4a7c2c'
              }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button 
            onClick={() => setActionDialogOpen(false)}
            sx={{
              color: '#666',
              textTransform: 'none',
              fontWeight: 600,
              px: 3,
              '&:hover': {
                bgcolor: '#f5f5f5'
              }
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleProposalAction} 
            variant="contained"
            sx={{
              bgcolor: '#2d5016',
              color: 'white',
              textTransform: 'none',
              fontWeight: 600,
              px: 3,
              boxShadow: '0 2px 8px rgba(45,80,22,0.3)',
              '&:hover': {
                bgcolor: '#4a7c2c',
                boxShadow: '0 4px 12px rgba(45,80,22,0.4)'
              }
            }}
          >
            Confirm Action
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default NewProposalWorkflowPage;