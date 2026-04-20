import React from "react";
import { Link } from "react-router-dom";
import { Box, Container, Typography, Button, Paper, useTheme } from "@mui/material";
import { ErrorOutline as ErrorOutlineIcon, Home as HomeIcon } from "@mui/icons-material";

const NotFoundPage = () => {
  const theme = useTheme();

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
        <Box sx={{ mb: 2, display: "flex", justifyContent: "center" }}>
          <ErrorOutlineIcon sx={{ fontSize: 60, color: theme.palette.warning.main }} />
        </Box>

        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1, color: theme.palette.text.primary }}>
          404 - Page Not Found
        </Typography>

        <Typography variant="body1" sx={{ color: theme.palette.text.secondary, mb: 4 }}>
          The page you are trying to open does not exist.
        </Typography>

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
      </Paper>
    </Container>
  );
};

export default NotFoundPage;