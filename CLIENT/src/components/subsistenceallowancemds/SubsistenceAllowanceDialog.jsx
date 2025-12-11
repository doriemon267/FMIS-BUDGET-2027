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
  Chip,
  Fade,
  CircularProgress,
} from "@mui/material";
import { Restaurant as RestaurantIcon, Add as AddIcon } from "@mui/icons-material";
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
  const [subsistenceRate, setSubsistenceRate] = useState(0);
  const [fiscalYearFromSettings, setFiscalYearFromSettings] = useState("");
  const [budgetTypeFromSettings, setBudgetTypeFromSettings] = useState("");

  const { control, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: {
      employee: row?.employee || null,
      positionTitle: row?.positionTitle || "",
    },
  });

  const selectedEmployee = watch("employee");

  const mutation = useMutation({
    mutationFn: async (data) => {
      const processBy = `${currentUser.FirstName} ${currentUser.LastName}`;
      const processDate = new Date();
      const fiscalYear = fiscalYearFromSettings;
      const budgetType = budgetTypeFromSettings;
      const payload = {
        employeeNumber: isEditing ? row.employeeNumber : data.employee.employeeNumber,
        employeeFullName: isEditing ? row.employeeFullName : data.employee.employeeFullName,
        positionTitle: isEditing ? row.positionTitle : data.employee.positionTitle,
        department: isEditing ? row.department : data.employee.department,
        division: isEditing ? row.division : data.employee.division,
        // Use active region if available, otherwise use employee's region
        region: activeRegion?.name || (isEditing ? row.region : data.employee.region),
        Amount: subsistenceRate,
        fiscalYear,
        processBy,
        processDate,
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
      queryClient.invalidateQueries({ queryKey: ["workflowProposals"] });
      toast.success(isEditing ? "Record updated" : "Record created");
      handleClose();
    },
    onError: (err) => {
      console.error("❌ Error submitting:", err);
      toast.error(err.response?.data?.error || "Something went wrong");
    },
  });

  const fetchEmployees = async () => {
    try {
      // Use region filtering if available
      const params = {};
      if (activeRegion?.name) {
        params.region = activeRegion.name;
      }
      
      const res = await api.get("/getpersonnelsmds/byParams", { params });
      setEmployees(res.data);
    } catch (error) {
      console.error("Error fetching employees:", error);
      // Fallback to fetching all employees if the filtered endpoint fails
      try {
        const fallbackRes = await api.get("/getpersonnelsmds");
        setEmployees(fallbackRes.data);
      } catch (fallbackErr) {
        console.error("Fallback error fetching employees:", fallbackErr);
      }
    }
  };

  const fetchActiveSettings = async () => {
    try {
      const res = await api.get("/settings/active");
      setSubsistenceRate(res.data.subsistenceAllowanceRate || 0);
      setFiscalYearFromSettings(res.data.fiscalYear || new Date().getFullYear().toString());
    } catch (error) {
      console.error("Error fetching settings:", error);
      setSubsistenceRate(0);
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchActiveSettings();
  }, [activeRegion]); // Re-fetch when region changes

  useEffect(() => {
    if (selectedEmployee && !isEditing) {
      setValue("positionTitle", selectedEmployee.positionTitle);
    }
  }, [selectedEmployee, setValue, isEditing]);

  const onSubmit = (data) => {
    mutation.mutate(data);
  };

  const handleOpen = () => setOpen(true);
  const handleClose = () => {
    reset();
    setOpen(false);
  };

  // Preprocess employees array to attach a unique key for each option
  const employeeOptions = employees
    .filter((e) => e.employeeFullName)
    .map((employee, index) => ({
      ...employee,
      uniqueKey: `${employee.employeeNumber}-${index}`,
    }));

  return (
    <>
      {!row ? (
        <CustomButton onClick={handleOpen} size="large">
          Add Subsistence
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
          background: 'linear-gradient(135deg, #375e38 0%, #2e4d30 100%)',
          color: 'white',
          fontWeight: 'bold'
        }}>
          <Box display="flex" alignItems="center" gap={2}>
            <RestaurantIcon />
            <Box>
              <Typography variant="h6" fontWeight="bold">
                {isEditing ? "Edit Subsistence Allowance" : "Add Subsistence Allowance"}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                {isEditing ? "Update employee subsistence allowance details" : "Add new subsistence allowance record"}
                {(activeRegion || assignmentLevel) && ` - ${getHierarchicalDisplay()}`}
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
                render={({ field }) => (
                  <Autocomplete
                    options={employeeOptions}
                    getOptionLabel={(option) => option.employeeFullName || ""}
                    isOptionEqualToValue={(option, value) =>
                      option.employeeNumber === value.employeeNumber
                    }
                    value={
                      isEditing
                        ? { employeeFullName: row.employeeFullName }
                        : field.value || null
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
            <Grid item xs={12}>
              <TextField
                label="Amount"
                value={
                  subsistenceRate
                    ? subsistenceRate.toLocaleString("en-PH", {
                        style: "currency",
                        currency: "PHP",
                      })
                    : "₱0.00"
                }
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
            disabled={mutation.isLoading}
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
    </>
  );
};

export default SubsistenceAllowanceDialog;
