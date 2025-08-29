// StickyButtons.js
import React from "react";
import { Box, Button } from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import ClearIcon from "@mui/icons-material/Clear";

const StickyButtons = ({ handleSave, handleClear, disabled }) => {
  return (
    <Box
      sx={{
        position: "sticky",
        top: "-1px",
        zIndex: 10,
        // backgroundColor: "white",
        p: -1,
        display: "flex",
        justifyContent: "flex-end",
        gap: 1,
      }}
    >
      <Button
        variant="outlined"
        onClick={handleSave}
        disabled={disabled}
        sx={{
          mr: 2,
          background: "#009688",
          color: "#fff",
          //  border: "thin solid #fff",
          "&:hover": {
            background: "#00796B",
            color: "#fff",
            textDecoration: "underline rgb(255, 255, 255)",
          },
        }}
        startIcon={<SaveIcon />}
      >
        Save
      </Button>

      <Button
        variant="outlined"
        onClick={handleClear}
        disabled={disabled}
        sx={{
          mr: 2,
          background: "#9E9E9E",
          color: "#fff",
          //  border: "thin solid #fff",
          "&:hover": {
            background: "#757575",
            color: "#fff",
            textDecoration: "underline rgb(255, 255, 255)",
          },
        }}
        startIcon={<ClearIcon />}
      >
        Clear
      </Button>
    </Box>
  );
};

export default StickyButtons;
