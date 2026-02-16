/**
 * Advanced Filters Component
 * Supports date range, status, budget type, and custom filters
 */

import {
  Box,
  Paper,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Stack,
  Button,
  IconButton,
  Collapse,
} from '@mui/material';
// DatePicker - using native HTML5 date input if @mui/x-date-pickers is not available
// import { DatePicker } from '@mui/x-date-pickers/DatePicker';
// import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
// import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';
import { useState } from 'react';

const AdvancedFilters = ({
  filters = {},
  onFilterChange,
  onClear,
  availableStatuses = [],
  availableBudgetTypes = [],
  showDateRange = true,
  showStatus = true,
  showBudgetType = true,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [localFilters, setLocalFilters] = useState(filters);

  const handleFilterChange = (key, value) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
    if (onFilterChange) {
      onFilterChange(newFilters);
    }
  };

  const handleClear = () => {
    const clearedFilters = {};
    setLocalFilters(clearedFilters);
    if (onClear) {
      onClear();
    }
    if (onFilterChange) {
      onFilterChange(clearedFilters);
    }
  };

  const activeFilterCount = Object.values(localFilters).filter(
    (v) => v !== null && v !== undefined && v !== ''
  ).length;

  return (
    <Box sx={{ mb: 2 }}>
      <Button
        startIcon={<FilterListIcon />}
        onClick={() => setExpanded(!expanded)}
        variant="outlined"
        size="small"
        sx={{ mb: 1 }}
      >
        Advanced Filters
        {activeFilterCount > 0 && (
          <Chip
            label={activeFilterCount}
            size="small"
            color="primary"
            sx={{ ml: 1, height: 20 }}
          />
        )}
      </Button>

      <Collapse in={expanded}>
        <Paper sx={{ p: 2, mt: 1 }}>
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle2" fontWeight="bold">
                Filter Options
              </Typography>
              {activeFilterCount > 0 && (
                <Button
                  size="small"
                  startIcon={<ClearIcon />}
                  onClick={handleClear}
                  color="error"
                >
                  Clear All
                </Button>
              )}
            </Box>

            {showDateRange && (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Start Date"
                  type="date"
                  size="small"
                  fullWidth
                  value={localFilters.startDate ? new Date(localFilters.startDate).toISOString().split('T')[0] : ''}
                  onChange={(e) => handleFilterChange('startDate', e.target.value ? new Date(e.target.value) : null)}
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  label="End Date"
                  type="date"
                  size="small"
                  fullWidth
                  value={localFilters.endDate ? new Date(localFilters.endDate).toISOString().split('T')[0] : ''}
                  onChange={(e) => handleFilterChange('endDate', e.target.value ? new Date(e.target.value) : null)}
                  InputLabelProps={{ shrink: true }}
                />
              </Stack>
            )}

            {showStatus && availableStatuses.length > 0 && (
              <FormControl size="small" fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={localFilters.status || ''}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  label="Status"
                >
                  <MenuItem value="">All Statuses</MenuItem>
                  {availableStatuses.map((status) => (
                    <MenuItem key={status} value={status}>
                      {status}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {showBudgetType && availableBudgetTypes.length > 0 && (
              <FormControl size="small" fullWidth>
                <InputLabel>Budget Type</InputLabel>
                <Select
                  value={localFilters.budgetType || ''}
                  onChange={(e) => handleFilterChange('budgetType', e.target.value)}
                  label="Budget Type"
                >
                  <MenuItem value="">All Budget Types</MenuItem>
                  {availableBudgetTypes.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {/* Active Filters Display */}
            {activeFilterCount > 0 && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                  Active Filters:
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {localFilters.startDate && (
                    <Chip
                      label={`From: ${localFilters.startDate.toLocaleDateString()}`}
                      size="small"
                      onDelete={() => handleFilterChange('startDate', null)}
                    />
                  )}
                  {localFilters.endDate && (
                    <Chip
                      label={`To: ${localFilters.endDate.toLocaleDateString()}`}
                      size="small"
                      onDelete={() => handleFilterChange('endDate', null)}
                    />
                  )}
                  {localFilters.status && (
                    <Chip
                      label={`Status: ${localFilters.status}`}
                      size="small"
                      onDelete={() => handleFilterChange('status', '')}
                    />
                  )}
                  {localFilters.budgetType && (
                    <Chip
                      label={`Budget: ${localFilters.budgetType}`}
                      size="small"
                      onDelete={() => handleFilterChange('budgetType', '')}
                    />
                  )}
                </Stack>
              </Box>
            )}
          </Stack>
        </Paper>
      </Collapse>
    </Box>
  );
};

export default AdvancedFilters;
