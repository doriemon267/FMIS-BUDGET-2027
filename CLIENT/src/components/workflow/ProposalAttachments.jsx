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
  const isPreparer = normalizedRoles.includes('BUDGET PREPARER') || normalizedRoles.includes('BUDGET_PREPARER');
  const userId = userInfo?.Username?.[0] || userInfo?.userId || userInfo?.id || userInfo?.Id;
  const isOwner = String(proposal?.processBy || '').toLowerCase() === String(userId || '').toLowerCase();

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
      const resp = await api.post(`/api/proposals/${proposal._id}/attachments?module=${moduleName}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Attachment uploaded');
      const att = resp.data.attachment;
      setAttachments(prev => [ ...(prev || []), att ]);
      if (onChange) onChange(att);
    } catch (err) {
      console.error('Attachment upload error', err);
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
      await api.delete(`/api/proposals/${proposal._id}/attachments/${att.attachmentId || att._id}`);
      setAttachments(prev => prev.filter(a => String(a.attachmentId || a._id) !== String(att.attachmentId || att._id)));
      toast.success('Attachment deleted');
      if (onChange) onChange({ deleted: att });
    } catch (err) {
      console.error('Delete error', err);
      toast.error(err.response?.data?.message || 'Failed to delete attachment');
    }
  };

  if (!attachments && !isPreparer) return null;

  const filtered = (attachments || []).filter(a => (a.module || 'general') === moduleName);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="subtitle2">Supporting Documents</Typography>
        {(isPreparer && isOwner) && (
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
              <Tooltip title="Download">
                <IconButton size="small" component="a" href={att.url} target="_blank" rel="noopener noreferrer">
                  {att.mimeType === 'application/pdf' ? <PictureAsPdfIcon /> : <InsertDriveFileIcon />}
                </IconButton>
              </Tooltip>
              {(isPreparer || (userInfo?.Roles || []).includes('SUPER ADMIN')) && (
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
