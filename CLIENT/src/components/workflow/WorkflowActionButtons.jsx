/**
 * 🔄 Workflow Action Buttons Component
 * Action buttons for Division → Department → Region workflow
 */

import React, { useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Chip,
  Tooltip,
  IconButton
} from '@mui/material';
import {
  CheckCircle as VerifyIcon,
  Send as SubmitIcon,
  ThumbUp as ApproveIcon,
  ThumbDown as RejectIcon,
  EmojiEvents as FinalizeIcon,
  Undo as ReturnIcon
} from '@mui/icons-material';
import api from '../../config/api';

/**
 * 📤 Submit to Department Button (Division Level)
 */
export const SubmitToDepartmentButton = ({ row, refreshData, disabled }) => {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const modelType = determineModelType(row);
      await api.post('/api/status-workflow/submit-to-department', {
        modelType,
        recordIds: [row._id]
      });
      
      if (refreshData) refreshData();
    } catch (error) {
      console.error('Submit to Department error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (row.status !== 'Draft') return null;

  return (
    <Tooltip title="Submit to Department for Verification">
      <IconButton
        onClick={handleSubmit}
        disabled={disabled || loading}
        size="small"
        sx={{ 
          color: '#2196f3',
          '&:hover': { backgroundColor: '#e3f2fd' }
        }}
      >
        {loading ? <CircularProgress size={16} /> : <SubmitIcon />}
      </IconButton>
    </Tooltip>
  );
};

/**
 * ✅ Department Verify Button (Department Level)
 */
export const DepartmentVerifyButton = ({ row, refreshData, disabled }) => {
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    setLoading(true);
    try {
      console.log('🔧 Starting verification for:', { 
        rowId: row._id, 
        status: row.status,
        workflowLevel: row.workflowLevel,
        fullRow: row 
      });
      
      const modelType = determineModelType(row);
      console.log('🔧 Model type determined:', modelType);
      
      // Detailed model type analysis
      console.log('🔧 Model detection analysis:', {
        hasSalaryGrade: !!row.salaryGrade,
        hasUacsCode: !!row.uacsCode, 
        hasProjectTitle: !!row.projectTitle,
        detectedType: modelType
      });
      
      const response = await api.post('/api/status-workflow/verify-by-department', {
        modelType,
        recordIds: [row._id],
        action: 'verify'
      });
      
      console.log('✅ Verification successful:', response.data);
      
      if (response.data.modifiedCount > 0) {
        const message = `✅ Successfully verified ${response.data.modifiedCount} proposal(s)! Status updated to: Department Verified`;
        console.log('✅', message);
        
        // Show success message and refresh page option
        if (confirm(`${message}\n\nClick OK to refresh the page to see updated data.`)) {
          window.location.reload();
        }
      } else {
        alert(`⚠️ No records were updated. The proposal may already be processed or doesn't match the expected status.`);
      }
      
      if (refreshData) {
        // Immediate refresh
        refreshData();
        console.log('🔄 Data refresh triggered immediately');
        
        // Also do a delayed refresh to ensure data is updated
        setTimeout(() => {
          refreshData();
          console.log('🔄 Secondary data refresh triggered');
        }, 1000);
        
        // If data still doesn't refresh after 3 seconds, suggest page reload
        setTimeout(() => {
          if (confirm('Data updated successfully! Click OK to refresh the page to see the latest status.')) {
            window.location.reload();
          }
        }, 3000);
      }
    } catch (error) {
      console.error('❌ Department verification error:', error);
      
      let errorMessage = 'Failed to verify proposal';
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alert(`❌ Error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  // Only show verify button for proposals that need department verification
  if (row.status !== 'Division Submitted' && row.status !== 'Submitted') return null;
  
  // Hide if already verified
  if (row.status === 'Department Verified' || row.status === 'Department Submitted') return null;

  return (
    <Tooltip title="Verify Proposal">
      <IconButton
        onClick={handleVerify}
        disabled={disabled || loading}
        size="small"
        sx={{ 
          color: '#ff9800',
          '&:hover': { backgroundColor: '#fff3e0' }
        }}
      >
        {loading ? <CircularProgress size={16} /> : <VerifyIcon />}
      </IconButton>
    </Tooltip>
  );
};

/**
 * 📤 Submit to Region Button (Department Level)
 */
export const SubmitToRegionButton = ({ row, refreshData, disabled }) => {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const modelType = determineModelType(row);
      await api.post('/api/status-workflow/submit-to-region', {
        modelType,
        recordIds: [row._id]
      });
      
      if (refreshData) refreshData();
    } catch (error) {
      console.error('Submit to Region error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (row.status !== 'Department Verified') return null;

  return (
    <Tooltip title="Submit to Region for Approval">
      <IconButton
        onClick={handleSubmit}
        disabled={disabled || loading}
        size="small"
        sx={{ 
          color: '#673ab7',
          '&:hover': { backgroundColor: '#ede7f6' }
        }}
      >
        {loading ? <CircularProgress size={16} /> : <SubmitIcon />}
      </IconButton>
    </Tooltip>
  );
};

/**
 * 👍 Region Approve Button (Region Level)
 */
export const RegionApproveButton = ({ row, refreshData, disabled }) => {
  const [loading, setLoading] = useState(false);

  const handleApprove = async () => {
    setLoading(true);
    try {
      const modelType = determineModelType(row);
      await api.post('/api/status-workflow/approve-by-region', {
        modelType,
        recordIds: [row._id],
        action: 'approve'
      });
      
      if (refreshData) refreshData();
    } catch (error) {
      console.error('Region approval error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (row.status !== 'Department Submitted') return null;

  return (
    <Tooltip title="Approve Proposal">
      <IconButton
        onClick={handleApprove}
        disabled={disabled || loading}
        size="small"
        sx={{ 
          color: '#4caf50',
          '&:hover': { backgroundColor: '#e8f5e8' }
        }}
      >
        {loading ? <CircularProgress size={16} /> : <ApproveIcon />}
      </IconButton>
    </Tooltip>
  );
};

/**
 * 🏆 Finalize Button (Admin Level)
 */
export const FinalizeButton = ({ row, refreshData, disabled }) => {
  const [loading, setLoading] = useState(false);

  const handleFinalize = async () => {
    setLoading(true);
    try {
      const modelType = determineModelType(row);
      await api.post('/api/status-workflow/finalize-proposals', {
        modelType,
        recordIds: [row._id]
      });
      
      if (refreshData) refreshData();
    } catch (error) {
      console.error('Finalize proposals error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (row.status !== 'Region Approved') return null;

  return (
    <Tooltip title="Finalize Proposal">
      <IconButton
        onClick={handleFinalize}
        disabled={disabled || loading}
        size="small"
        sx={{ 
          color: '#1b5e20',
          '&:hover': { backgroundColor: '#e0f2f1' }
        }}
      >
        {loading ? <CircularProgress size={16} /> : <FinalizeIcon />}
      </IconButton>
    </Tooltip>
  );
};

/**
 * 📋 Reject/Return Button with Dialog
 */
export const RejectButton = ({ row, refreshData, disabled, userLevel }) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const canReject = () => {
    // Department can reject Division submissions
    if (userLevel === 'DEPARTMENT' && (row.status === 'Division Submitted' || row.status === 'Submitted')) return true;
    // Region can reject Department submissions
    if (userLevel === 'REGION' && row.status === 'Department Submitted') return true;
    // Full access can reject at any level (except finalized)
    if (userLevel === 'FULL' && row.status !== 'Finalized' && row.status !== 'Draft') return true;
    return false;
  };

  const handleReject = async () => {
    setLoading(true);
    try {
      const modelType = determineModelType(row);
      const endpoint = userLevel === 'DEPARTMENT' 
        ? '/api/status-workflow/verify-by-department'
        : '/api/status-workflow/approve-by-region';
      
      await api.post(endpoint, {
        modelType,
        recordIds: [row._id],
        action: 'reject',
        rejectionReason: reason
      });
      
      setOpen(false);
      setReason('');
      if (refreshData) refreshData();
    } catch (error) {
      console.error('Rejection error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!canReject()) return null;

  return (
    <>
      <Tooltip title="Reject/Return Proposal">
        <IconButton
          onClick={() => setOpen(true)}
          disabled={disabled || loading}
          size="small"
          sx={{ 
            color: '#f44336',
            '&:hover': { backgroundColor: '#ffebee' }
          }}
        >
          <RejectIcon />
        </IconButton>
      </Tooltip>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Return Proposal</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Please provide a reason for returning this proposal:
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Enter reason for rejection..."
            variant="outlined"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleReject}
            disabled={loading || !reason.trim()}
            color="error"
            variant="contained"
          >
            {loading ? <CircularProgress size={20} /> : 'Return Proposal'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

/**
 * 🎯 Smart Workflow Actions - Shows appropriate buttons based on status and user level
 */
export const WorkflowActionButtons = ({ row, refreshData, userAccess }) => {
  const userLevel = userAccess?.scope || userAccess?.assignmentLevel || 'NONE';
  const hasFullAccess = userAccess?.hasFullAccess || false;

  return (
    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
      {/* Division Level: Submit to Department */}
      {(userLevel === 'DIVISION' || userLevel === 'FULL') && (
        <SubmitToDepartmentButton row={row} refreshData={refreshData} />
      )}
      
      {/* Department Level: Verify and Submit to Region */}
      {(userLevel === 'DEPARTMENT' || userLevel === 'FULL') && (
        <>
          <DepartmentVerifyButton row={row} refreshData={refreshData} />
          <SubmitToRegionButton row={row} refreshData={refreshData} />
        </>
      )}
      
      {/* Region Level: Approve */}
      {(userLevel === 'REGION' || userLevel === 'FULL') && (
        <RegionApproveButton row={row} refreshData={refreshData} />
      )}
      
      {/* Full Access Only: Finalize */}
      {userLevel === 'FULL' && (
        <FinalizeButton row={row} refreshData={refreshData} />
      )}
      
      {/* Reject/Return Button - Available at all levels */}
      <RejectButton 
        row={row} 
        refreshData={refreshData} 
        userLevel={userLevel}
      />
    </Box>
  );
};

/**
 * Helper function to determine model type from row data
 */
const determineModelType = (row) => {
  // This logic should match your data structure
  if (row.salaryGrade) return 'personnel';
  if (row.uacsCode) return 'mooe';
  if (row.projectTitle) return 'capital';
  if (row.particulars && row.incomecategory) return 'income'; // Corporate Income
  return 'proposal';
};

// All components are already exported individually when declared above
// Just export as default for convenience
export default {
  SubmitToDepartmentButton,
  DepartmentVerifyButton,
  SubmitToRegionButton,
  RegionApproveButton,
  FinalizeButton,
  RejectButton,
  WorkflowActionButtons
};