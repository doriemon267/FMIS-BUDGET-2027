import React, { useState, useEffect, useCallback } from "react";
import {
  TableRow,
  TableCell,
  TextField,
  IconButton,
  Chip,
  Tooltip,
  Box,
  Fade,
  Zoom
} from "@mui/material";
import { useMutation } from "@tanstack/react-query";
import api from "../../config/api";
import { toast } from "react-hot-toast";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import CancelIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import { green, orange, red, blue } from "@mui/material/colors";

const OvertimePayEditableRow = ({ row, refreshData, activeSettings: propActiveSettings }) => {
  const [activeSettings, setActiveSettings] = useState(propActiveSettings);
  const [personStatus, setPersonStatus] = useState(null);

  // Fetch active settings if not provided
  useEffect(() => {
    if (!activeSettings) {
      const fetchSettings = async () => {
        try {
          const res = await api.get("/settings/active");
          setActiveSettings(res.data);
        } catch (err) {
          console.error("Error fetching active settings:", err);
          toast.error("Failed to load settings.");
        }
      };
      fetchSettings();
    }
  }, [activeSettings]);

  // After settings load, fetch personnel status
  useEffect(() => {
    if (activeSettings && activeSettings.fiscalYear) {
      const fetchStatus = async () => {
        try {
          const res = await api.get(`/getpersonnels?fiscalYear=${activeSettings.fiscalYear}`);
          const found = res.data.find(
            (e) => e.employeeFullName === row.employeeFullName
          );
          setPersonStatus(found?.status || null);
        } catch (err) {
          console.error("Error fetching personnel status:", err);
        }
      };
      fetchStatus();
    }
  }, [activeSettings, row.employeeFullName]);

  // Settings multipliers
  const localSettings = activeSettings || { weekdayMultiplier: 1.25, weekendMultiplier: 1.5 };

  const getMonthlySalary = () => {
    const salary = Number(row.monthlySalary);
    return salary > 0 ? salary : 50000;
  };

  const [isEditing, setIsEditing] = useState(false);
  const [weekdayHours, setWeekdayHours] = useState(row.weekdayHours);
  const [weekendHours, setWeekendHours] = useState(row.weekendHours);
  const [computedAmount, setComputedAmount] = useState(row.amount);

  // Compute new amount
  const computeAmount = useCallback(() => {
    const monthlySalary = getMonthlySalary();
    const wd = Math.min(Number(weekdayHours) || 0, 3);
    const we = Math.min(Number(weekendHours) || 0, 8);
    const amount =
      wd * (localSettings.weekdayMultiplier / 100) * monthlySalary * 12 +
      we * (localSettings.weekendMultiplier / 100) * monthlySalary * 12;
    return isNaN(amount) ? 0 : amount;
  }, [weekdayHours, weekendHours, localSettings, row.monthlySalary]);

  useEffect(() => {
    if (isEditing) {
      setComputedAmount(computeAmount());
    }
  }, [computeAmount, isEditing]);

  const mutation = useMutation({
    mutationFn: async (data) => await api.put(`/overtime-pay/${row._id}`, data),
    onSuccess: () => {
      toast.success("Overtime record updated successfully");
      setIsEditing(false);
      refreshData();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Error updating record");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => await api.delete(`/overtime-pay/${row._id}`),
    onSuccess: () => {
      toast.success("Overtime record deleted successfully");
      refreshData();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Error deleting record");
    },
  });

  const handleSave = () => {
    const payload = {
      weekdayHours: Number(weekdayHours),
      weekendHours: Number(weekendHours),
      monthlySalary: getMonthlySalary(),
      amount: computeAmount(),
    };
    mutation.mutate(payload);
  };

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete this record?")) {
      deleteMutation.mutate();
    }
  };

  // disable actions if status is Submitted or Approved
  const isFinal = ["Submitted", "Approved"].includes(personStatus);

  // Get status color and styling
  const getStatusChip = () => {
    if (!personStatus) return null;

    const statusConfig = {
      'Draft': { color: blue[500], bg: blue[50] },
      'Submitted': { color: orange[700], bg: orange[50] },
      'Approved': { color: green[700], bg: green[50] },
      'Rejected': { color: red[700], bg: red[50] },
    };

    const config = statusConfig[personStatus] || { color: blue[500], bg: blue[50] };

    return (
      <Chip
        label={personStatus}
        size="small"
        sx={{
          backgroundColor: config.bg,
          color: config.color,
          fontWeight: 'bold',
          fontSize: '0.75rem'
        }}
      />
    );
  };

  return (
    <Fade in={true} timeout={300}>
      <TableRow
        sx={{
          backgroundColor: isEditing ? 'rgba(55, 94, 56, 0.05)' : 'inherit',
          transition: 'all 0.3s ease',
          '&:hover': {
            backgroundColor: isEditing ? 'rgba(55, 94, 56, 0.08)' : 'rgba(55, 94, 56, 0.02)',
          }
        }}
      >
        <TableCell>
          <Box display="flex" flexDirection="column" gap={0.5}>
            <Box fontWeight="medium">{row.employeeFullName}</Box>
            {getStatusChip()}
          </Box>
        </TableCell>
        <TableCell>
          {isEditing ? (
            <Zoom in={isEditing}>
              <TextField
                type="number"
                value={weekdayHours}
                onChange={(e) => setWeekdayHours(e.target.value)}
                variant="outlined"
                size="small"
                inputProps={{ min: 0, max: 3 }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '&.Mui-focused fieldset': {
                      borderColor: '#375e38',
                    },
                  },
                }}
              />
            </Zoom>
          ) : (
            <Box display="flex" alignItems="center" gap={1}>
              <Box fontWeight="medium">{row.weekdayHours}</Box>
              <Chip
                label="hrs"
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.7rem', height: '20px' }}
              />
            </Box>
          )}
        </TableCell>
        <TableCell>
          {isEditing ? (
            <Zoom in={isEditing}>
              <TextField
                type="number"
                value={weekendHours}
                onChange={(e) => setWeekendHours(e.target.value)}
                variant="outlined"
                size="small"
                inputProps={{ min: 0, max: 8 }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '&.Mui-focused fieldset': {
                      borderColor: '#375e38',
                    },
                  },
                }}
              />
            </Zoom>
          ) : (
            <Box display="flex" alignItems="center" gap={1}>
              <Box fontWeight="medium">{row.weekendHours}</Box>
              <Chip
                label="hrs"
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.7rem', height: '20px' }}
              />
            </Box>
          )}
        </TableCell>
        <TableCell>
          {isEditing ? (
            <Zoom in={isEditing}>
              <TextField
                value={computedAmount.toLocaleString("en-PH", { style: "currency", currency: "PHP" })}
                variant="outlined"
                size="small"
                disabled
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: '#f5f5f5',
                  },
                }}
              />
            </Zoom>
          ) : (
            <Box
              sx={{
                fontWeight: 'bold',
                color: '#375e38',
                fontSize: '1rem'
              }}
            >
              {row.amount.toLocaleString("en-PH", { style: "currency", currency: "PHP" })}
            </Box>
          )}
        </TableCell>
        <TableCell>
          <Box display="flex" gap={0.5}>
            {isEditing ? (
              <>
                <Tooltip title="Save Changes">
                  <IconButton
                    onClick={handleSave}
                    disabled={isFinal}
                    sx={{
                      backgroundColor: green[50],
                      color: green[700],
                      '&:hover': { backgroundColor: green[100] },
                      '&:disabled': { backgroundColor: 'rgba(0,0,0,0.04)' }
                    }}
                    size="small"
                  >
                    <SaveIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Cancel">
                  <IconButton
                    onClick={() => setIsEditing(false)}
                    disabled={isFinal}
                    sx={{
                      backgroundColor: orange[50],
                      color: orange[700],
                      '&:hover': { backgroundColor: orange[100] },
                      '&:disabled': { backgroundColor: 'rgba(0,0,0,0.04)' }
                    }}
                    size="small"
                  >
                    <CancelIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
            ) : (
              <>
                <Tooltip title={isFinal ? `Cannot edit ${personStatus} record` : "Edit Record"}>
                  <IconButton
                    onClick={() => setIsEditing(true)}
                    disabled={isFinal}
                    sx={{
                      backgroundColor: blue[50],
                      color: blue[700],
                      '&:hover': { backgroundColor: blue[100] },
                      '&:disabled': { backgroundColor: 'rgba(0,0,0,0.04)' }
                    }}
                    size="small"
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title={isFinal ? `Cannot delete ${personStatus} record` : "Delete Record"}>
                  <IconButton
                    onClick={handleDelete}
                    disabled={isFinal}
                    sx={{
                      backgroundColor: red[50],
                      color: red[700],
                      '&:hover': { backgroundColor: red[100] },
                      '&:disabled': { backgroundColor: 'rgba(0,0,0,0.04)' }
                    }}
                    size="small"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
            )}
          </Box>
        </TableCell>
      </TableRow>
    </Fade>
  );
};

export default OvertimePayEditableRow;
