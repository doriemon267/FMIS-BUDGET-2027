import React from 'react';
import { TextField, Autocomplete } from '@mui/material';

const AutocompleteField = ({ label, options, value, onChange, error, helperText }) => {
  return (
    <Autocomplete
      options={options}
      value={options.find(option => option.name === value) || null}
      onChange={(event, newValue) => onChange(newValue?.name || '')}
      getOptionLabel={(option) => option.name || ''}
      renderOption={(props, option) => (
        <li {...props} key={option._id}>
          {option.name}
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          variant="outlined"
          error={!!error}
          helperText={helperText}
        />
      )}
    />
  );
};

export default AutocompleteField;