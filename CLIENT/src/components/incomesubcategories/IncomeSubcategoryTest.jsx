import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

const IncomeSubcategoryTest = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5">
          Income Subcategories Test Component
        </Typography>
        <Typography>
          This is a simple test component to verify imports are working.
        </Typography>
      </Paper>
    </Box>
  );
};

export default IncomeSubcategoryTest;