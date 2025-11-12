import React from 'react';
import {
  Box,
  Typography,
  Chip,
  Paper,
  Tooltip
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import PlayCircleFilledIcon from '@mui/icons-material/PlayCircleFilled';
import PersonIcon from '@mui/icons-material/Person';
import GroupIcon from '@mui/icons-material/Group';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import GavelIcon from '@mui/icons-material/Gavel';

/**
 * WorkflowStatusStepper - Compact horizontal workflow progress indicator
 * 
 * Shows the current status and next steps in the 6-step budget proposal workflow:
 * 1. BUDGET PREPARER - Creates proposal
 * 2. BUDGET REVIEWER - Reviews and ensures quality
 * 3. BUDGET APPROVER - Approves and chooses routing (standard or fast-track)
 * 4. BUDGET PLANNING ANALYST - Technical analysis (optional, can be bypassed)
 * 5. BUDGET OFFICER - Operational approval
 * 6. OVERALL BUDGET APPROVER (Manager) - Final executive approval
 * 
 * September 2025 Refactored Implementation
 */
const WorkflowStatusStepper = ({ proposal, isOfficeLevel = false, bypassedAnalyst = false }) => {
  if (!proposal) return null;

  const status = proposal.status || 'Draft';

  // STANDARD 6-STEP WORKFLOW (Division/Responsibility Center Level)
  const standardSteps = [
    {
      label: 'BUDGET PREPARER',
      role: 'Creates',
      shortLabel: 'Preparer',
      statuses: ['Draft'],
      icon: <PersonIcon />
    },
    {
      label: 'BUDGET REVIEWER',
      role: 'Reviews',
      shortLabel: 'Reviewer',
      statuses: ['Forwarded to Reviewer'],
      icon: <GroupIcon />
    },
    {
      label: 'BUDGET APPROVER',
      role: 'Approves',
      shortLabel: 'Approver',
      statuses: ['Forwarded to Approver'],
      icon: <VerifiedUserIcon />
    },
    {
      label: 'BUDGET PLANNING ANALYST',
      role: 'Analyzes',
      shortLabel: 'Analyst',
      statuses: ['Forwarded to Analyst'],
      icon: <PersonIcon />
    },
    {
      label: 'BUDGET OFFICER',
      role: 'Verifies',
      shortLabel: 'Officer',
      statuses: ['Forwarded to Officer'],
      icon: <VerifiedUserIcon />
    },
    {
      label: 'OVERALL BUDGET APPROVER',
      role: 'Finalizes',
      shortLabel: 'Manager',
      statuses: ['Forwarded to Manager', 'Finalized'],
      icon: <GavelIcon />
    }
  ];

  // FAST-TRACK WORKFLOW (skips Analyst step)
  const fastTrackSteps = [
    {
      label: 'BUDGET PREPARER',
      role: 'Creates',
      shortLabel: 'Preparer',
      statuses: ['Draft'],
      icon: <PersonIcon />
    },
    {
      label: 'BUDGET REVIEWER',
      role: 'Reviews',
      shortLabel: 'Reviewer',
      statuses: ['Forwarded to Reviewer'],
      icon: <GroupIcon />
    },
    {
      label: 'BUDGET APPROVER',
      role: 'Approves',
      shortLabel: 'Approver',
      statuses: ['Forwarded to Approver'],
      icon: <VerifiedUserIcon />
    },
    {
      label: 'BUDGET OFFICER',
      role: 'Verifies',
      shortLabel: 'Officer',
      statuses: ['Forwarded to Officer'],
      icon: <VerifiedUserIcon />
    },
    {
      label: 'OVERALL BUDGET APPROVER',
      role: 'Finalizes',
      shortLabel: 'Manager',
      statuses: ['Forwarded to Manager', 'Finalized'],
      icon: <GavelIcon />
    }
  ];

  // Select workflow based on path (standard vs fast-track)
  // If bypassedAnalyst flag is true, use fast-track steps
  const steps = bypassedAnalyst || proposal?.bypassedAnalyst ? fastTrackSteps : standardSteps;

  // Determine active step
  const getActiveStep = () => {
    // First, try to match by status
    for (let i = 0; i < steps.length; i++) {
      if (steps[i].statuses.includes(status)) {
        return i;
      }
    }

    // If status is "Returned", determine which step based on workflowLevel or currentAssigneeRole
    if (status === 'Returned' || status === 'Rejected') {
      const assigneeRole = proposal?.currentAssigneeRole || proposal?.workflowLevel;
      if (assigneeRole) {
        // Normalize role names for matching
        const roleMap = {
          'PREPARER': 'BUDGET PREPARER',
          'BUDGET PREPARER': 'BUDGET PREPARER',
          'REVIEWER': 'BUDGET REVIEWER',
          'BUDGET_REVIEWER': 'BUDGET REVIEWER',
          'BUDGET REVIEWER': 'BUDGET REVIEWER',
          'APPROVER': 'BUDGET APPROVER',
          'BUDGET APPROVER': 'BUDGET APPROVER',
          'BUDGET_PLANNING_ANALYST': 'BUDGET PLANNING ANALYST',
          'BUDGET PLANNING ANALYST': 'BUDGET PLANNING ANALYST',
          'OFFICER': 'BUDGET OFFICER',
          'BUDGET_OFFICER': 'BUDGET OFFICER',
          'BUDGET OFFICER': 'BUDGET OFFICER',
          'BUDGET_MANAGER': 'BUDGET MANAGER',
          'BUDGET MANAGER': 'BUDGET MANAGER',
          'OVERALL_BUDGET_APPROVER': 'BUDGET MANAGER',
          'OVERALL BUDGET APPROVER': 'BUDGET MANAGER'
        };
        
        const normalizedRole = roleMap[assigneeRole] || assigneeRole;
        
        for (let i = 0; i < steps.length; i++) {
          if (steps[i].label === normalizedRole) {
            return i;
          }
        }
      }
    }

    return 0;
  };

  const activeStep = getActiveStep();

  // Determine if step is completed, active, or pending
  const getStepStatus = (index) => {
    if (index < activeStep) return 'completed';
    if (index === activeStep) return 'active';
    return 'pending';
  };

  const getStepIcon = (index) => {
    const stepStatus = getStepStatus(index);
    if (stepStatus === 'completed') {
      return <CheckCircleIcon sx={{ color: 'success.main', fontSize: '1.5rem' }} />;
    }
    if (stepStatus === 'active') {
      return <PlayCircleFilledIcon sx={{ color: 'primary.main', fontSize: '1.5rem' }} />;
    }
    return <RadioButtonUncheckedIcon sx={{ color: 'text.disabled', fontSize: '1.5rem' }} />;
  };

  const getStatusChipColor = () => {
    switch (status) {
      case 'Draft':
        return 'default';
      case 'Division Submitted':
      case 'Forwarded to Reviewer':
      case 'Forwarded to Officer':
      case 'Officer Approved':
      case 'Forwarded to Manager':
        return 'info';
      case 'Finalized':
        return 'success';
      case 'Returned':
        return 'warning';
      case 'Rejected':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Paper elevation={1} sx={{ p: 2, mb: 2, backgroundColor: 'background.paper' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
          Workflow Progress
        </Typography>
        <Chip 
          label={status} 
          color={getStatusChipColor()} 
          size="small"
          sx={{ fontWeight: 600, fontSize: '0.75rem', height: '24px' }}
        />
      </Box>

      {/* Horizontal Timeline */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 0.5,
        width: '100%'
      }}>
        {steps.map((step, index) => (
          <Box key={step.label} sx={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
            {/* Step */}
            <Tooltip title={step.label}>
              <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0.5,
                flex: 1,
                minWidth: 0
              }}>
                <Box sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: getStepStatus(index) === 'completed' ? 'success.light' :
                                   getStepStatus(index) === 'active' ? 'primary.light' : 'action.disabledBackground',
                  transition: 'all 0.3s ease'
                }}>
                  {getStepIcon(index)}
                </Box>
                <Typography 
                  variant="caption" 
                  sx={{
                    textAlign: 'center',
                    fontWeight: getStepStatus(index) === 'active' ? 600 : 500,
                    fontSize: '0.65rem',
                    lineHeight: 1,
                    color: getStepStatus(index) === 'completed' ? 'success.main' :
                           getStepStatus(index) === 'active' ? 'primary.main' : 'text.secondary',
                    whiteSpace: 'normal',
                    maxWidth: '50px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {step.shortLabel}
                </Typography>
                {getStepStatus(index) === 'active' && (
                  <Chip 
                    label="Active" 
                    size="mini" 
                    color="primary" 
                    sx={{
                      height: '18px',
                      fontSize: '0.6rem',
                      '& .MuiChip-label': { px: '4px' }
                    }}
                  />
                )}
              </Box>
            </Tooltip>

            {/* Connector Line */}
            {index < steps.length - 1 && (
              <Box sx={{
                flex: 0.5,
                height: '2px',
                backgroundColor: getStepStatus(index) === 'completed' ? 'success.main' :
                                 getStepStatus(index + 1) === 'active' ? 'primary.main' : '#e0e0e0',
                mx: 0.25,
                transition: 'background-color 0.3s ease'
              }} />
            )}
          </Box>
        ))}
      </Box>

      {/* Status Messages */}
      {(status === 'Finalized' || status === 'Returned' || status === 'Rejected') && (
        <Box sx={{
          mt: 1.5,
          p: 1,
          backgroundColor: 
            status === 'Finalized' ? 'success.light' : 
            status === 'Returned' ? 'warning.light' : 
            'error.light',
          borderRadius: 0.5,
          borderLeft: `3px solid ${
            status === 'Finalized' ? '#4caf50' : 
            status === 'Returned' ? '#ff9800' : 
            '#f44336'
          }`
        }}>
          <Typography 
            variant="caption" 
            sx={{
              color: 
                status === 'Finalized' ? 'success.dark' : 
                status === 'Returned' ? 'warning.dark' : 
                'error.dark',
              fontWeight: 600,
              fontSize: '0.75rem'
            }}
          >
            {status === 'Finalized' ? '✅ Finalized & Approved' : 
             status === 'Returned' ? '⚠️ Returned for Revision' :
             '❌ Rejected'}
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default WorkflowStatusStepper;
