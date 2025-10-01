import React from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  useTheme,
} from "@mui/material";
import {
  Lock as LockIcon,
  Home as HomeIcon,
} from "@mui/icons-material";

const NotAuthorized = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <Container maxWidth="md" sx={{ py: 10 }}>
      <Paper
        elevation={2}
        sx={{
          p: { xs: 4, md: 6 },
          textAlign: "center",
          borderRadius: 2,
          backgroundColor: theme.palette.grey[50],
        }}
      >
        {/* Icon */}
        <Box sx={{ mb: 2, display: "flex", justifyContent: "center" }}>
          <LockIcon
            sx={{ fontSize: 60, color: theme.palette.error.main }}
          />
        </Box>

        {/* Title */}
        <Typography
          variant="h5"
          sx={{ fontWeight: 600, mb: 1, color: theme.palette.text.primary }}
        >
          Access Restricted
        </Typography>

        {/* Message */}
        <Typography
          variant="body1"
          sx={{ color: theme.palette.text.secondary, mb: 4 }}
        >
          You don’t have permission to view this page.  
          Please request access if you believe this is a mistake.
        </Typography>

        {/* Button */}
        <Button
          variant="contained"
          color="primary"
          startIcon={<HomeIcon />}
          component={Link}
          to="/dashboard"
          sx={{
            px: 4,
            py: 1.5,
            borderRadius: 2,
            fontWeight: 600,
            textTransform: "none",
          }}
        >
          Go to Dashboard
        </Button>

        {/* Small footer */}
        <Box sx={{ mt: 4 }}>
          <Typography
            variant="caption"
            sx={{ color: theme.palette.text.disabled }}
          >
            © 2025 FMIS Budget Management System
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
};

export default NotAuthorized;
