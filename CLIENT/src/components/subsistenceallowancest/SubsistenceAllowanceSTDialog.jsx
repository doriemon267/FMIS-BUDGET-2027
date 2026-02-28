import React, { useEffect, useState } from "react";
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
  Box,
  Typography,
  Chip,
  Fade,
  CircularProgress,
} from "@mui/material";
import { Security as SecurityIcon, Add as AddIcon } from "@mui/icons-material";
import { Controller, useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import EditIcon from "@mui/icons-material/Edit";
import CustomButton from "../../global/components/CustomButton";
import api from "../../config/api";
import { useUser } from "../../context/UserContext";
import { useRegion } from "../../context/RegionContext";

const SubsistenceAllowanceSTDialog = ({ row, endpoint, dataListName, schema }) => {
  const isEditing = Boolean(row);
  const [open, setOpen] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [settings, setSettings] = useState(null);
  const { currentUser, assignmentLevel } = useUser();
  const { activeRegion } = useRegion();
  const queryClient = useQueryClient();

  // Function to get hierarchical display
  const getHierarchicalDisplay = () => {
    const hierarchical = currentUser?.hierarchicalAccess || {};
    
    switch (assignmentLevel) {
      case 'DIVISION':
        return `Division: ${hierarchical.accessibleDivisions?.[0]?.divisionName || currentUser?.divisionName || 'N/A'}`;
      case 'DEPARTMENT':
        return `Department: ${hierarchical.accessibleDepartments?.[0]?.departmentName || 'N/A'}`;
      case 'REGION':
        return `Region: ${hierarchical.accessibleRegions?.[0]?.regionName || activeRegion?.name || 'N/A'}`;
      case 'FULL':
        return 'Full Access: All Data';
      default:
        return `Region: ${activeRegion?.name || 'N/A'}`;
    }
  };

  const { control, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: {
      employee: row?.employee || null,
      positionTitle: row?.positionTitle || "",
      department: row?.department || "",
      division: row?.division || "",
      region: row?.region || "",
      monthlySalary: row?.monthlySalary || 0,
      actualExposureDays: row?.actualExposureDays || 0,
      riskLevel: row?.riskLevel || "",
    },
  });

  const selectedEmployee = watch("employee");
  const actualExposureDays = watch("actualExposureDays");
  const riskLevel = watch("riskLevel");
  const monthlySalary = watch("monthlySalary");

  // Effect to fetch data when dialog opens or region changes
  useEffect(() => {
    if (open) {
      fetchSettings();
      
      // Only fetch employees if a region is selected
      if (activeRegion?.name) {
        fetchEmployees();
      } else {
        setEmployees([]);
      }
    }
  }, [open, activeRegion]); // Re-fetch when dialog opens or region changes

  useEffect(() => {
    if (selectedEmployee && !isEditing) {
      setValue("positionTitle", selectedEmployee.positionTitle || "");
      setValue("department", selectedEmployee.department || "");
      setValue("division", selectedEmployee.division || "");
      setValue("region", selectedEmployee.region || "");
      setValue("monthlySalary", selectedEmployee.monthlySalary || 0);
    }
  }, [selectedEmployee, setValue, isEditing]);

  const fetchEmployees = async () => {
    try {
      // CRITICAL: Only fetch employees if a region is selected
      if (!activeRegion?.name) {
        setEmployees([]);
        return;
      }
      
      // Always include region filter
      const params = {
        region: activeRegion.name
      };
      
      const res = await api.get("/getpersonnels", { params });
      
      // Log the first few employees for debugging
      if (res.data.length > 0) {
        res.data.slice(0, 3).forEach((emp, i) => {
        });
      }
      
      // Set the employees directly - server now handles case-insensitive matching
      setEmployees(res.data);
    } catch (err) {
      console.error("Error fetching employees:", err);
      toast.error("Failed to fetch employees.");
      setEmployees([]);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await api.get("/settings/active");
      setSettings(res.data);
    } catch (err) {
      toast.error("Failed to fetch settings.");
    }
  };

  const computeAmount = () => {
    if (!settings || !monthlySalary || !actualExposureDays || !riskLevel) return 0;
    // Check both locations: direct settings (legacy) or populated compensationSettingsId (new architecture)
    const rates = settings.subsistenceAllowanceSTRates || settings.compensationSettingsId?.subsistenceAllowanceSTRates;
    let percentage = 0;

    if (riskLevel === "High") {
      if (actualExposureDays >= 15) percentage = rates.highRisk.fifteenOrMoreDays;
      else if (actualExposureDays >= 8)
        percentage = rates.highRisk.eightToFourteenDays;
      else percentage = rates.highRisk.lessThanEightDays;
    } else {
      if (actualExposureDays >= 15) percentage = rates.lowRisk.fifteenOrMoreDays;
      else if (actualExposureDays >= 8)
        percentage = rates.lowRisk.eightToFourteenDays;
      else percentage = rates.lowRisk.lessThanEightDays;
    }

    return monthlySalary * percentage;
  };

  const mutation = useMutation({
    mutationFn: async (data) => {
      const processBy = `${currentUser.FirstName} ${currentUser.LastName}`;
      const processDate = new Date();
      const fiscalYear =
        settings?.fiscalYear || new Date().getFullYear().toString();
      const budgetType = settings?.budgetType;

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
        region: activeRegion?.name || data.region,
        monthlySalary: Number(data.monthlySalary),
        actualExposureDays: Number(data.actualExposureDays),
        riskLevel: data.riskLevel,
        amount: computeAmount(),
        fiscalYear,
        budgetType,
        processBy,
        processDate,
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

  const handleOpen = () => setOpen(true);
  const handleClose = () => {
    reset();
    setOpen(false);
  };

  // Preprocess employees to attach a unique key for each option
  // and ensure they belong to the active region
  const employeeOptions = employees
    .filter((emp) => {
      // Must have a name
      if (!emp.employeeFullName) {
        return false;
      }
      
      // Must have a region that matches the active region (case-insensitive)
      if (!activeRegion?.name) {
        return false;
      }
      
      const regionMatches = emp.region && emp.region.toLowerCase() === activeRegion.name.toLowerCase();
      if (!regionMatches) {
      }
      
      return regionMatches;
    })
    .map((emp, index) => ({
      ...emp,
      uniqueKey: emp._id ? `${emp._id}-${index}` : `unknown-${index}`,
    }));

  // Log the first few filtered employees
  if (employeeOptions.length > 0) {
    employeeOptions.slice(0, 3).forEach((emp, i) => {
    });
  }

  return (
    <>
      {!row ? (
        <CustomButton onClick={handleOpen} size="large">
          Add Subsistence (S&T)
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
            <SecurityIcon />
            <Box>
              <Typography variant="h6" fontWeight="bold">
                {isEditing ? "Edit S&T Allowance" : "Add S&T Allowance"}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                {isEditing ? "Update employee hazard allowance details" : "Add new hazard allowance record"}
                {(activeRegion || assignmentLevel) && ` - ${getHierarchicalDisplay()}`}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent dividers sx={{ mt: 2 }}>
          {!activeRegion ? (
            <Box sx={{ 
              p: 2, 
              mb: 2, 
              bgcolor: '#fff9c4', 
              borderRadius: 1,
              border: '1px solid #ffd54f'
            }}>
              <Typography color="error" variant="subtitle1" fontWeight="bold">
                Please select a region first
              </Typography>
              <Typography variant="body2">
                You must select a region before you can add or edit S&T Allowance records.
                Use the region selector in the top navigation bar.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ 
              p: 2, 
              mb: 2, 
              bgcolor: '#e8f5e9', 
              borderRadius: 1,
              border: '1px solid #a5d6a7'
            }}>
              <Typography color="primary" variant="subtitle1" fontWeight="bold">
                {getHierarchicalDisplay()}
              </Typography>
              <Typography variant="body2">
                Only employees from {getHierarchicalDisplay().replace(/.*: /, '')} will be shown in the dropdown below.
              </Typography>
            </Box>
          )}
          
          <Grid container spacing={2}>
            {/* Employee Selector */}
            <Grid item xs={12}>
              <Controller
                name="employee"
                control={control}
                render={({ field }) => (
                  <Autocomplete
                    options={employeeOptions}
                    getOptionLabel={(option) => option.employeeFullName || ""}
                    isOptionEqualToValue={(option, value) =>
                      option._id === value._id
                    }
                    disabled={!activeRegion} // Disable if no region is selected
                    noOptionsText={!activeRegion 
                      ? "Please select a region first" 
                      : "No employees found for this region"}
                    value={
                      isEditing
                        ? employeeOptions.find(
                            (emp) => emp.employeeFullName === row.employeeFullName
                          ) || null
                        : field.value
                    }
                    onChange={(e, value) => !isEditing && field.onChange(value)}
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
                name="monthlySalary"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Monthly Salary"
                    type="number"
                    fullWidth
                    disabled
                  />
                )}
              />
            </Grid>

            <Grid item xs={6}>
              <Controller
                name="actualExposureDays"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Actual Exposure Days"
                    type="number"
                    fullWidth
                  />
                )}
              />
            </Grid>
            <Grid item xs={6}>
              <Controller
                name="riskLevel"
                control={control}
                render={({ field }) => (
                  <TextField {...field} label="Risk Level" select fullWidth>
                    <MenuItem value="High">High</MenuItem>
                    <MenuItem value="Low">Low</MenuItem>
                  </TextField>
                )}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Computed Amount"
                value={computeAmount().toLocaleString("en-PH", {
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
            disabled={mutation.isLoading || !activeRegion} // Disable if no region is selected
            sx={{
              background: 'linear-gradient(135deg, #375e38 0%, #2e4d30 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #2e4d30 0%, #1e3320 100%)',
              }
            }}
          >
            {mutation.isLoading ? (
              <CircularProgress size={20} color="inherit" />
            ) : !activeRegion ? (
              "Select Region First"
            ) : (
              isEditing ? "Update" : "Save"
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default SubsistenceAllowanceSTDialog;
