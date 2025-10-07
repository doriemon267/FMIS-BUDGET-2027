import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

const ComparisonPersonnelTable = ({ data }) => {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount || 0);
  };

  const getCellStyle = (item, field) => {
    if (item.changeType === 'added') return { backgroundColor: '#e8f5e9', fontWeight: 'bold' };
    if (item.changeType === 'deleted') return { backgroundColor: '#ffebee', textDecoration: 'line-through', opacity: 0.7 };
    if (item.changeType === 'modified' && item.originalValues && item.originalValues[field] !== undefined) {
      const oldValue = item.originalValues[field];
      const newValue = item[field];
      const numericFields = ['monthlySalary', 'annualSalary', 'Total', 'RATA', 'PERA'];
      if (numericFields.includes(field)) {
        if (newValue > oldValue) return { backgroundColor: '#e8f5e9', fontWeight: 'bold' };
        if (newValue < oldValue) return { backgroundColor: '#ffebee', fontWeight: 'bold' };
      } else if (oldValue !== newValue) {
        return { backgroundColor: '#fff3e0' };
      }
    }
    return {};
  };

  const renderComparisonCell = (item, field, isCurrency = false) => {
    const cellStyle = getCellStyle(item, field);
    const currentValue = item[field];
    
    if (item.changeType === 'modified' && item.originalValues && item.originalValues[field] !== undefined) {
      const oldValue = item.originalValues[field];
      if (oldValue !== currentValue) {
        return (
          <TableCell sx={cellStyle}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                {isCurrency ? formatCurrency(currentValue) : currentValue}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ textDecoration: 'line-through' }}>
                Was: {isCurrency ? formatCurrency(oldValue) : oldValue}
              </Typography>
            </Box>
          </TableCell>
        );
      }
    }
    
    return (
      <TableCell sx={cellStyle}>
        {isCurrency ? formatCurrency(currentValue) : currentValue}
      </TableCell>
    );
  };

  return (
    <Box>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell><strong>Employee Name</strong></TableCell>
              <TableCell><strong>Position</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              <TableCell><strong>Monthly Salary</strong></TableCell>
              <TableCell><strong>Annual Salary</strong></TableCell>
              <TableCell><strong>Total</strong></TableCell>
              <TableCell><strong>Change Status</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Box sx={{ py: 3, color: 'text.secondary' }}>
                    No personnel entries found.
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              data.map((item, index) => (
                <React.Fragment key={index}>
                  <TableRow>
                    {renderComparisonCell(item, 'employeeFullName')}
                    {renderComparisonCell(item, 'positionTitle')}
                    {renderComparisonCell(item, 'statusOfAppointment')}
                    {renderComparisonCell(item, 'monthlySalary', true)}
                    {renderComparisonCell(item, 'annualSalary', true)}
                    {renderComparisonCell(item, 'Total', true)}
                    <TableCell>
                      {item.changeType === 'added' && <Chip label="Added" size="small" color="success" />}
                      {item.changeType === 'modified' && <Chip label="Modified" size="small" color="warning" />}
                      {item.changeType === 'deleted' && <Chip label="Deleted" size="small" color="error" />}
                      {item.changeType === 'unchanged' && <Chip label="Unchanged" size="small" />}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={7} sx={{ p: 0 }}>
                      <Accordion sx={{ boxShadow: 'none', '&:before': { display: 'none' } }}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Typography variant="caption">View Additional Details</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
                            {['RATA', 'PERA', 'uniformALLOWANCE', 'productivityIncentive', 'medical', 'childrenAllowance',
                              'meal', 'cashGift', 'subsistenceAllowanceMDS', 'subsistenceAllowanceST', 'midyearBonus',
                              'yearEndBonus', 'gsisPremium', 'philhealthPremium', 'pagibigPremium', 'employeeCompensation'
                            ].map(field => {
                              const cellStyle = getCellStyle(item, field);
                              const currentValue = item[field];
                              const oldValue = item.originalValues?.[field];
                              const hasChanged = oldValue !== undefined && oldValue !== currentValue;
                              
                              return (
                                <Box key={field} sx={{ ...cellStyle, p: 1, borderRadius: 1 }}>
                                  <Typography variant="caption" color="text.secondary">
                                    {field.replace(/([A-Z])/g, ' $1').trim()}:
                                  </Typography>
                                  <Typography variant="body2" sx={{ fontWeight: hasChanged ? 'bold' : 'normal' }}>
                                    {formatCurrency(currentValue)}
                                  </Typography>
                                  {hasChanged && (
                                    <Typography variant="caption" color="text.secondary" sx={{ textDecoration: 'line-through' }}>
                                      Was: {formatCurrency(oldValue)}
                                    </Typography>
                                  )}
                                </Box>
                              );
                            })}
                          </Box>
                        </AccordionDetails>
                      </Accordion>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default ComparisonPersonnelTable;