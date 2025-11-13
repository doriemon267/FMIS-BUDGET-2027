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
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from "@mui/icons-material";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  const [searchParams] = useSearchParams();

  // Check if user is BRD (Budget Revenue Division) level or SUPER ADMIN
  const isBRDUser = currentUser?.Roles?.some(role => 
    ['BUDGET_REVIEWER', 'BUDGET REVIEWER', 'BUDGET_APPROVER', 'BUDGET APPROVER', 'BUDGET_PLANNING_ANALYST', 'BUDGET PLANNING ANALYST', 'BUDGET_OFFICER', 'BUDGET OFFICER', 'BUDGET_MANAGER', 'BUDGET MANAGER', 'SUPER_ADMIN', 'SUPER ADMIN'].includes(role)
  );

  // Check if user is actual BRD staff (Planning Analyst, Officer, Manager) - only these should have status filter
  const isBRDStaff = currentUser?.Roles?.some(role => 
    ['BUDGET_PLANNING_ANALYST', 'BUDGET PLANNING ANALYST', 'BUDGET_OFFICER', 'BUDGET OFFICER', 'BUDGET_MANAGER', 'BUDGET MANAGER', 'SUPER_ADMIN', 'SUPER ADMIN'].includes(role)
  );

  // State management - BRD users start at "Pending Review" (index 1), others at "My Proposals" (index 0)
  const [activeTab, setActiveTab] = useState(isBRDUser ? 1 : 0);
  
  // Handle view parameter from query string (e.g., from notifications)
  useEffect(() => {
    const viewParam = searchParams.get('view');
    if (viewParam) {
      const tabIndex = TABS.findIndex(tab => tab.value === viewParam);
      if (tabIndex !== -1) {
        setActiveTab(tabIndex);
      }
    }
  }, [searchParams]);
  const [loading, setLoading] = useState(false);
  const [proposals, setProposals] = useState([]);
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDetailsDialogOpen, setViewDetailsDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [auditTrailDialogOpen, setAuditTrailDialogOpen] = useState(false);
  const [auditTrailData, setAuditTrailData] = useState([]);
  const [auditTrailLoading, setAuditTrailLoading] = useState(false);
  const [actionType, setActionType] = useState('');
  const [actionComment, setActionComment] = useState('');
  const [actionMenuAnchor, setActionMenuAnchor] = useState(null);
  const [availableActionsForMenu, setAvailableActionsForMenu] = useState([]);
  const [proposalDetails, setProposalDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsTab, setDetailsTab] = useState(0);
  const [historyPage, setHistoryPage] = useState(0);
  const [historyRowsPerPage, setHistoryRowsPerPage] = useState(20);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [personnelPage, setPersonnelPage] = useState(0);
  const [personnelRowsPerPage, setPersonnelRowsPerPage] = useState(10);
  const [expandedPersonnel, setExpandedPersonnel] = useState({});
  const [newProposalData, setNewProposalData] = useState({
    title: '',
    description: '',
    modelType: 'Initial', // mooe, capital, income, personnel
    fiscalYear: new Date().getFullYear(),
    amount: 0
  });
  
  // Edit mode and change tracking for reviewers - now for items
  const [editableItems, setEditableItems] = useState({
    income: [],
    personnel: [],
    mooe: [],
    capitalOutlay: []
  });
  const [changedItems, setChangedItems] = useState(new Set());

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

  // Check if user is a reviewer
  const isReviewer = currentUser?.Roles?.some(role => 
    ['BUDGET REVIEWER', 'BUDGET_REVIEWER', 'BUDGET APPROVER', 'BUDGET_APPROVER'].includes(role)
  );

  // Check if user can edit the current proposal based on their role and proposal status
  const canUserEdit = () => {
    if (!selectedProposal) return false;
    
    const userRoles = currentUser?.Roles || [];
    const status = selectedProposal.status;
    
    // Budget Reviewer can only edit when status is Forwarded to Reviewer or Returned to Reviewer
    if (userRoles.some(role => ['BUDGET REVIEWER', 'BUDGET_REVIEWER'].includes(role))) {
      return ['Forwarded to Reviewer', 'Returned to Reviewer'].includes(status);
    }
    
    // Budget Approver can only edit when status is Forwarded to Approver or Returned to Approver
    if (userRoles.some(role => ['BUDGET APPROVER', 'BUDGET_APPROVER'].includes(role))) {
      return ['Forwarded to Approver', 'Returned to Approver'].includes(status);
    }

    // Budget Planning Analyst can edit when status is Forwarded to Analyst or Returned to Analyst
    if (userRoles.some(role => ['BUDGET PLANNING ANALYST', 'BUDGET_PLANNING_ANALYST'].includes(role))) {
      return ['Forwarded to Budget Planning Analyst', 'Returned to Budget Planning Analyst', 'Returned'].includes(status);
    }

    // Budget Officer can edit when status is Forwarded to Officer or Returned to Officer
    if (userRoles.some(role => ['BUDGET OFFICER', 'BUDGET_OFFICER'].includes(role))) {
      return ['Forwarded to Budget Officer', 'Returned to Budget Officer', 'Returned'].includes(status);
    }

    // Budget Manager can edit when status is Forwarded to Manager or Returned to Manager
    if (userRoles.some(role => ['BUDGET MANAGER', 'BUDGET_MANAGER'].includes(role))) {
      return ['Forwarded to Overall Budget Approver', 'Returned'].includes(status);
    }
    
    return false;
  };

  // Handle view details
  const handleViewDetails = async (proposal) => {
    setDetailsLoading(true);
    setViewDetailsDialogOpen(true);
    setSelectedProposal(proposal);
    setDetailsTab(0);
    setChangedItems(new Set());
    
    try {
      const queryParams = {
        proposalId: proposal._id
      };

      const [incomeRes, personnelRes, mooeRes, capitalRes] = await Promise.all([
        api.get('/income/getByParams', { params: queryParams }),
        api.get('/api/personnel/getByParams', { params: queryParams }),
        api.get('/mooe/getByParams', { params: queryParams }),
        api.get('/capital-outlay/getByParams', { params: queryParams })
      ]);

      const details = {
        income: incomeRes.data || [],
        personnel: personnelRes.data || [],
        mooe: mooeRes.data || [],
        capitalOutlay: capitalRes.data || []
      };
      
      setProposalDetails(details);
      
      setEditableItems({
        income: JSON.parse(JSON.stringify(details.income)),
        personnel: JSON.parse(JSON.stringify(details.personnel)),
        mooe: JSON.parse(JSON.stringify(details.mooe)),
        capitalOutlay: JSON.parse(JSON.stringify(details.capitalOutlay))
      });
    } catch (error) {
      console.error('Error fetching proposal details:', error);
      toast.error('Failed to load proposal details');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleViewAuditTrail = async (proposal) => {
    setAuditTrailLoading(true);
    setSelectedProposal(proposal);
    
    try {
      const response = await api.get(`/api/new-proposal-workflow/proposals/${proposal._id}/audit-trail`);
      
      if (response.data.success) {
        const changes = response.data.data.changes || [];
        setAuditTrailData(changes);
        
        // Show toast notification if no changes found
        if (changes.length === 0) {
          toast.info('No changes recorded for this proposal yet');
        }
        
        setAuditTrailDialogOpen(true);
      } else {
        toast.error('Failed to fetch audit trail');
      }
    } catch (error) {
      console.error('Error fetching audit trail:', error);
      toast.error('Failed to load audit trail');
    } finally {
      setAuditTrailLoading(false);
    }
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
      // Use the action type directly - backend expects specific action names
      const response = await api.post(`/api/proposals/${selectedProposal._id}/action`, {
        action: actionType,
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

  // Handle item amount changes for reviewers
  const handleEditItemAmount = (category, index, newAmount) => {
    if (!isReviewer) return;
    
    setEditableItems(prev => {
      const updated = { ...prev };
      if (updated[category] && updated[category][index]) {
        if ('amount' in updated[category][index]) {
          updated[category][index].amount = newAmount;
        } else if ('Total' in updated[category][index]) {
          updated[category][index].Total = newAmount;
        } else if ('cost' in updated[category][index]) {
          updated[category][index].cost = newAmount;
        }
      }
      return updated;
    });
    
    // Track changed items
    const itemKey = `${category}-${index}`;
    const newChangedItems = new Set(changedItems);
    const originalItem = proposalDetails[category]?.[index];
    
    if (originalItem) {
      const originalAmount = originalItem.amount ?? originalItem.Total ?? originalItem.cost ?? 0;
      
      if (originalAmount !== newAmount) {
        newChangedItems.add(itemKey);
      } else {
        newChangedItems.delete(itemKey);
      }
    }
    setChangedItems(newChangedItems);
  };

  // Save proposal item changes
  const handleSaveChanges = async () => {
    try {
      if (changedItems.size === 0) {
        toast.info('No changes made');
        return;
      }
      
      const changedByCategory = {};
      changedItems.forEach(itemKey => {
        const [category, index] = itemKey.split('-');
        const idx = parseInt(index);
        if (!changedByCategory[category]) changedByCategory[category] = [];
        changedByCategory[category].push(editableItems[category][idx]);
      });
      
      const savePromises = [];
      if (changedByCategory.income) {
        savePromises.push(api.put('/income/bulk-update', { items: changedByCategory.income }));
      }
      if (changedByCategory.personnel) {
        savePromises.push(api.put('/api/personnel/bulk-update', { items: changedByCategory.personnel }));
      }
      if (changedByCategory.mooe) {
        savePromises.push(api.put('/mooe/bulk-update', { items: changedByCategory.mooe }));
      }
      if (changedByCategory.capitalOutlay) {
        savePromises.push(api.put('/capital-outlay/bulk-update', { items: changedByCategory.capitalOutlay }));
      }
      
      await Promise.all(savePromises);
      toast.success('Changes saved successfully');
      
      setProposalDetails(editableItems);
      setChangedItems(new Set());
    } catch (error) {
      console.error('Error saving changes:', error);
      toast.error('Failed to save changes');
    }
  };

  // Helper function to determine the role/position from action or status
  const getRoleFromAction = (entry) => {
    const action = entry.action || '';
    const newStatus = entry.newStatus || entry.toStatus || '';
    
    // Map based on action
    if (action.includes('SUBMIT_TO_REVIEWER') || action.includes('submit-to-reviewer')) return 'BUDGET PREPARER';
    if (action.includes('SUBMIT_TO_APPROVER') || action.includes('submit-to-approver')) return 'BUDGET REVIEWER';
    if (action.includes('SUBMIT_TO_ANALYST') || action.includes('submit-to-analyst')) return 'BUDGET APPROVER';
    if (action.includes('FORWARD_TO_OFFICER') || action.includes('forward-to-officer')) return 'BUDGET PLANNING ANALYST';
    if (action.includes('FORWARD_TO_MANAGER') || action.includes('forward-to-manager')) return 'BUDGET OFFICER';
    if (action.includes('FINALIZE') || action.includes('finalize')) return 'BUDGET MANAGER';
    if (action.includes('RETURN_TO')) return 'RETURN ACTION';
    
    // Map based on new status if action is not clear
    if (newStatus.includes('Reviewer')) return 'BUDGET PREPARER';
    if (newStatus.includes('Approver')) return 'BUDGET REVIEWER';
    if (newStatus.includes('Analyst') || newStatus.includes('Planning')) return 'BUDGET APPROVER';
    if (newStatus.includes('Officer')) return 'BUDGET PLANNING ANALYST';
    if (newStatus.includes('Manager')) return 'BUDGET OFFICER';
    if (newStatus.includes('Finalized')) return 'BUDGET MANAGER';
    
    return action || '-';
  };

  // Get available actions based on user role and proposal status
  const getAvailableActions = (proposal) => {
    const userRoles = currentUser?.Roles || [];
    const currentStatus = proposal.status;
    const actions = [];

    // VIEW DETAILS (always available)
    actions.push({ label: 'View Details', value: 'view-details', icon: <ViewIcon />, color: '#2d5016' });
    
    // VIEW HISTORY (always available)
    actions.push({ label: 'View History', value: 'view-history', icon: <ExpandMoreIcon />, color: '#1976d2' });

    // VIEW AUDIT TRAIL (always available)
    actions.push({ label: 'View Audit Trail', value: 'view-audit-trail', icon: <ExpandMoreIcon />, color: '#d97706' });

    // BUDGET PREPARER actions
    const userName = currentUser?.name || `${currentUser?.FirstName || ''} ${currentUser?.LastName || ''}`.trim();
    console.log('[DEBUG] User Roles:', userRoles);
    console.log('[DEBUG] Has BUDGET PREPARER role:', userRoles.includes('BUDGET PREPARER'));
    console.log('[DEBUG] Has BUDGET_PREPARER role:', userRoles.includes('BUDGET_PREPARER'));
    console.log('[DEBUG] Current User Name:', userName);
    console.log('[DEBUG] Proposal processBy:', proposal.processBy);
    console.log('[DEBUG] Proposal status:', currentStatus);
    console.log('[DEBUG] Match:', proposal.processBy === userName);
    
    if ((userRoles.includes('BUDGET PREPARER') || userRoles.includes('BUDGET_PREPARER')) && proposal.processBy === userName) {
      console.log('[DEBUG] Passed role and processBy check!');
      console.log('[DEBUG] Checking status:', currentStatus);
      if (currentStatus === 'DRAFT' || currentStatus === 'Draft' || currentStatus === 'Returned to Preparer') {
        console.log('[DEBUG] Adding Submit to Budget Reviewer action!');
        actions.push({ label: 'Submit to Budget Reviewer', value: 'submit-to-reviewer', icon: <SendIcon />, color: 'primary' });
      }
    }

    // BUDGET REVIEWER actions
    if (userRoles.includes('BUDGET REVIEWER') && (currentStatus === 'Forwarded to Reviewer' || currentStatus === 'Returned to Reviewer')) {
      actions.push(
        { label: 'Submit to Budget Approver', value: 'submit-to-approver', icon: <SendIcon />, color: 'primary' },
        { label: 'Return to Budget Preparer', value: 'return-to-preparer', icon: <RejectIcon />, color: 'warning' }
      );
    }

    // BUDGET APPROVER actions
    if (userRoles.includes('BUDGET APPROVER') && (currentStatus === 'Forwarded to Approver' || currentStatus === 'Returned to Approver')) {
      actions.push(
        { label: 'Submit to Budget Planning Analyst', value: 'submit-to-analyst', icon: <SendIcon />, color: 'primary' },
        { label: 'Return to Budget Reviewer', value: 'return-to-reviewer', icon: <RejectIcon />, color: 'warning' }
      );
    }

    // BUDGET PLANNING ANALYST actions
    if (userRoles.includes('BUDGET PLANNING ANALYST') && (currentStatus === 'Forwarded to Budget Planning Analyst' || currentStatus === 'Returned to Budget Planning Analyst' || currentStatus === 'Returned')) {
      actions.push(
        { label: 'Forward to Budget Officer', value: 'forward-to-officer', icon: <SendIcon />, color: 'primary' },
        { label: 'Return to Budget Approver', value: 'return-to-approver', icon: <RejectIcon />, color: 'warning' }
      );
    }

    // BUDGET OFFICER actions
    if (userRoles.includes('BUDGET OFFICER') && (currentStatus === 'Forwarded to Budget Officer' || currentStatus === 'Returned to Budget Officer' || currentStatus === 'Returned')) {
      actions.push(
        { label: 'Forward to Budget Manager', value: 'forward-to-manager', icon: <SendIcon />, color: 'primary' },
        { label: 'Return to Budget Planning Analyst', value: 'return-to-analyst', icon: <RejectIcon />, color: 'warning' }
      );
    }

    // BUDGET MANAGER actions
    if (userRoles.includes('BUDGET MANAGER') && (currentStatus === 'Forwarded to Overall Budget Approver' || currentStatus === 'Returned')) {
      actions.push(
        { label: 'Finalize Proposal', value: 'finalize', icon: <ApproveIcon />, color: 'success' },
        { label: 'Return to Budget Officer', value: 'return-to-officer', icon: <RejectIcon />, color: 'warning' }
      );
    }

    return actions;
  };

  // Filter and search proposals
  const statusEnumToDbMap = {
    'DRAFT': 'Draft',
    'FORWARDED_TO_REVIEWER': 'Forwarded to Reviewer',
    'FORWARDED_TO_APPROVER': 'Forwarded to Approver',
    'FORWARDED_TO_BRD_ANALYST': 'Forwarded to Budget Planning Analyst',
    'FORWARDED_TO_BRD_OFFICER': 'Forwarded to Budget Officer',
    'FORWARDED_TO_BRD_MANAGER': 'Forwarded to Overall Budget Approver',
    'FINALIZED': 'Finalized',
    'RETURNED_TO_PREPARER': 'Returned to Preparer',
    'RETURNED_TO_REVIEWER': 'Returned to Reviewer',
    'RETURNED_TO_APPROVER': 'Returned to Approver',
    'RETURNED_TO_PLANNING_ANALYST': 'Returned to Budget Planning Analyst',
    'RETURNED_TO_BRD_OFFICER': 'Returned to Budget Officer',
    'RETURNED': 'Returned'
  };

  const filteredProposals = proposals.filter(proposal => {
    const matchesSearch = searchQuery === '' || 
      proposal.responsibilityCenter?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      proposal.division?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      proposal.budgetType?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      proposal.status?.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Map the filter enum to actual database status
    const filterDbStatus = statusEnumToDbMap[filterStatus];
    const matchesFilter = filterStatus === 'all' || proposal.status === filterDbStatus;
    
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
                bgcolor: activeTab === TABS.findIndex(t => t.value === tab.value) ? '#4C6F4D' : '#375e38',
                color: 'white',
                cursor: 'pointer',
                fontWeight: activeTab === TABS.findIndex(t => t.value === tab.value) ? 'bold' : 'normal',
                borderRadius: '8px',
                transition: 'all 0.3s ease',
                boxShadow: activeTab === TABS.findIndex(t => t.value === tab.value) ? '0 4px 8px rgba(0,0,0,0.2)' : '0 2px 4px rgba(0,0,0,0.1)',
                transform: activeTab === TABS.findIndex(t => t.value === tab.value) ? 'translateY(-2px)' : 'none',
                '&:hover': {
                  bgcolor: activeTab === TABS.findIndex(t => t.value === tab.value) ? '#4C6F4D' : '#4a7c2c',
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
          {isBRDStaff && (
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
                <MenuItem value="FORWARDED_TO_BRD_ANALYST">Forwarded to Budget Planning Analyst</MenuItem>
                <MenuItem value="FORWARDED_TO_BRD_OFFICER">Forwarded to Budget Officer</MenuItem>
                <MenuItem value="FORWARDED_TO_BRD_MANAGER">Forwarded to Overall Budget Approver</MenuItem>
                <MenuItem value="FINALIZED">Finalized</MenuItem>
                <MenuItem value="RETURNED_TO_PREPARER">Returned to Preparer</MenuItem>
                <MenuItem value="RETURNED_TO_REVIEWER">Returned to Reviewer</MenuItem>
                <MenuItem value="RETURNED_TO_APPROVER">Returned to Approver</MenuItem>
                <MenuItem value="RETURNED_TO_PLANNING_ANALYST">Returned to Budget Planning Analyst</MenuItem>
                <MenuItem value="RETURNED_TO_OFFICER">Returned to Budget Officer</MenuItem>
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
                                      onClick={async () => {
                                        setActionType(action.value);
                                        setActionMenuAnchor(null);
                                        if (action.value === 'view-details') {
                                          await handleViewDetails(proposal);
                                        } else if (action.value === 'view-history') {
                                          setSelectedProposal(proposal);
                                          setHistoryPage(0);
                                          setHistoryDialogOpen(true);
                                        } else if (action.value === 'view-audit-trail') {
                                          await handleViewAuditTrail(proposal);
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

      {/* View Details Dialog */}
      <Dialog
        open={viewDetailsDialogOpen}
        onClose={() => {
          if (changedItems.size > 0) {
            const confirm = window.confirm('You have unsaved changes. Close anyway?');
            if (!confirm) return;
          }
          setViewDetailsDialogOpen(false);
          setChangedItems(new Set());
        }}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
          }
        }}
      >
        <DialogTitle sx={{ 
          bgcolor: 'linear-gradient(135deg, #2d5016 0%, #375e38 100%)',
          background: 'linear-gradient(135deg, #2d5016 0%, #375e38 100%)',
          color: 'white',
          fontWeight: 'bold',
          fontSize: '1.25rem',
          p: 3
        }}>
          Proposal Details
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {detailsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 6 }}>
              <CircularProgress sx={{ color: '#2d5016' }} />
            </Box>
          ) : (
            <>
              {/* Proposal Summary */}
              <Box sx={{ p: 3, bgcolor: '#f5f5f5', borderBottom: '1px solid #e0e0e0' }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Responsibility Center</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedProposal?.responsibilityCenter || selectedProposal?.division || 'N/A'}</Typography>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Fiscal Year</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedProposal?.fiscalYear}</Typography>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Budget Type</Typography>
                    <Chip 
                      label={selectedProposal?.budgetType?.toUpperCase()} 
                      size="small"
                      sx={{ bgcolor: '#012014ff', color: 'white', fontWeight: 'bold' }}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Projected Income</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600, color: '#1976d2' }}>
                      ₱{(selectedProposal?.totalIncome || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Projected Expenses</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600, color: '#d32f2f' }}>
                      ₱{(selectedProposal?.totalExpenses || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Proposed Budget</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 'bold', color: '#2d5016', fontSize: '1.1rem' }}>
                      ₱{(selectedProposal?.proposedBudget || selectedProposal?.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Status</Typography>
                    {renderStatusChip(selectedProposal?.status)}
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Created Date</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {selectedProposal?.createdAt ? new Date(selectedProposal.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      }) : 'N/A'}
                    </Typography>
                  </Grid>
                </Grid>
                
                {/* Save button for reviewers if changes made */}
                {canUserEdit() && changedItems.size > 0 && (
                  <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #e0e0e0', display: 'flex', gap: 2 }}>
                    <Button
                      variant="contained"
                      sx={{ bgcolor: '#2d5016', '&:hover': { bgcolor: '#1e3a0f' } }}
                      onClick={handleSaveChanges}
                    >
                      Save Changes ({changedItems.size})
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => {
                        setEditableItems({
                          income: JSON.parse(JSON.stringify(proposalDetails.income || [])),
                          personnel: JSON.parse(JSON.stringify(proposalDetails.personnel || [])),
                          mooe: JSON.parse(JSON.stringify(proposalDetails.mooe || [])),
                          capitalOutlay: JSON.parse(JSON.stringify(proposalDetails.capitalOutlay || []))
                        });
                        setChangedItems(new Set());
                      }}
                    >
                      Cancel
                    </Button>
                  </Box>
                )}
              </Box>

              {/* Tabs for different sections */}
              <Tabs 
                value={detailsTab} 
                onChange={(e, newValue) => setDetailsTab(newValue)}
                sx={{
                  borderBottom: '1px solid #e0e0e0',
                  bgcolor: 'white',
                  '& .MuiTab-root': {
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '0.95rem',
                    minWidth: 120,
                    '&.Mui-selected': {
                      color: '#2d5016'
                    }
                  },
                  '& .MuiTabs-indicator': {
                    bgcolor: '#2d5016',
                    height: 3
                  }
                }}
              >
                <Tab label="Income" />
                <Tab label="Personnel Services" />
                <Tab label="MOOE" />
                <Tab label="Capital Outlay" />
              </Tabs>

              {/* Tab Content */}
              <Box sx={{ p: 3, minHeight: 300, maxHeight: 500, overflow: 'auto' }}>
                {/* Income Tab */}
                {detailsTab === 0 && (
                  proposalDetails?.income?.length > 0 ? (
                    <>
                      {(() => {
                        const groupedIncome = proposalDetails.income.reduce((acc, item) => {
                          const category = item.category || 'Uncategorized';
                          if (!acc[category]) acc[category] = [];
                          acc[category].push(item);
                          return acc;
                        }, {});

                        return Object.entries(groupedIncome).map(([category, items]) => {
                          const categoryTotal = items.reduce((sum, item) => sum + (item.amount || 0), 0);
                          const isExpanded = expandedGroups[`income-${category}`];

                          return (
                            <Box key={category} sx={{ mb: 2 }}>
                              <Box
                                onClick={() => setExpandedGroups(prev => ({ ...prev, [`income-${category}`]: !prev[`income-${category}`] }))}
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  p: 2,
                                  bgcolor: '#2d5016',
                                  color: 'white',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  '&:hover': { bgcolor: '#3d6026' }
                                }}
                              >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                    {category} ({items.length} {items.length === 1 ? 'item' : 'items'})
                                  </Typography>
                                </Box>
                                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                  ₱{categoryTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </Typography>
                              </Box>

                              {isExpanded && (
                                <TableContainer sx={{ mt: 1 }}>
                                  <Table size="small">
                                    <TableHead>
                                      <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                                        <TableCell sx={{ fontWeight: 'bold' }}>Subcategory</TableCell>
                                        <TableCell sx={{ fontWeight: 'bold' }}>Particulars</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Amount</TableCell>
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      {items.map((item, idx) => {
                                        const globalIndex = proposalDetails.income.indexOf(item);
                                        const itemKey = `income-${globalIndex}`;
                                        const isChanged = changedItems.has(itemKey);
                                        const editedItem = editableItems.income[globalIndex];
                                        return (
                                          <TableRow key={idx} hover sx={{ 
                                            bgcolor: isChanged ? '#fff3cd' : 'transparent',
                                            transition: 'background-color 0.3s ease'
                                          }}>
                                            <TableCell>{item.subcategory || 'N/A'}</TableCell>
                                            <TableCell>{item.particulars || 'N/A'}</TableCell>
                                            <TableCell align="right">
                                              {canUserEdit() ? (
                                                <TextField
                                                  type="text"
                                                  size="small"
                                                  value={(editedItem?.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                  onChange={(e) => {
                                                    const numValue = parseFloat(e.target.value.replace(/,/g, ''));
                                                    if (!isNaN(numValue)) {
                                                      handleEditItemAmount('income', globalIndex, numValue);
                                                    }
                                                  }}
                                                  inputProps={{ style: { textAlign: 'right' } }}
                                                  sx={{ 
                                                    width: 120,
                                                    '& .MuiOutlinedInput-root': {
                                                      bgcolor: isChanged ? '#fff9e6' : 'white',
                                                      borderColor: isChanged ? '#ffc107' : undefined
                                                    }
                                                  }}
                                                />
                                              ) : (
                                                `₱${(item.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                                              )}
                                            </TableCell>
                                          </TableRow>
                                        );
                                      })}
                                    </TableBody>
                                  </Table>
                                </TableContainer>
                              )}
                            </Box>
                          );
                        });
                      })()}
                      <Box sx={{ mt: 3, p: 2, bgcolor: '#f5f5f5', borderRadius: '8px' }}>
                        <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1976d2' }}>
                          Grand Total: ₱{editableItems.income.reduce((sum, item) => sum + (item.amount || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </Typography>
                      </Box>
                    </>
                  ) : (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Typography variant="body2" color="text.secondary">No income data available</Typography>
                    </Box>
                  )
                )}

                {/* Personnel Services Tab */}
                {detailsTab === 1 && (
                  proposalDetails?.personnel?.length > 0 ? (
                    <>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                              <TableCell sx={{ width: 50 }}></TableCell>
                              <TableCell sx={{ fontWeight: 'bold' }}>Employee Name</TableCell>
                              <TableCell sx={{ fontWeight: 'bold' }}>Position</TableCell>
                              <TableCell sx={{ fontWeight: 'bold' }}>SG/Step</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>Monthly Salary</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>Total</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {proposalDetails.personnel
                              .slice(personnelPage * personnelRowsPerPage, personnelPage * personnelRowsPerPage + personnelRowsPerPage)
                              .map((item, index) => {
                                const globalIndex = personnelPage * personnelRowsPerPage + index;
                                const itemKey = `personnel-${globalIndex}`;
                                const isChanged = changedItems.has(itemKey);
                                const editedItem = editableItems.personnel[globalIndex];
                                const isExpanded = expandedPersonnel[index];
                                return (
                                  <React.Fragment key={index}>
                                    <TableRow hover sx={{ 
                                      cursor: 'pointer',
                                      bgcolor: isChanged ? '#fff3cd' : 'transparent',
                                      transition: 'background-color 0.3s ease'
                                    }}>
                                      <TableCell>
                                        <IconButton
                                          size="small"
                                          onClick={() => setExpandedPersonnel(prev => ({ ...prev, [index]: !prev[index] }))}
                                        >
                                          {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                        </IconButton>
                                      </TableCell>
                                      <TableCell>{item.employeeFullName || 'N/A'}</TableCell>
                                      <TableCell>{item.positionTitle || 'N/A'}</TableCell>
                                      <TableCell>{item.gradelevel_SG || 'N/A'}/{item.step || 'N/A'}</TableCell>
                                      <TableCell align="right">
                                        ₱{(item.monthlySalary || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                      </TableCell>
                                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                                        {canUserEdit() ? (
                                          <TextField
                                            type="text"
                                            size="small"
                                            value={(editedItem?.Total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            onChange={(e) => {
                                              const numValue = parseFloat(e.target.value.replace(/,/g, ''));
                                              if (!isNaN(numValue)) {
                                                handleEditItemAmount('personnel', globalIndex, numValue);
                                              }
                                            }}
                                            inputProps={{ style: { textAlign: 'right' } }}
                                            sx={{ 
                                              width: 120,
                                              '& .MuiOutlinedInput-root': {
                                                bgcolor: isChanged ? '#fff9e6' : 'white',
                                                borderColor: isChanged ? '#ffc107' : undefined
                                              }
                                            }}
                                          />
                                        ) : (
                                          `₱${(item.Total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                                        )}
                                      </TableCell>
                                    </TableRow>
                                    {isExpanded && (
                                      <TableRow>
                                        <TableCell colSpan={6} sx={{ bgcolor: '#fafafa', p: 3 }}>
                                          <Grid container spacing={2}>
                                            <Grid item xs={12}>
                                              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 2, color: '#2d5016' }}>
                                                Employee Information
                                              </Typography>
                                            </Grid>
                                            <Grid item xs={6} md={3}>
                                              <Typography variant="caption" color="text.secondary">Item Number</Typography>
                                              <Typography variant="body2">{item.itemNumber || 'N/A'}</Typography>
                                            </Grid>
                                            <Grid item xs={6} md={3}>
                                              <Typography variant="caption" color="text.secondary">Employee Number</Typography>
                                              <Typography variant="body2">{item.employeeNumber || 'N/A'}</Typography>
                                            </Grid>
                                            <Grid item xs={6} md={3}>
                                              <Typography variant="caption" color="text.secondary">Status</Typography>
                                              <Typography variant="body2">{item.employeeStatus || 'N/A'}</Typography>
                                            </Grid>
                                            <Grid item xs={6} md={3}>
                                              <Typography variant="caption" color="text.secondary">Appointment Status</Typography>
                                              <Typography variant="body2">{item.statusOfAppointment || 'N/A'}</Typography>
                                            </Grid>
                                            <Grid item xs={6} md={3}>
                                              <Typography variant="caption" color="text.secondary">Division</Typography>
                                              <Typography variant="body2">{item.division || 'N/A'}</Typography>
                                            </Grid>
                                            <Grid item xs={6} md={3}>
                                              <Typography variant="caption" color="text.secondary">Section</Typography>
                                              <Typography variant="body2">{item.section || 'N/A'}</Typography>
                                            </Grid>
                                            <Grid item xs={6} md={3}>
                                              <Typography variant="caption" color="text.secondary">Unit</Typography>
                                              <Typography variant="body2">{item.unit || 'N/A'}</Typography>
                                            </Grid>
                                            <Grid item xs={6} md={3}>
                                              <Typography variant="caption" color="text.secondary">Dependents</Typography>
                                              <Typography variant="body2">{item.noOfDependent || 0}</Typography>
                                            </Grid>

                                            <Grid item xs={12}>
                                              <Divider sx={{ my: 1 }} />
                                              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 2, color: '#2d5016' }}>
                                                Compensation Breakdown
                                              </Typography>
                                            </Grid>
                                            <Grid item xs={6} md={3}>
                                              <Typography variant="caption" color="text.secondary">Annual Salary</Typography>
                                              <Typography variant="body2">₱{(item.annualSalary || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Typography>
                                            </Grid>
                                            <Grid item xs={6} md={3}>
                                              <Typography variant="caption" color="text.secondary">PERA</Typography>
                                              <Typography variant="body2">₱{(item.PERA || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Typography>
                                            </Grid>
                                            <Grid item xs={6} md={3}>
                                              <Typography variant="caption" color="text.secondary">RATA</Typography>
                                              <Typography variant="body2">₱{(item.RATA || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Typography>
                                            </Grid>
                                            <Grid item xs={6} md={3}>
                                              <Typography variant="caption" color="text.secondary">Hazard Pay</Typography>
                                              <Typography variant="body2">₱{(item.hazardPay || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Typography>
                                            </Grid>
                                            <Grid item xs={6} md={3}>
                                              <Typography variant="caption" color="text.secondary">Subsistence Allowance</Typography>
                                              <Typography variant="body2">₱{(item.subsistenceAllowance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Typography>
                                            </Grid>
                                            <Grid item xs={6} md={3}>
                                              <Typography variant="caption" color="text.secondary">Uniform Allowance</Typography>
                                              <Typography variant="body2">₱{(item.uniformALLOWANCE || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Typography>
                                            </Grid>
                                            <Grid item xs={6} md={3}>
                                              <Typography variant="caption" color="text.secondary">Medical Allowance</Typography>
                                              <Typography variant="body2">₱{(item.medical || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Typography>
                                            </Grid>
                                            <Grid item xs={6} md={3}>
                                              <Typography variant="caption" color="text.secondary">Children Allowance</Typography>
                                              <Typography variant="body2">₱{(item.childrenAllowance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Typography>
                                            </Grid>
                                            <Grid item xs={6} md={3}>
                                              <Typography variant="caption" color="text.secondary">Midyear Bonus</Typography>
                                              <Typography variant="body2">₱{(item.midyearBonus || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Typography>
                                            </Grid>
                                            <Grid item xs={6} md={3}>
                                              <Typography variant="caption" color="text.secondary">Year-End Bonus</Typography>
                                              <Typography variant="body2">₱{(item.yearEndBonus || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Typography>
                                            </Grid>
                                            <Grid item xs={6} md={3}>
                                              <Typography variant="caption" color="text.secondary">Cash Gift</Typography>
                                              <Typography variant="body2">₱{(item.cashGift || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Typography>
                                            </Grid>
                                            <Grid item xs={6} md={3}>
                                              <Typography variant="caption" color="text.secondary">Productivity Incentive</Typography>
                                              <Typography variant="body2">₱{(item.productivityIncentive || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Typography>
                                            </Grid>

                                            <Grid item xs={12}>
                                              <Divider sx={{ my: 1 }} />
                                              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 2, color: '#2d5016' }}>
                                                Deductions
                                              </Typography>
                                            </Grid>
                                            <Grid item xs={6} md={3}>
                                              <Typography variant="caption" color="text.secondary">GSIS Premium</Typography>
                                              <Typography variant="body2">₱{(item.gsisPremium || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Typography>
                                            </Grid>
                                            <Grid item xs={6} md={3}>
                                              <Typography variant="caption" color="text.secondary">PhilHealth Premium</Typography>
                                              <Typography variant="body2">₱{(item.philhealthPremium || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Typography>
                                            </Grid>
                                            <Grid item xs={6} md={3}>
                                              <Typography variant="caption" color="text.secondary">Pag-IBIG Premium</Typography>
                                              <Typography variant="body2">₱{(item.pagibigPremium || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Typography>
                                            </Grid>
                                          </Grid>
                                        </TableCell>
                                      </TableRow>
                                    )}
                                  </React.Fragment>
                                );
                              })}
                          </TableBody>
                        </Table>
                      </TableContainer>
                      <TablePagination
                        component="div"
                        count={proposalDetails.personnel.length}
                        page={personnelPage}
                        onPageChange={(e, newPage) => setPersonnelPage(newPage)}
                        rowsPerPage={personnelRowsPerPage}
                        onRowsPerPageChange={(e) => {
                          setPersonnelRowsPerPage(parseInt(e.target.value, 10));
                          setPersonnelPage(0);
                        }}
                        rowsPerPageOptions={[5, 10, 25, 50]}
                      />
                      <Box sx={{ mt: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: '8px' }}>
                        <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#d32f2f' }}>
                          Grand Total: ₱{editableItems.personnel.reduce((sum, item) => sum + (item.Total || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </Typography>
                      </Box>
                    </>
                  ) : (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Typography variant="body2" color="text.secondary">No personnel services data available</Typography>
                    </Box>
                  )
                )}

                {/* MOOE Tab */}
                {detailsTab === 2 && (
                  proposalDetails?.mooe?.length > 0 ? (
                    <>
                      {(() => {
                        const groupedMOOE = proposalDetails.mooe.reduce((acc, item) => {
                          const category = item.category || 'Uncategorized';
                          if (!acc[category]) acc[category] = [];
                          acc[category].push(item);
                          return acc;
                        }, {});

                        return Object.entries(groupedMOOE).map(([category, items]) => {
                          const categoryTotal = items.reduce((sum, item) => sum + (item.amount || 0), 0);
                          const isExpanded = expandedGroups[`mooe-${category}`];

                          return (
                            <Box key={category} sx={{ mb: 2 }}>
                              <Box
                                onClick={() => setExpandedGroups(prev => ({ ...prev, [`mooe-${category}`]: !prev[`mooe-${category}`] }))}
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  p: 2,
                                  bgcolor: '#2d5016',
                                  color: 'white',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  '&:hover': { bgcolor: '#3d6026' }
                                }}
                              >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                    {category} ({items.length} {items.length === 1 ? 'item' : 'items'})
                                  </Typography>
                                </Box>
                                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                  ₱{categoryTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </Typography>
                              </Box>

                              {isExpanded && (
                                <TableContainer sx={{ mt: 1 }}>
                                  <Table size="small">
                                    <TableHead>
                                      <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                                        <TableCell sx={{ fontWeight: 'bold' }}>Particulars</TableCell>
                                        <TableCell sx={{ fontWeight: 'bold' }}>UACS Code</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Amount</TableCell>
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      {items.map((item, idx) => {
                                        const globalIndex = proposalDetails.mooe.indexOf(item);
                                        const itemKey = `mooe-${globalIndex}`;
                                        const isChanged = changedItems.has(itemKey);
                                        const editedItem = editableItems.mooe[globalIndex];
                                        return (
                                          <TableRow key={idx} hover sx={{ 
                                            bgcolor: isChanged ? '#fff3cd' : 'transparent',
                                            transition: 'background-color 0.3s ease'
                                          }}>
                                            <TableCell>{item.particulars || 'N/A'}</TableCell>
                                            <TableCell>{item.uacsCode || 'N/A'}</TableCell>
                                            <TableCell align="right">
                                              {canUserEdit() ? (
                                                <TextField
                                                  type="text"
                                                  size="small"
                                                  value={(editedItem?.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                  onChange={(e) => {
                                                    const numValue = parseFloat(e.target.value.replace(/,/g, ''));
                                                    if (!isNaN(numValue)) {
                                                      handleEditItemAmount('mooe', globalIndex, numValue);
                                                    }
                                                  }}
                                                  inputProps={{ style: { textAlign: 'right' } }}
                                                  sx={{ 
                                                    width: 120,
                                                    '& .MuiOutlinedInput-root': {
                                                      bgcolor: isChanged ? '#fff9e6' : 'white',
                                                      borderColor: isChanged ? '#ffc107' : undefined
                                                    }
                                                  }}
                                                />
                                              ) : (
                                                `₱${(item.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                                              )}
                                            </TableCell>
                                          </TableRow>
                                        );
                                      })}
                                    </TableBody>
                                  </Table>
                                </TableContainer>
                              )}
                            </Box>
                          );
                        });
                      })()}
                      <Box sx={{ mt: 3, p: 2, bgcolor: '#f5f5f5', borderRadius: '8px' }}>
                        <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#d32f2f' }}>
                          Grand Total: ₱{editableItems.mooe.reduce((sum, item) => sum + (item.amount || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </Typography>
                      </Box>
                    </>
                  ) : (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Typography variant="body2" color="text.secondary">No MOOE data available</Typography>
                    </Box>
                  )
                )}

                {/* Capital Outlay Tab */}
                {detailsTab === 3 && (
                  proposalDetails?.capitalOutlay?.length > 0 ? (
                    <>
                      {(() => {
                        const groupedCapital = proposalDetails.capitalOutlay.reduce((acc, item) => {
                          const category = item.category || 'Uncategorized';
                          if (!acc[category]) acc[category] = [];
                          acc[category].push(item);
                          return acc;
                        }, {});

                        return Object.entries(groupedCapital).map(([category, items]) => {
                          const categoryTotal = items.reduce((sum, item) => sum + (item.cost || item.amount || 0), 0);
                          const isExpanded = expandedGroups[`capital-${category}`];

                          return (
                            <Box key={category} sx={{ mb: 2 }}>
                              <Box
                                onClick={() => setExpandedGroups(prev => ({ ...prev, [`capital-${category}`]: !prev[`capital-${category}`] }))}
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  p: 2,
                                  bgcolor: '#2d5016',
                                  color: 'white',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  '&:hover': { bgcolor: '#3d6026' }
                                }}
                              >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                    {category} ({items.length} {items.length === 1 ? 'item' : 'items'})
                                  </Typography>
                                </Box>
                                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                  ₱{categoryTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </Typography>
                              </Box>

                              {isExpanded && (
                                <TableContainer sx={{ mt: 1 }}>
                                  <Table size="small">
                                    <TableHead>
                                      <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                                        <TableCell sx={{ fontWeight: 'bold' }}>Particulars</TableCell>
                                        <TableCell sx={{ fontWeight: 'bold' }}>UACS Code</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Amount</TableCell>
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      {items.map((item, idx) => {
                                        const globalIndex = proposalDetails.capitalOutlay.indexOf(item);
                                        const itemKey = `capitalOutlay-${globalIndex}`;
                                        const isChanged = changedItems.has(itemKey);
                                        const editedItem = editableItems.capitalOutlay[globalIndex];
                                        const fieldName = item.cost !== undefined ? 'cost' : 'amount';
                                        return (
                                          <TableRow key={idx} hover sx={{ 
                                            bgcolor: isChanged ? '#fff3cd' : 'transparent',
                                            transition: 'background-color 0.3s ease'
                                          }}>
                                            <TableCell>{item.particulars || 'N/A'}</TableCell>
                                            <TableCell>{item.uacsCode || 'N/A'}</TableCell>
                                            <TableCell align="right">
                                              {canUserEdit() ? (
                                                <TextField
                                                  type="text"
                                                  size="small"
                                                  value={(editedItem?.[fieldName] || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                  onChange={(e) => {
                                                    const numValue = parseFloat(e.target.value.replace(/,/g, ''));
                                                    if (!isNaN(numValue)) {
                                                      handleEditItemAmount('capitalOutlay', globalIndex, numValue);
                                                    }
                                                  }}
                                                  inputProps={{ style: { textAlign: 'right' } }}
                                                  sx={{ 
                                                    width: 120,
                                                    '& .MuiOutlinedInput-root': {
                                                      bgcolor: isChanged ? '#fff9e6' : 'white',
                                                      borderColor: isChanged ? '#ffc107' : undefined
                                                    }
                                                  }}
                                                />
                                              ) : (
                                                `₱${(item.cost || item.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                                              )}
                                            </TableCell>
                                          </TableRow>
                                        );
                                      })}
                                    </TableBody>
                                  </Table>
                                </TableContainer>
                              )}
                            </Box>
                          );
                        });
                      })()}
                      <Box sx={{ mt: 3, p: 2, bgcolor: '#f5f5f5', borderRadius: '8px' }}>
                        <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#d32f2f' }}>
                          Grand Total: ₱{editableItems.capitalOutlay.reduce((sum, item) => sum + (item.cost || item.amount || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </Typography>
                      </Box>
                    </>
                  ) : (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Typography variant="body2" color="text.secondary">No capital outlay data available</Typography>
                    </Box>
                  )
                )}
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, borderTop: '1px solid #e0e0e0' }}>
          <Button 
            onClick={() => {
              if (changedItems.size > 0) {
                const confirm = window.confirm('You have unsaved changes. Close anyway?');
                if (!confirm) return;
              }
              setViewDetailsDialogOpen(false);
              setChangedItems(new Set());
            }}
            variant="contained"
            sx={{
              bgcolor: '#2d5016',
              color: 'white',
              textTransform: 'none',
              fontWeight: 600,
              px: 4,
              '&:hover': {
                bgcolor: '#4a7c2c'
              }
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Proposal History Dialog */}
      <Dialog
        open={historyDialogOpen}
        onClose={() => setHistoryDialogOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)'
          }
        }}
      >
        <DialogTitle sx={{
          bgcolor: '#2d5016',
          color: 'white',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          fontSize: '1.1rem',
          py: 2.5,
          px: 3
        }}>
          <Box sx={{ 
            width: 28, 
            height: 28, 
            bgcolor: 'rgba(255,255,255,0.2)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <ExpandMoreIcon sx={{ fontSize: '1.2rem' }} />
          </Box>
          Proposal History
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {selectedProposal?.workflowHistory && selectedProposal.workflowHistory.length > 0 ? (
            <>
              <TableContainer sx={{ maxHeight: 600 }}>
                <Table stickyHeader>
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                      <TableCell sx={{ fontWeight: 'bold', color: '#333', fontSize: '0.85rem', letterSpacing: '0.5px' }}>
                        PROCESSOR NAME
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: '#333', fontSize: '0.85rem', letterSpacing: '0.5px' }}>
                        POSITION
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: '#333', fontSize: '0.85rem', letterSpacing: '0.5px' }}>
                        OLD STATUS
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: '#333', fontSize: '0.85rem', letterSpacing: '0.5px' }}>
                        NEW STATUS
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: '#333', fontSize: '0.85rem', letterSpacing: '0.5px' }}>
                        REMARK
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: '#333', fontSize: '0.85rem', letterSpacing: '0.5px' }}>
                        DATE
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: '#333', fontSize: '0.85rem', letterSpacing: '0.5px' }}>
                        TIME
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedProposal.workflowHistory
                      .slice(historyPage * historyRowsPerPage, (historyPage + 1) * historyRowsPerPage)
                      .map((entry, index) => (
                        <TableRow 
                          key={index}
                          sx={{
                            '&:nth-of-type(odd)': { bgcolor: '#f9f9f9' },
                            '&:hover': { bgcolor: '#f0f7ed' },
                            transition: 'background-color 0.2s ease'
                          }}
                        >
                          <TableCell sx={{ py: 1.5, fontSize: '0.85rem', color: '#333' }}>
                            {entry.performedByName || entry.userName || '-'}
                          </TableCell>
                          <TableCell sx={{ py: 1.5, fontSize: '0.85rem', color: '#666' }}>
                            {entry.position || getRoleFromAction(entry)}
                          </TableCell>
                          <TableCell sx={{ py: 1.5, fontSize: '0.85rem', color: '#666' }}>
                            {entry.fromStatus || entry.previousStatus || '-'}
                          </TableCell>
                          <TableCell sx={{ py: 1.5, fontSize: '0.85rem', color: '#333', fontWeight: 500 }}>
                            {entry.toStatus || entry.newStatus || '-'}
                          </TableCell>
                          <TableCell sx={{ py: 1.5, fontSize: '0.85rem', color: '#555' }}>
                            {entry.comment || '-'}
                          </TableCell>
                          <TableCell sx={{ py: 1.5, fontSize: '0.85rem', color: '#666' }}>
                            {entry.timestamp ? new Date(entry.timestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}
                          </TableCell>
                          <TableCell sx={{ py: 1.5, fontSize: '0.85rem', color: '#666' }}>
                            {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Box sx={{
                p: 2,
                bgcolor: '#fafafa',
                borderTop: '1px solid #e0e0e0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" sx={{ color: '#666', fontWeight: 500 }}>
                    Rows per page:
                  </Typography>
                  <Select
                    value={historyRowsPerPage}
                    onChange={(e) => {
                      setHistoryRowsPerPage(e.target.value);
                      setHistoryPage(0);
                    }}
                    size="small"
                    sx={{ width: 70 }}
                  >
                    <MenuItem value={10}>10</MenuItem>
                    <MenuItem value={20}>20</MenuItem>
                    <MenuItem value={50}>50</MenuItem>
                  </Select>
                </Box>
                <Typography variant="body2" sx={{ color: '#666' }}>
                  {selectedProposal.workflowHistory.length > 0 
                    ? `${historyPage * historyRowsPerPage + 1}–${Math.min((historyPage + 1) * historyRowsPerPage, selectedProposal.workflowHistory.length)} of ${selectedProposal.workflowHistory.length}`
                    : '0 of 0'
                  }
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <IconButton
                    size="small"
                    onClick={() => setHistoryPage(Math.max(0, historyPage - 1))}
                    disabled={historyPage === 0}
                  >
                    <Box sx={{ transform: 'rotate(90deg)' }}>
                      ‹
                    </Box>
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => setHistoryPage(historyPage + 1)}
                    disabled={(historyPage + 1) * historyRowsPerPage >= selectedProposal.workflowHistory.length}
                  >
                    <Box sx={{ transform: 'rotate(-90deg)' }}>
                      ›
                    </Box>
                  </IconButton>
                </Box>
              </Box>
            </>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 6 }}>
              <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                No history available
              </Typography>
              <Typography variant="body2" color="text.secondary">
                This proposal has no workflow history yet
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, borderTop: '1px solid #e0e0e0' }}>
          <Button 
            onClick={() => setHistoryDialogOpen(false)}
            variant="contained"
            sx={{
              bgcolor: '#2d5016',
              color: 'white',
              textTransform: 'none',
              fontWeight: 600,
              px: 4,
              '&:hover': {
                bgcolor: '#4a7c2c'
              }
            }}
          >
            Back
          </Button>
        </DialogActions>
      </Dialog>

      {/* Audit Trail Dialog */}
      <Dialog
        open={auditTrailDialogOpen}
        onClose={() => setAuditTrailDialogOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)'
          }
        }}
      >
        <DialogTitle sx={{
          bgcolor: '#d97706',
          color: 'white',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          fontSize: '1.1rem',
          py: 2.5,
          px: 3
        }}>
          <Box sx={{ 
            width: 28, 
            height: 28, 
            bgcolor: 'rgba(255,255,255,0.2)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <ExpandMoreIcon sx={{ fontSize: '1.2rem' }} />
          </Box>
          Change Log & Audit Trail
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {auditTrailLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 6 }}>
              <CircularProgress />
            </Box>
          ) : auditTrailData && auditTrailData.length > 0 ? (
            <TableContainer sx={{ maxHeight: 600 }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                    <TableCell sx={{ fontWeight: 'bold', color: '#333', fontSize: '0.85rem', letterSpacing: '0.5px' }}>
                      CHANGED BY
                    </TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: '#333', fontSize: '0.85rem', letterSpacing: '0.5px' }}>
                      ROLE
                    </TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: '#333', fontSize: '0.85rem', letterSpacing: '0.5px' }}>
                      FIELDS CHANGED
                    </TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: '#333', fontSize: '0.85rem', letterSpacing: '0.5px' }}>
                      OLD VALUE → NEW VALUE
                    </TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: '#333', fontSize: '0.85rem', letterSpacing: '0.5px' }}>
                      DATE & TIME
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {auditTrailData.map((change, index) => (
                    <TableRow key={index} sx={{
                      '&:hover': { bgcolor: '#f9f9f9' },
                      borderBottom: '1px solid #e0e0e0'
                    }}>
                      <TableCell sx={{ fontSize: '0.85rem', py: 2 }}>
                        {change.performedBy || 'System'}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.85rem', py: 2 }}>
                        <Chip 
                          label={change.role?.replace(/_/g, ' ') || 'N/A'}
                          size="small"
                          sx={{
                            bgcolor: '#e3f2fd',
                            color: '#1976d2',
                            fontWeight: 500
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.85rem', py: 2 }}>
                        {change.changedFields?.join(', ') || 'N/A'}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8rem', py: 2, fontFamily: 'monospace' }}>
                        {Object.entries(change.details || {}).map(([field, values]) => (
                          <Box key={field} sx={{ mb: 0.5, pb: 0.5, borderBottom: '1px solid #f0f0f0' }}>
                            <Box sx={{ fontWeight: 600, color: '#d97706', fontSize: '0.75rem' }}>
                              {field}:
                            </Box>
                            <Box sx={{ color: '#ef4444', fontSize: '0.75rem' }}>
                              {values.oldValue ? String(values.oldValue).substring(0, 30) : 'empty'}
                            </Box>
                            <Box sx={{ color: '#22c55e', fontSize: '0.75rem' }}>
                              → {values.newValue ? String(values.newValue).substring(0, 30) : 'empty'}
                            </Box>
                          </Box>
                        ))}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.85rem', py: 2, whiteSpace: 'nowrap' }}>
                        {new Date(change.timestamp).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 6 }}>
              <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                No changes recorded
              </Typography>
              <Typography variant="body2" color="text.secondary">
                This proposal has not been edited yet
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, borderTop: '1px solid #e0e0e0' }}>
          <Button 
            onClick={() => setAuditTrailDialogOpen(false)}
            variant="contained"
            sx={{
              bgcolor: '#d97706',
              color: 'white',
              textTransform: 'none',
              fontWeight: 600,
              px: 4,
              '&:hover': {
                bgcolor: '#b45309'
              }
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default NewProposalWorkflowPage;