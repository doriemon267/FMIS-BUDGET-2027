import React, { useState, useContext } from "react";
import {
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  CircularProgress,
} from "@mui/material";
import CancelIcon from "@mui/icons-material/Cancel";
import api from "../../config/api";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import { NotificationsContext } from "../../global/components/NotificationsContext";

const ReturnProposalDialog = ({ row, parentClose, refreshData }) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const { addNotification } = useContext(NotificationsContext) || {};
  const queryClient = useQueryClient();

  const handleReject = async () => {
    if (!reason.trim()) {
      toast.error("Please provide a reason for returning the proposal.");
      return;
    }
    setLoading(true);
    try {
      await api.put(`/rejectAllProposals`, {
        fiscalYear: row.fiscalYear,
        budgetType: row.budgetType,
        processBy: row.processBy,
        region: row.region,
        reason,
      });
      toast.success("Proposal returned successfully.");
      addNotification && addNotification({
        message: `Proposal returned: ${reason}`,
        type: "info",
      });
      await queryClient.invalidateQueries(["proposals"]);
      refreshData?.(); // Trigger table refresh
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to return proposal.");
    } finally {
      setLoading(false);
      setOpen(false);
      setReason("");
      parentClose?.();
    }
  };

  return (
    <>
      <MenuItem onClick={() => setOpen(true)} disabled={loading}>
        <ListItemIcon>
          {loading ? <CircularProgress size={20} /> : <CancelIcon fontSize="small" color="error" />}
        </ListItemIcon>
        <ListItemText>Return</ListItemText>
      </MenuItem>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Return Proposal</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Please state the reason for returning the proposal:
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            <strong>Process By:</strong> {row.processBy}<br />
            <strong>Region:</strong> {row.region}<br />
            <strong>Fiscal Year:</strong> {row.fiscalYear}<br />
            <strong>Budget Type:</strong> {row.budgetType}
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            label="Feedback / Reason for Return"
            type="text"
            fullWidth
            multiline
            rows={4}
            variant="outlined"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={loading}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleReject}
            color="error"
            variant="contained"
            disabled={loading || !reason.trim()}
          >
            {loading ? <CircularProgress size={20} /> : "Return"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ReturnProposalDialog;