/**
 * Deadline Reminder Component
 * Shows deadline warnings and reminders
 */

import { Box, Alert, Chip, Typography, Stack } from '@mui/material';
import { Warning, CheckCircle, Error } from '@mui/icons-material';
// Simple date utilities (no date-fns dependency)
const differenceInDays = (date1, date2) => {
  const diffTime = Math.abs(date1 - date2);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const differenceInHours = (date1, date2) => {
  const diffTime = Math.abs(date1 - date2);
  return Math.ceil(diffTime / (1000 * 60 * 60));
};

const isPast = (date) => {
  return new Date(date) < new Date();
};

const isToday = (date) => {
  const today = new Date();
  const checkDate = new Date(date);
  return (
    checkDate.getDate() === today.getDate() &&
    checkDate.getMonth() === today.getMonth() &&
    checkDate.getFullYear() === today.getFullYear()
  );
};

const DeadlineReminder = ({ deadline, label = 'Deadline', showIcon = true }) => {
  if (!deadline) return null;

  const deadlineDate = new Date(deadline);
  const now = new Date();
  const daysRemaining = differenceInDays(deadlineDate, now);
  const hoursRemaining = differenceInHours(deadlineDate, now);
  const isOverdue = isPast(deadlineDate);
  const isDueToday = isToday(deadlineDate);

  const getSeverity = () => {
    if (isOverdue) return 'error';
    if (isDueToday) return 'warning';
    if (daysRemaining <= 3) return 'warning';
    return 'info';
  };

  const getMessage = () => {
    if (isOverdue) {
      return `${label} has passed ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) !== 1 ? 's' : ''} ago`;
    }
    if (isDueToday) {
      return `${label} is due today (${hoursRemaining} hour${hoursRemaining !== 1 ? 's' : ''} remaining)`;
    }
    if (daysRemaining <= 3) {
      return `${label} is in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} (${hoursRemaining} hours)`;
    }
    return `${label} is in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`;
  };

  const getIcon = () => {
    if (isOverdue) return <Error />;
    if (isDueToday || daysRemaining <= 3) return <Warning />;
    return <CheckCircle />;
  };

  return (
    <Alert
      severity={getSeverity()}
      icon={showIcon ? getIcon() : false}
      sx={{ mb: 2 }}
    >
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
        <Typography variant="body2">{getMessage()}</Typography>
        <Chip
          label={deadlineDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
          size="small"
          color={getSeverity()}
        />
      </Stack>
    </Alert>
  );
};

export default DeadlineReminder;
