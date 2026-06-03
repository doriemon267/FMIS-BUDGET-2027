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
import { displayUacs } from "../../../../utils/uacsDisplayHelper";

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

const CapitalOutlayTable = ({
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

  if (!proposalDetails?.capitalOutlay || proposalDetails.capitalOutlay.length === 0) {
    return (
      <>
        <Box sx={{ mb: 2 }}>
          <ProposalAttachments
            proposal={selectedProposal}
            moduleName="capital"
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
                    No capital outlay data available
                  </Typography>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </>
    );
  }

  const groupedCapital = proposalDetails.capitalOutlay.reduce((acc, item) => {
    let category = "Uncategorized";
    if (item.categoryName) {
      category = item.categoryName;
    } else if (item.category) {
      if (typeof item.category === "object" && item.category.categoryName) {
        category = item.category.categoryName;
      } else if (typeof item.category === "object" && item.category.name) {
        category = item.category.name;
      } else if (
        typeof item.category === "string" &&
        item.category.trim() &&
        item.category.length > 20
      ) {
        category =
          item.sublineItem ||
          item.type ||
          item.classification ||
          item.categoryTitle ||
          "Uncategorized";
      } else if (typeof item.category === "string" && item.category.trim()) {
        category = item.category;
      } else {
        category = item.type || item.classification || item.categoryTitle || "Uncategorized";
      }
    } else {
      category =
        item.sublineItem || item.type || item.classification || item.categoryTitle || "Uncategorized";
    }
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {});

  const grandTotal = editableItems.capitalOutlay.reduce(
    (sum, item) => sum + (item.cost || item.amount || 0),
    0
  );

  return (
    <>
      {Object.entries(groupedCapital).map(([category, items]) => {
        const isExpanded = expandedGroups[`capital-${category}`];

        return (
          <Box key={category} sx={{ mb: 2 }}>
            {/* Attachments (Capital Outlay) */}
            <Box sx={{ mb: 1 }}>
              <ProposalAttachments
                proposal={selectedProposal}
                moduleName="capital"
                userInfo={currentUser}
                onChange={handleViewDetails}
              />
            </Box>
            <Box
              onClick={() =>
                setExpandedGroups((prev) => ({
                  ...prev,
                  [`capital-${category}`]: !prev[`capital-${category}`],
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
                  {category} ({items.length} {items.length === 1 ? "item" : "items"})
                </Typography>
              </Box>
            </Box>

            {isExpanded && (
              <TableContainer sx={{ mt: 1 }}>
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
                    {items.map((item, idx) => {
                      const globalIndex = proposalDetails.capitalOutlay.indexOf(item);
                      const itemKey = `capitalOutlay-${globalIndex}`;
                      const isChanged = changedItems.has(itemKey);
                      const editedItem = editableItems.capitalOutlay[globalIndex];
                      const income = editedItem?.income || item.income || 0;
                      const subsidy = editedItem?.subsidy || item.subsidy || 0;
                      const itemTotal = income + subsidy;

                      return (
                        <TableRow
                          key={idx}
                          hover
                          sx={{
                            bgcolor: isChanged ? "#fff3cd" : "transparent",
                            transition: "background-color 0.3s ease",
                          }}
                        >
                          <TableCell>{item.sublineItem || item.sublimeItem || "N/A"}</TableCell>
                          <TableCell>
                            {item.accountingTitle || item.particulars || "N/A"}
                          </TableCell>
                          <TableCell>{displayUacs(item.uacsCode, item.sublineItem)}</TableCell>
                          <TableCell align="right" sx={{ minWidth: 130 }}>
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
                                    "capitalOutlay",
                                    globalIndex,
                                    numValue,
                                    "income"
                                  );
                                }}
                                inputProps={{
                                  style: {
                                    textAlign: "right",
                                  },
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
                              <Box
                                sx={{
                                  textAlign: "right",
                                  p: 0.5,
                                }}
                              >
                                ₱
                                {income.toLocaleString("en-US", {
                                  minimumFractionDigits: 2,
                                })}
                              </Box>
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
                                    "capitalOutlay",
                                    globalIndex,
                                    numValue,
                                    "subsidy"
                                  );
                                }}
                                inputProps={{
                                  style: {
                                    textAlign: "right",
                                  },
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
                            })}
                          </TableCell>
                        </TableRow>
                      );
                    })}
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
        <Typography variant="h6" sx={{ fontWeight: "bold", color: "#d32f2f" }}>
          Grand Total: ₱
          {grandTotal.toLocaleString("en-US", {
            minimumFractionDigits: 2,
          })}
        </Typography>
      </Box>
    </>
  );
};

export default CapitalOutlayTable;
