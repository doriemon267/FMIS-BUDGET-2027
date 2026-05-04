import  { useState } from 'react';
import { 
  Box, 
  Button, 
  Typography, 
  Paper, 
  Container, 
  Grid, 
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

const MooeUploadPage = () => {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setFileName(selectedFile.name);
      setUploadResult(null);
      setError(null);
    }
  };

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
    try {
      const response = await api.post(
        '/income/mooe/upload',
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
      setError(
        err.response?.data?.message || 
        err.response?.data?.error || 
        'Failed to upload file. Please try again.'
      );
      setLoading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await api.get('/income/mooe/template', {
        responseType: 'blob',
        headers: {
          'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'mooe_template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError('Failed to download template. Please try again later.');
    }
  };

  return (
    <Container maxWidth={false} sx={{ mt: 4, mb: 4, px: { xs: 2, md: 3 } }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom>
          MOOE Bulk Upload
        </Typography>
        <Typography variant="body1" paragraph>
          Upload an Excel file to add multiple MOOE entries at once. Make sure your file follows the required format.
        </Typography>
        <Divider sx={{ my: 3 }} />
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
              <Typography variant="h6" gutterBottom>
                Step 1: Download Template
              </Typography>
              <Typography variant="body2" paragraph>
                Download the Excel template and fill it with your MOOE data.
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
          </Grid>
          <Grid item xs={12}>
            <Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
              <Typography variant="h6" gutterBottom>
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
          <Grid item xs={12}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleUpload}
              disabled={!file || loading}
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <CloudUpload />}
              sx={{ mt: 2 }}
            >
              {loading ? 'Uploading...' : 'Upload MOOE Data'}
            </Button>
          </Grid>
          {error && (
            <Grid item xs={12}>
              <Alert severity="error" sx={{ mt: 2 }}>
                <AlertTitle>Error</AlertTitle>
                {error}
              </Alert>
            </Grid>
          )}
          {uploadResult && (
            <Grid item xs={12}>
              <Alert 
                severity={uploadResult.failed > 0 ? "warning" : "success"} 
                sx={{ mt: 2 }}
              >
                <AlertTitle>
                  {uploadResult.failed > 0 
                    ? "Upload Completed with Issues" 
                    : "Upload Successful"}
                </AlertTitle>
                <Typography variant="body2">
                  Successfully Processed: <strong>{uploadResult.success}</strong>
                </Typography>
                <Typography variant="body2">
                  Failed Records: <strong>{uploadResult.failed}</strong>
                </Typography>
              </Alert>
              {uploadResult.errors && uploadResult.errors.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Error Details
                  </Typography>
                  <TableContainer component={Paper}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Row Data</TableCell>
                          <TableCell>Error</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {uploadResult.errors.map((error, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              {JSON.stringify(error.row)}
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

export default MooeUploadPage;
