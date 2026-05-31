import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Container,
  Grid,
  Button,
  Tabs,
  Tab,
  Card,
  CardContent,
  Divider,
  Alert,
  AlertTitle,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  LinearProgress,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Download as DownloadIcon,
  CheckCircle as CheckCircleIcon,
  Refresh as RefreshIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import api from '../config/api';
import { toast } from 'react-toastify';

const BulkUploadManagementPage = () => {
  const [tabValue, setTabValue] = useState(0);
  const [uploadStatus, setUploadStatus] = useState([]);
  const [loadingStatus, setLoadingStatus] = useState(false);

  // Upload state
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState(null);

  const uploadTypes = [
    {
      id: 'income',
      label: 'Corporate Income',
      uploadEndpoint: '/income/corporate-income/upload',
      templateEndpoint: '/income/corporate-income/template',
      description: 'Bulk upload corporate income estimates by region and category.'
    },
    {
      id: 'mooe',
      label: 'MOOE',
      uploadEndpoint: '/income/mooe/upload',
      templateEndpoint: '/income/mooe/template',
      description: 'Bulk upload Maintenance and Other Operating Expenses.'
    },
    {
      id: 'capitalOutlay',
      label: 'Capital Outlay',
      uploadEndpoint: '/capitaloutlay/upload',
      templateEndpoint: '/capitaloutlay/template',
      description: 'Bulk upload Capital Outlay projects and equipment.'
    }
  ];

  const currentType = uploadTypes[tabValue];

  const fetchUploadStatus = async () => {
    setLoadingStatus(true);
    try {
      const response = await api.get('/bulk-upload-management/status');
      setUploadStatus(response.data.data || []);
    } catch (err) {
      console.error('Failed to fetch upload status', err);
      toast.error('Failed to load upload status indicators');
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchUploadStatus();
  }, []);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    resetUploadState();
  };

  const resetUploadState = () => {
    setSelectedFile(null);
    setFileName('');
    setUploadResult(null);
    setError(null);
    setUploadProgress(0);
  };

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/octet-stream'
    ];

    if (!validTypes.includes(file.type)) {
      setError('Invalid file type. Please select an Excel file (.xlsx or .xls)');
      return;
    }

    setSelectedFile(file);
    setFileName(file.name);
    setError(null);
    setUploadResult(null);
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await api.get(currentType.templateEndpoint, {
        responseType: 'blob',
        headers: {
          Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${currentType.id}_template.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Template downloaded successfully');
    } catch (err) {
      console.error('Template download error:', err);
      toast.error('Failed to download template');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await api.post(currentType.uploadEndpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(progress);
        }
      });

      setUploadResult(response.data);
      toast.success('Upload completed successfully');
      fetchUploadStatus(); // Refresh indicators
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Upload failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Container maxWidth={false} sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, color: 'primary.main' }}>
        Bulk Upload Management
      </Typography>
      <Typography variant="body1" sx={{ mb: 4, color: 'text.secondary' }}>
        Administrative tool for bulk importing system-generated data. Data uploaded here will be tagged as 
        <strong> System Upload</strong> and will not appear in regular user proposal listings.
      </Typography>

      <Grid container spacing={3}>
        {/* Indicators Section */}
        <Grid item xs={12} lg={4}>
          <Paper elevation={2} sx={{ p: 3, height: '100%', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <InfoIcon color="primary" /> Uploaded Areas
              </Typography>
              <IconButton onClick={fetchUploadStatus} disabled={loadingStatus} size="small">
                <RefreshIcon className={loadingStatus ? 'animate-spin' : ''} />
              </IconButton>
            </Box>
            <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
              Indicator of Regions/Departments/Divisions with existing system uploads.
            </Typography>
            
            {loadingStatus ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress size={30} />
              </Box>
            ) : uploadStatus.length === 0 ? (
              <Alert severity="info">No system uploads found.</Alert>
            ) : (
              <TableContainer sx={{ maxHeight: 600 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Area</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Counts</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {uploadStatus.map((item, index) => (
                      <TableRow key={index} hover>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.region}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {item.department} / {item.division}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            {item.incomeCount > 0 && <Chip label={`Inc: ${item.incomeCount}`} size="small" color="primary" variant="outlined" sx={{ fontSize: '0.65rem', height: 20 }} />}
                            {item.mooeCount > 0 && <Chip label={`MOOE: ${item.mooeCount}`} size="small" color="secondary" variant="outlined" sx={{ fontSize: '0.65rem', height: 20 }} />}
                            {item.capitalCount > 0 && <Chip label={`CO: ${item.capitalCount}`} size="small" color="success" variant="outlined" sx={{ fontSize: '0.65rem', height: 20 }} />}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Grid>

        {/* Upload Forms Section */}
        <Grid item xs={12} lg={8}>
          <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden' }}>
            <Tabs
              value={tabValue}
              onChange={handleTabChange}
              variant="fullWidth"
            >
              <Tab label="Income" />
              <Tab label="MOOE" />
              <Tab label="Capital Outlay" />
            </Tabs>

            <Box sx={{ p: 4 }}>
              <Typography variant="h6" gutterBottom>
                {currentType.label} Bulk Upload
              </Typography>
              <Typography variant="body2" paragraph color="text.secondary">
                {currentType.description}
              </Typography>

              <Box sx={{ mt: 3, p: 3, bgcolor: 'action.hover', borderRadius: 2, border: '1px dashed', borderColor: 'divider' }}>
                <Grid container spacing={3} alignItems="center">
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" gutterBottom>Step 1: Download Template</Typography>
                    <Button
                      variant="outlined"
                      startIcon={<DownloadIcon />}
                      onClick={handleDownloadTemplate}
                      fullWidth
                    >
                      Download Excel Template
                    </Button>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" gutterBottom>Step 2: Select Formatted File</Typography>
                    <input
                      accept=".xlsx,.xls"
                      style={{ display: 'none' }}
                      id="bulk-upload-file-input"
                      type="file"
                      onChange={handleFileSelect}
                    />
                    <label htmlFor="bulk-upload-file-input">
                      <Button
                        variant="contained"
                        component="span"
                        startIcon={<CloudUploadIcon />}
                        fullWidth
                        color={selectedFile ? "success" : "primary"}
                      >
                        {selectedFile ? 'Change File' : 'Select File'}
                      </Button>
                    </label>
                  </Grid>
                </Grid>

                {selectedFile && (
                  <Box sx={{ mt: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'success.light' }}>
                    <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CheckCircleIcon color="success" fontSize="small" />
                      Selected: <strong>{fileName}</strong>
                    </Typography>
                  </Box>
                )}

                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  fullWidth
                  sx={{ mt: 4, py: 1.5 }}
                  onClick={handleUpload}
                  disabled={!selectedFile || isUploading}
                  startIcon={isUploading ? <CircularProgress size={20} color="inherit" /> : <CloudUploadIcon />}
                >
                  {isUploading ? `Uploading (${uploadProgress}%)` : `Upload ${currentType.label} Data`}
                </Button>

                {isUploading && (
                  <Box sx={{ mt: 2 }}>
                    <LinearProgress variant="determinate" value={uploadProgress} />
                  </Box>
                )}
              </Box>

              {error && (
                <Alert severity="error" sx={{ mt: 3 }}>
                  <AlertTitle>Upload Failed</AlertTitle>
                  {error}
                </Alert>
              )}

              {uploadResult && (
                <Alert severity={uploadResult.failedRecords > 0 ? "warning" : "success"} sx={{ mt: 3 }}>
                  <AlertTitle>
                    {uploadResult.failedRecords > 0 ? 'Upload Completed with Errors' : 'Upload Successful'}
                  </AlertTitle>
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="body2">Processed: <strong>{uploadResult.successfullyProcessed || uploadResult.success || 0}</strong></Typography>
                    <Typography variant="body2">Failed: <strong>{uploadResult.failedRecords || uploadResult.failed || 0}</strong></Typography>
                    {uploadResult.regions && (
                      <Typography variant="body2">Regions: <strong>{uploadResult.regions.join(', ')}</strong></Typography>
                    )}
                  </Box>
                </Alert>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default BulkUploadManagementPage;