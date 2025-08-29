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
  freeSolo = false,
  getObject = false,
  apiList = { api: null, endpoint: "", listName: "" },
  getOptionColumn = "", // rare usage
  disabled = false,
  label = "",
  ...rest
}) => {
  const {
    field,
    fieldState: { error },
  } = useController({
    name: fieldName,
    control,
    rules: required ? { required: label + " is required" } : undefined,
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
      .then((res) => setOptions(res.data[apiList.listName] || [])) // Ensure fallback to empty array
      .catch((error) => {
        console.error("Error fetching options:", error);
        setOptions([]); // Fallback in case of an error
      });
  }, [apiList.api, apiList.endpoint, searchQuery]); // Include dependencies

  return (
    <Autocomplete
      freeSolo={freeSolo}
      disabled={disabled}
      {...field}
      options={optionsProp ?? options}
      getOptionLabel={(option) =>
        typeof option === "string"
          ? option
          : option[getOptionColumn || getOptionLabel] || ""
      }
      getOptionKey={(option) =>
        typeof option === "string" ? option : option._id
      }
      value={field.value || null} // Ensure initial value is null or a valid object
      onChange={(_, value) => {
        // if the list are strings then value is string || if list of object then value is object
        const newValue =
          typeof value === "string" || getObject
            ? value
            : value?.[getOptionLabel]; // else get the value is object and no getObject then get the string value from object.

        field.onChange(
          getOptionColumn && value ? value[getOptionColumn] : newValue
        ); // for use form change
        onChange && onChange(value); // for dev use
      }}
      onInputChange={(_, value) => {
        onInputChange && onInputChange(value); // for dev use
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label + (required ? " *" : "")}
          error={!!error}
          helperText={error ? error.message : ""}
          variant={variant}
          margin="normal"
          size={size}
          sx={sx}
          {...rest}
        />
      )}
    />
  );
};

export default CustomAutoComplete;
