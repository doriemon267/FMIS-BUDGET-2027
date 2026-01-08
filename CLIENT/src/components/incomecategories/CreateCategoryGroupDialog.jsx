import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  Box,
  Typography,
  Chip,
  CircularProgress,
} from "@mui/material";
import { Controller, useForm } from "react-hook-form";
import * as Yup from "yup";
import { yupResolver } from "@hookform/resolvers/yup";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../config/api";
import { toast } from "react-toastify";

const validationSchema = Yup.object().shape({
  groupName: Yup.string()
    .required("Group name is required")
    .min(2, "Group name must be at least 2 characters"),
  description: Yup.string().max(500, "Description must be less than 500 characters"),
});

const CreateCategoryGroupDialog = ({ open, onClose, onSuccess, editingGroup = null }) => {
  const [selectedFiscalYears, setSelectedFiscalYears] = useState([]);
  const [fiscalYearsError, setFiscalYearsError] = useState("");
  const queryClient = useQueryClient();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(validationSchema),
    defaultValues: {
      groupName: editingGroup?.groupName || "",
      description: editingGroup?.description || "",
    },
  });

  // Fetch fiscal years on dialog open
  useEffect(() => {
    if (open && editingGroup) {
      setSelectedFiscalYears(editingGroup.fiscalYears || []);
    } else if (open) {
      setSelectedFiscalYears([]);
    }
  }, [open, editingGroup]);

  // Fetch fiscal years
  const { data: fiscalYearsData = [] } = useQuery({
    queryKey: ["fiscalYears"],
    queryFn: async () => {
      const response = await api.get("/settings/fiscal-years");
      const result = response.data.data || response.data || [];
      // console.log("Fetched fiscal years:", result);
      return result;
    },
    enabled: open,
  });

  // Create group mutation
  const createGroup = useMutation({
    mutationFn: async (data) => {
      const fiscalYearIds = selectedFiscalYears.map(fy => fy._id);
      // console.log("Creating group with fiscalYears:", fiscalYearIds);
      const response = await api.post("/income-category-groups", {
        ...data,
        fiscalYears: fiscalYearIds,
      });
      // console.log("Create group response:", response.data);
      return response.data;
    },
    onSuccess: (response) => {
      // console.log("Group created successfully:", response);
      queryClient.invalidateQueries({ queryKey: ["groupedCategories"] });
      toast.success("Category group created successfully");
      handleClose();
      onSuccess?.();
    },
    onError: (error) => {
      console.error("Create group error:", error);
      toast.error(error.response?.data?.error || "Failed to create group");
    },
  });

  // Update group mutation
  const updateGroup = useMutation({
    mutationFn: async (data) => {
      const fiscalYearIds = selectedFiscalYears.map(fy => fy._id);
      // console.log("Updating group with fiscalYears:", fiscalYearIds);
      const response = await api.put(
        `/income-category-groups/${editingGroup._id}`,
        {
          ...data,
          fiscalYears: fiscalYearIds,
        }
      );
      // console.log("Update group response:", response.data);
      return response.data;
    },
    onSuccess: (response) => {
      // console.log("Group updated successfully:", response);
      queryClient.invalidateQueries({ queryKey: ["groupedCategories"] });
      toast.success("Category group updated successfully");
      handleClose();
      onSuccess?.();
    },
    onError: (error) => {
      console.error("Update group error:", error);
      toast.error(error.response?.data?.error || "Failed to update group");
    },
  });

  const handleClose = () => {
    reset();
    setSelectedFiscalYears([]);
    setFiscalYearsError("");
    onClose();
  };

  const onSubmit = (data) => {
    // Validate that at least one fiscal year is selected
    if (selectedFiscalYears.length === 0) {
      setFiscalYearsError("At least one fiscal year must be selected");
      return;
    }
    setFiscalYearsError("");

    if (editingGroup) {
      updateGroup.mutate(data);
    } else {
      createGroup.mutate(data);
    }
  };

  const handleToggleFiscalYear = (fy) => {
    setSelectedFiscalYears((prev) => {
      const isSelected = prev.some((item) => item._id === fy._id);
      const updated = isSelected 
        ? prev.filter((item) => item._id !== fy._id)
        : [...prev, fy];
      // console.log("Toggled fiscal year, selected now:", updated);
      return updated;
    });
  };

  const isLoading = createGroup.isPending || updateGroup.isPending;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogTitle>
          {editingGroup ? "Edit Category Group" : "Create Category Group"}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <Controller
              name="groupName"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Group Name"
                  fullWidth
                  error={!!errors.groupName}
                  helperText={errors.groupName?.message}
                  placeholder="e.g., Infrastructure, Equipment"
                />
              )}
            />

            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Description"
                  fullWidth
                  multiline
                  rows={3}
                  error={!!errors.description}
                  helperText={errors.description?.message}
                  placeholder="Optional description for this group"
                />
              )}
            />

            {/* Fiscal Years Selection */}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 500, mb: 1, color: fiscalYearsError ? "#d32f2f" : "inherit" }}>
                Link Fiscal Years ({selectedFiscalYears.length} selected) <span style={{ color: "#d32f2f" }}>*</span>
              </Typography>
              {fiscalYearsError && (
                <Typography variant="caption" sx={{ color: "#d32f2f", display: "block", mb: 1 }}>
                  {fiscalYearsError}
                </Typography>
              )}

              {/* Selected Fiscal Years */}
              {selectedFiscalYears.length > 0 && (
                <Box sx={{ mb: 1, display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                  {selectedFiscalYears.map((fy) => (
                    <Chip
                      key={fy._id}
                      label={fy.fiscalYearCode}
                      onDelete={() => handleToggleFiscalYear(fy)}
                      color="primary"
                      size="small"
                    />
                  ))}
                </Box>
              )}

              {/* Grouped Fiscal Years */}
              {fiscalYearsData.length > 0 ? (
                <Box
                  sx={{
                    border: "1px solid #e0e0e0",
                    borderRadius: 1,
                    p: 1,
                    maxHeight: 200,
                    overflowY: "auto",
                  }}
                >
                  {/* Group by budgetType */}
                  {Object.entries(
                    fiscalYearsData.reduce((acc, fy) => {
                      const type = fy.budgetType || "Other";
                      if (!acc[type]) acc[type] = [];
                      acc[type].push(fy);
                      return acc;
                    }, {})
                  ).map(([budgetType, fys]) => (
                    <Box key={budgetType} sx={{ mb: 1 }}>
                      <Typography
                        variant="caption"
                        sx={{ fontWeight: 600, color: "#666" }}
                      >
                        {budgetType}
                      </Typography>
                      <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", ml: 1 }}>
                        {fys.map((fy, index) => {
                          const isSelected = selectedFiscalYears.some(
                            (item) => item._id === fy._id
                          );
                          return (
                            <Chip
                              key={fy._id || `${budgetType}-${index}`}
                              label={fy.fiscalYearCode}
                              onClick={() => handleToggleFiscalYear(fy)}
                              variant={isSelected ? "filled" : "outlined"}
                              color={isSelected ? "primary" : "default"}
                              size="small"
                              sx={{
                                cursor: "pointer",
                                backgroundColor: isSelected ? "#1976d2" : "transparent",
                                color: isSelected ? "white" : "inherit",
                              }}
                            />
                          );
                        })}
                      </Box>
                    </Box>
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" color="textSecondary">
                  No fiscal years available
                </Typography>
              )}
              
              {/* Explanation */}
              <Box sx={{ mt: 1.5, p: 1, backgroundColor: "#f0f7f0", borderRadius: 1, borderLeft: "3px solid #264524" }}>
                <Typography variant="caption" color="textSecondary">
                  <strong>Note:</strong> Budget type is automatically determined from the fiscal years you select. 
                  Each group must be linked to at least one fiscal year.
                </Typography>
              </Box>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isLoading || selectedFiscalYears.length === 0}
          >
            {isLoading ? (
              <>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                {editingGroup ? "Updating..." : "Creating..."}
              </>
            ) : editingGroup ? (
              "Update"
            ) : (
              "Create"
            )}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default CreateCategoryGroupDialog;