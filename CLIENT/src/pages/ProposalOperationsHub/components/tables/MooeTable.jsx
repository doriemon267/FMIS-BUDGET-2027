import React, { useState } from "react";
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

const MooeTable = ({
  proposalDetails,
  editableItems,
  changedItems,
  handleEditItemAmount,
  canUserEdit,
  selectedProposal,
  handleViewDetails,
}) => {
  const theme = useTheme();
  const { currentUser } = useUser();
  const headerBg = theme.palette.mode === "dark" ? "#0b2413" : "#2d5016";

  const [expandedGroups, setExpandedGroups] = useState({});

  if (!proposalDetails?.mooe || proposalDetails.mooe.length === 0) {
    return (
      <>
        <Box sx={{ mb: 2 }}>
          <ProposalAttachments
            proposal={selectedProposal}
            moduleName="mooe"
            userInfo={currentUser}
            onChange={handleViewDetails}
          />
        </Box>
        <TableContainer sx={TABLE_CONTAINER}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ ...TABLE_HEADER_ROW, bgcolor: headerBg }}>
                <TableCell sx={{ fontWeight: "bold" }}>Subline Item</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Accounting Title</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>UACS Code</TableCell>
                <TableCell align="right" sx={{ fontWeight: "bold" }}>Income</TableCell>
                <TableCell align="right" sx={{ fontWeight: "bold" }}>Subsidy</TableCell>
                <TableCell align="right" sx={{ fontWeight: "bold" }}>Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell
                  colSpan={6}
                  align="center"
                  sx={{ py: 5, borderBottom: "none", bgcolor: "grey.50" }}
                >
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.9rem" }}>
                    No MOOE data available
                  </Typography>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </>
    );
  }

  const normalizeMergePart = (value) => String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

  // Group first by subline, then merge identical accounting rows coming from
  // the source proposals of a consolidated proposal.
  const groupedMOOE = proposalDetails.mooe.reduce((acc, item, sourceIndex) => {
    const category = item.sublineItem || item.sublimeItem || "Other Expenses";
    if (!acc[category]) acc[category] = [];

    const mergeKey = [
      category,
      item.accountingTitle || item.particulars,
      item.uacsCode,
    ].map(normalizeMergePart).join("|");
    const existing = acc[category].find((entry) => entry.mergeKey === mergeKey);

    if (existing) {
      existing.sourceIndices.push(sourceIndex);
    } else {
      acc[category].push({
        ...item,
        mergeKey,
        sourceIndices: [sourceIndex],
      });
    }
    return acc;
  }, {});

  const getMergedValue = (item, field) => item.sourceIndices.reduce((sum, sourceIndex) => {
    const source = proposalDetails.mooe[sourceIndex];
    const edited = editableItems?.mooe?.[sourceIndex];
    return sum + Number(edited?.[field] ?? source?.[field] ?? 0);
  }, 0);

  // Compute Grand Total using editable items with fallback safety
  const grandTotal = (editableItems?.mooe || proposalDetails.mooe).reduce(
    (sum, item) => sum + (Number(item.income) || 0) + (Number(item.subsidy) || 0),
    0
  );

  return (
    <>
      {/* Attachments (MOOE) */}
      <Box sx={{ mb: 2 }}>
        <ProposalAttachments
          proposal={selectedProposal}
          moduleName="mooe"
          userInfo={currentUser}
          onChange={handleViewDetails}
        />
      </Box>

      {Object.entries(groupedMOOE).map(([category, items]) => {
        const isExpanded = expandedGroups[`mooe-${category}`];

        return (
          <Box key={category} sx={{ mb: 2 }}>
            <Box
              onClick={() =>
                setExpandedGroups((prev) => ({
                  ...prev,
                  [`mooe-${category}`]: !prev[`mooe-${category}`],
                }))
              }
              sx={{
                display: "flex",
                alignItems: "center",
                justifySpaceBetween: "space-between",
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
                  {category} ({items.length} {items.length === 1 ? "item" : "items"})
                </Typography>
              </Box>
            </Box>

            {isExpanded && (
              <TableContainer sx={{ mt: 1, ...TABLE_CONTAINER }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ ...TABLE_HEADER_ROW, bgcolor: headerBg }}>
                      <TableCell sx={{ fontWeight: "bold" }}>Subline Item</TableCell>
                      <TableCell sx={{ fontWeight: "bold" }}>Accounting Title</TableCell>
                      <TableCell sx={{ fontWeight: "bold" }}>UACS Code</TableCell>
                      <TableCell align="right" sx={{ fontWeight: "bold" }}>Income</TableCell>
                      <TableCell align="right" sx={{ fontWeight: "bold" }}>Subsidy</TableCell>
                      <TableCell align="right" sx={{ fontWeight: "bold" }}>Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.map((item, itemIdx) => {
                      const sourceIndices = item.sourceIndices;
                      const isChanged = sourceIndices.some((sourceIndex) =>
                        changedItems?.has(`mooe-${sourceIndex}`)
                      );

                      const income = getMergedValue(item, "income");
                      const subsidy = getMergedValue(item, "subsidy");
                      const itemTotal = income + subsidy;

                      return (
                        <TableRow
                          key={item.mergeKey || item.uacsCode || itemIdx}
                          hover
                          sx={{
                            bgcolor: isChanged ? "#fff3cd" : "transparent",
                            transition: "background-color 0.3s ease",
                          }}
                        >
                          <TableCell
                            sx={{
                              fontSize: "0.85rem",
                              fontWeight: 500,
                            }}
                          >
                            {item.sublineItem || item.sublimeItem || "N/A"}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 500 }}>
                            {item.accountingTitle || item.particulars || "N/A"}
                          </TableCell>
                          <TableCell sx={{ fontFamily: "monospace", fontSize: "0.85rem" }}>
                            {item.uacsCode || "N/A"}
                          </TableCell>
                          <TableCell align="right" sx={{ minWidth: 120 }}>
                            {canUserEdit() ? (
                              <TextField
                                type="text"
                                size="small"
                                value={income.toLocaleString("en-US", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                                onKeyDown={preventNegativeNumericKey}
                                onChange={(e) => {
                                  const numValue = toNonNegativeNumber(e.target.value);
                                  handleEditItemAmount(
                                    "mooe",
                                    sourceIndices,
                                    numValue,
                                    "income"
                                  );
                                }}
                                inputProps={{
                                  style: { textAlign: "right" },
                                }}
                                sx={{
                                  width: "100%",
                                  "& .MuiOutlinedInput-root": {
                                    bgcolor: isChanged ? "#fff9e6" : "white",
                                    borderColor: isChanged ? "#ffc107" : undefined,
                                  },
                                }}
                              />
                            ) : (
                              `₱${income.toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}`
                            )}
                          </TableCell>
                          <TableCell align="right" sx={{ minWidth: 120 }}>
                            {canUserEdit() ? (
                              <TextField
                                type="text"
                                size="small"
                                value={subsidy.toLocaleString("en-US", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                                onKeyDown={preventNegativeNumericKey}
                                onChange={(e) => {
                                  const numValue = toNonNegativeNumber(e.target.value);
                                  handleEditItemAmount(
                                    "mooe",
                                    sourceIndices,
                                    numValue,
                                    "subsidy"
                                  );
                                }}
                                inputProps={{
                                  style: { textAlign: "right" },
                                }}
                                sx={{
                                  width: "100%",
                                  "& .MuiOutlinedInput-root": {
                                    bgcolor: isChanged ? "#fff9e6" : "white",
                                    borderColor: isChanged ? "#ffc107" : undefined,
                                  },
                                }}
                              />
                            ) : (
                              `₱${subsidy.toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}`
                            )}
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{
                              fontWeight: "bold",
                              bgcolor: "#e8f5e9",
                              minWidth: 130,
                            }}
                          >
                            ₱
                            {itemTotal.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </TableCell>
                        </TableRow>
                      );
                    })}

                    {/* Category Subtotal Row */}
                    <TableRow sx={{ bgcolor: "#e8f5e9" }}>
                      <TableCell
                        colSpan={3}
                        sx={{
                          fontWeight: "bold",
                          textAlign: "right",
                          pr: 2,
                        }}
                      >
                        Subtotal ({category}):
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          fontWeight: "bold",
                          bgcolor: "#c8e6c9",
                          minWidth: 120,
                        }}
                      >
                        ₱
                        {items
                          .reduce((sum, item) => {
                            return sum + getMergedValue(item, "income");
                          }, 0)
                          .toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          fontWeight: "bold",
                          bgcolor: "#c8e6c9",
                          minWidth: 120,
                        }}
                      >
                        ₱
                        {items
                          .reduce((sum, item) => {
                            return sum + getMergedValue(item, "subsidy");
                          }, 0)
                          .toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          fontWeight: "bold",
                          bgcolor: "#a5d6a7",
                          minWidth: 130,
                        }}
                      >
                        ₱
                        {items
                          .reduce((sum, item) => {
                            return sum + getMergedValue(item, "income") + getMergedValue(item, "subsidy");
                          }, 0)
                          .toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        );
      })}

      {/* Grand Total Box */}
      <Box
        sx={{
          mt: 3,
          p: 2,
          bgcolor: "#f5f5f5",
          borderRadius: "8px",
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: "bold", color: "#d32f2f" }}>
          Grand Total: ₱
          {grandTotal.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </Typography>
      </Box>
    </>
  );
};

export default MooeTable;
