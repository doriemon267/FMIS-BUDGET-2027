import React, { useEffect, useState, useRef } from "react";
import { useTheme } from "@mui/material/styles";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  TextField,
  Autocomplete,
  MenuItem,
  Typography,
  Box,
  CircularProgress,
} from "@mui/material";
import {
  EmojiEvents as LoyaltyIcon,
  Edit as EditIcon,
} from "@mui/icons-material";
import { Controller, useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import CustomButton from "../../global/components/CustomButton";
import api from "../../config/api";
import { useUser } from "../../context/UserContext";
import { useRegion } from "../../context/RegionContext";
import {
  calculateLoyaltyPayYearsOfService,
  getEligibleLoyaltyPayYear,
  formatCutoffDate
} from "../../utils/loyaltyPayUtils";

const LoyaltyPayDialog = ({ row, endpoint, dataListName, schema, onDialogClose }) => {
  const theme = useTheme();
  const headerGradient = theme.palette.mode === 'dark' 
    ? 'linear-gradient(135deg, #0b2413 0%, #1e3320 100%)' 
    : 'linear-gradient(135deg, #2d5016 0%, #375e38 100%)';
  const buttonGradient = theme.palette.mode === 'dark'
    ? 'linear-gradient(135deg, #1e3320 0%, #0b2413 100%)'
    : 'linear-gradient(135deg, #375e38 0%, #2e4d30 100%)';
  const buttonHoverGradient = theme.palette.mode === 'dark'
    ? 'linear-gradient(135deg, #2e4d30 0%, #1e3320 100%)'
    : 'linear-gradient(135deg, #2e4d30 0%, #1e3320 100%)';

  const isEditing = Boolean(row);
  const [open, setOpen] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [settings, setSettings] = useState(null);
  const { currentUser } = useUser();
  const { activeRegion } = useRegion();
  const queryClient = useQueryClient();

  const { control, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: {
      employee: row?.employee || null,
      positionTitle: row?.positionTitle || "",
      department: row?.department || "",
      division: row?.division || "",
      region: row?.region || "",
      yearsInService: row?.yearsInService || "",
    },
  });

  const selectedEmployee = watch("employee");
  const yearsInService = watch("yearsInService");

  // Refs to manage one-time toast
  const toastShownRef = useRef(false);

  useEffect(() => {
    if (open && activeRegion) {
      // First fetch settings, then fetch employees
      const loadData = async () => {
        const settingsData = await fetchSettings();
        // Now that settings are loaded, fetch employees
        // Pass settingsData directly instead of relying on state update
        if (settingsData) {
          fetchEmployees(settingsData);
        }
      };
      
      loadData();
    }
  }, [open, activeRegion]);

  useEffect(() => {
    if (selectedEmployee && !isEditing) {
      // Set form values based on selected employee
      setValue("positionTitle", selectedEmployee.positionTitle || "");
      setValue("department", selectedEmployee.department || "");
      setValue("division", selectedEmployee.division || "");
      setValue("region", selectedEmployee.region || "");
      
      // Calculate years in service based on DateOfAppointment with June 22 cutoff
      if (selectedEmployee.dateOfAppointment) {
        const fiscalYear = settings?.fiscalYear || new Date().getFullYear().toString();
        const loyaltyConfig = settings?.loyaltyPay || settings?.compensationSettingsId?.loyaltyPay;
        const cutoffDate = loyaltyConfig?.cutoffDate || "06-22";

        // Calculate years of service with June 22 cutoff
        const yearsOfService = calculateLoyaltyPayYearsOfService(
          selectedEmployee.dateOfAppointment,
          fiscalYear,
          cutoffDate
        );

        // Get the eligible loyalty pay year (milestone)
        const eligibleYear = getEligibleLoyaltyPayYear(yearsOfService);

        // Set years in service to the valid milestone year
        if (eligibleYear !== null) {
          setValue("yearsInService", eligibleYear);
        }
      }
    }
  }, [selectedEmployee, setValue, isEditing]);

  const fetchEmployees = async (settingsData) => {
    try {
      if (!activeRegion) {
        toast.error("Please select a region first");
        return;
      }
      
      if (!settingsData) {
        toast.error("Settings not loaded yet. Please try again.");
        return;
      }
      
      // console.log("Fetching eligible employees for region:", activeRegion.name || activeRegion.Region);
      
      // Use the correct endpoint from your EmployeeList_router.js with region and fiscal year filter
      const res = await api.get("/employees/loyalty-pay", {
        params: {
          region: activeRegion.name || activeRegion.Region,
          fiscalYear: settingsData.fiscalYear
        }
      });
      
      // console.log("Fetched employees:", res.data.length);
      setEmployees(res.data);
      
      if (res.data.length === 0) {
        toast.info("No eligible employees found for the selected region and fiscal year.");
      }
    } catch (err) {
      console.error("Error fetching eligible employees:", err);
      toast.error("Failed to fetch eligible employees.");
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await api.get("/settings/active");
      // console.log("Fetched settings:", res.data);
      setSettings(res.data);
      return res.data;
    } catch (err) {
      toast.error("Failed to fetch settings.");
      return null;
    }
  };

  // computeAmount function – tumatanggap na ng parameter na 'yrs'
  // Note: This should NOT call toast during render to avoid React warnings
  const computeAmount = (yrs, showError = false) => {
    if (!settings) {
      return 0;
    }
    // Check both locations: direct settings.loyaltyPay (legacy) or populated compensationSettingsId.loyaltyPay (new architecture)
    const loyalty = settings.loyaltyPay || settings.compensationSettingsId?.loyaltyPay;
    if (
      !loyalty ||
      loyalty.baseAmount === undefined ||
      loyalty.succeedingAmount === undefined
    ) {
      // Only show error toast when explicitly requested (not during render)
      if (showError && !toastShownRef.current) {
        toast.error("Loyalty Pay settings are incomplete. Please configure Loyalty Pay in Compensation Settings.");
        toastShownRef.current = true;
      }
      return 0;
    }
    toastShownRef.current = false;
    const validYears = [10, 15, 20, 25, 30, 35, 40, 45, 50];
    const yrsNum = Number(yrs);
    if (!validYears.includes(yrsNum)) {
      return 0;
    }
    // Kung 10, ibalik ang baseAmount; kung hindi, ibalik ang succeedingAmount.
    return yrsNum === 10 ? loyalty.baseAmount : loyalty.succeedingAmount;
  };

  const mutation = useMutation({
    mutationFn: async (data) => {
      const processBy = `${currentUser.FirstName} ${currentUser.LastName}`;
      const processDate = new Date();
      
      // Always use fiscal year from settings, not current year
      const fiscalYear = settings?.fiscalYear;
      
      if (!fiscalYear) {
        throw new Error("Fiscal year not found in settings. Please contact administrator.");
      }

      const budgetType = settings?.budgetType || "";
      const payload = {
        employeeNumber: isEditing
          ? row.employeeNumber
          : data.employee?.employeeNumber,
        employeeFullName: isEditing
          ? row.employeeFullName
          : data.employee?.employeeFullName,
        positionTitle: data.positionTitle,
        department: data.department,
        division: data.division,
        region: data.region,
        yearsInService: Number(data.yearsInService),
        appointmentDate: isEditing
          ? row.appointmentDate
          : data.employee?.dateOfAppointment, // Include appointment date for cutoff calculation
        // Gamitin ang computeAmount function na may parameter (showError=true during submit)
        amount: computeAmount(data.yearsInService, true),
        processBy,
        processDate,
        fiscalYear,
        budgetType,
      };

      return isEditing
        ? await api.put(`${endpoint}/${row._id}`, payload)
        : await api.post(endpoint, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries([dataListName]);
      // Invalidate proposal queries so NewProposalWorkflowPage updates totals
      queryClient.invalidateQueries({ queryKey: ["allProposals"] });
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      queryClient.invalidateQueries({ queryKey: ["workflowProposals"] });
      // Invalidate for BudgetarySupportTable, Comprehensive Reports
      queryClient.invalidateQueries({ queryKey: ["personnel-services-combined"] });
      queryClient.invalidateQueries({ queryKey: ["calculated-budgetary-support"] });
      queryClient.invalidateQueries({ queryKey: ["comprehensive-report-data"] });
      toast.success(isEditing ? "Record updated" : "Record created");
      handleClose();
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || "Something went wrong");
    },
  });

  const onSubmit = (data) => {
    mutation.mutate(data);
  };

  const handleOpen = () => {
    if (!activeRegion) {
      toast.error("Please select a region first");
      return;
    }
    setOpen(true);
  };
  
  const handleClose = () => {
    reset();
    setOpen(false);
    // Optional: tawagin ang callback para isara ang menu sa parent component
    if (onDialogClose) {
      onDialogClose();
    }
  };

  return (
    <>
      {!row ? (
        <CustomButton onClick={handleOpen} size="large">
          Add Loyalty Pay
        </CustomButton>
      ) : (
        <MenuItem onClick={handleOpen} disableRipple sx={{ display: "flex", gap: 1 }}>
          <EditIcon fontSize="small" />
          Edit
        </MenuItem>
      )}

      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          }
        }}
      >
        <DialogTitle sx={{
          background: headerGradient,
          color: 'white',
          fontWeight: 'bold'
        }}>
          <Box display="flex" alignItems="center" gap={2}>
            <LoyaltyIcon />
            <Box>
              <Typography variant="h6" fontWeight="bold">
                {isEditing ? "Edit Loyalty Pay" : "Add Loyalty Pay"}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                {isEditing ? "Update employee loyalty pay details" : "Add new loyalty pay record"}
              </Typography>
              {(settings?.loyaltyPay?.cutoffDate || settings?.compensationSettingsId?.loyaltyPay?.cutoffDate) && (
                <>
                  <Typography variant="caption" sx={{ opacity: 0.8, display: 'block', mt: 0.5 }}>
                    Loyalty Pay Cutoff: {formatCutoffDate(settings.loyaltyPay?.cutoffDate || settings.compensationSettingsId?.loyaltyPay?.cutoffDate)} each year
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.8, display: 'block' }}>
                    Only employees with exactly 10, 15, 20, 25, 30, 35, 40, 45, or 50 years of service are eligible
                  </Typography>
                </>
              )}
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Controller
                name="employee"
                control={control}
                render={({ field }) => (
                  <Autocomplete
                    options={employees}
                    getOptionLabel={(option) => 
                      `${option.employeeFullName} - ${option.yearsInService} years of service`
                    }
                    isOptionEqualToValue={(option, value) =>
                      option._id === value._id
                    }
                    renderOption={(props, option) => (
                      <li {...props} key={option._id}>
                        <div>
                          <strong>{option.employeeFullName}</strong>
                          <div style={{ fontSize: '0.8rem', color: 'gray' }}>
                            Position: {option.positionTitle} | Years: {option.yearsInService}
                          </div>
                        </div>
                      </li>
                    )}
                    value={
                      isEditing
                        ? employees.find(
                            (emp) =>
                              emp.employeeFullName === row.employeeFullName
                          ) || null
                        : field.value || null
                    }
                    onChange={(e, value) => !isEditing && field.onChange(value)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Select Eligible Employee"
                        fullWidth
                        disabled={isEditing}
                      />
                    )}
                  />
                )}
              />
            </Grid>

            <Grid item xs={6}>
              <Controller
                name="positionTitle"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Position Title"
                    fullWidth
                    disabled
                  />
                )}
              />
            </Grid>

            <Grid item xs={6}>
              <Controller
                name="yearsInService"
                control={control}
                defaultValue={row?.yearsInService || ""}
                rules={{
                  required: "Required",
                  validate: (value) =>
                    [10, 15, 20, 25, 30, 35, 40, 45, 50].includes(
                      Number(value)
                    ) || "Pumili lamang ng valid na value",
                }}
                render={({ field, fieldState: { error } }) => (
                  <TextField
                    select
                    label="Years in Service"
                    {...field}
                    onChange={(e) => {
                      // Convert to number before setting the value
                      field.onChange(Number(e.target.value));
                    }}
                    fullWidth
                    error={!!error}
                    helperText={error ? error.message : ""}
                  >
                    {[10, 15, 20, 25, 30, 35, 40, 45, 50].map((year) => (
                      <MenuItem key={year} value={year}>
                        {year}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
            </Grid>

            <Grid item xs={6}>
              <Controller
                name="department"
                control={control}
                render={({ field }) => (
                  <TextField {...field} label="Department" fullWidth disabled />
                )}
              />
            </Grid>
            <Grid item xs={6}>
              <Controller
                name="division"
                control={control}
                render={({ field }) => (
                  <TextField {...field} label="Division" fullWidth disabled />
                )}
              />
            </Grid>
            <Grid item xs={6}>
              <Controller
                name="region"
                control={control}
                render={({ field }) => (
                  <TextField {...field} label="Region" fullWidth disabled />
                )}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Computed Amount"
                value={computeAmount(yearsInService).toLocaleString("en-PH", {
                  style: "currency",
                  currency: "PHP",
                })}
                fullWidth
                disabled
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
            onClick={handleSubmit(onSubmit)}
            variant="contained"
            disabled={mutation.isLoading}
            sx={{
              background: buttonGradient,
              '&:hover': {
                background: buttonHoverGradient,
              }
            }}
          >
            {mutation.isLoading ? (
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

export default LoyaltyPayDialog;
