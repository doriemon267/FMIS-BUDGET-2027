import React from 'react';
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
  Button
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import RestoreIcon from '@mui/icons-material/Restore';

const EditableMOOETable = ({ data, onChange }) => {
  const handleFieldChange = (index, field, value) => {
    const newData = [...data];
    const numValue = field === 'amount' ? (parseFloat(value) || 0) : value;
    newData[index] = {
      ...newData[index],
      [field]: numValue,
      changeType: newData[index].originalId ? 'modified' : 'added'
    };
    onChange(newData);
  };

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

  const handleAddRow = () => {
    const newRow = {
      uacsCode: '',
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
    if (item.changeType === 'deleted') return { backgroundColor: '#ffebee', textDecoration: 'line-through', opacity: 0.6 };
    if (item.changeType === 'added') return { backgroundColor: '#e8f5e9' };
    if (item.changeType === 'modified') return { backgroundColor: '#fff3e0' };
    return {};
  };

  return (
    <Box>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Chip label={`Total: ${formatCurrency(data.reduce((sum, item) => sum + (item.changeType !== 'deleted' ? (item.amount || 0) : 0), 0))}`} color="primary" />
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={handleAddRow}>
          Add MOOE Entry
        </Button>
      </Box>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell><strong>UACS Code</strong></TableCell>
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
                    No MOOE entries. Click "Add MOOE Entry" to create one.
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              data.map((item, index) => (
                <TableRow key={index} sx={getRowStyle(item)}>
                  <TableCell>
                    <TextField
                      value={item.uacsCode || ''}
                      onChange={(e) => handleFieldChange(index, 'uacsCode', e.target.value)}
                      size="small"
                      fullWidth
                      disabled={item.changeType === 'deleted'}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      value={item.description || ''}
                      onChange={(e) => handleFieldChange(index, 'description', e.target.value)}
                      size="small"
                      fullWidth
                      multiline
                      disabled={item.changeType === 'deleted'}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="number"
                      value={item.amount || 0}
                      onChange={(e) => handleFieldChange(index, 'amount', e.target.value)}
                      size="small"
                      fullWidth
                      disabled={item.changeType === 'deleted'}
                      inputProps={{ step: 0.01, min: 0 }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      value={item.department || ''}
                      onChange={(e) => handleFieldChange(index, 'department', e.target.value)}
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
                      <IconButton size="small" color="primary" onClick={() => handleRestore(index)}>
                        <RestoreIcon fontSize="small" />
                      </IconButton>
                    ) : (
                      <IconButton size="small" color="error" onClick={() => handleDelete(index)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
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

export default EditableMOOETable;