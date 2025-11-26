import React, { useState, useEffect } from 'react';
// Inspector removed; no dialog imports
import { useTheme } from '@mui/material/styles';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
  Tooltip,
} from '@mui/material';
import TableContainer from '@mui/material/TableContainer';
import RefreshIcon from '@mui/icons-material/Refresh';
import { DataGrid } from '@mui/x-data-grid';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
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

  // onPageChange and onPageSizeChange are implemented inline in the DataGrid props.

  const columns = [
    { field: 'Id', headerName: 'Id', width: 260, hide: true },
    { field: 'StatusOfAppointment', headerName: 'Status', width: 140 },
    { field: 'SG', headerName: 'SG', width: 80, type: 'number', align: 'right', headerAlign: 'right' },
    { field: 'SG_Step', headerName: 'SG Step', width: 100, type: 'number' },
    { field: 'JG', headerName: 'JG', width: 80, type: 'number' },
    { field: 'JG_Step', headerName: 'JG Step', width: 100, type: 'number' },
    { field: 'MonthlyRate', headerName: 'Monthly Rate', width: 140, type: 'number', align: 'right', headerAlign: 'right',
      valueGetter: (params) => {
        const monthlyRaw = params?.row?.MonthlyRate ?? params?.row?.monthlyRate ?? params?.row?.Monthly ?? params?.row?.monthly ?? params?.row?.Monthly_Rate ?? params?.row?.monthly_rate;
        if (monthlyRaw != null && monthlyRaw !== '') return monthlyRaw;
        // Fallback: if daily exists, compute monthly
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
        return <span style={{ whiteSpace: 'nowrap' }}>{formatCurrency(n)}</span>;
      }
    },
    { field: 'DailyRate', headerName: 'Daily Rate', width: 140, type: 'number', align: 'right', headerAlign: 'right',
      valueGetter: (params) => params?.row?.DailyRate ?? params?.row?.dailyRate ?? params?.row?.Daily ?? params?.row?.daily,
      valueFormatter: (params) => {
        let value = params?.value;
        if (value == null) {
          // Fallback: compute daily rate from MonthlyRate when available (Assume 22 working days)
          const monthly = params?.row?.MonthlyRate ?? params?.row?.monthlyRate ?? params?.row?.Monthly ?? params?.row?.monthly;
          if (monthly != null && monthly !== '') {
            const n2 = Number(monthly);
            if (!Number.isNaN(n2)) {
              return formatCurrency(n2 / 22);
            }
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
            if (!Number.isNaN(n2)) return <span style={{ whiteSpace: 'nowrap' }}>{formatCurrency(n2 / 22)}</span>;
          }
          return '—';
        }
        const n = Number(v);
        if (Number.isNaN(n)) return String(v);
        return <span style={{ whiteSpace: 'nowrap' }}>{formatCurrency(n)}</span>;
      }
    },
    { field: 'Source', headerName: 'Source', width: 140 },
    { field: 'EncodedBy', headerName: 'Encoded By', width: 120 },
    { field: 'EncodedDate', headerName: 'Encoded Date', width: 160, valueFormatter: (params) => {
      const value = params?.value;
      return value ? new Date(value).toLocaleString() : '';
    } },
    { field: 'ModifiedBy', headerName: 'Modified By', width: 120 },
    { field: 'ModifiedDate', headerName: 'Modified Date', width: 160, valueFormatter: (params) => {
      const value = params?.value;
      return value ? new Date(value).toLocaleString() : '';
    } },
    // inspector column removed
  ];

  const theme = useTheme();

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h4">Salary Table</Typography>
          <Box>
            <TextField
              size="small"
              placeholder="Search across all columns"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ mr: 1, width: 300 }}
            />
            <Tooltip title="Refresh">
              <IconButton onClick={handleRefresh}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title={showAllRows ? 'Showing all rows' : 'Show all rows'}>
              <Button sx={{ ml: 1 }} size='small' variant='outlined' onClick={() => setShowAllRows(s => !s)}>
                {showAllRows ? 'All rows' : 'Show all'}
              </Button>
            </Tooltip>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
          <Typography variant='body2' color='text.secondary'>
            Showing {rows.length} of {total >= 0 ? total : 'unknown'} rows
          </Typography>
          <Typography variant='body2' color='text.secondary'>
            Page size: {showAllRows ? (total >= 0 ? total : rows.length) : rowsPerPage}
          </Typography>
        </Box>
      </Paper>
      {/* Filters removed by request */}
      <Paper sx={{ borderTop: '4px solid #375e38' }}>
        <TableContainer>
          <div style={{ height: 600, width: '100%' }}>
          <DataGrid
            rows={rows}
            columns={columns}
            page={page}
            pageSize={showAllRows ? (total >= 0 ? total : rows.length) : rowsPerPage}
            rowCount={total >= 0 ? total : rows.length}
            paginationMode='server'
            onPageChange={(newPage) => setPage(newPage)}
            onPageSizeChange={(newSize) => setRowsPerPage(newSize)}
            sortingMode='server'
            sortModel={sortModel}
            onSortModelChange={(newModel) => {
              setSortModel(newModel);
              // reset to first page on sort
              setPage(0);
            }}
            loading={loading}
                  initialState={{
                    columns: {
                      visibilityModel: {
                        MonthlyRate: true,
                        DailyRate: true
                      }
                    }
                  }}
            sx={{
              '& .MuiDataGrid-columnHeaders': {
                // Force green header: exact color as requested
                backgroundColor: '#375e38 !important',
                color: '#ffffff !important',
                borderBottom: '1px solid rgba(0,0,0,0.12)',
                backgroundImage: 'none',
                boxShadow: 'none'
              },
              '& .MuiDataGrid-columnHeader': {
                backgroundColor: '#375e38 !important'
              },
              '& .MuiDataGrid-columnHeaderTitle': {
                fontWeight: 600,
                letterSpacing: 0.2,
                textTransform: 'none',
                color: '#ffffff !important'
              },
              '& .MuiDataGrid-columnSeparator': {
                backgroundColor: 'rgba(255,255,255,0.15) !important',
              },
              '& .MuiDataGrid-columnHeaderTitle': {
                fontWeight: 600,
                letterSpacing: 0.2,
                textTransform: 'none'
              },
              '& .MuiDataGrid-cell': {
                color: theme.palette.text.primary,
                borderBottom: '1px solid rgba(0,0,0,0.06)'
              },
              '& .MuiDataGrid-row:nth-of-type(odd)': {
                backgroundColor: 'rgba(0,0,0,0.02)'
              },
              '& .MuiDataGrid-cell:focus, & .MuiDataGrid-columnHeader:focus': {
                outline: 'none'
              }
            }}
            getRowId={(row) => row.id}
            disableColumnFilter={false}
            density='compact'
            rowsPerPageOptions={[10, 20, 50, 100]}
          />
        </div>
        </TableContainer>
        {/* Inspector removed */}
      </Paper>
    </Box>
  );
};

export default SalaryTablePage;
