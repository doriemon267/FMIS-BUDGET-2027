import React, { useEffect, useState, useMemo, useCallback } from "react";
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
} from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../config/api";
import { toast } from "react-hot-toast";
import { useUser } from "../../context/UserContext";
import { useRegion } from "../../context/RegionContext";
import EditIcon from "@mui/icons-material/Edit";
import CustomButton from "../../global/components/CustomButton";

const OvertimePayDialog = ({ row, endpoint, dataListName, schema }) => {
  const isEditing = Boolean(row);
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { currentUser } = useUser();
  const { activeRegion } = useRegion();

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

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>{isEditing ? "Edit Overtime Pay" : "Add Overtime Pay"}</DialogTitle>
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
        <DialogActions>
          <Button onClick={handleSubmit(onSubmit)} variant="contained">
            {isEditing ? "Update" : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default OvertimePayDialog;
