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
  Typography
} from '@mui/material';

const ComparisonCapitalOutlayTable = ({ data }) => {
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
      const numericFields = ['quantity', 'unitCost', 'cost'];
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
              <TableCell><strong>Particulars</strong></TableCell>
              <TableCell><strong>Quantity</strong></TableCell>
              <TableCell><strong>Unit Cost</strong></TableCell>
              <TableCell><strong>Total Cost</strong></TableCell>
              <TableCell><strong>Department</strong></TableCell>
              <TableCell><strong>Change Status</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Box sx={{ py: 3, color: 'text.secondary' }}>
                    No capital outlay entries found.
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              data.map((item, index) => (
                <TableRow key={index}>
                  {renderComparisonCell(item, 'particulars')}
                  <TableCell sx={getCellStyle(item, 'quantity')}>{item.quantity}</TableCell>
                  {renderComparisonCell(item, 'unitCost', true)}
                  {renderComparisonCell(item, 'cost', true)}
                  {renderComparisonCell(item, 'department')}
                  <TableCell>
                    {item.changeType === 'added' && <Chip label="Added" size="small" color="success" />}
                    {item.changeType === 'modified' && <Chip label="Modified" size="small" color="warning" />}
                    {item.changeType === 'deleted' && <Chip label="Deleted" size="small" color="error" />}
                    {item.changeType === 'unchanged' && <Chip label="Unchanged" size="small" />}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default ComparisonCapitalOutlayTable;