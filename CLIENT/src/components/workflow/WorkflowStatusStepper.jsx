import React from 'react';
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Typography,
  Chip,
  Paper
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import PlayCircleFilledIcon from '@mui/icons-material/PlayCircleFilled';
import PersonIcon from '@mui/icons-material/Person';
import GroupIcon from '@mui/icons-material/Group';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import GavelIcon from '@mui/icons-material/Gavel';

/**
 * WorkflowStatusStepper - Visual representation of proposal workflow progress
 * 
 * Shows the current status and next steps in the budget proposal workflow
 */
const WorkflowStatusStepper = ({ proposal, isOfficeLevel = false }) => {
  if (!proposal) return null;

  const status = proposal.status || 'Draft';

  // Define workflow steps based on level
  const steps = isOfficeLevel ? [
    {
      label: 'Budget Analyst',
      role: 'Creates Proposal',
      statuses: ['Draft'],
      icon: <PersonIcon />
    },
    {
      label: 'Budget Officer',
      role: 'Approves & Submits',
      statuses: ['Officer Approved', 'Forwarded to Manager'],
      icon: <VerifiedUserIcon />
    },
    {
      label: 'Budget Manager',
      role: 'Final Approval',
      statuses: ['Finalized'],
      icon: <GavelIcon />
    }
  ] : [
    {
      label: 'Budget Analyst',
      role: 'Creates Proposal',
      statuses: ['Draft'],
      icon: <PersonIcon />
    },
    {
      label: 'Budget Coordinator',
      role: 'Reviews & Forwards',
      statuses: ['Division Submitted', 'Forwarded to Officer'],
      icon: <GroupIcon />
    },
    {
      label: 'Budget Officer',
      role: 'Approves & Submits',
      statuses: ['Officer Approved', 'Forwarded to Manager'],
      icon: <VerifiedUserIcon />
    },
    {
      label: 'Budget Manager',
      role: 'Final Approval',
      statuses: ['Finalized'],
      icon: <GavelIcon />
    }
  ];

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
      return <CheckCircleIcon sx={{ color: 'success.main' }} />;
    }
    if (stepStatus === 'active') {
      return <PlayCircleFilledIcon sx={{ color: 'primary.main' }} />;
    }
    return <RadioButtonUncheckedIcon sx={{ color: 'text.disabled' }} />;
  };

  const getStatusChipColor = () => {
    switch (status) {
      case 'Draft':
        return 'default';
      case 'Division Submitted':
      case 'Forwarded to Officer':
      case 'Forwarded to Manager':
        return 'info';
      case 'Officer Approved':
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
    <Paper elevation={2} sx={{ p: 3, mb: 3, backgroundColor: 'background.paper' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Workflow Progress
        </Typography>
        <Chip 
          label={status} 
          color={getStatusChipColor()} 
          size="medium"
          sx={{ fontWeight: 600 }}
        />
      </Box>

      <Stepper activeStep={activeStep} orientation="vertical">
        {steps.map((step, index) => (
          <Step key={step.label} completed={getStepStatus(index) === 'completed'}>
            <StepLabel
              StepIconComponent={() => getStepIcon(index)}
              sx={{
                '& .MuiStepLabel-label': {
                  fontWeight: getStepStatus(index) === 'active' ? 600 : 400,
                  color: getStepStatus(index) === 'completed' ? 'success.main' : 
                         getStepStatus(index) === 'active' ? 'primary.main' : 'text.secondary'
                }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {step.icon}
                <Typography variant="body1" sx={{ fontWeight: 'inherit' }}>
                  {step.label}
                </Typography>
              </Box>
            </StepLabel>
            <StepContent>
              <Typography variant="body2" color="text.secondary">
                {step.role}
              </Typography>
              {getStepStatus(index) === 'active' && (
                <Chip 
                  label="Current Step" 
                  size="small" 
                  color="primary" 
                  sx={{ mt: 1 }}
                />
              )}
            </StepContent>
          </Step>
        ))}
      </Stepper>

      {status === 'Finalized' && (
        <Box sx={{ mt: 2, p: 2, backgroundColor: 'success.light', borderRadius: 1 }}>
          <Typography variant="body2" sx={{ color: 'success.dark', fontWeight: 600 }}>
            ✅ This proposal has been finalized and approved!
          </Typography>
        </Box>
      )}

      {status === 'Returned' && (
        <Box sx={{ mt: 2, p: 2, backgroundColor: 'warning.light', borderRadius: 1 }}>
          <Typography variant="body2" sx={{ color: 'warning.dark', fontWeight: 600 }}>
            ⚠️ This proposal has been returned for revision.
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default WorkflowStatusStepper;
