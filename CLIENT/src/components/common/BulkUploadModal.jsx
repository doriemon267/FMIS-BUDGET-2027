import React, { useState } from "react";
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  Card,
  CardContent,
  Divider,
  Alert,
  AlertTitle,
  CircularProgress,
  Paper,
  Stepper,
  Step,
  StepLabel,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Grid,
  Container,
  IconButton,
} from "@mui/material";
import {
  CloudUpload as CloudUploadIcon,
  Download as DownloadIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  WarningAmber as WarningIcon,
  Close as CloseIcon,
} from "@mui/icons-material";
import { toast } from "react-toastify";
import api from "../../config/api";

/**
 * BulkUploadModal Component
 * Handles bulk import of data for Income, MOOE, and Capital Outlay tables
 * Features:
 * - Template download
 * - File upload with validation
 * - Progress tracking
 * - Error reporting
 * - Success summary
 */
export const BulkUploadModal = ({ 
  open = false,
  onClose = () => {},
  tableType = "income", // 'income', 'mooe', 'capitalOutlay'
  onUploadSuccess = () => {}
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState(null);

  const steps = ["Download Template", "Prepare Data", "Upload File"];

  // Endpoint mapping
  const endpoints = {
    income: {
      upload: "/income/corporate-income/upload",
      template: "/income/corporate-income/template",
      label: "Corporate Income",
      description: "Import multiple corporate income entries"
    },
    mooe: {
      upload: "/income/mooe/upload",
      template: "/income/mooe/template",
      label: "MOOE (M&OOE)",
      description: "Import maintenance and other operating expenses"
    },
    capitalOutlay: {
      upload: "/capitaloutlay/upload",
      template: "/capitaloutlay/template",
      label: "Capital Outlay",
      description: "Import capital outlay items"
    }
  };

  const config = endpoints[tableType];

  const handleDownloadTemplate = async () => {
    try {
      setError(null);
      const response = await api.get(config.template, {
        responseType: "blob",
        headers: {
          Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        }
      });

      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${tableType}_template.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Template downloaded successfully!");
      setActiveStep(1);
    } catch (err) {
      const message = err.response?.data?.message || "Failed to download template";
      setError(message);
      toast.error(message);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/octet-stream"
    ];

    if (!validTypes.includes(file.type)) {
      setError("Invalid file type. Please select an Excel file (.xlsx or .xls)");
      toast.error("Invalid file type");
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(`File too large. Maximum size is ${maxSize / 1024 / 1024}MB`);
      toast.error("File too large");
      return;
    }

    setSelectedFile(file);
    setFileName(file.name);
    setError(null);
    setActiveStep(2);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Please select a file first");
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await api.post(config.upload, formData, {
        headers: {
          "Content-Type": "multipart/form-data"
        },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setUploadProgress(progress);
        }
      });

      setUploadResult(response.data);
      toast.success(
        `Upload completed! ${response.data.success} records processed successfully.`
      );
      onUploadSuccess();
    } catch (err) {
      const message = err.response?.data?.message || err.message || "Upload failed";
      setError(message);
      toast.error(message);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleReset = () => {
    setActiveStep(0);
    setSelectedFile(null);
    setFileName("");
    setUploadResult(null);
    setError(null);
    setUploadProgress(0);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pr: 6 }}>
        Bulk Import: {config.label}
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{ position: "absolute", right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Container maxWidth="md" sx={{ py: 1, px: 0 }}>
          <Card elevation={0}>
            <CardContent>
              {/* Header */}
              <Box sx={{ mb: 3, textAlign: "center" }}>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {config.description}
                </Typography>
              </Box>

          <Divider sx={{ mb: 3 }} />

          {/* Stepper */}
          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {/* Error Alert */}
          {error && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
              <AlertTitle>Error</AlertTitle>
              {error}
            </Alert>
          )}

          {/* Step 0: Download Template */}
          {activeStep === 0 && (
            <Paper sx={{ p: 3, bgcolor: "#f5f5f5" }}>
              <Typography variant="h6" gutterBottom>
                Step 1: Download Template
              </Typography>
              <Typography variant="body2" color="textSecondary" paragraph>
                Download the Excel template to see the required format and field names. Fill it with your data and then upload it.
              </Typography>
              <Button
                variant="contained"
                color="success"
                startIcon={<DownloadIcon />}
                onClick={handleDownloadTemplate}
                sx={{ mt: 2 }}
              >
                Download Template
              </Button>
            </Paper>
          )}

          {/* Step 1: Prepare Data */}
          {activeStep === 1 && (
            <Paper sx={{ p: 3, bgcolor: "#f5f5f5" }}>
              <Typography variant="h6" gutterBottom>
                Step 2: Prepare Your Data
              </Typography>
              <Typography variant="body2" color="textSecondary" paragraph>
                Open the downloaded template and fill in your data. Make sure to:
              </Typography>
              <ul style={{ marginTop: 0 }}>
                <li>
                  <Typography variant="body2">Keep the column headers exactly as shown</Typography>
                </li>
                <li>
                  <Typography variant="body2">Include all required columns</Typography>
                </li>
                <li>
                  <Typography variant="body2">Use proper formatting for numbers (no currency symbols)</Typography>
                </li>
                <li>
                  <Typography variant="body2">Ensure dates are in YYYY-MM-DD format if applicable</Typography>
                </li>
              </ul>
              <Typography variant="body2" color="textSecondary" sx={{ mt: 2, fontStyle: "italic" }}>
                💡 Tip: You can copy existing data from the system and paste it into this template to make updates faster!
              </Typography>
            </Paper>
          )}

          {/* Step 2: Upload File */}
          {activeStep === 2 && !uploadResult && (
            <Paper sx={{ p: 3, bgcolor: "#f5f5f5" }}>
              <Typography variant="h6" gutterBottom>
                Step 3: Upload Your File
              </Typography>

              {/* File Input */}
              <Box
                sx={{
                  border: "2px dashed #1976d2",
                  borderRadius: 2,
                  p: 4,
                  textAlign: "center",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  "&:hover": {
                    borderColor: "#1565c0",
                    backgroundColor: "rgba(25, 118, 210, 0.05)"
                  }
                }}
              >
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  style={{ display: "none" }}
                  id="file-input"
                />
                <label htmlFor="file-input" style={{ cursor: "pointer", display: "block" }}>
                  <CloudUploadIcon sx={{ fontSize: 48, color: "#1976d2", mb: 1 }} />
                  <Typography variant="h6">
                    {fileName || "Click to select file or drag and drop"}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Supported formats: Excel (.xlsx, .xls) | Max size: 10MB
                  </Typography>
                </label>
              </Box>

              {selectedFile && (
                <Box sx={{ mt: 3 }}>
                  <Chip
                    icon={<CheckCircleIcon />}
                    label={`Selected: ${fileName}`}
                    color="success"
                    variant="outlined"
                    sx={{ mb: 2 }}
                  />

                  {isUploading && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        Uploading... {uploadProgress}%
                      </Typography>
                      <LinearProgress variant="determinate" value={uploadProgress} />
                    </Box>
                  )}

                  <Box sx={{ display: "flex", gap: 2, mt: 3 }}>
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={isUploading ? <CircularProgress size={20} /> : <CloudUploadIcon />}
                      onClick={handleUpload}
                      disabled={isUploading}
                    >
                      {isUploading ? "Uploading..." : "Upload File"}
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => setSelectedFile(null)}
                      disabled={isUploading}
                    >
                      Clear Selection
                    </Button>
                  </Box>
                </Box>
              )}
            </Paper>
          )}

          {/* Upload Result */}
          {uploadResult && (
            <Paper sx={{ p: 3, bgcolor: uploadResult.failed > 0 ? "#fff3cd" : "#d4edda" }}>
              <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                {uploadResult.failed > 0 ? (
                  <WarningIcon sx={{ fontSize: 32, color: "#ff9800", mr: 2 }} />
                ) : (
                  <CheckCircleIcon sx={{ fontSize: 32, color: "#4caf50", mr: 2 }} />
                )}
                <Typography variant="h6">
                  {uploadResult.failed > 0 ? "Upload Completed with Issues" : "Upload Successful"}
                </Typography>
              </Box>

              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: "center", py: 2 }}>
                      <Typography color="textSecondary" gutterBottom>
                        Total Processed
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: "bold" }}>
                        {uploadResult.success + uploadResult.failed}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined" sx={{ bgcolor: "#d4edda" }}>
                    <CardContent sx={{ textAlign: "center", py: 2 }}>
                      <Typography color="textSecondary" gutterBottom>
                        Successful
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: "bold", color: "#4caf50" }}>
                        {uploadResult.success}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined" sx={{ bgcolor: uploadResult.failed > 0 ? "#f8d7da" : "#f5f5f5" }}>
                    <CardContent sx={{ textAlign: "center", py: 2 }}>
                      <Typography color="textSecondary" gutterBottom>
                        Failed
                      </Typography>
                      <Typography
                        variant="h5"
                        sx={{ fontWeight: "bold", color: uploadResult.failed > 0 ? "#f44336" : "#9e9e9e" }}
                      >
                        {uploadResult.failed}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: "center", py: 2 }}>
                      <Typography color="textSecondary" gutterBottom>
                        Regions
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: "bold" }}>
                        {uploadResult.regions?.length || 0}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {uploadResult.errors && uploadResult.errors.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: "bold", mb: 1 }}>
                    ⚠️ Errors Found ({uploadResult.errors.length})
                  </Typography>
                  <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 300 }}>
                    <Table size="small">
                      <TableHead sx={{ bgcolor: "#f5f5f5" }}>
                        <TableRow>
                          <TableCell sx={{ fontWeight: "bold" }}>Row Data</TableCell>
                          <TableCell sx={{ fontWeight: "bold" }}>Region</TableCell>
                          <TableCell sx={{ fontWeight: "bold" }}>Error Message</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {uploadResult.errors.map((err, idx) => (
                          <TableRow key={idx} sx={{ bgcolor: idx % 2 === 0 ? "#fafafa" : "white" }}>
                            <TableCell sx={{ fontSize: "0.85rem" }}>{err.row}</TableCell>
                            <TableCell sx={{ fontSize: "0.85rem" }}>{err.region}</TableCell>
                            <TableCell sx={{ fontSize: "0.85rem", color: "error.main" }}>
                              {err.error}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              <Box sx={{ display: "flex", gap: 2, mt: 3 }}>
                <Button variant="contained" color="primary" onClick={handleReset}>
                  Upload Another File
                </Button>
                <Button variant="outlined" onClick={() => window.location.reload()}>
                  Refresh Page
                </Button>
              </Box>
            </Paper>
          )}
            </CardContent>
          </Card>
        </Container>
      </DialogContent>
    </Dialog>
  );
};

export default BulkUploadModal;
