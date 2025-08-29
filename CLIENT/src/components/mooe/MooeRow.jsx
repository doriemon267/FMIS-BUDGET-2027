import React, { memo, useMemo } from "react";
import {
  TableRow,
  TableCell,
  IconButton,
  TextField,
  InputAdornment,
  Typography,
  Button,
} from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import AddIcon from "@mui/icons-material/Add";
import { NumericFormat } from "react-number-format";

// Custom component for numeric input formatting
const NumberFormatCustom = React.forwardRef(function NumberFormatCustom(props, ref) {
  const { onChange, value, ...other } = props;

  return (
    <NumericFormat
      {...other}
      value={value || ""}
      getInputRef={ref}
      thousandSeparator={true}
      decimalScale={2}
      fixedDecimalScale={false}
      allowNegative={false}
      allowLeadingZeros={false}
      onValueChange={(values, sourceInfo) => {

        if (onChange && sourceInfo.source !== 'prop') {
          // Use the raw numeric value (without formatting)
          const numericValue = values.value || "";
          onChange({
            target: {
              value: numericValue,
            },
          });
        } else if (!onChange) {
          console.error("❌ NumberFormatCustom: onChange is not defined!");
        }
      }}
    />
  );
});

const MooeRow = ({
  row,
  expanded,
  onToggleExpand,
  onAmountChange,
  onTitleChange,
  onAddCustomMOOE,
  calculateTotal,
  status,
  onIncomeChange,
  onSubsidyChange,
  disableIncomeInputs = false, // Add this prop with default value
}) => {
  const isEditable = ["Not Submitted", "Returned", "Draft"].includes(status);

  // Memoize calculations to prevent unnecessary recalculations
  const totals = useMemo(() => {
    const totalIncome = row.children.reduce((sum, child) => {
      return sum + parseFloat(child.income || 0);
    }, 0);

    const totalSubsidy = row.children.reduce((sum, child) => {
      return sum + parseFloat(child.subsidy || 0);
    }, 0);

    const totalAmount = totalIncome + totalSubsidy;

    return { totalIncome, totalSubsidy, totalAmount };
  }, [row.children]);

  // Memoize the check for "Other MOOE" UACS code
  const hasOtherMOOE = useMemo(() => {
    return row.children.some(child => child.uacsCode === "5-02-99-990");
  }, [row.children]);

  return (
    <>
      {/* Parent row */}
      <TableRow 
        sx={{ 
          backgroundColor: expanded ? "rgba(55, 94, 56, 0.08)" : "rgba(55, 94, 56, 0.04)",
          '&:hover': { backgroundColor: "rgba(55, 94, 56, 0.12)" }
        }}
      >
        <TableCell>
          <IconButton
            size="small"
            onClick={() => onToggleExpand(row.id)}
            sx={{ color: "#375e38" }}
          >
            {expanded ? <RemoveCircleOutlineIcon /> : <AddCircleOutlineIcon />}
          </IconButton>
        </TableCell>
        <TableCell sx={{ fontWeight: "bold" }}>{row.sublineItem}</TableCell>
        <TableCell colSpan={2}></TableCell>
        <TableCell align="right" sx={{ fontWeight: "bold" }}>
          ₱{totals.totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </TableCell>
        <TableCell align="right" sx={{ fontWeight: "bold" }}>
          ₱{totals.totalSubsidy.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </TableCell>
        <TableCell align="right" sx={{ fontWeight: "bold" }}>
          ₱{totals.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </TableCell>
      </TableRow>

      {/* Child rows */}
      {expanded && row.children.map((child) => (
        <TableRow key={child.id}>
          <TableCell></TableCell>
          <TableCell></TableCell>
          <TableCell>
            {child.custom ? (
              <TextField
                fullWidth
                size="small"
                value={child.accountingTitle || ""}
                onChange={(e) => onTitleChange(row.id, child.id, e.target.value)}
                disabled={!isEditable}
                placeholder="Enter MOOE title"
                sx={{ my: 0.5 }}
              />
            ) : (
              child.accountingTitle
            )}
          </TableCell>
          <TableCell>{child.uacsCode}</TableCell>
          
          {/* Income field with NumberFormatCustom */}
          <TableCell>
            <TextField
              fullWidth
              size="small"
              value={child.income === "0" || child.income === 0 ? "" : (child.income || "")}
              onChange={(e) => {

                try {
                  onIncomeChange(child.id, e.target.value);
                } catch (error) {
                  console.error("❌ Error calling onIncomeChange:", error);
                }
              }}
              disabled={!isEditable || disableIncomeInputs} // Add disableIncomeInputs here
              placeholder="0.00"
              InputProps={{
                startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                inputComponent: NumberFormatCustom,
                inputProps: {
                  style: { textAlign: 'right' },
                  // Prevent auto-conversion to zero on blur
                  onBlur: (e) => {
                    // Only trigger validation, don't auto-convert empty to zero
                    if (e.target.value === "") {
                      // Keep empty value as is
                      return;
                    }
                  }
                }
              }}
              sx={{
                backgroundColor: !isEditable || disableIncomeInputs ? "#f5f5f5" : "white",
                '& .MuiInputBase-input': {
                  textAlign: 'right'
                }
              }}
            />
          </TableCell>
          
          {/* Subsidy field with NumberFormatCustom */}
          <TableCell>
            <TextField
              fullWidth
              size="small"
              value={child.subsidy === "0" || child.subsidy === 0 ? "" : (child.subsidy || "")}
              onChange={(e) => {

                try {

                  if (onSubsidyChange) {
                    onSubsidyChange(child.id, e.target.value);
                  } else {
                    console.error("❌ onSubsidyChange is null or undefined!");
                  }
                } catch (error) {
                  console.error("❌ Error calling onSubsidyChange:", error);
                  console.error("❌ Error stack:", error.stack);
                }
              }}
              disabled={!isEditable}
              placeholder="0.00"
              InputProps={{
                startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                inputComponent: NumberFormatCustom,
                inputProps: {
                  style: { textAlign: 'right' },
                  // Prevent auto-conversion to zero on blur
                  onBlur: (e) => {
                    // Only trigger validation, don't auto-convert empty to zero
                    if (e.target.value === "") {
                      // Keep empty value as is
                      return;
                    }
                  }
                }
              }}
              sx={{
                backgroundColor: !isEditable ? "#f5f5f5" : "white",
                '& .MuiInputBase-input': {
                  textAlign: 'right'
                }
              }}
            />
          </TableCell>
          
          {/* Amount field (calculated) */}
          <TableCell>
            <Typography variant="body2" align="right">
              ₱{(parseFloat(child.income || 0) + parseFloat(child.subsidy || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </Typography>
            {/* Debug info - remove in production */}
            <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'gray' }}>
              I:{child.income} S:{child.subsidy}
            </Typography>
          </TableCell>
        </TableRow>
      ))}

      {/* Add Custom MOOE button row - only show if expanded and has Other MOOE */}
      {expanded && hasOtherMOOE && isEditable && (
        <TableRow>
          <TableCell></TableCell>
          <TableCell></TableCell>
          <TableCell colSpan={5}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => onAddCustomMOOE(row.id)}
              sx={{
                my: 1,
                color: "#375e38",
                borderColor: "#375e38",
                '&:hover': {
                  backgroundColor: "rgba(55, 94, 56, 0.08)",
                  borderColor: "#375e38",
                }
              }}
            >
              Add Other MOOE
            </Button>
          </TableCell>
        </TableRow>
      )}
    </>
  );
};

export default MooeRow;
