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

const ComparisonMOOETable = ({ data }) => {
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
      if (field === 'amount') {
        if (newValue > oldValue) return { backgroundColor: '#e8f5e9', fontWeight: 'bold' };
        if (newValue < oldValue) return { backgroundColor: '#ffebee', fontWeight: 'bold' };
      } else if (oldValue !== newValue) {
        return { backgroundColor: '#fff3e0' };
      }
    }
    return {};
  };

  const renderComparisonCell = (item, field) => {
    const cellStyle = getCellStyle(item, field);
    const currentValue = item[field];
    
    if (item.changeType === 'modified' && item.originalValues && item.originalValues[field] !== undefined) {
      const oldValue = item.originalValues[field];
      if (oldValue !== currentValue) {
        return (
          <TableCell sx={cellStyle}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                {field === 'amount' ? formatCurrency(currentValue) : currentValue}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ textDecoration: 'line-through' }}>
                Was: {field === 'amount' ? formatCurrency(oldValue) : oldValue}
              </Typography>
            </Box>
          </TableCell>
        );
      }
    }
    
    return (
      <TableCell sx={cellStyle}>
        {field === 'amount' ? formatCurrency(currentValue) : currentValue}
      </TableCell>
    );
  };

  return (
    <Box>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell><strong>UACS Code</strong></TableCell>
              <TableCell><strong>Description</strong></TableCell>
              <TableCell><strong>Amount</strong></TableCell>
              <TableCell><strong>Department</strong></TableCell>
              <TableCell><strong>Change Status</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Box sx={{ py: 3, color: 'text.secondary' }}>
                    No MOOE entries found.
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              data.map((item, index) => (
                <TableRow key={index}>
                  {renderComparisonCell(item, 'uacsCode')}
                  {renderComparisonCell(item, 'description')}
                  {renderComparisonCell(item, 'amount')}
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

export default ComparisonMOOETable;