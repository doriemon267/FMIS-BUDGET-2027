import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  useMediaQuery,
  CircularProgress,
  Box,
  IconButton,
  AppBar,
  Toolbar,
  Typography
} from '@mui/material';
import { PDFViewer, PDFDownloadLink } from '@react-pdf/renderer';
import PDFReportDocument from './PDFReportDocument';
import { useTheme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';

export default function ViewReportDialog({ open, onClose, data }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
  const [loading, setLoading] = useState(true);

  // Reset loading state when dialog opens or data changes
  useEffect(() => {
    if (open) {
      setLoading(true);
      // Add a fallback timer to hide loading after 5 seconds
      // in case the onLoadSuccess doesn't trigger
      const timer = setTimeout(() => {
        setLoading(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [open, data]);

  if (!data) return null;

  const { fiscalYear, psSummary, mooe, co, isFinalized } = data;
  
  // Handle PDF loading state
  const handlePDFLoadSuccess = () => {
    setLoading(false);
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
            Consolidated Report Preview
          </Typography>
          <PDFDownloadLink
            document={
              <PDFReportDocument
                fiscalYear={fiscalYear}
                psSummary={psSummary}
                mooe={mooe}
                co={co}
                isFinalized={isFinalized}
              />
            }
            fileName={`NIA_Budget_Report_FY${fiscalYear}.pdf`}
            style={{ textDecoration: 'none' }}
          >
            {({ loading: downloadLoading }) => (
              <Button
                variant="outlined"
                color="inherit"
                startIcon={<DownloadIcon />}
                disabled={downloadLoading}
                sx={{ borderColor: 'rgba(255,255,255,0.7)', '&:hover': { borderColor: 'white', backgroundColor: 'rgba(255,255,255,0.1)' } }}
              >
                {downloadLoading ? 'Preparing...' : 'Download PDF'}
              </Button>
            )}
          </PDFDownloadLink>
        </Toolbar>
      </AppBar>

      <DialogContent sx={{ p: 0, bgcolor: "#525659", height: "100%", position: 'relative', overflow: 'hidden' }}>
        {loading && (
          <Box sx={{ 
            position: 'absolute', 
            top: '50%', 
            left: '50%', 
            transform: 'translate(-50%, -50%)',
            zIndex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            color: 'white'
          }}>
            <CircularProgress color="inherit" />
            <Box sx={{ mt: 2 }}>Loading PDF...</Box>
          </Box>
        )}
        
        <PDFViewer 
          width="100%" 
          height="100%" 
          style={{ border: 'none' }}
          onRender={handlePDFLoadSuccess}
        >
          <PDFReportDocument
            fiscalYear={fiscalYear}
            psSummary={psSummary}
            mooe={mooe}
            co={co}
            isFinalized={isFinalized}
          />
        </PDFViewer>
      </DialogContent>
    </Dialog>
  );
}
