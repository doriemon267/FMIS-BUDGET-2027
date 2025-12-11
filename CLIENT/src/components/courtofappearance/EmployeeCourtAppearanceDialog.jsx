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
} from "@mui/material";
import { Controller, useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import CustomButton from "../../global/components/CustomButton";
import EditIcon from "@mui/icons-material/Edit";
import api from "../../config/api";
import { useUser } from "../../context/UserContext";

const EmployeeCourtAppearanceDialog = ({ row, endpoint, dataListName }) => {
  const isEditing = Boolean(row);
  const [open, setOpen] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [settings, setSettings] = useState(null);
  const { currentUser } = useUser();
  const queryClient = useQueryClient();

  const { control, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: {
      employee: row?.employee || null,
      positionTitle: row?.positionTitle || "",
      department: row?.department || "",
      division: row?.division || "",
      region: row?.region || "",
      noOfCourtAppearance: row?.noOfCourtAppearance || 0,
    },
  });

  const selectedEmployee = watch("employee");

  // Kunin muna ang active settings sa mount
  useEffect(() => {
    fetchSettings();
  }, []);

  // Kapag available na ang settings, at may fiscalYear, kunin ang mga empleyado
  useEffect(() => {
    if (settings && settings.fiscalYear) {
      fetchEmployees();
    }
  }, [settings]);

  useEffect(() => {
    if (selectedEmployee && !isEditing) {
      setValue("positionTitle", selectedEmployee.positionTitle || "");
      setValue("department", selectedEmployee.department || "");
      setValue("division", selectedEmployee.division || "");
      setValue("region", selectedEmployee.region || "");
    }
  }, [selectedEmployee, setValue, isEditing]);

  /**
   * Fetches the active settings from the API and sets the `settings` state with the result.
   * If no active settings are found, shows an error toast.
   */
  const fetchSettings = async () => {
    try {
      const res = await api.get("/settings/active");
      if (res.data) {
        setSettings(res.data);
      } else {
        toast.error("No active settings found.");
      }
    } catch (err) {
      toast.error("Failed to fetch settings.");
    }
  };

  const fetchEmployees = async () => {
    try {
      if (!settings || !settings.fiscalYear) {
        toast.error("Settings not loaded or fiscalYear is missing.");
        return;
      }
      const res = await api.get(`/getpersonnels?fiscalYear=${settings.fiscalYear}`);
      setEmployees(res.data);
    } catch (err) {
      toast.error("Failed to fetch employees.");
    }
  };

  const mutation = useMutation({
    mutationFn: async (data) => {
      if (!settings) {
        toast.error("Settings not loaded. Please try again.");
        return;
      }
      const processBy = `${currentUser.FirstName} ${currentUser.LastName}`;
      const processDate = new Date();
      const fiscalYear = settings.fiscalYear;
      const budgetType = settings.budgetType;

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
        noOfCourtAppearance: Number(data.noOfCourtAppearance),
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

  const employeeOptions = employees
    .filter((emp) => emp.employeeFullName)
    .map((emp, index) => ({
      ...emp,
      uniqueKey: emp._id ? `${emp._id}-${index}` : `unknown-${index}`,
    }));

  return (
    <>
      {!row ? (
        <CustomButton onClick={handleOpen} size="large">
          Add Court Appearance
        </CustomButton>
      ) : (
        <MenuItem
          onClick={handleOpen}
          disableRipple
          sx={{ display: "flex", gap: 1 }}
        >
          <EditIcon fontSize="small" />
          Edit
        </MenuItem>
      )}

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          {isEditing ? "Edit Court Appearance" : "Add Court Appearance"}
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
                    getOptionLabel={(option) => option.employeeFullName || ""}
                    isOptionEqualToValue={(option, value) =>
                      option._id === value._id
                    }
                    value={
                      isEditing
                        ? employeeOptions.find(
                            (emp) =>
                              emp.employeeFullName === row.employeeFullName
                          ) || null
                        : field.value || null
                    }
                    onChange={(e, value) => !isEditing && field.onChange(value)}
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
                        {option.employeeFullName}
                      </li>
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
                name="noOfCourtAppearance"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="No. of Court Appearances"
                    type="number"
                    fullWidth
                  />
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

export default EmployeeCourtAppearanceDialog;
