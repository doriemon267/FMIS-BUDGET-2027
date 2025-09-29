import React, { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  CircularProgress,
  Typography,
  TablePagination,
  Alert,
  Collapse,
  IconButton,
  Checkbox,
} from "@mui/material";
import PropTypes from "prop-types";
import api from "../../config/api";
import { useSearch } from "../../context/SearchContext";
import toast from "react-hot-toast";
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';

const ProposalCustomTable = forwardRef(({
  columns,
  ROWS_PER_PAGE = 10,
  apiPath,
  apiParams = {},
  dataListName,
  additionalMenuOptions = [],
  hasEdit = true,
  hasDelete = true,
  refreshData,
  groupBy = null,
  showTotals = false,
  totalsData = null,
  selectedRows = [],
  onRowSelectionChange,
}, ref) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(ROWS_PER_PAGE);
  const [totalCount, setTotalCount] = useState(0);
  const { searchValue } = useSearch();
  const [expandedGroups, setExpandedGroups] = useState({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: rowsPerPage,
        search: searchValue || undefined,
        ...apiParams
      };
      const response = await api.get(apiPath, { params });
      
      // Handle different response formats based on the endpoint
      let extractedData = [];
      let totalRecords = 0;
      
      if (response.data && response.data.proposals && Array.isArray(response.data.proposals)) {
        extractedData = response.data.proposals;
        totalRecords = response.data.totalRecords || 0;
      } else if (response.data && Array.isArray(response.data)) {
        extractedData = response.data;
        totalRecords = response.data.length;
      } else if (response.data && response.data[dataListName] && Array.isArray(response.data[dataListName])) {
        extractedData = response.data[dataListName];
        totalRecords = response.data.totalRecords || response.data[dataListName].length;
      } else {
        // Fallback for other formats
        const extracted = extractDataFromResponse(response.data);
        extractedData = extracted.data;
        totalRecords = extracted.count;
      }
      
      setRows(extractedData);
      setTotalCount(totalRecords);
      setError(null);
      
      // Initialize expanded state for groups
      if (groupBy && extractedData.length > 0) {
        const groups = [...new Set(extractedData.map(item => item[groupBy]))];
        const initialExpandedState = {};
        groups.forEach(group => {
          initialExpandedState[group] = false;
        });
        setExpandedGroups(initialExpandedState);
      }
      
    } catch (err) {
      console.error("❌ Error fetching data:", err);
      console.error("❌ Error response:", err.response?.data);
      console.error("❌ Error status:", err.response?.status);
      setError(`Failed to load data: ${err.response?.data?.error || err.response?.data?.message || err.message}`);
      toast.error("Failed to load data");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to extract data from various response formats
  const extractDataFromResponse = (responseData) => {
    // Try to find an array in the response
    for (const key in responseData) {
      if (Array.isArray(responseData[key])) {
        return {
          data: responseData[key],
          count: responseData.totalRecords || responseData.totalCount || responseData[key].length
        };
      }
    }
    
    // If no array found, return empty data
    return { data: [], count: 0 };
  };

  // Selection handlers
  const isSelected = (id) => selectedRows.indexOf(id) !== -1;

  const handleRowClick = (event, id, fromCheckbox = false) => {
    if (event.target.type === 'checkbox' && !fromCheckbox) return; // Don't trigger on checkbox click unless it originated from checkbox

    const selectedIndex = selectedRows.indexOf(id);
    let newSelected = [];

    if (selectedIndex === -1) {
      newSelected = newSelected.concat(selectedRows, id);
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(selectedRows.slice(1));
    } else if (selectedIndex === selectedRows.length - 1) {
      newSelected = newSelected.concat(selectedRows.slice(0, -1));
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(
        selectedRows.slice(0, selectedIndex),
        selectedRows.slice(selectedIndex + 1),
      );
    }

    onRowSelectionChange && onRowSelectionChange(newSelected);
  };

  const handleSelectAllClick = (event) => {
    if (event.target.checked) {
      const newSelected = rows.map((row) => row._id || row.id);
      onRowSelectionChange && onRowSelectionChange(newSelected);
      return;
    }
    onRowSelectionChange && onRowSelectionChange([]);
  };

  useEffect(() => {
    fetchData();
  }, [page, rowsPerPage, searchValue, apiPath, JSON.stringify(apiParams)]);

  // Expose refetch method to parent components
  useImperativeHandle(ref, () => ({
    refetch: fetchData,
    getRows: () => rows
  }));

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const toggleGroupExpand = (group) => {
    setExpandedGroups(prev => ({
      ...prev,
      [group]: !prev[group]
    }));
  };

  // Group data by the specified field
  const groupedData = React.useMemo(() => {
    if (!groupBy || !rows.length) return null;
    
    const groups = {};
    rows.forEach(row => {
      const valueRaw = row[groupBy];
      const groupValue = (typeof valueRaw === 'string' ? valueRaw.trim() : valueRaw) || 'CENTRAL OFFICE';
      if (!groups[groupValue]) {
        groups[groupValue] = [];
      }
      groups[groupValue].push(row);
    });
    
    return groups;
  }, [rows, groupBy]);

  if (loading && rows.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && rows.length === 0) {
    return (
      <Box sx={{ width: '100%', mt: 2 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Please check if the API endpoint "{apiPath}" exists and is properly implemented.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      {error && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <Paper sx={{ width: '100%', mb: 2 }}>
        <TableContainer>
          {groupBy && groupedData ? (
            <Table>
              <TableBody>
                {Object.keys(groupedData).map(group => (
                  <React.Fragment key={group}>
                    <TableRow 
                      sx={{ 
                        '& > *': { borderBottom: 'unset' },
                        backgroundColor: '#e6e7e8',
                        fontWeight: 'bold'
                      }}
                    >
                      <TableCell padding="checkbox">
                        <IconButton
                          aria-label="expand row"
                          size="small"
                          onClick={() => toggleGroupExpand(group)}
                        >
                          {expandedGroups[group] ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                        </IconButton>
                      </TableCell>
                      <TableCell colSpan={columns.length - 1}>
                        <Typography variant="subtitle1" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '9999px',
                              fontSize: '11px',
                              fontWeight: 700,
                              background: '#f3f4f6',
                              border: '1px solid #e5e7eb',
                              color: '#374151'
                            }}
                          >
                            {(() => {
                              // Determine label by explicit groupBy field
                              if (groupBy === 'division') return 'DIVISION';
                              if (groupBy === 'department') return 'DEPARTMENT';
                              return 'REGION';
                            })()}
                          </span>
                          <span style={{ color: '#111827' }}>{group}</span>
                          <span style={{ marginLeft: 8, color: '#6b7280', fontWeight: 500, fontSize: 12 }}>
                            ({groupedData[group]?.length || 0})
                          </span>
                        </Typography>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={columns.length}>
                        <Collapse in={expandedGroups[group]} timeout="auto" unmountOnExit>
                          <Box sx={{ margin: 1 }}>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  {columns.map((column) => (
                                    <TableCell
                                      key={column.field}
                                      align={column.type === 'number' ? 'right' : 'left'}
                                      style={{ fontWeight: 'bold' }}
                                    >
                                      {column.label}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {groupedData[group].map((row, index) => (
                                  <TableRow
                                    hover
                                    key={row._id || row.id || index}
                                  >
                                    {columns.map((column) => (
                                      <TableCell
                                        key={`${row._id || row.id || index}-${column.field}`}
                                        align={column.type === 'number' ? 'right' : 'left'}
                                      >
                                        {column.render
                                          ? column.render(row)
                                          : row[column.field] !== undefined
                                          ? String(row[column.field])
                                          : ''}
                                      </TableCell>
                                    ))}
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Table sx={{ minWidth: 750 }} size="medium">
              <TableHead>
                <TableRow>
                  {/* Checkbox column header */}
                  {onRowSelectionChange && (
                    <TableCell padding="checkbox">
                      <Checkbox
                        color="primary"
                        indeterminate={selectedRows.length > 0 && selectedRows.length < rows.length}
                        checked={rows.length > 0 && selectedRows.length === rows.length}
                        onChange={handleSelectAllClick}
                      />
                    </TableCell>
                  )}
                  {columns.map((column) => (
                    <TableCell
                      key={column.field}
                      align={column.type === 'number' ? 'right' : 'left'}
                      style={{ fontWeight: 'bold' }}
                    >
                      {column.label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.length > 0 ? (
                  rows.map((row, index) => {
                    const isRowSelected = isSelected(row._id || row.id);
                    return (
                      <TableRow
                        hover
                        key={row._id || row.id || index}
                        sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                        onClick={(event) => handleRowClick(event, row._id || row.id)}
                        role={onRowSelectionChange ? "checkbox" : undefined}
                        aria-checked={isRowSelected}
                        selected={isRowSelected}
                      >
                        {/* Checkbox column */}
                        {onRowSelectionChange && (
                          <TableCell padding="checkbox">
                            <Checkbox
                              color="primary"
                              checked={isRowSelected}
                              onChange={(event) => {
                                event.stopPropagation();
                                handleRowClick(event, row._id || row.id, true);
                              }}
                            />
                          </TableCell>
                        )}
                        {columns.map((column) => (
                          <TableCell
                            key={`${row._id || row.id || index}-${column.field}`}
                            align={column.type === 'number' ? 'right' : 'left'}
                          >
                            {column.render
                              ? column.render(row)
                              : row[column.field] !== undefined
                              ? String(row[column.field])
                              : ''}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length + (onRowSelectionChange ? 1 : 0)} align="center">
                      No data available
                    </TableCell>
                  </TableRow>
                )}
                {/* Totals Row */}
                {showTotals && totalsData && rows.length > 0 && (
                  <>
                    <TableRow>
                      <TableCell colSpan={columns.length + (onRowSelectionChange ? 1 : 0)} sx={{ borderBottom: '2px solid #000', padding: '8px' }}>
                      </TableCell>
                    </TableRow>
                    <TableRow sx={{ backgroundColor: '#f5f5f5', fontWeight: 'bold' }}>
                      {onRowSelectionChange && <TableCell></TableCell>}
                      {columns.map((column) => (
                        <TableCell
                          key={`total-${column.field}`}
                          align={column.type === 'number' ? 'right' : 'left'}
                          sx={{ fontWeight: 'bold', borderTop: '2px solid #000' }}
                        >
                          {column.field === 'office' ? 'TOTAL' : 
                           column.field === 'totalIncome' ? `₱${(totalsData.totalProjectedCorporateIncome || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` :
                           column.field === 'totalExpenses' ? `₱${(totalsData.totalProjectedSubsidy || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` :
                           column.field === 'proposedBudget' ? `₱${(totalsData.totalProposedBudget || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` :
                           ''}
                        </TableCell>
                      ))}
                    </TableRow>
                  </>
                )}
                {loading && rows.length > 0 && (
                  <TableRow>
                    <TableCell colSpan={columns.length + (onRowSelectionChange ? 1 : 0)} align="center">
                      <CircularProgress size={24} />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50, 100]}
          component="div"
          count={totalCount}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>
    </Box>
  );
});

ProposalCustomTable.propTypes = {
  columns: PropTypes.array.isRequired,
  ROWS_PER_PAGE: PropTypes.number,
  apiPath: PropTypes.string.isRequired,
  dataListName: PropTypes.string,
  additionalMenuOptions: PropTypes.array,
  hasEdit: PropTypes.bool,
  hasDelete: PropTypes.bool,
  refreshData: PropTypes.func,
  groupBy: PropTypes.string,
  showTotals: PropTypes.bool,
  totalsData: PropTypes.object,
  selectedRows: PropTypes.array,
  onRowSelectionChange: PropTypes.func,
};

export default ProposalCustomTable;
