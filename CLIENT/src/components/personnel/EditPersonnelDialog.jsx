import React, { useState, useEffect } from 'react';
import { Dialog, DialogActions, DialogContent, DialogTitle, TextField, Button } from '@mui/material';
import api from '../../config/api'; 

const EditPersonnelDialog = ({ open, onClose, rowData, onSave }) => {
  const [formData, setFormData] = useState({
    _id: '', // Initialize _id to be part of formData
    employeeFullName: '',
    monthlySalary: '',
    noOfDependent: '',
    hazardPay: '',
    subsistenceAllowance: '',
    honoraria: '',
    childrenAllowance: '',
  });

  useEffect(() => {
    if (rowData) {
      setFormData({
        _id: rowData._id || '', // Assuming _id is part of rowData
        employeeFullName: rowData.employeeFullName || '',
        monthlySalary: rowData.monthlySalary || '',
        noOfDependent: rowData.noOfDependent || '',
        hazardPay: rowData.hazardPay || '',
        subsistenceAllowance: rowData.subsistenceAllowance || '',
        honoraria: rowData.honoraria || '',
        childrenAllowance: (rowData.noOfDependent * 30 * 12) || '', // Calculate children allowance
      });
    }
  }, [rowData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
      childrenAllowance: name === 'noOfDependent' ? (value * 30 * 12) : prevData.childrenAllowance, // Update children allowance dynamically
    }));
  };

  const handleSave = async () => {
    try {
      const { _id, employeeFullName, monthlySalary, noOfDependent,hazardPay,subsistenceAllowance,honoraria } = formData;

      // Ensure that the required fields are passed to the backend
      if (!_id) {
        console.error('Error: Personnel ID is missing.');
        return;
      }

      const response = await api.put(`/personnel-services/${_id}`, {
        _id,
        employeeFullName,
        monthlySalary,
        noOfDependent,
        hazardPay,
        subsistenceAllowance,
        honoraria,
      });

        console.error('Failed to update personnel service:', response.data);
        throw new Error('Failed to update personnel service');
      }

      const updatedPersonnelService = response.data;
      onSave(updatedPersonnelService);
    } catch (error) {
      console.error('Error updating personnel service:', error);
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Edit Personnel</DialogTitle>
      <DialogContent>
       
        <TextField
          margin="dense"
          label="Employee Full Name"
          name="employeeFullName"
          value={formData.employeeFullName}
          onChange={handleChange}
          fullWidth
        />
        <TextField
          margin="dense"
          label="Monthly Salary"
          name="monthlySalary"
          type="number"
          value={formData.monthlySalary}
          onChange={handleChange}
          fullWidth
        />
        <TextField
          margin="dense"
          label="Number of Dependents"
          name="noOfDependent"
          type="number"
          value={formData.noOfDependent}
          onChange={handleChange}
          fullWidth
        />
        <TextField
          margin="dense"
          label="Hazard Pay"
          name="hazardPay"
          type="number"
          value={formData.hazardPay}
          onChange={handleChange}
          fullWidth
        />
        <TextField
          margin="dense"
          label="Subsistence Allowance"
          name="subsistenceAllowance"
          type="number"
          value={formData.subsistenceAllowance}
          onChange={handleChange}
          fullWidth
        />
        <TextField
          margin="dense"
          label="Honoraria"
          name="honoraria"
          type="number"
          value={formData.honoraria}
          onChange={handleChange}
          fullWidth
        />
        <TextField
          margin="dense"
          label="Children Allowance"
          name="childrenAllowance"
          type="number"
          value={formData.childrenAllowance}
          onChange={handleChange}
          fullWidth
          disabled
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">
          Cancel
        </Button>
        <Button onClick={handleSave} color="primary">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditPersonnelDialog;