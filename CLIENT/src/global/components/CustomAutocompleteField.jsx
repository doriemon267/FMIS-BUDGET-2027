import React from 'react';
import { Autocomplete, TextField, Chip } from '@mui/material';
import { useController } from 'react-hook-form';

const CustomAutocompleteField = ({
  control,
  fieldName = '',
  label = '',
  options = [],
  multiple = true,
  sx = { bgcolor: '#ffffff', mb: 2 },
  size = 'small',
  variant = 'outlined',
  required = false,
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
          validate: value => 
            (multiple && value.length === 0) 
              ? `${label} field is required` 
              : true
        }
      : undefined,
  });

  return (
    <Autocomplete
      multiple={multiple}
      options={options}
      value={field.value || (multiple ? [] : null)}
      onChange={(_, newValue) => {
        field.onChange(newValue);
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          error={!!error}
          helperText={error ? error.message : ''}
          size={size}
          variant={variant}
          required={required}
          sx={sx}
        />
      )}
      renderTags={(value, getTagProps) =>
        value.map((option, index) => (
          <Chip
            label={option}
            {...getTagProps({ index })}
            color="primary"
            variant="outlined"
            size="small"
          />
        ))
      }
      {...rest}
    />
  );
};

export default CustomAutocompleteField;