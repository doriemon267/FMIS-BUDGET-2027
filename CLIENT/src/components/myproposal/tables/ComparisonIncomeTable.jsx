import React, { useEffect, useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Box,
  Typography,
  IconButton,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";

const ComparisonIncomeTable = ({ data }) => {
  const [expandedCategories, setExpandedCategories] = useState({});

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount ?? 0);
  };

  const getFieldRawValue = (entry, field) => {
    if (!entry) return undefined;

    switch (field) {
      case "category": {
        const category = entry.category ?? entry.categoryName ?? entry.Category;
        if (typeof category === "object") {
          return (
            category?.categoryName ?? category?.name ?? category?.label ?? ""
          );
        }
        return category ?? "";
      }
      case "subCategory":
      case "subcategory": {
        return (
          entry.subCategory ??
          entry.subcategory ??
          entry["sub-category"] ??
          entry.subCategoryName ??
          ""
        );
      }
      case "amount":
        return Number(entry.amount ?? entry.Amount ?? 0);
      default:
        return entry[field];
    }
  };

  const getDisplayValue = (entry, field) => {
    if (!entry) return "";
    const value = getFieldRawValue(entry, field);
    if (value === undefined || value === null) {
      return "";
    }
    if (field === "amount") {
      return formatCurrency(value);
    }
    return value;
  };

  const getCellStyle = (item, field) => {
    if (item.changeType === "added") {
      return { backgroundColor: "#e8f5e9", fontWeight: "bold" };
    }
    if (item.changeType === "deleted") {
      return {
        backgroundColor: "#ffebee",
        textDecoration: "line-through",
        opacity: 0.7,
      };
    }
    if (item.changeType === "modified") {
      const oldValue = getFieldRawValue(item.originalValues, field);
      const newValue = getFieldRawValue(item, field);

      if (field === "amount") {
        if (newValue > oldValue) {
          return { backgroundColor: "#e8f5e9", fontWeight: "bold" };
        }
        if (newValue < oldValue) {
          return { backgroundColor: "#ffebee", fontWeight: "bold" };
        }
      } else if (
        oldValue !== undefined &&
        newValue !== undefined &&
        oldValue !== newValue
      ) {
        return { backgroundColor: "#fff3e0" };
      }
    }
    return {};
  };

  const renderComparisonCell = (item, field, options = {}) => {
    const { alignRight = false, bold = false, sx: extraSx } = options;
    const cellStyle = {
      ...getCellStyle(item, field),
      ...(alignRight ? { textAlign: "right" } : {}),
      ...(bold ? { fontWeight: "bold" } : {}),
      ...(extraSx || {}),
    };
    const textAlign = alignRight ? "right" : "left";

    const currentValue = getFieldRawValue(item, field);
    const originalValue = getFieldRawValue(item?.originalValues, field);
    const hasDelta =
      item.changeType === "modified" &&
      originalValue !== undefined &&
      originalValue !== currentValue;

    if (hasDelta) {
      const displayCurrent =
        field === "amount"
          ? formatCurrency(currentValue)
          : getDisplayValue(item, field) || "—";
      const displayOld =
        field === "amount"
          ? formatCurrency(originalValue)
          : getDisplayValue(item.originalValues, field) || "—";

      return (
        <TableCell sx={cellStyle}>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: "bold", textAlign }}>
              {displayCurrent}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ textDecoration: "line-through" }}
            >
              {displayOld}
            </Typography>
          </Box>
        </TableCell>
      );
    }

    const displayValue =
      field === "amount"
        ? formatCurrency(currentValue)
        : getDisplayValue(item, field) || "—";

    return (
      <TableCell sx={cellStyle}>
        <Typography
          variant="body2"
          sx={{ fontWeight: bold ? "bold" : undefined, textAlign }}
        >
          {displayValue}
        </Typography>
      </TableCell>
    );
  };

  const groupedData = useMemo(() => {
    const groups = [];
    const lookup = new Map();

    (data || []).forEach((item, index) => {
      const categoryName = getDisplayValue(item, "category") || "No category";
      if (!lookup.has(categoryName)) {
        const group = { category: categoryName, items: [] };
        lookup.set(categoryName, group);
        groups.push(group);
      }
      lookup.get(categoryName).items.push({ ...item, __index: index });
    });

    return groups;
  }, [data]);

  useEffect(() => {
    setExpandedCategories((prev) => {
      const next = { ...prev };
      let changed = false;

      groupedData.forEach(({ category }) => {
        if (!(category in next)) {
          next[category] = true;
          changed = true;
        }
      });

      Object.keys(next).forEach((category) => {
        if (!groupedData.find((group) => group.category === category)) {
          delete next[category];
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [groupedData]);

  const getOriginalAmount = (item) => {
    const original = getFieldRawValue(item.originalValues, "amount");
    if (original !== undefined && original !== null) {
      return Number(original) || 0;
    }
    const comparisonOriginal = getFieldRawValue(
      item.comparisonOriginal,
      "amount"
    );
    if (comparisonOriginal !== undefined && comparisonOriginal !== null) {
      return Number(comparisonOriginal) || 0;
    }
    if ((item.changeType || "").toLowerCase() === "added") {
      return 0;
    }
    return Number(getFieldRawValue(item, "amount")) || 0;
  };

  const categorySummaries = useMemo(() => {
    const summary = {};

    groupedData.forEach(({ category, items }) => {
      let currentTotal = 0;
      let originalTotal = 0;
      const changeTypes = new Set();

      items.forEach((item) => {
        const changeType = item.changeType || "unchanged";
        changeTypes.add(changeType);

        const currentAmount =
          changeType === "deleted"
            ? 0
            : Number(getFieldRawValue(item, "amount")) || 0;
        currentTotal += currentAmount;

        originalTotal += getOriginalAmount(item);
      });

      let categoryChangeType = "unchanged";
      if (changeTypes.size === 1) {
        categoryChangeType = changeTypes.values().next().value || "unchanged";
      } else {
        const meaningfulChanges = [...changeTypes].filter(
          (type) => type && type !== "unchanged"
        );
        categoryChangeType =
          meaningfulChanges.length === 0
            ? "unchanged"
            : meaningfulChanges.length === 1
            ? meaningfulChanges[0]
            : "mixed";
      }

      summary[category] = {
        currentTotal,
        originalTotal,
        changeType: categoryChangeType,
      };
    });

    return summary;
  }, [groupedData]);

  const flattenedData = useMemo(() => {
    const rows = [];
    groupedData.forEach(({ category, items }) => {
      const expanded = expandedCategories[category] !== false;
      rows.push({ type: "category", category, items, expanded });
      if (expanded) {
        items.forEach((item) => {
          rows.push({ type: "item", category, item });
        });
      }
    });
    return rows;
  }, [groupedData, expandedCategories]);

  const toggleCategory = (category) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !(prev[category] !== false),
    }));
  };

  const renderChangeChip = (changeType) => {
    const normalized = changeType || "unchanged";
    if (normalized === "added") {
      return <Chip label="Added" size="small" color="success" />;
    }
    if (normalized === "modified") {
      return <Chip label="Modified" size="small" color="warning" />;
    }
    if (normalized === "deleted") {
      return <Chip label="Deleted" size="small" color="error" />;
    }
    if (normalized === "mixed") {
      return (
        <Chip label="Mixed" size="small" color="info" variant="outlined" />
      );
    }
    return <Chip label="Unchanged" size="small" />;
  };

  // Determine which organizational column to display (Division preferred for Analyst context)
  const orgColumnLabel = useMemo(() => {
    if (Array.isArray(data) && data.some((d) => d && d.division))
      return "Division";
    if (Array.isArray(data) && data.some((d) => d && d.department))
      return "Department";
    return "Organization";
  }, [data]);

  const renderCategoryAmountCell = (category) => {
    const summary = categorySummaries[category] || {
      currentTotal: 0,
      originalTotal: 0,
      changeType: "unchanged",
    };
    const { currentTotal, originalTotal, changeType } = summary;
    const hasDelta = Math.abs(currentTotal - originalTotal) > 0.005;

    let sx = { textAlign: "right", fontWeight: "bold" };
    if (changeType === "added" || (hasDelta && currentTotal > originalTotal)) {
      sx = { ...sx, backgroundColor: "#e8f5e9" };
    } else if (
      changeType === "deleted" ||
      (hasDelta && currentTotal < originalTotal)
    ) {
      sx = { ...sx, backgroundColor: "#ffebee" };
    }

    return (
      <TableCell sx={sx}>
        <Box>
          <Typography
            variant="body2"
            sx={{ fontWeight: "bold", textAlign: "right" }}
          >
            {formatCurrency(currentTotal)}
          </Typography>
          {hasDelta && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ textDecoration: "line-through", display: "block" }}
            >
              {formatCurrency(originalTotal)}
            </Typography>
          )}
        </Box>
      </TableCell>
    );
  };

  return (
    <Box>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>
                <strong>Category</strong>
              </TableCell>
              <TableCell>
                <strong>Sub-Category</strong>
              </TableCell>
              <TableCell align="right">
                <strong>Amount</strong>
              </TableCell>
              <TableCell>
                <strong>{orgColumnLabel}</strong>
              </TableCell>
              <TableCell>
                <strong>Change Status</strong>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {flattenedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Box sx={{ py: 3, color: "text.secondary" }}>
                    No income entries found.
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              flattenedData.map((row, index) => {
                if (row.type === "category") {
                  return (
                    <TableRow
                      key={`category-${row.category}-${index}`}
                      sx={{
                        backgroundColor: "grey.100",
                        "&:hover": { backgroundColor: "grey.200" },
                      }}
                    >
                      <TableCell sx={{ fontWeight: "bold", fontSize: "1rem" }}>
                        <Box
                          sx={{ display: "flex", alignItems: "center", gap: 1 }}
                        >
                          <IconButton
                            size="small"
                            onClick={() => toggleCategory(row.category)}
                            aria-label={
                              row.expanded
                                ? "Collapse category"
                                : "Expand category"
                            }
                          >
                            {row.expanded ? (
                              <KeyboardArrowDownIcon />
                            ) : (
                              <KeyboardArrowRightIcon />
                            )}
                          </IconButton>
                          <Typography
                            variant="subtitle2"
                            sx={{ fontWeight: "bold" }}
                          >
                            {row.category}
                          </Typography>
                        </Box>
                      </TableCell>
                      {renderCategoryAmountCell(row.category)}
                      <TableCell
                        sx={{ color: "text.disabled", fontStyle: "italic" }}
                      >
                        —
                      </TableCell>
                      <TableCell>
                        {renderChangeChip(
                          categorySummaries[row.category]?.changeType
                        )}
                      </TableCell>
                    </TableRow>
                  );
                }

                const item = row.item;
                const key = item._id || item.id || `${row.category}-${index}`;

                return (
                  <TableRow key={key}>
                    <TableCell></TableCell>
                    {renderComparisonCell(item, "subCategory", {
                      sx: { pl: 4 },
                    })}
                    {renderComparisonCell(item, "amount", {
                      alignRight: true,
                      bold: true,
                    })}
                    <TableCell>
                      {item.division || item.department || "—"}
                    </TableCell>
                    <TableCell>
                      {renderChangeChip(item.changeType || "unchanged")}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default ComparisonIncomeTable;
