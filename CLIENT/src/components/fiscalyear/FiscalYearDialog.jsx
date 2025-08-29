// components/FiscalYearDialog.js

import React, { useState } from 'react';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  TextField,
  Grid,
  Typography,
} from '@mui/material';

const FiscalYearDialog = ({ open, handleClose, handleSave }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [fiscalYear, setFiscalYear] = useState('');

  // Function to generate the fiscal year in the format 'FY-YYYY'
  const generateFiscalYear = (startDate) => {
    const year = new Date(startDate).getFullYear();
    return `FY-${year}`;
  };

  const handleStartDateChange = (event) => {
    const newStartDate = event.target.value;
    setStartDate(newStartDate);
    // Automatically generate fiscal year when start date is changed
    setFiscalYear(generateFiscalYear(newStartDate));
  };

  const handleEndDateChange = (event) => setEndDate(event.target.value);

  const handleSubmit = () => {
    const fiscalYearData = { startDate, endDate, fiscalYear };
    handleSave(fiscalYearData);
    handleClose(); // Close the dialog
  };

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogTitle>Create Fiscal Year</DialogTitle>
      <DialogContent>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Typography variant="body2" color="textSecondary">
              Fiscal Year: {fiscalYear || 'N/A'} {/* Show the generated fiscal year */}
            </Typography>
          </Grid>

          <Grid item xs={12}>
            <TextField
              label="Start Date"
              type="date"
              fullWidth
              value={startDate}
              onChange={handleStartDateChange}
              InputLabelProps={{
                shrink: true,
              }}
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              label="End Date"
              type="date"
              fullWidth
              value={endDate}
              onChange={handleEndDateChange}
              InputLabelProps={{
                shrink: true,
              }}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="primary">
          Cancel
        </Button>
        <Button onClick={handleSubmit} color="primary" variant="contained">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FiscalYearDialog;
