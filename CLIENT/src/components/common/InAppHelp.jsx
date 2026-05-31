/**
 * In-App Help Component
 * Provides contextual help and tooltips
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Divider,
  Box,
  Paper,
  Tabs,
  Tab,
  IconButton,
  Stack,
  alpha,
  LinearProgress,
  Chip,
  Grid,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  HelpOutline as HelpIcon,
  PlayCircleOutline as PlayIcon,
  InfoOutlined as InfoIcon,
  AccountTreeOutlined as WorkflowIcon,
  LiveHelpOutlined as FAQIcon,
  KeyboardOutlined as KeyboardIcon,
  Close as CloseIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  Restore as RestoreIcon
} from '@mui/icons-material';
import FAQ from './FAQ';
import { useThemeContext } from '../../context/ThemeContext';

const TabPanel = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`help-tabpanel-${index}`}
      aria-labelledby={`help-tab-${index}`}
      style={{ height: '100%' }}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: { xs: 3, md: 4.5 }, display: 'flex', flexDirection: 'column', gap: 3.5 }}>
          {children}
        </Box>
      )}
    </div>
  );
};

const InAppHelp = ({ open, onClose, context = 'general' }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [walkthroughStep, setWalkthroughStep] = useState(0);

  const quickStartSteps = [
    { title: 'Go to Create Proposal', desc: 'Click "Create Proposal" under Budget Proposal Management, or use the template selector on the dashboard.' },
    { title: 'Fill required fields', desc: 'Enter title, fiscal year, budget type (Initial/NEP/GAA), projected income and subsidy. Select your region.' },
    { title: 'Add line items', desc: 'Add Personnel Services, MOOE, Capital Outlay, and Income data in the respective tabs.' },
    { title: 'Submit for review', desc: 'When ready, click Submit. The proposal goes to Budget Reviewer, then Approver, then BRD Analyst, Officer, and Manager.' },
    { title: 'Track progress', desc: 'Use "All Proposals" to see status. You can Return at any step if changes are needed.' },
  ];

  const workflowSteps = [
    { stage: '1. Draft & Initiate', role: 'Budget Preparer', desc: 'Creates and enters line items for Personnel Services, MOOE, Capital Outlay, and Projected Income.', color: '#0077b6' },
    { stage: '2. Compliance Verification', role: 'Budget Reviewer', desc: 'Reviews the budget submission to ensure precision, mathematical integrity, and adherence to assigned ceilings.', color: '#f48c06' },
    { stage: '3. Endorsement & Signoff', role: 'Budget Approver', desc: 'Grants regional or division approval to forward the proposal to central office review.', color: '#6a994e' },
    { stage: '4. Analysis & Validation', role: 'BRD Analyst', desc: 'Performs central office data validation and comprehensive budget analysis.', color: '#8338ec' },
    { stage: '5. Compliance Confirmation', role: 'BRD Officer', desc: 'Verifies the proposal against overall national program requirements and GAA policies.', color: '#3a86c8' },
    { stage: '6. Finalization & Lock', role: 'BRD Manager', desc: 'Conducts final executive audit, signs off, and locks the proposal for budget consolidation.', color: '#d00000' },
  ];

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const theme = useTheme();
  const { mode } = useThemeContext();
  const isDarkMode = mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      disableEnforceFocus={false} 
      aria-labelledby="help-dialog-title"
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
      <DialogTitle id="help-dialog-title" sx={{ p: 3.5, borderBottom: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}` }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center" gap={2}>
            <Box sx={{ 
              display: 'flex', p: 1.2, borderRadius: 4, 
              bgcolor: isDarkMode ? 'rgba(96,165,97,0.12)' : 'rgba(96,165,97,0.08)', 
              color: '#60a561',
              boxShadow: `0 8px 16px -4px ${alpha('#60a561', 0.2)}`
            }}>
              <HelpIcon />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight="900" sx={{ letterSpacing: -0.5, lineHeight: 1.1 }}>Help & Support</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>Contextual guidelines and workflow information</Typography>
            </Box>
          </Box>
          <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary', bgcolor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', '&:hover': { bgcolor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' } }}>
            <CloseIcon size={18} />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, minHeight: 480 }}>
        {/* Left Vertical Tab Bar */}
        <Box sx={{
          width: { xs: '100%', md: 240 },
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
            <Tab icon={<PlayIcon sx={{ fontSize: 20, mr: 1.5 }} />} iconPosition="start" label="Quick Start" />
            <Tab icon={<InfoIcon sx={{ fontSize: 20, mr: 1.5 }} />} iconPosition="start" label="Overview" />
            <Tab icon={<WorkflowIcon sx={{ fontSize: 20, mr: 1.5 }} />} iconPosition="start" label="Workflow" />
            <Tab icon={<FAQIcon sx={{ fontSize: 20, mr: 1.5 }} />} iconPosition="start" label="FAQ" />
          </Tabs>
        </Box>

        {/* Right Tab Content Panels */}
        <Box sx={{ flexGrow: 1, overflowY: 'auto', maxHeight: 520, p: 1 }}>
          
          {/* Quick Start Walkthrough Panel */}
          <TabPanel value={activeTab} index={0}>
            <Box>
              <Typography variant="h6" fontWeight="900" sx={{ letterSpacing: -0.5 }} gutterBottom>
                Quick Start Walkthrough
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 3 }}>
                Follow this simple step-by-step pipeline to create and submit budget proposals.
              </Typography>
              <Divider sx={{ mb: 4 }} />
            </Box>

            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="subtitle2" fontWeight="800" color="success.main" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Walkthrough Pipeline
                </Typography>
                <Chip 
                  label={`Step ${walkthroughStep + 1} of ${quickStartSteps.length}`} 
                  size="small"
                  sx={{ bgcolor: 'rgba(96,165,97,0.1)', color: '#60a561', fontWeight: 800, fontSize: '0.75rem' }} 
                />
              </Stack>

              {/* Modern Linear Walkthrough Progress Bar */}
              <LinearProgress 
                variant="determinate" 
                value={((walkthroughStep + 1) / quickStartSteps.length) * 100} 
                sx={{ 
                  height: 8, borderRadius: 4, mb: 4, 
                  bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                  '& .MuiLinearProgress-bar': { bgcolor: '#60a561', borderRadius: 4 }
                }} 
              />

              <Paper 
                elevation={0}
                sx={{ 
                  p: 3.5, mb: 4, borderRadius: 5, 
                  border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}`,
                  bgcolor: isDarkMode ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <Box sx={{
                  position: 'absolute', top: -30, right: -30, width: 90, height: 90,
                  borderRadius: '50%', background: `radial-gradient(circle, ${alpha('#60a561', 0.08)} 0%, transparent 70%)`,
                  zIndex: 0, pointerEvents: 'none'
                }} />
                
                <Typography variant="h6" fontWeight="900" sx={{ letterSpacing: -0.3, zIndex: 1, position: 'relative', color: '#60a561', mb: 1.5 }}>
                  {quickStartSteps[walkthroughStep].title}
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ zIndex: 1, position: 'relative', lineHeight: 1.7, fontWeight: 500, fontSize: '0.95rem' }}>
                  {quickStartSteps[walkthroughStep].desc}
                </Typography>
              </Paper>

              <Stack direction="row" spacing={2} justifyContent="space-between">
                <Button
                  variant="outlined"
                  size="medium"
                  startIcon={<ArrowBackIcon />}
                  disabled={walkthroughStep === 0}
                  onClick={() => setWalkthroughStep((s) => Math.max(0, s - 1))}
                  sx={{ borderRadius: 3, textTransform: 'none', fontWeight: 700, px: 2.5 }}
                >
                  Previous Step
                </Button>
                {walkthroughStep < quickStartSteps.length - 1 ? (
                  <Button
                    variant="contained"
                    size="medium"
                    endIcon={<ArrowForwardIcon />}
                    onClick={() => setWalkthroughStep((s) => s + 1)}
                    sx={{ 
                      borderRadius: 3, textTransform: 'none', fontWeight: 700, px: 3, bgcolor: '#386641',
                      '&:hover': { bgcolor: '#1b4332' }
                    }}
                  >
                    Next Step
                  </Button>
                ) : (
                  <Button 
                    variant="contained" 
                    size="medium" 
                    startIcon={<RestoreIcon />}
                    onClick={() => setWalkthroughStep(0)}
                    sx={{ 
                      borderRadius: 3, textTransform: 'none', fontWeight: 700, px: 3, bgcolor: '#f48c06',
                      '&:hover': { bgcolor: '#d87d05' }
                    }}
                  >
                    Restart Flow
                  </Button>
                )}
              </Stack>
            </Box>
          </TabPanel>

          {/* Overview Panel */}
          <TabPanel value={activeTab} index={1}>
            <Box>
              <Typography variant="h6" fontWeight="900" sx={{ letterSpacing: -0.5 }} gutterBottom>
                Getting Started Overview
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 3 }}>
                Essential guidelines and keyboard controls for efficient system operations.
              </Typography>
              <Divider sx={{ mb: 4 }} />
            </Box>

            <Grid container spacing={3.5}>
              <Grid item xs={12} md={6}>
                <Paper 
                  elevation={0}
                  sx={{ 
                    p: 3, borderRadius: 5, height: '100%',
                    border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}`,
                    bgcolor: isDarkMode ? 'rgba(255,255,255,0.01)' : '#fff'
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                    <InfoIcon sx={{ color: '#60a561' }} />
                    <Typography variant="subtitle1" fontWeight="800">Key Information</Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, fontWeight: 500 }}>
                    Create budget proposals with clear fiscal breakdowns. Ensure line items stay strictly within assigned regional ceilings. Line items are audited in real-time by the workflow review boards.
                  </Typography>
                </Paper>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper 
                  elevation={0}
                  sx={{ 
                    p: 3, borderRadius: 5, height: '100%',
                    border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}`,
                    bgcolor: isDarkMode ? 'rgba(255,255,255,0.01)' : '#fff'
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                    <KeyboardIcon sx={{ color: '#0077b6' }} />
                    <Typography variant="subtitle1" fontWeight="800">Keyboard Shortcuts</Typography>
                  </Stack>
                  <Stack spacing={1.5}>
                    {[
                      { keys: ['Ctrl', 'R'], action: 'Refresh active dashboard data' },
                      { keys: ['Ctrl', 'Shift', 'H'], action: 'Open In-App Help menu' },
                      { keys: ['Ctrl', 'K'], action: 'Open system global search dock' }
                    ].map((shortcut, idx) => (
                      <Box key={idx} display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{shortcut.action}</Typography>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          {shortcut.keys.map((key, kIdx) => (
                            <kbd 
                              key={kIdx} 
                              style={{ 
                                backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#eee',
                                color: isDarkMode ? '#f1f5f9' : '#333',
                                padding: '3px 7px',
                                border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.15)' : '#ccc'}`,
                                borderRadius: '4px',
                                fontFamily: 'monospace',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                boxShadow: '0 1px 0px rgba(0,0,0,0.1)'
                              }}
                            >
                              {key}
                            </kbd>
                          ))}
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                </Paper>
              </Grid>
            </Grid>
          </TabPanel>

          {/* Workflow Timeline Panel */}
          <TabPanel value={activeTab} index={2}>
            <Box>
              <Typography variant="h6" fontWeight="900" sx={{ letterSpacing: -0.5 }} gutterBottom>
                Workflow Pipeline Guide
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 3 }}>
                Proposals pass through a standard 6-step review process to ensure compliance.
              </Typography>
              <Divider sx={{ mb: 4 }} />
            </Box>

            {/* Premium Vertical CSS Timeline */}
            <Box sx={{ position: 'relative', pl: { xs: 2, sm: 4 }, pr: 1 }}>
              {/* Timeline Connector Line */}
              <Box sx={{ 
                position: 'absolute', top: 12, bottom: 12, left: { xs: 15, sm: 23 }, width: 2, 
                bgcolor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' 
              }} />

              <Stack spacing={4}>
                {workflowSteps.map((step, idx) => (
                  <Box key={idx} sx={{ display: 'flex', gap: { xs: 2.5, sm: 3.5 }, position: 'relative' }}>
                    
                    {/* Glowing Number Circle indicator */}
                    <Box sx={{
                      width: 18, height: 18, borderRadius: '50%',
                      bgcolor: step.color,
                      border: `4px solid ${isDarkMode ? '#0f172a' : '#ffffff'}`,
                      boxShadow: `0 0 12px ${alpha(step.color, 0.6)}`,
                      zIndex: 2,
                      mt: 0.6,
                      flexShrink: 0
                    }} />

                    <Box sx={{ flexGrow: 1 }}>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1, sm: 1.5 }} alignItems={{ xs: 'flex-start', sm: 'center' }} sx={{ mb: 1 }}>
                        <Typography variant="subtitle2" fontWeight="900" sx={{ color: 'text.primary', fontSize: '0.95rem', letterSpacing: -0.2 }}>
                          {step.stage}
                        </Typography>
                        <Chip 
                          label={step.role}
                          size="small"
                          sx={{ 
                            bgcolor: alpha(step.color, 0.08), color: step.color, 
                            fontWeight: 800, fontSize: '0.72rem', border: `1px solid ${alpha(step.color, 0.15)}`,
                            height: 22, px: 1
                          }} 
                        />
                      </Stack>
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, lineHeight: 1.6, pr: { xs: 1, sm: 2 } }}>
                        {step.desc}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Stack>
            </Box>
          </TabPanel>

          {/* FAQ Panel */}
          <TabPanel value={activeTab} index={3}>
            <Box>
              <Typography variant="h6" fontWeight="900" sx={{ letterSpacing: -0.5 }} gutterBottom>
                Frequently Asked Questions
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 3 }}>
                Answers to common queries regarding budget ceilings and workflow routing.
              </Typography>
              <Divider sx={{ mb: 4 }} />
            </Box>
            
            <Box sx={{ px: 1 }}>
              <FAQ />
            </Box>
          </TabPanel>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3.5, borderTop: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}` }}>
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
          Close Help
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default InAppHelp;
