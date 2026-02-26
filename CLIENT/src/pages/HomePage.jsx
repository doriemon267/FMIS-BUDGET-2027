import {
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Grid,
  Link,
  Toolbar,
  Typography,
  useTheme,
} from "@mui/material";
import { motion } from "framer-motion";
import {
  FaCalculator,
  FaCashRegister,
  FaCheckCircle,
  FaExternalLinkAlt,
} from "react-icons/fa";
import { FaPesoSign } from "react-icons/fa6";
import env from "../utils/env";
import IS_PRODUCTION from "../utils/IS_PRODUCTION";
import { useEffect, useState } from "react";
import { authApi } from "../config/api";

// Animation variants
const appBarVariants = {
  hidden: { opacity: 0, y: -50 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" }, // Reduced from 0.6 to 0.3
  },
};

const typographyVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.3, ease: "easeOut" }, // Reduced from 0.5 to 0.3
  },
};

const heroVariants = {
  hidden: { opacity: 0, y: 50 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" }, // Reduced from 0.8 to 0.4
  },
};

// New variants for hero section elements
const heroElementVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, delay: i * 0.1, ease: "easeOut" }, // Fast stagger
  }),
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1, // Reduced from 0.2 to 0.1
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" }, // Reduced from 0.6 to 0.3
  },
};

// New variants for card content (icon, title, description)
const cardContentVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, delay: i * 0.1, ease: "easeOut" }, // Fast stagger
  }),
};

export default function HomePage() {
  const theme = useTheme();

  const [hasUser, setHasUser] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const res = await authApi.get("/get-user");
        setHasUser(!!res?.data?.user);
      } catch {
        setHasUser(false);
      }
    })();
  }, []);

  const handleNavigateToLogin = () => {
    const currentUrl = window.location.origin + "/dashboard";
    let base = env("LOGIN_REDIRECT_URL");
    if (base && /\/Manage$/i.test(base)) {
      base = "https://accounts.nia.gov.ph/Account/Login";
    }
    const loginUrl = IS_PRODUCTION
      ? `${base || "https://accounts.nia.gov.ph/Account/Login"}?ReturnUrl=${encodeURIComponent(currentUrl)}`
      : `${env("LOGIN_REDIRECT_URL_DEV") || env("AUTH_CLIENT_URL_DEV") || env("CLIENT_URL_DEV")}/login?redirect=${encodeURIComponent(currentUrl)}`;

    location.href = loginUrl;
  };

  // Feature data with react-icons, dashboard links, and background image positions
  const features = [
    {
      title: "Budget System",
      description:
        "Plan, allocate, and monitor budgets effectively across departments.",
      icon: <FaCalculator style={{ fontSize: 40, color: "#fff" }} />,
      dashboardUrl: "https://budget.nia.gov.ph/dashboard",
      bgPosition: "top left",
    },
    {
      title: "Disbursement Voucher System",
      description:
        "Streamline the process of creating and approving disbursement vouchers.",
      icon: <FaPesoSign style={{ fontSize: 40, color: "#fff" }} />,
      dashboardUrl: "https://dv.nia.gov.ph/dashboard",
      bgPosition: "top center",
    },
    {
      title: "Cash System",
      description:
        "Manage cash inflows and outflows efficiently to maintain financial stability.",
      icon: <FaCashRegister style={{ fontSize: 40, color: "#fff" }} />,
      dashboardUrl: "https://cash.nia.gov.ph/dashboard",
      bgPosition: "center",
    },
    {
      title: "Billing & Collection System",
      description:
        "Streamline billing and collection processes for efficient financial management.",
      icon: <FaPesoSign style={{ fontSize: 40, color: "#fff" }} />,
      dashboardUrl: "https://bc.nia.gov.ph/dashboard",
      bgPosition: "bottom right",
    },
  ];

  return (
    <Box
      sx={{
        minHeight: "100vh",
        width: "100%",
        backgroundImage:
          "linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url('/homepage.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Roboto', sans-serif",
      }}
    >
      {/* AppBar Section */}
      <motion.div variants={appBarVariants} initial="hidden" animate="visible">
        <AppBar
          position="sticky"
          color="primary"
          elevation={0}
          sx={{
            py: 1.5,
            px: { xs: 2, sm: 4, md: 8 },
          }}
        >
          <Toolbar sx={{ justifyContent: "space-between" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <img
                src="/2020-nia-logo.svg"
                alt="NIA Logo"
                style={{ height: 50, marginRight: 16 }}
              />

              <Box sx={{ display: "flex", alignItems: "center" }}>
                <motion.div
                  variants={typographyVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <Typography
                    variant="h6"
                    sx={{
                      display: { xs: "none", sm: "block" },
                      fontWeight: "bold",
                      letterSpacing: 1.2,
                      textTransform: "uppercase",
                      fontFamily: '"Merriweather", "Georgia", serif',
                    }}
                    aria-label={env("APP_FULL_TITLE")}
                  >
                    {env("APP_FULL_TITLE")}
                  </Typography>
                </motion.div>
                <motion.div
                  variants={typographyVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <Typography
                    variant="h6"
                    sx={{
                      display: { xs: "block", sm: "none" },
                      fontFamily: '"Merriweather", "Georgia", serif',
                      fontWeight: 700,
                      fontSize: "1.125rem",
                      letterSpacing: 0.5,
                      lineHeight: 1.4,
                    }}
                    aria-label={env("APP_TITLE")}
                  >
                    {env("APP_TITLE")}
                  </Typography>
                </motion.div>
              </Box>
            </Box>
            {hasUser && (
              <Chip
                icon={<FaCheckCircle style={{ fontSize: 16, color: "inherit" }} />}
                label="Logged in"
                size="small"
                sx={{
                  bgcolor: "rgba(76, 175, 80, 0.9)",
                  color: "#fff",
                  fontWeight: 600,
                  "& .MuiChip-icon": { color: "inherit" },
                }}
              />
            )}
          </Toolbar>
        </AppBar>
      </motion.div>

      {/* Hero Section */}
      <Box
        sx={{
          textAlign: "center",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "70vh",
          px: { xs: 2, sm: 4, md: 8 },
        }}
      >
        <motion.div variants={heroVariants} initial="hidden" animate="visible">
          <motion.div
            variants={heroElementVariants}
            initial="hidden"
            animate="visible"
            custom={0}
          >
            <Typography
              variant="h1"
              sx={{
                fontSize: { xs: "2.8rem", sm: "4rem", md: "5rem" },
                fontWeight: 900,
                lineHeight: 1.1,
                letterSpacing: -1,
                mb: 2,
                background: `linear-gradient(45deg, #fff, ${theme.palette.primary.light})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Welcome to FMIS Portal
            </Typography>
          </motion.div>
          <motion.div
            variants={heroElementVariants}
            initial="hidden"
            animate="visible"
            custom={1}
          >
            <Typography
              variant="h5"
              sx={{
                maxWidth: 800,
                mx: "auto",
                opacity: 0.9,
                fontWeight: 300,
                lineHeight: 1.6,
                mb: 4,
              }}
            >
              A centralized platform for managing and overseeing all
              functionalities under the FMIS system with efficiency and ease.
            </Typography>
          </motion.div>
          <motion.div
            variants={heroElementVariants}
            initial="hidden"
            animate="visible"
            custom={2}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {hasUser ? (
              <Button
                href="/dashboard"
                variant="outlined"
                size="medium"
                sx={{
                  color: "#fff",
                  borderColor: "#fff",
                  background: "transparent",
                  borderRadius: 24,
                  px: 4,
                  py: 1.5,
                  textTransform: "none",
                  fontWeight: 600,
                  fontSize: "1rem",
                  lineHeight: 1.5,
                  minWidth: 120,
                  height: 48,
                  "&:hover": {
                    backgroundColor: "rgba(255,255,255,0.15)",
                    borderColor: "#fff",
                    color: "#fff",
                    boxShadow: "0 8px 32px rgba(255,255,255,0.2)",
                    transform: "translateY(-2px)",
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  },
                }}
              >
                Dashboard
              </Button>
            ) : (
              <Button
                onClick={handleNavigateToLogin} // <-- also here
                variant="outlined"
                size="medium"
                sx={{
                  color: "#fff",
                  borderColor: "#fff",
                  background: "transparent",
                  borderRadius: 24,
                  px: 4,
                  py: 1.5,
                  textTransform: "none",
                  fontWeight: 600,
                  fontSize: "1rem",
                  lineHeight: 1.5,
                  minWidth: 120,
                  height: 48,
                  "&:hover": {
                    backgroundColor: "rgba(255,255,255,0.15)",
                    borderColor: "#fff",
                    color: "#fff",
                    boxShadow: "0 8px 32px rgba(255,255,255,0.2)",
                    transform: "translateY(-2px)",
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  },
                }}
              >
                Login
              </Button>
            )}
          </motion.div>
        </motion.div>
      </Box>

      {/* Features Overview */}
      <Container sx={{ py: 8 }}>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <Grid container spacing={4} justifyContent="center">
            {features.map((item, index) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={index}>
                <motion.div
                  variants={cardVariants}
                  whileHover={{
                    scale: 1.05,
                    transition: { duration: 0.3 },
                  }}
                >
                  <Card
                    sx={{
                      backgroundImage: `linear-gradient(rgba(0,0,0,0.65), rgba(0,0,0,0.5)), url('/homepage.jpg')`,
                      backgroundSize: "cover",
                      backgroundPosition: item.bgPosition || "center",
                      backdropFilter: "blur(12px)",
                      color: "#fff",
                      padding: 3,
                      borderRadius: "20px",
                      border: "1px solid rgba(255,255,255,0.25)",
                      boxShadow: "0px 8px 30px rgba(0,0,0,0.3)",
                      transition: "all 0.3s ease",
                      overflow: "hidden",
                    }}
                  >
                    <CardContent sx={{ textAlign: "center" }}>
                      <motion.div
                        variants={cardContentVariants}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                        custom={0}
                      >
                        <Box sx={{ mb: 2 }}>{item.icon}</Box>
                      </motion.div>
                      <motion.div
                        variants={cardContentVariants}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                        custom={1}
                      >
                        <Typography
                          variant="h6"
                          fontWeight={700}
                          gutterBottom
                          sx={{ letterSpacing: 0.5 }}
                        >
                          {item.title}
                        </Typography>
                      </motion.div>
                      <motion.div
                        variants={cardContentVariants}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                        custom={2}
                      >
                        <Typography
                          variant="body2"
                          sx={{ opacity: 0.85, lineHeight: 1.7 }}
                        >
                          {item.description}
                        </Typography>
                      </motion.div>
                      {item.dashboardUrl && (
                        <Link
                          href={item.dashboardUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          underline="none"
                          sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 0.5,
                            mt: 2,
                            color: "primary.light",
                            fontWeight: 600,
                            fontSize: "0.875rem",
                            "&:hover": { color: "primary.main" },
                          }}
                        >
                          Go to Dashboard
                          <FaExternalLinkAlt style={{ fontSize: 12 }} />
                        </Link>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              </Grid>
            ))}
          </Grid>
        </motion.div>
      </Container>
    </Box>
  );
}