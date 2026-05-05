import React, { useState, useEffect, useMemo } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  TextField,
  Autocomplete,
  FormControl,
  InputLabel,
  Select,
  FormHelperText,
  IconButton,
  InputAdornment,
  Typography,
  Box,
  CircularProgress,
  Chip,
  Alert,
} from "@mui/material";
import {
  Elderly as RetireeIcon,
  Edit as EditIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
} from "@mui/icons-material";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useRegion } from "../../context/RegionContext";
import { toast } from "react-hot-toast";
import { FaPlus, FaEdit } from "react-icons/fa";
import api from "../../config/api";
import { useUser } from "../../context/UserContext";
import { NumericFormat } from 'react-number-format';

const RetireeDialog = ({
  row,
  schema,
  endpoint,
  dataListName,
  buttonProps = {},
}) => {
  const { currentUser } = useUser();
  const { activeRegion } = useRegion();
  const queryClient = useQueryClient();

  // Get organizational level display text based on user's hierarchical access
  const getOrganizationalDisplay = () => {
    const hierarchical = currentUser?.hierarchicalAccess || {};
    const scope = hierarchical.scope || 'REGION';
    
    switch(scope) {
      case 'DIVISION':
        const divisionName = hierarchical.accessibleDivisions?.[0] || 'Division';
        return `Division: ${divisionName}`;
      case 'DEPARTMENT':
        const departmentName = hierarchical.accessibleDepartments?.[0]?.departmentName || 'Department';
        return `Department: ${departmentName}`;
      case 'REGION':
      default:
        return activeRegion ? `Region: ${activeRegion.name}` : '';
    }
  };
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});
  const isEditing = Boolean(row);

  // Fetch active fiscal year and settings
  const { data: settingsData } = useQuery({
    queryKey: ["settings", "active"],
    queryFn: async () => {
      const response = await api.get("/settings/active");
      return response.data;
    },
    enabled: open,
  });

  // Fetch employees eligible for retirement
  const { data: eligibleData, isLoading: isLoadingEmployees } = useQuery({
    queryKey: ["eligible-for-retirement", activeRegion?.name],
    queryFn: async () => {
      // Add region parameter if available
      const params = {};
      if (activeRegion?.name) {
        params.region = activeRegion.name;
      }
      
      const response = await api.get("/retiree/eligible", { params });
      // Backend now returns { eligible: [...], referenceDate, referenceYear }
      return response.data;
    },
    enabled: open && !isEditing,
  });

  // Extract the eligible array and reference date from the response
  const eligibleEmployees = Array.isArray(eligibleData?.eligible)
    ? eligibleData.eligible
    : Array.isArray(eligibleData) ? eligibleData : []; // backward-compat fallback
  const eligibilityReferenceDate = eligibleData?.referenceDate || null;

  // Build a unique, de-duplicated options list for Autocomplete
  const retireeOptions = useMemo(() => {
    const list = Array.isArray(eligibleEmployees)
      ? eligibleEmployees.filter(e => e.eligibleType === "Compulsory" || e.eligibleType === "Optional")
      : [];

    // Deduplicate by a stable composite id (prefer employeeNumber or _id)
    const seen = new Set();
    const unique = [];
    for (const e of list) {
      const stableId = String(
        e.employeeNumber ?? e.employeeID ?? e.EmployeeID ?? e._id ?? `${e.employeeFullName}-${e.dateOfBirth}`
      );
      if (!seen.has(stableId)) {
        seen.add(stableId);
        unique.push({ ...e, __stableId: stableId });
      }
    }
    return unique;
  }, [eligibleEmployees]);

  useEffect(() => {
    if (open) {
      if (isEditing) {
        // Normalize dateOfRetirement: DB stores full ISO strings (e.g. "2026-12-31T00:00:00.000Z")
        // but <input type="date"> requires "YYYY-MM-DD" — slice at "T" to fix the empty placeholder bug.
        const rawDate = row?.dateOfRetirement;
        const normalizedDate = rawDate
          ? String(rawDate).split("T")[0]   // "2026-12-31T00:00:00.000Z" → "2026-12-31"
          : "";

        setFormData({
          ...row,
          dateOfRetirement: normalizedDate,
          processBy: `${currentUser?.FirstName || ""} ${
            currentUser?.LastName || ""
          }`,
          processDate: new Date().toISOString().split("T")[0],
        });
      } else {
        setFormData({
          employeeNumber: "",
          employeeFullName: "",
          positionTitle: "",
          department: "",
          division: "",
          region: "",
          retirementType: "Compulsory",
          dateOfRetirement: "",
          leaveDays: 0,
          monthlySalary: 0,
          terminalLeave: 0,
          retirementGratuity: 0,
          total: 0,
          fiscalYear: settingsData?.fiscalYear || "",
          budgetType: settingsData?.budgetType || "",
          processBy: `${currentUser?.FirstName || ""} ${
            currentUser?.LastName || ""
          }`,
          processDate: new Date().toISOString().split("T")[0],
        });
      }
    }
  }, [open, row, isEditing, currentUser, settingsData]);

  // Recalculate terminal leave when leaveDays or monthlySalary changes
  useEffect(() => {
    if (formData.leaveDays !== undefined && formData.monthlySalary !== undefined) {
      const computed = calculateTerminalLeave(
        Number(formData.leaveDays) || 0,
        Number(formData.monthlySalary) || 0
      );
      setFormData(prev => ({
        ...prev,
        terminalLeave: computed,
        total: computed + (Number(prev.retirementGratuity) || 0)
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.leaveDays, formData.monthlySalary]);

  // Keep total in sync with retirementGratuity changes
  useEffect(() => {
    if (formData.retirementGratuity !== undefined) {
      setFormData(prev => ({
        ...prev,
        total: (Number(prev.terminalLeave) || 0) + (Number(prev.retirementGratuity) || 0)
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.retirementGratuity]);

  const handleOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setFormData({});
    setErrors({});
  };

  // Function to calculate retirement type based on birth date
  const calculateRetirementType = (birthDate) => {
    if (!birthDate) return { type: "Unknown", age: 0, isEligible: false };

    const birth = new Date(birthDate);
    const today = new Date();
    const age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    // Adjust age if birthday hasn't occurred this year
    const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())
      ? age - 1
      : age;

    if (actualAge >= 65) {
      return { type: "Compulsory", age: actualAge, isEligible: true, reason: "65 years or older" };
    } else if (actualAge >= 60) {
      return { type: "Optional", age: actualAge, isEligible: true, reason: "60-64 years old" };
    } else {
      return { type: "Not Eligible", age: actualAge, isEligible: false, reason: "Under 60 years old" };
    }
  };

  // Function to calculate terminal leave using the official formula:
  // Terminal Leave = Total Earned Leaves × Monthly Rate × 0.0481927
  const TERMINAL_LEAVE_FACTOR = 0.0481927;
  const calculateTerminalLeave = (leaveDays, monthlySalary) => {
    if (!leaveDays || leaveDays <= 0) return 0;
    if (!monthlySalary || monthlySalary <= 0) return 0;
    // Formula: leaveDays × Monthly Rate × 0.0481927
    return leaveDays * monthlySalary * TERMINAL_LEAVE_FACTOR;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // For numeric fields, ensure we store the actual number value
    if (name === "terminalLeave" || name === "retirementGratuity") {
      // Store as numeric value for calculations
      setFormData((prev) => ({
        ...prev,
        [name]: value,
        // Recalculate total whenever these values change
        total: Number(name === "terminalLeave" ? value : prev.terminalLeave || 0) + 
               Number(name === "retirementGratuity" ? value : prev.retirementGratuity || 0)
      }));
    } else {
      // For other fields, just update normally
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleEmployeeSelect = (event, employee) => {
    if (employee) {

      // Try to get employee number from any available field
      const employeeNum = employee.employeeNumber ||
                          employee.employeeID ||
                          employee.EmployeeID ||
                          (typeof employee._id === 'string' ? employee._id : "");

      // Use the server-computed eligibleType (already based on Dec 31 reference date).
      // DO NOT re-compute via calculateRetirementType() — that function uses today's date
      // and can return "Not Eligible" which fails Mongoose enum validation → 500 error.
      const retirementType = employee.eligibleType; // "Compulsory" | "Optional"

      // Get monthly salary — prefer monthlySalary field, fallback to annualSalary/12
      const monthlySal = employee.monthlySalary
        ? Number(employee.monthlySalary)
        : (employee.annualSalary ? Number(employee.annualSalary) / 12 : 0);

      // Default leave days from earnedLeaves
      const leaveDays = Number(employee.earnedLeaves) || 0;

      // Compute terminal leave: leaveDays × Monthly Rate × 0.0481927
      const calculatedTerminalLeave = calculateTerminalLeave(leaveDays, monthlySal);

      setFormData((prev) => ({
        ...prev,
        employeeNumber: employeeNum,
        employeeFullName: employee.employeeFullName || employee.EmployeeFullName || "",
        positionTitle: employee.positionTitle || employee.PositionTitle || "",
        department: employee.department || employee.Department || "",
        division: employee.division || employee.Division || "",
        region: employee.region || employee.Region || "",
        retirementType,
        leaveDays,
        monthlySalary: monthlySal,
        terminalLeave: calculatedTerminalLeave,
        earnedLeaves: leaveDays,       // Store original for reference
        retirementAge: employee.age,   // from server (Dec 31 reference)
        retirementReason: retirementType === "Compulsory" ? "65 years or older" : "60–64 years old with 15+ years service",
        dateOfBirth: employee.dateOfBirth || employee.DateOfBirth || "",
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.employeeNumber) {
      newErrors.employeeNumber = "Employee number is required";
    }
    if (!formData.employeeFullName) {
      newErrors.employeeFullName = "Employee name is required";
    }
    if (!formData.dateOfRetirement) {
      newErrors.dateOfRetirement = "Retirement date is required";
    }
    if (!formData.leaveDays && Number(formData.leaveDays) <= 0) {
      newErrors.leaveDays = "Leave days is required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data) => {
      const response = await api.post(endpoint, data);
      return response;
    },
    onSuccess: (response) => {
      toast.success("Retiree record created successfully");
      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ["retiree"] });
      queryClient.invalidateQueries({ queryKey: ["personnel-services-combined"] });
      queryClient.invalidateQueries({ queryKey: ["calculated-budgetary-support"] });
      queryClient.invalidateQueries({ queryKey: ["comprehensive-report-data"] });
      queryClient.invalidateQueries({ queryKey: ["allProposals"] });
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      queryClient.invalidateQueries({ queryKey: ["workflowProposals"] });
      handleClose();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Error creating record");
      console.error("Error creating retiree record:", error);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data) => {
      return await api.put(`${endpoint}/${row._id}`, data);
    },
    onSuccess: () => {
      toast.success("Retiree record updated successfully");
      // Make sure we're invalidating the correct query
      queryClient.invalidateQueries({ queryKey: [dataListName] });
      // Also invalidate any related queries
      queryClient.invalidateQueries({ queryKey: ["retiree"] });
      // Invalidate for BudgetarySupportTable, Comprehensive Reports, NewProposalWorkflowPage
      queryClient.invalidateQueries({ queryKey: ["personnel-services-combined"] });
      queryClient.invalidateQueries({ queryKey: ["calculated-budgetary-support"] });
      queryClient.invalidateQueries({ queryKey: ["comprehensive-report-data"] });
      queryClient.invalidateQueries({ queryKey: ["allProposals"] });
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      queryClient.invalidateQueries({ queryKey: ["workflowProposals"] });
      handleClose();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Error updating record");
      console.error("Error updating retiree record:", error);
    },
  });

  const handleSubmit = () => {
    if (!validateForm()) {
      return;
    }
    
    const terminalLeaveAmt = parseFloat(formData.terminalLeave) || 0;
    const retirementGratuityAmt = parseFloat(formData.retirementGratuity) || 0;

    const submissionData = {
      ...formData,
      leaveDays: parseFloat(formData.leaveDays) || 0,
      terminalLeave: terminalLeaveAmt,
      retirementGratuity: retirementGratuityAmt,
      total: terminalLeaveAmt + retirementGratuityAmt,
      processBy: `${currentUser?.FirstName || ""} ${currentUser?.LastName || ""}`,
      processDate: new Date().toISOString(),
      fiscalYear: formData.fiscalYear || new Date().getFullYear().toString(),
      budgetType: formData.budgetType || "Initial"
    };

    if (isEditing) {
      updateMutation.mutate(submissionData);
    } else {
      createMutation.mutate(submissionData);
    }
  };

  // Add a useEffect to log form data changes
  useEffect(() => {
  }, [formData]);

  // Custom component for currency formatting
  const NumberFormatCustom = React.forwardRef(function NumberFormatCustom(props, ref) {
    const { onChange, ...other } = props;
    return (
      <NumericFormat
        {...other}
        getInputRef={ref}
        thousandSeparator
        decimalScale={2}
        fixedDecimalScale
        prefix="₱ "
        onValueChange={(values) => {
          onChange({
            target: {
              name: props.name,
              value: values.value,
            },
          });
        }}
      />
    );
  });

  return (
    <>
      {isEditing ? (
        <MenuItem onClick={handleOpen} disableRipple sx={{ display: "flex", gap: 1 }}>
          <EditIcon fontSize="small" />
          Edit
        </MenuItem>
      ) : (
        <Button
          variant="contained"
          startIcon={<RetireeIcon />}
          onClick={handleOpen}
          sx={{
            background: 'linear-gradient(135deg, #375e38 0%, #2e4d30 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #2e4d30 0%, #1e3320 100%)',
            }
          }}
          {...buttonProps}
        >
          Add Retiree
        </Button>
      )}

      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          }
        }}
      >
        <DialogTitle sx={{
          background: 'linear-gradient(135deg, #375e38 0%, #2e4d30 100%)',
          color: 'white',
          fontWeight: 'bold'
        }}>
          <Box display="flex" alignItems="center" gap={2}>
            <RetireeIcon />
            <Box>
              <Typography variant="h6" fontWeight="bold">
                {isEditing ? "Edit Retiree Record" : "Add New Retiree Record"}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                {isEditing ? "Update retiree information and benefits" : "Process employee retirement with automatic calculations"}
                {getOrganizationalDisplay() && ` - ${getOrganizationalDisplay()}`}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {!isEditing && (
              <Grid item xs={12}>
                {/* Reference date info banner */}
                {eligibilityReferenceDate && (
                  <Typography variant="caption" sx={{ display: 'block', mb: 1, color: 'text.secondary', fontStyle: 'italic' }}>
                    ℹ️ Eligibility based on age as of <strong>December 31, {eligibleData?.referenceYear}</strong> — per Philippine government budget rules.
                  </Typography>
                )}
                <Autocomplete
                  options={retireeOptions}
                  getOptionLabel={(option) =>
                    `${option.employeeNumber || ''} - ${option.employeeFullName || ''} (Age as of Dec 31: ${option.age ?? '?'})`
                  }
                  onChange={handleEmployeeSelect}
                  loading={isLoadingEmployees}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Select Employee Eligible for Retirement"
                      fullWidth
                      error={!!errors.employeeFullName}
                      helperText={errors.employeeFullName}
                    />
                  )}
                  renderOption={(props, option) => {
                    const uniqueKey = String(option.employeeNumber ?? option.employeeID ?? option.EmployeeID ?? option._id ?? `${option.employeeFullName}-${option.dateOfBirth || option.DateOfBirth || ''}`);
                    const { key, ...optionProps } = props;
                    return (
                      <Box component="li" key={uniqueKey} {...optionProps}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                          <Typography variant="body1">
                            {option.employeeNumber} - {option.employeeFullName}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                            <Chip
                              size="small"
                              label={`Age (Dec 31): ${option.age ?? '?'}`}
                              color="primary"
                              variant="outlined"
                            />
                            <Chip
                              size="small"
                              label={option.eligibleType ?? "Not Eligible"}
                              color={
                                option.eligibleType === "Compulsory"
                                  ? "error"
                                  : option.eligibleType === "Optional"
                                  ? "warning"
                                  : "default"
                              }
                            />
                            {option.earnedLeaves > 0 && (
                              <Chip
                                size="small"
                                label={`${option.earnedLeaves} leave days`}
                                color="info"
                                variant="outlined"
                              />
                            )}
                          </Box>
                        </Box>
                      </Box>
                    );
                  }}
                />
              </Grid>
            )}

            {/* Display retirement information for selected employee */}
           {formData.employeeFullName && (formData.retirementType === "Compulsory" || formData.retirementType === "Optional") && (
  <Grid item xs={12}>
    <Alert
      severity={formData.retirementType === 'Compulsory' ? 'error' : 'warning'}
      icon={formData.retirementType === 'Compulsory' ? <WarningIcon /> : <CheckIcon />}
      sx={{ mb: 2 }}
    >
      <Typography variant="body2">
        <strong>{formData.employeeFullName}</strong> is eligible for <strong>{formData.retirementType} Retirement</strong>
        {formData.retirementAge && ` (Age: ${formData.retirementAge})`}
        {formData.retirementReason && ` - ${formData.retirementReason}`}
      </Typography>
      {formData.earnedLeaves && (
        <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
          Terminal leave calculated from {formData.earnedLeaves} earned leave days
        </Typography>
      )}
    </Alert>
  </Grid>
)}

            {/* Hidden fields - we keep them in the form but don't display them */}
            <input type="hidden" name="employeeNumber" value={formData.employeeNumber || ""} />
            <input type="hidden" name="employeeFullName" value={formData.employeeFullName || ""} />
            <input type="hidden" name="fiscalYear" value={formData.fiscalYear || ""} />
            <input type="hidden" name="budgetType" value={formData.budgetType || ""} />

            <Grid item xs={12} md={6}>
              <TextField
                name="positionTitle"
                label="Position Title"
                value={formData.positionTitle || ""}
                onChange={handleChange}
                fullWidth
                disabled={true}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                name="department"
                label="Department"
                value={formData.department || ""}
                onChange={handleChange}
                fullWidth
                disabled={true}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                name="division"
                label="Division"
                value={formData.division || ""}
                onChange={handleChange}
                fullWidth
                disabled={true}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                name="region"
                label="Region"
                value={formData.region || ""}
                onChange={handleChange}
                fullWidth
                disabled={true}
              />
            </Grid>

            {/* Retirement Type is now auto-determined from selected employee */}
            <input type="hidden" name="retirementType" value={formData.retirementType || ""} />

            <Grid item xs={12} md={6}>
              <TextField
                name="dateOfRetirement"
                label="Date of Retirement"
                type="date"
                value={formData.dateOfRetirement || ""}
                onChange={handleChange}
                fullWidth
                required
                error={!!errors.dateOfRetirement}
                helperText={errors.dateOfRetirement}
                InputLabelProps={{ shrink: true }}
                // Prevent selecting dates in the past
                inputProps={{ 
                  min: new Date().toISOString().split('T')[0]
                }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                name="leaveDays"
                label="Leave Days (Total Earned)"
                type="number"
                value={formData.leaveDays ?? ""}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setFormData(prev => ({ ...prev, leaveDays: val }));
                }}
                fullWidth
                required
                error={!!errors.leaveDays}
                helperText={
                  errors.leaveDays ||
                  (formData.earnedLeaves > 0
                    ? `Prefilled from earned leaves (${formData.earnedLeaves} days). Editable.`
                    : "Enter total earned leave days")
                }
                inputProps={{ min: 0, step: 0.5 }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                name="terminalLeave"
                label="Terminal Leave (Auto-computed)"
                value={
                  (Number(formData.terminalLeave) || 0)
                    .toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                }
                fullWidth
                disabled
                helperText={
                  formData.leaveDays > 0 && formData.monthlySalary > 0
                    ? `${formData.leaveDays} days × ₱${Number(formData.monthlySalary).toLocaleString('en-PH', {minimumFractionDigits:2})} × 0.0481927`
                    : "Formula: Leave Days × Monthly Rate × 0.0481927"
                }
                InputProps={{
                  startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                  readOnly: true,
                  style: { fontWeight: 'bold' }
                }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                name="retirementGratuity"
                label="Retirement Gratuity Amount"
                value={formData.retirementGratuity || ""}
                onChange={handleChange}
                fullWidth
                error={!!errors.retirementGratuity}
                helperText={errors.retirementGratuity || "Optional"}
                InputProps={{
                  inputComponent: NumberFormatCustom,
                  inputProps: { style: { textAlign: 'right' } }
                }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                name="total"
                label="Total Amount"
                value={
                  (Number(formData.terminalLeave || 0) + Number(formData.retirementGratuity || 0))
                    .toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })
                    .replace('PHP', '₱')
                }
                fullWidth
                disabled
                InputProps={{
                  readOnly: true,
                  style: { fontWeight: 'bold' }
                }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button
            onClick={handleClose}
            variant="outlined"
            sx={{ mr: 1 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={createMutation.isPending || updateMutation.isPending}
            sx={{
              background: 'linear-gradient(135deg, #375e38 0%, #2e4d30 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #2e4d30 0%, #1e3320 100%)',
              }
            }}
          >
            {createMutation.isPending || updateMutation.isPending ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              isEditing ? "Update" : "Save"
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default RetireeDialog;

