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
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Chip,
  CircularProgress,
  Alert,
  Divider,
  Card,
  CardContent,
  Grid,
  Radio,
  FormControlLabel,
  useTheme,
  alpha
} from "@mui/material";
import {
  MdAddCircle,
  MdContentCopy,
  MdArrowForward,
  MdCheck
} from "react-icons/md";
import { useQuery } from "@tanstack/react-query";
import api from "../../config/api";
import CompensationSettingsDialogForm from "./CompensationSettingsForm";
import { toast } from "react-hot-toast";

/**
 * Enhanced Compensation Settings Dialog
 * Provides 2-step flow:
 * Step 1: Choose "Create New" or "Assign from Existing"
 * Step 2: If "Assign", select source compensation to copy
 */
const CompensationSettingsDialogEnhanced = ({
  open,
  onClose,
  fiscalYear,
  editData,
  onSaved
}) => {
  const theme = useTheme();
  const [step, setStep] = useState(1); // Step 1: Choose mode, Step 2: Select source
  const [mode, setMode] = useState("create"); // 'create' or 'assign'
  const [selectedSource, setSelectedSource] = useState(null);
  const [showFormDialog, setShowFormDialog] = useState(false);

  // If editing existing compensation, skip the modal and show form directly
  useEffect(() => {
    if (editData && editData._id) {
      setShowFormDialog(true);
      setStep(2);
    } else {
      setStep(1);
      setMode("create");
      setSelectedSource(null);
    }
  }, [editData, open]);

  // Fetch available compensation settings to copy from
  const { data: compensationList = [], isLoading } = useQuery({
    queryKey: ["compensation-list"],
    queryFn: async () => {
      try {
        const response = await api.get("/settings");
        // Filter to only get compensation settings with data
        return (response.data?.settings || []).filter(
          (s) =>
            s.PERA !== undefined ||
            s.philhealthPremium !== undefined ||
            s.gsisPremium !== undefined
        );
      } catch (error) {
        console.error("Failed to fetch compensation settings:", error);
        return [];
      }
    },
    enabled: open && mode === "assign"
  });

  const handleModeSelect = (selectedMode) => {
    setMode(selectedMode);
    if (selectedMode === "create") {
      setShowFormDialog(true);
      setStep(2);
    } else {
      setStep(2); // Go to source selection
    }
  };

  const handleSourceSelect = (source) => {
    setSelectedSource(source);
  };

  const handleAssignCompensation = () => {
    if (!selectedSource) {
      toast.error("Please select a compensation template to copy from");
      return;
    }

    // Create a copy of the selected compensation for the new fiscal year
    const compensationData = {
      ...selectedSource,
      _id: undefined, // Remove ID to create new record
      fiscalYear: fiscalYear,
      isActive: false, // New assignments start as inactive
      createdAt: undefined,
      updatedAt: undefined
    };

    // Pass as initial data to form
    setShowFormDialog(true);
  };

  const handleFormClose = () => {
    setShowFormDialog(false);
    if (onSaved) {
      onSaved();
    }
    handleDialogClose();
  };

  const handleDialogClose = () => {
    setStep(1);
    setMode("create");
    setSelectedSource(null);
    setShowFormDialog(false);
    onClose();
  };

  // If in form edit mode, show form directly
  if (editData && editData._id && showFormDialog) {
    return (
      <CompensationSettingsDialogForm
        open={showFormDialog}
        onClose={handleFormClose}
        fiscalYear={fiscalYear}
        editData={editData}
        onSaved={handleFormClose}
      />
    );
  }

  // Step 1: Choose mode
  if (step === 1) {
    return (
      <Dialog
        open={open}
        onClose={handleDialogClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: "0 20px 40px rgba(0,0,0,0.1)",
            overflow: "hidden"
          }
        }}
      >
        <DialogTitle
          sx={{
            background: "linear-gradient(135deg, #264524 0%, #375e38 100%)",
            color: "white",
            py: 3
          }}
        >
          <Typography variant="h6" fontWeight="bold" component="div">
            Add Compensation Settings
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9, mt: 1 }}>
            Choose how to set up compensation for this fiscal year
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ p: 3, backgroundColor: "#f8f9fa" }}>
          <Stack spacing={2}>
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                You can either create new compensation settings from scratch or
                copy from an existing fiscal year.
              </Typography>
            </Alert>

            {/* Option 1: Create New */}
            <Card
              onClick={() => handleModeSelect("create")}
              sx={{
                cursor: "pointer",
                border: mode === "create" ? `2px solid #264524` : "1px solid #e0e0e0",
                transition: "all 0.3s ease",
                "&:hover": {
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  transform: "translateY(-2px)"
                },
                backgroundColor: mode === "create" ? alpha("#264524", 0.05) : "white"
              }}
            >
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="flex-start">
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      backgroundColor: "#264524",
                      color: "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1.5rem",
                      minWidth: 50,
                      minHeight: 50
                    }}
                  >
                    <MdAddCircle />
                  </Box>
                  <Box flex={1}>
                    <Typography variant="subtitle1" fontWeight="bold">
                      Create New Settings
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      Set up compensation rates from scratch. You can use prefilled values
                      from the previous fiscal year if available.
                    </Typography>
                  </Box>
                  <Radio checked={mode === "create"} />
                </Stack>
              </CardContent>
            </Card>

            {/* Option 2: Assign from Existing */}
            <Card
              onClick={() => handleModeSelect("assign")}
              sx={{
                cursor: "pointer",
                border: mode === "assign" ? `2px solid #264524` : "1px solid #e0e0e0",
                transition: "all 0.3s ease",
                "&:hover": {
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  transform: "translateY(-2px)"
                },
                backgroundColor: mode === "assign" ? alpha("#264524", 0.05) : "white"
              }}
            >
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="flex-start">
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      backgroundColor: "#264524",
                      color: "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1.5rem",
                      minWidth: 50,
                      minHeight: 50
                    }}
                  >
                    <MdContentCopy />
                  </Box>
                  <Box flex={1}>
                    <Typography variant="subtitle1" fontWeight="bold">
                      Copy from Existing
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      Reuse compensation settings from another fiscal year. This creates
                      an independent copy for the new fiscal year.
                    </Typography>
                    {compensationList.length > 0 && (
                      <Chip
                        label={`${compensationList.length} available`}
                        size="small"
                        sx={{ mt: 1, backgroundColor: alpha("#264524", 0.1) }}
                      />
                    )}
                  </Box>
                  <Radio checked={mode === "assign"} />
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 3, backgroundColor: "#ffffff" }}>
          <Button onClick={handleDialogClose} variant="outlined">
            Cancel
          </Button>
          <Button
            onClick={() => handleModeSelect(mode)}
            variant="contained"
            endIcon={<MdArrowForward />}
            sx={{
              background: "linear-gradient(45deg, #264524 30%, #375e38 90%)",
              boxShadow: "0 3px 5px 2px rgba(38, 69, 36, 0.3)"
            }}
          >
            Next
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  // Step 2a: If mode is "create", show form
  if (step === 2 && mode === "create") {
    return (
      <CompensationSettingsDialogForm
        open={true}
        onClose={handleFormClose}
        fiscalYear={fiscalYear}
        editData={null}
        onSaved={handleFormClose}
      />
    );
  }

  // Step 2b: If mode is "assign", show source selection
  if (step === 2 && mode === "assign") {
    return (
      <Dialog
        open={open}
        onClose={handleDialogClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: "0 20px 40px rgba(0,0,0,0.1)",
            overflow: "hidden"
          }
        }}
      >
        <DialogTitle
          sx={{
            background: "linear-gradient(135deg, #264524 0%, #375e38 100%)",
            color: "white",
            py: 3
          }}
        >
          <Typography variant="h6" fontWeight="bold" component="div">
            Select Template to Copy
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9, mt: 1 }}>
            Choose an existing compensation setting to duplicate
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ p: 0, backgroundColor: "#f8f9fa" }}>
          {isLoading ? (
            <Box sx={{ p: 3, display: "flex", justifyContent: "center" }}>
              <CircularProgress />
            </Box>
          ) : compensationList.length === 0 ? (
            <Box sx={{ p: 3 }}>
              <Alert severity="warning">
                No existing compensation settings found. Please create one first.
              </Alert>
            </Box>
          ) : (
            <List sx={{ p: 0 }}>
              {compensationList.map((comp, index) => (
                <div key={comp._id || index}>
                  <ListItemButton
                    selected={selectedSource?._id === comp._id}
                    onClick={() => handleSourceSelect(comp)}
                    sx={{
                      borderLeft:
                        selectedSource?._id === comp._id ? `4px solid #264524` : "4px solid transparent",
                      backgroundColor:
                        selectedSource?._id === comp._id
                          ? alpha("#264524", 0.05)
                          : "transparent",
                      "&:hover": {
                        backgroundColor: alpha("#264524", 0.08)
                      },
                      p: 2
                    }}
                  >
                    <Stack sx={{ width: "100%" }} spacing={1}>
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <Typography
                          variant="subtitle1"
                          fontWeight="bold"
                          color="#264524"
                        >
                          FY {comp.fiscalYear}
                        </Typography>
                        <Stack direction="row" spacing={1}>
                          {comp.budgetType && (
                            <Chip
                              label={comp.budgetType}
                              size="small"
                              variant="outlined"
                            />
                          )}
                          {comp.isActive && (
                            <Chip
                              icon={<MdCheck />}
                              label="Active"
                              size="small"
                              color="success"
                            />
                          )}
                        </Stack>
                      </Stack>
                      <Stack
                        direction="row"
                        spacing={2}
                        sx={{ opacity: 0.7, fontSize: "0.875rem" }}
                      >
                        <Typography variant="body2">
                          PERA: ₱{(comp.PERA || 0).toLocaleString()}
                        </Typography>
                        <Typography variant="body2">
                          PhilHealth: {((comp.philhealthPremium || 0) * 100).toFixed(
                            1
                          )}%
                        </Typography>
                        <Typography variant="body2">
                          GSIS: {((comp.gsisPremium || 0) * 100).toFixed(1)}%
                        </Typography>
                      </Stack>
                    </Stack>
                  </ListItemButton>
                  {index < compensationList.length - 1 && <Divider />}
                </div>
              ))}
            </List>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 3, backgroundColor: "#ffffff" }}>
          <Button onClick={() => setStep(1)} variant="outlined">
            Back
          </Button>
          <Button onClick={handleDialogClose} variant="outlined">
            Cancel
          </Button>
          <Button
            onClick={handleAssignCompensation}
            disabled={!selectedSource}
            variant="contained"
            sx={{
              background: "linear-gradient(45deg, #264524 30%, #375e38 90%)",
              boxShadow: "0 3px 5px 2px rgba(38, 69, 36, 0.3)"
            }}
          >
            Copy & Edit
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  return null;
};

export default CompensationSettingsDialogEnhanced;