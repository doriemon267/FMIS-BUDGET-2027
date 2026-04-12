/**
 * Example Integration of BulkUploadModal in Capital Outlay Table Page
 * File: CLIENT/src/components/capitaloutlay/CapitalOutlayTableWithBulkUpload.jsx
 * 
 * This shows how to add the bulk upload feature to an existing table page
 */

import React, { useState } from "react";
import { Box, Button, Dialog } from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import GetAppIcon from "@mui/icons-material/GetApp";
import BulkUploadModal from "../common/BulkUploadModal";
import CapitalOutlayTable from "./CapitalOutlayTable"; // Your existing table component

/**
 * Wrapper component that adds bulk upload functionality to the table
 * Usage:
 * <CapitalOutlayTableWithBulkUpload />
 */
export const CapitalOutlayTableWithBulkUpload = () => {
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  /**
   * Handle successful upload by refreshing table data
   */
  const handleUploadSuccess = () => {
    console.log("Upload successful, refreshing table...");
    setShowBulkUpload(false);
    
    // Trigger table refresh by changing key
    setRefreshKey(prev => prev + 1);
    
    // Optional: You can also call a refresh function directly
    // if your table component has a ref with a refresh method
  };

  return (
    <Box sx={{ width: "100%", p: 2 }}>
      {/* Toolbar with Bulk Upload Button */}
      <Box
        sx={{
          display: "flex",
          gap: 2,
          mb: 2,
          flexWrap: "wrap",
          alignItems: "center"
        }}
      >
        <Button
          variant="contained"
          color="primary"
          startIcon={<CloudUploadIcon />}
          onClick={() => setShowBulkUpload(true)}
          sx={{
            backgroundColor: "#1976d2",
            "&:hover": {
              backgroundColor: "#1565c0"
            }
          }}
        >
          📊 Bulk Import Capital Outlay
        </Button>

        <Button
          variant="outlined"
          startIcon={<GetAppIcon />}
          onClick={() => {
            // Optional: Trigger export functionality
            console.log("Export Capital Outlay data");
          }}
        >
          Export to Excel
        </Button>
      </Box>

      {/* Your existing Capital Outlay Table */}
      <CapitalOutlayTable key={refreshKey} />

      {/* Bulk Upload Modal */}
      <Dialog
        open={showBulkUpload}
        onClose={() => setShowBulkUpload(false)}
        maxWidth="md"
        fullWidth
      >
        <BulkUploadModal
          tableType="capitalOutlay"
          onUploadSuccess={handleUploadSuccess}
        />
      </Dialog>
    </Box>
  );
};

export default CapitalOutlayTableWithBulkUpload;
