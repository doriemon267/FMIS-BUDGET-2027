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
 * Shows the current status and next steps in the budget proposal workflow
 * in a space-efficient horizontal layout
 * 
 * NEW 6-STEP WORKFLOW (September 2025):
 * - Division Level: PREPARER → REVIEWER → APPROVER → BUDGET_ANALYST → BUDGET_OFFICER → OVERALL_BUDGET_APPROVER
 * - Office Level: PREPARER → APPROVER → BUDGET_ANALYST → BUDGET_OFFICER → OVERALL_BUDGET_APPROVER (skips REVIEWER)
 */
const WorkflowStatusStepper = ({ proposal, isOfficeLevel = false }) => {
  if (!proposal) return null;

  const status = proposal.status || 'Draft';

  // NEW 6-STEP WORKFLOW (Division/Responsibility Center Level)
  const divisionSteps = [
    {
      label: 'PREPARER',
      role: 'Creates',
      shortLabel: 'Preparer',
      statuses: ['Draft'],
      icon: <PersonIcon />
    },
    {
      label: 'REVIEWER',
      role: 'Reviews',
      shortLabel: 'Reviewer',
      statuses: ['Division Submitted'],
      icon: <GroupIcon />
    },
    {
      label: 'APPROVER',
      role: 'Approves',
      shortLabel: 'Approver',
      statuses: ['Forwarded to Approver', 'Forwarded to Officer', 'Approver Approved'],
      icon: <VerifiedUserIcon />
    },
    {
      label: 'BUDGET_ANALYST',
      role: 'Analyzes',
      shortLabel: 'Analyst',
      statuses: ['Forwarded to Analyst', 'Officer Approved'],
      icon: <PersonIcon />
    },
    {
      label: 'BUDGET_OFFICER',
      role: 'Approves',
      shortLabel: 'Officer',
      statuses: ['Forwarded to Budget Officer', 'Forwarded to Manager'],
      icon: <VerifiedUserIcon />
    },
    {
      label: 'OVERALL_BUDGET_APPROVER',
      role: 'Finalizes',
      shortLabel: 'Final Approver',
      statuses: ['Finalized'],
      icon: <GavelIcon />
    }
  ];

  // NEW 5-STEP WORKFLOW (Office Level - skips Reviewer)
  const officeSteps = [
    {
      label: 'PREPARER',
      role: 'Creates',
      shortLabel: 'Preparer',
      statuses: ['Draft'],
      icon: <PersonIcon />
    },
    {
      label: 'APPROVER',
      role: 'Approves',
      shortLabel: 'Approver',
      statuses: ['Forwarded to Approver', 'Forwarded to Officer', 'Approver Approved'],
      icon: <VerifiedUserIcon />
    },
    {
      label: 'BUDGET_ANALYST',
      role: 'Analyzes',
      shortLabel: 'Analyst',
      statuses: ['Forwarded to Analyst', 'Officer Approved'],
      icon: <PersonIcon />
    },
    {
      label: 'BUDGET_OFFICER',
      role: 'Approves',
      shortLabel: 'Officer',
      statuses: ['Forwarded to Budget Officer', 'Forwarded to Manager'],
      icon: <VerifiedUserIcon />
    },
    {
      label: 'OVERALL_BUDGET_APPROVER',
      role: 'Finalizes',
      shortLabel: 'Final Approver',
      statuses: ['Finalized'],
      icon: <GavelIcon />
    }
  ];

  // Select workflow based on level
  const steps = isOfficeLevel ? officeSteps : divisionSteps;

  // Determine active step
  const getActiveStep = () => {
    for (let i = 0; i < steps.length; i++) {
      if (steps[i].statuses.includes(status)) {
        return i;
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
