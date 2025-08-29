import React from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  Stack,
  Divider,
  useTheme,
} from "@mui/material";
import {
  Lock as LockIcon,
  Home as HomeIcon,
  ArrowBack as ArrowBackIcon,
  Security as SecurityIcon,
} from "@mui/icons-material";
import { motion } from "framer-motion";

const NotAuthorized = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  const handleGoBack = () => {
    navigate(-1);
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: "easeOut",
        staggerChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4 },
    },
  };

  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            minHeight: "60vh",
            justifyContent: "center",
          }}
        >
          <Paper
            elevation={8}
            sx={{
              p: { xs: 4, md: 6 },
              borderRadius: 4,
              textAlign: "center",
              maxWidth: 600,
              width: "100%",
              background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${theme.palette.grey[50]} 100%)`,
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <motion.div variants={itemVariants}>
              <Box
                sx={{
                  mb: 3,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Box
                  sx={{
                    width: 80,
                    height: 80,
                    borderRadius: "50%",
                    backgroundColor: theme.palette.error.light,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    mb: 2,
                  }}
                >
                  <LockIcon
                    sx={{
                      fontSize: 40,
                      color: theme.palette.error.main,
                    }}
                  />
                </Box>
              </Box>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Typography
                variant="h1"
                sx={{
                  fontSize: { xs: "3rem", md: "4rem" },
                  fontWeight: 700,
                  color: theme.palette.error.main,
                  mb: 1,
                  letterSpacing: "-0.02em",
                }}
              >
                403
              </Typography>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 600,
                  color: theme.palette.text.primary,
                  mb: 2,
                  fontSize: { xs: "1.5rem", md: "2rem" },
                }}
              >
                Access Denied
              </Typography>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Box sx={{ mb: 3, px: 2 }}>
                <Typography
                  variant="body1"
                  sx={{
                    color: theme.palette.text.secondary,
                    fontSize: "1.1rem",
                    lineHeight: 1.6,
                    mb: 2,
                  }}
                >
                  You don't have the necessary permissions to access this page
                  in the FMIS Budget Management System.
                </Typography>

                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 1,
                    mb: 2,
                  }}
                >
                  <SecurityIcon
                    sx={{
                      fontSize: 20,
                      color: theme.palette.warning.main,
                    }}
                  />
                  <Typography
                    variant="body2"
                    sx={{
                      color: theme.palette.text.secondary,
                      fontStyle: "italic",
                    }}
                  >
                    Contact your system administrator for access
                  </Typography>
                </Box>
              </Box>
            </motion.div>

            <Divider sx={{ my: 3 }} />

            <motion.div variants={itemVariants}>
              <Typography
                variant="h6"
                sx={{
                  color: theme.palette.text.primary,
                  mb: 3,
                  fontWeight: 500,
                }}
              >
                What would you like to do?
              </Typography>

              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                justifyContent="center"
                alignItems="center"
              >
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<HomeIcon />}
                  component={Link}
                  to="/dashboard"
                  sx={{
                    minWidth: 180,
                    py: 1.5,
                    borderRadius: 2,
                    textTransform: "none",
                    fontWeight: 600,
                    fontSize: "1rem",
                    background: `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${theme.palette.primary.dark} 90%)`,
                    "&:hover": {
                      background: `linear-gradient(45deg, ${theme.palette.primary.dark} 30%, ${theme.palette.primary.main} 90%)`,
                      transform: "translateY(-1px)",
                      boxShadow: theme.shadows[8],
                    },
                    transition: "all 0.3s ease",
                  }}
                >
                  Go to Dashboard
                </Button>

                <Button
                  variant="outlined"
                  size="large"
                  startIcon={<ArrowBackIcon />}
                  onClick={handleGoBack}
                  sx={{
                    minWidth: 180,
                    py: 1.5,
                    borderRadius: 2,
                    textTransform: "none",
                    fontWeight: 600,
                    fontSize: "1rem",
                    "&:hover": {
                      transform: "translateY(-1px)",
                      boxShadow: theme.shadows[4],
                    },
                    transition: "all 0.3s ease",
                  }}
                >
                  Go Back
                </Button>
              </Stack>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Box sx={{ mt: 4, pt: 3, borderTop: `1px solid ${theme.palette.divider}` }}>
                <Typography
                  variant="caption"
                  sx={{
                    color: theme.palette.text.disabled,
                    fontSize: "0.875rem",
                  }}
                >
                  FMIS Budget Management System
                </Typography>
              </Box>
            </motion.div>
          </Paper>
        </Box>
      </motion.div>
    </Container>
  );
};

export default NotAuthorized;