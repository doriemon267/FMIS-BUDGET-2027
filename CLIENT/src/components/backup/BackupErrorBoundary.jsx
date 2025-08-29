import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  Stack
} from '@mui/material';
import { Refresh, BugReport } from '@mui/icons-material';

class BackupErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error details
    console.error('Backup component error:', error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box p={3}>
          <Card>
            <CardContent>
              <Stack spacing={2} alignItems="center" textAlign="center">
                <BugReport color="error" sx={{ fontSize: 48 }} />
                
                <Typography variant="h5" color="error">
                  Backup System Error
                </Typography>
                
                <Typography variant="body1" color="text.secondary">
                  Something went wrong with the backup interface. This might be due to:
                </Typography>
                
                <Alert severity="info" sx={{ textAlign: 'left' }}>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    <li>Network connectivity issues</li>
                    <li>Server communication problems</li>
                    <li>Component rendering conflicts</li>
                    <li>Missing dependencies</li>
                  </ul>
                </Alert>
                
                <Stack direction="row" spacing={2}>
                  <Button
                    variant="contained"
                    startIcon={<Refresh />}
                    onClick={() => {
                      this.setState({ hasError: false, error: null, errorInfo: null });
                      // Optionally reload the page
                      if (this.props.onRetry) {
                        this.props.onRetry();
                      }
                    }}
                  >
                    Try Again
                  </Button>
                  
                  <Button
                    variant="outlined"
                    onClick={() => window.location.reload()}
                  >
                    Reload Page
                  </Button>
                </Stack>
                
                {process.env.NODE_ENV === 'development' && this.state.error && (
                  <Box mt={2} p={2} bgcolor="grey.100" borderRadius={1} width="100%">
                    <Typography variant="subtitle2" color="error" gutterBottom>
                      Error Details (Development Mode):
                    </Typography>
                    <Typography variant="body2" component="pre" sx={{ 
                      fontSize: '0.75rem',
                      overflow: 'auto',
                      maxHeight: 200,
                      whiteSpace: 'pre-wrap'
                    }}>
                      {this.state.error.toString()}
                      {this.state.errorInfo && this.state.errorInfo.componentStack}
                    </Typography>
                  </Box>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Box>
      );
    }

    // If no error, render children normally
    return this.props.children;
  }
}

export default BackupErrorBoundary;