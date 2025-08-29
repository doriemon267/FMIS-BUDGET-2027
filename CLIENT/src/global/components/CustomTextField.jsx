import TextField from "@mui/material/TextField";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import { useController } from "react-hook-form";

const CustomTextField = ({
  control,
  fieldName = "",
  label = "",
  type = "text",
  sx = { bgcolor: "#ffffff", mb: 2 },
  size = "small",
  variant = "outlined",
  required = false,
  multiline = false,
  rows = 3,
  ...rest
}) => {
  const {
    field,
    fieldState: { error },
  } = useController({
    name: fieldName,
    control,
    rules: required
      ? {
          required: `${label} field is required`,
          ...(type === "email"
            ? { pattern: { value: /^\S+@\S+\.\S+$/, message: "Invalid email" } }
            : {}),
        }
      : undefined,
  });
  // If the type is boolean, render a Switch instead
  if (type === "boolean") {
    return (
      <FormControlLabel
        control={<Switch {...field} checked={!!field.value} />}
        label={label}
      />
    );
  }
  return (
    <TextField
      {...field}
      rows={rows}
      multiline={multiline}
      type={type}
      label={label}
      value={field.value || ""}
      fullWidth
      size={size}
      variant={variant}
      required={required}
      error={!!error}
      helperText={error ? error.message : ""}
      sx={sx}
      {...rest}
    />
  );
};

export default CustomTextField;
