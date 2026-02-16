import React, { Component } from "react";
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Stack,
  Alert,
} from "@mui/material";
import { Refresh, Home, BugReport } from "@mui/icons-material";
import logger from "../../utils/logger";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    logger.error("ErrorBoundary caught an error", error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });

    // In production, send to error tracking service
    // if (window.Sentry) {
    //   window.Sentry.captureException(error, {
    //     contexts: {
    //       react: {
    //         componentStack: errorInfo.componentStack,
    //       },
    //     },
    //   });
    // }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleGoHome = () => {
    window.location.href = "/dashboard";
  };

  render() {
    if (this.state.hasError) {
      const { FallbackComponent, showDetails = false } = this.props;
      const isDevelopment = import.meta.env.DEV || process.env.NODE_ENV === "development";

      if (FallbackComponent) {
        return <FallbackComponent error={this.state.error} />;
      }

      return (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "60vh",
            p: 3,
          }}
        >
          <Card sx={{ maxWidth: 600, width: "100%" }}>
            <CardContent>
              <Stack spacing={3}>
                <Box sx={{ textAlign: "center" }}>
                  <BugReport sx={{ fontSize: 64, color: "error.main", mb: 2 }} />
                  <Typography variant="h5" fontWeight="bold" gutterBottom>
                    Something went wrong
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    We encountered an unexpected error. Don't worry, your data is safe.
                  </Typography>
                </Box>

                <Alert severity="error" sx={{ textAlign: "left" }}>
                  <Typography variant="body2" fontWeight="bold" gutterBottom>
                    Error Details:
                  </Typography>
                  <Typography variant="body2">
                    {this.state.error?.message || "An unknown error occurred"}
                  </Typography>
                </Alert>

                {(isDevelopment || showDetails) && this.state.errorInfo && (
                  <Box
                    sx={{
                      p: 2,
                      bgcolor: "grey.100",
                      borderRadius: 1,
                      maxHeight: 200,
                      overflow: "auto",
                    }}
                  >
                    <Typography variant="caption" fontWeight="bold" display="block" gutterBottom>
                      Component Stack:
                    </Typography>
                    <Typography
                      variant="caption"
                      component="pre"
                      sx={{
                        fontSize: "0.7rem",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {this.state.errorInfo.componentStack}
                    </Typography>
                  </Box>
                )}

                <Stack direction="row" spacing={2} justifyContent="center">
                  <Button
                    variant="contained"
                    startIcon={<Refresh />}
                    onClick={this.handleReset}
                  >
                    Try Again
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<Home />}
                    onClick={this.handleGoHome}
                  >
                    Go to Dashboard
                  </Button>
                </Stack>

                <Typography variant="caption" color="text.secondary" textAlign="center">
                  If this problem persists, please contact support with the error details above.
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;