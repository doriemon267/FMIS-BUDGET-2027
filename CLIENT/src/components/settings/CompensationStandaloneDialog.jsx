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
  TextField,
  CircularProgress,
  Alert,
  Divider,
  Tab,
  Tabs,
  useTheme,
  alpha,
  FormHelperText,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  Select,
  MenuItem
} from "@mui/material";
import {
  MdAddCircle,
  MdClose,
  MdExpandMore
} from "react-icons/md";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { NumericFormat } from "react-number-format";
import api from "../../config/api";
import { toast } from "react-hot-toast";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

// Number format component
const NumberFormatCustom = React.forwardRef(function NumberFormatCustom(props, ref) {
  const { onChange, onBlur, ...other } = props;
  return (
    <NumericFormat
      {...other}
      getInputRef={ref}
      thousandSeparator
      decimalScale={2}
      fixedDecimalScale
      onValueChange={(values) => onChange(values.value)}
      onBlur={(e) => onBlur && onBlur(e)}
    />
  );
});

// Percentage format component
const PercentageFormatCustom = React.forwardRef(function PercentageFormatCustom(props, ref) {
  const { onChange, onBlur, ...other } = props;
  return (
    <NumericFormat
      {...other}
      getInputRef={ref}
      thousandSeparator
      decimalScale={2}
      suffix="%"
      onValueChange={(values) => onChange(values.floatValue / 100)}
      value={props.value * 100}
      onBlur={(e) => onBlur && onBlur(e)}
    />
  );
});

// ✅ High-precision format component (for Earned Leaves - allows up to 7 decimal places)
const HighPrecisionFormatCustom = React.forwardRef(function HighPrecisionFormatCustom(props, ref) {
  const { onChange, onBlur, ...other } = props;
  return (
    <NumericFormat
      {...other}
      getInputRef={ref}
      thousandSeparator
      decimalScale={7}
      fixedDecimalScale={false}
      onValueChange={(values) => onChange(values.value)}
      onBlur={(e) => onBlur && onBlur(e)}
    />
  );
});

// Validation schema - NO fiscal year fields
const compensationSchema = yup.object().shape({
  name: yup.string()
    .required("Compensation name is required")
    .min(3, "Name must be at least 3 characters")
    .max(100, "Name must not exceed 100 characters"),
  description: yup.string()
    .max(500, "Description must not exceed 500 characters"),
  PERA: yup.number().min(0, "Must be 0 or greater"),
  uniformAllowance: yup.number().min(0),
  productivityIncentive: yup.number().min(0),
  medicalAllowance: yup.number().min(0),
  additionalMedical: yup.number().min(0),
  cashGift: yup.number().min(0),
  meal: yup.number().min(0),
  courtAppearance: yup.number().min(0),
  childrenAllowance: yup.number().min(0),
  gsisPremium: yup.number().min(0),
  philhealthPremium: yup
    .number()
    .min(0.05, "PhilHealth premium must be 5% per Circular 2019-0009")
    .max(0.05, "PhilHealth premium must be 5% per Circular 2019-0009"),
  pagibigPremium: yup.number().min(0),
  employeeCompensation: yup.number().min(0),
  weekdayMultiplier: yup.number().min(0),
  weekendMultiplier: yup.number().min(0),
  subsistenceAllowance: yup.number().min(0),
  subsistenceAllowanceRate: yup.number().min(0),
  earnedLeaves: yup.number().min(0),
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

/**
 * Compensation Standalone Dialog
 * Creates compensation INDEPENDENTLY without fiscal year
 * After creation, user links to fiscal years separately
 */
const CompensationStandaloneDialog = ({
  open,
  onClose,
  editData,
  onSaved,
  existingCompensations = []
}) => {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(0);
  const [copiedFromId, setCopiedFromId] = useState(null);

  // ✅ Fetch existing compensations if not provided
  const { data: fetchedCompensations = [] } = useQuery({
    queryKey: ["compensationList"],
    queryFn: async () => {
      try {
        const response = await api.get("/compensation");
        let data = response.data?.compensationSettings || response.data?.data || response.data || [];
        if (Array.isArray(data)) {
          data = data.map(item => ({
            ...item,
            linkedFiscalYears: item.linkedFiscalYears || [],
            linkedBudgetTypes: item.linkedBudgetTypes || []
          }));
        }
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("Failed to fetch compensation settings:", error);
        return [];
      }
    },
    enabled: open && existingCompensations.length === 0
  });

  // Use provided compensations or fetched ones
  const compensationsForCopy = existingCompensations.length > 0 ? existingCompensations : fetchedCompensations;

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm({
    resolver: yupResolver(compensationSchema),
    defaultValues: {
      name: "",
      description: "",
      PERA: 0,
      uniformAllowance: 0,
      productivityIncentive: 0,
      medicalAllowance: 0,
      additionalMedical: 0,
      cashGift: 0,
      meal: 0,
      courtAppearance: 0,
      childrenAllowance: 0,
      gsisPremium: 0,
      philhealthPremium: 0.05,
      pagibigPremium: 0,
      employeeCompensation: 0,
      weekdayMultiplier: 0,
      weekendMultiplier: 0,
      subsistenceAllowance: 0,
      subsistenceAllowanceRate: 0,
      earnedLeaves: 0,
      loyaltyPay: {
        baseYears: 10,
        baseAmount: 10000,
        succeedingInterval: 5,
        succeedingAmount: 5000,
      },
      subsistenceAllowanceSTRates: {
        highRisk: {
          fifteenOrMoreDays: 0.3,
          eightToFourteenDays: 0.23,
          lessThanEightDays: 0.15,
        },
        lowRisk: {
          fifteenOrMoreDays: 0.15,
          eightToFourteenDays: 0.12,
          lessThanEightDays: 0.1,
        },
      },
    }
  });

  // ✅ FIX: Reset form when editData changes (when user clicks Edit on different row)
  useEffect(() => {
    if (editData) {
      reset(editData);
    } else {
      reset();
    }
  }, [editData, reset]);

  // Create/Update compensation
  const mutation = useMutation({
    mutationFn: async (data) => {
      if (editData?._id) {
        // Update existing
        return api.put(`/compensation/${editData._id}`, data);
      } else {
        // Create new
        return api.post("/compensation", data);
      }
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries(["compensationList"]);
      queryClient.invalidateQueries(["compensation"]);
      toast.success(editData ? "Compensation updated successfully" : "Compensation created successfully");
      handleDialogClose();
      if (onSaved) onSaved();
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to save compensation");
    }
  });

  const handleCopyFromExisting = (compensationId) => {
    if (!compensationId) {
      setCopiedFromId(null);
      reset();
      return;
    }

    const sourceCompensation = compensationsForCopy.find(c => c._id === compensationId);
    if (sourceCompensation) {
      setCopiedFromId(compensationId);
      
      // Create a copy without the _id so it creates a new record
      const { _id, createdAt, updatedAt, linkedFiscalYears, linkedBudgetTypes, ...copyData } = sourceCompensation;
      
      // Pre-fill name with " - Copy" suffix
      copyData.name = `${copyData.name} - Copy`;
      
      reset(copyData);
      toast.success(`Compensation "${sourceCompensation.name}" loaded. Edit and save as new.`);
    }
  };

  const handleDialogClose = () => {
    reset();
    setActiveTab(0);
    setCopiedFromId(null);
    onClose();
  };

  const onSubmit = (data) => {
    mutation.mutate(data);
  };

  return (
    <Dialog
      open={open}
      onClose={handleDialogClose}
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
            {editData ? "Edit Compensation Settings" : "Create Compensation Settings"}
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
            {editData 
              ? "Update compensation details (independent of fiscal year)"
              : "Create reusable compensation settings that can be linked to multiple fiscal years"
            }
          </Typography>
        </Box>
        <Button
          onClick={handleDialogClose}
          sx={{ minWidth: "auto", color: "white" }}
        >
          <MdClose size={24} />
        </Button>
      </DialogTitle>

      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent sx={{ p: 3, backgroundColor: "#f8f9fa" }}>
          {/* Alert */}
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              <strong>Important:</strong> This compensation will be created as a standalone entry.
              After creation, you can link it to one or more fiscal years from the Compensation Management interface.
            </Typography>
          </Alert>

          <Stack spacing={3}>
            {/* Copy From Existing - Only Show in Create Mode */}
            {!editData && compensationsForCopy.length > 0 && (
              <Box sx={{ p: 2.5, backgroundColor: '#fff3cd', borderRadius: 2, border: '1px solid #ffc107' }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: '#d39e00' }}>
                  📋 Copy From Existing (Optional)
                </Typography>
                <Typography variant="body2" sx={{ mb: 2, color: '#666' }}>
                  Select an existing compensation to copy its settings. All fields will be pre-filled with its values.
                </Typography>
                <TextField
                  select
                  fullWidth
                  label="Select Compensation to Copy"
                  value={copiedFromId || ''}
                  onChange={(e) => handleCopyFromExisting(e.target.value)}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '&:hover fieldset': { borderColor: '#d39e00' },
                      '&.Mui-focused fieldset': { borderColor: '#d39e00' }
                    },
                    '& .MuiInputLabel-root.Mui-focused': { color: '#d39e00' }
                  }}
                >
                  <MenuItem value="">-- Start Fresh (Default values) --</MenuItem>
                  {compensationsForCopy.map((comp) => (
                    <MenuItem key={comp._id} value={comp._id}>
                      {comp.name} {comp.linkedFiscalYears?.length > 0 && `(Linked to ${comp.linkedFiscalYears.length} FY)`}
                    </MenuItem>
                  ))}
                </TextField>
              </Box>
            )}

            {/* Name & Description Section */}
            <Box sx={{ p: 2.5, backgroundColor: '#ffffff', borderRadius: 2, border: '1px solid #e0e0e0' }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: '#264524' }}>
                📋 Compensation Identification
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="name"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Compensation Name"
                        fullWidth
                        placeholder="e.g., COMPENSATION 1, Standard 2025-2026"
                        error={!!errors.name}
                        helperText={errors.name?.message}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            '&:hover fieldset': { borderColor: '#264524' },
                            '&.Mui-focused fieldset': { borderColor: '#264524' }
                          },
                          '& .MuiInputLabel-root.Mui-focused': { color: '#264524' }
                        }}
                      />
                    )}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Controller
                    name="description"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Description (Optional)"
                        fullWidth
                        placeholder="e.g., Notes or additional information about this compensation"
                        multiline
                        rows={2}
                        error={!!errors.description}
                        helperText={errors.description?.message}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            '&:hover fieldset': { borderColor: '#264524' },
                            '&.Mui-focused fieldset': { borderColor: '#264524' }
                          },
                          '& .MuiInputLabel-root.Mui-focused': { color: '#264524' }
                        }}
                      />
                    )}
                  />
                </Grid>
              </Grid>

              <FormHelperText sx={{ mt: 2, color: '#666' }}>
                ✓ Give your compensation a unique name for easy identification
              </FormHelperText>
            </Box>

            {/* Compensation Sections */}
            {/* Allowances Section */}
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6" sx={{ fontWeight: 600, color: '#264524' }}>
                  💰 Allowances & Benefits
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ backgroundColor: '#ffffff' }}>
                <Grid container spacing={2}>
                  {[
                    { name: "PERA", label: "PERA (₱)" },
                    { name: "uniformAllowance", label: "Uniform Allowance (₱)" },
                    { name: "productivityIncentive", label: "Productivity Incentive (₱)" },
                    { name: "medicalAllowance", label: "Medical Allowance (₱)" },
                    { name: "additionalMedical", label: "Additional Medical (₱)" },
                    { name: "subsistenceAllowance", label: "Subsistence Allowance (Monthly ₱)" },
                    { name: "cashGift", label: "Cash Gift (₱)" },
                    { name: "meal", label: "Meal Allowance (₱)" },
                    { name: "courtAppearance", label: "Court Appearance (₱)" },
                    { name: "childrenAllowance", label: "Children Allowance (₱)" }
                  ].map(({ name, label }) => (
                    <Grid item xs={12} sm={6} key={name}>
                      <Controller
                        name={name}
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            label={label}
                            fullWidth
                            InputProps={{ inputComponent: NumberFormatCustom }}
                            error={!!errors[name]}
                            helperText={errors[name]?.message}
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                '&:hover fieldset': { borderColor: '#264524' },
                                '&.Mui-focused fieldset': { borderColor: '#264524' }
                              }
                            }}
                          />
                        )}
                      />
                    </Grid>
                  ))}
                </Grid>
              </AccordionDetails>
            </Accordion>

            {/* Government Contributions Section */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6" sx={{ fontWeight: 600, color: '#264524' }}>
                  🏛️ Government Contributions
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ backgroundColor: '#ffffff' }}>
                <Grid container spacing={2}>
                  {[
                    { name: "gsisPremium", label: "GSIS Premium (%)", component: PercentageFormatCustom },
                    { name: "philhealthPremium", label: "PhilHealth Premium (%)", component: PercentageFormatCustom },
                    { name: "pagibigPremium", label: "Pag-IBIG Premium (₱)", component: NumberFormatCustom },
                    { name: "employeeCompensation", label: "Employee Compensation (₱)", component: NumberFormatCustom }
                  ].map(({ name, label, component: Component }) => (
                    <Grid item xs={12} sm={6} key={name}>
                      <Controller
                        name={name}
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            label={label}
                            fullWidth
                            InputProps={{ inputComponent: Component }}
                            error={!!errors[name]}
                            helperText={name === "philhealthPremium" ? "2025: Total 5% (Employee 2.5% + Employer 2.5%). Salary ₱10,000–₱100,000. Cap ₱2,500 each at ₱100,000+." : errors[name]?.message}
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                '&:hover fieldset': { borderColor: '#264524' },
                                '&.Mui-focused fieldset': { borderColor: '#264524' }
                              }
                            }}
                          />
                        )}
                      />
                    </Grid>
                  ))}
                </Grid>
              </AccordionDetails>
            </Accordion>

            {/* Other Settings Section */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6" sx={{ fontWeight: 600, color: '#264524' }}>
                  ⚙️ Other Settings
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ backgroundColor: '#ffffff' }}>
                <Grid container spacing={2}>
                  {[
                    { name: "weekdayMultiplier", label: "Weekday Multiplier" },
                    { name: "weekendMultiplier", label: "Weekend Multiplier" },
                    { name: "subsistenceAllowance", label: "Subsistence Allowance (Monthly ₱)" },
                    { name: "subsistenceAllowanceRate", label: "Subsistence Allowance MDS Rate (₱)" },
                    { name: "earnedLeaves", label: "Earned Leaves (Days)", component: HighPrecisionFormatCustom }
                  ].map(({ name, label, component }) => (
                    <Grid item xs={12} sm={6} key={name}>
                      <Controller
                        name={name}
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            label={label}
                            fullWidth
                            InputProps={{ inputComponent: component || NumberFormatCustom }}
                            error={!!errors[name]}
                            helperText={errors[name]?.message}
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                '&:hover fieldset': { borderColor: '#264524' },
                                '&.Mui-focused fieldset': { borderColor: '#264524' }
                              }
                            }}
                          />
                        )}
                      />
                    </Grid>
                  ))}
                </Grid>
              </AccordionDetails>
            </Accordion>

            {/* Subsistence Allowance (EST) Rates Section */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6" sx={{ fontWeight: 600, color: '#264524' }}>
                  📊 Subsistence Allowance (EST) Rates
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ backgroundColor: '#ffffff' }}>
                <Stack spacing={3}>
                  {/* High Risk */}
                  <Box>
                    <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 2 }}>
                      High Risk
                    </Typography>
                    <Grid container spacing={2}>
                      {[
                        { name: "subsistenceAllowanceSTRates.highRisk.fifteenOrMoreDays", label: "≥15 days" },
                        { name: "subsistenceAllowanceSTRates.highRisk.eightToFourteenDays", label: "8–14 days" },
                        { name: "subsistenceAllowanceSTRates.highRisk.lessThanEightDays", label: "<8 days" }
                      ].map(({ name, label }) => (
                        <Grid item xs={12} sm={4} key={name}>
                          <Controller
                            name={name}
                            control={control}
                            render={({ field }) => (
                              <TextField
                                {...field}
                                label={label}
                                type="number"
                                fullWidth
                                inputProps={{ step: 0.01 }}
                                error={!!errors?.subsistenceAllowanceSTRates?.highRisk}
                                sx={{
                                  '& .MuiOutlinedInput-root': {
                                    '&:hover fieldset': { borderColor: '#264524' },
                                    '&.Mui-focused fieldset': { borderColor: '#264524' }
                                  }
                                }}
                              />
                            )}
                          />
                        </Grid>
                      ))}
                    </Grid>
                  </Box>

                  {/* Low Risk */}
                  <Box>
                    <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 2 }}>
                      Low Risk
                    </Typography>
                    <Grid container spacing={2}>
                      {[
                        { name: "subsistenceAllowanceSTRates.lowRisk.fifteenOrMoreDays", label: "≥15 days" },
                        { name: "subsistenceAllowanceSTRates.lowRisk.eightToFourteenDays", label: "8–14 days" },
                        { name: "subsistenceAllowanceSTRates.lowRisk.lessThanEightDays", label: "<8 days" }
                      ].map(({ name, label }) => (
                        <Grid item xs={12} sm={4} key={name}>
                          <Controller
                            name={name}
                            control={control}
                            render={({ field }) => (
                              <TextField
                                {...field}
                                label={label}
                                type="number"
                                fullWidth
                                inputProps={{ step: 0.01 }}
                                error={!!errors?.subsistenceAllowanceSTRates?.lowRisk}
                                sx={{
                                  '& .MuiOutlinedInput-root': {
                                    '&:hover fieldset': { borderColor: '#264524' },
                                    '&.Mui-focused fieldset': { borderColor: '#264524' }
                                  }
                                }}
                              />
                            )}
                          />
                        </Grid>
                      ))}
                    </Grid>
                  </Box>
                </Stack>
              </AccordionDetails>
            </Accordion>

            {/* Loyalty Pay Settings Section */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6" sx={{ fontWeight: 600, color: '#264524' }}>
                  🎖️ Loyalty Pay Settings
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ backgroundColor: '#ffffff' }}>
                <Grid container spacing={2}>
                  {[
                    { name: "loyaltyPay.baseYears", label: "Base Years (e.g. 10)" },
                    { name: "loyaltyPay.baseAmount", label: "Base Amount (₱)" },
                    { name: "loyaltyPay.succeedingInterval", label: "Succeeding Interval (e.g. 5 years)" },
                    { name: "loyaltyPay.succeedingAmount", label: "Succeeding Amount (₱)" }
                  ].map(({ name, label }) => (
                    <Grid item xs={12} sm={6} key={name}>
                      <Controller
                        name={name}
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            label={label}
                            fullWidth
                            InputProps={{ inputComponent: NumberFormatCustom }}
                            error={!!errors?.loyaltyPay}
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                '&:hover fieldset': { borderColor: '#264524' },
                                '&.Mui-focused fieldset': { borderColor: '#264524' }
                              }
                            }}
                          />
                        )}
                      />
                    </Grid>
                  ))}
                </Grid>
              </AccordionDetails>
            </Accordion>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 3, backgroundColor: "#ffffff", borderTop: '1px solid #e0e0e0' }}>
          <Button onClick={handleDialogClose} variant="outlined">
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={mutation.isPending}
            sx={{
              background: `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${theme.palette.secondary.main} 90%)`,
              boxShadow: `0 3px 5px 2px ${alpha(theme.palette.primary.main, 0.3)}`
            }}
          >
            {mutation.isPending ? (
              <CircularProgress size={20} sx={{ mr: 1 }} />
            ) : editData ? (
              "Update Compensation"
            ) : (
              "Create Compensation"
            )}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default CompensationStandaloneDialog;