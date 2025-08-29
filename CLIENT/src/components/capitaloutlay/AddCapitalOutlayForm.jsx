import React, { useState } from "react";
import { Dialog, DialogActions, DialogContent, DialogTitle, TextField, Button, MenuItem } from "@mui/material";

const AddCapitalOutlayForm = ({ categories, onAddOutlay, open, onClose }) => {
  const [title, setTitle] = useState("");
  const [particulars, setParticulars] = useState("");
  const [cost, setCost] = useState("");
  const [category, setCategory] = useState("");

  const handleSubmit = () => {
    const newOutlay = {
      title,
      particulars,
      cost: parseFloat(cost),
      category, // Ensure category is a string representing the category ID
    };
    onAddOutlay(newOutlay);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Add New Capital Outlay</DialogTitle>
      <DialogContent>
        <TextField
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          fullWidth
          margin="normal"
        />
        <TextField
          label="Particulars"
          value={particulars}
          onChange={(e) => setParticulars(e.target.value)}
          fullWidth
          margin="normal"
        />
        <TextField
          label="Cost"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          type="number"
          fullWidth
          margin="normal"
        />
        <TextField
          label="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          select
          fullWidth
          margin="normal"
        >
          {categories.map((cat) => (
            <MenuItem key={cat._id} value={cat._id}>
              {cat.categoryName}
            </MenuItem>
          ))}
        </TextField>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">
          Cancel
        </Button>
        <Button onClick={handleSubmit} color="primary">
          Add
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddCapitalOutlayForm;