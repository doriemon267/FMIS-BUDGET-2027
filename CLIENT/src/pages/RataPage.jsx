import React, { useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Paper,
  Stack,
  Alert,
  Divider,
  useTheme,
  alpha,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem
} from "@mui/material";
import {
  MdGrade,
  MdAttachMoney,
  MdTrendingUp,
  MdSettings,
  MdPeople,
  MdCalculate,
  MdLink,
  MdCalendarToday
} from "react-icons/md";
import {
  AiOutlineEdit,
  AiOutlineEye,
  AiOutlineDownload,
  AiOutlineReload,
  AiOutlinePlus
} from "react-icons/ai";
import { useQuery } from "@tanstack/react-query";
import CustomPage from "../components/rata/CustomPage";
import EnhancedRataDialog from "../components/rata/EnhancedRataDialog";
import LinkRATAToFiscalYearsDialog from "../components/rata/LinkRATAToFiscalYearsDialog";
import api from "../config/api";

const RataPage = () => {
  const theme = useTheme();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedData, setSelectedData] = useState(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewData, setViewData] = useState(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [selectedForLinking, setSelectedForLinking] = useState(null);

  // Fetch RATA data for summary cards
  const { data: rataData, isLoading: rataLoading, refetch } = useQuery({
    queryKey: ["ratas"],
    queryFn: async () => {
      const response = await api.get("/ratas");
      return response.data;
    },
  });

  console.log("Fetched RATA data:", rataData); // Debug log for fetched data

  const handleAddNew = () => {
    setSelectedData(null);
    setDialogOpen(true);
  };

  const handleEdit = (row) => {
    setSelectedData(row);
    setDialogOpen(true);
  };

  const handleView = (row) => {
    setViewData(row);
    setViewDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedData(null);
    refetch(); // Ensure the table reflects saved RA and TA values
  };

  const handleViewDialogClose = () => {
    setViewDialogOpen(false);
    setViewData(null);
  };

  const handleLinkFiscalYears = (rata) => {
    setSelectedForLinking(rata);
    setLinkDialogOpen(true);
  };

  const handleLinkDialogClose = () => {
    setLinkDialogOpen(false);
    setSelectedForLinking(null);
    refetch();
  };

  const handleExport = () => {
    // Export functionality - convert data to CSV
    if (!rataData?.ratas || rataData.ratas.length === 0) {
      alert("No data to export");
      return;
    }

    const csvData = [
      ["Salary Grade", "RA", "TA", "RATA (RA+TA)", "Annual RATA", "Created Date"],
      ...rataData.ratas.map(row => [
        `SG-${row.SG}`,
        row.RA,
        row.TA,
        (parseFloat(row.RA || 0) + parseFloat(row.TA || 0)),
        ((parseFloat(row.RA || 0) + parseFloat(row.TA || 0)) * 12),
        new Date(row.createdAt).toLocaleDateString()
      ])
    ];

    const csvContent = csvData.map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rata-settings-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Enhanced schema with better formatting - let CustomPage handle actions
  const rataSchema = {
    action: {
      type: "action",
      label: "Actions",
    },
    SG: {
      type: "text",
      label: "Salary Grade",
      required: true,
      searchable: true,
      show: true,
      customRender: (row) => (
        <Chip
          label={`SG-${row.SG}`}
          color="primary"
          variant="outlined"
          size="small"
          icon={<MdGrade />}
        />
      )
    },
    linkedBudgetTypes: {
      type: "text",
      label: "Budget Types",
      show: true,
      searchable: false,
      customRender: (row) => (
        <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
          {(row.linkedBudgetTypes && row.linkedBudgetTypes.length > 0) ? (
            row.linkedBudgetTypes.map((bt, idx) => (
              <Chip
                key={idx}
                label={bt}
                color="info"
                variant="outlined"
                size="small"
              />
            ))
          ) : (
            <Chip
              label="Not Linked"
              color="default"
              variant="outlined"
              size="small"
            />
          )}
        </Box>
      )
    },
    linkedFiscalYears: {
      type: "text",
      label: "Linked FY Count",
      show: true,
      searchable: false,
      customRender: (row) => (
        <Chip
          icon={<MdCalendarToday />}
          label={
            (row.linkedFiscalYears && row.linkedFiscalYears.length > 0)
              ? `${row.linkedFiscalYears.length} FY`
              : "Not linked"
          }
          color={(row.linkedFiscalYears && row.linkedFiscalYears.length > 0) ? "primary" : "default"}
          variant="outlined"
          size="small"
        />
      )
    },
    RA: {
      type: "number",
      label: "RA (Representation Allowance)",
      required: true,
      searchable: true,
      show: true,
      customRender: (row) => (
        <Typography variant="body2" fontWeight="medium" color="info.main">
          ₱{(parseFloat(row.RA) || 0).toLocaleString('en-PH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })}
        </Typography>
      )
    },
    TA: {
      type: "number",
      label: "TA (Transportation Allowance)",
      required: true,
      searchable: true,
      show: true,
      customRender: (row) => (
        <Typography variant="body2" fontWeight="medium" color="warning.main">
          ₱{(parseFloat(row.TA) || 0).toLocaleString('en-PH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })}
        </Typography>
      )
    },
    RATA: {
      type: "number",
      label: "RATA (RA + TA)",
      show: true,
      customRender: (row) => (
        <Typography variant="body2" fontWeight="bold" color="success.main">
          ₱{((parseFloat(row.RA) || 0) + (parseFloat(row.TA) || 0)).toLocaleString('en-PH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })}
        </Typography>
      )
    },
    createdAt: {
      type: "date",
      label: "Created Date",
      show: true,
      customRender: (row) => (
        <Typography variant="body2" color="text.secondary">
          {new Date(row.createdAt).toLocaleDateString()}
        </Typography>
      )
    },
  };

  // Custom menu options for additional actions
  const additionalMenuOptions = [
    ({ row, parentClose }) => (
      <MenuItem
        key="view-details"
        onClick={() => {
          handleView(row);
          parentClose();
        }}
        sx={{ display: "flex", gap: 1 }}
      >
        <AiOutlineEye />
        View Details
      </MenuItem>
    ),
    ({ row, parentClose }) => (
      <MenuItem
        key="link-fiscal-years"
        onClick={() => {
          handleLinkFiscalYears(row);
          parentClose();
        }}
        sx={{ display: "flex", gap: 1 }}
      >
        <MdLink />
        Link to Fiscal Years
      </MenuItem>
    )
  ];

  // Summary Cards Component (One Line, Boxed)
  const SummaryCards = () => {
    const rataRecords = rataData?.ratas || [];
    const totalRecords = rataRecords.length;
    const totalRA = rataRecords.reduce((sum, record) => sum + (parseFloat(record.RA) || 0), 0);
    const totalTA = rataRecords.reduce((sum, record) => sum + (parseFloat(record.TA) || 0), 0);
    const totalRataAmount = rataRecords.reduce((sum, record) => sum + ((parseFloat(record.RA) || 0) + (parseFloat(record.TA) || 0)), 0);
    const averageRata = totalRecords > 0 ? totalRataAmount / totalRecords : 0;
    const highestGrade = rataRecords.length > 0
      ? Math.max(...rataRecords.map(r => parseInt(r.SG) || 0))
      : 0;
    // ✅ NEW: Count linked RATA records
    const linkedCount = rataRecords.filter(r => r.linkedFiscalYears?.length > 0).length;
    const totalFYLinks = rataRecords.reduce((sum, r) => sum + (r.linkedFiscalYears?.length || 0), 0);

    const statBoxStyle = (color) => ({
      px: 3,
      py: 2,
      minWidth: 170,
      borderRadius: 2,
      background: alpha(color, 0.08),
      border: `1px solid ${alpha(color, 0.18)}`,
      boxShadow: `0 2px 8px ${alpha(color, 0.08)}`,
      display: 'flex',
      alignItems: 'center',
      gap: 1,
    });

    return (
      <Box sx={{ width: '100%', mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="stretch" justifyContent="space-between" sx={{ width: '100%', flexWrap: 'wrap' }}>
          <Paper elevation={0} sx={{ ...statBoxStyle(theme.palette.primary.main), flex: 1, minWidth: 0, mx: 0.5 }}>
            <MdSettings style={{ verticalAlign: 'middle', fontSize: 22, color: theme.palette.primary.main }} />
            <Box>
              <Typography variant="caption" color="text.secondary">Total Records</Typography>
              <Typography variant="h6" fontWeight="bold" color={theme.palette.primary.main}>{totalRecords}</Typography>
            </Box>
          </Paper>
          <Paper elevation={0} sx={{ ...statBoxStyle(theme.palette.info.main), flex: 1, minWidth: 0, mx: 0.5 }}>
            <MdAttachMoney style={{ verticalAlign: 'middle', fontSize: 22, color: theme.palette.info.main }} />
            <Box>
              <Typography variant="caption" color="text.secondary">Total RA</Typography>
              <Typography variant="h6" fontWeight="bold" color={theme.palette.info.main}>₱{totalRA.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Typography>
            </Box>
          </Paper>
          <Paper elevation={0} sx={{ ...statBoxStyle(theme.palette.warning.main), flex: 1, minWidth: 0, mx: 0.5 }}>
            <MdAttachMoney style={{ verticalAlign: 'middle', fontSize: 22, color: theme.palette.warning.main }} />
            <Box>
              <Typography variant="caption" color="text.secondary">Total TA</Typography>
              <Typography variant="h6" fontWeight="bold" color={theme.palette.warning.main}>₱{totalTA.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Typography>
            </Box>
          </Paper>
          <Paper elevation={0} sx={{ ...statBoxStyle(theme.palette.success.main), flex: 1, minWidth: 0, mx: 0.5 }}>
            <MdCalculate style={{ verticalAlign: 'middle', fontSize: 22, color: theme.palette.success.main }} />
            <Box>
              <Typography variant="caption" color="text.secondary">Total RATA</Typography>
              <Typography variant="h6" fontWeight="bold" color={theme.palette.success.main}>₱{totalRataAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Typography>
            </Box>
          </Paper>
          <Paper elevation={0} sx={{ ...statBoxStyle(theme.palette.info.main), flex: 1, minWidth: 0, mx: 0.5 }}>
            <MdCalculate style={{ verticalAlign: 'middle', fontSize: 22, color: theme.palette.info.main }} />
            <Box>
              <Typography variant="caption" color="text.secondary">Average RATA</Typography>
              <Typography variant="h6" fontWeight="bold" color={theme.palette.info.main}>₱{averageRata.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Typography>
            </Box>
          </Paper>
          <Paper elevation={0} sx={{ ...statBoxStyle(theme.palette.warning.main), flex: 1, minWidth: 0, mx: 0.5 }}>
            <MdTrendingUp style={{ verticalAlign: 'middle', fontSize: 22, color: theme.palette.warning.main }} />
            <Box>
              <Typography variant="caption" color="text.secondary">Highest Grade</Typography>
              <Typography variant="h6" fontWeight="bold" color={theme.palette.warning.main}>{highestGrade > 0 ? `SG-${highestGrade}` : "N/A"}</Typography>
            </Box>
          </Paper>
          {/* ✅ NEW: Linked RATA statistics */}
          <Paper elevation={0} sx={{ ...statBoxStyle(theme.palette.success.main), flex: 1, minWidth: 0, mx: 0.5 }}>
            <MdLink style={{ verticalAlign: 'middle', fontSize: 22, color: theme.palette.success.main }} />
            <Box>
              <Typography variant="caption" color="text.secondary">Linked to FY</Typography>
              <Typography variant="h6" fontWeight="bold" color={theme.palette.success.main}>{linkedCount}</Typography>
            </Box>
          </Paper>
          <Paper elevation={0} sx={{ ...statBoxStyle(theme.palette.primary.main), flex: 1, minWidth: 0, mx: 0.5 }}>
            <MdCalendarToday style={{ verticalAlign: 'middle', fontSize: 22, color: theme.palette.primary.main }} />
            <Box>
              <Typography variant="caption" color="text.secondary">Total FY Links</Typography>
              <Typography variant="h6" fontWeight="bold" color={theme.palette.primary.main}>{totalFYLinks}</Typography>
            </Box>
          </Paper>
        </Stack>
      </Box>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header Section */}
      <Paper
        sx={{
          p: 3,
          mb: 3,
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
          color: 'white'
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              RATA Settings
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9 }}>
              Manage Representation and Transportation Allowance rates by salary grade. Link them to specific fiscal years and budget types.
            </Typography>
          </Box>
          <Stack direction="row" spacing={2}>
            <Tooltip title="Export RATA Settings">
              <IconButton
                onClick={handleExport}
                sx={{
                  color: 'white',
                  backgroundColor: alpha('#fff', 0.1),
                  '&:hover': { backgroundColor: alpha('#fff', 0.2) }
                }}
              >
                <AiOutlineDownload />
              </IconButton>
            </Tooltip>
            <Tooltip title="Refresh Data">
              <IconButton
                onClick={() => refetch()}
                sx={{
                  color: 'white',
                  backgroundColor: alpha('#fff', 0.1),
                  '&:hover': { backgroundColor: alpha('#fff', 0.2) }
                }}
              >
                <AiOutlineReload />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>

      {/* Summary Cards */}
      {!rataLoading && <SummaryCards />}

      {/* Alert for no RATA records */}
      {!rataLoading && (!rataData?.ratas || rataData.ratas.length === 0) && (
        <Alert severity="info" sx={{ mb: 3 }}>
          No RATA records found. Please add RATA rates for different salary grades to enable proper allowance calculations.
        </Alert>
      )}

      {/* ✅ NEW: Info Alert for linking workflow */}
      {!rataLoading && rataData?.ratas && rataData.ratas.length > 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>Workflow:</strong> Create RATA rates independently (no fiscal year required),
            then link them to one or more fiscal year/budget type combinations. You can reuse the same RATA rate across multiple fiscal years.
          </Typography>
        </Alert>
      )}

      <Paper sx={{ p: 0, borderRadius: 2, overflow: 'hidden' }}>
        <CustomPage
          dataListName="ratas"
          schema={rataSchema}
          title="RATA Rates"
          description="Manage RATA rates"
          hasEdit={false} // We'll handle edit through additional menu options
          hasDelete={true}
          hasAdd={false} // We'll use custom add element
          additionalMenuOptions={[
            ...additionalMenuOptions,
            ({ row, parentClose }) => (
              <MenuItem
                key="edit-rata"
                onClick={() => {
                  handleEdit(row);
                  parentClose();
                }}
                sx={{ display: "flex", gap: 1 }}
              >
                <AiOutlineEdit />
                Edit RATA
              </MenuItem>
            )
          ]}
          customAddElement={
            <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
              <Button
                variant="contained"
                onClick={handleAddNew}
                startIcon={<AiOutlinePlus />}
                sx={{
                  background: `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${theme.palette.secondary.main} 90%)`,
                  boxShadow: `0 3px 5px 2px ${alpha(theme.palette.primary.main, 0.3)}`,
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: `0 6px 10px 4px ${alpha(theme.palette.primary.main, 0.3)}`
                  }
                }}
              >
                ADD RATA
              </Button>
              <Button
                variant="outlined"
                onClick={handleExport}
                startIcon={<AiOutlineDownload />}
                sx={{
                  borderColor: theme.palette.primary.main,
                  color: theme.palette.primary.main,
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                    borderColor: theme.palette.primary.dark
                  }
                }}
              >
                EXPORT
              </Button>
            </Stack>
          }
        />
      </Paper>

      {/* Enhanced Add/Edit Dialog */}
      <EnhancedRataDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        editData={selectedData}
      />

      {/* View Details Dialog */}
      <Dialog
        open={viewDialogOpen}
        onClose={handleViewDialogClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
          }
        }}
      >
        <DialogTitle
          sx={{
            background: 'linear-gradient(135deg, #264524 0%, #375e38 100%)',
            color: 'white',
            py: 3
          }}
        >
          <Typography variant="subtitle1" fontWeight="bold" component="div">
            RATA Details
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          {viewData && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Salary Grade
                  </Typography>
                  <Chip
                    label={`SG-${viewData.SG}`}
                    color="primary"
                    variant="outlined"
                    icon={<MdGrade />}
                    sx={{ mt: 1 }}
                  />
                </Box>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Monthly RATA
                </Typography>
                <Typography variant="h6" color="success.main" fontWeight="bold">
                  ₱{(parseFloat(viewData.RATA) || 0).toLocaleString('en-PH', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Annual RATA
                </Typography>
                <Typography variant="h6" color="success.main" fontWeight="bold">
                  ₱{((parseFloat(viewData.RATA) || 0) * 12).toLocaleString('en-PH', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Created Date
                </Typography>
                <Typography variant="body1">
                  {new Date(viewData.createdAt).toLocaleDateString()}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Last Updated
                </Typography>
                <Typography variant="body1">
                  {new Date(viewData.updatedAt).toLocaleDateString()}
                </Typography>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={handleViewDialogClose} variant="outlined">
            Close
          </Button>
          <Button
            onClick={() => {
              handleViewDialogClose();
              handleEdit(viewData);
            }}
            variant="contained"
            startIcon={<AiOutlineEdit />}
            sx={{
              background: 'linear-gradient(45deg, #264524 30%, #375e38 90%)',
              '&:hover': {
                background: 'linear-gradient(45deg, #1a2f1a 30%, #2a4a2b 90%)',
              }
            }}
          >
            Edit
          </Button>
        </DialogActions>
      </Dialog>

      {/* Link to Fiscal Years Dialog */}
      <LinkRATAToFiscalYearsDialog
        open={linkDialogOpen}
        onClose={handleLinkDialogClose}
        rataId={selectedForLinking?._id}
        rataName={selectedForLinking ? `SG-${selectedForLinking.SG}` : ""}
        onSaved={handleLinkDialogClose}
      />
    </Box>
  );
};

export default RataPage;
