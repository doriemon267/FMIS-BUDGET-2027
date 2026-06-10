import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  CircularProgress,
  Alert,
  IconButton,
  Paper,
  Chip,
} from '@mui/material';
import {
  Close as CloseIcon,
  Download as DownloadIcon,
  Print as PrintIcon,
  Preview as PreviewIcon,
} from '@mui/icons-material';
import { PDFDownloadLink, pdf } from '@react-pdf/renderer';
import LongevityPayReportPDF from '../reports/LongevityPayReportPDF';
import { useQuery } from '@tanstack/react-query';
import api from '../../config/api';
import { useRegion } from '../../context/RegionContext';

const LongevityPayReportDialog = ({ open, onClose }) => {
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [errorPdf, setErrorPdf] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  
  const { activeRegion } = useRegion();

  // Fetch all loyalty pay records
  const { data: records, isLoading: loadingData, error: dataError } = useQuery({
    queryKey: ['loyalty-pay', 'report-all'],
    queryFn: async () => {
      const response = await api.get('/loyalty-pay');
      return response.data.data || [];
    },
    enabled: open, // Only fetch when dialog is open
  });

  const generatePDFBlob = async () => {
    if (!records || records.length === 0) return;
    
    try {
      setLoadingPdf(true);
      setErrorPdf(null);
      
      const pdfElement = (
        <LongevityPayReportPDF
          reportData={records}
          fiscalYear={records[0]?.fiscalYear || new Date().getFullYear()}
          regionName={activeRegion?.name || 'REGION/PROJECT'}
        />
      );

      const blob = await pdf(pdfElement).toBlob();
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      setLoadingPdf(false);
    } catch (err) {
      console.error('Error generating PDF:', err);
      setErrorPdf('Failed to generate PDF preview. Please try again.');
      setLoadingPdf(false);
    }
  };

  React.useEffect(() => {
    if (open && records && records.length > 0) {
      generatePDFBlob();
    }
    
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [open, records]);

  const handlePreviewInNewWindow = () => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank', 'width=1200,height=800');
    }
  };

  const handlePrint = async () => {
    if (pdfUrl) {
      const printWindow = window.open(pdfUrl, '_blank');
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
    >
      <DialogTitle sx={{ m: 0, p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h6" component="div">
            PDF Preview & Export - Longevity Pay
          </Typography>
          <Chip 
            label={activeRegion?.name || 'All Regions'}
            color="primary"
            size="small"
          />
        </Box>
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{ color: (theme) => theme.palette.grey[500] }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {(loadingData || loadingPdf) && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 4 }}>
            <CircularProgress size={60} />
            <Typography variant="h6">
              {loadingData ? 'Fetching Data...' : 'Generating PDF...'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Please wait while we prepare your professional report
            </Typography>
          </Box>
        )}

        {(dataError || errorPdf) && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {dataError ? 'Failed to fetch data' : errorPdf}
          </Alert>
        )}

        {!loadingData && records && records.length === 0 && (
          <Alert severity="info" sx={{ mb: 2 }}>
            No Loyalty Pay records found to generate a report.
          </Alert>
        )}

        {!loadingData && !loadingPdf && !errorPdf && !dataError && records && records.length > 0 && (
          <Box sx={{ py: 2 }}>
            <Alert severity="success" sx={{ mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                ✅ PDF Generated Successfully!
              </Typography>
              <Typography variant="body2">
                Your professional report is ready. You can preview it in a new window or download it directly.
              </Typography>
            </Alert>

            <Paper sx={{ p: 3, backgroundColor: '#f5f5f5' }}>
              <Typography variant="h6" gutterBottom>
                📄 Report Details
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 3 }}>
                <Typography variant="body2">
                  <strong>Report Type:</strong> Longevity Pay (Loyalty Award)
                </Typography>
                <Typography variant="body2">
                  <strong>Fiscal Year:</strong> {records[0]?.fiscalYear || new Date().getFullYear()}
                </Typography>
                <Typography variant="body2">
                  <strong>Region:</strong> {activeRegion?.name || 'All Regions'}
                </Typography>
                <Typography variant="body2">
                  <strong>Total Records:</strong> {records.length}
                </Typography>
                <Typography variant="body2">
                  <strong>Generated:</strong> {new Date().toLocaleString()}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<PreviewIcon />}
                  onClick={handlePreviewInNewWindow}
                  disabled={!pdfUrl}
                  sx={{ minWidth: 160 }}
                >
                  Preview in New Window
                </Button>

                <Button
                  variant="outlined"
                  color="primary"
                  startIcon={<PrintIcon />}
                  onClick={handlePrint}
                  disabled={!pdfUrl}
                  sx={{ minWidth: 120 }}
                >
                  Print
                </Button>

                <PDFDownloadLink
                  document={
                    <LongevityPayReportPDF
                      reportData={records}
                      fiscalYear={records[0]?.fiscalYear || new Date().getFullYear()}
                      regionName={activeRegion?.name || 'REGION/PROJECT'}
                    />
                  }
                  fileName={`Longevity_Pay_Report_${records[0]?.fiscalYear || new Date().getFullYear()}.pdf`}
                  style={{ textDecoration: 'none' }}
                >
                  {({ loading: downloadLoading }) => (
                    <Button
                      variant="contained"
                      color="secondary"
                      startIcon={<DownloadIcon />}
                      disabled={downloadLoading}
                      sx={{ minWidth: 140 }}
                    >
                      {downloadLoading ? 'Preparing...' : 'Download PDF'}
                    </Button>
                  )}
                </PDFDownloadLink>
              </Box>
            </Paper>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} variant="outlined">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LongevityPayReportDialog;
