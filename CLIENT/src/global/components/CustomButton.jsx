import React from "react";
import { Button, CircularProgress, Box } from "@mui/material";

// plain is saying just button no loading or variant
const CustomButton = ({
  loading,
  loadingText = "",
  type = "button",
  children,
  plain,
  sx,
  color = "primary",
  allow,
  ...props
}) => {
  return (
    <Button
      color={color}
      type={type}
      variant={plain ? "text" : "contained"}
      sx={{
        opacity: allow || loading ? 0.5 : 1,
        cursor: allow || loading ? "not-allowed" : "pointer",
        position: "relative",
        pointerEvents: allow || loading ? "none" : "auto", // Prevent clicks when loading
        ...sx,
      }}
      {...props}
    >
      {loading && !plain ? (
        <Box display="flex" alignItems="center">
          <CircularProgress size={20} sx={{ color: "white", mr: 1 }} />
          {loadingText || "Loading..."}
        </Box>
      ) : (
        children
      )}
    </Button>
  );
};

export default CustomButton;
