/**
 * In-App Help Component
 * Provides contextual help and tooltips
 */

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Box,
  Paper,
} from '@mui/material';
import {
  HelpOutline,
  Keyboard,
  Info,
  PlayArrow,
} from '@mui/icons-material';
import FAQ from './FAQ';
import { useState } from 'react';

const InAppHelp = ({ open, onClose, context = 'general' }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [walkthroughStep, setWalkthroughStep] = useState(0);

  const quickStartSteps = [
    { title: 'Go to Create Proposal', desc: 'Click "Create Proposal" under Budget Proposal Management, or use the template selector on the dashboard.' },
    { title: 'Fill required fields', desc: 'Enter title, fiscal year, budget type (Initial/NEP/GAA), projected income and subsidy. Select your region.' },
    { title: 'Add line items', desc: 'Add Personnel Services, MOOE, Capital Outlay, and Income data in the respective tabs.' },
    { title: 'Submit for review', desc: 'When ready, click Submit. The proposal goes to Budget Reviewer, then Approver, then BRD Analyst, Officer, and Manager.' },
    { title: 'Track progress', desc: 'Use "All Proposals" to see status. You can Return at any step if changes are needed.' },
  ];

  const helpContent = {
    quickStart: (
      <Box>
        <Typography variant="h6" gutterBottom>
          Quick Start Walkthrough
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Step {walkthroughStep + 1} of {quickStartSteps.length}
        </Typography>
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography fontWeight={600} gutterBottom>
            {quickStartSteps[walkthroughStep].title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {quickStartSteps[walkthroughStep].desc}
          </Typography>
        </Paper>
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between' }}>
          <Button
            size="small"
            disabled={walkthroughStep === 0}
            onClick={() => setWalkthroughStep((s) => Math.max(0, s - 1))}
          >
            Previous
          </Button>
          {walkthroughStep < quickStartSteps.length - 1 ? (
            <Button
              variant="contained"
              size="small"
              startIcon={<PlayArrow />}
              onClick={() => setWalkthroughStep((s) => s + 1)}
            >
              Next
            </Button>
          ) : (
            <Button variant="contained" size="small" onClick={() => setWalkthroughStep(0)}>
              Restart
            </Button>
          )}
        </Box>
      </Box>
    ),
    overview: (
      <Box>
        <Typography variant="h6" gutterBottom>
          Getting Started
        </Typography>
        <List>
          <ListItem>
            <ListItemIcon>
              <Info color="primary" />
            </ListItemIcon>
            <ListItemText
              primary="Create Your First Proposal"
              secondary="Click 'Create Proposal' to start. Fill in all required fields and ensure your budget is within the assigned ceiling."
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <Keyboard color="primary" />
            </ListItemIcon>
            <ListItemText
              primary="Keyboard Shortcuts"
              secondary="Press Ctrl+K to search, Ctrl+R to refresh, Ctrl+S to save (where applicable)."
            />
          </ListItem>
        </List>
      </Box>
    ),
    workflow: (
      <Box>
        <Typography variant="h6" gutterBottom>
          Workflow Guide
        </Typography>
        <Typography variant="body2" paragraph>
          The workflow follows these steps:
        </Typography>
        <List>
          <ListItem>
            <ListItemText primary="1. Draft → Preparer creates and saves proposal" />
          </ListItem>
          <ListItem>
            <ListItemText primary="2. Reviewer → Reviews for accuracy" />
          </ListItem>
          <ListItem>
            <ListItemText primary="3. Approver → Approves proposal" />
          </ListItem>
          <ListItem>
            <ListItemText primary="4. BRD Analyst → Analyzes and validates" />
          </ListItem>
          <ListItem>
            <ListItemText primary="5. BRD Officer → Confirms compliance" />
          </ListItem>
          <ListItem>
            <ListItemText primary="6. BRD Manager → Final review and finalization" />
          </ListItem>
        </List>
      </Box>
    ),
    faq: <FAQ />,
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth disableEnforceFocus={false} aria-labelledby="help-dialog-title">
      <DialogTitle id="help-dialog-title">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HelpOutline color="primary" />
          <Typography variant="h6">Help & Support</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <Button
            variant={activeTab === 'quickStart' ? 'contained' : 'outlined'}
            onClick={() => setActiveTab('quickStart')}
            sx={{ mr: 1 }}
            size="small"
          >
            Quick Start
          </Button>
          <Button
            variant={activeTab === 'overview' ? 'contained' : 'outlined'}
            onClick={() => setActiveTab('overview')}
            sx={{ mr: 1 }}
            size="small"
          >
            Overview
          </Button>
          <Button
            variant={activeTab === 'workflow' ? 'contained' : 'outlined'}
            onClick={() => setActiveTab('workflow')}
            sx={{ mr: 1 }}
            size="small"
          >
            Workflow
          </Button>
          <Button
            variant={activeTab === 'faq' ? 'contained' : 'outlined'}
            onClick={() => setActiveTab('faq')}
            size="small"
          >
            FAQ
          </Button>
        </Box>
        <Divider sx={{ mb: 2 }} />
        {helpContent[activeTab] ?? helpContent.quickStart}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default InAppHelp;
