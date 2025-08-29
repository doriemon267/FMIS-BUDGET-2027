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
  IconButton
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

  const { fiscalYear, psSummary, mooe, co } = data;
  
  // Handle PDF loading state
  const handlePDFLoadSuccess = () => {
    setLoading(false);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={fullScreen}
      maxWidth={false}
      PaperProps={{
        sx: {
          width: '100vw',
          height: '100vh',
          maxWidth: '100vw',
          maxHeight: '100vh',
        },
      }}
    >
      <DialogTitle sx={{ 
        backgroundColor: theme.palette.primary.main, 
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        Consolidated Report Preview
        <IconButton color="inherit" onClick={onClose} aria-label="close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers style={{ height: 'calc(100vh - 140px)', padding: 0, position: 'relative' }}>
        {loading && (
          <Box sx={{ 
            position: 'absolute', 
            top: '50%', 
            left: '50%', 
            transform: 'translate(-50%, -50%)',
            zIndex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}>
            <CircularProgress />
            <Box sx={{ mt: 2 }}>Loading PDF...</Box>
          </Box>
        )}
        
        <PDFViewer 
          width="100%" 
          height="100%" 
          onRender={handlePDFLoadSuccess}
        >
          <PDFReportDocument
            fiscalYear={fiscalYear}
            psSummary={psSummary}
            mooe={mooe}
            co={co}
          />
        </PDFViewer>
      </DialogContent>

      <DialogActions sx={{ justifyContent: 'space-between', padding: 2, backgroundColor: theme.palette.grey[100] }}>
        <PDFDownloadLink
          document={
            <PDFReportDocument
              fiscalYear={fiscalYear}
              psSummary={psSummary}
              mooe={mooe}
              co={co}
            />
          }
          fileName={`NIA_Budget_Report_FY${fiscalYear}.pdf`}
        >
          {({ loading: downloadLoading, blob, url, error }) => (
            <Button 
              variant="contained" 
              color="primary" 
              startIcon={<DownloadIcon />}
              disabled={downloadLoading}
            >
              {downloadLoading ? 'Preparing Download...' : 'Download PDF'}
            </Button>
          )}
        </PDFDownloadLink>
        <Button onClick={onClose} variant="outlined">Close</Button>
      </DialogActions>
    </Dialog>
  );
}
