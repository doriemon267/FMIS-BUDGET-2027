import React, { useState, useEffect } from 'react';
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
  AlertTitle,
  IconButton,
  Paper,
  Chip,
  Stack,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  LinearProgress,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Print as PrintIcon,
  Preview as PreviewIcon,
  Security as SecurityIcon,
  CheckCircle as CheckCircleIcon,
  Description as DescriptionIcon,
  Fingerprint as FingerprintIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';
import api from '../config/api';

/**
 * Enhanced PDF Preview Dialog with Server-Side Secure PDF Generation
 * 
 * Security Features:
 * - Server-side PDF generation (data not exposed to client)
 * - Watermarked documents
 * - Unique document ID for audit trail
 * - User attribution
 * 
 * @param {Object} props
 * @param {boolean} props.open - Dialog open state
 * @param {function} props.onClose - Close handler
 * @param {Object} props.reportData - Report data for preview info
 * @param {number} props.activeTab - Active tab (0: Summary, 1: Categories, 2: Subcategories)
 * @param {string} props.selectedRegions - Selected regions filter
 * @param {boolean} props.showPercentages - Show percentages in report
 */
const EnhancedPDFPreviewDialog = ({ 
  open, 
  onClose, 
  reportData, 
  activeTab, 
  selectedRegions, 
  showPercentages 
}) => {
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Get preview information
  useEffect(() => {
    const fetchPreview = async () => {
      if (!open || !reportData) return;
      
      try {
        setLoading(true);
        setError(null);
        
        const response = await api.get('/reports/consolidated-corporate-income/preview', {
          params: {
            fiscalYear: reportData.fiscalYear,
            budgetType: reportData.budgetType,
            selectedRegions
          }
        });
        
        setPreviewData(response.data.preview);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching preview:', err);
        // Don't show error, just use local preview data
        setPreviewData({
          fiscalYear: reportData.fiscalYear,
          budgetType: reportData.budgetType,
          selectedRegions,
          documentId: `CCI-${Date.now().toString(36)}-LOCAL`.toUpperCase(),
          generatedAt: new Date().toISOString()
        });
        setLoading(false);
      }
    };

    fetchPreview();
  }, [open, reportData, selectedRegions]);

  // Handle secure PDF download from server
  const handleSecureDownload = async () => {
    try {
      setDownloading(true);
      setDownloadProgress(10);
      setError(null);

      setDownloadProgress(30);

      const response = await api.post(
        '/reports/consolidated-corporate-income/export-pdf',
        {
          fiscalYear: reportData.fiscalYear,
          budgetType: reportData.budgetType,
          selectedRegions,
          activeTab,
          showPercentages
        },
        {
          responseType: 'blob',
          onDownloadProgress: (progressEvent) => {
            const progress = Math.round((progressEvent.loaded * 100) / (progressEvent.total || progressEvent.loaded));
            setDownloadProgress(30 + (progress * 0.6)); // Scale to 30-90%
          }
        }
      );

      setDownloadProgress(95);

      // Get document ID from response headers if available
      const documentId = response.headers['x-document-id'] || previewData?.documentId || 'CCI-DOC';

      // Create blob URL and download
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Consolidated_Corporate_Income_${reportData.fiscalYear}_${reportData.budgetType}_${documentId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setDownloadProgress(100);

      // Auto close after successful download
      setTimeout(() => {
        setDownloading(false);
        setDownloadProgress(0);
      }, 1500);

    } catch (err) {
      console.error('Error downloading PDF:', err);
      setError('Failed to download PDF. Please try again.');
      setDownloading(false);
      setDownloadProgress(0);
    }
  };

  // Handle print (download and open in new tab for printing)
  const handlePrint = async () => {
    try {
      setDownloading(true);
      setError(null);

      const response = await api.post(
        '/reports/consolidated-corporate-income/export-pdf',
        {
          fiscalYear: reportData.fiscalYear,
          budgetType: reportData.budgetType,
          selectedRegions,
          activeTab,
          showPercentages
        },
        { responseType: 'blob' }
      );

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      
      // Open in new window for printing
      const printWindow = window.open(url, '_blank');
      if (printWindow) {
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print();
          }, 500);
        };
      }

      setDownloading(false);

    } catch (err) {
      console.error('Error preparing print:', err);
      setError('Failed to prepare document for printing.');
      setDownloading(false);
    }
  };

  // Handle preview in new window
  const handlePreview = async () => {
    try {
      setDownloading(true);
      setError(null);

      const response = await api.post(
        '/reports/consolidated-corporate-income/export-pdf',
        {
          fiscalYear: reportData.fiscalYear,
          budgetType: reportData.budgetType,
          selectedRegions,
          activeTab,
          showPercentages
        },
        { responseType: 'blob' }
      );

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      
      window.open(url, '_blank', 'width=1200,height=800');
      setDownloading(false);

    } catch (err) {
      console.error('Error opening preview:', err);
      setError('Failed to open preview.');
      setDownloading(false);
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
    <Dialog open={open} onClose={onClose} fullScreen>
      <DialogTitle>Consolidated Corporate Income PDF Preview</DialogTitle>

      <DialogContent dividers sx={{ p: 3 }}>
        {loading && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 4 }}>
            <CircularProgress size={60} />
            <Typography variant="h6">Preparing Export...</Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <AlertTitle>Error</AlertTitle>
            {error}
          </Alert>
        )}

        {!loading && !error && (
          <>
            {/* Security Features Section */}
            <Paper sx={{ p: 2, mb: 3, backgroundColor: '#e3f2fd' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <SecurityIcon color="primary" />
                <Typography variant="subtitle1" fontWeight="bold" color="primary">
                  Security Features
                </Typography>
              </Box>
              <List dense>
                <ListItem>
                  <ListItemIcon><CheckCircleIcon color="success" fontSize="small" /></ListItemIcon>
                  <ListItemText 
                    primary="Server-Side Generation" 
                    secondary="PDF is generated securely on the server"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon><CheckCircleIcon color="success" fontSize="small" /></ListItemIcon>
                  <ListItemText 
                    primary="Watermarked Document" 
                    secondary="Official document watermark for authenticity"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon><CheckCircleIcon color="success" fontSize="small" /></ListItemIcon>
                  <ListItemText 
                    primary="Audit Trail" 
                    secondary="Unique document ID for tracking and verification"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon><CheckCircleIcon color="success" fontSize="small" /></ListItemIcon>
                  <ListItemText 
                    primary="User Attribution" 
                    secondary="Document includes generator information"
                  />
                </ListItem>
              </List>
            </Paper>

            {/* Report Details */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <DescriptionIcon color="primary" />
                Report Details
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">Report Type</Typography>
                  <Typography variant="body1" fontWeight="medium">{getTabName()}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">Fiscal Year</Typography>
                  <Typography variant="body1" fontWeight="medium">{reportData?.fiscalYear}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">Budget Type</Typography>
                  <Typography variant="body1" fontWeight="medium">{reportData?.budgetType}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">Regions</Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {selectedRegions === 'all' ? 'All Regions' : selectedRegions}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">Categories</Typography>
                  <Typography variant="body1" fontWeight="medium">{reportData?.hierarchicalData?.length || 0}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">Grand Total</Typography>
                  <Typography variant="body1" fontWeight="bold" color="primary">
                    ₱{(reportData?.grandTotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </Box>
              </Box>

              {previewData && (
                <Box sx={{ mt: 3, pt: 2, borderTop: '1px dashed #ccc' }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <FingerprintIcon fontSize="small" color="action" />
                    <Typography variant="caption" color="text.secondary">
                      Document ID: <strong>{previewData.documentId}</strong>
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CalendarIcon fontSize="small" color="action" />
                    <Typography variant="caption" color="text.secondary">
                      Will be generated: <strong>{new Date().toLocaleString()}</strong>
                    </Typography>
                  </Stack>
                </Box>
              )}
            </Paper>

            {/* Download Progress */}
            {downloading && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" gutterBottom>
                  {downloadProgress < 100 ? 'Generating secure PDF...' : 'Download complete!'}
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={downloadProgress} 
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
            )}

            {/* Action Buttons */}
            <Stack direction="row" spacing={2} flexWrap="wrap" justifyContent="center">
              <Button
                variant="contained"
                color="primary"
                size="large"
                startIcon={downloading ? <CircularProgress size={20} color="inherit" /> : <DownloadIcon />}
                onClick={handleSecureDownload}
                disabled={downloading}
                sx={{ minWidth: 180 }}
              >
                {downloading ? 'Generating...' : 'Download PDF'}
              </Button>

              <Button
                variant="outlined"
                color="primary"
                size="large"
                startIcon={<PreviewIcon />}
                onClick={handlePreview}
                disabled={downloading}
                sx={{ minWidth: 160 }}
              >
                Preview
              </Button>

              <Button
                variant="outlined"
                color="secondary"
                size="large"
                startIcon={<PrintIcon />}
                onClick={handlePrint}
                disabled={downloading}
                sx={{ minWidth: 140 }}
              >
                Print
              </Button>
            </Stack>
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
          Server-side PDF generation ensures data security and authenticity.
        </Typography>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default EnhancedPDFPreviewDialog;
