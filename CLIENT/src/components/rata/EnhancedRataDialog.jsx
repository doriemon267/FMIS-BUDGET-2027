import React, { useState, useEffect, forwardRef } from "react";
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
  InputAdornment,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Card,
  CardContent,
  CircularProgress
} from "@mui/material";
import {
  MdGrade,
  MdSave,
  MdAdd,
  MdCalendarToday
} from "react-icons/md";
import PesoIcon from "../icons/PesoIcon";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { NumericFormat } from "react-number-format";
import api from "../../config/api";

// Validation schema
const rataSchema = yup.object().shape({
  SG: yup.string().required("Salary Grade is required"),
  RA: yup.number()
    .required("RA amount is required")
    .min(0, "RA amount must be positive")
    .max(50000, "RA amount seems too high, please verify"),
  TA: yup.number()
    .required("TA amount is required")
    .min(0, "TA amount must be positive")
    .max(50000, "TA amount seems too high, please verify"),
});

// Predefined salary grades for dropdown
const salaryGrades = Array.from({ length: 33 }, (_, i) => (i + 1).toString());

// Custom Number Format Component for Peso Currency
const PesoFormatCustom = forwardRef(function PesoFormatCustom(props, ref) {
  const { onChange, ...other } = props;

  return (
    <NumericFormat
      {...other}
      getInputRef={ref}
      onValueChange={(values) => {
        onChange({
          target: {
            name: props.name,
            value: values.value,
          },
        });
      }}
      thousandSeparator={true}
      valueIsNumericString={true}
      prefix="₱"
      decimalScale={2}
      fixedDecimalScale={false}
      allowNegative={false}
    />
  );
});

const EnhancedRataDialog = ({ open, onClose, editData = null }) => {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const isEditing = Boolean(editData);
  const [selectedFiscalYears, setSelectedFiscalYears] = useState([]);

  // Fetch available fiscal years from settings
  const { data: fiscalYearsData = [], isLoading: fiscalYearsLoading } = useQuery({
    queryKey: ["fiscalYearsForRataAdd"],
    queryFn: async () => {
      try {
        const response = await api.get("/settings", {
          params: {
            page: 1,
            limit: 100
          }
        });
        return response.data?.settings || [];
      } catch (error) {
        console.error("Failed to fetch fiscal years:", error);
        return [];
      }
    },
    enabled: open && !isEditing
  });

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors }
  } = useForm({
    resolver: yupResolver(rataSchema),
    defaultValues: {
      SG: editData?.SG || "",
      RA: editData?.RA || 0,
      TA: editData?.TA || 0
    }
  });

  // Watch form values for real-time calculations
  const watchedValues = watch();

  // Reset form when editData changes or dialog opens
  useEffect(() => {
    if (editData) {
      reset({
        SG: editData.SG,
        RA: editData.RA || 0,
        TA: editData.TA || 0
      });
      setSelectedFiscalYears([]); // Don't allow linking on edit
    } else {
      reset({
        SG: "",
        RA: 0,
        TA: 0
      });
      setSelectedFiscalYears([]);
    }
  }, [editData, reset, open]);

  // Mutation for saving RATA and linking fiscal years
  const mutation = useMutation({
    mutationFn: async (data) => {
      // Always send RATA as RA + TA for backend compatibility
      const payload = {
        ...data,
        RATA: (parseFloat(data.RA) || 0) + (parseFloat(data.TA) || 0)
      };
      // console.log("Payload sent to backend:", data);
      const url = isEditing ? `/ratas/${editData._id}` : "/ratas";
      const method = isEditing ? api.put : api.post;
      const response = await method(url, payload);
      
      // If creating new RATA and fiscal years are selected, link them
      if (!isEditing && selectedFiscalYears.length > 0 && response.data?.data?._id) {
        const rataId = response.data.data._id;
        await api.put(`/ratas/${rataId}/link-fiscal-years`, {
          fiscalYearIds: selectedFiscalYears
        });
      }
      
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(["ratas"]);
      // Invalidate proposal queries so NewProposalWorkflowPage updates totals
      queryClient.invalidateQueries({ queryKey: ["allProposals"] });
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      const message = isEditing 
        ? "RATA updated successfully" 
        : selectedFiscalYears.length > 0
          ? `RATA created and linked to ${selectedFiscalYears.length} fiscal year(s)`
          : "RATA created successfully";
      toast.success(data.message || message);
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
    setSelectedFiscalYears([]);
    onClose();
  };

  const handleFiscalYearToggle = (fiscalYearId) => {
    setSelectedFiscalYears(prev =>
      prev.includes(fiscalYearId)
        ? prev.filter(id => id !== fiscalYearId)
        : [...prev, fiscalYearId]
    );
  };

  // Group fiscal years by budget type
  const groupedByBudgetType = fiscalYearsData.reduce((acc, fy) => {
    const budgetType = fy.budgetType || "Other";
    if (!acc[budgetType]) acc[budgetType] = [];
    acc[budgetType].push(fy);
    return acc;
  }, {});

  // Calculate annual RATA
  const monthlyRata = (parseFloat(watchedValues.RA) || 0) + (parseFloat(watchedValues.TA) || 0);
  const annualRata = monthlyRata * 12;

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="md" 
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
            {isEditing ? "Edit RATA Rate" : "Add New RATA Rate"}
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9, mt: 1 }} component="div">
            Configure Representation and Transportation Allowance by salary grade
          </Typography>
          {isEditing && (
            <Chip
              label={`SG-${editData.SG}`}
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
            <b>RATA</b> (Representation and Transportation Allowance) is a monthly allowance based on salary grade.<br/>
            <span style={{ color: '#264524' }}>Split into RA and TA for more accurate management.</span>
          </Alert>

          <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, color: '#375e38' }}>
            Allowance Details
          </Typography>
          <Grid container spacing={2}>
            {/* Salary Grade Selection */}
            <Grid item xs={12} md={12}>
              <Controller
                name="SG"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    select
                    label="Salary Grade *"
                    fullWidth
                    variant="outlined"
                    error={!!errors.SG}
                    helperText={errors.SG?.message || 'Select the salary grade for this entry.'}
                    InputProps={{
                      startAdornment: (
                        <Box sx={{ mr: 1, color: '#264524' }}>
                          <MdGrade />
                        </Box>
                      )
                    }}
                    sx={{
                      mb: 2,
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
                  >
                    {salaryGrades.map((grade) => (
                      <MenuItem key={grade} value={grade}>
                        SG-{grade}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Controller
                name="RA"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="RA (Representation Allowance) *"
                    fullWidth
                    variant="outlined"
                    error={!!errors.RA}
                    helperText={errors.RA?.message || 'Enter the monthly RA amount.'}
                    InputProps={{
                      inputComponent: PesoFormatCustom,
                      startAdornment: (
                        <InputAdornment position="start">
                          <Box sx={{ color: '#264524', display: 'flex', alignItems: 'center' }}>
                            <PesoIcon />
                          </Box>
                        </InputAdornment>
                      ),
                      style: { textAlign: 'right' }
                    }}
                    sx={{
                      mb: 2,
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
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Controller
                name="TA"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="TA (Transportation Allowance) *"
                    fullWidth
                    variant="outlined"
                    error={!!errors.TA}
                    helperText={errors.TA?.message || 'Enter the monthly TA amount.'}
                    InputProps={{
                      inputComponent: PesoFormatCustom,
                      startAdornment: (
                        <InputAdornment position="start">
                          <Box sx={{ color: '#264524', display: 'flex', alignItems: 'center' }}>
                            <PesoIcon />
                          </Box>
                        </InputAdornment>
                      ),
                      style: { textAlign: 'right' }
                    }}
                    sx={{
                      mb: 2,
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
              />
            </Grid>
            <Grid item xs={12} md={12}>
              <TextField
                label="RATA (RA + TA)"
                value={monthlyRata.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                fullWidth
                variant="filled"
                InputProps={{
                  readOnly: true,
                  startAdornment: (
                    <InputAdornment position="start">
                      <Box sx={{ color: '#264524', display: 'flex', alignItems: 'center' }}>
                        <PesoIcon />
                      </Box>
                    </InputAdornment>
                  ),
                  style: { textAlign: 'right', fontWeight: 'bold', background: '#f5f5f5' }
                }}
                sx={{
                  mb: 2,
                  '& .MuiInputBase-root': {
                    background: '#f5f5f5',
                  },
                  '& .MuiInputLabel-root.Mui-focused': {
                    color: '#264524',
                  },
                }}
                helperText="This is the sum of RA and TA. Read-only."
              />
            </Grid>
          </Grid>

          {/* Calculation Summary */}
          {monthlyRata > 0 && (
            <>
              <Divider sx={{ my: 3 }} />
              <Box 
                sx={{ 
                  p: 2, 
                  backgroundColor: alpha(theme.palette.success.main, 0.1),
                  borderRadius: 2,
                  border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`
                }}
              >
                <Typography variant="h6" color="success.main" gutterBottom>
                  Calculation Summary
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={4}>
                    <Typography variant="body2" color="info.main">
                      RA (Monthly):
                    </Typography>
                    <Typography variant="h6" color="info.main">
                      ₱{(parseFloat(watchedValues.RA) || 0).toLocaleString('en-PH', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="body2" color="warning.main">
                      TA (Monthly):
                    </Typography>
                    <Typography variant="h6" color="warning.main">
                      ₱{(parseFloat(watchedValues.TA) || 0).toLocaleString('en-PH', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="body2" color="success.main">
                      RATA (RA+TA) Monthly:
                    </Typography>
                    <Typography variant="h6" color="success.main">
                      ₱{monthlyRata.toLocaleString('en-PH', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="success.main">
                      Annual RATA (RA+TA):
                    </Typography>
                    <Typography variant="h6" color="success.main">
                      ₱{annualRata.toLocaleString('en-PH', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </Typography>
                  </Grid>
                </Grid>
              </Box>
            </>
          )}

          {/* Fiscal Year Linking Section (Only for New RATA) */}
          {!isEditing && (
            <>
              <Divider sx={{ my: 3 }} />
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, color: '#375e38' }}>
                📅 Link to Fiscal Years (Optional)
              </Typography>
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  You can optionally link this RATA to specific fiscal year/budget type combinations now, or link them later using the "Link to Fiscal Years" action.
                </Typography>
              </Alert>

              {fiscalYearsLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                  <CircularProgress size={30} />
                </Box>
              ) : fiscalYearsData.length === 0 ? (
                <Alert severity="warning">
                  No fiscal years available. Create fiscal year settings first to enable linking.
                </Alert>
              ) : (
                <Stack spacing={2}>
                  {Object.entries(groupedByBudgetType).map(([budgetType, fiscalYears]) => (
                    <Card key={budgetType} sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.02) }}>
                      <CardContent>
                        <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 2, color: theme.palette.primary.main }}>
                          {budgetType}
                        </Typography>
                        <FormGroup>
                          {fiscalYears.map(fy => (
                            <FormControlLabel
                              key={fy._id}
                              control={
                                <Checkbox
                                  checked={selectedFiscalYears.includes(fy._id)}
                                  onChange={() => handleFiscalYearToggle(fy._id)}
                                  disabled={mutation.isPending}
                                />
                              }
                              label={
                                <Typography variant="body2">
                                  {fy.fiscalYear} • {new Date(fy.createdAt).toLocaleDateString()}
                                </Typography>
                              }
                            />
                          ))}
                        </FormGroup>
                      </CardContent>
                    </Card>
                  ))}

                  {selectedFiscalYears.length > 0 && (
                    <Alert severity="success">
                      <Typography variant="body2">
                        ✅ <strong>{selectedFiscalYears.length}</strong> fiscal year/budget type combination(s) will be linked
                      </Typography>
                    </Alert>
                  )}
                </Stack>
              )}
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
          disabled={mutation.isPending}
          startIcon={mutation.isPending ? null : isEditing ? <MdSave /> : <MdAdd />}
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
          {mutation.isPending ? "Saving..." : isEditing ? "Update RATA" : "Save RATA"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EnhancedRataDialog;
