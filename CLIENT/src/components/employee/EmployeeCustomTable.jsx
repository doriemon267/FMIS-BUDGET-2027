import React, { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Checkbox,
  IconButton,
  Popover,
  TextField,
  Box,
  Chip,
  Switch,
  Typography,
  Tooltip,
  CircularProgress,
  Button,
  InputAdornment,
  useTheme,
  Skeleton,
  Collapse,
  Alert,
  useMediaQuery,
  Menu,
  MenuItem,
  Divider,
  Pagination,
  Select
} from "@mui/material";
import FilterListIcon from "@mui/icons-material/FilterList";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import ClearIcon from "@mui/icons-material/Clear";
import SortIcon from "@mui/icons-material/Sort";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import api from "../../config/api";
import PropTypes from "prop-types";
import { useThemeContext } from "../../context/ThemeContext";
import { useRegion } from "../../context/RegionContext";
import { useUser } from "../../context/UserContext";
import { toast } from "react-hot-toast";

const CustomTable = ({
  ROWS_PER_PAGE,
  dataListName,
  apiPath,
  columns,
  searchQuery = "",
  tableContainerProps = {},
  onDataChange = null,
  refreshTrigger = 0
}) => {
  const theme = useTheme();
  const { mode } = useThemeContext();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [employees, setEmployees] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(ROWS_PER_PAGE);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedRows, setSelectedRows] = useState([]);
  const [refreshTriggerInternal, setRefreshTriggerInternal] = useState(0);
  const [filters, setFilters] = useState(
    columns.reduce((acc, col) => {
      acc[col.field] = "";
      return acc;
    }, {})
  );
  const [anchorEl, setAnchorEl] = useState(null);
  const [activeFilterField, setActiveFilterField] = useState(null);
  const [error, setError] = useState(null);
  const [sortConfig, setSortConfig] = useState({ field: null, direction: 'asc' });
  const [filterMenuAnchorEl, setFilterMenuAnchorEl] = useState(null);
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);

  // Use the region context
  const { activeRegion } = useRegion();
  const { currentUser } = useUser();

    // Get user's hierarchical access information
    const userAccessLevel = currentUser?.hierarchicalAccess?.scope || 'REGION';
    const rawDivision = currentUser?.hierarchicalAccess?.accessibleDivisions?.[0];
    const userDivision = typeof rawDivision === 'string' ? rawDivision : rawDivision?.divisionName;
      const userDepartment = currentUser?.hierarchicalAccess?.accessibleDepartments?.[0]?.departmentName;
      const userRegion = currentUser?.hierarchicalAccess?.accessibleRegions?.[0]?.regionName;

      // Debug hierarchical access information
      console.log('🔍 Hierarchical Access Info:', {
        userAccessLevel,
        userDivision,
        userDepartment,
        userRegion,
        hierarchicalAccess: currentUser?.hierarchicalAccess,
        currentUser: currentUser ? 'User exists' : 'No user'
      });

  const resolveProcessByFilter = (user) => {
    if (!user) return null;
    if (user.FirstName && user.LastName) {
      return `${user.FirstName} ${user.LastName}`;
    }
    if (user.fullName) {
      return user.fullName;
    }
    if (user.name) {
      return user.name;
    }
    if (user.username) {
      return user.username;
    }
    return null;
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    setEmployees([]);
    setTotalRecords(0);
    
    // Check if active region is available
    if (!activeRegion) {
      setError("Please select a region to view employees");
      setLoading(false);
      return;
    }
    
    try {
      // Get the region name - include all known keys
      const regionName = activeRegion.name || activeRegion.regionName || activeRegion.Region;
      
      // CRITICAL: Ensure we have a valid region name
      if (!regionName) {
        setError("Invalid region selected");
        setLoading(false);
        toast.error("Invalid region selected", {
          style: {
            borderRadius: '10px',
            background: theme.palette.mode === 'dark' ? '#333' : '#fff',
            color: theme.palette.mode === 'dark' ? '#fff' : '#333',
          },
        });
        return;
      }

      // CRITICAL: Force the region parameter to be exactly as specified
      // This ensures we're using the exact region name for filtering
      const queryParams = {
        page: page + 1,
        limit: rowsPerPage,
        search: searchQuery,
      };

      // Add hierarchical access parameters based on user access level
      // IMPORTANT: For Division/Department level users, DO NOT send region parameter
      // The backend will enforce hierarchical restrictions automatically
      console.log('🔍 User Access Debug:', {
        userAccessLevel,
        userDivision,
        userDepartment,
        userRegion,
        currentUserHierarchicalAccess: currentUser?.hierarchicalAccess
      });

      if (userAccessLevel === 'DIVISION' && userDivision) {
        // Division level: Only send division parameter, no region override
        queryParams.Division = userDivision;
        console.log(`Division level user - restricting to division: ${userDivision}`);
      } else if (userAccessLevel === 'DEPARTMENT' && userDepartment) {
        // Department level: Only send department parameter, no region override
        queryParams.Department = userDepartment;
        if (userDivision) {
          queryParams.Division = userDivision;
        }
        console.log(`Department level user - restricting to department: ${userDepartment}`);
      } else if (userAccessLevel === 'REGION' && userRegion) {
        // Region level: Can specify region (within their assigned regions)
        queryParams.region = userRegion;
        console.log(`Region level user - using region: ${userRegion}`);
      } else {
        // Fallback: Only send region if we have hierarchical access info
        // For users without proper hierarchical setup, don't send region to avoid conflicts
        if (currentUser?.hierarchicalAccess?.scope) {
          queryParams.region = regionName;
          console.log(`Fallback - using active region: ${regionName}`);
        } else {
          console.log('No hierarchical access info - not sending region parameter');
        }
      }

      // Add processBy parameter for additional access control
      // This allows users to see employees they processed, in addition to hierarchical access
      const processByFilter = resolveProcessByFilter(currentUser);
      if (processByFilter) {
        queryParams.processBy = processByFilter;
      }
      
      // Add other filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value && key !== "select" && key !== "action") {
          queryParams[key] = value;
        }
      });

      // Add sorting parameters if sorting is active
      if (sortConfig.field && sortConfig.field !== 'action' && sortConfig.field !== 'select') {
        queryParams.sortField = sortConfig.field;
        queryParams.sortDirection = sortConfig.direction;
      }

      const response = await api.get(apiPath, { params: queryParams });

      // Check if response has employees
      if (!response.data.employees) {
        setError("No employee data received from server");
        setEmployees([]);
        setTotalRecords(0);
        setLoading(false);
        return;
      }
      
      // CRITICAL: Verify that all employees belong to the user's allowed scope (case-insensitive)
      // This is a double-check to ensure security while avoiding case mismatches
      const verifiedEmployees = response.data.employees.filter(emp => {
        // For Division level users: check if employee belongs to their division
        if (userAccessLevel === 'DIVISION' && userDivision) {
          const employeeDivision = (emp.Division || '').trim();
          const matchesDivision = employeeDivision.localeCompare(userDivision.trim(), undefined, { sensitivity: 'accent' }) === 0 ||
                                  new RegExp(`^${userDivision.trim()}$`, 'i').test(employeeDivision);

          if (!matchesDivision) {
            console.error(`SECURITY WARNING: Employee ${emp.EmployeeFullName} has division ${employeeDivision} but user division is ${userDivision}`);
          }

          return matchesDivision;
        }

        // For Department level users: check if employee belongs to their department
        if (userAccessLevel === 'DEPARTMENT' && userDepartment) {
          const employeeDepartment = (emp.Department || '').trim();
          const matchesDepartment = employeeDepartment.localeCompare(userDepartment.trim(), undefined, { sensitivity: 'accent' }) === 0 ||
                                    new RegExp(`^${userDepartment.trim()}$`, 'i').test(employeeDepartment);

          if (!matchesDepartment) {
            console.error(`SECURITY WARNING: Employee ${emp.EmployeeFullName} has department ${employeeDepartment} but user department is ${userDepartment}`);
          }

          return matchesDepartment;
        }

        // For Region level users: check if employee belongs to their region
        if (userAccessLevel === 'REGION' && userRegion) {
          const employeeRegion = (emp.Region || '').trim();
          const matchesRegion = employeeRegion.localeCompare(userRegion.trim(), undefined, { sensitivity: 'accent' }) === 0 ||
                                new RegExp(`^${userRegion.trim()}$`, 'i').test(employeeRegion);

          if (!matchesRegion) {
            console.error(`SECURITY WARNING: Employee ${emp.EmployeeFullName} has region ${employeeRegion} but user region is ${userRegion}`);
          }

          return matchesRegion;
        }

        // For other levels: use the requested region as fallback
        const employeeRegion = (emp.Region || '').trim();
        const matchesRegion = employeeRegion.localeCompare((regionName || '').trim(), undefined, { sensitivity: 'accent' }) === 0 ||
                              new RegExp(`^${(regionName || '').trim()}$`, 'i').test(employeeRegion);

        if (!matchesRegion) {
          console.error(`SECURITY WARNING: Employee ${emp.EmployeeFullName} has region ${employeeRegion} but requested region is ${regionName}`);
        }

        return matchesRegion;
      });

      // Only use employees that match the current region
      setEmployees(verifiedEmployees);

      // Use the total records from the server for pagination
      setTotalRecords(response.data.totalRecords || 0);
      
      // Debug pagination data
      console.log('📊 Pagination Debug:', {
        totalRecords: response.data.totalRecords,
        totalPages: response.data.totalPages,
        currentPage: response.data.currentPage,
        employeesCount: verifiedEmployees.length,
        page,
        rowsPerPage
      });
      if (verifiedEmployees.length < response.data.employees.length) {
        const filteredCount = response.data.employees.length - verifiedEmployees.length;
        console.warn(`Filtered out ${filteredCount} employees due to hierarchical access restrictions`);
        toast.warning(`${filteredCount} employee(s) were filtered out due to access restrictions`, {
          style: {
            borderRadius: '10px',
            background: theme.palette.mode === 'dark' ? '#333' : '#fff',
            color: theme.palette.mode === 'dark' ? '#fff' : '#333',
          },
        });
      }
    } catch (error) {
      console.error("❌ Error fetching employee data:", error);
      console.error("Error details:", error.response?.data || error.message);
      
      if (error.response?.status === 400 && error.response?.data?.error === "Region parameter is required") {
        setError("Please select a region to view employees");
      } else if (error.response?.status === 401 || error.response?.status === 403) {
        setError("Authentication required. Please login again.");
      } else {
        setError(`Failed to load employee data: ${error.response?.data?.error || error.message}`);
        
        // Show error toast
        toast.error("Failed to load employee data", {
          style: {
            borderRadius: '10px',
            background: theme.palette.mode === 'dark' ? '#333' : '#fff',
            color: theme.palette.mode === 'dark' ? '#fff' : '#333',
          },
        });
      }
      setEmployees([]);
      setTotalRecords(0);
    } finally {
      setLoading(false);
    }
  };

  // Handle external refresh trigger
  useEffect(() => {
    if (onDataChange) {
      // This effect will run when onDataChange changes, but we need to trigger refresh
      // The parent component should call onDataChange when data needs to be refreshed
    }
  }, [onDataChange]);

  // Reset page when anything except page changes
  useEffect(() => {
    setPage(0);
  }, [rowsPerPage, apiPath, refreshTrigger, refreshTriggerInternal, searchQuery, filters, sortConfig, activeRegion]);

  // Fetch data when any dependency changes
  useEffect(() => {
    fetchData();
  }, [page, rowsPerPage, apiPath, refreshTrigger, refreshTriggerInternal, searchQuery, filters, sortConfig, activeRegion]);

  useEffect(() => {
    // Count active filters
    const count = Object.values(filters).filter(value => value && value.trim() !== '').length;
    setActiveFiltersCount(count);
  }, [filters]);

  const handleFilterClick = (event, field) => {
    setAnchorEl(event.currentTarget);
    setActiveFilterField(field);
  };

  const handleFilterClose = () => {
    setAnchorEl(null);
    setActiveFilterField(null);
  };

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setPage(0); // Reset to first page on filter change
  };

  const handleClearFilter = (field) => {
    setFilters((prev) => ({ ...prev, [field]: "" }));
    if (field === activeFilterField) {
      handleFilterClose();
    }
  };

  const handleClearAllFilters = () => {
    const clearedFilters = Object.keys(filters).reduce((acc, key) => {
      acc[key] = "";
      return acc;
    }, {});
    setFilters(clearedFilters);
    setFilterMenuAnchorEl(null);
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      const activeEmployees = employees
        .filter((row) => row.employeeStatus === "Active")
        .map((row) => row._id);
      setSelectedRows(activeEmployees);
    } else {
      setSelectedRows([]);
    }
  };

  const handleSelectRow = (id, checked) => {
    if (checked) {
      setSelectedRows((prev) => [...prev, id]);
    } else {
      setSelectedRows((prev) => prev.filter((rowId) => rowId !== id));
    }
  };

  const handleChangePage = (event, newPage) => {
    console.log('📄 Page change:', { from: page, to: newPage, totalRecords, rowsPerPage });
    setPage(newPage);
    setSelectedRows([]);
    // Optional: Add loading state for page changes
    setLoading(true);
  };

  const handleChangeRowsPerPage = (event) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    console.log('📏 Rows per page change:', { from: rowsPerPage, to: newRowsPerPage });

    // Handle "All" option
    const actualRowsPerPage = newRowsPerPage === -1 ? totalRecords : newRowsPerPage;

    setRowsPerPage(actualRowsPerPage);
    setPage(0); // Reset to first page when changing rows per page
    setSelectedRows([]);
    setLoading(true);
  };

  const handleRefresh = () => {
    setRefreshTriggerInternal((prev) => prev + 1);
  };

  const handleStatusToggle = async (id, checked) => {
    const newStatus = checked ? "Active" : "Inactive";
    try {
      // Update both Status and employeeStatus fields for compatibility
      await api.put(`/employees/${id}`, { 
        employeeStatus: newStatus,
        Status: newStatus
      });
      
      // Refresh the table data
      handleRefresh();
      
      // Notify parent component to refresh stats
      if (onDataChange) {
        onDataChange();
      }
      
      return true;
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update employee status", {
        style: {
          borderRadius: '10px',
          background: theme.palette.mode === 'light' ? '#fff' : '#333',
          color: theme.palette.mode === 'light' ? '#333' : '#fff',
        },
      });
      return false;
    }
  };

  const handleSort = (field) => {
    if (field === 'select' || field === 'action') return;
    
    let direction = 'asc';
    if (sortConfig.field === field && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    
    setSortConfig({ field, direction });
    setPage(0); // Reset to first page on sort change
  };

  const handleFilterMenuOpen = (event) => {
    setFilterMenuAnchorEl(event.currentTarget);
  };

  const handleFilterMenuClose = () => {
    setFilterMenuAnchorEl(null);
  };

  const open = Boolean(anchorEl);
  const id = open ? "filter-popover" : undefined;
  const filterMenuOpen = Boolean(filterMenuAnchorEl);

  // Get searchable columns for filter menu
  const searchableColumns = columns.filter(col => 
    col.searchable && col.field !== 'select' && col.field !== 'action'
  );

  return (
    <>
      {/* Filter and Sort Controls */}
      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          mb: 2,
          flexWrap: 'wrap',
          gap: 1
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<FilterListIcon />}
            endIcon={activeFiltersCount > 0 ? <Chip size="small" label={activeFiltersCount} color="primary" /> : null}
            onClick={handleFilterMenuOpen}
            sx={{ 
              borderRadius: '8px',
              textTransform: 'none',
              fontWeight: 500
            }}
          >
            Filters
          </Button>
          
          <Menu
            anchorEl={filterMenuAnchorEl}
            open={filterMenuOpen}
            onClose={handleFilterMenuClose}
            PaperProps={{
              sx: { 
                width: 250,
                maxHeight: 400,
                borderRadius: '8px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
              }
            }}
          >
            <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="subtitle2">Filter Employees</Typography>
            </Box>
            <Divider />
            
            {searchableColumns.length > 0 ? (
              <>
                {searchableColumns.map((column) => (
                  <MenuItem key={column.field} sx={{ flexDirection: 'column', alignItems: 'flex-start', py: 1 }}>
                    <Typography variant="body2" fontWeight={500} sx={{ mb: 0.5 }}>
                      {column.label}
                    </Typography>
                    <TextField
                      size="small"
                      fullWidth
                      value={filters[column.field] || ""}
                      onChange={(e) => handleFilterChange(column.field, e.target.value)}
                      placeholder={`Filter by ${column.label.toLowerCase()}`}
                      variant="outlined"
                      InputProps={{
                        endAdornment: filters[column.field] ? (
                          <InputAdornment position="end">
                            <IconButton
                              size="small"
                              onClick={() => handleClearFilter(column.field)}
                              edge="end"
                            >
                              <ClearIcon fontSize="small" />
                            </IconButton>
                          </InputAdornment>
                        ) : null,
                      }}
                    />
                  </MenuItem>
                ))}
                <Divider />
                <Box sx={{ p: 1, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button 
                    size="small" 
                    onClick={handleClearAllFilters}
                    disabled={activeFiltersCount === 0}
                    sx={{ textTransform: 'none' }}
                  >
                    Clear All
                  </Button>
                </Box>
              </>
            ) : (
              <MenuItem disabled>No filterable columns available</MenuItem>
            )}
          </Menu>
          
          <Tooltip title="Refresh data">
            <IconButton 
              onClick={handleRefresh} 
              size="small"
              sx={{ 
                bgcolor: theme.palette.mode === 'light' ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.08)',
                '&:hover': {
                  bgcolor: theme.palette.mode === 'light' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.12)',
                }
              }}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {selectedRows.length > 0 && (
            <Chip 
              label={`${selectedRows.length} selected`} 
              color="primary" 
              size="small" 
              onDelete={() => setSelectedRows([])}
              sx={{ mr: 1 }}
            />
          )}
          <Typography variant="body2" color="text.secondary">
            Showing {employees.length > 0 ? (page * rowsPerPage) + 1 : 0} - {Math.min((page + 1) * rowsPerPage, totalRecords)} of {totalRecords} employees
          </Typography>
        </Box>
      </Box>

      {/* Error Alert */}
      <Collapse in={!!error}>
        <Alert 
          severity="error" 
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={handleRefresh}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      </Collapse>

      {/* Table and Pagination Container */}
      <Paper 
        sx={{ 
          borderRadius: '8px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
          overflow: 'hidden'
        }}
      >
        {/* Table */}
        <TableContainer 
          sx={{ 
            maxHeight: "60vh", 
            overflow: "auto",
            ...tableContainerProps.sx
          }}
        >
          <Table stickyHeader>
            <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell 
                  key={column.field} 
                  sx={{ 
                    bgcolor: theme.palette.mode === 'light' ? theme.palette.secondary.main : theme.palette.secondary.dark,
                    color: "#fff",
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    cursor: column.field !== 'select' && column.field !== 'action' ? 'pointer' : 'default',
                    '&:hover': {
                      bgcolor: column.field !== 'select' && column.field !== 'action' 
                        ? (theme.palette.mode === 'light' ? '#264524' : '#1b5e20') 
                        : undefined
                    },
                    transition: 'background-color 0.2s'
                  }}
                  onClick={() => handleSort(column.field)}
                >
                  <Box sx={{ display: "flex", alignItems: "center" }}>
                    {column.field === "select" ? (
                      <Checkbox
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        indeterminate={
                          selectedRows.length > 0 &&
                          selectedRows.length <
                            employees.filter((row) => row.employeeStatus === "Active").length
                        }
                        checked={
                          employees.length > 0 &&
                          selectedRows.length ===
                          employees.filter((row) => row.employeeStatus === "Active").length
                        }
                        disabled={employees.length === 0}
                        sx={{ 
                          color: '#fff',
                          '&.Mui-checked': {
                            color: '#fff',
                          },
                          '&.Mui-indeterminate': {
                            color: '#fff',
                          }
                        }}
                      />
                    ) : (
                      <Typography variant="subtitle2" component="span">
                        {column.label}
                      </Typography>
                    )}
                    
                    {column.field !== "select" && column.field !== "action" && (
                      <Box sx={{ display: 'flex', alignItems: 'center', ml: 0.5 }}>
                        {sortConfig.field === column.field && (
                          <SortIcon 
                            fontSize="small" 
                            sx={{ 
                              transform: sortConfig.direction === 'desc' ? 'rotate(180deg)' : 'none',
                              transition: 'transform 0.2s'
                            }} 
                          />
                        )}
                        {column.searchable && (
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFilterClick(e, column.field);
                            }}
                            sx={{ ml: 0.5, color: "#fff" }}
                          >
                            <FilterListIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Box>
                    )}
                  </Box>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              // Loading skeletons
              Array.from(new Array(5)).map((_, index) => (
                <TableRow key={index}>
                  {columns.map((column, colIndex) => (
                    <TableCell key={colIndex}>
                      <Skeleton animation="wave" height={30} width={colIndex === 0 ? 40 : '100%'} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : employees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ py: 4 }}>
                  <Typography variant="body1" color="text.secondary" gutterBottom>
                    No employees found
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {Object.values(filters).some(f => f) ? 
                      'Try adjusting your filters or search criteria' : 
                      'Add employees to get started'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              employees.map((row) => (
                <TableRow 
                  key={row._id}
                  sx={{ 
                    '&:hover': { 
                      bgcolor: theme.palette.mode === 'light' ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.08)'
                    },
                    bgcolor: row.employeeStatus === 'Inactive' ? 
                      (theme.palette.mode === 'light' ? 'rgba(0, 0, 0, 0.02)' : 'rgba(255, 255, 255, 0.02)') : 
                      'inherit',
                  }}
                >
                  {columns.map((column) => (
                    <TableCell 
                      key={column.field}
                      sx={{ 
                        color: row.employeeStatus === 'Inactive' ? 'text.disabled' : 'inherit',
                        borderBottom: `1px solid ${theme.palette.mode === 'light' ? '#e0e0e0' : '#424242'}`
                      }}
                    >
                      {column.field === "select" ? (
                        <Checkbox
                          checked={selectedRows.includes(row._id)}
                          onChange={(e) =>
                            handleSelectRow(row._id, e.target.checked)
                          }
                          disabled={row.employeeStatus === "Inactive"}
                          size="small"
                        />
                      ) : column.field === "employeeStatus" ? (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Chip 
                            label={row.employeeStatus || "N/A"} 
                            color={row.employeeStatus === "Active" ? "success" : "error"}
                            size="small"
                            sx={{ minWidth: '70px' }}
                          />
                          <Switch
                            checked={row.employeeStatus === "Active"}
                            onChange={(e) => handleStatusToggle(row._id, e.target.checked)}
                            size="small"
                          />
                        </Box>
                      ) : column.render ? (
                        (() => {
                          const renderResult = column.render(row);
                          if (renderResult && typeof renderResult === "object" && "render" in renderResult) {
                            const { render, onChange } = renderResult;
                            return React.cloneElement(render, {
                              onChange: async (e) => {
                                const success = await onChange(e.target.checked);
                                if (success) handleRefresh();
                              },
                            });
                          }
                          return renderResult;
                        })()
                      ) : (
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            color: row.employeeStatus === 'Inactive' ? 'text.disabled' : 'inherit'
                          }}
                        >
                          {row[column.field] || ""}
                        </Typography>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Sticky Pagination inside scroll area */}
        {totalRecords > 0 && (
          <Box
            sx={{
              position: 'sticky',
              bottom: 0,
              left: 0,
              right: 0,
              bgcolor: theme.palette.background.paper,
              borderTop: `1px solid ${theme.palette.mode === 'light' ? '#e0e0e0' : '#424242'}`,
              px: 2,
              py: 1.25,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              zIndex: 1
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography variant="body2" color="text.secondary">
                Employees per page:
              </Typography>
              <Select
                size="small"
                value={rowsPerPage === totalRecords ? -1 : rowsPerPage}
                onChange={handleChangeRowsPerPage}
                sx={{
                  minWidth: 100,
                  height: 36,
                  borderRadius: '8px',
                  '& .MuiSelect-select': {
                    py: 0.75
                  }
                }}
              >
                <MenuItem value={10}>10</MenuItem>
                <MenuItem value={20}>20</MenuItem>
                <MenuItem value={50}>50</MenuItem>
                <MenuItem value={100}>100</MenuItem>
                <MenuItem value={-1}>All</MenuItem>
              </Select>
            </Box>

            <Pagination
              count={rowsPerPage === -1 || rowsPerPage === totalRecords ? 1 : Math.max(1, Math.ceil(totalRecords / rowsPerPage))}
              page={totalRecords === 0 ? 1 : Math.min(page + 1, (rowsPerPage === -1 || rowsPerPage === totalRecords) ? 1 : Math.ceil(totalRecords / rowsPerPage))}
              onChange={(e, value) => handleChangePage(e, value - 1)}
              variant="outlined"
              shape="rounded"
              color="primary"
              siblingCount={1}
              boundaryCount={1}
              sx={{
                '& .MuiPaginationItem-root': {
                  border: `2px solid ${theme.palette.mode === 'light' ? '#1976d2' : '#90caf9'}`,
                  borderRadius: '8px',
                  fontWeight: 500,
                  '&.Mui-selected': {
                    backgroundColor: theme.palette.primary.main,
                    color: '#fff',
                    borderColor: theme.palette.primary.dark,
                  },
                  '&:hover': {
                    backgroundColor: theme.palette.primary.main,
                    color: '#fff',
                    borderColor: theme.palette.primary.dark,
                  }
                }
              }}
            />
          </Box>
        )}
        
        {/* Filter Popover */}
        <Popover
          id={id}
          open={open}
          anchorEl={anchorEl}
          onClose={handleFilterClose}
          anchorOrigin={{
            vertical: "bottom",
            horizontal: "left",
          }}
          transformOrigin={{
            vertical: "top",
            horizontal: "left",
          }}
          PaperProps={{
            sx: { 
              borderRadius: '8px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
            }
          }}
        >
          <Box sx={{ p: 2, width: 250 }}>
            <Typography variant="subtitle2" gutterBottom>
              Filter by {columns.find((col) => col.field === activeFilterField)?.label}
            </Typography>
            <TextField
              size="small"
              placeholder="Enter filter value"
              value={filters[activeFilterField] || ""}
              onChange={(e) => handleFilterChange(activeFilterField, e.target.value)}
              fullWidth
              variant="outlined"
              autoFocus
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: filters[activeFilterField] ? (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => handleClearFilter(activeFilterField)}
                      edge="end"
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
              <Button 
                size="small" 
                onClick={handleFilterClose}
                sx={{ textTransform: 'none' }}
              >
                Done
              </Button>
            </Box>
          </Box>
        </Popover>
        
      </TableContainer>
      

      
      {/* Debug Info */}
      {process.env.NODE_ENV === 'development' && (
        <Box sx={{ p: 2, bgcolor: 'grey.100', borderTop: '1px solid #e0e0e0' }}>
          <Typography variant="body2" color="text.secondary">
            Debug: Page {page + 1}, Rows per page: {rowsPerPage}, Total: {totalRecords}, 
            Employees shown: {employees.length}
          </Typography>
        </Box>
      )}
      </Paper>
    </>
  );
};

CustomTable.propTypes = {
  ROWS_PER_PAGE: PropTypes.number.isRequired,
  dataListName: PropTypes.string.isRequired,
  apiPath: PropTypes.string.isRequired,
  columns: PropTypes.arrayOf(
    PropTypes.shape({
      field: PropTypes.string.isRequired,
      label: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
      type: PropTypes.string,
      searchable: PropTypes.bool,
      render: PropTypes.func,
    })
  ).isRequired,
  searchQuery: PropTypes.string,
  tableContainerProps: PropTypes.object,
  onDataChange: PropTypes.func,
  refreshTrigger: PropTypes.number,
};

export default CustomTable;
