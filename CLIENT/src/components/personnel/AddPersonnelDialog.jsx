import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, FormControl, Autocomplete } from '@mui/material';
import api from '../../config/api'; // API instance for fetching positions
import { toast } from 'react-toastify'; // Import toast for error notifications
import 'react-toastify/dist/ReactToastify.css'; // Import Toastify styles

const AddPersonnelDialog = ({ open, onClose, onAdd }) => {
  const [personnelData, setPersonnelData] = useState({
    name: '',
    position: '',
    department: '',
    salary: '',
  });

  const [positions, setPositions] = useState([]); // Stores fetched positions
  const [department, setDepartment] = useState([]); // Stores fetched department
  const [errors, setErrors] = useState({}); // State for validation errors

  // Fetch positions from the database
  useEffect(() => {
    const fetchPositions = async () => {
      try {
        const response = await api.get('/allpositions'); // Fetch positions from API
        if (response.data && response.data.length > 0) {
          setPositions(response.data);
          setPersonnelData((prev) => ({
            ...prev,
            position: response.data[0].PositionTitle, // Set default position
          }));
        }
      } catch {
        toast.error('Error fetching positions');
      }
    };

    if (open) fetchPositions(); // Fetch only when dialog is opened
  }, [open]);

  // Fetch departments from the database
  useEffect(() => {
    const fetchDepartment = async () => {
      try {
        const response = await api.get('/alldepartment'); // Fetch department from API
        if (response.data && response.data.length > 0) {
          setDepartment(response.data);
          setPersonnelData((prev) => ({
            ...prev,
            department: response.data[0].Department, // Set default department
          }));
        }
      } catch {
        toast.error('Error fetching departments');
      }
    };

    if (open) fetchDepartment(); // Fetch only when dialog is opened
  }, [open]);

  const handleChange = (e) => {
    setPersonnelData({ ...personnelData, [e.target.name]: e.target.value });
  };

  const validate = () => {
    const newErrors = {};
    if (!personnelData.name) newErrors.name = 'Name is required';
    if (!personnelData.position) newErrors.position = 'Position is required';
    if (!personnelData.department) newErrors.department = 'Department is required';
    if (!personnelData.salary) newErrors.salary = 'Salary is required';
    else if (isNaN(personnelData.salary) || personnelData.salary <= 0) newErrors.salary = 'Salary must be a positive number';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onAdd(personnelData);
    } else {
      toast.error('Please fix the validation errors');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Add Personnel</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          label="Name"
          name="name"
          value={personnelData.name}
          onChange={handleChange}
          margin="dense"
          error={!!errors.name}
          helperText={errors.name}
        />
        {/* Position Autocomplete */}
        <FormControl fullWidth margin="dense">
          <Autocomplete
            options={positions}
            value={positions.find(pos => pos.PositionTitle === personnelData.position) || null}
            onChange={(event, newValue) => {
              setPersonnelData({ ...personnelData, position: newValue?.PositionTitle || '' });
            }}
            getOptionLabel={(option) => option.PositionTitle || ''}
            renderOption={(props, option) => (
              <li {...props} key={option._id}>
                {option.PositionTitle}
              </li>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Position"
                variant="outlined"
                error={!!errors.position}
                helperText={errors.position}
              />
            )}
          />
        </FormControl>

        {/* Department Autocomplete */}
        <FormControl fullWidth margin="dense">
          <Autocomplete
            options={department}
            value={department.find(dept => dept.Department === personnelData.department) || null}
            onChange={(event, newValue) => {
              setPersonnelData({ ...personnelData, department: newValue?.Department || '' });
            }}
            getOptionLabel={(option) => option.Department || ''}
            renderOption={(props, option) => (
              <li {...props} key={option._id}>
                {option.Department}
              </li>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Department"
                variant="outlined"
                error={!!errors.department}
                helperText={errors.department}
              />
            )}
          />
        </FormControl>

        <TextField
          fullWidth
          label="Salary"
          name="salary"
          type="number"
          value={personnelData.salary}
          onChange={handleChange}
          margin="dense"
          error={!!errors.salary}
          helperText={errors.salary}
        />
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color="secondary">Cancel</Button>
        <Button onClick={handleSubmit} color="primary">Add</Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddPersonnelDialog;