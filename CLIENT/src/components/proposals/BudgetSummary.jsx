import React, { useMemo } from 'react';
import { Box, Typography, Paper, CircularProgress, Divider } from '@mui/material';

const BudgetSummary = ({ 
  personnelData, 
  mooeData, 
  capitalOutlayData, 
  incomeData,
  budgetarySupportData,
  isLoading
}) => {
  // Calculate budget totals including subsidy balance
  const budgetTotals = useMemo(() => {
    try {
      // Calculate Income totals
      const corporateIncome = Array.isArray(incomeData)
        ? incomeData.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
        : 0;

      // Calculate regular MOOE and IAs O&M Cost from formattedData
      let regularMooeIncome = 0;
      let regularMooeSubsidy = 0;
      let iasOMIncome = 0;
      let iasOMSubsidy = 0;
      if (mooeData?.formattedData) {
        mooeData.formattedData.forEach(row => {
          if (row.sublineItem === "Irrigators' Associations (IAs) Operation & Maintenance Cost") {
            row.children.forEach(child => {
              iasOMIncome += Number(child.income) || 0;
              iasOMSubsidy += Number(child.subsidy) || 0;
            });
          } else {
            row.children.forEach(child => {
              regularMooeIncome += Number(child.income) || 0;
              regularMooeSubsidy += Number(child.subsidy) || 0;
            });
          }
        });
      }
      // Combined MOOE totals
      const mooeIncome = regularMooeIncome + iasOMIncome;
      const mooeSubsidy = regularMooeSubsidy + iasOMSubsidy;

      // Calculate Capital Outlay income and subsidy
      const capitalOutlayIncome = Array.isArray(capitalOutlayData)
        ? capitalOutlayData.reduce((sum, item) => sum + (Number(item.income) || 0), 0)
        : 0;
      const capitalOutlaySubsidy = Array.isArray(capitalOutlayData)
        ? capitalOutlayData.reduce((sum, item) => sum + (Number(item.subsidy) || 0), 0)
        : 0;

      // Calculate Budgetary Support total (subsidy)
      const budgetarySupportTotal = Array.isArray(budgetarySupportData)
        ? budgetarySupportData.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
        : 0;

      // Calculate combined income total
      const combinedIncomeTotal = corporateIncome + mooeIncome + capitalOutlayIncome;
      // Calculate combined subsidy total
      const combinedSubsidyTotal = mooeSubsidy + capitalOutlaySubsidy;
      // Calculate income mismatch
      const incomeMismatch = Math.abs(combinedIncomeTotal - corporateIncome);
      // Calculate subsidy mismatch
      const subsidyMismatch = Math.abs(combinedSubsidyTotal - budgetarySupportTotal);

      return {
        corporateIncome,
        mooeIncome,
        mooeSubsidy,
        mooeBreakdown: {
          regular: {
            income: regularMooeIncome,
            subsidy: regularMooeSubsidy,
            total: regularMooeIncome + regularMooeSubsidy
          },
          iasOM: {
            income: iasOMIncome,
            subsidy: iasOMSubsidy,
            total: iasOMIncome + iasOMSubsidy
          },
          total: mooeIncome + mooeSubsidy
        },
        capitalOutlayIncome,
        capitalOutlaySubsidy,
        combinedIncomeTotal,
        combinedSubsidyTotal,
        budgetarySupportTotal,
        incomeMismatch,
        subsidyMismatch,
        isIncomeBalanced: incomeMismatch < 0.01,
        isSubsidyBalanced: subsidyMismatch < 0.01
      };
    } catch (error) {
      console.error("Error calculating budget totals:", error);
      return {
        corporateIncome: 0,
        mooeIncome: 0,
        capitalOutlayIncome: 0,
        combinedIncomeTotal: 0,
        mooeSubsidy: 0,
        capitalOutlaySubsidy: 0,
        combinedSubsidyTotal: 0,
        budgetarySupportTotal: 0,
        incomeMismatch: 0,
        subsidyMismatch: 0,
        isIncomeBalanced: false,
        isSubsidyBalanced: false
      };
    }
  }, [personnelData, mooeData, capitalOutlayData, budgetarySupportData, incomeData]);

  // Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value || 0);
  };

  return (
    <Paper 
      elevation={2} 
      sx={{ 
        mb: 3, 
        p: 2, 
        borderRadius: 2,
        backgroundColor: budgetTotals.isIncomeBalanced ? '#f5f5f5' : '#ffebee',
        position: 'relative'
      }}
    >
      {isLoading && (
        <Box 
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            backgroundColor: 'rgba(55, 94, 56, 0.1)',
            borderRadius: 1,
            px: 1,
            py: 0.5
          }}
        >
          <CircularProgress size={16} thickness={5} color="success" />
          <Typography variant="caption" color="text.secondary">
            Updating...
          </Typography>
        </Box>
      )}
      <Typography variant="h6" gutterBottom align="center" sx={{ 
        fontWeight: 'bold', 
        mb: 2,
        color: '#000000'
      }}>
        Budget Summary
      </Typography>
      {/* Income Section */}
      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
        gap: 2,
        mb: 2
      }}>
        <Box sx={{ 
          p: 1.5, 
          borderRadius: 1, 
          backgroundColor: '#fff',
          textAlign: 'center',
          border: '1px solid #e0e0e0'
        }}>
          <Typography variant="subtitle2" color="#000000" fontWeight="bold">Corporate Income</Typography>
          <Typography variant="h6" fontWeight="bold" color="#000000">
            ₱{formatCurrency(budgetTotals.corporateIncome)}
          </Typography>
        </Box>
        <Box sx={{ 
          p: 1.5, 
          borderRadius: 1, 
          backgroundColor: '#fff',
          textAlign: 'center',
          border: '1px solid #e0e0e0'
        }}>
          <Typography variant="subtitle2" color="#000000" fontWeight="bold">MOOE Income (Regular + IAs O & M COST)</Typography>
          <Typography variant="h6" fontWeight="bold" color="#000000">
            ₱{formatCurrency(budgetTotals.mooeBreakdown.regular.income + budgetTotals.mooeBreakdown.iasOM.income)}
          </Typography>
        </Box>
        <Box sx={{ 
          p: 1.5, 
          borderRadius: 1, 
          backgroundColor: '#fff',
          textAlign: 'center',
          border: '1px solid #e0e0e0'
        }}>
          <Typography variant="subtitle2" color="#000000" fontWeight="bold">Capital Outlay Income</Typography>
          <Typography variant="h6" fontWeight="bold" color="#000000">
            ₱{formatCurrency(budgetTotals.capitalOutlayIncome)}
          </Typography>
        </Box>
        <Box sx={{ 
          p: 1.5, 
          borderRadius: 1, 
          backgroundColor: '#fff',
          textAlign: 'center',
          border: '1px solid #e0e0e0'
        }}>
          <Typography variant="subtitle2" color="#000000" fontWeight="bold">Combined Income Total</Typography>
          <Typography variant="h6" fontWeight="bold" color="#000000">
            ₱{formatCurrency(budgetTotals.combinedIncomeTotal)}
          </Typography>
        </Box>
      </Box>
      {!budgetTotals.isIncomeBalanced && (
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          mb: 2
        }}>
          <Typography 
            variant="subtitle2" 
            color="error" 
            fontWeight="bold"
            sx={{ 
              display: 'flex', 
              alignItems: 'center',
              px: 2,
              py: 0.5,
              borderRadius: 1,
              backgroundColor: 'rgba(244, 67, 54, 0.1)'
            }}
          >
            <span style={{ marginRight: '4px' }}>🚨</span>
            Income mismatch: ₱{formatCurrency(budgetTotals.incomeMismatch)}
          </Typography>
        </Box>
      )}
      <Divider sx={{ my: 2 }} />
      {/* Subsidy Section */}
      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
        gap: 2,
        mb: 2
      }}>
        <Box sx={{ 
          p: 1.5, 
          borderRadius: 1, 
          backgroundColor: '#e8f5e9',
          textAlign: 'center',
          border: '1px solid #c8e6c9'
        }}>
          <Typography variant="subtitle2" color="#000000" fontWeight="bold">MOOE Subsidy (Regular + IAs O & M COST)</Typography>
          <Typography variant="h6" fontWeight="bold" color="#000000">
            ₱{formatCurrency(budgetTotals.mooeBreakdown.regular.subsidy + budgetTotals.mooeBreakdown.iasOM.subsidy)}
          </Typography>
        </Box>
        <Box sx={{ 
          p: 1.5, 
          borderRadius: 1, 
          backgroundColor: '#e3f2fd',
          textAlign: 'center',
          border: '1px solid #bbdefb'
        }}>
          <Typography variant="subtitle2" color="#000000" fontWeight="bold">Capital Outlay Subsidy</Typography>
          <Typography variant="h6" fontWeight="bold" color="#000000">
            ₱{formatCurrency(budgetTotals.capitalOutlaySubsidy)}
          </Typography>
        </Box>
        <Box sx={{ 
          p: 1.5, 
          borderRadius: 1, 
          backgroundColor: '#fff3e0',
          textAlign: 'center',
          border: '1px solid #ffe0b2'
        }}>
          <Typography variant="subtitle2" color="#000000" fontWeight="bold">Combined Subsidy Total</Typography>
          <Typography variant="h6" fontWeight="bold" color="#000000">
            ₱{formatCurrency(budgetTotals.combinedSubsidyTotal)}
          </Typography>
        </Box>
        <Box sx={{ 
          p: 1.5, 
          borderRadius: 1, 
          backgroundColor: '#e0f7fa',
          textAlign: 'center',
          border: '1px solid #b2ebf2'
        }}>
          <Typography variant="subtitle2" color="#000000" fontWeight="bold">Budgetary Support</Typography>
          <Typography variant="h6" fontWeight="bold" color="#000000">
            ₱{formatCurrency(budgetTotals.budgetarySupportTotal)}
          </Typography>
        </Box>
      </Box>
      {!budgetTotals.isSubsidyBalanced && (
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          mb: 2
        }}>
          <Typography 
            variant="subtitle2" 
            color="error" 
            fontWeight="bold"
            sx={{ 
              display: 'flex', 
              alignItems: 'center',
              px: 2,
              py: 0.5,
              borderRadius: 1,
              backgroundColor: 'rgba(244, 67, 54, 0.1)'
            }}
          >
            <span style={{ marginRight: '4px' }}>🚨</span>
            Subsidy mismatch: ₱{formatCurrency(budgetTotals.subsidyMismatch)}
          </Typography>
        </Box>
      )}
      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)', md: 'repeat(3, 1fr)' },
        gap: 2,
        mb: 2
      }}>
        {/* Regular MOOE Total Stat Box */}
        <Box sx={{ 
          p: 1.5, 
          borderRadius: 1, 
          backgroundColor: '#f5f5f5',
          textAlign: 'center',
          border: '2px solid #375e38',
        }}>
          <Typography variant="subtitle2" color="#375e38" fontWeight="bold">
            REGULAR MOOE TOTAL (Income + Subsidy)
          </Typography>
          <Typography variant="h6" fontWeight="bold" color="#375e38">
            ₱{formatCurrency(budgetTotals.mooeBreakdown.regular.total)}
          </Typography>
        </Box>
        {/* IAs O&M Cost Stat Box */}
        <Box sx={{ 
          p: 1.5, 
          borderRadius: 1, 
          backgroundColor: '#f5f5f5',
          textAlign: 'center',
          border: '2px solid #375e38',
        }}>
          <Typography variant="subtitle2" color="#375e38" fontWeight="bold">
            MOOE - O & M COST (IAs) (Income + Subsidy)
          </Typography>
          <Typography variant="h6" fontWeight="bold" color="#375e38">
            ₱{formatCurrency(budgetTotals.mooeBreakdown.iasOM.total)}
          </Typography>
        </Box>
        {/* Combined Total Stat Box */}
        <Box sx={{ 
          p: 1.5, 
          borderRadius: 1, 
          backgroundColor: '#fff',
          textAlign: 'center',
          border: '2px solid #375e38',
        }}>
          <Typography variant="subtitle2" color="#375e38" fontWeight="bold">
            TOTAL MOOE REGULAR + IAs O & M COST (Income + Subsidy)
          </Typography>
          <Typography variant="h5" fontWeight="bold" color="#375e38">
            ₱{formatCurrency(budgetTotals.mooeBreakdown.total)}
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
};

export default React.memo(BudgetSummary);

