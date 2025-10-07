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
  Button,
  Typography
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import RestoreIcon from '@mui/icons-material/Restore';

const EditableCapitalOutlayTable = ({ data, onChange }) => {
  const handleFieldChange = (index, field, value) => {
    const newData = [...data];
    const numValue = ['income', 'subsidy', 'cost'].includes(field) ? (parseFloat(value) || 0) : value;
    newData[index] = {
      ...newData[index],
      [field]: numValue,
      changeType: newData[index].originalId ? 'modified' : 'added'
    };
    
    // Recalculate total cost (income + subsidy)
    if (field === 'income' || field === 'subsidy') {
      newData[index].cost = (newData[index].income || 0) + (newData[index].subsidy || 0);
    }
    
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
      particulars: '',
      sublineItem: '',
      accountingTitle: '',
      uacsCode: '',
      income: 0,
      subsidy: 0,
      cost: 0,
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
        <Chip label={`Total: ${formatCurrency(data.reduce((sum, item) => sum + (item.changeType !== 'deleted' ? (item.cost || 0) : 0), 0))}`} color="primary" />
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={handleAddRow}>
          Add Capital Outlay Entry
        </Button>
      </Box>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: '#2e7d32' }}>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>TITLE</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Subline Item</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Accounting Title</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>UACS Code</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold', backgroundColor: '#4caf50' }}>Particulars</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold', backgroundColor: '#4caf50' }}>INCOME</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold', backgroundColor: '#4caf50' }}>SUBSIDY</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>TOTAL</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Status</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} align="center">
                  <Box sx={{ py: 3, color: 'text.secondary' }}>
                    No capital outlay entries. Click "Add Capital Outlay Entry" to create one.
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              data.map((item, index) => (
                <TableRow key={index} sx={getRowStyle(item)}>
                  {/* TITLE - Read-only (from category) */}
                  <TableCell>
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                      {item.categoryName || item.category?.name || '-'}
                    </Typography>
                  </TableCell>
                  
                  {/* Subline Item - Read-only */}
                  <TableCell>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {item.sublineItem || '-'}
                    </Typography>
                  </TableCell>
                  
                  {/* Accounting Title - Read-only */}
                  <TableCell>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {item.accountingTitle || '-'}
                    </Typography>
                  </TableCell>
                  
                  {/* UACS Code - Read-only */}
                  <TableCell>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {item.uacsCode || '-'}
                    </Typography>
                  </TableCell>
                  
                  {/* Particulars - EDITABLE with details badge */}
                  <TableCell sx={{ backgroundColor: item.changeType === 'deleted' ? 'inherit' : '#e8f5e9' }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      <TextField
                        type="text"
                        value={item.particulars || ''}
                        onChange={(e) => handleFieldChange(index, 'particulars', e.target.value)}
                        size="small"
                        fullWidth
                        disabled={item.changeType === 'deleted'}
                        placeholder="Enter particulars..."
                        multiline
                        maxRows={2}
                      />
                      {item.details && item.details.length > 0 && (
                        <Chip 
                          label={`${item.details.length} item${item.details.length > 1 ? 's' : ''}`} 
                          size="small" 
                          color="primary" 
                          variant="outlined"
                          sx={{ width: 'fit-content' }}
                        />
                      )}
                    </Box>
                  </TableCell>
                  
                  {/* INCOME - EDITABLE */}
                  <TableCell sx={{ backgroundColor: item.changeType === 'deleted' ? 'inherit' : '#e8f5e9' }}>
                    <TextField
                      type="number"
                      value={item.income || 0}
                      onChange={(e) => handleFieldChange(index, 'income', e.target.value)}
                      size="small"
                      fullWidth
                      disabled={item.changeType === 'deleted'}
                      inputProps={{ step: 0.01, min: 0 }}
                      sx={{ 
                        '& .MuiInputBase-input': { 
                          textAlign: 'right',
                          fontWeight: 'bold'
                        }
                      }}
                    />
                  </TableCell>
                  
                  {/* SUBSIDY - EDITABLE */}
                  <TableCell sx={{ backgroundColor: item.changeType === 'deleted' ? 'inherit' : '#e8f5e9' }}>
                    <TextField
                      type="number"
                      value={item.subsidy || 0}
                      onChange={(e) => handleFieldChange(index, 'subsidy', e.target.value)}
                      size="small"
                      fullWidth
                      disabled={item.changeType === 'deleted'}
                      inputProps={{ step: 0.01, min: 0 }}
                      sx={{ 
                        '& .MuiInputBase-input': { 
                          textAlign: 'right',
                          fontWeight: 'bold'
                        }
                      }}
                    />
                  </TableCell>
                  
                  {/* TOTAL - Computed (read-only) */}
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', textAlign: 'right' }}>
                      {formatCurrency(item.cost || ((item.income || 0) + (item.subsidy || 0)))}
                    </Typography>
                  </TableCell>
                  
                  {/* Status */}
                  <TableCell align="center">
                    {item.changeType === 'added' && <Chip label="Added" size="small" color="success" />}
                    {item.changeType === 'modified' && <Chip label="Modified" size="small" color="warning" />}
                    {item.changeType === 'deleted' && <Chip label="Deleted" size="small" color="error" />}
                    {item.changeType === 'unchanged' && <Chip label="Unchanged" size="small" />}
                  </TableCell>
                  
                  {/* Actions */}
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

export default EditableCapitalOutlayTable;