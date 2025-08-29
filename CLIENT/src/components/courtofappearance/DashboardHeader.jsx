import { Box, Typography } from "@mui/material";
import React from "react";
import TableSearchBar from "../../global/components/TableSearchBar";

const DashboardHeader = ({
  title = "Dashboard",
  description = "",
  searchable = false,
  childElement,
}) => {
  return (
    <Box
      sx={{
        pt: 1.8,
        pb: 2,
        px: 3,
        boxShadow: 2,
        color: "white",
        backgroundImage:
          "linear-gradient(to right, rgba(55, 94, 56, 0.9) 60%, rgba(55, 94, 56, 0.7) 100%)",
      }}
    >
      <Box display="flex" justifyContent="space-between" alignItems="end">
        <Box>
          <Typography variant="h4" fontWeight="bold">
            {title}
          </Typography>
          {description && (
            <Typography variant="body2">{description}</Typography>
          )}
        </Box>
        <Box display="flex" gap={2}>
          {childElement}
          {searchable ? <TableSearchBar /> : undefined}
        </Box>
      </Box>
    </Box>
  );
};

export default DashboardHeader;
