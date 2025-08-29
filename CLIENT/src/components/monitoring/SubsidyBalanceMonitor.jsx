import React, { useMemo } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  Alert
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import api from '../../config/api';

const SubsidyBalanceMonitor = ({ fiscalYear, budgetType }) => {
  // Fetch MOOE data
  const { data: mooeData } = useQuery({
    queryKey: ['mooe', fiscalYear, budgetType],
    queryFn: async () => {
      const response = await api.get('/mooe', {
        params: { fiscalYear, budgetType }
      });
      return response.data;
    },
    enabled: !!fiscalYear && !!budgetType
  });

  // Fetch Capital Outlay data
  const { data: capitalOutlayData } = useQuery({
    queryKey: ['capital-outlays', fiscalYear, budgetType],
    queryFn: async () => {
      const response = await api.get('/capital-outlays', {
        params: { fiscalYear, budgetType }
      });
      return response.data.capitalOutlays;
    },
    enabled: !!fiscalYear && !!budgetType
  });

  // Fetch Budgetary Support data
  const { data: budgetarySupportData } = useQuery({
    queryKey: ['budgetary-support', fiscalYear, budgetType],
    queryFn: async () => {
      const response = await api.get('/budgetary-support', {
        params: { fiscalYear, budgetType }
      });
      return response.data;
    },
    enabled: !!fiscalYear && !!budgetType
  });

  // Calculate subsidy totals
  const subsidyTotals = useMemo(() => {
    // Calculate MOOE subsidy total
    const mooeSubsidyTotal = mooeData?.formattedData
      ? mooeData.formattedData.reduce((sum, row) => {
          return sum + row.children.reduce((childSum, child) => {
            return childSum + (Number(child.subsidy) || 0);
          }, 0);
        }, 0)
      : 0;

    // Calculate Capital Outlay subsidy total
    const capitalOutlaySubsidyTotal = capitalOutlayData
      ? capitalOutlayData.reduce((sum, item) => sum + (Number(item.subsidy) || 0), 0)
      : 0;

    // Calculate Budgetary Support total (all of budgetary support is considered subsidy)
    const budgetarySupportTotal = budgetarySupportData && budgetarySupportData.length > 0
      ? budgetarySupportData.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
      : 0;

    // Calculate combined subsidy total
    const combinedSubsidyTotal = mooeSubsidyTotal + capitalOutlaySubsidyTotal;

    // Check if balanced
    const isBalanced = Math.abs(combinedSubsidyTotal - budgetarySupportTotal) < 0.01;

    return {
      mooeSubsidyTotal,
      capitalOutlaySubsidyTotal,
      combinedSubsidyTotal,
      budgetarySupportTotal,
      isBalanced
    };
  }, [mooeData, capitalOutlayData, budgetarySupportData]);

  // Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value || 0);
  };

  return (
    <Box sx={{ width: '100%', mb: 4 }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
        Subsidy Balance Monitoring
      </Typography>

      <TableContainer component={Paper} sx={{ boxShadow: 3 }}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: 'primary.main' }}>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Category</TableCell>
              <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>Amount</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {/* MOOE Subsidy */}
            <TableRow>
              <TableCell>MOOE Subsidy</TableCell>
              <TableCell align="right">
                ₱{formatCurrency(subsidyTotals.mooeSubsidyTotal)}
              </TableCell>
            </TableRow>

            {/* Capital Outlay Subsidy */}
            <TableRow>
              <TableCell>Capital Outlay Subsidy</TableCell>
              <TableCell align="right">
                ₱{formatCurrency(subsidyTotals.capitalOutlaySubsidyTotal)}
              </TableCell>
            </TableRow>

            {/* Combined Subsidy Total */}
            <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
              <TableCell sx={{ fontWeight: 'bold' }}>Combined Subsidy Total</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                ₱{formatCurrency(subsidyTotals.combinedSubsidyTotal)}
              </TableCell>
            </TableRow>

            {/* Budgetary Support */}
            <TableRow>
              <TableCell>Budgetary Support</TableCell>
              <TableCell align="right">
                ₱{formatCurrency(subsidyTotals.budgetarySupportTotal)}
              </TableCell>
            </TableRow>

            {/* Balance Status */}
            <TableRow sx={{ backgroundColor: subsidyTotals.isBalanced ? '#e8f5e9' : '#ffebee' }}>
              <TableCell colSpan={2} align="center">
                {subsidyTotals.isBalanced ? (
                  <Alert severity="success" sx={{ justifyContent: 'center' }}>
                    Subsidy is balanced with Budgetary Support
                  </Alert>
                ) : (
                  <Alert severity="error" sx={{ justifyContent: 'center' }}>
                    Subsidy is not balanced with Budgetary Support. 
                    Difference: ₱{formatCurrency(Math.abs(subsidyTotals.combinedSubsidyTotal - subsidyTotals.budgetarySupportTotal))}
                  </Alert>
                )}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default SubsidyBalanceMonitor;