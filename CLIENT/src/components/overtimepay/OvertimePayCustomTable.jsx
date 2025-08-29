/************************************************************
 * File: components/overtimepay/OvertimePayCustomTable.jsx
 ************************************************************/
import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  IconButton,
  Tooltip,
  Popover,
  Button,
  Select,
  MenuItem,
  TextField,
  Typography,
  Chip,
  Switch,
  FormControlLabel,
  Zoom,
  Fade,
  CircularProgress,
  Card,
  CardContent,
  Grid,
} from "@mui/material";
import {
  Refresh as RefreshIcon,
  GetApp as GetAppIcon,
  Visibility as VisibilityIcon,
  Assessment as AssessmentIcon,
  Schedule as ScheduleIcon,
  AttachMoney as MoneyIcon,
} from "@mui/icons-material";
import { grey, green, blue } from "@mui/material/colors";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { TiFilter } from "react-icons/ti";
import api from "../../config/api";
import { useSearch } from "../../context/SearchContext";
import { useRegion } from "../../context/RegionContext";
import TableBodyLoading from "./TableBodyLoading";
import { isValidDate } from "../../utils/formatDate";
import InlineOvertimeAddRow from "./InlineOvertimeAddRow";
import OvertimePayEditableRow from "./OvertimePayEditableRow";
import * as XLSX from 'xlsx';
import { toast } from "react-hot-toast";

const OvertimePayCustomTable = ({
  columns,
  ROWS_PER_PAGE = 20,
  apiPath = "/overtime-pay",
  dataListName = "overtimePays",
  orderByDefault = "updatedAt",
}) => {
  const { searchValue, setSearchValue } = useSearch();
  const queryClient = useQueryClient();
  // Use the region context - moved up before it's used
  const { activeRegion } = useRegion();

  // Enhanced UI state
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState({});
  const [exportMenuAnchor, setExportMenuAnchor] = useState(null);
  const [summaryStats, setSummaryStats] = useState({
    totalRecords: 0,
    totalAmount: 0,
    totalWeekdayHours: 0,
    totalWeekendHours: 0,
  });

  const [order, setOrder] = useState("desc");
  const [orderBy, setOrderBy] = useState(orderByDefault);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(ROWS_PER_PAGE);
  const [filterAnchorEl, setFilterAnchorEl] = useState(null);
  const [fieldAndValue, setFieldAndValue] = useState({
    field: "",
    value: "",
    label: "",
    operator: "=",
  });
  const [employeeOptions, setEmployeeOptions] = useState([]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: [dataListName, page, rowsPerPage, searchValue, fieldAndValue, orderBy, order, activeRegion?.name],
    queryFn: async () => {
      const params = {
        page: page + 1,
        limit: rowsPerPage,
        search: searchValue,
        [fieldAndValue.field]: fieldAndValue.value,
        orderBy,
        order,
        operator: fieldAndValue.operator,
      };
      
      // Add region parameter if available
      if (activeRegion?.name) {
        params.region = activeRegion.name;
      }
      
      const res = await api.get(apiPath, { params });
      return res.data;
    },
  });

  const fetchEmployees = async () => {
    try {
      // Use the byParams endpoint to filter by region
      const params = {};
      if (activeRegion?.name) {
        params.region = activeRegion.name;
      }
      
      // Use the endpoint that supports region filtering
      const res = await api.get("/getpersonnels/byParams", { params });
      let data = res.data || [];
      
      // De-duplicate employee options
      const uniqueData = [];
      const seen = new Set();
      for (const emp of data) {
        const key = emp.EmployeeID || emp.employeeFullName;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueData.push(emp);
        }
      }
      setEmployeeOptions(uniqueData);
    } catch (err) {
      console.error("Error fetching employees:", err);
      // Fallback to fetching all employees if the filtered endpoint fails
      try {
        const fallbackRes = await api.get("/getpersonnels");
        let fallbackData = fallbackRes.data || [];
        const uniqueData = [];
        const seen = new Set();
        for (const emp of fallbackData) {
          const key = emp.EmployeeID || emp.employeeFullName;
          if (!seen.has(key)) {
            seen.add(key);
            uniqueData.push(emp);
          }
        }
        setEmployeeOptions(uniqueData);
      } catch (fallbackErr) {
        console.error("Fallback error fetching employees:", fallbackErr);
      }
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [activeRegion]); // Re-fetch when region changes

  const refreshData = () => {
    refetch();
  };

  // Enhanced functionality handlers
  const handleManualRefresh = useCallback(() => {
    queryClient.invalidateQueries([dataListName]);
    refetch();
    toast.success("Data refreshed");
  }, [queryClient, dataListName, refetch]);

  const handleExportMenuClick = (event) => setExportMenuAnchor(event.currentTarget);
  const handleExportMenuClose = () => setExportMenuAnchor(null);

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      queryClient.invalidateQueries([dataListName]);
      refetch();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, queryClient, dataListName, refetch]);

  // Calculate summary statistics
  useEffect(() => {
    if (data?.data) {
      const stats = data.data.reduce((acc, row) => {
        acc.totalAmount += row.amount || 0;
        acc.totalWeekdayHours += row.weekdayHours || 0;
        acc.totalWeekendHours += row.weekendHours || 0;
        return acc;
      }, {
        totalRecords: data.data.length,
        totalAmount: 0,
        totalWeekdayHours: 0,
        totalWeekendHours: 0,
      });
      setSummaryStats(stats);
    }
  }, [data]);

  // Export functionality
  const handleExportExcel = useCallback(async () => {
    try {
      // Include region parameter in export if available
      const params = { limit: 10000 };
      if (activeRegion?.name) {
        params.region = activeRegion.name;
      }
      
      const response = await api.get(apiPath, { params });
      const exportData = response.data.data || response.data;

      if (!Array.isArray(exportData) || exportData.length === 0) {
        toast.error("No data to export");
        return;
      }

      // Format data for export
      const formattedData = exportData.map(row => ({
        'Employee Name': row.employeeFullName,
        'Position Title': row.positionTitle,
        'Weekday Hours': row.weekdayHours,
        'Weekend Hours': row.weekendHours,
        'Amount': row.amount,
        'Fiscal Year': row.fiscalYear,
        'Processed By': row.processBy,
        'Process Date': row.processDate ? new Date(row.processDate).toLocaleDateString() : '',
        'Created At': row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '',
      }));

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(formattedData);

      // Auto-size columns
      const colWidths = Object.keys(formattedData[0]).map(key => ({
        wch: Math.max(key.length, 15)
      }));
      worksheet['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(workbook, worksheet, "Overtime Pay");
      XLSX.writeFile(workbook, `overtime_pay_${new Date().toISOString().split('T')[0]}.xlsx`);

      toast.success("Excel file exported successfully");
    } catch (error) {
      toast.error("Error exporting to Excel");
      console.error("Export error:", error);
    }
    handleExportMenuClose();
  }, [apiPath, activeRegion]);

  // Debounce refetch
  useEffect(() => {
    const debouncedSearch = setTimeout(() => refetch(), 500);
    return () => clearTimeout(debouncedSearch);
  }, [order, orderBy, rowsPerPage, refetch]);

  useEffect(() => {
    if (fieldAndValue.field === "date" && fieldAndValue.value) {
      if (isValidDate(fieldAndValue.value)) refetch();
    } else if (searchValue && searchValue.split("-").length === 3) {
      if (isValidDate(searchValue)) refetch();
    } else {
      const debouncedSearch = setTimeout(() => refetch(), 500);
      return () => clearTimeout(debouncedSearch);
    }
  }, [searchValue, fieldAndValue, refetch]);

  useEffect(() => {
    if (searchValue && (fieldAndValue.field || fieldAndValue.label || fieldAndValue.value)) {
      setFieldAndValue({ field: "", label: "", value: "", operator: "=" });
    }
  }, [searchValue]);

  useEffect(() => {
    if (fieldAndValue.value && searchValue) {
      setSearchValue("");
    }
  }, [fieldAndValue.value, searchValue, setSearchValue]);

  const handleRequestSort = useCallback(
    (property) => {
      const isAsc = orderBy === property && order === "asc";
      setOrder(isAsc ? "desc" : "asc");
      setOrderBy(property);
    },
    [order, orderBy]
  );

  const handleFilterClick = (event, columnKey, columnLabel) => {
    setFilterAnchorEl(event.currentTarget);
    if (fieldAndValue.field !== columnKey) {
      setFieldAndValue({ field: columnKey, value: "", label: columnLabel, operator: "=" });
    }
  };

  const handleFilterClearValue = () =>
    setFieldAndValue((prev) => ({ ...prev, value: "" }));

  const handleFilterClose = () => setFilterAnchorEl(null);

  const handleChangePage = (event, newPage) => setPage(newPage);

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleDateChange = (e) => {
    const [year, month, day] = e.target.value.split("-");
    const formattedValue = `${month}-${day}-${year}`;
    setFieldAndValue((prev) => ({ ...prev, value: formattedValue }));
  };

  const getFormattedValue = () => {
    if (!fieldAndValue.value) return "";
    const [month, day, year] = fieldAndValue.value.split("-");
    return `${year}-${month}-${day}`;
  };

  const renderFilter = () => {
    const column = columns.find((col) => col.field === fieldAndValue.field);
    if (!column) return null;

    if (column.type === "date") {
      return (
        <>
          <TextField
            size="small"
            type="date"
            value={getFormattedValue()}
            onChange={handleDateChange}
            fullWidth
          />
          {fieldAndValue.value && (
            <Button onClick={handleFilterClearValue} size="small" color="error">
              Clear
            </Button>
          )}
        </>
      );
    } else if (column.type === "number") {
      return (
        <>
          <Select
            size="small"
            value={fieldAndValue.operator || "="}
            onChange={(e) =>
              setFieldAndValue((prev) => ({ ...prev, operator: e.target.value }))
            }
            fullWidth
          >
            <MenuItem value="=">Equal (=)</MenuItem>
            <MenuItem value="<">Less than (&lt;)</MenuItem>
            <MenuItem value=">">Greater than (&gt;)</MenuItem>
            <MenuItem value="<=">Less than or Equal (≤)</MenuItem>
            <MenuItem value=">=">Greater than or Equal (≥)</MenuItem>
          </Select>
          <TextField
            size="small"
            type="number"
            value={fieldAndValue.value || ""}
            onChange={(e) =>
              setFieldAndValue((prev) => ({ ...prev, value: e.target.value }))
            }
            fullWidth
          />
          {fieldAndValue.value && (
            <Button onClick={handleFilterClearValue} size="small" color="error">
              Clear
            </Button>
          )}
        </>
      );
    } else if (column.type === "boolean") {
      return (
        <>
          <Select
            size="small"
            value={fieldAndValue.value !== undefined ? fieldAndValue.value : ""}
            onChange={(e) =>
              setFieldAndValue((prev) => ({
                ...prev,
                value: e.target.value === "true",
              }))
            }
            fullWidth
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="true">Yes</MenuItem>
            <MenuItem value="false">No</MenuItem>
          </Select>
          {fieldAndValue.value !== "" && (
            <Button onClick={handleFilterClearValue} size="small" color="error">
              Clear
            </Button>
          )}
        </>
      );
    }
    return (
      <>
        <TextField
          size="small"
          placeholder={`Search by ${fieldAndValue.label}`}
          value={fieldAndValue.value}
          onChange={(e) =>
            setFieldAndValue((prev) => ({ ...prev, value: e.target.value }))
          }
          fullWidth
        />
        {fieldAndValue.value && (
          <Button onClick={handleFilterClearValue} size="small" color="error">
            Clear
          </Button>
        )}
      </>
    );
  };

  // Function para ibigay ang alignment base sa column index
  const getAlignment = (index) => {
    if (index === 0) return "left";
    if (index === 1 || index === 2) return "center";
    if (index === 3) return "right";
    if (index === 4) return "center";
    return "left";
  };

  const rows = data?.data || [];

  return (
    <>
      {/* Enhanced Action Bar */}
      <Paper sx={{ p: 2, mb: 2, borderRadius: 2, boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
          <Box display="flex" alignItems="center" gap={2}>
            <Typography variant="h6" sx={{ color: '#375e38', fontWeight: 'bold' }}>
              Overtime Pay Management
            </Typography>
            
            {activeRegion && (
              <Chip
                label={`Region: ${activeRegion.name}`}
                size="small"
                color="primary"
                sx={{
                  backgroundColor: blue[100],
                  color: blue[800],
                  fontWeight: 'bold',
                  border: `1px solid ${blue[300]}`
                }}
              />
            )}

            <Tooltip title="Refresh Data">
              <IconButton
                onClick={handleManualRefresh}
                disabled={isLoading}
                color="primary"
                sx={{
                  backgroundColor: 'rgba(55, 94, 56, 0.1)',
                  '&:hover': { backgroundColor: 'rgba(55, 94, 56, 0.2)' }
                }}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>

            <FormControlLabel
              control={
                <Switch
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  color="primary"
                />
              }
              label="Auto Refresh"
            />
          </Box>

          <Box display="flex" alignItems="center" gap={1}>
            <Tooltip title="Export Options">
              <IconButton
                onClick={handleExportMenuClick}
                sx={{
                  backgroundColor: 'rgba(55, 94, 56, 0.1)',
                  '&:hover': { backgroundColor: 'rgba(55, 94, 56, 0.2)' }
                }}
              >
                <GetAppIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Summary Statistics */}
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card 
            sx={{ backgroundColor: '#e8f5e9', 
            borderLeft: '4px solid #4caf50', 

            }}>
              <CardContent sx={{ py: 1 }}>
                <Box display="flex" alignItems="center" gap={1}>
                  <AssessmentIcon sx={{ color: '#4caf50' }} />
                  <Box>
                    <Typography variant="body2" color="text.secondary">Total Records</Typography>
                    <Typography variant="h6" fontWeight="bold">{summaryStats.totalRecords}</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ backgroundColor: '#e3f2fd', borderLeft: '4px solid #2196f3' }}>
              <CardContent sx={{ py: 1 }}>
                <Box display="flex" alignItems="center" gap={1}>
                  <MoneyIcon sx={{ color: '#2196f3' }} />
                  <Box>
                    <Typography variant="body2" color="text.secondary">Total Amount</Typography>
                    <Typography variant="h6" fontWeight="bold">
                      ₱{summaryStats.totalAmount.toLocaleString()}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ backgroundColor: '#fff3e0', borderLeft: '4px solid #ff9800' }}>
              <CardContent sx={{ py: 1 }}>
                <Box display="flex" alignItems="center" gap={1}>
                  <ScheduleIcon sx={{ color: '#ff9800' }} />
                  <Box>
                    <Typography variant="body2" color="text.secondary">Weekday Hours</Typography>
                    <Typography variant="h6" fontWeight="bold">{summaryStats.totalWeekdayHours}</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ backgroundColor: '#fce4ec', borderLeft: '4px solid #e91e63' }}>
              <CardContent sx={{ py: 1 }}>
                <Box display="flex" alignItems="center" gap={1}>
                  <ScheduleIcon sx={{ color: '#e91e63' }} />
                  <Box>
                    <Typography variant="body2" color="text.secondary">Weekend Hours</Typography>
                    <Typography variant="h6" fontWeight="bold">{summaryStats.totalWeekendHours}</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>

      {/* Main Table with Zoom Animation */}
      <Zoom in={true} timeout={600}>
        <Box overflow="auto">
          <Paper sx={{
            width: "100%",
            overflow: "hidden",
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
            transition: 'all 0.3s ease'
          }}>
            <TableContainer sx={{
              height: "60vh",
              '&::-webkit-scrollbar': {
                width: '8px',
              },
              '&::-webkit-scrollbar-track': {
                background: '#f1f1f1',
                borderRadius: '4px',
              },
              '&::-webkit-scrollbar-thumb': {
                background: '#c1c1c1',
                borderRadius: '4px',
                '&:hover': {
                  background: '#a8a8a8',
                },
              },
            }}>
          <Table size="small">
            {/* HEAD */}
            <TableHead
              sx={{
                "& .MuiTableCell-root": {
                  fontWeight: "bold", // Bold ang header font
                  color: "#fff",
                },
              }}
            >
              <TableRow
                sx={{
                  position: "sticky",
                  top: 0,
                  backgroundColor: "#375e38",
                  zIndex: 2,
                  borderBottom: "2px solid #fff", // Horizontal grid line
                }}
              >
                {columns.map((column, index) => (
                  <TableCell
                    key={column.field}
                    sx={{
                      borderRight: "1px solid",
                      borderColor: grey[500],
                      textAlign: getAlignment(index),
                    }}
                  >
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <TableSortLabel
                        active={orderBy === column.field}
                        direction={orderBy === column.field ? order : "asc"}
                        onClick={() => handleRequestSort(column.field)}
                      >
                        {column.label}
                      </TableSortLabel>
                      {column.type !== "action" && (
                        <Tooltip title={`Filter ${column.label}`} arrow>
                          <IconButton
                            size="small"
                            onClick={(event) =>
                              handleFilterClick(event, column.field, column.label)
                            }
                          >
                            <TiFilter color="lightgray" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>

            {/* BODY */}
            <TableBody
              sx={{
                "& .MuiTableRow-root": {
                  borderBottom: "1px solid rgba(224, 224, 224, 1)",
                  transition: 'all 0.2s ease',
                  cursor: "pointer",
                  '&:hover': {
                    backgroundColor: 'rgba(55, 94, 56, 0.04)',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                  }
                },
                "& .MuiTableRow-root:nth-of-type(odd)": {
                  backgroundColor: "#f8f9fa",
                },
                "& .MuiTableRow-root:nth-of-type(even)": {
                  backgroundColor: "#ffffff",
                },
                // Enhanced hover effects for odd/even rows
                "& .MuiTableRow-root:nth-of-type(odd):hover": {
                  backgroundColor: 'rgba(55, 94, 56, 0.08)',
                },
                "& .MuiTableRow-root:nth-of-type(even):hover": {
                  backgroundColor: 'rgba(55, 94, 56, 0.04)',
                },
                // Specific alignment para sa bawat column gamit ang nth-of-type
                "& .MuiTableRow-root > .MuiTableCell-root:nth-of-type(1)": {
                  textAlign: "left",
                },
                "& .MuiTableRow-root > .MuiTableCell-root:nth-of-type(2)": {
                  textAlign: "center",
                },
                "& .MuiTableRow-root > .MuiTableCell-root:nth-of-type(3)": {
                  textAlign: "center",
                },
                "& .MuiTableRow-root > .MuiTableCell-root:nth-of-type(4)": {
                  textAlign: "right",
                },
                "& .MuiTableRow-root > .MuiTableCell-root:nth-of-type(5)": {
                  textAlign: "center",
                },
                "& .MuiTableCell-root": {
                  fontWeight: "normal",
                  padding: "12px 16px",
                },
              }}
            >
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={columns.length} sx={{ textAlign: 'center', py: 8 }}>
                    <Fade in={isLoading}>
                      <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
                        <CircularProgress size={40} sx={{ color: '#375e38' }} />
                        <Typography variant="body2" color="text.secondary">
                          Loading overtime pay data...
                        </Typography>
                      </Box>
                    </Fade>
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {/* Inline Add Row */}
                  <InlineOvertimeAddRow refreshData={refreshData} employeeOptions={employeeOptions} />

                  {/* Existing Rows */}
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={columns.length} align="center">
                        {searchValue ? (
                          <>
                            No results found for <b>"{searchValue}"</b>.
                          </>
                        ) : (
                          "No rows found."
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => (
                      <OvertimePayEditableRow
                        key={row._id}
                        row={row}
                        refreshData={refetch}
                        activeSettings={data?.activeSettings || null}
                      />
                    ))
                  )}
                </>
              )}
            </TableBody>
          </Table>
            </TableContainer>

            {/* PAGINATION */}
            <TablePagination
              rowsPerPageOptions={[10, ROWS_PER_PAGE, 50]}
              component="div"
              count={data?.totalRecords || 0}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              sx={{
                borderTop: '1px solid rgba(224, 224, 224, 1)',
                backgroundColor: '#fafafa'
              }}
            />

            {/* FILTER POPOVER */}
            <Popover
              open={Boolean(filterAnchorEl)}
              anchorEl={filterAnchorEl}
              onClose={handleFilterClose}
              anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
            >
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1, p: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "#375e38" }}>
                  Filter by {fieldAndValue.label}
                </Typography>
                {renderFilter()}
              </Box>
            </Popover>
          </Paper>
        </Box>
      </Zoom>

      {/* Export Menu */}
      <Popover
        open={Boolean(exportMenuAnchor)}
        anchorEl={exportMenuAnchor}
        onClose={handleExportMenuClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Box sx={{ p: 1 }}>
          <Button
            onClick={handleExportExcel}
            startIcon={<GetAppIcon />}
            sx={{
              justifyContent: 'flex-start',
              width: '100%',
              color: '#375e38',
              '&:hover': { backgroundColor: 'rgba(55, 94, 56, 0.1)' }
            }}
          >
            Export to Excel
          </Button>
          <Button
            onClick={() => {
              toast.info("PDF export functionality to be implemented");
              handleExportMenuClose();
            }}
            startIcon={<GetAppIcon />}
            sx={{
              justifyContent: 'flex-start',
              width: '100%',
              color: '#375e38',
              '&:hover': { backgroundColor: 'rgba(55, 94, 56, 0.1)' }
            }}
          >
            Export to PDF
          </Button>
        </Box>
      </Popover>

      {/* Grand Total Footer with Fade Animation */}
      <Fade in={true} timeout={1000}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            mt: 0,
            gap: 2,
            justifyContent: "flex-end",
            backgroundColor: "#375e38",
            padding: "12px 24px",
            borderRadius: "0 0 8px 8px",
            boxShadow: '0 -2px 8px rgba(0,0,0,0.1)',
            transition: 'all 0.3s ease'
          }}
        >
          <Typography
            sx={{
              color: "#fff",
              fontWeight: "bold",
              textAlign: "right",
            }}
          >
            TOTAL OVERTIME PAY:
          </Typography>
          <Typography
            sx={{
              color: "#fff",
              fontWeight: "bold",
              textAlign: "right",
              fontSize: '1.2rem'
            }}
          >
            ₱{summaryStats.totalAmount.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </Typography>
        </Box>
      </Fade>
    </>
  );
};

export default OvertimePayCustomTable;
