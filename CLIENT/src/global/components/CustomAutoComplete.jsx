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
    
    apiList.api
      .get(`${apiList.endpoint}${searchQuery ? `?search=${searchQuery}` : ""}`)
      .then((res) => {
        const fetchedOptions = res.data[apiList.listName] || [];
        setOptions(fetchedOptions);
      })
      .catch((error) => {
        console.error("Error fetching options:", error);
        setOptions([]); // Fallback in case of an error
      });
  }, [apiList.api, apiList.endpoint, searchQuery]); // Include dependencies

  const currentOptions = optionsProp ?? options;

  return (
    <Autocomplete
      freeSolo={freeSolo}
      disabled={disabled}
      options={currentOptions}
      open={undefined} // Let Material-UI handle the open state
      getOptionLabel={(option) => {
        if (!option) {
          return "";
        }
        
        if (typeof option === "string") {
          return option;
        }

        if (typeof getOptionLabel === "function") {
          return String(getOptionLabel(option) || "");
        }
        
        const label = option[getOptionColumn || getOptionLabel] || "";
        
        return String(label);
      }}
      isOptionEqualToValue={(option, value) => {
        if (!option || !value) return false;
        if (typeof option === "string" && typeof value === "string") {
          return option === value;
        }
        if (typeof option === "object" && typeof value === "object") {
          if (option._id && value._id) return option._id === value._id;
          if (option.id && value.id) return option.id === value.id;
        }

        // Helper to get label for comparison
        const getLabel = (opt) => {
          if (typeof opt === "string") return opt;
          if (typeof getOptionLabel === "function") return getOptionLabel(opt);
          return opt[getOptionColumn || getOptionLabel] || "";
        };

        return String(getLabel(option)).toLowerCase() === String(getLabel(value)).toLowerCase();
      }}
      value={field.value || null}
      inputValue={undefined} // Let autocomplete manage its own input value
      onChange={(_, value) => {
        const newValue =
          typeof value === "string" || getObject
            ? value
            : typeof getOptionLabel === "function" 
              ? getOptionLabel(value)
              : value?.[getOptionLabel];

        field.onChange(
          getOptionColumn && value ? value[getOptionColumn] : newValue
        );
        onChange && onChange(value);
      }}
      onInputChange={(_, inputValue, _reason) => {
        // Don't override field value when input changes, let filterOptions handle it
        onInputChange && onInputChange(inputValue);
      }}
      filterOptions={(options, { inputValue }) => {
        if (!inputValue || inputValue.trim() === '') {
          return options;
        }

        const filtered = options.filter((option) => {
          const label = typeof option === "string"
            ? option
            : typeof getOptionLabel === "function"
              ? getOptionLabel(option)
              : option[getOptionColumn || getOptionLabel] || "";
          const matches = String(label || "").toLowerCase().includes(inputValue.toLowerCase());
          return matches;
        });

        return filtered;
      }}
      renderInput={(params) => {
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
        const labelText = typeof option === "string"
          ? option
          : typeof getOptionLabel === "function"
            ? getOptionLabel(option)
            : option[getOptionColumn || getOptionLabel] || "";

        // Ensure key is unique and not just [object Object]
        const key = option._id || option.id || (typeof option === "string" ? option : `opt-${state.index}`);

        return (
          <li {...props} key={key}>
            {labelText}
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
