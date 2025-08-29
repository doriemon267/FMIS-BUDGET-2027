import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
} from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { MdDelete } from "react-icons/md";
import api from "../../config/api";

const CustomDeleteDialog = ({ row, endpoint, parentClose, dataListName }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      setLoading(true);
      try {
        const res = await api.delete(`${endpoint}/${row._id}`);
        toast.success(res.data.message, { duration: 4000 });
        return res.data.message;
      } catch (error) {
        toast.error(error.response?.data?.error || "Failed to delete test.", {
          duration: 4000,
        });
        throw error;
      } finally {
        setLoading(false);
      }
    },
  });

  const handleOpen = () => setIsOpen(true);
  const handleClose = () => setIsOpen(false);

  const handleDelete = () => {
    mutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries([dataListName]); // Refresh the test list
        handleClose();
        if (parentClose) parentClose(); // Close parent if needed
      },
    });
  };

  return (
    <div>
      {/* Delete button inside a menu item */}
      <MenuItem
        onClick={handleOpen}
        disableRipple
        sx={{ display: "flex", gap: 1, color: "red" }}
      >
        <MdDelete />
        Delete
      </MenuItem>

      {/* Confirmation dialog */}
      <Dialog open={isOpen} onClose={handleClose} maxWidth="xs" fullWidth>
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          Are you sure you want to delete?
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} color="error" disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            color="error"
            variant="contained"
            disabled={loading}
          >
            {loading ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default CustomDeleteDialog;
