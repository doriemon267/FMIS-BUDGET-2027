import React from "react";
import {
  Box,
  Typography,
  Button,
  Paper,
  Collapse,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  TextField,
  FormHelperText,
  Stack,
  FormControlLabel,
  Switch,
} from "@mui/material";
import { Clear } from "@mui/icons-material";

const defaultFilterState = {
  categories: [],
  sublineItems: [],
  amountRange: { min: "", max: "" },
  hasValues: false,
  emptyValues: false,
};

const CapitalOutlayFilters = ({
  showFilters,
  selectedFilters,
  onFiltersChange,
  onResetFilters,
  categories = [],
  availableSublineItems = [],
  isAmountRangeInvalid,
}) => {
  const categoryOptions = categories.map((cat) => ({
    id: cat._id,
    name: cat.name,
  }));

  const handleCategoryFilterChange = (event) => {
    const value = event.target.value;
    const normalized = (typeof value === "string" ? value.split(",") : value).map((val) => val.toString());
    onFiltersChange({
      ...selectedFilters,
      categories: normalized,
    });
  };

  const handleSublineFilterChange = (event) => {
    const value = event.target.value;
    const normalized = (typeof value === "string" ? value.split(",") : value).map((val) => val.toString());
    onFiltersChange({
      ...selectedFilters,
      sublineItems: normalized,
    });
  };

  const handleAmountFilterChange = (key) => (event) => {
    const { value } = event.target;
    onFiltersChange({
      ...selectedFilters,
      amountRange: {
        ...selectedFilters.amountRange,
        [key]: value,
      },
    });
  };

  const handleToggleHasValues = (event) => {
    const isChecked = event.target.checked;
    onFiltersChange({
      ...selectedFilters,
      hasValues: isChecked,
      emptyValues: isChecked ? false : selectedFilters.emptyValues,
    });
  };

  const handleToggleEmptyValues = (event) => {
    const isChecked = event.target.checked;
    onFiltersChange({
      ...selectedFilters,
      emptyValues: isChecked,
      hasValues: isChecked ? false : selectedFilters.hasValues,
    });
  };

  return (
    <Collapse in={showFilters} timeout="auto" unmountOnExit>
      <Paper
        variant="outlined"
        sx={{
          p: 3,
          mb: 3,
          backgroundColor: "background.default",
          borderRadius: 2,
          borderColor: "divider",
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              md: "repeat(2, minmax(0, 1fr))",
              lg: "repeat(4, minmax(0, 1fr))",
            },
            gap: 2,
            mb: 3,
          }}
        >
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary", mb: 1, display: "block" }}>
              Categories
            </Typography>
            <Select
              multiple
              fullWidth
              size="small"
              displayEmpty
              value={selectedFilters.categories}
              onChange={handleCategoryFilterChange}
              renderValue={(selected) => {
                if (!selected || selected.length === 0) {
                  return <Typography color="text.secondary">All categories</Typography>;
                }
                const names = categoryOptions
                  .filter((option) => selected.includes(option.id))
                  .map((option) => option.name);
                return names.join(", ");
              }}
            >
              {categoryOptions.map((option) => (
                <MenuItem key={option.id} value={option.id}>
                  <Checkbox checked={selectedFilters.categories.includes(option.id)} size="small" />
                  <ListItemText primary={option.name} />
                </MenuItem>
              ))}
            </Select>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary", mb: 1, display: "block" }}>
              Subline items
            </Typography>
            <Select
              multiple
              fullWidth
              size="small"
              displayEmpty
              value={selectedFilters.sublineItems}
              onChange={handleSublineFilterChange}
              renderValue={(selected) => {
                if (!selected || selected.length === 0) {
                  return <Typography color="text.secondary">All subline items</Typography>;
                }
                return selected.join(", ");
              }}
            >
              {availableSublineItems.map((item) => (
                <MenuItem key={item} value={item}>
                  <Checkbox checked={selectedFilters.sublineItems.includes(item)} size="small" />
                  <ListItemText primary={item} />
                </MenuItem>
              ))}
            </Select>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary", mb: 1, display: "block" }}>
              Minimum amount (₱)
            </Typography>
            <TextField
              type="number"
              size="small"
              fullWidth
              placeholder="0.00"
              value={selectedFilters.amountRange.min}
              onChange={handleAmountFilterChange("min")}
              inputProps={{ min: 0 }}
              error={isAmountRangeInvalid}
            />
          </Box>

          <Box>
            <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary", mb: 1, display: "block" }}>
              Maximum amount (₱)
            </Typography>
            <TextField
              type="number"
              size="small"
              fullWidth
              placeholder="No limit"
              value={selectedFilters.amountRange.max}
              onChange={handleAmountFilterChange("max")}
              inputProps={{ min: 0 }}
              error={isAmountRangeInvalid}
            />
            {isAmountRangeInvalid && (
              <FormHelperText error sx={{ mt: 0.5 }}>
                Maximum must be greater than or equal to minimum.
              </FormHelperText>
            )}
          </Box>
        </Box>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "flex-start", sm: "center" }} justifyContent="space-between">
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <FormControlLabel
              control={
                <Switch
                  checked={selectedFilters.hasValues}
                  onChange={handleToggleHasValues}
                  size="small"
                  color="success"
                />
              }
              label="Only items with amounts"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={selectedFilters.emptyValues}
                  onChange={handleToggleEmptyValues}
                  size="small"
                  color="warning"
                />
              }
              label="Only items without amounts"
            />
          </Stack>

          <Button
            variant="text"
            color="secondary"
            startIcon={<Clear />}
            onClick={onResetFilters}
            sx={{ alignSelf: { xs: "flex-end", sm: "center" } }}
          >
            Clear filters
          </Button>
        </Stack>
      </Paper>
    </Collapse>
  );
};

export default CapitalOutlayFilters;