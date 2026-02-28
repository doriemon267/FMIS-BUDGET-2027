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
  LocalHospital as MedicalIcon,
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
import { useRegion } from "../../context/RegionContext";

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

const MedicalAllowanceDialog = ({ row, schema, endpoint, dataListName }) => {
  const isEditing = Boolean(row);
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [formData, setFormData] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [duplicateCheck, setDuplicateCheck] = useState(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [personnelService, setPersonnelService] = useState(null);
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
  const [employees, setEmployees] = useState([]);
  // Add state for tracking children allowance record
  const [childrenAllowanceRecord, setChildrenAllowanceRecord] = useState(null);
  const [dependentsMismatch, setDependentsMismatch] = useState(false);

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
  const { data: settingsData, isLoading: settingsLoading, error: settingsError } = useQuery({
    queryKey: ["activeSettings"],
    queryFn: async () => {
      const res = await api.get("/settings/active");
      return res.data;
    },
    refetchInterval: 60000,
    enabled: open,
    onError: (err) => {
      toast.error("Failed to load settings: " + (err.message || "Unknown error"));
      setError("Failed to load settings");
    },
  });

  useEffect(() => {
    if (settingsData) {
      // console.log("Settings fetched:", settingsData);
      setSettings(settingsData);
      setError(null);
    }
  }, [settingsData]);

  // Fetch eligible employees (hired before June 1988) for the current fiscal year
  useEffect(() => {
    const fetchData = async () => {
      if (!settings?.fiscalYear) {
        // Wait for settings to load
        return;
      }
      
      setLoading(true);
      setError(null);
      try {
        const res = await api.get("/getpersonnels/hiredBeforeJune1988", {
          params: {
            fiscalYear: settings.fiscalYear
          }
        });
        
        // Ensure all employees have the current fiscal year
        const employeesWithFiscalYear = res.data.map(emp => ({
          ...emp,
          fiscalYear: settings.fiscalYear
        }));
        
        setEmployees(employeesWithFiscalYear);
      } catch (err) {
        const errorMsg = err.message || "Failed to fetch employees";
        setError(errorMsg);
        toast.error(errorMsg);
        setEmployees([]);
      } finally {
        setLoading(false);
      }
    };

    if (open && settings) {
      fetchData();
    }
  }, [open, settings]);

  // Fetch PersonnelServices and fallback to ChildrenAllowance for noOfDependent
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

        // If no PersonnelServices record or noOfDependent is 0, fallback to ChildrenAllowance
        const childrenAllowanceRes = await api.get("/children-allowance", {
          params: {
            employeeNumber: selectedEmployee.employeeNumber,
            fiscalYear: settings.fiscalYear,
            budgetType: settings.budgetType,
          },
        });

        if (childrenAllowanceRes.data.data && childrenAllowanceRes.data.data.length > 0) {
          const defaultDependents = childrenAllowanceRes.data.data[0].noOfDependents || 0;
          setValue("noOfDependents", defaultDependents, { shouldValidate: true });
        } else {
          setValue("noOfDependents", 0, { shouldValidate: true });
        }
      } catch (err) {
        console.error("Error fetching PersonnelServices or ChildrenAllowance:", err);
        setPersonnelService(null);
        setValue("noOfDependents", 0, { shouldValidate: true });
      }
    };

    fetchPersonnelService();
  }, [selectedEmployee, settings, setValue]);

  // Check for existing MedicalAllowance record when employee is selected
  useEffect(() => {
    const checkDuplicate = async () => {
      if (!selectedEmployee || isEditing || !settings?.fiscalYear || !settings?.budgetType) return;

      setCheckingDuplicate(true);
      try {
        const res = await api.get("/medical-allowance", {
          params: {
            search: selectedEmployee.employeeNumber,
            fiscalYear: settings.fiscalYear,
            budgetType: settings.budgetType,
            limit: 100
          },
        });
        
        // Check if any of the returned records match this employee exactly
        const existingRecord = res.data.data.find(record => 
          record.employeeNumber === selectedEmployee.employeeNumber &&
          record.fiscalYear === settings.fiscalYear &&
          record.budgetType === settings.budgetType
        );
        
        if (existingRecord) {
          setDuplicateCheck(`A medical allowance record already exists for ${selectedEmployee.employeeFullName} in ${settings.fiscalYear} (${settings.budgetType})`);
        } else {
          setDuplicateCheck(null);
        }
      } catch (err) {
        console.error("Error checking for duplicate:", err);
        setDuplicateCheck("Unable to check for existing records");
      } finally {
        setCheckingDuplicate(false);
      }
    };

    checkDuplicate();
  }, [selectedEmployee, settings, isEditing]);

  // Check for existing Children Allowance record when employee is selected
  useEffect(() => {
    const checkChildrenAllowance = async () => {
      if (!selectedEmployee || !settings?.fiscalYear || isEditing) return;
      
      try {
        const res = await api.get("/children-allowance", {
          params: {
            employeeNumber: selectedEmployee.employeeNumber,
            fiscalYear: settings.fiscalYear,
            budgetType: settings.budgetType,
          },
        });
        
        if (res.data.data && res.data.data.length > 0) {
          const childrenRecord = res.data.data[0];
          setChildrenAllowanceRecord(childrenRecord);
          
          // Set the number of dependents to match children allowance
          setValue("noOfDependents", childrenRecord.noOfDependents, { shouldValidate: true });
        } else {
          setChildrenAllowanceRecord(null);
        }
      } catch (err) {
        console.error("Error checking children allowance:", err);
        setChildrenAllowanceRecord(null);
      }
    };
    
    checkChildrenAllowance();
  }, [selectedEmployee, settings, isEditing, setValue]);

  // Check for mismatch when noOfDependents changes
  useEffect(() => {
    if (childrenAllowanceRecord && noOfDependents !== childrenAllowanceRecord.noOfDependents) {
      setDependentsMismatch(true);
    } else {
      setDependentsMismatch(false);
    }
  }, [noOfDependents, childrenAllowanceRecord]);

  useEffect(() => {
    if (isEditing && row) {
      reset({
        employee: {
          _id: row.employeeId,
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

  useEffect(() => {
    if (selectedEmployee && !isEditing && !personnelService) {
      setValue("noOfDependents", 0, { shouldValidate: true });
    }
  }, [selectedEmployee, personnelService, setValue, isEditing]);

  const computeAmount = useMemo(() => {
    // Check both locations: direct settings (legacy) or populated compensationSettingsId (new architecture)
    const medicalRate = settings?.medicalAllowance ?? settings?.compensationSettingsId?.medicalAllowance;
    if (!settings || !medicalRate || noOfDependents === undefined) return 0;
    return (Number(medicalRate) * Number(noOfDependents) * 12).toFixed(2);
  }, [settings, noOfDependents]);

  const mutation = useMutation({
    mutationFn: async (data) => {
      if (!data.employee) throw new Error("Employee is required");
      if (!data.employee.employeeNumber) throw new Error("Employee number is missing");
      if (!Number.isInteger(Number(data.noOfDependents))) throw new Error("Number of dependents must be an integer");
      if (!settings?.fiscalYear || !settings?.budgetType) throw new Error("Fiscal year and budget type are required");

      const payload = {
        employeeId: data.employee._id,
        employeeNumber: data.employee.employeeNumber,
        employeeFullName: data.employee.employeeFullName,
        positionTitle: data.employee.positionTitle,
        department: data.employee.department,
        division: data.employee.division,
        region: data.employee.region,
        noOfDependents: Number(data.noOfDependents),
        amount: Number(computeAmount),
        processBy: `${currentUser.FirstName} ${currentUser.LastName}`,
        processDate: new Date().toISOString(),
        fiscalYear: settings.fiscalYear,
        budgetType: settings.budgetType,
      };

      return isEditing
        ? await api.put(`${endpoint}/${row._id}`, payload)
        : await api.post(endpoint, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [dataListName] });
      queryClient.invalidateQueries({ queryKey: ["personnelServices"] });
      // Invalidate proposal queries so NewProposalWorkflowPage updates totals
      queryClient.invalidateQueries({ queryKey: ["allProposals"] });
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      queryClient.invalidateQueries({ queryKey: ["workflowProposals"] });
      // Invalidate for BudgetarySupportTable, Comprehensive Reports
      queryClient.invalidateQueries({ queryKey: ["personnel-services-combined"] });
      queryClient.invalidateQueries({ queryKey: ["calculated-budgetary-support"] });
      queryClient.invalidateQueries({ queryKey: ["comprehensive-report-data"] });
      toast.success(
        isEditing
          ? "Medical allowance updated successfully"
          : "Medical allowance created successfully"
      );
      handleClose();
    },
    onError: (err) => {
      console.error("Mutation error:", err);
      const errorMessage = err.response?.data?.error || err.response?.data?.message || err.message || "Failed to save medical allowance";
      toast.error(errorMessage);
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
    setError(null);
    setDuplicateCheck(null);
    setCheckingDuplicate(false);
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
        <CustomButton onClick={handleOpen} size="large">
          Add Medical Allowance
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
            <MedicalIcon />
            <Box>
              <Typography variant="h6" fontWeight="bold">
                {isEditing ? "Edit Medical Allowance" : "Add Medical Allowance"}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                {isEditing ? "Update employee medical allowance details" : "Add new medical allowance record"}
                {getOrganizationalDisplay() && ` - ${getOrganizationalDisplay()}`}
              </Typography>
              {settings?.fiscalYear && (
                <Typography variant="caption" sx={{ opacity: 0.8, display: 'block', mt: 0.5, fontWeight: 'bold', color: '#ffeb3b' }}>
                  Fiscal Year: {settings.fiscalYear} {settings.budgetType ? `(${settings.budgetType})` : ''}
                </Typography>
              )}
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {settings?.fiscalYear && (
            <Box sx={{ 
              p: 2, 
              mb: 2, 
              bgcolor: '#fff9c4', 
              borderRadius: 1, 
              border: '1px solid #ffd54f',
              textAlign: 'center'
            }}>
              <Typography variant="body2" fontWeight="medium">
                You are viewing and creating records for <strong>Fiscal Year {settings.fiscalYear}</strong>. 
                Only employees from this fiscal year will be shown.
              </Typography>
            </Box>
          )}
          
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
              {duplicateCheck && !isEditing && (
                <Grid item xs={12}>
                  <Typography color="error" align="center">
                    {duplicateCheck}
                  </Typography>
                </Grid>
              )}
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
                          label="Select Employee (Hired before June 1988)"
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
                        const medicalRate = settings?.medicalAllowance ?? settings?.compensationSettingsId?.medicalAllowance;
                        if (medicalRate) {
                          const amount = validValue * medicalRate;
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
                  label="Amount"
                  value={Number(computeAmount).toLocaleString("en-PH", {
                    style: "currency",
                    currency: "PHP",
                  })}
                  fullWidth
                  disabled
                  InputLabelProps={{ shrink: true }}
                  helperText={`Amount: ${noOfDependents} dependents × ${settings?.medicalAllowance || 0} PHP/month × 12 months = ${Number(computeAmount).toFixed(2)} PHP/year`}
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
              {childrenAllowanceRecord && dependentsMismatch && (
                <Grid item xs={12}>
                  <Typography color="error" variant="body2">
                    Warning: Number of dependents does not match Children Allowance record ({childrenAllowanceRecord.noOfDependents}). 
                    Both records should have the same number of dependents.
                  </Typography>
                </Grid>
              )}
            </Grid>
          )}
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
            disabled={loading || mutation.isLoading || !settings || settingsLoading || !!error || !!duplicateCheck || checkingDuplicate || dependentsMismatch}
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
            Are you sure you want to update this medical allowance record?
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

export default MedicalAllowanceDialog;
