import React, { useEffect, useState } from "react";
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  TextField,
  Typography,
  Divider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Stack,
  Chip,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  CircularProgress
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { NumericFormat } from "react-number-format";
import api from "../../config/api";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  MdAttachMoney,
  MdAccountBalance,
  MdAccessTime,
  MdEmojiEvents,
  MdSettings,
  MdCalendarToday,
  MdCategory
} from "react-icons/md";

// Component for numeric input formatting (for monetary values)
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

// Component for percentage input formatting (for PhilHealth, GSIS, etc.)
const PercentageFormatCustom = React.forwardRef(function PercentageFormatCustom(props, ref) {
  const { onChange, onBlur, ...other } = props;
  return (
    <NumericFormat
      {...other}
      getInputRef={ref}
      thousandSeparator
      decimalScale={2}
      suffix="%"
      onValueChange={(values) => onChange(values.floatValue / 100)} // Convert 5% to 0.05
      value={props.value * 100} // Display 0.05 as 5%
      onBlur={(e) => onBlur && onBlur(e)}
    />
  );
});

// Add this component for earned leaves input
const EarnedLeavesFormatCustom = React.forwardRef(function EarnedLeavesFormatCustom(props, ref) {
  const { onChange, onBlur, ...other } = props;
  return (
    <NumericFormat
      {...other}
      getInputRef={ref}
      thousandSeparator
      decimalScale={8} // Allow up to 8 decimal places
      fixedDecimalScale={false} // Allow variable decimal places
      allowNegative={false}
      onValueChange={(values) => onChange(values.floatValue || 0)}
      onBlur={(e) => onBlur && onBlur(e)}
    />
  );
});

// Validation schema
const advancedSchema = yup.object().shape({
  fiscalYear: yup.string().required("Fiscal year is required"),
  budgetType: yup.string().required("Budget type is required"),
  PERA: yup.number().min(0),
  uniformAllowance: yup.number().min(0),
  productivityIncentive: yup.number().min(0),
  medicalAllowance: yup.number().min(0),
  cashGift: yup.number().min(0),
  meal: yup.number().min(0),
  courtAppearance: yup.number().min(0),
  childrenAllowance: yup.number().min(0),
  gsisPremium: yup.number().min(0),
  philhealthPremium: yup
    .number()
    .min(0.05, "PhilHealth premium must be 5% in 2025 per Circular 2019-0009")
    .max(0.05, "PhilHealth premium must be 5% in 2025 per Circular 2019-0009")
    .required("PhilHealth premium is required")
    .typeError("Must be a valid number"),
  pagibigPremium: yup.number().min(0),
  employeeCompensation: yup.number().min(0),
  weekdayMultiplier: yup.number().min(0),
  weekendMultiplier: yup.number().min(0),
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

// Fiscal Year & Budget Type Section Component
const FiscalYearBudgetTypeSection = ({ control, errors, fiscalYears, isEditMode, isLoading }) => (
  <Box sx={{ mb: 3, p: 2.5, backgroundColor: '#ffffff', borderRadius: 2, border: '1px solid #e0e0e0' }}>
    <Stack spacing={2.5}>
      <Stack direction="row" alignItems="center" spacing={2}>
        <Box sx={{ color: '#264524', fontSize: '1.5rem' }}>
          <MdCalendarToday />
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 600, color: '#264524' }}>
          Fiscal Year & Budget Type
        </Typography>
      </Stack>
      
      <Grid container spacing={2}>
        {/* Fiscal Year Field */}
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
                  disabled={isEditMode || isLoading}
                >
                  <MenuItem value="" disabled>
                    {isLoading ? "Loading fiscal years..." : "Select a fiscal year"}
                  </MenuItem>
                  {fiscalYears?.map((fy) => (
                    <MenuItem key={fy} value={fy}>
                      FY {fy}
                    </MenuItem>
                  ))}
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

        {/* Budget Type Field */}
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
                  disabled={isEditMode}
                >
                  <MenuItem value="" disabled>
                    Select a budget type
                  </MenuItem>
                  <MenuItem value="Initial">Initial Budget</MenuItem>
                  <MenuItem value="GAA">General Appropriations Act (GAA)</MenuItem>
                  <MenuItem value="NEP">Normative/Emergency/Priority (NEP)</MenuItem>
                  <MenuItem value="Supplemental">Supplemental Budget</MenuItem>
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
      </Grid>

      <Box sx={{ p: 1.5, backgroundColor: '#f0f7f0', borderRadius: 1, borderLeft: '3px solid #264524' }}>
        <Typography variant="caption" color="text.secondary">
          <strong>Note:</strong> {isEditMode ? 
            "Fiscal year and budget type cannot be changed when editing." : 
            "Select the fiscal year and budget type for these compensation settings. This creates a unique record for tracking."}
        </Typography>
      </Box>
    </Stack>
  </Box>
);

// Enhanced Accordion Section Component
const AccordionSection = ({ title, children, icon }) => (
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
        {icon && (
          <Box
            sx={{
              color: '#264524',
              fontSize: '1.5rem',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            {icon}
          </Box>
        )}
        <Typography variant="h6" sx={{ fontWeight: 600, color: '#264524' }}>
          {title}
        </Typography>
      </Stack>
    </AccordionSummary>
    <AccordionDetails sx={{ p: 3, backgroundColor: '#ffffff' }}>
      {children}
    </AccordionDetails>
  </Accordion>
);

// Compensation Section (including subsistenceAllowanceRate)
const CompensationSection = ({ control, errors }) => {
  const fields = [
    { name: "PERA", label: "PERA (₱)" },
    { name: "uniformAllowance", label: "Uniform Allowance (₱)" },
    { name: "productivityIncentive", label: "Productivity Incentive (₱)" },
    { name: "medicalAllowance", label: "Medical Allowance (₱)" },
    { name: "cashGift", label: "Cash Gift (₱)" },
    { name: "meal", label: "Meal Allowance (₱)" },
    { name: "courtAppearance", label: "Court Appearance (₱)" },
    { name: "childrenAllowance", label: "Children Allowance (₱)" },
    { name: "subsistenceAllowanceRate", label: "Subsistence Allowance Rate" },
    { name: "earnedLeaves", label: "Earned Leaves (Days)", special: true },
  ];
  return (
    <AccordionSection title="Compensation & Allowances" icon={<MdAttachMoney />}>
      <Grid container spacing={3}>
        {fields.map(({ name, label, special }) => (
          <Grid item xs={12} sm={6} key={name}>
            <Controller
              name={name}
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label={label}
                  fullWidth
                  variant="outlined"
                  InputProps={{
                    inputComponent: special ? EarnedLeavesFormatCustom : NumberFormatCustom,
                    style: { textAlign: "right" },
                  }}
                  error={!!errors[name]}
                  helperText={errors[name]?.message}
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
        ))}
      </Grid>
    </AccordionSection>
  );
};

// Government Share Section
const GovernmentShareSection = ({ control, errors }) => {
  const fields = [
    { name: "gsisPremium", label: "GSIS Premium", inputComponent: PercentageFormatCustom },
    { name: "philhealthPremium", label: "PhilHealth Premium", inputComponent: PercentageFormatCustom },
    { name: "pagibigPremium", label: "Pag-IBIG Premium", inputComponent: NumberFormatCustom },
    { name: "employeeCompensation", label: "Employee Compensation", inputComponent: NumberFormatCustom },
  ];
  return (
    <AccordionSection title="Government Share & Contributions" icon={<MdAccountBalance />}>
      <Grid container spacing={3}>
        {fields.map(({ name, label, inputComponent }) => (
          <Grid item xs={12} sm={6} key={name}>
            <Controller
              name={name}
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label={label}
                  fullWidth
                  variant="outlined"
                  InputProps={{
                    inputComponent,
                    inputProps: { value: field.value },
                    style: { textAlign: "right" },
                  }}
                  error={!!errors[name]}
                  helperText={
                    errors[name]?.message ||
                    (name === "philhealthPremium"
                      ? "2025: Total 5% of monthly basic salary (Employee 2.5% + Employer 2.5%). Salary range ₱10,000–₱100,000. Cap: ₱2,500 each share at ₱100,000+."
                      : "")
                  }
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
        ))}
      </Grid>
    </AccordionSection>
  );
};

// Subsistence Allowance (S&T) Rates Section
const SubsistenceAllowanceSTRatesSection = ({ control, errors }) => {
  const highRiskFields = [
    { name: "subsistenceAllowanceSTRates.highRisk.fifteenOrMoreDays", label: "≥15 days" },
    { name: "subsistenceAllowanceSTRates.highRisk.eightToFourteenDays", label: "8–14 days" },
    { name: "subsistenceAllowanceSTRates.highRisk.lessThanEightDays", label: "<8 days" },
  ];
  const lowRiskFields = [
    { name: "subsistenceAllowanceSTRates.lowRisk.fifteenOrMoreDays", label: "≥15 days" },
    { name: "subsistenceAllowanceSTRates.lowRisk.eightToFourteenDays", label: "8–14 days" },
    { name: "subsistenceAllowanceSTRates.lowRisk.lessThanEightDays", label: "<8 days" },
  ];
  return (
    <AccordionSection title="Subsistence Allowance (S&T) Rates">
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Typography variant="subtitle2" fontWeight="bold">
            High Risk
          </Typography>
        </Grid>
        {highRiskFields.map(({ name, label }) => (
          <Grid item xs={4} key={name}>
            <Controller
              name={name}
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label={label}
                  type="number"
                  fullWidth
                  inputProps={{ step: 0.01, style: { textAlign: "right" } }}
                  error={!!errors?.subsistenceAllowanceSTRates?.highRisk?.[name.split(".").pop()]}
                  helperText={
                    errors?.subsistenceAllowanceSTRates?.highRisk?.[name.split(".").pop()]?.message
                  }
                />
              )}
            />
          </Grid>
        ))}
        <Grid item xs={12} sx={{ mt: 2 }}>
          <Typography variant="subtitle2" fontWeight="bold">
            Low Risk
          </Typography>
        </Grid>
        {lowRiskFields.map(({ name, label }) => (
          <Grid item xs={4} key={name}>
            <Controller
              name={name}
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label={label}
                  type="number"
                  fullWidth
                  inputProps={{ step: 0.01, style: { textAlign: "right" } }}
                  error={!!errors?.subsistenceAllowanceSTRates?.lowRisk?.[name.split(".").pop()]}
                  helperText={
                    errors?.subsistenceAllowanceSTRates?.lowRisk?.[name.split(".").pop()]?.message
                  }
                />
              )}
            />
          </Grid>
        ))}
      </Grid>
    </AccordionSection>
  );
};

// Percentage Multipliers Section
const PercentageMultipliersSection = ({ control, errors }) => {
  const fields = [
    {
      name: "weekdayMultiplier",
      label: "Weekday Multiplier (%)",
      type: "number",
      extraProps: { inputProps: { step: 0.01, style: { textAlign: "right" } } },
    },
    {
      name: "weekendMultiplier",
      label: "Weekend Multiplier (%)",
      type: "number",
      extraProps: { inputProps: { step: 0.01, style: { textAlign: "right" } } },
    },
  ];

  return (
    <AccordionSection title="Overtime Pay Multipliers" icon={<MdAccessTime />}>
      <Grid container spacing={3}>
        {fields.map(({ name, label, type, extraProps }) => (
          <Grid item xs={12} sm={6} key={name}>
            <Controller
              name={name}
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label={label}
                  type={type || "number"}
                  fullWidth
                  variant="outlined"
                  InputProps={{
                    inputComponent: NumberFormatCustom,
                    ...extraProps,
                  }}
                  onBlur={field.onBlur}
                  error={!!errors[name]}
                  helperText={errors[name]?.message}
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
        ))}
      </Grid>
    </AccordionSection>
  );
};

// Loyalty Pay Settings Section
const LoyaltyPaySettingsSection = ({ control, errors }) => (
  <AccordionSection title="Loyalty Pay Settings" icon={<MdEmojiEvents />}>
    <Grid container spacing={3}>
      <Grid item xs={12} sm={6}>
        <Controller
          name="loyaltyPay.baseYears"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Base Years (e.g. 10)"
              type="number"
              fullWidth
              variant="outlined"
              InputProps={{
                inputComponent: NumberFormatCustom,
                style: { textAlign: "right" },
              }}
              error={!!errors?.loyaltyPay?.baseYears}
              helperText={errors?.loyaltyPay?.baseYears?.message}
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
          name="loyaltyPay.baseAmount"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Base Amount (₱)"
              fullWidth
              variant="outlined"
              InputProps={{
                inputComponent: NumberFormatCustom,
                style: { textAlign: "right" },
              }}
              error={!!errors?.loyaltyPay?.baseAmount}
              helperText={errors?.loyaltyPay?.baseAmount?.message}
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
          name="loyaltyPay.succeedingInterval"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Succeeding Interval (e.g. 5 years)"
              type="number"
              fullWidth
              variant="outlined"
              InputProps={{
                inputComponent: NumberFormatCustom,
                style: { textAlign: "right" },
              }}
              error={!!errors?.loyaltyPay?.succeedingInterval}
              helperText={errors?.loyaltyPay?.succeedingInterval?.message}
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
          name="loyaltyPay.succeedingAmount"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Succeeding Amount (₱)"
              fullWidth
              variant="outlined"
              InputProps={{
                inputComponent: NumberFormatCustom,
                style: { textAlign: "right" },
              }}
              error={!!errors?.loyaltyPay?.succeedingAmount}
              helperText={errors?.loyaltyPay?.succeedingAmount?.message}
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
  </AccordionSection>
);

// Main Dialog Component with integrated form
const CompensationSettingsDialogForm = ({
  fiscalYear,
  onSaved,
  onCancel,
  editData,
  open,
  onClose,
}) => {
  const queryClient = useQueryClient();
  const [isEditMode] = useState(!!editData?._id);

  // Fetch available fiscal years
  const { data: fiscalYears = [], isLoading: isLoadingFiscalYears } = useQuery({
    queryKey: ["fiscal-years"],
    queryFn: async () => {
      try {
        const response = await api.get('/settings/fiscal-years');
        const yearsData = response.data?.data || response.data || [];
        return Array.isArray(yearsData) ? yearsData : [];
      } catch (error) {
        console.error("Failed to fetch fiscal years:", error);
        return [];
      }
    },
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(advancedSchema),
    defaultValues: {
      fiscalYear: "",
      budgetType: "Initial",
      PERA: 0,
      uniformAllowance: 0,
      productivityIncentive: 0,
      medicalAllowance: 200, // Default to 200 pesos per month per dependent
      cashGift: 0,
      meal: 200, // Default to 200 pesos per day for eligible employees
      courtAppearance: 0,
      childrenAllowance: 0,
      gsisPremium: 0,
      philhealthPremium: 0.05, // Default to 5% for 2025
      pagibigPremium: 0,
      employeeCompensation: 0,
      weekdayMultiplier: 0,
      weekendMultiplier: 0,
      subsistenceAllowanceRate: 0,
      loyaltyPay: {
        baseYears: 0,
        baseAmount: 0,
        succeedingInterval: 0,
        succeedingAmount: 0,
      },
      subsistenceAllowanceSTRates: {
        highRisk: {
          fifteenOrMoreDays: 0,
          eightToFourteenDays: 0,
          lessThanEightDays: 0,
        },
        lowRisk: {
          fifteenOrMoreDays: 0,
          eightToFourteenDays: 0,
          lessThanEightDays: 0,
        },
      },
    },
  });

  // Pre-fill form if in edit mode
  useEffect(() => {
    if (editData) {
      reset({
        fiscalYear: editData.fiscalYear || "",
        budgetType: editData.budgetType || "Initial",
        PERA: editData.PERA,
        uniformAllowance: editData.uniformAllowance,
        productivityIncentive: editData.productivityIncentive,
        medicalAllowance: editData.medicalAllowance,
        cashGift: editData.cashGift,
        meal: editData.meal,
        courtAppearance: editData.courtAppearance,
        childrenAllowance: editData.childrenAllowance,
        gsisPremium: editData.gsisPremium,
        philhealthPremium: editData.philhealthPremium,
        pagibigPremium: editData.pagibigPremium,
        employeeCompensation: editData.employeeCompensation,
        weekdayMultiplier: editData.weekdayMultiplier,
        weekendMultiplier: editData.weekendMultiplier,
        subsistenceAllowanceRate: editData.subsistenceAllowanceRate,
        earnedLeaves: editData.earnedLeaves,
        loyaltyPay: {
          baseYears: editData.loyaltyPay?.baseYears,
          baseAmount: editData.loyaltyPay?.baseAmount,
          succeedingInterval: editData.loyaltyPay?.succeedingInterval,
          succeedingAmount: editData.loyaltyPay?.succeedingAmount,
        },
        subsistenceAllowanceSTRates: {
          highRisk: {
            fifteenOrMoreDays: editData.subsistenceAllowanceSTRates?.highRisk?.fifteenOrMoreDays,
            eightToFourteenDays: editData.subsistenceAllowanceSTRates?.highRisk?.eightToFourteenDays,
            lessThanEightDays: editData.subsistenceAllowanceSTRates?.highRisk?.lessThanEightDays,
          },
          lowRisk: {
            fifteenOrMoreDays: editData.subsistenceAllowanceSTRates?.lowRisk?.fifteenOrMoreDays,
            eightToFourteenDays: editData.subsistenceAllowanceSTRates?.lowRisk?.eightToFourteenDays,
            lessThanEightDays: editData.subsistenceAllowanceSTRates?.lowRisk?.lessThanEightDays,
          },
        },
      });
    }
  }, [editData, reset]);

  // When creating new settings (no editData), set fiscal year and auto-prefill from previous FY
  useEffect(() => {
    const prefillFromPreviousFY = async () => {
      try {
        if (!open || editData || !fiscalYear) return;

        // Set the fiscal year to the one from URL params
        reset((current) => ({
          ...current,
          fiscalYear: fiscalYear || "",
        }));

        // Fetch advanced settings for the previous FY and use them as defaults
        const { data: advanced } = await api.get(`/settings/advanced/${fiscalYear}`);
        if (advanced && typeof advanced === 'object') {
          reset((current) => ({
            ...current,
            fiscalYear: fiscalYear || "",
            PERA: advanced.PERA ?? current.PERA,
            uniformAllowance: advanced.uniformAllowance ?? current.uniformAllowance,
            productivityIncentive: advanced.productivityIncentive ?? current.productivityIncentive,
            medicalAllowance: advanced.medicalAllowance ?? current.medicalAllowance,
            cashGift: advanced.cashGift ?? current.cashGift,
            meal: advanced.meal ?? current.meal,
            courtAppearance: advanced.courtAppearance ?? current.courtAppearance,
            childrenAllowance: advanced.childrenAllowance ?? current.childrenAllowance,
            gsisPremium: advanced.gsisPremium ?? current.gsisPremium,
            philhealthPremium: advanced.philhealthPremium ?? current.philhealthPremium,
            pagibigPremium: advanced.pagibigPremium ?? current.pagibigPremium,
            employeeCompensation: advanced.employeeCompensation ?? current.employeeCompensation,
            weekdayMultiplier: advanced.weekdayMultiplier ?? current.weekdayMultiplier,
            weekendMultiplier: advanced.weekendMultiplier ?? current.weekendMultiplier,
            subsistenceAllowanceRate: advanced.subsistenceAllowanceRate ?? current.subsistenceAllowanceRate,
            earnedLeaves: advanced.earnedLeaves ?? current.earnedLeaves,
          }));
          toast.info(`Prefilled from previous fiscal year settings.`, { autoClose: 2000 });
        } else {
          // Just set the fiscal year even if no previous settings
          reset((current) => ({
            ...current,
            fiscalYear: fiscalYear || "",
          }));
        }
      } catch (err) {
        console.error('[CompensationSettingsDialogForm] Prefill error:', err);
        // Still set the fiscal year
        reset((current) => ({
          ...current,
          fiscalYear: fiscalYear || "",
        }));
      }
    };

    prefillFromPreviousFY();
  }, [open, fiscalYear, editData, reset]);

  // Mutation definition
  const mutation = useMutation({
    mutationFn: async (data) => {
      const effectiveFiscalYear = data.fiscalYear || editData?.fiscalYear;
      if (!effectiveFiscalYear) {
        throw new Error("Fiscal year is missing.");
      }
      // Extract fiscal year and budget type from form data
      const { fiscalYear: fy, budgetType, ...compensationData } = data;
      const res = await api.put(`/settings/advanced/${effectiveFiscalYear}`, compensationData, { 
        params: { budgetType: budgetType || editData?.budgetType } 
      });
      return res.data.message;
    },
    onSuccess: (message) => {
      queryClient.invalidateQueries(["settings"]);
      queryClient.invalidateQueries(["fiscal-years"]);
      const updatedMessage = message.replace("Advanced settings", "Compensation Settings");
      toast.success(updatedMessage);
      if (onSaved) onSaved();
      reset();
      onClose();
    },
    onError: (error) => {
      toast.error(error.message || "An error occurred.");
    },
  });

  const onSubmit = (data) => {
    const effectiveFiscalYear = data.fiscalYear || editData?.fiscalYear;
    if (!effectiveFiscalYear) {
      toast.error("Fiscal year is missing. Please provide a valid fiscal year.");
      return;
    }
    mutation.mutate(data);
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
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
              {editData ? "Edit Compensation Settings" : "Add Compensation Settings"}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9, mt: 1 }} component="div">
              Configure compensation rates, allowances, and government contributions
            </Typography>
            {isEditMode && editData && (
              <Stack direction="row" spacing={1} sx={{ position: 'absolute', top: 16, right: 16 }}>
                <Chip
                  label={`Fiscal Year: ${editData.fiscalYear}`}
                  size="small"
                  sx={{
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    color: 'white'
                  }}
                />
                <Chip
                  label={`${editData.budgetType || 'N/A'}`}
                  size="small"
                  sx={{
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    color: 'white'
                  }}
                />
              </Stack>
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
            {/* Fiscal Year & Budget Type Section */}
            <FiscalYearBudgetTypeSection 
              control={control} 
              errors={errors} 
              fiscalYears={fiscalYears}
              isEditMode={isEditMode}
              isLoading={isLoadingFiscalYears}
            />
            
            <Divider sx={{ my: 3 }} />
            <CompensationSection control={control} errors={errors} />
            <Divider sx={{ my: 3 }} />
            <GovernmentShareSection control={control} errors={errors} />
            <Divider sx={{ my: 3 }} />
            <SubsistenceAllowanceSTRatesSection control={control} errors={errors} />
            <Divider sx={{ my: 3 }} />
            <PercentageMultipliersSection control={control} errors={errors} />
            <Divider sx={{ my: 3 }} />
            <LoyaltyPaySettingsSection control={control} errors={errors} />
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
            onClick={onClose}
            variant="outlined"
            sx={{ mr: 2 }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit(onSubmit)}
            variant="contained"
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
            {mutation.isLoading ? "Saving..." : editData ? "Update Settings" : "Save Settings"}
          </Button>
        </DialogActions>
      </Dialog>
      <ToastContainer />
    </>
  );
};

export default CompensationSettingsDialogForm;
