import React, { useState, useEffect } from "react";
import {
  Box,
  Grid,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Divider,
  CircularProgress,
} from "@mui/material";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useQuery } from "@tanstack/react-query";
import api from "../../config/api";
import { useUser } from "../../context/UserContext";
import CustomButton from "../../global/components/CustomButton";
import CustomAutoComplete from "../../global/components/CustomAutoComplete";
import { toast } from "react-hot-toast";

const schema = yup.object().shape({
  employeeNumber: yup.string().required("Employee number is required"),
  employeeFullName: yup.string().required("Employee name is required"),
  positionTitle: yup.string().required("Position title is required"),
  department: yup.string().required("Department is required"),
  noOfDependents: yup
    .number()
    .required("Number of dependents is required")
    .min(0, "Minimum is 0")
    .max(4, "Maximum is 4")
    .integer("Number of dependents must be a whole number"),
  updatePersonnelService: yup.boolean(),
});

const MedicalAllowanceForm = ({ onSubmit, initialData, isEditing }) => {
  const { currentUser } = useUser();
  const [selectedEmployee, setzenSelectedEmployee] = useState(null);
  const [effectiveDependentCount, setEffectiveDependentCount] = useState(0);
  const [estimatedAmount, setEstimatedAmount] = useState(0);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      employeeNumber: initialData?.employeeNumber || "",
      employeeFullName: initialData?.employeeFullName || "",
      positionTitle: initialData?.positionTitle || "",
      department: initialData?.department || "",
      division: initialData?.division || "",
      noOfDependents: initialData?.noOfDependents || 0,
      updatePersonnelService: true,
    },
  });

  const noOfDependents = watch("noOfDependents");

  // Fetch active settings
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["activeSettings"],
    queryFn: async () => {
      const res = await api.get("/settings/active");
      return res.data;
    },
    staleTime: 300000,
    onError: () => {
      toast.error("Failed to load settings");
    },
  });

  // Fetch eligible employees (hired before June 1988)
  const { data: eligibleEmployees, isLoading: employeesLoading } = useQuery({
    queryKey: ["eligibleEmployees"],
    queryFn: async () => {
      const res = await api.get("/getpersonnels/hiredBeforeJune1988");
      return res.data;
    },
    enabled: !isEditing,
    staleTime: 300000,
    onError: () => {
      toast.error("Failed to load eligible employees");
    },
  });

  // Calculate effective dependent count and estimated amount
  useEffect(() => {
    const medicalRate = settings?.medicalAllowance ?? settings?.compensationSettingsId?.medicalAllowance;
    if (noOfDependents !== undefined && medicalRate) {
      const effective = Math.min(Number(noOfDependents), 4);
      setEffectiveDependentCount(effective);
      setEstimatedAmount(effective * medicalRate);
    }
  }, [noOfDependents, settings]);

  // Set form values when employee is selected
  useEffect(() => {
    if (selectedEmployee) {
      setValue("employeeNumber", selectedEmployee.employeeNumber);
      const fullName = `${selectedEmployee.lastName}, ${selectedEmployee.firstName} ${selectedEmployee.middleName || ''}`.trim();
      setValue("employeeFullName", fullName);
      setValue("positionTitle", selectedEmployee.positionTitle || '');
      setValue("department", selectedEmployee.department || '');
      setValue("division", selectedEmployee.division || '');
    }
  }, [selectedEmployee, setValue]);

  // Reset form when initialData changes
  useEffect(() => {
    if (initialData) {
      reset({
        employeeNumber: initialData.employeeNumber || "",
        employeeFullName: initialData.employeeFullName || "",
        positionTitle: initialData.positionTitle || "",
        department: initialData.department || "",
        division: initialData.division || "",
        noOfDependents: initialData.noOfDependents || 0,
        updatePersonnelService: true,
      });
      const medicalRate = settings?.medicalAllowance ?? settings?.compensationSettingsId?.medicalAllowance;
      if (initialData.noOfDependents !== undefined && medicalRate) {
        const effective = Math.min(Number(initialData.noOfDependents), 4);
        setEffectiveDependentCount(effective);
        setEstimatedAmount(effective * medicalRate);
      }
    }
  }, [initialData, reset, settings]);

  const handleFormSubmit = (data) => {
    const processBy = `${currentUser.FirstName} ${currentUser.LastName}`;
    const region = currentUser.Region;
    const processDate = new Date();
    const fiscalYear = settings?.fiscalYear || new Date().getFullYear().toString();

    const formData = {
      ...data,
      employeeId: selectedEmployee?._id || initialData?.employeeId,
      effectiveDependentCount,
      amount: estimatedAmount,
      region,
      processBy,
      processDate,
      fiscalYear,
      budgetType: settings?.budgetType || "Initial",
      status: "Not Submitted",
      previousMedicalAmount: initialData?.amount || 0,
    };

    onSubmit(formData);
  };

  return (
    <Box component="form" onSubmit={handleSubmit(handleFormSubmit)} sx={{ mt: 3, p: 2, bgcolor: '#fafafa', borderRadius: 2 }}>
      {(settingsLoading || employeesLoading) ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {!isEditing && (
            <Grid item xs={12}>
              <CustomAutoComplete
                control={control}
                name="employeeSelect"
                label="Select Employee (Hired before June 1988)"
                options={eligibleEmployees || []}
                getOptionLabel={(option) => `${option.lastName}, ${option.firstName} ${option.middleName || ''} (${option.employeeNumber})`.trim()}
                onChange={(_, value) => setSelectedEmployee(value)}
                renderOption={(props, option) => (
                  <li {...props} key={option._id}>
                    <Box>
                      <Typography variant="body1">
                        {`${option.lastName}, ${option.firstName} ${option.middleName || ''}`.trim()}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {option.employeeNumber} - {option.positionTitle}
                      </Typography>
                    </Box>
                  </li>
                )}
                error={!!errors.employeeSelect}
                helperText={errors.employeeSelect?.message || "Only employees hired before June 1988 are eligible"}
              />
            </Grid>
          )}

          <Grid item xs={12} sm={6}>
            <Controller
              name="employeeNumber"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Employee Number"
                  fullWidth
                  error={!!errors.employeeNumber}
                  helperText={errors.employeeNumber?.message}
                  disabled
                  variant="outlined"
                />
              )}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <Controller
              name="employeeFullName"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Employee Name"
                  fullWidth
                  error={!!errors.employeeFullName}
                  helperText={errors.employeeFullName?.message}
                  disabled
                  variant="outlined"
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
                  label="Position Title"
                  fullWidth
                  error={!!errors.positionTitle}
                  helperText={errors.positionTitle?.message}
                  disabled
                  variant="outlined"
                />
              )}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <Controller
              name="department"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Department"
                  fullWidth
                  error={!!errors.department}
                  helperText={errors.department?.message}
                  disabled
                  variant="outlined"
                />
              )}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <Controller
              name="division"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Division"
                  fullWidth
                  disabled
                  variant="outlined"
                />
              )}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <Controller
              name="noOfDependents"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Number of Dependents"
                  type="number"
                  fullWidth
                  error={!!errors.noOfDependents}
                  helperText={errors.noOfDependents?.message || "Maximum of 4 dependents"}
                  InputProps={{ inputProps: { min: 0, max: 4 } }}
                  variant="outlined"
                  onChange={(e) => {
                    const value = Math.min(Math.max(0, parseInt(e.target.value) || 0), 4);
                    field.onChange(value);
                  }}
                />
              )}
            />
          </Grid>

          <Grid item xs={12}>
            <Divider sx={{ my: 3 }} />
            <Typography variant="h6" color="primary">Medical Allowance Details</Typography>
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              label="Effective Dependent Count"
              value={effectiveDependentCount}
              fullWidth
              disabled
              variant="outlined"
              helperText="Maximum of 4 dependents"
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              label="Rate per Dependent"
              value={(settings?.medicalAllowance ?? settings?.compensationSettingsId?.medicalAllowance) ? `$${(settings?.medicalAllowance ?? settings?.compensationSettingsId?.medicalAllowance).toLocaleString()}` : "Loading..."}
              fullWidth
              disabled
              variant="outlined"
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              label="Estimated Medical Allowance Amount"
              value={estimatedAmount ? `$${estimatedAmount.toLocaleString()}` : "0"}
              fullWidth
              disabled
              variant="outlined"
              sx={{
                '& .MuiInputBase-input': {
                  fontWeight: 'bold',
                  color: '#264524',
                },
              }}
            />
          </Grid>

          <Grid item xs={12}>
            <Controller
              name="updatePersonnelService"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth variant="outlined">
                  <InputLabel>Update Personnel Service Record</InputLabel>
                  <Select
                    {...field}
                    label="Update Personnel Service Record"
                  >
                    <MenuItem value={true}>Yes</MenuItem>
                    <MenuItem value={false}>No</MenuItem>
                  </Select>
                  <FormHelperText>
                    If Yes, the medical allowance amount will be updated in the personnel service record
                  </FormHelperText>
                </FormControl>
              )}
            />
          </Grid>

          <Grid item xs={12} sx={{ display: "flex", justifyContent: "flex-end", mt: 3 }}>
            <CustomButton
              type="submit"
              variant="contained"
              disabled={settingsLoading || employeesLoading}
              sx={{ minWidth: 200 }}
            >
              {isEditing ? "Update Medical Allowance" : "Add Medical Allowance"}
            </CustomButton>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default MedicalAllowanceForm;