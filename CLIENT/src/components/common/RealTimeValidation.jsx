/**
 * Real-time validation feedback component
 */

import { useState, useEffect } from 'react';
import { TextField, FormHelperText, Box } from '@mui/material';
import { createValidator } from '../../utils/validation';
import TooltipHelp from './TooltipHelp';

const RealTimeValidationField = ({
  label,
  value,
  onChange,
  rules = [],
  helperText,
  tooltip,
  ...textFieldProps
}) => {
  const [error, setError] = useState('');
  const [touched, setTouched] = useState(false);

  const validator = rules.length > 0 ? createValidator(rules) : null;

  useEffect(() => {
    if (validator && touched && value !== undefined && value !== null) {
      const result = validator(label, value);
      setError(result.isValid ? '' : result.errors[0]?.message || '');
    } else if (!touched) {
      setError('');
    }
  }, [value, touched, validator, label]);

  const handleBlur = () => {
    setTouched(true);
  };

  const handleChange = (e) => {
    setTouched(true);
    onChange(e);
  };

  return (
    <Box>
      <TextField
        {...textFieldProps}
        label={label}
        value={value || ''}
        onChange={handleChange}
        onBlur={handleBlur}
        error={!!error}
        helperText={error || helperText}
        InputProps={{
          ...textFieldProps.InputProps,
          endAdornment: tooltip ? (
            <>
              {textFieldProps.InputProps?.endAdornment}
              <TooltipHelp title={tooltip} />
            </>
          ) : textFieldProps.InputProps?.endAdornment,
        }}
      />
    </Box>
  );
};

export default RealTimeValidationField;
