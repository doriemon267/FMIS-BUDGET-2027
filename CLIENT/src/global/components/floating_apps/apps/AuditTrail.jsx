import { useState, useEffect } from 'react';
import { Box, Typography, List, ListItem, Chip, TextField, Select, MenuItem, Button, CircularProgress, Dialog, DialogTitle, DialogContent } from '@mui/material';
import { FiShield, FiUser, FiEdit, FiTrash2, FiDownload, FiFilter } from 'react-icons/fi';
import { useTheme, useMediaQuery } from '@mui/material';
import { api } from '../../../services/api';

export default function AuditTrail() {
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'));

  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [filterUser, setFilterUser] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetchAuditLogs();
    fetchUsers();
  }, []);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/audit-trail', { params: { limit: 100 } });
      if (response?.data?.logs) {
        setAuditLogs(response.data.logs);
      }
    } catch (e) {
      console.error('[AuditTrail] Failed to fetch logs:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await api.get('/api/users');
      if (response?.data) {
        setUsers(response.data);
      }
    } catch (e) {
      console.error('[AuditTrail] Failed to fetch users:', e);
    }
  };

  const exportLogs = async () => {
    try {
      const response = await api.get('/api/audit-trail/export', { params: { format: 'csv' }, responseType: 'blob' });
      const url = window.URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-trail-${new Date().toISOString()}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('[AuditTrail] Export failed:', e);
    }
  };

  const getActionIcon = (action) => {
    const props = { size: 14 };
    switch (action) {
      case 'create': return <FiEdit {...props} />;
      case 'update': return <FiEdit {...props} />;
      case 'delete': return <FiTrash2 {...props} />;
      default: return <FiUser {...props} />;
    }
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'create': return '#43a047';
      case 'update': return '#0066cc';
      case 'delete': return '#d32f2f';
      default: return '#f57c00';
    }
  };

  const filtered = auditLogs.filter(log => {
    if (filterType !== 'all' && log.action !== filterType) return false;
    if (filterUser && log.userId !== filterUser) return false;
    return true;
  });

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
        <FiShield size={20} />
        <Typography variant='subtitle1'>Audit Trail</Typography>
      </Box>

      {/* Filters */}
      <Box sx={{ p: 1.5, borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: 1 }}>
        <Select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          size='small'
          sx={{ flex: 1, bgcolor: 'rgba(255,255,255,0.05)', color: '#eee' }}
        >
          <MenuItem value='all'>All Actions</MenuItem>
          <MenuItem value='create'>Create</MenuItem>
          <MenuItem value='update'>Update</MenuItem>
          <MenuItem value='delete'>Delete</MenuItem>
        </Select>
        <Select
          value={filterUser}
          onChange={(e) => setFilterUser(e.target.value)}
          size='small'
          displayEmpty
          sx={{ flex: 1, bgcolor: 'rgba(255,255,255,0.05)', color: '#eee' }}
        >
          <MenuItem value=''>All Users</MenuItem>
          {users.map(u => (
            <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>
          ))}
        </Select>
        <Button
          size='small'
          onClick={exportLogs}
          startIcon={<FiDownload size={14} />}
          sx={{ color: '#aaa' }}
        >
          Export
        </Button>
      </Box>

      {/* Logs List */}
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
            <FiShield size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
            <Typography variant='body2'>No audit logs</Typography>
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
            {filtered.map((log, idx) => (
              <ListItem
                key={log.id || idx}
                onClick={() => {
                  setSelectedLog(log);
                  setDialogOpen(true);
                }}
                sx={{
                  bgcolor: idx % 2 === 0 ? 'rgba(0,0,0,0.1)' : 'transparent',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  p: 1.5,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                }}
              >
                <Box sx={{ display: 'flex', gap: 1.5, width: '100%', alignItems: 'center' }}>
                  <Box sx={{ color: getActionColor(log.action), mt: 0.25 }}>
                    {getActionIcon(log.action)}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant='body2' sx={{ fontWeight: 600, mb: 0.25 }}>
                      {log.resource} - {log.action}
                    </Typography>
                    <Typography variant='caption' sx={{ color: 'rgba(255,255,255,0.7)', display: 'block', mb: 0.25 }}>
                      by {log.userName || log.userId}
                    </Typography>
                    <Typography variant='caption' sx={{ color: 'rgba(255,255,255,0.5)' }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </Typography>
                  </Box>
                  <Chip
                    label={log.action}
                    size='small'
                    sx={{
                      height: 18,
                      fontSize: '10px',
                      bgcolor: getActionColor(log.action),
                      color: '#fff'
                    }}
                  />
                </Box>
              </ListItem>
            ))}
          </List>
        )}
      </Box>

      {/* Detail Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth='sm' fullWidth>
        {selectedLog && (
          <>
            <DialogTitle>{selectedLog.action.toUpperCase()} - {selectedLog.resource}</DialogTitle>
            <DialogContent sx={{ pt: 2 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box>
                  <Typography variant='caption' sx={{ color: 'rgba(0,0,0,0.6)' }}>User</Typography>
                  <Typography variant='body2'>{selectedLog.userName || selectedLog.userId}</Typography>
                </Box>
                <Box>
                  <Typography variant='caption' sx={{ color: 'rgba(0,0,0,0.6)' }}>Timestamp</Typography>
                  <Typography variant='body2'>{new Date(selectedLog.timestamp).toLocaleString()}</Typography>
                </Box>
                <Box>
                  <Typography variant='caption' sx={{ color: 'rgba(0,0,0,0.6)' }}>Resource</Typography>
                  <Typography variant='body2'>{selectedLog.resource} ({selectedLog.resourceId})</Typography>
                </Box>
                {selectedLog.changes && (
                  <Box>
                    <Typography variant='caption' sx={{ color: 'rgba(0,0,0,0.6)' }}>Changes</Typography>
                    <Box sx={{ mt: 0.5, p: 1, bgcolor: 'rgba(0,0,0,0.05)', borderRadius: 1, fontFamily: 'monospace', fontSize: '12px', maxHeight: 200, overflowY: 'auto' }}>
                      <pre>{JSON.stringify(selectedLog.changes, null, 2)}</pre>
                    </Box>
                  </Box>
                )}
              </Box>
            </DialogContent>
          </>
        )}
      </Dialog>
    </Box>
  );
}
