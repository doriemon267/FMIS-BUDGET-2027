import React, { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Box,
  Typography,
  Divider,
  Alert,
  CircularProgress,
  Tooltip,
} from "@mui/material";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Close as CloseIcon,
} from "@mui/icons-material";
import { NumericFormat } from "react-number-format";
import api from "../../config/api";
import { toast } from "react-toastify";
import { useUser } from "../../context/UserContext";
import { useRegion } from "../../context/RegionContext";

const isValidCapitalOutlayUacs = (code) =>
  typeof code === "string" && /^(5-01|5-02)-/i.test(code.trim());

// Custom number format component for currency inputs
const NumberFormatCustom = React.forwardRef(function NumberFormatCustom(props, ref) {
  const { onChange, name, ...other } = props;

  return (
    <NumericFormat
      {...other}
      getInputRef={ref}
      onValueChange={(values) => {
        onChange({
          target: {
            name: name,
            value: values.value,
          },
        });
      }}
      thousandSeparator
      valueIsNumericString
      prefix="₱"
      decimalScale={2}
      fixedDecimalScale
    />
  );
});

NumberFormatCustom.propTypes = {
  onChange: PropTypes.func.isRequired,
  name: PropTypes.string.isRequired,
};

const CapitalOutlayDetailsModal = ({
  open,
  onClose,
  capitalOutlayId = null,
  accountingTitle = "",
  onSave,
  temporaryItem = null, // New prop for temporary items that aren't saved yet
}) => {
  const [details, setDetails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const { currentUser } = useUser();
  const { activeRegion } = useRegion();

  // Initialize with one empty row
  const initializeEmptyRow = () => ({
    id: Date.now() + Math.random(), // Temporary ID for new rows
    particulars: "",
    income_amount: 0,
    subsidy_amount: 0,
    isNew: true,
  });

  const loadDetails = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get(`/api/capital-outlay/${capitalOutlayId}/details`);
      if (response.data.success) {
        const loadedDetails = response.data.details.map((detail) => ({
          ...detail,
          isNew: false,
        }));
        // If no details exist, start with one empty row
        setDetails(loadedDetails.length > 0 ? loadedDetails : [initializeEmptyRow()]);
      }
    } catch (error) {
      console.error("Error loading details:", error);
      toast.error("Failed to load details");
      setDetails([initializeEmptyRow()]);
    } finally {
      setLoading(false);
    }
  }, [capitalOutlayId]);

  // Load existing details when modal opens
  useEffect(() => {
    if (!open) {
      return;
    }

    if (capitalOutlayId && !temporaryItem) {
      loadDetails();
    } else {
      // New capital outlay or temporary item - start with one empty row
      setDetails([initializeEmptyRow()]);
    }
  }, [open, capitalOutlayId, temporaryItem, loadDetails]);

  const handleAddRow = () => {
    setDetails((prev) => [...prev, initializeEmptyRow()]);
  };

  const handleRemoveRow = (index) => {
    if (details.length === 1) {
      toast.warning("At least one row is required");
      return;
    }
    setDetails((prev) => prev.filter((_, i) => i !== index));
    // Clear any errors for the removed row
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[`particulars_${index}`];
      delete newErrors[`income_amount_${index}`];
      delete newErrors[`subsidy_amount_${index}`];
      return newErrors;
    });
  };

  const handleInputChange = (index, field, value) => {
    setDetails((prev) =>
      prev.map((detail, i) =>
        i === index ? { ...detail, [field]: value } : detail
      )
    );

    // Clear error for this field
    const errorKey = `${field}_${index}`;
    if (errors[errorKey]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[errorKey];
        return newErrors;
      });
    }
  };

  const validateDetails = () => {
    const newErrors = {};
    let isValid = true;
    const MINIMUM_AMOUNT = 50000; // ₱50,000 minimum requirement

    details.forEach((detail, index) => {
      console.log(`--- Validating detail ${index} ---`);
      console.log("Raw detail:", detail);
      
      // Validate particulars
      if (!detail.particulars || detail.particulars.trim() === "") {
        newErrors[`particulars_${index}`] = "Particulars is required";
        isValid = false;
      }

      // Validate amounts (must be non-negative)
      const incomeAmount = parseFloat(detail.income_amount) || 0;
      const subsidyAmount = parseFloat(detail.subsidy_amount) || 0;
      console.log(`Parsed amounts - Income: ${incomeAmount}, Subsidy: ${subsidyAmount}`);

      if (incomeAmount < 0) {
        newErrors[`income_amount_${index}`] = "Income amount cannot be negative";
        isValid = false;
      }

      if (subsidyAmount < 0) {
        newErrors[`subsidy_amount_${index}`] = "Subsidy amount cannot be negative";
        isValid = false;
      }

      // At least one amount should be greater than 0
      if (incomeAmount === 0 && subsidyAmount === 0) {
        newErrors[`income_amount_${index}`] = "At least one amount must be greater than 0";
        newErrors[`subsidy_amount_${index}`] = "At least one amount must be greater than 0";
        isValid = false;
      }

      // Validate minimum amount requirement (₱50,000)
      if (incomeAmount > 0 && incomeAmount < MINIMUM_AMOUNT) {
        newErrors[`income_amount_${index}`] = `Income amount must be at least ₱${MINIMUM_AMOUNT.toLocaleString()}`;
        isValid = false;
      }

      if (subsidyAmount > 0 && subsidyAmount < MINIMUM_AMOUNT) {
        newErrors[`subsidy_amount_${index}`] = `Subsidy amount must be at least ₱${MINIMUM_AMOUNT.toLocaleString()}`;
        isValid = false;
      }
    });

    setErrors(newErrors);
    console.log("=== VALIDATION COMPLETE ===");
    console.log("New errors found:", newErrors);
    console.log("Is valid:", isValid);
    console.log("Error count:", Object.keys(newErrors).length);
    return isValid;
  };

  const handleSave = async () => {
    console.log("=== HANDLE SAVE CLICKED ===");
    console.log("Details:", details);
    console.log("Temporary Item:", temporaryItem);
    console.log("Capital Outlay ID:", capitalOutlayId);
    
    const validationResult = validateDetails();
    console.log("Validation result:", validationResult);
    console.log("OLD validation errors (from state - may be outdated):", errors);
    
    if (!validationResult) {
      console.log("Validation failed, showing error toast");
      toast.error("Please fix the validation errors before saving");
      return;
    }

    // UACS validation removed - not applicable for this database
    // All chart_of_accounts codes start with "1-", not "5-"
    console.log("UACS code check skipped - accepting all codes from chart_of_accounts");
    console.log("All validations passed, starting save process");
    setSaving(true);
    try {
      // Debug logging
      console.log("Current user:", currentUser);
      console.log("Details to save:", details);
      
      if (!currentUser) {
        toast.error("User session expired. Please refresh and try again.");
        setSaving(false);
        return;
      }

      const processBy = `${currentUser.FirstName} ${currentUser.LastName}`;
      console.log("Process by:", processBy);
      
      // If this is a temporary item, we need to create the capital outlay first
      if (temporaryItem && temporaryItem.isTemporary) {
        // Calculate totals from breakdown details
        const totalIncome = details.reduce((sum, detail) => sum + (parseFloat(detail.income_amount) || 0), 0);
        const totalSubsidy = details.reduce((sum, detail) => sum + (parseFloat(detail.subsidy_amount) || 0), 0);
        
        // Try to create the capital outlay item with calculated totals
        let newCapitalOutlayId = null;
        let createdCapitalOutlay = null;
        try {
          const capitalOutlayResponse = await api.post("/capital-outlays", {
            sublineItem: temporaryItem.sublineItem,
            accountingTitle: temporaryItem.accountingTitle,
            uacsCode: temporaryItem.uacsCode || "",
            particulars: temporaryItem.particulars || "",
            income: totalIncome,
            subsidy: totalSubsidy,
            cost: totalIncome + totalSubsidy,
            category: temporaryItem.tempCategoryId,
            processBy: processBy,
            // Ensure organizational context is provided for server-side enforcement
            region: activeRegion?.name || activeRegion?.Region || currentUser?.Region || "",
            department: currentUser?.Department || currentUser?.department || "",
            division: currentUser?.Division || currentUser?.division || "",
            processDate: new Date(),
            fiscalYear: temporaryItem.fiscalYear,
            budgetType: temporaryItem.budgetType,
            status: "Draft",
          });
          createdCapitalOutlay = capitalOutlayResponse?.data?.capitalOutlay || null;
          newCapitalOutlayId = createdCapitalOutlay?._id;
        } catch (createErr) {
          console.warn("Create capital outlay failed, attempting to attach to existing:", createErr?.response?.data || createErr?.message);
          // If duplicate or server-side error, try to find an existing outlay with the same keys
          try {
            const params = new URLSearchParams();
            if (temporaryItem.fiscalYear) params.append('fiscalYear', temporaryItem.fiscalYear);
            if (temporaryItem.budgetType) params.append('budgetType', temporaryItem.budgetType);
            if (activeRegion?.name || activeRegion?.Region || currentUser?.Region) {
              params.append('region', activeRegion?.name || activeRegion?.Region || currentUser?.Region);
            }
            // Narrow list then match client-side on uacsCode + sublineItem
            const listRes = await api.get(`/capital-outlays?${params.toString()}`);
            const candidates = Array.isArray(listRes?.data?.capitalOutlays) ? listRes.data.capitalOutlays : [];
            const matched = candidates.find((c) =>
              String(c?.uacsCode || '').trim().toUpperCase() === String(temporaryItem.uacsCode || '').trim().toUpperCase() &&
              String(c?.sublineItem || '').trim().toUpperCase() === String(temporaryItem.sublineItem || '').trim().toUpperCase()
            );
            if (matched?._id) {
              newCapitalOutlayId = matched._id;
              console.info("Found existing capital outlay to attach details to:", newCapitalOutlayId);
            } else {
              // Re-throw original error if none found
              throw createErr;
            }
          } catch (fallbackErr) {
            // Surface the most informative error
            const msg = fallbackErr?.response?.data?.error || fallbackErr?.response?.data?.message || fallbackErr?.message || 'Unable to create or find capital outlay record';
            throw new Error(msg);
          }
        }
        
        // Now save the breakdown details to the newly created capital outlay
        const detailsPayload = {
          details: details.map((detail) => ({
            particulars: detail.particulars.trim(),
            income_amount: parseFloat(detail.income_amount) || 0,
            subsidy_amount: parseFloat(detail.subsidy_amount) || 0,
          })),
          processBy,
        };
        
        console.log("Sending details payload for new item:", detailsPayload);
        const detailsResponse = await api.post(`/api/capital-outlay/${newCapitalOutlayId}/details`, detailsPayload);

        if (detailsResponse.data.success) {
          toast.success("Capital outlay item and breakdown details saved successfully!");
          if (onSave) {
            const totalsData = detailsResponse.data.totals || {};
            const savedDetails = detailsResponse.data.details || detailsPayload.details || [];
            const computedTotals = {
              income: parseFloat(totalsData.income ?? totalIncome) || 0,
              subsidy: parseFloat(totalsData.subsidy ?? totalSubsidy) || 0,
              cost: parseFloat(totalsData.cost ?? totalsData.total ?? totalIncome + totalSubsidy) || 0,
              total: parseFloat(totalsData.total ?? totalsData.cost ?? totalIncome + totalSubsidy) || 0,
            };
            const particularsFromDetails = savedDetails
              .map((detail) => detail.particulars)
              .filter(Boolean)
              .join('; ');

            if (createdCapitalOutlay) {
              onSave({
                ...computedTotals,
                details: savedDetails,
                particulars: particularsFromDetails,
                newItem: {
                  ...createdCapitalOutlay,
                  income: computedTotals.income,
                  subsidy: computedTotals.subsidy,
                  cost: computedTotals.cost,
                  particulars:
                    createdCapitalOutlay?.particulars && createdCapitalOutlay.particulars.trim() !== ''
                      ? createdCapitalOutlay.particulars
                      : particularsFromDetails,
                },
                isNewItem: true,
              });
            } else {
              onSave({
                ...computedTotals,
                details: savedDetails,
                particulars: particularsFromDetails,
                capitalOutlayId: newCapitalOutlayId,
                isNewItem: false,
              });
            }
          }
          onClose();
        }
      } else {
        // Normal flow for existing capital outlay items
        const detailsPayload = {
          details: details.map((detail) => ({
            particulars: detail.particulars.trim(),
            income_amount: parseFloat(detail.income_amount) || 0,
            subsidy_amount: parseFloat(detail.subsidy_amount) || 0,
          })),
          processBy,
        };
        
        console.log("Sending details payload for existing item:", detailsPayload);
        console.log("Capital outlay ID:", capitalOutlayId);
        const response = await api.post(`/api/capital-outlay/${capitalOutlayId}/details`, detailsPayload);

        if (response.data.success) {
          toast.success("Details saved successfully");
          if (onSave) {
            const totalsData = response.data.totals || {};
            const savedDetails = response.data.details || detailsPayload.details || [];
            const computedTotals = {
              income: parseFloat(totalsData.income ?? totals.income) || 0,
              subsidy: parseFloat(totalsData.subsidy ?? totals.subsidy) || 0,
              cost: parseFloat(totalsData.cost ?? totalsData.total ?? totals.total) || 0,
              total: parseFloat(totalsData.total ?? totalsData.cost ?? totals.total) || 0,
            };
            const particularsFromDetails = savedDetails
              .map((detail) => detail.particulars)
              .filter(Boolean)
              .join('; ');

            onSave({
              ...computedTotals,
              details: savedDetails,
              particulars: particularsFromDetails,
            });
          }
          onClose();
        }
      }
    } catch (error) {
      console.error("Error saving details:", error);
      console.error("Error response:", error.response?.data);
      console.error("Error status:", error.response?.status);
      
      let errorMessage = "Failed to save details";
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = `Network error: ${error.message}`;
      }
      
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const calculateTotals = useCallback(() => {
    const totalIncome = details.reduce(
      (sum, detail) => sum + (parseFloat(detail.income_amount) || 0),
      0
    );
    const totalSubsidy = details.reduce(
      (sum, detail) => sum + (parseFloat(detail.subsidy_amount) || 0),
      0
    );
    return {
      income: totalIncome,
      subsidy: totalSubsidy,
      total: totalIncome + totalSubsidy,
    };
  }, [details]);

  const totals = calculateTotals();

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { minHeight: "70vh" },
      }}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            {temporaryItem && temporaryItem.isTemporary 
              ? `Create New Item: ${temporaryItem.accountingTitle}`
              : `Item Breakdown for: ${accountingTitle || "New Capital Outlay"}`}
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Box mb={2}>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={handleAddRow}
                size="small"
              >
                Add Row
              </Button>
            </Box>

            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>Important:</strong> Each amount must be at least ₱50,000. Values below this amount are not acceptable.
              </Typography>
            </Alert>

            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell width="40%">Particulars</TableCell>
                    <TableCell width="25%" align="right">
                      Income Amount
                    </TableCell>
                    <TableCell width="25%" align="right">
                      Subsidy Amount
                    </TableCell>
                    <TableCell width="10%" align="center">
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {details.map((detail, index) => (
                    <TableRow key={detail.id || index}>
                      <TableCell>
                        <TextField
                          fullWidth
                          multiline
                          rows={2}
                          value={detail.particulars}
                          onChange={(e) =>
                            handleInputChange(index, "particulars", e.target.value)
                          }
                          placeholder="Enter description (e.g., Construction of Operation Room)"
                          error={!!errors[`particulars_${index}`]}
                          helperText={errors[`particulars_${index}`]}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          fullWidth
                          value={detail.income_amount}
                          onChange={(e) =>
                            handleInputChange(index, "income_amount", e.target.value)
                          }
                          InputProps={{
                            inputComponent: NumberFormatCustom,
                          }}
                          inputProps={{
                            name: "income_amount",
                          }}
                          error={!!errors[`income_amount_${index}`]}
                          helperText={errors[`income_amount_${index}`]}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          fullWidth
                          value={detail.subsidy_amount}
                          onChange={(e) =>
                            handleInputChange(index, "subsidy_amount", e.target.value)
                          }
                          InputProps={{
                            inputComponent: NumberFormatCustom,
                          }}
                          inputProps={{
                            name: "subsidy_amount",
                          }}
                          error={!!errors[`subsidy_amount_${index}`]}
                          helperText={errors[`subsidy_amount_${index}`]}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="Remove Row">
                          <span>
                            <IconButton
                              onClick={() => handleRemoveRow(index)}
                              size="small"
                              color="error"
                              disabled={details.length === 1}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Divider sx={{ my: 2 }} />

            {/* Totals Section - Enhanced */}
            <Paper 
              elevation={3} 
              sx={{ 
                p: 3, 
                background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)',
                borderRadius: 2
              }}
            >
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: '#1b5e20', mb: 2 }}>
                💰 Running Totals
              </Typography>
              <Box display="flex" gap={4} flexWrap="wrap">
                <Box sx={{ 
                  flex: 1, 
                  minWidth: '200px',
                  p: 2,
                  backgroundColor: 'white',
                  borderRadius: 2,
                  boxShadow: 1
                }}>
                  <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 'bold' }}>
                    Income Amount
                  </Typography>
                  <Typography variant="h5" color="primary" sx={{ fontWeight: 'bold', mt: 0.5 }}>
                    {formatCurrency(totals.income)}
                  </Typography>
                </Box>
                <Box sx={{ 
                  flex: 1, 
                  minWidth: '200px',
                  p: 2,
                  backgroundColor: 'white',
                  borderRadius: 2,
                  boxShadow: 1
                }}>
                  <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 'bold' }}>
                    Subsidy Amount
                  </Typography>
                  <Typography variant="h5" color="secondary" sx={{ fontWeight: 'bold', mt: 0.5 }}>
                    {formatCurrency(totals.subsidy)}
                  </Typography>
                </Box>
                <Box sx={{ 
                  flex: 1, 
                  minWidth: '200px',
                  p: 2,
                  backgroundColor: '#4caf50',
                  color: 'white',
                  borderRadius: 2,
                  boxShadow: 2
                }}>
                  <Typography variant="caption" sx={{ fontWeight: 'bold', opacity: 0.9 }}>
                    GRAND TOTAL
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', mt: 0.5 }}>
                    {formatCurrency(totals.total)}
                  </Typography>
                </Box>
              </Box>
            </Paper>

            {Object.keys(errors).length > 0 && (
              <Alert severity="error" sx={{ mt: 2 }}>
                Please fix the validation errors above before saving.
              </Alert>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={() => {
            console.log("Save button clicked! Disabled:", saving || loading);
            handleSave();
          }}
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
          disabled={saving || loading}
        >
          {saving ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

CapitalOutlayDetailsModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  capitalOutlayId: PropTypes.string,
  accountingTitle: PropTypes.string,
  onSave: PropTypes.func,
  temporaryItem: PropTypes.shape({
    isTemporary: PropTypes.bool,
    sublineItem: PropTypes.string,
    accountingTitle: PropTypes.string,
    uacsCode: PropTypes.string,
    particulars: PropTypes.string,
    tempCategoryId: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.shape({ _id: PropTypes.string }),
    ]),
    fiscalYear: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    budgetType: PropTypes.string,
  }),
};

export default CapitalOutlayDetailsModal;