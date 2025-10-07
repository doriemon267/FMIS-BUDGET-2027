import React, { useState, useEffect } from "react";
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
  CircularProgress,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  InputAdornment,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import VisibilityIcon from "@mui/icons-material/Visibility";
import UndoIcon from "@mui/icons-material/Undo";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import SearchIcon from "@mui/icons-material/Search";
import api from "../../config/api";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useUser } from "../../context/UserContext";
import ProposalDetailsDialog from "../myproposal/ProposalDetailsDialog";

// View Proposal Button - Now uses ProposalDetailsDialog with Budget Officer Edit System
export const ViewButton = ({ row }) => {
  const [open, setOpen] = useState(false);

  const handleView = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  // Allow external triggers (e.g., Actions menu) to open this view dialog
  useEffect(() => {
    const handler = (e) => {
      const incoming = e?.detail?.row;
      if (incoming?._id && row?._id && String(incoming._id) === String(row._id)) {
        handleView();
      }
    };
    window.addEventListener('open-proposal-view', handler);
    return () => window.removeEventListener('open-proposal-view', handler);
  }, [row?._id]);

  return (
    <>
      <Tooltip title="View Details">
        <IconButton onClick={handleView} size="small">
          <VisibilityIcon />
        </IconButton>
      </Tooltip>
      <ProposalDetailsDialog
        open={open}
        onClose={handleClose}
        proposal={row}
      />
    </>
  );
};

// Helpers
const mapCobToEntity = (cob) => {
  if (!cob) return 'personnel';
  const s = String(cob).toLowerCase();
  if (s.includes('personnel')) return 'personnel';
  if (s.includes('mooe')) return 'mooe';
  if (s.includes('capital')) return 'capital';
  if (s.includes('income') || s.includes('corporate')) return 'income';
  return 'personnel';
};

const fetchIdsForRow = async (row, targetStatus) => {
  const entity = mapCobToEntity(row.cobExpenditures);
  const params = {
    fiscalYear: row.fiscalYear,
    budgetType: row.budgetType,
    processBy: row.processBy,
    region: row.region,
  };
  let url = '';
  switch (entity) {
    case 'personnel':
      url = '/getpersonnels/byParams';
      break;
    case 'mooe':
      url = '/mooe/getByParams';
      break;
    case 'capital':
      url = '/capital-outlay/getByParams';
      break;
    case 'income':
      url = '/income/getByParams';
      break;
  }
  const resp = await api.get(url, { params });
  const list = Array.isArray(resp.data) ? resp.data : (resp.data?.data || []);
  return list.filter(i => (i.status || '').toLowerCase() === String(targetStatus).toLowerCase()).map(i => i._id).filter(Boolean);
};

// Approve (Region) Button
export const ApproveButton = ({ row, refreshData }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState('');
  const [idsPreviewLoading, setIdsPreviewLoading] = useState(false);
  const [idsPreviewCount, setIdsPreviewCount] = useState(0);
  const queryClient = useQueryClient();
  const { currentUser } = useUser();
  
  // Debug logging for user data
  console.log('👤 ApproveButton User Debug:', {
    currentUser: currentUser,
    hierarchicalAccess: currentUser?.hierarchicalAccess,
    scope: currentUser?.hierarchicalAccess?.scope,
    workflowRoles: currentUser?.hierarchicalAccess?.workflowRoles,
    rolePermissions: currentUser?.hierarchicalAccess?.rolePermissions,
    hierarchicalFlags: currentUser?.hierarchicalFlags
  });
  
  // Debug logging for row data
  console.log('📋 ApproveButton Row Debug:', {
    rowId: row._id,
    rowStatus: row.status,
    fullRow: row
  });
  const handleOpen = async () => {
    setOpen(true);
    // Prefetch affected record count
    setIdsPreviewLoading(true);
    try {
      const ids = await fetchIdsForRow(row, 'Department Submitted');
      setIdsPreviewCount(ids.length || 0);
    } catch (e) {
      setIdsPreviewCount(0);
    } finally {
      setIdsPreviewLoading(false);
    }
  };

  const scope = currentUser?.hierarchicalAccess?.scope;
  const roles = currentUser?.hierarchicalAccess?.workflowRoles || [];
  const canApprovePermission = currentUser?.hierarchicalFlags?.canApproveProposals === true || currentUser?.hierarchicalAccess?.rolePermissions?.canApproveProposals === true;
  
  // Department users with departmentConsolidator role can approve Division Submitted proposals
  // Office users (BUDGET_OFFICER) can approve proposals pending their review
  // Full/Region users (BUDGET_MANAGER/BUDGET_ADMIN) can approve at higher levels
  const canApprove = (
    (scope === 'DEPARTMENT' && roles.includes('departmentConsolidator') && row.status === 'Division Submitted') ||
    (scope === 'OFFICE' && roles.includes('officeFinalVerifier') && canApprovePermission && 
     ['Division Submitted', 'Responsibility Center Submitted', 'Submitted to Officer', 'Submitted'].includes(row.status)) ||
    ((scope === 'FULL' || scope === 'REGION') && canApprovePermission && 
     ['Officer Approved', 'Submitted to Manager', 'Office Submitted'].includes(row.status))
  );
  
  // Debug logging
  console.log('🔍 ApproveButton Debug:', {
    scope,
    roles,
    rowStatus: row.status,
    canApprove,
    departmentCondition: scope === 'DEPARTMENT' && roles.includes('departmentConsolidator') && row.status === 'Division Submitted',
    officeFinalCondition: (scope === 'OFFICE' || scope === 'FULL') && roles.includes('officeFinalVerifier') && canApprovePermission && row.status === 'Office Submitted',
    officeVerificationCondition: (scope === 'OFFICE' || scope === 'FULL') && roles.includes('officeFinalVerifier') && canApprovePermission && 
                               ['Division Submitted', 'Responsibility Center Submitted', 'Submitted to Officer', 'Submitted'].includes(row.status),
    hasDepartmentConsolidator: roles.includes('departmentConsolidator'),
    hasOfficeFinalVerifier: roles.includes('officeFinalVerifier'),
    canApprovePermission
  });
  
  if (!canApprove) return null;

  const handleApprove = async () => {
    setLoading(true);
    try {
      const entity = mapCobToEntity(row.cobExpenditures);
      
      if (scope === 'DEPARTMENT' && row.status === 'Division Submitted') {
        // Department approval: Division Submitted → Department Verified
        const ids = await fetchIdsForRow(row, 'Division Submitted');
        if (ids.length === 0) throw new Error('No records to approve');
        
        await api.post('/api/submission-workflow/office/verify-submission', {
          ids,
          entity,
          departmentVerificationNote: note || `Verified at Department on ${new Date().toLocaleString()}`
        });
        toast.success('Department verification successful');
      } else if (scope === 'OFFICE' && ['Division Submitted', 'Responsibility Center Submitted', 'Submitted to Officer', 'Submitted'].includes(row.status)) {
        // BUDGET_OFFICER approval: Division/RC Submitted → Officer Approved
        const statusToUse = row.status;
        const ids = await fetchIdsForRow(row, statusToUse);
        if (ids.length === 0) throw new Error('No records to approve');
        
        await api.post('/api/submission-workflow/office/verify-submission', {
          ids,
          entity,
          officeVerificationNote: note || `Approved by Officer on ${new Date().toLocaleString()}`
        });
        toast.success('Officer approval successful');
      } else if ((scope === 'FULL' || scope === 'REGION') && ['Officer Approved', 'Submitted to Manager', 'Office Submitted'].includes(row.status)) {
        // BUDGET_MANAGER/BUDGET_ADMIN approval: Officer Approved/Submitted to Manager → Manager Approved
        const statusToUse = row.status;
        const ids = await fetchIdsForRow(row, statusToUse);
        if (ids.length === 0) throw new Error('No records to approve');
        
        await api.post('/api/submission-workflow/office/approve-submission', {
          ids,
          entity,
          managerApprovalNote: note || `Approved by Manager on ${new Date().toLocaleString()}`
        });
        toast.success('Manager approval successful');
      }
      
      await queryClient.invalidateQueries(['proposals']);
      refreshData?.();
      setOpen(false);
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.message || e.message || 'Failed to approve');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Tooltip title="Approve">
        <IconButton color="success" onClick={handleOpen} size="small" disabled={loading}>
          <CheckCircleIcon />
        </IconButton>
      </Tooltip>
      <Dialog open={open} onClose={() => !loading && setOpen(false)}>
        <DialogTitle>
          {scope === 'DEPARTMENT' ? 'Verify Division Submission' : 'Approve Submission'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            This will move records to <strong>
              {scope === 'DEPARTMENT' ? 'Department Verified' : 'Region Approved'}
            </strong>.
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            {idsPreviewLoading ? 'Checking affected records…' : `Affected records: ${idsPreviewCount}`}
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={3}
            label="Approval Note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
          <Button onClick={handleApprove} disabled={loading} variant="contained" color="success">
            {loading ? <CircularProgress size={20} /> : 'Approve'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

// Submit to Office Button
export const SubmitToOfficeButton = ({ row, refreshData }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState('');
  const [idsPreviewLoading, setIdsPreviewLoading] = useState(false);
  const [idsPreviewCount, setIdsPreviewCount] = useState(0);
  const queryClient = useQueryClient();
  const { currentUser } = useUser();
  const handleOpen = async () => {
    setOpen(true);
    setIdsPreviewLoading(true);
    try {
      const ids = await fetchIdsForRow(row, 'Department Verified');
      setIdsPreviewCount(ids.length || 0);
    } catch (e) {
      setIdsPreviewCount(0);
    } finally {
      setIdsPreviewLoading(false);
    }
  };

  const scope = currentUser?.hierarchicalAccess?.scope;
  const roles = currentUser?.hierarchicalAccess?.workflowRoles || [];
  const canSubmit = scope === 'OFFICE' && roles.includes('officeConsolidator') && row.status === 'Office Verified';
  if (!canSubmit) return null;

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const ids = await fetchIdsForRow(row, 'Office Verified');
      if (ids.length === 0) throw new Error('No verified records to submit');
      const entity = mapCobToEntity(row.cobExpenditures);
      await api.post('/api/submission-workflow/office/submit-own', {
        ids,
        entity,
        approvalNote: note || `Finalized on ${new Date().toLocaleString()}`
      });
      toast.success('Finalized submission');
      await queryClient.invalidateQueries(['proposals']);
      refreshData?.();
      setOpen(false);
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.message || e.message || 'Failed to submit');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Tooltip title="Finalize Submission">
        <IconButton color="primary" onClick={handleOpen} size="small" disabled={loading}>
          <KeyboardArrowRightIcon />
        </IconButton>
      </Tooltip>
      <Dialog open={open} onClose={() => !loading && setOpen(false)}>
        <DialogTitle>Submit to Region</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            This will move records to <strong>Department Submitted</strong>.
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            {idsPreviewLoading ? 'Checking affected records…' : `Affected records: ${idsPreviewCount}`}
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={3}
            label="Approval Note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading} variant="contained" color="primary">
            {loading ? <CircularProgress size={20} /> : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

// Return / Reject Button
export const ReturnButton = ({ row, refreshData }) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [idsPreviewLoading, setIdsPreviewLoading] = useState(false);
  const [idsPreviewCount, setIdsPreviewCount] = useState(0);
  const queryClient = useQueryClient();
  const { currentUser } = useUser();
  
  // Debug logging for user data
  console.log('👤 ReturnButton User Debug:', {
    currentUser: currentUser,
    hierarchicalAccess: currentUser?.hierarchicalAccess,
    scope: currentUser?.hierarchicalAccess?.scope,
    workflowRoles: currentUser?.hierarchicalAccess?.workflowRoles,
    rolePermissions: currentUser?.hierarchicalAccess?.rolePermissions,
    hierarchicalFlags: currentUser?.hierarchicalFlags
  });
  
  // Debug logging for row data
  console.log('📋 ReturnButton Row Debug:', {
    rowId: row._id,
    rowStatus: row.status,
    fullRow: row
  });

  const scope = currentUser?.hierarchicalAccess?.scope;
  const roles = currentUser?.hierarchicalAccess?.workflowRoles || [];
  const canReturn = (
    // Department users with departmentConsolidator role can return Division Submitted and Department Verified proposals
    (scope === 'DEPARTMENT' && roles.includes('departmentConsolidator') && ['Division Submitted', 'Department Verified'].includes(row.status)) ||
    // Office users can return various statuses
    ((scope === 'OFFICE' && roles.includes('officeConsolidator')) ||
     ((scope === 'OFFICE' || scope === 'FULL') && roles.includes('officeFinalVerifier'))) &&
    ['Responsibility Center Submitted','Office Verified','Office Submitted','Submitted'].includes(row.status)
  );
  
  // Debug logging
  console.log('🔍 ReturnButton Debug:', {
    scope,
    roles,
    rowStatus: row.status,
    canReturn,
    departmentCondition: scope === 'DEPARTMENT' && roles.includes('departmentConsolidator') && ['Division Submitted', 'Department Verified'].includes(row.status),
    officeCondition: ((scope === 'OFFICE' && roles.includes('officeConsolidator')) ||
                     ((scope === 'OFFICE' || scope === 'FULL') && roles.includes('officeFinalVerifier'))) &&
                    ['Responsibility Center Submitted','Office Verified','Office Submitted','Submitted'].includes(row.status),
    hasDepartmentConsolidator: roles.includes('departmentConsolidator'),
    hasOfficeConsolidator: roles.includes('officeConsolidator'),
    hasOfficeFinalVerifier: roles.includes('officeFinalVerifier')
  });

  if (!canReturn) return null;

  const handleOpen = async () => {
    setOpen(true);
    setIdsPreviewLoading(true);
    try {
      const ids = await fetchIdsForRow(row, row.status || 'Submitted');
      setIdsPreviewCount(ids.length || 0);
    } catch (e) {
      setIdsPreviewCount(0);
    } finally {
      setIdsPreviewLoading(false);
    }
  };

  const handleReturn = async () => {
    if (!reason.trim()) {
      toast.error('Please provide a reason for returning the proposal');
      return;
    }
    setLoading(true);
    try {
      await api.post('/returnProposal', {
        fiscalYear: row.fiscalYear,
        budgetType: row.budgetType,
        processBy: row.processBy,
        region: row.region,
        reason,
        cobExpenditures: row.cobExpenditures,
      });
      toast.success(`${row.cobExpenditures} proposal returned successfully`);
      await queryClient.invalidateQueries(['proposals']);
      refreshData?.();
      setOpen(false);
      setReason('');
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to return proposal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Tooltip title="Return / Reject">
        <IconButton color="error" onClick={handleOpen} size="small" disabled={loading}>
          <UndoIcon />
        </IconButton>
      </Tooltip>
      <Dialog open={open} onClose={() => !loading && setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Return {row.cobExpenditures} Proposal</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            This will mark the proposal as <strong>Returned</strong> with feedback.
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            {idsPreviewLoading ? 'Checking affected records…' : `Affected records: ${idsPreviewCount}`}
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            <strong>Expenditure Type:</strong> {row.cobExpenditures}<br />
            <strong>Region:</strong> {row.region}<br />
            <strong>Fiscal Year:</strong> {row.fiscalYear}<br />
            <strong>Budget Type:</strong> {row.budgetType}
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            label="Feedback / Reason for Return"
            type="text"
            fullWidth
            multiline
            rows={4}
            variant="outlined"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={loading}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
          <Button onClick={handleReturn} color="error" variant="contained" disabled={loading || !reason.trim()}>
            {loading ? <CircularProgress size={20} /> : 'Return'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

// Verify (Department) Button
export const VerifyButton = ({ row, refreshData }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState('');
  const [idsPreviewLoading, setIdsPreviewLoading] = useState(false);
  const [idsPreviewCount, setIdsPreviewCount] = useState(0);
  const queryClient = useQueryClient();
  const { currentUser } = useUser();

  const scope = currentUser?.hierarchicalAccess?.scope;
  const roles = currentUser?.hierarchicalAccess?.workflowRoles || [];
  const canVerify = scope === 'OFFICE' && roles.includes('officeConsolidator') && row.status === 'Responsibility Center Submitted';
  if (!canVerify) return null;

  const handleOpen = async () => {
    setOpen(true);
    setIdsPreviewLoading(true);
    try {
      const ids = await fetchIdsForRow(row, 'Responsibility Center Submitted');
      setIdsPreviewCount(ids.length || 0);
    } catch (e) {
      setIdsPreviewCount(0);
    } finally {
      setIdsPreviewLoading(false);
    }
  };

  const handleVerify = async () => {
    setLoading(true);
    try {
      const ids = await fetchIdsForRow(row, 'Responsibility Center Submitted');
      if (ids.length === 0) throw new Error('No matching records to verify');
      const entity = mapCobToEntity(row.cobExpenditures);
      await api.post('/api/submission-workflow/office/verify-submission', {
        ids,
        entity,
        verificationNote: note || `Verified on ${new Date().toLocaleString()}`
      });
      toast.success('Responsibility Center submission verified');
      await queryClient.invalidateQueries(['proposals']);
      refreshData?.();
      setOpen(false);
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.message || e.message || 'Failed to verify');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Tooltip title="Verify">
        <IconButton color="success" onClick={handleOpen} size="small" disabled={loading}>
          <CheckCircleIcon />
        </IconButton>
      </Tooltip>
      <Dialog open={open} onClose={() => !loading && setOpen(false)}>
        <DialogTitle>Verify Responsibility Center Submission</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            This will move records to <strong>Department Verified</strong>.
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            {idsPreviewLoading ? 'Checking affected records…' : `Affected records: ${idsPreviewCount}`}
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={3}
            label="Verification Note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
          <Button onClick={handleVerify} disabled={loading} variant="contained" color="success">
            {loading ? <CircularProgress size={20} /> : 'Verify'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

// Finalize (Region) Button
export const FinalizeButton = ({ row, refreshData }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState('');
  const [idsPreviewLoading, setIdsPreviewLoading] = useState(false);
  const [idsPreviewCount, setIdsPreviewCount] = useState(0);
  const queryClient = useQueryClient();
  const { currentUser } = useUser();

  const scope = currentUser?.hierarchicalAccess?.scope;
  const roles = currentUser?.hierarchicalAccess?.workflowRoles || [];
  const canFinalize = (scope === 'OFFICE' || scope === 'FULL') && roles.includes('officeFinalVerifier') && (currentUser?.hierarchicalFlags?.canApproveProposals || currentUser?.hierarchicalAccess?.rolePermissions?.canApproveProposals) && row.status === 'Office Approved';
  if (!canFinalize) return null;

  const handleOpen = async () => {
    setOpen(true);
    setIdsPreviewLoading(true);
    try {
      const ids = await fetchIdsForRow(row, 'Office Approved');
      setIdsPreviewCount(ids.length || 0);
    } catch (e) {
      setIdsPreviewCount(0);
    } finally {
      setIdsPreviewLoading(false);
    }
  };

  const handleFinalize = async () => {
    setLoading(true);
    try {
      const ids = await fetchIdsForRow(row, 'Office Approved');
      if (ids.length === 0) throw new Error('No approved records to finalize');
      const entity = mapCobToEntity(row.cobExpenditures);
      await api.post('/api/submission-workflow/office/finalize-submission', {
        ids,
        entity,
        finalizationNote: note || `Finalized on ${new Date().toLocaleString()}`
      });
      toast.success('Finalized successfully');
      await queryClient.invalidateQueries(['proposals']);
      refreshData?.();
      setOpen(false);
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.message || e.message || 'Failed to finalize');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Tooltip title="Finalize">
        <IconButton color="primary" onClick={handleOpen} size="small" disabled={loading}>
          <KeyboardArrowDownIcon />
        </IconButton>
      </Tooltip>
      <Dialog open={open} onClose={() => !loading && setOpen(false)}>
        <DialogTitle>Finalize Submission</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            This will move records to <strong>Finalized</strong>.
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            {idsPreviewLoading ? 'Checking affected records…' : `Affected records: ${idsPreviewCount}`}
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={3}
            label="Finalization Note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
          <Button onClick={handleFinalize} disabled={loading} variant="contained" color="primary">
            {loading ? <CircularProgress size={20} /> : 'Finalize'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

// Submit Draft Button
export const SubmitDraftButton = ({ row, refreshData }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState('');
  const [idsPreviewLoading, setIdsPreviewLoading] = useState(false);
  const [idsPreviewCount, setIdsPreviewCount] = useState(0);
  const queryClient = useQueryClient();
  const { currentUser } = useUser();

  const scope = currentUser?.hierarchicalAccess?.scope;
  const roles = currentUser?.hierarchicalAccess?.workflowRoles || [];

  // Determine if user can submit draft based on their level and roles
  const canSubmitDraft = (
    (scope === 'RESPONSIBILITY_CENTER' && roles.includes('responsibilityCenterCreator') && row.status === 'Draft') ||
    (scope === 'OFFICE' && roles.includes('officeConsolidator') && row.status === 'Draft')
  );

  if (!canSubmitDraft) return null;

  const handleOpen = async () => {
    setOpen(true);
    setIdsPreviewLoading(true);
    try {
      const ids = await fetchIdsForRow(row, 'Draft');
      setIdsPreviewCount(ids.length || 0);
    } catch (e) {
      setIdsPreviewCount(0);
    } finally {
      setIdsPreviewLoading(false);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Collect all matching record IDs for the row's current status
      const ids = await fetchIdsForRow(row, 'Draft');
      if (!ids || ids.length === 0) {
        throw new Error('No draft records found to submit');
      }
      const entity = mapCobToEntity(row.cobExpenditures);

      let endpoint = '';
      let successMessage = '';

      if (scope === 'RESPONSIBILITY_CENTER') {
        endpoint = '/api/submission-workflow/responsibility-center/submit-to-office';
        successMessage = 'Submitted to Office';
      } else if (scope === 'OFFICE') {
        // For office, use the new submit-own endpoint that finalizes directly
        endpoint = '/api/submission-workflow/office/submit-own';
        successMessage = 'Finalized';
      }

      await api.post(endpoint, {
        ids,
        entity,
        submissionNote: note || `Submitted from ${scope} level on ${new Date().toLocaleString()}`
      });

      toast.success(successMessage);
      await queryClient.invalidateQueries(['proposals']);
      refreshData?.();
      setOpen(false);
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.message || e.message || 'Failed to submit');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Tooltip title={`Submit ${row.status} to next level`}>
        <IconButton color="primary" onClick={handleOpen} size="small" disabled={loading}>
          <CheckCircleIcon />
        </IconButton>
      </Tooltip>
      <Dialog open={open} onClose={() => !loading && setOpen(false)}>
        <DialogTitle>Submit Draft Proposal</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            This will submit the draft proposal to the next level for review.
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            {idsPreviewLoading ? 'Checking affected records…' : `Affected records: ${idsPreviewCount}`}
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={3}
            label="Submission Note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading} variant="contained" color="primary">
            {loading ? <CircularProgress size={20} /> : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
