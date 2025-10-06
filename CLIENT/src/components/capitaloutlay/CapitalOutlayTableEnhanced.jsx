import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { NumericFormat } from "react-number-format";
import PropTypes from "prop-types";
import api from "../../config/api";
import { useRegion } from "../../context/RegionContext";
import {
  Box,
  Typography,
  Button,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Collapse,
  Stack,
  Tooltip,
  Alert,
  Switch,
  Chip,
  CircularProgress,
  Divider,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Select,
  FormControlLabel,
  TextField,
  Checkbox,
  ListItemText,
  FormHelperText,
  InputAdornment,
  Backdrop,
  Badge,
} from "@mui/material";
import {
  Refresh,
  List as ListIcon,
  Visibility,
  VisibilityOff,
  MoreVert,
  TrendingUp,
  AccountBalance,
  Paid,
  Save,
  Add,
  Close,
  Edit,
  Delete,
  Search,
  Clear,
  FilterList,
} from "@mui/icons-material";
import { useUser } from "../../context/UserContext";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import CapitalOutlayDetailsModal from "./CapitalOutlayDetailsModal";

// Error Boundary Component with reset capability
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <Box sx={{ p: 3 }}>
          <Alert severity="error" variant="filled">
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              Something went wrong while loading the capital outlay table.
            </Typography>
            <Typography variant="body2">
              {this.state.error.message || "Please try again or contact support if the issue persists."}
            </Typography>
          </Alert>
        </Box>
      );
    }
    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  resetKey: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  children: PropTypes.node.isRequired,
};

// Updated NumberFormatCustom to handle props correctly
const NumberFormatCustom = React.forwardRef(function NumberFormatCustom(props, ref) {
  const { onChange, name = 'amount', ...other } = props;

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
  name: PropTypes.string,
  onChange: PropTypes.func.isRequired,
};

const formatNumber = (number) => {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number);
};

const defaultFilterState = {
  categories: [],
  sublineItems: [],
  amountRange: { min: "", max: "" },
  hasValues: false,
  emptyValues: false,
};

const CapitalOutlayTableEnhanced = ({ onDataChange, disableIncomeInputs = false }) => {
  // Basic state
  const [capitalOutlays, setCapitalOutlays] = useState([]);
  const [categories, setCategories] = useState([]);
  const [sublineItems, setSublineItems] = useState({});
  const [accountingTitles, setAccountingTitles] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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
  const tableContainerRef = useRef(null);
  const scrollPositionRef = useRef(0);

  // Enhanced state management
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilters, setSelectedFilters] = useState(() => ({
    ...defaultFilterState,
    amountRange: { ...defaultFilterState.amountRange },
  }));
  const [showColumnTotals, setShowColumnTotals] = useState(true);

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

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

  // Actions menu state
  const [actionsMenuAnchor, setActionsMenuAnchor] = useState(null);
  const [actionsMenuRow, setActionsMenuRow] = useState(null);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedFilters.categories.length) count += selectedFilters.categories.length;
    if (selectedFilters.sublineItems.length) count += selectedFilters.sublineItems.length;
    if (selectedFilters.amountRange.min) count += 1;
    if (selectedFilters.amountRange.max) count += 1;
    if (selectedFilters.hasValues) count += 1;
    if (selectedFilters.emptyValues) count += 1;
    return count;
  }, [selectedFilters]);

  const amountRangeValidation = useMemo(() => {
    const min = selectedFilters.amountRange.min !== ""
      ? parseFloat(selectedFilters.amountRange.min)
      : null;
    const max = selectedFilters.amountRange.max !== ""
      ? parseFloat(selectedFilters.amountRange.max)
      : null;
    const isInvalid =
      min !== null &&
      max !== null &&
      !Number.isNaN(min) &&
      !Number.isNaN(max) &&
      min > max;

    return { min, max, isInvalid };
  }, [selectedFilters.amountRange]);

  const { min: filterMinAmount, max: filterMaxAmount, isInvalid: isAmountRangeInvalid } = amountRangeValidation;

  const categoryOptions = useMemo(() => {
    return [...categories]
      .map((category) => ({
        id: category._id?.toString() || category._id,
        name: category.categoryName,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [categories]);

  const availableSublineItems = useMemo(() => {
    const items = new Set();
    capitalOutlays.forEach((item) => {
      if (item.sublineItem) {
        items.add(item.sublineItem);
      }
    });
    return Array.from(items).sort((a, b) => a.localeCompare(b));
  }, [capitalOutlays]);

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
    const selectedCategoryIds = new Set(selectedFilters.categories);
    const selectedSublineItems = new Set(selectedFilters.sublineItems);
    const minAmount = filterMinAmount;
    const maxAmount = filterMaxAmount;
    const isRangeInvalid = isAmountRangeInvalid;

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
      if (selectedCategoryIds.size > 0) {
        const categoryId = (item.category?._id || item.category)?.toString();
        if (!selectedCategoryIds.has(categoryId)) {
          return false;
        }
      }

      // Subline item filter
      if (selectedSublineItems.size > 0) {
        if (!selectedSublineItems.has(item.sublineItem)) {
          return false;
        }
      }

      // Amount range filter
      const totalAmount = (parseFloat(item.income) || 0) + (parseFloat(item.subsidy) || 0);
      if (!isRangeInvalid && minAmount !== null && !Number.isNaN(minAmount) && totalAmount < minAmount) {
        return false;
      }
      if (!isRangeInvalid && maxAmount !== null && !Number.isNaN(maxAmount) && totalAmount > maxAmount) {
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
  }, [capitalOutlays, searchTerm, selectedFilters, filterMinAmount, filterMaxAmount, isAmountRangeInvalid]);

  // Group data by category for display
  const groupedTableData = useMemo(() => {
    const grouped = {};
    
    // First, add existing items grouped by category
    filteredData.forEach(item => {
      const categoryId = item.category?._id || item.category;
      const categoryName = item.category?.categoryName || "Uncategorized";
      
      if (!grouped[categoryId]) {
        grouped[categoryId] = {
          categoryId,
          categoryName,
          items: []
        };
      }
      
      grouped[categoryId].items.push(item);
    });
    
    // ALWAYS show all categories (even empty ones) so users can add new items
    // Only hide if user is actively searching
    if (categories.length > 0 && !searchTerm) {
      categories.forEach(category => {
        if (!grouped[category._id]) {
          grouped[category._id] = {
            categoryId: category._id,
            categoryName: category.categoryName,
            items: []
          };
        }
      });
    }
    
    return Object.values(grouped);
  }, [filteredData, categories, searchTerm]);

  const paginatedGroups = useMemo(() => {
    if (rowsPerPage === -1) {
      return groupedTableData;
    }
    const start = page * rowsPerPage;
    return groupedTableData.slice(start, start + rowsPerPage);
  }, [groupedTableData, page, rowsPerPage]);

  useEffect(() => {
    if (rowsPerPage === -1) return;
    const maxPage = Math.max(0, Math.ceil(groupedTableData.length / rowsPerPage) - 1);
    if (page > maxPage) {
      setPage(maxPage);
    }
  }, [groupedTableData.length, page, rowsPerPage]);

  useEffect(() => {
    setPage(0);
  }, [searchTerm, selectedFilters, rowsPerPage]);

  // Calculate totals
  const calculateTotals = useMemo(() => {
    const totalIncome = filteredData.reduce((sum, item) => sum + (parseFloat(item.income) || 0), 0);
    const totalSubsidy = filteredData.reduce((sum, item) => sum + (parseFloat(item.subsidy) || 0), 0);
    const totalCost = totalIncome + totalSubsidy;

    return {
      income: totalIncome,
      subsidy: totalSubsidy,
      cost: totalCost
    };
  }, [filteredData]);

  const summaryCards = useMemo(() => [
    {
      key: "items",
      label: "Items in view",
      value: filteredData.length,
      helper: `${groupedTableData.length} categories`,
      icon: ListIcon,
      color: "primary.main",
      formatter: (val) => val.toLocaleString(),
    },
    {
      key: "income",
      label: "Total income",
      value: calculateTotals.income,
      helper: "Funding from income",
      icon: TrendingUp,
      color: "success.main",
      formatter: formatNumber,
    },
    {
      key: "subsidy",
      label: "Total subsidy",
      value: calculateTotals.subsidy,
      helper: "Funding from subsidy",
      icon: AccountBalance,
      color: "info.main",
      formatter: formatNumber,
    },
    {
      key: "total",
      label: "Grand total",
      value: calculateTotals.cost,
      helper: "Income + subsidy",
      icon: Paid,
      color: "warning.main",
      formatter: formatNumber,
    },
  ], [filteredData.length, groupedTableData.length, calculateTotals]);

  // Modal handlers for capital outlay details
  const handleOpenDetailsModal = useCallback((capitalOutlay) => {
    setSelectedCapitalOutlay(capitalOutlay);
    setDetailsModalOpen(true);
    setActionsMenuAnchor(null);
  }, []);

  const handleCloseDetailsModal = () => {
    setDetailsModalOpen(false);
    setSelectedCapitalOutlay(null);
    
    if (newlyAddedItemId) {
      setTimeout(() => {
        const element = document.getElementById(`capital-outlay-row-${newlyAddedItemId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.style.backgroundColor = '#e3f2fd';
          setTimeout(() => {
            element.style.backgroundColor = '';
          }, 2000);
        }
        setNewlyAddedItemId(null);
      }, 100);
    }
  };

  // Callback when details are saved
  const handleDetailsSaved = useCallback(async (capitalOutlayId, totals) => {
    try {
      // Fetch the updated details
      const detailsResponse = await api.get(`/api/capital-outlay/${capitalOutlayId}/details`);
      const details = detailsResponse.data.details || [];
      
      setCapitalOutlayDetails(prev => ({
        ...prev,
        [capitalOutlayId]: details
      }));

      // Extract particulars from the details - combine all particulars from breakdown items
      const particularsFromDetails = details
        .map(d => d.particulars)
        .filter(Boolean)
        .join('; ');

      // Fetch the complete capital outlay item to get updated accountingTitle, uacsCode, etc.
      // We need to refetch from the list since there's no single-item endpoint
      const params = new URLSearchParams();
      if (fiscalYear) params.append('fiscalYear', fiscalYear);
      if (budgetType) params.append('budgetType', budgetType);
      if (regionFilter) params.append('region', regionFilter);
      
      const outlaysResponse = await api.get(`/capital-outlays?${params.toString()}`);
      const allOutlays = outlaysResponse.data.capitalOutlays || [];
      const updatedItem = allOutlays.find(item => item._id === capitalOutlayId);

      // Update the capital outlays array with the fresh data
      setCapitalOutlays(prev => {
        const updatedOutlays = prev.map(item => 
          item._id === capitalOutlayId 
            ? { 
                ...item,
                // Update with data from the refetched item if available
                ...(updatedItem ? {
                  accountingTitle: updatedItem.accountingTitle,
                  uacsCode: updatedItem.uacsCode,
                  sublineItem: updatedItem.sublineItem,
                } : {}),
                // Update totals from the save response
                income: totals.income, 
                subsidy: totals.subsidy, 
                cost: totals.cost,
                // Update particulars from details
                particulars: particularsFromDetails || item.particulars
              }
            : item
        );
        onDataChange?.(updatedOutlays);
        return updatedOutlays;
      });
    } catch (error) {
      console.error("Error fetching capital outlay details:", error);
    }
  }, [onDataChange, fiscalYear, budgetType, regionFilter]);

  // Validation function
  const validateInput = useCallback((data, isNew = false) => {
    const newErrors = {};

    if (!data.sublineItem) newErrors.sublineItem = "Subline item is required";
    if (!data.accountingTitle) newErrors.accountingTitle = "Accounting title is required";
    if (isNew && (!data.uacsCode || data.uacsCode.trim() === "")) {
      newErrors.uacsCode = "UACS code is required";
    }
    
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
    
    // Check for duplicates
    if (isNew && capitalOutlays && data.category && data.accountingTitle) {
      const normalizedCategoryId = data.category?.toString() || data.category;
      const normalizedTitle = data.accountingTitle.trim().toLowerCase();
      const normalizedUacs = (data.uacsCode || "").trim().toLowerCase();

      const isDuplicate = capitalOutlays.some((outlay) => {
        const outlayCategoryId = (outlay.category?._id || outlay.category)?.toString();
        if (outlayCategoryId !== normalizedCategoryId) {
          return false;
        }

        const outlayTitle = (outlay.accountingTitle || "").trim().toLowerCase();
        if (outlayTitle !== normalizedTitle) {
          return false;
        }

        if (normalizedUacs) {
          const outlayUacs = (outlay.uacsCode || "").trim().toLowerCase();
          return outlayUacs === normalizedUacs;
        }

        return true;
      });
      if (isDuplicate) {
        newErrors.accountingTitle = "This accounting title already exists for this category";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [capitalOutlays]);

  // Fetch accounting titles for a subline item (declared first to avoid dependency issues)
  const fetchAccountingTitles = useCallback(async (sublineItem) => {
    if (!sublineItem) return;
    if (tableContainerRef.current) {
      scrollPositionRef.current = tableContainerRef.current.scrollTop;
    }
    try {
      const res = await api.get(`/accounting-titles?sublineItem=${encodeURIComponent(sublineItem)}`);
      const titles = Array.isArray(res.data.accountingTitles) ? res.data.accountingTitles : [];
      const advisoryMessage = res.data?.message;

      if (titles.length === 0) {
        toast.warning(
          advisoryMessage ||
            `Please populate the Chart of Accounts with capital outlay titles for "${sublineItem}" (UACS starting with 5-01 or 5-02).`
        );
      }

      setAccountingTitles((prev) => ({
        ...prev,
        [sublineItem]: titles,
      }));
      setTimeout(() => {
        if (tableContainerRef.current) {
          tableContainerRef.current.scrollTop = scrollPositionRef.current;
        }
      }, 0);
    } catch (error) {
      console.error("Error fetching accounting titles:", error);
      toast.error("Error fetching accounting titles.");
    }
  }, []);

  // Fetch subline items for a category
  const fetchSublineItems = useCallback(async (categoryName, isNew = false, categoryId = null) => {
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
            category: categoryId,
            sublineItem: items[0],
            accountingTitle: "",
            uacsCode: "",
          },
        }));
        await fetchAccountingTitles(items[0]);
      }
    } catch (error) {
      console.error("Error fetching subline items:", error);
      toast.error("Error fetching subline items.");
    }
  }, [fetchAccountingTitles]);

  // Handle adding new outlay (launch breakdown modal with temporary item)
  const handleAddOutlay = useCallback((categoryId, categoryName) => {
    const currentEntry = newOutlays[categoryId] || {};

    if (!fiscalYear) {
      toast.warning("⏳ Loading fiscal year settings, please wait...");
      return;
    }

    if (!currentUser) {
      toast.error("User information is still loading. Please try again in a moment.");
      return;
    }

    // Ensure UACS code is populated based on selected accounting title
    let ensuredEntry = { ...currentEntry, category: categoryId };
    if (!ensuredEntry.uacsCode && ensuredEntry.sublineItem && ensuredEntry.accountingTitle) {
      const matchedTitle = (accountingTitles[ensuredEntry.sublineItem] || []).find(
        (title) => title.accountingTitle === ensuredEntry.accountingTitle
      );
      if (matchedTitle?.uacsCode) {
        ensuredEntry = { ...ensuredEntry, uacsCode: matchedTitle.uacsCode };
        setNewOutlays((prev) => ({
          ...prev,
          [categoryId]: {
            ...(prev[categoryId] || {}),
            category: categoryId,
            uacsCode: matchedTitle.uacsCode,
          },
        }));
        setErrors((prevErrors) => {
          if (!prevErrors.uacsCode) return prevErrors;
          const nextErrors = { ...prevErrors };
          delete nextErrors.uacsCode;
          return nextErrors;
        });
      }
    }

    if (!validateInput(ensuredEntry, true)) {
      toast.error("Please fix all validation errors before continuing");
      return;
    }

    const resolvedCategoryName =
      categoryName ||
      categories.find((cat) => (cat._id || cat.id)?.toString() === categoryId?.toString())?.categoryName ||
      "Uncategorized";

    const temporaryItem = {
      ...ensuredEntry,
      isTemporary: true,
      tempCategoryId: categoryId,
      fiscalYear,
      budgetType,
      category: {
        _id: categoryId,
        categoryName: resolvedCategoryName,
      },
    };

    setSelectedCapitalOutlay(temporaryItem);
    setDetailsModalOpen(true);
    setActionsMenuAnchor(null);

    toast.info("Add breakdown details and click Save to create the item.", {
      autoClose: 3000,
    });
  }, [newOutlays, fiscalYear, currentUser, accountingTitles, validateInput, budgetType, categories]);

  // Handle changes to new outlay form
  const handleOutlayChange = useCallback((categoryId, field, value) => {
    if (field === "income" && disableIncomeInputs) return;

    setNewOutlays((prev) => {
      const previousEntry = prev[categoryId] || { category: categoryId };
      const nextEntry = {
        ...previousEntry,
        category: previousEntry.category || categoryId,
        [field]: value,
      };

      if (field === "sublineItem") {
        nextEntry.accountingTitle = "";
        nextEntry.uacsCode = "";
      }

      if (field === "accountingTitle" && !value) {
        nextEntry.uacsCode = "";
      }

      if (field === "income" || field === "subsidy") {
        const income = parseFloat(field === "income" ? value : nextEntry.income) || 0;
        const subsidy = parseFloat(field === "subsidy" ? value : nextEntry.subsidy) || 0;
        nextEntry.cost = income + subsidy;
      }

      return {
        ...prev,
        [categoryId]: nextEntry,
      };
    });

    setErrors((prevErrors) => {
      if (field === "sublineItem") {
        if (!prevErrors.sublineItem && !prevErrors.accountingTitle && !prevErrors.uacsCode) {
          return prevErrors;
        }
        const nextErrors = { ...prevErrors };
        delete nextErrors.sublineItem;
        delete nextErrors.accountingTitle;
        delete nextErrors.uacsCode;
        return nextErrors;
      }
      if (field === "accountingTitle") {
        if (!prevErrors.accountingTitle && !prevErrors.uacsCode) {
          return prevErrors;
        }
        const nextErrors = { ...prevErrors };
        delete nextErrors.accountingTitle;
        delete nextErrors.uacsCode;
        return nextErrors;
      }
      if (field === "uacsCode") {
        if (!prevErrors.uacsCode) {
          return prevErrors;
        }
        const nextErrors = { ...prevErrors };
        delete nextErrors.uacsCode;
        return nextErrors;
      }
      return prevErrors;
    });
  }, [disableIncomeInputs]);

  const handleDetailsModalSave = async (totals) => {
    if (totals.isNewItem && totals.newItem) {
      const newItem = {
        ...totals.newItem,
        status: "Not Submitted",
      };
      
      const updatedData = [...capitalOutlays, newItem];
      setCapitalOutlays(updatedData);
      
      setCapitalOutlayDetails(prev => ({
        ...prev,
        [newItem._id]: []
      }));
      
      if (selectedCapitalOutlay?.tempCategoryId) {
        setNewOutlays((prev) => ({ ...prev, [selectedCapitalOutlay.tempCategoryId]: {} }));
        setAddingCategoryId(null);
      }
      
      setErrors({});
      
      onDataChange?.(updatedData);
      setNewlyAddedItemId(newItem._id);
      
      toast.success("Capital outlay item created successfully with breakdown details!");
    } else if (totals.capitalOutlayId) {
      await handleDetailsSaved(totals.capitalOutlayId, totals);
      toast.success("Capital outlay details saved to existing item successfully");
    } else if (selectedCapitalOutlay && selectedCapitalOutlay._id) {
      await handleDetailsSaved(selectedCapitalOutlay._id, totals);
      toast.success("Capital outlay details updated successfully");
    }
  };

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

        if (dueDateRes && dueDateRes.data) {
          setDueDateStatus(dueDateRes.data);
        }

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

  const handleDeleteClick = (itemId) => {
    setItemToDelete(itemId);
    setDeleteConfirmOpen(true);
    setActionsMenuAnchor(null);
  };

  const handleConfirmDelete = async () => {
    if (itemToDelete) {
      try {
        await api.delete(`/capital-outlays/${itemToDelete}`);
        const updatedOutlays = capitalOutlays.filter(item => item._id !== itemToDelete);
        setCapitalOutlays(updatedOutlays);
        onDataChange?.(updatedOutlays);
        toast.success("Item deleted successfully");
      } catch (error) {
        console.error("Error deleting item:", error);
        toast.error("Failed to delete item");
      }
      setDeleteConfirmOpen(false);
      setItemToDelete(null);
    }
  };

  const handleRefreshData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (regionFilter) {
        params.append('region', regionFilter);
      }
      
      const outlaysRes = await api.get(`/capital-outlays?${params.toString()}`);
      const outlaysWithStatus = outlaysRes.data.capitalOutlays.map((item) => ({
        ...item,
        status: item.status || "Not Submitted",
      }));

      setCapitalOutlays(outlaysWithStatus);
      await fetchAllCapitalOutlayDetails(outlaysWithStatus);
      onDataChange?.(outlaysWithStatus);
      toast.success("Data refreshed successfully");
    } catch (error) {
      console.error("Error refreshing data:", error);
      toast.error("Failed to refresh data");
    } finally {
      setLoading(false);
    }
  };

  // Handle actions menu
  const handleActionsMenuOpen = (event, item) => {
    setActionsMenuAnchor(event.currentTarget);
    setActionsMenuRow(item);
  };

  const handleActionsMenuClose = () => {
    setActionsMenuAnchor(null);
    setActionsMenuRow(null);
  };

  const handleChangePage = (_, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    const value = Number(event.target.value);
    setRowsPerPage(value);
    setPage(0);
  };

  const handleResetFilters = useCallback(() => {
    setSelectedFilters({
      ...defaultFilterState,
      amountRange: { ...defaultFilterState.amountRange },
    });
  }, []);

  const handleCategoryFilterChange = (event) => {
    const value = event.target.value;
    const normalized = (typeof value === "string" ? value.split(",") : value).map((val) => val.toString());
    setSelectedFilters((prev) => ({
      ...prev,
      categories: normalized,
    }));
  };

  const handleSublineFilterChange = (event) => {
    const value = event.target.value;
    const normalized = (typeof value === "string" ? value.split(",") : value).map((val) => val.toString());
    setSelectedFilters((prev) => ({
      ...prev,
      sublineItems: normalized,
    }));
  };

  const handleAmountFilterChange = (key) => (event) => {
    const { value } = event.target;
    setSelectedFilters((prev) => ({
      ...prev,
      amountRange: {
        ...prev.amountRange,
        [key]: value,
      },
    }));
  };

  const handleToggleHasValues = (event) => {
    const isChecked = event.target.checked;
    setSelectedFilters((prev) => ({
      ...prev,
      hasValues: isChecked,
      emptyValues: isChecked ? false : prev.emptyValues,
    }));
  };

  const handleToggleEmptyValues = (event) => {
    const isChecked = event.target.checked;
    setSelectedFilters((prev) => ({
      ...prev,
      emptyValues: isChecked,
      hasValues: isChecked ? false : prev.hasValues,
    }));
  };

  // Render enhanced toolbar
  const renderEnhancedToolbar = () => {
    const hasSearch = Boolean(searchTerm.trim());
    const hasFilters = activeFilterCount > 0;

    return (
      <Box sx={{ mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} mb={2} flexWrap="wrap" gap={2}>
          <Box>
            <Typography variant="h5" component="h2" fontWeight="bold" color="primary.main">
              Capital Outlay Items
            </Typography>
            {status && (
              <Chip
                label={`Submission status: ${status}`}
                size="small"
                color="primary"
                variant="outlined"
                sx={{ mt: 1, fontWeight: 500 }}
              />
            )}
          </Box>

          <Box display="flex" gap={1} flexWrap="wrap">
            <Tooltip title="Refresh data">
              <IconButton color="primary" onClick={handleRefreshData} size="small">
                <Refresh />
              </IconButton>
            </Tooltip>

            <Tooltip title={compactView ? "Normal view" : "Compact view"}>
              <IconButton
                color={compactView ? "secondary" : "primary"}
                onClick={() => setCompactView(!compactView)}
                size="small"
              >
                {compactView ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </Tooltip>

            <Tooltip title={showColumnTotals ? "Hide column totals" : "Show column totals"}>
              <IconButton
                color={showColumnTotals ? "primary" : "default"}
                onClick={() => setShowColumnTotals(!showColumnTotals)}
                size="small"
              >
                <ListIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title="Filter results">
              <IconButton
                color={showFilters || hasFilters ? "secondary" : "default"}
                onClick={() => setShowFilters((prev) => !prev)}
                size="small"
              >
                <Badge
                  color="secondary"
                  badgeContent={activeFilterCount}
                  overlap="circular"
                  invisible={!hasFilters}
                >
                  <FilterList />
                </Badge>
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          sx={{ mb: 3 }}
        >
          {summaryCards.map((card) => {
            const IconComponent = card.icon;
            return (
              <Paper
                key={card.key}
                elevation={0}
                sx={{
                  flex: 1,
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: "divider",
                  p: 2,
                  background: "linear-gradient(135deg, rgba(27,94,32,0.05) 0%, rgba(27,94,32,0.02) 100%)",
                }}
              >
                <Box display="flex" alignItems="center" gap={1.5} mb={1}>
                  <IconComponent sx={{ color: card.color }} fontSize="small" />
                  <Typography variant="subtitle2" sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    {card.label}
                  </Typography>
                </Box>
                <Typography variant="h6" fontWeight={700} sx={{ color: "text.primary" }}>
                  {card.formatter(card.value)}
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  {card.helper}
                </Typography>
              </Paper>
            );
          })}
        </Stack>

        <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
          <TextField
            placeholder="Search items, titles or codes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            sx={{ flexGrow: 1, minWidth: "220px", maxWidth: { xs: "100%", md: "420px" } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
              endAdornment: hasSearch && (
                <InputAdornment position="end">
                  <Tooltip title="Clear search">
                    <span>
                      <IconButton size="small" onClick={() => setSearchTerm("")}>
                        <Clear />
                      </IconButton>
                    </span>
                  </Tooltip>
                </InputAdornment>
              ),
            }}
          />
        </Box>

        {(hasSearch || hasFilters) && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Showing {filteredData.length.toLocaleString()} of {capitalOutlays.length.toLocaleString()} items across {groupedTableData.length.toLocaleString()} categories.
          </Typography>
        )}
      </Box>
    );
  };

  const renderFilterControls = () => (
    <Collapse in={showFilters} timeout="auto" unmountOnExit>
      <Paper
        variant="outlined"
        sx={{
          p: 3,
          mb: 3,
          backgroundColor: "background.default",
          borderRadius: 2,
          borderColor: "divider",
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              md: "repeat(2, minmax(0, 1fr))",
              lg: "repeat(4, minmax(0, 1fr))",
            },
            gap: 2,
            mb: 3,
          }}
        >
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary", mb: 1, display: "block" }}>
              Categories
            </Typography>
            <Select
              multiple
              fullWidth
              size="small"
              displayEmpty
              value={selectedFilters.categories}
              onChange={handleCategoryFilterChange}
              renderValue={(selected) => {
                if (!selected || selected.length === 0) {
                  return <Typography color="text.secondary">All categories</Typography>;
                }
                const names = categoryOptions
                  .filter((option) => selected.includes(option.id))
                  .map((option) => option.name);
                return names.join(", ");
              }}
            >
              {categoryOptions.map((option) => (
                <MenuItem key={option.id} value={option.id}>
                  <Checkbox checked={selectedFilters.categories.includes(option.id)} size="small" />
                  <ListItemText primary={option.name} />
                </MenuItem>
              ))}
            </Select>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary", mb: 1, display: "block" }}>
              Subline items
            </Typography>
            <Select
              multiple
              fullWidth
              size="small"
              displayEmpty
              value={selectedFilters.sublineItems}
              onChange={handleSublineFilterChange}
              renderValue={(selected) => {
                if (!selected || selected.length === 0) {
                  return <Typography color="text.secondary">All subline items</Typography>;
                }
                return selected.join(", ");
              }}
            >
              {availableSublineItems.map((item) => (
                <MenuItem key={item} value={item}>
                  <Checkbox checked={selectedFilters.sublineItems.includes(item)} size="small" />
                  <ListItemText primary={item} />
                </MenuItem>
              ))}
            </Select>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary", mb: 1, display: "block" }}>
              Minimum amount (₱)
            </Typography>
            <TextField
              type="number"
              size="small"
              fullWidth
              placeholder="0.00"
              value={selectedFilters.amountRange.min}
              onChange={handleAmountFilterChange("min")}
              inputProps={{ min: 0 }}
              error={isAmountRangeInvalid}
            />
          </Box>

          <Box>
            <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary", mb: 1, display: "block" }}>
              Maximum amount (₱)
            </Typography>
            <TextField
              type="number"
              size="small"
              fullWidth
              placeholder="No limit"
              value={selectedFilters.amountRange.max}
              onChange={handleAmountFilterChange("max")}
              inputProps={{ min: 0 }}
              error={isAmountRangeInvalid}
            />
            {isAmountRangeInvalid && (
              <FormHelperText error sx={{ mt: 0.5 }}>
                Maximum must be greater than or equal to minimum.
              </FormHelperText>
            )}
          </Box>
        </Box>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "flex-start", sm: "center" }} justifyContent="space-between">
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <FormControlLabel
              control={
                <Switch
                  checked={selectedFilters.hasValues}
                  onChange={handleToggleHasValues}
                  size="small"
                  color="success"
                />
              }
              label="Only items with amounts"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={selectedFilters.emptyValues}
                  onChange={handleToggleEmptyValues}
                  size="small"
                  color="warning"
                />
              }
              label="Only items without amounts"
            />
          </Stack>

          <Button
            variant="text"
            color="secondary"
            startIcon={<Clear />}
            onClick={handleResetFilters}
            sx={{ alignSelf: { xs: "flex-end", sm: "center" } }}
          >
            Clear filters
          </Button>
        </Stack>
      </Paper>
    </Collapse>
  );

  // Render loading state
  if (loading && capitalOutlays.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  // Render error state
  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <ErrorBoundary resetKey={`${capitalOutlays.length}-${error ? 1 : 0}` }>
      <Backdrop
        sx={{
          color: "#fff",
          zIndex: (theme) => theme.zIndex.drawer + 1,
          backdropFilter: "blur(1px)",
        }}
        open={loading && capitalOutlays.length > 0}
      >
        <Stack spacing={1} alignItems="center">
          <CircularProgress color="inherit" size={32} thickness={5} />
          <Typography variant="caption">Syncing latest capital outlay data…</Typography>
        </Stack>
      </Backdrop>
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

  {/* Filters */}
  {renderFilterControls()}

        {/* Main Table */}
        <TableContainer
          component={Paper}
          sx={{
            maxHeight: "70vh",
            boxShadow: 3,
            overflowX: 'auto',
            overflowY: 'auto',
            borderRadius: 2,
            border: '1px solid #e0e0e0',
            '&::-webkit-scrollbar': {
              width: '10px',
              height: '10px',
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
          ref={tableContainerRef}
        >
          <Table 
            stickyHeader
            sx={{
              minWidth: 1400,
              '& .MuiTableCell-root': compactView ? {
                padding: '8px 12px',
                fontSize: '0.85rem'
              } : {
                padding: '12px 16px',
                fontSize: '0.95rem'
              }
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell 
                  sx={{ 
                    backgroundColor: "#1b5e20",
                    color: "white",
                    fontWeight: "bold",
                    fontSize: compactView ? '0.85rem' : '0.95rem',
                    minWidth: '250px',
                    position: 'sticky',
                    left: 0,
                    zIndex: 3
                  }}
                >
                  TITLE
                </TableCell>
                <TableCell 
                  sx={{ 
                    backgroundColor: "#1b5e20",
                    color: "white",
                    fontWeight: "bold",
                    fontSize: compactView ? '0.85rem' : '0.95rem',
                    width: "100px",
                    textAlign: 'center'
                  }}
                >
                  Actions
                </TableCell>
                <TableCell 
                  sx={{ 
                    backgroundColor: "#1b5e20",
                    color: "white",
                    fontWeight: "bold",
                    fontSize: compactView ? '0.85rem' : '0.95rem',
                    minWidth: '200px'
                  }}
                >
                  Subline Item
                </TableCell>
                <TableCell 
                  sx={{ 
                    backgroundColor: "#1b5e20",
                    color: "white",
                    fontWeight: "bold",
                    fontSize: compactView ? '0.85rem' : '0.95rem',
                    minWidth: '200px'
                  }}
                >
                  Accounting Title
                </TableCell>
                <TableCell 
                  sx={{ 
                    backgroundColor: "#1b5e20",
                    color: "white",
                    fontWeight: "bold",
                    fontSize: compactView ? '0.85rem' : '0.95rem',
                    minWidth: "140px",
                    width: "140px"
                  }}
                >
                  UACS Code
                </TableCell>
                <TableCell 
                  sx={{ 
                    backgroundColor: "#1b5e20",
                    color: "white",
                    fontWeight: "bold",
                    fontSize: compactView ? '0.85rem' : '0.95rem',
                    minWidth: '300px'
                  }}
                >
                  Particulars
                </TableCell>
                <TableCell 
                  sx={{ 
                    backgroundColor: "#1b5e20",
                    color: "white",
                    fontWeight: "bold",
                    fontSize: compactView ? '0.85rem' : '0.95rem',
                    minWidth: '150px',
                    textAlign: 'right'
                  }}
                >
                  INCOME
                </TableCell>
                <TableCell 
                  sx={{ 
                    backgroundColor: "#1b5e20",
                    color: "white",
                    fontWeight: "bold",
                    fontSize: compactView ? '0.85rem' : '0.95rem',
                    minWidth: '150px',
                    textAlign: 'right'
                  }}
                >
                  SUBSIDY
                </TableCell>
                <TableCell 
                  sx={{ 
                    backgroundColor: "#1b5e20",
                    color: "white",
                    fontWeight: "bold",
                    fontSize: compactView ? '0.85rem' : '0.95rem',
                    minWidth: '150px',
                    textAlign: 'right'
                  }}
                >
                  TOTAL
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedGroups.map((group) => {
                const groupItems = group.items;
                const hasItems = groupItems.length > 0;
                
                return (
                  <React.Fragment key={group.categoryId}>
                    {/* Show category header if no items yet */}
                    {!hasItems && addingCategoryId !== group.categoryId && (
                      <TableRow>
                        <TableCell 
                          sx={{ 
                            fontWeight: 'bold',
                            fontSize: compactView ? '0.85rem' : '0.95rem',
                            verticalAlign: 'top',
                            borderRight: '2px solid #e0e0e0',
                            backgroundColor: '#ffffff',
                            position: 'sticky',
                            left: 0,
                            zIndex: 2
                          }}
                        >
                          {group.categoryName.toUpperCase()}
                        </TableCell>
                        <TableCell colSpan={8} sx={{ textAlign: 'center', fontStyle: 'italic', color: 'text.secondary' }}>
                          No items yet
                        </TableCell>
                      </TableRow>
                    )}
                    
                    {hasItems && groupItems.map((item, itemIndex) => {
                      const isFirstItemInCategory = itemIndex === 0;
                      const categoryRowSpan = groupItems.length;
                      
                      return (
                        <TableRow
                          key={item._id}
                          id={`capital-outlay-row-${item._id}`}
                          sx={{
                            backgroundColor: itemIndex % 2 === 0 ? "#ffffff" : "#f9f9f9",
                            "&:hover": {
                              backgroundColor: "#e8f5e9",
                            },
                            height: compactView ? '48px' : '60px'
                          }}
                        >
                          {/* TITLE Column - Only show for first item in category */}
                          {isFirstItemInCategory && (
                            <TableCell 
                              rowSpan={categoryRowSpan}
                              sx={{ 
                                fontWeight: 'bold',
                                fontSize: compactView ? '0.85rem' : '0.95rem',
                                verticalAlign: 'top',
                                borderRight: '2px solid #e0e0e0',
                                backgroundColor: '#ffffff',
                                position: 'sticky',
                                left: 0,
                                zIndex: 2
                              }}
                            >
                              {group.categoryName.toUpperCase()}
                            </TableCell>
                          )}
                          
                          {/* Actions Column */}
                          <TableCell sx={{ textAlign: 'center' }}>
                            <Tooltip title="View actions">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={(e) => handleActionsMenuOpen(e, item)}
                              >
                                <MoreVert fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                          
                          {/* Subline Item */}
                          <TableCell>
                            {item.sublineItem || "—"}
                          </TableCell>
                          
                          {/* Accounting Title */}
                          <TableCell>
                            {item.accountingTitle || "—"}
                          </TableCell>
                          
                          {/* UACS Code */}
                          <TableCell sx={{ minWidth: '140px', width: '140px' }}>
                            {item.uacsCode || "—"}
                          </TableCell>
                          
                          {/* Particulars */}
                          <TableCell>
                            <Box>
                              <Typography 
                                variant="body2" 
                                sx={{ 
                                  fontWeight: 'medium',
                                  fontSize: compactView ? '0.8rem' : '0.9rem'
                                }}
                              >
                                {item.particulars && item.particulars.trim() !== "" 
                                  ? item.particulars 
                                  : (capitalOutlayDetails[item._id]?.length > 0 
                                      ? capitalOutlayDetails[item._id].map(d => d.particulars).filter(Boolean).join('; ')
                                      : '—')}
                              </Typography>
                              
                              {/* Show breakdown count if available */}
                              {capitalOutlayDetails[item._id] && capitalOutlayDetails[item._id].length > 0 && (
                                <Chip
                                  label={`${capitalOutlayDetails[item._id].length} items`}
                                  size="small"
                                  color="primary"
                                  variant="outlined"
                                  sx={{ mt: 0.5, height: '20px', fontSize: '0.7rem' }}
                                />
                              )}
                            </Box>
                          </TableCell>
                          
                          {/* Income */}
                          <TableCell align="right">
                            {(() => {
                              const income = parseFloat(item.income || 0);
                              return income > 0 ? formatNumber(income) : "";
                            })()}
                          </TableCell>
                          
                          {/* Subsidy */}
                          <TableCell align="right">
                            {(() => {
                              const subsidy = parseFloat(item.subsidy || 0);
                              return subsidy > 0 ? formatNumber(subsidy) : "";
                            })()}
                          </TableCell>
                          
                          {/* Total */}
                          <TableCell align="right">
                            <Typography fontWeight="bold">
                              {(() => {
                                const income = parseFloat(item.income || 0);
                                const subsidy = parseFloat(item.subsidy || 0);
                                const total = income + subsidy;
                                return total > 0 ? formatNumber(total) : "";
                              })()}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    
                    {/* Add New Item Row (Form) */}
                    {addingCategoryId === group.categoryId && (
                      <TableRow sx={{
                        backgroundColor: '#f0f8f0',
                        borderTop: '2px dashed #4caf50',
                        '& .MuiTableCell-root': {
                          padding: compactView ? '8px' : '12px',
                        }
                      }}>
                        {/* TITLE Column - Show Category Name */}
                        <TableCell 
                          sx={{ 
                            position: 'sticky',
                            left: 0,
                            zIndex: 2,
                            backgroundColor: '#f0f8f0',
                            borderRight: '1px solid rgba(224, 224, 224, 1)',
                            fontWeight: 'bold',
                            verticalAlign: 'middle'
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip 
                              label="NEW" 
                              color="success" 
                              size="small" 
                              sx={{ fontWeight: 'bold', height: '20px' }}
                            />
                            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                              {group.categoryName}
                            </Typography>
                          </Box>
                        </TableCell>

                        {/* Actions Column - Cancel and Status */}
                        <TableCell sx={{ textAlign: 'center', backgroundColor: '#f0f8f0' }}>
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                            <Tooltip title="Cancel">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => {
                                  setAddingCategoryId(null);
                                  setNewOutlays((prev) => ({ ...prev, [group.categoryId]: {} }));
                                  setErrors({});
                                }}
                                sx={{
                                  '&:hover': {
                                    backgroundColor: 'error.lighter',
                                    transform: 'scale(1.1)'
                                  },
                                  transition: 'all 0.2s'
                                }}
                              >
                                <Close fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', fontWeight: 'medium', textAlign: 'center' }}>
                              {!newOutlays[group.categoryId]?.sublineItem 
                                ? "⚠️ Select subline"
                                : !newOutlays[group.categoryId]?.accountingTitle
                                ? "⚠️ Select title"
                                : "✓ Ready"}
                            </Typography>
                          </Box>
                        </TableCell>

                        {/* Subline Item */}
                        <TableCell>
                          <Box>
                            <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'text.secondary', mb: 0.5, display: 'block' }}>
                              Subline Item *
                            </Typography>
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
                              size="small"
                              error={!!errors.sublineItem}
                              displayEmpty
                              sx={{ 
                                backgroundColor: 'white', 
                                minWidth: '150px',
                                '& .MuiOutlinedInput-notchedOutline': {
                                  borderColor: errors.sublineItem ? 'error.main' : 'success.main',
                                  borderWidth: 2
                                }
                              }}
                            >
                              <MenuItem value="" disabled>
                                <em>Select subline item</em>
                              </MenuItem>
                              {(sublineItems[group.categoryName] || []).map((item) => (
                                <MenuItem key={item} value={item}>
                                  {item}
                                </MenuItem>
                              ))}
                            </Select>
                            {errors.sublineItem && <FormHelperText error>{errors.sublineItem}</FormHelperText>}
                          </Box>
                        </TableCell>

                        {/* Accounting Title */}
                        <TableCell>
                          <Box>
                            <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'text.secondary', mb: 0.5, display: 'block' }}>
                              Accounting Title *
                            </Typography>
                            <Select
                              value={newOutlays[group.categoryId]?.accountingTitle || ""}
                              onChange={(e) => {
                                const selectedTitle = e.target.value;
                                const selectedTitleObj = accountingTitles[newOutlays[group.categoryId]?.sublineItem]?.find(
                                  (title) => title.accountingTitle === selectedTitle
                                );
                                
                                handleOutlayChange(group.categoryId, "accountingTitle", selectedTitle);
                                if (selectedTitleObj?.uacsCode) {
                                  handleOutlayChange(group.categoryId, "uacsCode", selectedTitleObj.uacsCode);
                                }
                              }}
                              fullWidth
                              size="small"
                              error={!!errors.accountingTitle}
                              disabled={!newOutlays[group.categoryId]?.sublineItem}
                              displayEmpty
                              sx={{ 
                                backgroundColor: !newOutlays[group.categoryId]?.sublineItem ? '#f5f5f5' : 'white',
                                minWidth: '200px',
                                '& .MuiOutlinedInput-notchedOutline': {
                                  borderColor: errors.accountingTitle ? 'error.main' : 'success.main',
                                  borderWidth: 2
                                }
                              }}
                            >
                              <MenuItem value="" disabled>
                                <em>{!newOutlays[group.categoryId]?.sublineItem ? 'Select subline first' : 'Choose accounting title'}</em>
                              </MenuItem>
                              {(accountingTitles[newOutlays[group.categoryId]?.sublineItem] || []).map((title) => (
                                <MenuItem key={title._id || title.accountingTitle} value={title.accountingTitle}>
                                  {title.accountingTitle}
                                </MenuItem>
                              ))}
                            </Select>
                            {errors.accountingTitle && <FormHelperText error>{errors.accountingTitle}</FormHelperText>}
                          </Box>
                        </TableCell>

                        {/* UACS Code */}
                        <TableCell sx={{ minWidth: '140px', width: '140px' }}>
                          <Box>
                            <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'text.secondary', mb: 0.5, display: 'block' }}>
                              UACS Code
                            </Typography>
                            <TextField
                              value={newOutlays[group.categoryId]?.uacsCode || ""}
                              size="small"
                              disabled
                              sx={{ 
                                backgroundColor: '#f5f5f5',
                                width: '140px',
                                '& .MuiInputBase-input.Mui-disabled': {
                                  WebkitTextFillColor: '#333',
                                  fontWeight: 'medium',
                                  fontSize: '0.875rem'
                                }
                              }}
                              placeholder="Auto-filled"
                            />
                            {errors.uacsCode && <FormHelperText error>{errors.uacsCode}</FormHelperText>}
                          </Box>
                        </TableCell>

                        {/* Particulars, Income, Subsidy, Total - Info message and Save button */}
                        <TableCell colSpan={4}>
                          <Box sx={{ 
                            backgroundColor: '#e3f2fd', 
                            p: 1.5, 
                            borderRadius: 1,
                            border: '2px dashed #2196f3',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 2
                          }}>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="body2" color="primary" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                                💡 Breakdown details will be entered in the next step
                              </Typography>
                              {/* {fiscalYear && (
                                <Typography variant="caption" color="success.main">
                                  ✓ Fiscal Year: {fiscalYear}
                                </Typography>
                              )} */}
                            </Box>
                            <Tooltip title={
                              !fiscalYear
                                ? "⏳ Loading fiscal year settings..."
                                : !newOutlays[group.categoryId]?.sublineItem || !newOutlays[group.categoryId]?.accountingTitle
                                ? "Please complete all required fields first"
                                : "Click to proceed and enter breakdown details"
                            }>
                              <span>
                                <Button
                                  variant="contained"
                                  color="success"
                                  size="medium"
                                  startIcon={!fiscalYear ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <Save />}
                                  onClick={() => {
                                    handleAddOutlay(group.categoryId, group.categoryName);
                                  }}
                                  disabled={!fiscalYear || !newOutlays[group.categoryId]?.sublineItem || !newOutlays[group.categoryId]?.accountingTitle}
                                  sx={{
                                    fontWeight: 'bold',
                                    px: 3,
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {!fiscalYear ? 'Loading...' : 'Continue'}
                                </Button>
                              </span>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    )}
                    
                    {/* Add New Item Button - Compact Icon Style */}
                    {addingCategoryId !== group.categoryId && (
                      <TableRow>
                        <TableCell 
                          colSpan={9} 
                          sx={{ 
                            textAlign: 'center',
                            py: 0.75,
                            borderTop: '1px solid rgba(224, 224, 224, 0.4)',
                            backgroundColor: '#fafafa',
                            position: 'relative'
                          }}
                        >
                          <Tooltip title={`Add new ${group.categoryName} item`} placement="top">
                            <IconButton
                              color="success"
                              size="small"
                              onClick={() => {
                                setAddingCategoryId(group.categoryId);
                                setNewOutlays((prev) => ({
                                  ...prev,
                                  [group.categoryId]: {
                                    category: group.categoryId
                                  },
                                }));
                                setErrors({});
                                // Fetch subline items for this category
                                fetchSublineItems(group.categoryName, true, group.categoryId);
                              }}
                              sx={{
                                backgroundColor: 'success.main',
                                color: 'white',
                                '&:hover': {
                                  backgroundColor: 'success.dark',
                                  transform: 'scale(1.1)'
                                },
                                transition: 'all 0.2s ease-in-out',
                                boxShadow: 1
                              }}
                            >
                              <Add />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
              
              {/* Grand Total Row */}
              {showColumnTotals && filteredData.length > 0 && (
                <TableRow
                  sx={{
                    backgroundColor: "#fff3cd",
                    borderTop: '3px solid #1b5e20',
                    '& .MuiTableCell-root': {
                      fontWeight: 'bold',
                      fontSize: compactView ? '0.9rem' : '1rem',
                      padding: compactView ? '10px 12px' : '16px'
                    }
                  }}
                >
                  <TableCell 
                    colSpan={6}
                    sx={{ 
                      textAlign: 'right',
                      fontSize: compactView ? '1rem' : '1.1rem',
                      position: 'sticky',
                      left: 0,
                      zIndex: 2,
                      backgroundColor: "#fff3cd"
                    }}
                  >
                    TOTAL
                  </TableCell>
                  <TableCell align="right" sx={{ color: '#1b5e20' }}>
                    {formatNumber(calculateTotals.income)}
                  </TableCell>
                  <TableCell align="right" sx={{ color: '#1b5e20' }}>
                    {formatNumber(calculateTotals.subsidy)}
                  </TableCell>
                  <TableCell align="right" sx={{ color: '#1b5e20' }}>
                    {formatNumber(calculateTotals.cost)}
                  </TableCell>
                </TableRow>
              )}
              
              {/* No data message - only show when no categories available OR search has no results */}
              {(filteredData.length === 0 && (categories.length === 0 || searchTerm)) && (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                    <Typography variant="body1" color="text.secondary">
                      {searchTerm ? "No items match your search" : "No categories available. Please configure categories first."}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {groupedTableData.length > 0 && (
          <TablePagination
            component="div"
            count={groupedTableData.length}
            page={rowsPerPage === -1 ? 0 : page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage === -1 ? groupedTableData.length || 1 : rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[10, 25, 50, 100, { label: "All", value: -1 }]}
            labelRowsPerPage="Categories per page"
            labelDisplayedRows={({ from, to, count }) =>
              rowsPerPage === -1
                ? `Showing all ${count} categories`
                : `${from}-${to} of ${count} categories`
            }
            sx={{ mt: 1, borderTop: "1px solid", borderColor: "divider" }}
          />
        )}

        {/* Info Message
        <Alert 
          severity="info" 
          sx={{ 
            mt: 2,
            backgroundColor: '#fff3cd',
            color: '#856404',
            '& .MuiAlert-icon': {
              color: '#856404'
            }
          }}
        >
          <Typography variant="body2">
            <strong>Sa TITLE bali magiging combolist nalang pipiliin yung user kung aling/saan title sya maglalagay tapos kapag existing na yung TITLE na meron ng records na nakikita sa table ay hindi na kasamasa pagpipilian</strong>
          </Typography>
        </Alert> */}
      </Box>

      {/* Actions Menu */}
      <Menu
        anchorEl={actionsMenuAnchor}
        open={Boolean(actionsMenuAnchor)}
        onClose={handleActionsMenuClose}
        PaperProps={{
          sx: { minWidth: 200 }
        }}
      >
        <MenuItem onClick={() => handleOpenDetailsModal(actionsMenuRow)}>
          <Edit fontSize="small" sx={{ mr: 1 }} />
          Edit Details
        </MenuItem>
        <MenuItem 
          onClick={() => handleOpenDetailsModal(actionsMenuRow)}
        >
          <Visibility fontSize="small" sx={{ mr: 1 }} />
          View Breakdown
        </MenuItem>
        <Divider />
        <MenuItem 
          onClick={() => handleDeleteClick(actionsMenuRow?._id)}
          disabled={!canDeleteItems || actionsMenuRow?.status === "Submitted" || actionsMenuRow?.status === "Approved"}
          sx={{ color: 'error.main' }}
        >
          <Delete fontSize="small" sx={{ mr: 1 }} />
          Delete Item
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this capital outlay item? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

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
          budgetType,
        } : null}
      />
    </ErrorBoundary>
  );
};

CapitalOutlayTableEnhanced.propTypes = {
  onDataChange: PropTypes.func,
  disableIncomeInputs: PropTypes.bool,
};

export default CapitalOutlayTableEnhanced;