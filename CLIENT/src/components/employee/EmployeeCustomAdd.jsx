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
  FormControl,
  Select,
  InputLabel,
  MenuItem,
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
import PesoIcon from "../icons/PesoIcon";
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
  const { activeRegion, availableRegions } = useRegion(); // Add this line to get activeRegion from context and availableRegions
  const queryClient = useQueryClient(); // Add this line to get queryClient
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
  const [useCPCSForEmployeeAdd, setUseCPCSForEmployeeAdd] = useState(false);
  const [cpcs1Types, setCpcs1Types] = useState(["CASUAL"]);
  const [cpcs2Types, setCpcs2Types] = useState(["PERMANENT"]);
  // Entitled to Medical/Meal toggle state (auto-derived + manually overridable)
  const [entitledToMedicalMeal, setEntitledToMedicalMeal] = useState(false);
  const [noOfDependent, setNoOfDependent] = useState(0);


  // Fetch CPCS salary setting when add dialog opens (for rate lookup)
  useEffect(() => {
    if (!isOpen) return;
    api.get("/cpcs-salary/use-cpcs")
      .then((res) => {
        setUseCPCSForEmployeeAdd(res.data?.useCPCSForEmployeeAdd === true);
        setCpcs1Types(Array.isArray(res.data?.cpcs1AppointmentTypes) ? res.data.cpcs1AppointmentTypes : ["CASUAL"]);
        setCpcs2Types(Array.isArray(res.data?.cpcs2AppointmentTypes) ? res.data.cpcs2AppointmentTypes : ["PERMANENT"]);
      })
      .catch(() => {
        setUseCPCSForEmployeeAdd(false);
        setCpcs1Types(["CASUAL"]);
        setCpcs2Types(["PERMANENT"]);
      });
  }, [isOpen]);

  // Debug user context
  useEffect(() => {
    if (currentUser) {
    } else {
      // No current user found in context
    }
  }, [currentUser]);

  // Initialize react-hook-form
  const methods = useForm({
    mode: "onChange",
    defaultValues: {
      Region: "",
      Department: "",
      Division: "",
      Status: "Active",
      DateOfBirth: "",
      Item_No: "",
      Employee_No: "", // Employee Number (optional; for VACANT leave blank to auto-generate e.g. V00001)
      PG: "",
    },
  });

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    trigger,
    formState: { errors, isValid },
    getValues, // Add getValues here
  } = methods;

  // Watch all form values for the review step
  const watchedValues = watch();

  // Auto-derive entitledToMedicalMeal from DateOfAppointment (hired before 1989)
  const watchedDOA = watch("DateOfAppointment");
  useEffect(() => {
    if (watchedDOA) {
      const doa = new Date(watchedDOA);
      const cutoff = new Date("1989-01-01");
      setEntitledToMedicalMeal(doa < cutoff);
    }
  }, [watchedDOA]);

  // Dynamic options for Division and Section based on Department
  const [divisionOptions, setDivisionOptions] = useState([]);
  const [sectionOptions, setSectionOptions] = useState([]);
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [positionOptions, setPositionOptions] = useState([]);
  const [organizationStructure, setOrganizationStructure] = useState(null);

  // States for bulk upload Department & Division selection
  const [uploadDepartment, setUploadDepartment] = useState("");
  const [uploadDivision, setUploadDivision] = useState("");
  const [uploadDivisionOptions, setUploadDivisionOptions] = useState([]);

  // Get user's hierarchical access information
  const userAccessLevel = currentUser?.hierarchicalAccess?.scope || currentUser?.hierarchicalAccess?.assignmentLevel || 'REGION';
  const rawDivision = currentUser?.hierarchicalAccess?.accessibleDivisions?.[0];
  const userDivision = typeof rawDivision === "string" ? rawDivision : (rawDivision?.divisionName || rawDivision?.name || rawDivision?.Division || "");
  const deptObj = currentUser?.hierarchicalAccess?.accessibleDepartments?.[0];
  const userDepartment = typeof deptObj === "string" ? deptObj : (deptObj?.departmentName || deptObj?.Department || deptObj?.DepartmentName || "");
  const userRegion = currentUser?.hierarchicalAccess?.accessibleRegions?.[0]?.regionName
    || currentUser?.hierarchicalAccess?.accessibleRegions?.[0]?.Region
    || currentUser?.hierarchicalAccess?.accessibleRegions?.[0]?.name || "";

  const activeRegionName = activeRegion ? (activeRegion.Region || activeRegion.name || activeRegion.regionName) : null;
  const isAllRegionsActive = activeRegionName && String(activeRegionName).toLowerCase() === "all regions";

  // Dynamic divisions lookup for bulk upload
  // Filters divisions by activeRegion if available, else aggregates divisions from ALL regional mappings for departments like IMO
  useEffect(() => {
    if (!uploadDepartment || !organizationStructure) {
      setUploadDivisionOptions([]);
      setUploadDivision("");
      return;
    }
    const departmentsWithDivisions = organizationStructure?.availableUnits?.departmentsWithDivisions || [];
    let matched = departmentsWithDivisions.filter(
      (d) => String(d.departmentName).toLowerCase() === String(uploadDepartment).toLowerCase()
    );

    // Apply activeRegion filter if available to prevent showing IMOs from other regions
    const activeRegionName = activeRegion 
      ? (activeRegion.Region || activeRegion.name || activeRegion.regionName || String(activeRegion)) 
      : (userRegion || "");

    if (activeRegionName && activeRegionName.toLowerCase() !== "all regions") {
      const regionLower = activeRegionName.toLowerCase();
      matched = matched.filter(m => 
        m.regionName && m.regionName.toLowerCase() === regionLower
      );
    }

    if (matched && matched.length > 0) {
      // Aggregate all divisions from matched mappings and remove duplicates
      const allDivisions = new Set();
      matched.forEach((mapping) => {
        mapping.divisions?.forEach((div) => {
          if (div.name) allDivisions.add(div.name);
        });
      });
      const divisions = Array.from(allDivisions).sort();
      setUploadDivisionOptions(divisions);
    } else {
      setUploadDivisionOptions([]);
    }
    setUploadDivision("");
  }, [uploadDepartment, organizationStructure, activeRegion, userRegion]);

  // Pre-fill and lock upload selectors based on user access levels
  useEffect(() => {
    if (isImportOpen) {
      if (userAccessLevel === 'DIVISION') {
        setUploadDepartment(userDepartment || "");
        if (userDepartment && organizationStructure) {
          const departmentsWithDivisions = organizationStructure?.availableUnits?.departmentsWithDivisions || [];
          const matched = departmentsWithDivisions.filter(
            (d) => String(d.departmentName).toLowerCase() === String(userDepartment).toLowerCase()
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
            setUploadDivisionOptions(divisions);
          }
        }
        setUploadDivision(userDivision || "");
      } else if (userAccessLevel === 'DEPARTMENT') {
        setUploadDepartment(userDepartment || "");
        if (userDepartment && organizationStructure) {
          const departmentsWithDivisions = organizationStructure?.availableUnits?.departmentsWithDivisions || [];
          const matched = departmentsWithDivisions.filter(
            (d) => String(d.departmentName).toLowerCase() === String(userDepartment).toLowerCase()
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
            setUploadDivisionOptions(divisions);
          }
        }
        setUploadDivision("");
      } else {
        setUploadDepartment("");
        setUploadDivision("");
        setUploadDivisionOptions([]);
      }
    }
  }, [isImportOpen, userAccessLevel, userDepartment, userDivision, organizationStructure]);

  // Set Region value when activeRegion changes
  useEffect(() => {
    if (activeRegion && !isAllRegionsActive) {
      const regionVal = activeRegion.Region || activeRegion.name || activeRegion.regionName;
      if (regionVal) {
        setValue("Region", regionVal);
      }
    }
  }, [activeRegion, isAllRegionsActive, setValue]);

  // Auto-populate fields based on user's hierarchical access level
  useEffect(() => {
    if (currentUser?.hierarchicalAccess) {
      const accessLevel = userAccessLevel;
      
      switch (accessLevel) {
        case 'DIVISION':
          if (userDivision) setValue("Division", userDivision);
          if (userRegion) setValue("Region", userRegion);
          if (userDepartment) setValue("Department", userDepartment);
          break;
          
        case 'DEPARTMENT':
          if (userDepartment) setValue("Department", userDepartment);
          if (userRegion) setValue("Region", userRegion);
          break;
          
        case 'REGION':
          if (userRegion) setValue("Region", userRegion);
          break;
          
        case 'BUDGET_AND_REVENUE_DIVISION':
        case 'FULL':
        default:
          // For BRD, FULL, or others: default to activeRegion if it's a specific region
          if (activeRegion && !isAllRegionsActive) {
            const regionVal = activeRegion.Region || activeRegion.name || activeRegion.regionName;
            if (regionVal) {
              setValue("Region", regionVal);
            }
          }
          break;
      }
    }
  }, [currentUser, userAccessLevel, userDivision, userDepartment, userRegion, activeRegion, isAllRegionsActive, setValue]);

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
        // Use structure=old so we get departments, departmentsWithDivisions, and mappings (regionId/departmentId) for Department/Division/Section combos
        const response = await api.get(
          "/api/hierarchical-rbac/organization-structure",
          { params: { structure: "old" } }
        );
        if (response.data?.data) {
          const data = response.data.data;
          setOrganizationStructure(data);

          const allDepts = data?.availableUnits?.departments || [];
          const allMappings = data?.mappings || [];
          const regions = data?.availableUnits?.regions || [];

          if (activeRegion) {
            let regionId = null;
            const regionName = activeRegion.Region || activeRegion.name || activeRegion.regionName;
            if (regionName && regions.length > 0) {
              const matchedRegion = regions.find(
                (r) =>
                  String(r.name || "").toLowerCase() === String(regionName).toLowerCase() ||
                  String(r.regionName || "").toLowerCase() === String(regionName).toLowerCase() ||
                  String(r.Region || "").toLowerCase() === String(regionName).toLowerCase()
              );
              if (matchedRegion && (matchedRegion.id != null || matchedRegion._id != null)) {
                regionId = String(matchedRegion.id ?? matchedRegion._id);
              }
            }
            if (!regionId) {
              regionId = activeRegion._id != null ? String(activeRegion._id) : activeRegion.id != null ? String(activeRegion.id) : null;
            }
            const regionMappings = regionId
              ? allMappings.filter((mapping) => {
                  if (mapping.regionIds && mapping.regionIds.length > 0) {
                    return mapping.regionIds.some((id) => String(id) === regionId);
                  }
                  return mapping.regionId != null && String(mapping.regionId) === regionId;
                })
              : [];
            const departmentIds = regionMappings.map((mapping) => mapping.departmentId);
            const depts =
              departmentIds.length > 0
                ? allDepts.filter((dept) =>
                    departmentIds.some(
                      (id) => id != null && dept.id != null && String(id) === String(dept.id)
                    )
                  )
                : [];
            // If no departments for this region (e.g. no mappings), show all departments so user can still select
            setDepartmentOptions(depts.length > 0 ? depts : allDepts);
          } else {
            setDepartmentOptions(allDepts);
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
    if (!organizationStructure || !activeRegion) return;
    const allDepts = organizationStructure?.availableUnits?.departments || [];
    const allMappings = organizationStructure?.mappings || [];
    const regions = organizationStructure?.availableUnits?.regions || [];
    let regionId = null;
    const regionName = activeRegion.Region || activeRegion.name || activeRegion.regionName;
    if (regionName && regions.length > 0) {
      const matchedRegion = regions.find(
        (r) =>
          String(r.name || "").toLowerCase() === String(regionName).toLowerCase() ||
          String(r.regionName || "").toLowerCase() === String(regionName).toLowerCase() ||
          String(r.Region || "").toLowerCase() === String(regionName).toLowerCase()
      );
      if (matchedRegion && (matchedRegion.id != null || matchedRegion._id != null)) {
        regionId = String(matchedRegion.id ?? matchedRegion._id);
      }
    }
    if (!regionId) {
      regionId = activeRegion._id != null ? String(activeRegion._id) : activeRegion.id != null ? String(activeRegion.id) : null;
    }
    const regionMappings = regionId
      ? allMappings.filter((mapping) => {
          if (mapping.regionIds && mapping.regionIds.length > 0) {
            return mapping.regionIds.some((id) => String(id) === regionId);
          }
          return mapping.regionId != null && String(mapping.regionId) === regionId;
        })
      : [];
    const departmentIds = regionMappings.map((mapping) => mapping.departmentId);
    const depts =
      departmentIds.length > 0
        ? allDepts.filter((dept) =>
            departmentIds.some(
              (id) => id != null && dept.id != null && String(id) === String(dept.id)
            )
          )
        : [];
    setDepartmentOptions(depts.length > 0 ? depts : allDepts);
  }, [activeRegion, organizationStructure]);

  // When Department/Division changes, fetch divisions based on selected Department
  useEffect(() => {
    const subscription = watch((values, { name }) => {
      if (name === "Department") {
        const deptValue = values?.Department || "";
        const deptName = typeof deptValue === "string" ? deptValue : (deptValue?.name || deptValue?.departmentName || deptValue?.Department || "");
        setValue("Division", "");
        setSectionOptions([]);

        if (!deptName || !organizationStructure) {
          setDivisionOptions([]);
          return;
        }

        // Find the department in the hierarchical structure
        const departmentsWithDivisions =
          organizationStructure?.availableUnits?.departmentsWithDivisions || [];
        let matched = departmentsWithDivisions.filter(
          (d) =>
            (d.departmentId != null && deptValue?.id != null && String(d.departmentId) === String(deptValue.id)) ||
            (String(d.departmentName).toLowerCase().trim() === String(deptName).toLowerCase().trim())
        );

        // FILTER BY REGION: If a specific region is selected (not "All Regions"), filter divisions by that region
        const currentRegion = values?.Region || activeRegion;
        const regionName = typeof currentRegion === "string" 
          ? currentRegion 
          : (currentRegion?.Region || currentRegion?.name || currentRegion?.regionName || "");

        if (regionName && String(regionName).toLowerCase() !== "all regions") {
          const regionLower = String(regionName).toLowerCase().trim();
          matched = matched.filter(m => {
            if (m.regionNames && m.regionNames.length > 0) {
              return m.regionNames.some(rn => String(rn).toLowerCase().trim() === regionLower);
            }
            return m.regionName && String(m.regionName).toLowerCase().trim() === regionLower;
          });
        }

        if (matched && matched.length > 0) {
          // Aggregate all divisions from matched mappings and remove duplicates
          const allDivisions = new Set();
          matched.forEach((mapping) => {
            mapping.divisions?.forEach((div) => {
              if (div.name) allDivisions.add(div.name);
            });
          });
          const divisions = Array.from(allDivisions).sort();
          setDivisionOptions(divisions);
        } else {
          setDivisionOptions([]);
        }
      }

      if (name === "Division") {
        const divValue = values?.Division || "";
        const divName = typeof divValue === "string" ? divValue : (divValue?.name || divValue?.code || divValue?.Division || "");
        if (!divName) {
          setSectionOptions([]);
        } else {
          // Find the selected division in the hierarchical structure
          const departmentsWithDivisions =
            organizationStructure?.availableUnits?.departmentsWithDivisions ||
            [];
          
          const deptValue = values?.Department || "";
          const deptName = typeof deptValue === "string" ? deptValue : (deptValue?.name || deptValue?.departmentName || deptValue?.Department || "");
          const currentRegion = values?.Region || activeRegion;
          const regionName = typeof currentRegion === "string" 
            ? currentRegion 
            : (currentRegion?.Region || currentRegion?.name || currentRegion?.regionName || "");

          // Find specific division matching both department and region if possible
          let matchedMappings = departmentsWithDivisions.filter(dept => 
            (dept.departmentId != null && deptValue?.id != null && String(dept.departmentId) === String(deptValue.id)) ||
            (String(dept.departmentName).toLowerCase().trim() === String(deptName).toLowerCase().trim())
          );

          if (regionName && String(regionName).toLowerCase() !== "all regions") {
            const regionLower = String(regionName).toLowerCase().trim();
            matchedMappings = matchedMappings.filter(m => {
              if (m.regionNames && m.regionNames.length > 0) {
                return m.regionNames.some(rn => String(rn).toLowerCase().trim() === regionLower);
              }
              return m.regionName && String(m.regionName).toLowerCase().trim() === regionLower;
            });
          }

          // If no specific region match, fall back to all mappings for that department
          if (matchedMappings.length === 0) {
            matchedMappings = departmentsWithDivisions.filter(dept => 
              (dept.departmentId != null && deptValue?.id != null && String(dept.departmentId) === String(deptValue.id)) ||
              (String(dept.departmentName).toLowerCase().trim() === String(deptName).toLowerCase().trim())
            );
          }

          const matchedDiv = matchedMappings.flatMap(m => m.divisions || [])
            .find(div => String(div.name).toLowerCase().trim() === String(divName).toLowerCase().trim());

          if (matchedDiv && matchedDiv.sections) {
            const sections = matchedDiv.sections
              .map((section) => section.name)
              .filter(Boolean);
            setSectionOptions(sections);
          } else {
            setSectionOptions([]);
          }
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
    
    // Reset lower fields when region changes to prevent invalid data (IMO in Region 2 but Region 1 selected)
    setValue("Department", "");
    setValue("Division", "");
    setValue("Section", "");
    setDivisionOptions([]);
    setSectionOptions([]);

    if (!regionValue || !organizationStructure) return;
    const allDepts = organizationStructure?.availableUnits?.departments || [];
    const allMappings = organizationStructure?.mappings || [];
    const regions = organizationStructure?.availableUnits?.regions || [];
    let regionId = null;
    const regionName =
      typeof regionValue === "string"
        ? regionValue
        : regionValue?.regionName || regionValue?.name || regionValue?.Region;
    if (regionName && regions.length > 0) {
      const matchedRegion = regions.find(
        (r) =>
          String(r.name || "").toLowerCase() === String(regionName).toLowerCase() ||
          String(r.regionName || "").toLowerCase() === String(regionName).toLowerCase() ||
          String(r.Region || "").toLowerCase() === String(regionName).toLowerCase()
      );
      if (matchedRegion && (matchedRegion.id != null || matchedRegion._id != null)) {
        regionId = String(matchedRegion.id ?? matchedRegion._id);
      }
    }
    if (!regionId) {
      regionId = regionValue?._id != null ? String(regionValue._id) : regionValue?.id != null ? String(regionValue.id) : null;
    }
    const regionMappings = regionId
      ? allMappings.filter((mapping) => {
          if (mapping.regionIds && mapping.regionIds.length > 0) {
            return mapping.regionIds.some((id) => String(id) === regionId);
          }
          return mapping.regionId != null && String(mapping.regionId) === regionId;
        })
      : [];
    const departmentIds = regionMappings.map((mapping) => mapping.departmentId);
    const depts =
      departmentIds.length > 0
        ? allDepts.filter((dept) =>
            departmentIds.some(
              (id) => id != null && dept.id != null && String(id) === String(dept.id)
            )
          )
        : [];
    setDepartmentOptions(depts.length > 0 ? depts : allDepts);
  }, [watch("Region"), organizationStructure]);

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
    const activeRegionValue = activeRegion.name || activeRegion.Region || activeRegion.regionName;
    formData.append("activeRegion", activeRegionValue);
    
    if (uploadDepartment) {
      formData.append("activeDepartment", uploadDepartment);
    }
    if (uploadDivision) {
      formData.append("activeDivision", uploadDivision);
    }

    // Get the user's name for processBy, fallback to "Admin" if user context is not available
    const processBy =
      currentUser?.FirstName && currentUser?.LastName
        ? `${currentUser.FirstName} ${currentUser.LastName}`
        : "Admin";
    formData.append("processBy", processBy);

    // Debug logging
    // console.log("Upload debug:", {
      // hasFile: !!selectedFile,
      // fileName: selectedFile?.name,
      // activeRegion: activeRegionValue,
      // activeRegionObject: activeRegion,
      // processBy
    // });

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

        // Trigger parent component refresh
        if (onDataChange) {
          onDataChange();
        }

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
    
    // Check if a region is selected - allow BRD users to specify Region in the form when activeRegion not set
    const selectedRegionValue = activeRegion || data.Region;
    if (!selectedRegionValue) {
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

    // Ensure the Region field is set to the selected region value
    data.Region = (activeRegion ? (activeRegion.name || activeRegion.regionName || activeRegion.Region) : data.Region) || selectedRegionValue;

    // Convert EmployeeFullName to uppercase
    if (data.EmployeeFullName) {
      data.EmployeeFullName = String(data.EmployeeFullName).trim().toUpperCase();
    }

    // Map Item_No to itemNumber for backend
    if (data.Item_No != null && data.Item_No !== "") {
      data.itemNumber = data.Item_No;
    }
    delete data.Item_No;
    // Map Employee_No to EmployeeID; for VACANT leave empty to let backend auto-generate (e.g. V00001)
    if (data.Employee_No != null && String(data.Employee_No).trim() !== "") {
      data.EmployeeID = String(data.Employee_No).trim();
    }
    delete data.Employee_No;

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

    // Add entitlement fields to the payload
    data.entitledToMedicalMeal = entitledToMedicalMeal;
    data.noOfDependent = noOfDependent;

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
          "EmployeeFullName",
          "Department",
        ];
        if (!activeRegion) {
          basicFields.push("Region");
        }
        return basicFields;
      case 1: // Position Information
        return [
          "PositionTitle",
          "StatusOfAppointment",
          "DateOfAppointment",
        ];
      case 2: // Salary Information - SG, JG, PG not required (bases from employee-salary-table / cos-salary-table)
        return ["Rate"]; // Only Rate required; SG/JG/PG optional
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
                        helperText="Leave blank to auto-generate (VACANT: V00001, others: E00001)"
                      />
                    </Grid>

                    <Grid item xs={12}>
                      {activeRegion && !isAllRegionsActive && userAccessLevel !== 'BUDGET_AND_REVENUE_DIVISION' && userAccessLevel !== 'FULL' ? (
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
                      ) : (userAccessLevel === 'BUDGET_AND_REVENUE_DIVISION' || userAccessLevel === 'FULL' || isAllRegionsActive || !activeRegion) ? (
                        <Box sx={{ mb: 2 }}>
                          <CustomAutoComplete
                            fieldName="Region"
                            label="Region"
                            options={availableRegions?.filter(r => {
                              const rName = r.name || r.regionName || r.Region;
                              return rName && String(rName).toLowerCase() !== "all regions";
                            }) || []}
                            control={control}
                            getOptionLabel={(opt) => opt.name || opt.regionName || opt.Region || opt}
                            required
                            rules={{ required: "Region is required" }}
                          />
                        </Box>
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
                        required
                        rules={{ required: "Date of Appointment is required" }}
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
                          id="entitledToMedicalMeal-switch"
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
                      ? "Enter the contract rate for this COS employee."
                      : "Enter the salary grade and rate details for permanent/contractual employees."}
                  </Typography>

                  <Grid container spacing={2}>
                    {/* Show SG for Permanent/Contractual or CASUAL (CPCS 2) employees */}
                    {watchedValues.StatusOfAppointment && (() => {
                      const st = watchedValues.StatusOfAppointment.toString().toUpperCase();
                      const showSG = st === 'PERMANENT' || st === 'CONTRACTUAL' || (st === 'CASUAL' && cpcs2Types.includes('CASUAL'));
                      return showSG;
                    })() && (
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

                            const status = watchedValues.StatusOfAppointment?.toString().toUpperCase();
                            const useSG = status === 'PERMANENT' || status === 'CONTRACTUAL' || (status === 'CASUAL' && cpcs2Types.includes('CASUAL'));
                            if (!useSG) return;

                            if (sgValue) {
                              try {
                                const url = useCPCSForEmployeeAdd
                                  ? `cpcs-salary/grades?salary_grade=${sgValue}`
                                  : `salary-grades?salary_grade=${sgValue}`;
                                const response = await api.get(url);
                                const salaryGrades = response.data.grades?.[0];

                                if (salaryGrades) {
                                  setValue("JG", salaryGrades.job_grade || '');
                                  if (useCPCSForEmployeeAdd && salaryGrades.cpcs2PayGrade != null) {
                                    setValue("PG", salaryGrades.cpcs2PayGrade);
                                  }
                                  const steps = salaryGrades.steps.map(
                                    (aw) => aw + ""
                                  );
                                  setStepOptions(steps);
                                  setSalaryData(salaryGrades);
                                  const defaultStep = steps[0] || "1";
                                  setValue("Step", defaultStep);
                                  const rate = salaryGrades.rates?.[defaultStep];
                                  setValue("Rate", rate || '');

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
                    {/* Show JG for CASUAL (CPCS 1) only - when CASUAL uses Job Grade */}
                    {watchedValues.StatusOfAppointment &&
                     watchedValues.StatusOfAppointment.toString().toUpperCase() === 'CASUAL' &&
                     cpcs1Types.includes('CASUAL') && (
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
                    {/* COS: SG + Step (optional) - auto-compute Rate from cos-salary-table, no manual Rate needed */}
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
                            const casualUsesSG = status === 'CASUAL' && cpcs2Types.includes('CASUAL');

                            if (status === 'PERMANENT' || status === 'CONTRACTUAL' || casualUsesSG) {
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
                                        console.error(
                                            "Error fetching rate by job grade and step:",
                                            error
                                        );
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

              <Box sx={{ mt: 3, mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Active scope (Optional Department / Division restriction):
                </Typography>
                <Grid container spacing={2} sx={{ mt: 0.5 }}>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel id="upload-dept-select-label">Department</InputLabel>
                      <Select
                        labelId="upload-dept-select-label"
                        id="upload-dept-select"
                        value={uploadDepartment}
                        label="Department"
                        disabled={userAccessLevel === 'DIVISION' || userAccessLevel === 'DEPARTMENT'}
                        onChange={(e) => {
                          setUploadDepartment(e.target.value);
                        }}
                        sx={{ borderRadius: "8px" }}
                      >
                        <MenuItem value="">
                          <em>All Departments (No Filter)</em>
                        </MenuItem>
                        {(departmentOptions || []).map((dept) => (
                          <MenuItem key={dept.id || dept._id || dept.name} value={dept.name}>
                            {dept.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel id="upload-div-select-label">Division</InputLabel>
                      <Select
                        labelId="upload-div-select-label"
                        id="upload-div-select"
                        value={uploadDivision}
                        label="Division"
                        disabled={userAccessLevel === 'DIVISION' || !uploadDepartment}
                        onChange={(e) => {
                          setUploadDivision(e.target.value);
                        }}
                        sx={{ borderRadius: "8px" }}
                      >
                        <MenuItem value="">
                          <em>All Divisions (No Filter)</em>
                        </MenuItem>
                        {(uploadDivisionOptions || []).map((divName) => (
                          <MenuItem key={divName} value={divName}>
                            {divName}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
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
                    Required: EmployeeFullName*, Region*, Department*, PositionTitle*, StatusOfAppointment*, Status*
                  </li>
                  <li>
                    Rate: auto-computed from SG+Step (cos-salary-table for COS, employee-salary-table for others). Leave empty when SG+Step provided.
                  </li>
                  <li>
                    Optional: DateOfBirth, Division, Item_No, PG, SG, JG, Step (PG with SG/JG in Salary section)
                  </li>
                  <li>Rate will be auto-computed based on employee type (see above)</li>
                  <li>Region must match the currently selected region</li>
                  <li>Use the template download button to get the correct format</li>
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
                  onClick={async () => {
                    if (!activeRegion) {
                      toast.error("Please select a region first", {
                        style: {
                          borderRadius: "10px",
                          background: theme.palette.mode === "dark" ? "#333" : "#fff",
                          color: theme.palette.mode === "dark" ? "#fff" : "#333",
                        },
                      });
                      return;
                    }

                    try {
                      const regionName = activeRegion.name || activeRegion.regionName;
                      // console.log('Attempting to download template for region:', regionName);
                      // console.log('Active region object:', activeRegion);
                      // console.log('User access level:', userAccessLevel);
                      // console.log('User department:', userDepartment);
                      // console.log('User division:', userDivision);

                      // Prepare hierarchical access parameters
                      const params = {
                        region: regionName,
                        scope: userAccessLevel
                      };

                      // Add accessible departments if user has department-level access
                      if (userAccessLevel === 'DEPARTMENT' && currentUser?.hierarchicalAccess?.accessibleDepartments) {
                        const deptNames = currentUser.hierarchicalAccess.accessibleDepartments
                          .filter(d => d && (d.departmentName || d.name || d))
                          .map(d => d.departmentName || d.name || d);
                        if (deptNames.length > 0) {
                          params.accessibleDepartments = JSON.stringify(deptNames);
                        }
                      }

                      // Add accessible divisions if user has division-level access
                      if (userAccessLevel === 'DIVISION' && currentUser?.hierarchicalAccess?.accessibleDivisions) {
                        const divNames = currentUser.hierarchicalAccess.accessibleDivisions
                          .filter(d => d && (d.divisionName || d.name || d))
                          .map(d => d.divisionName || d.name || d);
                        if (divNames.length > 0) {
                          params.accessibleDivisions = JSON.stringify(divNames);
                        }
                      }

                      // Add accessible sections if user has section-level access
                      if (userAccessLevel === 'SECTION' && currentUser?.hierarchicalAccess?.accessibleSections) {
                        const sectNames = currentUser.hierarchicalAccess.accessibleSections
                          .filter(s => s && (s.sectionName || s.name || s))
                          .map(s => s.sectionName || s.name || s);
                        if (sectNames.length > 0) {
                          params.accessibleSections = JSON.stringify(sectNames);
                        }
                      }

                      // console.log('Template download params:', params);

                      const response = await api.get("/api/excel-upload/template", {
                        params,
                        responseType: 'blob'
                      });

                      // console.log('Template download response received');

                      // Create download link
                      const url = window.URL.createObjectURL(new Blob([response.data]));
                      const link = document.createElement('a');
                      link.href = url;
                      link.setAttribute('download', `employee_import_template_${regionName}.xlsx`);
                      document.body.appendChild(link);
                      link.click();
                      link.remove();
                      window.URL.revokeObjectURL(url);

                      toast.success("Template downloaded successfully!", {
                        style: {
                          borderRadius: "10px",
                          background: theme.palette.mode === "dark" ? "#333" : "#fff",
                          color: theme.palette.mode === "dark" ? "#fff" : "#333",
                        },
                      });
                    } catch (error) {
                      console.error("Error downloading template:", error);
                      console.error("Error details:", error.response?.data || error.message);

                      const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || "Failed to download template";

                      toast.error(errorMessage, {
                        style: {
                          borderRadius: "10px",
                          background: theme.palette.mode === "dark" ? "#333" : "#fff",
                          color: theme.palette.mode === "dark" ? "#fff" : "#333",
                        },
                      });
                    }
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
