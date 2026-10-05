import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Alert,
  Box,
  Grid,
  Button,
  CircularProgress,
  LinearProgress,
  useTheme,
} from "@mui/material";
import { actionRequiresDigitalSignature } from "../../../../utils/digitalSignature";

const mapActionToBackend = (frontendAction) => {
  const actionMapping = {
    // Budget Preparer actions
    "submit-to-reviewer": "submit-to-reviewer",

    // Budget Reviewer actions
    "reviewer-approve-forward-approver": "submit-to-approver",
    "reviewer-approve-forward-analyst": "submit-to-analyst", // IMO path: skip Approver
    "reviewer-return": "return-to-preparer",
    "reviewer-save-edits": "reviewer-save-edits",

    // Budget Approver actions
    "approver-approve-forward-analyst": "submit-to-analyst",
    "approver-approve-forward-officer": "submit-to-analyst",
    "approver-return": "return-to-reviewer",
    "approver-save-edits": "approver-save-edits",

    // Budget Planning Analyst actions
    "analyst-submit-to-officer": "forward-to-officer",
    "analyst-return": "return-to-preparer",
    "analyst-save-edits": "analyst-save-edits",

    // Budget Officer actions
    "officer-approve": "forward-to-manager",
    "officer-return": "return-to-preparer",
    "officer-return-to-analyst": "return-to-analyst",
    "officer-save-edits": "officer-save-edits",
    "officer-submit-to-manager": "forward-to-manager",

    // Budget Manager actions
    "manager-approve": "finalize",
    "manager-return": "return-to-preparer",
    "manager-return-to-officer": "return-to-officer",
    "manager-save-edits": "manager-save-edits",
  };

  return actionMapping[frontendAction] || frontendAction;
};

const ActionConfirmDialog = ({
  open,
  onClose,
  actionType,
  actionComment,
  setActionComment,
  actionLoading,
  isSubmitToAnalystAction,
  analystsForProposal = [],
  targetAnalystId,
  setTargetAnalystId,
  signerMode,
  actionP12File,
  setActionP12File,
  actionP12Password,
  setActionP12Password,
  onConfirm,
}) => {
  const theme = useTheme();
  const headerBg = theme.palette.mode === "dark" ? "#0b2413" : "#2d5016";
  const titleColor = theme.palette.mode === "dark" ? "#a5d6a7" : "#2d5016";

  const handleClose = (_event, reason) => {
    if (actionLoading || reason === "backdropClick") return;
    onClose();
  };

  const isReturnAction = actionType?.includes("return");

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      disableEscapeKeyDown={actionLoading}
      aria-busy={actionLoading}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: "12px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
        },
      }}
    >
      <DialogTitle
        sx={{
          bgcolor: headerBg,
          color: "white",
          fontWeight: "bold",
          fontSize: "1.25rem",
        }}
      >
        Confirm Action
      </DialogTitle>
      <DialogContent sx={{ mt: 3 }}>
        <Typography variant="body1" sx={{ mb: 3, color: "text.primary", lineHeight: 1.6 }}>
          {isSubmitToAnalystAction && analystsForProposal.length > 0 ? (
            <>
              Approved and Forward to Central Office BRD
              {analystsForProposal.length > 1 && (
                <>
                  <FormControl fullWidth sx={{ mt: 2 }}>
                    <InputLabel>Select Analyst</InputLabel>
                    <Select
                      value={targetAnalystId || analystsForProposal[0]?.userId || ""}
                      onChange={(e) => setTargetAnalystId(e.target.value)}
                      label="Select Analyst"
                      disabled={actionLoading}
                    >
                      {analystsForProposal.map((a) => (
                        <MenuItem key={a.userId} value={a.userId}>
                          {a.userName} ({a.userId})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </>
              )}
            </>
          ) : (
            "Are you sure you want to perform this action on the proposal?"
          )}
        </Typography>
        <TextField
          fullWidth
          required={isReturnAction}
          disabled={actionLoading}
          label={isReturnAction ? "Comment (Required)" : "Comment (Optional)"}
          value={actionComment}
          onChange={(e) => setActionComment(e.target.value)}
          multiline
          rows={4}
          placeholder={
            isReturnAction
              ? "Provide feedback for returning the proposal..."
              : "Add any comments or notes for this action..."
          }
          sx={{
            "& .MuiOutlinedInput-root": {
              "&:hover fieldset": {
                borderColor: "#4a7c2c",
              },
              "&.Mui-focused fieldset": {
                borderColor: "#4a7c2c",
              },
            },
            "& .MuiInputLabel-root.Mui-focused": {
              color: "#4a7c2c",
            },
          }}
        />

        {actionType && actionRequiresDigitalSignature(mapActionToBackend(actionType)) && (
          <Box sx={{ mt: 2 }}>
            <Alert severity="warning">
              This action requires a digital signature. Signer mode: <strong>{signerMode}</strong>.
            </Alert>

            {signerMode === "p12" && (
              <Box
                sx={{
                  mt: 2,
                  p: 2,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                  bgcolor:
                    theme.palette.mode === "dark" ? "background.default" : "#fafafa",
                }}
              >
                <Typography
                  variant="subtitle2"
                  sx={{ mb: 1, fontWeight: "bold", color: titleColor }}
                >
                  Digital Signature (P12 Mode)
                </Typography>

                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Typography variant="caption" display="block" sx={{ mb: 0.5 }}>
                      Select your .p12 or .pfx certificate file:
                    </Typography>
                    <input
                      type="file"
                      accept=".p12,.pfx"
                      disabled={actionLoading}
                      onChange={(e) => {
                        const file = e.target.files[0];
                        setActionP12File(file);
                      }}
                      style={{ width: "100%" }}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      type="password"
                      label="Certificate Password"
                      size="small"
                      value={actionP12Password}
                      onChange={(e) => setActionP12Password(e.target.value)}
                      placeholder="Enter password..."
                      disabled={actionLoading}
                    />
                  </Grid>
                </Grid>
              </Box>
            )}
          </Box>
        )}
        {actionLoading && (
          <Box
            role="status"
            aria-live="polite"
            sx={{
              mt: 3,
              p: 2,
              borderRadius: 2,
              border: "1px solid",
              borderColor: theme.palette.mode === "dark" ? "#36523d" : "#dce7d2",
              bgcolor: theme.palette.mode === "dark" ? "#172b20" : "#f3f7ef",
            }}
          >
            <Typography variant="body2" sx={{ color: titleColor, fontWeight: 700, mb: 0.5 }}>
              Processing your request…
            </Typography>
            <Typography variant="caption" sx={{ display: "block", color: "text.secondary", mb: 1.5 }}>
              Please keep this window open while we process your proposal.
            </Typography>
            <LinearProgress
              aria-label="Processing proposal"
              sx={{
                height: 6,
                borderRadius: 3,
                bgcolor: theme.palette.mode === "dark" ? "#2d4935" : "#dce7d2",
                "& .MuiLinearProgress-bar": {
                  bgcolor: theme.palette.mode === "dark" ? "#a5d6a7" : "#456b2d",
                  borderRadius: 3,
                },
                "@media (prefers-reduced-motion: reduce)": {
                  "& .MuiLinearProgress-bar": {
                    animation: "none",
                    transform: "none",
                    width: "40%",
                  },
                },
              }}
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 3, gap: 1 }}>
        <Button
          onClick={handleClose}
          disabled={actionLoading}
          sx={{
            color: "#666",
            textTransform: "none",
            fontWeight: 600,
            px: 3,
            "&:hover": {
              bgcolor: "#f5f5f5",
            },
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          disabled={
            actionLoading ||
            (isReturnAction && !actionComment.trim()) ||
            (signerMode === "p12" &&
              actionType &&
              actionRequiresDigitalSignature(mapActionToBackend(actionType)) &&
              (!actionP12File || !actionP12Password))
          }
          sx={{
            bgcolor: headerBg,
            color: "white",
            textTransform: "none",
            fontWeight: 600,
            px: 3,
            boxShadow:
              theme.palette.mode === "dark"
                ? "0 2px 8px rgba(0,0,0,0.5)"
                : "0 2px 8px rgba(45,80,22,0.3)",
            "&:hover": {
              bgcolor: theme.palette.mode === "dark" ? "#14331d" : "#4a7c2c",
              boxShadow:
                theme.palette.mode === "dark"
                  ? "0 4px 12px rgba(0,0,0,0.6)"
                  : "0 4px 12px rgba(45,80,22,0.4)",
            },
            "&:disabled": {
              bgcolor: actionLoading ? headerBg : "#ccc",
              color: actionLoading ? "white" : "#666",
            },
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          {actionLoading && (
            <CircularProgress
              size={18}
              aria-hidden="true"
              sx={{
                color: "inherit",
                "@media (prefers-reduced-motion: reduce)": {
                  animation: "none",
                  "& .MuiCircularProgress-circle": { animation: "none" },
                },
              }}
            />
          )}
          {actionLoading ? "Processing..." : "Confirm Action"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ActionConfirmDialog;
