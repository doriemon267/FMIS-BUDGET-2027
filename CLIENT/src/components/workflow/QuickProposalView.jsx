import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Divider,
  Grid,
  Chip,
  Stack,
  CircularProgress,
  Paper
} from '@mui/material';
import WorkflowStatusBadge from './WorkflowStatusBadge';
import CloseIcon from '@mui/icons-material/Close';

const QuickProposalView = ({ open, onClose, proposal }) => {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setLoading(true);
      setTimeout(() => setLoading(false), 300);
    }
  }, [open]);

  if (!proposal) return null;

  const formatCurrency = (value) => {
    const num = Number(value) || 0;
    return `₱${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" sx={{ flex: 1 }}>Quick View</Typography>
        <Button onClick={onClose} size="small" color="inherit">
          <CloseIcon />
        </Button>
      </DialogTitle>

      <DialogContent sx={{ maxHeight: '70vh', overflowY: 'auto' }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        )}
        {!loading && (
        <Stack spacing={2.5}>
          {/* Title */}
          <Box>
            <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 'bold', textTransform: 'uppercase' }}>
              Proposal Title
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 500 }}>
              {proposal.title || 'Untitled'}
            </Typography>
          </Box>

          <Divider />

          {/* Status & Fiscal Year */}
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 'bold', textTransform: 'uppercase' }}>
                Status
              </Typography>
              <Box sx={{ mt: 0.5 }}>
                <WorkflowStatusBadge status={proposal.status} />
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 'bold', textTransform: 'uppercase' }}>
                Fiscal Year
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 500 }}>
                {proposal.fiscalYear}
              </Typography>
            </Grid>
          </Grid>

          {/* Region & Department */}
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 'bold', textTransform: 'uppercase' }}>
                Region
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 500 }}>
                {proposal.region || '—'}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 'bold', textTransform: 'uppercase' }}>
                Department
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 500 }}>
                {proposal.department || '—'}
              </Typography>
            </Grid>
          </Grid>

          {/* Division & Budget Type */}
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 'bold', textTransform: 'uppercase' }}>
                Division
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 500 }}>
                {proposal.division || '—'}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 'bold', textTransform: 'uppercase' }}>
                Budget Type
              </Typography>
              <Chip label={proposal.budgetType} size="small" sx={{ mt: 0.5 }} />
            </Grid>
          </Grid>

          <Divider />

          {/* Budget Summary */}
          <Box>
            <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 'bold', textTransform: 'uppercase', display: 'block', mb: 1.5 }}>
              Budget Summary
            </Typography>
            
            <Stack spacing={1.5}>
              {/* Projected Subsidy */}
              {proposal.projectedSubsidy > 0 && (
                <Paper sx={{ p: 1.5, bgcolor: '#e3f2fd', border: 'none' }}>
                  <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.5 }}>Projected Subsidy</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1565c0' }}>
                    {formatCurrency(proposal.projectedSubsidy)}
                  </Typography>
                </Paper>
              )}

              {/* Projected Corporate Income */}
              {proposal.projectedCorporateIncome > 0 && (
                <Paper sx={{ p: 1.5, bgcolor: '#f0f4c3', border: 'none' }}>
                  <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.5 }}>Projected Corporate Income</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#558b2f' }}>
                    {formatCurrency(proposal.projectedCorporateIncome)}
                  </Typography>
                </Paper>
              )}

              {/* Total Expenses */}
              {proposal.totalExpenses > 0 && (
                <Paper sx={{ p: 1.5, bgcolor: '#fff3e0', border: 'none' }}>
                  <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.5 }}>Total Expenses</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#e65100' }}>
                    {formatCurrency(proposal.totalExpenses)}
                  </Typography>
                </Paper>
              )}

              {/* Total Income */}
              {proposal.totalIncome > 0 && (
                <Paper sx={{ p: 1.5, bgcolor: '#f3e5f5', border: 'none' }}>
                  <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.5 }}>Total Income</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#6a1b9a' }}>
                    {formatCurrency(proposal.totalIncome)}
                  </Typography>
                </Paper>
              )}

              {/* Proposed Budget Total */}
              <Paper sx={{ p: 1.5, bgcolor: '#c8e6c9', border: '2px solid #2e7d32' }}>
                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.5, fontWeight: 'bold' }}>Total Proposed Budget</Typography>
                <Typography variant="body1" sx={{ fontWeight: 'bold', color: '#1b5e20', fontSize: '1.25rem' }}>
                  {formatCurrency(proposal.proposedBudget)}
                </Typography>
              </Paper>
            </Stack>
          </Box>

          <Divider />

          {/* Current Assignee & Status */}
          <Box>
            <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 'bold', textTransform: 'uppercase', display: 'block', mb: 1 }}>
              Workflow Status
            </Typography>
            <Grid container spacing={1.5}>
              {proposal.currentAssigneeRole && (
                <Grid item xs={6}>
                  <Paper sx={{ p: 1, bgcolor: '#fff3e0' }}>
                    <Typography variant="caption" color="textSecondary">Current Level</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500, mt: 0.5 }}>
                      {proposal.currentAssigneeRole}
                    </Typography>
                  </Paper>
                </Grid>
              )}
              {proposal.currentStep && (
                <Grid item xs={6}>
                  <Paper sx={{ p: 1, bgcolor: '#f3e5f5' }}>
                    <Typography variant="caption" color="textSecondary">Current Step</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500, mt: 0.5 }}>
                      {proposal.currentStep}
                    </Typography>
                  </Paper>
                </Grid>
              )}
            </Grid>
          </Box>
        </Stack>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="contained">Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default QuickProposalView;
