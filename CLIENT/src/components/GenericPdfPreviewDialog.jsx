import React from 'react';
import {
  Dialog,
  DialogContent,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Button,
  Box,
  CircularProgress
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

const GenericPdfPreviewDialog = ({
  open,
  onClose,
  pdfUrl,
  title = "PDF Preview",
  downloadFilename = "document.pdf"
}) => {
  const handleDownload = () => {
    if (!pdfUrl) return;
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = downloadFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog
      fullScreen
      open={open}
      onClose={onClose}
    >
      <AppBar sx={{ position: "relative" }}>
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={onClose} aria-label="close">
            <CloseIcon />
          </IconButton>
          <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
            {title}
          </Typography>
          <Button 
            autoFocus 
            color="inherit" 
            onClick={handleDownload}
            disabled={!pdfUrl}
          >
            Download
          </Button>
        </Toolbar>
      </AppBar>
      <DialogContent sx={{ p: 0, bgcolor: "#525659", height: "100%" }}>
        {pdfUrl ? (
          <iframe
            title={title}
            src={pdfUrl}
            style={{ width: "100%", height: "100%", border: "none" }}
          />
        ) : (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
            <CircularProgress />
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default GenericPdfPreviewDialog;
