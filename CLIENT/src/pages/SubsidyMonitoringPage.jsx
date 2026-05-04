import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import api from '../config/api';
import SubsidyBalanceMonitor from '../components/monitoring/SubsidyBalanceMonitor';
import { useUser } from '../context/UserContext';

const SubsidyMonitoringPage = () => {
  const { currentUser } = useUser();
  const [fiscalYear, setFiscalYear] = useState('');
  const [budgetType, setBudgetType] = useState('');

  // Fetch settings for fiscal year and budget type options
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await api.get('/settings');
      return response.data;
    }
  });

  // Set default values from active settings
  useEffect(() => {
    if (settings) {
      const activeSettings = settings.find(setting => setting.isActive);
      if (activeSettings) {
        setFiscalYear(activeSettings.fiscalYear);
        setBudgetType(activeSettings.budgetType);
      }
    }
  }, [settings]);

  return (
    <Container maxWidth={false} sx={{ mt: 4, mb: 4, px: { xs: 2, md: 3 } }}>
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Subsidy Monitoring
        </Typography>
        <Typography variant="body1" paragraph>
          Monitor the balance between MOOE/Capital Outlay subsidies and Budgetary Support.
        </Typography>

        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Fiscal Year</InputLabel>
              <Select
                value={fiscalYear}
                label="Fiscal Year"
                onChange={(e) => setFiscalYear(e.target.value)}
              >
                {settings?.map((setting) => (
                  <MenuItem key={setting.fiscalYear} value={setting.fiscalYear}>
                    {setting.fiscalYear}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Budget Type</InputLabel>
              <Select
                value={budgetType}
                label="Budget Type"
                onChange={(e) => setBudgetType(e.target.value)}
              >
                <MenuItem value="TIER1">TIER 1</MenuItem>
                <MenuItem value="TIER2">TIER 2</MenuItem>
                <MenuItem value="NEP">NEP</MenuItem>
                <MenuItem value="GAA">GAA</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        {fiscalYear && budgetType && (
          <SubsidyBalanceMonitor 
            fiscalYear={fiscalYear} 
            budgetType={budgetType} 
          />
        )}
      </Paper>
    </Container>
  );
};

export default SubsidyMonitoringPage;