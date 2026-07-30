import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Button,
  Container,
  Paper,
  Chip,
  Stack,
  CircularProgress,
} from "@mui/material";
import { keyframes } from "@mui/system";
import BuildIcon from "@mui/icons-material/Build";
import RefreshIcon from "@mui/icons-material/Refresh";
import LogoutIcon from "@mui/icons-material/Logout";
import { useRoutePermissions } from "../context/RoutePermissionContext";
import { useUser } from "../context/UserContext";

// ─── Animations ───────────────────────────────────────────────────────────────

const spinSlow = keyframes`
  0%   { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

const pulse = keyframes`
  0%, 100% { opacity: 0.6; transform: scale(1); }
  50%       { opacity: 1;   transform: scale(1.05); }
`;

const shimmer = keyframes`
  0%   { background-position: -200% center; }
  100% { background-position: 200% center; }
`;

const floatUp = keyframes`
  0%   { opacity: 0; transform: translateY(20px); }
  100% { opacity: 1; transform: translateY(0); }
`;

// ─── Gear SVG Component ────────────────────────────────────────────────────────

const AnimatedGear = ({ size = 80, color = "#f59e0b", speed = "4s" }) => (
  <Box
    sx={{
      animation: `${spinSlow} ${speed} linear infinite`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <BuildIcon sx={{ fontSize: size, color }} />
  </Box>
);

// ─── Countdown to next check ───────────────────────────────────────────────────

const RefreshCountdown = ({ seconds, onRefresh }) => {
  const [count, setCount] = useState(seconds);

  useEffect(() => {
    setCount(seconds);
    const timer = setInterval(() => {
      setCount((c) => {
        if (c <= 1) {
          clearInterval(timer);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [seconds]);

  useEffect(() => {
    if (count === 0) {
      onRefresh();
    }
  }, [count, onRefresh]);

  return (
    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)", mt: 1 }}>
      Auto-checking status in{" "}
      <Box component="span" sx={{ color: "#fbbf24", fontWeight: 700 }}>
        {count}s
      </Box>
    </Typography>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────

/**
 * SystemMaintenancePage
 * Full-screen lockout page shown to non-Super Admin users when maintenance mode is ON.
 */
const SystemMaintenancePage = () => {
  const { maintenanceMessage, refetchMaintenanceStatus } = useRoutePermissions();
  const { logout } = useUser();
  const [isChecking, setIsChecking] = useState(false);
  const [countdown, setCountdown] = useState(30);

  const handleCheckStatus = async () => {
    setIsChecking(true);
    try {
      await refetchMaintenanceStatus();
      // If maintenance is over, the context will update and AccessGuard re-renders
      window.location.reload();
    } catch (_) {
      // ignore
    } finally {
      setIsChecking(false);
      setCountdown(30); // reset countdown
    }
  };

  const displayMessage =
    maintenanceMessage ||
    "We are currently performing scheduled maintenance to improve your experience. The system will be back online shortly.";

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 40%, #312e81 70%, #1e293b 100%)",
      }}
    >
      {/* Ambient glow orbs */}
      <Box
        sx={{
          position: "absolute",
          top: "-10%",
          left: "-5%",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(251,191,36,0.12) 0%, transparent 70%)",
          animation: `${pulse} 6s ease-in-out infinite`,
          pointerEvents: "none",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          bottom: "-10%",
          right: "-5%",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(139,92,246,0.10) 0%, transparent 70%)",
          animation: `${pulse} 8s ease-in-out infinite 2s`,
          pointerEvents: "none",
        }}
      />

      <Container maxWidth="sm" sx={{ position: "relative", zIndex: 1 }}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 4, sm: 6 },
            textAlign: "center",
            borderRadius: 4,
            background: "rgba(255,255,255,0.04)",
            backdropFilter: "blur(24px)",
            border: "1px solid rgba(251,191,36,0.25)",
            boxShadow:
              "0 0 0 1px rgba(251,191,36,0.1), 0 24px 64px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)",
            animation: `${floatUp} 0.6s ease-out`,
          }}
        >
          {/* Status chip */}
          <Chip
            label="🔧 SYSTEM MAINTENANCE"
            size="small"
            sx={{
              mb: 3,
              background: "rgba(251,191,36,0.15)",
              border: "1px solid rgba(251,191,36,0.4)",
              color: "#fbbf24",
              fontWeight: 700,
              letterSpacing: "0.08em",
              fontSize: "0.7rem",
              px: 1,
            }}
          />

          {/* Animated Gear */}
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 120,
              height: 120,
              borderRadius: "50%",
              mb: 3,
              background: "rgba(251,191,36,0.08)",
              border: "2px solid rgba(251,191,36,0.2)",
              boxShadow: "0 0 40px rgba(251,191,36,0.15)",
            }}
          >
            <AnimatedGear size={56} color="#fbbf24" speed="5s" />
          </Box>

          {/* Heading */}
          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              mb: 1,
              letterSpacing: "-0.03em",
              background: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #fde68a 100%)",
              backgroundSize: "200% auto",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              animation: `${shimmer} 3s linear infinite`,
            }}
          >
            System Under Maintenance
          </Typography>

          {/* NIA / OSBPIS branding */}
          <Typography
            variant="caption"
            sx={{
              display: "block",
              color: "rgba(255,255,255,0.35)",
              mb: 3,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            NIA — OSBPIS Budget System
          </Typography>

          {/* Divider */}
          <Box
            sx={{
              width: 60,
              height: 2,
              borderRadius: 1,
              background: "linear-gradient(90deg, transparent, #fbbf24, transparent)",
              mx: "auto",
              mb: 3,
            }}
          />

          {/* Message */}
          <Typography
            variant="body1"
            sx={{
              color: "rgba(255,255,255,0.75)",
              lineHeight: 1.75,
              mb: 4,
              maxWidth: 400,
              mx: "auto",
            }}
          >
            {displayMessage}
          </Typography>

          {/* Action Buttons */}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="center" mb={2}>
            <Button
              variant="contained"
              size="large"
              startIcon={isChecking ? <CircularProgress size={18} color="inherit" /> : <RefreshIcon />}
              onClick={handleCheckStatus}
              disabled={isChecking}
              sx={{
                px: 4,
                py: 1.5,
                borderRadius: 2.5,
                fontWeight: 700,
                textTransform: "none",
                fontSize: "0.95rem",
                background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                boxShadow: "0 4px 20px rgba(245,158,11,0.4)",
                color: "#1a1a1a",
                "&:hover": {
                  background: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)",
                  boxShadow: "0 6px 24px rgba(245,158,11,0.5)",
                },
                "&:disabled": {
                  opacity: 0.7,
                  color: "#1a1a1a",
                },
              }}
            >
              {isChecking ? "Checking..." : "Check Status"}
            </Button>

            <Button
              variant="outlined"
              size="large"
              startIcon={<LogoutIcon />}
              onClick={logout}
              sx={{
                px: 4,
                py: 1.5,
                borderRadius: 2.5,
                fontWeight: 600,
                textTransform: "none",
                fontSize: "0.95rem",
                borderColor: "rgba(255,255,255,0.2)",
                color: "rgba(255,255,255,0.7)",
                "&:hover": {
                  borderColor: "rgba(255,255,255,0.4)",
                  background: "rgba(255,255,255,0.05)",
                  color: "#fff",
                },
              }}
            >
              Sign Out
            </Button>
          </Stack>

          {/* Countdown */}
          <RefreshCountdown seconds={countdown} onRefresh={handleCheckStatus} />
        </Paper>

        {/* Footer */}
        <Typography
          variant="caption"
          sx={{
            display: "block",
            textAlign: "center",
            mt: 3,
            color: "rgba(255,255,255,0.25)",
          }}
        >
          © {new Date().getFullYear()} National Irrigation Administration — Budget System
        </Typography>
      </Container>
    </Box>
  );
};

export default SystemMaintenancePage;
