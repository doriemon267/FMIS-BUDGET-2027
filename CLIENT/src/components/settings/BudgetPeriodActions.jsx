import React, { useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  Typography,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  Grid,
  useTheme,
  alpha,
  Alert
} from "@mui/material";
import {
  AiOutlinePlus,
  AiOutlineCheckCircle
} from "react-icons/ai";
import { MdDateRange } from "react-icons/md";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import api from "../../config/api";

/**
 * Component for managing budget period actions:
 * - Extend: Add new period without affecting existing ones
 * - Activate: Switch to a different period
 */
const BudgetPeriodActions = ({ settingId, budgetPeriods = [] }) => {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [showExtendDialog, setShowExtendDialog] = useState(false);
  const [showActivateDialog, setShowActivateDialog] = useState(false);
  const [selectedPeriodIndex, setSelectedPeriodIndex] = useState(null);
  const [extendPeriod, setExtendPeriod] = useState({
    periodName: "",
    startDate: "",
    dueDate: ""
  });

  // Mutation for extending period
  const extendMutation = useMutation({
    mutationFn: async (data) => {
      const response = await api.post(
        `/settings/${settingId}/extend-period`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["settings"]);
      toast.success("Period extended successfully!");
      setShowExtendDialog(false);
      setExtendPeriod({
        periodName: "",
        startDate: "",
        dueDate: ""
      });
    },
    onError: (error) => {
      const errorMessage =
        error.response?.data?.message || "Failed to extend period";
      toast.error(errorMessage);
    }
  });

  // Mutation for activating period
  const activateMutation = useMutation({
    mutationFn: async (periodIndex) => {
      const response = await api.patch(
        `/settings/${settingId}/activate-period`,
        { periodIndex }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["settings"]);
      toast.success("Period activated successfully!");
      setShowActivateDialog(false);
      setSelectedPeriodIndex(null);
    },
    onError: (error) => {
      const errorMessage =
        error.response?.data?.message || "Failed to activate period";
      toast.error(errorMessage);
    }
  });

  const handleExtendPeriod = () => {
    if (
      !extendPeriod.periodName ||
      !extendPeriod.startDate ||
      !extendPeriod.dueDate
    ) {
      toast.error("Please fill in all fields");
      return;
    }

    // Validation: startDate < dueDate
    if (new Date(extendPeriod.startDate) >= new Date(extendPeriod.dueDate)) {
      toast.error("Start date must be before due date");
      return;
    }

    // Validation: New period should start after last period
    if (budgetPeriods.length > 0) {
      const lastPeriod = budgetPeriods[budgetPeriods.length - 1];
      const newStart = new Date(extendPeriod.startDate);
      const lastEnd = new Date(lastPeriod.dueDate);

      if (newStart <= lastEnd) {
        toast.error("New period must start after the last period ends");
        return;
      }
    }

    extendMutation.mutate(extendPeriod);
  };

  const handleActivatePeriod = () => {
    if (selectedPeriodIndex === null) return;
    activateMutation.mutate(selectedPeriodIndex);
  };

  const activePeriod = budgetPeriods.find((p) => p.isActive);
  const activePeriodIndex = budgetPeriods.findIndex((p) => p.isActive);

  return (
    <Box>
      {/* Period Display Cards */}
      {budgetPeriods.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Budget Periods
          </Typography>

          <Grid container spacing={2}>
            {budgetPeriods.map((period, index) => (
              <Grid item xs={12} sm={6} md={4} key={index}>
                <Card
                  sx={{
                    border: `2px solid ${
                      period.isActive
                        ? theme.palette.success.main
                        : theme.palette.divider
                    }`,
                    backgroundColor: period.isActive
                      ? alpha(theme.palette.success.main, 0.05)
                      : "#fff",
                    transition: "all 0.3s ease",
                    cursor: "pointer",
                    "&:hover": {
                      transform: "translateY(-4px)",
                      boxShadow: "0 8px 16px rgba(0,0,0,0.1)"
                    }
                  }}
                  onClick={() => {
                    if (!period.isActive) {
                      setSelectedPeriodIndex(index);
                      setShowActivateDialog(true);
                    }
                  }}
                >
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                      <Typography variant="subtitle2" fontWeight="bold">
                        {period.periodName}
                      </Typography>
                      {period.isActive && (
                        <Chip
                          icon={<AiOutlineCheckCircle />}
                          label="Active"
                          size="small"
                          color="success"
                          variant="filled"
                        />
                      )}
                    </Stack>

                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      <strong>Start:</strong>{" "}
                      {new Date(period.startDate).toLocaleDateString()}
                    </Typography>

                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      <strong>Due:</strong>{" "}
                      {new Date(period.dueDate).toLocaleDateString()}
                    </Typography>

                    <Typography variant="caption" color="text.secondary">
                      Duration:{" "}
                      {Math.ceil(
                        (new Date(period.dueDate) - new Date(period.startDate)) /
                          (1000 * 60 * 60 * 24)
                      )}{" "}
                      days
                    </Typography>

                    {!period.isActive && (
                      <Box sx={{ mt: 2 }}>
                        <Button
                          size="small"
                          variant="outlined"
                          fullWidth
                          startIcon={<AiOutlineCheckCircle />}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPeriodIndex(index);
                            setShowActivateDialog(true);
                          }}
                        >
                          Activate
                        </Button>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}

            {/* Extend Button Card */}
            <Grid item xs={12} sm={6} md={4}>
              <Card
                sx={{
                  border: `2px dashed ${theme.palette.primary.main}`,
                  backgroundColor: alpha(theme.palette.primary.main, 0.02),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: "200px",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  "&:hover": {
                    backgroundColor: alpha(theme.palette.primary.main, 0.05),
                    transform: "scale(1.02)"
                  }
                }}
                onClick={() => setShowExtendDialog(true)}
              >
                <Box sx={{ textAlign: "center" }}>
                  <Box
                    sx={{
                      fontSize: "2rem",
                      color: theme.palette.primary.main,
                      mb: 1
                    }}
                  >
                    <AiOutlinePlus />
                  </Box>
                  <Typography variant="body2" color="primary">
                    Extend Period
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Add new phase or extension
                  </Typography>
                </Box>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Extend Period Dialog */}
      <Dialog
        open={showExtendDialog}
        onClose={() => setShowExtendDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Extend Budget Period</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            Add a new phase or extension. Previous periods remain unchanged.
          </Alert>

          {budgetPeriods.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Last period ends on:{" "}
              <strong>
                {new Date(budgetPeriods[budgetPeriods.length - 1].dueDate).toLocaleDateString()}
              </strong>
            </Alert>
          )}

          <Stack spacing={2}>
            <TextField
              label="Period Name"
              placeholder="e.g., Extension, Phase 3"
              value={extendPeriod.periodName}
              onChange={(e) =>
                setExtendPeriod({ ...extendPeriod, periodName: e.target.value })
              }
              fullWidth
            />
            <TextField
              label="Start Date"
              type="date"
              value={extendPeriod.startDate}
              onChange={(e) =>
                setExtendPeriod({ ...extendPeriod, startDate: e.target.value })
              }
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Due Date"
              type="date"
              value={extendPeriod.dueDate}
              onChange={(e) =>
                setExtendPeriod({ ...extendPeriod, dueDate: e.target.value })
              }
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowExtendDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleExtendPeriod}
            disabled={extendMutation.isPending}
          >
            {extendMutation.isPending ? "Extending..." : "Extend"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Activate Period Dialog */}
      <Dialog
        open={showActivateDialog}
        onClose={() => setShowActivateDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Activate Budget Period</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {selectedPeriodIndex !== null && (
            <Box>
              <Alert severity="info" sx={{ mb: 2 }}>
                You're about to activate:{" "}
                <strong>{budgetPeriods[selectedPeriodIndex]?.periodName}</strong>
              </Alert>

              <Typography variant="body2" sx={{ mb: 2 }}>
                <strong>Period Details:</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Start:{" "}
                {new Date(budgetPeriods[selectedPeriodIndex]?.startDate).toLocaleDateString()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Due:{" "}
                {new Date(budgetPeriods[selectedPeriodIndex]?.dueDate).toLocaleDateString()}
              </Typography>

              <Alert severity="warning" sx={{ mt: 2 }}>
                The current active period will become inactive.
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowActivateDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleActivatePeriod}
            disabled={activateMutation.isPending || selectedPeriodIndex === null}
          >
            {activateMutation.isPending ? "Activating..." : "Confirm Activate"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BudgetPeriodActions;