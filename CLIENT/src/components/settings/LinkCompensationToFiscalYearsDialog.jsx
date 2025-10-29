import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Stack,
  CircularProgress,
  Alert,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Paper,
  Chip,
  useTheme,
  alpha,
  Grid,
  Card,
  CardContent
} from "@mui/material";
import {
  MdClose,
  MdCheckCircle,
  MdLink,
  MdCalendarToday
} from "react-icons/md";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../config/api";
import { toast } from "react-hot-toast";

/**
 * Link Compensation to Fiscal Years Dialog
 * Allows user to select multiple fiscal years to link to a compensation setting
 */
const LinkCompensationToFiscalYearsDialog = ({
  open,
  onClose,
  compensationId,
  compensationName,
  onSaved
}) => {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [selectedFiscalYears, setSelectedFiscalYears] = useState([]);
  const [currentlyLinked, setCurrentlyLinked] = useState([]);

  // Fetch all fiscal years - get full settings objects, not just strings
  const { data: fiscalYearsData = [], isLoading: fiscalYearsLoading } = useQuery({
    queryKey: ["fiscalYears"],
    queryFn: async () => {
      try {
        const response = await api.get("/settings", {
          params: {
            page: 1,
            limit: 100  // Get all fiscal years
          }
        });
        // Return full settings objects so we have _id, fiscalYear, budgetType, etc.
        return response.data?.settings || [];
      } catch (error) {
        console.error("Failed to fetch fiscal years:", error);
        return [];
      }
    },
    enabled: open
  });

  // Fetch which fiscal years are currently linked
  useEffect(() => {
    if (open && compensationId) {
      fetchCurrentLinks();
    }
  }, [open, compensationId]);

  const fetchCurrentLinks = async () => {
    try {
      const response = await api.get(`/compensation/${compensationId}/linked-fiscal-years`);
      setCurrentlyLinked(response.data?.linkedFiscalYears || []);
      setSelectedFiscalYears(response.data?.linkedFiscalYears || []);
    } catch (error) {
      console.error("Failed to fetch linked fiscal years:", error);
    }
  };

  // Link compensation to selected fiscal years
  const linkMutation = useMutation({
    mutationFn: async (fiscalYearIds) => {
      const promises = fiscalYearIds.map(fyId =>
        api.put(`/settings/${fyId}/link-compensation`, {
          compensationSettingsId: compensationId
        })
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["compensationList"]);
      queryClient.invalidateQueries(["compensation"]);
      queryClient.invalidateQueries(["settings"]);
      toast.success("Fiscal years linked successfully");
      handleClose();
      if (onSaved) onSaved();
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to link fiscal years");
    }
  });

  // Unlink compensation from fiscal years (those that were deselected)
  const unlinkMutation = useMutation({
    mutationFn: async (fiscalYearIds) => {
      const promises = fiscalYearIds.map(fyId =>
        api.delete(`/settings/${fyId}/compensation-link`)
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["compensationList"]);
      queryClient.invalidateQueries(["compensation"]);
      queryClient.invalidateQueries(["settings"]);
      toast.success("Fiscal years unlinked successfully");
      handleClose();
      if (onSaved) onSaved();
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to unlink fiscal years");
    }
  });

  const handleFiscalYearToggle = (fiscalYearId) => {
    setSelectedFiscalYears(prev =>
      prev.includes(fiscalYearId)
        ? prev.filter(id => id !== fiscalYearId)
        : [...prev, fiscalYearId]
    );
  };

  const handleSave = () => {
    // Find what needs to be linked and unlinked
    const toLink = selectedFiscalYears.filter(id => !currentlyLinked.includes(id));
    const toUnlink = currentlyLinked.filter(id => !selectedFiscalYears.includes(id));

    if (toLink.length === 0 && toUnlink.length === 0) {
      toast.info("No changes made");
      handleClose();
      return;
    }

    // Execute both operations
    if (toLink.length > 0) {
      linkMutation.mutate(toLink);
    }
    if (toUnlink.length > 0) {
      unlinkMutation.mutate(toUnlink);
    }
  };

  const handleClose = () => {
    setSelectedFiscalYears([]);
    setCurrentlyLinked([]);
    onClose();
  };

  const isLoading = fiscalYearsLoading || linkMutation.isPending || unlinkMutation.isPending;
  const hasChanges = JSON.stringify(selectedFiscalYears.sort()) !== JSON.stringify(currentlyLinked.sort());

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          boxShadow: "0 20px 40px rgba(0,0,0,0.1)"
        }
      }}
    >
      <DialogTitle
        sx={{
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
          color: "white",
          py: 3,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}
      >
        <Box>
          <Typography variant="h6" fontWeight="bold" component="div">
            🔗 Link to Fiscal Years
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
            {compensationName}
          </Typography>
        </Box>
        <Button
          onClick={handleClose}
          disabled={isLoading}
          sx={{ minWidth: "auto", color: "white" }}
        >
          <MdClose size={24} />
        </Button>
      </DialogTitle>

      <DialogContent sx={{ p: 3, backgroundColor: "#f8f9fa" }}>
        <Stack spacing={3}>
          {/* Info Alert */}
          <Alert severity="info">
            <Typography variant="body2">
              <strong>Select fiscal years</strong> where this compensation should be applied.
              You can select multiple fiscal years to reuse the same compensation settings.
            </Typography>
          </Alert>

          {/* Loading State */}
          {fiscalYearsLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
              <CircularProgress />
            </Box>
          ) : fiscalYearsData.length === 0 ? (
            <Alert severity="warning">
              No fiscal years available. Please create fiscal year settings first.
            </Alert>
          ) : (
            /* Fiscal Years List */
            <FormGroup>
              <Stack spacing={2}>
                {fiscalYearsData.map((fiscalYear) => {
                  const isSelected = selectedFiscalYears.includes(fiscalYear._id);
                  const isCurrentlyLinked = currentlyLinked.includes(fiscalYear._id);

                  return (
                    <Card
                      key={fiscalYear._id}
                      sx={{
                        border: isSelected ? `2px solid ${theme.palette.primary.main}` : "1px solid #e0e0e0",
                        backgroundColor: isSelected ? alpha(theme.palette.primary.main, 0.05) : "#ffffff",
                        transition: "all 0.3s ease",
                        cursor: "pointer",
                        "&:hover": {
                          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                          transform: "translateY(-2px)"
                        }
                      }}
                      onClick={() => handleFiscalYearToggle(fiscalYear._id)}
                    >
                      <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                        <Stack direction="row" spacing={2} alignItems="center">
                          <Checkbox
                            checked={isSelected}
                            onChange={() => handleFiscalYearToggle(fiscalYear._id)}
                            sx={{
                              color: theme.palette.primary.main,
                              "&.Mui-checked": {
                                color: theme.palette.primary.main
                              }
                            }}
                          />

                          <Box sx={{ flex: 1 }}>
                            <Stack spacing={0.5}>
                              <Typography variant="subtitle1" fontWeight="bold">
                                FY {fiscalYear.fiscalYear}
                                {fiscalYear.budgetType && (
                                  <Chip
                                    label={fiscalYear.budgetType}
                                    size="small"
                                    sx={{
                                      ml: 1,
                                      backgroundColor: alpha(theme.palette.info.main, 0.1),
                                      color: theme.palette.info.main,
                                      height: 24
                                    }}
                                  />
                                )}
                              </Typography>

                              {isCurrentlyLinked && !isSelected && (
                                <Typography variant="caption" color="error" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                  <MdLink size={14} /> Currently linked (will be unlinked if deselected)
                                </Typography>
                              )}

                              {isCurrentlyLinked && isSelected && (
                                <Typography variant="caption" color="success" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                  <MdCheckCircle size={14} /> Currently linked
                                </Typography>
                              )}
                            </Stack>
                          </Box>

                          {isSelected && (
                            <MdCheckCircle
                              size={24}
                              color={theme.palette.primary.main}
                            />
                          )}
                        </Stack>
                      </CardContent>
                    </Card>
                  );
                })}
              </Stack>
            </FormGroup>
          )}

          {/* Summary */}
          {!fiscalYearsLoading && selectedFiscalYears.length > 0 && (
            <Paper sx={{ p: 2, backgroundColor: alpha(theme.palette.primary.main, 0.05), border: `1px solid ${theme.palette.primary.main}` }}>
              <Typography variant="body2" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <MdCalendarToday size={18} color={theme.palette.primary.main} />
                <strong>{selectedFiscalYears.length} fiscal year(s) selected</strong>
              </Typography>
            </Paper>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 3, backgroundColor: "#ffffff", borderTop: "1px solid #e0e0e0" }}>
        <Button onClick={handleClose} variant="outlined" disabled={isLoading}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={isLoading || !hasChanges}
          sx={{
            background: `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${theme.palette.secondary.main} 90%)`,
            boxShadow: `0 3px 5px 2px ${alpha(theme.palette.primary.main, 0.3)}`
          }}
        >
          {isLoading ? (
            <CircularProgress size={20} sx={{ mr: 1 }} />
          ) : (
            "Save Links"
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LinkCompensationToFiscalYearsDialog;