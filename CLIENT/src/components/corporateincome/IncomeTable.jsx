import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "../../context/UserContext";
import { useRegion } from "../../context/RegionContext";
import api from "../../config/api";
import { REGIONS, doesItemBelongToRegion, getRegionErrorMessage, getDefaultRegionForSave } from "../../constants/regions";
import {
  Box, Paper, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, IconButton,
  CircularProgress, Dialog, DialogActions, DialogContent,
  DialogContentText, DialogTitle, FormControl, InputLabel,
  Select, MenuItem, Switch, FormControlLabel, TableFooter,
  Chip, Tooltip, Card, CardContent, Grid, Divider, Fade, Zoom,
  Alert, Menu
} from "@mui/material";
import {
  Save as SaveIcon, Cancel as CancelIcon, Settings as SettingsIcon,
  Refresh as RefreshIcon, GetApp as GetAppIcon, Visibility as VisibilityIcon,
  TrendingUp as TrendingUpIcon, AccountBalance as AccountBalanceIcon,
  Info as InfoIcon, CheckCircle as CheckCircleIcon, Warning as WarningIcon,
  ExpandMore as ExpandMoreIcon, Add as AddIcon
} from "@mui/icons-material";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { NumericFormat } from "react-number-format";
import { debounce } from 'lodash';

const NumberFormatCustom = React.forwardRef(function NumberFormatCustom(props, ref) {
  const { onChange, value, ...other } = props;
  const displayValue = useMemo(() => {
    if (value === '' || value === null || value === undefined) return '';
    const numValue = Number(value);
    return isNaN(numValue) ? '' : numValue.toString();
  }, [value]);

  return (
    <NumericFormat
      {...other}
      value={displayValue}
      getInputRef={ref}
      thousandSeparator=","
      decimalScale={2}
      fixedDecimalScale={false}
      allowNegative={false}
      allowLeadingZeros={false}
      valueIsNumericString={true}
      placeholder="0.00"
      onValueChange={(values, sourceInfo) => {
        if (onChange && (sourceInfo.source === 'event' || sourceInfo.source !== 'prop')) {
          const numericValue = values.value || "";
          onChange({
            target: {
              name: props.name,
              value: numericValue,
            },
          });
        }
      }}
      onBlur={(e) => {
        if (onChange && props.onBlur) {
          props.onBlur(e);
        }
      }}
    />
  );
});

const IncomeTable = ({ onGrandTotalUpdate, onGroupedItemsUpdate, locked = false, proposalId }) => {
  const queryClient = useQueryClient();
  const { currentUser } = useUser();
  const { activeRegion } = useRegion();
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [discountSettingsOpen, setDiscountSettingsOpen] = useState(false);
  const [discountType, setDiscountType] = useState("percentage");
  const [discountValue, setDiscountValue] = useState(10);
  const [applyDiscount, setApplyDiscount] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [fiscalYear, setFiscalYear] = useState("");
  const [budgetType, setBudgetType] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [userModifiedFields, setUserModifiedFields] = useState({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [newSubcategories, setNewSubcategories] = useState({});
  const [addingToCategoryId, setAddingToCategoryId] = useState(null);
  const [autoSave, setAutoSave] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [compactView, setCompactView] = useState(false);
  const [showSummaryCard, setShowSummaryCard] = useState(true);
  const [exportMenuAnchor, setExportMenuAnchor] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [autoSaveTimer, setAutoSaveTimer] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries(["income-items", fiscalYear, budgetType, regionFilter]);
    queryClient.invalidateQueries(["income-categories", regionFilter]);
    toast.info("Data refreshed");
  }, [queryClient, fiscalYear, budgetType, regionFilter]);

  const fetchActiveSettings = useCallback(async () => {
    try {
      const response = await api.get("/settings/active");
      if (!response.data) {
        throw new Error("No active settings found");
      }
      setFiscalYear(response.data.fiscalYear);
      setBudgetType(response.data.budgetType);
    } catch (error) {
      console.error("Error fetching active settings:", error);
      toast.error(`Failed to fetch active settings: ${error.message}`);
    }
  }, []);

  useEffect(() => {
    fetchActiveSettings();
  }, [fetchActiveSettings]);

  useEffect(() => {
    
    if (!fiscalYear) {
      const newFiscalYear = currentUser?.fiscalYear || new Date().getFullYear().toString();
      setFiscalYear(newFiscalYear);
    }
    if (!budgetType) {
      const newBudgetType = currentUser?.budgetType || "Initial";
      setBudgetType(newBudgetType);
    }
  }, [currentUser, fiscalYear, budgetType]);

  useEffect(() => {
    
    if (activeRegion) {
      const regionName = activeRegion.name || activeRegion.regionName;
      
      // If region changed, invalidate existing queries to force fresh data
      if (regionFilter && regionFilter !== regionName) {
        queryClient.invalidateQueries(["income-items"]);
        queryClient.invalidateQueries(["income-categories"]);
      }
      
      setRegionFilter(regionName);
    } else {
      setRegionFilter(REGIONS.DEFAULT_REGION);
    }
  }, [activeRegion, regionFilter, queryClient]);

  const { data: discountSettings, isLoading: loadingSettings } = useQuery({
    queryKey: ["discount-settings", fiscalYear, budgetType, regionFilter],
    queryFn: async () => {
      try {
        const response = await api.get("/api/discount-settings", {
          params: { fiscalYear, budgetType, region: regionFilter }
        });
        return response.data || { discountType: "percentage", discountValue: 10, applyDiscount: true };
      } catch (error) {
        console.error("Error fetching discount settings:", error);
        return { discountType: "percentage", discountValue: 10, applyDiscount: true };
      }
    },
    enabled: !!fiscalYear && !!budgetType && !!regionFilter,
  });

  useEffect(() => {
    if (discountSettings) {
      setDiscountType(discountSettings.discountType);
      setDiscountValue(discountSettings.discountValue);
      setApplyDiscount(discountSettings.applyDiscount);
    }
  }, [discountSettings]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (data) => {
      const response = await api.put("/api/discount-settings", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["discount-settings", fiscalYear, budgetType, regionFilter]);
      toast.success("Discount settings saved successfully");
      setDiscountSettingsOpen(false);
      setSavingSettings(false);
    },
    onError: (error) => {
      console.error("Error saving settings:", error);
      toast.error(`Error saving discount settings: ${error.message}`);
      setSavingSettings(false);
    }
  });

  const handleOpenDiscountSettings = () => {
    if (locked) return;
    setDiscountSettingsOpen(true);
  };
  const handleCloseDiscountSettings = () => setDiscountSettingsOpen(false);
  const handleDiscountTypeChange = (event) => setDiscountType(event.target.value);
  const handleDiscountValueChange = (event) => setDiscountValue(Number(event.target.value));
  const handleApplyDiscountChange = (event) => setApplyDiscount(event.target.checked);

  const handleSaveDiscountSettings = () => {
    if (locked) return;
    if (!regionFilter) {
      toast.warning("Please select a region before saving discount settings");
      return;
    }
    setSavingSettings(true);
    updateSettingsMutation.mutate({
      fiscalYear,
      budgetType,
      region: regionFilter,
      discountType,
      discountValue,
      applyDiscount
    });
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num).replace('PHP', '').trim();
  };

  const checkRegionMatch = (item) => {
    return doesItemBelongToRegion(item, regionFilter);
  };

  const { data: incomeItems = [], isLoading } = useQuery({
    queryKey: ["income-items", fiscalYear, budgetType, regionFilter],
    queryFn: async () => {
      try {
        
        const response = await api.get("/income", {
          params: { fiscalYear, budgetType, region: regionFilter }
        });

        const filteredItems = response.data.filter(item => checkRegionMatch(item));
        
        return filteredItems;
      } catch (error) {
        console.error("❌ Error fetching income items:", error);
        
        toast.error(getRegionErrorMessage(regionFilter, error));
        return [];
      }
    },
    enabled: !!fiscalYear && !!budgetType && !!regionFilter,
    retry: (failureCount, error) => {
      // Don't retry on authentication errors
      if (error.response?.status === 401 || error.response?.status === 403) {
        return false;
      }
      return failureCount < 2;
    }
  });

  const { data: incomeCategories = [] } = useQuery({
    queryKey: ["income-categories", regionFilter],
    queryFn: async () => {
      try {
        
        const response = await api.get("/income-categories", {
          params: { 
            limit: 1000,
            region: regionFilter // Include region in API call
          }
        });

        const categories = Array.isArray(response.data) ? 
          response.data : 
          response.data.categories || response.data.incomeCategories || [];

        // Filter categories based on region assignment
        const filteredCategories = categories.filter(category => {
          // Show global categories in all regions
          if (category.isGlobal === true) {
            return true;
          }
          
          // Show region-specific categories only in their assigned regions
          if (category.isGlobal === false && Array.isArray(category.regions)) {
            const isAssignedToRegion = category.regions.includes(regionFilter);
            return isAssignedToRegion;
          }
          
          // If no region info, treat as global for backward compatibility
          return true;
        });

        return filteredCategories;
      } catch (error) {
        console.error("❌ Error fetching income categories:", error);
        
        toast.error(getRegionErrorMessage(regionFilter, error));
        
        return [];
      }
    },
    enabled: !!regionFilter, // Only run when regionFilter is available
    retry: (failureCount, error) => {
      // Don't retry on authentication errors
      if (error.response?.status === 401 || error.response?.status === 403) {
        return false;
      }
      return failureCount < 2;
    }
  });

  // Use subcategories directly from category data instead of separate API call
  const categorySubcategories = useMemo(() => {
    const subcategoriesMap = {};
    incomeCategories.forEach(category => {
      if (!category || !category._id) return;
      
      let subcategories = [];
      
      // Primary field from Income Management page
      if (category.incomeSubcategoryName && Array.isArray(category.incomeSubcategoryName)) {
        subcategories = category.incomeSubcategoryName.filter(sub => sub && sub.trim());
      } 
      // Fallback for string format
      else if (category.incomeSubcategoryName && typeof category.incomeSubcategoryName === 'string') {
        subcategories = category.incomeSubcategoryName.split(',').map(s => s.trim()).filter(s => s);
      }
      // Alternative field name
      else if (category.incomeSubcategories && Array.isArray(category.incomeSubcategories)) {
        subcategories = category.incomeSubcategories.filter(sub => sub && sub.trim());
      }
      
      subcategoriesMap[category._id] = subcategories;
    });
    
    return subcategoriesMap;
  }, [incomeCategories]);

  const [subcategoryAmounts, setSubcategoryAmounts] = useState({});

  const handleSubcategoryAmountChange = useCallback(
    debounce((categoryId, subcategoryName, value) => {
      const key = `${categoryId}-${subcategoryName}`;
      setSubcategoryAmounts(prev => ({
        ...prev,
        [key]: value
      }));
      setUserModifiedFields(prev => ({
        ...prev,
        [key]: true
      }));
      setHasUnsavedChanges(true);
    }, 300),
    []
  );

  const calculateCategorySubtotal = (categoryId, subcategories) => {
    if (!Array.isArray(subcategories)) return 0;
    return subcategories.reduce((total, subcategory) => {
      const subcategoryName = typeof subcategory === 'object' ?
        (subcategory.incomeSubcategoryName || subcategory.name) : subcategory;
      const key = `${categoryId}-${subcategoryName.trim()}`;
      let amount = parseFloat(subcategoryAmounts[key]) || 0;
      if (amount === 0) {
        const subcategoryItems = incomeItems.filter(item =>
          item.subcategory === subcategoryName &&
          (item.incomecategory === categoryId || item.incomecategory?._id === categoryId) &&
          checkRegionMatch(item)
        );
        amount = subcategoryItems.reduce((sum, item) => sum + parseFloat(item.amount || item.cost || 0), 0);
      }
      return total + amount;
    }, 0);
  };

  const saveIncomeAmountMutation = useMutation({
    mutationFn: async (data) => {
      const response = await api.post("/income", data);
      return response.data;
    },
    onSuccess: () => {
      handleRefresh();
      toast.success("Income amount saved successfully");
    },
    onError: (error) => {
      console.error("Error saving income amount:", error);
      toast.error(`Error saving income amount: ${error.message}`);
    }
  });

  const updateIncomeMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/income/${id}`, data),
    onSuccess: () => {
      handleRefresh();
      toast.success("Income amount updated successfully");
    },
    onError: (error) => {
      console.error("Error updating income:", error);
      toast.error(`Error updating income amount: ${error.message}`);
    }
  });

  const handleSaveSubcategoryAmount = (category, subcategoryName) => {
    const key = `${category._id}-${subcategoryName}`;
    const amount = subcategoryAmounts[key] || "0";
    if (!category || !category._id || !subcategoryName || isNaN(Number(amount))) {
      toast.error("Cannot save: Missing category, subcategory, or amount.");
      return;
    }
    const existingItem = incomeItems.find(item =>
      (item.incomecategory === category._id || item.incomecategory?._id === category._id) &&
      item.subcategory === subcategoryName &&
      doesItemBelongToRegion(item, regionFilter)
    );
    const categoryName = category.incomeCategoryName?.trim() || "Unknown Category";
    const incomeData = {
      particulars: subcategoryName,
      cost: Number(amount),
      incomecategory: category._id,
      subcategory: subcategoryName,
      category: categoryName,
      amount: Number(amount),
      fiscalYear,
      budgetType,
      region: getDefaultRegionForSave(regionFilter),
      processBy: currentUser ? `${currentUser.FirstName} ${currentUser.LastName}` : "User",
      processDate: new Date(),
      ...(proposalId && { proposalId })  // Include proposalId if available
    };
    if (existingItem) {
      updateIncomeMutation.mutate({ id: existingItem._id, data: incomeData });
    } else {
      saveIncomeAmountMutation.mutate(incomeData);
    }
    setUserModifiedFields(prev => {
      const newState = { ...prev };
      delete newState[key];
      return newState;
    });
  };

  const addCategoryMutation = useMutation({
    mutationFn: (data) => api.post("/categories", data),
    onSuccess: () => {
      handleRefresh();
      toast.success("Category added successfully");
      setIsAddingCategory(false);
      setNewCategoryName("");
    },
    onError: (error) => {
      toast.error(`Error adding category: ${error.message}`);
    }
  });

  const groupedItems = useMemo(() => {
    
    const categoryMap = new Map();
    incomeCategories.forEach(category => {
      if (!category?.incomeCategoryName || category.incomeCategoryName.toLowerCase() === 'test') return;
      const trimmedName = category.incomeCategoryName.trim();
      const subcategories = categorySubcategories[category._id] || [];

      categoryMap.set(trimmedName, {
        items: [],
        subtotal: 0,
        isMainCategory: true,
        subcategories: subcategories,
        categoryId: category._id
      });
    });

    let isfTotal = 0;
    let currentAccountTotal = 0;
    let hasIsfCategory = false;

    incomeItems.forEach(item => {
      // Add comprehensive null checking for default region
      if (!item || !item.incomecategory) {
        return;
      }
      
      const categoryName = typeof item.incomecategory === 'object' ?
        (item.incomecategory.name || item.incomecategory.incomeCategoryName) : item.incomecategory;
        
      if (!categoryName || !checkRegionMatch(item)) return;
      const trimmedName = categoryName.trim();
      if (!categoryMap.has(trimmedName)) {
        categoryMap.set(trimmedName, {
          items: [],
          subtotal: 0,
          isMainCategory: true,
          subcategories: [],
          categoryId: item.incomecategory?._id
        });
      }
      const category = categoryMap.get(trimmedName);
      category.items.push(item);
      category.subtotal += Number(item.amount) || 0;
      if (trimmedName.includes("Irrigation Service Fees") && !trimmedName.includes("Net")) {
        hasIsfCategory = true;
        isfTotal += Number(item.amount) || 0;
        if (item.subcategory === "Current Account") {
          currentAccountTotal += Number(item.amount) || 0;
        }
      }
    });

    if (hasIsfCategory && applyDiscount && discountSettings?.region === regionFilter) {
      const discountAmount = discountType === "percentage" ?
        currentAccountTotal * (discountValue / 100) :
        Math.min(discountValue, currentAccountTotal);
      const discountLabel = discountType === "percentage" ?
        `Less: ${discountValue}% Discount on Current Account` :
        `Less: ${formatNumber(discountValue)} Discount on Current Account`;
      categoryMap.set(discountLabel, {
        items: [],
        subtotal: discountAmount,
        isDiscount: true,
        isMainCategory: true,
        subcategories: []
      });
      categoryMap.set("Net Irrigation Service Fees", {
        items: [],
        subtotal: isfTotal - discountAmount,
        isMainCategory: true,
        subcategories: [],
        isNetIsf: true
      });
    }

    categoryMap.forEach((category, categoryName) => {
      if (category.categoryId) {
        category.subtotal = calculateCategorySubtotal(category.categoryId, category.subcategories);
      }
    });

    // Add Others total to Miscellaneous Income while keeping Others as separate display
    if (categoryMap.has("Others") && categoryMap.has("Miscellaneous Income")) {
      const othersCategory = categoryMap.get("Others");
      const miscellaneousCategory = categoryMap.get("Miscellaneous Income");
      
      // Add Others total to Miscellaneous Income
      miscellaneousCategory.subtotal += othersCategory.subtotal;
      
      // Set Others subtotal to 0 so it doesn't show individual total
      othersCategory.subtotal = 0;
      othersCategory.hideTotal = true; // Flag to hide total display
    } else if (categoryMap.has("Others") && !categoryMap.has("Miscellaneous Income")) {
      // If only Others exists, rename it to Miscellaneous Income
      const othersCategory = categoryMap.get("Others");
      categoryMap.delete("Others");
      categoryMap.set("Miscellaneous Income", othersCategory);
    }

    const result = {};
    const categoryOrder = [
      "Irrigation Service Fees",
      `Less: ${discountValue}% Discount on Current Account`,
      "Net Irrigation Service Fees",
      "Rent Income",
      "Water Service Fee",
      "Miscellaneous Income"
    ];
    categoryOrder.forEach(categoryName => {
      if (categoryName.includes("Less:") && categoryMap.has(categoryName)) {
        result[categoryName] = categoryMap.get(categoryName);
      } else if (categoryMap.has(categoryName)) {
        result[categoryName] = categoryMap.get(categoryName);
      }
    });
    categoryMap.forEach((value, key) => {
      if (!result[key] && !key.includes("Less:") && !key.includes("Net Irrigation")) {
        result[key] = value;
      }
    });

    return result;
  }, [incomeItems, incomeCategories, categorySubcategories, discountType, discountValue, applyDiscount, subcategoryAmounts]);

  const grandTotal = useMemo(() => {
    // Define categories to include based on discount status
    let irrigationCategory;
    if (applyDiscount && discountValue > 0) {
      // If discount is applied, use Net Irrigation Service Fees
      irrigationCategory = "Net Irrigation Service Fees";
    } else {
      // If no discount, use Irrigation Service Fees (with 's')
      irrigationCategory = "Irrigation Service Fees";
    }
    
    const allowedCategories = [
      irrigationCategory,
      "Rent Income",
      "Water Service Fee",
      "Miscellaneous Income"
    ];

    const total = Object.entries(groupedItems).reduce((total, [categoryName, category]) => {
      const isAllowed = allowedCategories.includes(categoryName);
      const subtotal = category.subtotal || 0;
      
      return isAllowed ? total + subtotal : total;
    }, 0);
    
    return total;
  }, [groupedItems, applyDiscount, discountValue]);

  const handleExportToExcel = useCallback(() => {
    const exportData = [];
    Object.entries(groupedItems).forEach(([categoryName, category]) => {
      exportData.push({
        'Category': categoryName,
        'Subcategory': '',
        'Amount': category.subtotal || 0,
        'Type': 'Category Total',
        'Fiscal Year': fiscalYear,
        'Budget Type': budgetType,
        'Last Updated': lastSaved ? new Date(lastSaved).toLocaleString() : 'Never'
      });
      if (category.subcategories) {
        category.subcategories.forEach(subcategory => {
          const key = `${category.categoryId}-${subcategory}`;
          exportData.push({
            'Category': categoryName,
            'Subcategory': subcategory,
            'Amount': subcategoryAmounts[key] || 0,
            'Type': 'Subcategory',
            'Fiscal Year': fiscalYear,
            'Budget Type': budgetType,
            'Last Updated': lastSaved ? new Date(lastSaved).toLocaleString() : 'Never'
          });
        });
      }
    });
    const headers = Object.keys(exportData[0]);
    const csvContent = [
      headers.join(','),
      ...exportData.map(row => headers.map(header => `"${row[header]}"`).join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Income_Table_${fiscalYear}_${budgetType}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("Income data exported successfully!");
    setExportMenuAnchor(null);
  }, [groupedItems, subcategoryAmounts, fiscalYear, budgetType, lastSaved]);

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) {
      toast.error("Category name cannot be empty");
      return;
    }
    addCategoryMutation.mutate({
      name: newCategoryName,
      type: "income"
    });
  };

  const handleSaveAll = () => {
    const modifiedKeys = Object.keys(userModifiedFields);
    if (modifiedKeys.length === 0) {
      toast.info("No changes to save");
      return;
    }
    const savePromises = modifiedKeys.map(key => {
      const [categoryId, subcategoryName] = key.split('-');
      const category = incomeCategories.find(cat => cat._id === categoryId);
      if (!category) return null;
      const amount = subcategoryAmounts[key] || "0";
      const existingItem = incomeItems.find(item =>
        (item.incomecategory === categoryId || item.incomecategory?._id === categoryId) &&
        item.subcategory === subcategoryName &&
        doesItemBelongToRegion(item, regionFilter)
      );
      const categoryName = category.incomeCategoryName?.trim() || "Unknown Category";
      const incomeData = {
        particulars: subcategoryName,
        cost: Number(amount),
        incomecategory: categoryId,
        subcategory: subcategoryName,
        category: categoryName,
        amount: Number(amount),
        fiscalYear,
        budgetType,
        region: getDefaultRegionForSave(regionFilter),
        processBy: currentUser ? `${currentUser.FirstName} ${currentUser.LastName}` : "User",
        processDate: new Date(),
        ...(proposalId && { proposalId })  // Include proposalId if available
      };
      return existingItem ?
        api.put(`/income/${existingItem._id}`, incomeData) :
        api.post("/income", incomeData);
    }).filter(Boolean);
    Promise.all(savePromises)
      .then(() => {
        toast.success("All changes saved successfully");
        setUserModifiedFields({});
        queryClient.invalidateQueries(["income-items", fiscalYear, budgetType, regionFilter]);
        setHasUnsavedChanges(false);
        setLastSaved(new Date());
      })
      .catch(error => {
        console.error("Error saving changes:", error);
        toast.error(`Error saving changes: ${error.message}`);
      });
  };

  const handleClearUnsaved = () => {
    const modifiedKeys = Object.keys(userModifiedFields);
    if (modifiedKeys.length === 0) {
      toast.info("No unsaved changes to clear");
      return;
    }
    const newSubcategoryAmounts = { ...subcategoryAmounts };
    modifiedKeys.forEach(key => {
      const [categoryId, subcategoryName] = key.split('-');
      const originalItem = incomeItems.find(item =>
        (item.incomecategory === categoryId || item.incomecategory?._id === categoryId) &&
        item.subcategory === subcategoryName
      );
      if (originalItem) {
        newSubcategoryAmounts[key] = Number(originalItem.amount || originalItem.cost || 0).toString();
      } else {
        delete newSubcategoryAmounts[key];
      }
    });
    setSubcategoryAmounts(newSubcategoryAmounts);
    setUserModifiedFields({});
    setHasUnsavedChanges(false);
    toast.info("Unsaved changes cleared");
  };

  useEffect(() => {
    if (autoSave && hasUnsavedChanges) {
      const timer = setTimeout(() => {
        handleSaveAll();
        setLastSaved(new Date());
      }, 3000);
      setAutoSaveTimer(timer);
      return () => clearTimeout(timer);
    }
  }, [autoSave, hasUnsavedChanges, handleSaveAll]);

  const handleAddSubcategoryField = (categoryId) => {
    setAddingToCategoryId(categoryId);
    setNewSubcategories(prev => ({ ...prev, [categoryId]: "" }));
  };

  const handleNewSubcategoryChange = (categoryId, value) => {
    setNewSubcategories(prev => ({ ...prev, [categoryId]: value }));
  };

  const handleSaveNewSubcategory = (categoryId) => {
    const newSubcategoryName = newSubcategories[categoryId]?.trim();
    if (!newSubcategoryName) {
      toast.error("Subcategory name cannot be empty");
      return;
    }
    const category = incomeCategories.find(cat => cat._id === categoryId);
    if (!category) {
      toast.error("Category not found");
      return;
    }
    if (category.incomeSubcategoryName?.some(subcat =>
      (typeof subcat === 'object' ? subcat.incomeSubcategoryName || subcat.name : subcat).trim() === newSubcategoryName
    )) {
      toast.error("This subcategory already exists");
      return;
    }
    const updateCategoryMutation = useMutation({
      mutationFn: async () => {
        const updatedSubcategories = [...(category.incomeSubcategoryName || []), newSubcategoryName];
        return api.put(`/income-categories/${categoryId}`, {
          ...category,
          incomeSubcategoryName: updatedSubcategories
        });
      },
      onSuccess: () => {
        handleRefresh();
        toast.success("Subcategory added successfully");
        setNewSubcategories(prev => ({ ...prev, [categoryId]: "" }));
        setAddingToCategoryId(null);
      },
      onError: (error) => {
        toast.error(`Error adding subcategory: ${error.message}`);
      }
    });
    updateCategoryMutation.mutate();
  };

  const handleCancelAddSubcategory = (categoryId) => {
    setNewSubcategories(prev => ({ ...prev, [categoryId]: "" }));
    setAddingToCategoryId(null);
  };

  useEffect(() => {
    if (onGrandTotalUpdate) {
      onGrandTotalUpdate(grandTotal); // Always update, even if 0
    }
  }, [grandTotal, onGrandTotalUpdate, regionFilter]);

  useEffect(() => {
    if (typeof onGroupedItemsUpdate === 'function') {
      onGroupedItemsUpdate(groupedItems);
    }
  }, [groupedItems, onGroupedItemsUpdate]);

  useEffect(() => {
    if (incomeItems.length > 0) {
      const initialAmounts = {};
      incomeItems.forEach(item => {
        if (item.incomecategory && item.subcategory && checkRegionMatch(item)) {
          const categoryId = item.incomecategory._id || item.incomecategory;
          const key = `${categoryId}-${item.subcategory}`;
          if (!userModifiedFields[key]) {
            initialAmounts[key] = (parseFloat(initialAmounts[key] || 0) + parseFloat(item.amount || item.cost || 0)).toString();
          }
        }
      });
      setSubcategoryAmounts(prev => ({
        ...prev,
        ...Object.keys(initialAmounts).reduce((acc, key) => {
          if (!userModifiedFields[key]) {
            acc[key] = initialAmounts[key];
          }
          return acc;
        }, {})
      }));
    }
  }, [incomeItems, userModifiedFields]);

  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box display="flex" alignItems="center" gap={2}>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSaveAll}
              disabled={locked || !hasUnsavedChanges}
              sx={{ minWidth: 120 }}
            >
              {hasUnsavedChanges ? 'Save Changes' : 'Saved'}
            </Button>
            <Button
              variant="outlined"
              startIcon={<CancelIcon />}
              onClick={handleClearUnsaved}
              disabled={locked || !hasUnsavedChanges}
              sx={{ minWidth: 120 }}
            >
              Clear Changes
            </Button>
            <FormControlLabel
              control={
                <Switch
                  checked={autoSave}
                  onChange={(e) => {
                    if (locked) return;
                    setAutoSave(e.target.checked);
                    toast.info(`Auto-save ${e.target.checked ? 'enabled' : 'disabled'}`, { autoClose: 3000 });
                  }}
                  color="primary"
                />
              }
              label={
                <Box display="flex" alignItems="center" gap={1}>
                  <SaveIcon fontSize="small" color={autoSave ? "primary" : "disabled"} />
                  <Typography variant="body2" color={autoSave ? "primary" : "text.secondary"}>
                    Auto-save {autoSave ? "(ON)" : "(OFF)"}
                  </Typography>
                </Box>
              }
            />
            {lastSaved && (
              <Chip
                icon={<CheckCircleIcon />}
                label={`Last saved: ${new Date(lastSaved).toLocaleTimeString()}`}
                color="success"
                variant="outlined"
                size="small"
              />
            )}
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <Tooltip title="Export data">
              <IconButton onClick={(e) => setExportMenuAnchor(e.currentTarget)} color="primary">
                <GetAppIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Refresh data">
              <span>
                <IconButton onClick={handleRefresh} color="primary" disabled={isLoading}>
                  {isLoading ? <CircularProgress size={24} /> : <RefreshIcon />}
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Toggle compact view">
              <IconButton
                onClick={() => setCompactView(!compactView)}
                color={compactView ? "primary" : "default"}
              >
                <VisibilityIcon />
              </IconButton>
            </Tooltip>
            <Button
              variant="outlined"
              startIcon={<SettingsIcon />}
              onClick={handleOpenDiscountSettings}
            >
              Discount Settings
            </Button>
          </Box>
        </Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box display="flex" alignItems="center" gap={2}>
            <Tooltip title="Expand all categories">
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  const allCategories = Object.keys(groupedItems);
                  setExpandedCategories(Object.fromEntries(allCategories.map(cat => [cat, true])));
                }}
                startIcon={<ExpandMoreIcon />}
                sx={{ minWidth: 'auto', px: 2 }}
              >
                Expand All
              </Button>
            </Tooltip>
            <Tooltip title="Collapse all categories">
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  const allCategories = Object.keys(groupedItems);
                  setExpandedCategories(Object.fromEntries(allCategories.map(cat => [cat, false])));
                }}
                startIcon={<ExpandMoreIcon sx={{ transform: 'rotate(-90deg)' }} />}
                sx={{ minWidth: 'auto', px: 2 }}
              >
                Collapse All
              </Button>
            </Tooltip>
            <TextField
              size="small"
              placeholder="Search categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ width: 250 }}
              InputProps={{
                startAdornment: (
                  <Box sx={{ mr: 1, display: 'flex', alignItems: 'center' }}>
                    <InfoIcon fontSize="small" color="action" />
                  </Box>
                ),
              }}
            />
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <FormControlLabel
              control={
                <Switch
                  checked={compactView}
                  onChange={(e) => setCompactView(e.target.checked)}
                  color="primary"
                  size="small"
                />
              }
              label={<Typography variant="body2" color="text.secondary">Compact View</Typography>}
            />
          </Box>
        </Box>
      </Box>
      {showSummaryCard && (
        <Fade in={showSummaryCard}>
          <Card sx={{ mb: 3, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
            <CardContent sx={{ py: 2 }}>
              <Grid container spacing={3} alignItems="center">
                <Grid item xs={12} md={3}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <AccountBalanceIcon sx={{ color: 'white', fontSize: 28 }} />
                    <Box>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                        Grand Total
                      </Typography>
                      <Typography variant="h6" sx={{ color: 'white', fontWeight: 'bold' }}>
                        {Number(grandTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <InfoIcon sx={{ color: 'white', fontSize: 24 }} />
                    <Box>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                        Fiscal Year
                      </Typography>
                      <Typography variant="body1" sx={{ color: 'white', fontWeight: 'medium' }}>
                        {fiscalYear || 'Not Set'}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <TrendingUpIcon sx={{ color: 'white', fontSize: 24 }} />
                    <Box>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                        Budget Type
                      </Typography>
                      <Typography variant="body1" sx={{ color: 'white', fontWeight: 'medium' }}>
                        {budgetType || 'Not Set'}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Box display="flex" alignItems="center" gap={1}>
                    {hasUnsavedChanges ? (
                      <WarningIcon sx={{ color: '#ffeb3b', fontSize: 24 }} />
                    ) : (
                      <CheckCircleIcon sx={{ color: '#4caf50', fontSize: 24 }} />
                    )}
                    <Box>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                        Status
                      </Typography>
                      <Typography variant="body1" sx={{ color: 'white', fontWeight: 'medium' }}>
                        {hasUnsavedChanges ? 'Unsaved Changes' : 'Up to Date'}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Fade>
      )}
      <Zoom in={true}>
        <Paper elevation={3} sx={{ width: '100%', overflow: 'hidden', borderRadius: 2, boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress size={40} sx={{ color: '#375e38' }} />
            </Box>
          ) : (
            <TableContainer sx={{
              maxHeight: compactView ? '60vh' : '70vh',
              '&::-webkit-scrollbar': { width: '8px' },
              '&::-webkit-scrollbar-track': { background: '#f1f1f1', borderRadius: '4px' },
              '&::-webkit-scrollbar-thumb': { background: '#c1c1c1', borderRadius: '4px', '&:hover': { background: '#a8a8a8' } }
            }}>
              <Table size={compactView ? "small" : "medium"} stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ bgcolor: '#375e38', color: 'white', fontWeight: 'bold', width: '45%', position: 'sticky', top: 0, zIndex: 2, fontSize: compactView ? '0.875rem' : '1rem', py: compactView ? 1 : 2 }}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <AccountBalanceIcon fontSize="small" />
                        CATEGORIES
                      </Box>
                    </TableCell>
                    <TableCell sx={{ bgcolor: '#375e38', color: 'white', fontWeight: 'bold', width: '40%', position: 'sticky', top: 0, zIndex: 2, fontSize: compactView ? '0.875rem' : '1rem', py: compactView ? 1 : 2 }}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <InfoIcon fontSize="small" />
                        SUB-CATEGORIES
                      </Box>
                    </TableCell>
                    <TableCell sx={{ bgcolor: '#375e38', color: 'white', fontWeight: 'bold', width: '15%', position: 'sticky', top: 0, zIndex: 2, fontSize: compactView ? '0.875rem' : '1rem', py: compactView ? 1 : 2 }} align="right">
                      <Box display="flex" alignItems="center" justifyContent="flex-end" gap={1}>
                        <TrendingUpIcon fontSize="small" />
                        AMOUNT
                      </Box>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(groupedItems)
                    .filter(([categoryName]) => !searchTerm || categoryName.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map(([categoryName, category]) => {
                      const isExpanded = expandedCategories[categoryName] !== false;
                      const hasSubcategories = category.subcategories && category.subcategories.length > 0;

                      return (
                        <React.Fragment key={categoryName}>
                          <TableRow sx={{
                            bgcolor: category.isNetIsf ? '#e8f5e9' : category.isDiscount ? '#ffebee' : hasSubcategories ? '#f8f9fa' : 'white',
                            '&:hover': { backgroundColor: category.isNetIsf ? '#e0f2f1' : category.isDiscount ? '#ffcdd2' : hasSubcategories ? '#e3f2fd' : 'rgba(0, 0, 0, 0.04)' },
                            cursor: hasSubcategories ? 'pointer' : 'default',
                            transition: 'all 0.2s ease',
                            borderLeft: hasSubcategories ? '4px solid #1976d2' : 'none'
                          }}>
                            <TableCell sx={{
                              fontWeight: 'bold',
                              color: category.isDiscount ? '#d32f2f' : category.isNetIsf ? '#2e7d32' : hasSubcategories ? '#1976d2' : 'inherit',
                              fontStyle: category.isDiscount ? 'italic' : 'normal',
                              fontSize: compactView ? '0.875rem' : '1rem',
                              py: compactView ? 1 : 1.5
                            }} onClick={() => hasSubcategories && setExpandedCategories(prev => ({ ...prev, [categoryName]: !isExpanded }))}>
                              <Box display="flex" alignItems="center" gap={1}>
                                {hasSubcategories && (
                                  <Tooltip title={isExpanded ? "Collapse category" : "Expand category"}>
                                    <IconButton size="small" sx={{ p: 0.5, color: '#1976d2', '&:hover': { backgroundColor: 'rgba(25, 118, 210, 0.08)' } }}>
                                      <ExpandMoreIcon sx={{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.3s ease' }} />
                                    </IconButton>
                                  </Tooltip>
                                )}
                                {category.isNetIsf ? (
                                  <CheckCircleIcon sx={{ fontSize: 20, color: '#2e7d32' }} />
                                ) : category.isDiscount ? (
                                  <WarningIcon sx={{ fontSize: 20, color: '#d32f2f' }} />
                                ) : hasSubcategories ? (
                                  <AccountBalanceIcon sx={{ fontSize: 20, color: '#1976d2' }} />
                                ) : (
                                  <InfoIcon sx={{ fontSize: 20, color: '#757575' }} />
                                )}
                                <Typography variant={compactView ? "body2" : "body1"} sx={{ fontWeight: 'bold' }}>
                                  {categoryName}
                                </Typography>
                                {hasSubcategories && (
                                  <Chip label={`${category.subcategories?.length || 0} items`} size="small" color="primary" variant="outlined" sx={{ ml: 'auto', fontSize: '0.7rem' }} />
                                )}
                              </Box>
                            </TableCell>
                            <TableCell sx={{ fontSize: compactView ? '0.875rem' : '1rem' }}>
                              {hasSubcategories && (
                                <Typography variant="body2" color="text.secondary">
                                  {isExpanded ? 'Click to collapse' : 'Click to expand'}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: compactView ? '0.875rem' : '1rem', color: category.subtotal > 0 ? '#2e7d32' : '#757575' }}>
                              {category.hideTotal ? '-' : formatNumber(category.subtotal).replace('₱', '')}
                            </TableCell>
                          </TableRow>
                          {hasSubcategories && isExpanded && category.subcategories.map((subcategory, index) => {
                            const subcategoryName = typeof subcategory === 'object' ? (subcategory.incomeSubcategoryName || subcategory.name) : subcategory;
                            const cleanSubcategoryName = subcategoryName.trim();
                            const key = `${category.categoryId}-${cleanSubcategoryName}`;
                            const amount = subcategoryAmounts[key] || '';
                            return (
                              <TableRow key={`${categoryName}-${cleanSubcategoryName}-${index}`}>
                                <TableCell></TableCell>
                                <TableCell>{cleanSubcategoryName}</TableCell>
                                <TableCell align="right">
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'flex-end' }}>
                                    <TextField
                                      size="small"
                                      value={amount}
                                      onChange={(e) => !locked && handleSubcategoryAmountChange(category.categoryId, cleanSubcategoryName, e.target.value)}
                                      onBlur={() => !locked && autoSave && userModifiedFields[key] && amount && parseFloat(amount) > 0 &&
                                        handleSaveSubcategoryAmount(category, cleanSubcategoryName)}
                                      InputProps={{
                                        inputComponent: NumberFormatCustom,
                                        inputProps: { style: { textAlign: 'right' } }
                                      }}
                                      disabled={locked}
                                      sx={{ width: '120px', '& .MuiInputBase-root': { display: 'flex', justifyContent: 'flex-end' } }}
                                    />
                                  </Box>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          {/* Removed Add Item button as requested */}
                          {addingToCategoryId === category.categoryId && (
                            <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                              <TableCell></TableCell>
                              <TableCell>
                                <TextField
                                  size="small"
                                  fullWidth
                                  placeholder="New subcategory name"
                                  value={newSubcategories[category.categoryId] || ''}
                                  onChange={(e) => handleNewSubcategoryChange(category.categoryId, e.target.value)}
                                />
                              </TableCell>
                              <TableCell align="right">
                                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                                  <IconButton color="primary" onClick={() => !locked && handleSaveNewSubcategory(category.categoryId)} size="small" disabled={locked}>
                                    <SaveIcon />
                                  </IconButton>
                                  <IconButton color="secondary" onClick={() => handleCancelAddSubcategory(category.categoryId)} size="small" disabled={locked}>
                                    <CancelIcon />
                                  </IconButton>
                                </Box>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#375e38', color: 'white', position: 'sticky', bottom: 0, zIndex: 1 }}>
                      Grand Total
                    </TableCell>
                    <TableCell sx={{ bgcolor: '#375e38', color: 'white', position: 'sticky', bottom: 0, zIndex: 1 }}></TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: '#375e38', color: 'white', position: 'sticky', bottom: 0, zIndex: 1 }}>
                      {formatNumber(grandTotal).replace('₱', '')}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Zoom>
      <Menu
        anchorEl={exportMenuAnchor}
        open={Boolean(exportMenuAnchor)}
        onClose={() => setExportMenuAnchor(null)}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={handleExportToExcel}>
          <GetAppIcon sx={{ mr: 1 }} />
          Export to CSV
        </MenuItem>
      </Menu>
      <Dialog open={discountSettingsOpen} onClose={handleCloseDiscountSettings} maxWidth="sm" fullWidth>
        <DialogTitle>ISF Discount Settings {regionFilter ? `for ${regionFilter}` : '(Please select a region)'}</DialogTitle>
        <DialogContent>
          {!regionFilter && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Please select a region first. Discount settings are region-specific.
            </Alert>
          )}
          <Box sx={{ mt: 2 }}>
            <FormControlLabel
              control={<Switch checked={applyDiscount} onChange={handleApplyDiscountChange} color="primary" disabled={!regionFilter} />}
              label="Apply discount to ISF"
            />
          </Box>
          {applyDiscount && (
            <>
              <FormControl fullWidth sx={{ mt: 2 }}>
                <InputLabel>Discount Type</InputLabel>
                <Select value={discountType} onChange={handleDiscountTypeChange} label="Discount Type" disabled={!regionFilter}>
                  <MenuItem value="percentage">Percentage (%)</MenuItem>
                  <MenuItem value="fixed">Fixed Amount (₱)</MenuItem>
                </Select>
              </FormControl>
              {discountType === "percentage" ? (
                <TextField
                  label="Discount Percentage"
                  type="number"
                  value={discountValue}
                  onChange={handleDiscountValueChange}
                  fullWidth
                  margin="normal"
                  disabled={!regionFilter}
                  InputProps={{ endAdornment: <Typography>%</Typography>, inputProps: { min: 0, max: 100 } }}
                />
              ) : (
                <TextField
                  label="Discount Amount"
                  value={discountValue}
                  onChange={handleDiscountValueChange}
                  fullWidth
                  margin="normal"
                  disabled={!regionFilter}
                  InputProps={{ inputComponent: NumberFormatCustom }}
                />
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDiscountSettings}>Cancel</Button>
          <Button onClick={handleSaveDiscountSettings} color="primary" variant="contained" disabled={savingSettings || !regionFilter}>
            {savingSettings ? <CircularProgress size={24} /> : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <DialogContentText>Are you sure you want to delete this item? This action cannot be undone.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)} color="primary" variant="outlined">Cancel</Button>
          <Button onClick={() => deleteItemMutation.mutate(itemToDelete)} color="error" variant="contained" autoFocus>Delete</Button>
        </DialogActions>
      </Dialog>
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
    </Paper>
  );
};

export default React.memo(IncomeTable);