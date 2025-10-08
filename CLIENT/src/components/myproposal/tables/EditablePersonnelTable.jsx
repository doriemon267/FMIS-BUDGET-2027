import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  IconButton,
  Chip,
  Box,
  Button,
  Typography,
  Collapse,
  TablePagination
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import RestoreIcon from '@mui/icons-material/Restore';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { NumericFormat } from 'react-number-format';

const numericFields = [
  'monthlySalary',
  'annualSalary',
  'RATA',
  'PERA',
  'uniformALLOWANCE',
  'productivityIncentive',
  'medical',
  'childrenAllowance',
  'meal',
  'cashGift',
  'subsistenceAllowanceMDS',
  'subsistenceAllowanceST',
  'midyearBonus',
  'yearEndBonus',
  'gsisPremium',
  'philhealthPremium',
  'pagibigPremium',
  'employeeCompensation',
  'loyaltyAward',
  'overtimePay',
  'earnedLeaves',
  'retirementBenefits',
  'terminalLeave',
  'courtAppearance'
];

const NumericFormatInput = React.forwardRef(function NumericFormatInput(props, ref) {
  const { onChange, name, ...other } = props;

  return (
    <NumericFormat
      {...other}
      getInputRef={ref}
      thousandSeparator
      decimalScale={2}
      fixedDecimalScale
      allowNegative={false}
      onValueChange={(values) => {
        onChange({
          target: {
            name,
            value: values.value
          }
        });
      }}
    />
  );
});

const EditablePersonnelTable = ({ data = [], onChange }) => {
  const [expandedRows, setExpandedRows] = useState({});
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const totalCount = data.length;
  const pageStart = rowsPerPage === -1 ? 0 : page * rowsPerPage;

  useEffect(() => {
    if (rowsPerPage === -1) {
      if (page !== 0) {
        setPage(0);
      }
      return;
    }

    const maxPage = totalCount === 0 ? 0 : Math.max(0, Math.ceil(totalCount / rowsPerPage) - 1);
    if (page > maxPage) {
      setPage(maxPage);
    }
  }, [page, rowsPerPage, totalCount]);

  useEffect(() => {
    setExpandedRows((prev) => {
      const next = { ...prev };
      let changed = false;
      const keys = new Set();

      data.forEach((item, index) => {
        const key = String(item?.originalId || item?._id || index);
        keys.add(key);
        if (typeof next[key] !== 'boolean') {
          next[key] = false;
          changed = true;
        }
      });

      Object.keys(next).forEach((key) => {
        if (!keys.has(key)) {
          delete next[key];
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [data]);

  const paginatedData = useMemo(() => {
    if (rowsPerPage === -1) {
      return data;
    }
    return data.slice(pageStart, pageStart + rowsPerPage);
  }, [data, pageStart, rowsPerPage]);

  const totals = useMemo(() => {
    return data.reduce(
      (acc, item) => {
        if (item.changeType === 'deleted') {
          return acc;
        }

        acc.count += 1;
        acc.totalAmount += Number(item.Total || 0);
        return acc;
      },
      { count: 0, totalAmount: 0 }
    );
  }, [data]);

  const toggleRow = useCallback((key) => {
    setExpandedRows((prev) => ({
      ...prev,
      [key]: !(prev[key] ?? false)
    }));
  }, []);

  const handleChangePage = useCallback((event, newPage) => {
    if (rowsPerPage === -1) {
      return;
    }
    setPage(newPage);
  }, [rowsPerPage]);

  const handleChangeRowsPerPage = useCallback((event) => {
    const nextValue = parseInt(event.target.value, 10);
    setRowsPerPage(nextValue);
    setPage(0);
  }, []);

  const handleFieldChange = useCallback((index, field, value) => {
    const newData = [...data];
    const numericValue = numericFields.includes(field) || field === 'Total'
      ? (parseFloat(value) || 0)
      : value;

    const current = newData[index] || {};
    const updated = {
      ...current,
      [field]: numericValue,
      changeType: current.originalId ? 'modified' : 'added'
    };

    if (field !== 'Total') {
      updated.Total = numericFields.reduce((sum, key) => sum + Number(key === field ? numericValue : updated[key] ?? 0), 0);
    }

    newData[index] = updated;
    onChange(newData);
  }, [data, onChange]);

  const handleDelete = (index) => {
    const newData = [...data];
    if (newData[index].originalId) {
      newData[index] = { ...newData[index], changeType: 'deleted' };
    } else {
      newData.splice(index, 1);
    }
    onChange(newData);
  };

  const handleRestore = (index) => {
    const newData = [...data];
    newData[index] = { ...newData[index], changeType: 'unchanged' };
    onChange(newData);
  };

  const handleAddRow = useCallback(() => {
    const newRow = {
      employeeFullName: '',
      positionTitle: '',
      statusOfAppointment: '',
      monthlySalary: 0,
      annualSalary: 0,
      RATA: 0,
      PERA: 0,
      uniformALLOWANCE: 0,
      productivityIncentive: 0,
      medical: 0,
      childrenAllowance: 0,
      meal: 0,
      cashGift: 0,
      subsistenceAllowanceMDS: 0,
      subsistenceAllowanceST: 0,
      midyearBonus: 0,
      yearEndBonus: 0,
      gsisPremium: 0,
      philhealthPremium: 0,
      pagibigPremium: 0,
      employeeCompensation: 0,
      loyaltyAward: 0,
      overtimePay: 0,
      earnedLeaves: 0,
      retirementBenefits: 0,
      terminalLeave: 0,
      courtAppearance: 0,
      Total: 0,
      changeType: 'added'
    };
    onChange([...data, newRow]);
  }, [data, onChange]);

  const decimalFormatter = useMemo(() => new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }), []);

  const formatAmount = useCallback((amount) => decimalFormatter.format(Number(amount) || 0), [decimalFormatter]);

  const formatCurrency = useCallback((amount) => `₱${formatAmount(amount)}`, [formatAmount]);

  const getRowStyle = (item) => {
    if (item.changeType === 'deleted') return { backgroundColor: '#ffebee', textDecoration: 'line-through', opacity: 0.6 };
    if (item.changeType === 'added') return { backgroundColor: '#e8f5e9' };
    if (item.changeType === 'modified') return { backgroundColor: '#fff3e0' };
    return {};
  };

  return (
    <Box>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip label={`Active Records: ${totals.count}`} variant="outlined" />
          <Chip label={`Total: ${formatCurrency(totals.totalAmount)}`} color="primary" />
        </Box>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={handleAddRow}>
          Add Personnel
        </Button>
      </Box>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell width={48} />
              <TableCell><strong>Employee Name</strong></TableCell>
              <TableCell><strong>Position</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              <TableCell align="right"><strong>Monthly Salary</strong></TableCell>
              <TableCell align="right"><strong>Annual Salary</strong></TableCell>
              <TableCell align="right"><strong>Total</strong></TableCell>
              <TableCell><strong>Change Status</strong></TableCell>
              <TableCell align="center"><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  <Box sx={{ py: 3, color: 'text.secondary' }}>
                    No personnel entries. Click "Add Personnel" to create one.
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((item, offset) => {
                const actualIndex = rowsPerPage === -1 ? offset : pageStart + offset;
                const rowKey = String(item?.originalId || item?._id || actualIndex);
                const isExpanded = expandedRows[rowKey] ?? false;
                const isDeleted = item.changeType === 'deleted';

                const renderNumberField = (field) => (
                  <TextField
                    value={item[field] ?? 0}
                    onChange={(e) => handleFieldChange(actualIndex, field, e.target.value)}
                    size="small"
                    fullWidth
                    disabled={isDeleted}
                    InputProps={{ inputComponent: NumericFormatInput }}
                    inputProps={{ name: field }}
                    sx={{ '& .MuiInputBase-input': { textAlign: 'right' } }}
                  />
                );

                return (
                  <React.Fragment key={rowKey}>
                    <TableRow sx={getRowStyle(item)}>
                      <TableCell>
                        <IconButton size="small" onClick={() => toggleRow(rowKey)}>
                          {isExpanded ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
                        </IconButton>
                      </TableCell>
                      <TableCell>
                        <TextField
                          value={item.employeeFullName || ''}
                          onChange={(e) => handleFieldChange(actualIndex, 'employeeFullName', e.target.value)}
                          size="small"
                          fullWidth
                          disabled={isDeleted}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          value={item.positionTitle || ''}
                          onChange={(e) => handleFieldChange(actualIndex, 'positionTitle', e.target.value)}
                          size="small"
                          fullWidth
                          disabled={isDeleted}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          value={item.statusOfAppointment || ''}
                          onChange={(e) => handleFieldChange(actualIndex, 'statusOfAppointment', e.target.value)}
                          size="small"
                          fullWidth
                          disabled={isDeleted}
                        />
                      </TableCell>
                      <TableCell align="right">
                        {renderNumberField('monthlySalary')}
                      </TableCell>
                      <TableCell align="right">
                        {renderNumberField('annualSalary')}
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {formatAmount(item.Total)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {item.changeType === 'added' && <Chip label="Added" size="small" color="success" />}
                        {item.changeType === 'modified' && <Chip label="Modified" size="small" color="warning" />}
                        {item.changeType === 'deleted' && <Chip label="Deleted" size="small" color="error" />}
                        {(!item.changeType || item.changeType === 'unchanged') && <Chip label="Unchanged" size="small" />}
                      </TableCell>
                      <TableCell align="center">
                        {item.changeType === 'deleted' ? (
                          <IconButton size="small" color="primary" onClick={() => handleRestore(actualIndex)}>
                            <RestoreIcon fontSize="small" />
                          </IconButton>
                        ) : (
                          <IconButton size="small" color="error" onClick={() => handleDelete(actualIndex)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow sx={getRowStyle(item)}>
                      <TableCell colSpan={9} sx={{ py: 0 }}>
                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                          <Box sx={{ p: 2, backgroundColor: '#f9fafb' }}>
                            <Typography variant="subtitle2" gutterBottom>
                              Additional Benefits & Premiums
                            </Typography>
                            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(1, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 2 }}>
                              {numericFields.filter((field) => !['monthlySalary', 'annualSalary'].includes(field)).map((field) => (
                                <TextField
                                  key={field}
                                  label={field.replace(/([A-Z])/g, ' $1').replace(/ALLOWANCE/g, 'Allowance').trim()}
                                  value={item[field] ?? 0}
                                  onChange={(e) => handleFieldChange(actualIndex, field, e.target.value)}
                                  size="small"
                                  fullWidth
                                  disabled={isDeleted}
                                  InputProps={{ inputComponent: NumericFormatInput }}
                                  inputProps={{ name: field }}
                                  sx={{ '& .MuiInputBase-input': { textAlign: 'right' } }}
                                />
                              ))}
                            </Box>
                            <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                              <Chip label={`Total Compensations: ${formatCurrency(item.Total)}`} size="small" color="primary" />
                              <Chip label={`Monthly Salary: ${formatCurrency(item.monthlySalary)}`} size="small" variant="outlined" />
                              <Chip label={`Annual Salary: ${formatCurrency(item.annualSalary)}`} size="small" variant="outlined" />
                            </Box>
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {totalCount > 0 && (
        <TablePagination
          component="div"
          count={totalCount}
          page={rowsPerPage === -1 ? 0 : page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[5, 10, 25, 50, { value: -1, label: 'All' }]}
          labelRowsPerPage="Rows per page"
          showFirstButton
          showLastButton
        />
      )}
    </Box>
  );
};

export default EditablePersonnelTable;