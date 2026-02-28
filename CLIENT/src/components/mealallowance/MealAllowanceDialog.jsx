import React, { useEffect, useState, useMemo } from "react";
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
  CircularProgress,
  Typography,
  Box,
} from "@mui/material";
import {
  Restaurant as RestaurantIcon,
  Edit as EditIcon,
} from "@mui/icons-material";
import { Controller, useForm } from "react-hook-form";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import CustomButton from "../../global/components/CustomButton";
import api from "../../config/api";
import { useUser } from "../../context/UserContext";
import { useRegion } from "../../context/RegionContext";

const MealAllowanceDialog = ({ row, endpoint, dataListName }) => {
  const isEditing = Boolean(row);
  const [open, setOpen] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
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

  const { control, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: {
      employee: null,
      actualDays: 22, // Fixed to 22 days
      positionTitle: "",
      department: "",
      division: "",
      region: "",
    },
  });

  const actualDays = watch("actualDays");
  const selectedEmployee = watch("employee");

  // Fetch settings with polling to detect changes
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["activeSettings"],
    queryFn: async () => {
      const res = await api.get("/settings/active");
      return res.data;
    },
    refetchInterval: 60000, // Poll every 60 seconds
  });

  useEffect(() => {
    if (isEditing && row) {
      reset({
        employee: {
          employeeNumber: row.employeeNumber,
          employeeFullName: row.employeeFullName,
          _id: row._id,
          positionTitle: row.positionTitle,
          department: row.department,
          division: row.division,
          region: row.region,
        },
        actualDays: row.actualDays || 0,
        positionTitle: row.positionTitle || "",
        department: row.department || "",
        division: row.division || "",
        region: row.region || "",
      });
    }
  }, [isEditing, row, reset]);

  useEffect(() => {
    if (selectedEmployee && !isEditing) {
      setValue("positionTitle", selectedEmployee.positionTitle || "", { shouldValidate: true });
      setValue("department", selectedEmployee.department || "", { shouldValidate: true });
      setValue("division", selectedEmployee.division || "", { shouldValidate: true });
      setValue("region", selectedEmployee.region || "", { shouldValidate: true });
    }
  }, [selectedEmployee, setValue, isEditing]);

  useEffect(() => {
    const fetchEmployees = async () => {
      setLoading(true);
      setError(null);
      try {
        // Use region filtering if available
        const params = {};
        if (activeRegion?.name) {
          params.region = activeRegion.name;
        }
        
        const res = await api.get("/getpersonnels/hiredBeforeJune1988", { params });
        setEmployees(res.data);
      } catch (err) {
        setError(err.message || "Failed to fetch employees");
        toast.error(err.message || "Failed to fetch employees");
      } finally {
        setLoading(false);
      }
    };
    fetchEmployees();
  }, [activeRegion]); // Re-fetch when region changes

  const computeAmount = useMemo(() => {
    // Check both locations: direct settings (legacy) or populated compensationSettingsId (new architecture)
    const mealRate = settings?.meal ?? settings?.compensationSettingsId?.meal;
    if (!settings || !mealRate || actualDays === undefined) return 0;
    // Calculate monthly amount first
    const monthlyAmount = Number(mealRate) * Number(actualDays);
    // Return annual amount (monthly × 12)
    return (monthlyAmount * 12).toFixed(2);
  }, [settings, actualDays]);

  const mutation = useMutation({
    mutationFn: async (data) => {
      if (!data.employee) throw new Error("Employee is required");
      if (!Number.isInteger(Number(data.actualDays))) throw new Error("Actual days must be an integer");

      const payload = {
        employeeNumber: data.employee.employeeNumber,
        employeeFullName: data.employee.employeeFullName,
        positionTitle: data.positionTitle,
        department: data.department,
        division: data.division,
        proposalId: data.employee.proposalId,
        workflowRef: data.employee.workflowRef,
        // Use active region if available, otherwise use employee's region
        region: activeRegion?.name || data.region,
        actualDays: Number(data.actualDays),
        amount: computeAmount,
        processBy: `${currentUser.FirstName} ${currentUser.LastName}`,
        processDate: new Date(),
        fiscalYear: settings?.fiscalYear,
        budgetType: settings?.budgetType,
      };

      return isEditing
        ? api.put(`${endpoint}/${row._id}`, payload)
        : api.post(endpoint, payload);
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
      toast.success(isEditing ? "Record updated successfully" : "Record created successfully");
      handleClose();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || err.message || "Something went wrong");
    },
  });

  const onSubmit = (data) => {
    mutation.mutate(data);
  };

  const handleOpen = () => setOpen(true);
  const handleClose = () => {
    reset();
    setOpen(false);
  };

  const employeeOptions = useMemo(() =>
    employees.map((emp) => ({
      ...emp,
      uniqueKey: emp._id || `emp-${Math.random().toString(36).substring(2, 11)}`,
    })), [employees]);

  return (
    <>
      {!row ? (
        <CustomButton 
          onClick={handleOpen} 
          size="large"
          sx={{
            transition: 'all 0.3s ease',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: '0 6px 20px rgba(46, 125, 50, 0.3)',
            }
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <RestaurantIcon />
            Add Meal Allowance
          </Box>
        </CustomButton>
      ) : (
        <MenuItem 
          onClick={handleOpen} 
          disableRipple 
          sx={{ 
            display: "flex", 
            gap: 1,
            transition: 'all 0.2s ease',
            '&:hover': {
              backgroundColor: 'rgba(46, 125, 50, 0.1)',
              transform: 'translateX(2px)',
            }
          }}
        >
          <EditIcon fontSize="small" />
          Edit
        </MenuItem>
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
            transition: 'all 0.3s ease',
            '&:hover': {
              boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
            }
          }
        }}
        TransitionProps={{
          timeout: 500
        }}
      >
        <DialogTitle sx={{
          background: 'linear-gradient(135deg, #375e38 0%, #2e4d30 100%)',
          color: 'white',
          fontWeight: 'bold'
        }}>
          <Box display="flex" alignItems="center" gap={2}>
            <RestaurantIcon />
            <Box>
              <Typography variant="h6" fontWeight="bold">
                {isEditing ? "Edit Meal Allowance" : "Add Meal Allowance"}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                {isEditing ? "Update employee meal allowance details" : "Add new meal allowance record"}
                {getOrganizationalDisplay() && ` - ${getOrganizationalDisplay()}`}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        
        <DialogContent dividers sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            {/* Employee Selector */}
            <Grid item xs={12}>
              <Controller
                name="employee"
                control={control}
                rules={{ required: "Employee is required" }}
                render={({ field }) => (
                  <Autocomplete
                    options={employeeOptions}
                    getOptionLabel={(option) => option.employeeFullName || ""}
                    isOptionEqualToValue={(option, value) =>
                      option._id === value._id
                    }
                    value={
                      isEditing
                        ? employeeOptions.find(
                            (emp) => emp.employeeFullName === row?.employeeFullName
                          ) || null
                        : field.value
                    }
                    onChange={(_, value) => !isEditing && field.onChange(value)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Select Employee"
                        fullWidth
                        disabled={isEditing}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            '&.Mui-focused fieldset': {
                              borderColor: '#375e38',
                            },
                          },
                        }}
                      />
                    )}
                    renderOption={(props, option) => (
                      <li {...props} key={option.uniqueKey}>
                        {option.employeeFullName}
                      </li>
                    )}
                  />
                )}
              />
            </Grid>

            {/* Auto-filled + Input Fields */}
            <Grid item xs={6}>
              <Controller
                name="positionTitle"
                control={control}
                render={({ field }) => (
                  <TextField {...field} label="Position Title" fullWidth disabled />
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

            <Grid item xs={6}>
              <Controller
                name="actualDays"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Actual Days"
                    type="number"
                    fullWidth
                    disabled
                    helperText="Fixed at 22 days per month"
                  />
                )}
              />
            </Grid>

            <Grid item xs={6}>
              <TextField
                label="Computed Amount"
                value={Number(computeAmount).toLocaleString("en-PH", {
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
            sx={{
              mr: 1,
              transition: 'all 0.3s ease',
              borderRadius: 1.5,
              '&:hover': {
                borderColor: '#2e7d32',
                backgroundColor: 'rgba(46, 125, 50, 0.05)',
                transform: 'translateY(-2px)',
              }
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit(onSubmit)}
            variant="contained"
            disabled={mutation.isLoading}
            sx={{
              background: 'linear-gradient(135deg, #375e38 0%, #2e4d30 100%)',
              borderRadius: 1.5,
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 10px rgba(46, 125, 50, 0.3)',
              '&:hover': {
                background: 'linear-gradient(135deg, #2e4d30 0%, #1e3320 100%)',
                transform: 'translateY(-2px)',
                boxShadow: '0 6px 15px rgba(46, 125, 50, 0.4)',
              }
            }}
          >
            {mutation.isLoading ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {isEditing ? (
                  <>
                    <EditIcon fontSize="small" />
                    Update
                  </>
                ) : (
                  <>
                    <RestaurantIcon fontSize="small" />
                    Save
                  </>
                )}
              </Box>
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default MealAllowanceDialog;
