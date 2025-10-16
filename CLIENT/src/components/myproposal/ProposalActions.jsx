import React, { useState } from "react";
import { useUser } from "../../context/UserContext";
import { hasPermission, PERMISSIONS } from "../../utils/permissions";
import {
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
} from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import api from "../../config/api";
import toast from "react-hot-toast";
import ProposalDetailsDialog from "./ProposalDetailsDialog";
import { goTo } from "../../global/navigation";

export function ViewMenuItem({ row, parentClose }) {
  const [open, setOpen] = useState(false);

  const handleView = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <>
      <MenuItem onClick={handleView}>
        <ListItemIcon>
          <VisibilityIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>View Details</ListItemText>
      </MenuItem>

      <ProposalDetailsDialog
        open={open}
        onClose={handleClose}
        proposal={row}
      />
    </>
  );
}

export function ApproveMenuItem({ row, parentClose, refreshData }) {
  const [open, setOpen] = useState(false);
  const { currentUser } = useUser();
  const canApprove = hasPermission(currentUser, PERMISSIONS.APPROVE);
  if (!canApprove) return null;

  const handleApprove = async () => {
    try {
      await api.put(`/proposals/${row._id}`, { status: "Finalized" });
      toast.success("Proposal approved.");
      try {
        if (typeof window !== 'undefined' && window.showSuccess) {
          window.showSuccess('Proposal approved. Click to view All Proposals.', 8000, () => {
            goTo('/AllProposals');
          });
        }
      } catch (_) {}
      refreshData?.();
    } catch (err) {
      console.error(err);
      toast.error("Failed to approve.");
    } finally {
      setOpen(false);
      parentClose();
    }
  };

  return (
    <>
      <MenuItem onClick={() => setOpen(true)}>
        <ListItemIcon>
          <CheckCircleIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>Approve</ListItemText>
      </MenuItem>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>Approve Proposal</DialogTitle>
        <DialogContent>
          Are you sure you want to approve this proposal?
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleApprove} color="success" variant="contained">
            Approve
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export function RejectMenuItem({ row, parentClose, refreshData }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  const handleReject = async () => {
    try {
      // Para sa grouped proposals, tawagin ang group rejection endpoint
      await api.put(`/rejectAllProposals`, {
        fiscalYear: row.fiscalYear,
        budgetType: row.budgetType,
        processBy: row.processBy,
        region: row.region,
        reason,
      });
      toast.success("Proposal rejected.");
      try {
        if (typeof window !== 'undefined' && window.showWarning) {
          window.showWarning('Proposal rejected. Click to view All Proposals.', 8000, () => {
            goTo('/AllProposals');
          });
        }
      } catch (_) {}
      refreshData?.();
    } catch (err) {
      console.error(err);
      toast.error("Failed to reject.");
    } finally {
      setOpen(false);
      parentClose();
    }
  };

  return (
    <>
      <MenuItem onClick={() => setOpen(true)}>
        <ListItemIcon>
          <CancelIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>Reject</ListItemText>
      </MenuItem>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>Reject Proposal</DialogTitle>
        <DialogContent>
          <div>Are you sure you want to reject this proposal?</div>
          <TextField
            autoFocus
            margin="dense"
            label="Rejection Reason"
            type="text"
            fullWidth
            variant="standard"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleReject} color="error" variant="contained">
            Reject
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
 