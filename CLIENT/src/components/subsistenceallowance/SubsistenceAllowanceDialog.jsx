import React, { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  TextField,
  Autocomplete,
  MenuItem,
  Box,
  Typography,
  CircularProgress,
  Chip,
  Alert,
} from "@mui/material";
import { Restaurant as RestaurantIcon, Clear as ClearIcon } from "@mui/icons-material";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import api from "../../config/api";
import { toast } from "react-hot-toast";
import { useUser } from "../../context/UserContext";
import { useRegion } from "../../context/RegionContext";
import EditIcon from "@mui/icons-material/Edit";
import CustomButton from "../../global/components/CustomButton";

const SubsistenceAllowanceDialog = ({ row, endpoint, dataListName, schema }) => {
  const isEditing = Boolean(row);
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const [employees, setEmployees] = useState([]);
  const [addedEmployeesSet, setAddedEmployeesSet] = useState(new Set());
  const { currentUser, assignmentLevel } = useUser();
  const { activeRegion } = useRegion();

  const [annualAmount, setAnnualAmount] = useState(0);
  const [monthlyAmount, setMonthlyAmount] = useState(0);
  const [fiscalYearFromSettings, setFiscalYearFromSettings] = useState("");
  const [budgetTypeFromSettings, setBudgetTypeFromSettings] = useState("");

  const { control, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: { 
        employees: [],  // Always an array for consistency
        positionTitle: "" 
    },
  });

  // Fetch already-added employees to filter them out
  const { data: existingEntries = [] } = useQuery({
    queryKey: [dataListName, "all"],
    queryFn: async () => {
      try {
        const res = await api.get(endpoint);
        const entries = res.data || [];
        // Ensure we always return an array
        return Array.isArray(entries) ? entries : [];
      } catch (error) {
        return [];
      }
    },
  });

  // Update addedEmployeesSet whenever existing entries change
  useEffect(() => {
    // Safely check if existingEntries is an array before mapping
    if (Array.isArray(existingEntries) && existingEntries.length > 0) {
      const employeeNumbers = new Set(
        existingEntries.map((entry) => entry?.employeeNumber).filter(Boolean)
      );
      setAddedEmployeesSet(employeeNumbers);
    } else {
      setAddedEmployeesSet(new Set());
    }
  }, [existingEntries]);

  // FIX 1: Reset form when dialog opens or row changes
  useEffect(() => {
    if (open) {
      if (isEditing && row) {
        reset({
          employees: [row], // Pass as array even for edit mode
          positionTitle: row.positionTitle || "",
        });
      } else {
        reset({ employees: [], positionTitle: "" });
      }
    }
  }, [open, row, isEditing, reset]);

  const selectedEmployees = Array.isArray(watch("employees")) ? watch("employees") : [];

  const getHierarchicalDisplay = () => {
    const hierarchical = currentUser?.hierarchicalAccess || {};
    switch (assignmentLevel) {
      case "DIVISION":
        return `Division: ${hierarchical.accessibleDivisions?.[0]?.divisionName || currentUser?.divisionName || "N/A"}`;
      case "DEPARTMENT":
        return `Department: ${hierarchical.accessibleDepartments?.[0]?.departmentName || "N/A"}`;
      case "REGION":
        return `Region: ${hierarchical.accessibleRegions?.[0]?.regionName || activeRegion?.name || "N/A"}`;
      case "FULL":
        return "Full Access: All Data";
      default:
        return `Region: ${activeRegion?.name || "N/A"}`;
    }
  };

  const mutation = useMutation({
    mutationFn: async (data) => {
      const processBy = `${currentUser?.FirstName || ""} ${currentUser?.LastName || ""}`.trim();
      const processDate = new Date();
      
      if (isEditing) {
        // Single edit
        const targetEmployee = row;
        const payload = {
          employeeNumber: targetEmployee.employeeNumber,
          employeeFullName: targetEmployee.employeeFullName,
          positionTitle: data.positionTitle || targetEmployee.positionTitle,
          department: targetEmployee.department,
          division: targetEmployee.division,
          region: activeRegion?.name || targetEmployee.region,
          fiscalYear: fiscalYearFromSettings,
          processBy,
          processDate,
          budgetType: budgetTypeFromSettings,
          monthlyAmount,
          annualAmount
        };
        return await api.put(`${endpoint}/${row._id}`, payload);
      } else {
        // Bulk add multiple employees
        if (data.employees.length === 0) {
          throw new Error("Please select at least one employee");
        }

        const payloads = data.employees.map((employee) => ({
          employeeNumber: employee.employeeNumber,
          employeeFullName: employee.employeeFullName,
          positionTitle: employee.positionTitle,
          department: employee.department,
          division: employee.division,
          region: activeRegion?.name || employee.region,
          fiscalYear: fiscalYearFromSettings,
          processBy,
          processDate,
          budgetType: budgetTypeFromSettings,
          monthlyAmount,
          annualAmount
        }));

        // Send bulk add request
        return await api.post(`${endpoint}/bulk`, { entries: payloads });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries([dataListName]);
      queryClient.invalidateQueries({ queryKey: [dataListName, "all"] });
      queryClient.invalidateQueries({ queryKey: ["allProposals"] });
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      queryClient.invalidateQueries({ queryKey: ["workflowProposals"] });
      queryClient.invalidateQueries({ queryKey: ["personnel-services-combined"] });
      queryClient.invalidateQueries({ queryKey: ["calculated-budgetary-support"] });
      queryClient.invalidateQueries({ queryKey: ["comprehensive-report-data"] });
      toast.success(isEditing ? "Record updated" : `${selectedEmployees.length} record(s) created`);
      handleClose();
    },
    onError: (err) => {
      console.error("Error submitting:", err);
      toast.error(err.response?.data?.message || "Something went wrong");
    },
  });

  const fetchActiveSettings = async () => {
    try {
      const res = await api.get("/settings/active");
      const compensation = res.data?.compensationSettingsId;
      const monthly = Number(compensation?.subsistenceAllowance) || 0;
      setMonthlyAmount(monthly);
      setAnnualAmount(monthly * 12);
      setFiscalYearFromSettings(res.data?.fiscalYear || new Date().getFullYear().toString());
      setBudgetTypeFromSettings(res.data?.budgetType || "Initial");
    } catch (error) {
      console.error("Settings Error:", error);
    }
  };

  const fetchEmployees = async () => {
    if (!fiscalYearFromSettings) return;
    try {
      const params = { fiscalYear: fiscalYearFromSettings };
      if (activeRegion?.name) params.region = activeRegion.name;
      const res = await api.get("/getpersonnels", { params });
      const list = res.data || [];
      setEmployees(list);
    } catch (error) {
      setEmployees([]);
    }
  };

  useEffect(() => {
    fetchActiveSettings();
  }, []);

  useEffect(() => {
    if (fiscalYearFromSettings) fetchEmployees();
  }, [fiscalYearFromSettings, activeRegion?.name]);

  const onSubmit = (data) => mutation.mutate(data);
  const handleOpen = () => setOpen(true);
  const handleClose = () => {
    setOpen(false);
    reset();
  };

  // Filter out already-added employees
  const availableEmployees = employees
    .filter((e) => e.employeeFullName && !addedEmployeesSet.has(e.employeeNumber))
    .map((e, i) => ({ ...e, uniqueKey: `${e.employeeNumber}-${i}` }));

  const duplicateCount = selectedEmployees.filter((emp) => addedEmployeesSet.has(emp.employeeNumber)).length;

  return (
    <>
      {!row ? (
        <CustomButton onClick={handleOpen} size="large">Add Subsistence</CustomButton>
      ) : (
        <MenuItem onClick={handleOpen} disableRipple sx={{ display: "flex", gap: 1 }}>
          <EditIcon fontSize="small" /> Edit
        </MenuItem>
      )}

      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle sx={{ background: "linear-gradient(135deg, #2d5a3d 0%, #1e3d2a 100%)", color: "white" }}>
          <Box display="flex" alignItems="center" gap={2}>
            <RestaurantIcon />
            <Box>
              <Typography variant="h6" fontWeight="bold">
                {isEditing ? "Edit Subsistence Allowance" : "Add Subsistence Allowance"}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                {getHierarchicalDisplay()}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent dividers sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            {!isEditing && addedEmployeesSet.size > 0 && (
              <Grid item xs={12}>
                <Alert severity="info" onClose={() => {}}>
                  <Typography variant="body2">
                    <strong>{addedEmployeesSet.size}</strong> employee(s) already have subsistence allowance. They won't appear in the dropdown.
                  </Typography>
                </Alert>
              </Grid>
            )}
            <Grid item xs={12}>
              <Controller
                name="employees"
                control={control}
                rules={{ required: isEditing ? false : "Select at least one employee" }}
                render={({ field }) => (
                  <Autocomplete
                    {...field}
                    multiple={true}
                    disabled={isEditing}
                    options={availableEmployees}
                    getOptionLabel={(option) => option?.employeeFullName || ""}
                    isOptionEqualToValue={(p, v) => p?.employeeNumber === v?.employeeNumber}
                    onChange={(e, data) => field.onChange(data || [])}
                    value={Array.isArray(field.value) ? field.value : []}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label={isEditing ? "Employee" : "Select Employees (Add multiple)"}
                        fullWidth
                        required={!isEditing}
                      />
                    )}
                    renderOption={(props, option) => {
                      const { key, ...otherProps } = props;
                      return (
                        <li key={option.uniqueKey} {...otherProps}>
                          {option.employeeFullName}
                        </li>
                      );
                    }}
                    renderTags={(value, getTagProps) => {
                      const validValue = Array.isArray(value) ? value : [];
                      return validValue.map((option, index) => (
                        <Chip
                          label={option?.employeeFullName || ""}
                          {...getTagProps({ index })}
                          key={option?.uniqueKey || index}
                          onDelete={() => {
                            const newValues = validValue.filter((_, i) => i !== index);
                            field.onChange(newValues);
                          }}
                          variant="outlined"
                          size="small"
                        />
                      ));
                    }}
                  />
                )}
              />
              {!isEditing && selectedEmployees && selectedEmployees.length > 0 && (
                <Typography variant="caption" sx={{ mt: 1, display: "block", color: "#2d5a3d", fontWeight: "bold" }}>
                  ✓ {selectedEmployees.length} employee(s) selected
                </Typography>
              )}
            </Grid>
            {isEditing && (
              <Grid item xs={12} sm={6}>
                <Controller
                  name="positionTitle"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth label="Position Title" disabled />
                  )}
                />
              </Grid>
            )}
            <Grid item xs={12} sm={6}>
              <TextField
                label="Monthly (Compensation)"
                value={monthlyAmount.toLocaleString("en-PH", { style: "currency", currency: "PHP" })}
                fullWidth
                disabled
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Annual (× 12)"
                value={annualAmount.toLocaleString("en-PH", { style: "currency", currency: "PHP" })}
                fullWidth
                disabled
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ p: 3 }}>
          <Button onClick={handleClose} variant="outlined">Cancel</Button>
          <Button
            onClick={handleSubmit(onSubmit)}
            variant="contained"
            disabled={mutation.isPending || (isEditing ? false : !selectedEmployees || selectedEmployees.length === 0)}
            sx={{ background: "linear-gradient(135deg, #2d5a3d 0%, #1e3d2a 100%)" }}
          >
            {mutation.isPending ? <CircularProgress size={20} color="inherit" /> : isEditing ? "Update" : `Add (${selectedEmployees?.length || 0})`}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default SubsistenceAllowanceDialog;