import React, { useState, useEffect, useMemo } from "react";
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
  ChildCare as ChildrenIcon,
  Edit as EditIcon,
} from "@mui/icons-material";
import { Controller, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import CustomButton from "../../global/components/CustomButton";
import api from "../../config/api";
import { useUser } from "../../context/UserContext";

const validationSchema = yup.object({
  employee: yup
    .object()
    .nullable()
    .required("Please select an employee"),
  noOfDependents: yup
    .number()
    .required("Number of dependents is required")
    .min(0, "Number of dependents must be at least 0")
    .max(4, "Number of dependents cannot exceed 4")
    .integer("Number of dependents must be a whole number"),
});

const ChildrenAllowanceDialog = ({ row, schema, endpoint, dataListName }) => {
  const isEditing = Boolean(row);
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [formData, setFormData] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [personnelService, setPersonnelService] = useState(null);
  const { currentUser } = useUser();
  const queryClient = useQueryClient();
  const [employees, setEmployees] = useState([]);

  const { control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm({
    defaultValues: {
      employee: null,
      noOfDependents: isEditing ? row?.noOfDependents : 0,
    },
    resolver: yupResolver(validationSchema),
  });

  const noOfDependents = watch("noOfDependents");
  const selectedEmployee = watch("employee");

  // Fetch settings with polling to detect changes
  const { data: settingsData, isLoading: settingsLoading } = useQuery({
    queryKey: ["activeSettings"],
    queryFn: async () => {
      const res = await api.get("/settings/active");
      return res.data;
    },
    refetchInterval: 60000,
    enabled: open,
  });

  useEffect(() => {
    if (settingsData) {
      setSettings(settingsData);
    }
  }, [settingsData]);

  // Fetch employees
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Change this line to fetch only employees hired before June 1988
        const res = await api.get("/getpersonnels/hiredBeforeJune1988");
        setEmployees(res.data);
      } catch (err) {
        setError(err.message || "Failed to fetch employees");
        toast.error(err.message || "Failed to fetch employees");
        setEmployees([]);
      } finally {
        setLoading(false);
      }
    };

    if (open) {
      fetchData();
    }
  }, [open]);

  // Fetch PersonnelServices and fallback to MedicalAllowance for noOfDependent
  useEffect(() => {
    const fetchPersonnelService = async () => {
      if (!selectedEmployee || !settings?.fiscalYear) return;

      try {
        // First, try to get noOfDependent from PersonnelServices
        const personnelRes = await api.get("/personnel-services", {
          params: {
            employeeNumber: selectedEmployee.employeeNumber,
            fiscalYear: settings.fiscalYear,
          },
        });

        if (personnelRes.data.personnelServices && personnelRes.data.personnelServices.length > 0) {
          setPersonnelService(personnelRes.data.personnelServices[0]);
          const defaultDependents = personnelRes.data.personnelServices[0].noOfDependent || 0;
          if (defaultDependents > 0) {
            setValue("noOfDependents", defaultDependents, { shouldValidate: true });
            return;
          }
        } else {
          setPersonnelService(null);
        }

        // If no PersonnelServices record or noOfDependent is 0, fallback to MedicalAllowance
        const medicalAllowanceRes = await api.get("/medical-allowance", {
          params: {
            employeeNumber: selectedEmployee.employeeNumber,
            fiscalYear: settings.fiscalYear,
            budgetType: settings.budgetType,
          },
        });

        if (medicalAllowanceRes.data.data && medicalAllowanceRes.data.data.length > 0) {
          const defaultDependents = medicalAllowanceRes.data.data[0].noOfDependents || 0;
          setValue("noOfDependents", defaultDependents, { shouldValidate: true });
        } else {
          setValue("noOfDependents", 0, { shouldValidate: true });
        }
      } catch (err) {
        console.error("Error fetching PersonnelServices or MedicalAllowance:", err);
        setPersonnelService(null);
        setValue("noOfDependents", 0, { shouldValidate: true });
      }
    };

    fetchPersonnelService();
  }, [selectedEmployee, settings, setValue]);

  useEffect(() => {
    if (isEditing && row) {
      reset({
        employee: {
          employeeNumber: row.employeeNumber,
          employeeFullName: row.employeeFullName,
          positionTitle: row.positionTitle,
          department: row.department,
          division: row.division,
          region: row.region,
        },
        noOfDependents: row.noOfDependents || 0,
      });
    }
  }, [isEditing, row, reset]);

  const computeAmount = useMemo(() => {
    if (!settings || !settings.childrenAllowance || noOfDependents === undefined) return 0;
    const monthlyAmount = Number(settings.childrenAllowance) * Number(noOfDependents);
    return (monthlyAmount * 12).toFixed(2);
  }, [settings, noOfDependents]);

  const mutation = useMutation({
    mutationFn: async (data) => {
      if (!data.employee) throw new Error("Employee is required");
      if (!Number.isInteger(Number(data.noOfDependents))) throw new Error("Number of dependents must be an integer");

      const payload = {
        employeeNumber: data.employee.employeeNumber,
        employeeFullName: data.employee.employeeFullName,
        positionTitle: data.employee.positionTitle,
        department: data.employee.department,
        division: data.employee.division,
        region: data.employee.region,
        noOfDependents: Number(data.noOfDependents),
        amount: computeAmount,
        processBy: `${currentUser.FirstName} ${currentUser.LastName}`,
        processDate: new Date(),
        fiscalYear: settings?.fiscalYear,
        budgetType: settings?.budgetType,
      };

      return isEditing
        ? await api.put(`${endpoint}/${row._id}`, payload)
        : await api.post(endpoint, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [dataListName] });
      queryClient.invalidateQueries({ queryKey: ["personnelServices"] });
      toast.success(
        isEditing
          ? "Children allowance updated successfully"
          : "Children allowance created successfully"
      );
      handleClose();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || err.message || "Something went wrong");
    },
  });

  const onSubmit = (data) => {
    if (isEditing) {
      setFormData(data);
      setConfirmOpen(true);
    } else {
      mutation.mutate(data);
    }
  };

  const handleConfirmUpdate = () => {
    if (formData) {
      mutation.mutate(formData);
    }
    setConfirmOpen(false);
  };

  const handleOpen = () => setOpen(true);
  const handleClose = () => {
    reset();
    setOpen(false);
    setEmployees([]);
    setPersonnelService(null);
  };

  const handleConfirmClose = () => {
    setConfirmOpen(false);
    setFormData(null);
  };

  const employeeOptions = useMemo(() =>
    Array.isArray(employees)
      ? employees.map((emp) => ({
          ...emp,
          uniqueKey: emp._id || `emp-${Math.random().toString(36).substr(2, 9)}`,
        }))
      : [], [employees]);

  return (
    <>
      {!row ? (
        <CustomButton
          onClick={handleOpen}
          disabled={loading || !settings || settingsLoading || !!error}
        >
          {loading || settingsLoading ? <CircularProgress size={24} /> : "Add Children Allowance"}
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
            <ChildrenIcon />
            <Box>
              <Typography variant="h6" fontWeight="bold">
                {isEditing ? "Edit Children Allowance" : "Add Children Allowance"}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                {isEditing ? "Update employee children allowance details" : "Add new children allowance record"}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {loading || settingsLoading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Typography color="error" align="center" p={2}>
              {error}
            </Typography>
          ) : !settings ? (
            <Typography color="error" align="center" p={2}>
              Unable to load settings. Please try again later.
            </Typography>
          ) : (
            <Grid container spacing={2} sx={{ pt: 1 }}>
              <Grid item xs={12}>
                <Controller
                  name="employee"
                  control={control}
                  render={({ field }) => (
                    <Autocomplete
                      options={employeeOptions}
                      getOptionLabel={(opt) => opt.employeeFullName || ""}
                      isOptionEqualToValue={(opt, val) => opt._id === val._id}
                      value={field.value}
                      onChange={(_, val) => field.onChange(val)}
                      disabled={isEditing}
                      readOnly={isEditing}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Select Employee"
                          fullWidth
                          error={!!errors.employee}
                          helperText={errors.employee?.message || (!selectedEmployee && "Select an employee to auto-fill details")}
                          InputLabelProps={{ shrink: true }}
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
                  name="noOfDependents"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Number of Dependents"
                      type="number"
                      fullWidth
                      InputProps={{
                        inputProps: { 
                          min: 0, 
                          max: 4,
                          step: 1 
                        },
                      }}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        const validValue = isNaN(value) ? 0 : Math.min(Math.max(value, 0), 4);
                        field.onChange(validValue);
                        
                        // Recalculate amount when noOfDependents changes
                        if (settings?.childrenAllowance) {
                          const amount = validValue * settings.childrenAllowance;
                          setValue("amount", amount);
                        }
                      }}
                      error={!!errors.noOfDependents}
                      helperText={errors.noOfDependents?.message || "Maximum of 4 dependents allowed"}
                      InputLabelProps={{ shrink: true }}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={6}>
                <TextField
                  label="Amount (Annual)"
                  value={Number(computeAmount).toLocaleString("en-PH", {
                    style: "currency",
                    currency: "PHP",
                  })}
                  fullWidth
                  disabled
                  InputLabelProps={{ shrink: true }}
                  helperText={`Annual: ${noOfDependents} dependents × ${settings?.childrenAllowance || 0} PHP/month × 12 months = ${Number(computeAmount).toFixed(2)} PHP/year`}
                />
              </Grid>

              {selectedEmployee && (
                <>
                  <Grid item xs={6}>
                    <TextField
                      label="Employee Number"
                      value={selectedEmployee.employeeNumber || ""}
                      fullWidth
                      disabled
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      label="Employee Name"
                      value={selectedEmployee.employeeFullName || ""}
                      fullWidth
                      disabled
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      label="Position Title"
                      value={selectedEmployee.positionTitle || ""}
                      fullWidth
                      disabled
                      InputLabelProps={{ shrink: true }}
                      helperText={selectedEmployee && !selectedEmployee.positionTitle ? "No position title available" : ""}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      label="Department"
                      value={selectedEmployee.department || ""}
                      fullWidth
                      disabled
                      InputLabelProps={{ shrink: true }}
                      helperText={selectedEmployee && !selectedEmployee.department ? "No department available" : ""}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      label="Division"
                      value={selectedEmployee.division || ""}
                      fullWidth
                      disabled
                      InputLabelProps={{ shrink: true }}
                      helperText={selectedEmployee && !selectedEmployee.division ? "No division available" : ""}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      label="Region"
                      value={selectedEmployee.region || ""}
                      fullWidth
                      disabled
                      InputLabelProps={{ shrink: true }}
                      helperText={selectedEmployee && !selectedEmployee.region ? "No region available" : ""}
                    />
                  </Grid>
                </>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button
            onClick={handleClose}
            variant="outlined"
            sx={{ mr: 1 }}
            disabled={loading || mutation.isLoading || settingsLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit(onSubmit)}
            variant="contained"
            disabled={loading || mutation.isLoading || !settings || settingsLoading || !!error}
            sx={{
              background: 'linear-gradient(135deg, #375e38 0%, #2e4d30 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #2e4d30 0%, #1e3320 100%)',
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

      <Dialog
        open={confirmOpen}
        onClose={handleConfirmClose}
        maxWidth="md"
        fullWidth
        aria-labelledby="confirm-update-dialog-title"
      >
        <DialogTitle id="confirm-update-dialog-title">
          Confirm Update
        </DialogTitle>
        <DialogContent dividers>
          <Typography>
            Are you sure you want to update this children allowance record?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleConfirmClose} disabled={mutation.isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmUpdate}
            variant="contained"
            disabled={mutation.isLoading}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ChildrenAllowanceDialog;

