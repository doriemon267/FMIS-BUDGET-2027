import React, { useState } from "react";
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  TextField,
  Typography,
  Box,
  Chip,
  Stack,
  useTheme,
  alpha,
  Alert,
  FormControlLabel,
  Switch,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { toast } from "react-hot-toast";
import { IoMdSave } from "react-icons/io";
import {
  MdCalendarToday,
  MdAccountBalance,
  MdDateRange
} from "react-icons/md";
import * as yup from "yup";
import api from "../../config/api";
import BudgetPeriodsManager from "./BudgetPeriodsManager";
import RegionSelector from "./RegionSelector";

/**
 * Enhanced Settings Dialog for Fiscal Year Configuration
 * ONLY handles fiscal year settings - NO compensation!
 * Compensation is managed separately via CompensationSettingsPanel
 */

const enhancedSchema = yup.object().shape({
  fiscalYear: yup
    .string()
    .required("Fiscal Year is required")
    .matches(/^\d{4}$/, "Fiscal Year must be a 4-digit year"),
  budgetType: yup
    .string()
    .required("Budget Type is required")
    .oneOf(["Initial", "GAA", "NEP", "Supplemental"], "Invalid budget type"),
  applicableRegions: yup
    .array()
    .min(1, "At least one region must be selected")
    .required("Regions are required"),
  budgetPeriods: yup
    .array()
    .min(1, "At least one budget period is required")
    .test("dates-valid", "Invalid period dates", function (periods) {
      if (!periods) return true;
      for (let period of periods) {
        if (new Date(period.startDate) >= new Date(period.dueDate)) {
          return false;
        }
      }
      return true;
    }),
  isActive: yup.boolean()
});

const AddSettingsDialog_Enhanced = ({ row, onCloseDialog }) => {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(true);
  const queryClient = useQueryClient();
  const isEditing = Boolean(row && row._id);

  // Fetch regions from database
  const { data: regionsData = [] } = useQuery({
    queryKey: ["regions"],
    queryFn: async () => {
      const response = await api.get("/api/regions");
      // Transform region data to match RegionSelector format
      return [
        { id: "All", name: "NIA-Wide (All Regions)" },
        ...(response.data || []).map((region) => ({
          id: region._id || region.Region,
          name: region.Region
        }))
      ];
    }
  });

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isValid }
  } = useForm({
    resolver: yupResolver(enhancedSchema),
    mode: "onChange",
    defaultValues: {
      fiscalYear: row?.fiscalYear || new Date().getFullYear().toString(),
      budgetType: row?.budgetType || "Initial",
      applicableRegions: row?.applicableRegions || ["All"],
      budgetPeriods: row?.budgetPeriods || [
        {
          periodName: "Phase 1",
          startDate: "",
          dueDate: "",
          isActive: true
        }
      ],
      isActive: row?.isActive ?? true
    }
  });

  const watchIsActive = watch("isActive");

  const mutation = useMutation({
    mutationFn: async (data) => {
      try {
        // Use the new enhanced endpoint for creating/updating with regions and periods
        const url = isEditing
          ? `/settings/${row._id}`
          : "/settings/enhanced/create";
        const methodFn = isEditing ? api.put : api.post;

        const formattedData = {
          fiscalYear: data.fiscalYear,
          budgetType: data.budgetType,
          applicableRegions: data.applicableRegions,
          budgetPeriods: data.budgetPeriods,
          isActive: data.isActive
        };

        const response = await methodFn(url, formattedData);
        return response.data.message || "Settings saved successfully";
      } catch (error) {
        console.error("[AddSettingsDialog_Enhanced] API error:", error);
        throw error;
      }
    },
    onSuccess: (message) => {
      queryClient.invalidateQueries(["settings"]);
      toast.success(message);
      handleClose();
    },
    onError: (error) => {
      console.error("[AddSettingsDialog_Enhanced] Mutation failed:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to save settings";
      toast.error(errorMessage);
    }
  });

  const handleClose = () => {
    setIsOpen(false);
    reset();
    if (onCloseDialog) {
      onCloseDialog();
    }
  };

  const onSubmit = async (data) => {
    mutation.mutate(data);
  };

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      maxWidth="lg"
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
          py: 3,
          position: "relative"
        }}
      >
        <Box>
          <Typography variant="h6" fontWeight="bold" component="div">
            {isEditing
              ? "Edit Fiscal Year Settings"
              : "Create New Fiscal Year Settings"}
          </Typography>
          <Typography
            variant="body2"
            sx={{ opacity: 0.9, mt: 1 }}
            component="div"
          >
            Configure fiscal year periods, budget types, and applicable regions
          </Typography>
          {isEditing && (
            <Chip
              label={`Fiscal Year: ${row.fiscalYear}`}
              size="small"
              sx={{
                position: "absolute",
                top: 16,
                right: 16,
                backgroundColor: "rgba(255,255,255,0.2)",
                color: "white"
              }}
            />
          )}
        </Box>
      </DialogTitle>

      <DialogContent
        dividers
        sx={{
          p: 0,
          backgroundColor: "#f8f9fa"
        }}
      >
        <Box sx={{ p: 3 }}>
          {/* Alert: Compensation is NOT auto-created */}
          <Alert severity="warning" sx={{ mb: 3 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>⚠️ Important:</strong> When you create this cutoff, it will <strong>NOT automatically get compensation</strong>.
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              To add compensation settings (PERA, allowances, PhilHealth, etc.):
            </Typography>
            <Typography variant="caption" component="div" sx={{ ml: 2 }}>
              1️⃣ Create this cutoff here<br/>
              2️⃣ Go to <strong>"Compensation Management"</strong> and link existing compensation settings to it
            </Typography>
          </Alert>

          {/* Basic Settings Section */}
          <Accordion
            defaultExpanded
            sx={{
              mb: 2,
              borderRadius: 2,
              border: "1px solid #e0e0e0",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              "&:before": { display: "none" },
              "&.Mui-expanded": {
                margin: "0 0 16px 0"
              }
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{
                backgroundColor: "#f8f9fa",
                borderRadius: "8px 8px 0 0",
                minHeight: 56,
                "&.Mui-expanded": {
                  minHeight: 56
                },
                "& .MuiAccordionSummary-content": {
                  alignItems: "center"
                }
              }}
            >
              <Stack direction="row" alignItems="center" spacing={2}>
                <Box
                  sx={{
                    color: "#264524",
                    fontSize: "1.5rem",
                    display: "flex",
                    alignItems: "center"
                  }}
                >
                  <MdCalendarToday />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 600, color: "#264524" }}>
                  Basic Settings
                </Typography>
              </Stack>
            </AccordionSummary>

            <AccordionDetails sx={{ p: 3, backgroundColor: "#ffffff" }}>
              <Grid container spacing={3}>
                {/* Fiscal Year */}
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="fiscalYear"
                    control={control}
                    render={({ field }) => (
                      <FormControl fullWidth error={!!errors.fiscalYear}>
                        <InputLabel>Fiscal Year</InputLabel>
                        <Select
                          {...field}
                          label="Fiscal Year"
                          disabled={isEditing}
                        >
                          <MenuItem value="" disabled>
                            Select a fiscal year
                          </MenuItem>
                          {Array.from({ length: 15 }, (_, i) => {
                            const year = new Date().getFullYear() - 2 + i;
                            return (
                              <MenuItem key={year} value={year.toString()}>
                                FY {year}
                              </MenuItem>
                            );
                          })}
                        </Select>
                        {errors.fiscalYear && (
                          <Typography variant="caption" sx={{ color: '#d32f2f', mt: 0.5, display: 'block' }}>
                            {errors.fiscalYear.message}
                          </Typography>
                        )}
                      </FormControl>
                    )}
                  />
                </Grid>

                {/* Budget Type */}
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="budgetType"
                    control={control}
                    render={({ field }) => (
                      <FormControl fullWidth error={!!errors.budgetType}>
                        <InputLabel>Budget Type</InputLabel>
                        <Select
                          {...field}
                          label="Budget Type"
                        >
                          <MenuItem value="" disabled>
                            Select a budget type
                          </MenuItem>
                          {["Initial", "GAA", "NEP", "Supplemental"].map((type) => (
                            <MenuItem key={type} value={type}>
                              {type}
                            </MenuItem>
                          ))}
                        </Select>
                        {errors.budgetType && (
                          <Typography variant="caption" sx={{ color: '#d32f2f', mt: 0.5, display: 'block' }}>
                            {errors.budgetType.message}
                          </Typography>
                        )}
                      </FormControl>
                    )}
                  />
                </Grid>

                {/* Active Status */}
                <Grid item xs={12}>
                  <Controller
                    name="isActive"
                    control={control}
                    render={({ field }) => (
                      <FormControlLabel
                        control={
                          <Switch
                            {...field}
                            checked={watchIsActive}
                            sx={{
                              "& .MuiSwitch-switchBase.Mui-checked": {
                                color: theme.palette.success.main
                              }
                            }}
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body2">
                              {watchIsActive ? "✓ Active" : "◯ Inactive"}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Active fiscal years are used for budget submissions
                            </Typography>
                          </Box>
                        }
                      />
                    )}
                  />
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          {/* Budget Periods Section */}
          <Accordion
            defaultExpanded
            sx={{
              mb: 2,
              borderRadius: 2,
              border: "1px solid #e0e0e0",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              "&:before": { display: "none" },
              "&.Mui-expanded": {
                margin: "0 0 16px 0"
              }
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{
                backgroundColor: "#f8f9fa",
                borderRadius: "8px 8px 0 0",
                minHeight: 56,
                "&.Mui-expanded": {
                  minHeight: 56
                },
                "& .MuiAccordionSummary-content": {
                  alignItems: "center"
                }
              }}
            >
              <Stack direction="row" alignItems="center" spacing={2}>
                <Box
                  sx={{
                    color: "#264524",
                    fontSize: "1.5rem",
                    display: "flex",
                    alignItems: "center"
                  }}
                >
                  <MdDateRange />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 600, color: "#264524" }}>
                  Budget Periods
                </Typography>
              </Stack>
            </AccordionSummary>

            <AccordionDetails sx={{ p: 3, backgroundColor: "#ffffff" }}>
              <BudgetPeriodsManager
                control={control}
                watch={watch}
                setValue={setValue}
                errors={errors}
              />
              {errors.budgetPeriods && (
                <Typography variant="caption" color="error" sx={{ mt: 1, display: "block" }}>
                  {errors.budgetPeriods.message}
                </Typography>
              )}
            </AccordionDetails>
          </Accordion>

          {/* Applicable Regions Section */}
          <Accordion
            defaultExpanded
            sx={{
              mb: 2,
              borderRadius: 2,
              border: "1px solid #e0e0e0",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              "&:before": { display: "none" },
              "&.Mui-expanded": {
                margin: "0 0 16px 0"
              }
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{
                backgroundColor: "#f8f9fa",
                borderRadius: "8px 8px 0 0",
                minHeight: 56,
                "&.Mui-expanded": {
                  minHeight: 56
                },
                "& .MuiAccordionSummary-content": {
                  alignItems: "center"
                }
              }}
            >
              <Stack direction="row" alignItems="center" spacing={2}>
                <Box
                  sx={{
                    color: "#264524",
                    fontSize: "1.5rem",
                    display: "flex",
                    alignItems: "center"
                  }}
                >
                  <MdAccountBalance />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 600, color: "#264524" }}>
                  Applicable Regions
                </Typography>
              </Stack>
            </AccordionSummary>

            <AccordionDetails sx={{ p: 3, backgroundColor: "#ffffff" }}>
              <RegionSelector
                control={control}
                watch={watch}
                setValue={setValue}
                errors={errors}
                availableRegions={regionsData}
              />
              {errors.applicableRegions && (
                <Typography variant="caption" color="error" sx={{ mt: 1, display: "block" }}>
                  {errors.applicableRegions.message}
                </Typography>
              )}
            </AccordionDetails>
          </Accordion>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2, backgroundColor: "#f8f9fa" }}>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit(onSubmit)}
          disabled={mutation.isPending || !isValid}
          startIcon={
            mutation.isPending ? (
              <CircularProgress size={20} />
            ) : (
              <IoMdSave />
            )
          }
        >
          {mutation.isPending
            ? "Saving..."
            : isEditing
            ? "Update Settings"
            : "Create Settings"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddSettingsDialog_Enhanced;