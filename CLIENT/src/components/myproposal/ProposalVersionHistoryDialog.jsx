import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip
} from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import { getVersionHistory } from '../../services/budgetOfficerEditService';

const formatCurrency = (raw) => {
  const value = Number(raw ?? 0);
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(Number.isFinite(value) ? value : 0);
};

const formatDate = (d) => {
  if (!d) return '—';
  const date = new Date(d);
  return Number.isFinite(date.getTime()) ? date.toLocaleString('en-PH', { dateStyle: 'short', timeStyle: 'short' }) : '—';
};

const ProposalVersionHistoryDialog = ({ open, onClose, proposalId }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    if (!open || !proposalId) {
      setData(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getVersionHistory(proposalId)
      .then((res) => {
        if (cancelled) return;
        const payload = res?.data ?? res;
        setData(payload);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.response?.data?.message || err?.message || 'Failed to load version history');
        setData(null);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, proposalId]);

  const proposal = data?.proposal || {};
  const original = data?.original || null;
  const revisions = data?.revisions || [];
  const hasOriginal = !!original?.snapshot;
  const hasRevisions = revisions.length > 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HistoryIcon /> Version History – Initial Budget Proposal
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {!loading && data && (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {proposal.title} • FY {proposal.fiscalYear} • {proposal.processBy}
            </Typography>
            {!hasOriginal && !hasRevisions && (
              <Alert severity="info">
                No version history recorded yet. The initial snapshot is captured when the proposal is first viewed at BRD.
              </Alert>
            )}
            {(hasOriginal || hasRevisions) && (
              <>
                <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 2 }}>
                  <Tab label="Summary" />
                  <Tab label="Original vs Revised" disabled={!hasOriginal || !hasRevisions.length} />
                </Tabs>
                {activeTab === 0 && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {hasOriginal && (
                      <Paper variant="outlined" sx={{ p: 2 }}>
                        <Typography variant="subtitle2" color="primary" gutterBottom>Original (as first received at BRD)</Typography>
                        <Typography variant="caption" display="block" color="text.secondary">
                          Captured: {formatDate(original.capturedAt)} • Status: {original.proposalStatusAtCapture || '—'}
                        </Typography>
                        {original.totals && (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                            <Chip size="small" label={`Income: ${formatCurrency(original.totals.totalIncome)}`} variant="outlined" />
                            <Chip size="small" label={`PS: ${formatCurrency(original.totals.totalPersonnel)}`} variant="outlined" />
                            <Chip size="small" label={`MOOE: ${formatCurrency(original.totals.totalMOOE)}`} variant="outlined" />
                            <Chip size="small" label={`CO: ${formatCurrency(original.totals.totalCapitalOutlay)}`} variant="outlined" />
                          </Box>
                        )}
                      </Paper>
                    )}
                    {revisions.map((rev, idx) => (
                      <Paper key={rev._id} variant="outlined" sx={{ p: 2 }}>
                        <Typography variant="subtitle2" color="secondary">Revision {idx + 1}</Typography>
                        <Typography variant="caption" display="block" color="text.secondary">
                          By: {rev.editedBy?.userName || '—'} • Submitted: {formatDate(rev.submittedAt)}
                          {rev.approvedAt && ` • Approved: ${formatDate(rev.approvedAt)}`}
                        </Typography>
                        {rev.comments && (
                          <Typography variant="body2" sx={{ mt: 0.5, fontStyle: 'italic' }}>{rev.comments}</Typography>
                        )}
                        {rev.changeSummary && (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                            {rev.changeSummary.income && (
                              <Chip size="small" label={`Income: +${rev.changeSummary.income.added} / ~${rev.changeSummary.income.modified} / −${rev.changeSummary.income.deleted}`} />
                            )}
                            {rev.changeSummary.personnelServices && (
                              <Chip size="small" label={`PS: +${rev.changeSummary.personnelServices.added} / ~${rev.changeSummary.personnelServices.modified} / −${rev.changeSummary.personnelServices.deleted}`} />
                            )}
                            {rev.changeSummary.mooe && (
                              <Chip size="small" label={`MOOE: +${rev.changeSummary.mooe.added} / ~${rev.changeSummary.mooe.modified} / −${rev.changeSummary.mooe.deleted}`} />
                            )}
                            {rev.changeSummary.capitalOutlay && (
                              <Chip size="small" label={`CO: +${rev.changeSummary.capitalOutlay.added} / ~${rev.changeSummary.capitalOutlay.modified} / −${rev.changeSummary.capitalOutlay.deleted}`} />
                            )}
                          </Box>
                        )}
                      </Paper>
                    ))}
                  </Box>
                )}
                {activeTab === 1 && hasOriginal && revisions.length > 0 && (
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Totals comparison: Original (at BRD receipt) vs latest revision.
                    </Typography>
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell><strong>Category</strong></TableCell>
                            <TableCell align="right">Original</TableCell>
                            <TableCell align="right">Revised (latest)</TableCell>
                            <TableCell align="right">Difference</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          <TableRow>
                            <TableCell>Income</TableCell>
                            <TableCell align="right">{formatCurrency(original.totals?.totalIncome)}</TableCell>
                            <TableCell align="right">—</TableCell>
                            <TableCell align="right">—</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Personnel Services</TableCell>
                            <TableCell align="right">{formatCurrency(original.totals?.totalPersonnel)}</TableCell>
                            <TableCell align="right">—</TableCell>
                            <TableCell align="right">—</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>MOOE</TableCell>
                            <TableCell align="right">{formatCurrency(original.totals?.totalMOOE)}</TableCell>
                            <TableCell align="right">—</TableCell>
                            <TableCell align="right">—</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Capital Outlay</TableCell>
                            <TableCell align="right">{formatCurrency(original.totals?.totalCapitalOutlay)}</TableCell>
                            <TableCell align="right">—</TableCell>
                            <TableCell align="right">—</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                    <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                      For full line-item comparison, use the proposal details view and comparison tables when available.
                    </Typography>
                  </Box>
                )}
              </>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

ProposalVersionHistoryDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  proposalId: PropTypes.string
};

export default ProposalVersionHistoryDialog;
