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
  Switch,
} from "@mui/material";

import {
  FormProvider,
  useForm,
} from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import CloseIcon from "@mui/icons-material/Close";
import BadgeIcon from "@mui/icons-material/Badge";
import PesoIcon from "../icons/PesoIcon";
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
  const [stepOptions, setStepOptions] = useState(["1", "2", "3", "4", "5", "6", "7", "8"]);
  const [salaryData, setSalaryData] = useState(null);
  const [activeStep, setActiveStep] = useState(0);
  const [activeSettings, setActiveSettings] = useState(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [formDataToSave, setFormDataToSave] = useState(null);
  const { activeRegion } = useRegion();
  const { currentUser } = useUser();
  const queryClient = useQueryClient();

  // Get user's hierarchical access information
  const userAccessLevel = currentUser?.hierarchicalAccess?.scope || 'REGION';
  const userDivision = currentUser?.hierarchicalAccess?.accessibleDivisions?.[0];
  const userDepartment = currentUser?.hierarchicalAccess?.accessibleDepartments?.[0]?.departmentName;
  const userRegion = currentUser?.hierarchicalAccess?.accessibleRegions?.[0]?.regionName;

  // Dynamic options for Division and Section based on Department
  const [divisionOptions, setDivisionOptions] = useState([]);
  const [sectionOptions, setSectionOptions] = useState([]);
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [positionOptions, setPositionOptions] = useState([]);
  const [organizationStructure, setOrganizationStructure] = useState(null);
  const [useCPCSForEmployeeAdd, setUseCPCSForEmployeeAdd] = useState(false);
  // Entitled to Medical/Meal toggle (auto-derived from DateOfAppointment, manually overridable)
  const [entitledToMedicalMeal, setEntitledToMedicalMeal] = useState(
    () => {
      if (row?.entitledToMedicalMeal !== undefined && row?.entitledToMedicalMeal !== null) {
        return Boolean(row.entitledToMedicalMeal);
      }
      if (row?.DateOfAppointment) {
        return new Date(row.DateOfAppointment) < new Date("1989-01-01");
      }
      return false;
    }
  );
  const [noOfDependent, setNoOfDependent] = useState(Number(row?.noOfDependent) || 0);

  // Fetch CPCS setting for employee add/edit (use CPCSSalaryTable vs salary-grades)
  useEffect(() => {
    api.get("/cpcs-salary/use-cpcs")
      .then((res) => setUseCPCSForEmployeeAdd(res.data?.useCPCSForEmployeeAdd === true))
      .catch(() => setUseCPCSForEmployeeAdd(false));
  }, []);

  // Utility function to format dates for HTML date inputs
  const formatDateForInput = (dateValue) => {
    if (!dateValue) return "";

    try {
      let date;
      if (dateValue instanceof Date) {
        date = dateValue;
      } else if (typeof dateValue === 'string') {
        // Handle ISO string or other date formats
        date = new Date(dateValue);
      } else {
        return "";
      }

      if (isNaN(date.getTime())) {
        return "";
      }

      // Return in YYYY-MM-DD format for HTML date input
      return date.toISOString().split('T')[0];
    } catch (error) {
      console.warn("Error formatting date:", dateValue, error);
      return "";
    }
  };

  // Initialize react-hook-form with existing employee data
  const methods = useForm({
    mode: "onChange",
    defaultValues: {
      EmployeeFullName: row?.EmployeeFullName || "",
      Employee_No: row?.EmployeeID || "",
      Region: row?.Region || "",
      Department: row?.Department || "",
      Division: row?.Division || "",
      PositionTitle: row?.PositionTitle || "",
      StatusOfAppointment: row?.StatusOfAppointment || "",
      DateOfAppointment: formatDateForInput(row?.DateOfAppointment),
      DateOfBirth: formatDateForInput(row?.DateOfBirth),
      Status: row?.Status || "Active",
      Item_No: row?.ItemNumber || "",
      PG: row?.PG || "",
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
    getValues,
  } = methods;

  // Watch all form values for the review step
  const watchedValues = watch();

  // Auto-derive entitledToMedicalMeal when DateOfAppointment changes (unless manually set)
  const watchedDOA = watch("DateOfAppointment");
  useEffect(() => {
    if (watchedDOA) {
      const doa = new Date(watchedDOA);
      const cutoff = new Date("1989-01-01");
      // Only auto-update if no explicit override is stored on the employee record
      if (row?.entitledToMedicalMeal === undefined || row?.entitledToMedicalMeal === null) {
        setEntitledToMedicalMeal(doa < cutoff);
      }
    }
  }, [watchedDOA]);

  // Debug watchedValues.StatusOfAppointment
  useEffect(() => {
    // console.log("🔍 watchedValues.StatusOfAppointment:", watchedValues.StatusOfAppointment);
    // console.log("🔍 watchedValues.StatusOfAppointment type:", typeof watchedValues.StatusOfAppointment);
    // console.log("🔍 watchedValues.StatusOfAppointment upper:", watchedValues.StatusOfAppointment?.toString().toUpperCase());
  }, [watchedValues.StatusOfAppointment]);

  // Debug activeStep changes
  useEffect(() => {
    // console.log("🔄 activeStep changed to:", activeStep);
  }, [activeStep]);

  // Debug user context
  useEffect(() => {
    // console.log("👤 Current user in EmployeeEditDialog:", currentUser);
  }, [currentUser]);

  // Fetch position options
  useEffect(() => {
    const fetchPositions = async () => {
      try {
        const response = await api.get("/positions");
        // console.log("📋 Fetched positions for dropdown:", response.data);
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
        // console.log("🔄 Fetching active settings...");
        const response = await api.get("/settings/active");
        // console.log("⚙️ Fetched active settings:", response.data);
        if (response.data && response.data.fiscalYear) {
          setActiveSettings(response.data);
          // console.log("✅ Active fiscal year set:", response.data.fiscalYear);
        } else {
          // console.log("❌ No fiscal year in response:", response.data);
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
            const matched = departmentsWithDivisions.filter(
              (d) =>
                String(d.departmentName).toLowerCase() ===
                String(row.Department).toLowerCase()
            );

            if (matched && matched.length > 0) {
              // Aggregate all divisions from all mappings and remove duplicates
              const allDivisions = new Set();
              matched.forEach((mapping) => {
                mapping.divisions?.forEach((div) => {
                  if (div.name) allDivisions.add(div.name);
                });
              });
              const divisions = Array.from(allDivisions).sort();
              setDivisionOptions(divisions);

              // Set sections if division exists
              if (row?.Division) {
                const matchedDept = matched.find((m) =>
                  m.divisions?.some((div) => div.name === row.Division)
                );
                if (matchedDept) {
                  const matchedDiv = matchedDept.divisions.find(
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

  // Auto-populate fields based on user's hierarchical access level
  useEffect(() => {
    if (currentUser?.hierarchicalAccess && isOpen) {
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
  }, [currentUser, userAccessLevel, userDivision, userDepartment, userRegion, activeRegion, setValue, isOpen]);

  // Initialize salary data when editing existing employee
  useEffect(() => {
    const initializeSalaryData = async () => {
      if (!isOpen || !row) return;

      const status = row.StatusOfAppointment?.toString().toUpperCase();
      const sg = row.SG;
      const jg = row.JG;

      // For PERMANENT/CONTRACTUAL employees with SG
      if ((status === 'PERMANENT' || status === 'CONTRACTUAL') && sg) {
        try {
          const url = useCPCSForEmployeeAdd
            ? `cpcs-salary/grades?salary_grade=${sg}`
            : `salary-grades?salary_grade=${sg}`;
          const response = await api.get(url);
          const salaryGrades = response.data.grades?.[0];

          if (salaryGrades) {
            const steps = salaryGrades.steps.map((aw) => aw + "");
            setStepOptions(steps);
            setSalaryData(salaryGrades);
          }
        } catch (error) {
          console.error("Error initializing salary data:", error);
        }
      }
      // For CASUAL employees, just ensure step options are set
      else if (status === 'CASUAL') {
        setStepOptions(["1", "2", "3", "4", "5", "6", "7", "8"]);
      }
    };

    initializeSalaryData();
  }, [isOpen, row, useCPCSForEmployeeAdd]);

  // When Department/Division changes, fetch divisions based on selected Department
  useEffect(() => {
    const subscription = watch((values, { name }) => {
      if (name === "Department") {
        const deptName = values?.Department || "";
        
        // Only clear Division and Section if user can change Department
        if (userAccessLevel !== 'DIVISION' && userAccessLevel !== 'DEPARTMENT') {
          setValue("Division", "");
          setValue("Section", "");
          setSectionOptions([]);
        }

        if (!deptName || !organizationStructure) {
          if (userAccessLevel !== 'DIVISION' && userAccessLevel !== 'DEPARTMENT') {
            setDivisionOptions([]);
          }
          return;
        }

        // Find the department in the hierarchical structure
        // Aggregates divisions from ALL regional mappings for departments like IMO
        const departmentsWithDivisions =
          organizationStructure?.availableUnits?.departmentsWithDivisions || [];
        const matched = departmentsWithDivisions.filter(
          (d) =>
            String(d.departmentName).toLowerCase() ===
            String(deptName).toLowerCase()
        );

        if (matched && matched.length > 0) {
          // Aggregate all divisions from all mappings and remove duplicates
          const allDivisions = new Set();
          matched.forEach((mapping) => {
            mapping.divisions?.forEach((div) => {
              if (div.name) allDivisions.add(div.name);
            });
          });
          const divisions = Array.from(allDivisions).sort();
          setDivisionOptions(divisions);
        } else {
          if (userAccessLevel !== 'DIVISION' && userAccessLevel !== 'DEPARTMENT') {
            setDivisionOptions([]);
          }
        }
      }

      if (name === "Division") {
        const divName = values?.Division || "";
        
        // Only clear Section if user can change Division
        if (userAccessLevel !== 'DIVISION') {
          if (!divName) {
            setSectionOptions([]);
          } else {
            // Find the selected division in the hierarchical structure
            const departmentsWithDivisions =
              organizationStructure?.availableUnits?.departmentsWithDivisions ||
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
        const regionId = regionValue?._id || regionValue;
        const regionName = regionValue?.regionName || regionValue;
        const regionMappings =
          organizationStructure?.mappings?.filter(
            (mapping) => mapping.regionId === regionId || mapping.regionName === regionName
          ) || [];
      const departmentIds = regionMappings.map(
        (mapping) => mapping.departmentId
      );
      const depts =
        organizationStructure?.availableUnits?.departments?.filter((dept) =>
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
      // Aggregates divisions from ALL regional mappings for departments like IMO
      const departmentsWithDivisions =
        organizationStructure?.availableUnits?.departmentsWithDivisions || [];
      const matched = departmentsWithDivisions.filter(
        (d) =>
          String(d.departmentName).toLowerCase() ===
          String(deptValue).toLowerCase()
      );

      if (matched && matched.length > 0) {
        // Aggregate all divisions from all mappings and remove duplicates
        const allDivisions = new Set();
        matched.forEach((mapping) => {
          mapping.divisions?.forEach((div) => {
            if (div.name) allDivisions.add(div.name);
          });
        });
        const divisions = Array.from(allDivisions).sort();
        setDivisionOptions(divisions);
      } else {
        if (userAccessLevel !== 'DIVISION' && userAccessLevel !== 'DEPARTMENT') {
          setDivisionOptions([]);
        }
      }
    }
  }, [watch("Department"), organizationStructure]);

  // Handle default Division value changes - fetch sections
  useEffect(() => {
    const divValue = watch("Division");
    if (divValue && organizationStructure) {
      // Find the selected division in the hierarchical structure
      const departmentsWithDivisions =
        organizationStructure?.availableUnits?.departmentsWithDivisions ||
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

  // Unified initialization effect when dialog opens or row changes
  useEffect(() => {
    const initializeData = async () => {
      if (!isOpen || !row) return;

      // 1. Set basic employee information
      setValue("EmployeeFullName", row.EmployeeFullName || "");
      setValue("Employee_No", row.EmployeeID || row.Employee_No || "");
      setValue("Region", row.Region || "");
      setValue("Department", row.Department || "");
      setValue("Division", row.Division || "");
      setValue("Item_No", row.Item_No || row.ItemNumber || row.itemNumber || "");
      setValue("PositionTitle", row.PositionTitle || "");
      setValue("StatusOfAppointment", row.StatusOfAppointment || "");
      setValue("DateOfAppointment", formatDateForInput(row.DateOfAppointment));
      setValue("DateOfBirth", formatDateForInput(row.DateOfBirth));
      setValue("Status", row.Status || "Active");
      setValue("SG", row.SG || "");
      setValue("PG", row.PG || "");

      // 2. Initialize salary and step data for non-COS employees
      if (row.SG && row.StatusOfAppointment?.toString().toUpperCase() !== 'COS') {
        try {
          const url = useCPCSForEmployeeAdd
            ? `cpcs-salary/grades?salary_grade=${row.SG}`
            : `salary-grades?salary_grade=${row.SG}`;
          const response = await api.get(url);
          const salaryGrades = response.data.grades?.[0];

          if (salaryGrades) {
            const steps = salaryGrades.steps.map((aw) => aw + "");
            setStepOptions(steps);
            setSalaryData(salaryGrades);

            // Set JG if it exists in salary data or row
            setValue("JG", salaryGrades.job_grade || row.JG || "");
            
            // Set Step - prioritize row data, fallback to first step
            const targetStep = row.Step != null ? String(row.Step) : (steps[0] || "1");
            setValue("Step", targetStep);

            if (useCPCSForEmployeeAdd && salaryGrades.cpcs2PayGrade != null) {
              setValue("PG", salaryGrades.cpcs2PayGrade);
            }

            // Calculate and set Rate based on salary grade data
            const correctRate = salaryGrades.rates?.[targetStep];
            setValue("Rate", correctRate || row.Rate || "");
          } else {
            setStepOptions(["1", "2", "3", "4", "5", "6", "7", "8"]);
            setSalaryData(null);
            setValue("Step", row.Step != null ? String(row.Step) : "1");
            setValue("Rate", row.Rate || "");
          }
        } catch (error) {
          console.error("❌ Error initializing salary data:", error);
          setStepOptions(["1", "2", "3", "4", "5", "6", "7", "8"]);
          setSalaryData(null);
          setValue("Step", row.Step != null ? String(row.Step) : "1");
          setValue("Rate", row.Rate || "");
        }
      } else {
        // Handle COS or no SG
        setStepOptions(["1", "2", "3", "4", "5", "6", "7", "8"]);
        setValue("Step", row.Step != null ? String(row.Step) : "");
        setValue("Rate", row.Rate || "");
      }
    };

    initializeData();
  }, [isOpen, row, setValue, useCPCSForEmployeeAdd]);

  const handleSave = async (data) => {
    // Store the form data and show confirmation dialog
    setFormDataToSave(data);
    setShowConfirmDialog(true);
  };

  const handleConfirmSave = async () => {
    const data = formDataToSave;
    // console.log("💾 handleConfirmSave called - this should ONLY happen when user clicks Update Employee button");
    // console.log("🎯 Current activeStep:", activeStep);
    // console.log("📋 Expected final step:", steps.length - 1);
    // console.log("⚠️  If activeStep is not 3 (Review), this is a BUG!");
    // console.log("💾 Updating employee with data:", data);
    // console.log("🎂 DateOfBirth in data:", data.DateOfBirth);

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

    // Convert EmployeeFullName to uppercase
    if (data.EmployeeFullName) {
      data.EmployeeFullName = String(data.EmployeeFullName).trim().toUpperCase();
    }

    // Map Item_No to itemNumber for backend
    if (data.Item_No != null && data.Item_No !== "") {
      data.itemNumber = data.Item_No;
    }
    delete data.Item_No;
    // Map Employee_No to EmployeeID for backend
    if (data.Employee_No != null && String(data.Employee_No).trim() !== "") {
      data.EmployeeID = String(data.Employee_No).trim();
    }
    delete data.Employee_No;

    // Add employee status field if not present
    if (!data.employeeStatus) {
      data.employeeStatus = data.Status === "Active" ? "Active" : "Inactive";
    }

    // Add fiscal year if available
    if (activeSettings?.fiscalYear) {
      data.fiscalYear = activeSettings.fiscalYear;
    }

    // Add entitlement fields to the payload
    data.entitledToMedicalMeal = entitledToMedicalMeal;
    data.noOfDependent = noOfDependent;

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
      
      // console.log("✅ Employee updated successfully, refreshing table...");
      
      // Call onDataChange callback to refresh parent component (stats, etc)
      if (onDataChange) {
        onDataChange();
        // console.log("📊 Parent component notified to refresh stats");
      }
      
      // console.log("🔄 Data refreshed successfully");
      handleClose();
      
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
    // console.log("🚀 handleNext called, activeStep:", activeStep);
    // console.log("📋 Current steps.length:", steps.length);
    // console.log("🎯 Will this be the last step?", activeStep >= steps.length - 1);
    
    const fieldsForStep = getFieldsForStep(activeStep);
    // console.log("📝 Fields to validate:", fieldsForStep);

    try {
      const isStepValid = await trigger(fieldsForStep);
      // console.log("✅ Validation result:", isStepValid);

      if (isStepValid) {
        const nextStep = activeStep + 1;
        // console.log("🔄 Moving to step:", nextStep);
        setActiveStep(nextStep);
        
        // Add debugging for potential auto-submission
        if (nextStep >= steps.length) {
          // console.log("⚠️  Reached or exceeded max steps - this should not auto-submit");
        }
      } else {
        // console.log("❌ Validation failed, staying on current step");
        fieldsForStep.forEach((field) => {
          if (errors[field]) {
            // console.log(`❌ Field ${field} has error:`, errors[field].message);
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
    // console.log("🚪 Opening edit dialog with row data:", row);
    // console.log("🚪 Row Step value:", row?.Step);
    // console.log("🚪 Row JG value:", row?.JG);
    // console.log("🚪 Row SG value:", row?.SG);
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
        return ["EmployeeFullName", "Department"];
      case 1: // Position Information
        return ["PositionTitle", "StatusOfAppointment"];
      case 2: // Salary Information - SG, JG, PG not required (bases from salary tables)
        return ["Rate"];
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
            // console.log("🚫 Form submission prevented! This should not trigger handleSave");
            return false;
          }} onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              // console.log("🚫 Enter key submission prevented!");
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
              {/* {activeSettings?.fiscalYear && (
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
              )} */}

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
                    <Grid item xs={12} sm={6}>
                      <CustomTextField
                        fieldName="Item_No"
                        control={control}
                        label="Item No."
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <CustomTextField
                        fieldName="Employee_No"
                        control={control}
                        label="Employee Number"
                        helperText="e.g. V00001 for VACANT positions"
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
                        disabled={userAccessLevel === 'DIVISION' || userAccessLevel === 'DEPARTMENT'}
                        onChange={(val) => {
                          if (userAccessLevel !== 'DIVISION' && userAccessLevel !== 'DEPARTMENT') {
                            setValue("Division", "");
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
                        onChange={async (selectedPosition) => {
                          if (selectedPosition) {
                            if (selectedPosition.SG != null) {
                              setValue("SG", selectedPosition.SG);
                            }
                            if (selectedPosition.JG) {
                              setValue("JG", selectedPosition.JG);
                            }
                            if (selectedPosition.PG) {
                              setValue("PG", selectedPosition.PG);
                            }

                            // Trigger Rate recalculation
                            const stepVal = getValues("Step") || "1";
                            setValue("Step", stepVal);
                            const status = getValues("StatusOfAppointment")?.toString().toUpperCase();
                            
                            if (status) {
                              if (status === 'COS' && selectedPosition.SG != null) {
                                try {
                                  const res = await api.get(`/cos-salary/rate/${selectedPosition.SG}/${stepVal}`);
                                  if (res.data?.rate != null) setValue("Rate", res.data.rate);
                                } catch (err) {
                                  console.error("Error fetching COS rate:", err);
                                }
                              } else if (status === 'CASUAL' && selectedPosition.JG) {
                                try {
                                  const path = typeof useCPCSForEmployeeAdd !== 'undefined' && useCPCSForEmployeeAdd
                                    ? `/cpcs-salary/rate-by-job-grade-and-step/${selectedPosition.JG}/${stepVal}`
                                    : `/rate-by-job-grade-and-step/${selectedPosition.JG}/${stepVal}`;
                                  const response = await api.get(path);
                                  if (response.data?.rate) setValue("Rate", response.data.rate);
                                } catch (error) {
                                  console.error("Error fetching JG rate:", error);
                                }
                              } else if ((status === 'PERMANENT' || status === 'CONTRACTUAL' || (status === 'CASUAL' && typeof cpcs2Types !== 'undefined' && cpcs2Types.includes('CASUAL'))) && selectedPosition.SG != null) {
                                try {
                                  const url = typeof useCPCSForEmployeeAdd !== 'undefined' && useCPCSForEmployeeAdd
                                    ? `cpcs-salary/grades?salary_grade=${selectedPosition.SG}`
                                    : `salary-grades?salary_grade=${selectedPosition.SG}`;
                                  const response = await api.get(url);
                                  const salaryGrades = response.data.grades?.[0];
                                  if (salaryGrades) {
                                    if (typeof setSalaryData !== 'undefined') setSalaryData(salaryGrades);
                                    const steps = salaryGrades.steps.map(aw => aw + "");
                                    if (typeof setStepOptions !== 'undefined') setStepOptions(steps);
                                    const stepToUse = steps.includes(stepVal) ? stepVal : (steps[0] || "1");
                                    setValue("Step", stepToUse);
                                    const rate = salaryGrades.rates?.[stepToUse];
                                    setValue("Rate", rate || "");
                                  }
                                } catch (err) {
                                  console.error("Error fetching SG rate:", err);
                                }
                              }
                            }
                            trigger(["SG", "JG", "PG", "Step", "Rate"]);
                          }
                        }}
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
                    {/* Entitled to Medical/Meal Allowance toggle */}
                    <Grid item xs={12}>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 2,
                          p: 2,
                          borderRadius: "8px",
                          border: `1px solid ${theme.palette.divider}`,
                          background: entitledToMedicalMeal
                            ? (theme.palette.mode === "dark" ? "rgba(76,175,80,0.12)" : "#f0faf0")
                            : "transparent",
                          transition: "background 0.3s",
                        }}
                      >
                        <Switch
                          id="edit-entitledToMedicalMeal-switch"
                          checked={entitledToMedicalMeal}
                          onChange={(e) => setEntitledToMedicalMeal(e.target.checked)}
                          color="success"
                        />
                        <Box>
                          <Typography variant="body2" fontWeight={600}>
                            Entitled to Medical / Meal Allowance
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Auto-enabled for employees hired before January 1, 1989. You may override manually.
                          </Typography>
                        </Box>
                        {entitledToMedicalMeal && (
                          <Chip
                            label="Entitled"
                            size="small"
                            color="success"
                            variant="outlined"
                            sx={{ ml: "auto", fontWeight: 700 }}
                          />
                        )}
                      </Box>
                    </Grid>
                    {/* Number of Dependents (used for Children Allowance & Medical Allowance) */}
                    <Grid item xs={12} sm={6}>
                      <CustomTextField
                        fieldName="noOfDependent"
                        control={control}
                        label="Number of Dependents (0–4)"
                        type="number"
                        defaultValue={noOfDependent}
                        rules={{
                          min: { value: 0, message: "Cannot be negative" },
                          max: { value: 4, message: "Maximum 4 dependents" },
                        }}
                        onChange={(e) => {
                          const val = Math.min(4, Math.max(0, parseInt(e.target.value, 10) || 0));
                          setNoOfDependent(val);
                          setValue("noOfDependent", val);
                        }}
                      />
                    </Grid>
                  </Grid>
                </Box>
              )}

              {activeStep === 2 && (
                <Box>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                    {watchedValues.StatusOfAppointment && 
                     watchedValues.StatusOfAppointment.toString().toUpperCase() === 'COS' 
                      ? "Contract Information"
                      : "Salary Information"}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 3 }}
                  >
                    {watchedValues.StatusOfAppointment && 
                     watchedValues.StatusOfAppointment.toString().toUpperCase() === 'COS' 
                      ? "Update the contract rate for this COS employee."
                      : "Enter the salary grade and rate details for permanent/contractual employees."}
                  </Typography>

                  <Grid container spacing={2}>
                    {/* Show SG for Permanent/Contractual employees only */}
                    {watchedValues.StatusOfAppointment &&
                     (watchedValues.StatusOfAppointment.toString().toUpperCase() === 'PERMANENT' ||
                      watchedValues.StatusOfAppointment.toString().toUpperCase() === 'CONTRACTUAL') && (
                      <Grid item xs={12} sm={6}>
                        <CustomTextField
                          fieldName="SG"
                          control={control}
                          label="Salary Grade"
                          type="number"
                          rules={{
                            min: {
                              value: 1,
                              message: "Salary grade must be at least 1",
                            },
                          }}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <PesoIcon sx={{ color: "action.main" }} />
                              </InputAdornment>
                            ),
                          }}
                          onChange={async (e) => {
                            const sgValue = e.target.value;
                            setValue("SG", sgValue);

                            if (sgValue) {
                              try {
                                const url = useCPCSForEmployeeAdd
                                  ? `cpcs-salary/grades?salary_grade=${sgValue}`
                                  : `salary-grades?salary_grade=${sgValue}`;
                                const response = await api.get(url);
                                const salaryGrades = response.data.grades?.[0];

                                if (salaryGrades) {
                                  setValue("JG", salaryGrades.job_grade || "");
                                  if (useCPCSForEmployeeAdd && salaryGrades.cpcs2PayGrade != null) {
                                    setValue("PG", salaryGrades.cpcs2PayGrade);
                                  }
                                  const steps = salaryGrades.steps.map(
                                    (aw) => aw + ""
                                  );
                                  setStepOptions(steps);
                                  setSalaryData(salaryGrades);
                                  const defaultStep = steps[0];
                                  setValue("Step", defaultStep);
                                  const rate = salaryGrades.rates?.[defaultStep];
                                  setValue("Rate", rate || "");

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
                    )}
                    {/* Show JG for Casual employees, hide for others */}
                    {watchedValues.StatusOfAppointment &&
                     watchedValues.StatusOfAppointment.toString().toUpperCase() === 'CASUAL' && (
                      <Grid item xs={12} sm={6}>
                        <CustomTextField
                          fieldName="JG"
                          control={control}
                          label="Job Grade"
                          type="number"
                          onChange={async (e) => {
                            const jgValue = e.target.value;
                            setValue("JG", jgValue);

                            const status = watchedValues.StatusOfAppointment?.toString().toUpperCase();
                            if (status !== 'CASUAL') return;

                            if (jgValue) {
                              // Set default step to 1 if not already set
                              const currentStep = getValues("Step");
                              const stepValue = currentStep || "1";
                              if (!currentStep) {
                                setValue("Step", stepValue);
                              }

                              try {
                                const path = useCPCSForEmployeeAdd
                                  ? `/cpcs-salary/rate-by-job-grade-and-step/${jgValue}/${stepValue}`
                                  : `/rate-by-job-grade-and-step/${jgValue}/${stepValue}`;
                                const response = await api.get(path);
                                const rateData = response.data;

                                if (rateData && rateData.rate) {
                                  setValue("Rate", rateData.rate);
                                  trigger("Rate");
                                } else {
                                  setValue("Rate", "");
                                }
                              } catch (error) {
                                console.error(
                                  "Error fetching rate by job grade and step:",
                                  error
                                );
                                setValue("Rate", "");
                              }
                            } else {
                              setValue("Rate", "");
                            }
                          }}
                        />
                      </Grid>
                    )}
                    {/* PG - optional, with SG/JG in Salary Information (not for COS - COS uses SG only) */}
                    {(watchedValues.StatusOfAppointment?.toString().toUpperCase() === 'PERMANENT' ||
                      watchedValues.StatusOfAppointment?.toString().toUpperCase() === 'CONTRACTUAL' ||
                      watchedValues.StatusOfAppointment?.toString().toUpperCase() === 'CASUAL') && (
                      <Grid item xs={12} sm={6}>
                        <CustomTextField
                          fieldName="PG"
                          control={control}
                          label="PG"
                          type="number"
                        />
                      </Grid>
                    )}
                    {/* COS: SG + Step (optional) - auto-compute Rate from cos-salary-table */}
                    {watchedValues.StatusOfAppointment &&
                     watchedValues.StatusOfAppointment.toString().toUpperCase() === 'COS' && (
                      <>
                        <Grid item xs={12} sm={6}>
                          <CustomTextField
                            fieldName="SG"
                            control={control}
                            label="Salary Grade (COS)"
                            type="number"
                            rules={{ min: { value: 1, message: "SG must be at least 1" } }}
                            onChange={async (e) => {
                              const sgVal = e.target.value;
                              setValue("SG", sgVal);
                              const stepVal = getValues("Step");
                              if (sgVal && stepVal) {
                                try {
                                  const res = await api.get(`/cos-salary/rate/${sgVal}/${stepVal}`);
                                  if (res.data?.rate != null) setValue("Rate", res.data.rate);
                                } catch (err) {
                                  console.error("Error fetching COS rate:", err);
                                }
                              }
                            }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <CustomAutoComplete
                            fieldName="Step"
                            options={["1", "2", "3", "4", "5", "6", "7", "8"]}
                            label="Step (COS)"
                            control={control}
                            onChange={async (val) => {
                              setValue("Step", val);
                              const sgVal = getValues("SG");
                              if (sgVal && val) {
                                try {
                                  const res = await api.get(`/cos-salary/rate/${sgVal}/${val}`);
                                  if (res.data?.rate != null) setValue("Rate", res.data.rate);
                                } catch (err) {
                                  console.error("Error fetching COS rate:", err);
                                }
                              }
                              trigger("Rate");
                            }}
                          />
                        </Grid>
                      </>
                    )}
                    {/* Step field - show for Permanent, Contractual, and Casual employees */}
                    {watchedValues.StatusOfAppointment &&
                     watchedValues.StatusOfAppointment.toString().toUpperCase() !== 'COS' && (
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
                          onChange={async (value) => {
                            setValue("Step", value);
                            const status = watchedValues.StatusOfAppointment?.toString().toUpperCase();

                            if (status === 'PERMANENT' || status === 'CONTRACTUAL') {
                                if (salaryData && value) {
                                    const rate = salaryData.rates[value] || "";
                                    setValue("Rate", rate);
                                }
                            } else if (status === 'CASUAL') {
                                const jgValue = getValues("JG");
                                if (jgValue && value) {
                                    try {
                                        const path = useCPCSForEmployeeAdd
                                            ? `/cpcs-salary/rate-by-job-grade-and-step/${jgValue}/${value}`
                                            : `/rate-by-job-grade-and-step/${jgValue}/${value}`;
                                        const response = await api.get(path);
                                        const rateData = response.data;
                                        if (rateData && rateData.rate) {
                                            setValue("Rate", rateData.rate);
                                        } else {
                                            setValue("Rate", "");
                                        }
                                    } catch (error) {
                                        console.error("Error fetching rate by job grade and step:", error);
                                        setValue("Rate", "");
                                    }
                                }
                            }
                            trigger("Rate");
                          }}
                        />
                      </Grid>
                    )}
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
                        {watchedValues.Item_No && (
                          <Typography variant="body2">
                            Item No.: {watchedValues.Item_No}
                          </Typography>
                        )}
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

                          {watchedValues.Division && (
                            <Box sx={{ mb: 2 }}>
                              <Typography variant="body2" color="text.secondary">
                                Division
                              </Typography>
                              <Typography variant="body1">
                                {watchedValues.Division}
                              </Typography>
                            </Box>
                          )}

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
                            {watchedValues.StatusOfAppointment && 
                             watchedValues.StatusOfAppointment.toString().toUpperCase() === 'COS' ? (
                              <>
                                {(watchedValues.SG || watchedValues.Step) && (
                                  <Typography variant="body2" color="text.secondary">
                                    SG: {watchedValues.SG ?? "N/A"} | Step: {watchedValues.Step ?? "N/A"} (from cos-salary-table)
                                  </Typography>
                                )}
                                <Typography variant="body1">
                                  Contract Rate: ₱{watchedValues.Rate ? Number(watchedValues.Rate).toLocaleString() : "N/A"}
                                </Typography>
                              </>
                            ) : (
                              <>
                                <Typography variant="body1">
                                  SG: {watchedValues.SG ?? "N/A"} | JG:{" "}
                                  {watchedValues.JG != null && watchedValues.JG !== "" ? String(watchedValues.JG).replace(/^JG-?/, '') : "N/A"} | PG: {watchedValues.PG ?? "N/A"} | Step:{" "}
                                  {watchedValues.Step ?? "N/A"}
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
                              </>
                            )}
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
              {formDataToSave.Item_No && (
                <Typography variant="body2" color="text.secondary">
                  Item No.: {formDataToSave.Item_No}
                </Typography>
              )}
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
