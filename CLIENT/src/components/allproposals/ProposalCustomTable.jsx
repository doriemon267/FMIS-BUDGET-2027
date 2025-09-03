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
  dataListName,
  additionalMenuOptions = [],
  hasEdit = true,
  hasDelete = true,
  refreshData,
  groupBy = null,
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
      console.log("🔍 Fetching proposals data from:", apiPath);
      console.log("📋 Request params:", { page, limit: rowsPerPage, search: searchValue });
      
      const response = await api.get(apiPath, {
        params: {
          page,
          limit: rowsPerPage,
          search: searchValue || undefined,
        },
      });
      
      console.log("📥 API Response:", response.data);
      console.log("📊 Response status:", response.status);
      
      // Handle different response formats based on the endpoint
      let extractedData = [];
      let totalRecords = 0;
      
      if (response.data && response.data.proposals && Array.isArray(response.data.proposals)) {
        extractedData = response.data.proposals;
        totalRecords = response.data.totalRecords || 0;
        console.log("✅ Found proposals array with", extractedData.length, "items");
      } else if (response.data && Array.isArray(response.data)) {
        extractedData = response.data;
        totalRecords = response.data.length;
        console.log("✅ Found direct array with", extractedData.length, "items");
      } else if (response.data && response.data[dataListName] && Array.isArray(response.data[dataListName])) {
        extractedData = response.data[dataListName];
        totalRecords = response.data.totalRecords || response.data[dataListName].length;
        console.log("✅ Found", dataListName, "array with", extractedData.length, "items");
      } else {
        // Fallback for other formats
        console.warn("⚠️ Unexpected response format:", response.data);
        const extracted = extractDataFromResponse(response.data);
        extractedData = extracted.data;
        totalRecords = extracted.count;
      }
      
      console.log("📋 Final extracted data:", extractedData);
      console.log("🔢 Total records:", totalRecords);
      
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

  useEffect(() => {
    fetchData();
  }, [page, rowsPerPage, searchValue, apiPath]);

  // Expose refetch method to parent components
  useImperativeHandle(ref, () => ({
    refetch: fetchData
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
      const groupValue = row[groupBy] || 'Unknown';
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
                        <Typography variant="subtitle1" fontWeight="bold">
                          Region: {group}
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
                  rows.map((row, index) => (
                    <TableRow
                      hover
                      key={row._id || row.id || index}
                      sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
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
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} align="center">
                      No data available
                    </TableCell>
                  </TableRow>
                )}
                {loading && rows.length > 0 && (
                  <TableRow>
                    <TableCell colSpan={columns.length} align="center">
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
};

export default ProposalCustomTable;
