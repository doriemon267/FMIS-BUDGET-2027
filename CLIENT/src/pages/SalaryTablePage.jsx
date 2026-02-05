import React, { useState, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
  Tooltip,
  Stack,
  Alert,
  alpha,
  Chip,
} from '@mui/material';
import TableContainer from '@mui/material/TableContainer';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  MdAttachMoney,
  MdTrendingUp,
  MdPeople,
  MdSettings,
  MdGrade,
} from 'react-icons/md';
import { AiOutlineDownload, AiOutlineReload } from 'react-icons/ai';
import { DataGrid } from '@mui/x-data-grid';
import { getSalaryTable } from '../services/mssqlService';
import { useDebounce } from '../utils/hooks';
import formatCurrency from '../utils/formatCurrency';

const SalaryTablePage = () => {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [showAllRows, setShowAllRows] = useState(false);
  const debouncedSearch = useDebounce(search, 350);
  const [filters, setFilters] = useState({
    StatusOfAppointment: '',
    SG: '',
    JG: '',
    Source: '',
    EncodedBy: '',
    MonthlyRate_min: '',
    MonthlyRate_max: '',
    DailyRate_min: '',
    DailyRate_max: '',
    EncodedDate_from: '',
    EncodedDate_to: '',
  });
  const debouncedFilters = useDebounce(filters, 350);
  const [sortModel, setSortModel] = useState([]);
  // Inspector removed

  const fetchData = async () => {
    try {
      setLoading(true);
      const offset = page * rowsPerPage;
      const limit = showAllRows ? (total >= 0 ? total : rowsPerPage) : rowsPerPage;
      const sortField = sortModel?.[0]?.field || null;
      const sortDir = sortModel?.[0]?.sort || null;
      const res = await getSalaryTable({ q: debouncedSearch, limit, offset, ...debouncedFilters, sortField, sortDir });
      // res expected format: { success, count, data }
      if (!res || !res.success) {
        throw new Error(res?.message || 'Unexpected response from server');
      }
      const data = res?.data || [];
      const count = typeof res?.count === 'number' ? res.count : (Array.isArray(data) ? data.length : -1);
      // DataGrid expects rows with `id` property - map accordingly
      const gridRows = (data || []).map(r => {
        const monthlyRaw = r.MonthlyRate ?? r.monthlyRate ?? r.Monthly ?? r.monthly ?? r.Monthly_Rate ?? r.monthly_rate;
        const dailyRaw = r.DailyRate ?? r.dailyRate ?? r.Daily ?? r.daily ?? r.Daily_Rate ?? r.daily_rate;
        const monthly = monthlyRaw !== undefined && monthlyRaw !== null && monthlyRaw !== '' ? Number(monthlyRaw) : null;
        let daily = dailyRaw !== undefined && dailyRaw !== null && dailyRaw !== '' ? Number(dailyRaw) : null;
        if ((daily === null || Number.isNaN(daily)) && monthly !== null && !Number.isNaN(monthly)) {
          // Compute daily from monthly on-demand; assume 22 working days
          daily = monthly / 22;
        }
        return {
          ...r,
          id: r.Id || r.id,
          MonthlyRate: monthly,
          DailyRate: daily,
        };
      });
      // If you want, I can keep these debug logs temporarily; currently removed for cleaner UI
      setRows(gridRows);
      setTotal(count);
    } catch (err) {
      console.error('Failed to fetch salary table', err);
      setRows([]);
      // show error details if available
      try { console.error('Server error details:', err.response?.data || err.message || err); } catch (_e) { /* noop: ignore logging failure */ }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, debouncedFilters, page, rowsPerPage, showAllRows]);

  // When the search changes, reset to first page
  useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  const handleRefresh = () => {
    fetchData();
  };

  const handleExport = () => {
    if (!rows.length && total <= 0) {
      alert('No data to export');
      return;
    }
    const headers = ['Status', 'SG', 'SG Step', 'JG', 'JG Step', 'Monthly Rate', 'Daily Rate', 'Source', 'Encoded By', 'Encoded Date'];
    const monthlyRaw = (r) => r.MonthlyRate ?? r.monthlyRate ?? r.Monthly ?? r.monthly;
    const dailyRaw = (r) => r.DailyRate ?? r.dailyRate ?? r.Daily ?? r.daily;
    const csvRows = [
      headers.join(','),
      ...rows.map((r) => {
        const monthly = monthlyRaw(r);
        const daily = dailyRaw(r) ?? (monthly != null ? Number(monthly) / 22 : '');
        return [
          r.StatusOfAppointment ?? '',
          r.SG ?? '',
          r.SG_Step ?? '',
          r.JG ?? '',
          r.JG_Step ?? '',
          monthly != null && monthly !== '' ? Number(monthly) : '',
          daily !== '' ? (typeof daily === 'number' ? daily : daily) : '',
          r.Source ?? '',
          r.EncodedBy ?? '',
          r.EncodedDate ? new Date(r.EncodedDate).toLocaleString() : '',
        ].join(',');
      }),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `salary-table-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Summary stats from current page (for display; server has full total)
  const totalRecords = total >= 0 ? total : rows.length;
  const monthlyRates = rows.map((r) => r.MonthlyRate ?? r.Monthly ?? r.monthlyRate).filter((v) => v != null && v !== '' && !Number.isNaN(Number(v)));
  const avgMonthly = monthlyRates.length ? monthlyRates.reduce((s, v) => s + Number(v), 0) / monthlyRates.length : 0;
  const sgValues = rows.map((r) => parseInt(r.SG, 10)).filter((n) => !Number.isNaN(n));
  const highestSG = sgValues.length ? Math.max(...sgValues) : null;
  const lowestSG = sgValues.length ? Math.min(...sgValues) : null;

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

  const theme = useTheme();

  const columns = [
    { field: 'Id', headerName: 'Id', width: 260, hide: true },
    {
      field: 'StatusOfAppointment',
      headerName: 'Status',
      width: 150,
      renderCell: (params) => (
        <Chip
          label={params.value || '—'}
          size="small"
          variant="outlined"
          color="default"
          sx={{ fontWeight: 500, fontSize: '0.75rem' }}
        />
      ),
    },
    {
      field: 'SG',
      headerName: 'SG',
      width: 100,
      type: 'number',
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <Chip
          label={params.value != null ? `SG-${params.value}` : '—'}
          color="primary"
          variant="outlined"
          size="small"
          icon={<MdGrade style={{ fontSize: 14 }} />}
          sx={{ fontWeight: 600 }}
        />
      ),
    },
    { field: 'SG_Step', headerName: 'SG Step', width: 100, type: 'number', align: 'center', headerAlign: 'center' },
    { field: 'JG', headerName: 'JG', width: 80, type: 'number', align: 'center', headerAlign: 'center' },
    { field: 'JG_Step', headerName: 'JG Step', width: 100, type: 'number', align: 'center', headerAlign: 'center' },
    {
      field: 'MonthlyRate',
      headerName: 'Monthly Rate',
      width: 150,
      type: 'number',
      align: 'right',
      headerAlign: 'right',
      valueGetter: (params) => {
        const monthlyRaw = params?.row?.MonthlyRate ?? params?.row?.monthlyRate ?? params?.row?.Monthly ?? params?.row?.monthly ?? params?.row?.Monthly_Rate ?? params?.row?.monthly_rate;
        if (monthlyRaw != null && monthlyRaw !== '') return monthlyRaw;
        const dailyRaw = params?.row?.DailyRate ?? params?.row?.dailyRate ?? params?.row?.Daily ?? params?.row?.daily ?? params?.row?.Daily_Rate ?? params?.row?.daily_rate;
        if (dailyRaw != null && dailyRaw !== '') {
          const dailyN = Number(dailyRaw);
          if (!Number.isNaN(dailyN)) return dailyN * 22;
        }
        return null;
      },
      valueFormatter: (params) => {
        const value = params?.value;
        if (value == null) return '—';
        const n = Number(value);
        if (Number.isNaN(n)) return String(value);
        return formatCurrency(n);
      },
      renderCell: (params) => {
        const v = params?.value ?? params?.row?.MonthlyRate ?? params?.row?.monthlyRate ?? params?.row?.Monthly ?? params?.row?.monthly;
        if (v == null) return '—';
        const n = Number(v);
        if (Number.isNaN(n)) return String(v);
        return (
          <Typography variant="body2" fontWeight="600" color="success.main" sx={{ whiteSpace: 'nowrap' }}>
            {formatCurrency(n)}
          </Typography>
        );
      },
    },
    {
      field: 'DailyRate',
      headerName: 'Daily Rate',
      width: 150,
      type: 'number',
      align: 'right',
      headerAlign: 'right',
      valueGetter: (params) => params?.row?.DailyRate ?? params?.row?.dailyRate ?? params?.row?.Daily ?? params?.row?.daily,
      valueFormatter: (params) => {
        let value = params?.value;
        if (value == null) {
          const monthly = params?.row?.MonthlyRate ?? params?.row?.monthlyRate ?? params?.row?.Monthly ?? params?.row?.monthly;
          if (monthly != null && monthly !== '') {
            const n2 = Number(monthly);
            if (!Number.isNaN(n2)) return formatCurrency(n2 / 22);
          }
          return '—';
        }
        const n = Number(value);
        if (Number.isNaN(n)) return String(value);
        return formatCurrency(n);
      },
      renderCell: (params) => {
        const v = params?.value;
        if (v == null) {
          const monthly = params?.row?.MonthlyRate ?? params?.row?.monthlyRate ?? params?.row?.Monthly ?? params?.row?.monthly;
          if (monthly != null && monthly !== '') {
            const n2 = Number(monthly);
            if (!Number.isNaN(n2)) {
              return (
                <Typography variant="body2" fontWeight="500" color="info.main" sx={{ whiteSpace: 'nowrap' }}>
                  {formatCurrency(n2 / 22)}
                </Typography>
              );
            }
          }
          return '—';
        }
        const n = Number(v);
        if (Number.isNaN(n)) return String(v);
        return (
          <Typography variant="body2" fontWeight="500" color="info.main" sx={{ whiteSpace: 'nowrap' }}>
            {formatCurrency(n)}
          </Typography>
        );
      },
    },
    { field: 'Source', headerName: 'Source', width: 140 },
    { field: 'EncodedBy', headerName: 'Encoded By', width: 120 },
    {
      field: 'EncodedDate',
      headerName: 'Encoded Date',
      width: 165,
      renderCell: (params) => (
        <Typography variant="body2" color="text.secondary">
          {params.value ? new Date(params.value).toLocaleString() : '—'}
        </Typography>
      ),
    },
    { field: 'ModifiedBy', headerName: 'Modified By', width: 120 },
    {
      field: 'ModifiedDate',
      headerName: 'Modified Date',
      width: 165,
      renderCell: (params) => (
        <Typography variant="body2" color="text.secondary">
          {params.value ? new Date(params.value).toLocaleString() : '—'}
        </Typography>
      ),
    },
  ];

  const SummaryCards = () => (
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
            <Typography variant="caption" color="text.secondary">Avg Monthly (page)</Typography>
            <Typography variant="h6" fontWeight="bold" color={theme.palette.info.main}>
              {avgMonthly > 0 ? formatCurrency(avgMonthly) : '—'}
            </Typography>
          </Box>
        </Paper>
        <Paper elevation={0} sx={{ ...statBoxStyle(theme.palette.warning.main), flex: 1, minWidth: 0, mx: 0.5 }}>
          <MdTrendingUp style={{ verticalAlign: 'middle', fontSize: 22, color: theme.palette.warning.main }} />
          <Box>
            <Typography variant="caption" color="text.secondary">Highest SG</Typography>
            <Typography variant="h6" fontWeight="bold" color={theme.palette.warning.main}>
              {highestSG != null ? `SG-${highestSG}` : '—'}
            </Typography>
          </Box>
        </Paper>
        <Paper elevation={0} sx={{ ...statBoxStyle(theme.palette.success.main), flex: 1, minWidth: 0, mx: 0.5 }}>
          <MdGrade style={{ verticalAlign: 'middle', fontSize: 22, color: theme.palette.success.main }} />
          <Box>
            <Typography variant="caption" color="text.secondary">Lowest SG</Typography>
            <Typography variant="h6" fontWeight="bold" color={theme.palette.success.main}>
              {lowestSG != null ? `SG-${lowestSG}` : '—'}
            </Typography>
          </Box>
        </Paper>
        <Paper elevation={0} sx={{ ...statBoxStyle(theme.palette.info.main), flex: 1, minWidth: 0, mx: 0.5 }}>
          <MdPeople style={{ verticalAlign: 'middle', fontSize: 22, color: theme.palette.info.main }} />
          <Box>
            <Typography variant="caption" color="text.secondary">Showing</Typography>
            <Typography variant="h6" fontWeight="bold" color={theme.palette.info.main}>
              {rows.length} of {total >= 0 ? total : '…'}
            </Typography>
          </Box>
        </Paper>
      </Stack>
    </Box>
  );

  return (
    <Box sx={{ p: 3 }}>
      {/* Header – same style as Rata page */}
      <Paper
        sx={{
          p: 3,
          mb: 3,
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
          color: 'white',
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
          <Box>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              Salary Table
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9 }}>
              View and search salary grades, monthly and daily rates from the salary table. Export data for reporting.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <TextField
              size="small"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{
                width: 220,
                '& .MuiOutlinedInput-root': {
                  backgroundColor: alpha('#fff', 0.15),
                  color: 'white',
                  '& fieldset': { borderColor: alpha('#fff', 0.3) },
                  '&:hover fieldset': { borderColor: alpha('#fff', 0.5) },
                },
                '& .MuiInputBase-input::placeholder': { color: alpha('#fff', 0.8) },
              }}
            />
            <Tooltip title="Export CSV">
              <IconButton
                onClick={handleExport}
                sx={{
                  color: 'white',
                  backgroundColor: alpha('#fff', 0.1),
                  '&:hover': { backgroundColor: alpha('#fff', 0.2) },
                }}
              >
                <AiOutlineDownload />
              </IconButton>
            </Tooltip>
            <Tooltip title="Refresh">
              <IconButton
                onClick={handleRefresh}
                sx={{
                  color: 'white',
                  backgroundColor: alpha('#fff', 0.1),
                  '&:hover': { backgroundColor: alpha('#fff', 0.2) },
                }}
              >
                <AiOutlineReload />
              </IconButton>
            </Tooltip>
            <Tooltip title={showAllRows ? 'Showing all rows' : 'Show all rows'}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => setShowAllRows((s) => !s)}
                sx={{
                  borderColor: alpha('#fff', 0.6),
                  color: 'white',
                  '&:hover': { borderColor: 'white', backgroundColor: alpha('#fff', 0.1) },
                }}
              >
                {showAllRows ? 'All rows' : 'Show all'}
              </Button>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>

      {/* Summary cards – same layout as Rata */}
      {!loading && <SummaryCards />}

      {/* Empty state */}
      {!loading && total >= 0 && total === 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          No salary table records found. Adjust search or filters, or ensure data is loaded from the source.
        </Alert>
      )}

      {/* Table in Paper – enhanced look */}
      <Paper
        sx={{
          p: 0,
          borderRadius: 2,
          overflow: 'hidden',
          boxShadow: `0 4px 20px ${alpha(theme.palette.common.black, 0.08)}`,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box
          sx={{
            px: 2,
            py: 1.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: alpha(theme.palette.primary.main, 0.04),
          }}
        >
          <Typography variant="subtitle1" fontWeight="600" color="text.secondary">
            Salary rates
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Page size: {showAllRows ? (total >= 0 ? total : rows.length) : rowsPerPage}
          </Typography>
        </Box>
        <TableContainer>
          <Box sx={{ height: 620, width: '100%' }}>
            <DataGrid
              rows={rows}
              columns={columns}
              page={page}
              pageSize={showAllRows ? (total >= 0 ? total : rows.length) : rowsPerPage}
              rowCount={total >= 0 ? total : rows.length}
              paginationMode="server"
              onPageChange={(newPage) => setPage(newPage)}
              onPageSizeChange={(newSize) => setRowsPerPage(newSize)}
              sortingMode="server"
              sortModel={sortModel}
              onSortModelChange={(newModel) => {
                setSortModel(newModel);
                setPage(0);
              }}
              loading={loading}
              initialState={{
                columns: {
                  visibilityModel: {
                    Id: false,
                    MonthlyRate: true,
                    DailyRate: true,
                  },
                },
              }}
              sx={{
                border: 'none',
                '& .MuiDataGrid-main': {
                  border: 'none',
                },
                '& .MuiDataGrid-columnHeaders': {
                  minHeight: '52px !important',
                  maxHeight: '52px !important',
                  backgroundColor: '#375e38 !important',
                  color: '#ffffff !important',
                  borderBottom: '2px solid rgba(0,0,0,0.12)',
                  backgroundImage: 'linear-gradient(180deg, #3d6b3e 0%, #375e38 100%)',
                  boxShadow: `0 2px 8px ${alpha('#375e38', 0.4)}`,
                },
                '& .MuiDataGrid-columnHeader': {
                  backgroundColor: 'transparent !important',
                  paddingLeft: 2,
                  paddingRight: 2,
                  '&:focus, &:focus-within': { outline: 'none' },
                },
                '& .MuiDataGrid-columnHeaderTitle': {
                  fontWeight: 700,
                  letterSpacing: 0.3,
                  textTransform: 'none',
                  color: '#ffffff !important',
                  fontSize: '0.8125rem',
                },
                '& .MuiDataGrid-columnSeparator': {
                  backgroundColor: 'rgba(255,255,255,0.2) !important',
                },
                '& .MuiDataGrid-cell': {
                  color: theme.palette.text.primary,
                  borderBottom: '1px solid',
                  borderColor: alpha(theme.palette.divider, 0.6),
                  borderRight: '1px solid',
                  borderRightColor: alpha(theme.palette.divider, 0.3),
                  py: 1.5,
                  fontSize: '0.8125rem',
                  '&:last-of-type': { borderRight: 'none' },
                  '&:focus': { outline: 'none' },
                },
                '& .MuiDataGrid-row': {
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.06) + ' !important',
                  },
                },
                '& .MuiDataGrid-row:nth-of-type(even)': {
                  backgroundColor: alpha(theme.palette.action.hover, 0.3),
                },
                '& .MuiDataGrid-row:nth-of-type(even):hover': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.08) + ' !important',
                },
                '& .MuiDataGrid-cell:focus, & .MuiDataGrid-columnHeader:focus': {
                  outline: 'none',
                },
                '& .MuiDataGrid-footerContainer': {
                  minHeight: 52,
                  borderTop: '2px solid',
                  borderColor: 'divider',
                  backgroundColor: alpha(theme.palette.grey[500], 0.06),
                  '& .MuiTablePagination-root': {
                    color: theme.palette.text.secondary,
                  },
                  '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                    fontSize: '0.8125rem',
                  },
                },
              }}
              getRowId={(row) => row.id}
              disableColumnFilter={false}
              density="comfortable"
              rowsPerPageOptions={[10, 20, 50, 100]}
            />
          </Box>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default SalaryTablePage;
