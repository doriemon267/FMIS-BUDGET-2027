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
} from "@mui/material";
import { Restaurant as RestaurantIcon } from "@mui/icons-material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
  const { currentUser, assignmentLevel } = useUser();
  const { activeRegion } = useRegion();

  const [annualAmount, setAnnualAmount] = useState(0);
  const [monthlyAmount, setMonthlyAmount] = useState(0);
  const [fiscalYearFromSettings, setFiscalYearFromSettings] = useState("");
  const [budgetTypeFromSettings, setBudgetTypeFromSettings] = useState("");

  const { control, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: { 
        employee: null, 
        positionTitle: "" 
    },
  });

  // FIX 1: Reset form when dialog opens or row changes
  useEffect(() => {
    if (open) {
      if (isEditing && row) {
        reset({
          employee: row, // Pass the whole row so Autocomplete finds the match
          positionTitle: row.positionTitle || "",
        });
      } else {
        reset({ employee: null, positionTitle: "" });
      }
    }
  }, [open, row, isEditing, reset]);

  const selectedEmployee = watch("employee");

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
      
      // FIX 2: Cleaner payload logic
      const targetEmployee = isEditing ? row : data.employee;
      
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
        // Include amounts if your backend expects them in the payload
        monthlyAmount,
        annualAmount
      };

      return isEditing
        ? await api.put(`${endpoint}/${row._id}`, payload)
        : await api.post(endpoint, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries([dataListName]);
      queryClient.invalidateQueries({ queryKey: ["allProposals"] });
      toast.success(isEditing ? "Record updated" : "Record created");
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

  // Update position title when employee selection changes
  useEffect(() => {
    if (selectedEmployee && !isEditing) {
      setValue("positionTitle", selectedEmployee.positionTitle || "");
    }
  }, [selectedEmployee, setValue, isEditing]);

  const onSubmit = (data) => mutation.mutate(data);
  const handleOpen = () => setOpen(true);
  const handleClose = () => {
    setOpen(false);
    reset();
  };

  const employeeOptions = employees
    .filter((e) => e.employeeFullName)
    .map((e, i) => ({ ...e, uniqueKey: `${e.employeeNumber}-${i}` }));

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
            <Grid item xs={12}>
              <Controller
                name="employee"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <Autocomplete
                    {...field}
                    options={employeeOptions}
                    disabled={isEditing}
                    getOptionLabel={(option) => option.employeeFullName || ""}
                    isOptionEqualToValue={(p, v) => p.employeeNumber === v?.employeeNumber}
                    onChange={(_, data) => field.onChange(data)}
                    renderInput={(params) => (
                      <TextField {...params} label="Select Employee" fullWidth required />
                    )}
                    renderOption={(props, option) => {
                        const { key, ...otherProps } = props; // Handle key properly
                        return (
                            <li key={option.uniqueKey} {...otherProps}>
                                {option.employeeFullName}
                            </li>
                        );
                    }}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller
                name="positionTitle"
                control={control}
                render={({ field }) => (
                  <TextField {...field} fullWidth label="Position Title" disabled />
                )}
              />
            </Grid>
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
            disabled={mutation.isPending || !selectedEmployee}
            sx={{ background: "linear-gradient(135deg, #2d5a3d 0%, #1e3d2a 100%)" }}
          >
            {mutation.isPending ? <CircularProgress size={20} color="inherit" /> : isEditing ? "Update" : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default SubsistenceAllowanceDialog;