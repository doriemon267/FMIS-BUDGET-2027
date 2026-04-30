import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  Box, 
  Card, 
  CardContent, 
  Typography, 
  CircularProgress, 
  Button,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Paper,
  Container,
  TextField,
  Tabs,
  Tab,
  Stack
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

const VerifyDocumentPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const documentId = searchParams.get('id');
  
  const [loading, setLoading] = useState(false);
  const [auditData, setAuditData] = useState(null);
  const [error, setError] = useState(null);
  
  const [tabValue, setTabValue] = useState(0);
  const [manualId, setManualId] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (documentId) {
      fetchDocumentStatus(documentId);
    }
  }, [documentId]);

  const fetchDocumentStatus = async (id) => {
    setLoading(true);
    setError(null);
    setAuditData(null);
    try {
      const response = await fetch(`/api/comprehensive-reports/verify/${id}`);
      const data = await response.json();
      if (data.success) {
        setAuditData(data.auditLog);
      } else {
        setError(data.message || 'Document not found or invalid.');
      }
    } catch (err) {
      setError('Failed to connect to verification server.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manualId.trim()) {
      setSearchParams({ id: manualId.trim() });
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Please upload a valid PDF file.');
      return;
    }

    setLoading(true);
    setError(null);
    setAuditData(null);

    const formData = new FormData();
    formData.append('pdfFile', file);

    try {
      const response = await fetch('/api/comprehensive-reports/verify-upload', {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      
      if (data.success) {
        setAuditData(data.auditLog);
        // Clear search params so it doesn't show URL id
        setSearchParams({});
      } else {
        setError(data.message || 'Document is altered or invalid.');
      }
    } catch (err) {
      setError('Failed to connect to verification server.');
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const resetVerification = () => {
    setAuditData(null);
    setError(null);
    setSearchParams({});
    setManualId('');
  };

  const renderInitialForm = () => (
    <Card elevation={3} sx={{ borderRadius: 3 }}>
      <CardContent sx={{ p: 4 }}>
        <Tabs 
          value={tabValue} 
          onChange={(e, v) => setTabValue(v)} 
          centered 
          sx={{ mb: 4 }}
        >
          <Tab label="Enter Document ID" />
          <Tab label="Upload PDF File" />
        </Tabs>

        {tabValue === 0 && (
          <Box component="form" onSubmit={handleManualSubmit} sx={{ textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary" mb={3}>
              Enter the Document ID found at the bottom of the PDF report to verify its authenticity.
            </Typography>
            <TextField
              fullWidth
              variant="outlined"
              label="Document ID (e.g. COMP-1A2B-3C4D)"
              value={manualId}
              onChange={(e) => setManualId(e.target.value)}
              sx={{ mb: 3 }}
            />
            <Button 
              variant="contained" 
              color="primary" 
              size="large" 
              type="submit"
              disabled={!manualId.trim() || loading}
            >
              Verify Document
            </Button>
          </Box>
        )}

        {tabValue === 1 && (
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary" mb={3}>
              Upload the PDF file directly to verify its cryptographic fingerprint. This checks if the document has been altered.
            </Typography>
            
            <input
              type="file"
              accept="application/pdf"
              style={{ display: 'none' }}
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
            
            <Button
              variant="outlined"
              size="large"
              startIcon={<CloudUploadIcon />}
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              sx={{ py: 3, px: 4, borderStyle: 'dashed', borderWidth: 2 }}
            >
              Select PDF File to Verify
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Box minHeight="100vh" bgcolor="#f8f9fa" py={8}>
      <Container maxWidth="md">
        <Box display="flex" flexDirection="column" alignItems="center" mb={4}>
          <img src="/logo.png" alt="NIA Logo" style={{ width: 80, height: 80, marginBottom: 16 }} />
          <Typography variant="h4" fontWeight="bold" color="primary.main" textAlign="center">
            FMIS Document Verification
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            National Irrigation Administration
          </Typography>
        </Box>

        {loading ? (
          <Box display="flex" justifyContent="center" py={10}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Card elevation={3} sx={{ borderRadius: 3, borderTop: '6px solid #f44336' }}>
            <CardContent sx={{ textAlign: 'center', py: 6 }}>
              <CancelIcon color="error" sx={{ fontSize: 80, mb: 2 }} />
              <Typography variant="h5" fontWeight="bold" color="error" gutterBottom>
                Verification Failed
              </Typography>
              <Typography variant="body1" color="text.secondary" mb={4}>
                {error}
              </Typography>
              <Button variant="outlined" onClick={resetVerification}>
                Try Another Document
              </Button>
            </CardContent>
          </Card>
        ) : auditData ? (
          <Card elevation={3} sx={{ borderRadius: 3, borderTop: '6px solid #4caf50' }}>
            <CardContent sx={{ p: 4 }}>
              <Box display="flex" alignItems="center" justifyContent="center" mb={4}>
                <CheckCircleIcon color="success" sx={{ fontSize: 60, mr: 2 }} />
                <Box>
                  <Typography variant="h5" fontWeight="bold" color="success.main">
                    Document Verified
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    This document is authentic and has not been altered.
                  </Typography>
                </Box>
              </Box>

              <Divider sx={{ mb: 3 }} />

              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Document Details
              </Typography>
              <Paper variant="outlined" sx={{ p: 3, mb: 4, borderRadius: 2, bgcolor: '#fafafa' }}>
                <Box display="grid" gridTemplateColumns="1fr 2fr" gap={2}>
                  <Typography variant="body2" color="text.secondary">Document ID:</Typography>
                  <Typography variant="body1" fontWeight="bold">{auditData.documentId}</Typography>

                  <Typography variant="body2" color="text.secondary">Report Type:</Typography>
                  <Typography variant="body1">{auditData.reportType}</Typography>

                  <Typography variant="body2" color="text.secondary">Fiscal Year:</Typography>
                  <Typography variant="body1">{auditData.fiscalYear || 'All Years'}</Typography>

                  <Typography variant="body2" color="text.secondary">Generated By:</Typography>
                  <Typography variant="body1">{auditData.generatedBy}</Typography>

                  <Typography variant="body2" color="text.secondary">Generated At:</Typography>
                  <Typography variant="body1">
                    {new Date(auditData.generatedAt).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'medium' })}
                  </Typography>
                </Box>
              </Paper>

              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Workflow Digital Signatures
              </Typography>
              <List sx={{ width: '100%', bgcolor: 'background.paper', borderRadius: 2, border: '1px solid #eee', mb: 4 }}>
                {auditData.signatories?.map((sig, index) => (
                  <React.Fragment key={index}>
                    <ListItem alignItems="flex-start" sx={{ py: 2 }}>
                      <ListItemIcon>
                        <VerifiedUserIcon color={sig.verificationStatus.includes('Valid') ? 'success' : 'primary'} />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography variant="subtitle1" fontWeight="bold">
                            {sig.fullName}
                          </Typography>
                        }
                        secondary={
                          <Box mt={1} display="flex" flexDirection="column" gap={0.5}>
                            <Typography variant="body2" color="text.primary">
                              {sig.position}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Signed: {sig.signedAt ? new Date(sig.signedAt).toLocaleString() : 'N/A'}
                            </Typography>
                            <Box display="flex" gap={1} mt={0.5}>
                              <Chip 
                                size="small" 
                                label={sig.verificationStatus} 
                                color={sig.verificationStatus.includes('Valid') ? 'success' : 'default'} 
                                variant="outlined" 
                              />
                              <Chip 
                                size="small" 
                                label={sig.signatureType} 
                                variant="outlined" 
                              />
                            </Box>
                          </Box>
                        }
                      />
                    </ListItem>
                    {index < auditData.signatories.length - 1 && <Divider component="li" />}
                  </React.Fragment>
                ))}
              </List>
              
              <Box textAlign="center">
                <Button variant="outlined" onClick={resetVerification}>
                  Verify Another Document
                </Button>
              </Box>
            </CardContent>
          </Card>
        ) : (
          renderInitialForm()
        )}
      </Container>
    </Box>
  );
};

export default VerifyDocumentPage;
