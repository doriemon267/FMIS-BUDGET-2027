/**
 * Loading skeleton components for better UX
 */

import { Box, Skeleton, Stack } from '@mui/material';

/**
 * Table loading skeleton
 */
export const TableSkeleton = ({ rows = 5, columns = 4 }) => {
  return (
    <Stack spacing={1}>
      {/* Header */}
      <Stack direction="row" spacing={1}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} variant="rectangular" width="100%" height={40} />
        ))}
      </Stack>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <Stack key={rowIndex} direction="row" spacing={1}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={colIndex}
              variant="rectangular"
              width="100%"
              height={56}
              sx={{ borderRadius: 1 }}
            />
          ))}
        </Stack>
      ))}
    </Stack>
  );
};

/**
 * Card loading skeleton
 */
export const CardSkeleton = ({ count = 3 }) => {
  return (
    <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
      {Array.from({ length: count }).map((_, i) => (
        <Box key={i} sx={{ flex: 1, minWidth: 200 }}>
          <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 2, mb: 1 }} />
          <Skeleton variant="text" width="60%" />
          <Skeleton variant="text" width="40%" />
        </Box>
      ))}
    </Stack>
  );
};

/**
 * Form loading skeleton
 */
export const FormSkeleton = ({ fields = 5 }) => {
  return (
    <Stack spacing={2}>
      {Array.from({ length: fields }).map((_, i) => (
        <Box key={i}>
          <Skeleton variant="text" width="30%" height={20} sx={{ mb: 1 }} />
          <Skeleton variant="rectangular" height={56} sx={{ borderRadius: 1 }} />
        </Box>
      ))}
    </Stack>
  );
};

/**
 * Dashboard stat card skeleton
 */
export const StatCardSkeleton = ({ count = 4 }) => {
  return (
    <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
      {Array.from({ length: count }).map((_, i) => (
        <Box
          key={i}
          sx={{
            flex: 1,
            minWidth: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(25% - 12px)' },
          }}
        >
          <Skeleton
            variant="rectangular"
            height={140}
            sx={{ borderRadius: 2 }}
          />
        </Box>
      ))}
    </Stack>
  );
};

/**
 * List item skeleton
 */
export const ListItemSkeleton = ({ count = 5 }) => {
  return (
    <Stack spacing={1}>
      {Array.from({ length: count }).map((_, i) => (
        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2 }}>
          <Skeleton variant="circular" width={40} height={40} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="60%" height={20} />
            <Skeleton variant="text" width="40%" height={16} sx={{ mt: 0.5 }} />
          </Box>
          <Skeleton variant="rectangular" width={80} height={32} />
        </Box>
      ))}
    </Stack>
  );
};

export default {
  TableSkeleton,
  CardSkeleton,
  FormSkeleton,
  StatCardSkeleton,
  ListItemSkeleton,
};
