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
  IconButton,
  Paper,
  Stack,
  alpha
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {
  Settings as SettingsIcon,
  Palette as PaletteIcon,
  NotificationsActive as NotificationsIcon,
  Dashboard as DashboardIcon,
  ReceiptLong as ProposalsIcon,
  AccessibilityNew as AccessibilityIcon,
  Restore as RestoreIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import Swal from 'sweetalert2';
import { useUserPreferences } from '../../hooks/useUserPreferences';
import { useThemeContext } from '../../context/ThemeContext';

const TabPanel = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`preferences-tabpanel-${index}`}
      aria-labelledby={`preferences-tab-${index}`}
      style={{ height: '100%' }}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: { xs: 3, md: 4.5 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
};

const UserPreferencesDialog = ({ open, onClose }) => {
  const theme = useTheme();
  const { mode, setMode } = useThemeContext();
  const isDarkMode = mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

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

  const handleReset = async () => {
    const result = await Swal.fire({
      title: "Reset Preferences?",
      text: "Are you sure you want to restore all preferences to their default values?",
      icon: "warning",
      iconColor: "#f48c06",
      showCancelButton: true,
      confirmButtonText: "Yes, Reset",
      cancelButtonText: "Cancel",
      background: isDarkMode ? "#152e22" : "#ffffff",
      color: isDarkMode ? "#cbd5e1" : "#1e293b",
      confirmButtonColor: "#f48c06",
      cancelButtonColor: "#386641",
      reverseButtons: true,
      allowOutsideClick: false,
      customClass: {
        popup: 'premium-swal-popup',
        title: 'premium-swal-title',
        htmlContainer: 'premium-swal-text',
        confirmButton: 'premium-swal-confirm',
        cancelButton: 'premium-swal-cancel',
      }
    });

    if (result.isConfirmed) {
      resetPreferences();
      Swal.fire({
        title: "Reset Completed",
        text: "Your preferences have been successfully restored to default.",
        icon: "success",
        confirmButtonText: "Okay",
        confirmButtonColor: "#386641",
        background: isDarkMode ? "#152e22" : "#ffffff",
        color: isDarkMode ? "#cbd5e1" : "#1e293b",
        customClass: {
          popup: 'premium-swal-popup',
          title: 'premium-swal-title',
          htmlContainer: 'premium-swal-text',
          confirmButton: 'premium-swal-confirm',
        }
      });
    }
  };

  if (isLoading) {
    return (
      <Dialog 
        open={open} 
        onClose={onClose} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 6,
            border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
            bgcolor: isDarkMode ? '#0f172a' : '#ffffff',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          }
        }}
      >
        <DialogContent>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={300}>
            <CircularProgress color="success" />
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  // Common styles for form controls to look extremely premium
  const selectStyles = {
    borderRadius: 3,
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    },
    '&:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: '#60a561',
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: '#60a561',
    }
  };

  const switchContainerStyles = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    p: 2.5,
    borderRadius: 4,
    border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
    bgcolor: isDarkMode ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)',
    transition: 'all 0.3s ease',
    '&:hover': {
      borderColor: 'rgba(96,165,97,0.3)',
      bgcolor: isDarkMode ? 'rgba(96,165,97,0.02)' : 'rgba(96,165,97,0.01)',
    }
  };

  return (
    <>
      <style>{`
        .premium-swal-popup {
          border-radius: 24px !important;
          font-family: 'Outfit', 'Inter', 'Roboto', sans-serif !important;
          border: 1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'} !important;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25) !important;
          padding: 2.5rem 1.5rem !important;
        }
        .premium-swal-title {
          font-weight: 900 !important;
          font-size: 1.6rem !important;
          letter-spacing: -0.5px !important;
          margin-bottom: 0.5rem !important;
        }
        .premium-swal-text {
          font-weight: 500 !important;
          font-size: 1rem !important;
          opacity: 0.85 !important;
          margin-bottom: 1.5rem !important;
        }
        .premium-swal-confirm {
          border-radius: 12px !important;
          font-weight: 700 !important;
          font-size: 0.95rem !important;
          padding: 12px 24px !important;
          transition: all 0.3s ease !important;
        }
        .premium-swal-confirm:hover {
          transform: translateY(-2px) !important;
        }
        .premium-swal-cancel {
          border-radius: 12px !important;
          font-weight: 700 !important;
          font-size: 0.95rem !important;
          padding: 12px 24px !important;
          transition: all 0.3s ease !important;
        }
        .premium-swal-cancel:hover {
          transform: translateY(-2px) !important;
        }
      `}</style>

      <Dialog 
        open={open} 
        onClose={onClose} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 6,
            border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
            bgcolor: isDarkMode ? '#0f172a' : '#ffffff',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          }
        }}
      >
        <DialogTitle sx={{ p: 3.5, borderBottom: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}` }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box display="flex" alignItems="center" gap={2}>
              <Box sx={{ 
                display: 'flex', p: 1.2, borderRadius: 4, 
                bgcolor: isDarkMode ? 'rgba(96,165,97,0.12)' : 'rgba(96,165,97,0.08)', 
                color: '#60a561',
                boxShadow: `0 8px 16px -4px ${alpha('#60a561', 0.2)}`
              }}>
                <SettingsIcon />
              </Box>
              <Box>
                <Typography variant="h5" fontWeight="900" sx={{ letterSpacing: -0.5, lineHeight: 1.1 }}>User Preferences</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>Customize your default application settings</Typography>
              </Box>
            </Box>
            <Box display="flex" alignItems="center" gap={1.5}>
              {isSaving && <CircularProgress size={20} color="success" />}
              <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary', bgcolor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', '&:hover': { bgcolor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' } }}>
                <CloseIcon size={18} />
              </IconButton>
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 0, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, minHeight: 480 }}>
          {/* Left Vertical Tab Bar */}
          <Box sx={{
            width: { xs: '100%', md: 250 },
            borderRight: { xs: 'none', md: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}` },
            borderBottom: { xs: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`, md: 'none' },
            bgcolor: isDarkMode ? 'rgba(255,255,255,0.01)' : '#f8fafc',
            p: 2.5,
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0
          }}>
            <Tabs
              orientation={isMobile ? 'horizontal' : 'vertical'}
              variant="scrollable"
              scrollButtons="auto"
              value={activeTab}
              onChange={handleTabChange}
              sx={{
                height: '100%',
                '& .MuiTabs-indicator': {
                  width: { xs: '100%', md: 4 },
                  borderRadius: 2,
                  left: { xs: 0, md: 0 },
                  bgcolor: '#60a561',
                },
                '& .MuiTab-root': {
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                  borderRadius: 3.5,
                  minHeight: 52,
                  py: 1.5,
                  px: 2.5,
                  mb: { xs: 0, md: 1 },
                  mr: { xs: 1, md: 0 },
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  textTransform: 'none',
                  color: 'text.secondary',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  minWidth: { xs: 120, md: 'auto' },
                  '&:hover': {
                    bgcolor: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                    color: 'text.primary',
                  },
                  '&.Mui-selected': {
                    color: '#60a561',
                    bgcolor: isDarkMode ? 'rgba(96,165,97,0.1)' : 'rgba(96,165,97,0.05)',
                  }
                }
              }}
            >
              <Tab icon={<PaletteIcon sx={{ fontSize: 20, mr: 1.5 }} />} iconPosition="start" label="Appearance" />
              <Tab icon={<NotificationsIcon sx={{ fontSize: 20, mr: 1.5 }} />} iconPosition="start" label="Notifications" />
              <Tab icon={<DashboardIcon sx={{ fontSize: 20, mr: 1.5 }} />} iconPosition="start" label="Dashboard" />
              <Tab icon={<ProposalsIcon sx={{ fontSize: 20, mr: 1.5 }} />} iconPosition="start" label="Proposals" />
              <Tab icon={<AccessibilityIcon sx={{ fontSize: 20, mr: 1.5 }} />} iconPosition="start" label="Accessibility" />
            </Tabs>
          </Box>

          {/* Right Forms Content Area */}
          <Box sx={{ flexGrow: 1, overflowY: 'auto', maxHeight: 520, p: 1 }}>
            {saveError && (
              <Box sx={{ p: 3, pb: 0 }}>
                <Alert severity="error" sx={{ borderRadius: 3 }}>
                  Failed to save preferences. Please try again.
                </Alert>
              </Box>
            )}

            {/* Appearance Tab */}
            <TabPanel value={activeTab} index={0}>
              <Box>
                <Typography variant="h6" fontWeight="900" sx={{ letterSpacing: -0.5 }} gutterBottom>
                  Appearance Settings
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 3 }}>
                  Customize the overall theme, dates, and clock layouts.
                </Typography>
                <Divider sx={{ mb: 4 }} />
              </Box>

              <Stack spacing={3.5}>
                <FormControl fullWidth>
                  <Typography variant="subtitle2" fontWeight="800" gutterBottom>System Theme</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5, fontWeight: 500 }}>
                    Choose between Light, Dark, or System automatic themes.
                  </Typography>
                  <Select
                    value={preferences.theme || 'auto'}
                    sx={selectStyles}
                    onChange={(e) => handleThemeChange(e.target.value)}
                  >
                    <MenuItem value="light">Light Mode</MenuItem>
                    <MenuItem value="dark">Dark Mode</MenuItem>
                    <MenuItem value="auto">Auto (System Standard)</MenuItem>
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <Typography variant="subtitle2" fontWeight="800" gutterBottom>Date Format</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5, fontWeight: 500 }}>
                    Select your preferred date layout for lists and tables.
                  </Typography>
                  <Select
                    value={preferences.dateFormat || 'MM/DD/YYYY'}
                    sx={selectStyles}
                    onChange={(e) => updatePreference('dateFormat', e.target.value)}
                  >
                    <MenuItem value="MM/DD/YYYY">MM/DD/YYYY (e.g. 05/31/2026)</MenuItem>
                    <MenuItem value="DD/MM/YYYY">DD/MM/YYYY (e.g. 31/05/2026)</MenuItem>
                    <MenuItem value="YYYY-MM-DD">YYYY-MM-DD (e.g. 2026-05-31)</MenuItem>
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <Typography variant="subtitle2" fontWeight="800" gutterBottom>Time Format</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5, fontWeight: 500 }}>
                    Choose between 12-hour or 24-hour clock formats.
                  </Typography>
                  <Select
                    value={preferences.timeFormat || '12h'}
                    sx={selectStyles}
                    onChange={(e) => updatePreference('timeFormat', e.target.value)}
                  >
                    <MenuItem value="12h">12 Hour (AM/PM - e.g. 04:09 PM)</MenuItem>
                    <MenuItem value="24h">24 Hour (Military - e.g. 16:09)</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            </TabPanel>

            {/* Notifications Tab */}
            <TabPanel value={activeTab} index={1}>
              <Box>
                <Typography variant="h6" fontWeight="900" sx={{ letterSpacing: -0.5 }} gutterBottom>
                  Notification Settings
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 3 }}>
                  Select which notification alerts you wish to receive.
                </Typography>
                <Divider sx={{ mb: 4 }} />
              </Box>

              <Stack spacing={2.5}>
                <Box sx={switchContainerStyles}>
                  <Box sx={{ pr: 2 }}>
                    <Typography variant="subtitle2" fontWeight="800">Email Notifications</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                      Receive critical proposal updates and approvals in your inbox.
                    </Typography>
                  </Box>
                  <Switch
                    color="success"
                    checked={preferences.notifications?.email ?? true}
                    onChange={(e) => updatePreference('notifications.email', e.target.checked)}
                  />
                </Box>

                <Box sx={switchContainerStyles}>
                  <Box sx={{ pr: 2 }}>
                    <Typography variant="subtitle2" fontWeight="800">Browser Notifications</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                      Show real-time notifications on your screen while using the system.
                    </Typography>
                  </Box>
                  <Switch
                    color="success"
                    checked={preferences.notifications?.browser ?? true}
                    onChange={(e) => updatePreference('notifications.browser', e.target.checked)}
                  />
                </Box>

                <Box sx={switchContainerStyles}>
                  <Box sx={{ pr: 2 }}>
                    <Typography variant="subtitle2" fontWeight="800">Workflow Notifications</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                      Notify when a proposal moves to a new review or approval stage.
                    </Typography>
                  </Box>
                  <Switch
                    color="success"
                    checked={preferences.notifications?.workflow ?? true}
                    onChange={(e) => updatePreference('notifications.workflow', e.target.checked)}
                  />
                </Box>

                <Box sx={switchContainerStyles}>
                  <Box sx={{ pr: 2 }}>
                    <Typography variant="subtitle2" fontWeight="800">Deadline Reminders</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                      Send automated reminders before budget submission deadlines arrive.
                    </Typography>
                  </Box>
                  <Switch
                    color="success"
                    checked={preferences.notifications?.deadline ?? true}
                    onChange={(e) => updatePreference('notifications.deadline', e.target.checked)}
                  />
                </Box>
              </Stack>
            </TabPanel>

            {/* Dashboard Tab */}
            <TabPanel value={activeTab} index={2}>
              <Box>
                <Typography variant="h6" fontWeight="900" sx={{ letterSpacing: -0.5 }} gutterBottom>
                  Dashboard Settings
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 3 }}>
                  Customize your default dashboard view and layouts.
                </Typography>
                <Divider sx={{ mb: 4 }} />
              </Box>

              <Stack spacing={3.5}>
                <FormControl fullWidth>
                  <Typography variant="subtitle2" fontWeight="800" gutterBottom>Default Screen View</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5, fontWeight: 500 }}>
                    Choose the primary landing screen after system login.
                  </Typography>
                  <Select
                    value={preferences.dashboard?.defaultView || 'overview'}
                    sx={selectStyles}
                    onChange={(e) => updatePreference('dashboard.defaultView', e.target.value)}
                  >
                    <MenuItem value="overview">Overview Dashboard</MenuItem>
                    <MenuItem value="analytics">Analytics Dashboard</MenuItem>
                    <MenuItem value="reports">Comprehensive Reports</MenuItem>
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <Typography variant="subtitle2" fontWeight="800" gutterBottom>Table Items Per Page</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5, fontWeight: 500 }}>
                    Determine the default row count for lists and budget tables.
                  </Typography>
                  <Select
                    value={preferences.dashboard?.itemsPerPage || 25}
                    sx={selectStyles}
                    onChange={(e) => updatePreference('dashboard.itemsPerPage', e.target.value)}
                  >
                    <MenuItem value={10}>10 items per page</MenuItem>
                    <MenuItem value={25}>25 items per page</MenuItem>
                    <MenuItem value={50}>50 items per page</MenuItem>
                    <MenuItem value={100}>100 items per page</MenuItem>
                  </Select>
                </FormControl>

                <Stack spacing={2.5} sx={{ mt: 1 }}>
                  <Box sx={switchContainerStyles}>
                    <Box sx={{ pr: 2 }}>
                      <Typography variant="subtitle2" fontWeight="800">Show Completed Items</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                        Include fully approved and finalized proposals in your lists by default.
                      </Typography>
                    </Box>
                    <Switch
                      color="success"
                      checked={preferences.dashboard?.showCompleted ?? false}
                      onChange={(e) => updatePreference('dashboard.showCompleted', e.target.checked)}
                    />
                  </Box>

                  <Box sx={switchContainerStyles}>
                    <Box sx={{ pr: 2 }}>
                      <Typography variant="subtitle2" fontWeight="800">Show Archived Items</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                        Display historic archived proposals in your main tracker list.
                      </Typography>
                    </Box>
                    <Switch
                      color="success"
                      checked={preferences.dashboard?.showArchived ?? false}
                      onChange={(e) => updatePreference('dashboard.showArchived', e.target.checked)}
                    />
                  </Box>
                </Stack>
              </Stack>
            </TabPanel>

            {/* Proposals Tab */}
            <TabPanel value={activeTab} index={3}>
              <Box>
                <Typography variant="h6" fontWeight="900" sx={{ letterSpacing: -0.5 }} gutterBottom>
                  Proposal Settings
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 3 }}>
                  Set default sorting and tracking preferences for budget proposals.
                </Typography>
                <Divider sx={{ mb: 4 }} />
              </Box>

              <Stack spacing={3.5}>
                <FormControl fullWidth>
                  <Typography variant="subtitle2" fontWeight="800" gutterBottom>Default Status Filter</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5, fontWeight: 500 }}>
                    Select the default status filter applied on budget trackers.
                  </Typography>
                  <Select
                    value={preferences.proposals?.defaultFilter || 'all'}
                    sx={selectStyles}
                    onChange={(e) => updatePreference('proposals.defaultFilter', e.target.value)}
                  >
                    <MenuItem value="all">All Proposals</MenuItem>
                    <MenuItem value="pending">Pending Review</MenuItem>
                    <MenuItem value="approved">Approved & Finalized</MenuItem>
                    <MenuItem value="rejected">Rejected & Returned</MenuItem>
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <Typography variant="subtitle2" fontWeight="800" gutterBottom>Primary Column Sorting</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5, fontWeight: 500 }}>
                    Select which data column should be used for sorting proposals.
                  </Typography>
                  <Select
                    value={preferences.proposals?.sortBy || 'updatedAt'}
                    sx={selectStyles}
                    onChange={(e) => updatePreference('proposals.sortBy', e.target.value)}
                  >
                    <MenuItem value="createdAt">Created Date</MenuItem>
                    <MenuItem value="updatedAt">Updated Date</MenuItem>
                    <MenuItem value="title">Proposal Title</MenuItem>
                    <MenuItem value="status">Workflow Status</MenuItem>
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <Typography variant="subtitle2" fontWeight="800" gutterBottom>Sort Direction</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5, fontWeight: 500 }}>
                    Determine sorting direction order.
                  </Typography>
                  <Select
                    value={preferences.proposals?.sortOrder || 'desc'}
                    sx={selectStyles}
                    onChange={(e) => updatePreference('proposals.sortOrder', e.target.value)}
                  >
                    <MenuItem value="asc">Ascending (A-Z / Oldest first)</MenuItem>
                    <MenuItem value="desc">Descending (Z-A / Newest first)</MenuItem>
                  </Select>
                </FormControl>

                <Box sx={switchContainerStyles}>
                  <Box sx={{ pr: 2 }}>
                    <Typography variant="subtitle2" fontWeight="800">Show Details by Default</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                      Automatically expand breakdown details and sub-tables on page load.
                    </Typography>
                  </Box>
                  <Switch
                    color="success"
                    checked={preferences.proposals?.showDetails ?? true}
                    onChange={(e) => updatePreference('proposals.showDetails', e.target.checked)}
                  />
                </Box>
              </Stack>
            </TabPanel>

            {/* Accessibility Tab */}
            <TabPanel value={activeTab} index={4}>
              <Box>
                <Typography variant="h6" fontWeight="900" sx={{ letterSpacing: -0.5 }} gutterBottom>
                  Accessibility Settings
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 3 }}>
                  Fine-tune high contrast, text dimensions, and animation effects.
                </Typography>
                <Divider sx={{ mb: 4 }} />
              </Box>

              <Stack spacing={3.5}>
                <Box sx={switchContainerStyles}>
                  <Box sx={{ pr: 2 }}>
                    <Typography variant="subtitle2" fontWeight="800">High Contrast Mode</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                      Increase visual contrast for easier and clearer text readability.
                    </Typography>
                  </Box>
                  <Switch
                    color="success"
                    checked={preferences.accessibility?.highContrast ?? false}
                    onChange={(e) => updatePreference('accessibility.highContrast', e.target.checked)}
                  />
                </Box>

                <FormControl fullWidth>
                  <Typography variant="subtitle2" fontWeight="800" gutterBottom>System Font Scaling</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5, fontWeight: 500 }}>
                    Adjust the overall text font dimensions system-wide.
                  </Typography>
                  <Select
                    value={preferences.accessibility?.fontSize || 'medium'}
                    sx={selectStyles}
                    onChange={(e) => updatePreference('accessibility.fontSize', e.target.value)}
                  >
                    <MenuItem value="small">Small scale (Compact view)</MenuItem>
                    <MenuItem value="medium">Medium scale (Standard standard)</MenuItem>
                    <MenuItem value="large">Large scale (High visibility)</MenuItem>
                  </Select>
                </FormControl>

                <Box sx={switchContainerStyles}>
                  <Box sx={{ pr: 2 }}>
                    <Typography variant="subtitle2" fontWeight="800">Reduce System Motion</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                      Deactivate system UI transitions, zoom effects, and layout animations.
                    </Typography>
                  </Box>
                  <Switch
                    color="success"
                    checked={preferences.accessibility?.reduceMotion ?? false}
                    onChange={(e) => updatePreference('accessibility.reduceMotion', e.target.checked)}
                  />
                </Box>
              </Stack>
            </TabPanel>
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 3.5, borderTop: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`, gap: 1.5 }}>
          <Button 
            onClick={handleReset} 
            variant="outlined"
            color="warning"
            startIcon={<RestoreIcon />}
            sx={{
              borderRadius: 3.5,
              textTransform: 'none',
              fontWeight: 700,
              px: 2.5,
              py: 1,
              fontSize: '0.85rem',
              borderColor: 'rgba(244,140,6,0.3)',
              '&:hover': {
                borderColor: '#f48c06',
                bgcolor: 'rgba(244,140,6,0.05)',
              }
            }}
          >
            Reset to Defaults
          </Button>
          <Box sx={{ flexGrow: 1 }} />
          <Button 
            onClick={onClose} 
            variant="contained"
            startIcon={<CloseIcon />}
            sx={{
              borderRadius: 3.5,
              textTransform: 'none',
              fontWeight: 700,
              px: 3.5,
              py: 1.2,
              fontSize: '0.85rem',
              bgcolor: '#386641',
              boxShadow: '0 4px 12px rgba(56, 102, 65, 0.2)',
              '&:hover': {
                bgcolor: '#1b4332',
                boxShadow: '0 8px 16px rgba(27, 67, 50, 0.3)',
                transform: 'translateY(-1px)',
              },
              transition: 'all 0.2s',
            }}
          >
            Close Settings
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default UserPreferencesDialog;
