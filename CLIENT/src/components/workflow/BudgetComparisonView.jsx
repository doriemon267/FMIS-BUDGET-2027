import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  IconButton,
  Tooltip,
  Collapse,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  CompareArrows as CompareIcon,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import api from '../../config/api';

// Brand colors
const BRAND_COLORS = {
  darkGreen: '#375e38',
  deepGreen: '#2d5016',
  lightGreen: '#4CAF50',
  success: '#2e7d32',
  warning: '#ed6c02',
  error: '#d32f2f',
  info: '#0288d1',
};

const formatCurrency = (amount) => {
  return `₱${(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const BudgetComparisonView = ({ fiscalYear, region, regionName }) => {
  const [loading, setLoading] = useState(false);
  const [comparison, setComparison] = useState(null);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    const fetchComparison = async () => {
      if (!fiscalYear || !region) return;
      
      setLoading(true);
      try {
        const res = await api.get(`/api/budget-ceiling/comparison/${fiscalYear}/${encodeURIComponent(regionName || region)}`);
        if (res.data.success) {
          setComparison(res.data.data);
        }
      } catch (error) {
        console.error('Error fetching comparison:', error);
        // Don't show error for 404
        if (error.response?.status !== 404) {
          toast.error('Failed to fetch comparison data');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchComparison();
  }, [fiscalYear, region, regionName]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress size={24} sx={{ color: BRAND_COLORS.deepGreen }} />
      </Box>
    );
  }

  if (!comparison || !comparison.comparison || comparison.comparison.length === 0) {
    return null;
  }

  const { summary } = comparison;

  return (
    <Paper sx={{ mt: 2, borderRadius: 2, overflow: 'hidden' }}>
      {/* Header */}
      <Box 
        sx={{ 
          p: 2, 
          bgcolor: BRAND_COLORS.deepGreen, 
          color: '#fff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer'
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CompareIcon />
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Initial vs NEP Comparison - FY {fiscalYear}
          </Typography>
        </Box>
        <IconButton size="small" sx={{ color: '#fff' }}>
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        {/* Summary Cards */}
        <Box sx={{ display: 'flex', gap: 2, p: 2, bgcolor: '#f8f9fa', flexWrap: 'wrap' }}>
          <Paper sx={{ p: 2, flex: 1, minWidth: 180, bgcolor: '#e3f2fd', border: '1px solid #64b5f6' }}>
            <Typography sx={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase' }}>
              Total Initial
            </Typography>
            <Typography variant="h6" sx={{ color: BRAND_COLORS.info, fontWeight: 700 }}>
              {formatCurrency(summary?.totalInitial)}
            </Typography>
          </Paper>

          <Paper sx={{ p: 2, flex: 1, minWidth: 180, bgcolor: '#fff3e0', border: '1px solid #ffb74d' }}>
            <Typography sx={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase' }}>
              Total Ceiling
            </Typography>
            <Typography variant="h6" sx={{ color: BRAND_COLORS.warning, fontWeight: 700 }}>
              {formatCurrency(summary?.totalCeiling)}
            </Typography>
          </Paper>

          <Paper sx={{ p: 2, flex: 1, minWidth: 180, bgcolor: '#e8f5e9', border: '1px solid #66bb6a' }}>
            <Typography sx={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase' }}>
              Total NEP
            </Typography>
            <Typography variant="h6" sx={{ color: BRAND_COLORS.success, fontWeight: 700 }}>
              {formatCurrency(summary?.totalNep)}
            </Typography>
          </Paper>

          <Paper sx={{ 
            p: 2, 
            flex: 1, 
            minWidth: 180, 
            bgcolor: (summary?.totalCeiling - summary?.totalInitial) < 0 ? '#ffebee' : '#e8f5e9',
            border: `1px solid ${(summary?.totalCeiling - summary?.totalInitial) < 0 ? '#ef5350' : '#66bb6a'}`
          }}>
            <Typography sx={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase' }}>
              Variance (Ceiling - Initial)
            </Typography>
            <Typography variant="h6" sx={{ 
              color: (summary?.totalCeiling - summary?.totalInitial) < 0 ? BRAND_COLORS.error : BRAND_COLORS.success,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 0.5
            }}>
              {(summary?.totalCeiling - summary?.totalInitial) < 0 ? <TrendingDownIcon /> : <TrendingUpIcon />}
              {formatCurrency(Math.abs((summary?.totalCeiling || 0) - (summary?.totalInitial || 0)))}
            </Typography>
          </Paper>
        </Box>

        {/* Comparison Table */}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                <TableCell sx={{ fontWeight: 600, borderBottom: '2px solid #ddd' }}>Division</TableCell>
                <TableCell sx={{ fontWeight: 600, textAlign: 'right', borderBottom: '2px solid #ddd' }}>Initial</TableCell>
                <TableCell sx={{ fontWeight: 600, textAlign: 'right', borderBottom: '2px solid #ddd' }}>Ceiling</TableCell>
                <TableCell sx={{ fontWeight: 600, textAlign: 'right', borderBottom: '2px solid #ddd' }}>NEP</TableCell>
                <TableCell sx={{ fontWeight: 600, textAlign: 'right', borderBottom: '2px solid #ddd' }}>Variance</TableCell>
                <TableCell sx={{ fontWeight: 600, textAlign: 'center', borderBottom: '2px solid #ddd' }}>NEP Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {comparison.comparison.map((row, index) => {
                const variance = row.variance?.initialVsCeiling || 0;
                const variancePercent = row.initial.amount > 0 
                  ? ((variance / row.initial.amount) * 100).toFixed(1)
                  : 0;

                return (
                  <TableRow 
                    key={row.division || index}
                    sx={{ '&:hover': { bgcolor: '#fafafa' } }}
                  >
                    <TableCell>
                      <Typography sx={{ fontWeight: 500 }}>{row.division || row.department || 'N/A'}</Typography>
                    </TableCell>
                    <TableCell sx={{ textAlign: 'right' }}>
                      {formatCurrency(row.initial.amount)}
                    </TableCell>
                    <TableCell sx={{ textAlign: 'right', color: BRAND_COLORS.warning, fontWeight: 500 }}>
                      {formatCurrency(row.ceiling.amount)}
                    </TableCell>
                    <TableCell sx={{ textAlign: 'right', color: BRAND_COLORS.success, fontWeight: 500 }}>
                      {row.nep ? formatCurrency(row.nep.amount) : '-'}
                    </TableCell>
                    <TableCell sx={{ textAlign: 'right' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                        {variance < 0 ? (
                          <TrendingDownIcon sx={{ color: BRAND_COLORS.error, fontSize: 16 }} />
                        ) : variance > 0 ? (
                          <TrendingUpIcon sx={{ color: BRAND_COLORS.success, fontSize: 16 }} />
                        ) : null}
                        <Typography sx={{ 
                          color: variance < 0 ? BRAND_COLORS.error : variance > 0 ? BRAND_COLORS.success : '#666',
                          fontSize: '0.85rem'
                        }}>
                          {formatCurrency(Math.abs(variance))} ({variancePercent}%)
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>
                      {row.nep ? (
                        <Chip
                          size="small"
                          label={row.nep.status || 'Draft'}
                          color={
                            row.nep.status === 'Finalized' || row.nep.status === 'FINALIZED' ? 'success' :
                            row.nep.status?.includes('FORWARDED') ? 'primary' :
                            row.nep.status?.includes('RETURNED') ? 'warning' : 'default'
                          }
                        />
                      ) : (
                        <Chip size="small" label="Not Created" color="default" variant="outlined" />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {/* Totals Row */}
              <TableRow sx={{ bgcolor: '#f0f7f0' }}>
                <TableCell sx={{ fontWeight: 700, borderTop: '2px solid #ddd' }}>TOTAL</TableCell>
                <TableCell sx={{ fontWeight: 700, textAlign: 'right', borderTop: '2px solid #ddd' }}>
                  {formatCurrency(summary?.totalInitial)}
                </TableCell>
                <TableCell sx={{ fontWeight: 700, textAlign: 'right', color: BRAND_COLORS.warning, borderTop: '2px solid #ddd' }}>
                  {formatCurrency(summary?.totalCeiling)}
                </TableCell>
                <TableCell sx={{ fontWeight: 700, textAlign: 'right', color: BRAND_COLORS.success, borderTop: '2px solid #ddd' }}>
                  {formatCurrency(summary?.totalNep)}
                </TableCell>
                <TableCell sx={{ fontWeight: 700, textAlign: 'right', borderTop: '2px solid #ddd' }}>
                  {formatCurrency(Math.abs((summary?.totalCeiling || 0) - (summary?.totalInitial || 0)))}
                </TableCell>
                <TableCell sx={{ borderTop: '2px solid #ddd' }}></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Collapse>
    </Paper>
  );
};

export default BudgetComparisonView;
