import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Checkbox,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Paper,
  Stack,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { toast } from "react-hot-toast";
import CustomButton from "../../global/components/CustomButton";
import api from "../../config/api";
import { FaPlus } from "react-icons/fa";

/**
 * Enhanced Income Categories Dialog with Fiscal Year Linking & Group Support
 * Template-based approach that mirrors the RATA fiscal year linking implementation
 */
const EnhancedIncomeCategoriesDialog = ({
  endpoint = "/income-categories",
  dataListName = "incomeCategories",
  onSuccess = null,
  open = false,
  onClose = null,
}) => {
  const [isOpen, setIsOpen] = useState(open);
  const [selectedFiscalYears, setSelectedFiscalYears] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const queryClient = useQueryClient();

  // ✅ Sync open prop with internal state
  useEffect(() => {
    setIsOpen(open);
  }, [open]);

  // ✅ Validation schema for income category
  const validationSchema = yup.object({
    incomeCategoryName: yup.string().required("Category name is required"),
    description: yup.string(),
  });

  const { control, handleSubmit, reset } = useForm({
    resolver: yupResolver(validationSchema),
    defaultValues: {
      incomeCategoryName: "",
      description: "",
    },
  });

  // ✅ Fetch category groups
  const { data: groupsData, isLoading: isGroupsLoading } = useQuery({
    queryKey: ["incomeCategoryGroups"],
    queryFn: async () => {
      const response = await api.get("/income-category-groups");
      return response.data.groups || [];
    },
    enabled: isOpen,
  });

  // ✅ Fetch fiscal years from settings
  const { data: fiscalYearsData, isLoading: isFiscalYearsLoading } = useQuery({
    queryKey: ["fiscalYears"],
    queryFn: async () => {
      const response = await api.get("/settings/fiscal-years");
      return response.data.data || [];
    },
    enabled: isOpen,
  });

  // ✅ Group fiscal years by budget type
  const groupedFiscalYears = React.useMemo(() => {
    if (!fiscalYearsData) return {};
    return fiscalYearsData.reduce((acc, fy) => {
      const budgetType = fy.budgetType || "General";
      if (!acc[budgetType]) acc[budgetType] = [];
      acc[budgetType].push(fy);
      return acc;
    }, {});
  }, [fiscalYearsData]);

  // ✅ Create mutation - with optional fiscal year linking and group assignment
  const createMutation = useMutation({
    mutationFn: async (formData) => {
      // Add groupId and fiscal years to form data
      const payload = {
        ...formData,
        groupId: selectedGroupId || null,
        fiscalYears: selectedFiscalYears,
      };

      // Create the category
      const categoryResponse = await api.post(endpoint, payload);
      return categoryResponse.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries([dataListName]);
      queryClient.invalidateQueries({ queryKey: ["groupedCategories"] });
      queryClient.invalidateQueries({ queryKey: ["categoriesByGroup"] });
      toast.success("Income category created successfully");
      handleClose();
      if (onSuccess) onSuccess(data);
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || "Failed to create income category");
    },
  });

  const handleOpen = () => {
    reset();
    setSelectedFiscalYears([]);
    setSelectedGroupId("");
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    if (onClose) {
      onClose();
    }
    setSelectedFiscalYears([]);
    setSelectedGroupId("");
    reset();
  };

  const handleFiscalYearToggle = (fiscalYearId) => {
    setSelectedFiscalYears((prev) =>
      prev.includes(fiscalYearId)
        ? prev.filter((id) => id !== fiscalYearId)
        : [...prev, fiscalYearId]
    );
  };

  const onSubmit = (data) => {
    createMutation.mutate(data);
  };

  return (
    <>
      {/* ✅ Add Button */}
      <CustomButton
        onClick={handleOpen}
        startIcon={<FaPlus />}
        variant="contained"
      >
        Add Income Category
      </CustomButton>

      {/* ✅ Dialog */}
      <Dialog open={isOpen} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Income Category</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3} sx={{ pt: 2 }}>
            {/* Category Details Section */}
            <Box>
              <Typography variant="subtitle2" fontWeight="600" mb={2}>
                Category Details
              </Typography>
              <Controller
                name="incomeCategoryName"
                control={control}
                render={({ field, fieldState: { error } }) => (
                  <TextField
                    {...field}
                    label="Category Name"
                    fullWidth
                    margin="normal"
                    error={!!error}
                    helperText={error?.message}
                  />
                )}
              />
              <Controller
                name="description"
                control={control}
                render={({ field, fieldState: { error } }) => (
                  <TextField
                    {...field}
                    label="Description"
                    fullWidth
                    multiline
                    rows={2}
                    margin="normal"
                    error={!!error}
                    helperText={error?.message}
                  />
                )}
              />
            </Box>

            <Divider />

            {/* Group Assignment Section */}
            <Box>
              <Typography variant="subtitle2" fontWeight="600" mb={2}>
                Assign to Group (Optional)
              </Typography>
              {isGroupsLoading ? (
                <Box display="flex" justifyContent="center" py={2}>
                  <CircularProgress size={30} />
                </Box>
              ) : groupsData && groupsData.length > 0 ? (
                <FormControl fullWidth>
                  <InputLabel>Select Group</InputLabel>
                  <Select
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                    label="Select Group"
                  >
                    <MenuItem value="">None</MenuItem>
                    {groupsData.map((group) => (
                      <MenuItem key={group._id} value={group._id}>
                        {group.groupName} ({group.budgetType})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : (
                <Alert severity="info">No groups available. Create one first!</Alert>
              )}
            </Box>

            <Divider />

            {/* Fiscal Year Linking Section */}
            <Box>
              <Typography variant="subtitle2" fontWeight="600" mb={2}>
                Link to Fiscal Years (Optional)
              </Typography>

              {isFiscalYearsLoading ? (
                <Box display="flex" justifyContent="center" py={2}>
                  <CircularProgress size={30} />
                </Box>
              ) : fiscalYearsData && fiscalYearsData.length > 0 ? (
                <Box>
                  {Object.entries(groupedFiscalYears).map(([budgetType, fiscalYears]) => (
                    <Paper key={budgetType} variant="outlined" sx={{ p: 2, mb: 2 }}>
                      <Typography variant="caption" fontWeight="600" color="textSecondary">
                        {budgetType}
                      </Typography>
                      <Stack spacing={1} mt={1}>
                        {fiscalYears.map((fy, index) => (
                          <FormControlLabel
                            key={fy._id || fy.id || `${budgetType}-${index}`}
                            control={
                              <Checkbox
                                checked={selectedFiscalYears.includes(fy._id || fy.id)}
                                onChange={() => handleFiscalYearToggle(fy._id || fy.id)}
                              />
                            }
                            label={fy.name || fy.fiscalYear}
                          />
                        ))}
                      </Stack>
                    </Paper>
                  ))}

                  <Alert severity="info" variant="outlined">
                    <Typography variant="caption">
                      {selectedFiscalYears.length} fiscal year(s) selected
                    </Typography>
                  </Alert>
                </Box>
              ) : (
                <Alert severity="warning">
                  No fiscal years available for linking
                </Alert>
              )}
            </Box>
          </Stack>
        </DialogContent>

        <DialogActions>
          <CustomButton plain color="error" onClick={handleClose}>
            Cancel
          </CustomButton>
          <CustomButton
            loading={createMutation.isPending}
            onClick={handleSubmit(onSubmit)}
          >
            Create
          </CustomButton>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default EnhancedIncomeCategoriesDialog;