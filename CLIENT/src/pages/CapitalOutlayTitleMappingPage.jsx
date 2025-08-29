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
  MenuItem
} from "@mui/material";
import { 
  MdAccountBalance, 
  MdCode, 
  MdCategory, 
  MdSettings,
  MdMap,
  MdTrendingUp
} from "react-icons/md";
import { 
  AiOutlineEdit, 
  AiOutlineEye,
  AiOutlineDownload,
  AiOutlineReload,
  AiOutlinePlus
} from "react-icons/ai";
import { useQuery } from "@tanstack/react-query";
import CustomPage from "../global/components/CustomPage";
import EnhancedTitleMappingDialog from "../components/capitaloutlay/EnhancedTitleMappingDialog";
import api from "../config/api";

const CapitalOutlayTitleMappingPage = () => {
  const theme = useTheme();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedData, setSelectedData] = useState(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewData, setViewData] = useState(null);
  
  // Fetch title mappings data for summary cards
  const { data: titleMappingData, isLoading: titleMappingLoading, refetch } = useQuery({
    queryKey: ["title-mappings"],
    queryFn: async () => {
      try {
        const response = await api.get("/title-mappings/capital-outlay");
        return response.data;
      } catch (error) {
        console.error("Error fetching title mappings:", error);
        // Return empty structure if API fails
        return { titleMappings: [] };
      }
    },
  });

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
    refetch(); // Refresh data after dialog closes
  };

  const handleViewDialogClose = () => {
    setViewDialogOpen(false);
    setViewData(null);
  };

  const handleExport = () => {
    // Export functionality - convert data to CSV
    if (!titleMappingData?.titleMappings || titleMappingData.titleMappings.length === 0) {
      alert("No data to export");
      return;
    }

    const csvData = [
      ["Subline Item", "Accounting Title", "UACS Code", "Account Class", "Line Item", "Created Date"],
      ...titleMappingData.titleMappings
        .map(row => [
          row.sublineItem || "",
          row.accountingTitle || "",
          row.uacsCode || "",
          row.accountClass || "",
          row.lineItem || "",
          new Date(row.createdAt).toLocaleDateString()
        ])
    ];

    const csvContent = csvData.map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `capital-outlay-title-mapping-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Enhanced schema with better formatting - let CustomPage handle actions
  const titleMappingSchema = {
    action: {
      type: "action",
      label: "Actions",
    },
    sublineItem: {
      type: "text",
      label: "Subline Item",
      required: true,
      searchable: true,
      show: true,
      customRender: (row) => (
        <Chip 
          label={row.sublineItem || "N/A"} 
          color="primary"
          variant="outlined"
          size="small"
          icon={<MdCategory />}
        />
      )
    },
    accountingTitle: {
      type: "text",
      label: "Accounting Title",
      required: true,
      searchable: true,
      show: true,
      customRender: (row) => (
        <Typography variant="body2" fontWeight="medium" color="text.primary">
          {row.accountingTitle || "N/A"}
        </Typography>
      )
    },
    uacsCode: {
      type: "text",
      label: "UACS Code",
      required: true,
      searchable: true,
      show: true,
      customRender: (row) => (
        <Chip 
          label={row.uacsCode || "N/A"} 
          color="success"
          variant="filled"
          size="small"
          icon={<MdCode />}
        />
      )
    },
    accountClass: {
      type: "text",
      label: "Account Class",
      show: true,
      customRender: (row) => (
        <Chip 
          label={row.accountClass || "N/A"} 
          color="info"
          variant="outlined"
          size="small"
        />
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
        key="edit-mapping"
        onClick={() => {
          handleEdit(row);
          parentClose();
        }}
        sx={{ display: "flex", gap: 1 }}
      >
        <AiOutlineEdit />
        Edit Mapping
      </MenuItem>
    )
  ];

  // Summary Cards Component
  const SummaryCards = () => {
    const capitalOutlayMappings = titleMappingData?.titleMappings || [];

    const totalMappings = capitalOutlayMappings.length;
    const uniqueSublineItems = [...new Set(capitalOutlayMappings.map(item => item.sublineItem))].length;
    const uniqueUacsCodes = [...new Set(capitalOutlayMappings.map(item => item.uacsCode))].length;
    const recentMappings = capitalOutlayMappings.filter(
      item => new Date(item.createdAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    ).length;
    
    const summaryData = [
      {
        title: "Total Mappings",
        value: totalMappings,
        icon: <MdMap />,
        color: theme.palette.primary.main,
        bgColor: alpha(theme.palette.primary.main, 0.1)
      },
      {
        title: "Subline Items",
        value: uniqueSublineItems,
        icon: <MdCategory />,
        color: theme.palette.success.main,
        bgColor: alpha(theme.palette.success.main, 0.1)
      },
      {
        title: "UACS Codes",
        value: uniqueUacsCodes,
        icon: <MdCode />,
        color: theme.palette.info.main,
        bgColor: alpha(theme.palette.info.main, 0.1)
      },
      {
        title: "Recent Mappings",
        value: recentMappings,
        icon: <MdTrendingUp />,
        color: theme.palette.warning.main,
        bgColor: alpha(theme.palette.warning.main, 0.1)
      }
    ];

    return (
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {summaryData.map((item, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card 
              sx={{ 
                height: '100%',
                background: `linear-gradient(135deg, ${item.bgColor} 0%, ${alpha(item.color, 0.05)} 100%)`,
                border: `1px solid ${alpha(item.color, 0.2)}`,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: `0 8px 25px ${alpha(item.color, 0.3)}`,
                  border: `1px solid ${alpha(item.color, 0.4)}`
                }
              }}
            >
              <CardContent sx={{ p: 2 }}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      backgroundColor: item.color,
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.5rem'
                    }}
                  >
                    {item.icon}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                      {item.title}
                    </Typography>
                    <Typography variant="h6" fontWeight="bold" color={item.color}>
                      {item.value}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
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
              Capital Outlay Title Mapping
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9 }}>
              Manage subline items, accounting titles, and UACS code mappings for capital outlay
            </Typography>
          </Box>
          <Stack direction="row" spacing={2}>
            <Tooltip title="Export Title Mappings">
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
      {!titleMappingLoading && <SummaryCards />}

      {/* Alert for no mappings */}
      {!titleMappingLoading && (!titleMappingData?.titleMappings || titleMappingData.titleMappings.length === 0) && (
        <Alert severity="info" sx={{ mb: 3 }}>
          No title mappings found. Please add mappings to enable proper capital outlay categorization.
        </Alert>
      )}

      {/* Loading state */}
      {titleMappingLoading && (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography>Loading title mappings...</Typography>
        </Paper>
      )}

      {/* Main content - only show when not loading */}
      {!titleMappingLoading && (
        <Paper sx={{ p: 0, borderRadius: 2, overflow: 'hidden' }}>
          <CustomPage
            dataListName="title-mappings"
            schema={titleMappingSchema}
            title=""
            description=""
            hasEdit={false} // We'll handle edit through additional menu options
            hasDelete={true}
            hasAdd={true} // Enable add functionality
            additionalMenuOptions={additionalMenuOptions}
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
                  ADD TITLE MAPPING
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
      )}

      {/* Enhanced Add/Edit Dialog */}
      <EnhancedTitleMappingDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        editData={selectedData}
      />
    </Box>
  );
};

export default CapitalOutlayTitleMappingPage;
