import React, { useState, useEffect } from 'react';
import { Box, Button, IconButton, List, ListItem, ListItemText, ListItemSecondaryAction, Tooltip, Typography } from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DeleteIcon from '@mui/icons-material/Delete';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import api from '../../config/api';
import { toast } from 'react-toastify';

const ProposalAttachments = ({ proposal, moduleName = 'general', userInfo, onChange }) => {
  const [attachments, setAttachments] = useState(() => proposal?.attachments || []);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setAttachments(proposal?.attachments || []);
  }, [proposal]);

  const normalizedRoles = (userInfo?.Roles || []).map(r => String(r).toUpperCase());
  const workflowRoles = userInfo?.hierarchicalAccess?.workflowRoles || [];
  
  const isPreparer = normalizedRoles.includes('BUDGET PREPARER') || normalizedRoles.includes('BUDGET_PREPARER') || workflowRoles.includes('Preparer');
  const isReviewer = normalizedRoles.includes('BUDGET REVIEWER') || normalizedRoles.includes('BUDGET_REVIEWER') || workflowRoles.includes('Reviewer');
  const isApprover = normalizedRoles.includes('BUDGET APPROVER') || normalizedRoles.includes('BUDGET_APPROVER') || workflowRoles.includes('Approver');
  const isManager = normalizedRoles.includes('BUDGET MANAGER') || normalizedRoles.includes('BUDGET_MANAGER') || workflowRoles.includes('Manager');
  const isSuperAdmin = normalizedRoles.includes('SUPER ADMIN') || normalizedRoles.includes('SUPERADMIN') || workflowRoles.includes('superAdmin');
  
  // Extract user ID from multiple possible locations
  const userId = userInfo?.Username?.[0] || 
                 userInfo?.username || 
                 userInfo?.userId || 
                 userInfo?.id || 
                 userInfo?.Id || 
                 userInfo?.email?.split('@')[0] ||
                 '';
  
  // Check ownership - for DRAFT status, allow if user is Preparer (loosen the ownership check)
  // In DRAFT, any Budget Preparer should be able to attach since they're creating it
  const isOwner = proposal?.status === 'DRAFT' ? isPreparer : 
                  (String(proposal?.processBy || '').toLowerCase() === String(userId || '').toLowerCase());
  
  // Determine if user can attach files based on proposal status and their role
  const canAttachFiles = () => {
    const status = proposal?.status || '';
    
    // Super admins can always attach
    if (isSuperAdmin) {
      return true;
    }
    
    // DRAFT - Only Budget Preparer can attach
    if (status === 'DRAFT') {
      if (isPreparer) {
        return true;
      }
    }
    
    // FORWARDED_TO_REVIEWER - Budget Preparer (owner) can still add docs, or Reviewer can
    if (status === 'FORWARDED_TO_REVIEWER' && ((isPreparer && isOwner) || isReviewer)) return true;
    
    // FORWARDED_TO_APPROVER - Reviewer or Approver can attach
    if (status === 'FORWARDED_TO_APPROVER' && (isReviewer || isApprover)) return true;
    
    // FORWARDED_TO_BRD_ANALYST - Approver or Analyst can attach
    if (status === 'FORWARDED_TO_BRD_ANALYST' && (isApprover || normalizedRoles.includes('BUDGET_PLANNING_ANALYST') || normalizedRoles.includes('BUDGET PLANNING ANALYST'))) return true;
    
    // FORWARDED_TO_BRD_OFFICER - Officer can attach
    if (status === 'FORWARDED_TO_BRD_OFFICER' && (normalizedRoles.includes('BUDGET_OFFICER') || normalizedRoles.includes('BUDGET OFFICER') || isManager)) return true;
    
    // FORWARDED_TO_BRD_MANAGER - Manager can attach
    if (status === 'FORWARDED_TO_BRD_MANAGER' && isManager) return true;
    
    // RETURNED statuses - whoever it was returned to can attach
    if (status === 'RETURNED_TO_PREPARER' && isPreparer && isOwner) return true;
    if (status === 'RETURNED_TO_REVIEWER' && isReviewer) return true;
    if (status === 'RETURNED_TO_APPROVER' && isApprover) return true;
    if (status === 'RETURNED_TO_PLANNING_ANALYST' && (normalizedRoles.includes('BUDGET_PLANNING_ANALYST') || normalizedRoles.includes('BUDGET PLANNING ANALYST'))) return true;
    if (status === 'RETURNED_TO_OFFICER' && (normalizedRoles.includes('BUDGET_OFFICER') || normalizedRoles.includes('BUDGET OFFICER'))) return true;
    
    // FINALIZED - No one can attach (read-only)
    if (status === 'FINALIZED') return false;
    
    return false;
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const allowed = ['application/pdf', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (!allowed.includes(file.type)) {
      toast.error('Only PDF and Excel files are allowed');
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const resp = await api.post(`/api/allproposal/proposals/${proposal._id}/attachments?module=${moduleName}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Attachment uploaded');
      
      // Fetch the updated proposal from server to get all attachments
      try {
        const proposalRes = await api.get(`/api/allproposal/proposals/${proposal._id}`);
        const proposalData = proposalRes.data?.data || proposalRes.data;
        if (proposalData && proposalData.attachments) {
          setAttachments(proposalData.attachments);
          // Call onChange with updated proposal so parent updates too
          if (onChange) onChange(proposalData);
        }
      } catch (fetchErr) {
        // If fetch fails, at least add the attachment to local state
        const att = resp.data.attachment;
        setAttachments(prev => [ ...(prev || []), att ]);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload attachment');
    } finally {
      setUploading(false);
      // clear input value
      e.target.value = null;
    }
  };

  const handleDelete = async (att) => {
    if (!window.confirm('Delete this attachment?')) return;
    try {
      await api.delete(`/api/allproposal/proposals/${proposal._id}/attachments/${att.attachmentId || att._id}`);
      setAttachments(prev => prev.filter(a => String(a.attachmentId || a._id) !== String(att.attachmentId || att._id)));
      toast.success('Attachment deleted');
      if (onChange) onChange({ deleted: att });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete attachment');
    }
  };

  const handleDownload = async (att) => {
    try {
      const response = await api.get(`/uploads/${att.filename}`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', att.originalName || att.filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Failed to download file');
    }
  };

  if (!attachments && !canAttachFiles()) return null;

  const filtered = (attachments || []).filter(a => (a.module || 'general') === moduleName);
  
  // Debug info (can be removed later)
  const debugInfo = {
    status: proposal?.status,
    canAttach: canAttachFiles(),
    isPreparer,
    isReviewer,
    isApprover,
    isManager,
    isSuperAdmin,
    isOwner,
    userId,
    processBy: proposal?.processBy,
    draftCheck: proposal?.status === 'DRAFT' ? 'true (DRAFT status)' : 'false (not DRAFT)'
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="subtitle2">Supporting Documents</Typography>
        {canAttachFiles() && (
          <Box>
            <input
              type="file"
              accept=".pdf,.xls,.xlsx,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              id={`attach-file-${moduleName}`}
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <label htmlFor={`attach-file-${moduleName}`}>
              <Button component="span" variant="outlined" startIcon={<UploadFileIcon />} size="small" disabled={uploading}>
                {uploading ? 'Uploading...' : 'Attach File'}
              </Button>
            </label>
          </Box>
        )}
      </Box>
      
      {/* Debug Helper - shows why upload is disabled */}
      {!canAttachFiles() && filtered.length === 0 && (
        <Box sx={{ backgroundColor: '#fff3cd', p: 1, borderRadius: 0.5, border: '1px solid #ffc107' }}>
          <Typography variant="caption" sx={{ fontSize: '0.75rem', display: 'block', mb: 0.5 }}>
            ℹ️ Status: <strong>{debugInfo.status || 'Unknown'}</strong> | Role: <strong>{isPreparer ? 'Preparer' : isReviewer ? 'Reviewer' : isApprover ? 'Approver' : isManager ? 'Manager' : 'Other'}</strong>
          </Typography>
          <Typography variant="caption" sx={{ fontSize: '0.7rem', color: '#666', display: 'block' }}>
            Can Attach: <strong>{debugInfo.canAttach ? 'Yes ✅' : 'No ❌'}</strong> | Is Owner (DRAFT check): <strong>{debugInfo.draftCheck}</strong>
          </Typography>
          <Typography variant="caption" sx={{ fontSize: '0.7rem', color: '#999', display: 'block' }}>
            User ID: {debugInfo.userId} | ProcessBy: {debugInfo.processBy}
          </Typography>
        </Box>
      )}
      
      <List dense>
        {filtered.length === 0 && (
          <Typography variant="caption" color="text.secondary">No supporting documents</Typography>
        )}
        {filtered.map((att) => (
          <ListItem key={att.attachmentId || att._id} sx={{ pl: 0 }}>
            <ListItemText
              primary={att.originalName || att.filename}
              secondary={(new Date(att.uploadedAt)).toLocaleString()} 
            />
            <ListItemSecondaryAction>
              <Tooltip title="Download">
                <IconButton 
                  size="small" 
                  onClick={() => handleDownload(att)}
                >
                  {att.mimeType === 'application/pdf' ? <PictureAsPdfIcon /> : <InsertDriveFileIcon />}
                </IconButton>
              </Tooltip>
              {(canAttachFiles() || isSuperAdmin) && (
                <Tooltip title="Delete">
                  <IconButton size="small" onClick={() => handleDelete(att)}><DeleteIcon /></IconButton>
                </Tooltip>
              )}
            </ListItemSecondaryAction>
          </ListItem>
        ))}
      </List>
    </Box>
  );
};

export default ProposalAttachments;
