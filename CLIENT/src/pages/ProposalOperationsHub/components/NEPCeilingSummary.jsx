import React, { useEffect, useMemo } from "react";
import {
  Alert,
  AlertTitle,
  Box,
  Chip,
  CircularProgress,
  Grid,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useQuery } from "@tanstack/react-query";
import api from "../../../config/api";
import {
  buildLiveCompliance,
  CURRENCY_TOLERANCE,
  getNepReportReadiness,
} from "../../../utils/nepReportStatus";

const FIELD_LABELS = {
  targetCeilingMismatch: "Income + Subsidy total",
  totalExpenses: "Total allocation",
  personnelServices: "Personnel Services",
  mooe: "MOOE",
  capitalOutlay: "Capital Outlay",
};

const formatCurrency = (value) =>
  `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatPercent = (value) =>
  `${Number(value || 0).toLocaleString("en-PH", { maximumFractionDigits: 1 })}%`;

const roundMoney = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const getUtilization = (actual, cap) => {
  if (cap <= 0) return actual > 0 ? 100 : 0;
  return (actual / cap) * 100;
};

const FinancialMetric = ({ label, value, tone = "neutral", helper }) => {
  const toneColor =
    tone === "error" ? "error.main" : tone === "success" ? "success.main" : "text.primary";

  return (
    <Box
      sx={{
        height: "100%",
        p: { xs: 1.75, md: 2 },
        border: 1,
        borderColor: "divider",
        bgcolor: (theme) =>
          tone === "error"
            ? alpha(theme.palette.error.main, 0.045)
            : tone === "success"
              ? alpha(theme.palette.success.main, 0.045)
              : alpha(theme.palette.text.primary, 0.018),
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", fontWeight: 700, letterSpacing: 0.45, textTransform: "uppercase" }}
      >
        {label}
      </Typography>
      <Typography
        variant="h6"
        sx={{ mt: 0.5, color: toneColor, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}
      >
        {formatCurrency(value)}
      </Typography>
      {helper && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
          {helper}
        </Typography>
      )}
    </Box>
  );
};

const CategoryCeiling = ({ label, actual, cap }) => {
  const variance = roundMoney(cap - actual);
  const isOver = variance < -CURRENCY_TOLERANCE;
  const isAligned = Math.abs(variance) <= CURRENCY_TOLERANCE;
  const utilization = getUtilization(actual, cap);
  const progressColor = isOver ? "error" : isAligned ? "success" : "primary";

  return (
    <Box
      sx={{
        height: "100%",
        p: 1.5,
        border: 1,
        borderColor: isOver ? "error.light" : "divider",
        bgcolor: (theme) => (isOver ? alpha(theme.palette.error.main, 0.035) : "transparent"),
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={1}>
        <Typography variant="body2" sx={{ fontWeight: 750 }}>
          {label}
        </Typography>
        <Typography
          variant="caption"
          color={isOver ? "error.main" : isAligned ? "success.main" : "text.secondary"}
          sx={{ fontWeight: 700, whiteSpace: "nowrap" }}
        >
          {isOver
            ? `${formatCurrency(Math.abs(variance))} over`
            : isAligned
              ? "Aligned"
              : `${formatCurrency(variance)} remaining`}
        </Typography>
      </Stack>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mt: 0.75, mb: 1, fontVariantNumeric: "tabular-nums" }}
      >
        <Box component="span" sx={{ color: "text.primary", fontWeight: 700 }}>
          {formatCurrency(actual)}
        </Box>{" "}
        of {formatCurrency(cap)}
      </Typography>
      <LinearProgress
        variant="determinate"
        value={Math.min(Math.max(utilization, 0), 100)}
        color={progressColor}
        aria-label={`${label} ceiling utilization`}
        sx={{ height: 5, bgcolor: (theme) => alpha(theme.palette.text.primary, 0.08) }}
      />
    </Box>
  );
};

const StickyCeilingTracker = ({
  currentAllocation,
  approvedCeiling,
  remaining,
  utilization,
  isAligned,
  isTotalOver,
  hasAnyViolation,
  hasCategoryViolation,
  hasUnsavedChanges,
  statusLabel,
}) => {
  const stateColor = hasAnyViolation ? "error" : isAligned ? "success" : "primary";
  const progressColor = hasAnyViolation ? "error" : isAligned ? "success" : "primary";
  const needsCategoryAdjustment = hasCategoryViolation && !isTotalOver;
  const actionLabel = isTotalOver
    ? "Amount to Reduce"
    : needsCategoryAdjustment
      ? "Allocation Action"
      : isAligned
        ? "Alignment"
        : "Remaining Capacity";
  const actionValue = isTotalOver
    ? formatCurrency(Math.abs(remaining))
    : needsCategoryAdjustment
      ? isAligned
        ? "Total aligned"
        : `${formatCurrency(remaining)} total capacity`
      : isAligned
        ? "Ceiling aligned"
        : formatCurrency(remaining);

  return (
    <Paper
      component="aside"
      variant="outlined"
      aria-label="Live NEP ceiling adjustment tracker"
      sx={{
        position: "sticky",
        top: { xs: 68, md: 76 },
        zIndex: (theme) => theme.zIndex.appBar - 1,
        mt: 1.25,
        mb: 2.25,
        px: { xs: 1.25, md: 1.5 },
        py: 1.15,
        bgcolor: "background.paper",
        borderColor: hasAnyViolation
          ? "error.main"
          : isAligned
            ? "success.main"
            : "primary.main",
        borderLeftWidth: 4,
        boxShadow: (theme) => `0 5px 18px ${alpha(theme.palette.common.black, 0.1)}`,
      }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "repeat(2, minmax(0, 1fr))",
            md: "minmax(170px, 0.9fr) repeat(2, minmax(145px, 0.8fr)) minmax(210px, 1.1fr) minmax(170px, 0.9fr)",
          },
          columnGap: { xs: 1.5, md: 2 },
          rowGap: 1,
          alignItems: "center",
        }}
      >
        <Box sx={{ gridColumn: { xs: "1 / -1", md: "auto" }, minWidth: 0 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", fontWeight: 800, letterSpacing: 0.55 }}
          >
            LIVE CEILING TRACKER
          </Typography>
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 0.5 }}>
            <Chip
              size="small"
              color={stateColor}
              variant={hasAnyViolation ? "filled" : "outlined"}
              label={statusLabel}
              sx={{ height: 23, fontWeight: 750 }}
            />
            {hasUnsavedChanges && (
              <Chip
                size="small"
                color="warning"
                label="Unsaved live values"
                sx={{ height: 23, fontWeight: 750 }}
              />
            )}
          </Stack>
        </Box>

        {[
          ["Current Tier Allocation", formatCurrency(currentAllocation)],
          ["Approved NEP Ceiling", formatCurrency(approvedCeiling)],
        ].map(([label, value]) => (
          <Box key={label} sx={{ minWidth: 0 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", fontWeight: 700, letterSpacing: 0.35, textTransform: "uppercase" }}
            >
              {label}
            </Typography>
            <Typography
              variant="body2"
              title={value}
              sx={{
                mt: 0.15,
                overflow: "hidden",
                fontWeight: 750,
                fontVariantNumeric: "tabular-nums",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {value}
            </Typography>
          </Box>
        ))}

        <Box sx={{ gridColumn: { xs: "1 / -1", md: "auto" }, minWidth: 0 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase" }}
          >
            {actionLabel}
          </Typography>
          <Typography
            variant="subtitle1"
            color={hasAnyViolation ? "error.main" : isAligned ? "success.main" : "primary.main"}
            sx={{
              mt: 0.05,
              fontWeight: 850,
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1.25,
            }}
          >
            {actionValue}
          </Typography>
          {needsCategoryAdjustment && (
            <Typography variant="caption" color="error.main" sx={{ display: "block", fontWeight: 700 }}>
              Category adjustment required
            </Typography>
          )}
        </Box>

        <Box sx={{ gridColumn: { xs: "1 / -1", md: "auto" }, minWidth: 0 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={1}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
              UTILIZATION
            </Typography>
            <Typography
              variant="caption"
              color={hasAnyViolation ? "error.main" : "text.secondary"}
              sx={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}
            >
              {formatPercent(utilization)}
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={Math.min(Math.max(utilization, 0), 100)}
            color={progressColor}
            aria-label={`NEP ceiling utilization: ${formatPercent(utilization)}`}
            sx={{ mt: 0.55, height: 6, bgcolor: (theme) => alpha(theme.palette.text.primary, 0.09) }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.3 }}>
            Live as Income and Subsidy change
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
};

const NEPCeilingSummary = ({
  proposal,
  liveTotals = null,
  hasUnsavedChanges = false,
  showStickyTracker = false,
  onReportContextChange,
  readOnly = false,
  isActiveCycle = true,
}) => {
  const proposalId = proposal?._id;
  const isNep = String(proposal?.modelType || proposal?.budgetType || "").toUpperCase() === "NEP";

  const { data, isLoading, error } = useQuery({
    queryKey: ["nepCeilingContext", String(proposalId || "")],
    queryFn: async () => {
      const response = await api.get(`/api/budget-ceiling/proposal/${proposalId}`);
      return response?.data?.data;
    },
    enabled: isNep && Boolean(proposalId),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  const compliance = useMemo(
    () => buildLiveCompliance(liveTotals, data?.compliance),
    [liveTotals, data?.compliance]
  );
  const readiness = useMemo(
    () => getNepReportReadiness({ compliance, hasUnsavedChanges }),
    [compliance, hasUnsavedChanges]
  );

  useEffect(() => {
    if (!onReportContextChange) return;
    if (!data || !compliance) {
      onReportContextChange(null);
      return;
    }
    onReportContextChange({
      initial: data.initial,
      ceiling: data.ceiling,
      compliance,
      readiness,
      fiscalYear: data.fiscalYear,
      allocationId: data.allocationId,
      ceilingId: data.ceilingId,
    });
  }, [compliance, data, onReportContextChange, readiness]);

  if (!isNep) return null;

  if (isLoading) {
    return (
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <CircularProgress size={20} />
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              Loading NEP ceiling alignment
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Checking the approved BRD ceiling and saved Tier values…
            </Typography>
          </Box>
        </Box>
      </Paper>
    );
  }

  if (error || !data) {
    return (
      <Alert severity="warning">
        <AlertTitle>NEP ceiling unavailable</AlertTitle>
        {error?.response?.data?.message ||
          "The approved BRD ceiling for this NEP proposal could not be loaded."}
      </Alert>
    );
  }

  const currentAllocation = Number(compliance.actual?.proposedBudget || 0);
  const currentSubsidy = Number(compliance.actual?.projectedSubsidy || 0);
  const currentIncome = Math.max(0, currentAllocation - currentSubsidy);
  const approvedCeiling = Number(compliance.caps?.totalExpenses || data.ceiling?.amount || 0);
  const remaining = Number(compliance?.remaining?.totalExpenses || 0);
  const isAligned = Math.abs(remaining) <= CURRENCY_TOLERANCE;
  const isTotalOver = remaining < -CURRENCY_TOLERANCE;
  const hasAnyViolation =
    !isAligned || Number(compliance.violations?.length || 0) > 0;
  const hasCategoryViolation = Boolean(
    compliance.violations?.some((violation) => violation.field !== "totalExpenses")
  );
  const utilization = getUtilization(currentAllocation, approvedCeiling);
  const statusLabel = hasAnyViolation
    ? isTotalOver
      ? "ABOVE CEILING"
      : "BELOW CEILING"
    : isAligned
      ? "MATCHED"
      : "BELOW CEILING";
  const varianceLabel = isAligned
    ? "Ceiling Aligned"
    : isTotalOver
      ? "Amount to Reduce"
      : "Remaining Capacity";
  const stateColor = hasAnyViolation ? "error" : "success";
  const detailRows = [
    ["Personnel Services", "personnelServices"],
    ["MOOE", "mooe"],
    ["Capital Outlay", "capitalOutlay"],
  ];

  return (
    <>
      <Paper
      component="section"
      variant="outlined"
      aria-labelledby="nep-ceiling-alignment-title"
      sx={{
        p: { xs: 2, md: 2.5 },
        borderColor: hasAnyViolation ? "error.light" : "divider",
        boxShadow: (theme) => `0 8px 24px ${alpha(theme.palette.common.black, 0.045)}`,
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        spacing={1.5}
      >
        <Box>
          <Typography id="nep-ceiling-alignment-title" variant="h6" sx={{ fontWeight: 800 }}>
            NEP Ceiling Alignment
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {readOnly
              ? isActiveCycle
                ? "Review the approved Target Ceiling and saved Income/Subsidy allocation."
                : "Review the Target Ceiling and saved Income/Subsidy allocation. This proposal is outside the active NEP cycle and is read-only."
              : liveTotals
              ? "Unsaved Income/Subsidy edits are shown live. Save only after the total matches the Target Ceiling."
              : "Income plus Subsidy must exactly match the Target Ceiling before submission."}
          </Typography>
        </Box>
        <Chip
          size="small"
          color={stateColor}
          variant={hasAnyViolation ? "filled" : "outlined"}
          label={statusLabel}
          sx={{ fontWeight: 750 }}
        />
      </Stack>

      <Grid container spacing={1.25} sx={{ mt: 1 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <FinancialMetric label="Initial Request" value={data.initial?.amount} helper="Read-only baseline" />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <FinancialMetric
            label="Target Ceiling"
            value={approvedCeiling}
            tone="success"
            helper="Approved by BRD"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <FinancialMetric
            label="Current NEP Total"
            value={currentAllocation}
            tone={isTotalOver ? "error" : "neutral"}
            helper={hasUnsavedChanges ? "Includes unsaved edits" : "Income + Subsidy"}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <FinancialMetric
            label={varianceLabel}
            value={Math.abs(remaining)}
            tone={isTotalOver ? "error" : "success"}
            helper={
              isAligned && hasAnyViolation
                ? "Total aligned; a category still exceeds its limit"
                : isAligned
                  ? "Exact match with approved ceiling"
                  : "Against approved ceiling"
            }
          />
        </Grid>
      </Grid>

      <Grid container spacing={1.25} sx={{ mt: 0 }}>
        <Grid item xs={12} sm={6}>
          <FinancialMetric label="Current Income" value={currentIncome} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <FinancialMetric label="Current Subsidy" value={currentSubsidy} />
        </Grid>
      </Grid>

      <Box sx={{ mt: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={2}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
            CEILING UTILIZATION
          </Typography>
          <Typography
            variant="body2"
            color={isTotalOver ? "error.main" : isAligned ? "success.main" : "text.secondary"}
            sx={{ fontWeight: 750, fontVariantNumeric: "tabular-nums", textAlign: "right" }}
          >
            {formatPercent(utilization)} utilized
            {isTotalOver ? ` · ${formatCurrency(Math.abs(remaining))} over` : ""}
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={Math.min(Math.max(utilization, 0), 100)}
          color={isTotalOver ? "error" : isAligned ? "success" : "primary"}
          aria-label="Total NEP ceiling utilization"
          sx={{ mt: 0.75, height: 8, bgcolor: (theme) => alpha(theme.palette.text.primary, 0.08) }}
        />
      </Box>

      {liveTotals && (
        <Box
          sx={{
            mt: 2,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 1,
            py: 1.25,
            px: 1.5,
            borderTop: 1,
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          {[
            ["Income", liveTotals.projectedCorporateIncome ?? liveTotals.corporateIncome],
            ["Subsidy", liveTotals.projectedSubsidy ?? liveTotals.subsidies],
            ["NEP Total", liveTotals.proposedBudget],
          ].map(([label, value]) => (
            <Box key={label}>
              <Typography variant="caption" color="text.secondary">
                {label}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 750, fontVariantNumeric: "tabular-nums" }}>
                {formatCurrency(value)}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {compliance.hasDetailedCeiling && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 750 }}>
            Expense category limits
          </Typography>
          <Grid container spacing={1.25}>
            {detailRows.map(([label, key]) => (
              <Grid item xs={12} md={4} key={key}>
                <CategoryCeiling
                  label={label}
                  actual={Number(compliance.actual?.[key] || 0)}
                  cap={Number(compliance.caps?.[key] || 0)}
                />
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {hasAnyViolation ? (
        <Alert severity="error" sx={{ mt: 2 }}>
          <AlertTitle>
            {readOnly ? "Saved allocation exceeds the approved ceiling" : "Submission remains blocked"}
          </AlertTitle>
          {readOnly
            ? isActiveCycle
              ? "Use NEP Tier Adjustment when the action is available to correct the saved allocation."
              : "The saved allocation is shown for reference. Adjustment becomes available when this proposal's NEP fiscal year is the active budget cycle."
            : "Adjust Income and Subsidy until their total exactly matches the Target Ceiling."}
          {compliance.violations?.length > 0 && (
            <Box component="ul" sx={{ mt: 0.75, mb: 0, pl: 2.25 }}>
              {compliance.violations.map((violation) => (
                <li key={violation.field}>
                  <Typography variant="body2" component="span">
                    {FIELD_LABELS[violation.field] || "Allocation"} exceeds its approved ceiling.
                  </Typography>
                </li>
              ))}
            </Box>
          )}
        </Alert>
      ) : (
        <Alert severity={isAligned ? "success" : "info"} sx={{ mt: 2 }}>
          <AlertTitle>{isAligned ? "Income and Subsidy match the Target Ceiling" : "Submission is blocked"}</AlertTitle>
          {readOnly
            ? isActiveCycle
              ? "Saved Income and Subsidy are shown for reference."
              : "Saved values are read-only outside the active NEP budget cycle."
            : hasUnsavedChanges
            ? "This is a live preview. Save the values before submission."
            : "The saved Income and Subsidy will be validated again by the server on submission."}
        </Alert>
      )}

      {data.assignedPreparerNames?.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.25 }}>
          Assigned Budget Preparer{data.assignedPreparerNames.length > 1 ? "s" : ""}: {" "}
          {data.assignedPreparerNames.join(", ")}
        </Typography>
      )}
      </Paper>
      {showStickyTracker && (
        <StickyCeilingTracker
          currentAllocation={currentAllocation}
          approvedCeiling={approvedCeiling}
          remaining={remaining}
          utilization={utilization}
          isAligned={isAligned}
          isTotalOver={isTotalOver}
          hasAnyViolation={hasAnyViolation}
          hasCategoryViolation={hasCategoryViolation}
          hasUnsavedChanges={hasUnsavedChanges}
          statusLabel={statusLabel}
        />
      )}
    </>
  );
};

export default NEPCeilingSummary;
