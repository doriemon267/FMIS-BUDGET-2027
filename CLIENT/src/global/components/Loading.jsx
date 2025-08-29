import React from "react";
import { Box, Typography } from "@mui/material";
import { CircularProgress } from "@mui/material";

const Loading = () => {
  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      height="100vh"
      bgcolor="primary.main"
      flexDirection="column"
    >
      <Box position="relative" mb={2}>
        <img
          src="/2020-nia-logo.svg"
          alt="NIA Logo"
          style={{ height: "96px", width: "96px", position: "absolute" }}
        />
        <CircularProgress size={96} sx={{ color: "white" }} />
      </Box>
      <Typography variant="h6" color="white" fontWeight="bold">
        Loading, please wait...
      </Typography>
    </Box>
  );
};

export default Loading;
