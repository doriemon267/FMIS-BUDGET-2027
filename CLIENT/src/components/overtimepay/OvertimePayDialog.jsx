import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { useTheme } from "@mui/material/styles";
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
} from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../config/api";
import { toast } from "react-hot-toast";
import { useUser } from "../../context/UserContext";
import { useRegion } from "../../context/RegionContext";
import EditIcon from "@mui/icons-material/Edit";
import OvertimeIcon from "@mui/icons-material/AccessTime";
import CustomButton from "../../global/components/CustomButton";

const OvertimePayDialog = ({ row, endpoint, dataListName, schema }) => {
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
  const queryClient = useQueryClient();
  const { currentUser } = useUser();
  const { activeRegion } = useRegion();

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

  const [overtimeRate, setOvertimeRate] = useState(100);
  const [weekdayMultiplier, setWeekdayMultiplier] = useState(1.25);
  const [weekendMultiplier, setWeekendMultiplier] = useState(1.5);
  const [employees, setEmployees] = useState([]);
  const [fiscalYearFromSettings, setFiscalYearFromSettings] = useState("");
  const [settings, setSettings] = useState(null);

  const { control, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: {
      employee: row?.employee || null,
      weekdayHours: row?.weekdayHours || 0,
      weekendHours: row?.weekendHours || 0,
      positionTitle: row?.positionTitle || "",
    },
  });

  const selectedEmployee = watch("employee");
  const weekdayHours = watch("weekdayHours");
  const weekendHours = watch("weekendHours");

  // fetch active settings
  const fetchActiveSettings = async () => {
    try {
      const res = await api.get("/settings/active");
      setOvertimeRate(res.data.overtimeRate || 100);
      setWeekdayMultiplier(res.data.weekdayMultiplier || 1.25);
      setWeekendMultiplier(res.data.weekendMultiplier || 1.5);
      setFiscalYearFromSettings(
        res.data.fiscalYear?.toString() || new Date().getFullYear().toString()
      );
      setSettings(res.data);
    } catch (error) {
      console.error("❌ Error fetching settings:", error);
      toast.error("Nabigo sa pagkuha ng active settings.");
    }
  };

  // fetch employees from PersonnelServices (same FY + Region/Department/Division as in PS)
  const fetchEmployees = async () => {
    if (!settings?.fiscalYear) return;
    try {
      const params = { fiscalYear: settings.fiscalYear };
      if (activeRegion?.name) params.region = activeRegion.name;
      const res = await api.get("/getpersonnels", { params });
      const list = res.data || [];
      setEmployees(list.filter(emp => !["Submitted", "Approved"].includes(emp.status)));
    } catch (err) {
      console.error("❌ Error fetching employees:", err);
      toast.error("Nabigo sa pagkuha ng personnel (PersonnelServices).");
    }
  };

  useEffect(() => {
    fetchActiveSettings();
  }, []);

  useEffect(() => {
    if (settings) {
      fetchEmployees();
    }
  }, [settings, activeRegion?.name]);

  const computeAmount = useCallback(() => {
    const wd = Math.min(Number(weekdayHours) || 0, 3);
    const we = Math.min(Number(weekendHours) || 0, 8);
    return wd * overtimeRate * weekdayMultiplier + we * overtimeRate * weekendMultiplier;
  }, [weekdayHours, weekendHours, overtimeRate, weekdayMultiplier, weekendMultiplier]);

  const mutation = useMutation({
    mutationFn: async (data) => {
      const payload = {
        employeeFullName: isEditing
          ? row.employeeFullName
          : data.employee.employeeFullName,
        positionTitle: isEditing
          ? row.positionTitle
          : data.employee.positionTitle,
        weekdayHours: Number(data.weekdayHours),
        weekendHours: Number(data.weekendHours),
        amount: computeAmount(),
        fiscalYear: fiscalYearFromSettings,
        processBy: `${currentUser.FirstName} ${currentUser.LastName}`,
        processDate: new Date(),
        budgetType: settings?.budgetType,
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
      console.error("❌ Error submitting:", err);
      toast.error(err.response?.data?.error || "May problema sa proseso.");
    },
  });

  const onSubmit = (data) => mutation.mutate(data);

  const handleOpen = () => {
    reset(); 
    setOpen(true);
  };
  const handleClose = () => {
    reset();
    setOpen(false);
  };

  // prepare Autocomplete options
  const employeeOptions = useMemo(
    () =>
      employees.map((emp, idx) => ({
        ...emp,
        uniqueKey: emp.EmployeeID ? `${emp.EmployeeID}-${idx}` : `unknown-${idx}`,
      })),
    [employees]
  );

  return (
    <>
      {!row ? (
        <CustomButton onClick={handleOpen} size="large">
          Add Overtime
        </CustomButton>
      ) : (
        <MenuItem onClick={handleOpen} disableRipple sx={{ display: "flex", gap: 1 }}>
          <EditIcon fontSize="small" /> Edit
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
          fontWeight: 'bold',
          py: 2
        }}>
          <Box display="flex" alignItems="center" gap={2}>
            <OvertimeIcon sx={{ fontSize: '2rem' }} />
            <Box>
              <Typography variant="h6" fontWeight="bold">
                {isEditing ? "Edit Overtime Pay" : "Add Overtime Pay"}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                {isEditing ? "Update employee overtime pay details" : "Add new overtime pay record"}
                {getOrganizationalDisplay() && ` - ${getOrganizationalDisplay()}`}
              </Typography>
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
                    options={employeeOptions}
                    getOptionLabel={(opt) => opt.employeeFullName || ""}
                    isOptionEqualToValue={(opt, val) =>
                      opt.EmployeeID === val.EmployeeID
                    }
                    value={
                      isEditing
                        ? employeeOptions.find(
                            (e) => e.employeeFullName === row.employeeFullName
                          ) || null
                        : field.value || null
                    }
                    onChange={(e, val) => !isEditing && field.onChange(val)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Select Employee"
                        fullWidth
                        disabled={isEditing}
                      />
                    )}
                    renderOption={(props, option) => (
                      <li {...props} key={option.uniqueKey}>
                        <Box>
                          <Typography variant="body1">{option.employeeFullName}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {option.positionTitle}
                          </Typography>
                        </Box>
                      </li>
                    )}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller
                name="positionTitle"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="Position Title"
                    value={field.value || ""}
                    disabled
                  />
                )}
              />
            </Grid>
            <Grid item xs={6}>
              <Controller
                name="weekdayHours"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="Weekday Hours"
                    type="number"
                  />
                )}
              />
            </Grid>
            <Grid item xs={6}>
              <Controller
                name="weekendHours"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="Weekend Hours"
                    type="number"
                  />
                )}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Amount"
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
          <Button onClick={handleClose} variant="outlined" sx={{ mr: 1 }}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit(onSubmit)}
            variant="contained"
            disabled={mutation.isLoading}
            sx={{
              background: buttonGradient,
              color: 'white',
              '&:hover': {
                background: buttonHoverGradient,
              }
            }}
          >
            {mutation.isLoading ? "Saving..." : (isEditing ? "Update" : "Save")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default OvertimePayDialog;
