import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { NumericFormat } from "react-number-format";
import PropTypes from "prop-types";
import api from "../../config/api";
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
  Stack,
  Tooltip,
  Alert,
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
  TextField,
  FormHelperText,
  InputAdornment,
  Backdrop,
  Badge,
  useTheme,
} from "@mui/material";
import {
  Refresh,
  List as ListIcon,
  Visibility,
  VisibilityOff,
  MoreVert,
  TrendingUp,
  AccountBalance,
  Save,
  Edit,
  Delete,
  Search,
  Clear,
  FilterList,
  Keyboard,
  CloudUpload as CloudUploadIcon,
} from "@mui/icons-material";
import PesoIcon from "../icons/PesoIcon";
import { useUser } from "../../context/UserContext";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import CapitalOutlayDetailsModal from "./CapitalOutlayDetailsModal";
import { useCapitalOutlayData } from "./useCapitalOutlayData";
import CapitalOutlayFilters from "./CapitalOutlayFilters";
import { useWorkflowRef } from "../../hooks/useWorkflowRef";
import BulkUploadModal from "../common/BulkUploadModal";

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

const CapitalOutlayTableEnhanced = ({ onDataChange, disableIncomeInputs = false, locked = false }) => {
  const theme = useTheme();
  const headerBg = theme.palette.mode === 'dark' ? '#0b2413' : '#2d5016';
  const { currentUser } = useUser();
  const isSuperAdmin = useMemo(() => {
    return (currentUser?.Roles || []).some((role) =>
      ["SUPER ADMIN", "SUPER_ADMIN", "SUPERADMIN"].includes(
        String(role).toUpperCase()
      )
    );
  }, [currentUser]);
  const { workflowRef, headerConfig } = useWorkflowRef();
  const hasWorkflowRef = Boolean(workflowRef);
  const ensureWorkflowRef = useCallback(() => {
    if (!workflowRef) {
      toast.error("Create a proposal first to modify capital outlay entries.");
      return false;
    }
    return true;
  }, [workflowRef]);
  const modificationsAllowed = hasWorkflowRef && !locked;
  const modificationBlockedReason = useMemo(() => {
    if (!hasWorkflowRef) {
      return "Create a proposal first to add or edit capital outlay entries.";
    }
    if (locked) {
      return "Capital outlay editing is currently locked.";
    }
    return "";
  }, [hasWorkflowRef, locked]);

  // Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilters, setSelectedFilters] = useState(() => ({
    categories: [],
    sublineItems: [],
    amountRange: { min: "", max: "" },
    hasValues: false,
    emptyValues: false,
  }));
  const [showFilters, setShowFilters] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const {
    capitalOutlays,
  categories,
    accountingTitles,
    loading,
    error,
    fiscalYear,
    budgetType,
    status,
    dueDateStatus,
    capitalOutlayDetails,
  setCapitalOutlays,
    setAccountingTitles,
    setCapitalOutlayDetails,
    refreshData,
    handleDetailsSaved,
  } = useCapitalOutlayData(onDataChange);

  // Filter validation
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

  const availableSublineItems = useMemo(() => {
    const items = new Set();
    capitalOutlays.forEach((item) => {
      if (item.sublineItem) {
        items.add(item.sublineItem);
      }
    });
    return Array.from(items).sort((a, b) => a.localeCompare(b));
  }, [capitalOutlays]);

  const canDeleteItems = useMemo(() => {
    return currentUser?.userRoles?.includes('SUPER ADMIN') ||
           currentUser?.userRoles?.includes('BUDGET PLANNING ANALYST');
  }, [currentUser]);

  // Other state
  const [newOutlays, setNewOutlays] = useState({});
  const [errors, setErrors] = useState({});
  const [sublineItems, setSublineItems] = useState({});
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const tableContainerRef = useRef(null);
  const scrollPositionRef = useRef(0);
  const accountingTitleSelectRefs = useRef({});
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Enhanced state management
  const [showColumnTotals, setShowColumnTotals] = useState(true);

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // View state
  const [compactView, setCompactView] = useState(false);
  
  // Modal state for capital outlay details
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedCapitalOutlay, setSelectedCapitalOutlay] = useState(null);
  const [newlyAddedItemId, setNewlyAddedItemId] = useState(null);
  const [openSublineCategoryId, setOpenSublineCategoryId] = useState(null);
  const [openAccountingTitleCategoryId, setOpenAccountingTitleCategoryId] = useState(null);
  const shortcutToastShownRef = useRef(false);
  const shortcutPreferenceKey = useMemo(
    () => `capitalOutlayQuickAddShortcuts:${currentUser?._id || currentUser?.id || "anonymous"}`,
    [currentUser]
  );
  const [keyboardShortcutsEnabled, setKeyboardShortcutsEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = window.localStorage.getItem("capitalOutlayQuickAddShortcuts:anonymous");
    if (stored === null) return true;
    return stored === "1";
  });
    useEffect(() => {
      if (typeof window === "undefined") return;
      const stored = window.localStorage.getItem(shortcutPreferenceKey);
      if (stored === null) {
        setKeyboardShortcutsEnabled(true);
        return;
      }
      setKeyboardShortcutsEnabled(stored === "1");
    }, [shortcutPreferenceKey]);

    useEffect(() => {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(shortcutPreferenceKey, keyboardShortcutsEnabled ? "1" : "0");
    }, [shortcutPreferenceKey, keyboardShortcutsEnabled]);
  
  // Actions menu state
  const [actionsMenuAnchor, setActionsMenuAnchor] = useState(null);
  const [actionsMenuRow, setActionsMenuRow] = useState(null);

  const isSelectedItemIntangibleAssets = useMemo(() => {
    const normalizedText = [
      selectedCapitalOutlay?.accountingTitle,
      selectedCapitalOutlay?.sublineItem,
      selectedCapitalOutlay?.category?.categoryName,
      typeof selectedCapitalOutlay?.category === "string" ? selectedCapitalOutlay?.category : "",
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return (
      normalizedText.includes("intangible") ||
      normalizedText.includes("intagible")
    );
  }, [selectedCapitalOutlay]);

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
      icon: PesoIcon,
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
          return outlayUacs && outlayUacs === normalizedUacs;
        } else {
          const outlayUacs = (outlay.uacsCode || "").trim().toLowerCase();
          return !outlayUacs;
        }
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
  }, [setAccountingTitles]);

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
    if (!modificationsAllowed) {
      toast.error(modificationBlockedReason || "Capital outlay editing is currently locked.");
      return;
    }
    if (!ensureWorkflowRef()) {
      return;
    }
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
  }, [newOutlays, fiscalYear, currentUser, accountingTitles, validateInput, budgetType, categories, modificationsAllowed, modificationBlockedReason, ensureWorkflowRef]);

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

  const resetQuickAddDraft = useCallback((categoryId) => {
    setNewOutlays((prev) => ({
      ...prev,
      [categoryId]: {
        category: categoryId,
      },
    }));
    setErrors({});
    setOpenAccountingTitleCategoryId((current) => (current === categoryId ? null : current));
  }, []);

  const setAccountingTitleSelectRef = useCallback((categoryId, node) => {
    if (!categoryId) return;
    if (node) {
      accountingTitleSelectRefs.current[categoryId] = node;
    } else {
      delete accountingTitleSelectRefs.current[categoryId];
    }
  }, []);

  const focusAccountingTitleField = useCallback((categoryId) => {
    const target = accountingTitleSelectRefs.current[categoryId];
    if (target && typeof target.focus === "function") {
      target.focus();
    }
  }, []);

  const isSubmitShortcut = useCallback((event, allowPlainEnter = false) => {
    const isEnterKey = event.key === "Enter" || event.code === "Enter" || event.keyCode === 13;
    if (!isEnterKey) return false;
    if (event.ctrlKey || event.metaKey) return true;
    return allowPlainEnter && !event.shiftKey && !event.altKey;
  }, []);

  const normalizeTotals = useCallback((data = {}) => {
    const income = parseFloat(data.income ?? data.totalIncome ?? 0) || 0;
    const subsidy = parseFloat(data.subsidy ?? data.totalSubsidy ?? 0) || 0;
    const cost = parseFloat(data.cost ?? data.total ?? income + subsidy) || 0;
    return { income, subsidy, cost };
  }, []);

  const handleDetailsModalSave = async (result) => {
    const totals = normalizeTotals(result);
    const detailsList = Array.isArray(result?.details) ? result.details : [];
    const particularsFromDetails = result?.particulars || detailsList
      .map(detail => detail?.particulars)
      .filter(Boolean)
      .join('; ');

    if (result.isNewItem && result.newItem) {
      const responseItem = result.newItem;
      const categoryId = responseItem?.category?._id || responseItem?.category || selectedCapitalOutlay?.tempCategoryId;
      const matchedCategory = categories.find(cat => {
        const catId = cat._id?.toString() || cat._id;
        return catId === (categoryId?.toString?.() ?? categoryId);
      });

      const resolvedCategory = typeof responseItem?.category === 'object' && responseItem.category !== null
        ? responseItem.category
        : matchedCategory
          ? { _id: matchedCategory._id, categoryName: matchedCategory.categoryName }
          : categoryId
            ? { _id: categoryId, categoryName: "Uncategorized" }
            : null;

      const newItem = {
        ...responseItem,
        status: "Not Submitted",
        income: totals.income,
        subsidy: totals.subsidy,
        cost: totals.cost,
        particulars: responseItem?.particulars?.trim?.() ? responseItem.particulars : particularsFromDetails,
        ...(resolvedCategory ? { category: resolvedCategory } : {}),
      };
      
      const updatedData = [...capitalOutlays, newItem];
      setCapitalOutlays(updatedData);
      
      setCapitalOutlayDetails(prev => ({
        ...prev,
        [newItem._id]: detailsList
      }));
      
      if (selectedCapitalOutlay?.tempCategoryId) {
        const nextCategoryDraft = {
          category: selectedCapitalOutlay.tempCategoryId,
          sublineItem: selectedCapitalOutlay.sublineItem || "",
          accountingTitle: selectedCapitalOutlay.accountingTitle || "",
          uacsCode: selectedCapitalOutlay.uacsCode || "",
        };
        setNewOutlays((prev) => ({
          ...prev,
          [selectedCapitalOutlay.tempCategoryId]: nextCategoryDraft,
        }));
      }
      
      setErrors({});
      onDataChange?.(updatedData);
      setNewlyAddedItemId(newItem._id);

      // Ensure freshly created item reflects saved details/totals without reload
      await handleDetailsSaved(newItem._id, {
        ...totals,
        particulars: newItem.particulars,
      });

      toast.success("Capital outlay item created successfully with breakdown details!");
    } else if (result.capitalOutlayId) {
      if (detailsList.length > 0) {
        setCapitalOutlayDetails(prev => ({
          ...prev,
          [result.capitalOutlayId]: detailsList
        }));
      }
      await handleDetailsSaved(result.capitalOutlayId, totals);
      toast.success("Capital outlay details saved to existing item successfully");
    } else if (selectedCapitalOutlay && selectedCapitalOutlay._id) {
      if (detailsList.length > 0) {
        setCapitalOutlayDetails(prev => ({
          ...prev,
          [selectedCapitalOutlay._id]: detailsList
        }));
      }
      await handleDetailsSaved(selectedCapitalOutlay._id, totals);
      toast.success("Capital outlay details updated successfully");
    }
  };

  const handleDeleteClick = (itemId) => {
    setItemToDelete(itemId);
    setDeleteConfirmOpen(true);
    setActionsMenuAnchor(null);
  };

  const handleConfirmDelete = async () => {
    if (itemToDelete) {
      if (!modificationsAllowed) {
        toast.error(modificationBlockedReason || "Capital outlay editing is currently locked.");
        setDeleteConfirmOpen(false);
        setItemToDelete(null);
        return;
      }
      if (!ensureWorkflowRef()) {
        setDeleteConfirmOpen(false);
        setItemToDelete(null);
        return;
      }
      try {
        await api.delete(`/capital-outlays/${itemToDelete}`, { params: {}, headers: headerConfig() });
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
      setIsRefreshing(true);
      await refreshData();
      toast.success("Data refreshed successfully");
    } catch (error) {
      console.error("Error refreshing data:", error);
      toast.error("Failed to refresh data");
    } finally {
      setIsRefreshing(false);
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
              <span>
                <IconButton
                  color="primary"
                  onClick={handleRefreshData}
                  size="small"
                  disabled={loading || isRefreshing}
                >
                  {isRefreshing ? <CircularProgress size={18} thickness={5} /> : <Refresh />}
                </IconButton>
              </span>
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

            <Tooltip title={keyboardShortcutsEnabled ? "Disable keyboard shortcuts" : "Enable keyboard shortcuts"}>
              <IconButton
                color={keyboardShortcutsEnabled ? "secondary" : "default"}
                onClick={() => setKeyboardShortcutsEnabled((prev) => !prev)}
                size="small"
              >
                <Keyboard />
              </IconButton>
            </Tooltip>

            {isSuperAdmin && (
              <Tooltip title="Bulk import capital outlay data">
                <IconButton
                  color="primary"
                  onClick={() => setShowBulkUpload(true)}
                  size="small"
                >
                  <CloudUploadIcon />
                </IconButton>
              </Tooltip>
            )}
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
        open={(loading || isRefreshing) && capitalOutlays.length > 0}
      >
        <Stack spacing={1} alignItems="center">
          <CircularProgress color="inherit" size={32} thickness={5} />
          <Typography variant="caption">
            {isRefreshing ? "Refreshing capital outlay data…" : "Syncing latest capital outlay data…"}
          </Typography>
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

      {(!hasWorkflowRef || locked) && (
        <Box sx={{ mb: 2, display: "flex", flexDirection: "column", gap: 1 }}>
          {!hasWorkflowRef && (
            <Alert severity="warning">
              Create a proposal first to enable capital outlay editing. Existing entries remain read-only.
            </Alert>
          )}
          {locked && (
            <Alert severity="info">
              Capital outlay entries are currently locked for editing by administrators.
            </Alert>
          )}
        </Box>
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
        <CapitalOutlayFilters
          showFilters={showFilters}
          selectedFilters={selectedFilters}
          onFiltersChange={setSelectedFilters}
          onResetFilters={handleResetFilters}
          categories={categories}
          availableSublineItems={availableSublineItems}
          isAmountRangeInvalid={isAmountRangeInvalid}
        />

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
                    backgroundColor: headerBg,
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
                    backgroundColor: headerBg,
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
                    backgroundColor: headerBg,
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
                    backgroundColor: headerBg,
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
                    backgroundColor: headerBg,
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
                    backgroundColor: headerBg,
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
                    backgroundColor: headerBg,
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
                    backgroundColor: headerBg,
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
                    backgroundColor: headerBg,
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
                const pendingOutlay = newOutlays[group.categoryId] || { category: group.categoryId };
                const continueDisabled =
                  !fiscalYear ||
                  !pendingOutlay?.sublineItem ||
                  !pendingOutlay?.accountingTitle ||
                  !modificationsAllowed;
                const continueTooltip = !modificationsAllowed
                  ? modificationBlockedReason || "Capital outlay editing is currently locked."
                  : !fiscalYear
                    ? "⏳ Loading fiscal year settings..."
                    : !pendingOutlay?.sublineItem || !pendingOutlay?.accountingTitle
                      ? "Please complete all required fields first"
                      : "Open breakdown details and save the new item";
                
                return (
                  <React.Fragment key={group.categoryId}>
                    {/* Show category header if no items yet */}
                    {!hasItems && (
                      <TableRow>
                        <TableCell 
                          sx={{ 
                            fontWeight: 'bold',
                            fontSize: compactView ? '0.85rem' : '0.95rem',
                            verticalAlign: 'middle',
                            borderRight: '2px solid #e0e0e0',
                            backgroundColor: '#ffffff',
                            position: 'sticky',
                            left: 0,
                            zIndex: 2,
                            textAlign: 'left'
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
                                verticalAlign: 'middle',
                                borderRight: '2px solid #e0e0e0',
                                backgroundColor: '#ffffff',
                                position: 'sticky',
                                left: 0,
                                zIndex: 2,
                                textAlign: 'center'
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
                    
                    {/* Quick Add New Item Row (Always Visible) */}
                    {modificationsAllowed && (
                      <TableRow
                        onKeyDownCapture={(event) => {
                          if (!keyboardShortcutsEnabled) return;
                          const allowPlainEnter = !openSublineCategoryId && !openAccountingTitleCategoryId;
                          if (!isSubmitShortcut(event, allowPlainEnter)) return;
                          if (continueDisabled) return;
                          event.preventDefault();
                          handleAddOutlay(group.categoryId, group.categoryName);
                          if (!shortcutToastShownRef.current) {
                            shortcutToastShownRef.current = true;
                            toast.info("Shortcut used: Add Breakdown", { autoClose: 1200 });
                          }
                        }}
                        sx={{
                          backgroundColor: '#f0f8f0',
                          borderTop: '2px dashed #4caf50',
                          '& .MuiTableCell-root': {
                            padding: compactView ? '8px' : '12px',
                          }
                        }}
                      >
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
                              label="QUICK ADD" 
                              color="success" 
                              size="small" 
                              sx={{ fontWeight: 'bold', height: '20px' }}
                            />
                            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                              {group.categoryName}
                            </Typography>
                          </Box>
                        </TableCell>

                        {/* Actions Column - Status */}
                        <TableCell sx={{ textAlign: 'center', backgroundColor: '#f0f8f0' }}>
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
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
                              onOpen={() => {
                                setOpenSublineCategoryId(group.categoryId);
                                if (!sublineItems[group.categoryName]?.length) {
                                  fetchSublineItems(group.categoryName, true, group.categoryId);
                                }
                              }}
                              onClose={() => {
                                setOpenSublineCategoryId((current) => (current === group.categoryId ? null : current));
                              }}
                              onKeyDown={(event) => {
                                if (!keyboardShortcutsEnabled) return;
                                if (event.key === "Escape") {
                                  event.preventDefault();
                                  resetQuickAddDraft(group.categoryId);
                                  return;
                                }
                              }}
                              onChange={(e) => {
                                const selectedSublineItem = e.target.value;
                                handleOutlayChange(group.categoryId, "sublineItem", selectedSublineItem);
                                if (selectedSublineItem) {
                                  fetchAccountingTitles(selectedSublineItem);
                                  setTimeout(() => {
                                    focusAccountingTitleField(group.categoryId);
                                    setOpenAccountingTitleCategoryId(group.categoryId);
                                  }, 0);
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
                              inputRef={(node) => setAccountingTitleSelectRef(group.categoryId, node)}
                              open={openAccountingTitleCategoryId === group.categoryId}
                              value={newOutlays[group.categoryId]?.accountingTitle || ""}
                              onOpen={() => {
                                const selectedSubline = newOutlays[group.categoryId]?.sublineItem;
                                if (selectedSubline && !(accountingTitles[selectedSubline] || []).length) {
                                  fetchAccountingTitles(selectedSubline);
                                }
                                if (selectedSubline) {
                                  setOpenAccountingTitleCategoryId(group.categoryId);
                                }
                              }}
                              onClose={() => {
                                setOpenAccountingTitleCategoryId((current) => (current === group.categoryId ? null : current));
                              }}
                              onKeyDown={(event) => {
                                if (!keyboardShortcutsEnabled) return;
                                if (event.key === "Escape") {
                                  event.preventDefault();
                                  resetQuickAddDraft(group.categoryId);
                                  return;
                                }
                              }}
                              onChange={(e) => {
                                const selectedTitle = e.target.value;
                                const selectedTitleObj = accountingTitles[newOutlays[group.categoryId]?.sublineItem]?.find(
                                  (title) => title.accountingTitle === selectedTitle
                                );
                                
                                handleOutlayChange(group.categoryId, "accountingTitle", selectedTitle);
                                if (selectedTitleObj?.uacsCode) {
                                  handleOutlayChange(group.categoryId, "uacsCode", selectedTitleObj.uacsCode);
                                }
                                setOpenAccountingTitleCategoryId((current) => (current === group.categoryId ? null : current));
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
                              <Typography variant="caption" color="text.secondary">
                                Shortcuts: Enter/Ctrl + Enter to continue, Esc to clear fields
                              </Typography>
                              {/* {fiscalYear && (
                                <Typography variant="caption" color="success.main">
                                  ✓ Fiscal Year: {fiscalYear}
                                </Typography>
                              )} */}
                            </Box>
                            <Tooltip title={continueTooltip}>
                              <span>
                                <Button
                                  variant="contained"
                                  color="success"
                                  size="medium"
                                  startIcon={!fiscalYear ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <Save />}
                                  onClick={() => {
                                    handleAddOutlay(group.categoryId, group.categoryName);
                                  }}
                                  disabled={continueDisabled}
                                  sx={{
                                    fontWeight: 'bold',
                                    px: 3,
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {!fiscalYear ? 'Loading...' : 'Add Breakdown'}
                                </Button>
                              </span>
                            </Tooltip>
                          </Box>
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
        <MenuItem
          onClick={() => handleOpenDetailsModal(actionsMenuRow)}
          disabled={!modificationsAllowed}
        >
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
          disabled={!canDeleteItems || actionsMenuRow?.status === "Finalized" || !modificationsAllowed}
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
        isIntangibleAssets={isSelectedItemIntangibleAssets}
        onSave={handleDetailsModalSave}
        temporaryItem={selectedCapitalOutlay?.isTemporary ? {
          ...selectedCapitalOutlay,
          fiscalYear,
          budgetType,
        } : null}
        editingDisabled={!modificationsAllowed}
        editingDisabledReason={modificationBlockedReason}
      />

      <BulkUploadModal
        open={showBulkUpload}
        onClose={() => setShowBulkUpload(false)}
        tableType="capitalOutlay"
        onUploadSuccess={() => {
          setShowBulkUpload(false);
          refreshData();
        }}
      />
    </ErrorBoundary>
  );
};

CapitalOutlayTableEnhanced.propTypes = {
  onDataChange: PropTypes.func,
  disableIncomeInputs: PropTypes.bool,
};

export default CapitalOutlayTableEnhanced;