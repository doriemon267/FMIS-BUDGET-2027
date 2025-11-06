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
  CardContent,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from "@mui/material";
import {
  MdClose,
  MdCheckCircle,
  MdLink,
  MdCalendarToday,
  MdGrade
} from "react-icons/md";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../config/api";
import { toast } from "react-hot-toast";

/**
 * Link RATA to Fiscal Years Dialog
 * Allows user to select multiple fiscal year/budget type combinations for a RATA rate
 */
const LinkRATAToFiscalYearsDialog = ({
  open,
  onClose,
  rataId,
  rataName,
  onSaved
}) => {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [selectedFiscalYears, setSelectedFiscalYears] = useState([]);
  const [currentlyLinked, setCurrentlyLinked] = useState([]);

  // Fetch all fiscal years (Settings records) - get full settings objects
  const { data: fiscalYearsData = [], isLoading: fiscalYearsLoading } = useQuery({
    queryKey: ["fiscalYearsForRata"],
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

  // Fetch which fiscal years are currently linked to this RATA
  useEffect(() => {
    if (open && rataId) {
      fetchCurrentLinks();
    }
  }, [open, rataId]);

  const fetchCurrentLinks = async () => {
    try {
      const response = await api.get(`/ratas/${rataId}/linked-fiscal-years`);
      console.log('🔗 [LinkRATADialog] Linked Fiscal Years Response:', response.data?.linkedFiscalYears);
      const linkedIds = response.data?.linkedFiscalYears?.map(l => {
        // Ensure we're getting the string ID regardless of format
        return typeof l.settingsId === 'object' ? l.settingsId._id : l.settingsId;
      }) || [];
      console.log('🔗 [LinkRATADialog] Extracted Linked IDs:', linkedIds);
      setCurrentlyLinked(linkedIds);
      setSelectedFiscalYears(linkedIds);
    } catch (error) {
      console.error("Failed to fetch linked fiscal years:", error);
    }
  };

  // Link RATA to selected fiscal years
  const linkMutation = useMutation({
    mutationFn: async (fiscalYearIds) => {
      return api.put(`/ratas/${rataId}/link-fiscal-years`, {
        fiscalYearIds
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["ratas"]);
      toast.success("RATA linked to fiscal years successfully");
      handleClose();
      if (onSaved) onSaved();
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to link RATA to fiscal years");
    }
  });

  // Unlink RATA from specific fiscal years
  const unlinkMutation = useMutation({
    mutationFn: async (settingsIds) => {
      const promises = settingsIds.map(settingsId =>
        api.put(`/ratas/${rataId}/unlink-fiscal-year/${settingsId}`)
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["ratas"]);
      toast.success("RATA unlinked from fiscal years successfully");
      handleClose();
      if (onSaved) onSaved();
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to unlink RATA from fiscal years");
    }
  });

  const handleFiscalYearToggle = (fiscalYearId) => {
    setSelectedFiscalYears(prev => {
      const idString = String(fiscalYearId);
      const updated = prev.some(id => String(id) === idString)
        ? prev.filter(id => String(id) !== idString)
        : [...prev, fiscalYearId];
      console.log('🔗 [LinkRATADialog] Selected Fiscal Years:', updated);
      return updated;
    });
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

    // Execute both operations in sequence
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

  // Group fiscal years by budget type for better organization
  const groupedByBudgetType = fiscalYearsData.reduce((acc, fy) => {
    const budgetType = fy.budgetType || "Other";
    if (!acc[budgetType]) acc[budgetType] = [];
    acc[budgetType].push(fy);
    return acc;
  }, {});

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
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
            <MdLink style={{ marginRight: 8, verticalAlign: "middle" }} />
            Link RATA to Fiscal Years
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
            {rataName}
          </Typography>
        </Box>
        <Button
          onClick={handleClose}
          sx={{
            color: "white",
            minWidth: "auto",
            p: 0.5
          }}
          disabled={isLoading}
        >
          <MdClose size={24} />
        </Button>
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        {isLoading && !fiscalYearsData.length ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
            <CircularProgress />
          </Box>
        ) : fiscalYearsData.length === 0 ? (
          <Alert severity="info">
            No fiscal years available. Please create fiscal year settings first.
          </Alert>
        ) : (
          <Stack spacing={3}>
            {/* Instructions */}
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>Select fiscal year/budget type combinations</strong> where this RATA rate should be applied.
                You can reuse the same RATA rate across multiple fiscal years and budget types.
              </Typography>
            </Alert>

            {/* Currently Linked Summary */}
            {currentlyLinked.length > 0 && (
              <Card sx={{ backgroundColor: alpha(theme.palette.success.main, 0.08), border: `1px solid ${alpha(theme.palette.success.main, 0.2)}` }}>
                <CardContent>
                  <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
                    ✅ Currently Linked ({currentlyLinked.length})
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {fiscalYearsData
                      .filter(fy => currentlyLinked.includes(fy._id))
                      .map(fy => (
                        <Chip
                          key={fy._id}
                          icon={<MdCalendarToday />}
                          label={`${fy.fiscalYear} (${fy.budgetType})`}
                          color="success"
                          variant="outlined"
                          size="small"
                        />
                      ))}
                  </Stack>
                </CardContent>
              </Card>
            )}

            {/* Fiscal Years Selection by Budget Type */}
            <Box>
              <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 2 }}>
                📅 Available Fiscal Years
              </Typography>
              <Stack spacing={2}>
                {Object.entries(groupedByBudgetType).map(([budgetType, fiscalYears]) => (
                  <Card key={budgetType} sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.02) }}>
                    <CardContent>
                      <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 2, color: theme.palette.primary.main }}>
                        {budgetType}
                      </Typography>
                      <FormGroup>
                        {fiscalYears.map(fy => (
                          <FormControlLabel
                            key={fy._id}
                            control={
                              <Checkbox
                                checked={selectedFiscalYears.some(id => String(id) === String(fy._id))}
                                onChange={() => handleFiscalYearToggle(fy._id)}
                                disabled={isLoading}
                              />
                            }
                            label={
                              <Typography variant="body2">
                                {fy.fiscalYear} • {new Date(fy.createdAt).toLocaleDateString()}
                              </Typography>
                            }
                          />
                        ))}
                      </FormGroup>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Box>

            {/* Selected Count */}
            {selectedFiscalYears.length > 0 && (
              <Alert severity="success">
                <Typography variant="body2">
                  <strong>{selectedFiscalYears.length}</strong> fiscal year/budget type combination(s) selected
                </Typography>
              </Alert>
            )}
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3, gap: 2 }}>
        <Button
          onClick={handleClose}
          disabled={isLoading}
          variant="outlined"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!hasChanges || isLoading}
          startIcon={isLoading ? <CircularProgress size={20} /> : <MdCheckCircle />}
        >
          {isLoading ? "Saving..." : "Save Changes"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LinkRATAToFiscalYearsDialog;