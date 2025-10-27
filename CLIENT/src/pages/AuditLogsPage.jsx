import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Paper,
  Stack,
  Alert,
  Chip,
  IconButton,
  Tooltip,
  TextField,
  MenuItem,
  Grid,
  useTheme,
  alpha
} from "@mui/material";
import {
  MdHistory,
  MdPerson,
  MdSearch,
  MdRefresh,
  MdFilterList,
  MdDateRange,
  MdAssignment
} from "react-icons/md";
import { useQuery } from "@tanstack/react-query";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { DataGrid } from "@mui/x-data-grid";
import { format } from "date-fns";
import DashboardHeader from "../global/components/DashboardHeader";
import { getProposalAuditLogs, getUserActivityLogs, getMyActivityLogs } from "../services/auditService";
import { useUser } from "../context/UserContext";

const AuditLogsPage = () => {
  const theme = useTheme();
  const { currentUser } = useUser();
  const [viewMode, setViewMode] = useState('all'); // 'all', 'proposal', 'user'
  const [selectedProposalId, setSelectedProposalId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [entityType, setEntityType] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  // Query for audit logs based on view mode
  const { data: auditData, isLoading, error, refetch } = useQuery({
    queryKey: ["auditLogs", viewMode, selectedProposalId, selectedUserId, startDate, endDate, entityType, page, pageSize],
    queryFn: async () => {
      const options = {
        startDate: startDate ? format(startDate, 'yyyy-MM-dd') : undefined,
        endDate: endDate ? format(endDate, 'yyyy-MM-dd') : undefined,
        entityType: entityType || undefined,
        limit: pageSize,
        page: page + 1
      };

      if (viewMode === 'proposal' && selectedProposalId) {
        return await getProposalAuditLogs(selectedProposalId, options);
      } else if (viewMode === 'user' && selectedUserId) {
        return await getUserActivityLogs(selectedUserId, options);
      } else {
        // Default to current user's activity
        return await getMyActivityLogs(options);
      }
    },
    enabled: viewMode !== 'proposal' || !!selectedProposalId,
    keepPreviousData: true
  });

  const handleRefresh = () => {
    refetch();
  };

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    setSelectedProposalId('');
    setSelectedUserId('');
    setPage(0);
  };

  // DataGrid columns
  const columns = [
    {
      field: 'timestamp',
      headerName: 'Date & Time',
      width: 180,
      valueFormatter: (params) => format(new Date(params.value), 'MMM dd, yyyy HH:mm:ss')
    },
    {
      field: 'user',
      headerName: 'User',
      width: 200,
      valueGetter: (params) => params.row.user?.name || 'Unknown',
      renderCell: (params) => (
        <Box>
          <Typography variant="body2" fontWeight="medium">
            {params.row.user?.name || 'Unknown'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {params.row.user?.role || ''}
          </Typography>
        </Box>
      )
    },
    {
      field: 'action',
      headerName: 'Action',
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          color={getActionColor(params.value)}
          variant="outlined"
          sx={{
            color: getActionTextColor(params.value),
            borderColor: getActionColor(params.value),
            backgroundColor: alpha(getActionColor(params.value), 0.1)
          }}
        />
      )
    },
    {
      field: 'entity',
      headerName: 'Entity',
      width: 120,
      valueGetter: (params) => params.row.entity || 'Unknown'
    },
    {
      field: 'summary',
      headerName: 'Summary',
      width: 250,
      renderCell: (params) => (
        <Tooltip title={params.value || 'No summary'}>
          <Typography variant="body2" noWrap>
            {params.value || 'No summary'}
          </Typography>
        </Tooltip>
      )
    },
    {
      field: 'changes',
      headerName: 'Field Changes',
      width: 200,
      renderCell: (params) => {
        const changes = params.value || [];
        if (changes.length === 0) {
          return <Typography variant="body2" color="text.secondary">No field changes</Typography>;
        }

        return (
          <Box>
            <Typography variant="body2" fontWeight="medium">
              {changes.length} field{changes.length !== 1 ? 's' : ''} changed
            </Typography>
            <Stack direction="row" spacing={0.5} flexWrap="wrap">
              {changes.slice(0, 2).map((change, index) => (
                <Chip
                  key={index}
                  label={`${change.field}: ${change.oldValue || 'null'} → ${change.newValue || 'null'}`}
                  size="small"
                  variant="outlined"
                  sx={{
                    fontSize: '0.7rem',
                    height: '20px',
                    borderColor: theme.palette.secondary.main,
                    color: theme.palette.secondary.main
                  }}
                />
              ))}
              {changes.length > 2 && (
                <Chip
                  label={`+${changes.length - 2} more`}
                  size="small"
                  variant="outlined"
                  sx={{
                    fontSize: '0.7rem',
                    height: '20px',
                    borderColor: theme.palette.secondary.main,
                    color: theme.palette.secondary.main
                  }}
                />
              )}
            </Stack>
          </Box>
        );
      }
    },
    {
      field: 'proposalId',
      headerName: 'Proposal ID',
      width: 220,
      renderCell: (params) => (
        <Tooltip title={params.value}>
          <Typography variant="body2" fontFamily="monospace" noWrap>
            {params.value ? `${params.value.substring(0, 8)}...` : 'N/A'}
          </Typography>
        </Tooltip>
      )
    }
  ];

  const getActionColor = (action) => {
    switch (action?.toUpperCase()) {
      case 'CREATE': return theme.palette.success.main;
      case 'UPDATE': return theme.palette.primary.main;
      case 'DELETE': return theme.palette.error.main;
      case 'STATUS_CHANGE': return theme.palette.warning.main;
      case 'BULK_EDIT': return theme.palette.info.main;
      default: return theme.palette.grey[500];
    }
  };

  const getActionTextColor = (action) => {
    switch (action?.toUpperCase()) {
      case 'CREATE': return theme.palette.success.main;
      case 'UPDATE': return theme.palette.primary.main;
      case 'DELETE': return theme.palette.error.main;
      case 'STATUS_CHANGE': return theme.palette.warning.main;
      case 'BULK_EDIT': return theme.palette.info.main;
      default: return theme.palette.grey[700];
    }
  };

  const logs = auditData?.data?.logs || [];
  const totalCount = auditData?.data?.total || 0;

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: 3 }}>
        {/* Header using DashboardHeader component */}
        <DashboardHeader
          title="Audit Logs"
          description="View detailed audit trails of all changes made to proposals and budget data"
          searchable={false}
          childElement={
            <Button
              variant="contained"
              onClick={handleRefresh}
              startIcon={<MdRefresh />}
              sx={{
                backgroundColor: theme.palette.secondary.main,
                '&:hover': {
                  backgroundColor: theme.palette.primary.main,
                }
              }}
            >
              Refresh
            </Button>
          }
        />

        {/* Filters and Controls */}
        <Paper
          sx={{
            p: 3,
            mb: 3,
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
          }}
        >
          <Grid container spacing={2} alignItems="center">
            {/* View Mode Selection */}
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                select
                fullWidth
                label="View Mode"
                value={viewMode}
                onChange={(e) => handleViewModeChange(e.target.value)}
                size="small"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': {
                      borderColor: alpha(theme.palette.primary.main, 0.3),
                    },
                    '&:hover fieldset': {
                      borderColor: theme.palette.primary.main,
                    },
                  },
                }}
              >
                <MenuItem value="all">My Activity</MenuItem>
                <MenuItem value="proposal">By Proposal</MenuItem>
                <MenuItem value="user">By User</MenuItem>
              </TextField>
            </Grid>

            {/* Proposal ID Input (when proposal mode) */}
            {viewMode === 'proposal' && (
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  label="Proposal ID"
                  value={selectedProposalId}
                  onChange={(e) => setSelectedProposalId(e.target.value)}
                  placeholder="Enter proposal ID"
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': {
                        borderColor: alpha(theme.palette.primary.main, 0.3),
                      },
                      '&:hover fieldset': {
                        borderColor: theme.palette.primary.main,
                      },
                    },
                  }}
                />
              </Grid>
            )}

            {/* User ID Input (when user mode) */}
            {viewMode === 'user' && (
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  label="User ID"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  placeholder="Enter user ID"
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': {
                        borderColor: alpha(theme.palette.primary.main, 0.3),
                      },
                      '&:hover fieldset': {
                        borderColor: theme.palette.primary.main,
                      },
                    },
                  }}
                />
              </Grid>
            )}

            {/* Entity Type Filter */}
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                select
                fullWidth
                label="Entity Type"
                value={entityType}
                onChange={(e) => setEntityType(e.target.value)}
                size="small"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': {
                      borderColor: alpha(theme.palette.primary.main, 0.3),
                    },
                    '&:hover fieldset': {
                      borderColor: theme.palette.primary.main,
                    },
                  },
                }}
              >
                <MenuItem value="">All Types</MenuItem>
                <MenuItem value="Proposal">Proposal</MenuItem>
                <MenuItem value="Income">Income</MenuItem>
                <MenuItem value="PersonnelServices">Personnel Services</MenuItem>
                <MenuItem value="MOOE">MOOE</MenuItem>
                <MenuItem value="CapitalOutlay">Capital Outlay</MenuItem>
              </TextField>
            </Grid>

            {/* Date Range */}
            <Grid item xs={12} sm={6} md={2}>
              <DatePicker
                label="Start Date"
                value={startDate}
                onChange={setStartDate}
                slotProps={{
                  textField: {
                    size: 'small',
                    fullWidth: true,
                    sx: {
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': {
                          borderColor: alpha(theme.palette.primary.main, 0.3),
                        },
                        '&:hover fieldset': {
                          borderColor: theme.palette.primary.main,
                        },
                      },
                    }
                  }
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <DatePicker
                label="End Date"
                value={endDate}
                onChange={setEndDate}
                slotProps={{
                  textField: {
                    size: 'small',
                    fullWidth: true,
                    sx: {
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': {
                          borderColor: alpha(theme.palette.primary.main, 0.3),
                        },
                        '&:hover fieldset': {
                          borderColor: theme.palette.primary.main,
                        },
                      },
                    }
                  }
                }}
              />
            </Grid>

            {/* Refresh Button */}
            <Grid item xs={12} sm={6} md={2}>
              <Button
                variant="outlined"
                onClick={handleRefresh}
                startIcon={<MdRefresh />}
                fullWidth
                size="small"
              >
                Refresh
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* Results Summary */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" gutterBottom sx={{ color: theme.palette.primary.main }}>
            Audit Log Entries
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Showing {logs.length} of {totalCount} entries
            {viewMode === 'proposal' && selectedProposalId && ` for proposal ${selectedProposalId}`}
            {viewMode === 'user' && selectedUserId && ` for user ${selectedUserId}`}
          </Typography>
        </Box>

        {/* Data Grid */}
        <Paper
          sx={{
            height: 600,
            width: '100%',
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
            '& .MuiDataGrid-root': {
              border: 'none',
            }
          }}
        >
          <DataGrid
            rows={logs}
            columns={columns}
            loading={isLoading}
            pageSize={pageSize}
            page={page}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            rowsPerPageOptions={[10, 25, 50, 100]}
            pagination
            paginationMode="server"
            rowCount={totalCount}
            getRowId={(row) => row.id}
            disableSelectionOnClick
            sx={{
              border: 0,
              '& .MuiDataGrid-cell': {
                borderBottom: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
                '&:focus': {
                  outline: 'none',
                },
              },
              '& .MuiDataGrid-columnHeaders': {
                backgroundColor: theme.palette.secondary.main,
                color: theme.palette.secondary.contrastText,
                borderBottom: `2px solid ${theme.palette.primary.main}`,
                '& .MuiDataGrid-columnHeaderTitle': {
                  fontWeight: 'bold',
                },
              },
              '& .MuiDataGrid-row:hover': {
                backgroundColor: alpha(theme.palette.primary.main, 0.04),
              },
              '& .MuiDataGrid-footerContainer': {
                backgroundColor: theme.palette.background.paper,
                borderTop: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
              },
              '& .MuiTablePagination-root': {
                color: theme.palette.text.primary,
              },
            }}
          />
        </Paper>

        {/* Error Display */}
        {error && (
          <Alert
            severity="error"
            sx={{
              mt: 2,
              backgroundColor: alpha(theme.palette.error.main, 0.1),
              border: `1px solid ${theme.palette.error.main}`,
              color: theme.palette.error.main
            }}
          >
            Failed to load audit logs: {error.message}
          </Alert>
        )}
      </Box>
    </LocalizationProvider>
  );
};

export default AuditLogsPage;