import React, { useState, useCallback } from "react";
import {
  Box,
  Typography,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TextField,
  useTheme,
} from "@mui/material";
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from "@mui/icons-material";
import { useUser } from "../../../../context/UserContext";
import ProposalAttachments from "../../../../components/workflow/ProposalAttachments";
import { preventNegativeNumericKey, toNonNegativeNumber } from "../../../../utils/preventNegativeInput";

const normalizeName = (value) => {
  if (!value) return "";
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s\-()/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const toNumber = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const BRAND_COLORS = {
  darkGreen: "#375e38",
  deepGreen: "#2d5016",
};

const TABLE_HEADER_ROW = {
  bgcolor: BRAND_COLORS.deepGreen,
  "& .MuiTableCell-root": {
    color: "white",
    fontWeight: 600,
    fontSize: "0.8125rem",
    py: 1.25,
    borderBottom: "none",
  },
};

const TABLE_CONTAINER = {
  borderRadius: 2,
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  overflow: "hidden",
  border: "1px solid",
  borderColor: "divider",
};

const IncomeTable = ({
  proposalDetails,
  editableItems,
  changedItems,
  handleEditItemAmount,
  canUserEdit,
  discountSettings,
  selectedProposal,
  handleViewDetails,
}) => {
  const theme = useTheme();
  const { currentUser } = useUser();
  const headerBg = theme.palette.mode === "dark" ? "#0b2413" : "#2d5016";
  const titleColor = theme.palette.mode === "dark" ? "#a5d6a7" : "#2d5016";

  const [expandedGroups, setExpandedGroups] = useState({});

  if (!proposalDetails?.income || proposalDetails.income.length === 0) {
    return (
      <>
        <Box sx={{ mb: 2 }}>
          <ProposalAttachments
            proposal={selectedProposal}
            moduleName="income"
            userInfo={currentUser}
            onChange={handleViewDetails}
          />
        </Box>
        <TableContainer sx={TABLE_CONTAINER}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ ...TABLE_HEADER_ROW, bgcolor: headerBg }}>
                <TableCell sx={{ fontWeight: "bold" }}>Item</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Category</TableCell>
                <TableCell align="right" sx={{ fontWeight: "bold" }}>Amount</TableCell>
                <TableCell align="right" sx={{ fontWeight: "bold" }}>Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell
                  colSpan={4}
                  align="center"
                  sx={{ py: 5, borderBottom: "none", bgcolor: "grey.50" }}
                >
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.9rem" }}>
                    No income data available
                  </Typography>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </>
    );
  }

  const items = proposalDetails.income || [];
  const discountType = discountSettings?.discountType || "percentage";
  const discountValue = toNumber(discountSettings?.discountValue || 0);
  const applyDiscount = Boolean(discountSettings?.applyDiscount);

  let irrigationGross = 0;
  let irrigationNet = 0;
  let currentAccountTotal = 0;

  items.forEach((item) => {
    const categoryRaw =
      item.category ||
      item.categoryName ||
      item.type ||
      item.incomecategory?.name ||
      item.incomecategory?.incomeCategoryName ||
      "Uncategorized";
    const category = normalizeName(categoryRaw);
    const amount = toNumber(item.amount || 0);
    const subcategory = normalizeName(item.subcategory || item.subCategory || "");

    if (category.includes("net irrigation service fees")) {
      irrigationNet += amount;
      return;
    }
    if (category.includes("irrigation service fees")) {
      irrigationGross += amount;
      if (subcategory.includes("current account")) {
        currentAccountTotal += amount;
      }
    }
  });

  let discountAmount = 0;
  const discountBase = currentAccountTotal > 0 ? currentAccountTotal : irrigationGross;
  if (applyDiscount && discountValue > 0 && discountBase > 0) {
    discountAmount =
      discountType === "percentage"
        ? discountBase * (discountValue / 100)
        : Math.min(discountValue, discountBase);
  }

  const hasGrossIrrigation = irrigationGross > 0;
  const useNet = irrigationNet > 0 || (applyDiscount && discountAmount > 0);
  const irrigationLabel = useNet ? "Net Irrigation Service Fees" : "Irrigation Service Fees";
  const irrigationTotal = useNet
    ? irrigationNet || Math.max(0, irrigationGross - discountAmount)
    : irrigationGross;

  const shouldHideNetRow = useNet && hasGrossIrrigation;

  const groupedIncome = items.reduce((acc, item) => {
    const rawCategory =
      item.category ||
      item.categoryName ||
      item.type ||
      item.incomecategory?.name ||
      item.incomecategory?.incomeCategoryName ||
      "Uncategorized";
    const normalized = normalizeName(rawCategory);
    const isNetRow =
      normalized.includes("net irrigation service fees") || Boolean(item.isComputed);
    if (shouldHideNetRow && isNetRow) {
      return acc;
    }
    const category =
      normalized.includes("irrigation service fees") && useNet
        ? irrigationLabel
        : rawCategory;
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {});

  const groupedEntries = Object.entries(groupedIncome);
  const grandTotal = groupedEntries.reduce((sum, [category, groupItems]) => {
    const categoryTotal =
      normalizeName(category).includes("irrigation service fees") && useNet
        ? irrigationTotal
        : groupItems.reduce((groupSum, item) => groupSum + toNumber(item.amount || 0), 0);
    return sum + categoryTotal;
  }, 0);

  return (
    <>
      {groupedEntries.map(([category, groupItems]) => {
        const categoryTotal =
          normalizeName(category).includes("irrigation service fees") && useNet
            ? irrigationTotal
            : groupItems.reduce((sum, item) => sum + toNumber(item.amount || 0), 0);
        const isExpanded = expandedGroups[`income-${category}`];

        return (
          <Box key={category} sx={{ mb: 2 }}>
            <Box
              onClick={() =>
                setExpandedGroups((prev) => ({
                  ...prev,
                  [`income-${category}`]: !prev[`income-${category}`],
                }))
              }
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                p: 2,
                bgcolor: headerBg,
                color: "white",
                borderRadius: "8px",
                cursor: "pointer",
                "&:hover": {
                  bgcolor: theme.palette.mode === "dark" ? "#14331d" : "#3d6026",
                },
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {category} ({groupItems.length} {groupItems.length === 1 ? "item" : "items"}
                  )
                </Typography>
              </Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                ₱
                {categoryTotal.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Typography>
            </Box>

            {isExpanded && (
              <TableContainer sx={{ mt: 1 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ ...TABLE_HEADER_ROW, bgcolor: headerBg }}>
                      <TableCell sx={{ fontWeight: "bold" }}>Item</TableCell>
                      <TableCell sx={{ fontWeight: "bold" }}>Category</TableCell>
                      <TableCell align="right" sx={{ fontWeight: "bold" }}>Amount</TableCell>
                      <TableCell align="right" sx={{ fontWeight: "bold" }}>Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {groupItems.map((item, idx) => {
                      const globalIndex = proposalDetails.income.indexOf(item);
                      const itemKey = `income-${globalIndex}`;
                      const isChanged = changedItems.has(itemKey);
                      const editedItem = editableItems.income[globalIndex];
                      const itemAmount = editedItem?.amount || 0;
                      return (
                        <TableRow
                          key={idx}
                          hover
                          sx={{
                            bgcolor: isChanged ? "#fff3cd" : "transparent",
                            transition: "background-color 0.3s ease",
                          }}
                        >
                          <TableCell>
                            {item.particulars || item.itemName || item.title || "N/A"}
                          </TableCell>
                          <TableCell>
                            {item.categoryName ||
                              item.category ||
                              item.type ||
                              item.subcategory ||
                              "N/A"}
                          </TableCell>
                          <TableCell align="right">
                            {canUserEdit() ? (
                              <TextField
                                type="text"
                                size="small"
                                value={itemAmount.toLocaleString("en-US", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                                onKeyDown={preventNegativeNumericKey}
                                onChange={(e) => {
                                  const numValue = toNonNegativeNumber(e.target.value);
                                  handleEditItemAmount("income", globalIndex, numValue);
                                }}
                                inputProps={{
                                  style: {
                                    textAlign: "right",
                                  },
                                }}
                                sx={{
                                  width: 120,
                                  "& .MuiOutlinedInput-root": {
                                    bgcolor: isChanged ? "#fff9e6" : "white",
                                    borderColor: isChanged ? "#ffc107" : undefined,
                                  },
                                }}
                              />
                            ) : (
                              `₱${itemAmount.toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}`
                            )}
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{
                              fontWeight: "bold",
                              bgcolor: "#f0f0f0",
                            }}
                          >
                            ₱
                            {itemAmount.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {normalizeName(category).includes("irrigation service fees") &&
                      useNet &&
                      discountAmount > 0 && (
                        <TableRow sx={{ bgcolor: "#fff3f3" }}>
                          <TableCell sx={{ color: "#d32f2f", fontWeight: "bold", pl: 2 }}>
                            Less:{" "}
                            {discountType === "percentage"
                              ? `${discountValue}%`
                              : "₱" +
                                discountValue.toLocaleString("en-US", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}{" "}
                            Discount on Current Account
                          </TableCell>
                          <TableCell sx={{ color: "#d32f2f", fontWeight: 500 }}>
                            ISF Discount
                          </TableCell>
                          <TableCell align="right" sx={{ color: "#d32f2f", fontWeight: "bold" }}>
                            -₱
                            {discountAmount.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{ color: "#d32f2f", fontWeight: "bold", bgcolor: "#ffebeb" }}
                          >
                            -₱
                            {discountAmount.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </TableCell>
                        </TableRow>
                      )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        );
      })}
      <Box
        sx={{
          mt: 3,
          p: 2,
          bgcolor: "#f5f5f5",
          borderRadius: "8px",
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: "bold", color: headerBg }}>
          Grand Total: ₱
          {grandTotal.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </Typography>
      </Box>

      {/* Attachments (Income) - shown below grand total when has data */}
      <Box sx={{ mt: 2, mb: 2 }}>
        <ProposalAttachments
          proposal={selectedProposal}
          moduleName="income"
          userInfo={currentUser}
          onChange={handleViewDetails}
        />
      </Box>
    </>
  );
};

export default IncomeTable;
