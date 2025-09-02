import React, { useState, useEffect, useCallback } from "react";
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

const CapitalOutlayDetailsModal = ({
  open,
  onClose,
  capitalOutlayId,
  accountingTitle,
  onSave,
}) => {
  const [details, setDetails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const { currentUser } = useUser();

  // Initialize with one empty row
  const initializeEmptyRow = () => ({
    id: Date.now() + Math.random(), // Temporary ID for new rows
    particulars: "",
    income_amount: 0,
    subsidy_amount: 0,
    isNew: true,
  });

  // Load existing details when modal opens
  useEffect(() => {
    if (open && capitalOutlayId) {
      loadDetails();
    } else if (open && !capitalOutlayId) {
      // New capital outlay - start with one empty row
      setDetails([initializeEmptyRow()]);
    }
  }, [open, capitalOutlayId]);

  const loadDetails = async () => {
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
  };

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
      // Validate particulars
      if (!detail.particulars || detail.particulars.trim() === "") {
        newErrors[`particulars_${index}`] = "Particulars is required";
        isValid = false;
      }

      // Validate amounts (must be non-negative)
      const incomeAmount = parseFloat(detail.income_amount) || 0;
      const subsidyAmount = parseFloat(detail.subsidy_amount) || 0;

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
    return isValid;
  };

  const handleSave = async () => {
    if (!validateDetails()) {
      toast.error("Please fix the validation errors before saving");
      return;
    }

    setSaving(true);
    try {
      const processBy = `${currentUser.FirstName} ${currentUser.LastName}`;
      
      const response = await api.post(`/api/capital-outlay/${capitalOutlayId}/details`, {
        details: details.map((detail) => ({
          particulars: detail.particulars.trim(),
          income_amount: parseFloat(detail.income_amount) || 0,
          subsidy_amount: parseFloat(detail.subsidy_amount) || 0,
        })),
        processBy,
      });

      if (response.data.success) {
        toast.success("Details saved successfully");
        if (onSave) {
          onSave(response.data.totals);
        }
        onClose();
      }
    } catch (error) {
      console.error("Error saving details:", error);
      toast.error(error.response?.data?.error || "Failed to save details");
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
            Item Breakdown for: {accountingTitle || "New Capital Outlay"}
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
                          <IconButton
                            onClick={() => handleRemoveRow(index)}
                            size="small"
                            color="error"
                            disabled={details.length === 1}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Divider sx={{ my: 2 }} />

            {/* Totals Section */}
            <Box>
              <Typography variant="h6" gutterBottom>
                Running Totals
              </Typography>
              <Box display="flex" gap={4} flexWrap="wrap">
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    Total Income Amount
                  </Typography>
                  <Typography variant="h6" color="primary">
                    {formatCurrency(totals.income)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    Total Subsidy Amount
                  </Typography>
                  <Typography variant="h6" color="secondary">
                    {formatCurrency(totals.subsidy)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    Grand Total
                  </Typography>
                  <Typography variant="h6" color="success.main">
                    {formatCurrency(totals.total)}
                  </Typography>
                </Box>
              </Box>
            </Box>

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
          onClick={handleSave}
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
          disabled={saving || loading || !capitalOutlayId}
        >
          {saving ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CapitalOutlayDetailsModal;