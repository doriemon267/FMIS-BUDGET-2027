import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { NumericFormat } from "react-number-format";
import PropTypes from "prop-types";
import api from "../../config/api";
import { useRegion } from "../../context/RegionContext";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  IconButton,
  Button,
  TextField,
  Select,
  MenuItem,
  Box,
  CircularProgress,
  FormHelperText,
  useMediaQuery,
  useTheme,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  InputAdornment,
  Chip,
  Checkbox,
  FormControlLabel,
  Switch,
  Menu,
  Divider,
  Alert,
  Collapse,
  TablePagination,
  Toolbar,
  AppBar,
  Fab,
} from "@mui/material";
import {
  Edit,
  Delete,
  Close,
  Add,
  Save,
  Search,
  FilterList,
  GetApp,
  Clear,
  ExpandMore,
  ExpandLess,
  Refresh,
  CheckBox,
  CheckBoxOutlineBlank,
  FileDownload,
  Settings,
  Visibility,
  VisibilityOff,
  List,
} from "@mui/icons-material";
import { useUser } from "../../context/UserContext";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import CapitalOutlayDetailsModal from "./CapitalOutlayDetailsModal";

// Error Boundary Component
class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <Box sx={{ p: 2, color: "error.main" }}>
          <Typography>Something went wrong: {this.state.error.message}</Typography>
        </Box>
      );
    }
    return this.props.children;
  }
}

// Updated NumberFormatCustom to handle props correctly
const NumberFormatCustom = React.forwardRef(function NumberFormatCustom(props, ref) {
  const { onChange, name = 'amount', ...other } = props;  // Provide default name

  return (
    <NumericFormat
      {...other}
      getInputRef={ref}
      onValueChange={(values) => {
        onChange({
          target: {
            name: name,
            value: values.value,
          },
        });
      }}
      thousandSeparator
      valueIsNumericString
      prefix="₱"
    />
  );
});

NumberFormatCustom.propTypes = {
  name: PropTypes.string,  // No longer required
  onChange: PropTypes.func.isRequired,
};

const formatNumber = (number) => {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number);
};

const CapitalOutlayTable = ({ onDataChange, disableIncomeInputs = false }) => {
  // Basic state
  const [capitalOutlays, setCapitalOutlays] = useState([]);
  const [categories, setCategories] = useState([]);
  const [sublineItems, setSublineItems] = useState({});
  const [accountingTitles, setAccountingTitles] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editedOutlay, setEditedOutlay] = useState({});
  const [newOutlays, setNewOutlays] = useState({});
  const [addingCategoryId, setAddingCategoryId] = useState(null);
  const [fiscalYear, setFiscalYear] = useState("");
  const [budgetType, setBudgetType] = useState("");
  const { currentUser } = useUser();
  const { activeRegion } = useRegion();
  const [regionFilter, setRegionFilter] = useState("");
  const [status, setStatus] = useState("");
  const [errors, setErrors] = useState({});
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const tableContainerRef = useRef(null);
  const scrollPositionRef = useRef(0);

  // Enhanced state management
  const [searchTerm, setSearchTerm] = useState("");
  const [filterAnchorEl, setFilterAnchorEl] = useState(null);
  const [selectedFilters, setSelectedFilters] = useState({
    categories: [],
    sublineItems: [],
    amountRange: { min: "", max: "" },
    hasValues: false,
    emptyValues: false
  });
  const [autoSave, setAutoSave] = useState(false); // Default to false as requested
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [selectedRows, setSelectedRows] = useState([]);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [autoSaveTimer, setAutoSaveTimer] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState([]);
  const [showColumnTotals, setShowColumnTotals] = useState(true);

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // View state
  const [compactView, setCompactView] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  // Due date status
  const [dueDateStatus, setDueDateStatus] = useState(null);

  // Modal state for capital outlay details
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedCapitalOutlay, setSelectedCapitalOutlay] = useState(null);
  const [newlyAddedItemId, setNewlyAddedItemId] = useState(null);
  
  // State to store details for each capital outlay item
  const [capitalOutlayDetails, setCapitalOutlayDetails] = useState({});

  // Check if user can delete items (admin users)
  const canDeleteItems = useMemo(() => {
    if (!currentUser || !currentUser.Roles) return false;
    return currentUser.Roles.some(role => 
      role.toUpperCase().includes('ADMIN') || 
      role.toUpperCase().includes('SUPER') ||
      role.toUpperCase().includes('BUDGET ADMIN')
    );
  }, [currentUser]);

  // Enhanced filtering and search
  const filteredData = useMemo(() => {
    if (!capitalOutlays || capitalOutlays.length === 0) return [];

    return capitalOutlays.filter((item) => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const categoryName = item.category?.categoryName?.toLowerCase() || "";
        const sublineItem = item.sublineItem?.toLowerCase() || "";
        const accountingTitle = item.accountingTitle?.toLowerCase() || "";
        const uacsCode = item.uacsCode?.toLowerCase() || "";
        const particulars = item.particulars?.toLowerCase() || "";

        if (
          !categoryName.includes(searchLower) &&
          !sublineItem.includes(searchLower) &&
          !accountingTitle.includes(searchLower) &&
          !uacsCode.includes(searchLower) &&
          !particulars.includes(searchLower)
        ) {
          return false;
        }
      }

      // Category filter
      if (selectedFilters.categories.length > 0) {
        const categoryId = item.category?._id || item.category;
        if (!selectedFilters.categories.includes(categoryId)) {
          return false;
        }
      }

      // Subline item filter
      if (selectedFilters.sublineItems.length > 0) {
        if (!selectedFilters.sublineItems.includes(item.sublineItem)) {
          return false;
        }
      }

      // Amount range filter
      const totalAmount = (parseFloat(item.income) || 0) + (parseFloat(item.subsidy) || 0);
      if (selectedFilters.amountRange.min && totalAmount < parseFloat(selectedFilters.amountRange.min)) {
        return false;
      }
      if (selectedFilters.amountRange.max && totalAmount > parseFloat(selectedFilters.amountRange.max)) {
        return false;
      }

      // Has values filter
      if (selectedFilters.hasValues && totalAmount === 0) {
        return false;
      }

      // Empty values filter
      if (selectedFilters.emptyValues && totalAmount > 0) {
        return false;
      }

      return true;
    });
  }, [capitalOutlays, searchTerm, selectedFilters]);

  const calculateCategoryTotal = useCallback((categoryId, outlays) => {
    return outlays
      .filter((item) => {
        const itemCategoryId = item.category?._id || item.category;
        return itemCategoryId === categoryId;
      })
      .reduce((sum, item) => {
        const income = parseFloat(item.income) || 0;
        const subsidy = parseFloat(item.subsidy) || 0;
        return sum + income + subsidy;
      }, 0);
  }, []);

  // Auto-save functionality
  useEffect(() => {
    if (autoSave && hasUnsavedChanges) {
      if (autoSaveTimer) clearTimeout(autoSaveTimer);

      const timer = setTimeout(() => {
        handleAutoSave();
      }, 3000); // Auto-save after 3 seconds of inactivity

      setAutoSaveTimer(timer);

      return () => clearTimeout(timer);
    }
  }, [autoSave, hasUnsavedChanges]);

  // Track unsaved changes
  const trackChanges = useCallback(() => {
    setHasUnsavedChanges(true);
  }, []);

  const calculateTotal = useCallback((income, subsidy) => {
    const incomeValue = parseFloat(income) || 0;
    const subsidyValue = parseFloat(subsidy) || 0;
    return formatNumber(incomeValue + subsidyValue);
  }, []);

  // Calculate column totals
  const columnTotals = useMemo(() => {
    const totalIncome = filteredData.reduce((sum, item) => sum + (parseFloat(item.income) || 0), 0);
    const totalSubsidy = filteredData.reduce((sum, item) => sum + (parseFloat(item.subsidy) || 0), 0);
    const totalCost = totalIncome + totalSubsidy;

    return {
      income: totalIncome,
      subsidy: totalSubsidy,
      cost: totalCost
    };
  }, [filteredData]);

  // Enhanced handlers
  const handleDeleteClick = (itemId) => {
    setItemToDelete(itemId);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    if (itemToDelete) {
      handleDeleteOutlay(itemToDelete);
      setDeleteConfirmOpen(false);
      setItemToDelete(null);
    }
  };

  // Modal handlers for capital outlay details
  const handleOpenDetailsModal = (capitalOutlay) => {
    setSelectedCapitalOutlay(capitalOutlay);
    setDetailsModalOpen(true);
  };

  const handleCloseDetailsModal = () => {
    setDetailsModalOpen(false);
    setSelectedCapitalOutlay(null);
    
    // If this was a newly added item, scroll to it and highlight it briefly
    if (newlyAddedItemId) {
      setTimeout(() => {
        const element = document.getElementById(`capital-outlay-row-${newlyAddedItemId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Add a brief highlight effect
          element.style.backgroundColor = '#e3f2fd';
          setTimeout(() => {
            element.style.backgroundColor = '';
          }, 2000);
        }
        setNewlyAddedItemId(null);
      }, 100);
    }
  };

  // Callback when details are saved - refresh the details and update the main table
  const handleDetailsSaved = useCallback(async (capitalOutlayId, totals) => {
    // Refresh the details for this item
    try {
      const response = await api.get(`/api/capital-outlay/${capitalOutlayId}/details`);
      setCapitalOutlayDetails(prev => ({
        ...prev,
        [capitalOutlayId]: response.data.details || []
      }));
    } catch (error) {
      console.error("Error fetching capital outlay details:", error);
    }
    
    // Update the main capital outlay record with new totals
    setCapitalOutlays(prev => prev.map(item => 
      item._id === capitalOutlayId 
        ? { 
            ...item, 
            income: totals.income, 
            subsidy: totals.subsidy, 
            cost: totals.cost 
          }
        : item
    ));
    
    // Notify parent component of data change
    const updatedOutlays = capitalOutlays.map(item => 
      item._id === capitalOutlayId 
        ? { 
            ...item, 
            income: totals.income, 
            subsidy: totals.subsidy, 
            cost: totals.cost 
          }
        : item
    );
    onDataChange?.(updatedOutlays);
  }, [capitalOutlays, onDataChange]);

  const handleDetailsModalSave = async (totals) => {
    if (totals.isNewItem && totals.newItem) {
      // Handle newly created item
      const newItem = {
        ...totals.newItem,
        status: "Not Submitted",
      };
      
      const updatedData = [...capitalOutlays, newItem];
      setCapitalOutlays(updatedData);
      
      // Initialize empty details for the new item
      setCapitalOutlayDetails(prev => ({
        ...prev,
        [newItem._id]: []
      }));
      
      // Clear the form for the category
      if (selectedCapitalOutlay?.tempCategoryId) {
        setNewOutlays((prev) => ({ ...prev, [selectedCapitalOutlay.tempCategoryId]: {} }));
        setAddingCategoryId(null);
      }
      
      setErrors({});
      setHasUnsavedChanges(false);
      setLastSaved(new Date());
      
      // Trigger parent data refresh
      onDataChange?.(updatedData);
      
      // Set this as newly added for highlighting
      setNewlyAddedItemId(newItem._id);
      
      toast.success("Capital outlay item created successfully with breakdown details!");
    } else if (totals.capitalOutlayId) {
      // Fallback path: details were saved to an existing item we attached to
      await handleDetailsSaved(totals.capitalOutlayId, totals);
      toast.success("Capital outlay details saved to existing item successfully");
    } else if (selectedCapitalOutlay && selectedCapitalOutlay._id) {
      // Handle existing item update
      await handleDetailsSaved(selectedCapitalOutlay._id, totals);
      toast.success("Capital outlay details updated successfully");
    }
  };

  // Move validateInput before handleAutoSave to fix hoisting issue
  const validateInput = useCallback((data, isNew = false) => {
    const newErrors = {};

    if (!data.sublineItem) newErrors.sublineItem = "Subline item is required";
    if (!data.accountingTitle) newErrors.accountingTitle = "Accounting title is required";
    
    // For new items, income and subsidy can be empty (will be calculated from breakdown)
    // For existing items, validate as before
    if (!isNew) {
      if (data.income == null || isNaN(data.income) || data.income < 0) {
        newErrors.income = "Valid income (0 or more) is required";
      }
      if (data.subsidy == null || isNaN(data.subsidy) || data.subsidy < 0) {
        newErrors.subsidy = "Valid subsidy (0 or more) is required";
      }
    }
    // Note: isDuplicateOutlay will be defined later, so we'll handle this check in the calling functions
    if (isNew && capitalOutlays && data.category && data.accountingTitle) {
      const isDuplicate = capitalOutlays.some(
        (outlay) =>
          (outlay.category?._id === data.category || outlay.category === data.category) &&
          outlay.accountingTitle === data.accountingTitle &&
          (!data.uacsCode || outlay.uacsCode === data.uacsCode)
      );
      if (isDuplicate) {
        newErrors.accountingTitle = "This accounting title already exists for this category";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [capitalOutlays]);

  const handleAutoSave = useCallback(async () => {
    try {
      // Check if there are any pending edits to save
      if (editingId && editedOutlay && Object.keys(editedOutlay).length > 0) {

        if (!validateInput(editedOutlay)) {
          toast.warning("Cannot auto-save: Please fix validation errors first");
          return;
        }

        const { status, ...payload } = editedOutlay;
        payload.category = editedOutlay.category?._id || editedOutlay.category;

        let income;
        if (disableIncomeInputs) {
          const originalItem = capitalOutlays.find(item => item._id === editingId);
          income = originalItem ? parseFloat(originalItem.income) || 0 : 0;
        } else {
          income = parseFloat(payload.income) || 0;
        }

        const subsidy = parseFloat(payload.subsidy) || 0;
        payload.income = income;
        payload.subsidy = subsidy;
        payload.cost = income + subsidy;

        await api.put(`/capital-outlays/${editingId}`, {
          ...payload,
          processBy: `${currentUser.FirstName} ${currentUser.LastName}`,
          region: regionFilter || activeRegion?.name || currentUser.Region,
          processDate: new Date(),
          fiscalYear,
          budgetType,
        });

        // Refresh data
        const params = new URLSearchParams();
        if (regionFilter) {
          params.append('region', regionFilter);
        }
        const res = await api.get(`/capital-outlays?${params.toString()}`);
        const updatedData = res.data.capitalOutlays.map((item) => ({
          ...item,
          status: item.status || "Not Submitted",
        }));

        setCapitalOutlays(updatedData);
        setEditingId(null);
        setEditedOutlay({});
        setErrors({});
        onDataChange?.(updatedData);

        setHasUnsavedChanges(false);
        setLastSaved(new Date());
        toast.success("Auto-saved successfully!", { autoClose: 2000 });

      } else if (Object.keys(newOutlays).length > 0) {
        // Check if there are any new outlays being added
        const pendingOutlays = Object.entries(newOutlays).filter(([categoryId, outlay]) =>
          outlay && (outlay.sublineItem || outlay.accountingTitle || outlay.particulars || outlay.income || outlay.subsidy)
        );

        if (pendingOutlays.length > 0) {
          toast.info("Auto-save: Please complete adding new items first");
          return;
        }
      } else {
        // No pending changes
        setHasUnsavedChanges(false);
        toast.info("No changes to auto-save", { autoClose: 1500 });
      }

    } catch (error) {
      console.error("Auto-save failed:", error);
      toast.error(`Auto-save failed: ${error.response?.data?.error || error.message}`);
    }
  }, [editingId, editedOutlay, newOutlays, currentUser, fiscalYear, budgetType, onDataChange, disableIncomeInputs, capitalOutlays, validateInput]);

  const handleSelectAll = useCallback(() => {
    if (selectedRows.length === filteredData.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(filteredData.map(item => item._id));
    }
  }, [selectedRows, filteredData]);

  const handleRowSelect = useCallback((itemId) => {
    setSelectedRows(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  }, []);

  const handleExportToExcel = useCallback(() => {
    const exportData = filteredData.map(item => ({
      'Category': item.category?.categoryName || '',
      'Subline Item': item.sublineItem || '',
      'Accounting Title': item.accountingTitle || '',
      'UACS Code': item.uacsCode || '',
      'Particulars': item.particulars || '',
      'Income': parseFloat(item.income || 0),
      'Subsidy': parseFloat(item.subsidy || 0),
      'Total Cost': parseFloat(item.income || 0) + parseFloat(item.subsidy || 0)
    }));

    // Create CSV content
    const headers = Object.keys(exportData[0] || {});
    const csvContent = [
      headers.join(','),
      ...exportData.map(row => headers.map(header => `"${row[header]}"`).join(','))
    ].join('\n');

    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Capital_Outlay_Data_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast.success("Data exported successfully!");
  }, [filteredData]);

  const handleClearFilters = useCallback(() => {
    setSearchTerm("");
    setSelectedFilters({
      categories: [],
      sublineItems: [],
      amountRange: { min: "", max: "" },
      hasValues: false,
      emptyValues: false
    });
  }, []);

  const toggleCategoryExpansion = useCallback((categoryId) => {
    setExpandedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  }, []);

  const fetchAccountingTitles = useCallback(
    async (sublineItem) => {
      if (!sublineItem) return;
      if (tableContainerRef.current) {
        scrollPositionRef.current = tableContainerRef.current.scrollTop;
      }
      try {
        setLoading(true);
        const res = await api.get(`/accounting-titles?sublineItem=${encodeURIComponent(sublineItem)}`);
        setAccountingTitles((prev) => ({
          ...prev,
          [sublineItem]: res.data.accountingTitles || [],
        }));
        setTimeout(() => {
          if (tableContainerRef.current) {
            tableContainerRef.current.scrollTop = scrollPositionRef.current;
          }
        }, 0);
      } catch (error) {
        console.error("Error fetching accounting titles:", error);
        toast.error("Error fetching accounting titles.");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const fetchSublineItems = useCallback(
    async (categoryName, isNew = false, categoryId = null) => {
      try {
        const encodedCategoryName = encodeURIComponent(categoryName);
        const res = await api.get(`/subline-items?category=${encodedCategoryName}`);
        const items = res.data.sublineItems || [];
        setSublineItems((prev) => ({
          ...prev,
          [categoryName]: items,
        }));
        
        if (items.length === 1 && isNew && categoryId) {
          setNewOutlays((prev) => ({
            ...prev,
            [categoryId]: {
              ...prev[categoryId],
              sublineItem: items[0],
            },
          }));
          await fetchAccountingTitles(items[0]);
        }
      } catch (error) {
        console.error("Error fetching subline items:", error);
        toast.error("Error fetching subline items.");
      }
    },
    [fetchAccountingTitles]
  );

  // Function to fetch details for all capital outlays
  const fetchAllCapitalOutlayDetails = useCallback(async (outlays) => {
    const detailsPromises = outlays.map(async (outlay) => {
      try {
        const response = await api.get(`/api/capital-outlay/${outlay._id}/details`);
        setCapitalOutlayDetails(prev => ({
          ...prev,
          [outlay._id]: response.data.details || []
        }));
      } catch (error) {
        console.error(`Error fetching details for outlay ${outlay._id}:`, error);
      }
    });
    await Promise.allSettled(detailsPromises);
  }, []);

  // Update region filter when active region changes
  useEffect(() => {
    if (activeRegion) {
      const regionName = activeRegion.name || activeRegion.regionName;
      setRegionFilter(regionName);
    } else {
      setRegionFilter("");
    }
  }, [activeRegion]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Build query parameters for capital outlays
        const params = new URLSearchParams();
        if (regionFilter) {
          params.append('region', regionFilter);
        }
        
        const [outlaysRes, categoriesRes, dueDateRes] = await Promise.all([
          api.get(`/capital-outlays?${params.toString()}`),
          api.get("/categories"),
          api.get("/due-date-status").catch(err => {
            console.warn("Could not fetch due date status:", err);
            return null;
          })
        ]);

        const outlaysWithStatus = outlaysRes.data.capitalOutlays.map((item) => ({
          ...item,
          status: item.status || "Not Submitted",
        }));

        setCapitalOutlays(outlaysWithStatus);
        const categoriesData = categoriesRes.data.categories || [];
        setCategories(categoriesData);

        // Set all categories as expanded by default
        setExpandedCategories(categoriesData.map(cat => cat._id));

        // Set due date status
        if (dueDateRes && dueDateRes.data) {
          setDueDateStatus(dueDateRes.data);
        }

        // Fetch details for all capital outlays
        await fetchAllCapitalOutlayDetails(outlaysWithStatus);

        setStatus(outlaysRes.data.status || "Not Submitted");
        onDataChange?.(outlaysWithStatus);
      } catch (error) {
        console.error("Error fetching data:", error);
        setError("Failed to retrieve data.");
        toast.error("Failed to retrieve data.");
      } finally {
        setLoading(false);
      }
    };

    const fetchFiscalYear = async () => {
      try {
        const response = await api.get("/settings/active");
        if (response.data && response.data.fiscalYear) {
          setFiscalYear(response.data.fiscalYear);
          setBudgetType(response.data.budgetType);
        }
      } catch (error) {
        console.error("Error fetching active fiscal year:", error);
        toast.error("Error fetching active fiscal year.");
      }
    };

    fetchData();
    fetchFiscalYear();
  }, [onDataChange, regionFilter, fetchAllCapitalOutlayDetails]);

  const handleEditOutlay = useCallback(
    (id) => {
      const outlay = capitalOutlays.find((o) => o._id === id);
      if (outlay) {
        setEditingId(id);
        setEditedOutlay(outlay);
        setErrors({});
        fetchSublineItems(outlay.category?.categoryName || "");
        fetchAccountingTitles(outlay.sublineItem);
      }
    },
    [capitalOutlays, fetchSublineItems, fetchAccountingTitles]
  );

  const handleSaveEdit = useCallback(
    async (id) => {
      if (!validateInput(editedOutlay)) {
        toast.error("Please fix all validation errors before saving");
        return;
      }

      try {
        setLoading(true);
        const { status, ...payload } = editedOutlay;
        payload.category = editedOutlay.category?._id || editedOutlay.category;
        
        let income;
        if (disableIncomeInputs) {
          const originalItem = capitalOutlays.find(item => item._id === id);
          income = originalItem ? parseFloat(originalItem.income) || 0 : 0;
          toast.info("Income value preserved due to locked state");
        } else {
          income = parseFloat(payload.income) || 0;
        }
        
        const subsidy = parseFloat(payload.subsidy) || 0;
        payload.income = income;
        payload.subsidy = subsidy;
        payload.cost = income + subsidy;

        await api.put(`/capital-outlays/${id}`, {
          ...payload,
          processBy: `${currentUser.FirstName} ${currentUser.LastName}`,
          region: regionFilter || activeRegion?.name || currentUser.Region,
          processDate: new Date(),
          fiscalYear,
          budgetType,
        });

        const params = new URLSearchParams();
        if (regionFilter) {
          params.append('region', regionFilter);
        }
        const res = await api.get(`/capital-outlays?${params.toString()}`);
        const updatedData = res.data.capitalOutlays.map((item) => ({
          ...item,
          status: item.status || "Not Submitted",
        }));

        setCapitalOutlays(updatedData);
        
        // Fetch details for all updated capital outlays
        await fetchAllCapitalOutlayDetails(updatedData);
        
        setEditingId(null);
        setEditedOutlay({});
        setErrors({});
        setHasUnsavedChanges(false);
        setLastSaved(new Date());

        // Trigger parent data refresh for global save as draft functionality
        onDataChange?.(updatedData);

        // Add a small delay then trigger a parent refresh to ensure global state is updated
        setTimeout(() => {
          if (window.location.pathname.includes('proposals')) {
            // Trigger a global data refresh if we're in the proposals page
            window.dispatchEvent(new CustomEvent('capitalOutlayDataChanged'));
          }
        }, 500);

        toast.success("Outlay updated successfully.");
      } catch (error) {
        console.error("Error updating outlay:", error);
        toast.error("Error updating outlay.");
      } finally {
        setLoading(false);
      }
    },
    [editedOutlay, currentUser, fiscalYear, budgetType, onDataChange, disableIncomeInputs, capitalOutlays]
  );

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditedOutlay({});
    setErrors({});
    setHasUnsavedChanges(false);
  }, []);

  const handleDeleteOutlay = useCallback(
    async (id) => {
      try {
        setLoading(true);
        // Debug: log the actual URL and config
        // Use axios config to ensure no params are sent
        await api.delete(`/capital-outlays/${id}`, { params: {} });
        // Only use region param for GET refresh
        const params = new URLSearchParams();
        if (regionFilter) {
          params.append('region', regionFilter);
        }
        const res = await api.get(`/capital-outlays?${params.toString()}`);
        const updatedData = res.data.capitalOutlays.map((item) => ({
          ...item,
          status: item.status || "Not Submitted",
        }));

        setCapitalOutlays(updatedData);
        onDataChange?.(updatedData);
        toast.success("Outlay deleted successfully.");
      } catch (error) {
        console.error("Error deleting outlay:", error);
        
        // Handle specific error messages
        let errorMessage = "Error deleting outlay.";
        if (error?.response?.status === 403) {
          const serverMessage = error?.response?.data?.message || "";
          if (serverMessage.includes("Deadline was") || serverMessage.includes("closed")) {
            errorMessage = `${serverMessage} ${canDeleteItems ? "You have admin privileges, but there may be another issue." : "Contact your administrator if you need to delete items after the deadline."}`;
          } else {
            errorMessage = "Access denied. You may not have permission to delete this item.";
          }
        } else if (error?.response?.data?.error) {
          errorMessage = error.response.data.error;
        } else if (error?.message) {
          errorMessage = error.message;
        }
        
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [onDataChange, regionFilter]
  );

  const isDuplicateOutlay = useCallback(
    (categoryId, accountingTitle, uacsCode) => {
      if (!accountingTitle || !categoryId) return false;
      return capitalOutlays.some(
        (outlay) =>
          (outlay.category?._id === categoryId || outlay.category === categoryId) &&
          outlay.accountingTitle === accountingTitle &&
          (!uacsCode || outlay.uacsCode === uacsCode)
      );
    },
    [capitalOutlays]
  );

  const handleAddOutlay = useCallback(
    async (categoryId) => {
      const newEntry = newOutlays[categoryId] || {};
      if (!validateInput(newEntry, true)) {
        toast.error("Please fix all validation errors before saving");
        return;
      }

      try {
        setLoading(true);
        let income = parseFloat(newEntry.income) || 0;
        
        if (disableIncomeInputs && income > 0) {
          toast.warning("Income value set to 0 because income fields are locked");
          income = 0;
        }
        
        const subsidy = parseFloat(newEntry.subsidy) || 0;
        const cost = income + subsidy;

        const response = await api.post("/capital-outlays", {
          ...newEntry,
          income,
          subsidy,
          cost,
          category: categoryId,
          processBy: `${currentUser.FirstName} ${currentUser.LastName}`,
          region: regionFilter || activeRegion?.name || currentUser.Region,
          processDate: new Date(),
          fiscalYear,
          budgetType,
          status: "Not Submitted",
        });

        // Add the new item to existing state instead of refetching all data
        const newItem = {
          ...response.data.capitalOutlay,
          status: "Not Submitted",
        };
        
        const updatedData = [...capitalOutlays, newItem];
        setCapitalOutlays(updatedData);
        
        // Initialize empty details for the new item
        setCapitalOutlayDetails(prev => ({
          ...prev,
          [newItem._id]: []
        }));
        
        // Clear the form
        setNewOutlays((prev) => ({ ...prev, [categoryId]: {} }));
        setAddingCategoryId(null);
        setErrors({});
        setHasUnsavedChanges(false);
        setLastSaved(new Date());

        // Trigger parent data refresh for global save as draft functionality
        onDataChange?.(updatedData);

        // Show success message
        toast.success("Outlay added successfully! Now add the breakdown details.", {
          autoClose: 3000,
        });

        // Automatically open the details modal for the new item
        setNewlyAddedItemId(newItem._id);
        setTimeout(() => {
          handleOpenDetailsModal(newItem);
        }, 300);

        // Scroll to the newly added item if possible
        setTimeout(() => {
          const element = document.getElementById(`capital-outlay-row-${newItem._id}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Add a brief highlight effect
            element.style.backgroundColor = '#e8f5e8';
            setTimeout(() => {
              element.style.backgroundColor = '';
            }, 2000);
          }
        }, 100);
      } catch (error) {
        console.error("Error adding new outlay:", error);
        toast.error(`Error adding new outlay: ${error.response?.data?.error || error.message}`);
      } finally {
        setLoading(false);
      }
    },
    [newOutlays, currentUser, fiscalYear, budgetType, onDataChange, validateInput, disableIncomeInputs, handleOpenDetailsModal, capitalOutlays, regionFilter, activeRegion]
  );

  const handleOutlayChange = useCallback(
    (categoryId, field, value) => {
      if (field === "income" && disableIncomeInputs) return;

      setNewOutlays((prev) => {
        const updated = {
          ...prev,
          [categoryId]: {
            ...prev[categoryId],
            [field]: value,
          },
        };

        if (field === "income" || field === "subsidy") {
          const income = parseFloat(field === "income" ? value : updated[categoryId]?.income) || 0;
          const subsidy = parseFloat(field === "subsidy" ? value : updated[categoryId]?.subsidy) || 0;
          updated[categoryId].cost = income + subsidy;
        }

        return updated;
      });

      // Track changes for new outlays
      setHasUnsavedChanges(true);
    },
    [disableIncomeInputs]
  );


  const handleEditChange = useCallback(
    (field, value) => {
      if (field === "income" && disableIncomeInputs) return;

      setEditedOutlay((prev) => {
        const updated = {
          ...prev,
          [field]: value,
        };
        if (field === "income" || field === "subsidy") {
          const income = parseFloat(field === "income" ? value : updated.income) || 0;
          const subsidy = parseFloat(field === "subsidy" ? value : updated.subsidy) || 0;
          updated.cost = income + subsidy;
        }
        return updated;
      });

      // Track changes for edited outlays
      setHasUnsavedChanges(true);
    },
    [disableIncomeInputs]
  );

  // Enhanced toolbar component
  const renderEnhancedToolbar = () => (
    <Box sx={{ mb: 3 }}>
      {/* Top Row - Main Controls */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box display="flex" alignItems="center" gap={2}>
          {/* Clear filters button */}

          <Button
            variant="outlined"
            startIcon={<Clear />}
            onClick={handleClearFilters}
            sx={{ minWidth: 100 }}
          >
            Clear
          </Button>

          {/* Expand/Collapse All button */}
          <Button
            variant="outlined"
            startIcon={expandedCategories.length === categories.length ? <ExpandLess /> : <ExpandMore />}
            onClick={() => {
              if (expandedCategories.length === categories.length) {
                setExpandedCategories([]);
              } else {
                setExpandedCategories(categories.map(cat => cat._id));
              }
            }}
            sx={{ minWidth: 120 }}
          >
            {expandedCategories.length === categories.length ? 'Collapse All' : 'Expand All'}
          </Button>

          {/* Auto-save toggle */}
          <FormControlLabel
            control={
              <Switch
                checked={autoSave}
                onChange={(e) => {
                  setAutoSave(e.target.checked);
                  if (e.target.checked) {
                    toast.info("Auto-save enabled - changes will be saved automatically after 3 seconds", { autoClose: 3000 });
                  } else {
                    toast.info("Auto-save disabled - use Save button to save changes", { autoClose: 3000 });
                  }
                }}
                color="primary"
              />
            }
            label={
              <Box display="flex" alignItems="center" gap={1}>
                <Save fontSize="small" color={autoSave ? "primary" : "disabled"} />
                <Typography variant="body2" color={autoSave ? "primary" : "text.secondary"}>
                  Auto-save {autoSave ? "(ON)" : "(OFF)"}
                </Typography>
              </Box>
            }
          />

          {/* Last saved indicator */}
          {lastSaved && (
            <Typography variant="caption" color="text.secondary">
              Last saved: {lastSaved.toLocaleTimeString()}
            </Typography>
          )}
        </Box>
        <Box display="flex" alignItems="center" gap={1}>
          {/* Export button */}
          <Tooltip title="Export to CSV">
            <IconButton onClick={handleExportToExcel} color="primary">
              <FileDownload />
            </IconButton>
          </Tooltip>

          {/* Refresh button */}
          <Tooltip title="Refresh data">
            <IconButton onClick={() => window.location.reload()} color="primary">
              <Refresh />
            </IconButton>
          </Tooltip>

          {/* View options */}
          <Tooltip title={compactView ? "Switch to normal view" : "Switch to compact view"}>
            <IconButton onClick={() => setCompactView(!compactView)} color="primary">
              {compactView ? <ExpandMore /> : <ExpandLess />}
            </IconButton>
          </Tooltip>

          {/* Column totals toggle */}
          <Tooltip title={showColumnTotals ? "Hide column totals" : "Show column totals"}>
            <IconButton onClick={() => setShowColumnTotals(!showColumnTotals)} color="primary">
              {showColumnTotals ? <Visibility /> : <VisibilityOff />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Second Row - Search and Filters */}
      <Box display="flex" alignItems="center" gap={2} mb={2}>
        {/* Search */}
        <TextField
          placeholder="Search categories, items, titles, codes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 300 }}
          size="small"
        />

        {/* Filter button */}
        <Button
          variant="outlined"
          startIcon={<FilterList />}
          onClick={(e) => setFilterAnchorEl(e.currentTarget)}
          sx={{ minWidth: 100 }}
        >
          Filters
        </Button>

        {/* Results counter */}
        <Typography variant="body2" color="text.secondary">
          Showing {filteredData.length} of {capitalOutlays.length} items
        </Typography>

        {/* Selected items counter */}
        {selectedRows.length > 0 && (
          <Chip
            label={`${selectedRows.length} selected`}
            color="primary"
            size="small"
            onDelete={() => setSelectedRows([])}
          />
        )}
      </Box>

      {/* Active filters display */}
      {(selectedFilters.categories.length > 0 ||
        selectedFilters.sublineItems.length > 0 ||
        selectedFilters.amountRange.min ||
        selectedFilters.amountRange.max ||
        selectedFilters.hasValues ||
        selectedFilters.emptyValues) && (
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <Typography variant="body2" color="text.secondary">
            Active filters:
          </Typography>
          {selectedFilters.categories.map(categoryId => {
            const category = categories.find(c => c._id === categoryId);
            return (
              <Chip
                key={categoryId}
                label={category?.categoryName || categoryId}
                size="small"
                onDelete={() => setSelectedFilters(prev => ({
                  ...prev,
                  categories: prev.categories.filter(id => id !== categoryId)
                }))}
              />
            );
          })}
          {selectedFilters.hasValues && (
            <Chip
              label="Has values"
              size="small"
              onDelete={() => setSelectedFilters(prev => ({ ...prev, hasValues: false }))}
            />
          )}
          {selectedFilters.emptyValues && (
            <Chip
              label="Empty values"
              size="small"
              onDelete={() => setSelectedFilters(prev => ({ ...prev, emptyValues: false }))}
            />
          )}
        </Box>
      )}

      {/* Validation errors */}
      {Object.keys(validationErrors).length > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="body2">
            Please fix the following errors: {Object.values(validationErrors).join(', ')}
          </Typography>
        </Alert>
      )}
    </Box>
  );

  const groupedData = useMemo(() => {
    const sortedCategories = Array.isArray(categories)
      ? [...categories].sort((a, b) => (a.order || 0) - (b.order || 0))
      : [];
    return sortedCategories
      .map((category) => {
        if (!category?._id || !category?.categoryName) return null;
        const items = filteredData.filter((outlay) => {
          const outlayCategoryId = outlay.category?._id || outlay.category;
          return outlayCategoryId === category._id;
        });
        const totalIncome = items.reduce((sum, item) => sum + (parseFloat(item.income) || 0), 0);
        const totalSubsidy = items.reduce((sum, item) => sum + (parseFloat(item.subsidy) || 0), 0);
        const totalCost = totalIncome + totalSubsidy;
        return {
          order: category.order,
          categoryName: category.categoryName,
          categoryId: category._id,
          items,
          totalIncome,
          totalSubsidy,
          totalCost,
        };
      })
      .filter(Boolean);
  }, [categories, capitalOutlays]);

  const grandTotalIncome = useMemo(() => {
    return groupedData.reduce((sum, group) => sum + (group.totalIncome || 0), 0);
  }, [groupedData]);

  const grandTotalSubsidy = useMemo(() => {
    return groupedData.reduce((sum, group) => sum + (group.totalSubsidy || 0), 0);
  }, [groupedData]);

  const grandTotal = useMemo(() => {
    return grandTotalIncome + grandTotalSubsidy;
  }, [grandTotalIncome, grandTotalSubsidy]);

  const toRoman = useCallback((num) => {
    const romanNumerals = [
      ["M", 1000],
      ["CM", 900],
      ["D", 500],
      ["CD", 400],
      ["C", 100],
      ["XC", 90],
      ["L", 50],
      ["XL", 40],
      ["X", 10],
      ["IX", 9],
      ["V", 5],
      ["IV", 4],
      ["I", 1],
    ];
    let result = "";
    for (const [roman, value] of romanNumerals) {
      while (num >= value) {
        result += roman;
        num -= value;
      }
    }
    return result;
  }, []);

  const isGroupSubmitted = useCallback(
    (group) => group.items.length > 0 && group.items.every((item) => item.status === "Submitted" || item.status === "Approved"),
    []
  );

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "300px" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2, color: "error.main" }}>
        <Typography>{error}</Typography>
      </Box>
    );
  }

  const OutlayTextField = ({ value, onChange, placeholder, disabled = false, error, isMonetary = false, ...props }) => (
    <TextField
      fullWidth
      value={value || ""}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      error={!!error}
      size="small"
      sx={{ backgroundColor: "white" }}
      InputProps={
        isMonetary
          ? {
              inputComponent: NumberFormatCustom,
              startAdornment: <InputAdornment position="start">₱</InputAdornment>,
            }
          : undefined
      }
      {...props}
    />
  );

  const TableHeader = ({ children, ...props }) => (
    <TableCell 
      sx={{ 
        fontWeight: "bold", 
        color: "white", 
        backgroundColor: "#375e38",
        padding: "12px 16px",
        ...props.sx 
      }}
      {...props}
    >
      {children}
    </TableCell>
  );

  const CategoryHeader = ({ name, total, categoryId, isExpanded, onToggle }) => (
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: "#375e38",
        color: "white",
        p: 1.5,
        borderRadius: "4px 4px 0 0",
        mb: 0,
        cursor: "pointer",
        "&:hover": {
          backgroundColor: "#2e4e2f",
        },
      }}
      onClick={() => onToggle(categoryId)}
    >
      <Box display="flex" alignItems="center" gap={1}>
        <IconButton
          size="small"
          sx={{ color: "white", p: 0.5 }}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(categoryId);
          }}
        >
          {isExpanded ? <ExpandLess /> : <ExpandMore />}
        </IconButton>
        <Typography variant="h6" component="h3" sx={{ fontWeight: "bold" }}>
          {name}
        </Typography>
      </Box>
      <Typography variant="subtitle1">Total: ₱{total}</Typography>
    </Box>
  );

  // Filter menu component
  const renderFilterMenu = () => (
    <Menu
      anchorEl={filterAnchorEl}
      open={Boolean(filterAnchorEl)}
      onClose={() => setFilterAnchorEl(null)}
      PaperProps={{ sx: { minWidth: 300, p: 2 } }}
    >
      <Typography variant="h6" gutterBottom>
        Advanced Filters
      </Typography>

      <Divider sx={{ mb: 2 }} />

      {/* Category filter */}
      <Typography variant="subtitle2" gutterBottom>
        Categories
      </Typography>
      <Box sx={{ mb: 2, maxHeight: 150, overflow: 'auto' }}>
        {categories.map(category => (
          <FormControlLabel
            key={category._id}
            control={
              <Checkbox
                checked={selectedFilters.categories.includes(category._id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedFilters(prev => ({
                      ...prev,
                      categories: [...prev.categories, category._id]
                    }));
                  } else {
                    setSelectedFilters(prev => ({
                      ...prev,
                      categories: prev.categories.filter(id => id !== category._id)
                    }));
                  }
                }}
              />
            }
            label={category.categoryName}
          />
        ))}
      </Box>

      <Divider sx={{ mb: 2 }} />

      {/* Amount range filter */}
      <Typography variant="subtitle2" gutterBottom>
        Amount Range
      </Typography>
      <Box display="flex" gap={1} mb={2}>
        <TextField
          label="Min"
          type="number"
          size="small"
          value={selectedFilters.amountRange.min}
          onChange={(e) => setSelectedFilters(prev => ({
            ...prev,
            amountRange: { ...prev.amountRange, min: e.target.value }
          }))}
        />
        <TextField
          label="Max"
          type="number"
          size="small"
          value={selectedFilters.amountRange.max}
          onChange={(e) => setSelectedFilters(prev => ({
            ...prev,
            amountRange: { ...prev.amountRange, max: e.target.value }
          }))}
        />
      </Box>

      <Divider sx={{ mb: 2 }} />

      {/* Value filters */}
      <FormControlLabel
        control={
          <Checkbox
            checked={selectedFilters.hasValues}
            onChange={(e) => setSelectedFilters(prev => ({
              ...prev,
              hasValues: e.target.checked,
              emptyValues: e.target.checked ? false : prev.emptyValues
            }))}
          />
        }
        label="Show only items with values"
      />

      <FormControlLabel
        control={
          <Checkbox
            checked={selectedFilters.emptyValues}
            onChange={(e) => setSelectedFilters(prev => ({
              ...prev,
              emptyValues: e.target.checked,
              hasValues: e.target.checked ? false : prev.hasValues
            }))}
          />
        }
        label="Show only empty items"
      />

      <Box display="flex" justifyContent="space-between" mt={2}>
        <Button onClick={handleClearFilters} size="small">
          Clear All
        </Button>
        <Button
          onClick={() => setFilterAnchorEl(null)}
          variant="contained"
          size="small"
        >
          Apply
        </Button>
      </Box>
    </Menu>
  );

  return (
    <ErrorBoundary>
      {/* Due Date Warning */}
      {dueDateStatus && dueDateStatus.isPastDue && (
        <Alert 
          severity={canDeleteItems ? "warning" : "error"} 
          sx={{ mb: 2 }}
          variant="filled"
        >
          <Typography variant="body2">
            <strong>
              {canDeleteItems 
                ? "⚠️ Past Due Date - Admin Access" 
                : "🚫 Submission Deadline Passed"
              }
            </strong>
          </Typography>
          <Typography variant="body2">
            Deadline was {dueDateStatus.dueDateFormatted}. 
            {canDeleteItems 
              ? " You have admin privileges and can still make changes."
              : " Contact your administrator if you need to make changes."
            }
          </Typography>
        </Alert>
      )}
      
      <Box
        sx={{
          backgroundColor: "background.paper",
          borderRadius: 2,
          boxShadow: 3,
          p: 3,
          mb: 2,
        }}
      >
        {/* Enhanced Toolbar */}
        {renderEnhancedToolbar()}

        {/* Filter Menu */}
        {renderFilterMenu()}
        <Box sx={{ maxHeight: "60vh", overflowY: "auto" }} ref={tableContainerRef}>
          {groupedData.map((group, index) => {
            const isExpanded = expandedCategories.includes(group.categoryId);

            return (
              <Box key={group.categoryId}>
                <Box
                  sx={{
                    mb: compactView ? 2 : 4,
                    pb: compactView ? 1 : 2,
                    borderRadius: 2,
                    overflow: "hidden",
                    boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                  }}
                >
                <CategoryHeader
                  name={group.categoryName}
                  total={formatNumber(calculateCategoryTotal(group.categoryId, capitalOutlays))}
                  categoryId={group.categoryId}
                  isExpanded={isExpanded}
                  onToggle={toggleCategoryExpansion}
                />

                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
              
                <TableContainer
                  component={Paper}
                  sx={{
                    mb: compactView ? 2 : 4,
                    boxShadow: 3,
                    overflowX: 'auto',
                    borderRadius: 2,
                    '&::-webkit-scrollbar': {
                      width: '8px',
                      height: '8px',
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
                  }}
                >
                  <Table sx={{
                    minWidth: 1200,
                    '& .MuiTableCell-root': compactView ? {
                      padding: '6px 8px',
                      fontSize: '0.8rem'
                    } : {}
                  }}>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: "primary.main" }}>
                      <TableCell sx={{ color: "white", width: "50px", padding: "8px" }}>
                        <Checkbox
                          checked={selectedRows.length === group.items.length && group.items.length > 0}
                          indeterminate={selectedRows.length > 0 && selectedRows.length < group.items.length}
                          onChange={() => {
                            const groupItemIds = group.items.map(item => item._id);
                            const allSelected = groupItemIds.every(id => selectedRows.includes(id));

                            if (allSelected) {
                              setSelectedRows(prev => prev.filter(id => !groupItemIds.includes(id)));
                            } else {
                              setSelectedRows(prev => [...new Set([...prev, ...groupItemIds])]);
                            }
                          }}
                          sx={{ color: "white" }}
                        />
                      </TableCell>
                      <TableCell sx={{ color: "white", width: "80px" }}>Actions</TableCell>
                      <TableCell sx={{ color: "white" }}>Subline Item</TableCell>
                      <TableCell sx={{ color: "white" }}>Accounting Title</TableCell>
                      <TableCell sx={{ color: "white", width: "120px" }}>UACS Code</TableCell>
                      <TableCell sx={{ color: "white" }}>Particulars</TableCell>
                      <TableCell sx={{ color: "white", minWidth: '150px', width: '150px', textAlign: 'center' }}>
                        INCOME
                        {showColumnTotals && (
                          <Typography variant="caption" display="block" sx={{ fontSize: '0.7rem', opacity: 0.8 }}>
{group.totalIncome > 0 ? `₱${formatNumber(group.totalIncome)}` : ""}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ color: "white", minWidth: '150px', width: '150px', textAlign: 'center' }}>
                        SUBSIDY
                        {showColumnTotals && (
                          <Typography variant="caption" display="block" sx={{ fontSize: '0.7rem', opacity: 0.8 }}>
{group.totalSubsidy > 0 ? `₱${formatNumber(group.totalSubsidy)}` : ""}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ color: "white", minWidth: '150px', width: '150px', textAlign: 'center' }}>
                        TOTAL
                        {showColumnTotals && (
                          <Typography variant="caption" display="block" sx={{ fontSize: '0.7rem', opacity: 0.8 }}>
{group.totalCost > 0 ? `₱${formatNumber(group.totalCost)}` : ""}
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {group.items.map((item, itemIndex) => (
                      <TableRow
                        key={item._id}
                        id={`capital-outlay-row-${item._id}`}
                        sx={{
                          backgroundColor: selectedRows.includes(item._id)
                            ? "#e3f2fd"
                            : itemIndex % 2 === 0 ? "white" : "#f9f9f9",
                          height: compactView ? 'auto' : 'inherit',
                          "&:hover": {
                            backgroundColor: selectedRows.includes(item._id) ? "#bbdefb" : "#e8f5e9",
                          },
                        }}
                      >
                        <TableCell sx={{ padding: "8px" }}>
                          <Checkbox
                            checked={selectedRows.includes(item._id)}
                            onChange={() => handleRowSelect(item._id)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: "flex", gap: 0.5 }}>
                            <Tooltip title="Edit details and breakdown">
                              <IconButton
                                color="primary"
                                onClick={() => handleOpenDetailsModal(item)}
                                disabled={item.status === "Submitted" || item.status === "Approved"}
                                size="small"
                              >
                                <Edit fontSize="small" />
                              </IconButton>
                            </Tooltip>

                            
                            <Tooltip 
                              title={
                                item.status === "Submitted" || item.status === "Approved" 
                                  ? "Cannot delete submitted/approved items"
                                  : !canDeleteItems 
                                    ? "Only admin users can delete items after the deadline"
                                    : "Delete item"
                              }
                            >
                              <span>
                                <IconButton
                                  color="error"
                                  onClick={() => handleDeleteClick(item._id)}
                                  disabled={item.status === "Submitted" || item.status === "Approved"}
                                  size="small"
                                >
                                  <Delete fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Box>
                        </TableCell>
                        {editingId === item._id ? (
                          <>
                            <TableCell>
                              <TextField value={editedOutlay.sublineItem || ""} onChange={e => handleEditChange("sublineItem", e.target.value)} size="small" />
                            </TableCell>
                            <TableCell>
                              <TextField value={editedOutlay.accountingTitle || ""} onChange={e => handleEditChange("accountingTitle", e.target.value)} size="small" />
                            </TableCell>
                            <TableCell>
                              <TextField value={editedOutlay.uacsCode || ""} onChange={e => handleEditChange("uacsCode", e.target.value)} size="small" />
                            </TableCell>
                            <TableCell>
                              <TextField value={editedOutlay.particulars || ""} onChange={e => handleEditChange("particulars", e.target.value)} size="small" />
                            </TableCell>
                            <TableCell align="right">
                              <TextField 
                                value={editedOutlay.income || ""} 
                                size="small" 
                                InputProps={{
                                  readOnly: true,
                                  style: { backgroundColor: '#f5f5f5' }
                                }}
                                helperText="Calculated from breakdown"
                              />
                            </TableCell>
                            <TableCell align="right">
                              <TextField 
                                value={editedOutlay.subsidy || ""} 
                                size="small" 
                                InputProps={{
                                  readOnly: true,
                                  style: { backgroundColor: '#f5f5f5' }
                                }}
                                helperText="Calculated from breakdown"
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Typography fontWeight="bold">
                                {(() => {
                                  const income = parseFloat(editedOutlay.income || 0);
                                  const subsidy = parseFloat(editedOutlay.subsidy || 0);
                                  const total = income + subsidy;
                                  return total > 0 ? `₱${formatNumber(total)}` : "";
                                })()}
                              </Typography>
                            </TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell>{item.sublineItem}</TableCell>
                            <TableCell>{item.accountingTitle}</TableCell>
                            <TableCell>{item.uacsCode}</TableCell>
                            <TableCell>
                              {/* Show main particulars with fallback if empty */}
                              <Typography variant="body2" sx={{ fontWeight: 'medium', mb: 0.5 }}>
                                {item.particulars && item.particulars.trim() !== "" 
                                  ? item.particulars 
                                  : (capitalOutlayDetails[item._id]?.length > 0 
                                      ? capitalOutlayDetails[item._id].map(d => d.particulars).filter(Boolean).join('; ')
                                      : '—')}
                              </Typography>
                              
                              {/* Show breakdown items if available */}
                              {capitalOutlayDetails[item._id] && capitalOutlayDetails[item._id].length > 0 && (
                                <Box sx={{ mt: 1 }}>
                                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold' }}>
                                    Breakdown:
                                  </Typography>
                                  {capitalOutlayDetails[item._id].map((detail, index) => (
                                    <Typography 
                                      key={detail._id || detail.particulars || index} 
                                      variant="caption" 
                                      display="block" 
                                      color="text.secondary"
                                      sx={{ pl: 1, fontSize: '0.75rem' }}
                                    >
                                      • {detail.particulars} (₱{(detail.income_amount + detail.subsidy_amount).toLocaleString()})
                                    </Typography>
                                  ))}
                                </Box>
                              )}
                            </TableCell>
                            <TableCell align="right" sx={{ minWidth: '150px', width: '150px' }}>
                              {(() => {
                                const income = parseFloat(item.income || 0);
                                return income > 0 ? `₱${formatNumber(income)}` : "";
                              })()}
                            </TableCell>
                            <TableCell align="right" sx={{ minWidth: '150px', width: '150px' }}>
                              {(() => {
                                const subsidy = parseFloat(item.subsidy || 0);
                                return subsidy > 0 ? `₱${formatNumber(subsidy)}` : "";
                              })()}
                            </TableCell>
                            <TableCell align="right" sx={{ minWidth: '150px', width: '150px' }}>
                              <Typography fontWeight="bold">
                                {(() => {
                                  const income = parseFloat(item.income || 0);
                                  const subsidy = parseFloat(item.subsidy || 0);
                                  const total = income + subsidy;
                                  return total > 0 ? `₱${formatNumber(total)}` : "";
                                })()}
                              </Typography>
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    ))}
                    
                    {addingCategoryId === group.categoryId && (
                      <TableRow sx={{
                        backgroundColor: '#f0f8f0',
                        borderTop: '1px dashed #4caf50',
                        height: 'auto',
                        minHeight: compactView ? '60px' : '80px'
                      }}>
                        <TableCell sx={{ padding: "8px" }}>
                          {/* Empty checkbox column for add row */}
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: "flex", gap: 0.5, justifyContent: "center", alignItems: "center" }}>
                            <Tooltip title="Cancel adding new item">
                              <IconButton
                                color="error"
                                onClick={() => {
                                  setAddingCategoryId(null);
                                  setNewOutlays((prev) => ({ ...prev, [group.categoryId]: {} }));
                                  setErrors({});
                                }}
                                size="small"
                              >
                                <Close fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Typography variant="caption" color="text.secondary" sx={{ ml: 1, fontStyle: 'italic' }}>
                              {!newOutlays[group.categoryId]?.sublineItem 
                                ? "Select subline item"
                                : !newOutlays[group.categoryId]?.accountingTitle
                                ? "Select accounting title to continue"
                                : "Form will auto-save"}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={newOutlays[group.categoryId]?.sublineItem || ""}
                            onChange={(e) => {
                              const selectedSublineItem = e.target.value;
                              handleOutlayChange(group.categoryId, "sublineItem", selectedSublineItem);
                              if (selectedSublineItem) {
                                fetchAccountingTitles(selectedSublineItem);
                              }
                            }}
                            fullWidth
                            size={compactView ? "small" : "small"}
                            error={!!errors.sublineItem}
                            sx={{
                              backgroundColor: "white",
                              height: compactView ? "32px" : "40px",
                              '& .MuiSelect-select': {
                                padding: compactView ? '6px 10px' : '10px 14px',
                                fontSize: compactView ? '12px' : '14px'
                              }
                            }}
                          >
                            {(sublineItems[group.categoryName] || []).map((item) => (
                              <MenuItem key={item} value={item}>
                                {item}
                              </MenuItem>
                            ))}
                          </Select>
                          {errors.sublineItem && <FormHelperText error>{errors.sublineItem}</FormHelperText>}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={newOutlays[group.categoryId]?.accountingTitle || ""}
                            onChange={(e) => {
                              const selectedTitle = e.target.value;
                              
                              const selectedTitleObj = accountingTitles[newOutlays[group.categoryId]?.sublineItem]?.find(
                                (title) => title.accountingTitle === selectedTitle
                              );
                              
                              // Update the form first
                              handleOutlayChange(group.categoryId, "accountingTitle", selectedTitle);
                              if (selectedTitleObj?.uacsCode) {
                                handleOutlayChange(group.categoryId, "uacsCode", selectedTitleObj.uacsCode);
                              }

                              // If both subline item and accounting title are selected, open modal for breakdown entry
                              // Do NOT save to database yet - only save when user clicks save in modal with breakdown details
                              if (selectedTitle && newOutlays[group.categoryId]?.sublineItem) {
                                const currentEntry = newOutlays[group.categoryId] || {};
                                
                                // Create a temporary item object for the modal (not saved to database yet)
                                const tempItemForModal = {
                                  sublineItem: currentEntry.sublineItem,
                                  accountingTitle: selectedTitle,
                                  uacsCode: selectedTitleObj?.uacsCode || "",
                                  particulars: currentEntry.particulars || "",
                                  category: {
                                    _id: group.categoryId,
                                    categoryName: group.categoryName
                                  },
                                  isTemporary: true, // Flag to indicate this is not saved yet
                                  tempCategoryId: group.categoryId // For saving later
                                };

                                toast.info("Add breakdown details and click Save to create the item.", {
                                  autoClose: 3000,
                                });

                                // Open the modal immediately with the temporary item
                                setSelectedCapitalOutlay(tempItemForModal);
                                setDetailsModalOpen(true);
                              }
                            }}
                            fullWidth
                            size={compactView ? "small" : "small"}
                            error={!!errors.accountingTitle}
                            disabled={!newOutlays[group.categoryId]?.sublineItem}
                            sx={{
                              backgroundColor: "white",
                              height: compactView ? "32px" : "40px",
                              '& .MuiSelect-select': {
                                padding: compactView ? '6px 10px' : '10px 14px',
                                fontSize: compactView ? '12px' : '14px'
                              }
                            }}
                          >
                            {(accountingTitles[newOutlays[group.categoryId]?.sublineItem] || []).map((title) => (
                              <MenuItem key={title.accountingTitle} value={title.accountingTitle}>
                                {title.accountingTitle}
                              </MenuItem>
                            ))}
                          </Select>
                          {errors.accountingTitle && <FormHelperText error>{errors.accountingTitle}</FormHelperText>}
                        </TableCell>
                        <TableCell>
                          <TextField
                            value={newOutlays[group.categoryId]?.uacsCode || ""}
                            disabled
                            fullWidth
                            size="small"
                            sx={{ 
                              backgroundColor: "#f5f5f5",
                              '& .MuiInputBase-input': {
                                padding: '10px 14px',
                                height: '20px',
                                fontSize: '14px'
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            value={newOutlays[group.categoryId]?.particulars || ""}
                            onChange={(e) => handleOutlayChange(group.categoryId, "particulars", e.target.value)}
                            placeholder="Enter particulars"
                            fullWidth
                            multiline
                            rows={3}
                            size="small"
                            sx={{ 
                              backgroundColor: "white",
                              '& .MuiInputBase-input': {
                                padding: '10px 14px',
                                fontSize: '14px'
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ minWidth: '150px', width: '150px' }}>
                          <TextField
                            value={newOutlays[group.categoryId]?.income || ""}
                            placeholder="0.00"
                            fullWidth
                            size="medium"
                            InputProps={{
                              readOnly: true,
                              inputComponent: NumberFormatCustom,
                            }}
                            sx={{ 
                              backgroundColor: "#f5f5f5",
                              width: '150px',
                              '& .MuiInputBase-input': {
                                padding: '12px 14px',
                                fontSize: '16px',
                                textAlign: 'right',
                                fontWeight: 'normal'
                              }
                            }}
                            helperText="Calculated from breakdown"
                          />
                        </TableCell>
                        <TableCell sx={{ minWidth: '150px', width: '150px' }}>
                          <TextField
                            value={newOutlays[group.categoryId]?.subsidy || ""}
                            placeholder="0.00"
                            fullWidth
                            size="medium"
                            InputProps={{
                              readOnly: true,
                              inputComponent: NumberFormatCustom,
                            }}
                            sx={{ 
                              backgroundColor: "#f5f5f5",
                              width: '150px',
                              '& .MuiInputBase-input': {
                                padding: '12px 14px',
                                fontSize: '16px',
                                textAlign: 'right',
                                fontWeight: 'normal'
                              }
                            }}
                            helperText="Calculated from breakdown"
                          />
                        </TableCell>
                        <TableCell sx={{ minWidth: '150px', width: '150px' }}>
                          <TextField
                            value={calculateTotal(
                              newOutlays[group.categoryId]?.income || 0,
                              newOutlays[group.categoryId]?.subsidy || 0
                            )}
                            disabled
                            fullWidth
                            size="medium"
                            sx={{
                              backgroundColor: "#f5f5f5",
                              width: '150px',
                              '& .MuiInputBase-input': {
                                padding: '12px 14px',
                                fontSize: '16px',
                                textAlign: 'right',
                                fontWeight: 'bold'
                              },
                              "& .Mui-disabled": {
                                color: "#333",
                                WebkitTextFillColor: "#333",
                              }
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                    
                    {addingCategoryId !== group.categoryId && (
                      <TableRow>
                        <TableCell colSpan={9} sx={{ textAlign: "center", py: 1 }}>
                          <Button
                            variant="contained"
                            color="success"
                            startIcon={<Add />}
                            onClick={() => {
                              setAddingCategoryId(group.categoryId);
                              setNewOutlays((prev) => ({
                                ...prev,
                                [group.categoryId]: {
                                  income: "",
                                  subsidy: "",
                                  particulars: "",
                                },
                              }));
                              fetchSublineItems(group.categoryName, true, group.categoryId);
                            }}
                            size="small"
                            sx={{ borderRadius: 4, px: 2, my: 1 }}
                          >
                            Add Item
                          </Button>
                        </TableCell>
                      </TableRow>
                    )}
                    
                    <TableRow sx={{ backgroundColor: "#f0f7f0" }}>
                      <TableCell colSpan={6}>
                        <Typography variant="subtitle2" sx={{ fontWeight: "bold" }}>
                          SUBTOTAL
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                          <Typography variant="caption" sx={{ color: "#666", mb: 0.5, fontSize: "0.7rem" }}>
                            INCOME
                          </Typography>
                          <Typography variant="subtitle2" sx={{ fontWeight: "bold" }}>
                            {group.totalIncome > 0 ? `₱${formatNumber(group.totalIncome)}` : ""}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                          <Typography variant="caption" sx={{ color: "#666", mb: 0.5, fontSize: "0.7rem" }}>
                            SUBSIDY
                          </Typography>
                          <Typography variant="subtitle2" sx={{ fontWeight: "bold" }}>
                            {group.totalSubsidy > 0 ? `₱${formatNumber(group.totalSubsidy)}` : ""}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                          <Typography variant="caption" sx={{ color: "#666", mb: 0.5, fontSize: "0.7rem" }}>
                            TOTAL
                          </Typography>
                          <Typography variant="subtitle2" sx={{ fontWeight: "bold" }}>
                            {group.totalCost > 0 ? `₱${formatNumber(group.totalCost)}` : ""}
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                  </Table>
                </TableContainer>
                </Collapse>
                </Box>
              </Box>
            );
          })}
        </Box>

        {/* Pagination */}
        {filteredData.length > rowsPerPage && (
          <Box display="flex" justifyContent="center" mt={2}>
            <TablePagination
              component="div"
              count={filteredData.length}
              page={page}
              onPageChange={(event, newPage) => setPage(newPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(event) => {
                setRowsPerPage(parseInt(event.target.value, 10));
                setPage(0);
              }}
              rowsPerPageOptions={[5, 10, 25, 50, 100]}
              labelRowsPerPage="Items per page:"
              sx={{
                '& .MuiTablePagination-toolbar': {
                  backgroundColor: '#f5f5f5',
                  borderRadius: 1,
                  px: 2
                }
              }}
            />
          </Box>
        )}

        {/* Grand Total Section */}
        <TableContainer sx={{
          mt: 2,
          mb: 2,
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          borderRadius: 2,
          overflow: "hidden",
        }}>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: "#375e38" }}>
                <TableCell colSpan={6} sx={{ color: "#fff", fontWeight: "bold", fontSize: "1.1rem" }}>
                  GRAND TOTAL
                </TableCell>
                <TableCell
                  sx={{
                    color: "#fff",
                    fontWeight: "bold",
                    padding: "16px 20px",
                    textAlign: "right",
                    fontSize: "1.1rem",
                  }}
                >
                  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                    <Typography variant="caption" sx={{ color: "#fff", mb: 0.5 }}>
                      INCOME
                    </Typography>
                    {formatNumber(grandTotalIncome)}
                  </Box>
                </TableCell>
                <TableCell
                  sx={{
                    color: "#fff",
                    fontWeight: "bold",
                    padding: "16px 20px",
                    textAlign: "right",
                    fontSize: "1.1rem",
                  }}
                >
                  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                    <Typography variant="caption" sx={{ color: "#fff", mb: 0.5 }}>
                      SUBSIDY
                    </Typography>
                    {formatNumber(grandTotalSubsidy)}
                  </Box>
                </TableCell>
                <TableCell
                  sx={{
                    color: "#fff",
                    fontWeight: "bold",
                    padding: "16px 20px",
                    textAlign: "right",
                    fontSize: "1.2rem",
                  }}
                >
                  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                    <Typography variant="caption" sx={{ color: "#fff", mb: 0.5 }}>
                      TOTAL
                    </Typography>
                    {formatNumber(grandTotal)}
                  </Box>
                </TableCell>
              </TableRow>
            </TableHead>
            </Table>
          </TableContainer>

        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mt: 1,
            mb: 0,
            px: 2,
            py: 1,
            borderRadius: 1,
            backgroundColor: "#f5f5f5",
            fontSize: "0.875rem",
            color: "text.secondary",
          }}
        >
          <Typography variant="caption">Total Items: {capitalOutlays.length}</Typography>
          <Typography variant="caption">Last Updated: {new Date().toLocaleDateString()}</Typography>
        </Box>

        <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} aria-labelledby="delete-dialog-title" aria-describedby="delete-dialog-description">
          <DialogTitle id="delete-dialog-title" sx={{ backgroundColor: "error.main", color: "white" }}>
            Confirm Deletion
          </DialogTitle>
          <DialogContent sx={{ mt: 2 }}>
            <DialogContentText id="delete-dialog-description">Are you sure you want to delete this capital outlay entry? This action cannot be undone.</DialogContentText>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setDeleteConfirmOpen(false)} color="primary" variant="outlined">
              Cancel
            </Button>
            <Button onClick={handleConfirmDelete} color="error" variant="contained" autoFocus>
              Delete
            </Button>
          </DialogActions>
        </Dialog>

        {/* Floating Action Button for Quick Actions */}
        {selectedRows.length > 0 && (
          <Fab
            color="primary"
            sx={{
              position: 'fixed',
              bottom: 16,
              right: 16,
              zIndex: 1000
            }}
            onClick={() => {
              // Quick bulk actions menu could be implemented here
              toast.info(`${selectedRows.length} items selected`);
            }}
          >
            <Settings />
          </Fab>
        )}

        {/* Unsaved changes indicator */}
        {hasUnsavedChanges && (
          <Box
            sx={{
              position: 'fixed',
              bottom: 16,
              left: 16,
              backgroundColor: 'warning.main',
              color: 'white',
              px: 2,
              py: 1,
              borderRadius: 1,
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}
          >
            <Save fontSize="small" />
            <Typography variant="body2">
              Unsaved changes
            </Typography>
          </Box>
        )}

        {/* Capital Outlay Details Modal */}
        <CapitalOutlayDetailsModal
          open={detailsModalOpen}
          onClose={handleCloseDetailsModal}
          capitalOutlayId={selectedCapitalOutlay?._id}
          accountingTitle={selectedCapitalOutlay?.accountingTitle}
          onSave={handleDetailsModalSave}
          temporaryItem={selectedCapitalOutlay?.isTemporary ? {
            ...selectedCapitalOutlay,
            fiscalYear,
            budgetType
          } : null}
        />
      </Box>
    </ErrorBoundary>
  );
}

CapitalOutlayTable.propTypes = {
  onDataChange: PropTypes.func,
};

export default CapitalOutlayTable;
