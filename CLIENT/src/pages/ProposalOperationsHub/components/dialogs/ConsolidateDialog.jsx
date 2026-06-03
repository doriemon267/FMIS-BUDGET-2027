import React, { useMemo } from "react";
import {
  Box,
  Button,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
} from "@mui/material";
import { ThumbDown as RejectIcon } from "@mui/icons-material";

const ConsolidateDialog = ({
  isBudgetApprover,
  selectedForMerge,
  setSelectedForMerge,
  filteredProposals = [],
  mergeDialogOpen,
  setMergeDialogOpen,
  mergeLoading,
  handleMergeProposals,
  unconsolidateDialogOpen,
  setUnconsolidateDialogOpen,
  unconsolidateLoading,
  handleUnconsolidate,
  selectedProposal,
}) => {
  const theme = useTheme();
  const headerBg = theme.palette.mode === "dark" ? "#0b2413" : "#2d5016";
  const titleColor = theme.palette.mode === "dark" ? "#a5d6a7" : "#2d5016";

  // Compute selected proposals for merge and total merge amount
  const selectedMergeProposals = useMemo(() => {
    return filteredProposals.filter((p) => selectedForMerge.has(p._id));
  }, [filteredProposals, selectedForMerge]);

  const totalMergeAmount = useMemo(() => {
    return selectedMergeProposals.reduce(
      (sum, p) => sum + (Number(p.amount) || Number(p.projectedSubsidy) || 0),
      0
    );
  }, [selectedMergeProposals]);

  return (
    <>
      {/* ── Consolidate Proposals floating toolbar ── */}
      {isBudgetApprover && selectedForMerge.size > 0 && (
        <Box
          sx={{
            position: "fixed",
            bottom: 28,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1400,
            bgcolor: "#1b3a1b",
            color: "#fff",
            borderRadius: "12px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
            px: 3,
            py: 1.5,
            display: "flex",
            alignItems: "center",
            gap: 2,
            minWidth: 340,
            animation: "slideUp 0.25s ease",
            "@keyframes slideUp": {
              from: { opacity: 0, transform: "translateX(-50%) translateY(20px)" },
              to: { opacity: 1, transform: "translateX(-50%) translateY(0)" },
            },
          }}
        >
          <Box sx={{ fontSize: "1.4rem" }}>🔗</Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 700, fontSize: "0.95rem" }}>
              {selectedForMerge.size} proposals selected
            </Typography>
            <Typography sx={{ fontSize: "0.78rem", opacity: 0.8 }}>
              Piliin ang "Consolidate" para pagsamahin bilang isang consolidated proposal
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            onClick={() => setSelectedForMerge(new Set())}
            sx={{
              color: "#fff",
              borderColor: "rgba(255,255,255,0.4)",
              textTransform: "none",
              fontSize: "0.8rem",
              "&:hover": { borderColor: "#fff", bgcolor: "rgba(255,255,255,0.1)" },
            }}
          >
            Alisin
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={() => setMergeDialogOpen(true)}
            disabled={selectedForMerge.size < 2}
            sx={{
              bgcolor: "#4caf50",
              color: "#fff",
              fontWeight: 700,
              textTransform: "none",
              fontSize: "0.85rem",
              px: 2.5,
              "&:hover": { bgcolor: "#388e3c" },
            }}
          >
            🔗 Consolidate Selected ({selectedForMerge.size})
          </Button>
        </Box>
      )}

      {/* ── Consolidate Confirmation Dialog ── */}
      <Dialog
        open={mergeDialogOpen}
        onClose={() => !mergeLoading && setMergeDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: "12px",
            boxShadow: "0 16px 48px rgba(0,0,0,0.25)",
          },
        }}
      >
        <DialogTitle
          sx={{
            bgcolor: "#1b3a1b",
            color: "#fff",
            fontWeight: 700,
            fontSize: "1.1rem",
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          🔗 I-consolidate ang mga Proposal
        </DialogTitle>
        <DialogContent sx={{ pt: 3, pb: 1 }}>
          <Typography variant="body2" sx={{ color: "#555", mb: 2 }}>
            Ang mga sumusunod na proposals ay pagsasamahin sa isang{" "}
            <strong>Consolidated Proposal</strong>. Ang mga ito ay mai-archive (status:
            MERGED) at hindi na mababago nang individual pagkatapos ng merge.
          </Typography>

          {selectedMergeProposals.map((p, i) => (
            <Box
              key={p._id}
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                px: 2,
                py: 1.2,
                mb: 1,
                bgcolor: i % 2 === 0 ? "#f8f9fa" : "#fff",
                borderRadius: "8px",
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <Box>
                <Typography
                  sx={{ fontWeight: 600, fontSize: "0.88rem", color: "text.primary" }}
                >
                  {p.responsibilityCenter || p.division || p.title || "Untitled"}
                </Typography>
                <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
                  {p.department && `${p.department} · `}FY{p.fiscalYear} ·{" "}
                  {p.budgetType || p.modelType}
                </Typography>
              </Box>
              <Typography
                sx={{
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  color: titleColor,
                  whiteSpace: "nowrap",
                  ml: 1,
                }}
              >
                ₱
                {(Number(p.amount) || Number(p.projectedSubsidy) || 0).toLocaleString(
                  "en-US",
                  {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }
                )}
              </Typography>
            </Box>
          ))}

          <Box
            sx={{
              mt: 2,
              px: 2,
              py: 1.5,
              bgcolor:
                theme.palette.mode === "dark"
                  ? "rgba(76, 175, 80, 0.15)"
                  : "#e8f5e9",
              borderRadius: "8px",
              border: "2px solid",
              borderColor: "success.main",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Typography sx={{ fontWeight: 700, color: titleColor }}>
              Kabuuang Halaga ng Consolidated Proposal:
            </Typography>
            <Typography sx={{ fontWeight: 800, color: titleColor, fontSize: "1.05rem" }}>
              ₱
              {totalMergeAmount.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </Typography>
          </Box>

          <Box
            sx={{
              mt: 2,
              p: 1.5,
              bgcolor: "#fff8e1",
              borderRadius: "8px",
              border: "1px solid #ffc107",
            }}
          >
            <Typography sx={{ fontSize: "0.8rem", color: "#795548" }}>
              ⚠️ <strong>Paalala:</strong> Ang consolidated na proposals ay mananatili sa
              listahan pero <strong>locked at CONSOLIDATED</strong> na ang status — hindi na
              sila maaaring i-submit nang hiwalay. Ang bagong Consolidated Proposal ay
              maaari mong i-submit sa BRD Planning Analyst.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, borderTop: "1px solid #e0e0e0", gap: 1 }}>
          <Button
            onClick={() => setMergeDialogOpen(false)}
            disabled={mergeLoading}
            sx={{
              color: "#666",
              textTransform: "none",
              fontWeight: 600,
            }}
          >
            Kanselahin
          </Button>
          <Button
            variant="contained"
            onClick={handleMergeProposals}
            disabled={mergeLoading || selectedForMerge.size < 2}
            startIcon={mergeLoading ? null : <span>🔗</span>}
            sx={{
              bgcolor: headerBg,
              color: "#fff",
              fontWeight: 700,
              textTransform: "none",
              px: 3,
              "&:hover": {
                bgcolor: theme.palette.mode === "dark" ? "#14331d" : "#1b3a1b",
              },
            }}
          >
            {mergeLoading
              ? "Kino-consolidate..."
              : `Kumpirmahin ang Consolidation (${selectedForMerge.size})`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Un-consolidate Confirmation Dialog */}
      <Dialog
        open={unconsolidateDialogOpen}
        onClose={() => !unconsolidateLoading && setUnconsolidateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: "12px" },
        }}
      >
        <DialogTitle
          sx={{
            bgcolor: "#fdf3f2",
            color: "#c62828",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: 1.5,
          }}
        >
          <RejectIcon />
          Kumpirmahin ang Paghihiwalay (Un-consolidate)
        </DialogTitle>
        <DialogContent sx={{ p: 3, pt: 4 }}>
          <Typography sx={{ mb: 2, fontSize: "0.95rem" }}>
            Sigurado ka ba na gusto mong i-<strong>unconsolidate</strong> ang proposal na
            ito?
          </Typography>
          <Box
            sx={{
              bgcolor: "#fff4e5",
              p: 2,
              borderRadius: "8px",
              border: "1px solid #ffcc80",
            }}
          >
            <Typography
              sx={{ fontSize: "0.85rem", color: "#ed6c02", fontWeight: 600, mb: 0.5 }}
            >
              Ano ang mangyayari?
            </Typography>
            <Typography sx={{ fontSize: "0.8rem", color: "#666" }}>
              Made-delete ang consolidated proposal na ito, at ang lahat ng original na
              pinagsamang proposals ay babalik nang hiwa-hiwalay sa iyong inbox (Forwarded
              to Approver) upang maaari mo silang i-review at aksyunan isa-isa.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, borderTop: "1px solid #e0e0e0", gap: 1 }}>
          <Button
            onClick={() => setUnconsolidateDialogOpen(false)}
            disabled={unconsolidateLoading}
            sx={{ color: "#666", textTransform: "none", fontWeight: 600 }}
          >
            Kanselahin
          </Button>
          <Button
            variant="contained"
            onClick={handleUnconsolidate}
            disabled={unconsolidateLoading}
            sx={{
              bgcolor: "#d32f2f",
              color: "#fff",
              fontWeight: 700,
              textTransform: "none",
              px: 3,
              "&:hover": { bgcolor: "#c62828" },
            }}
          >
            {unconsolidateLoading ? "Inaayos..." : "Oo, I-unconsolidate"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ConsolidateDialog;
