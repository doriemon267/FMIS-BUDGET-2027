/**
 * Version Comparison Tool
 * Compare different versions of proposals or data
 */

import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Stack,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import { useState } from 'react';

const VersionComparison = ({ versions = [], fields = [] }) => {
  const [version1, setVersion1] = useState(versions[0]?.version || '');
  const [version2, setVersion2] = useState(versions[1]?.version || '');

  const v1 = versions.find((v) => v.version === version1);
  const v2 = versions.find((v) => v.version === version2);

  const getFieldValue = (version, field) => {
    if (field.includes('.')) {
      return field.split('.').reduce((obj, key) => obj?.[key], version);
    }
    return version[field];
  };

  const formatValue = (value) => {
    if (typeof value === 'number') {
      return value.toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    if (value === null || value === undefined) {
      return '—';
    }
    return String(value);
  };

  const getChangeType = (val1, val2) => {
    if (val1 === val2) return 'unchanged';
    if (val1 === null || val1 === undefined) return 'added';
    if (val2 === null || val2 === undefined) return 'removed';
    return 'modified';
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Version Comparison
      </Typography>

      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Version 1</InputLabel>
          <Select value={version1} onChange={(e) => setVersion1(e.target.value)} label="Version 1">
            {versions.map((v) => (
              <MenuItem key={v.version} value={v.version}>
                Version {v.version} - {v.createdAt ? new Date(v.createdAt).toLocaleDateString() : ''}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Version 2</InputLabel>
          <Select value={version2} onChange={(e) => setVersion2(e.target.value)} label="Version 2">
            {versions.map((v) => (
              <MenuItem key={v.version} value={v.version}>
                Version {v.version} - {v.createdAt ? new Date(v.createdAt).toLocaleDateString() : ''}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {v1 && v2 && (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Field</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Version {version1}</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Version {version2}</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Change</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {fields.map((field) => {
                const val1 = getFieldValue(v1, field);
                const val2 = getFieldValue(v2, field);
                const changeType = getChangeType(val1, val2);

                const chipColor = {
                  unchanged: 'default',
                  added: 'success',
                  removed: 'error',
                  modified: 'warning',
                }[changeType];

                return (
                  <TableRow key={field}>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {field}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          color: changeType === 'removed' ? 'error.main' : 'text.primary',
                          textDecoration: changeType === 'removed' ? 'line-through' : 'none',
                        }}
                      >
                        {formatValue(val1)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          color: changeType === 'added' ? 'success.main' : 'text.primary',
                          fontWeight: changeType === 'added' ? 'bold' : 'normal',
                        }}
                      >
                        {formatValue(val2)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={changeType}
                        size="small"
                        color={chipColor}
                        sx={{ textTransform: 'capitalize' }}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  );
};

export default VersionComparison;
