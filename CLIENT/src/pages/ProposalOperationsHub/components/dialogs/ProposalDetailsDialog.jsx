import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  CircularProgress,
  Tabs,
  Tab,
  Typography,
  Grid,
  Chip,
  Alert,
  TextField,
  useTheme,
} from "@mui/material";
import {
  History as HistoryIcon,
} from "@mui/icons-material";
import {
  FiLayers,
  FiUser,
  FiActivity,
  FiTrendingUp,
  FiUserCheck,
  FiUsers,
  FiCreditCard,
  FiBriefcase,
  FiCpu,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { useUser } from "../../../../context/UserContext";
import api from "../../../../config/api";
import { toast } from "react-toastify";
import { useQueryClient } from "@tanstack/react-query";
import { useProposalCalculations } from "../../hooks/useProposalCalculations";
import ProposalVersionHistoryDialog from "../../../../components/myproposal/ProposalVersionHistoryDialog";
import { WORKFLOW_STATUS_UI_METADATA } from "../../../../constants/workflowConstants";

// Lazy-loaded or imported table components
import IncomeTable from "../tables/IncomeTable";
import PersonnelServicesTable from "../tables/PersonnelServicesTable";
import MooeTable from "../tables/MooeTable";
import CapitalOutlayTable from "../tables/CapitalOutlayTable";

const renderStatusChip = (status) => {
  const statusColorMap = {
    DRAFT: { bg: "#ffb74d", text: "#fff" },
    FORWARDED_TO_REVIEWER: { bg: "#42a5f5", text: "#fff" },
    FORWARDED_TO_APPROVER: { bg: "#42a5f5", text: "#fff" },
    FORWARDED_TO_BRD_ANALYST: { bg: "#42a5f5", text: "#fff" },
    FORWARDED_TO_BRD_OFFICER: { bg: "#42a5f5", text: "#fff" },
    FORWARDED_TO_BRD_MANAGER: { bg: "#42a5f5", text: "#fff" },
    FINALIZED: { bg: "#66bb6a", text: "#fff" },
    RETURNED_TO_PREPARER: { bg: "#ef5350", text: "#fff" },
    RETURNED_TO_REVIEWER: { bg: "#ef5350", text: "#fff" },
    RETURNED_TO_APPROVER: { bg: "#ef5350", text: "#fff" },
    RETURNED_TO_PLANNING_ANALYST: { bg: "#ef5350", text: "#fff" },
    RETURNED_TO_OFFICER: { bg: "#ef5350", text: "#fff" },
    MERGED: { bg: "#9e9e9e", text: "#fff" },
  };

  const colors = statusColorMap[status] || { bg: "#999", text: "#fff" };
  const label = WORKFLOW_STATUS_UI_METADATA[status]?.label || status;

  return (
    <Chip
      label={label}
      sx={{
        bgcolor: colors.bg,
        color: colors.text,
        fontWeight: "bold",
        fontSize: "0.75rem",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
      }}
      size="small"
    />
  );
};

const ProposalDetailsDialog = ({
  open,
  onClose,
  selectedProposal,
  setSelectedProposal,
  proposalDetails,
  setProposalDetails,
  detailsLoading,
  canUserEdit,
  canViewVersionHistory,
  versionHistoryOpen,
  setVersionHistoryOpen,
  detailsTab,
  setDetailsTab,
  changedItems,
  setChangedItems,
  editableItems,
  setEditableItems,
  proposalEditValues,
  setProposalEditValues,
  proposalEditDirty,
  setProposalEditDirty,
  discountSettings,
  handleSaveChanges,
  handleEditItemAmount,
  lockStatus,
  hasLock,
  showAllRegions,
  fetchProposals,
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { currentUser } = useUser();
  const queryClient = useQueryClient();
  const {
    getAuthoritativeProjectedIncome,
    getAuthoritativeProjectedSubsidy,
    getAuthoritativeProposedBudget,
  } = useProposalCalculations();

  const headerBg = theme.palette.mode === "dark" ? "#0b2413" : "#2d5016";
  const titleColor = theme.palette.mode === "dark" ? "#a5d6a7" : "#2d5016";

  const handleDialogClose = () => {
    if (changedItems.size > 0) {
      const confirm = window.confirm("You have unsaved changes. Close anyway?");
      if (!confirm) return;
    }
    onClose();
    setChangedItems(new Set());
    fetchProposals({ forceAllRegions: showAllRegions });
  };

  return (
    <Dialog
      open={open}
      onClose={handleDialogClose}
      maxWidth="lg"
      fullWidth
      slotProps={{
        backdrop: {
          sx: {
            backdropFilter: "blur(6px)",
            backgroundColor: "rgba(0, 0, 0, 0.4)",
          },
        },
      }}
      PaperProps={{
        sx: {
          borderRadius: "16px",
          boxShadow: "0 20px 48px rgba(0,0,0,0.16)",
          border: "1px solid rgba(255,255,255,0.08)",
        },
      }}
    >
      <DialogTitle
        sx={{
          bgcolor:
            theme.palette.mode === "dark"
              ? "linear-gradient(135deg, #0b2413 0%, #1e3d22 100%)"
              : "linear-gradient(135deg, #2d5016 0%, #375e38 100%)",
          background:
            theme.palette.mode === "dark"
              ? "linear-gradient(135deg, #0b2413 0%, #1e3d22 100%)"
              : "linear-gradient(135deg, #2d5016 0%, #375e38 100%)",
          color: "white",
          fontWeight: "bold",
          fontSize: "1.25rem",
          p: 3,
        }}
      >
        <Box
          sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <span>Proposal Details</span>
          {canViewVersionHistory && selectedProposal?._id && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<HistoryIcon />}
              onClick={() => setVersionHistoryOpen(true)}
              sx={{
                color: "white",
                borderColor: "rgba(255,255,255,0.7)",
                "&:hover": { borderColor: "white", bgcolor: "rgba(255,255,255,0.1)" },
              }}
            >
              Version history
            </Button>
          )}
        </Box>
      </DialogTitle>
      <DialogContent sx={{ p: 0 }}>
        {lockStatus?.isLocked && !hasLock && (
          <Alert severity="warning" sx={{ m: 2 }}>
            This proposal is currently being edited by{" "}
            {lockStatus.lockedBy?.userName || "another user"} (
            {lockStatus.lockedBy?.userRole || "User"}). You can only view the details.
          </Alert>
        )}
        {detailsLoading ? (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              p: 6,
            }}
          >
            <CircularProgress sx={{ color: titleColor }} size={20} />
          </Box>
        ) : (
          <>
            {/* Proposal Summary Dashboard */}
            <Box
              sx={{
                p: 4,
                bgcolor:
                  theme.palette.mode === "dark"
                    ? "rgba(255, 255, 255, 0.02)"
                    : "rgba(0, 0, 0, 0.01)",
                borderBottom: "1px solid",
                borderColor: "divider",
              }}
            >
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      height: "100%",
                      justifyContent: "center",
                    }}
                  >
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        textTransform: "uppercase",
                        fontWeight: 700,
                        letterSpacing: "0.5px",
                        mb: 0.5,
                      }}
                    >
                      Responsibility Center
                    </Typography>
                    <Typography
                      variant="body1"
                      sx={{ fontWeight: 700, color: titleColor, fontSize: "1.05rem" }}
                    >
                      {selectedProposal?.responsibilityCenter ||
                        selectedProposal?.division ||
                        selectedProposal?.department ||
                        proposalDetails?.income?.[0]?.division ||
                        proposalDetails?.income?.[0]?.department ||
                        proposalDetails?.income?.[0]?.responsibilityCenter ||
                        proposalDetails?.personnel?.[0]?.division ||
                        proposalDetails?.personnel?.[0]?.department ||
                        proposalDetails?.mooe?.[0]?.division ||
                        proposalDetails?.mooe?.[0]?.department ||
                        proposalDetails?.capitalOutlay?.[0]?.division ||
                        proposalDetails?.capitalOutlay?.[0]?.department ||
                        proposalDetails?.income?.[0]?.region ||
                        proposalDetails?.personnel?.[0]?.region ||
                        proposalDetails?.mooe?.[0]?.region ||
                        proposalDetails?.capitalOutlay?.[0]?.region ||
                        "N/A"}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        textTransform: "uppercase",
                        fontWeight: 700,
                        letterSpacing: "0.5px",
                        mb: 0.5,
                      }}
                    >
                      Fiscal Year
                    </Typography>
                    <Typography
                      variant="body1"
                      sx={{ fontWeight: 700, fontSize: "1.1rem", color: "#1a1a1a" }}
                    >
                      {selectedProposal?.fiscalYear}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        textTransform: "uppercase",
                        fontWeight: 700,
                        letterSpacing: "0.5px",
                        mb: 0.5,
                      }}
                    >
                      Budget Type
                    </Typography>
                    <Box sx={{ mt: 0.5 }}>
                      <Chip
                        label={
                          selectedProposal?.budgetType?.toUpperCase() ||
                          selectedProposal?.modelType?.toUpperCase()
                        }
                        size="small"
                        sx={{
                          bgcolor: headerBg,
                          color: "white",
                          fontWeight: "bold",
                          borderRadius: "6px",
                          px: 1,
                        }}
                      />
                    </Box>
                  </Box>
                </Grid>

                {/* Premium Cards Grid for Metrics */}
                <Grid item xs={12} md={4}>
                  <Box
                    sx={{
                      p: 2.5,
                      borderRadius: "12px",
                      bgcolor: "rgba(3, 83, 136, 0.03)",
                      border: "1px solid rgba(3, 83, 136, 0.08)",
                      boxShadow: "0 2px 8px rgba(3, 83, 136, 0.02)",
                      transition: "all 0.2s",
                      "&:hover": { boxShadow: "0 4px 16px rgba(3, 83, 136, 0.06)" },
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        color: "#035388",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Projected Corporate Income
                    </Typography>
                    <Typography
                      variant="h6"
                      sx={{ fontWeight: 800, color: "#035388", mt: 0.5, fontSize: "1.25rem" }}
                    >
                      ₱
                      {getAuthoritativeProjectedIncome(
                        selectedProposal,
                        proposalDetails
                      ).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </Typography>
                  </Box>
                </Grid>

                <Grid item xs={12} md={4}>
                  <Box
                    sx={{
                      p: 2.5,
                      borderRadius: "12px",
                      bgcolor: "rgba(46, 125, 50, 0.03)",
                      border: "1px solid rgba(46, 125, 50, 0.08)",
                      boxShadow: "0 2px 8px rgba(46, 125, 50, 0.02)",
                      transition: "all 0.2s",
                      "&:hover": { boxShadow: "0 4px 16px rgba(46, 125, 50, 0.06)" },
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        color: "#2e7d32",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Projected Subsidy
                    </Typography>
                    <Typography
                      variant="h6"
                      sx={{ fontWeight: 800, color: "#2e7d32", mt: 0.5, fontSize: "1.25rem" }}
                    >
                      ₱
                      {getAuthoritativeProjectedSubsidy(
                        selectedProposal,
                        proposalDetails
                      ).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </Typography>
                  </Box>
                </Grid>

                <Grid item xs={12} md={4}>
                  <Box
                    sx={{
                      p: 2.5,
                      borderRadius: "12px",
                      bgcolor:
                        theme.palette.mode === "dark"
                          ? "rgba(76, 175, 80, 0.15)"
                          : "rgba(45, 80, 22, 0.04)",
                      border: "1px solid",
                      borderColor:
                        theme.palette.mode === "dark"
                          ? "rgba(76, 175, 80, 0.25)"
                          : "rgba(45, 80, 22, 0.1)",
                      boxShadow: "0 2px 8px rgba(45, 80, 22, 0.02)",
                      transition: "all 0.2s",
                      "&:hover": { boxShadow: "0 4px 16px rgba(45, 80, 22, 0.07)" },
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        color: titleColor,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Proposed Budget (Grand Total)
                    </Typography>
                    <Typography
                      variant="h6"
                      sx={{ fontWeight: 800, color: titleColor, mt: 0.5, fontSize: "1.3rem" }}
                    >
                      ₱
                      {getAuthoritativeProposedBudget(
                        selectedProposal,
                        proposalDetails
                      ).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </Typography>
                  </Box>
                </Grid>

                {(() => {
                  const st = selectedProposal?.status;
                  const brdOrFinal = [
                    "FORWARDED_TO_BRD_ANALYST",
                    "Forwarded to Budget/Planning Analyst",
                    "FORWARDED_TO_BRD_OFFICER",
                    "Forwarded to Budget Officer",
                    "FORWARDED_TO_BRD_MANAGER",
                    "Forwarded to Overall Budget Approver",
                    "Forwarded to Manager",
                    "FINALIZED",
                    "Finalized",
                  ].some((s) => String(st) === s);
                  const isBRD = currentUser?.Roles?.some((r) =>
                    [
                      "BUDGET_PLANNING_ANALYST",
                      "BUDGET PLANNING ANALYST",
                      "BUDGET_OFFICER",
                      "BUDGET OFFICER",
                      "BUDGET_MANAGER",
                      "BUDGET MANAGER",
                      "SUPER_ADMIN",
                      "SUPER ADMIN",
                    ].includes(String(r))
                  );
                  if (!brdOrFinal || !isBRD) return null;
                  const tierParams = new URLSearchParams();
                  if (selectedProposal?.fiscalYear != null)
                    tierParams.set("fiscalYear", String(selectedProposal.fiscalYear));
                  if (selectedProposal?.region) {
                    const regRaw = selectedProposal.region;
                    const regStr =
                      regRaw && typeof regRaw === "object"
                        ? regRaw.RegionName ||
                          regRaw.Region ||
                          regRaw.regionName ||
                          regRaw.region ||
                          regRaw.name ||
                          ""
                        : String(regRaw || "");
                    tierParams.set("region", regStr);
                  }
                  if (selectedProposal?.department)
                    tierParams.set("department", String(selectedProposal.department));
                  if (selectedProposal?.division || selectedProposal?.responsibilityCenter)
                    tierParams.set(
                      "division",
                      String(selectedProposal.division || selectedProposal.responsibilityCenter)
                    );
                  return (
                    <Grid item xs={12}>
                      <Alert severity="info" sx={{ mt: 1 }}>
                        For this proposal&apos;s scope, you can fill or update{" "}
                        <strong>Tier</strong> (Tier 1 / Tier 2). The Tier you save is what
                        gets passed to Budget Officer until Budget Manager finalizes.
                        <Button
                          size="small"
                          variant="contained"
                          sx={{ ml: 2, mt: 0.5 }}
                          onClick={() => navigate(`/tier?${tierParams.toString()}`)}
                        >
                          Open Tier
                        </Button>
                      </Alert>
                    </Grid>
                  );
                })()}

                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    Status
                  </Typography>
                  {renderStatusChip(selectedProposal?.status)}
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    Created Date
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {selectedProposal?.createdAt
                      ? new Date(selectedProposal.createdAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })
                      : "N/A"}
                  </Typography>
                </Grid>
              </Grid>

              {/* Inline Proposal Details Edit */}
              {(() => {
                if (!selectedProposal) return null;
                const userRoles = currentUser?.Roles || [];
                const isPreparer = userRoles.some((r) =>
                  ["BUDGET PREPARER", "BUDGET_PREPARER"].includes(r)
                );
                const isSuperAdmin = userRoles.some((r) =>
                  ["SUPER_ADMIN", "SUPER ADMIN"].includes(r)
                );
                const draftStatuses = [
                  "DRAFT",
                  "Draft",
                  "Returned to Preparer",
                  "RETURNED_TO_PREPARER",
                ];
                const canEditMeta =
                  (isPreparer || isSuperAdmin) &&
                  draftStatuses.includes(selectedProposal.status);
                if (!canEditMeta) return null;
                return (
                  <Box sx={{ mt: 4, pt: 3, borderTop: "2px dashed #d0d0d0" }}>
                    <Typography
                      variant="subtitle1"
                      sx={{ fontWeight: 600, mb: 2, color: titleColor }}
                    >
                      Edit Proposal Details
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <TextField
                          label="Title"
                          fullWidth
                          size="small"
                          value={proposalEditValues.title}
                          onChange={(e) => {
                            setProposalEditValues((v) => ({
                              ...v,
                              title: e.target.value,
                            }));
                            setProposalEditDirty(true);
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} md={12}>
                        <TextField
                          label="Description"
                          fullWidth
                          multiline
                          minRows={2}
                          value={proposalEditValues.description}
                          onChange={(e) => {
                            setProposalEditValues((v) => ({
                              ...v,
                              description: e.target.value,
                            }));
                            setProposalEditDirty(true);
                          }}
                        />
                      </Grid>
                    </Grid>
                    <Box sx={{ mt: 2, display: "flex", gap: 2 }}>
                      <Button
                        variant="contained"
                        size="small"
                        disabled={!proposalEditDirty}
                        sx={{
                          bgcolor: proposalEditDirty ? headerBg : "text.disabled",
                          "&:hover": {
                            bgcolor: proposalEditDirty
                              ? theme.palette.mode === "dark"
                                ? "#14331d"
                                : "#1e3a0f"
                              : "text.disabled",
                          },
                        }}
                        onClick={async () => {
                          try {
                            const payload = {
                              title: proposalEditValues.title,
                              description: proposalEditValues.description,
                              __v: selectedProposal.__v,
                            };
                            const res = await api.put(
                              `/api/allproposal/proposals/${selectedProposal._id}`,
                              payload
                            );
                            const updated = res?.data?.data || res?.data;
                            toast.success("Proposal details updated");
                            setSelectedProposal((prev) =>
                              prev
                                ? { ...prev, ...payload, __v: updated?.__v ?? prev.__v }
                                : prev
                            );
                            queryClient.invalidateQueries({
                              queryKey: ["workflowProposals"],
                            });
                            setProposalEditDirty(false);
                            queryClient.invalidateQueries({
                              queryKey: ["workflowNotifications"],
                            });
                          } catch (err) {
                            if (err?.response?.status === 409) {
                              toast.warning(
                                "Proposal was modified by another user. Please refresh and try again."
                              );
                              const refreshed = await api.get(
                                `${WORKFLOW_API_BASE}/${selectedProposal._id}`
                              );
                              if (refreshed?.data?.proposal)
                                setSelectedProposal(refreshed.data.proposal);
                            } else {
                              console.error("Error updating proposal details", err);
                              toast.error("Failed to update proposal details");
                            }
                          }
                        }}
                      >
                        Save Details
                      </Button>
                      {proposalEditDirty && (
                        <Button
                          variant="text"
                          size="small"
                          onClick={() => {
                            setProposalEditValues({
                              title: selectedProposal.title || "",
                              description: selectedProposal.description || "",
                            });
                            setProposalEditDirty(false);
                          }}
                        >
                          Reset
                        </Button>
                      )}
                    </Box>
                  </Box>
                );
              })()}
            </Box>

            {/* Tabs for different sections */}
            {!selectedProposal?.isConsolidated && (
              <>
                <Tabs
                  value={detailsTab}
                  onChange={(e, newValue) => setDetailsTab(newValue)}
                  variant="scrollable"
                  scrollButtons="auto"
                  sx={{
                    mb: 0.5,
                    borderBottom: "none",
                  }}
                >
                  <Tab
                    icon={
                      <Box
                        className="tab-icon-wrapper"
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          transition: "transform 0.2s",
                          color: detailsTab === "income" ? "#43a047" : "inherit",
                        }}
                      >
                        <FiTrendingUp size={16} />
                      </Box>
                    }
                    iconPosition="start"
                    label="Income"
                    value="income"
                  />
                  <Tab
                    icon={
                      <Box
                        className="tab-icon-wrapper"
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          transition: "transform 0.2s",
                          color: detailsTab === "ps-permanent" ? headerBg : "inherit",
                        }}
                      >
                        <FiUserCheck size={16} />
                      </Box>
                    }
                    iconPosition="start"
                    label="PS-Permanent"
                    value="ps-permanent"
                  />
                  <Tab
                    icon={
                      <Box
                        className="tab-icon-wrapper"
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          transition: "transform 0.2s",
                          color: detailsTab === "ps-casual" ? "#f57c00" : "inherit",
                        }}
                      >
                        <FiUsers size={16} />
                      </Box>
                    }
                    iconPosition="start"
                    label="PS-Casual"
                    value="ps-casual"
                  />
                  <Tab
                    icon={
                      <Box
                        className="tab-icon-wrapper"
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          transition: "transform 0.2s",
                          color: detailsTab === "ps-charged" ? "#9c27b0" : "inherit",
                        }}
                      >
                        <FiCreditCard size={16} />
                      </Box>
                    }
                    iconPosition="start"
                    label="PS-Charged"
                    value="ps-charged"
                  />
                  <Tab
                    icon={
                      <Box
                        className="tab-icon-wrapper"
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          transition: "transform 0.2s",
                          color: detailsTab === "mooe" ? "#00b0ff" : "inherit",
                        }}
                      >
                        <FiBriefcase size={16} />
                      </Box>
                    }
                    iconPosition="start"
                    label="MOOE"
                    value="mooe"
                  />
                  <Tab
                    icon={
                      <Box
                        className="tab-icon-wrapper"
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          transition: "transform 0.2s",
                          color: detailsTab === "capital-outlay" ? "#009688" : "inherit",
                        }}
                      >
                        <FiCpu size={16} />
                      </Box>
                    }
                    iconPosition="start"
                    label="Capital Outlay"
                    value="capital-outlay"
                  />
                </Tabs>

                {/* Tab Content */}
                <Box
                  sx={{
                    p: 3,
                    minHeight: 300,
                    maxHeight: 500,
                    overflow: "auto",
                    overflowX: "auto",
                  }}
                >
                  {detailsTab === "income" && (
                    <IncomeTable
                      proposalDetails={proposalDetails}
                      editableItems={editableItems}
                      changedItems={changedItems}
                      handleEditItemAmount={handleEditItemAmount}
                      canUserEdit={canUserEdit}
                      discountSettings={discountSettings}
                      selectedProposal={selectedProposal}
                    />
                  )}

                  {detailsTab === "ps-permanent" && (
                    <PersonnelServicesTable
                      appointmentType="permanent"
                      proposalDetails={proposalDetails}
                      editableItems={editableItems}
                      changedItems={changedItems}
                      handleEditItemAmount={handleEditItemAmount}
                      canUserEdit={canUserEdit}
                      selectedProposal={selectedProposal}
                    />
                  )}

                  {detailsTab === "ps-casual" && (
                    <PersonnelServicesTable
                      appointmentType="casual"
                      proposalDetails={proposalDetails}
                      editableItems={editableItems}
                      changedItems={changedItems}
                      handleEditItemAmount={handleEditItemAmount}
                      canUserEdit={canUserEdit}
                      selectedProposal={selectedProposal}
                    />
                  )}

                  {detailsTab === "ps-charged" && (
                    <PersonnelServicesTable
                      appointmentType="charged"
                      proposalDetails={proposalDetails}
                      editableItems={editableItems}
                      changedItems={changedItems}
                      handleEditItemAmount={handleEditItemAmount}
                      canUserEdit={canUserEdit}
                      selectedProposal={selectedProposal}
                    />
                  )}

                  {detailsTab === "mooe" && (
                    <MooeTable
                      proposalDetails={proposalDetails}
                      editableItems={editableItems}
                      changedItems={changedItems}
                      handleEditItemAmount={handleEditItemAmount}
                      canUserEdit={canUserEdit}
                      selectedProposal={selectedProposal}
                    />
                  )}

                  {detailsTab === "capital-outlay" && (
                    <CapitalOutlayTable
                      proposalDetails={proposalDetails}
                      editableItems={editableItems}
                      changedItems={changedItems}
                      handleEditItemAmount={handleEditItemAmount}
                      canUserEdit={canUserEdit}
                      selectedProposal={selectedProposal}
                    />
                  )}
                </Box>
              </>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions
        sx={{ p: 3, borderTop: "1px solid #e0e0e0", justifyContent: "space-between" }}
      >
        <Box sx={{ display: "flex", gap: 2 }}>
          {canUserEdit() && changedItems.size > 0 && (
            <>
              <Button
                variant="contained"
                sx={{
                  bgcolor: headerBg,
                  "&:hover": {
                    bgcolor: theme.palette.mode === "dark" ? "#14331d" : "#1e3a0f",
                  },
                }}
                onClick={handleSaveChanges}
              >
                Save Changes ({changedItems.size})
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  setEditableItems({
                    income: JSON.parse(JSON.stringify(proposalDetails.income || [])),
                    personnel: JSON.parse(JSON.stringify(proposalDetails.personnel || [])),
                    mooe: JSON.parse(JSON.stringify(proposalDetails.mooe || [])),
                    capitalOutlay: JSON.parse(
                      JSON.stringify(proposalDetails.capitalOutlay || [])
                    ),
                  });
                  setChangedItems(new Set());
                }}
              >
                Cancel
              </Button>
            </>
          )}
        </Box>
        <Button
          onClick={handleDialogClose}
          variant="contained"
          sx={{
            bgcolor: headerBg,
            color: "white",
            textTransform: "none",
            fontWeight: 600,
            px: 4,
            "&:hover": {
              bgcolor: theme.palette.mode === "dark" ? "#14331d" : "#4a7c2c",
            },
          }}
        >
          Close
        </Button>
      </DialogActions>

      <ProposalVersionHistoryDialog
        open={versionHistoryOpen}
        onClose={() => setVersionHistoryOpen(false)}
        proposalId={selectedProposal?._id ? String(selectedProposal._id) : undefined}
      />
    </Dialog>
  );
};

export default ProposalDetailsDialog;
