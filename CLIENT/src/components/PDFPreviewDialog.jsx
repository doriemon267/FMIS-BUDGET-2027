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
  Toolbar,
  Chip,
} from '@mui/material';
import {
  Close as CloseIcon,
  Download as DownloadIcon,
  Print as PrintIcon,
  Preview as PreviewIcon,
} from '@mui/icons-material';
import { PDFDownloadLink, pdf } from '@react-pdf/renderer';
import ConsolidatedIncomeReportPDF from './ConsolidatedIncomeReportPDF';

const PDFPreviewDialog = ({ 
  open, 
  onClose, 
  reportData, 
  activeTab, 
  selectedRegions, 
  showPercentages 
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);

  const generatePDFBlob = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const pdfElement = (
        <ConsolidatedIncomeReportPDF
          reportData={reportData}
          activeTab={activeTab}
          selectedRegions={selectedRegions}
          showPercentages={showPercentages}
        />
      );

      const blob = await pdf(pdfElement).toBlob();
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      setLoading(false);
    } catch (err) {
      console.error('Error generating PDF:', err);
      setError('Failed to generate PDF preview. Please try again.');
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (open && reportData) {
      generatePDFBlob();
    }
    
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [open, reportData, activeTab, selectedRegions, showPercentages]);

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

  const getTabName = () => {
    switch (activeTab) {
      case 0: return 'Executive Summary';
      case 1: return 'Category Breakdown';
      case 2: return 'Subcategory Details';
      default: return 'Report';
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
            PDF Preview & Export - {getTabName()}
          </Typography>
          <Chip 
            label={selectedRegions === 'all' ? 'All Regions' : selectedRegions}
            color="primary"
            size="small"
          />
          {showPercentages && (
            <Chip 
              label="With Percentages"
              color="secondary"
              size="small"
            />
          )}
        </Box>
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{ color: (theme) => theme.palette.grey[500] }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        {loading && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 4 }}>
            <CircularProgress size={60} />
            <Typography variant="h6">Generating PDF...</Typography>
            <Typography variant="body2" color="text.secondary">
              Please wait while we prepare your professional report
            </Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!loading && !error && (
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
                  <strong>Report Type:</strong> {getTabName()}
                </Typography>
                <Typography variant="body2">
                  <strong>Fiscal Year:</strong> {reportData?.fiscalYear}
                </Typography>
                <Typography variant="body2">
                  <strong>Budget Type:</strong> {reportData?.budgetType}
                </Typography>
                <Typography variant="body2">
                  <strong>Regions:</strong> {selectedRegions === 'all' ? 'All Regions' : selectedRegions}
                </Typography>
                <Typography variant="body2">
                  <strong>Categories:</strong> {reportData?.hierarchicalData?.length || 0}
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
                    <ConsolidatedIncomeReportPDF
                      reportData={reportData}
                      activeTab={activeTab}
                      selectedRegions={selectedRegions}
                      showPercentages={showPercentages}
                    />
                  }
                  fileName={`Consolidated_Corporate_Income_${reportData?.fiscalYear}_${reportData?.budgetType}_${getTabName().replace(/\s+/g, '_')}.pdf`}
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

      <DialogActions sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Button onClick={onClose} variant="outlined">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PDFPreviewDialog;
