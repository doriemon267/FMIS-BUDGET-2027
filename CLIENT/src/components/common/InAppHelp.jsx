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
} from '@mui/material';
import {
  HelpOutline,
  Keyboard,
  Info,
  QuestionAnswer,
  VideoLibrary,
} from '@mui/icons-material';
import FAQ from './FAQ';
import { useState } from 'react';

const InAppHelp = ({ open, onClose, context = 'general' }) => {
  const [activeTab, setActiveTab] = useState('overview');

  const helpContent = {
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
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HelpOutline color="primary" />
          <Typography variant="h6">Help & Support</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
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
        {helpContent[activeTab] || helpContent.overview}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default InAppHelp;
