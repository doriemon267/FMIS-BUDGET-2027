import React, { useState } from 'react';
import {
  TableRow,
  TableCell,
  IconButton,
  TextField,
  Select,
  MenuItem,
  FormControl,
  Button,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Close';
import api from '../../config/api';
import { getStoredWorkflowRef } from '../../hooks/useWorkflowRef';
import { toast } from 'react-toastify';

const ProposalDetailAddRow = ({ 
  expenditureType, 
  refreshData, 
  proposalId,
  disabled = false,
  categories = [] 
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newData, setNewData] = useState({});
  
  const handleChange = (field, value) => {
    setNewData(prev => ({
      ...prev,
      [field]: value,
      proposalId: proposalId
    }));
  };

  const handleSave = async () => {
    try {
      // Determine the endpoint based on expenditure type
      let endpoint = '';
      if (expenditureType.includes('Personnel')) {
        endpoint = '/personnel-services';
      } else if (expenditureType === 'MOOE') {
        endpoint = '/mooe';
      } else if (expenditureType === 'Capital Outlay') {
        endpoint = '/capital-outlay';
      } else if (expenditureType === 'Income') {
        endpoint = '/income';
      }

      // Make the API call to add the data
  // Ensure proposalId present (fallback to stored workflowRef if parent prop missing)
  const activeRef = proposalId || getStoredWorkflowRef();
  const payload = { ...newData, proposalId: activeRef };
  await api.post(endpoint, payload, { headers: activeRef ? { 'X-Workflow-Ref': activeRef } : {} });
      toast.success('Item added successfully');
      setIsAdding(false);
      setNewData({});
      refreshData();
    } catch (error) {
      console.error('Error adding item:', error);
      toast.error('Failed to add item');
    }
  };

  // Render different add rows based on expenditure type
  if (!isAdding) {
    // Determine the correct colSpan based on expenditure type
    let colSpan = 6; // Default
    
    if (expenditureType === 'MOOE') {
      colSpan = 7;
    } else if (expenditureType === 'Capital Outlay') {
      colSpan = 9;
    } else if (expenditureType === 'Income') {
      colSpan = 5;
    } else if (expenditureType.includes('Personnel')) {
      colSpan = 6;
    }
    
    return (
      <TableRow>
        <TableCell colSpan={colSpan} align="center">
          {!disabled && (
            <Button
              startIcon={<AddIcon />}
              onClick={() => setIsAdding(true)}
              variant="outlined"
              size="small"
              sx={{
                color: '#375e38',
                borderColor: '#375e38',
                '&:hover': {
                  backgroundColor: 'rgba(55, 94, 56, 0.1)',
                  borderColor: '#375e38'
                }
              }}
            >
              Add New Item
            </Button>
          )}
        </TableCell>
      </TableRow>
    );
  }

  if (expenditureType.includes('Personnel')) {
    return (
      <TableRow>
        <TableCell>
          <IconButton size="small" onClick={handleSave} color="primary">
            <SaveIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => setIsAdding(false)} color="secondary">
            <CancelIcon fontSize="small" />
          </IconButton>
        </TableCell>
        <TableCell>
          <TextField
            fullWidth
            variant="standard"
            placeholder="Employee Name"
            value={newData.employeeFullName || ''}
            onChange={(e) => handleChange('employeeFullName', e.target.value)}
          />
        </TableCell>
        <TableCell>
          <TextField
            fullWidth
            variant="standard"
            placeholder="Position"
            value={newData.positionTitle || ''}
            onChange={(e) => handleChange('positionTitle', e.target.value)}
          />
        </TableCell>
        <TableCell>
          <TextField
            fullWidth
            variant="standard"
            placeholder="Status"
            value={newData.statusOfAppointment || ''}
            onChange={(e) => handleChange('statusOfAppointment', e.target.value)}
          />
        </TableCell>
        <TableCell>
          <TextField
            fullWidth
            variant="standard"
            type="number"
            placeholder="Monthly Salary"
            value={newData.monthlySalary || ''}
            onChange={(e) => handleChange('monthlySalary', parseFloat(e.target.value))}
          />
        </TableCell>
        <TableCell>
          <TextField
            fullWidth
            variant="standard"
            type="number"
            placeholder="Annual Salary"
            value={newData.annualSalary || ''}
            onChange={(e) => handleChange('annualSalary', parseFloat(e.target.value))}
          />
        </TableCell>
      </TableRow>
    );
  } else if (expenditureType === 'MOOE') {
    return (
      <TableRow>
        <TableCell>
          <IconButton size="small" onClick={handleSave} color="primary">
            <SaveIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => setIsAdding(false)} color="secondary">
            <CancelIcon fontSize="small" />
          </IconButton>
        </TableCell>
        <TableCell>
          <TextField
            fullWidth
            variant="standard"
            placeholder="Subline Item"
            value={newData.sublineItem || ''}
            onChange={(e) => handleChange('sublineItem', e.target.value)}
          />
        </TableCell>
        <TableCell>
          <TextField
            fullWidth
            variant="standard"
            placeholder="Accounting Title"
            value={newData.accountingTitle || ''}
            onChange={(e) => handleChange('accountingTitle', e.target.value)}
          />
        </TableCell>
        <TableCell>
          <TextField
            fullWidth
            variant="standard"
            placeholder="UACS Code"
            value={newData.uacsCode || ''}
            onChange={(e) => handleChange('uacsCode', e.target.value)}
          />
        </TableCell>
        <TableCell>
          <TextField
            fullWidth
            variant="standard"
            type="number"
            placeholder="Income"
            value={newData.income || ''}
            onChange={(e) => handleChange('income', parseFloat(e.target.value))}
          />
        </TableCell>
        <TableCell>
          <TextField
            fullWidth
            variant="standard"
            type="number"
            placeholder="Subsidy"
            value={newData.subsidy || ''}
            onChange={(e) => handleChange('subsidy', parseFloat(e.target.value))}
          />
        </TableCell>
        <TableCell>
          <TextField
            fullWidth
            variant="standard"
            type="number"
            placeholder="Amount"
            value={newData.amount || ''}
            onChange={(e) => handleChange('amount', parseFloat(e.target.value))}
          />
        </TableCell>
      </TableRow>
    );
  } else if (expenditureType === 'Capital Outlay') {
    return (
      <TableRow>
        <TableCell>
          <IconButton size="small" onClick={handleSave} color="primary">
            <SaveIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => setIsAdding(false)} color="secondary">
            <CancelIcon fontSize="small" />
          </IconButton>
        </TableCell>
        <TableCell>
          <FormControl fullWidth variant="standard">
            <Select
              displayEmpty
              value={newData.category || ''}
              onChange={(e) => handleChange('category', e.target.value)}
            >
              <MenuItem value="" disabled>
                <em>Select Category</em>
              </MenuItem>
              {categories.map((cat) => (
                <MenuItem key={cat.id || cat} value={cat.categoryName || cat}>
                  {cat.categoryName || cat}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </TableCell>
        <TableCell>
          <TextField
            fullWidth
            variant="standard"
            placeholder="Subline Item"
            value={newData.sublineItem || ''}
            onChange={(e) => handleChange('sublineItem', e.target.value)}
          />
        </TableCell>
        <TableCell>
          <TextField
            fullWidth
            variant="standard"
            placeholder="Accounting Title"
            value={newData.accountingTitle || ''}
            onChange={(e) => handleChange('accountingTitle', e.target.value)}
          />
        </TableCell>
        <TableCell>
          <TextField
            fullWidth
            variant="standard"
            placeholder="UACS Code"
            value={newData.uacsCode || ''}
            onChange={(e) => handleChange('uacsCode', e.target.value)}
          />
        </TableCell>
        <TableCell>
          <TextField
            fullWidth
            variant="standard"
            placeholder="Particulars"
            value={newData.particulars || ''}
            onChange={(e) => handleChange('particulars', e.target.value)}
          />
        </TableCell>
        <TableCell>
          <TextField
            fullWidth
            variant="standard"
            type="number"
            placeholder="Income"
            value={newData.income || ''}
            onChange={(e) => handleChange('income', parseFloat(e.target.value))}
          />
        </TableCell>
        <TableCell>
          <TextField
            fullWidth
            variant="standard"
            type="number"
            placeholder="Subsidy"
            value={newData.subsidy || ''}
            onChange={(e) => handleChange('subsidy', parseFloat(e.target.value))}
          />
        </TableCell>
        <TableCell>
          <TextField
            fullWidth
            variant="standard"
            type="number"
            placeholder="Cost"
            value={newData.cost || ''}
            onChange={(e) => handleChange('cost', parseFloat(e.target.value))}
          />
        </TableCell>
      </TableRow>
    );
  } else if (expenditureType === 'Income') {
    return (
      <TableRow>
        <TableCell>
          <IconButton size="small" onClick={handleSave} color="primary">
            <SaveIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => setIsAdding(false)} color="secondary">
            <CancelIcon fontSize="small" />
          </IconButton>
        </TableCell>
        <TableCell>
          <TextField
            fullWidth
            variant="standard"
            placeholder="Source"
            value={newData.source || ''}
            onChange={(e) => handleChange('source', e.target.value)}
          />
        </TableCell>
        <TableCell>
          <TextField
            fullWidth
            variant="standard"
            placeholder="Category"
            value={newData.category || ''}
            onChange={(e) => handleChange('category', e.target.value)}
          />
        </TableCell>
        <TableCell>
          <TextField
            fullWidth
            variant="standard"
            placeholder="Description"
            value={newData.description || ''}
            onChange={(e) => handleChange('description', e.target.value)}
          />
        </TableCell>
        <TableCell>
          <TextField
            fullWidth
            variant="standard"
            type="number"
            placeholder="Amount"
            value={newData.amount || ''}
            onChange={(e) => handleChange('amount', parseFloat(e.target.value))}
          />
        </TableCell>
      </TableRow>
    );
  }

  // Default fallback row
  // Determine the correct colSpan based on expenditure type
  let colSpan = 6; // Default
  
  if (expenditureType === 'MOOE') {
    colSpan = 7;
  } else if (expenditureType === 'Capital Outlay') {
    colSpan = 9;
  } else if (expenditureType === 'Income') {
    colSpan = 5;
  } else if (expenditureType.includes('Personnel')) {
    colSpan = 6;
  }
  
  return (
    <TableRow>
      <TableCell colSpan={colSpan} align="center">
        <Button
          startIcon={<AddIcon />}
          onClick={() => setIsAdding(false)}
          variant="outlined"
          size="small"
          color="secondary"
        >
          Cancel
        </Button>
      </TableCell>
    </TableRow>
  );
};

export default ProposalDetailAddRow;
