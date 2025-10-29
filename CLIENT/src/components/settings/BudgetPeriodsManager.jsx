import React, { useState } from "react";
import {
  Box,
  Button,
  TextField,
  Grid,
  Paper,
  Typography,
  Stack,
  IconButton,
  Chip,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  useTheme,
  alpha
} from "@mui/material";
import {
  AiOutlineDelete,
  AiOutlinePlus,
  AiOutlineEdit
} from "react-icons/ai";
import { MdDateRange } from "react-icons/md";
import { Controller } from "react-hook-form";

/**
 * Manages multiple budget periods for fiscal year settings
 * Allows adding, editing, and removing periods
 */
const BudgetPeriodsManager = ({ control, watch, setValue, errors, periods = [] }) => {
  const theme = useTheme();
  const [editingIndex, setEditingIndex] = useState(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [tempPeriod, setTempPeriod] = useState({
    periodName: "",
    startDate: "",
    dueDate: ""
  });

  const watchedPeriods = watch("budgetPeriods") || [];

  const handleAddPeriod = () => {
    if (!tempPeriod.periodName || !tempPeriod.startDate || !tempPeriod.dueDate) {
      return;
    }

    // Validation: startDate < dueDate
    if (new Date(tempPeriod.startDate) >= new Date(tempPeriod.dueDate)) {
      alert("Start date must be before due date");
      return;
    }

    // Validation: No overlapping dates with other periods
    const newStart = new Date(tempPeriod.startDate);
    const newEnd = new Date(tempPeriod.dueDate);

    for (let period of watchedPeriods) {
      // Skip empty/invalid periods (they haven't been properly set yet)
      if (!period.startDate || !period.dueDate) {
        continue;
      }

      const existStart = new Date(period.startDate);
      const existEnd = new Date(period.dueDate);

      // Skip if dates are invalid
      if (isNaN(existStart) || isNaN(existEnd)) {
        continue;
      }

      if (!(newEnd < existStart || newStart > existEnd)) {
        alert("This period overlaps with an existing period");
        return;
      }
    }

    if (editingIndex !== null) {
      // Update existing
      const updated = [...watchedPeriods];
      updated[editingIndex] = {
        ...tempPeriod,
        isActive: editingIndex === 0 // First period is active by default
      };
      setValue("budgetPeriods", updated);
      setEditingIndex(null);
    } else {
      // Add new
      const newPeriod = {
        ...tempPeriod,
        isActive: watchedPeriods.length === 0 // First period is active by default
      };
      setValue("budgetPeriods", [...watchedPeriods, newPeriod]);
    }

    setTempPeriod({
      periodName: "",
      startDate: "",
      dueDate: ""
    });
    setShowAddDialog(false);
  };

  const handleEditPeriod = (index) => {
    setEditingIndex(index);
    setTempPeriod(watchedPeriods[index]);
    setShowAddDialog(true);
  };

  const handleDeletePeriod = (index) => {
    const updated = watchedPeriods.filter((_, i) => i !== index);
    setValue("budgetPeriods", updated);
  };

  const handleOpenDialog = () => {
    setEditingIndex(null);
    setTempPeriod({
      periodName: "",
      startDate: "",
      dueDate: ""
    });
    setShowAddDialog(true);
  };

  const handleCloseDialog = () => {
    setShowAddDialog(false);
    setEditingIndex(null);
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <MdDateRange style={{ fontSize: "1.3rem", color: theme.palette.primary.main }} />
          Budget Periods
        </Typography>
        <Button
          variant="contained"
          size="small"
          startIcon={<AiOutlinePlus />}
          onClick={handleOpenDialog}
          sx={{
            background: `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${theme.palette.secondary.main} 90%)`
          }}
        >
          Add Period
        </Button>
      </Stack>

      {watchedPeriods.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          At least one budget period is required. Click "Add Period" to create the first phase.
        </Alert>
      )}

      {/* Display periods */}
      <Stack spacing={2} sx={{ mb: 3 }}>
        {watchedPeriods.map((period, index) => (
          <Paper
            key={index}
            sx={{
              p: 2,
              border: `2px solid ${period.isActive ? theme.palette.success.main : theme.palette.divider}`,
              backgroundColor: period.isActive ? alpha(theme.palette.success.main, 0.05) : "#fff",
              transition: "all 0.3s ease"
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography variant="subtitle2" fontWeight="bold">
                    {period.periodName}
                  </Typography>
                  {period.isActive && (
                    <Chip
                      label="Active"
                      size="small"
                      color="success"
                      variant="filled"
                    />
                  )}
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {new Date(period.startDate).toLocaleDateString()} →{" "}
                  {new Date(period.dueDate).toLocaleDateString()}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Duration: {Math.ceil((new Date(period.dueDate) - new Date(period.startDate)) / (1000 * 60 * 60 * 24))} days
                </Typography>
              </Box>
              <Stack direction="row" spacing={1}>
                <IconButton
                  size="small"
                  onClick={() => handleEditPeriod(index)}
                  sx={{ color: theme.palette.primary.main }}
                >
                  <AiOutlineEdit />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => handleDeletePeriod(index)}
                  sx={{ color: theme.palette.error.main }}
                >
                  <AiOutlineDelete />
                </IconButton>
              </Stack>
            </Stack>
          </Paper>
        ))}
      </Stack>

      {/* Add/Edit Period Dialog */}
      <Dialog open={showAddDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingIndex !== null ? "Edit Budget Period" : "Add Budget Period"}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <TextField
              label="Period Name"
              placeholder="e.g., Phase 1, Phase 2, Extension"
              value={tempPeriod.periodName}
              onChange={(e) => setTempPeriod({ ...tempPeriod, periodName: e.target.value })}
              fullWidth
            />
            <TextField
              label="Start Date"
              type="date"
              value={tempPeriod.startDate}
              onChange={(e) => setTempPeriod({ ...tempPeriod, startDate: e.target.value })}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Due Date"
              type="date"
              value={tempPeriod.dueDate}
              onChange={(e) => setTempPeriod({ ...tempPeriod, dueDate: e.target.value })}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAddPeriod}
            disabled={!tempPeriod.periodName || !tempPeriod.startDate || !tempPeriod.dueDate}
          >
            {editingIndex !== null ? "Update" : "Add"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BudgetPeriodsManager;