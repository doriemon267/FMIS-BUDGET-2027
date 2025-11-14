import React, { useState, useEffect } from 'react';
import {
  TableRow,
  TableCell,
  IconButton,
  TextField,
  Select,
  MenuItem,
  FormControl,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import api from '../../config/api';
import { getStoredWorkflowRef } from '../../hooks/useWorkflowRef';
import { toast } from 'react-toastify';

const ProposalDetailEditableRow = ({ 
  row, 
  expenditureType, 
  refreshData, 
  disabled = false,
  categories = [] 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState({});
  
  useEffect(() => {
    setEditedData(row);
  }, [row]);

  const handleChange = (field, value) => {
    setEditedData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    try {
      // Determine the endpoint based on expenditure type
      let endpoint = '';
      if (expenditureType.includes('Personnel')) {
        endpoint = `/personnel-services/${row._id}`;
      } else if (expenditureType === 'MOOE') {
        endpoint = `/mooe/${row._id}`;
      } else if (expenditureType === 'Capital Outlay') {
        endpoint = `/capital-outlay/${row._id}`;
      } else if (expenditureType === 'Income') {
        endpoint = `/income/${row._id}`;
      }

  // Ensure proposal linkage
  const activeRef = getStoredWorkflowRef();
  const payload = { ...editedData, ...(activeRef ? { proposalId: activeRef } : {}) };
  await api.put(endpoint, payload, { headers: activeRef ? { 'X-Workflow-Ref': activeRef } : {} });
      toast.success('Item updated successfully');
      setIsEditing(false);
      refreshData();
    } catch (error) {
      console.error('Error updating item:', error);
      toast.error('Failed to update item');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    
    try {
      // Determine the endpoint based on expenditure type
      let endpoint = '';
      if (expenditureType.includes('Personnel')) {
        endpoint = `/personnel-services/${row._id}`;
      } else if (expenditureType === 'MOOE') {
        endpoint = `/mooe/${row._id}`;
      } else if (expenditureType === 'Capital Outlay') {
        endpoint = `/capital-outlay/${row._id}`;
      } else if (expenditureType === 'Income') {
        endpoint = `/income/${row._id}`;
      }

  const activeRef = getStoredWorkflowRef();
  await api.delete(endpoint, { headers: activeRef ? { 'X-Workflow-Ref': activeRef } : {} });
      toast.success('Item deleted successfully');
      refreshData();
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error('Failed to delete item');
    }
  };

  const formatCurrency = (value) => {
    if (value === undefined || value === null) return 'N/A';
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2
    }).format(value);
  };

  // Render different row types based on expenditure type
  if (expenditureType.includes('Personnel')) {
    return (
      <TableRow>
        <TableCell>
          {!disabled && (
            isEditing ? (
              <>
                <IconButton size="small" onClick={handleSave} color="primary">
                  <SaveIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" onClick={() => setIsEditing(false)} color="secondary">
                  <CancelIcon fontSize="small" />
                </IconButton>
              </>
            ) : (
              <>
                <IconButton size="small" onClick={() => setIsEditing(true)} color="primary">
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" onClick={handleDelete} color="error">
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </>
            )
          )}
        </TableCell>
        <TableCell>
          {isEditing ? (
            <TextField
              fullWidth
              variant="standard"
              value={editedData.employeeFullName || ''}
              onChange={(e) => handleChange('employeeFullName', e.target.value)}
            />
          ) : (
            row.employeeFullName || 'N/A'
          )}
        </TableCell>
        <TableCell>
          {isEditing ? (
            <TextField
              fullWidth
              variant="standard"
              value={editedData.positionTitle || ''}
              onChange={(e) => handleChange('positionTitle', e.target.value)}
            />
          ) : (
            row.positionTitle || 'N/A'
          )}
        </TableCell>
        <TableCell>
          {isEditing ? (
            <TextField
              fullWidth
              variant="standard"
              value={editedData.statusOfAppointment || ''}
              onChange={(e) => handleChange('statusOfAppointment', e.target.value)}
            />
          ) : (
            row.statusOfAppointment || 'N/A'
          )}
        </TableCell>
        <TableCell>
          {isEditing ? (
            <TextField
              fullWidth
              variant="standard"
              type="number"
              value={editedData.monthlySalary || 0}
              onChange={(e) => handleChange('monthlySalary', parseFloat(e.target.value))}
            />
          ) : (
            formatCurrency(row.monthlySalary)
          )}
        </TableCell>
        <TableCell>
          {isEditing ? (
            <TextField
              fullWidth
              variant="standard"
              type="number"
              value={editedData.annualSalary || 0}
              onChange={(e) => handleChange('annualSalary', parseFloat(e.target.value))}
            />
          ) : (
            formatCurrency(row.annualSalary)
          )}
        </TableCell>
      </TableRow>
    );
  } else if (expenditureType === 'MOOE') {
    return (
      <TableRow sx={{ '&:hover': { backgroundColor: '#f9f9f9' } }}>
        <TableCell>
          {!disabled && (
            isEditing ? (
              <>
                <IconButton size="small" onClick={handleSave} color="primary">
                  <SaveIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" onClick={() => setIsEditing(false)} color="secondary">
                  <CancelIcon fontSize="small" />
                </IconButton>
              </>
            ) : (
              <>
                <IconButton size="small" onClick={() => setIsEditing(true)} color="primary">
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" onClick={handleDelete} color="error">
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </>
            )
          )}
        </TableCell>
        <TableCell>
          {isEditing ? (
            <TextField
              fullWidth
              variant="standard"
              value={editedData.sublineItem || ''}
              onChange={(e) => handleChange('sublineItem', e.target.value)}
            />
          ) : (
            row.sublineItem || 'N/A'
          )}
        </TableCell>
        <TableCell>
          {isEditing ? (
            <TextField
              fullWidth
              variant="standard"
              value={editedData.description || editedData.accountingTitle || ''}
              onChange={(e) => handleChange('accountingTitle', e.target.value)}
            />
          ) : (
            row.description || row.accountingTitle || 'N/A'
          )}
        </TableCell>
        <TableCell>
          {isEditing ? (
            <TextField
              fullWidth
              variant="standard"
              value={editedData.uacsCode || ''}
              onChange={(e) => handleChange('uacsCode', e.target.value)}
            />
          ) : (
            row.uacsCode || 'N/A'
          )}
        </TableCell>
        <TableCell align="right">
          {isEditing ? (
            <TextField
              fullWidth
              variant="standard"
              type="number"
              value={editedData.income || 0}
              onChange={(e) => handleChange('income', parseFloat(e.target.value))}
              sx={{ textAlign: 'right' }}
            />
          ) : (
            formatCurrency(row.income || 0)
          )}
        </TableCell>
        <TableCell align="right">
          {isEditing ? (
            <TextField
              fullWidth
              variant="standard"
              type="number"
              value={editedData.subsidy || 0}
              onChange={(e) => handleChange('subsidy', parseFloat(e.target.value))}
              sx={{ textAlign: 'right' }}
            />
          ) : (
            formatCurrency(row.subsidy || 0)
          )}
        </TableCell>
        <TableCell align="right">
          {isEditing ? (
            <TextField
              fullWidth
              variant="standard"
              type="number"
              value={editedData.amount || 0}
              onChange={(e) => handleChange('amount', parseFloat(e.target.value))}
              sx={{ textAlign: 'right' }}
            />
          ) : (
            formatCurrency(row.amount)
          )}
        </TableCell>
      </TableRow>
    );
  } else if (expenditureType === 'Capital Outlay') {
    return (
      <TableRow sx={{ '&:hover': { backgroundColor: '#f9f9f9' } }}>
        <TableCell>
          {!disabled && (
            isEditing ? (
              <>
                <IconButton size="small" onClick={handleSave} color="primary">
                  <SaveIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" onClick={() => setIsEditing(false)} color="secondary">
                  <CancelIcon fontSize="small" />
                </IconButton>
              </>
            ) : (
              <>
                <IconButton size="small" onClick={() => setIsEditing(true)} color="primary">
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" onClick={handleDelete} color="error">
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </>
            )
          )}
        </TableCell>
        <TableCell>
          {isEditing ? (
            <FormControl fullWidth variant="standard">
              <Select
                value={editedData.category?.categoryName || editedData.category || ''}
                onChange={(e) => handleChange('category', e.target.value)}
              >
                {categories.map((cat) => (
                  <MenuItem key={cat.id || cat} value={cat.categoryName || cat}>
                    {cat.categoryName || cat}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : (
            row.category?.categoryName || row.category || 'N/A'
          )}
        </TableCell>
        <TableCell>
          {isEditing ? (
            <TextField
              fullWidth
              variant="standard"
              value={editedData.sublineItem || ''}
              onChange={(e) => handleChange('sublineItem', e.target.value)}
            />
          ) : (
            row.sublineItem || 'N/A'
          )}
        </TableCell>
        <TableCell>
          {isEditing ? (
            <TextField
              fullWidth
              variant="standard"
              value={editedData.accountingTitle || ''}
              onChange={(e) => handleChange('accountingTitle', e.target.value)}
            />
          ) : (
            row.accountingTitle || 'N/A'
          )}
        </TableCell>
        <TableCell>
          {isEditing ? (
            <TextField
              fullWidth
              variant="standard"
              value={editedData.uacsCode || ''}
              onChange={(e) => handleChange('uacsCode', e.target.value)}
            />
          ) : (
            row.uacsCode || 'N/A'
          )}
        </TableCell>
        <TableCell>
          {isEditing ? (
            <TextField
              fullWidth
              variant="standard"
              value={editedData.particulars || ''}
              onChange={(e) => handleChange('particulars', e.target.value)}
            />
          ) : (
            row.particulars || 'N/A'
          )}
        </TableCell>
        <TableCell align="right">
          {isEditing ? (
            <TextField
              fullWidth
              variant="standard"
              type="number"
              value={editedData.income || 0}
              onChange={(e) => handleChange('income', parseFloat(e.target.value))}
              sx={{ textAlign: 'right' }}
            />
          ) : (
            formatCurrency(row.income || 0)
          )}
        </TableCell>
        <TableCell align="right">
          {isEditing ? (
            <TextField
              fullWidth
              variant="standard"
              type="number"
              value={editedData.subsidy || 0}
              onChange={(e) => handleChange('subsidy', parseFloat(e.target.value))}
              sx={{ textAlign: 'right' }}
            />
          ) : (
            formatCurrency(row.subsidy || 0)
          )}
        </TableCell>
        <TableCell align="right">
          {isEditing ? (
            <TextField
              fullWidth
              variant="standard"
              type="number"
              value={editedData.cost || 0}
              onChange={(e) => handleChange('cost', parseFloat(e.target.value))}
              sx={{ textAlign: 'right' }}
            />
          ) : (
            formatCurrency(row.cost)
          )}
        </TableCell>
      </TableRow>
    );
  } else if (expenditureType === 'Income') {
    return (
      <TableRow>
        <TableCell>
          {!disabled && (
            isEditing ? (
              <>
                <IconButton size="small" onClick={handleSave} color="primary">
                  <SaveIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" onClick={() => setIsEditing(false)} color="secondary">
                  <CancelIcon fontSize="small" />
                </IconButton>
              </>
            ) : (
              <>
                <IconButton size="small" onClick={() => setIsEditing(true)} color="primary">
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" onClick={handleDelete} color="error">
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </>
            )
          )}
        </TableCell>
        <TableCell>
          {isEditing ? (
            <TextField
              fullWidth
              variant="standard"
              value={editedData.source || ''}
              onChange={(e) => handleChange('source', e.target.value)}
            />
          ) : (
            row.source || 'N/A'
          )}
        </TableCell>
        <TableCell>
          {isEditing ? (
            <TextField
              fullWidth
              variant="standard"
              value={editedData.category?.name || editedData.category || ''}
              onChange={(e) => handleChange('category', e.target.value)}
            />
          ) : (
            row.category?.name || row.category || 'N/A'
          )}
        </TableCell>
        <TableCell>
          {isEditing ? (
            <TextField
              fullWidth
              variant="standard"
              value={editedData.description || editedData.name || ''}
              onChange={(e) => handleChange('description', e.target.value)}
            />
          ) : (
            row.description || row.name || 'N/A'
          )}
        </TableCell>
        <TableCell>
          {isEditing ? (
            <TextField
              fullWidth
              variant="standard"
              type="number"
              value={editedData.amount || 0}
              onChange={(e) => handleChange('amount', parseFloat(e.target.value))}
            />
          ) : (
            formatCurrency(row.amount)
          )}
        </TableCell>
      </TableRow>
    );
  }

  // Default fallback row
  return (
    <TableRow>
      <TableCell colSpan={6}>Unknown expenditure type or missing data</TableCell>
    </TableRow>
  );
};

export default ProposalDetailEditableRow;