import React from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from "@mui/material";
import CompensationSettingsForm from "./CompensationSettingsForm";

const CompensationSettingsDialog = ({ open, onCloseDialog, fiscalYear, editData }) => {
  return (
    <Dialog open={open} onClose={onCloseDialog} maxWidth="md" fullWidth>
      <DialogTitle>
        {editData ? "Update Compensation Settings" : "Add Compensation Settings"}
      </DialogTitle>
      <DialogContent dividers>
        <CompensationSettingsForm
          fiscalYear={fiscalYear}
          onSaved={onCloseDialog}
          onCancel={onCloseDialog}
          editData={editData}
        />
      </DialogContent>
      {/* Optionally include dialog actions here if not handled inside the form */}
      {/* <DialogActions>
        <Button onClick={onCloseDialog} variant="outlined">Close</Button>
      </DialogActions> */}
    </Dialog>
  );
};

export default CompensationSettingsDialog;
