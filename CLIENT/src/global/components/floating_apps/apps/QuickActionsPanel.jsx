import { useState, useEffect } from 'react';
import { Box, Typography, Button, Card, Grid, Dialog, DialogTitle, DialogContent, TextField, Chip, CircularProgress } from '@mui/material';
import { FiZap, FiPlus, FiCheckCircle, FiClock, FiFileText, FiBarChart2 } from 'react-icons/fi';
import { useTheme, useMediaQuery } from '@mui/material';
import { api } from '../../../services/api';
import { useUser } from '../../../context/UserContext';

export default function QuickActionsPanel() {
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'));
  const { currentUser } = useUser();

  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAction, setSelectedAction] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionData, setActionData] = useState({});
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    fetchActions();
  }, []);

  const fetchActions = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/quick-actions');
      if (response?.data) {
        setActions(response.data);
      }
    } catch (e) {
      console.error('[QuickActionsPanel] Failed to fetch actions:', e);
    } finally {
      setLoading(false);
    }
  };

  const executeAction = async () => {
    if (!selectedAction) return;
    try {
      setExecuting(true);
      const response = await api.post(`/api/quick-actions/${selectedAction.id}/execute`, actionData);
      if (response?.data?.success) {
        // Show success toast
        window.dispatchEvent(new CustomEvent('toast', { detail: { message: selectedAction.successMessage || 'Action completed', type: 'success' } }));
        setDialogOpen(false);
        setActionData({});
        fetchActions();
      }
    } catch (e) {
      console.error('[QuickActionsPanel] Action failed:', e);
      window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'Action failed', type: 'error' } }));
    } finally {
      setExecuting(false);
    }
  };

  const getActionIcon = (type) => {
    const iconProps = { size: 20, style: { marginRight: 8 } };
    switch (type) {
      case 'submit': return <FiCheckCircle {...iconProps} />;
      case 'create': return <FiPlus {...iconProps} />;
      case 'approve': return <FiCheckCircle {...iconProps} />;
      case 'report': return <FiBarChart2 {...iconProps} />;
      default: return <FiZap {...iconProps} />;
    }
  };

  const getActionColor = (type) => {
    switch (type) {
      case 'submit': return '#0066cc';
      case 'create': return '#43a047';
      case 'approve': return '#43a047';
      case 'report': return '#f57c00';
      default: return '#9c27b0';
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', bgcolor: '#1a1a1e', color: '#eee' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#1a1a1e', color: '#eee', overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{ p: 1.5, borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 1 }}>
        <FiZap size={20} />
        <Typography variant='subtitle1'>Quick Actions</Typography>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
        {actions.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
            <FiZap size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
            <Typography variant='body2'>No actions available</Typography>
          </Box>
        ) : (
          <Grid container spacing={1.5}>
            {actions.map((action) => (
              <Grid item xs={12} key={action.id}>
                <Card
                  sx={{
                    bgcolor: 'rgba(0,0,0,0.3)',
                    border: `2px solid ${getActionColor(action.type)}22`,
                    p: 1.5,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': {
                      bgcolor: 'rgba(0,0,0,0.5)',
                      borderColor: getActionColor(action.type),
                      transform: 'translateY(-2px)'
                    }
                  }}
                  onClick={() => {
                    setSelectedAction(action);
                    setDialogOpen(true);
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                    <Box sx={{ color: getActionColor(action.type), mt: 0.25 }}>
                      {getActionIcon(action.type)}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant='body2' sx={{ fontWeight: 600, mb: 0.5 }}>
                        {action.label}
                      </Typography>
                      <Typography variant='caption' sx={{ color: 'rgba(255,255,255,0.7)', display: 'block', mb: 0.5 }}>
                        {action.description}
                      </Typography>
                      {action.badge && (
                        <Chip
                          label={action.badge}
                          size='small'
                          sx={{
                            height: 18,
                            fontSize: '10px',
                            bgcolor: getActionColor(action.type),
                            color: '#fff'
                          }}
                        />
                      )}
                    </Box>
                  </Box>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>

      {/* Action Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>{selectedAction?.label}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {selectedAction?.fields && selectedAction.fields.map((field) => (
            <TextField
              key={field.name}
              label={field.label}
              type={field.type || 'text'}
              multiline={field.multiline}
              rows={field.rows || 1}
              fullWidth
              value={actionData[field.name] || ''}
              onChange={(e) => setActionData({ ...actionData, [field.name]: e.target.value })}
              sx={{ mb: 2 }}
            />
          ))}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={() => { setDialogOpen(false); setActionData({}); }} variant='outlined'>Cancel</Button>
            <Button onClick={executeAction} variant='contained' disabled={executing}>
              {executing ? 'Executing...' : selectedAction?.label}
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
