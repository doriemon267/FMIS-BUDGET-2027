import React, { useEffect, useMemo, useState } from 'react';
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
  AccordionDetails,
  TablePagination
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

const ComparisonPersonnelTable = ({ data }) => {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount || 0);
  };

  const entries = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const changeCounts = useMemo(() => (
    entries.reduce((acc, item) => {
      const type = item.changeType || 'unchanged';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, { added: 0, modified: 0, deleted: 0, unchanged: 0 })
  ), [entries]);

  const totalEntries = entries.length;
  const pageStart = rowsPerPage === -1 ? 0 : page * rowsPerPage;

  useEffect(() => {
    if (rowsPerPage === -1) {
      if (page !== 0) {
        setPage(0);
      }
      return;
    }
    const maxPage = totalEntries === 0 ? 0 : Math.max(0, Math.ceil(totalEntries / rowsPerPage) - 1);
    if (page > maxPage) {
      setPage(maxPage);
    }
  }, [page, rowsPerPage, totalEntries]);

  const paginatedData = useMemo(() => {
    if (rowsPerPage === -1) {
      return entries;
    }
    return entries.slice(pageStart, pageStart + rowsPerPage);
  }, [entries, pageStart, rowsPerPage]);

  const handleChangePage = (event, newPage) => {
    if (rowsPerPage === -1) {
      return;
    }
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    const nextValue = parseInt(event.target.value, 10);
    setRowsPerPage(nextValue);
    setPage(0);
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
    const displayValue = currentValue ?? (isCurrency ? 0 : '—');
    
    if (item.changeType === 'modified' && item.originalValues && item.originalValues[field] !== undefined) {
      const oldValue = item.originalValues[field];
      if (oldValue !== currentValue) {
        const previousValue = oldValue ?? (isCurrency ? 0 : '—');
        return (
          <TableCell sx={cellStyle}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                {isCurrency ? formatCurrency(displayValue) : displayValue}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ textDecoration: 'line-through' }}>
                {isCurrency ? formatCurrency(previousValue) : previousValue}
              </Typography>
            </Box>
          </TableCell>
        );
      }
    }
    
    return (
      <TableCell sx={cellStyle}>
        {isCurrency ? formatCurrency(displayValue) : displayValue}
      </TableCell>
    );
  };

  return (
    <Box>
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Chip label={`Total Employees: ${totalEntries}`} color="primary" />
        {changeCounts.added > 0 && <Chip label={`+${changeCounts.added}`} size="small" color="success" />}
        {changeCounts.modified > 0 && <Chip label={`~${changeCounts.modified}`} size="small" color="warning" />}
        {changeCounts.deleted > 0 && <Chip label={`-${changeCounts.deleted}`} size="small" color="error" />}
        {changeCounts.unchanged > 0 && <Chip label={`${changeCounts.unchanged} unchanged`} size="small" />}
      </Box>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell><strong>Employee Name</strong></TableCell>
              <TableCell><strong>Position</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              <TableCell><strong>Tags</strong></TableCell>
              <TableCell><strong>Monthly Salary</strong></TableCell>
              <TableCell><strong>Annual Salary</strong></TableCell>
              <TableCell><strong>Total</strong></TableCell>
              <TableCell><strong>Change Status</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {totalEntries === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Box sx={{ py: 3, color: 'text.secondary' }}>
                    No personnel entries found.
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((item, index) => {
                const rowKey = item.originalId || item._id || `personnel-${pageStart + index}`;
                return (
                  <React.Fragment key={rowKey}>
                    <TableRow>
                      {renderComparisonCell(item, 'employeeFullName')}
                      {renderComparisonCell(item, 'positionTitle')}
                      {renderComparisonCell(item, 'statusOfAppointment')}
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          {item.subsidyEligible && (
                            <Chip 
                              label="PS - Subsidy" 
                              size="small" 
                              color="primary" 
                              variant="outlined"
                              sx={{ bgcolor: '#e3f2fd' }}
                            />
                          )}
                          {item.chargedToIncomeEligible && (
                            <Chip 
                              label="PS - Income" 
                              size="small" 
                              color="success" 
                              variant="outlined"
                              sx={{ bgcolor: '#e8f5e9' }}
                            />
                          )}
                        </Box>
                      </TableCell>
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
                      <TableCell colSpan={8} sx={{ p: 0 }}>
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
                                        {formatCurrency(oldValue)}
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
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {totalEntries > 0 && (
        <TablePagination
          component="div"
          count={totalEntries}
          page={rowsPerPage === -1 ? 0 : page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[5, 10, 25, { value: -1, label: 'All' }]}
          labelRowsPerPage="Rows per page"
          showFirstButton
          showLastButton
        />
      )}
    </Box>
  );
};

export default ComparisonPersonnelTable;