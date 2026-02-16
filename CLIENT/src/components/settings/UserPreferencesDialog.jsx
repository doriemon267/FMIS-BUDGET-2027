/**
 * User Preferences Dialog Component
 * 
 * Allows users to customize their application preferences
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Tabs,
  Tab,
  Box,
  FormControlLabel,
  Switch,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography,
  Divider,
  Alert,
  CircularProgress,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useUserPreferences } from '../../hooks/useUserPreferences';
import { useThemeContext } from '../../context/ThemeContext';
import logger from '../../utils/logger';

const TabPanel = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`preferences-tabpanel-${index}`}
      aria-labelledby={`preferences-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
};

const UserPreferencesDialog = ({ open, onClose }) => {
  const theme = useTheme();
  const { setMode } = useThemeContext();
  const {
    preferences,
    isLoading,
    updatePreference,
    resetPreferences,
    isSaving,
    saveError,
  } = useUserPreferences();

  const handleThemeChange = (value) => {
    updatePreference('theme', value);
    if (value === 'light' || value === 'dark') setMode(value);
  };

  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset all preferences to default values?')) {
      resetPreferences();
    }
  };

  if (isLoading) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogContent>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
            <CircularProgress />
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">User Preferences</Typography>
          {isSaving && <CircularProgress size={20} />}
        </Box>
      </DialogTitle>

      <DialogContent>
        {saveError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Failed to save preferences. Please try again.
          </Alert>
        )}

        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={handleTabChange} aria-label="preferences tabs">
            <Tab label="Appearance" />
            <Tab label="Notifications" />
            <Tab label="Dashboard" />
            <Tab label="Proposals" />
            <Tab label="Accessibility" />
          </Tabs>
        </Box>

        {/* Appearance Tab */}
        <TabPanel value={activeTab} index={0}>
          <Typography variant="h6" gutterBottom>
            Appearance Settings
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Theme</InputLabel>
            <Select
              value={preferences.theme || 'auto'}
              label="Theme"
              onChange={(e) => handleThemeChange(e.target.value)}
            >
              <MenuItem value="light">Light</MenuItem>
              <MenuItem value="dark">Dark</MenuItem>
              <MenuItem value="auto">Auto (System)</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Date Format</InputLabel>
            <Select
              value={preferences.dateFormat || 'MM/DD/YYYY'}
              label="Date Format"
              onChange={(e) => updatePreference('dateFormat', e.target.value)}
            >
              <MenuItem value="MM/DD/YYYY">MM/DD/YYYY</MenuItem>
              <MenuItem value="DD/MM/YYYY">DD/MM/YYYY</MenuItem>
              <MenuItem value="YYYY-MM-DD">YYYY-MM-DD</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Time Format</InputLabel>
            <Select
              value={preferences.timeFormat || '12h'}
              label="Time Format"
              onChange={(e) => updatePreference('timeFormat', e.target.value)}
            >
              <MenuItem value="12h">12 Hour (AM/PM)</MenuItem>
              <MenuItem value="24h">24 Hour</MenuItem>
            </Select>
          </FormControl>
        </TabPanel>

        {/* Notifications Tab */}
        <TabPanel value={activeTab} index={1}>
          <Typography variant="h6" gutterBottom>
            Notification Settings
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <FormControlLabel
            control={
              <Switch
                checked={preferences.notifications?.email ?? true}
                onChange={(e) => updatePreference('notifications.email', e.target.checked)}
              />
            }
            label="Email Notifications"
            sx={{ mb: 1 }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={preferences.notifications?.browser ?? true}
                onChange={(e) => updatePreference('notifications.browser', e.target.checked)}
              />
            }
            label="Browser Notifications"
            sx={{ mb: 1 }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={preferences.notifications?.workflow ?? true}
                onChange={(e) => updatePreference('notifications.workflow', e.target.checked)}
              />
            }
            label="Workflow Notifications"
            sx={{ mb: 1 }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={preferences.notifications?.deadline ?? true}
                onChange={(e) => updatePreference('notifications.deadline', e.target.checked)}
              />
            }
            label="Deadline Reminders"
            sx={{ mb: 1 }}
          />
        </TabPanel>

        {/* Dashboard Tab */}
        <TabPanel value={activeTab} index={2}>
          <Typography variant="h6" gutterBottom>
            Dashboard Settings
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Default View</InputLabel>
            <Select
              value={preferences.dashboard?.defaultView || 'overview'}
              label="Default View"
              onChange={(e) => updatePreference('dashboard.defaultView', e.target.value)}
            >
              <MenuItem value="overview">Overview</MenuItem>
              <MenuItem value="analytics">Analytics</MenuItem>
              <MenuItem value="reports">Reports</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Items Per Page</InputLabel>
            <Select
              value={preferences.dashboard?.itemsPerPage || 25}
              label="Items Per Page"
              onChange={(e) => updatePreference('dashboard.itemsPerPage', e.target.value)}
            >
              <MenuItem value={10}>10</MenuItem>
              <MenuItem value={25}>25</MenuItem>
              <MenuItem value={50}>50</MenuItem>
              <MenuItem value={100}>100</MenuItem>
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Switch
                checked={preferences.dashboard?.showCompleted ?? false}
                onChange={(e) => updatePreference('dashboard.showCompleted', e.target.checked)}
              />
            }
            label="Show Completed Items"
            sx={{ mb: 1 }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={preferences.dashboard?.showArchived ?? false}
                onChange={(e) => updatePreference('dashboard.showArchived', e.target.checked)}
              />
            }
            label="Show Archived Items"
            sx={{ mb: 1 }}
          />
        </TabPanel>

        {/* Proposals Tab */}
        <TabPanel value={activeTab} index={3}>
          <Typography variant="h6" gutterBottom>
            Proposal Settings
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Default Filter</InputLabel>
            <Select
              value={preferences.proposals?.defaultFilter || 'all'}
              label="Default Filter"
              onChange={(e) => updatePreference('proposals.defaultFilter', e.target.value)}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="approved">Approved</MenuItem>
              <MenuItem value="rejected">Rejected</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Sort By</InputLabel>
            <Select
              value={preferences.proposals?.sortBy || 'updatedAt'}
              label="Sort By"
              onChange={(e) => updatePreference('proposals.sortBy', e.target.value)}
            >
              <MenuItem value="createdAt">Created Date</MenuItem>
              <MenuItem value="updatedAt">Updated Date</MenuItem>
              <MenuItem value="title">Title</MenuItem>
              <MenuItem value="status">Status</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Sort Order</InputLabel>
            <Select
              value={preferences.proposals?.sortOrder || 'desc'}
              label="Sort Order"
              onChange={(e) => updatePreference('proposals.sortOrder', e.target.value)}
            >
              <MenuItem value="asc">Ascending</MenuItem>
              <MenuItem value="desc">Descending</MenuItem>
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Switch
                checked={preferences.proposals?.showDetails ?? true}
                onChange={(e) => updatePreference('proposals.showDetails', e.target.checked)}
              />
            }
            label="Show Details by Default"
            sx={{ mb: 1 }}
          />
        </TabPanel>

        {/* Accessibility Tab */}
        <TabPanel value={activeTab} index={4}>
          <Typography variant="h6" gutterBottom>
            Accessibility Settings
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <FormControlLabel
            control={
              <Switch
                checked={preferences.accessibility?.highContrast ?? false}
                onChange={(e) => updatePreference('accessibility.highContrast', e.target.checked)}
              />
            }
            label="High Contrast Mode"
            sx={{ mb: 1 }}
          />

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Font Size</InputLabel>
            <Select
              value={preferences.accessibility?.fontSize || 'medium'}
              label="Font Size"
              onChange={(e) => updatePreference('accessibility.fontSize', e.target.value)}
            >
              <MenuItem value="small">Small</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="large">Large</MenuItem>
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Switch
                checked={preferences.accessibility?.reduceMotion ?? false}
                onChange={(e) => updatePreference('accessibility.reduceMotion', e.target.checked)}
              />
            }
            label="Reduce Motion"
            sx={{ mb: 1 }}
          />
        </TabPanel>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleReset} color="warning">
          Reset to Defaults
        </Button>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UserPreferencesDialog;
