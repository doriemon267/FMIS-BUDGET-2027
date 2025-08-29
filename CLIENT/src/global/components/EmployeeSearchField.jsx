import React, { useState, useEffect } from "react";
import { Autocomplete, TextField, CircularProgress } from "@mui/material";
import api from "../../config/api";

const EmployeeSearchField = ({ 
  label = "Search Employee", 
  onEmployeeSelect, 
  fullWidth = true, 
  required = false,
  disabled = false
}) => {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  useEffect(() => {
    let active = true;

    if (inputValue === "") {
      setOptions([]);
      return undefined;
    }

    setLoading(true);
    
    const fetchEmployees = async () => {
      try {
        const response = await api.get(`/getpersonnels/search?search=${inputValue}`);
        if (active) {
          // Add a unique key to each option to avoid React key warnings
          const employeesWithKeys = response.data.map(employee => ({
            ...employee,
            uniqueKey: employee._id || Math.random().toString(36).substr(2, 9)
          }));
          setOptions(employeesWithKeys);
        }
      } catch (error) {
        console.error("Error fetching employees:", error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    // Debounce the API call
    const timeoutId = setTimeout(() => {
      fetchEmployees();
    }, 300);

    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [inputValue]);

  const handleEmployeeChange = (event, newValue) => {
    setSelectedEmployee(newValue);
    if (onEmployeeSelect && newValue) {
      onEmployeeSelect(newValue);
    }
  };

  return (
    <Autocomplete
      id="employee-search-field"
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      isOptionEqualToValue={(option, value) => option._id === value._id}
      getOptionLabel={(option) => 
        `${option.lastName || ''}, ${option.firstName || ''} ${option.middleName || ''} (${option.employeeNumber || ''})`
      }
      options={options}
      loading={loading}
      inputValue={inputValue}
      onInputChange={(event, newInputValue) => {
        setInputValue(newInputValue);
      }}
      onChange={handleEmployeeChange}
      value={selectedEmployee}
      fullWidth={fullWidth}
      disabled={disabled}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          required={required}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={20} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
      renderOption={(props, option) => (
        <li {...props} key={option.uniqueKey}>
          {`${option.lastName}, ${option.firstName} ${option.middleName || ''} (${option.employeeNumber || ''})`}
        </li>
      )}
    />
  );
};

export default EmployeeSearchField;