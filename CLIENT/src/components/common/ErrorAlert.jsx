/**
 * Reusable error alert component with actionable messages
 */

import { Alert, AlertTitle, Button, Stack } from '@mui/material';
import { Refresh, Home } from '@mui/icons-material';
import { getActionableErrorMessage } from '../../utils/errorHandler';

const ErrorAlert = ({
  error,
  onRetry,
  onGoHome,
  title = 'Error',
  showDetails = false,
  sx = {},
}) => {
  if (!error) return null;

  const errorInfo = getActionableErrorMessage(error);

  return (
    <Alert
      severity="error"
      sx={{
        ...sx,
        '& .MuiAlert-message': {
          width: '100%',
        },
      }}
    >
      <AlertTitle>{title}</AlertTitle>
      <Stack spacing={1}>
        <div>{errorInfo.message}</div>
        {errorInfo.action && (
          <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>
            {errorInfo.action}
          </div>
        )}
        
        {showDetails && error?.response?.data && (
          <details style={{ marginTop: 8, fontSize: '0.75rem' }}>
            <summary style={{ cursor: 'pointer', marginBottom: 4 }}>
              Technical Details
            </summary>
            <pre
              style={{
                margin: 0,
                padding: 8,
                background: 'rgba(0,0,0,0.05)',
                borderRadius: 4,
                overflow: 'auto',
                maxHeight: 200,
              }}
            >
              {JSON.stringify(error.response.data, null, 2)}
            </pre>
          </details>
        )}

        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          {errorInfo.retry && onRetry && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<Refresh />}
              onClick={onRetry}
            >
              Retry
            </Button>
          )}
          {onGoHome && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<Home />}
              onClick={onGoHome}
            >
              Go Home
            </Button>
          )}
        </Stack>
      </Stack>
    </Alert>
  );
};

export default ErrorAlert;
