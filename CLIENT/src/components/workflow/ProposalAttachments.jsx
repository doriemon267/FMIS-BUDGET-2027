import React, { useState, useEffect, useCallback } from 'react';
import { Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, IconButton, List, ListItem, ListItemText, ListItemSecondaryAction, Tooltip, Typography, CircularProgress } from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DeleteIcon from '@mui/icons-material/Delete';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DownloadIcon from '@mui/icons-material/Download';
import api from '../../config/api';
import { toast } from 'react-toastify';

const ProposalAttachments = ({ proposal, moduleName = 'general', userInfo, onChange }) => {
  const [attachments, setAttachments] = useState(() => proposal?.attachments || []);
  const [uploading, setUploading] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewAttachment, setViewAttachment] = useState(null);
  const [viewBlobUrl, setViewBlobUrl] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);

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
    const status = String(proposal?.status || '').trim();
    const statusUpper = status.toUpperCase();
    
    // FINALIZED - No one can attach (read-only), including Super Admin
    if (statusUpper === 'FINALIZED') {
      return false;
    }
    
    // Super admins can attach (except when Finalized, handled above)
    if (isSuperAdmin) {
      return true;
    }
    
    // DRAFT - Only Budget Preparer can attach
    if (statusUpper === 'DRAFT') {
      if (isPreparer) {
        return true;
      }
    }
    
    // FORWARDED_TO_REVIEWER - Budget Preparer (owner) can still add docs, or Reviewer can
    if (statusUpper === 'FORWARDED_TO_REVIEWER' && ((isPreparer && isOwner) || isReviewer)) return true;
    
    // FORWARDED_TO_APPROVER - Reviewer or Approver can attach
    if (statusUpper === 'FORWARDED_TO_APPROVER' && (isReviewer || isApprover)) return true;
    
    // FORWARDED_TO_BRD_ANALYST - Approver or Analyst can attach
    if (statusUpper === 'FORWARDED_TO_BRD_ANALYST' && (isApprover || normalizedRoles.includes('BUDGET_PLANNING_ANALYST') || normalizedRoles.includes('BUDGET PLANNING ANALYST'))) return true;
    
    // FORWARDED_TO_BRD_OFFICER - Officer can attach
    if (statusUpper === 'FORWARDED_TO_BRD_OFFICER' && (normalizedRoles.includes('BUDGET_OFFICER') || normalizedRoles.includes('BUDGET OFFICER') || isManager)) return true;
    
    // FORWARDED_TO_BRD_MANAGER - Manager can attach
    if (statusUpper === 'FORWARDED_TO_BRD_MANAGER' && isManager) return true;
    
    // RETURNED statuses - whoever it was returned to can attach
    if (statusUpper === 'RETURNED_TO_PREPARER' && isPreparer && isOwner) return true;
    if (statusUpper === 'RETURNED_TO_REVIEWER' && isReviewer) return true;
    if (statusUpper === 'RETURNED_TO_APPROVER' && isApprover) return true;
    if (statusUpper === 'RETURNED_TO_PLANNING_ANALYST' && (normalizedRoles.includes('BUDGET_PLANNING_ANALYST') || normalizedRoles.includes('BUDGET PLANNING ANALYST'))) return true;
    if (statusUpper === 'RETURNED_TO_OFFICER' && (normalizedRoles.includes('BUDGET_OFFICER') || normalizedRoles.includes('BUDGET OFFICER'))) return true;
    
    return false;
  };

  // At BRD Level, no one can delete attachments - view/download only
  const brdStatuses = ['FORWARDED_TO_BRD_ANALYST', 'FORWARDED_TO_BRD_OFFICER', 'FORWARDED_TO_BRD_MANAGER'];
  const isAtBRDLevel = brdStatuses.includes(String(proposal?.status || '').toUpperCase());
  const canDeleteAttachments = !isAtBRDLevel && canAttachFiles();

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const allowed = ['application/pdf', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (!allowed.includes(file.type)) {
      toast.error('Only PDF and Excel files are allowed');
      return;
    }
    
    // Check file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
      toast.error(`File is too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Maximum allowed size is 10MB.`);
      e.target.value = null;
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
      // Check for file size error (Multer returns 400 with file size message)
      const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message || '';
      if (errorMsg.toLowerCase().includes('file') && errorMsg.toLowerCase().includes('large')) {
        toast.error('File is too large. Maximum allowed size is 10MB.');
      } else {
        toast.error(errorMsg || 'Failed to upload attachment');
      }
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
      const response = await api.get(`/api/allproposal/uploads/${att.filename}`, {
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

  const handleCloseView = useCallback(() => {
    if (viewBlobUrl) {
      window.URL.revokeObjectURL(viewBlobUrl);
      setViewBlobUrl(null);
    }
    setViewAttachment(null);
    setViewDialogOpen(false);
  }, [viewBlobUrl]);

  const handleView = async (att) => {
    if (att.mimeType !== 'application/pdf') {
      toast.info('Preview available for PDF only. Use Download for Excel files.');
      return;
    }
    setViewLoading(true);
    setViewDialogOpen(true);
    setViewAttachment(att);
    setViewBlobUrl(null);
    try {
      const response = await api.get(`/api/allproposal/uploads/${att.filename}`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      setViewBlobUrl(url);
    } catch (err) {
      toast.error('Failed to load document');
      setViewDialogOpen(false);
      setViewAttachment(null);
    } finally {
      setViewLoading(false);
    }
  };

  if (!attachments && !canAttachFiles()) return null;

  const filtered = (attachments || []).filter(a => (a.module || 'general') === moduleName);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.primary' }}>Supporting Documents</Typography>
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
              {att.mimeType === 'application/pdf' && (
                <Tooltip title="View">
                  <IconButton size="small" onClick={() => handleView(att)}>
                    <VisibilityIcon />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="Download">
                <IconButton size="small" onClick={() => handleDownload(att)}>
                  <DownloadIcon />
                </IconButton>
              </Tooltip>
              {canDeleteAttachments && (
                <Tooltip title="Delete">
                  <IconButton size="small" onClick={() => handleDelete(att)}><DeleteIcon /></IconButton>
                </Tooltip>
              )}
            </ListItemSecondaryAction>
          </ListItem>
        ))}
      </List>

      <Dialog
        open={viewDialogOpen}
        onClose={handleCloseView}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { minHeight: '80vh' } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {viewAttachment?.originalName || viewAttachment?.filename || 'Document'}
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0, display: 'flex', flexDirection: 'column', minHeight: 400 }}>
          {viewLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, minHeight: 400 }}>
              <CircularProgress />
            </Box>
          )}
          {!viewLoading && viewBlobUrl && (
            <Box component="iframe" src={viewBlobUrl} title={viewAttachment?.originalName} sx={{ flex: 1, minHeight: 480, border: 'none' }} />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseView}>Close</Button>
          {viewAttachment && (
            <Button startIcon={<DownloadIcon />} variant="contained" onClick={() => { handleDownload(viewAttachment); }}>
              Download
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProposalAttachments;
