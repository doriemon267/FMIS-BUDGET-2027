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
  
  const isPreparer = normalizedRoles.includes('BUDGET PREPARER') || normalizedRoles.includes('BUDGET_PREPARER');
  const isReviewer = normalizedRoles.includes('BUDGET REVIEWER') || normalizedRoles.includes('BUDGET_REVIEWER');
  const isApprover = normalizedRoles.includes('BUDGET APPROVER') || normalizedRoles.includes('BUDGET_APPROVER');
  const isManager = normalizedRoles.includes('BUDGET MANAGER') || normalizedRoles.includes('BUDGET_MANAGER');
  const isPlanningAnalyst = normalizedRoles.includes('BUDGET_PLANNING_ANALYST') || normalizedRoles.includes('BUDGET PLANNING ANALYST');
  const isBudgetOfficer = normalizedRoles.includes('BUDGET_OFFICER') || normalizedRoles.includes('BUDGET OFFICER');
  const isSuperAdmin = normalizedRoles.includes('SUPER ADMIN') || normalizedRoles.includes('SUPERADMIN') || normalizedRoles.includes('SUPER_ADMIN');
  
  // Extract user ID from multiple possible locations
  const userId = userInfo?.Username?.[0] || 
                 userInfo?.username || 
                 userInfo?.userId || 
                 userInfo?.id || 
                 userInfo?.Id || 
                 userInfo?.email?.split('@')[0] ||
                 '';

  const normalizeWorkflowStatus = (status) => {
    const raw = String(status || '').trim().toUpperCase();
    const statusMap = {
      'DRAFT': 'DRAFT',
      'FINALIZED': 'FINALIZED',
      'FORWARDED TO REVIEWER': 'FORWARDED_TO_REVIEWER',
      'FORWARDED TO APPROVER': 'FORWARDED_TO_APPROVER',
      'FORWARDED TO BUDGET PLANNING ANALYST': 'FORWARDED_TO_BRD_ANALYST',
      'FORWARDED TO BUDGET OFFICER': 'FORWARDED_TO_BRD_OFFICER',
      'FORWARDED TO OVERALL BUDGET APPROVER': 'FORWARDED_TO_BRD_MANAGER',
      'RETURNED TO PREPARER': 'RETURNED_TO_PREPARER',
      'RETURNED TO REVIEWER': 'RETURNED_TO_REVIEWER',
      'RETURNED TO APPROVER': 'RETURNED_TO_APPROVER',
      'RETURNED TO BUDGET PLANNING ANALYST': 'RETURNED_TO_PLANNING_ANALYST',
      'RETURNED TO BUDGET OFFICER': 'RETURNED_TO_OFFICER',
    };

    return statusMap[raw] || raw.replace(/\s+/g, '_');
  };

  const workflowStatus = normalizeWorkflowStatus(proposal?.status);
  
  // Check ownership - for DRAFT status, allow if user is Preparer (loosen the ownership check)
  // In DRAFT, any Budget Preparer should be able to attach since they're creating it
  const isOwner = workflowStatus === 'DRAFT' ? isPreparer : 
                  (String(proposal?.processBy || '').toLowerCase() === String(userId || '').toLowerCase());
  
  // Determine if user can attach files based on proposal status and their role
  const canAttachFiles = () => {
    const statusUpper = workflowStatus;

    if (statusUpper === 'FINALIZED') return false;
    if (isSuperAdmin) return true;

    if ((statusUpper === 'DRAFT' || statusUpper === 'RETURNED_TO_PREPARER') && isPreparer && isOwner) return true;
    if ((statusUpper === 'FORWARDED_TO_REVIEWER' || statusUpper === 'RETURNED_TO_REVIEWER') && isReviewer) return true;
    if ((statusUpper === 'FORWARDED_TO_APPROVER' || statusUpper === 'RETURNED_TO_APPROVER') && isApprover) return true;
    if ((statusUpper === 'FORWARDED_TO_BRD_ANALYST' || statusUpper === 'RETURNED_TO_PLANNING_ANALYST') && isPlanningAnalyst) return true;
    if ((statusUpper === 'FORWARDED_TO_BRD_OFFICER' || statusUpper === 'RETURNED_TO_OFFICER') && isBudgetOfficer) return true;
    if (statusUpper === 'FORWARDED_TO_BRD_MANAGER' && isManager) return true;

    return false;
  };

  const canDeleteFilesByStatus = () => {
    return canAttachFiles();
  };

  const canDeleteAttachments = canDeleteFilesByStatus();

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

  const [dragOver, setDragOver] = useState(false);

  const uploadFile = async (file) => {
    const allowed = ['application/pdf', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (!allowed.includes(file.type)) {
      toast.error('Only PDF and Excel files are allowed');
      return;
    }
    
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast.error(`File is too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Maximum allowed size is 10MB.`);
      return;
    }
    
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const resp = await api.post(`/api/allproposal/proposals/${proposal._id}/attachments?module=${moduleName}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Attachment uploaded successfully');
      
      try {
        const proposalRes = await api.get(`/api/allproposal/proposals/${proposal._id}`);
        const proposalData = proposalRes.data?.data || proposalRes.data;
        if (proposalData && proposalData.attachments) {
          setAttachments(proposalData.attachments);
          if (onChange) onChange(proposalData);
        }
      } catch (fetchErr) {
        const att = resp.data.attachment;
        setAttachments(prev => [ ...(prev || []), att ]);
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message || '';
      toast.error(errorMsg || 'Failed to upload attachment');
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (canAttachFiles()) {
      setDragOver(true);
    }
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setDragOver(false);
    if (!canAttachFiles()) return;
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await uploadFile(file);
    }
  };

  if (!attachments && !canAttachFiles()) return null;

  const filtered = (attachments || []).filter(a => (a.module || 'general') === moduleName);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography 
          variant="subtitle2" 
          sx={{ 
            fontWeight: 700, 
            color: '#2d5016', 
            fontSize: '0.9rem', 
            textTransform: 'uppercase', 
            letterSpacing: '0.5px',
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}
        >
          Supporting Documents
        </Typography>
      </Box>

      {/* Modern Drag & Drop Zone */}
      {canAttachFiles() && (
        <Box
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => document.getElementById(`attach-file-${moduleName}`).click()}
          sx={{
            border: `2px dashed ${dragOver ? '#2d5016' : 'rgba(45, 80, 22, 0.25)'}`,
            borderRadius: '12px',
            bgcolor: dragOver ? 'rgba(45, 80, 22, 0.05)' : 'rgba(0, 0, 0, 0.015)',
            p: 3,
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease-in-out',
            boxShadow: dragOver ? '0 0 16px rgba(45, 80, 22, 0.08)' : 'none',
            '&:hover': {
              borderColor: '#2d5016',
              bgcolor: 'rgba(45, 80, 22, 0.025)'
            }
          }}
        >
          <input
            type="file"
            accept=".pdf,.xls,.xlsx,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            id={`attach-file-${moduleName}`}
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadFile(file);
              e.target.value = null;
            }}
          />
          {uploading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
              <CircularProgress size={28} sx={{ color: '#2d5016' }} />
              <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                Uploading attachment...
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <UploadFileIcon sx={{ fontSize: 36, color: '#2d5016', opacity: 0.85 }} />
              <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                Drag & drop document here, or <span style={{ color: '#2d5016', textDecoration: 'underline' }}>browse</span>
              </Typography>
              <Typography variant="caption" color="text.secondary">
                PDF or Excel files up to 10MB are supported
              </Typography>
            </Box>
          )}
        </Box>
      )}
      
      {/* Sleek File Cards List */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {filtered.length === 0 && (
          <Box sx={{ p: 2, textAlign: 'center', bgcolor: 'rgba(0,0,0,0.01)', border: '1px dashed rgba(0,0,0,0.08)', borderRadius: '8px' }}>
            <Typography variant="caption" color="text.secondary">No supporting documents attached for this section.</Typography>
          </Box>
        )}
        
        {filtered.map((att) => {
          const isPdf = att.mimeType === 'application/pdf';
          return (
            <Box
              key={att.attachmentId || att._id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                p: 1.5,
                bgcolor: 'white',
                border: '1px solid rgba(0,0,0,0.06)',
                borderRadius: '8px',
                transition: 'all 0.2s',
                '&:hover': {
                  boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
                  borderColor: '#2d5016',
                }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box
                  sx={{
                    p: 0.75,
                    borderRadius: '6px',
                    bgcolor: isPdf ? 'rgba(211, 47, 47, 0.06)' : 'rgba(46, 125, 50, 0.06)',
                    color: isPdf ? '#d32f2f' : '#2e7d32',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {isPdf ? <PictureAsPdfIcon fontSize="small" /> : <InsertDriveFileIcon fontSize="small" />}
                </Box>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', wordBreak: 'break-all', fontSize: '0.85rem' }}>
                    {att.originalName || att.filename}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, fontSize: '0.75rem' }}>
                    Uploaded on {new Date(att.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(att.uploadedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {isPdf && (
                  <Tooltip title="Preview PDF">
                    <IconButton size="small" onClick={() => handleView(att)} sx={{ color: '#035388', '&:hover': { bgcolor: 'rgba(3, 83, 136, 0.06)' } }}>
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title="Download File">
                  <IconButton size="small" onClick={() => handleDownload(att)} sx={{ color: '#2d5016', '&:hover': { bgcolor: 'rgba(45, 80, 22, 0.06)' } }}>
                    <DownloadIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                {canDeleteAttachments && (
                  <Tooltip title="Delete Document">
                    <IconButton size="small" onClick={() => handleDelete(att)} sx={{ color: '#d32f2f', '&:hover': { bgcolor: 'rgba(211, 47, 47, 0.06)' } }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* PDF View Dialog */}
      <Dialog
        open={viewDialogOpen}
        onClose={handleCloseView}
        maxWidth="md"
        fullWidth
        slotProps={{
          backdrop: {
            sx: {
              backdropFilter: "blur(4px)",
              backgroundColor: "rgba(0, 0, 0, 0.4)",
            }
          }
        }}
        PaperProps={{ sx: { minHeight: '80vh', borderRadius: '16px' } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 'bold' }}>
          <PictureAsPdfIcon sx={{ color: '#d32f2f' }} /> {viewAttachment?.originalName || viewAttachment?.filename || 'Document'}
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0, display: 'flex', flexDirection: 'column', minHeight: 400 }}>
          {viewLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, minHeight: 400 }}>
              <CircularProgress sx={{ color: '#2d5016' }} />
            </Box>
          )}
          {!viewLoading && viewBlobUrl && (
            <Box component="iframe" src={viewBlobUrl} title={viewAttachment?.originalName} sx={{ flex: 1, minHeight: 480, border: 'none' }} />
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleCloseView} sx={{ color: 'text.secondary' }}>Close</Button>
          {viewAttachment && (
            <Button startIcon={<DownloadIcon />} variant="contained" onClick={() => { handleDownload(viewAttachment); }} sx={{ bgcolor: '#2d5016', '&:hover': { bgcolor: '#1e3a0f' } }}>
              Download PDF
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProposalAttachments;
