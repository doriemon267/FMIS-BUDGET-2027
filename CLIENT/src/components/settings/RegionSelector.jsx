import React, { useState } from "react";
import {
  Box,
  Chip,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Paper,
  Typography,
  Stack,
  Divider,
  useTheme,
  alpha,
  FormControl,
  FormHelperText
} from "@mui/material";
import { MdLocationOn } from "react-icons/md";
import { Controller } from "react-hook-form";

/**
 * Region selector for fiscal year settings
 * Allows selecting "All" (NIA-Wide) or specific regions
 * Uses regions from database via availableRegions prop
 */
const RegionSelector = ({ control, watch, setValue, errors, availableRegions = [] }) => {
  const theme = useTheme();
  const watchedRegions = watch("applicableRegions") || [];

  // Use regions from database (via availableRegions prop passed from parent)
  // If no regions available, show empty state (they should come from AddSettingsDialog_Enhanced)
  const regions = availableRegions.length > 0 ? availableRegions : [];

  const handleSelectAll = () => {
    if (watchedRegions.includes("All")) {
      setValue("applicableRegions", []);
    } else {
      setValue("applicableRegions", ["All"]);
    }
  };

  const handleToggleRegion = (regionId) => {
    if (regionId === "All") {
      handleSelectAll();
      return;
    }

    let updated = [...watchedRegions];

    if (updated.includes("All")) {
      updated = updated.filter(r => r !== "All");
    }

    if (updated.includes(regionId)) {
      updated = updated.filter(r => r !== regionId);
    } else {
      updated.push(regionId);
    }

    setValue("applicableRegions", updated);
  };

  const isAllSelected = watchedRegions.includes("All");
  const selectedCount = isAllSelected ? regions.length : watchedRegions.length;

  return (
    <FormControl error={!!errors.applicableRegions} fullWidth>
      <Box>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <Box sx={{ color: theme.palette.primary.main, fontSize: "1.3rem" }}>
            <MdLocationOn />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Applicable Regions
          </Typography>
        </Stack>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Select which regions this fiscal year settings will apply to. Choose "NIA-Wide" for all regions.
        </Typography>

        <Paper
          sx={{
            p: 2,
            mb: 2,
            backgroundColor: alpha(theme.palette.primary.main, 0.05),
            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
          }}
        >
          <FormControlLabel
            control={
              <Checkbox
                checked={isAllSelected}
                onChange={handleSelectAll}
                sx={{
                  color: theme.palette.primary.main,
                  "&.Mui-checked": {
                    color: theme.palette.primary.main
                  }
                }}
              />
            }
            label={
              <Box>
                <Typography variant="subtitle2" fontWeight="bold">
                  NIA-Wide (All Regions)
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Settings will apply to all regions in NIA
                </Typography>
              </Box>
            }
          />
        </Paper>

        {!isAllSelected && (
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
              Or select specific regions:
            </Typography>

            <FormGroup sx={{ mb: 2 }}>
              {regions.map((region) => {
                if (region.id === "All") return null;

                return (
                  <FormControlLabel
                    key={region.id}
                    control={
                      <Checkbox
                        checked={watchedRegions.includes(region.id)}
                        onChange={() => handleToggleRegion(region.id)}
                        sx={{
                          color: theme.palette.primary.main,
                          "&.Mui-checked": {
                            color: theme.palette.primary.main
                          }
                        }}
                      />
                    }
                    label={
                      <Typography variant="body2">
                        {region.name}
                      </Typography>
                    }
                  />
                );
              })}
            </FormGroup>
          </Box>
        )}

        {/* Display selected regions as chips */}
        {watchedRegions.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary">
              {selectedCount} region{selectedCount !== 1 ? "s" : ""} selected
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap", gap: 1 }}>
              {isAllSelected ? (
                <Chip
                  label="All Regions"
                  onDelete={handleSelectAll}
                  color="primary"
                  variant="filled"
                />
              ) : (
                watchedRegions.map((regionId) => {
                  const region = regions.find(r => r.id === regionId);
                  return (
                    <Chip
                      key={regionId}
                      label={region?.name || regionId}
                      onDelete={() => handleToggleRegion(regionId)}
                      color="primary"
                      variant="outlined"
                    />
                  );
                })
              )}
            </Stack>
          </Box>
        )}

        {watchedRegions.length === 0 && (
          <Typography variant="caption" color="error">
            Please select at least one region or NIA-Wide
          </Typography>
        )}
      </Box>

      {errors.applicableRegions && (
        <FormHelperText>{errors.applicableRegions.message}</FormHelperText>
      )}
    </FormControl>
  );
};

export default RegionSelector;