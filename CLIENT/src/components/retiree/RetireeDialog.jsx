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
  const { data: eligibleEmployees, isLoading: isLoadingEmployees } = useQuery({
    queryKey: ["eligible-for-retirement", activeRegion?.name],
    queryFn: async () => {
      // Add region parameter if available
      const params = {};
      if (activeRegion?.name) {
        params.region = activeRegion.name;
      }
      
      const response = await api.get("/retiree/eligible", { params });
      return response.data;
    },
    enabled: open && !isEditing,
  });

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
        setFormData({
          ...row,
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

  // Calculate total when terminalLeave or retirementGratuity changes
  useEffect(() => {
    if (formData.terminalLeave !== undefined || formData.retirementGratuity !== undefined) {
      const terminalLeave = Number(formData.terminalLeave) || 0;
      const retirementGratuity = Number(formData.retirementGratuity) || 0;
      setFormData(prev => ({
        ...prev,
        total: terminalLeave + retirementGratuity
      }));
    }
  }, [formData.terminalLeave, formData.retirementGratuity]);

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

  // Function to calculate terminal leave based on earned leaves and salary
  const calculateTerminalLeave = (earnedLeaves, monthlySalary) => {
    if (!earnedLeaves || earnedLeaves <= 0) return 0;

    // Calculate daily rate: Monthly salary / 22 working days
    const dailyRate = monthlySalary ? (monthlySalary / 22) : 500; // Default to 500 if no salary data

    // Terminal leave = earned leaves × daily rate
    return earnedLeaves * dailyRate;
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

      // Calculate retirement type based on birth date
      const retirementInfo = calculateRetirementType(employee.dateOfBirth || employee.DateOfBirth);

      // Calculate terminal leave based on earned leaves and salary
      const earnedLeaves = employee.earnedLeaves || 0;
      const monthlySalary = employee.annualSalary ? (employee.annualSalary / 12) : null;
      const calculatedTerminalLeave = calculateTerminalLeave(earnedLeaves, monthlySalary);

      setFormData((prev) => ({
        ...prev,
        employeeNumber: employeeNum,
        employeeFullName: employee.employeeFullName || employee.EmployeeFullName || "",
        positionTitle: employee.positionTitle || employee.PositionTitle || "",
        department: employee.department || employee.Department || "",
        division: employee.division || employee.Division || "",
        region: employee.region || employee.Region || "",
        retirementType: retirementInfo.type, // Auto-set based on age calculation
        terminalLeave: calculatedTerminalLeave, // Auto-calculate terminal leave
        earnedLeaves: earnedLeaves, // Store for reference
        retirementAge: retirementInfo.age, // Store calculated age
        retirementReason: retirementInfo.reason, // Store reason
        dateOfBirth: employee.dateOfBirth || employee.DateOfBirth || "", // Store birth date
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    // Required fields validation
    if (!formData.employeeNumber) {
      newErrors.employeeNumber = "Employee number is required";
    }
    
    if (!formData.employeeFullName) {
      newErrors.employeeFullName = "Employee name is required";
    }
    
    if (!formData.dateOfRetirement) {
      newErrors.dateOfRetirement = "Retirement date is required";
    }

    // Retirement type is auto-determined, no validation needed

    // Add validation for amounts
    if (!formData.terminalLeave || Number(formData.terminalLeave) <= 0) {
      newErrors.terminalLeave = "Terminal leave amount is required";
    }
    
    if (!formData.retirementGratuity || Number(formData.retirementGratuity) <= 0) {
      newErrors.retirementGratuity = "Retirement gratuity amount is required";
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

  // Fix the handleSubmit function to properly format the data
  const handleSubmit = () => {
    if (!validateForm()) {
      return;
    }
    
    // Prepare the data for submission
    const submissionData = {
      ...formData,
      // Ensure numeric fields are sent as numbers
      terminalLeave: parseFloat(formData.terminalLeave) || 0,
      retirementGratuity: parseFloat(formData.retirementGratuity) || 0,
      total: parseFloat(formData.terminalLeave || 0) + parseFloat(formData.retirementGratuity || 0),
      // Add process information
      processBy: "Current User", // Replace with actual user info
      processDate: new Date().toISOString(),
      // Add default values if not provided
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
                <Autocomplete
                   options={
    Array.isArray(eligibleEmployees)
      ? eligibleEmployees.filter(e => e.eligibleType === "Compulsory" || e.eligibleType === "Optional")
      : []
  }
                  getOptionLabel={(option) =>
                    `${option.employeeNumber || ''} - ${option.employeeFullName || ''} (Age: ${calculateRetirementType(option.dateOfBirth || option.DateOfBirth).age})`
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
                    // Extract 'key' from props to avoid spreading it; pass explicitly to satisfy React warning
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
                              label={`Age: ${calculateRetirementType(option.dateOfBirth || option.DateOfBirth).age}`}
                              color="primary"
                              variant="outlined"
                            />
                            <Chip
                              size="small"
                              label={option.eligibleType ? option.eligibleType : "Not Eligible"}
                              color={
                                option.eligibleType === "Compulsory"
                                  ? "error"
                                  : option.eligibleType === "Optional"
                                  ? "warning"
                                  : "default"
                              }
                            />
                            {option.earnedLeaves && (
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
                name="terminalLeave"
                label="Terminal Leave Amount (Auto-calculated)"
                value={formData.terminalLeave || ""}
                onChange={handleChange}
                fullWidth
                required
                error={!!errors.terminalLeave}
                helperText={formData.earnedLeaves ?
                  `Based on ${formData.earnedLeaves} earned leave days` :
                  errors.terminalLeave
                }
                InputProps={{
                  inputComponent: NumberFormatCustom,
                  inputProps: { style: { textAlign: 'right' } },
                  readOnly: !isEditing // Make read-only for new entries, editable for existing ones
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
                required
                error={!!errors.retirementGratuity}
                helperText={errors.retirementGratuity}
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

