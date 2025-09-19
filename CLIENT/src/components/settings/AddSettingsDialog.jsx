import React, { useState } from "react";
import { NumericFormat } from "react-number-format";
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
  Divider,
  FormControlLabel,
  Grid,
  MenuItem,
  Switch,
  TextField,
  Typography,
  Box,
  Chip,
  Stack,
  useTheme,
  alpha
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { toast } from "react-hot-toast";
import { IoMdAdd, IoMdSave } from "react-icons/io";
import {
  MdCalendarToday,
  MdAccountBalance,
  MdDateRange,
  MdSettings
} from "react-icons/md";
import * as yup from "yup";
import api from "../../config/api";
// Component for numeric input formatting
const NumberFormatCustom = React.forwardRef(function NumberFormatCustom(
  props,
  ref
) {
  const { onChange, ...other } = props;
  return (
    <NumericFormat
      {...other}
      getInputRef={ref}
      thousandSeparator
      decimalScale={2}
      fixedDecimalScale
      onValueChange={(values) => {
        onChange(values.value);
      }}
    />
  );
});

// Updated EarnedLeavesInput component
const EarnedLeavesInput = React.forwardRef(function EarnedLeavesInput(
  { value, onChange, ...props },
  ref
) {
  return (
    <NumericFormat
      {...props}
      value={value}
      getInputRef={ref}
      customInput={TextField}
      decimalScale={8} // Allow up to 8 decimal places
      fixedDecimalScale={false} // Allow variable decimal places
      allowNegative={false}
      valueIsNumericString={false} // Ensure numeric value
      onValueChange={(values) => {
        onChange(values.floatValue || 0); // Pass numeric value to Controller
      }}
      fullWidth
    />
  );
});

// Define schema with updated earnedLeaves validation
const schema = yup.object().shape({
  fiscalYear: yup.string().required("Fiscal Year is required"),
  startDate: yup.date().required("Start Date is required"),
  dueDate: yup.date().required("Due Date is required"),
  budgetType: yup.string().required("Budget Type is required"),
  hazardPay: yup.number().min(0),
  subsistenceAllowance: yup.number().min(0),
  honoraria: yup.number().min(0),
  PERA: yup.number().min(0),
  uniformAllowance: yup.number().min(0),
  productivityIncentive: yup.number().min(0),
  medicalAllowance: yup.number().min(0),
  childrenAllowance: yup.number().min(0),
  meal: yup.number().min(0),
  cashGift: yup.number().min(0),
  gsisPremium: yup.number().min(0),
  philhealthPremium: yup.number().min(0),
  pagibigPremium: yup.number().min(0),
  employeeCompensation: yup.number().min(0),
  overtimeRate: yup.number().min(0),
  weekdayMultiplier: yup.number().min(0),
  weekendMultiplier: yup.number().min(0),
  subsistenceAllowanceRate: yup.number().min(0),
  earnedLeaves: yup
    .number()
    .min(0)
    .test(
      "maxDecimalPlaces",
      "Earned Leaves cannot have more than 8 decimal places",
      (value) => !value || Number(value.toFixed(8)) === value
    ),
  isActive: yup.boolean().default(true),
  loyaltyPay: yup.object({
    baseYears: yup.number(),
    baseAmount: yup.number(),
    succeedingInterval: yup.number(),
    succeedingAmount: yup.number(),
  }),
  subsistenceAllowanceSTRates: yup.object({
    highRisk: yup.object({
      fifteenOrMoreDays: yup.number().min(0),
      eightToFourteenDays: yup.number().min(0),
      lessThanEightDays: yup.number().min(0),
    }),
    lowRisk: yup.object({
      fifteenOrMoreDays: yup.number().min(0),
      eightToFourteenDays: yup.number().min(0),
      lessThanEightDays: yup.number().min(0),
    }),
  }),
});

const SettingsDialog = ({ row, onCloseDialog }) => {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [isActive, setIsActive] = useState(row?.isActive ?? true);
  const queryClient = useQueryClient();
  const isEditing = Boolean(row);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      fiscalYear: row?.fiscalYear || "",
      startDate: row?.startDate
        ? new Date(row.startDate).toISOString().split("T")[0]
        : "",
      dueDate: row?.dueDate
        ? new Date(row.dueDate).toISOString().split("T")[0]
        : "",
      budgetType: row?.budgetType || "",
      hazardPay: row?.hazardPay || 0,
      subsistenceAllowance: row?.subsistenceAllowance || 0,
      honoraria: row?.honoraria || 0,
      PERA: row?.PERA || 0,
      uniformAllowance: row?.uniformAllowance || 0,
      productivityIncentive: row?.productivityIncentive || 0,
      medicalAllowance: row?.medicalAllowance || 200, // Default to 200 pesos per month per dependent
      childrenAllowance: row?.childrenAllowance || 0,
      meal: row?.meal || 200, // Default to 200 pesos per day for eligible employees
      cashGift: row?.cashGift || 0,
      gsisPremium: row?.gsisPremium || 0,
      philhealthPremium: row?.philhealthPremium || 0,
      pagibigPremium: row?.pagibigPremium || 0,
      employeeCompensation: row?.employeeCompensation || 0,
      overtimeRate: row?.overtimeRate || 100,
      weekdayMultiplier: row?.weekdayMultiplier || 1.25,
      weekendMultiplier: row?.weekendMultiplier || 1.5,
      subsistenceAllowanceRate: row?.subsistenceAllowanceRate || 0,
      earnedLeaves: row?.earnedLeaves || 0,
      loyaltyPay: {
        baseYears: row?.loyaltyPay?.baseYears ?? 0,
        baseAmount: row?.loyaltyPay?.baseAmount ?? 0,
        succeedingInterval: row?.loyaltyPay?.succeedingInterval ?? 0,
        succeedingAmount: row?.loyaltyPay?.succeedingAmount ?? 0,
      },
      subsistenceAllowanceSTRates: {
        highRisk: {
          fifteenOrMoreDays:
            row?.subsistenceAllowanceSTRates?.highRisk?.fifteenOrMoreDays ||
            0.3,
          eightToFourteenDays:
            row?.subsistenceAllowanceSTRates?.highRisk?.eightToFourteenDays ||
            0.23,
          lessThanEightDays:
            row?.subsistenceAllowanceSTRates?.highRisk?.lessThanEightDays ||
            0.15,
        },
        lowRisk: {
          fifteenOrMoreDays:
            row?.subsistenceAllowanceSTRates?.lowRisk?.fifteenOrMoreDays ||
            0.15,
          eightToFourteenDays:
            row?.subsistenceAllowanceSTRates?.lowRisk?.eightToFourteenDays ||
            0.12,
          lessThanEightDays:
            row?.subsistenceAllowanceSTRates?.lowRisk?.lessThanEightDays || 0.1,
        },
      },
    },
  });

  const mutation = useMutation({
    mutationFn: async (data) => {
      const url = isEditing ? `/settings/${row._id}` : "/settings";
      const methodFn = isEditing ? api.put : api.post;

      try {
        // Ensure data is properly formatted
        const formattedData = {
          ...data,
          // Convert date strings to ISO format if they're not already
          startDate: data.startDate ? new Date(data.startDate).toISOString() : data.startDate,
          dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : data.dueDate,
        };
        
        const response = await methodFn(url, formattedData);
        return response.data.message || "Settings saved successfully";
      } catch (error) {
        console.error("[SettingsDialog] API error ←", error.response || error);
        throw error;
      }
    },
    onSuccess: (message) => {
      queryClient.invalidateQueries(["settings"]);
      toast.success(message);
      handleClose();
    },
    onError: (error) => {
      console.error("[SettingsDialog] ❌ Mutation failed:", error);
      const errorMessage = error.response?.data?.message || "Failed to save settings";
      toast.error(errorMessage);
    },
  });

  const handleClose = () => {
    setIsOpen(false);
    reset();
    if (onCloseDialog) {
      onCloseDialog();
    }
  };

  const handleAdvancedOpen = () => {
    setAdvancedOpen(true);
  };

  const handleAdvancedClose = () => {
    setAdvancedOpen(false);
  };

  const onSubmit = async (data) => {
    data.isActive = isActive;
    mutation.mutate(data, {
      onSuccess: (message) => {
        queryClient.invalidateQueries(["settings"]);
        toast.success(message);
        handleClose();
      },
      onError: (error) => {
        console.error("[SettingsDialog] API error:", error.response || error);
        toast.error("Failed to save settings; see console.");
      },
    });
  };

  return (
    <>
      <Dialog
        open={isOpen}
        onClose={handleClose}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
            overflow: 'hidden'
          }
        }}
      >
        <DialogTitle
          sx={{
            background: 'linear-gradient(135deg, #264524 0%, #375e38 100%)',
            color: 'white',
            py: 3,
            position: 'relative'
          }}
        >
          <Box>
            <Typography variant="h6" fontWeight="bold" component="div">
              {isEditing ? "Edit Fiscal Year Settings" : "Add New Fiscal Year Settings"}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9, mt: 1 }} component="div">
              Configure fiscal year periods, budget types, and cut-off dates
            </Typography>
            {isEditing && (
              <Chip
                label={`Fiscal Year: ${row.fiscalYear}`}
                size="small"
                sx={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  color: 'white'
                }}
              />
            )}
          </Box>
        </DialogTitle>
        <DialogContent
          dividers
          sx={{
            p: 0,
            backgroundColor: '#f8f9fa'
          }}
        >
          <Box sx={{ p: 3 }}>
          <Accordion
            defaultExpanded
            sx={{
              mb: 2,
              borderRadius: 2,
              border: '1px solid #e0e0e0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              '&:before': { display: 'none' },
              '&.Mui-expanded': {
                margin: '0 0 16px 0'
              }
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{
                backgroundColor: '#f8f9fa',
                borderRadius: '8px 8px 0 0',
                minHeight: 56,
                '&.Mui-expanded': {
                  minHeight: 56
                },
                '& .MuiAccordionSummary-content': {
                  alignItems: 'center'
                }
              }}
            >
              <Stack direction="row" alignItems="center" spacing={2}>
                <Box
                  sx={{
                    color: '#264524',
                    fontSize: '1.5rem',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <MdCalendarToday />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 600, color: '#264524' }}>
                  Fiscal Year Details
                </Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 3, backgroundColor: '#ffffff' }}>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="fiscalYear"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Fiscal Year"
                        fullWidth
                        variant="outlined"
                        error={!!errors.fiscalYear}
                        helperText={errors.fiscalYear?.message}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            '&:hover fieldset': {
                              borderColor: '#264524',
                            },
                            '&.Mui-focused fieldset': {
                              borderColor: '#264524',
                            },
                          },
                          '& .MuiInputLabel-root.Mui-focused': {
                            color: '#264524',
                          },
                        }}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="budgetType"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        select
                        {...field}
                        label="Budget Type"
                        fullWidth
                        variant="outlined"
                        error={!!errors.budgetType}
                        helperText={errors.budgetType?.message}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            '&:hover fieldset': {
                              borderColor: '#264524',
                            },
                            '&.Mui-focused fieldset': {
                              borderColor: '#264524',
                            },
                          },
                          '& .MuiInputLabel-root.Mui-focused': {
                            color: '#264524',
                          },
                        }}
                      >
                        <MenuItem value="Initial">Initial</MenuItem>
                        <MenuItem value="NEP">NEP</MenuItem>
                        <MenuItem value="GAA">GAA</MenuItem>
                      </TextField>
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="startDate"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        type="date"
                        label="Start Date"
                        fullWidth
                        variant="outlined"
                        InputLabelProps={{ shrink: true }}
                        error={!!errors.startDate}
                        helperText={errors.startDate?.message}
                        inputProps={{
                          min: new Date().toISOString().split("T")[0],
                        }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            '&:hover fieldset': {
                              borderColor: '#264524',
                            },
                            '&.Mui-focused fieldset': {
                              borderColor: '#264524',
                            },
                          },
                          '& .MuiInputLabel-root.Mui-focused': {
                            color: '#264524',
                          },
                        }}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="dueDate"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        type="date"
                        label="Due Date"
                        fullWidth
                        variant="outlined"
                        InputLabelProps={{ shrink: true }}
                        error={!!errors.dueDate}
                        helperText={errors.dueDate?.message}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            '&:hover fieldset': {
                              borderColor: '#264524',
                            },
                            '&.Mui-focused fieldset': {
                              borderColor: '#264524',
                            },
                          },
                          '& .MuiInputLabel-root.Mui-focused': {
                            color: '#264524',
                          },
                        }}
                      />
                    )}
                  />
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          <Divider sx={{ my: 3 }} />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body1" fontWeight="medium">
              Status:
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={isActive}
                  onChange={() => setIsActive(!isActive)}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': {
                      color: '#264524',
                    },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      backgroundColor: '#264524',
                    },
                  }}
                />
              }
              label={
                <Chip
                  label={isActive ? "Active" : "Inactive"}
                  color={isActive ? "success" : "default"}
                  variant="filled"
                  size="small"
                />
              }
            />
          </Box>
          </Box>
        </DialogContent>
        <DialogActions
          sx={{
            p: 3,
            backgroundColor: '#ffffff',
            borderTop: '1px solid #e0e0e0'
          }}
        >
          <Button
            onClick={handleClose}
            variant="outlined"
            sx={{ mr: 2 }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              handleSubmit(onSubmit, (errors) =>
                console.error("[SettingsDialog] ❗ Validation errors:", errors)
              )();
            }}
            variant="contained"
            startIcon={
              mutation.isLoading ? (
                <CircularProgress size={24} />
              ) : isEditing ? (
                <IoMdSave />
              ) : (
                <IoMdAdd />
              )
            }
            disabled={mutation.isLoading}
            sx={{
              background: 'linear-gradient(45deg, #264524 30%, #375e38 90%)',
              boxShadow: '0 3px 5px 2px rgba(38, 69, 36, 0.3)',
              px: 4,
              py: 1.5,
              '&:hover': {
                background: 'linear-gradient(45deg, #1a2f1a 30%, #2a4a2b 90%)',
                transform: 'translateY(-2px)',
                boxShadow: '0 6px 10px 4px rgba(38, 69, 36, 0.3)'
              },
              '&:disabled': {
                background: 'linear-gradient(45deg, #ccc 30%, #999 90%)'
              }
            }}
          >
            {mutation.isLoading ? "Saving..." : isEditing ? "Update Settings" : "Save Settings"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={advancedOpen}
        onClose={handleAdvancedClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Advanced Settings</DialogTitle>
        <DialogContent dividers>
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Compensation</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                {[
                  { name: "PERA", label: "PERA (₱)" },
                  { name: "uniformAllowance", label: "Uniform Allowance (₱)" },
                  {
                    name: "productivityIncentive",
                    label: "Productivity Incentive (₱)",
                  },
                  { name: "medicalAllowance", label: "Medical Allowance (₱)" },
                  { name: "cashGift", label: "Cash Gift (₱)" },
                  { name: "meal", label: "Meal Allowance (₱)" },
                  { name: "earnedLeaves", label: "Earned Leaves", special: true },
                  { name: "courtAppearance", label: "Court Appearance (₱)" },
                ].map(({ name, label, special }) => (
                  <Grid item xs={6} key={name}>
                    
                  </Grid>
                ))}
              </Grid>
            </AccordionDetails>
          </Accordion>

          <Divider sx={{ my: 2 }} />

          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Government Share</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                {[
                  { name: "gsisPremium", label: "GSIS Premium" },
                  { name: "philhealthPremium", label: "PhilHealth Premium" },
                  { name: "pagibigPremium", label: "Pag-IBIG Premium" },
                  {
                    name: "employeeCompensation",
                    label: "Employee Compensation",
                  },
                ].map(({ name, label }) => (
                  <Grid item xs={6} key={name}>
                    <Controller
                      name={name}
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          label={label}
                          fullWidth
                          InputProps={{
                            inputComponent: NumberFormatCustom,
                          }}
                        />
                      )}
                    />
                  </Grid>
                ))}
              </Grid>
            </AccordionDetails>
          </Accordion>

          <Divider sx={{ my: 2 }} />

          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Subsistence Allowance Rate</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Controller
                    name="subsistenceAllowanceRate"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Subsistence Allowance Rate"
                        fullWidth
                        InputProps={{
                          inputComponent: NumberFormatCustom,
                        }}
                        error={!!errors.subsistenceAllowanceRate}
                        helperText={errors.subsistenceAllowanceRate?.message}
                      />
                    )}
                  />
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          <Divider sx={{ my: 2 }} />

          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">
                Subsistence Allowance (S&T) Rates
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" fontWeight="bold">
                    High Risk
                  </Typography>
                </Grid>
                <Grid item xs={4}>
                  <Controller
                    name="subsistenceAllowanceSTRates.highRisk.fifteenOrMoreDays"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="≥15 days"
                        type="number"
                        fullWidth
                        inputProps={{ step: 0.01 }}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={4}>
                  <Controller
                    name="subsistenceAllowanceSTRates.highRisk.eightToFourteenDays"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="8–14 days"
                        type="number"
                        fullWidth
                        inputProps={{ step: 0.01 }}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={4}>
                  <Controller
                    name="subsistenceAllowanceSTRates.highRisk.lessThanEightDays"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="<8 days"
                        type="number"
                        fullWidth
                        inputProps={{ step: 0.01 }}
                      />
                    )}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Typography
                    variant="subtitle2"
                    fontWeight="bold"
                    sx={{ mt: 2 }}
                  >
                    Low Risk
                  </Typography>
                </Grid>
                <Grid item xs={4}>
                  <Controller
                    name="subsistenceAllowanceSTRates.lowRisk.fifteenOrMoreDays"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="≥15 days"
                        type="number"
                        fullWidth
                        inputProps={{ step: 0.01 }}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={4}>
                  <Controller
                    name="subsistenceAllowanceSTRates.lowRisk.eightToFourteenDays"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="8–14 days"
                        type="number"
                        fullWidth
                        inputProps={{ step: 0.01 }}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={4}>
                  <Controller
                    name="subsistenceAllowanceSTRates.lowRisk.lessThanEightDays"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="<8 days"
                        type="number"
                        fullWidth
                        inputProps={{ step: 0.01 }}
                      />
                    )}
                  />
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          <Divider sx={{ my: 2 }} />

          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Overtime Settings</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                {[
                  { name: "overtimeRate", label: "Overtime Rate (₱/hr)" },
                  {
                    name: "weekdayMultiplier",
                    label: "Weekday Multiplier (%)",
                    type: "number",
                    extraProps: { inputProps: { step: 0.01 } },
                  },
                  {
                    name: "weekendMultiplier",
                    label: "Weekend Multiplier (%)",
                    type: "number",
                    extraProps: { inputProps: { step: 0.01 } },
                  },
                ].map(({ name, label, type, extraProps }) => (
                  <Grid item xs={4} key={name}>
                    <Controller
                      name={name}
                      control={control}
                      render={({ field }) =>
                        name === "overtimeRate" ? (
                          <TextField
                            {...field}
                            label={label}
                            fullWidth
                            InputProps={{
                              inputComponent: NumberFormatCustom,
                            }}
                          />
                        ) : (
                          <TextField
                            {...field}
                            label={label}
                            type={type || "number"}
                            fullWidth
                            {...extraProps}
                          />
                        )
                      }
                    />
                  </Grid>
                ))}
              </Grid>
            </AccordionDetails>
          </Accordion>

          <Divider sx={{ my: 2 }} />

          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Loyalty Pay Settings</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Controller
                    name="loyaltyPay.baseYears"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Base Years (e.g. 10)"
                        type="number"
                        fullWidth
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={6}>
                  <Controller
                    name="loyaltyPay.baseAmount"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Base Amount (₱)"
                        fullWidth
                        InputProps={{
                          inputComponent: NumberFormatCustom,
                        }}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={6}>
                  <Controller
                    name="loyaltyPay.succeedingInterval"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Succeeding Interval (e.g. 5 years)"
                        type="number"
                        fullWidth
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={6}>
                  <Controller
                    name="loyaltyPay.succeedingAmount"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Succeeding Amount (₱)"
                        fullWidth
                        InputProps={{
                          inputComponent: NumberFormatCustom,
                        }}
                      />
                    )}
                  />
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          <Divider sx={{ my: 2 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleAdvancedClose} variant="outlined">
            Close Advanced
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default SettingsDialog;
