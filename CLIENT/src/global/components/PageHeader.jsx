import React from "react";
import { Box, Typography } from "@mui/material";
import PropTypes from "prop-types";

const PageHeader = ({ title, subtitle, children }) => {
  return (
    <Box
      sx={{
        pt: 1.8,
        pb: 2,
        px: 3,
        mb: 3,
        boxShadow: 2,
        color: "white",
        backgroundImage:
          "linear-gradient(to right, rgba(55, 94, 56, 0.9) 60%, rgba(55, 94, 56, 0.7) 100%)",
      }}
    >
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="h4" fontWeight="bold">
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2">{subtitle}</Typography>
          )}
        </Box>
        {children && <Box>{children}</Box>}
      </Box>
    </Box>
  );
};

PageHeader.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  children: PropTypes.node,
};

export default PageHeader;