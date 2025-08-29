import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Grid,
  Box,
  Typography,
  Chip,
  Stack,
  useTheme,
  alpha,
  MenuItem,
  Alert,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Autocomplete
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  MdCategory,
  MdAccountBalance,
  MdCode,
  MdSave,
  MdAdd
} from "react-icons/md";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "react-toastify";
import api from "../../config/api";

// Validation schema - for mapping categories to accounting titles
const titleMappingSchema = yup.object().shape({
  selectedCategory: yup.object().required("Category is required").nullable(),
  selectedAccountingTitle: yup.object().required("Accounting Title is required").nullable()
});

// Predefined options
const accountClasses = ["Asset", "Liability", "Equity", "Revenue", "Expense"];
const lineItems = [
  "Capital Outlays",
  "Property, Plant and Equipment Outlay",
  "Infrastructure Outlay",
  "Building and Other Structures",
  "Machinery and Equipment",
  "Transportation Equipment",
  "Furniture, Fixtures and Books",
  "Land",
  "Land Improvements"
];

const sublineItems = [
  "Infrastructure Outlay",
  "Building and Other Structures", 
  "Buildings and Other Structures",
  "Machinery and Equipment Outlay",
  "Transportation Equipment Outlay",
  "Furniture, Fixtures and Books Outlay",
  "Furniture Fixture and Books",
  "Land",
  "Land Improvements"
];

const EnhancedTitleMappingDialog = ({ open, onClose, editData = null }) => {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const isEditing = Boolean(editData);

  // Fetch categories for selection
  const { data: categoriesData, isLoading: categoriesLoading, error: categoriesError } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const response = await api.get("/categories");
      return response.data;
    },
  });

  // Fetch all chart of accounts to get available accounting titles
  const { data: allChartData, isLoading: chartLoading, error: chartError } = useQuery({
    queryKey: ["available-chart-of-accounts"],
    queryFn: async () => {
      const response = await api.get("/chart-of-accounts");
      return response.data;
    },
  });

  // Debug logging
  useEffect(() => {
  }, [categoriesData, allChartData, categoriesLoading, chartLoading, categoriesError, chartError]);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors }
  } = useForm({
    resolver: yupResolver(titleMappingSchema),
    defaultValues: {
      selectedCategory: editData ? {
        _id: editData.categoryId,
        categoryName: editData.categoryName,
        sublineItems: editData.sublineItems
      } : null,
      selectedAccountingTitle: editData ? {
        accountingTitle: editData.accountingTitle,
        uacsCode: editData.uacsCode,
        accountClass: editData.accountClass,
        lineItem: editData.lineItem
      } : null
    }
  });

  // Watch form values for real-time preview
  const watchedValues = watch();

  // Reset form when editData changes
  useEffect(() => {
    if (editData) {
      reset({
        selectedCategory: {
          _id: editData.categoryId,
          categoryName: editData.categoryName,
          sublineItems: editData.sublineItems
        },
        selectedAccountingTitle: {
          accountingTitle: editData.accountingTitle,
          uacsCode: editData.uacsCode,
          accountClass: editData.accountClass,
          lineItem: editData.lineItem
        }
      });
    } else {
      reset({
        selectedCategory: null,
        selectedAccountingTitle: null
      });
    }
  }, [editData, reset]);

  // Mutation for saving title mapping
  const mutation = useMutation({
    mutationFn: async (data) => {
      // Transform the data to include all fields from selected category and accounting title
      const mappingData = {
        categoryId: data.selectedCategory._id,
        categoryName: data.selectedCategory.categoryName,
        sublineItems: data.selectedCategory.sublineItems,
        accountingTitle: data.selectedAccountingTitle.accountingTitle,
        uacsCode: data.selectedAccountingTitle.uacsCode,
        accountClass: data.selectedAccountingTitle.accountClass,
        lineItem: data.selectedAccountingTitle.lineItem,
        normalBalance: data.selectedAccountingTitle.normalBalance || "Debit"
      };

      const url = isEditing ? `/title-mappings/${editData._id}` : "/title-mappings";
      const method = isEditing ? api.put : api.post;
      const response = await method(url, mappingData);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(["title-mappings"]);
      toast.success(data.message || `Title mapping ${isEditing ? "updated" : "created"} successfully`);
      onClose();
    },
    onError: (error) => {
      const errorMessage = error.response?.data?.error || error.message || "An error occurred";
      toast.error(errorMessage);
    }
  });

  const onSubmit = (data) => {
    mutation.mutate(data);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="lg" 
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
          overflow: 'hidden'
        }
      }}
    >
      <DialogTitle 
        sx={{ 
          background: 'linear-gradient(135deg, #264524 0%, #375e38 100%)',
          color: 'white',
          py: 3,
          position: 'relative'
        }}
      >
        <Box>
          <Typography variant="subtitle1" fontWeight="bold" component="div">
            {isEditing ? "Edit Title Mapping" : "Add New Title Mapping"}
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9, mt: 1 }} component="div">
            Configure subline items, accounting titles, and UACS code mappings
          </Typography>
          {isEditing && (
            <Chip 
              label={`UACS: ${editData.uacsCode}`}
              size="small"
              sx={{ 
                position: 'absolute',
                top: 16,
                right: 16,
                backgroundColor: 'rgba(255,255,255,0.2)',
                color: 'white'
              }}
            />
          )}
        </Box>
      </DialogTitle>

      <DialogContent 
        dividers 
        sx={{ 
          p: 0,
          backgroundColor: '#f8f9fa'
        }}
      >
        <Box sx={{ p: 3 }}>
          {/* Information Alert */}
          <Alert severity="info" sx={{ mb: 3 }}>
            Map capital outlay categories to specific accounting titles from the Chart of Accounts.
            Select a category first, then choose the corresponding accounting title with UACS code.
          </Alert>

          {/* Basic Information Accordion */}
          <Accordion 
            defaultExpanded
            sx={{
              mb: 2,
              borderRadius: 2,
              border: '1px solid #e0e0e0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              '&:before': { display: 'none' },
              '&.Mui-expanded': {
                margin: '0 0 16px 0'
              }
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{
                backgroundColor: '#f8f9fa',
                borderRadius: '8px 8px 0 0',
                minHeight: 56,
                '&.Mui-expanded': {
                  minHeight: 56
                },
                '& .MuiAccordionSummary-content': {
                  alignItems: 'center'
                }
              }}
            >
              <Stack direction="row" alignItems="center" spacing={2}>
                <Box 
                  sx={{ 
                    color: '#264524',
                    fontSize: '1.5rem',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <MdAccountBalance />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 600, color: '#264524' }}>
                  Basic Mapping Information
                </Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 3, backgroundColor: '#ffffff' }}>
              <Grid container spacing={3}>
                {/* Category Selection */}
                <Grid item xs={12} md={6}>
                  <Controller
                    name="selectedCategory"
                    control={control}
                    render={({ field }) => (
                      <Autocomplete
                        {...field}
                        options={categoriesData?.categories || []}
                        getOptionLabel={(option) => option.categoryName || ""}
                        isOptionEqualToValue={(option, value) => option._id === value?._id}
                        loading={categoriesLoading}
                        noOptionsText={
                          categoriesLoading
                            ? "Loading categories..."
                            : categoriesError
                              ? "Error loading categories"
                              : `No categories found (${categoriesData?.categories?.length || 0} available)`
                        }
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Select Capital Outlay Category"
                            fullWidth
                            variant="outlined"
                            error={!!errors.selectedCategory}
                            helperText={
                              errors.selectedCategory?.message ||
                              categoriesError
                                ? "Error loading categories"
                                : `${categoriesData?.categories?.length || 0} categories available`
                            }
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                '&:hover fieldset': {
                                  borderColor: '#264524',
                                },
                                '&.Mui-focused fieldset': {
                                  borderColor: '#264524',
                                },
                              },
                              '& .MuiInputLabel-root.Mui-focused': {
                                color: '#264524',
                              },
                            }}
                          />
                        )}
                        renderOption={(props, option) => (
                          <Box component="li" {...props}>
                            <Box>
                              <Typography variant="body2" fontWeight="medium">
                                {option.categoryName}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Subline Items: {option.sublineItems?.join(', ') || 'None'}
                              </Typography>
                            </Box>
                          </Box>
                        )}
                        onChange={(event, newValue) => {
                          field.onChange(newValue);
                        }}
                        value={field.value}
                      />
                    )}
                  />
                </Grid>

                {/* Accounting Title from Chart of Accounts */}
                <Grid item xs={12} md={6}>
                  <Controller
                    name="selectedAccountingTitle"
                    control={control}
                    render={({ field }) => (
                      <Autocomplete
                        {...field}
                        options={allChartData?.chartOfAccounts || []}
                        getOptionLabel={(option) => option.accountingTitle || ""}
                        isOptionEqualToValue={(option, value) => option.uacsCode === value?.uacsCode}
                        loading={chartLoading}
                        noOptionsText={
                          chartLoading
                            ? "Loading accounting titles..."
                            : chartError
                              ? "Error loading data"
                              : `No accounting titles found (${allChartData?.chartOfAccounts?.length || 0} available)`
                        }
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Select Accounting Title"
                            fullWidth
                            variant="outlined"
                            error={!!errors.selectedAccountingTitle}
                            helperText={
                              errors.selectedAccountingTitle?.message ||
                              chartError
                                ? "Error loading Chart of Accounts"
                                : `${allChartData?.chartOfAccounts?.length || 0} accounting titles available`
                            }
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                '&:hover fieldset': {
                                  borderColor: '#264524',
                                },
                                '&.Mui-focused fieldset': {
                                  borderColor: '#264524',
                                },
                              },
                              '& .MuiInputLabel-root.Mui-focused': {
                                color: '#264524',
                              },
                            }}
                          />
                        )}
                        renderOption={(props, option) => (
                          <Box component="li" {...props}>
                            <Box>
                              <Typography variant="body2" fontWeight="medium">
                                {option.accountingTitle}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                UACS: {option.uacsCode} | {option.accountClass}
                              </Typography>
                            </Box>
                          </Box>
                        )}
                        onChange={(event, newValue) => {
                          field.onChange(newValue);
                        }}
                        value={field.value}
                      />
                    )}
                  />
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          {/* Preview Summary */}
          {(watchedValues.selectedCategory || watchedValues.selectedAccountingTitle) && (
            <>
              <Divider sx={{ my: 3 }} />
              <Box
                sx={{
                  p: 2,
                  backgroundColor: alpha(theme.palette.info.main, 0.1),
                  borderRadius: 2,
                  border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`
                }}
              >
                <Typography variant="h6" color="info.main" gutterBottom>
                  Title Mapping Preview
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" color="text.secondary">
                      Category:
                    </Typography>
                    <Typography variant="body1" fontWeight="medium" sx={{ mt: 0.5 }}>
                      {watchedValues.selectedCategory?.categoryName || "Not selected"}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" color="text.secondary">
                      Subline Items:
                    </Typography>
                    <Box sx={{ mt: 0.5 }}>
                      {watchedValues.selectedCategory?.sublineItems?.map((item, index) => (
                        <Chip
                          key={index}
                          label={item}
                          color="primary"
                          variant="outlined"
                          size="small"
                          icon={<MdCategory />}
                          sx={{ mr: 0.5, mb: 0.5 }}
                        />
                      )) || <Typography variant="body2" color="text.secondary">None selected</Typography>}
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" color="text.secondary">
                      Accounting Title:
                    </Typography>
                    <Typography variant="body1" fontWeight="medium" sx={{ mt: 0.5 }}>
                      {watchedValues.selectedAccountingTitle?.accountingTitle || "Not selected"}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" color="text.secondary">
                      UACS Code:
                    </Typography>
                    <Chip
                      label={watchedValues.selectedAccountingTitle?.uacsCode || "Not selected"}
                      color="success"
                      variant="filled"
                      size="small"
                      icon={<MdCode />}
                      sx={{ mt: 0.5 }}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" color="text.secondary">
                      Account Class:
                    </Typography>
                    <Chip
                      label={watchedValues.selectedAccountingTitle?.accountClass || "Not selected"}
                      color="info"
                      variant="outlined"
                      size="small"
                      sx={{ mt: 0.5 }}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" color="text.secondary">
                      Line Item:
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {watchedValues.selectedAccountingTitle?.lineItem || "Not selected"}
                    </Typography>
                  </Grid>
                </Grid>
              </Box>
            </>
          )}
        </Box>
      </DialogContent>

      <DialogActions 
        sx={{ 
          p: 3, 
          backgroundColor: '#ffffff',
          borderTop: '1px solid #e0e0e0'
        }}
      >
        <Button 
          onClick={handleClose} 
          variant="outlined"
          sx={{ mr: 2 }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit(onSubmit)}
          variant="contained"
          disabled={mutation.isLoading}
          startIcon={mutation.isLoading ? null : isEditing ? <MdSave /> : <MdAdd />}
          sx={{
            background: 'linear-gradient(45deg, #264524 30%, #375e38 90%)',
            boxShadow: '0 3px 5px 2px rgba(38, 69, 36, 0.3)',
            px: 4,
            py: 1.5,
            '&:hover': {
              background: 'linear-gradient(45deg, #1a2f1a 30%, #2a4a2b 90%)',
              transform: 'translateY(-2px)',
              boxShadow: '0 6px 10px 4px rgba(38, 69, 36, 0.3)'
            },
            '&:disabled': {
              background: 'linear-gradient(45deg, #ccc 30%, #999 90%)'
            }
          }}
        >
          {mutation.isLoading ? "Saving..." : isEditing ? "Update Mapping" : "Save Mapping"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EnhancedTitleMappingDialog;
