import React, { useState, useEffect } from "react";
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
  CircularProgress,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  InputAdornment,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import VisibilityIcon from "@mui/icons-material/Visibility";
import UndoIcon from "@mui/icons-material/Undo";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import SearchIcon from "@mui/icons-material/Search";
import api from "../../config/api";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useUser } from "../../context/UserContext";

// View Proposal Button
export const ViewButton = ({ row }) => {
  const { currentUser } = useUser();
  
  // Debug logging for user data
  console.log('👤 ViewButton User Debug:', {
    currentUser: currentUser,
    hierarchicalAccess: currentUser?.hierarchicalAccess,
    scope: currentUser?.hierarchicalAccess?.scope,
    workflowRoles: currentUser?.hierarchicalAccess?.workflowRoles,
    rolePermissions: currentUser?.hierarchicalAccess?.rolePermissions,
    hierarchicalFlags: currentUser?.hierarchicalFlags
  });
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState(null);
  const [detailedData, setDetailedData] = useState([]);
  const [categoryMap, setCategoryMap] = useState({});
  // Add this state at the component level for MOOE expandable groups
  const [expandedGroups, setExpandedGroups] = useState({});
  
  // Add these state variables inside the ViewButton component
  const [searchTerm, setSearchTerm] = useState('');
  const [filterField, setFilterField] = useState('all');
  const [filteredData, setFilteredData] = useState([]);
  
  // Fetch categories when component mounts
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await api.get('/categories');
        const categories = response.data.categories || [];
        
        // Create a map of category IDs to names
        const map = {};
        categories.forEach(cat => {
          if (cat._id && cat.categoryName) {
            map[cat._id] = cat.categoryName;
          }
        });
        
        setCategoryMap(map);
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    };
    
    fetchCategories();
  }, []);

  // Add this useEffect to handle filtering
  useEffect(() => {
    if (!Array.isArray(detailedData)) {
      setFilteredData([]);
      return;
    }
    
    if (!searchTerm.trim()) {
      setFilteredData(detailedData);
      return;
    }
    
    const lowercasedSearch = searchTerm.toLowerCase();
    
    const filtered = detailedData.filter(item => {
      if (filterField === 'all') {
        // Search in all text fields
        return (
          (item.positionTitle?.toLowerCase().includes(lowercasedSearch) || false) ||
          (item.employeeFullName?.toLowerCase().includes(lowercasedSearch) || false) ||
          (item.division?.toLowerCase().includes(lowercasedSearch) || false) ||
          (item.department?.toLowerCase().includes(lowercasedSearch) || false) ||
          (item.employeeNumber?.toLowerCase().includes(lowercasedSearch) || false) ||
          (item.gradelevel_SG?.toString().includes(lowercasedSearch) || false)
        );
      } else {
        // Search in specific field
        const fieldValue = item[filterField];
        if (fieldValue === undefined || fieldValue === null) return false;
        
        return fieldValue.toString().toLowerCase().includes(lowercasedSearch);
      }
    });
    
    setFilteredData(filtered);
  }, [detailedData, searchTerm, filterField]);

  const handleView = async () => {
    setLoading(true);
    try {
      setDetails(row);
      
      // Fetch detailed data based on expenditure type
      const params = {
        fiscalYear: row.fiscalYear,
        budgetType: row.budgetType,
        processBy: row.processBy,
        region: row.region
      };

      // Determine which endpoint to call based on expenditure type
      if (row.cobExpenditures === "Personnel Services - PERMANENT" || 
          (row.cobExpenditures && row.cobExpenditures.includes("Personnel") && 
           row.cobExpenditures.includes("PERMANENT"))) {
        try {
          const response = await api.get("/getpersonnels/byParams", { 
            params: { 
              ...params, 
              statusOfAppointment: "PERMANENT" 
            } 
          });
          
          if (response.data && Array.isArray(response.data)) {
            // Filter to ensure only PERMANENT personnel are included
            const permanentOnly = response.data.filter(person => 
              person.statusOfAppointment === "PERMANENT"
            );
            setDetailedData(permanentOnly);
          } else {
            console.warn("Response data is not an array:", response.data);
            setDetailedData([]);
          }
        } catch (err) {
          console.error("Error fetching permanent personnel data:", err);
          console.error("Error details:", err.response?.data || err.message);
          toast.error("Failed to load permanent personnel details");
          setDetailedData([]);
        }
      } else if (row.cobExpenditures === "Personnel Services - CASUAL") {
        try {
          const response = await api.get("/getpersonnels/byParams", { 
            params: { ...params, statusOfAppointment: "CASUAL" } 
          });
          
          if (response.data && Array.isArray(response.data)) {
            // Filter to ensure only CASUAL personnel are included
            const casualOnly = response.data.filter(person => 
              person.statusOfAppointment === "CASUAL"
            );
            setDetailedData(casualOnly);
          } else {
            console.warn("Response data is not an array:", response.data);
            setDetailedData([]);
          }
        } catch (err) {
          console.error("Error fetching casual personnel data:", err);
          toast.error("Failed to load casual personnel details");
          setDetailedData([]);
        }
      } else if (row.cobExpenditures === "MOOE") {
        try {
          const response = await api.get("/mooe/getByParams", { params });
          setDetailedData(Array.isArray(response.data) ? response.data : []);
        } catch (err) {
          console.error("Error fetching MOOE data:", err);
          toast.error("Failed to load MOOE details");
        }
      } else if (row.cobExpenditures === "Capital Outlay") {
        try {
          // Fix the endpoint URL to match the one defined in your server router
          const response = await api.get("/capital-outlay/getByParams", { params });
          setDetailedData(Array.isArray(response.data) ? response.data : []);
        } catch (err) {
          console.error("Error fetching Capital Outlay data:", err);
          toast.error("Failed to load Capital Outlay details");
        }
      } else if (row.cobExpenditures === "Income") {
        try {
          const response = await api.get("/income/getByParams", { params });
          setDetailedData(Array.isArray(response.data) ? response.data : []);
        } catch (err) {
          console.error("Error fetching Income data:", err);
          toast.error("Failed to load Income details");
        }
      }
      
      setOpen(true);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load proposal details");
    } finally {
      setLoading(false);
    }
  };

  // Helper function to format currency
  const formatCurrency = (value) => {
    return typeof value === 'number' 
      ? value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '0.00';
  };

  // Toggle expansion of a MOOE group
  const toggleGroupExpand = (sublineItem) => {
    setExpandedGroups(prev => ({
      ...prev,
      [sublineItem]: !prev[sublineItem]
    }));
  };

  // Render different tables based on expenditure type
  const renderDetailedContent = () => {
    
    // Check if details is null or undefined
    if (!details) {
      return (
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="body1">
            No proposal details available.
          </Typography>
        </Box>
      );
    }

    // Check exact string comparison and type

    if (!details || !details.cobExpenditures) return null;
    
    // Add this at the beginning of the renderDetailedContent function
    // to track which condition is being matched
    let contentRendered = false;

    if (details.cobExpenditures && 
        (details.cobExpenditures === "Personnel Services - PERMANENT" || 
         (details.cobExpenditures.includes("Personnel") && 
          details.cobExpenditures.includes("PERMANENT")))) {
      
      contentRendered = true;
      
      // Make a safe copy of the data to avoid mutation issues
      const sortedData = Array.isArray(filteredData) ? [...filteredData] : [];
      
      // Sort data if we have any
      if (sortedData.length > 0) {
        sortedData.sort((a, b) => {
          // First sort by SG (Grade Level) in descending order
          const sgA = parseInt(a.gradelevel_SG || '0', 10);
          const sgB = parseInt(b.gradelevel_SG || '0', 10);
          
          if (sgB !== sgA) {
            return sgB - sgA; // Higher SG first
          }
          
          // Then by position title
          if (a.positionTitle !== b.positionTitle) {
            return (a.positionTitle || '').localeCompare(b.positionTitle || '');
          }
          
          // Finally by employee name
          return (a.employeeFullName || '').localeCompare(b.employeeFullName || '');
        });
      }
      
      // Calculate grand totals
      const grandTotal = sortedData.reduce((sum, item) => {
        const total = parseFloat(item.Total || 0);
        return sum + (isNaN(total) ? 0 : total);
      }, 0);
      
      return (
        <>
          {/* Search and filter controls */}
          <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'flex-end' }}>
            <TextField
              label="Search Personnel"
              variant="outlined"
              size="small"
              fullWidth
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
            
            <FormControl variant="outlined" size="small" sx={{ minWidth: 200 }}>
              <InputLabel id="filter-field-label">Search In</InputLabel>
              <Select
                labelId="filter-field-label"
                value={filterField}
                onChange={(e) => setFilterField(e.target.value)}
                label="Search In"
              >
                <MenuItem value="all">All Fields</MenuItem>
                <MenuItem value="positionTitle">Position Title</MenuItem>
                <MenuItem value="employeeFullName">Employee Name</MenuItem>
                <MenuItem value="employeeNumber">Employee Number</MenuItem>
                <MenuItem value="division">Division</MenuItem>
                <MenuItem value="department">Department</MenuItem>
                <MenuItem value="gradelevel_SG">Salary Grade</MenuItem>
              </Select>
            </FormControl>
          </Box>
          
          <Box sx={{ mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Showing {sortedData.length} of {Array.isArray(detailedData) ? detailedData.length : 0} records
            </Typography>
          </Box>
          
          <TableContainer 
            component={Paper} 
            variant="outlined" 
            sx={{ 
              mb: 3, 
              maxHeight: 600, 
              overflow: 'auto'
            }}
          >
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#375e38' }}>
                  <TableCell sx={{ color: 'white', backgroundColor: '#375e38', width: '15%' }}><strong>Position Title</strong></TableCell>
                  <TableCell sx={{ color: 'white', backgroundColor: '#375e38', width: '5%' }}><strong>SG</strong></TableCell>
                  <TableCell sx={{ color: 'white', backgroundColor: '#375e38', width: '5%' }}><strong>Step</strong></TableCell>
                  <TableCell sx={{ color: 'white', backgroundColor: '#375e38', width: '15%' }}><strong>Employee Name</strong></TableCell>
                  <TableCell sx={{ color: 'white', backgroundColor: '#375e38', width: '10%' }}><strong>Division</strong></TableCell>
                  <TableCell sx={{ color: 'white', backgroundColor: '#375e38', width: '7%' }} align="right"><strong>Monthly</strong></TableCell>
                  <TableCell sx={{ color: 'white', backgroundColor: '#375e38', width: '7%' }} align="right"><strong>Annual</strong></TableCell>
                  <TableCell sx={{ color: 'white', backgroundColor: '#375e38', width: '5%' }} align="right"><strong>RATA</strong></TableCell>
                  <TableCell sx={{ color: 'white', backgroundColor: '#375e38', width: '5%' }} align="right"><strong>PERA</strong></TableCell>
                  <TableCell sx={{ color: 'white', backgroundColor: '#375e38', width: '5%' }} align="right"><strong>Uniform</strong></TableCell>
                  <TableCell sx={{ color: 'white', backgroundColor: '#375e38', width: '5%' }} align="right"><strong>Mid-Year</strong></TableCell>
                  <TableCell sx={{ color: 'white', backgroundColor: '#375e38', width: '5%' }} align="right"><strong>Year-End</strong></TableCell>
                  <TableCell sx={{ color: 'white', backgroundColor: '#375e38', width: '7%' }} align="right"><strong>Total</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedData.length > 0 ? (
                  sortedData.map((personnel, index) => (
                    <TableRow 
                      key={personnel._id || personnel.employeeNumber || index}
                      sx={{ 
                        '&:nth-of-type(odd)': { backgroundColor: '#f9f9f9' },
                        '&:hover': { backgroundColor: '#f0f0f0' }
                      }}
                    >
                      <TableCell width="15%">{personnel.positionTitle || 'N/A'}</TableCell>
                      <TableCell width="5%">{personnel.gradelevel_SG || 'N/A'}</TableCell>
                      <TableCell width="5%">{personnel.step || 'N/A'}</TableCell>
                      <TableCell width="15%">{personnel.employeeFullName || 'N/A'}</TableCell>
                      <TableCell width="10%">{personnel.division || 'N/A'}</TableCell>
                      <TableCell width="7%" align="right">{formatCurrency(parseFloat(personnel.monthlySalary || 0))}</TableCell>
                      <TableCell width="7%" align="right">{formatCurrency(parseFloat(personnel.annualSalary || 0))}</TableCell>
                      <TableCell width="5%" align="right">{formatCurrency(parseFloat(personnel.RATA || 0))}</TableCell>
                      <TableCell width="5%" align="right">{formatCurrency(parseFloat(personnel.PERA || 0))}</TableCell>
                      <TableCell width="5%" align="right">{formatCurrency(parseFloat(personnel.uniformALLOWANCE || 0))}</TableCell>
                      <TableCell width="5%" align="right">{formatCurrency(parseFloat(personnel.midyearBonus || 0))}</TableCell>
                      <TableCell width="5%" align="right">{formatCurrency(parseFloat(personnel.yearEndBonus || 0))}</TableCell>
                      <TableCell width="7%" align="right">{formatCurrency(parseFloat(personnel.Total || 0))}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={13} align="center">
                      {searchTerm ? 'No matching records found' : 'No permanent personnel data available'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Display grand total outside the table instead */}
          {sortedData.length > 0 && (
            <Box 
              sx={{ 
                display: 'flex', 
                justifyContent: 'flex-end', 
                alignItems: 'center',
                mb: 2,
                mt: 1
              }}
            >
              <Typography variant="body1" fontWeight="bold" mr={2}>
                GRAND TOTAL:
              </Typography>
              <Typography variant="body1" fontWeight="bold">
                {formatCurrency(grandTotal)}
              </Typography>
            </Box>
          )}
        </>
      );
    } else if (details.cobExpenditures && 
        (details.cobExpenditures === "Personnel Services - CASUAL" || 
         details.cobExpenditures === "Personnel - Casual" ||
         (details.cobExpenditures.includes("Personnel") && 
          details.cobExpenditures.includes("CASUAL")))) {
      
      // Calculate grand total for casual personnel
      const grandTotal = filteredData.reduce((sum, item) => {
        const total = parseFloat(item.totalCompensation || item.Total || 0);
        return sum + (isNaN(total) ? 0 : total);
      }, 0);
      
      contentRendered = true;
      return (
        <>
          {/* Search and filter controls */}
          <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'flex-end' }}>
            <TextField
              label="Search Personnel"
              variant="outlined"
              size="small"
              fullWidth
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
            
            <FormControl variant="outlined" size="small" sx={{ minWidth: 200 }}>
              <InputLabel id="filter-field-label">Search In</InputLabel>
              <Select
                labelId="filter-field-label"
                value={filterField}
                onChange={(e) => setFilterField(e.target.value)}
                label="Search In"
              >
                <MenuItem value="all">All Fields</MenuItem>
                <MenuItem value="positionTitle">Position Title</MenuItem>
                <MenuItem value="employeeFullName">Employee Name</MenuItem>
                <MenuItem value="division">Division</MenuItem>
                <MenuItem value="gradelevel_JG">Salary Grade</MenuItem>
              </Select>
            </FormControl>
          </Box>
          
          <Box sx={{ mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Showing {filteredData.length} of {Array.isArray(detailedData) ? detailedData.length : 0} records
            </Typography>
          </Box>
          
          <TableContainer 
            component={Paper} 
            variant="outlined" 
            sx={{ 
              mb: 3, 
              maxHeight: 600, 
              overflow: 'auto'
            }}
          >
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: 'white', backgroundColor: '#375e38' }}><strong>Position Title</strong></TableCell>
                  <TableCell sx={{ color: 'white', backgroundColor: '#375e38' }}><strong>SG</strong></TableCell>
                  <TableCell sx={{ color: 'white', backgroundColor: '#375e38' }}><strong>Step</strong></TableCell>
                  <TableCell sx={{ color: 'white', backgroundColor: '#375e38' }}><strong>Employee Name</strong></TableCell>
                  <TableCell sx={{ color: 'white', backgroundColor: '#375e38' }}><strong>Division</strong></TableCell>
                  <TableCell sx={{ color: 'white', backgroundColor: '#375e38' }} align="right"><strong>Monthly</strong></TableCell>
                  <TableCell sx={{ color: 'white', backgroundColor: '#375e38' }} align="right"><strong>Annual</strong></TableCell>
                  <TableCell sx={{ color: 'white', backgroundColor: '#375e38' }} align="right"><strong>PERA</strong></TableCell>
                  <TableCell sx={{ color: 'white', backgroundColor: '#375e38' }} align="right"><strong>Total</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredData.length > 0 ? (
                  filteredData.map((item, index) => (
                    <TableRow 
                      key={item._id || item.employeeNumber || index}
                      sx={{ 
                        '&:nth-of-type(odd)': { backgroundColor: '#f9f9f9' },
                        '&:hover': { backgroundColor: '#f0f0f0' }
                      }}
                    >
                      <TableCell>{item.positionTitle || 'N/A'}</TableCell>
                      <TableCell>{item.salaryGrade ? item.salaryGrade.toString().replace(/^JG-?/, '') : (item.gradelevel_JG ? item.gradelevel_JG.toString().replace(/^JG-?/, '') : 'N/A')}</TableCell>
                      <TableCell>{item.step || 'N/A'}</TableCell>
                      <TableCell>{item.employeeFullName || 'N/A'}</TableCell>
                      <TableCell>{item.division || 'N/A'}</TableCell>
                      <TableCell align="right">{formatCurrency(parseFloat(item.monthlySalary || 0))}</TableCell>
                      <TableCell align="right">{formatCurrency(parseFloat(item.annualSalary || 0))}</TableCell>
                      <TableCell align="right">{formatCurrency(parseFloat(item.pera || item.PERA || 0))}</TableCell>
                      <TableCell align="right">{formatCurrency(parseFloat(item.totalCompensation || item.Total || 0))}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} align="center">
                      {searchTerm ? 'No matching records found' : 'No casual personnel data available'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          
          {/* Display grand total outside the table */}
          {filteredData.length > 0 && (
            <Box 
              sx={{ 
                display: 'flex', 
                justifyContent: 'flex-end', 
                alignItems: 'center',
                mb: 2,
                mt: 1
              }}
            >
              <Typography variant="body1" fontWeight="bold" mr={2}>
                GRAND TOTAL:
              </Typography>
              <Typography variant="body1" fontWeight="bold">
                {formatCurrency(grandTotal)}
              </Typography>
            </Box>
          )}
        </>
      );
    } else if (details.cobExpenditures === "MOOE") {
      contentRendered = true;
      // Group data by sublineItem
      const groupedBySubline = {};
      
      // First sort by UACS code
      const sortedData = [...detailedData].sort((a, b) => {
        // Extract numeric part from UACS code for better sorting
        const codeA = a.uacsCode ? a.uacsCode.replace(/[^0-9]/g, '') : '0';
        const codeB = b.uacsCode ? b.uacsCode.replace(/[^0-9]/g, '') : '0';
        
        // If codes are different, sort by code
        if (codeA !== codeB) {
          return codeA.localeCompare(codeB);
        }
        
        // If codes are the same, sort by sublineItem
        return (a.sublineItem || '').localeCompare(b.sublineItem || '');
      });
      
      // Then group by sublineItem
      sortedData.forEach(item => {
        const sublineItem = item.sublineItem || "Other";
        if (!groupedBySubline[sublineItem]) {
          groupedBySubline[sublineItem] = [];
        }
        groupedBySubline[sublineItem].push(item);
      });
      
      // Convert to array and sort subline items by their first item's UACS code
      const sublineGroups = Object.keys(groupedBySubline).map(subline => {
        // Sort items within each subline group by UACS code
        const sortedItems = groupedBySubline[subline].sort((a, b) => {
          const codeA = a.uacsCode ? a.uacsCode.replace(/[^0-9]/g, '') : '0';
          const codeB = b.uacsCode ? b.uacsCode.replace(/[^0-9]/g, '') : '0';
          return codeA.localeCompare(codeB);
        });
        
        // Get the first UACS code for sorting the groups
        const firstUacsCode = sortedItems[0]?.uacsCode?.replace(/[^0-9]/g, '') || '0';
        
        return {
          sublineItem: subline,
          items: sortedItems,
          firstUacsCode
        };
      }).sort((a, b) => a.firstUacsCode.localeCompare(b.firstUacsCode));
      
      // Calculate totals
      const grandTotalAmount = sortedData.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
      const grandTotalSubsidy = sortedData.reduce((sum, item) => sum + parseFloat(item.subsidy || 0), 0);
      
      return (
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 3, mt: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: '#375e38' }}>
                <TableCell sx={{ color: 'white', width: '40%' }}><strong>Sub-line Item / Accounting Title</strong></TableCell>
                <TableCell sx={{ color: 'white' }} align="right"><strong>Amount</strong></TableCell>
                <TableCell sx={{ color: 'white' }} align="right"><strong>Subsidy</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sublineGroups.length > 0 ? (
                sublineGroups.map((group) => {
                  // Calculate subtotals for this group
                  const subtotalAmount = group.items.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
                  const subtotalSubsidy = group.items.reduce((sum, item) => sum + parseFloat(item.subsidy || 0), 0);
                  
                  return (
                    <React.Fragment key={group.sublineItem}>
                      {/* Parent row (Subline Item) */}
                      <TableRow 
                        sx={{ 
                          backgroundColor: '#e6e7e8',
                          cursor: 'pointer',
                          '&:hover': { backgroundColor: '#d5d6d7' }
                        }}
                        onClick={() => toggleGroupExpand(group.sublineItem)}
                      >
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            {expandedGroups[group.sublineItem] ? 
                              <KeyboardArrowDownIcon fontSize="small" /> : 
                              <KeyboardArrowRightIcon fontSize="small" />
                            }
                            <Typography sx={{ fontWeight: 'bold', ml: 1 }}>
                              {group.sublineItem}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                          {formatCurrency(subtotalAmount)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                          {formatCurrency(subtotalSubsidy)}
                        </TableCell>
                      </TableRow>
                      
                      {/* Child rows (Accounting Titles) */}
                      {expandedGroups[group.sublineItem] && group.items.map((item, index) => (
                        <TableRow key={`${group.sublineItem}-${index}`}>
                          <TableCell sx={{ pl: 4 }}>
                            {item.accountingTitle || "No title specified"}
                          </TableCell>
                          <TableCell align="right">
                            {formatCurrency(parseFloat(item.amount || 0))}
                          </TableCell>
                          <TableCell align="right">
                            {formatCurrency(parseFloat(item.subsidy || 0))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </React.Fragment>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={3} align="center">No MOOE data available</TableCell>
                </TableRow>
              )}
              
              {/* Grand total row */}
              {sublineGroups.length > 0 && (
                <TableRow sx={{ backgroundColor: '#375e38' }}>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>
                    GRAND TOTAL
                  </TableCell>
                  <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>
                    {formatCurrency(grandTotalAmount)}
                  </TableCell>
                  <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>
                    {formatCurrency(grandTotalSubsidy)}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      );
    } else if (details.cobExpenditures === "Capital Outlay") {
      
      // Group by category
      const groupedItems = {};
      
      // Group items by their category
      detailedData.forEach(item => {
        // Get category information
        let categoryId;
        
        if (item.category) {
          // Handle both populated and unpopulated category fields
          if (typeof item.category === 'object' && item.category._id) {
            categoryId = item.category._id;
          } else {
            categoryId = item.category;
          }
          
          // Get category name from our map
          const categoryName = categoryMap[categoryId] || "Unknown Category";
          
          // Initialize the category group if it doesn't exist
          if (!groupedItems[categoryId]) {
            groupedItems[categoryId] = {
              id: categoryId,
              name: categoryName,
              items: []
            };
          }
          
          // Add the item to its category group
          groupedItems[categoryId].items.push(item);
        } else {
          // Handle items without a category
          const otherId = "other";
          if (!groupedItems[otherId]) {
            groupedItems[otherId] = {
              id: otherId,
              name: "OTHER CAPITAL OUTLAYS",
              items: []
            };
          }
          groupedItems[otherId].items.push(item);
        }
      });
      
      // Convert to array and sort by name
      const categories = Object.values(groupedItems).sort((a, b) => 
        a.name.localeCompare(b.name)
      );

      // Calculate grand totals
      const grandTotalSubsidy = detailedData.reduce((sum, item) => sum + parseFloat(item.subsidy || 0), 0);
      const grandTotalAmount = detailedData.reduce((sum, item) => sum + parseFloat(item.cost || 0), 0);
      
      return (<>
        {categories.map((category, categoryIndex) => {
          const categoryTotalSubsidy = category.items.reduce((sum, item) => sum + parseFloat(item.subsidy || 0), 0);
          const categoryTotalAmount = category.items.reduce((sum, item) => sum + parseFloat(item.cost || 0), 0);
          
          return (
            <React.Fragment key={category.id}>
              <Typography 
                variant="h6" 
                sx={{ 
                  mt: categoryIndex > 0 ? 3 : 2, 
                  mb: 0, 
                  backgroundColor: '#375e38',
                  color: 'white',
                  p: 1,
                  borderRadius: '4px 4px 0 0',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}
              >
                <span>{category.name}</span>
                <span>Total: ₱{formatCurrency(categoryTotalAmount)}</span>
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ backgroundColor: '#375e38' }}>
                      <TableCell sx={{ color: 'white' }}><strong>Subline Item</strong></TableCell>
                      <TableCell sx={{ color: 'white' }}><strong>Accounting Title</strong></TableCell>
                      <TableCell sx={{ color: 'white' }}><strong>UACS Code</strong></TableCell>
                      <TableCell sx={{ color: 'white' }}><strong>Particulars</strong></TableCell>
                      <TableCell sx={{ color: 'white' }} align="right"><strong>Subsidy</strong></TableCell>
                      <TableCell sx={{ color: 'white' }} align="right"><strong>Amount</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {category.items.map((item, index) => (
                      <TableRow key={item._id || item.uacsCode || index}>
                        <TableCell>{item.sublineItem || ""}</TableCell>
                        <TableCell>{item.accountingTitle || ""}</TableCell>
                        <TableCell>{item.uacsCode || ""}</TableCell>
                        <TableCell>{item.particulars || ""}</TableCell>
                        <TableCell align="right">{formatCurrency(parseFloat(item.subsidy || 0))}</TableCell>
                        <TableCell align="right">{formatCurrency(parseFloat(item.cost || 0))}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                      <TableCell colSpan={4}><strong>SUBTOTAL</strong></TableCell>
                      <TableCell align="right"><strong>{formatCurrency(categoryTotalSubsidy)}</strong></TableCell>
                      <TableCell align="right"><strong>{formatCurrency(categoryTotalAmount)}</strong></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </React.Fragment>
          );
        })}
        
        {/* Grand Total Row */}
        {detailedData.length > 0 && (
          <TableContainer component={Paper} variant="outlined" sx={{ mb: 3, backgroundColor: '#375e38' }}>
            <Table size="small">
              <TableBody>
                <TableRow sx={{ backgroundColor: '#375e38' }}>
                  <TableCell colSpan={4} sx={{ color: 'white' }}><strong>GRAND TOTAL:</strong></TableCell>
                  <TableCell align="right" sx={{ color: 'white' }}><strong>₱{formatCurrency(grandTotalSubsidy)}</strong></TableCell>
                  <TableCell align="right" sx={{ color: 'white' }}><strong>₱{formatCurrency(grandTotalAmount)}</strong></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </>);
    } else if (details.cobExpenditures === "Income") {
      return (
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 3, mt: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><strong>Source</strong></TableCell>
                <TableCell><strong>Category</strong></TableCell>
                <TableCell><strong>Description</strong></TableCell>
                <TableCell><strong>Amount</strong></TableCell>
                <TableCell><strong>Remarks</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {detailedData.length > 0 ? (
                detailedData.map((item, index) => (
                  <TableRow key={item._id || item.source || index}>
                    <TableCell>{item.source || "N/A"}</TableCell>
                    <TableCell>{item.category?.name || item.category || "N/A"}</TableCell>
                    <TableCell>{item.description || item.name || "N/A"}</TableCell>
                    <TableCell>{formatCurrency(parseFloat(item.amount || 0))}</TableCell>
                    <TableCell>{item.remarks || "N/A"}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} align="center">No Income data available</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      );
    }
    
    // Add this debugging section at the end of renderDetailedContent
    // This will help identify if we're falling through all conditions
    if (!contentRendered) {
      return (
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="body1">
            No detailed view available for "{details.cobExpenditures}" expenditure type.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Debug info: Type={typeof details.cobExpenditures}, Value="{details.cobExpenditures}"
          </Typography>
        </Box>
      );
    }
  };

  return (
    <>
      <Tooltip title="View Details">
        <IconButton 
          color="primary" 
          onClick={handleView} 
          disabled={loading}
          size="small"
        >
          {loading ? <CircularProgress size={20} /> : <VisibilityIcon />}
        </IconButton>
      </Tooltip>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          {details?.cobExpenditures} Proposal Details
        </DialogTitle>
        <DialogContent>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <Typography variant="h6" gutterBottom>
                Summary
              </Typography>
              <TableContainer component={Paper} sx={{ mb: 3 }}>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell><strong>Process By:</strong></TableCell>
                      <TableCell>{details?.processBy}</TableCell>
                      <TableCell><strong>Region:</strong></TableCell>
                      <TableCell>{details?.region}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><strong>Fiscal Year:</strong></TableCell>
                      <TableCell>{details?.fiscalYear}</TableCell>
                      <TableCell><strong>Budget Type:</strong></TableCell>
                      <TableCell>{details?.budgetType}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><strong>Status:</strong></TableCell>
                      <TableCell>{details?.status}</TableCell>
                      <TableCell><strong>Expenditure Type:</strong></TableCell>
                      <TableCell>{details?.cobExpenditures}</TableCell>
                    </TableRow>
                    {details?.totalExpenses && (
                      <TableRow>
                        <TableCell><strong>Total Amount:</strong></TableCell>
                        <TableCell colSpan={3}>{formatCurrency(details.totalExpenses)}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              
              <Typography variant="h6" gutterBottom>
                Detailed Records
              </Typography>
              {renderDetailedContent()}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

// Helpers
const mapCobToEntity = (cob) => {
  if (!cob) return 'personnel';
  const s = String(cob).toLowerCase();
  if (s.includes('personnel')) return 'personnel';
  if (s.includes('mooe')) return 'mooe';
  if (s.includes('capital')) return 'capital';
  if (s.includes('income') || s.includes('corporate')) return 'income';
  return 'personnel';
};

const fetchIdsForRow = async (row, targetStatus) => {
  const entity = mapCobToEntity(row.cobExpenditures);
  const params = {
    fiscalYear: row.fiscalYear,
    budgetType: row.budgetType,
    processBy: row.processBy,
    region: row.region,
  };
  let url = '';
  switch (entity) {
    case 'personnel':
      url = '/getpersonnels/byParams';
      break;
    case 'mooe':
      url = '/mooe/getByParams';
      break;
    case 'capital':
      url = '/capital-outlay/getByParams';
      break;
    case 'income':
      url = '/income/getByParams';
      break;
  }
  const resp = await api.get(url, { params });
  const list = Array.isArray(resp.data) ? resp.data : (resp.data?.data || []);
  return list.filter(i => (i.status || '').toLowerCase() === String(targetStatus).toLowerCase()).map(i => i._id).filter(Boolean);
};

// Approve (Region) Button
export const ApproveButton = ({ row, refreshData }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState('');
  const [idsPreviewLoading, setIdsPreviewLoading] = useState(false);
  const [idsPreviewCount, setIdsPreviewCount] = useState(0);
  const queryClient = useQueryClient();
  const { currentUser } = useUser();
  
  // Debug logging for user data
  console.log('👤 ApproveButton User Debug:', {
    currentUser: currentUser,
    hierarchicalAccess: currentUser?.hierarchicalAccess,
    scope: currentUser?.hierarchicalAccess?.scope,
    workflowRoles: currentUser?.hierarchicalAccess?.workflowRoles,
    rolePermissions: currentUser?.hierarchicalAccess?.rolePermissions,
    hierarchicalFlags: currentUser?.hierarchicalFlags
  });
  
  // Debug logging for row data
  console.log('📋 ApproveButton Row Debug:', {
    rowId: row._id,
    rowStatus: row.status,
    fullRow: row
  });
  const handleOpen = async () => {
    setOpen(true);
    // Prefetch affected record count
    setIdsPreviewLoading(true);
    try {
      const ids = await fetchIdsForRow(row, 'Department Submitted');
      setIdsPreviewCount(ids.length || 0);
    } catch (e) {
      setIdsPreviewCount(0);
    } finally {
      setIdsPreviewLoading(false);
    }
  };

  const scope = currentUser?.hierarchicalAccess?.scope;
  const roles = currentUser?.hierarchicalAccess?.workflowRoles || [];
  const canApprovePermission = currentUser?.hierarchicalFlags?.canApproveProposals === true || currentUser?.hierarchicalAccess?.rolePermissions?.canApproveProposals === true;
  
  // Department users with departmentConsolidator role can approve Division Submitted proposals
  // Office users need explicit approval permission and officeFinalVerifier role
  const canApprove = (
    (scope === 'DEPARTMENT' && roles.includes('departmentConsolidator') && row.status === 'Division Submitted') ||
    ((scope === 'OFFICE' || scope === 'FULL') && roles.includes('officeFinalVerifier') && canApprovePermission && row.status === 'Office Submitted')
  );
  
  // Debug logging
  console.log('🔍 ApproveButton Debug:', {
    scope,
    roles,
    rowStatus: row.status,
    canApprove,
    departmentCondition: scope === 'DEPARTMENT' && roles.includes('departmentConsolidator') && row.status === 'Division Submitted',
    officeCondition: (scope === 'OFFICE' || scope === 'FULL') && roles.includes('officeFinalVerifier') && canApprovePermission && row.status === 'Office Submitted',
    hasDepartmentConsolidator: roles.includes('departmentConsolidator'),
    hasOfficeFinalVerifier: roles.includes('officeFinalVerifier'),
    canApprovePermission
  });
  
  if (!canApprove) return null;

  const handleApprove = async () => {
    setLoading(true);
    try {
      const entity = mapCobToEntity(row.cobExpenditures);
      
      if (scope === 'DEPARTMENT' && row.status === 'Division Submitted') {
        // Department approval: Division Submitted → Department Verified
        const ids = await fetchIdsForRow(row, 'Division Submitted');
        if (ids.length === 0) throw new Error('No records to approve');
        
        await api.post('/api/submission-workflow/office/verify-submission', {
          ids,
          entity,
          departmentVerificationNote: note || `Verified at Department on ${new Date().toLocaleString()}`
        });
        toast.success('Department verification successful');
      } else if ((scope === 'OFFICE' || scope === 'FULL') && row.status === 'Office Submitted') {
        // Office approval: Office Submitted → Region Approved
        const ids = await fetchIdsForRow(row, 'Office Submitted');
        if (ids.length === 0) throw new Error('No records to approve');
        
        await api.post('/api/submission-workflow/office/approve-submission', {
          ids,
          entity,
          officeApprovalNote: note || `Approved at Office on ${new Date().toLocaleString()}`
        });
        toast.success('Office approval successful');
      }
      
      await queryClient.invalidateQueries(['proposals']);
      refreshData?.();
      setOpen(false);
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.message || e.message || 'Failed to approve');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Tooltip title="Approve">
        <IconButton color="success" onClick={handleOpen} size="small" disabled={loading}>
          <CheckCircleIcon />
        </IconButton>
      </Tooltip>
      <Dialog open={open} onClose={() => !loading && setOpen(false)}>
        <DialogTitle>
          {scope === 'DEPARTMENT' ? 'Verify Division Submission' : 'Approve Submission'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            This will move records to <strong>
              {scope === 'DEPARTMENT' ? 'Department Verified' : 'Region Approved'}
            </strong>.
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            {idsPreviewLoading ? 'Checking affected records…' : `Affected records: ${idsPreviewCount}`}
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={3}
            label="Approval Note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
          <Button onClick={handleApprove} disabled={loading} variant="contained" color="success">
            {loading ? <CircularProgress size={20} /> : 'Approve'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

// Submit to Office Button
export const SubmitToOfficeButton = ({ row, refreshData }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState('');
  const [idsPreviewLoading, setIdsPreviewLoading] = useState(false);
  const [idsPreviewCount, setIdsPreviewCount] = useState(0);
  const queryClient = useQueryClient();
  const { currentUser } = useUser();
  const handleOpen = async () => {
    setOpen(true);
    setIdsPreviewLoading(true);
    try {
      const ids = await fetchIdsForRow(row, 'Department Verified');
      setIdsPreviewCount(ids.length || 0);
    } catch (e) {
      setIdsPreviewCount(0);
    } finally {
      setIdsPreviewLoading(false);
    }
  };

  const scope = currentUser?.hierarchicalAccess?.scope;
  const roles = currentUser?.hierarchicalAccess?.workflowRoles || [];
  const canSubmit = scope === 'OFFICE' && roles.includes('officeConsolidator') && row.status === 'Office Verified';
  if (!canSubmit) return null;

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const ids = await fetchIdsForRow(row, 'Office Verified');
      if (ids.length === 0) throw new Error('No verified records to submit');
      const entity = mapCobToEntity(row.cobExpenditures);
      await api.post('/api/submission-workflow/office/submit-own', {
        ids,
        entity,
        approvalNote: note || `Finalized on ${new Date().toLocaleString()}`
      });
      toast.success('Finalized submission');
      await queryClient.invalidateQueries(['proposals']);
      refreshData?.();
      setOpen(false);
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.message || e.message || 'Failed to submit');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Tooltip title="Finalize Submission">
        <IconButton color="primary" onClick={handleOpen} size="small" disabled={loading}>
          <KeyboardArrowRightIcon />
        </IconButton>
      </Tooltip>
      <Dialog open={open} onClose={() => !loading && setOpen(false)}>
        <DialogTitle>Submit to Region</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            This will move records to <strong>Department Submitted</strong>.
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            {idsPreviewLoading ? 'Checking affected records…' : `Affected records: ${idsPreviewCount}`}
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={3}
            label="Approval Note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading} variant="contained" color="primary">
            {loading ? <CircularProgress size={20} /> : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

// Return / Reject Button
export const ReturnButton = ({ row, refreshData }) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [idsPreviewLoading, setIdsPreviewLoading] = useState(false);
  const [idsPreviewCount, setIdsPreviewCount] = useState(0);
  const queryClient = useQueryClient();
  const { currentUser } = useUser();
  
  // Debug logging for user data
  console.log('👤 ReturnButton User Debug:', {
    currentUser: currentUser,
    hierarchicalAccess: currentUser?.hierarchicalAccess,
    scope: currentUser?.hierarchicalAccess?.scope,
    workflowRoles: currentUser?.hierarchicalAccess?.workflowRoles,
    rolePermissions: currentUser?.hierarchicalAccess?.rolePermissions,
    hierarchicalFlags: currentUser?.hierarchicalFlags
  });
  
  // Debug logging for row data
  console.log('📋 ReturnButton Row Debug:', {
    rowId: row._id,
    rowStatus: row.status,
    fullRow: row
  });

  const scope = currentUser?.hierarchicalAccess?.scope;
  const roles = currentUser?.hierarchicalAccess?.workflowRoles || [];
  const canReturn = (
    // Department users with departmentConsolidator role can return Division Submitted and Department Verified proposals
    (scope === 'DEPARTMENT' && roles.includes('departmentConsolidator') && ['Division Submitted', 'Department Verified'].includes(row.status)) ||
    // Office users can return various statuses
    ((scope === 'OFFICE' && roles.includes('officeConsolidator')) ||
     ((scope === 'OFFICE' || scope === 'FULL') && roles.includes('officeFinalVerifier'))) &&
    ['Responsibility Center Submitted','Office Verified','Office Submitted','Submitted'].includes(row.status)
  );
  
  // Debug logging
  console.log('🔍 ReturnButton Debug:', {
    scope,
    roles,
    rowStatus: row.status,
    canReturn,
    departmentCondition: scope === 'DEPARTMENT' && roles.includes('departmentConsolidator') && ['Division Submitted', 'Department Verified'].includes(row.status),
    officeCondition: ((scope === 'OFFICE' && roles.includes('officeConsolidator')) ||
                     ((scope === 'OFFICE' || scope === 'FULL') && roles.includes('officeFinalVerifier'))) &&
                    ['Responsibility Center Submitted','Office Verified','Office Submitted','Submitted'].includes(row.status),
    hasDepartmentConsolidator: roles.includes('departmentConsolidator'),
    hasOfficeConsolidator: roles.includes('officeConsolidator'),
    hasOfficeFinalVerifier: roles.includes('officeFinalVerifier')
  });

  if (!canReturn) return null;

  const handleOpen = async () => {
    setOpen(true);
    setIdsPreviewLoading(true);
    try {
      const ids = await fetchIdsForRow(row, row.status || 'Submitted');
      setIdsPreviewCount(ids.length || 0);
    } catch (e) {
      setIdsPreviewCount(0);
    } finally {
      setIdsPreviewLoading(false);
    }
  };

  const handleReturn = async () => {
    if (!reason.trim()) {
      toast.error('Please provide a reason for returning the proposal');
      return;
    }
    setLoading(true);
    try {
      await api.post('/returnProposal', {
        fiscalYear: row.fiscalYear,
        budgetType: row.budgetType,
        processBy: row.processBy,
        region: row.region,
        reason,
        cobExpenditures: row.cobExpenditures,
      });
      toast.success(`${row.cobExpenditures} proposal returned successfully`);
      await queryClient.invalidateQueries(['proposals']);
      refreshData?.();
      setOpen(false);
      setReason('');
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to return proposal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Tooltip title="Return / Reject">
        <IconButton color="error" onClick={handleOpen} size="small" disabled={loading}>
          <UndoIcon />
        </IconButton>
      </Tooltip>
      <Dialog open={open} onClose={() => !loading && setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Return {row.cobExpenditures} Proposal</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            This will mark the proposal as <strong>Returned</strong> with feedback.
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            {idsPreviewLoading ? 'Checking affected records…' : `Affected records: ${idsPreviewCount}`}
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            <strong>Expenditure Type:</strong> {row.cobExpenditures}<br />
            <strong>Region:</strong> {row.region}<br />
            <strong>Fiscal Year:</strong> {row.fiscalYear}<br />
            <strong>Budget Type:</strong> {row.budgetType}
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            label="Feedback / Reason for Return"
            type="text"
            fullWidth
            multiline
            rows={4}
            variant="outlined"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={loading}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
          <Button onClick={handleReturn} color="error" variant="contained" disabled={loading || !reason.trim()}>
            {loading ? <CircularProgress size={20} /> : 'Return'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

// Verify (Department) Button
export const VerifyButton = ({ row, refreshData }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState('');
  const [idsPreviewLoading, setIdsPreviewLoading] = useState(false);
  const [idsPreviewCount, setIdsPreviewCount] = useState(0);
  const queryClient = useQueryClient();
  const { currentUser } = useUser();

  const scope = currentUser?.hierarchicalAccess?.scope;
  const roles = currentUser?.hierarchicalAccess?.workflowRoles || [];
  const canVerify = scope === 'OFFICE' && roles.includes('officeConsolidator') && row.status === 'Responsibility Center Submitted';
  if (!canVerify) return null;

  const handleOpen = async () => {
    setOpen(true);
    setIdsPreviewLoading(true);
    try {
      const ids = await fetchIdsForRow(row, 'Responsibility Center Submitted');
      setIdsPreviewCount(ids.length || 0);
    } catch (e) {
      setIdsPreviewCount(0);
    } finally {
      setIdsPreviewLoading(false);
    }
  };

  const handleVerify = async () => {
    setLoading(true);
    try {
      const ids = await fetchIdsForRow(row, 'Responsibility Center Submitted');
      if (ids.length === 0) throw new Error('No matching records to verify');
      const entity = mapCobToEntity(row.cobExpenditures);
      await api.post('/api/submission-workflow/office/verify-submission', {
        ids,
        entity,
        verificationNote: note || `Verified on ${new Date().toLocaleString()}`
      });
      toast.success('Responsibility Center submission verified');
      await queryClient.invalidateQueries(['proposals']);
      refreshData?.();
      setOpen(false);
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.message || e.message || 'Failed to verify');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Tooltip title="Verify">
        <IconButton color="success" onClick={handleOpen} size="small" disabled={loading}>
          <CheckCircleIcon />
        </IconButton>
      </Tooltip>
      <Dialog open={open} onClose={() => !loading && setOpen(false)}>
        <DialogTitle>Verify Responsibility Center Submission</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            This will move records to <strong>Department Verified</strong>.
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            {idsPreviewLoading ? 'Checking affected records…' : `Affected records: ${idsPreviewCount}`}
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={3}
            label="Verification Note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
          <Button onClick={handleVerify} disabled={loading} variant="contained" color="success">
            {loading ? <CircularProgress size={20} /> : 'Verify'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

// Finalize (Region) Button
export const FinalizeButton = ({ row, refreshData }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState('');
  const [idsPreviewLoading, setIdsPreviewLoading] = useState(false);
  const [idsPreviewCount, setIdsPreviewCount] = useState(0);
  const queryClient = useQueryClient();
  const { currentUser } = useUser();

  const scope = currentUser?.hierarchicalAccess?.scope;
  const roles = currentUser?.hierarchicalAccess?.workflowRoles || [];
  const canFinalize = (scope === 'OFFICE' || scope === 'FULL') && roles.includes('officeFinalVerifier') && (currentUser?.hierarchicalFlags?.canApproveProposals || currentUser?.hierarchicalAccess?.rolePermissions?.canApproveProposals) && row.status === 'Office Approved';
  if (!canFinalize) return null;

  const handleOpen = async () => {
    setOpen(true);
    setIdsPreviewLoading(true);
    try {
      const ids = await fetchIdsForRow(row, 'Office Approved');
      setIdsPreviewCount(ids.length || 0);
    } catch (e) {
      setIdsPreviewCount(0);
    } finally {
      setIdsPreviewLoading(false);
    }
  };

  const handleFinalize = async () => {
    setLoading(true);
    try {
      const ids = await fetchIdsForRow(row, 'Office Approved');
      if (ids.length === 0) throw new Error('No approved records to finalize');
      const entity = mapCobToEntity(row.cobExpenditures);
      await api.post('/api/submission-workflow/office/finalize-submission', {
        ids,
        entity,
        finalizationNote: note || `Finalized on ${new Date().toLocaleString()}`
      });
      toast.success('Finalized successfully');
      await queryClient.invalidateQueries(['proposals']);
      refreshData?.();
      setOpen(false);
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.message || e.message || 'Failed to finalize');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Tooltip title="Finalize">
        <IconButton color="primary" onClick={handleOpen} size="small" disabled={loading}>
          <KeyboardArrowDownIcon />
        </IconButton>
      </Tooltip>
      <Dialog open={open} onClose={() => !loading && setOpen(false)}>
        <DialogTitle>Finalize Submission</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            This will move records to <strong>Finalized</strong>.
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            {idsPreviewLoading ? 'Checking affected records…' : `Affected records: ${idsPreviewCount}`}
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={3}
            label="Finalization Note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
          <Button onClick={handleFinalize} disabled={loading} variant="contained" color="primary">
            {loading ? <CircularProgress size={20} /> : 'Finalize'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

// Submit Draft Button
export const SubmitDraftButton = ({ row, refreshData }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState('');
  const [idsPreviewLoading, setIdsPreviewLoading] = useState(false);
  const [idsPreviewCount, setIdsPreviewCount] = useState(0);
  const queryClient = useQueryClient();
  const { currentUser } = useUser();

  const scope = currentUser?.hierarchicalAccess?.scope;
  const roles = currentUser?.hierarchicalAccess?.workflowRoles || [];

  // Determine if user can submit draft based on their level and roles
  const canSubmitDraft = (
    (scope === 'RESPONSIBILITY_CENTER' && roles.includes('responsibilityCenterCreator') && row.status === 'Draft') ||
    (scope === 'OFFICE' && roles.includes('officeConsolidator') && row.status === 'Draft')
  );

  if (!canSubmitDraft) return null;

  const handleOpen = async () => {
    setOpen(true);
    setIdsPreviewLoading(true);
    try {
      const ids = await fetchIdsForRow(row, 'Draft');
      setIdsPreviewCount(ids.length || 0);
    } catch (e) {
      setIdsPreviewCount(0);
    } finally {
      setIdsPreviewLoading(false);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Collect all matching record IDs for the row's current status
      const ids = await fetchIdsForRow(row, 'Draft');
      if (!ids || ids.length === 0) {
        throw new Error('No draft records found to submit');
      }
      const entity = mapCobToEntity(row.cobExpenditures);

      let endpoint = '';
      let successMessage = '';

      if (scope === 'RESPONSIBILITY_CENTER') {
        endpoint = '/api/submission-workflow/responsibility-center/submit-to-office';
        successMessage = 'Submitted to Office';
      } else if (scope === 'OFFICE') {
        // For office, use the new submit-own endpoint that finalizes directly
        endpoint = '/api/submission-workflow/office/submit-own';
        successMessage = 'Finalized';
      }

      await api.post(endpoint, {
        ids,
        entity,
        submissionNote: note || `Submitted from ${scope} level on ${new Date().toLocaleString()}`
      });

      toast.success(successMessage);
      await queryClient.invalidateQueries(['proposals']);
      refreshData?.();
      setOpen(false);
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.message || e.message || 'Failed to submit');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Tooltip title={`Submit ${row.status} to next level`}>
        <IconButton color="primary" onClick={handleOpen} size="small" disabled={loading}>
          <CheckCircleIcon />
        </IconButton>
      </Tooltip>
      <Dialog open={open} onClose={() => !loading && setOpen(false)}>
        <DialogTitle>Submit Draft Proposal</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            This will submit the draft proposal to the next level for review.
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            {idsPreviewLoading ? 'Checking affected records…' : `Affected records: ${idsPreviewCount}`}
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={3}
            label="Submission Note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading} variant="contained" color="primary">
            {loading ? <CircularProgress size={20} /> : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
