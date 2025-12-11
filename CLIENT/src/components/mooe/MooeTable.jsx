import React, { useCallback, useMemo, useState, useEffect } from "react";
import { shouldHideGenericOtherUacs, getIndentLevelFromSubline } from '../../utils/uacsDisplayHelper';
import { useRegion } from "../../context/RegionContext";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableFooter,
  Paper,
  Box,
  CircularProgress,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  Switch,
  FormControlLabel,
  Tooltip,
  Menu,
  MenuItem,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  FormGroup,
  Divider,
  Alert,
  Zoom,
  Fade,
  FormControl,
  InputLabel,
  Select,
} from "@mui/material";
import { ToastContainer, toast } from "react-toastify";
import { debounce } from "lodash";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import StickyButtons from "./StickyButtons";

import api from "../../config/api";
import { useUser } from "../../context/UserContext";
import "react-toastify/dist/ReactToastify.css";
import { NumericFormat } from "react-number-format";
import { useWorkflowRef } from "../../hooks/useWorkflowRef";

// Custom component for numeric input formatting - memoized for performance
const NumberFormatCustom = React.memo(React.forwardRef(function NumberFormatCustom(props, ref) {
  const { onChange, ...other } = props;

  // Memoize the onValueChange callback to prevent unnecessary re-renders
  const handleValueChange = React.useCallback((values, sourceInfo) => {
    
    // Only trigger onChange if the source is not 'prop' to prevent infinite loops
    if (sourceInfo.source !== 'prop') {
      // Use the raw value to prevent formatting issues
      // Handle empty values properly
      let numericValue;
      
      if (values.value === undefined || values.value === "" || values.value === null) {
        numericValue = "";
      } else {
        numericValue = values.value;
      }

      onChange({
        target: {
          value: numericValue,
        },
      });
    }
  }, [onChange]);

  return (
    <NumericFormat
      {...other}
      getInputRef={ref}
      thousandSeparator
      decimalScale={2}
      fixedDecimalScale={false} // Don't force decimal places
      allowNegative={false} // Prevent negative values
      onValueChange={handleValueChange}
    />
  );
}));
// Import icons
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import GetAppIcon from "@mui/icons-material/GetApp";
import SaveIcon from "@mui/icons-material/Save";
import ClearIcon from "@mui/icons-material/Clear";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import EditIcon from "@mui/icons-material/Edit";
import VisibilityIcon from "@mui/icons-material/Visibility";
import BarChartIcon from "@mui/icons-material/BarChart";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";

const Mooe = ({ onDataChange, locked = false, proposalId = null, region = null, fiscalYear = null }) => {  // ADDED: Accept region, proposalId, fiscalYear from parent
  const { currentUser } = useUser();
  const contextRegion = useRegion(); // Get the active region from context
  const activeRegion = region || contextRegion.activeRegion; // ADDED: Use prop first, then context
  const queryClient = useQueryClient();
  const [expandedRows, setExpandedRows] = useState([]);
  const [disableIncomeInputs, setDisableIncomeInputs] = useState(false);
  const { workflowRef, headerConfig } = useWorkflowRef();
  const effectiveProposalId = proposalId || workflowRef;  // ADDED: Use prop first, then hook
  const hasWorkflowRef = Boolean(effectiveProposalId);

  // Debug user and region loading
  useEffect(() => {
  }, [currentUser, activeRegion]);

  // Add global error handler
  useEffect(() => {
    const handleError = (event) => {
      console.error("🚨 Global error caught:", event.error);
      console.error("🚨 Error message:", event.message);
      console.error("🚨 Error stack:", event.error?.stack);
    };

    const handleUnhandledRejection = (event) => {
      console.error("🚨 Unhandled promise rejection:", event.reason);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Enhanced state management
  const [searchTerm, setSearchTerm] = useState("");
  const [filterAnchorEl, setFilterAnchorEl] = useState(null);
  const [selectedFilters, setSelectedFilters] = useState({
    sublineItems: [],
    amountRange: { min: "", max: "" },
    hasValues: false,
    emptyValues: false
  });
  const [autoSave, setAutoSave] = useState(false); // Auto-save disabled - use SAVE button instead
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [selectedRows, setSelectedRows] = useState([]);
  const [viewMode, setViewMode] = useState("table"); // table, chart, summary, consolidated
  const [showMiniCharts, setShowMiniCharts] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [autoSaveTimer, setAutoSaveTimer] = useState(null);
  // Local draft inputs to prevent value resets while typing
  const [draftInputs, setDraftInputs] = useState({}); // { [childId]: { income?: string, subsidy?: string } }
  // Helper to read effective field value preferring draft while typing
  const getEffectiveField = React.useCallback((child, field) => {
    const v = draftInputs[child.id]?.[field];
    return v !== undefined ? v : child[field];
  }, [draftInputs]);

  const parseCurrency = useCallback((value) => {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === 'string') {
      const cleaned = value.replace(/,/g, '').trim();
      if (!cleaned) {
        return 0;
      }
      const parsed = Number(cleaned);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }, []);

  // Fetch data using React Query
  const { data, isLoading, error } = useQuery({
    queryKey: ["mooeData", activeRegion?.name], // Add region ID to query key to refetch when region changes
    queryFn: async () => {
      try {
        // Add region parameter to the API request
        const params = activeRegion?.id ? { region: activeRegion.name } : {};
        const response = await api.get("/mooe-data", {
          params,
          withCredentials: true
        });

        // Validate response structure
        if (!response.data) {
          throw new Error("No data received from server");
        }

        const { entries, status, settings } = response.data;

        // Validate entries array
        if (!Array.isArray(entries)) {
          console.warn("Entries is not an array, using empty array");
          return {
            formattedData: [],
            status: status || "Draft",
            fiscalYear: settings?.fiscalYear || "",
            budgetType: settings?.budgetType || "",
          };
        }

        const formatted = formatData(entries);

        return {
          formattedData: formatted,
          status: status || "Draft",
          fiscalYear: settings?.fiscalYear || "",
          budgetType: settings?.budgetType || "",
        };
      } catch (err) {
        console.error("Error in MOOE data query:", err);
        // Re-throw to trigger onError
        throw err;
      }
    },
    onError: (err) => {
      console.error("Error fetching MOOE data:", err);
      const errorMessage = err.response?.data?.message || err.message || "Failed to load data";
      toast.error(`Failed to load MOOE data: ${errorMessage}`);
    },
    // Add retry logic
    retry: (failureCount, error) => {
      // Don't retry on 4xx errors (client errors)
      if (error.response?.status >= 400 && error.response?.status < 500) {
        return false;
      }
      // Retry up to 3 times for other errors
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });

  // Fetch consolidated data for consolidated view mode
  const { data: consolidatedData, isLoading: consolidatedLoading } = useQuery({
    queryKey: ["consolidatedData", activeRegion?.name],
    queryFn: async () => {
      try {
        // Fetch both MOOE and Corporate Income data
        const [mooeResponse, incomeResponse] = await Promise.all([
          api.get("/mooe-data", {
            params: activeRegion?.id ? { region: activeRegion.name } : {},
            withCredentials: true
          }),
          api.get("/income", {
            params: activeRegion?.id ? { region: activeRegion.name } : {},
            withCredentials: true
          })
        ]);

        const mooeEntries = mooeResponse.data?.entries || [];
        const incomeItems = incomeResponse.data || [];

        // Combine and format data
        const combined = [];
        
        // Add MOOE data
        mooeEntries.forEach(entry => {
          combined.push({
            ...entry,
            dataType: 'MOOE',
            category: entry.sublineItem,
            source: 'Maintenance and Other Operating Expenses'
          });
        });

        // Add Corporate Income data
        incomeItems.forEach(item => {
          combined.push({
            ...item,
            dataType: 'Corporate Income',
            category: item.category?.name || 'Uncategorized',
            source: 'Corporate Income',
            accountingTitle: item.name,
            uacsCode: item.particulars,
            income: item.amount || 0,
            subsidy: 0,
            amount: item.amount || 0
          });
        });

        // Group by data type and category
        const grouped = {};
        combined.forEach((item, idx) => {
          const key = `${item.dataType}-${item.category}`;
          if (!grouped[key]) {
            grouped[key] = {
              id: key,
              dataType: item.dataType,
              sublineItem: `${item.dataType}: ${item.category}`,
              category: item.category,
              source: item.source,
              children: [],
            };
          }
          grouped[key].children.push({
            ...item,
            id: `${key}-${idx}`,
          });
        });

        return Object.values(grouped);
      } catch (err) {
        console.error("Error fetching consolidated data:", err);
        throw err;
      }
    },
    enabled: viewMode === "consolidated",
    onError: (err) => {
      console.error("Error fetching consolidated data:", err);
      toast.error("Failed to load consolidated data");
    },
  });

  const cosRegionName = activeRegion?.name || activeRegion?.regionName || 'Central Office';

  const { data: cosGrandTotalData } = useQuery({
    queryKey: [
      'cosGrandTotal',
      cosRegionName,
      currentUser?.hierarchicalAccess?.scope,
      currentUser?.hierarchicalAccess?.accessibleDepartments?.[0]?.departmentName,
      currentUser?.hierarchicalAccess?.accessibleDivisions?.[0]
    ],
    queryFn: async () => {
      const response = await api.get('/grandtotalCOS', {
        params: { region: cosRegionName },
        withCredentials: true
      });
      return response.data;
    },
    enabled: Boolean(cosRegionName && currentUser),
    staleTime: 60000,
    refetchInterval: 60000,
    onError: (err) => {
      console.error('Error fetching COS grand total:', err);
    }
  });

  const cosGrandTotal = useMemo(() => {
    const rawTotal = cosGrandTotalData?.grandTotal;
    if (rawTotal === undefined || rawTotal === null) return null;
    if (typeof rawTotal === 'number') {
      return Number.isFinite(rawTotal) ? rawTotal : null;
    }
    const numeric = Number(String(rawTotal).replace(/,/g, ''));
    return Number.isFinite(numeric) ? numeric : null;
  }, [cosGrandTotalData]);
  
  // Memoize formatData function to prevent unnecessary recalculations
  const formatData = useCallback((rawData) => {
    if (!Array.isArray(rawData) || rawData.length === 0) {
      return [];
    }

    // First, group by sublineItem for main categories
    const grouped = {};
    const parentEntries = [];
    const childEntries = [];

    // Separate parent and child entries
    for (let idx = 0; idx < rawData.length; idx++) {
      const item = rawData[idx];
      if (item.sublineItem) {
        // This is a parent entry
        parentEntries.push(item);
      } else {
        // This might be a child entry
        childEntries.push(item);
      }
    }

    // Group parent entries by sublineItem
    for (const item of parentEntries) {
      const key = item.sublineItem;
      if (!grouped[key]) {
        grouped[key] = {
          id: key,
          sublineItem: item.sublineItem,
          children: [],
        };
      }
      grouped[key].children.push({
        ...item,
        // Use stable ID based on data content, not timestamp/random
        id: item._id || `${key}-${item.uacsCode || "none"}`,
      });
    }

    // Now handle child entries - check if they belong to a parent
    for (const child of childEntries) {
      let foundParent = false;

      // Check if this child belongs to a parent based on UACS code pattern
      for (const parent of parentEntries) {
        if (parent.uacsCode && child.uacsCode && child.uacsCode.startsWith(parent.uacsCode + '-')) {
          // This child belongs to this parent
          const key = parent.sublineItem;
          if (grouped[key]) {
            grouped[key].children.push({
              ...child,
              // Use stable ID based on data content, not timestamp/random
              id: child._id || `${key}-${child.uacsCode || "none"}`,
            });
            foundParent = true;
            break;
          }
        }
      }

      // If no parent found, create a new group or add to unknown
      if (!foundParent) {
        const key = child.sublineItem || `unknown-${child.uacsCode || "other"}`;
        if (!grouped[key]) {
          grouped[key] = {
            id: key,
            sublineItem: child.sublineItem || "Other",
            children: [],
          };
        }
        grouped[key].children.push({
          ...child,
          // Use stable ID based on data content, not timestamp/random
          id: child._id || `${key}-${child.uacsCode || "none"}`,
        });
      }
    }

    return Object.values(grouped);
  }, []);  // Calculate grand totals including IAs O&M Cost
  // Calculate grand totals for REGULAR MOOE ONLY (exclude IAs O&M Cost)
  const grandTotals = useMemo(() => {
    if (!data?.formattedData) return {
      income: 0,
      subsidy: 0,
      total: 0
    };
    let income = 0;
    let subsidy = 0;
    data.formattedData.forEach(row => {
      if (row.sublineItem !== "Irrigators' Associations (IAs) Operation & Maintenance Cost") {
        row.children.forEach(child => {
          income += parseFloat(child.income || 0);
          subsidy += parseFloat(child.subsidy || 0);
        });
      }
    });
    return {
      income,
      subsidy,
      total: income + subsidy
    };
  }, [data?.formattedData]);

  // Calculate IAs O&M Cost totals
  const iasTotals = useMemo(() => {
    if (!data?.formattedData) return { income: 0, subsidy: 0, total: 0 };
    let income = 0;
    let subsidy = 0;
    data.formattedData.forEach(row => {
      if (row.sublineItem === "Irrigators' Associations (IAs) Operation & Maintenance Cost") {
        row.children.forEach(child => {
          income += parseFloat(child.income || 0);
          subsidy += parseFloat(child.subsidy || 0);
        });
      }
    });
    return { income, subsidy, total: income + subsidy };
  }, [data?.formattedData]);

  // Keep all rows collapsed by default for better performance
  // Removed auto-expand functionality to improve loading speed

  // Calculate total function (moved up to avoid hoisting issues)
  const calculateTotal = useCallback((children) => {
    return children.reduce((sum, child) => {
      const income = parseFloat(child.income || 0);
      const subsidy = parseFloat(child.subsidy || 0);
      return sum + income + subsidy;
    }, 0);
  }, []);

  // Enhanced filtering logic
  const filteredData = useMemo(() => {
    if (!data?.formattedData) return [];

    return data.formattedData.filter(row => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSubline = row.sublineItem?.toLowerCase().includes(searchLower);
        const matchesChildren = row.children.some(child =>
          child.accountingTitle?.toLowerCase().includes(searchLower) ||
          child.uacsCode?.toLowerCase().includes(searchLower)
        );
        if (!matchesSubline && !matchesChildren) return false;
      }

      // Subline item filter
      if (selectedFilters.sublineItems.length > 0) {
        if (!selectedFilters.sublineItems.includes(row.sublineItem)) return false;
      }

      // Amount range filter
      if (selectedFilters.amountRange.min || selectedFilters.amountRange.max) {
        const totalAmount = calculateTotal(row.children);
        const min = parseFloat(selectedFilters.amountRange.min) || 0;
        const max = parseFloat(selectedFilters.amountRange.max) || Infinity;
        if (totalAmount < min || totalAmount > max) return false;
      }

      // Has values filter
      if (selectedFilters.hasValues) {
        const hasValues = row.children.some(child =>
          parseFloat(child.income || 0) > 0 || parseFloat(child.subsidy || 0) > 0
        );
        if (!hasValues) return false;
      }

      // Empty values filter
      if (selectedFilters.emptyValues) {
        const hasValues = row.children.some(child =>
          parseFloat(child.income || 0) > 0 || parseFloat(child.subsidy || 0) > 0
        );
        if (hasValues) return false;
      }

      return true;
    });
  }, [data?.formattedData, searchTerm, selectedFilters, calculateTotal]);

  // Auto-save functionality - moved after handleSave definition
  // This will be handled by the handleSave function itself
  
  // Enhanced data refetch logic when region changes
  useEffect(() => {
    if (activeRegion?.name) {

      // Reset local state to prevent stale data
      setHasUnsavedChanges(false);
      setValidationErrors({});
      setExpandedRows([]);

      // Invalidate and refetch queries with new region
      queryClient.invalidateQueries(["mooeData", activeRegion.name]).then(() => {
      }).catch((error) => {
        console.error("Error during data refetch:", error);
        toast.error("Failed to load data for the selected region");
      });
    }
  }, [activeRegion?.id, queryClient]);

  // Track unsaved changes
  const trackChanges = useCallback(() => {
    setHasUnsavedChanges(true);
  }, []);

  useEffect(() => {
    if (!data?.formattedData) return;
    if (cosGrandTotal === null) return;

    const subsidyString = cosGrandTotal.toFixed(2);

    const adjustData = (original) => {
      if (!original?.formattedData) return { next: null, childIds: [] };

      let changed = false;
      const childIds = [];

      const updatedFormattedData = original.formattedData.map(row => {
        let rowChanged = false;

        const updatedChildren = row.children.map(child => {
          if (child.uacsCode === '5-02-99-990-3') {
            const currentSubsidy = parseCurrency(child.subsidy);
            if (Math.abs(currentSubsidy - cosGrandTotal) > 0.009) {
              rowChanged = true;
              changed = true;
              childIds.push(child.id);
              const incomeValue = parseCurrency(child.income);
              const amountValue = incomeValue + cosGrandTotal;

              return {
                ...child,
                subsidy: subsidyString,
                amount: amountValue.toFixed(2)
              };
            }
          }
          return child;
        });

        return rowChanged ? { ...row, children: updatedChildren } : row;
      });

      if (!changed) {
        return { next: null, childIds: [] };
      }

      return {
        next: { ...original, formattedData: updatedFormattedData },
        childIds
      };
    };

    const targetKeys = [
      ["mooeData", activeRegion?.name],
      ["mooeData"]
    ];

    let updateOccurred = false;
    const touchedChildIds = new Set();

    targetKeys.forEach((key) => {
      const cached = queryClient.getQueryData(key);
      if (!cached) return;

      const { next, childIds } = adjustData(cached);
      if (next) {
        queryClient.setQueryData(key, next);
        childIds.forEach((id) => touchedChildIds.add(id));
        updateOccurred = true;
      }
    });

    if (updateOccurred) {
      if (touchedChildIds.size > 0) {
        setDraftInputs((prev) => {
          if (!prev || Object.keys(prev).length === 0) return prev;
          const nextDrafts = { ...prev };
          touchedChildIds.forEach((id) => {
            if (!(id in nextDrafts)) return;
            const entry = nextDrafts[id];
            if (entry && entry.income !== undefined) {
              nextDrafts[id] = { income: entry.income };
            } else {
              delete nextDrafts[id];
            }
          });
          return nextDrafts;
        });
      }
      trackChanges();
    }
  }, [cosGrandTotal, data?.formattedData, activeRegion?.name, parseCurrency, queryClient, trackChanges]);

  const toggleExpandRow = useCallback((rowId) => {
    setExpandedRows(prev => 
      prev.includes(rowId) 
        ? prev.filter(id => id !== rowId)
        : [...prev, rowId]
    );
  }, []);

  const handleAmountChange = useCallback((rowId, childId, value) => {
    // Validate input
    const numValue = parseFloat(value) || 0;
    if (numValue < 0) {
      setValidationErrors(prev => ({
        ...prev,
        [`${rowId}-${childId}-amount`]: "Amount cannot be negative"
      }));
      return;
    } else {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[`${rowId}-${childId}-amount`];
        return newErrors;
      });
    }

    queryClient.setQueryData(["mooeData"], (old) => {
      if (!old) return old;

      return {
        ...old,
        formattedData: old.formattedData.map(row => {
          if (row.id !== rowId) return row;

          return {
            ...row,
            children: row.children.map(child =>
              child.id === childId ? { ...child, amount: value } : child
            )
          };
        })
      };
    });

    // Clear draft once debounced update is applied to data cache
    setDraftInputs(prev => {
      const next = { ...prev };
      if (next[childId]) {
        // if neither income nor subsidy draft remains, remove entry
        if (!next[childId].income && !next[childId].subsidy) delete next[childId];
      }
      return next;
    });

    trackChanges();
  }, [queryClient, trackChanges]);

  const handleIncomeChange = useCallback(debounce((childId, value) => {

    // If income inputs are disabled, don't allow changes
    if (disableIncomeInputs) {
      toast.warning("Income fields are locked because the total matches the Corporate Income projection. To make changes, adjust the Corporate Income first.");
      return;
    }

    // Parse childId to get rowId - childId format is "{sublineItem}-{uacsCode}-{index}"
    // We need to find the row that contains this child
    const parts = childId.split('-');
    const rowId = parts[0]; // First part is the sublineItem which is used as rowId

    // Don't convert empty string to 0 - preserve the actual input
    const stringValue = value === "" ? "" : value.toString().trim();
    const numValue = parseFloat(stringValue);

    // Debug: Check current data structure
    const queryKey = ["mooeData", activeRegion?.name];
    const currentData = queryClient.getQueryData(queryKey);

    // Enhanced validation with better error messages
    if (stringValue !== "") {
      if (isNaN(numValue)) {
        setValidationErrors(prev => ({
          ...prev,
          [`${childId}-income`]: "Please enter a valid number for income"
        }));
        return;
      }

      if (numValue < 0) {
        setValidationErrors(prev => ({
          ...prev,
          [`${childId}-income`]: "Income cannot be negative"
        }));
        return;
      }

      // Check for extremely large values
      if (numValue > 999999999999) {
        setValidationErrors(prev => ({
          ...prev,
          [`${childId}-income`]: "Income value is too large"
        }));
        return;
      }
    }

    // Clear validation errors if value is valid
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[`${childId}-income`];
      return newErrors;
    });

    queryClient.setQueryData(queryKey, (old) => {

      if (!old) {
        return old;
      }

      const updatedData = {
        ...old,
        formattedData: old.formattedData.map(row => {
          
          if (row.id !== rowId) return row;

          return {
            ...row,
            children: row.children.map(child => {
              
              if (child.id === childId) {
                const newIncome = stringValue; // Keep the actual string value, don't convert empty to "0"
                const newAmount = (parseFloat(stringValue || 0) + parseFloat(child.subsidy || 0)).toString();

                const updatedChild = {
                  ...child,
                  income: newIncome,
                  // Auto-compute amount when income changes
                  amount: newAmount
                };

                return updatedChild;
              }
              return child;
            })
          };
        })
      };

      return updatedData;
    });

    trackChanges();
    setHasUnsavedChanges(true);
  }, 300), [disableIncomeInputs, queryClient, trackChanges, activeRegion?.name]);

  const handleSubsidyChange = useCallback(debounce((childId, value) => {

    // Parse childId to get rowId - childId format is "{sublineItem}-{uacsCode}-{index}"
    // We need to find the row that contains this child
    const parts = childId.split('-');
    const rowId = parts[0]; // First part is the sublineItem which is used as rowId

    // Don't convert empty string to 0 - preserve the actual input
    const stringValue = value === "" ? "" : value.toString().trim();
    const numValue = parseFloat(stringValue);

    // Debug: Check current data structure
    const queryKey = ["mooeData", activeRegion?.name];
    const currentData = queryClient.getQueryData(queryKey);

    // Enhanced validation with better error messages
    if (stringValue !== "") {
      if (isNaN(numValue)) {
        setValidationErrors(prev => ({
          ...prev,
          [`${childId}-subsidy`]: "Please enter a valid number for subsidy"
        }));
        return;
      }

      if (numValue < 0) {
        setValidationErrors(prev => ({
          ...prev,
          [`${childId}-subsidy`]: "Subsidy cannot be negative"
        }));
        return;
      }

      // Check for extremely large values
      if (numValue > 999999999999) {
        setValidationErrors(prev => ({
          ...prev,
          [`${childId}-subsidy`]: "Subsidy value is too large"
        }));
        return;
      }
    }

    // Clear validation errors if value is valid
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[`${childId}-subsidy`];
      return newErrors;
    });

    queryClient.setQueryData(queryKey, (old) => {
      if (!old) return old;

      return {
        ...old,
        formattedData: old.formattedData.map(row => {
          if (row.id !== rowId) return row;

          return {
            ...row,
            children: row.children.map(child => {
              if (child.id === childId) {
                const newSubsidy = stringValue; // Keep the actual string value, don't convert empty to "0"
                const newAmount = (parseFloat(child.income || 0) + parseFloat(stringValue || 0)).toString();

                return {
                  ...child,
                  subsidy: newSubsidy,
                  // Auto-compute amount when subsidy changes
                  amount: newAmount
                };
              }
              return child;
            })
          };
        })
      };
    });

    trackChanges();
    setHasUnsavedChanges(true);
  }, 300), [queryClient, trackChanges, activeRegion?.name]);

  const handleTitleChange = useCallback((rowId, childId, value) => {
    queryClient.setQueryData(["mooeData"], (old) => {
      if (!old) return old;
      
      return {
        ...old,
        formattedData: old.formattedData.map(row => {
          if (row.id !== rowId) return row;
          
          return {
            ...row,
            children: row.children.map(child => 
              child.id === childId ? { ...child, accountingTitle: value } : child
            )
          };
        })
      };
    });
  }, [queryClient]);
  
  // Handlers for IAs O&M Cost input fields
  const addCustomMOOE = useCallback((rowId) => {
    queryClient.setQueryData(["mooeData"], (old) => {
      if (!old) return old;
      
      return {
        ...old,
        formattedData: old.formattedData.map(row => {
          if (row.id !== rowId) return row;
          
          // Find the Other MOOE category to get its details
          const otherMooeItem = row.children.find(child => child.uacsCode && child.uacsCode.startsWith("5-02-99-990"));
          
          if (!otherMooeItem) return row;
          
          return {
            ...row,
            children: [
              ...row.children,
              {
                id: `${rowId}-custom-${Date.now()}`,
                accountingTitle: "Custom MOOE",
                uacsCode: "5-02-99-990",
                amount: "0",
                income: "0",
                subsidy: "0",
                custom: true,
                sublineItem: row.sublineItem
              }
            ]
          };
        })
      };
    });
  }, [queryClient]);

  // Add saveMutation for saving MOOE data
  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      try {
        // Use the same API instance and endpoint as data loading, but POST
  const response = await api.post('/mooe-data', payload, { withCredentials: true, headers: headerConfig() });
        if (!response.data) {
          throw new Error('No response data from server');
        }
        // Return the response even if it contains warnings (partial success is still success)
        return response.data;
      } catch (error) {
        // Axios throws on 4xx/5xx status codes, but data is often already saved
        // Re-throw with full error details for onError handler
        throw error;
      }
    },
  });

  const handleSave = (isAutoSave = false) => {

    if (!workflowRef) {
      if (!isAutoSave) {
        toast.error("Create a proposal in the workflow tab before saving MOOE entries.");
      }
      return;
    }

    // Enhanced validation checks
    if (!data?.formattedData) {
      if (!isAutoSave) {
        toast.warning("No data available to save.");
      }
      return;
    }

    // Check if currentUser is available
    if (!currentUser) {
      console.error("currentUser is not available");
      if (!isAutoSave) {
        toast.error("User information not available. Please refresh the page and try again.");
      }
      return;
    }

    // Check for validation errors with detailed feedback
    if (Object.keys(validationErrors).length > 0) {
      if (!isAutoSave) {
        const errorCount = Object.keys(validationErrors).length;
        const firstError = Object.values(validationErrors)[0];
        toast.error(`Please fix ${errorCount} validation error${errorCount > 1 ? 's' : ''} before saving. First error: ${firstError}`);
      }
      return;
    }

    // Check if activeRegion is available
    // For SUPER_ADMIN: region might be passed as prop without activeRegion selected in context
    // Handle activeRegion as string (legacy) or object with id/name properties
    const hasValidRegion = activeRegion && (
      activeRegion?.id || 
      activeRegion?.name || 
      activeRegion?.regionName ||
      typeof activeRegion === 'string'  // Support legacy string regions
    );
    
    if (!hasValidRegion) {
      console.error("activeRegion is not available");
      if (!isAutoSave) {
        toast.error("Region information not available. Please select a region and try again.");
      }
      return;
    }
    
    // Get the current data from queryClient
    const queryKey = ["mooeData", activeRegion?.name];
    const currentData = queryClient.getQueryData(queryKey);
    
    // If income inputs are disabled, preserve the original income values
    let entries;
    if (disableIncomeInputs && currentData?.formattedData) {
      // Build from latest cache to preserve original income; apply draft subsidy while typing
      const originalIncomeMap = {};
      currentData.formattedData.forEach(row => {
        row.children.forEach(child => {
          const key = `${row.id}-${child.id}`;
          originalIncomeMap[key] = child.income;
        });
      });

      const source = currentData.formattedData;
      entries = source
        .flatMap(row =>
          row.children.map(child => {
            const key = `${row.id}-${child.id}`;
            const originalIncome = originalIncomeMap[key] ?? child.income;
            const draft = draftInputs[child.id] || {};
            const rawSubsidy = draft.subsidy ?? child.subsidy;
            const incomeNum = parseFloat(originalIncome || 0);
            const subsidyNum = parseFloat(rawSubsidy || 0);
            const hasValues = incomeNum > 0 || subsidyNum > 0;
            const isNewEntry = hasValues && (!child.status || child.status === "");
            const originalStatus = child.status;

            let newStatus;
            if (isNewEntry) {
              newStatus = "Not Submitted";
            } else if (child.status) {
              newStatus = child.status;
            } else {
              newStatus = data?.status || "Not Submitted";
            }

            return {
              ...child,
              sublineItem: row.sublineItem,
              status: newStatus,
              originalStatus: originalStatus,
              income: incomeNum,
              subsidy: subsidyNum,
              amount: incomeNum + subsidyNum,
              uacsCode: child.uacsCode || "UNKNOWN",
              accountingTitle: child.accountingTitle || "Unknown Account",
              id: child.id || undefined
            };
          })
        )
        .filter(entry => {
          // Save only rows that actually have values; drop blanks regardless of existingId
          const hasValues = parseFloat(entry.income || 0) !== 0 || parseFloat(entry.subsidy || 0) !== 0;
          return hasValues;
        });
    } else {
      // Normal processing if income inputs are not disabled
      // Build from the latest cache (currentData) so we include all edits
      const source = currentData?.formattedData || data.formattedData;
      entries = source
        .flatMap(row =>
          row.children.map(child => {
            // Prefer draft values while building entry
            const draft = draftInputs[child.id] || {};
            const rawIncome = draft.income ?? child.income;
            const rawSubsidy = draft.subsidy ?? child.subsidy;
            const incomeNum = parseFloat(rawIncome || 0);
            const subsidyNum = parseFloat(rawSubsidy || 0);
            const hasValues = incomeNum > 0 || subsidyNum > 0;
            const isNewEntry = hasValues && (!child.status || child.status === "");
            const originalStatus = child.status;

            let newStatus;
            if (isNewEntry) {
              newStatus = "Not Submitted";
            } else if (child.status) {
              newStatus = child.status;
            } else {
              newStatus = data?.status || "Not Submitted";
            }

            return {
              ...child,
              sublineItem: row.sublineItem,
              status: newStatus,
              originalStatus: originalStatus,
              income: incomeNum,
              subsidy: subsidyNum,
              amount: incomeNum + subsidyNum,
              uacsCode: child.uacsCode || "UNKNOWN",
              accountingTitle: child.accountingTitle || "Unknown Account",
              id: child.id || undefined
            };
          })
        )
        .filter(entry => {
          // Save only rows that actually have values; drop blanks regardless of existingId
          const hasValues = parseFloat(entry.income || 0) !== 0 || parseFloat(entry.subsidy || 0) !== 0;
          return hasValues;
        });
    }

    // Merge any in-progress draft values into entries so save uses what user sees
    const mergedEntries = entries.map(e => {
      const draft = draftInputs[e.id] || {};
      const income = draft.income !== undefined ? parseFloat(draft.income || 0) : e.income;
      const subsidy = draft.subsidy !== undefined ? parseFloat(draft.subsidy || 0) : e.subsidy;
      return { ...e, income, subsidy, amount: (parseFloat(income || 0) + parseFloat(subsidy || 0)) };
    });

    // Extract region name safely, supporting multiple formats
    const regionName = typeof activeRegion === 'string' 
      ? activeRegion 
      : (activeRegion?.name || activeRegion?.regionName || activeRegion?.Region || 'CENTRAL OFFICE');

    const payload = {
      proposalId: effectiveProposalId,  // ADDED: Use prop first, then hook
      meta: {
        processBy: `${currentUser.FirstName} ${currentUser.LastName}`,
        processDate: new Date(),
        region: regionName,
        department: currentUser?.hierarchicalAccess?.accessibleDepartments?.[0]?.departmentName || undefined,
        division: currentUser?.hierarchicalAccess?.accessibleDivisions?.[0] || undefined,
        fiscalYear: data?.fiscalYear,
        budgetType: data?.budgetType,
        status: data?.status,
      },
      entries: mergedEntries,
    };

    // Check if we have any entries to save
    if (payload.entries.length === 0) {
      console.warn("No entries to save - this might cause a server error");

      // If no entries, create a minimal entry to prevent server error
      // This can happen when all values are zero but we still want to save the state
      payload.entries = [{
        sublineItem: "System Entry",
        accountingTitle: "Placeholder Entry",
        uacsCode: "SYSTEM",
        income: 0,
        subsidy: 0,
        amount: 0,
        status: data?.status || "Draft",
        isSystemEntry: true // Flag to identify this as a system-generated entry
      }];

    }

    // Save all MOOE data including IAs O&M Cost entries
    console.log('📤 MOOE SAVE DEBUG:', {
      entriesCount: payload.entries.length,
      firstEntry: payload.entries[0],
      draftInputsState: Object.keys(draftInputs).length,
      proposalId: payload.proposalId
    });
    
    saveMutation.mutate(payload, {
      onSuccess: () => {
        setHasUnsavedChanges(false);
        setLastSaved(new Date());

        if (isAutoSave) {
          toast.success("Auto-saved successfully!", { autoClose: 2000 });
        } else {
          toast.success("Data saved successfully!");
        }

        // Wait a bit for the refetch to start, then clear draft inputs
        // This prevents the UI from showing blank fields momentarily
        setTimeout(() => {
          setDraftInputs({});
        }, 300);

        // Refresh the data after saving so the latest entries appear immediately
        queryClient.invalidateQueries(["mooeData", activeRegion?.name || activeRegion?.regionName]);
        queryClient.invalidateQueries(["consolidatedData", activeRegion?.name || activeRegion?.regionName]);
        // Also invalidate allProposals for NewProposalWorkflowPage to update totals
        queryClient.invalidateQueries({ queryKey: ["allProposals"] });
        queryClient.invalidateQueries({ queryKey: ["proposals"] });
        queryClient.invalidateQueries({ queryKey: ["workflowProposals"] });
      },
      onError: (error) => {
        console.error("Save error:", error);
        
        // Check if the error response indicates partial success or warning
        const errorData = error?.response?.data;
        const errorStatus = error?.response?.status;
        
        // If we got a 500 error but the server says data was saved (partial success), treat as success
        if (errorStatus === 500 && errorData?.success) {
          if (!isAutoSave) {
            const message = errorData?.warning 
              ? `${errorData.message} (${errorData.warning})`
              : errorData?.message || 'Data saved with warnings';
            toast.success(message, { autoClose: 3000 });
          }
          // Still invalidate queries since some data was saved
          queryClient.invalidateQueries(["mooeData", activeRegion?.name || activeRegion?.regionName]);
          queryClient.invalidateQueries(["consolidatedData", activeRegion?.name || activeRegion?.regionName]);
          return;
        }
        
        // Actual error - no data was saved
        if (!isAutoSave) {
          toast.error(`Failed to save: ${error.message || 'Unknown error'}`);
        }
      }
    });
  };

  const handleClear = async () => {
    try {
      // Call backend to delete all MOOE proposals for the active fiscal year and region
      if (!workflowRef) {
        toast.error("Create a proposal first to clear MOOE drafts.");
        return;
      }
      const regionName = activeRegion?.name || activeRegion?.regionName;
  await api.delete("/mooe-delete", { params: { region: regionName }, headers: headerConfig() });
      toast.success("MOOE data cleared successfully.");
      // Refresh the table data
      queryClient.invalidateQueries(["mooeData"]);
    } catch (error) {
      toast.error("Failed to clear MOOE data.");
      console.error("Clear error:", error);
    }
  };

  // Enhanced auto-save functionality with better debouncing and error handling
  useEffect(() => {

    // Clear existing timer
    // Auto-save timer disabled - users must click SAVE button explicitly
    // if (autoSaveTimer) {
    //   clearTimeout(autoSaveTimer);
    //   setAutoSaveTimer(null);
    // }
    // if (autoSave && hasUnsavedChanges) {
    //   const timer = setTimeout(async () => {
    //     try {
    //       await handleSave(true);
    //     } catch (error) {
    //       console.error("Auto-save failed:", error);
    //     }
    //   }, 1500);
    //   setAutoSaveTimer(timer);
    //   return () => {
    //     clearTimeout(timer);
    //     setAutoSaveTimer(null);
    //   };
    // }
  }, [autoSave, hasUnsavedChanges]);

  // Enhanced loading state with better UX
  if (isLoading) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
        role="status"
        aria-label="Loading MOOE data"
      >
        <CircularProgress size={60} thickness={4} sx={{ color: "#375e38" }} />
        <Typography variant="h6" sx={{ mt: 2, color: "#375e38" }}>
          Loading MOOE data...
        </Typography>
        <Typography variant="body2" sx={{ mt: 1, color: "text.secondary" }}>
          Please wait while we fetch your budget information
        </Typography>
      </Box>
    );
  }

  // Enhanced error state with retry option
  if (error) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
        role="alert"
        aria-label="Error loading data"
      >
        <Typography variant="h6" color="error" sx={{ mb: 2 }}>
          ⚠️ Error loading MOOE data
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: "center" }}>
          {error.response?.data?.message || error.message || "Unable to load data. Please check your connection and try again."}
        </Typography>
        <Button
          variant="contained"
          onClick={() => queryClient.invalidateQueries(["mooeData"])}
          sx={{ backgroundColor: "#375e38", "&:hover": { backgroundColor: "#2d4a2e" } }}
        >
          Retry Loading
        </Button>
      </Box>
    );
  }

  const isEditable = hasWorkflowRef && ["Not Submitted", "Returned", "Draft"].includes(
    data?.status
  ) && !locked;

  // Enhanced export functionality with multiple formats
  const handleExportToExcel = () => {
    try {
      // Include both regular MOOE and IAs O&M Cost data
      const regularMooeData = filteredData.flatMap(row =>
        row.children.map(child => ({
          'Category': 'Regular MOOE',
          'Subline Item': row.sublineItem,
          'Accounting Title': child.accountingTitle,
          'UACS Code': child.uacsCode,
          'Income': parseFloat(child.income || 0),
          'Subsidy': parseFloat(child.subsidy || 0),
          'Amount': parseFloat(child.income || 0) + parseFloat(child.subsidy || 0),
          'Status': child.status || 'Draft',
          'Region': activeRegion?.name || activeRegion.regionName,
          'Fiscal Year': data?.fiscalYear || '',
          'Budget Type': data?.budgetType || '',
          'Export Date': new Date().toISOString().split('T')[0]
        }))
      );

      const exportData = [...regularMooeData];

      if (exportData.length === 0) {
        toast.warning("No data to export");
        return;
      }

      // Create enhanced CSV content with proper formatting
      const headers = Object.keys(exportData[0]);
      const csvContent = [
        headers.join(','),
        ...exportData.map(row =>
          headers.map(header => {
            const value = row[header];
            // Properly escape values that contain commas or quotes
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          }).join(',')
        )
      ].join('\n');

      // Download file with enhanced naming
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      const regionName = activeRegion?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'Unknown';
      a.download = `MOOE_Data_${regionName}_${timestamp}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast.success(`Data exported successfully! ${exportData.length} records exported.`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export data. Please try again.");
    }
  };

  // Import functionality
  const handleImportData = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error("Please select a CSV file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csv = e.target.result;
        const lines = csv.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

        if (!headers.includes('UACS Code') || !headers.includes('Income') || !headers.includes('Subsidy')) {
          toast.error("Invalid CSV format. Required columns: UACS Code, Income, Subsidy");
          return;
        }

        const importedData = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
          const rowData = {};
          headers.forEach((header, index) => {
            rowData[header] = values[index] || '';
          });

          if (rowData['UACS Code'] && (rowData['Income'] || rowData['Subsidy'])) {
            importedData.push(rowData);
          }
        }

        if (importedData.length === 0) {
          toast.warning("No valid data found in the CSV file");
          return;
        }

        // Apply imported data to the current dataset
        queryClient.setQueryData(["mooeData", activeRegion?.name], (old) => {
          if (!old) return old;

          const updatedData = old.formattedData.map(row => ({
            ...row,
            children: row.children.map(child => {
              const importedRow = importedData.find(item => item['UACS Code'] === child.uacsCode);
              if (importedRow) {
                return {
                  ...child,
                  income: importedRow['Income'] || child.income,
                  subsidy: importedRow['Subsidy'] || child.subsidy,
                  amount: (parseFloat(importedRow['Income'] || 0) + parseFloat(importedRow['Subsidy'] || 0)).toString()
                };
              }
              return child;
            })
          }));

          return {
            ...old,
            formattedData: updatedData
          };
        });

        setHasUnsavedChanges(true);
        toast.success(`Successfully imported ${importedData.length} records`);
      } catch (error) {
        console.error("Import error:", error);
        toast.error("Failed to import data. Please check the file format.");
      }
    };

    reader.readAsText(file);
    // Reset the input
    event.target.value = '';
  };

  const handleBulkEdit = () => {
    setBulkEditMode(!bulkEditMode);
    setSelectedRows([]);
  };

  const toggleExpandAll = () => {
    if (expandedRows.length === filteredData.length) {
      setExpandedRows([]);
    } else {
      setExpandedRows(filteredData.map(row => row.id));
    }
  };

  return (
    <>
      {/* Enhanced Toolbar */}
      <Box sx={{ mb: 3 }}>
        {/* Top Row - Main Controls */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box display="flex" alignItems="center" gap={2}>
            <StickyButtons
              handleSave={() => handleSave(false)}
              handleClear={handleClear}
              disabled={!isEditable}
            />

            {!hasWorkflowRef && (
              <Typography variant="caption" color="error" sx={{ maxWidth: 260 }}>
                Create a proposal first to unlock MOOE editing and saving.
              </Typography>
            )}

            {/* Auto-save toggle */}
            <FormControlLabel
              control={
                <Switch
                  checked={autoSave}
                  onChange={(e) => setAutoSave(e.target.checked)}
                  color="primary"
                  disabled={!hasWorkflowRef}
                />
              }
              label={
                <Box display="flex" alignItems="center" gap={1}>
                  <SaveIcon fontSize="small" />
                  <Typography variant="body2">Auto-save</Typography>
                </Box>
              }
            />

            {/* Last saved indicator */}
            {lastSaved && (
              <Chip
                size="small"
                label={`Last saved: ${lastSaved.toLocaleTimeString()}`}
                color="success"
                variant="outlined"
              />
            )}

            {/* Unsaved changes indicator */}
            {hasUnsavedChanges && (
              <Chip
                size="small"
                label="Unsaved changes"
                color="warning"
                variant="outlined"
              />
            )}
          </Box>

          <Box display="flex" alignItems="center" gap={1}>
            {/* View mode selector */}
            {/* <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>View Mode</InputLabel>
              <Select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value)}
                label="View Mode"
              >
                <MenuItem value="table">
                  <Box display="flex" alignItems="center" gap={1}>
                    <VisibilityIcon fontSize="small" />
                    Table
                  </Box>
                </MenuItem>
                <MenuItem value="chart">
                  <Box display="flex" alignItems="center" gap={1}>
                    <BarChartIcon fontSize="small" />
                    Chart
                  </Box>
                </MenuItem>
                <MenuItem value="consolidated">
                  <Box display="flex" alignItems="center" gap={1}>
                    <BarChartIcon fontSize="small" />
                    Consolidated
                  </Box>
                </MenuItem>
              </Select>
            </FormControl> */}

            {/* Export button */}
            <Tooltip title="Export to CSV">
              <IconButton onClick={handleExportToExcel} color="primary">
                <GetAppIcon />
              </IconButton>
            </Tooltip>

            {/* Import button */}
            <Tooltip title="Import from CSV">
              <IconButton component="label" color="primary" disabled={!isEditable}>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleImportData}
                  style={{ display: 'none' }}
                />
                <GetAppIcon sx={{ transform: 'rotate(180deg)' }} />
              </IconButton>
            </Tooltip>

            {/* Bulk edit toggle */}
            <Tooltip title="Bulk edit mode">
              <IconButton
                onClick={handleBulkEdit}
                color={bulkEditMode ? "primary" : "default"}
                disabled={!isEditable}
              >
                <EditIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Second Row - Search and Filters */}
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          {/* Enhanced Search with accessibility */}
          <TextField
            size="small"
            placeholder="Search subline items, accounting titles, or UACS codes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: 300 }}
            aria-label="Search MOOE data"
            inputProps={{
              'aria-describedby': 'search-help-text',
            }}
            helperText={searchTerm && filteredData.length === 0 ? "No results found" : ""}
          />
          <Typography
            id="search-help-text"
            variant="caption"
            sx={{ display: 'none' }}
          >
            Search across subline items, accounting titles, and UACS codes
          </Typography>

          {/* Filter button */}
          <Button
            variant="outlined"
            startIcon={<FilterListIcon />}
            onClick={(e) => setFilterAnchorEl(e.currentTarget)}
            color={Object.values(selectedFilters).some(f =>
              Array.isArray(f) ? f.length > 0 : f !== "" && f !== false
            ) ? "primary" : "inherit"}
          >
            Filters
          </Button>

          {/* Expand/Collapse All */}
          <Button
            variant="outlined"
            startIcon={expandedRows.length === filteredData.length ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            onClick={toggleExpandAll}
          >
            {expandedRows.length === filteredData.length ? "Collapse All" : "Expand All"}
          </Button>

          {/* Results count */}
          <Typography variant="body2" color="text.secondary">
            Showing {filteredData.length} of {data?.formattedData?.length || 0} categories
          </Typography>
        </Box>

        {/* Validation errors alert */}
        {Object.keys(validationErrors).length > 0 && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Please fix the following errors: {Object.values(validationErrors).join(", ")}
          </Alert>
        )}
      </Box>

      {/* Main Table with Zoom Animation */}
      <Zoom in={true} timeout={600}>
        <Box sx={{ position: 'relative' }}>
          <TableContainer
            component={Paper}
            sx={{
              maxHeight: "calc(70vh - 50px)", // Reduced height to make room for footer
              overflow: "auto",
              borderRadius: '8px',
              border: '1px solid rgba(224, 224, 224, 1)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
              transition: 'all 0.3s ease',
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
            }}
          >
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell width="5%" sx={{ 
                  backgroundColor: "#375e38", 
                  color: "#fff",
                  fontWeight: "bold",
                  padding: "12px 16px",
                  borderRight: "1px solid white",
                  borderBottom: "1px solid white",
                  borderTop: "1px solid white",
                  borderLeft: "1px solid white",
                }}></TableCell>
                {viewMode === "consolidated" && (
                  <TableCell width="15%" sx={{ 
                    backgroundColor: "#375e38", 
                    color: "#fff",
                    fontWeight: "bold",
                    padding: "12px 16px",
                    borderRight: "1px solid white",
                    borderBottom: "1px solid white",
                    borderTop: "1px solid white",
                  }}>DATA TYPE</TableCell>
                )}
                <TableCell width={viewMode === "consolidated" ? "20%" : "20%"} sx={{ 
                  backgroundColor: "#375e38", 
                  color: "#fff",
                  fontWeight: "bold",
                  padding: "12px 16px",
                  borderRight: "1px solid white",
                  borderBottom: "1px solid white",
                  borderTop: "1px solid white",
                }}>{viewMode === "consolidated" ? "CATEGORY" : "SUBLINE ITEM"}</TableCell>
                <TableCell width={viewMode === "consolidated" ? "20%" : "25%"} sx={{ 
                  backgroundColor: "#375e38", 
                  color: "#fff",
                  fontWeight: "bold",
                  padding: "12px 16px",
                  borderRight: "1px solid white",
                  borderBottom: "1px solid white",
                  borderTop: "1px solid white",
                }}>ACCOUNTING TITLE</TableCell>
                <TableCell width="10%" sx={{ 
                  backgroundColor: "#375e38", 
                  color: "#fff",
                  fontWeight: "bold",
                  padding: "12px 16px",
                  borderRight: "1px solid white",
                  borderBottom: "1px solid white",
                  borderTop: "1px solid white",
                }}>UACS CODE</TableCell>
                <TableCell width="12%" sx={{ 
                  backgroundColor: "#375e38", 
                  color: "#fff",
                  fontWeight: "bold",
                  padding: "12px 16px",
                  borderRight: "1px solid white",
                  borderBottom: "1px solid white",
                  borderTop: "1px solid white",
                  textAlign: "right"
                }}>INCOME</TableCell>
                <TableCell width="12%" sx={{ 
                  backgroundColor: "#375e38", 
                  color: "#fff",
                  fontWeight: "bold",
                  padding: "12px 16px",
                  borderRight: "1px solid white",
                  borderBottom: "1px solid white",
                  borderTop: "1px solid white",
                  textAlign: "right"
                }}>SUBSIDY</TableCell>
                <TableCell width="16%" sx={{ 
                  backgroundColor: "#375e38", 
                  color: "#fff",
                  fontWeight: "bold",
                  padding: "12px 16px",
                  borderBottom: "1px solid white",
                  borderTop: "1px solid white",
                  borderRight: "1px solid white",
                  textAlign: "right"
                }}>AMOUNT</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(viewMode === "consolidated" ? consolidatedData : filteredData)?.map((row, index) => (
                <React.Fragment key={row.id}>
                  {/* Parent row */}
                  <TableRow
                    sx={{
                      backgroundColor: expandedRows.includes(row.id) ? "rgba(55, 94, 56, 0.08)" : "rgba(55, 94, 56, 0.04)",
                      '&:hover': { backgroundColor: "rgba(55, 94, 56, 0.12)" }
                    }}
                  >
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => toggleExpandRow(row.id)}
                        sx={{ color: "#375e38" }}
                      >
                        {expandedRows.includes(row.id) ? <RemoveCircleOutlineIcon /> : <AddCircleOutlineIcon />}
                      </IconButton>
                    </TableCell>
                    {viewMode === "consolidated" && (
                      <TableCell>
                        <Chip 
                          label={row.dataType} 
                          size="small" 
                          color={row.dataType === 'MOOE' ? 'primary' : 'secondary'}
                        />
                      </TableCell>
                    )}
                    <TableCell sx={{ fontWeight: "bold" }}>
                      {viewMode === "consolidated" ? row.category : row.sublineItem}
                    </TableCell>
                    <TableCell colSpan={viewMode === "consolidated" ? 1 : 2}></TableCell>
                    <TableCell align="right" sx={{ fontWeight: "bold" }}>
                      {(() => {
                        const total = row.children.reduce((sum, child) => sum + parseFloat(child.income || 0), 0);
                        const hasValues = row.children.some(child => child.income && parseFloat(child.income) > 0);
                        return hasValues ? `₱${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "";
                      })()}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: "bold" }}>
                      {(() => {
                        const total = row.children.reduce((sum, child) => sum + parseFloat(child.subsidy || 0), 0);
                        const hasValues = row.children.some(child => child.subsidy && parseFloat(child.subsidy) > 0);
                        return hasValues ? `₱${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "";
                      })()}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: "bold" }}>
                      {(() => {
                        const total = row.children.reduce((sum, child) => {
                          const income = parseFloat(child.income || 0);
                          const subsidy = parseFloat(child.subsidy || 0);
                          return sum + income + subsidy;
                        }, 0);
                        
                        // Only show total if there are actual values
                        const hasValues = row.children.some(child => 
                          (child.income && parseFloat(child.income) > 0) || 
                          (child.subsidy && parseFloat(child.subsidy) > 0)
                        );
                        
                        return hasValues ? `₱${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "";
                      })()}
                    </TableCell>
                  </TableRow>

                  {/* Child rows */}
                  {expandedRows.includes(row.id) && row.children.map((child) => {
                    // Check if this child has hierarchical children (sub-UACS codes)
                    const hierarchicalChildren = row.children.filter(c => 
                      c.uacsCode && child.uacsCode && c.uacsCode.startsWith(child.uacsCode + '-')
                    );
                    const hasHierarchicalChildren = hierarchicalChildren.length > 0;
                    
                    // Calculate sum of hierarchical children
                    const hierarchicalIncomeSum = hierarchicalChildren.reduce((sum, c) => sum + parseFloat(c.income || 0), 0);
                    const hierarchicalSubsidySum = hierarchicalChildren.reduce((sum, c) => sum + parseFloat(c.subsidy || 0), 0);
                    
                    const base = 'Other Maintenance and Operating Expenses';
                    const isOto = row.sublineItem && row.sublineItem.startsWith(base);
                    const indentLevel = getIndentLevelFromSubline(child.sublineItem || child.accountingTitle || row.sublineItem, child.uacsCode);
                    const hideGenericUacs = shouldHideGenericOtherUacs(child.uacsCode, row.sublineItem);

                    return (
                      <TableRow key={child.id}>
                        <TableCell></TableCell>
                        {viewMode === "consolidated" && <TableCell></TableCell>}
                        <TableCell></TableCell>
                        <TableCell sx={{ pl: indentLevel ? 3 : 0 }}>{child.accountingTitle || child.name}</TableCell>
                        <TableCell>{hideGenericUacs ? '' : (child.uacsCode || child.particulars)}</TableCell>

                        {/* Income field */}
                        <TableCell>
                          {viewMode === "consolidated" ? (
                            <Typography variant="body2" align="right">
                              ₱{parseFloat(child.income || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </Typography>
                          ) : hasHierarchicalChildren ? (
                            <Typography variant="body2" align="right" sx={{ fontWeight: 'bold', color: '#375e38' }}>
                              ₱{hierarchicalIncomeSum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </Typography>
                          ) : (
                            <TextField
                              fullWidth
                              size="small"
                              value={(() => {
                                // Prefer local draft value while typing
                                const draft = draftInputs[child.id]?.income;
                                if (draft !== undefined) return draft;
                                const val = child.income;
                                if (val === "0" || val === 0) return "";
                                if (val === null || val === undefined) return "";
                                return val.toString();
                              })()}
                              onChange={(e) => {
                                const v = e.target.value;
                                setDraftInputs(prev => ({
                                  ...prev,
                                  [child.id]: { ...(prev[child.id]||{}), income: v }
                                }));
                                handleIncomeChange(child.id, v);
                              }}
                              disabled={!isEditable || disableIncomeInputs}
                              placeholder="0.00"
                              InputProps={{
                                startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                                inputComponent: NumberFormatCustom,
                                inputProps: { style: { textAlign: 'right' } }
                              }}
                              sx={{
                                backgroundColor: !isEditable || disableIncomeInputs ? "#f5f5f5" : "white",
                                '& .MuiInputBase-input': { textAlign: 'right' }
                              }}
                            />
                          )}
                        </TableCell>

                        {/* Subsidy field */}
                        <TableCell>
                          {viewMode === "consolidated" ? (
                            <Typography variant="body2" align="right">
                              ₱{parseFloat(child.subsidy || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </Typography>
                          ) : hasHierarchicalChildren ? (
                            <Typography variant="body2" align="right" sx={{ fontWeight: 'bold', color: '#375e38' }}>
                              ₱{hierarchicalSubsidySum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </Typography>
                          ) : (
                            <TextField
                              fullWidth
                              size="small"
                              value={(() => {
                                // Prefer local draft value while typing
                                const draft = draftInputs[child.id]?.subsidy;
                                if (draft !== undefined) return draft;
                                const val = child.subsidy;
                                if (val === "0" || val === 0) return "";
                                if (val === null || val === undefined) return "";
                                return val.toString();
                              })()}
                              onChange={(e) => {
                                const v = e.target.value;
                                setDraftInputs(prev => ({
                                  ...prev,
                                  [child.id]: { ...(prev[child.id]||{}), subsidy: v }
                                }));
                                handleSubsidyChange(child.id, v);
                              }}
                              disabled={!isEditable}
                              placeholder="0.00"
                              InputProps={{
                                startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                                inputComponent: NumberFormatCustom,
                                inputProps: { style: { textAlign: 'right' } }
                              }}
                              sx={{
                                backgroundColor: !isEditable ? "#f5f5f5" : "white",
                                '& .MuiInputBase-input': { textAlign: 'right' }
                              }}
                            />
                          )}
                        </TableCell>

                        {/* Amount field (calculated) */}
                        <TableCell>
                          <Typography variant="body2" align="right">
                            {(() => {
                              // Prefer draft values while typing
                              const income = hasHierarchicalChildren ? hierarchicalIncomeSum : parseFloat((draftInputs[child.id]?.income ?? child.income) || 0);
                              const subsidy = hasHierarchicalChildren ? hierarchicalSubsidySum : parseFloat((draftInputs[child.id]?.subsidy ?? child.subsidy) || 0);
                              const total = income + subsidy;
                            
                              if (total === 0 && !(draftInputs[child.id]?.income ?? child.income) && !(draftInputs[child.id]?.subsidy ?? child.subsidy)) {
                                return "";
                              }
                              
                              return `₱${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
                            })()}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

          {/* Fixed Footer Table with Animation */}
          <Fade in={true} timeout={1000}>
            <Table
              sx={{
                position: 'sticky',
                bottom: 0,
                width: '100%',
                tableLayout: 'fixed',
                borderCollapse: 'separate',
                borderSpacing: 0,
                marginTop: '-2px', // To avoid gap between tables
                zIndex: 2,
                boxShadow: '0 -2px 8px rgba(0,0,0,0.1)',
                transition: 'all 0.3s ease'
              }}
            >
          <TableFooter>
            {/* Regular MOOE Total Row */}
            <TableRow>
              <TableCell 
                colSpan={4} 
                sx={{ 
                  backgroundColor: "#375e38", 
                  color: "#fff",
                  fontWeight: "bold",
                  padding: "12px 16px",
                  borderRight: "1px solid white",
                  borderTop: "1px solid white",
                  borderLeft: "1px solid white",
                  borderBottom: "1px solid white",
                  textAlign: "right",
                  width: "60%",
                }}
              >
                REGULAR MOOE TOTAL:
              </TableCell>
              <TableCell 
                sx={{ 
                  backgroundColor: "#375e38", 
                  color: "#fff",
                  fontWeight: "bold",
                  padding: "12px 16px",
                  borderRight: "1px solid white",
                  borderTop: "1px solid white",
                  borderBottom: "1px solid white",
                  textAlign: "right",
                  width: "12%",
                }}
              >
                ₱{grandTotals.income.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </TableCell>
              <TableCell 
                sx={{ 
                  backgroundColor: "#375e38", 
                  color: "#fff",
                  fontWeight: "bold",
                  padding: "12px 16px",
                  borderRight: "1px solid white",
                  borderTop: "1px solid white",
                  borderBottom: "1px solid white",
                  textAlign: "right",
                  width: "12%",
                }}
              >
                ₱{grandTotals.subsidy.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </TableCell>
              <TableCell 
                sx={{ 
                  backgroundColor: "#375e38", 
                  color: "#fff",
                  fontWeight: "bold",
                  padding: "12px 16px",
                  borderTop: "1px solid white",
                  borderRight: "1px solid white",
                  borderBottom: "1px solid white",
                  textAlign: "right",
                  width: "16%",
                }}
              >
                ₱{grandTotals.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </TableCell>
            </TableRow>

            {/* MOOE - O & M COST (IAs) Row */}
            <TableRow>
              <TableCell 
                colSpan={4} 
                sx={{ 
                  backgroundColor: "#375e38", 
                  color: "#fff",
                  fontWeight: "bold",
                  padding: "12px 16px",
                  borderRight: "1px solid white",
                  borderTop: "1px solid white",
                  borderLeft: "1px solid white",
                  borderBottom: "1px solid white",
                  textAlign: "right",
                  width: "60%",
                }}
              >
                MOOE - O & M COST (IAs)
              </TableCell>
              <TableCell 
                sx={{ 
                  backgroundColor: "#375e38", 
                  color: "#fff",
                  fontWeight: "bold",
                  padding: "12px 16px",
                  borderRight: "1px solid white",
                  borderTop: "1px solid white",
                  borderBottom: "1px solid white",
                  textAlign: "right",
                  width: "12%",
                }}
              >
                ₱{iasTotals.income.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </TableCell>
              <TableCell 
                sx={{ 
                  backgroundColor: "#375e38", 
                  color: "#fff",
                  fontWeight: "bold",
                  padding: "12px 16px",
                  borderRight: "1px solid white",
                  borderTop: "1px solid white",
                  borderBottom: "1px solid white",
                  textAlign: "right",
                  width: "12%",
                }}
              >
                ₱{iasTotals.subsidy.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </TableCell>
              <TableCell 
                sx={{ 
                  backgroundColor: "#375e38", 
                  color: "#fff",
                  fontWeight: "bold",
                  padding: "12px 16px",
                  borderTop: "1px solid white",
                  borderRight: "1px solid white",
                  borderBottom: "1px solid white",
                  textAlign: "right",
                  width: "16%",
                }}
              >
                ₱{iasTotals.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </TableCell>
            </TableRow>

            {/* Grand Total Row */}
            <TableRow>
              <TableCell 
                colSpan={4} 
                sx={{ 
                  backgroundColor: "#375e38", 
                  color: "#fff",
                  fontWeight: "bold",
                  padding: "12px 16px",
                  borderRight: "1px solid white",
                  borderTop: "1px solid white",
                  borderLeft: "1px solid white",
                  borderBottom: "1px solid white",
                  textAlign: "right",
                  width: "60%",
                }}
              >
                TOTAL MOOE REGULAR +IAs O & M COST:
              </TableCell>
              <TableCell 
                sx={{ 
                  backgroundColor: "#375e38", 
                  color: "#fff",
                  fontWeight: "bold",
                  padding: "12px 16px",
                  borderRight: "1px solid white",
                  borderTop: "1px solid white",
                  borderBottom: "1px solid white",
                  textAlign: "right",
                  width: "12%",
                }}
              >
                ₱{(grandTotals.income + iasTotals.income).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </TableCell>
              <TableCell 
                sx={{ 
                  backgroundColor: "#375e38", 
                  color: "#fff",
                  fontWeight: "bold",
                  padding: "12px 16px",
                  borderRight: "1px solid white",
                  borderTop: "1px solid white",
                  borderBottom: "1px solid white",
                  textAlign: "right",
                  width: "12%",
                }}
              >
                ₱{(grandTotals.subsidy + iasTotals.subsidy).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </TableCell>
              <TableCell 
                sx={{ 
                  backgroundColor: "#375e38", 
                  color: "#fff",
                  fontWeight: "bold",
                  padding: "12px 16px",
                  borderTop: "1px solid white",
                  borderRight: "1px solid white",
                  borderBottom: "1px solid white",
                  textAlign: "right",
                  width: "16%",
                }}
              >
                ₱{(grandTotals.total + iasTotals.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </TableCell>
            </TableRow>
          </TableFooter>
            </Table>
          </Fade>
        </Box>
      </Zoom>

      {/* Filter Menu */}
      <Menu
        anchorEl={filterAnchorEl}
        open={Boolean(filterAnchorEl)}
        onClose={() => setFilterAnchorEl(null)}
        PaperProps={{ sx: { minWidth: 300, p: 2 } }}
      >
        <Typography variant="h6" gutterBottom>Filters</Typography>
        <Divider sx={{ mb: 2 }} />

        {/* Amount Range Filter */}
        <Typography variant="subtitle2" gutterBottom>Amount Range</Typography>
        <Box display="flex" gap={1} mb={2}>
          <TextField
            size="small"
            label="Min"
            type="number"
            value={selectedFilters.amountRange.min}
            onChange={(e) => setSelectedFilters(prev => ({
              ...prev,
              amountRange: { ...prev.amountRange, min: e.target.value }
            }))}
          />
          <TextField
            size="small"
            label="Max"
            type="number"
            value={selectedFilters.amountRange.max}
            onChange={(e) => setSelectedFilters(prev => ({
              ...prev,
              amountRange: { ...prev.amountRange, max: e.target.value }
            }))}
          />
        </Box>

        {/* Value Filters */}
        <FormGroup>
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
            label="Show only entries with values"
          />          <FormControlLabel
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
            label="Show only empty entries"
          />
        </FormGroup>

        <Box display="flex" justifyContent="space-between" mt={2}>
          <Button
            size="small"
            onClick={() => setSelectedFilters({
              sublineItems: [],
              amountRange: { min: "", max: "" },
              hasValues: false,
              emptyValues: false
            })}
          >
            Clear All
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={() => setFilterAnchorEl(null)}
          >
            Apply
          </Button>
        </Box>
      </Menu>

      {/* Enhanced Toast Container */}
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </>
  );
};

export default Mooe;
