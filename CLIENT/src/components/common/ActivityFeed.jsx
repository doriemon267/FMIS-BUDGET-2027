/**
 * Activity Feed/Timeline component for showing recent activities
 */

import {
  Box,
  Card,
  CardContent,
  Typography,
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  Chip,
  Stack,
  Avatar,
} from '@mui/material';

/**
 * Format date to relative time (e.g., "2 hours ago")
 */
const formatDistanceToNow = (date) => {
  const now = new Date();
  const past = new Date(date);
  const diffInSeconds = Math.floor((now - past) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
  
  return past.toLocaleDateString();
};

const ActivityFeed = ({ activities = [], maxItems = 10, title = 'Recent Activity' }) => {
  if (!activities || activities.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            No recent activity
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const displayActivities = activities.slice(0, maxItems);

  const getActivityColor = (type) => {
    const colors = {
      created: 'primary',
      updated: 'info',
      deleted: 'error',
      approved: 'success',
      rejected: 'error',
      submitted: 'warning',
      finalized: 'success',
    };
    return colors[type] || 'default';
  };

  const getActivityIcon = (type) => {
    // You can customize icons here
    return null;
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        <Timeline>
          {displayActivities.map((activity, index) => (
            <TimelineItem key={activity.id || index}>
              <TimelineSeparator>
                <TimelineDot color={getActivityColor(activity.type)}>
                  {activity.user?.avatar ? (
                    <Avatar sx={{ width: 24, height: 24 }}>
                      {activity.user.avatar}
                    </Avatar>
                  ) : (
                    getActivityIcon(activity.type)
                  )}
                </TimelineDot>
                {index < displayActivities.length - 1 && <TimelineConnector />}
              </TimelineSeparator>
              <TimelineContent>
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                    <Typography variant="body2" fontWeight="medium">
                      {activity.user?.name || 'System'}
                    </Typography>
                    <Chip
                      label={activity.type}
                      size="small"
                      color={getActivityColor(activity.type)}
                      sx={{ height: 20, fontSize: '0.7rem' }}
                    />
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {activity.description || activity.message}
                  </Typography>
                  {activity.timestamp && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                    </Typography>
                  )}
                </Box>
              </TimelineContent>
            </TimelineItem>
          ))}
        </Timeline>
      </CardContent>
    </Card>
  );
};

export default ActivityFeed;
