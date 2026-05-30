import {
  Box,
  Button,
  IconButton,
  MenuItem,
  Paper,
  Popover,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  Tooltip,
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
  People as PeopleIcon,
  Security as SecurityIcon,
} from "@mui/icons-material";
import PesoIcon from "../icons/PesoIcon";
import { blueGrey, green, grey, blue, orange } from "@mui/material/colors";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { TiFilter } from "react-icons/ti";
import api from "../../config/api";
import { useSearch } from "../../context/SearchContext";
import { useRegion } from "../../context/RegionContext";
import { useUser } from "../../context/UserContext";
import TableBodyLoading from "../subsistenceallowancest/SubsistenceAllowanceTableBodyLoading";
import TextSearchable from "../../global/components/TextSearchable";
import formatCurrency from "../../utils/formatCurrency";
import { formatDateToMDY, isValidDate } from "../../utils/formatDate";
import * as XLSX from 'xlsx';
import { toast } from "react-hot-toast";

const CustomTable = ({
  columns,
  ROWS_PER_PAGE = 20,
  apiPath,
  dataListName = "data",
  orderByDefault = "updatedAt",
}) => {
  const { searchValue, setSearchValue } = useSearch();
  const queryClient = useQueryClient();
  const TEN_SECONDS_AGO = dayjs().subtract(10, "second");
  // Use the region context
  const { activeRegion } = useRegion();
  // Use the user context to get hierarchical assignment
  const { currentUser, assignmentLevel } = useUser();

  // Enhanced UI state
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState({});
  const [exportMenuAnchor, setExportMenuAnchor] = useState(null);
  const [summaryStats, setSummaryStats] = useState({
    totalRecords: 0,
    totalAmount: 0,
    averageAmount: 0,
    uniqueEmployees: 0,
    riskLevels: {},
  });

  const [order, setOrder] = useState("desc");
  const [orderBy, setOrderBy] = useState(orderByDefault);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(ROWS_PER_PAGE);
  const [filterAnchorEl, setFilterAnchorEl] = useState(null);
  const [focusedCell, setFocusedCell] = useState(null);
  const [fieldAndValue, setFieldAndValue] = useState({
    field: "",
    value: "",
    label: "",
    operator: "=", // for number type
  });

  // Function to get hierarchical display based on user assignment level
  const getHierarchicalDisplay = () => {
    const hierarchical = currentUser?.hierarchicalAccess || {};
    
    switch (assignmentLevel) {
      case 'DIVISION':
        return {
          label: `Division: ${hierarchical.accessibleDivisions?.[0] || currentUser?.divisionName || 'N/A'}`,
          color: 'warning'
        };
      case 'DEPARTMENT':
        return {
          label: `Department: ${hierarchical.accessibleDepartments?.[0]?.departmentName || 'N/A'}`,
          color: 'success'
        };
      case 'REGION':
        return {
          label: `Region: ${hierarchical.accessibleRegions?.[0]?.regionName || activeRegion?.name || 'N/A'}`,
          color: 'primary'
        };
      case 'FULL':
        return {
          label: 'Full Access: All Data',
          color: 'error'
        };
      default:
        return {
          label: `Region: ${activeRegion?.name || 'N/A'}`,
          color: 'primary'
        };
    }
  };

  const { data, isLoading, refetch, error } = useQuery({
    queryKey: [
      dataListName,
      page,
      rowsPerPage,
      searchValue,
      fieldAndValue,
      orderBy,
      order,
      activeRegion?.name,
    ],
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
      const uniqueEmployeeNames = new Set(data.data.map(row => row.employeeFullName));
      const riskLevels = {};

      const stats = data.data.reduce((acc, row) => {
        acc.totalAmount += row.amount || 0;

        // Count risk levels
        const riskLevel = row.riskLevel || 'Unknown';
        riskLevels[riskLevel] = (riskLevels[riskLevel] || 0) + 1;

        return acc;
      }, {
        totalRecords: data.data.length,
        totalAmount: 0,
        averageAmount: 0,
        uniqueEmployees: uniqueEmployeeNames.size,
        riskLevels,
      });

      stats.averageAmount = stats.totalRecords > 0 ? stats.totalAmount / stats.totalRecords : 0;
      setSummaryStats(stats);
    }
  }, [data]);

  useEffect(() => {
    const debouncedSearch = setTimeout(() => refetch(), 500);
    return () => clearTimeout(debouncedSearch);
  }, [order, orderBy, rowsPerPage]);

  useEffect(() => {
    if (fieldAndValue.value && fieldAndValue.field === "date") {
      if (isValidDate(fieldAndValue.value)) refetch();
    } else if (searchValue && searchValue.split("-").length === 3) {
      if (isValidDate(searchValue)) refetch();
    } else {
      const debouncedSearch = setTimeout(() => refetch(), 500);
      return () => clearTimeout(debouncedSearch);
    }
  }, [searchValue, fieldAndValue]);

  useEffect(() => {
    if (
      searchValue &&
      (fieldAndValue.field || fieldAndValue.label || fieldAndValue.value)
    ) {
      setFieldAndValue({ field: "", label: "", value: "" });
    }
  }, [searchValue]);

  useEffect(() => {
    if (fieldAndValue.value && searchValue) {
      setSearchValue("");
    }
  }, [fieldAndValue.value]);

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
        'Employee Number': row.employeeNumber,
        'Employee Name': row.employeeFullName,
        'Position Title': row.positionTitle,
        'Department': row.department,
        'Division': row.division,
        'Region': row.region,
        'Monthly Salary': row.monthlySalary,
        'Exposure Days': row.actualExposureDays,
        'Risk Level': row.riskLevel,
        'Hazard Allowance Amount': row.amount,
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

      XLSX.utils.book_append_sheet(workbook, worksheet, "Subsistence Allowance ST");
      XLSX.writeFile(workbook, `subsistence_allowance_st_${new Date().toISOString().split('T')[0]}.xlsx`);

      toast.success("Excel file exported successfully");
    } catch (error) {
      toast.error("Error exporting to Excel");
      console.error("Export error:", error);
    }
    handleExportMenuClose();
  }, [apiPath, activeRegion]);

  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  const handleFilterClick = (event, columnKey, columnLabel) => {
    setFilterAnchorEl(event.currentTarget);
    if (fieldAndValue.field !== columnKey)
      setFieldAndValue({ field: columnKey, value: "", label: columnLabel });
  };

  const handleFilterClearValue = () =>
    setFieldAndValue((prev) => ({ ...prev, value: "" }));

  const handleFilterClose = () => setFilterAnchorEl(null);

  const handleCellClick = (rowIndex, columnKey, _id) => {
    setFocusedCell({ rowIndex, columnKey, _id });
  };

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
              setFieldAndValue((prev) => ({
                ...prev,
                operator: e.target.value,
              }))
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
              setFieldAndValue((prev) => ({
                ...prev,
                value: e.target.value,
              }))
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
            setFieldAndValue((prev) => ({
              ...prev,
              value: e.target.value,
            }))
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

  const rows = data?.data || [];

  return (
    <>
      {/* Enhanced Action Bar */}
      <Paper sx={{ mt: 3, p: 2, mb: 2, borderRadius: 2, boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
          <Box display="flex" alignItems="center" gap={2}>
            <Typography variant="h6" sx={{ color: '#375e38', fontWeight: 'bold' }}>
              Subsistence Allowance S&T Management
            </Typography>
            
            {(activeRegion || assignmentLevel) && (
              <Chip
                label={getHierarchicalDisplay().label}
                size="small"
                color={getHierarchicalDisplay().color}
                sx={{
                  backgroundColor: getHierarchicalDisplay().color === 'success' ? green[100] : 
                                   getHierarchicalDisplay().color === 'warning' ? orange[100] :
                                   getHierarchicalDisplay().color === 'error' ? '#f8d7da' : blue[100],
                  color: getHierarchicalDisplay().color === 'success' ? green[800] : 
                         getHierarchicalDisplay().color === 'warning' ? orange[800] :
                         getHierarchicalDisplay().color === 'error' ? '#721c24' : blue[800],
                  fontWeight: 'bold',
                  border: `1px solid ${getHierarchicalDisplay().color === 'success' ? green[300] : 
                                       getHierarchicalDisplay().color === 'warning' ? orange[300] :
                                       getHierarchicalDisplay().color === 'error' ? '#f5c6cb' : blue[300]}`
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
            <Card sx={{ backgroundColor: '#e8f5e9', borderLeft: '4px solid #4caf50' }}>
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
                  <PesoIcon sx={{ color: '#2196f3' }} />
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
                  <SecurityIcon sx={{ color: '#ff9800' }} />
                  <Box>
                    <Typography variant="body2" color="text.secondary">Average Amount</Typography>
                    <Typography variant="h6" fontWeight="bold">
                      ₱{summaryStats.averageAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ backgroundColor: '#fce4ec', borderLeft: '4px solid #e91e63' }}>
              <CardContent sx={{ py: 1 }}>
                <Box display="flex" alignItems="center" gap={1}>
                  <PeopleIcon sx={{ color: '#e91e63' }} />
                  <Box>
                    <Typography variant="body2" color="text.secondary">Unique Employees</Typography>
                    <Typography variant="h6" fontWeight="bold">{summaryStats.uniqueEmployees}</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>

      {/* Main Table without Zoom Animation */}
      <Box overflow="auto">
        <Paper sx={{
          width: "100%",
          overflow: "hidden",
          borderRadius: 2,
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          transition: 'all 0.3s ease',
          '&:hover': {
            boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
          }
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
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell
                  key={column.field}
                  sx={{
                    borderRight: "1px solid",
                    borderColor: grey[500],
                    textAlign: column.type === "number" ? "right" : "left",
                    backgroundColor: "#375e38",
                    color: "#fff",
                    fontWeight: "bold",
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
                      <Tooltip title={`Filter ${column.label}`}>
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

          {isLoading ? (
            <TableBody>
              <TableRow>
                <TableCell colSpan={columns.length} sx={{ textAlign: 'center', py: 8 }}>
                  <Fade in={isLoading}>
                    <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
                      <CircularProgress size={40} sx={{ color: '#375e38' }} />
                      <Typography variant="body2" color="text.secondary">
                        Loading subsistence allowance S&T data...
                      </Typography>
                    </Box>
                  </Fade>
                </TableCell>
              </TableRow>
            </TableBody>
          ) : (
            <TableBody>
              {rows.length === 0 ? (
                <TableRow sx={{ height: "70vh" }}>
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
                rows.map((row, rowIndex) => {
                  const isRecentlyUpdated =
                    row.updatedAt && dayjs(row.updatedAt).isAfter(TEN_SECONDS_AGO);

                  return (
                    <TableRow
                      key={row._id || rowIndex}
                      hover
                      sx={{
                        backgroundColor: isRecentlyUpdated
                          ? green[50]
                          : rowIndex % 2 === 0
                          ? blueGrey[50]
                          : "#fff",
                        cursor: "pointer",
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          backgroundColor: isRecentlyUpdated
                            ? green[100]
                            : rowIndex % 2 === 0
                            ? blueGrey[100]
                            : "rgba(55, 94, 56, 0.04)",
                          transform: 'translateY(-1px)',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                        }
                      }}
                    >
                      {columns.map((column, i) => {
                        const cellValue = row[column.field];
                        return (
                          <TableCell
                            key={column.field}
                            onClick={() =>
                              handleCellClick(rowIndex, column.field, row["_id"])
                            }
                            sx={{
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              fontWeight: 500,
                              textAlign: column.type === "number" ? "right" : "left",
                            }}
                          >
                            {column.render ? (
                              column.render(row)
                            ) : column.type === "date" ? (
                              formatDateToMDY(cellValue)
                            ) : column.type === "number" ? (
                              formatCurrency(cellValue)
                            ) : column.type === "boolean" ? (
                              cellValue ? "Yes" : "No"
                            ) : column.searchable ? (
                              <TextSearchable columnName={cellValue} />
                            ) : (
                              cellValue
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          )}
        </Table>
          </TableContainer>

          {!isLoading && (
            <TablePagination
              rowsPerPageOptions={[...new Set([10, ROWS_PER_PAGE, 50])]}
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
          )}

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
            TOTAL HAZARD ALLOWANCE:
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

export default CustomTable;
