import React, { useState } from "react";
import { Button, Menu, MenuItem } from "@mui/material";
import { MdEdit, MdDelete } from "react-icons/md";
import AddSettingsDialog from "../../components/settings/CompensationSettingsForm";

const ProposalActionsButton = ({ row }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleEdit = () => {
    setIsDialogOpen(true);
    handleMenuClose(); // Awtomatikong isara ang menu
  };

  const handleDelete = () => {
    // Ilagay dito ang delete functionality
    handleMenuClose(); // Awtomatikong isara ang menu
  };

  return (
    <>
      <Button variant="contained" color="primary" onClick={handleMenuOpen}>
        Actions
      </Button>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
        <MenuItem onClick={handleEdit} disableRipple>
          <MdEdit /> Edit
        </MenuItem>
        <MenuItem onClick={handleDelete} disableRipple>
          <MdDelete /> Delete
        </MenuItem>
      </Menu>

      {isDialogOpen && (
        <AddSettingsDialog
          row={row}
          open={isDialogOpen}
          onCloseDialog={() => setIsDialogOpen(false)}
        />
      )}
    </>
  );
};

export default ProposalActionsButton;
