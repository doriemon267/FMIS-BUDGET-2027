import { useController, useWatch } from "react-hook-form";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import { useEffect, useMemo, useState } from "react";

const CustomAutoComplete = ({
  fieldName,
  control,
  onInputChange,
  defaultOptions = [],
  options: optionsProp, // allow direct options override
  getOptionLabel = "",
  onChange = undefined,
  sx = { bgcolor: "#ffffff", m: 0 },
  size = "small",
  variant = "outlined",
  required = false,
  rules, // Add support for custom rules
  freeSolo = false,
  getObject = false,
  apiList = { api: null, endpoint: "", listName: "" },
  getOptionColumn = "", // rare usage
  disabled = false,
  label = "",
  ...rest
}) => {
  // Use provided rules, or fall back to basic required validation
  const validationRules = rules || (required
    ? { required: label + " is required" }
    : undefined);

  const {
    field,
    fieldState: { error },
  } = useController({
    name: fieldName,
    control,
    rules: validationRules,
  });

  const searchValue = useWatch({ control, name: fieldName });

  const [options, setOptions] = useState(defaultOptions); // Default options
  const searchQuery = useMemo(() => searchValue || "", [searchValue]);

  // Keep options in sync when defaultOptions or optionsProp change and no API list is used
  useEffect(() => {
    if (!apiList.api || !apiList.endpoint) {
      setOptions(optionsProp ?? defaultOptions);
    }
  }, [defaultOptions, optionsProp, apiList.api, apiList.endpoint]);

  // Fetch options from API if available
  useEffect(() => {
    if (!apiList.api || !apiList.endpoint) return;
    
    console.log('Fetching options from:', apiList.endpoint);
    console.log('Search query:', searchQuery);
    
    apiList.api
      .get(`${apiList.endpoint}${searchQuery ? `?search=${searchQuery}` : ""}`)
      .then((res) => {
        console.log('API Response:', res.data);
        const options = res.data[apiList.listName] || [];
        console.log('Extracted options:', options.slice(0, 5)); // Show first 5
        setOptions(options);
      })
      .catch((error) => {
        console.error("Error fetching options:", error);
        setOptions([]); // Fallback in case of an error
      });
  }, [apiList.api, apiList.endpoint, searchQuery]); // Include dependencies

  const currentOptions = optionsProp ?? options;
  console.log('🔍 AUTOCOMPLETE DEBUG:', {
    fieldName,
    label,
    optionsCount: currentOptions.length,
    freeSolo,
    firstFewOptions: currentOptions.slice(0, 3),
    getOptionLabel,
    getOptionColumn
  });

  return (
    <Autocomplete
      freeSolo={freeSolo}
      disabled={disabled}
      options={currentOptions}
      open={undefined} // Let Material-UI handle the open state
      getOptionLabel={(option) => {
        if (!option) {
          console.log('🏷️ getOptionLabel: option is null/undefined');
          return "";
        }
        
        const label = typeof option === "string"
          ? option
          : option[getOptionColumn || getOptionLabel] || "";
        
        console.log('🏷️ getOptionLabel called:', { 
          option: typeof option === "object" ? { ...option, _id: option._id } : option, 
          getOptionColumn, 
          getOptionLabel, 
          resultLabel: label 
        });
        return String(label);
      }}
      isOptionEqualToValue={(option, value) => {
        if (!option || !value) return false;
        if (typeof option === "string" && typeof value === "string") {
          return option === value;
        }
        if (typeof option === "object" && typeof value === "object") {
          return option._id === value._id;
        }
        // Handle mixed types (object vs string)
        const optionLabel = typeof option === "string" ? option : option[getOptionColumn || getOptionLabel] || "";
        const valueLabel = typeof value === "string" ? value : value[getOptionColumn || getOptionLabel] || "";
        return optionLabel === valueLabel;
      }}
      value={field.value || null}
      inputValue={undefined} // Let autocomplete manage its own input value
      onChange={(_, value) => {
        console.log('✅ Autocomplete onChange:', value);
        const newValue =
          typeof value === "string" || getObject
            ? value
            : value?.[getOptionLabel];

        field.onChange(
          getOptionColumn && value ? value[getOptionColumn] : newValue
        );
        onChange && onChange(value);
      }}
      onInputChange={(_, inputValue, reason) => {
        console.log('📝 Autocomplete onInputChange:', { inputValue, reason });
        // Don't override field value when input changes, let filterOptions handle it
        onInputChange && onInputChange(inputValue);
      }}
      filterOptions={(options, { inputValue }) => {
        console.log('🔍 Filtering options:', { inputValue, totalOptions: options.length });
        
        if (!inputValue || inputValue.trim() === '') {
          console.log('📋 Returning all options:', options.length);
          return options;
        }
        
        const filtered = options.filter((option) => {
          const label = typeof option === "string" 
            ? option 
            : option[getOptionColumn || getOptionLabel] || "";
          const matches = label.toLowerCase().includes(inputValue.toLowerCase());
          return matches;
        });
        
        console.log('✨ Filtered results:', { 
          inputValue, 
          filteredCount: filtered.length,
          firstFew: filtered.slice(0, 3).map(opt => 
            typeof opt === "string" ? opt : opt[getOptionColumn || getOptionLabel]
          )
        });
        return filtered;
      }}
      renderInput={(params) => {
        console.log('🎨 renderInput called:', { 
          optionsCount: currentOptions.length,
          inputProps: params.inputProps
        });
        return (
          <TextField
            {...params}
            label={label + (required ? " *" : "")}
            error={!!error}
            helperText={error ? error.message : ""}
            variant={variant}
            margin="normal"
            size={size}
            sx={sx}
            placeholder={`Type to search ${label.toLowerCase()}...`}
            {...rest}
          />
        );
      }}
      renderOption={(props, option, state) => {
        const label = typeof option === "string"
          ? option
          : option[getOptionColumn || getOptionLabel] || "";
        
        console.log('🎯 renderOption called:', { 
          option: typeof option === "object" ? { ...option, _id: option._id } : option,
          label,
          state
        });
        
        return (
          <li {...props} key={option._id || option}>
            {label}
          </li>
        );
      }}
      noOptionsText={`No ${label.toLowerCase()} found`}
      loadingText={`Loading ${label.toLowerCase()}...`}
      componentsProps={{
        popper: {
          style: { zIndex: 1300 }
        }
      }}
    />
  );
};

export default CustomAutoComplete;
