import React, { useState } from "react";
import {
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  CircularProgress,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import api from "../../config/api";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";

const ApproveProposalDialog = ({ row, parentClose, refreshData }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const handleApprove = async () => {
    setLoading(true);
    try {
      await api.put(`/approve`, {
        fiscalYear: row.fiscalYear,
        budgetType: row.budgetType,
        processBy: row.processBy,
        region: row.region,
        approvedDate: new Date(),
      });
      toast.success("Proposal approved successfully.");
      await queryClient.invalidateQueries(["proposals"]);
      refreshData?.(); // Trigger table refresh
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to approve proposal.");
    } finally {
      setLoading(false);
      setOpen(false);
      parentClose?.();
    }
  };

  return (
    <>
      <MenuItem onClick={() => setOpen(true)} disabled={loading}>
        <ListItemIcon>
          {loading ? <CircularProgress size={20} /> : <CheckCircleIcon fontSize="small" color="success" />}
        </ListItemIcon>
        <ListItemText>Approve</ListItemText>
      </MenuItem>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>Approve Proposal</DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            Are you sure you want to approve this proposal?
          </Typography>
          <Typography variant="body2" sx={{ mt: 2 }}>
            <strong>Process By:</strong> {row.processBy}<br />
            <strong>Region:</strong> {row.region}<br />
            <strong>Fiscal Year:</strong> {row.fiscalYear}<br />
            <strong>Budget Type:</strong> {row.budgetType}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleApprove}
            color="success"
            variant="contained"
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} /> : "Approve"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ApproveProposalDialog;