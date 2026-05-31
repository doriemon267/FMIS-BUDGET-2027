import React, { useState, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Checkbox,
  Button,
  Alert,
  CircularProgress,
  Box,
  Paper,
  Typography,
  Divider
} from '@mui/material';
import api from '../config/api';

/**
 * OrganizationalInfoEditor
 * Modal dialog to edit organizational information for a BRD consolidation record
 * Allows BRD analysts to correct Division, Department, Office, and Central Office assignment
 */
const OrganizationalInfoEditor = ({ open, consolidationId, onClose, onSaved }) => {
  const theme = useTheme();
  const headerBg = theme.palette.mode === 'dark' ? '#0b2413' : '#2d5016';
  const titleColor = theme.palette.mode === 'dark' ? '#a5d6a7' : '#2d5016';

  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Form state
  const [division, setDivision] = useState('');
  const [department, setDepartment] = useState('');
  const [office, setOffice] = useState('');
  const [isCentralOffice, setIsCentralOffice] = useState(false);

  // Load consolidation record when dialog opens
  useEffect(() => {
    if (open && consolidationId) {
      loadRecord();
    }
  }, [open, consolidationId]);

  const loadRecord = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get(
        `/api/allproposal/consolidation/${consolidationId}`
      );

      if (response.data.success && response.data.data) {
        const data = response.data.data;
        setRecord(data);
        setDivision(data.division || '');
        setDepartment(data.department || '');
        setOffice(data.office || '');
        setIsCentralOffice(data.isCentralOffice || false);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load consolidation record');
      console.error('Error loading record:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const updateData = {};
      if (division !== record?.division) updateData.division = division;
      if (department !== record?.department) updateData.department = department;
      if (office !== record?.office) updateData.office = office;
      if (isCentralOffice !== record?.isCentralOffice) updateData.isCentralOffice = isCentralOffice;

      if (Object.keys(updateData).length === 0) {
        setSuccess('No changes to save');
        return;
      }

      const response = await api.put(
        `/api/allproposal/consolidation/${consolidationId}/org-info`,
        updateData
      );

      if (response.data.success) {
        setSuccess('Organizational information updated successfully!');
        setRecord(response.data.data);
        
        // Call parent callback
        if (onSaved) {
          onSaved(response.data.data);
        }

        // Close dialog after brief delay to show success message
        setTimeout(() => {
          handleClose();
        }, 1500);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update organizational information');
      console.error('Error saving:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setDivision('');
    setDepartment('');
    setOffice('');
    setIsCentralOffice(false);
    setRecord(null);
    setError(null);
    setSuccess(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1.5, bgcolor: headerBg, color: 'white', mb: 2 }}>
        Edit Organizational Information
      </DialogTitle>

      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {success && (
              <Alert severity="success" sx={{ mb: 2 }}>
                {success}
              </Alert>
            )}

            {record && (
              <>
                {/* Current Info Display */}
                <Paper sx={{ p: 2, mb: 2, bgcolor: theme.palette.mode === 'dark' ? 'background.default' : '#fcfdfa', border: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    Proposal: {record.proposalId?.title || 'N/A'}
                  </Typography>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="caption" display="block" sx={{ color: 'text.secondary' }}>
                    Region: {record.region || 'N/A'}
                  </Typography>
                  <Typography variant="caption" display="block" sx={{ color: 'text.secondary' }}>
                    Current Path: {record.consolidationPath || 'N/A'}
                  </Typography>
                </Paper>

                {/* Edit Form */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField
                    label="Division"
                    value={division}
                    onChange={(e) => setDivision(e.target.value)}
                    fullWidth
                    placeholder="e.g., ADMINISTRATIVE AND FINANCE DIVISION"
                    helperText="Primary organizational division"
                    disabled={saving}
                  />

                  <TextField
                    label="Department"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    fullWidth
                    placeholder="e.g., HEAD OFFICE"
                    helperText="Department within the division"
                    disabled={saving}
                  />

                  <TextField
                    label="Office (Optional)"
                    value={office}
                    onChange={(e) => setOffice(e.target.value)}
                    fullWidth
                    placeholder="e.g., CO, REGIONAL"
                    helperText="Office classification (Central Office, Regional, etc.)"
                    disabled={saving}
                  />

                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={isCentralOffice}
                        onChange={(e) => setIsCentralOffice(e.target.checked)}
                        disabled={saving}
                      />
                    }
                    label="Central Office Proposal"
                    sx={{ pt: 1 }}
                  />

                  {isCentralOffice && (
                    <Alert severity="info" sx={{ mt: 1 }}>
                      When marked as Central Office, the consolidation path will be:
                      <br />
                      <strong>CentralOffice/{department}</strong>
                    </Alert>
                  )}

                  {!isCentralOffice && (
                    <Alert severity="info" sx={{ mt: 1 }}>
                      When marked as Regional, the consolidation path will be:
                      <br />
                      <strong>{record.region}/{division}</strong>
                    </Alert>
                  )}
                </Box>
              </>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={handleClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={loading || saving}
          sx={{
            bgcolor: headerBg,
            "&:hover": {
              bgcolor: theme.palette.mode === 'dark' ? '#14331d' : '#1e3a0f',
            }
          }}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default OrganizationalInfoEditor;
