import  { useState, useEffect } from 'react';
import { 
  Box, 
  Button, 
  Typography, 
  Paper, 
  Container, 
  Grid, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  Alert, 
  AlertTitle, 
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,

} from '@mui/material';
import { CloudUpload, Download } from '@mui/icons-material';
import api from '../config/api';

const CorporateIncomeUploadPage = () => {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState(null);
  // Handle file selection
  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setFileName(selectedFile.name);
      // Reset previous upload results
      setUploadResult(null);
      setError(null);
    }
  };

  // Handle file upload
  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file to upload.');
      return;
    }

    setLoading(true);
    setError(null);
    setUploadResult(null);
    
    const formData = new FormData();
    formData.append('file', file);

    try {      const response = await api.post(
        '/income/corporate-income/upload',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      setUploadResult(response.data);
      setLoading(false);
    } catch (err) {
      console.error('Error uploading file:', err);
      setError(
        err.response?.data?.message || 
        err.response?.data?.error || 
        'Failed to upload file. Please try again.'
      );
      setLoading(false);
    }
  };

  // Handle template download
  const handleDownloadTemplate = async () => {
    try {
      const response = await api.get('/income/corporate-income/template', {
        responseType: 'blob',
        headers: {
          'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
      });

      // Create a download link and trigger the download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'corporate_income_template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Error downloading template:', err);
      setError('Failed to download template. Please try again later.');
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom>
          Corporate Income Bulk Upload
        </Typography>
        <Typography variant="body1" paragraph>
          Upload an Excel file to add multiple corporate income entries at once. Make sure your file follows the required format.
        </Typography>

        <Divider sx={{ my: 3 }} />

        <Grid container spacing={3}>
          {/* Template Download Section */}
          <Grid item xs={12}>
            <Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
              <Typography variant="h6" gutterBottom>
                Step 1: Download Template
              </Typography>
              <Typography variant="body2" paragraph>
                Download the Excel template and fill it with your corporate income data.
              </Typography>
              <Button
                variant="outlined"
                startIcon={<Download />}
                onClick={handleDownloadTemplate}
                sx={{ mt: 1 }}
              >
                Download Template
              </Button>
            </Box>
          </Grid>          {/* File Upload Section */}
          <Grid item xs={12}>
            <Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>              <Typography variant="h6" gutterBottom>
                Step 2: Upload File
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <input
                  accept=".xlsx,.xls"
                  style={{ display: 'none' }}
                  id="raised-button-file"
                  type="file"
                  onChange={handleFileChange}
                />
                <label htmlFor="raised-button-file">
                  <Button
                    variant="contained"
                    component="span"
                    startIcon={<CloudUpload />}
                  >
                    Select File
                  </Button>
                </label>
                {fileName && (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    Selected file: {fileName}
                  </Typography>
                )}
              </Box>
            </Box>
          </Grid>

          {/* Upload Button */}
          <Grid item xs={12}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleUpload}
              disabled={!file || loading}
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <CloudUpload />}
              sx={{ mt: 2 }}
            >
              {loading ? 'Uploading...' : 'Upload Corporate Income Data'}
            </Button>
          </Grid>

          {/* Error Message */}
          {error && (
            <Grid item xs={12}>
              <Alert severity="error" sx={{ mt: 2 }}>
                <AlertTitle>Error</AlertTitle>
                {error}
              </Alert>
            </Grid>
          )}

          {/* Upload Results */}
          {uploadResult && (
            <Grid item xs={12}>
              <Alert 
                severity={uploadResult.failedRecords > 0 ? "warning" : "success"} 
                sx={{ mt: 2 }}
              >
                <AlertTitle>
                  {uploadResult.failedRecords > 0 
                    ? "Upload Completed with Issues" 
                    : "Upload Successful"}
                </AlertTitle>                <Typography variant="body2">
                  Regions: <strong>{uploadResult.regions?.join(", ")}</strong>
                </Typography>
                <Typography variant="body2">
                  Fiscal Year: <strong>{uploadResult.fiscalYear}</strong>
                </Typography>
                <Typography variant="body2">
                  Budget Type: <strong>{uploadResult.budgetType}</strong>
                </Typography>
                <Typography variant="body2">
                  Total Records: <strong>{uploadResult.totalRecords}</strong>
                </Typography>
                <Typography variant="body2">
                  Successfully Processed: <strong>{uploadResult.successfullyProcessed}</strong>
                </Typography>
                <Typography variant="body2">
                  Failed Records: <strong>{uploadResult.failedRecords}</strong>
                </Typography>
              </Alert>

              {/* Error Details Table */}
              {uploadResult.errors && uploadResult.errors.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Error Details
                  </Typography>
                  <TableContainer component={Paper}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Category</TableCell>
                          <TableCell>Region</TableCell>
                          <TableCell>Amount</TableCell>
                          <TableCell>Error</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {uploadResult.errors.map((error, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              {error.category || 'N/A'}
                            </TableCell>
                            <TableCell>
                              {error.region || 'N/A'}
                            </TableCell>
                            <TableCell>
                              {error.amount || 'N/A'}
                            </TableCell>
                            <TableCell>
                              {error.error}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
            </Grid>
          )}
        </Grid>
      </Paper>
    </Container>
  );
};

export default CorporateIncomeUploadPage;