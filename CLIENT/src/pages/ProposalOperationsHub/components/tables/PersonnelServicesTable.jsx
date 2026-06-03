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
  IconButton,
  TextField,
  TablePagination,
  Grid,
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

const TABLE_CONTAINER_PS = {
  borderRadius: 2,
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  border: "1px solid",
  borderColor: "divider",
  overflowX: "auto",
  overflow: "auto",
};

const PS_TABLE_MIN_WIDTH = 3500;

const PS_HEADER_CELL = {
  expand: { width: 50, minWidth: 50 },
  name: { minWidth: 160 },
  position: { minWidth: 160 },
  sg: { minWidth: 56 },
  step: { minWidth: 56 },
  jg: { minWidth: 56 },
  amount: { minWidth: 130 },
};

const renderPSTableHead = (headerBg) => (
  <TableHead>
    <TableRow sx={{ ...TABLE_HEADER_ROW, bgcolor: headerBg || BRAND_COLORS.deepGreen }}>
      <TableCell sx={{ ...PS_HEADER_CELL.expand }}></TableCell>
      <TableCell sx={{ fontWeight: "bold", ...PS_HEADER_CELL.name }}>Employee Name</TableCell>
      <TableCell sx={{ fontWeight: "bold", ...PS_HEADER_CELL.position }}>Position</TableCell>
      <TableCell sx={{ fontWeight: "bold", ...PS_HEADER_CELL.sg }}>SG</TableCell>
      <TableCell sx={{ fontWeight: "bold", ...PS_HEADER_CELL.step }}>STEP</TableCell>
      <TableCell sx={{ fontWeight: "bold", ...PS_HEADER_CELL.jg }}>JG</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>No. of Dependents</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>Monthly Salary</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>Annual Salary</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>PERA</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>RATA</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>Subsistence Allowance</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>Uniform Allowance</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>Productivity Incentive</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>Honoraria</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>Medical Allowance</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>Additional Medical</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>Children Allowance</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>Meal Allowance</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>Hazard Pay</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>Cash Gift</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>Midyear Bonus</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>Year End Bonus</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>GSIS Premium</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>Provident Fund</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>PG (Pag-ibig)</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>Philhealth Premium</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>Employee Compensation</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>Loyalty Award</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>Earned Leaves</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>Retirement Benefits</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>Terminal Leave</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>Total</TableCell>
    </TableRow>
  </TableHead>
);

const PersonnelServicesTable = ({
  appointmentType, // "permanent", "casual", or "charged"
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
  const titleColor = theme.palette.mode === "dark" ? "#a5d6a7" : "#2d5016";

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [expandedPersonnel, setExpandedPersonnel] = useState({});

  // Filter personnel based on appointmentType
  const filteredPersonnel = React.useMemo(() => {
    const list = proposalDetails?.personnel || [];
    if (appointmentType === "permanent") {
      return list.filter(
        (p) =>
          String(p.statusOfAppointment || p.StatusOfAppointment || "")
            .trim()
            .toUpperCase() === "PERMANENT" && p.chargedToIncomeEligible !== true
      );
    }
    if (appointmentType === "casual") {
      return list.filter(
        (p) =>
          String(p.statusOfAppointment || p.StatusOfAppointment || "")
            .trim()
            .toUpperCase() === "CASUAL" && p.chargedToIncomeEligible !== true
      );
    }
    if (appointmentType === "charged") {
      return list.filter((p) => p.chargedToIncomeEligible === true);
    }
    return [];
  }, [proposalDetails, appointmentType]);

  const grandTotal = React.useMemo(() => {
    return filteredPersonnel.reduce((sum, item) => {
      const originalIndex = editableItems.personnel
        ? editableItems.personnel.findIndex((p) => String(p._id) === String(item._id))
        : -1;
      const editedItem = originalIndex !== -1 ? editableItems.personnel[originalIndex] : item;
      return (
        sum +
        (Number(editedItem?.Total) ||
          Number(editedItem?.total) ||
          Number(item?.Total) ||
          Number(item?.total) ||
          0)
      );
    }, 0);
  }, [filteredPersonnel, editableItems.personnel]);

  const paginatedPersonnel = React.useMemo(() => {
    return filteredPersonnel.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [filteredPersonnel, page, rowsPerPage]);

  const getEmptyLabel = () => {
    if (appointmentType === "permanent") return "No permanent personnel services data available";
    if (appointmentType === "casual") return "No casual personnel services data available";
    return "No personnel services charged to income available";
  };

  const getModuleLabel = () => {
    if (appointmentType === "permanent") return "Grand Total (PS-Permanent)";
    if (appointmentType === "casual") return "Grand Total (PS-Casual)";
    return "Grand Total (PS-Charged to Income)";
  };

  if (filteredPersonnel.length === 0) {
    return (
      <>
        <Box sx={{ mb: 2 }}>
          <ProposalAttachments
            proposal={selectedProposal}
            moduleName="personnel"
            userInfo={currentUser}
            onChange={handleViewDetails}
          />
        </Box>
        <TableContainer sx={TABLE_CONTAINER_PS}>
          <Table size="small" sx={{ minWidth: PS_TABLE_MIN_WIDTH }}>
            {renderPSTableHead(headerBg)}
            <TableBody>
              <TableRow>
                <TableCell
                  colSpan={33}
                  align="center"
                  sx={{ py: 5, borderBottom: "none", bgcolor: "grey.50" }}
                >
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.9rem" }}>
                    {getEmptyLabel()}
                  </Typography>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </>
    );
  }

  return (
    <>
      {/* Attachments */}
      <Box sx={{ mb: 2 }}>
        <ProposalAttachments
          proposal={selectedProposal}
          moduleName="personnel"
          userInfo={currentUser}
          onChange={handleViewDetails}
        />
      </Box>
      <TableContainer sx={TABLE_CONTAINER_PS}>
        <Table size="small" sx={{ minWidth: PS_TABLE_MIN_WIDTH }}>
          {renderPSTableHead(headerBg)}
          <TableBody>
            {paginatedPersonnel.map((item, index) => {
              const globalIndex = page * rowsPerPage + index;
              const originalIndex = editableItems.personnel
                ? editableItems.personnel.findIndex((p) => String(p._id) === String(item._id))
                : -1;
              const finalIndex = originalIndex !== -1 ? originalIndex : globalIndex;
              const itemKey = `${appointmentType}-${finalIndex}`;
              const isChanged = changedItems.has(itemKey);
              const editedItem = editableItems.personnel
                ? editableItems.personnel[finalIndex]
                : item;
              const isExpanded = expandedPersonnel[index];

              return (
                <React.Fragment key={index}>
                  <TableRow
                    hover
                    sx={{
                      cursor: "pointer",
                      bgcolor: item.subsidyEligible
                        ? "#fffde7"
                        : isChanged
                        ? "#fff3cd"
                        : "transparent",
                      transition: "background-color 0.3s ease",
                    }}
                  >
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() =>
                          setExpandedPersonnel((prev) => ({
                            ...prev,
                            [index]: !prev[index],
                          }))
                        }
                      >
                        {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 500 }}>
                      {item.employeeFullName || item.EmployeeFullName || "N/A"}
                    </TableCell>
                    <TableCell>{item.positionTitle || item.PositionTitle || "N/A"}</TableCell>
                    <TableCell>{item.gradelevel_SG || item.SG || item.sg || "N/A"}</TableCell>
                    <TableCell>{item.step || item.Step || "N/A"}</TableCell>
                    <TableCell>{item.gradelevel_JG || item.JG || item.jg || "N/A"}</TableCell>
                    <TableCell align="right">
                      {item.noOfDependent || item.NoOfDependent || 0}
                    </TableCell>
                    <TableCell align="right">
                      {`₱${(item.monthlySalary || item.MonthlySalary || 0).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}`}
                    </TableCell>
                    <TableCell align="right">
                      {`₱${(
                        item.annualSalary ||
                        item.AnnualSalary ||
                        (item.monthlySalary || item.MonthlySalary || 0) * 12
                      ).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}`}
                    </TableCell>
                    <TableCell align="right">
                      {`₱${(item.PERA || item.pera || 0).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}`}
                    </TableCell>
                    <TableCell align="right">
                      {canUserEdit() ? (
                        <TextField
                          type="text"
                          size="small"
                          value={(editedItem?.RATA || 0).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                          })}
                          onKeyDown={preventNegativeNumericKey}
                          onChange={(e) => {
                            const numValue = toNonNegativeNumber(e.target.value);
                            handleEditItemAmount(
                              "personnel",
                              finalIndex,
                              numValue,
                              null,
                              "RATA"
                            );
                          }}
                          inputProps={{
                            style: { textAlign: "right" },
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
                        `₱${(item.RATA || item.rata || 0).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}`
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {`₱${(
                        item.subsistenceAllowance ||
                        item.SubsistenceAllowance ||
                        0
                      ).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`}
                    </TableCell>
                    <TableCell align="right">
                      {`₱${(item.uniformALLOWANCE || item.uniformAllowance || 0).toLocaleString(
                        "en-US",
                        { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                      )}`}
                    </TableCell>
                    <TableCell align="right">
                      {`₱${(
                        item.productivityIncentive ||
                        item.ProductivityIncentive ||
                        0
                      ).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`}
                    </TableCell>
                    <TableCell align="right">
                      {`₱${(item.honoraria || item.Honoraria || 0).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`}
                    </TableCell>
                    <TableCell align="right">
                      {`₱${(item.medical || item.Medical || 0).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`}
                    </TableCell>
                    <TableCell align="right">
                      {`₱${(item.additionalMedical || item.AdditionalMedical || 0).toLocaleString(
                        "en-US",
                        { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                      )}`}
                    </TableCell>
                    <TableCell align="right">
                      {`₱${(item.childrenAllowance || item.ChildrenAllowance || 0).toLocaleString(
                        "en-US",
                        { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                      )}`}
                    </TableCell>
                    <TableCell align="right">
                      {`₱${(item.meal || item.Meal || 0).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`}
                    </TableCell>
                    <TableCell align="right">
                      {`₱${(item.hazardPay || item.HazardPay || 0).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`}
                    </TableCell>
                    <TableCell align="right">
                      {`₱${(item.cashGift || item.CashGift || 0).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`}
                    </TableCell>
                    <TableCell align="right">
                      {`₱${(item.midyearBonus || item.MidyearBonus || 0).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`}
                    </TableCell>
                    <TableCell align="right">
                      {`₱${(item.yearEndBonus || item.YearEndBonus || 0).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`}
                    </TableCell>
                    <TableCell align="right">
                      {`₱${(item.gsisPremium || item.GsisPremium || 0).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`}
                    </TableCell>
                    <TableCell align="right">
                      {`₱${(item.providentFund || item.ProvidentFund || 0).toLocaleString(
                        "en-US",
                        { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                      )}`}
                    </TableCell>
                    <TableCell align="right">
                      {`₱${(item.pagibigPremium || item.PagibigPremium || 0).toLocaleString(
                        "en-US",
                        { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                      )}`}
                    </TableCell>
                    <TableCell align="right">
                      {`₱${(item.philhealthPremium || item.PhilhealthPremium || 0).toLocaleString(
                        "en-US",
                        { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                      )}`}
                    </TableCell>
                    <TableCell align="right">
                      {`₱${(
                        item.employeeCompensation ||
                        item.EmployeeCompensation ||
                        0
                      ).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`}
                    </TableCell>
                    <TableCell align="right">
                      {`₱${(item.loyaltyAward || item.LoyaltyAward || 0).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`}
                    </TableCell>
                    <TableCell align="right">
                      {`₱${(item.earnedLeaves || item.EarnedLeaves || 0).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`}
                    </TableCell>
                    <TableCell align="right">
                      {`₱${(item.retirementBenefits || item.RetirementBenefits || 0).toLocaleString(
                        "en-US",
                        { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                      )}`}
                    </TableCell>
                    <TableCell align="right">
                      {`₱${(item.terminalLeave || item.TerminalLeave || 0).toLocaleString(
                        "en-US",
                        { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                      )}`}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: "bold" }}>
                      {`₱${(
                        editedItem?.Total ||
                        editedItem?.total ||
                        item.Total ||
                        item.total ||
                        0
                      ).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`}
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow>
                      <TableCell
                        colSpan={33}
                        sx={{
                          bgcolor:
                            theme.palette.mode === "dark"
                              ? "background.default"
                              : "#fafafa",
                          p: 3,
                        }}
                      >
                        <Grid container spacing={2}>
                          <Grid item xs={12}>
                            <Typography
                              variant="subtitle2"
                              sx={{ fontWeight: "bold", mb: 2, color: titleColor }}
                            >
                              Employee Information
                            </Typography>
                          </Grid>
                          <Grid item xs={6} md={3}>
                            <Typography variant="caption" color="text.secondary">
                              Item Number
                            </Typography>
                            <Typography variant="body2">{item.itemNumber || "N/A"}</Typography>
                          </Grid>
                          <Grid item xs={6} md={3}>
                            <Typography variant="caption" color="text.secondary">
                              Employee Number
                            </Typography>
                            <Typography variant="body2">
                              {item.employeeNumber || "N/A"}
                            </Typography>
                          </Grid>
                          <Grid item xs={6} md={3}>
                            <Typography variant="caption" color="text.secondary">
                              Status
                            </Typography>
                            <Typography variant="body2">
                              {item.employeeStatus || "N/A"}
                            </Typography>
                          </Grid>
                          <Grid item xs={6} md={3}>
                            <Typography variant="caption" color="text.secondary">
                              Appointment Status
                            </Typography>
                            <Typography variant="body2">
                              {item.statusOfAppointment || "N/A"}
                            </Typography>
                          </Grid>
                        </Grid>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={filteredPersonnel.length}
        page={page}
        onPageChange={(e, newPage) => setPage(newPage)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => {
          setRowsPerPage(parseInt(e.target.value, 10));
          setPage(0);
        }}
        rowsPerPageOptions={[5, 10, 25, 50]}
      />
      <Box
        sx={{
          mt: 3,
          p: 2,
          bgcolor: "#f5f5f5",
          borderRadius: "8px",
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: "bold", color: headerBg }}>
          {getModuleLabel()}: ₱
          {grandTotal.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </Typography>
      </Box>
    </>
  );
};

export default PersonnelServicesTable;
