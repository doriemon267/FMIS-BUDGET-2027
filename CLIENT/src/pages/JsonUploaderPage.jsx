import React, { useState } from "react";
import { Box, Typography, Paper, Grid, Card, CardContent, CardActionArea } from "@mui/material";
import DashboardHeader from "../global/components/DashboardHeader";
import JsonUploaderDialog from "../components/jsonuploader/JsonUploaderDialog";
import UploadFileIcon from "@mui/icons-material/UploadFile";

const JsonUploaderPage = () => {
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleOpenDialog = () => {
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
  };

  return (
    <>
      <DashboardHeader
        title="JSON Uploader"
        description="Upload JSON files to MongoDB collections"
        searchable={false}
      />
      
      <Box sx={{ p: 3 }}>
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            JSON Data Import Tool
          </Typography>
          <Typography variant="body2" paragraph>
            Use this tool to upload JSON data directly into MongoDB collections. 
            Select the target collection and upload a properly formatted JSON file.
          </Typography>
          
          <Grid container spacing={3} sx={{ mt: 2 }}>
            <Grid item xs={12} sm={6} md={4}>
              <Card>
                <CardActionArea onClick={handleOpenDialog}>
                  <CardContent sx={{ textAlign: "center", py: 4 }}>
                    <UploadFileIcon sx={{ fontSize: 60, color: "primary.main", mb: 2 }} />
                    <Typography variant="h6">Upload JSON File</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Import data from JSON file
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          </Grid>
        </Paper>
      </Box>
      
      <JsonUploaderDialog 
        open={dialogOpen} 
        onClose={handleCloseDialog} 
      />
    </>
  );
};

export default JsonUploaderPage;