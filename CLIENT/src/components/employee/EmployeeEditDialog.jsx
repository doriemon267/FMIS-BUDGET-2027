import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  Grid,
  Stepper,
  Step,
  StepLabel,
  CircularProgress,
  Card,
  CardContent,
  Avatar,
  Chip,
  Divider,
  Alert,
  Paper,
  MenuItem,
  InputAdornment,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import {
  FormProvider,
  useForm,
} from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import CloseIcon from "@mui/icons-material/Close";
import BadgeIcon from "@mui/icons-material/Badge";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import EditIcon from "@mui/icons-material/Edit";
import api from "../../config/api";
import CustomTextField from "../../global/components/CustomTextField";
import CustomAutoComplete from "../../global/components/CustomAutoComplete";
import ActiveRegionDisplay from "../common/ActiveRegionDisplay";
import { useThemeContext } from "../../context/ThemeContext";
import { useRegion } from "../../context/RegionContext";
import { useUser } from "../../context/UserContext";

const EmployeeEditDialog = ({ row, dataListName, parentClose, onDataChange }) => {
  const theme = useTheme();
  const { mode } = useThemeContext();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [stepOptions, setStepOptions] = useState([]);
  const [salaryData, setSalaryData] = useState(null);
  const [activeStep, setActiveStep] = useState(0);
  const [activeSettings, setActiveSettings] = useState(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [formDataToSave, setFormDataToSave] = useState(null);
  const { activeRegion } = useRegion();
  const { currentUser } = useUser();
  const queryClient = useQueryClient();

  // Dynamic options for Division and Section based on Department
  const [divisionOptions, setDivisionOptions] = useState([]);
  const [sectionOptions, setSectionOptions] = useState([]);
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [positionOptions, setPositionOptions] = useState([]);
  const [organizationStructure, setOrganizationStructure] = useState(null);

  // Initialize react-hook-form with existing employee data
  const methods = useForm({
    defaultValues: {
      EmployeeID: row?.EmployeeID || "",
      EmployeeFullName: row?.EmployeeFullName || "",
      Region: row?.Region || "",
      Department: row?.Department || "",
      Division: row?.Division || "",
      Section: row?.Section || "",
      PositionTitle: row?.PositionTitle || "",
      StatusOfAppointment: row?.StatusOfAppointment || "",
      DateOfAppointment: row?.DateOfAppointment || "",
      DateOfBirth: row?.DateOfBirth || "",
      Status: row?.Status || "Active",
      SG: row?.SG || "",
      JG: row?.JG || "",
      Step: row?.Step || "",
      Rate: row?.Rate || "",
    },
  });

  const {
    watch,
    setValue,
    handleSubmit,
    control,
    formState: { errors },
    trigger,
  } = methods;

  // Watch all form values for the review step
  const watchedValues = watch();

  // Debug activeStep changes
  useEffect(() => {
    console.log("🔄 activeStep changed to:", activeStep);
    console.log("📋 Total steps:", steps.length);
    console.log("🎯 Is final step?", activeStep === steps.length - 1);
  }, [activeStep]);

  // Debug user context
  useEffect(() => {
    console.log("👤 Current user in EmployeeEditDialog:", currentUser);
  }, [currentUser]);

  // Fetch position options
  useEffect(() => {
    const fetchPositions = async () => {
      try {
        const response = await api.get("/positions");
        console.log("📋 Fetched positions for dropdown:", response.data);
        setPositionOptions(response.data.positions || []);
      } catch (error) {
        console.error("Error fetching positions:", error);
        setPositionOptions([]);
      }
    };

    if (isOpen) {
      fetchPositions();
    }
  }, [isOpen]);

  // Fetch active settings (fiscal year)
  useEffect(() => {
    const fetchActiveSettings = async () => {
      try {
        console.log("🔄 Fetching active settings...");
        const response = await api.get("/settings/active");
        console.log("⚙️ Fetched active settings:", response.data);
        if (response.data && response.data.fiscalYear) {
          setActiveSettings(response.data);
          console.log("✅ Active fiscal year set:", response.data.fiscalYear);
        } else {
          console.log("❌ No fiscal year in response:", response.data);
          setActiveSettings(null);
        }
      } catch (error) {
        console.error("❌ Error fetching active settings:", error);
        setActiveSettings(null);
      }
    };

    if (isOpen) {
      fetchActiveSettings();
    }
  }, [isOpen]);

  useEffect(() => {
    const fetchOrganizationStructure = async () => {
      try {
        const response = await api.get(
          "/api/hierarchical-rbac/organization-structure"
        );
        if (response.data?.data) {
          setOrganizationStructure(response.data.data);

          // Set department options based on active region
          if (activeRegion) {
            const regionMappings =
              response.data.data.mappings?.filter(
                (mapping) => mapping.regionId === activeRegion._id
              ) || [];
            const departmentIds = regionMappings.map(
              (mapping) => mapping.departmentId
            );
            const depts =
              response.data.data.availableUnits?.departments?.filter((dept) =>
                departmentIds.includes(dept.id)
              ) || [];
            setDepartmentOptions(depts);
          } else {
            setDepartmentOptions(
              response.data.data.availableUnits?.departments || []
            );
          }

          // Set initial divisions and sections based on existing data
          if (row?.Department) {
            const departmentsWithDivisions =
              response.data.data.availableUnits?.departmentsWithDivisions || [];
            const matched = departmentsWithDivisions.find(
              (d) =>
                String(d.departmentName).toLowerCase() ===
                String(row.Department).toLowerCase()
            );

            if (matched) {
              const divisions =
                matched.divisions?.map((div) => div.name).filter(Boolean) || [];
              setDivisionOptions(divisions);

              // Set sections if division exists
              if (row?.Division) {
                const matchedDiv = matched.divisions.find(
                  (div) => div.name === row.Division
                );
                if (matchedDiv && matchedDiv.sections) {
                  const sections = matchedDiv.sections
                    .map((section) => section.name)
                    .filter(Boolean);
                  setSectionOptions(sections);
                }
              }
            }
          }
        }
      } catch (error) {
        console.error("Error fetching organization structure:", error);
        setDepartmentOptions([]);
      }
    };

    if (isOpen) {
      fetchOrganizationStructure();
    }
  }, [isOpen, activeRegion, row]);

  // When Department/Division changes, fetch divisions based on selected Department
  useEffect(() => {
    const subscription = watch((values, { name }) => {
      if (name === "Department") {
        const deptName = values?.Department || "";
        setValue("Division", "");
        setValue("Section", "");
        setSectionOptions([]);

        if (!deptName || !organizationStructure) {
          setDivisionOptions([]);
          return;
        }

        // Find the department in the hierarchical structure
        const departmentsWithDivisions =
          organizationStructure.availableUnits?.departmentsWithDivisions || [];
        const matched = departmentsWithDivisions.find(
          (d) =>
            String(d.departmentName).toLowerCase() ===
            String(deptName).toLowerCase()
        );

        if (matched) {
          const divisions =
            matched.divisions?.map((div) => div.name).filter(Boolean) || [];
          setDivisionOptions(divisions);
        } else {
          setDivisionOptions([]);
        }
      }

      if (name === "Division") {
        const divName = values?.Division || "";
        if (!divName) {
          setSectionOptions([]);
        } else {
          // Find the selected division in the hierarchical structure
          const departmentsWithDivisions =
            organizationStructure.availableUnits?.departmentsWithDivisions ||
            [];
          const matchedDept = departmentsWithDivisions.find((dept) =>
            dept.divisions?.some((div) => div.name === divName)
          );

          if (matchedDept) {
            const matchedDiv = matchedDept.divisions.find(
              (div) => div.name === divName
            );
            if (matchedDiv && matchedDiv.sections) {
              const sections = matchedDiv.sections
                .map((section) => section.name)
                .filter(Boolean);
              setSectionOptions(sections);
            } else {
              setSectionOptions([]);
            }
          } else {
            setSectionOptions([]);
          }
        }
        setValue("Section", "");
      }
    });

    return () => {
      if (subscription && typeof subscription.unsubscribe === "function") {
        subscription.unsubscribe();
      }
    };
  }, [watch, setValue, organizationStructure]);

  const handleSave = async (data) => {
    // Store the form data and show confirmation dialog
    setFormDataToSave(data);
    setShowConfirmDialog(true);
  };

  const handleConfirmSave = async () => {
    const data = formDataToSave;
    console.log("💾 handleConfirmSave called - this should ONLY happen when user clicks Update Employee button");
    console.log("🎯 Current activeStep:", activeStep);
    console.log("📋 Expected final step:", steps.length - 1);
    console.log("⚠️  If activeStep is not 3 (Review), this is a BUG!");
    console.log("💾 Updating employee with data:", data);
    console.log("🎂 DateOfBirth in data:", data.DateOfBirth);

    // Add processBy field with current user information
    const processBy = currentUser?.FirstName && currentUser?.LastName
      ? `${currentUser.FirstName} ${currentUser.LastName}`
      : currentUser?.fullName
      ? currentUser.fullName
      : currentUser?.name
      ? currentUser.name
      : currentUser?.username
      ? currentUser.username
      : "Admin";
    
    data.processBy = processBy;
    
    // Add employee status field if not present
    if (!data.employeeStatus) {
      data.employeeStatus = data.Status === "Active" ? "Active" : "Inactive";
    }

    // Add fiscal year if available
    if (activeSettings?.fiscalYear) {
      data.fiscalYear = activeSettings.fiscalYear;
    }

    setLoading(true);
    setShowConfirmDialog(false);
    
    try {
      const response = await api.put(`/employees/${row._id}`, data);
      
      toast.success("Employee updated successfully", {
        style: {
          borderRadius: "10px",
          background: theme.palette.mode === "dark" ? "#333" : "#fff",
          color: theme.palette.mode === "dark" ? "#fff" : "#333",
        },
        iconTheme: {
          primary: "#4caf50",
          secondary: "#FFFAEE",
        },
      });
      
      console.log("✅ Employee updated successfully, refreshing table...");
      
      // Call onDataChange callback to refresh parent component (stats, etc)
      if (onDataChange) {
        onDataChange();
        console.log("📊 Parent component notified to refresh stats");
      }
      
      // Add a small delay to ensure backend update is complete
      setTimeout(async () => {
        try {
          // Refresh the employee data after successful update
          await queryClient.invalidateQueries(['employees']);
          await queryClient.invalidateQueries(['employee-list']);
          await queryClient.invalidateQueries(['personnels']);
          await queryClient.refetchQueries(['employees']);
          await queryClient.refetchQueries(['employee-list']);
          
          console.log("🔄 Data refreshed successfully");
        } catch (error) {
          console.error("❌ Error refreshing data:", error);
        } finally {
          handleClose();
        }
      }, 200); // Reduced delay since we're calling onDataChange immediately
      
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to update employee", {
        style: {
          borderRadius: "10px",
          background: theme.palette.mode === "dark" ? "#333" : "#fff",
          color: theme.palette.mode === "dark" ? "#fff" : "#333",
        },
      });
    } finally {
      setLoading(false);
      setFormDataToSave(null);
    }
  };

  const handleCancelSave = () => {
    setShowConfirmDialog(false);
    setFormDataToSave(null);
  };

  const handleNext = async () => {
    console.log("🚀 handleNext called, activeStep:", activeStep);
    console.log("📋 Current steps.length:", steps.length);
    console.log("🎯 Will this be the last step?", activeStep >= steps.length - 1);
    
    const fieldsForStep = getFieldsForStep(activeStep);
    console.log("📝 Fields to validate:", fieldsForStep);

    try {
      const isStepValid = await trigger(fieldsForStep);
      console.log("✅ Validation result:", isStepValid);

      if (isStepValid) {
        const nextStep = activeStep + 1;
        console.log("🔄 Moving to step:", nextStep);
        setActiveStep(nextStep);
        
        // Add debugging for potential auto-submission
        if (nextStep >= steps.length) {
          console.log("⚠️  Reached or exceeded max steps - this should not auto-submit");
        }
      } else {
        console.log("❌ Validation failed, staying on current step");
        fieldsForStep.forEach((field) => {
          if (errors[field]) {
            console.log(`❌ Field ${field} has error:`, errors[field].message);
          }
        });
      }
    } catch (error) {
      console.error("💥 Error during validation:", error);
    }
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleOpen = () => {
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setActiveStep(0); // Reset to first step when closing
    if (parentClose) {
      parentClose(); // Close parent menu
    }
  };

  // Define which fields belong to each step
  const getFieldsForStep = (step) => {
    switch (step) {
      case 0: // Basic Information
        return [
          "EmployeeID",
          "EmployeeFullName",
          "Department",
        ];
      case 1: // Position Information
        return [
          "PositionTitle",
          "StatusOfAppointment",
        ];
      case 2: // Salary Information
        return ["SG", "JG", "Step", "Rate"];
      default:
        return [];
    }
  };

  // Check if current step is valid
  const isStepValid = () => {
    const fieldsForStep = getFieldsForStep(activeStep);
    return fieldsForStep.every((field) => !errors[field]);
  };

  // Steps for the stepper
  const steps = [
    "Basic Information",
    "Position Details",
    "Salary Information",
    "Review",
  ];

  return (
    <>
      <MenuItem
        onClick={handleOpen}
        disableRipple
        sx={{ display: "flex", gap: 1 }}
      >
        <EditIcon fontSize="small" />
        Edit Employee
      </MenuItem>

      <Dialog
        open={isOpen}
        onClose={handleClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: "12px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            overflow: "hidden",
          },
        }}
      >
        <DialogTitle
          sx={{
            p: 3,
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
            color: "white",
          }}
        >
          <Box
            display="flex"
            alignItems="center"
            justifyContent="space-between"
          >
            <Box>
              <Typography variant="h6" component="span">
                Edit Employee
              </Typography>
              {activeSettings?.fiscalYear && (
                <Typography
                  variant="caption"
                  sx={{ opacity: 0.8, display: "block", mt: 0.5 }}
                >
                  Fiscal Year: {activeSettings.fiscalYear}
                </Typography>
              )}
            </Box>
            <IconButton
              sx={{ color: "white" }}
              onClick={handleClose}
              size="small"
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </DialogTitle>

        <Box sx={{ px: 3, pt: 3, pb: 1 }}>
          <Stepper
            activeStep={activeStep}
            alternativeLabel={!isMobile}
            orientation={isMobile ? "vertical" : "horizontal"}
          >
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>

        <FormProvider {...methods}>
          <form onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log("🚫 Form submission prevented! This should not trigger handleSave");
            return false;
          }} onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              console.log("🚫 Enter key submission prevented!");
              return false;
            }
          }}>
            <DialogContent dividers sx={{ p: 3 }}>
              {!activeSettings?.fiscalYear && (
                <Alert severity="warning" sx={{ mb: 3 }}>
                  No active fiscal year found. Please set up the fiscal year in
                  Settings before editing employees.
                </Alert>
              )}
              {activeSettings?.fiscalYear && (
                <Box
                  sx={{
                    p: 2,
                    mb: 2,
                    bgcolor: "#fff9c4",
                    borderRadius: 1,
                    border: "1px solid #ffd54f",
                    textAlign: "center",
                  }}
                >
                  <Typography variant="body2" fontWeight="medium">
                    You are editing an employee for{" "}
                    <strong>Fiscal Year {activeSettings.fiscalYear}</strong>
                  </Typography>
                </Box>
              )}

              {activeStep === 0 && (
                <Box>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                    Basic Employee Information
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 3 }}
                  >
                    Update the basic details of the employee.
                  </Typography>

                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <CustomTextField
                        fieldName="EmployeeID"
                        control={control}
                        label="Employee ID"
                        required
                        rules={{
                          required: "Employee ID is required",
                          pattern: {
                            value: /^[A-Za-z0-9-]+$/,
                            message:
                              "Employee ID can only contain letters, numbers, and hyphens",
                          },
                        }}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <BadgeIcon color="action" />
                            </InputAdornment>
                          ),
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <CustomTextField
                        fieldName="EmployeeFullName"
                        control={control}
                        label="Employee Full Name"
                        required
                        rules={{
                          required: "Employee name is required",
                          minLength: {
                            value: 2,
                            message: "Name must be at least 2 characters",
                          },
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <CustomTextField
                        fieldName="DateOfBirth"
                        control={control}
                        label="Date of Birth"
                        type="date"
                        InputLabelProps={{ shrink: true }}
                        rules={{
                          validate: (value) => {
                            if (!value) return true; // Optional field
                            const today = new Date();
                            const birthDate = new Date(value);
                            const age = today.getFullYear() - birthDate.getFullYear();
                            
                            if (age < 16) {
                              return "Employee must be at least 16 years old";
                            }
                            if (age > 100) {
                              return "Please enter a valid birth date";
                            }
                            return true;
                          }
                        }}
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <Paper
                        variant="outlined"
                        sx={{
                          p: 2,
                          borderColor:
                            theme.palette.mode === "light"
                              ? "#e0e0e0"
                              : "#424242",
                          borderRadius: "8px",
                          bgcolor:
                            theme.palette.mode === "light"
                              ? "rgba(0, 0, 0, 0.02)"
                              : "rgba(255, 255, 255, 0.05)",
                        }}
                      >
                        <Typography variant="subtitle2" gutterBottom>
                          Region
                        </Typography>
                        <Typography variant="body1">
                          {row?.Region || "No region specified"}
                        </Typography>
                        <CustomTextField
                          fieldName="Region"
                          control={control}
                          label="Region"
                          required
                          disabled
                          sx={{ display: "none" }}
                        />
                      </Paper>
                    </Grid>

                    <Grid item xs={12} sm={4}>
                      <CustomAutoComplete
                        fieldName="Department"
                        label="Department"
                        options={departmentOptions}
                        control={control}
                        getOptionLabel="name"
                        required
                        rules={{ required: "Department is required" }}
                        onChange={(val) => {
                          setValue("Division", "");
                          setValue("Section", "");
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <CustomAutoComplete
                        fieldName="Division"
                        label="Division"
                        options={divisionOptions}
                        control={control}
                        onChange={() => {
                          setValue("Section", "");
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <CustomAutoComplete
                        fieldName="Section"
                        label="Section"
                        options={sectionOptions}
                        control={control}
                      />
                    </Grid>
                  </Grid>
                </Box>
              )}

              {activeStep === 1 && (
                <Box>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                    Position Details
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 3 }}
                  >
                    Update the position and appointment details.
                  </Typography>

                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <CustomAutoComplete
                        fieldName="PositionTitle"
                        label="Position Title"
                        options={positionOptions}
                        control={control}
                        getOptionLabel="PositionTitle"
                        required
                        rules={{ required: "Position title is required" }}
                      />
                    </Grid>

                    <Grid item xs={12} sm={6}>
                      <CustomAutoComplete
                        fieldName="StatusOfAppointment"
                        label="Status of Appointment"
                        apiList={{
                          api: api,
                          endpoint: "/status",
                          listName: "status",
                        }}
                        control={control}
                        getOptionLabel="Status"
                        required
                        rules={{
                          required: "Status of appointment is required",
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <CustomTextField
                        fieldName="DateOfAppointment"
                        control={control}
                        label="Date of Appointment"
                        type="date"
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <CustomAutoComplete
                        fieldName="Status"
                        label="Employee Status"
                        options={["Active", "Inactive"]}
                        control={control}
                        getOptionLabel={(option) => option}
                        required
                        rules={{ required: "Status is required" }}
                      />
                    </Grid>
                  </Grid>
                </Box>
              )}

              {activeStep === 2 && (
                <Box>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                    Salary Information
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 3 }}
                  >
                    Update the salary grade and rate details.
                  </Typography>

                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <CustomTextField
                        fieldName="SG"
                        control={control}
                        label="Salary Grade"
                        type="number"
                        required
                        rules={{
                          required: "Salary grade is required",
                          min: {
                            value: 1,
                            message: "Salary grade must be at least 1",
                          },
                        }}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <AttachMoneyIcon color="action" />
                            </InputAdornment>
                          ),
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <CustomTextField
                        fieldName="JG"
                        control={control}
                        label="Job Grade"
                        type="number"
                        required
                        rules={{ required: "Job grade is required" }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <CustomAutoComplete
                        fieldName="Step"
                        options={
                          stepOptions.length > 0
                            ? stepOptions
                            : ["1", "2", "3", "4", "5", "6", "7", "8"]
                        }
                        label="Step"
                        control={control}
                        required
                        rules={{ required: "Step is required" }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <CustomTextField
                        fieldName="Rate"
                        control={control}
                        label="Rate"
                        type="number"
                        required
                        rules={{
                          required: "Rate is required",
                          min: {
                            value: 0,
                            message: "Rate must be a positive number",
                          },
                        }}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">₱</InputAdornment>
                          ),
                        }}
                      />
                    </Grid>
                  </Grid>
                </Box>
              )}

              {activeStep === 3 && (
                <Box>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                    Review Employee Information
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 3 }}
                  >
                    Please review all information before updating.
                  </Typography>

                  <Card
                    variant="outlined"
                    sx={{
                      mb: 3,
                      borderRadius: "12px",
                      overflow: "hidden",
                    }}
                  >
                    <Box
                      sx={{
                        p: 2,
                        bgcolor: theme.palette.primary.main,
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        gap: 2,
                      }}
                    >
                      <Avatar
                        sx={{
                          bgcolor: "#fff",
                          color: theme.palette.primary.main,
                          fontWeight: "bold",
                        }}
                      >
                        {watchedValues.EmployeeFullName
                          ? watchedValues.EmployeeFullName.charAt(0)
                          : "E"}
                      </Avatar>
                      <Box>
                        <Typography variant="h6">
                          {watchedValues.EmployeeFullName || "Employee Name"}
                        </Typography>
                        <Typography variant="body2">
                          ID: {watchedValues.EmployeeID || "N/A"}
                        </Typography>
                        {watchedValues.DateOfBirth && (
                          <Typography variant="body2">
                            Born: {new Date(watchedValues.DateOfBirth).toLocaleDateString()}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                    <CardContent>
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                          <Typography
                            variant="subtitle2"
                            color="text.secondary"
                          >
                            Basic Information
                          </Typography>
                          <Divider sx={{ my: 1 }} />

                          <Box sx={{ mb: 2 }}>
                            <Typography variant="body2" color="text.secondary">
                              Region
                            </Typography>
                            <Typography variant="body1">
                              {watchedValues.Region || "N/A"}
                            </Typography>
                          </Box>

                          <Box sx={{ mb: 2 }}>
                            <Typography variant="body2" color="text.secondary">
                              Department
                            </Typography>
                            <Typography variant="body1">
                              {watchedValues.Department || "N/A"}
                            </Typography>
                          </Box>

                          <Box sx={{ mb: 2 }}>
                            <Typography variant="body2" color="text.secondary">
                              Division / Section
                            </Typography>
                            <Typography variant="body1">
                              {watchedValues.Division
                                ? watchedValues.Division
                                : "N/A"}
                              {watchedValues.Division && watchedValues.Section
                                ? " / "
                                : ""}
                              {watchedValues.Section
                                ? watchedValues.Section
                                : ""}
                            </Typography>
                          </Box>

                          {watchedValues.DateOfBirth && (
                            <Box sx={{ mb: 2 }}>
                              <Typography variant="body2" color="text.secondary">
                                Date of Birth
                              </Typography>
                              <Typography variant="body1">
                                {new Date(watchedValues.DateOfBirth).toLocaleDateString()}
                              </Typography>
                            </Box>
                          )}

                          <Box sx={{ mb: 2 }}>
                            <Typography variant="body2" color="text.secondary">
                              Status
                            </Typography>
                            <Chip
                              label={watchedValues.Status || "N/A"}
                              color={
                                watchedValues.Status === "Active"
                                  ? "success"
                                  : "error"
                              }
                              size="small"
                            />
                          </Box>
                        </Grid>

                        <Grid item xs={12} sm={6}>
                          <Typography
                            variant="subtitle2"
                            color="text.secondary"
                          >
                            Position & Salary
                          </Typography>
                          <Divider sx={{ my: 1 }} />

                          <Box sx={{ mb: 2 }}>
                            <Typography variant="body2" color="text.secondary">
                              Position Title
                            </Typography>
                            <Typography variant="body1">
                              {watchedValues.PositionTitle || "N/A"}
                            </Typography>
                          </Box>

                          <Box sx={{ mb: 2 }}>
                            <Typography variant="body2" color="text.secondary">
                              Status of Appointment
                            </Typography>
                            <Typography variant="body1">
                              {watchedValues.StatusOfAppointment || "N/A"}
                            </Typography>
                          </Box>

                          <Box sx={{ mb: 2 }}>
                            <Typography variant="body2" color="text.secondary">
                              Date of Appointment
                            </Typography>
                            <Typography variant="body1">
                              {watchedValues.DateOfAppointment || "N/A"}
                            </Typography>
                          </Box>

                          <Box sx={{ mb: 2 }}>
                            <Typography variant="body2" color="text.secondary">
                              Salary Details
                            </Typography>
                            <Typography variant="body1">
                              SG: {watchedValues.SG || "N/A"} | JG:{" "}
                              {watchedValues.JG || "N/A"} | Step:{" "}
                              {watchedValues.Step || "N/A"}
                            </Typography>
                            <Typography
                              variant="h6"
                              color="primary"
                              fontWeight="bold"
                            >
                              ₱
                              {watchedValues.Rate
                                ? Number(watchedValues.Rate).toLocaleString()
                                : "N/A"}
                            </Typography>
                          </Box>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Box>
              )}
            </DialogContent>

            <DialogActions
              sx={{ px: 3, py: 2, justifyContent: "space-between" }}
            >
              <Box>
                {activeStep > 0 && (
                  <Button
                    onClick={handleBack}
                    variant="outlined"
                    sx={{
                      borderRadius: "8px",
                      textTransform: "none",
                    }}
                  >
                    Back
                  </Button>
                )}
              </Box>
              <Box>
                <Button
                  onClick={handleClose}
                  color="inherit"
                  sx={{
                    mr: 1,
                    borderRadius: "8px",
                    textTransform: "none",
                  }}
                >
                  Cancel
                </Button>

                {activeStep < steps.length - 1 ? (
                  <Button
                    onClick={handleNext}
                    variant="contained"
                    disabled={!isStepValid()}
                    sx={{
                      borderRadius: "8px",
                      textTransform: "none",
                      fontWeight: 600,
                    }}
                  >
                    Next
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleSubmit(handleSave)}
                    disabled={loading}
                    sx={{
                      borderRadius: "8px",
                      textTransform: "none",
                      fontWeight: 600,
                    }}
                  >
                    {loading ? <CircularProgress size={24} /> : "Update Employee"}
                  </Button>
                )}
              </Box>
            </DialogActions>
          </form>
        </FormProvider>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog
        open={showConfirmDialog}
        onClose={handleCancelSave}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: "12px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          },
        }}
      >
        <DialogTitle
          sx={{
            p: 3,
            background: `linear-gradient(135deg, ${theme.palette.warning.main} 0%, ${theme.palette.warning.dark} 100%)`,
            color: "white",
            textAlign: "center",
          }}
        >
          <Box display="flex" alignItems="center" justifyContent="center" gap={2}>
            <EditIcon fontSize="large" />
            <Typography variant="h6" component="span">
              Confirm Update Employee
            </Typography>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 3, textAlign: "center" }}>
          <Typography variant="h6" gutterBottom>
            Are you sure you want to update this employee?
          </Typography>
          
          {formDataToSave && (
            <Box sx={{ mt: 2, p: 2, bgcolor: "rgba(0,0,0,0.05)", borderRadius: "8px" }}>
              <Typography variant="subtitle1" fontWeight="bold">
                {formDataToSave.EmployeeFullName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                ID: {formDataToSave.EmployeeID}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Position: {formDataToSave.PositionTitle || "N/A"}
              </Typography>
              {activeSettings?.fiscalYear && (
                <Typography variant="body2" color="text.secondary">
                  Fiscal Year: {activeSettings.fiscalYear}
                </Typography>
              )}
            </Box>
          )}

          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            This action will update the employee information in the system.
          </Typography>
        </DialogContent>

        <DialogActions sx={{ p: 3, justifyContent: "center", gap: 2 }}>
          <Button
            onClick={handleCancelSave}
            variant="outlined"
            color="inherit"
            sx={{
              borderRadius: "8px",
              textTransform: "none",
              px: 3,
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmSave}
            variant="contained"
            color="warning"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <EditIcon />}
            sx={{
              borderRadius: "8px",
              textTransform: "none",
              fontWeight: 600,
              px: 3,
            }}
          >
            {loading ? "Updating..." : "Yes, Update Employee"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default EmployeeEditDialog;
