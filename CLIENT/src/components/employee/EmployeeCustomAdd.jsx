import React, { useState, useEffect } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
  Alert,
  Box,
  Stepper,
  Step,
  StepLabel,
  Grid,
  Divider,
  Paper,
  IconButton,
  Tooltip,
  useTheme,
  useMediaQuery,
  InputAdornment,
  CircularProgress,
  Chip,
  Stack,
  Card,
  CardContent,
  Avatar,
  LinearProgress,
  styled,
} from "@mui/material";
import { useForm, FormProvider } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import CustomTextField from "../../global/components/CustomTextField";
import CustomAutoComplete from "../../global/components/CustomAutoComplete";
import CustomButton from "../../global/components/CustomButton";
import api from "../../config/api";
import { toast } from "react-hot-toast";
import { useRegion } from "../../context/RegionContext";
import { useUser } from "../../context/UserContext"; // Add this import
import ActiveRegionDisplay from "../common/ActiveRegionDisplay";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import CloseIcon from "@mui/icons-material/Close";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import BadgeIcon from "@mui/icons-material/Badge";
import WorkIcon from "@mui/icons-material/Work";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import { useThemeContext } from "../../context/ThemeContext";

// Styled components
const StyledInput = styled("input")(({ theme }) => ({
  display: "none",
}));

const VisuallyHiddenInput = styled("input")({
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  height: 1,
  overflow: "hidden",
  position: "absolute",
  bottom: 0,
  left: 0,
  whiteSpace: "nowrap",
  width: 1,
});

const AddEmployeeDialog = ({ parentClose, onDataChange }) => {
  const theme = useTheme();
  const { mode } = useThemeContext();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { currentUser } = useUser(); // Add this line to get currentUser from context
  const { activeRegion } = useRegion(); // Add this line to get activeRegion from context
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [stepOptions, setStepOptions] = useState([]);
  const [salaryData, setSalaryData] = useState(null);
  const [status, setStatus] = useState("Active");
  const [uploadError, setUploadError] = useState(null);
  const [activeStep, setActiveStep] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [activeSettings, setActiveSettings] = useState(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [formDataToSave, setFormDataToSave] = useState(null);
  // Get user's hierarchical access information
  const userAccessLevel = currentUser?.hierarchicalAccess?.scope || 'REGION';
  const userDivision = currentUser?.hierarchicalAccess?.accessibleDivisions?.[0];
  const userDepartment = currentUser?.hierarchicalAccess?.accessibleDepartments?.[0]?.departmentName;
  const userRegion = currentUser?.hierarchicalAccess?.accessibleRegions?.[0]?.regionName;

  // Debug user context
  useEffect(() => {
    if (currentUser) {
    } else {
      // No current user found in context
    }
  }, [currentUser]);

  // Initialize react-hook-form
  const methods = useForm({
    defaultValues: {
      Region: "",
      Department: "",
      Division: "",
      Section: "",
      Status: "Active",
      DateOfBirth: "",
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

  // Dynamic options for Division and Section based on Department
  const [divisionOptions, setDivisionOptions] = useState([]);
  const [sectionOptions, setSectionOptions] = useState([]);
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [positionOptions, setPositionOptions] = useState([]);
  const [organizationStructure, setOrganizationStructure] = useState(null);

  // Set Region value when activeRegion changes
  useEffect(() => {
    if (activeRegion) {
      setValue(
        "Region",
        activeRegion.Region || activeRegion.name || activeRegion
      );
    }
  }, [activeRegion, setValue]);

  // Auto-populate fields based on user's hierarchical access level
  useEffect(() => {
    if (currentUser?.hierarchicalAccess) {
      const accessLevel = userAccessLevel;
      
      switch (accessLevel) {
        case 'DIVISION':
          // For DIVISION level: Auto-select Division and Region, only Section is selectable
          if (userDivision) {
            setValue("Division", userDivision);
          }
          if (userRegion) {
            setValue("Region", userRegion);
          }
          if (userDepartment) {
            setValue("Department", userDepartment);
          }
          break;
          
        case 'DEPARTMENT':
          // For DEPARTMENT level: Auto-select Department and Region, Division and Section are selectable
          if (userDepartment) {
            setValue("Department", userDepartment);
          }
          if (userRegion) {
            setValue("Region", userRegion);
          }
          break;
          
        case 'REGION':
          // For REGION level: Auto-select Region, Department, Division, and Section are selectable
          if (userRegion) {
            setValue("Region", userRegion);
          }
          break;
          
        default:
          // For other levels or no specific access, use activeRegion
          if (activeRegion) {
            setValue("Region", activeRegion.Region || activeRegion.name || activeRegion);
          }
          break;
      }
    }
  }, [currentUser, userAccessLevel, userDivision, userDepartment, userRegion, activeRegion, setValue]);

  // Fetch position options
  useEffect(() => {
    const fetchPositions = async () => {
      try {
        const response = await api.get("/positions");
        setPositionOptions(response.data.positions || []);
      } catch (error) {
        console.error("Error fetching positions:", error);
        setPositionOptions([]);
      }
    };

    fetchPositions();
  }, []);

  // Fetch active settings (fiscal year)
  useEffect(() => {
    const fetchActiveSettings = async () => {
      try {
        const response = await api.get("/settings/active");
        if (response.data && response.data.fiscalYear) {
          setActiveSettings(response.data);
        } else {
          setActiveSettings(null);
        }
      } catch (error) {
        console.error("❌ Error fetching active settings:", error);
        console.error("Error details:", error.response?.data);
        setActiveSettings(null);
      }
    };

    fetchActiveSettings();
  }, []);

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
        }
      } catch (error) {
        console.error("Error fetching organization structure:", error);
        setDepartmentOptions([]);
      }
    };

    fetchOrganizationStructure();
  }, [activeRegion]);

  // Update department options when activeRegion changes
  useEffect(() => {
    if (organizationStructure && activeRegion) {
      const regionMappings =
        organizationStructure.mappings?.filter(
          (mapping) => mapping.regionId === activeRegion._id
        ) || [];
      const departmentIds = regionMappings.map(
        (mapping) => mapping.departmentId
      );
      const depts =
        organizationStructure.availableUnits?.departments?.filter((dept) =>
          departmentIds.includes(dept.id)
        ) || [];
      setDepartmentOptions(depts);
    }
  }, [activeRegion, organizationStructure]);

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

  // Handle default Region value changes - fetch departments
  useEffect(() => {
    const regionValue = watch("Region");
    if (regionValue && organizationStructure) {
      const regionMappings =
        organizationStructure.mappings?.filter(
          (mapping) => mapping.regionId === regionValue._id || mapping.regionName === regionValue
        ) || [];
      const departmentIds = regionMappings.map(
        (mapping) => mapping.departmentId
      );
      const depts =
        organizationStructure.availableUnits?.departments?.filter((dept) =>
          departmentIds.includes(dept.id)
        ) || [];
      setDepartmentOptions(depts);
    }
  }, [watch("Region"), organizationStructure]);

  // Handle default Department value changes - fetch divisions
  useEffect(() => {
    const deptValue = watch("Department");
    if (deptValue && organizationStructure) {
      // Find the department in the hierarchical structure
      const departmentsWithDivisions =
        organizationStructure.availableUnits?.departmentsWithDivisions || [];
      const matched = departmentsWithDivisions.find(
        (d) =>
          String(d.departmentName).toLowerCase() ===
          String(deptValue).toLowerCase()
      );

      if (matched) {
        const divisions =
          matched.divisions?.map((div) => div.name).filter(Boolean) || [];
        setDivisionOptions(divisions);
      } else {
        setDivisionOptions([]);
      }
    }
  }, [watch("Department"), organizationStructure]);

  // Handle default Division value changes - fetch sections
  useEffect(() => {
    const divValue = watch("Division");
    if (divValue && organizationStructure) {
      // Find the selected division in the hierarchical structure
      const departmentsWithDivisions =
        organizationStructure.availableUnits?.departmentsWithDivisions ||
        [];
      const matchedDept = departmentsWithDivisions.find((dept) =>
        dept.divisions?.some((div) => div.name === divValue)
      );

      if (matchedDept) {
        const matchedDiv = matchedDept.divisions.find(
          (div) => div.name === divValue
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
  }, [watch("Division"), organizationStructure]);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    setSelectedFile(file);

    // Reset any previous errors
    setUploadError(null);

    // Validate file type
    const validTypes = [".xlsx", ".xls"];
    const fileExtension = file.name
      .substring(file.name.lastIndexOf("."))
      .toLowerCase();

    if (!validTypes.includes(fileExtension)) {
      setUploadError(
        `Invalid file type. Please select an Excel file (${validTypes.join(
          ", "
        )})`
      );
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a file", {
        style: {
          borderRadius: "10px",
          background: theme.palette.mode === "dark" ? "#333" : "#fff",
          color: theme.palette.mode === "dark" ? "#fff" : "#333",
        },
      });
      return;
    }

    // Check if a region is selected
    if (!activeRegion) {
      toast.error("Please select a region before uploading employees", {
        style: {
          borderRadius: "10px",
          background: theme.palette.mode === "dark" ? "#333" : "#fff",
          color: theme.palette.mode === "dark" ? "#fff" : "#333",
        },
      });
      setUploadError(
        "No active region selected. Please select a region first."
      );
      return;
    }

    // Check if we have active settings for uploading
    if (!activeSettings?.fiscalYear) {
      setUploadError(
        "No active fiscal year found. Please set up the fiscal year first."
      );
      return;
    }
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append(
      "activeRegion",
      activeRegion.name || activeRegion.regionName
    );

    // Get the user's name for processBy, fallback to "Admin" if user context is not available
    const processBy =
      currentUser?.FirstName && currentUser?.LastName
        ? `${currentUser.FirstName} ${currentUser.LastName}`
        : "Admin";
    formData.append("processBy", processBy);

    setUploadError(null);
    setLoading(true);
    setUploadProgress(0);

    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 500);

      const response = await api.post("/api/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      setTimeout(() => {
        toast.success(response.data.message, {
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

        // Refresh the data in all related queries
        queryClient.invalidateQueries(["employees"]);
        queryClient.invalidateQueries(["personnels"]);
        queryClient.invalidateQueries(["employee-list"]);

        handleImportClose();
      }, 500);
    } catch (error) {
      console.error("Upload error:", error.response?.data);
      setUploadProgress(0);

      // Handle region mismatch error
      if (error.response?.data?.error === "Region mismatch") {
        setUploadError(error.response.data.message);

        // If there are details about mismatched records, show them
        if (
          error.response.data.details &&
          error.response.data.details.length > 0
        ) {
          const mismatchedRecords = error.response.data.details;
          setUploadError(
            (prev) =>
              `${prev}\n\nMismatched records (showing first ${mismatchedRecords.length}):\n` +
              mismatchedRecords
                .map((r) => `- ${r.name || r.employeeId} (${r.region})`)
                .join("\n")
          );
        }
      } else {
        toast.error(error.response?.data?.error || "File upload failed", {
          style: {
            borderRadius: "10px",
            background: theme.palette.mode === "dark" ? "#333" : "#fff",
            color: theme.palette.mode === "dark" ? "#fff" : "#333",
          },
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (data) => {
    // Store the form data and show confirmation dialog
    setFormDataToSave(data);
    setShowConfirmDialog(true);
  };

  const handleConfirmSave = async () => {
    const data = formDataToSave;
    
    // Check if a region is selected
    if (!activeRegion) {
      toast.error("Please select a region before adding an employee", {
        style: {
          borderRadius: "10px",
          background: theme.palette.mode === "dark" ? "#333" : "#fff",
          color: theme.palette.mode === "dark" ? "#fff" : "#333",
        },
      });
      setShowConfirmDialog(false);
      return;
    }

    // Check if we have active settings with fiscal year
    if (!activeSettings?.fiscalYear) {
      toast.error(
        "No active fiscal year found. Please set up the fiscal year first.",
        {
          style: {
            borderRadius: "10px",
            background: theme.palette.mode === "dark" ? "#333" : "#fff",
            color: theme.palette.mode === "dark" ? "#fff" : "#333",
          },
        }
      );
      setShowConfirmDialog(false);
      return;
    }

    // Check for duplicate employee in the same fiscal year
    try {
      const duplicateCheck = await api.get(`/employees/check-duplicate`, {
        params: {
          fullName: data.EmployeeFullName,
          fiscalYear: activeSettings.fiscalYear,
          region: activeRegion.name || activeRegion.regionName
        }
      });

      if (duplicateCheck.data.exists) {
        toast.error(
          `Employee "${data.EmployeeFullName}" already exists in fiscal year ${activeSettings.fiscalYear} for this region.`,
          {
            style: {
              borderRadius: "10px",
              background: theme.palette.mode === "dark" ? "#333" : "#fff",
              color: theme.palette.mode === "dark" ? "#fff" : "#333",
            },
          }
        );
        setShowConfirmDialog(false);
        return;
      }
    } catch (error) {
      console.error("Error checking for duplicate:", error);
      // Continue with save if duplicate check fails (don't block the user)
    }

    // Ensure the Region field is set to the active region
    data.Region = activeRegion.name || activeRegion.regionName;

    // Add employee status field if not present
    if (!data.employeeStatus) {
      data.employeeStatus = data.Status === "Active" ? "Active" : "Inactive";
    }

    // Add fiscal year to the employee data
    data.fiscalYear = activeSettings.fiscalYear;

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

    setLoading(true);
    setShowConfirmDialog(false);
    
    try {
      const response = await api.post("/employees", data);
      
      // Refresh the employee data after successful save
      if (onDataChange) {
        onDataChange();
      }
      
      toast.success("Employee added successfully", {
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
      
      handleClose();
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to save employee", {
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
    const fieldsForStep = getFieldsForStep(activeStep);

    // Log current form values for debugging
    const currentValues = watch();

    try {
      const isStepValid = await trigger(fieldsForStep);

      if (isStepValid) {
        setActiveStep((prevActiveStep) => prevActiveStep + 1);
      } else {
        // Show which specific fields are failing
        fieldsForStep.forEach((field) => {
          if (errors[field]) {
            console.error(`Field ${field} has error:`, errors[field].message);
          }
        });
      }
    } catch (error) {
      console.error("Error during validation:", error);
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
    if (parentClose) {
      parentClose();
    }
  };

  const handleImportOpen = () => {
    setIsImportOpen(true);
  };

  const handleImportClose = () => {
    setIsImportOpen(false);
  };

  // Define which fields belong to each step
  const getFieldsForStep = (step) => {
    switch (step) {
      case 0: // Basic Information
        const basicFields = [
          "EmployeeID",
          "EmployeeFullName",
          "Department", // Only require department, not all hierarchy levels
        ];
        // Only add Region if no activeRegion is set
        if (!activeRegion) {
          basicFields.push("Region");
        }
        return basicFields;
      case 1: // Position Information
        return [
          "PositionTitle",
          "StatusOfAppointment",
          // Make DateOfAppointment and Status optional for now
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
    <div>
      <Stack direction={isMobile ? "column" : "row"} spacing={2}>
        <Button
          variant="contained"
          size="large"
          onClick={handleOpen}
          startIcon={<PersonAddIcon />}
          sx={{
            borderRadius: "8px",
            textTransform: "none",
            fontWeight: 600,
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            transition: "transform 0.2s, box-shadow 0.2s",
            "&:hover": {
              transform: "translateY(-2px)",
              boxShadow: "0 6px 16px rgba(0,0,0,0.15)",
            },
          }}
        >
          Add Employee
        </Button>
        <Button
          variant="outlined"
          color="secondary"
          size="large"
          onClick={handleImportOpen}
          startIcon={<UploadFileIcon />}
          sx={{
            borderRadius: "8px",
            textTransform: "none",
            fontWeight: 600,
            transition: "transform 0.2s",
            "&:hover": {
              transform: "translateY(-2px)",
            },
          }}
        >
          Import Employees
        </Button>
      </Stack>

      {/* Add Employee Dialog */}
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
                Add Employee
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
          <form onSubmit={handleSubmit(handleSave)}>
            <DialogContent dividers sx={{ p: 3 }}>
              {!activeSettings?.fiscalYear && (
                <Alert severity="warning" sx={{ mb: 3 }}>
                  No active fiscal year found. Please set up the fiscal year in
                  Settings before adding employees.
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
                    You are adding an employee for{" "}
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
                    Enter the basic details of the employee.
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
                      {activeRegion ? (
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
                            Active Region
                          </Typography>
                          <ActiveRegionDisplay
                            variant="default"
                            showButton={false}
                          />
                          <CustomTextField
                            fieldName="Region"
                            control={control}
                            label="Region"
                            required
                            disabled
                            sx={{ display: "none" }}
                          />
                        </Paper>
                      ) : (
                        <Alert
                          severity="warning"
                          variant="outlined"
                          sx={{
                            borderRadius: "8px",
                            "& .MuiAlert-icon": {
                              alignItems: "center",
                            },
                          }}
                        >
                          <Typography variant="body2">
                            No active region selected. Please select a region
                            first.
                          </Typography>
                        </Alert>
                      )}
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
                        disabled={userAccessLevel === 'DIVISION' || userAccessLevel === 'DEPARTMENT'}
                        onChange={(val) => {
                          // val can be object or string - we set via watcher already; keep here for safety
                          if (userAccessLevel !== 'DIVISION' && userAccessLevel !== 'DEPARTMENT') {
                            setValue("Division", "");
                            setValue("Section", "");
                          }
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <CustomAutoComplete
                        fieldName="Division"
                        label="Division"
                        options={divisionOptions}
                        control={control}
                        disabled={userAccessLevel === 'DIVISION'}
                        onChange={() => {
                          // Clear Section when Division changes
                          if (userAccessLevel !== 'DIVISION') {
                            setValue("Section", "");
                          }
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <CustomAutoComplete
                        fieldName="Section"
                        label="Section"
                        options={sectionOptions}
                        control={control}
                        disabled={false} // Section should always be enabled for Division level users
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
                    Enter the position and appointment details.
                  </Typography>

                  <Grid container spacing={2}>
                    {/* <Grid item xs={12}>
                      <CustomAutoComplete
                        fieldName="PositionTitle"
                        label="Position Title"
                        options={positionOptions}
                        control={control}
                        getOptionLabel="PositionTitle"
                        freeSolo={true}
                        required
                        rules={{ required: "Position title is required" }}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <WorkIcon color="action" />
                            </InputAdornment>
                          ),
                        }}
                      />
                    </Grid> */}

                    <Grid item xs={12}>
                      <CustomAutoComplete
                        fieldName="PositionTitle"
                        label="Position Title"
                        apiList={
                         {
                            api: api,
                            endpoint: "/positions",
                            listName: "positions",
                          }}
                  
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
                        required
                        rules={{
                          required: "Date of appointment is required"
                        }}
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
                        onChange={(value) => {
                          setStatus(value);
                          setValue("Status", value);
                        }}
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
                    Enter the salary grade and rate details.
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
                        onChange={async (e) => {
                          const sgValue = e.target.value;
                          setValue("SG", sgValue);

                          if (sgValue) {
                            try {
                              const response = await api.get(
                                `salary-grades?salary_grade=${sgValue}`
                              );
                              const salaryGrades = response.data.grades?.[0];

                              if (salaryGrades) {
                                setValue("JG", salaryGrades.job_grade);
                                const steps = salaryGrades.steps.map(
                                  (aw) => aw + ""
                                );
                                setStepOptions(steps);
                                setSalaryData(salaryGrades);
                                const defaultStep = steps[0];
                                setValue("Step", defaultStep);
                                const rate = salaryGrades.rates[defaultStep];
                                setValue("Rate", rate);

                                // Trigger validation
                                trigger(["JG", "Step", "Rate"]);
                              } else {
                                setValue("JG", "");
                                setStepOptions([]);
                                setSalaryData(null);
                                setValue("Step", "");
                                setValue("Rate", "");
                              }
                            } catch (error) {
                              console.error(
                                "Error fetching salary grades:",
                                error
                              );
                            }
                          }
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
                        onChange={async (e) => {
                          const jgValue = e.target.value;
                          setValue("JG", jgValue);

                          if (!getValues("SG") && jgValue) {
                            const stepValue = getValues("Step") || "1";
                            try {
                              const response = await api.get(
                                `/rate-by-job-grade-and-step/${jgValue}/${stepValue}`
                              );
                              const rateData = response.data;

                              if (rateData) {
                                setValue("Rate", rateData.rate);
                                trigger("Rate");
                              } else {
                                setValue("Rate", "");
                                console.error(
                                  "Rate not found for the given job grade and step"
                                );
                              }
                            } catch (error) {
                              console.error(
                                "Error fetching rate by job grade and step:",
                                error
                              );
                            }
                          }
                        }}
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
                        onChange={async (value) => {
                          setValue("Step", value);

                          if (salaryData) {
                            const rate = salaryData.rates[value] || "";
                            setValue("Rate", rate);
                          } else {
                            const jgValue = getValues("JG");
                            if (jgValue) {
                              try {
                                const response = await api.get(
                                  `/rate-by-job-grade-and-step/${jgValue}/${value}`
                                );
                                const rateData = response.data;

                                if (rateData) {
                                  setValue("Rate", rateData.rate);
                                } else {
                                  setValue("Rate", "");
                                  console.error(
                                    "Rate not found for the given job grade and step"
                                  );
                                }
                              } catch (error) {
                                console.error(
                                  "Error fetching rate by job grade and step:",
                                  error
                                );
                              }
                            }
                          }

                          trigger("Rate");
                        }}
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
                    Please review all information before submitting.
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
                    disabled={!isStepValid() || !activeRegion}
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
                    type="submit"
                    disabled={loading || !activeRegion}
                    sx={{
                      borderRadius: "8px",
                      textTransform: "none",
                      fontWeight: 600,
                    }}
                  >
                    {loading ? <CircularProgress size={24} /> : "Save Employee"}
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
            background: `linear-gradient(135deg, ${theme.palette.success.main} 0%, ${theme.palette.success.dark} 100%)`,
            color: "white",
            textAlign: "center",
          }}
        >
          <Box display="flex" alignItems="center" justifyContent="center" gap={2}>
            <PersonAddIcon fontSize="large" />
            <Typography variant="h6" component="span">
              Confirm Save Employee
            </Typography>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 3, textAlign: "center" }}>
          <Typography variant="h6" gutterBottom>
            Are you sure you want to save this employee?
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
            This action will add the employee to the system and cannot be undone.
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
            color="success"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <PersonAddIcon />}
            sx={{
              borderRadius: "8px",
              textTransform: "none",
              fontWeight: 600,
              px: 3,
            }}
          >
            {loading ? "Saving..." : "Yes, Save Employee"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Import Employees Dialog */}
      <Dialog
        open={isImportOpen}
        onClose={handleImportClose}
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
            bgcolor: theme.palette.secondary.main,
            color: "#fff",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            py: 2,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <UploadFileIcon />
            <Typography variant="h6">Import Employees</Typography>
          </Box>
          <IconButton
            onClick={handleImportClose}
            size="small"
            sx={{ color: "#fff" }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 3 }}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Upload Employee Data
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Upload an Excel file to import employees. All employees in the
                file must belong to the currently selected region.
              </Typography>

              <Box sx={{ mt: 3, mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Current active region:
                </Typography>
                {activeRegion ? (
                  <Box sx={{ mt: 1 }}>
                    <ActiveRegionDisplay variant="default" showButton={true} />
                  </Box>
                ) : (
                  <Alert
                    severity="warning"
                    variant="outlined"
                    sx={{
                      mt: 1,
                      borderRadius: "8px",
                      "& .MuiAlert-icon": {
                        alignItems: "center",
                      },
                    }}
                  >
                    <Typography variant="body2">
                      No region selected. Please select a region before
                      uploading employees.
                    </Typography>
                  </Alert>
                )}
              </Box>

              <Box sx={{ mt: 4 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Select Excel file:
                </Typography>

                <Box
                  sx={{
                    border: `2px dashed ${
                      theme.palette.mode === "light" ? "#ccc" : "#555"
                    }`,
                    borderRadius: "8px",
                    p: 3,
                    textAlign: "center",
                    mt: 1,
                    bgcolor:
                      theme.palette.mode === "light"
                        ? "rgba(0, 0, 0, 0.02)"
                        : "rgba(255, 255, 255, 0.05)",
                    transition: "all 0.2s",
                    "&:hover": {
                      borderColor: theme.palette.primary.main,
                      bgcolor:
                        theme.palette.mode === "light"
                          ? "rgba(0, 0, 0, 0.04)"
                          : "rgba(255, 255, 255, 0.08)",
                    },
                  }}
                >
                  <label htmlFor="employee-file-upload">
                    <StyledInput
                      id="employee-file-upload"
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileChange}
                    />
                    <Button
                      component="span"
                      variant="outlined"
                      startIcon={<UploadFileIcon />}
                      sx={{
                        mb: 2,
                        borderRadius: "8px",
                        textTransform: "none",
                      }}
                    >
                      Choose File
                    </Button>
                  </label>

                  <Typography variant="body2" color="text.secondary">
                    {selectedFile ? selectedFile.name : "No file selected"}
                  </Typography>

                  {selectedFile && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block", mt: 1 }}
                    >
                      {(selectedFile.size / 1024).toFixed(2)} KB
                    </Typography>
                  )}
                </Box>

                {uploadProgress > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      gutterBottom
                    >
                      Uploading: {uploadProgress}%
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={uploadProgress}
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        bgcolor:
                          theme.palette.mode === "light"
                            ? "rgba(0, 0, 0, 0.1)"
                            : "rgba(255, 255, 255, 0.1)",
                      }}
                    />
                  </Box>
                )}
              </Box>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Import Guidelines
              </Typography>

              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: "8px",
                  borderColor:
                    theme.palette.mode === "light" ? "#e0e0e0" : "#424242",
                  bgcolor:
                    theme.palette.mode === "light"
                      ? "rgba(0, 0, 0, 0.02)"
                      : "rgba(255, 255, 255, 0.05)",
                  mb: 3,
                }}
              >
                <Typography variant="subtitle2" gutterBottom>
                  File Requirements:
                </Typography>
                <Typography variant="body2" component="ul" sx={{ pl: 2 }}>
                  <li>Excel file format (.xlsx, .xls)</li>
                  <li>First row must contain column headers</li>
                  <li>
                    Required columns: EmployeeID, EmployeeFullName, Region
                  </li>
                  <li>Region must match the currently selected region</li>
                </Typography>
              </Paper>

              {uploadError && (
                <Alert
                  severity="error"
                  variant="outlined"
                  sx={{
                    mt: 2,
                    mb: 2,
                    whiteSpace: "pre-line",
                    borderRadius: "8px",
                    "& .MuiAlert-icon": {
                      alignItems: "flex-start",
                      mt: 1,
                    },
                  }}
                >
                  <Typography variant="subtitle2" gutterBottom>
                    Upload Error
                  </Typography>
                  <Typography variant="body2">{uploadError}</Typography>
                </Alert>
              )}

              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Need help?
                </Typography>
                <Button
                  variant="text"
                  startIcon={<HelpOutlineIcon />}
                  sx={{
                    textTransform: "none",
                    justifyContent: "flex-start",
                    pl: 0,
                  }}
                  onClick={() => {
                    // You can add a help function here
                    toast.success("Download template feature coming soon!", {
                      style: {
                        borderRadius: "10px",
                        background:
                          theme.palette.mode === "dark" ? "#333" : "#fff",
                        color: theme.palette.mode === "dark" ? "#fff" : "#333",
                      },
                    });
                  }}
                >
                  Download template file
                </Button>
              </Box>
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            variant="outlined"
            onClick={handleImportClose}
            sx={{
              borderRadius: "8px",
              textTransform: "none",
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleUpload}
            disabled={!selectedFile || !activeRegion || loading}
            startIcon={
              loading ? <CircularProgress size={20} /> : <UploadFileIcon />
            }
            sx={{
              borderRadius: "8px",
              textTransform: "none",
              fontWeight: 600,
            }}
          >
            {loading ? "Uploading..." : "Upload File"}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default AddEmployeeDialog;
