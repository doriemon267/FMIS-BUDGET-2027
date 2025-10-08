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
  TablePagination
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import RestoreIcon from '@mui/icons-material/Restore';
import { NumericFormat } from 'react-number-format';

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

const EditableIncomeTable = ({ data = [], onChange }) => {
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

  const paginatedData = useMemo(() => {
    if (rowsPerPage === -1) {
      return data;
    }
    return data.slice(pageStart, pageStart + rowsPerPage);
  }, [data, pageStart, rowsPerPage]);

  const handleFieldChange = (index, field, value) => {
    const newData = [...data];
    newData[index] = {
      ...newData[index],
      [field]: value,
      changeType: newData[index].originalId ? 'modified' : 'added'
    };
    onChange(newData);
  };

  const handleAmountChange = (index, value) => {
    const numValue = parseFloat(value) || 0;
    handleFieldChange(index, 'amount', numValue);
  };

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

  const handleDelete = (index) => {
    const newData = [...data];
    if (newData[index].originalId) {
      // Mark as deleted instead of removing
      newData[index] = {
        ...newData[index],
        changeType: 'deleted'
      };
    } else {
      // Remove if it's a new entry
      newData.splice(index, 1);
    }
    onChange(newData);
  };

  const handleRestore = (index) => {
    const newData = [...data];
    newData[index] = {
      ...newData[index],
      changeType: 'unchanged'
    };
    onChange(newData);
  };

  const handleAddRow = () => {
    const newRow = {
      source: '',
      description: '',
      amount: 0,
      department: '',
      changeType: 'added'
    };
    onChange([...data, newRow]);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount || 0);
  };

  const getRowStyle = (item) => {
    if (item.changeType === 'deleted') {
      return { backgroundColor: '#ffebee', textDecoration: 'line-through', opacity: 0.6 };
    }
    if (item.changeType === 'added') {
      return { backgroundColor: '#e8f5e9' };
    }
    if (item.changeType === 'modified') {
      return { backgroundColor: '#fff3e0' };
    }
    return {};
  };

  return (
    <Box>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Chip label={`Total: ${formatCurrency(data.reduce((sum, item) => sum + (item.changeType !== 'deleted' ? (item.amount || 0) : 0), 0))}`} color="primary" />
        </Box>
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={handleAddRow}
        >
          Add Income Entry
        </Button>
      </Box>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell><strong>Source</strong></TableCell>
              <TableCell><strong>Description</strong></TableCell>
              <TableCell><strong>Amount</strong></TableCell>
              <TableCell><strong>Department</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              <TableCell align="center"><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Box sx={{ py: 3, color: 'text.secondary' }}>
                    No income entries. Click "Add Income Entry" to create one.
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((item, offset) => {
                const actualIndex = rowsPerPage === -1 ? offset : pageStart + offset;
                return (
                  <TableRow key={actualIndex} sx={getRowStyle(item)}>
                  <TableCell>
                    <TextField
                      value={item.source || ''}
                        onChange={(e) => handleFieldChange(actualIndex, 'source', e.target.value)}
                      size="small"
                      fullWidth
                      disabled={item.changeType === 'deleted'}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      value={item.description || ''}
                        onChange={(e) => handleFieldChange(actualIndex, 'description', e.target.value)}
                      size="small"
                      fullWidth
                      multiline
                      disabled={item.changeType === 'deleted'}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      value={item.amount || 0}
                        onChange={(e) => handleAmountChange(actualIndex, e.target.value)}
                      size="small"
                      fullWidth
                      disabled={item.changeType === 'deleted'}
                        InputProps={{ inputComponent: NumericFormatInput }}
                        inputProps={{ name: 'amount' }}
                        sx={{ '& .MuiInputBase-input': { textAlign: 'right' } }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      value={item.department || ''}
                        onChange={(e) => handleFieldChange(actualIndex, 'department', e.target.value)}
                      size="small"
                      fullWidth
                      disabled={item.changeType === 'deleted'}
                    />
                  </TableCell>
                  <TableCell>
                    {item.changeType === 'added' && <Chip label="Added" size="small" color="success" />}
                    {item.changeType === 'modified' && <Chip label="Modified" size="small" color="warning" />}
                    {item.changeType === 'deleted' && <Chip label="Deleted" size="small" color="error" />}
                    {item.changeType === 'unchanged' && <Chip label="Unchanged" size="small" />}
                  </TableCell>
                  <TableCell align="center">
                    {item.changeType === 'deleted' ? (
                      <IconButton
                        size="small"
                        color="primary"
                          onClick={() => handleRestore(actualIndex)}
                        title="Restore"
                      >
                        <RestoreIcon fontSize="small" />
                      </IconButton>
                    ) : (
                      <IconButton
                        size="small"
                        color="error"
                          onClick={() => handleDelete(actualIndex)}
                        title="Delete"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                  </TableRow>
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
          rowsPerPageOptions={[5, 10, 25, { value: -1, label: 'All' }]}
          labelRowsPerPage="Rows per page"
          showFirstButton
          showLastButton
        />
      )}
    </Box>
  );
};

export default EditableIncomeTable;