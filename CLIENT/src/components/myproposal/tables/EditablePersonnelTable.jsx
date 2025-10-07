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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import RestoreIcon from '@mui/icons-material/Restore';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

const EditablePersonnelTable = ({ data, onChange }) => {
  const handleFieldChange = (index, field, value) => {
    const newData = [...data];
    const numValue = ['monthlySalary', 'annualSalary', 'RATA', 'PERA', 'uniformALLOWANCE', 'productivityIncentive',
      'medical', 'childrenAllowance', 'meal', 'cashGift', 'subsistenceAllowanceMDS', 'subsistenceAllowanceST',
      'midyearBonus', 'yearEndBonus', 'gsisPremium', 'philhealthPremium', 'pagibigPremium', 'employeeCompensation',
      'loyaltyAward', 'overtimePay', 'earnedLeaves', 'retirementBenefits', 'terminalLeave', 'courtAppearance', 'Total'
    ].includes(field) ? (parseFloat(value) || 0) : value;
    
    newData[index] = {
      ...newData[index],
      [field]: numValue,
      changeType: newData[index].originalId ? 'modified' : 'added'
    };
    
    // Recalculate Total
    if (field !== 'Total') {
      const item = newData[index];
      item.Total = (item.annualSalary || 0) + (item.RATA || 0) + (item.PERA || 0) + (item.uniformALLOWANCE || 0) +
        (item.productivityIncentive || 0) + (item.medical || 0) + (item.childrenAllowance || 0) + (item.meal || 0) +
        (item.cashGift || 0) + (item.subsistenceAllowanceMDS || 0) + (item.subsistenceAllowanceST || 0) +
        (item.midyearBonus || 0) + (item.yearEndBonus || 0) + (item.gsisPremium || 0) + (item.philhealthPremium || 0) +
        (item.pagibigPremium || 0) + (item.employeeCompensation || 0) + (item.loyaltyAward || 0) + (item.overtimePay || 0) +
        (item.earnedLeaves || 0) + (item.retirementBenefits || 0) + (item.terminalLeave || 0) + (item.courtAppearance || 0);
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
        <Chip label={`Total: ${formatCurrency(data.reduce((sum, item) => sum + (item.changeType !== 'deleted' ? (item.Total || 0) : 0), 0))}`} color="primary" />
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={handleAddRow}>
          Add Personnel
        </Button>
      </Box>

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
              <TableCell align="center"><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Box sx={{ py: 3, color: 'text.secondary' }}>
                    No personnel entries. Click "Add Personnel" to create one.
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              data.map((item, index) => (
                <React.Fragment key={index}>
                  <TableRow sx={getRowStyle(item)}>
                    <TableCell>
                      <TextField
                        value={item.employeeFullName || ''}
                        onChange={(e) => handleFieldChange(index, 'employeeFullName', e.target.value)}
                        size="small"
                        fullWidth
                        disabled={item.changeType === 'deleted'}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        value={item.positionTitle || ''}
                        onChange={(e) => handleFieldChange(index, 'positionTitle', e.target.value)}
                        size="small"
                        fullWidth
                        disabled={item.changeType === 'deleted'}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        value={item.statusOfAppointment || ''}
                        onChange={(e) => handleFieldChange(index, 'statusOfAppointment', e.target.value)}
                        size="small"
                        fullWidth
                        disabled={item.changeType === 'deleted'}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        type="number"
                        value={item.monthlySalary || 0}
                        onChange={(e) => handleFieldChange(index, 'monthlySalary', e.target.value)}
                        size="small"
                        fullWidth
                        disabled={item.changeType === 'deleted'}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        type="number"
                        value={item.annualSalary || 0}
                        onChange={(e) => handleFieldChange(index, 'annualSalary', e.target.value)}
                        size="small"
                        fullWidth
                        disabled={item.changeType === 'deleted'}
                      />
                    </TableCell>
                    <TableCell>{formatCurrency(item.Total)}</TableCell>
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
                  <TableRow sx={getRowStyle(item)}>
                    <TableCell colSpan={8} sx={{ p: 0 }}>
                      <Accordion sx={{ boxShadow: 'none', '&:before': { display: 'none' } }}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Typography variant="caption">View/Edit Additional Details</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2 }}>
                            {['RATA', 'PERA', 'uniformALLOWANCE', 'productivityIncentive', 'medical', 'childrenAllowance',
                              'meal', 'cashGift', 'subsistenceAllowanceMDS', 'subsistenceAllowanceST', 'midyearBonus',
                              'yearEndBonus', 'gsisPremium', 'philhealthPremium', 'pagibigPremium', 'employeeCompensation',
                              'loyaltyAward', 'overtimePay', 'earnedLeaves', 'retirementBenefits', 'terminalLeave', 'courtAppearance'
                            ].map(field => (
                              <TextField
                                key={field}
                                label={field.replace(/([A-Z])/g, ' $1').trim()}
                                type="number"
                                value={item[field] || 0}
                                onChange={(e) => handleFieldChange(index, field, e.target.value)}
                                size="small"
                                fullWidth
                                disabled={item.changeType === 'deleted'}
                              />
                            ))}
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

export default EditablePersonnelTable;