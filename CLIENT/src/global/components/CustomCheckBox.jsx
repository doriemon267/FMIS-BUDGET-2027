import {
  Checkbox,
  FormControlLabel,
  FormHelperText,
  FormGroup,
} from "@mui/material";
import { useController } from "react-hook-form";

const CustomCheckbox = ({
  control,
  fieldName,
  label = "",
  disabled,
  sx = {},
}) => {
  const {
    field,
    fieldState: { error },
  } = useController({
    name: fieldName,
    control,
  });

  return (
    <FormGroup sx={sx}>
      <FormControlLabel
        control={
          <Checkbox
            checked={Boolean(field.value)}
            onChange={(e) => field.onChange(e.target.checked)}
            disabled={disabled}
          />
        }
        label={label}
      />
      {error && <FormHelperText error>{error.message}</FormHelperText>}
    </FormGroup>
  );
};

export default CustomCheckbox;
