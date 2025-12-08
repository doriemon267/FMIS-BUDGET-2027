import React, { useState, useEffect, useCallback } from "react";
import {
  TableRow,
  TableCell,
  TextField,
  IconButton,
  Autocomplete,
  Box,
  Chip,
  Tooltip,
  Zoom,
  LinearProgress,
} from "@mui/material";
import { useMutation } from "@tanstack/react-query";
import api from "../../config/api";
import { toast } from "react-hot-toast";
import SaveIcon from "@mui/icons-material/Save";
import AddIcon from "@mui/icons-material/Add";
import { useUser } from "../../context/UserContext";
import { useRegion } from "../../context/RegionContext";
import { green, blue } from "@mui/material/colors";

const InlineOvertimeAddRow = ({ refreshData, employeeOptions }) => {
  const { currentUser, assignmentLevel } = useUser();
  const { activeRegion } = useRegion();

  // Function to get hierarchical display
  const getHierarchicalDisplay = () => {
    const hierarchical = currentUser?.hierarchicalAccess || {};
    
    switch (assignmentLevel) {
      case 'DIVISION':
        return {
          label: `Division: ${hierarchical.accessibleDivisions?.[0] || currentUser?.divisionName || 'N/A'}`,
          color: 'warning'
        };
      case 'DEPARTMENT':
        return {
          label: `Department: ${hierarchical.accessibleDepartments?.[0]?.departmentName || 'N/A'}`,
          color: 'success'
        };
      case 'REGION':
        return {
          label: `Region: ${hierarchical.accessibleRegions?.[0]?.regionName || 'N/A'}`,
          color: 'primary'
        };
      case 'FULL':
        return {
          label: 'Full Access: All Data',
          color: 'error'
        };
      default:
        return {
          label: `Region: N/A`,
          color: 'primary'
        };
    }
  };
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [weekdayHours, setWeekdayHours] = useState("");
  const [weekendHours, setWeekendHours] = useState("");
  const [amount, setAmount] = useState(0);
  const [settings, setSettings] = useState(null);
  const [multipliers, setMultipliers] = useState({
    weekdayMultiplier: 1.25,
    weekendMultiplier: 1.5,
  });

  // NEW: track which employees already have records
  const [existingEmployees, setExistingEmployees] = useState([]);
  // NEW: final dropdown options after removing duplicates & final-status personnel
  const [filteredEmployeeOptions, setFilteredEmployeeOptions] = useState([]);

  const processBy = `${currentUser.FirstName} ${currentUser.LastName}`;
  const fiscalYear = settings?.fiscalYear || "";
  const budgetType = settings?.budgetType || "";

  // fetch active settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get("/settings/active");
        if (res.data) {
          setSettings(res.data);
          setMultipliers({
            weekdayMultiplier: res.data.weekdayMultiplier || 1.25,
            weekendMultiplier: res.data.weekendMultiplier || 1.5,
          });
        } else {
          toast.error("No active settings found.");
        }
      } catch (err) {
        console.error("Error fetching settings:", err);
        toast.error("Failed to fetch settings.");
      }
    };
    fetchSettings();
  }, []);

  // fetch existing overtime records for this year
  const fetchExistingRecords = useCallback(async () => {
    if (!fiscalYear) return;
    try {
      // Include region in the query if available
      const params = { fiscalYear };
      if (activeRegion?.name) {
        params.region = activeRegion.name;
      }
      
      const res = await api.get("/overtime-pay", { params });
      setExistingEmployees(res.data.data.map((rec) => rec.employeeFullName));
    } catch (error) {
      console.error("Error fetching overtime records:", error);
    }
  }, [fiscalYear, activeRegion]);

  useEffect(() => {
    fetchExistingRecords();
  }, [fiscalYear, activeRegion, fetchExistingRecords]);

  // NEW: filter out those already saved AND those whose status is Submitted/Approved
  useEffect(() => {
    setFilteredEmployeeOptions(
      employeeOptions.filter((option) =>
        !existingEmployees.includes(option.employeeFullName) &&
        !["Submitted", "Approved"].includes(option.status)
      )
    );
  }, [employeeOptions, existingEmployees]);

  // compute amount
  const computeAmount = useCallback(() => {
    if (!selectedEmployee) return 0;
    
    // Get monthly salary from employee data - support both monthlySalary and annualSalary fields
    let monthlySalary = Number(selectedEmployee.monthlySalary) || 0;
    
    // Fallback: if monthlySalary is not available, try to calculate from annualSalary
    if (!monthlySalary && selectedEmployee.annualSalary) {
      monthlySalary = Number(selectedEmployee.annualSalary) / 12;
    }
    
    // If still no valid salary, return 0
    if (!monthlySalary || isNaN(monthlySalary) || monthlySalary <= 0) {
      console.warn('Employee has no valid salary:', selectedEmployee);
      return 0;
    }
    
    const weekdayRate = (monthlySalary / 22 / 8) * multipliers.weekdayMultiplier;
    const weekendRate = (monthlySalary / 22 / 8) * multipliers.weekendMultiplier;
    const computed =
      Math.max(0, Number(weekdayHours)) * weekdayRate +
      Math.max(0, Number(weekendHours)) * weekendRate;
    return isNaN(computed) ? 0 : computed;
  }, [selectedEmployee, weekdayHours, weekendHours, multipliers]);

  useEffect(() => {
    setAmount(computeAmount());
  }, [computeAmount]);

  const mutation = useMutation({
    mutationFn: async (data) => {
      console.log('🚀 About to send request with data:', JSON.stringify(data, null, 2));
      const response = await api.post("/overtime-pay", data);
      console.log('✅ Response received:', response.data);
      return response;
    },
    onSuccess: () => {
      toast.success("Overtime record added successfully");
      setSelectedEmployee(null);
      setWeekdayHours("");
      setWeekendHours("");
      refreshData();
      fetchExistingRecords();
    },
    onError: (err) => {
      console.error('❌ Mutation error:', err);
      toast.error(err.response?.data?.message || "Error adding record");
    },
  });

  const handleSave = () => {
    if (!selectedEmployee) {
      toast.error("Please select an employee");
      return;
    }
    if (!settings) {
      toast.error("Settings not loaded. Please refresh.");
      return;
    }
    
    // Get monthly salary - support both monthlySalary and annualSalary fields
    let monthlySalary = Number(selectedEmployee.monthlySalary) || 0;
    if (!monthlySalary && selectedEmployee.annualSalary) {
      monthlySalary = Number(selectedEmployee.annualSalary) / 12;
    }
    
    // Debug log
    console.log('Selected Employee Data:', {
      employeeFullName: selectedEmployee.employeeFullName,
      monthlySalary: selectedEmployee.monthlySalary,
      annualSalary: selectedEmployee.annualSalary,
      calculatedMonthlySalary: monthlySalary,
      allFields: selectedEmployee
    });
    
    // Validate monthly salary
    if (!monthlySalary || isNaN(monthlySalary) || monthlySalary <= 0) {
      toast.error("Selected employee does not have a valid monthly salary. Data: " + JSON.stringify({monthlySalary, annualSalary: selectedEmployee.annualSalary}));
      return;
    }
    
    // Get hierarchical data for saving
    const hierarchical = currentUser?.hierarchicalAccess || {};
    
    const payload = {
      employeeFullName: selectedEmployee.employeeFullName,
      positionTitle: selectedEmployee.positionTitle,
      weekdayHours: Number(weekdayHours) || 0,
      weekendHours: Number(weekendHours) || 0,
      monthlySalary: monthlySalary,
      processBy,
      fiscalYear,
      budgetType,
      processDate: new Date(),
      // Include hierarchical organizational data
      region: hierarchical.accessibleRegions?.[0]?.regionName || activeRegion?.name || null,
      department: hierarchical.accessibleDepartments?.[0]?.departmentName || null,
      division: hierarchical.accessibleDivisions?.[0] || currentUser?.divisionName || null,
    };
    
    console.log('Payload being sent - Full details:');
    console.log('  employeeFullName:', payload.employeeFullName);
    console.log('  monthlySalary:', payload.monthlySalary);
    console.log('  weekdayHours:', payload.weekdayHours);
    console.log('  weekendHours:', payload.weekendHours);
    console.log('  fiscalYear:', payload.fiscalYear);
    console.log('  budgetType:', payload.budgetType);
    console.log('  Full payload:', JSON.stringify(payload));
    mutation.mutate(payload);
  };

  return (
    <Zoom in={true} timeout={400}>
      <TableRow
        sx={{
          backgroundColor: 'rgba(55, 94, 56, 0.02)',
          borderLeft: '4px solid #375e38',
          '&:hover': {
            backgroundColor: 'rgba(55, 94, 56, 0.05)',
          }
        }}
      >
        <TableCell>
          <Box display="flex" flexDirection="column" gap={1}>
            <Box display="flex" alignItems="center" gap={1}>
              <AddIcon sx={{ color: '#375e38', fontSize: '1rem' }} />
              <Chip
                label="Add New"
                size="small"
                sx={{
                  backgroundColor: green[50],
                  color: green[700],
                  fontWeight: 'bold'
                }}
              />
              <Chip
                label={getHierarchicalDisplay().label}
                size="small"
                sx={{
                  backgroundColor: getHierarchicalDisplay().color === 'success' ? green[50] : 
                                   getHierarchicalDisplay().color === 'warning' ? '#fff3cd' :
                                   getHierarchicalDisplay().color === 'error' ? '#f8d7da' : blue[50],
                  color: getHierarchicalDisplay().color === 'success' ? green[700] : 
                         getHierarchicalDisplay().color === 'warning' ? '#856404' :
                         getHierarchicalDisplay().color === 'error' ? '#721c24' : blue[700],
                  fontWeight: 'bold'
                }}
              />
            </Box>
            <Autocomplete
              options={filteredEmployeeOptions}
              getOptionLabel={(option) => option.employeeFullName || ""}
              isOptionEqualToValue={(option, value) => option._id === value._id}
              value={selectedEmployee}
              onChange={(e, newValue) => setSelectedEmployee(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Select Employee"
                  variant="outlined"
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '&.Mui-focused fieldset': {
                        borderColor: '#375e38',
                      },
                    },
                  }}
                />
              )}
              renderOption={(props, option) => {
                // Extract the key from props to pass it directly
                const { key, ...otherProps } = props;
                return (
                  <Box component="li" key={key} {...otherProps}>
                    <Box>
                      <Box fontWeight="medium">{option.employeeFullName}</Box>
                      <Box fontSize="0.8rem" color="text.secondary">
                        {option.positionTitle}
                      </Box>
                    </Box>
                  </Box>
                );
              }}
            />
          </Box>
        </TableCell>
        <TableCell>
          <TextField
            variant="outlined"
            size="small"
            type="number"
            value={weekdayHours}
            onChange={(e) => setWeekdayHours(e.target.value)}
            placeholder="0-3 hours"
            inputProps={{ min: 0, max: 3 }}
            sx={{
              '& .MuiOutlinedInput-root': {
                '&.Mui-focused fieldset': {
                  borderColor: '#375e38',
                },
              },
            }}
          />
        </TableCell>
        <TableCell>
          <TextField
            variant="outlined"
            size="small"
            type="number"
            value={weekendHours}
            onChange={(e) => setWeekendHours(e.target.value)}
            placeholder="0-8 hours"
            inputProps={{ min: 0, max: 8 }}
            sx={{
              '& .MuiOutlinedInput-root': {
                '&.Mui-focused fieldset': {
                  borderColor: '#375e38',
                },
              },
            }}
          />
        </TableCell>
        <TableCell>
          <Box display="flex" flexDirection="column" gap={1}>
            <TextField
              variant="outlined"
              size="small"
              value={amount.toLocaleString("en-PH", {
                style: "currency",
                currency: "PHP",
              })}
              disabled
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: '#f5f5f5',
                },
              }}
            />
            {(weekdayHours || weekendHours) && (
              <LinearProgress
                variant="determinate"
                value={Math.min((Number(weekdayHours) + Number(weekendHours)) / 11 * 100, 100)}
                sx={{
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: 'rgba(55, 94, 56, 0.1)',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: '#375e38',
                  }
                }}
              />
            )}
          </Box>
        </TableCell>
        <TableCell>
          <Tooltip title="Save Overtime Record">
            <IconButton
              onClick={handleSave}
              disabled={mutation.isLoading || !selectedEmployee}
              sx={{
                backgroundColor: blue[50],
                color: blue[700],
                '&:hover': { backgroundColor: blue[100] },
                '&:disabled': { backgroundColor: 'rgba(0,0,0,0.04)' }
              }}
            >
              <SaveIcon />
            </IconButton>
          </Tooltip>
        </TableCell>
      </TableRow>
    </Zoom>
  );
};

export default InlineOvertimeAddRow;
