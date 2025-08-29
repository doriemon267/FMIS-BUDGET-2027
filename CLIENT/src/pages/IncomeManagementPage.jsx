import React, { useEffect, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Alert,
  Chip,
  Stack,
  useTheme,
  alpha,
  IconButton,
  Tooltip,
  Grid,
  Card,
  CardContent,
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  Checkbox,
  ListItemText,
  Autocomplete,
  Snackbar,
  CircularProgress,
  FormGroup,
  FormControlLabel
} from "@mui/material";
import { MdCategory, MdList, MdAttachMoney, MdAdd, MdEdit, MdDelete } from "react-icons/md";
import RefreshIcon from "@mui/icons-material/Refresh";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import CategoryIcon from "@mui/icons-material/Category";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import CustomAutoComplete from "../global/components/CustomAutoComplete";
// Import existing components
import IncomeCategoriesCustomPage from "../components/incomecategories/IncomeCategoriesCustomPage";
import { useRegion } from "../context/RegionContext";
import api from "../config/api";
import { useForm } from "react-hook-form";

const IncomeManagementPage = () => {
  const theme = useTheme();
  const { availableRegions } = useRegion(); // Use dynamic regions from context
  const [incomeCategories, setIncomeCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [allSubcategories, setAllSubcategories] = useState([]);

  useEffect(() => {
    api.get("/getAllIncomeCategories")
      .then(res => setIncomeCategories(res.data.incomeCategory || []))
      .catch(() => setIncomeCategories([]));
    // Fetch all subcategories on mount
    api.get("/getAllIncomeSubcategories")
      .then(res => setAllSubcategories(res.data.data.incomeSubcategories))
      .catch(() => setAllSubcategories([]));
  }, []);
  const { control } = useForm();
  
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Dialog states for category management with inline subcategories
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryForm, setCategoryForm] = useState({
    incomeCategoryName: '',
    description: '',
    incomeSubcategories: [], // Array of subcategory names
    isGlobal: false,
    regions: []
  });

  // Toast notification state
  const [toast, setToast] = useState({
    open: false,
    message: '',
    severity: 'info' // 'success', 'error', 'warning', 'info'
  });

  // Manual input for subcategories
  const [manualInput, setManualInput] = useState('');

  // Auto-hide toast after 6 seconds
  useEffect(() => {
    if (toast.open) {
      const timer = setTimeout(() => {
        setToast(prev => ({ ...prev, open: false }));
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [toast.open]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch categories only - subcategories are now part of categories
        const categoriesRes = await api.get("/income-categories");
        
        const categoriesData = categoriesRes.data.incomeCategories || categoriesRes.data.categories || categoriesRes.data || [];
        
        // Ensure we always have an array
        const safeCategoriesData = Array.isArray(categoriesData) ? categoriesData : [];
        
        // Debug log to check data structure
        
        setCategories(safeCategoriesData);

        // Always clear error when we successfully fetch data, even if it's empty
        setError(null);
        
        if (safeCategoriesData.length === 0) {
        } else {
        }
      } catch (err) {
        console.error("Failed to fetch income data", err);
        console.error("Error details:", err.response?.data);
        
        // More specific error messages
        if (err.code === 'NETWORK_ERROR' || err.message.includes('Network Error')) {
          setError("Network connection failed. Please check your internet connection and server status.");
        } else if (err.response?.status === 404) {
          setError("Income categories endpoint not found. Please contact system administrator.");
        } else if (err.response?.status === 500) {
          setError("Server error occurred. Please try again later or contact support.");
        } else {
          setError(`Failed to load income data: ${err.message}. Please try refreshing the page.`);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [refreshTrigger]);

  const handleRefresh = () => {
    
    setRefreshTrigger(prev => {
      const newValue = prev + 1;
      return newValue;
    });
    
    // Show toast notification only for manual refresh
    if (arguments.length > 0 && arguments[0] === 'manual') {
      setToast({
        open: true,
        message: 'Refreshing income categories...',
        severity: 'info'
      });
    }
  };

  // Function to add manual subcategory
  const addManualSubcategory = () => {
    const trimmedInput = manualInput.trim();
    if (trimmedInput && !categoryForm.incomeSubcategories.includes(trimmedInput)) {
      setCategoryForm(prev => ({
        ...prev,
        incomeSubcategories: [...prev.incomeSubcategories, trimmedInput]
      }));
      setManualInput('');
    }
  };

  // Category management functions
  const handleCreateCategory = () => {
    setEditingCategory(null);
    setSelectedCategory(null);
    const initialForm = {
      incomeCategoryName: '',
      description: '',
      incomeSubcategories: [],
      isGlobal: false,
      regions: []
    };
    setCategoryForm(initialForm);
    setManualInput('');
    setCategoryDialogOpen(true);
  };

  const handleEditCategory = (category) => {
    setEditingCategory(category);
    // Find the matching category object from incomeCategories for Autocomplete
    const matchedCategory = incomeCategories.find(cat => cat._id === category._id) || category;
    setSelectedCategory(matchedCategory);

    // Debug: log selected category and all subcategories
    console.log('Editing category:', category);
    console.log('Matched category:', matchedCategory);
    console.log('All subcategories:', allSubcategories);

    // Extract subcategories from the category being edited
    let subcategories = [];
    
    // Try different possible field names for subcategories
    if (category.incomeSubcategories && Array.isArray(category.incomeSubcategories)) {
      subcategories = [...category.incomeSubcategories];
    } else if (category.incomeSubcategoryName && Array.isArray(category.incomeSubcategoryName)) {
      subcategories = [...category.incomeSubcategoryName];
    } else if (category.incomeSubcategoryName && typeof category.incomeSubcategoryName === 'string') {
      subcategories = category.incomeSubcategoryName.split(',').map(s => s.trim()).filter(s => s);
    }

    console.log('Extracted subcategories:', subcategories);

    setCategoryForm({
      incomeCategoryName: category.incomeCategoryName || '',
      description: category.description || '',
      incomeSubcategories: subcategories,
      isGlobal: category.isGlobal || false,
      regions: category.regions || []
    });
    
    // Clear manual input
    setManualInput('');
    
    setCategoryDialogOpen(true);
  };

  const handleDeleteCategory = async (categoryId) => {
    if (window.confirm('Are you sure you want to delete this income category?')) {
      try {
        await api.delete(`/income-categories/${categoryId}`);
        handleRefresh();
      } catch (error) {
        console.error('Error deleting category:', error);
        alert('Failed to delete category');
      }
    }
  };

  const handleSubmitCategory = async () => {
    try {
      
      // Ensure we have the subcategories array
      const subcategoriesArray = Array.isArray(categoryForm.incomeSubcategories) 
        ? categoryForm.incomeSubcategories 
        : [];

      const payload = {
        incomeCategoryName: categoryForm.incomeCategoryName,
        description: categoryForm.description,
        incomeSubcategoryName: subcategoriesArray, // This is what the backend expects
        incomeSubcategories: subcategoriesArray, // Keep this for future compatibility
        isGlobal: categoryForm.isGlobal,
        regions: categoryForm.regions
      };

      let response;
      if (editingCategory) {
        response = await api.put(`/income-categories/${editingCategory._id}`, payload);
      } else {
        response = await api.post('/income-categories', payload);
      }

      // Show success toast
      setToast({
        open: true,
        message: editingCategory ? 'Income category updated successfully! Table will refresh automatically.' : 'Income category created successfully! Table will refresh automatically.',
        severity: 'success'
      });
      
      // Reset form
      setCategoryForm({
        incomeCategoryName: '',
        description: '',
        incomeSubcategories: [],
        isGlobal: false, // Default to Region Specific instead of NIA Wide
        regions: []
      });
      
      // Clear all dialog states
      setEditingCategory(null);
      setSelectedCategory(null);
      setManualInput('');
      
      setCategoryDialogOpen(false);
      
      // Trigger immediate refresh with a small delay to ensure backend processing
      setTimeout(() => {
        handleRefresh();
      }, 100);
    } catch (error) {
      console.error('Error saving category:', error);
      console.error('Error details:', error.response?.data);
      
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.message || 
                          error.message || 
                          'Unknown error occurred';
      
      // Show error toast
      setToast({
        open: true,
        message: `Failed to save category: ${errorMessage}`,
        severity: 'error'
      });
    }
  };

  // Calculate stats from categories - aligned with Corporate Income table structure
  const totalSubcategories = Array.isArray(categories) ? categories.reduce((total, cat) => {
    // Check for incomeSubcategoryName field (primary field used in Corporate Income)
    if (cat.incomeSubcategoryName && Array.isArray(cat.incomeSubcategoryName)) {
      return total + cat.incomeSubcategoryName.filter(sub => sub && sub.trim()).length;
    }
    // Fallback to string splitting if it's a comma-separated string
    if (cat.incomeSubcategoryName && typeof cat.incomeSubcategoryName === 'string') {
      const subs = cat.incomeSubcategoryName.split(',').map(s => s.trim()).filter(s => s);
      return total + subs.length;
    }
    // Check for the form field (incomeSubcategories)
    if (cat.incomeSubcategories && Array.isArray(cat.incomeSubcategories)) {
      return total + cat.incomeSubcategories.filter(sub => sub && sub.trim()).length;
    }
    return total;
  }, 0) : 0;

  const globalCategories = Array.isArray(categories) ? categories.filter(cat => cat.isGlobal === true).length : 0;
  const regionalCategories = Array.isArray(categories) ? categories.filter(cat => cat.isGlobal !== true).length : 0;

  // Simplified Income Categories Schema - subcategories are now inline
  const incomeCategoriesSchema = {
    action: {
      type: "action",
      label: "Actions",
      show: true,
    },
    incomeCategoryName: {
      type: "text",
      label: "Category Name",
      searchable: true,
      show: true,
    },
    description: {
      type: "text",
      label: "Description",
      searchable: true,
      show: true,
    },
    incomeSubcategories: {
      type: "array",
      label: "Income Subcategories",
      searchable: true,
      show: true,
      helperText: "Type subcategory names and press Enter to add them (e.g., Tax Revenue, Service Fees, etc.)",
      customRender: (row) => {
        // Handle both incomeSubcategories and incomeSubcategoryName for backward compatibility
        let subcategories = [];
        if (row.incomeSubcategories && Array.isArray(row.incomeSubcategories)) {
          subcategories = row.incomeSubcategories;
        } else if (row.incomeSubcategoryName && Array.isArray(row.incomeSubcategoryName)) {
          subcategories = row.incomeSubcategoryName;
        } else if (row.incomeSubcategoryName && typeof row.incomeSubcategoryName === 'string') {
          // Handle case where it might be a comma-separated string
          subcategories = row.incomeSubcategoryName.split(',').map(s => s.trim()).filter(s => s);
        }
        
        if (subcategories.length === 0) {
          return (
            <Typography variant="body2" color="text.secondary" fontStyle="italic">
              No subcategories
            </Typography>
          );
        }

        // Show as comma-separated text for all cases
        return (
          <Box sx={{ maxWidth: 600 }}>
            <Typography variant="body2" sx={{ fontSize: '0.875rem', lineHeight: 1.4 }}>
              {subcategories.join(', ')}
            </Typography>
            <Typography variant="caption" color="primary" fontWeight="bold">
              {subcategories.length} subcategory{subcategories.length !== 1 ? 'ies' : ''}
            </Typography>
          </Box>
        );
      },
    },
    isGlobal: {
      label: "Access",
      type: "boolean", 
      show: true,
      customRender: (row) => (
        <Chip 
          label={row.isGlobal ? "NIA Wide" : "Region-Specific"} 
          size="small" 
          color={row.isGlobal ? "success" : "warning"}
          variant="outlined"
        />
      )
    },
    regions: {
      label: "Regions",
      type: "array",
      show: true,
      searchable: false,
      customRender: (row) => {
        if (row.isGlobal) {
          return (
            <Chip 
              label="NIA Wide (All Regions including Central Office)" 
              size="small" 
              color="primary" 
              variant="filled"
              sx={{ 
                fontWeight: 'bold',
                fontSize: '0.75rem',
                '& .MuiChip-label': {
                  px: 1.5
                }
              }}
            />
          );
        }
        
        const regions = row.regions || [];
        
        if (regions.length === 0) {
          return (
            <Chip
              label="No regions assigned"
              size="small"
              color="warning"
              variant="outlined"
            />
          );
        }
        
        if (regions.length <= 2) {
          return (
            <Stack direction="row" spacing={0.5} flexWrap="wrap">
              {regions.map((region) => (
                <Chip
                  key={region}
                  label={region}
                  size="small"
                  color="secondary"
                  variant="outlined"
                />
              ))}
            </Stack>
          );
        }
        
        return (
          <Box>
            <Stack direction="row" spacing={0.5} alignItems="center" mb={0.5}>
              {regions.slice(0, 2).map((region) => (
                <Chip
                  key={region}
                  label={region}
                  size="small"
                  color="secondary"
                  variant="outlined"
                />
              ))}
            </Stack>
            <Typography variant="caption" color="text.secondary">
              +{regions.length - 2} more regions
            </Typography>
          </Box>
        );
      }
    },
  };

  const getFilteredSubcategories = (selectedCatId, editingCategory) => {
    // First, try to match by category ID
    let filtered = allSubcategories.filter(sub => {
      if (typeof sub.category === 'object' && sub.category !== null) {
        return sub.category._id === selectedCatId;
      }
      return sub.category === selectedCatId;
    });
    // If none found, try to match by parent category name
    if (filtered.length === 0 && selectedCatId) {
      // Find the selected category name from incomeCategories or fallback to editingCategory
      let selectedCatObj = incomeCategories.find(cat => cat._id?.toString() === selectedCatId);
      let selectedCatName = selectedCatObj?.name || selectedCatObj?.incomeCategoryName;
      // Fallback: use editingCategory if not found
      if (!selectedCatName && typeof editingCategory === 'object' && editingCategory !== null) {
        selectedCatName = editingCategory.name || editingCategory.incomeCategoryName;
      }
      if (selectedCatName) {
        filtered = allSubcategories.filter(sub => {
          // If sub.category is an ID, look up its parent category name
          if (typeof sub.category === 'string') {
            const parentCatObj = incomeCategories.find(cat => cat._id?.toString() === sub.category);
            let parentCatName = parentCatObj?.name || parentCatObj?.incomeCategoryName;
            // Fallback: use categories array if not found
            if (!parentCatName && Array.isArray(categories)) {
              const altCatObj = categories.find(cat => cat._id?.toString() === sub.category);
              parentCatName = altCatObj?.name || altCatObj?.incomeCategoryName;
            }
            return parentCatName === selectedCatName;
          }
          // If sub.category is an object, match by name
          if (typeof sub.category === 'object' && sub.category !== null) {
            return (sub.category.name || sub.category.incomeCategoryName) === selectedCatName;
          }
          return false;
        });
      }
    }
    return filtered;
  };

  // Utility function to sort regions with 'Central Office' always first
  function sortRegionsWithCentralFirst(regions) {
    if (!Array.isArray(regions)) return regions;
    const central = regions.filter(r =>
      typeof r === 'string' ? r.toLowerCase().includes('central office') : (r.name || r.regionName || '').toLowerCase().includes('central office')
    );
    const others = regions.filter(r =>
      !(typeof r === 'string' ? r.toLowerCase().includes('central office') : (r.name || r.regionName || '').toLowerCase().includes('central office'))
    ).sort((a, b) => {
      const aName = typeof a === 'string' ? a : (a.name || a.regionName || a);
      const bName = typeof b === 'string' ? b : (b.name || b.regionName || b);
      return aName.localeCompare(bName);
    });
    return [...central, ...others];
  }

  // Utility function to custom sort regions: Central Office, MARIIS, UPRIIS, then Region 1, Region 2, etc.
  function customSortRegions(regions) {
    if (!Array.isArray(regions)) return regions;
    const getName = r => (typeof r === 'string' ? r : (r.name || r.regionName || r)).trim();
    // Normalize names for matching
    const normalize = name => name.toLowerCase().replace(/\s+/g, ' ').trim();
    // Priority order
    const priorityOrder = [
      'central office',
      'mariis',
      'upriis'
    ];
    // Separate regions
    const priorityRegions = [];
    const regionNumbered = [];
    const others = [];
    regions.forEach(r => {
      const name = getName(r);
      const norm = normalize(name);
      if (priorityOrder.includes(norm)) {
        priorityRegions.push({ region: r, order: priorityOrder.indexOf(norm) });
      } else if (/^region\s*[ivxlc0-9]+$/i.test(name)) {
        // Match REGION I, REGION II, REGION III, etc. (Roman or Arabic numerals)
        // Extract number (Roman or Arabic)
        const numStr = name.replace(/region\s*/i, '').trim();
        // Convert Roman numerals to number
        const romanMap = {I:1,II:2,III:3,IV:4,V:5,VI:6,VII:7,VIII:8,IX:9,X:10,XI:11,XII:12,XIII:13,XIV:14,XV:15,XVI:16,XVII:17,XVIII:18,XIX:19,XX:20};
        let num = parseInt(numStr);
        if (isNaN(num)) num = romanMap[numStr.toUpperCase()] || 999;
        regionNumbered.push({ region: r, num });
      } else {
        others.push(r);
      }
    });
    // Sort priority regions by their order
    priorityRegions.sort((a, b) => a.order - b.order);
    // Sort regionNumbered by num
    regionNumbered.sort((a, b) => a.num - b.num);
    // Sort others alphabetically
    others.sort((a, b) => getName(a).localeCompare(getName(b)));
    // Return in desired order
    return [
      ...priorityRegions.map(x => x.region),
      ...regionNumbered.map(x => x.region),
      ...others
    ];
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Enhanced Header Section */}
      <Paper
        elevation={3}
        sx={{
          p: 3,
          mb: 3,
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
          color: "white",
          borderRadius: "16px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Stack direction="row" alignItems="center" spacing={2}>
            <Box
              sx={{
                p: 1.5,
                borderRadius: '12px',
                backgroundColor: alpha('#fff', 0.15),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <MdAttachMoney size={32} />
            </Box>
            <Box>
              <Typography variant="h4" fontWeight="bold" gutterBottom sx={{ mb: 0.5 }}>
                Income Management System
              </Typography>
              <Typography variant="h6" sx={{ opacity: 0.9, fontWeight: 400 }}>
                Unified interface for managing income categories and subcategories
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.8, mt: 0.5 }}>
                Create, edit, and organize income categories with regional or global scope
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Add New Category">
              <IconButton
                sx={{
                  color: "white",
                  backgroundColor: alpha("#fff", 0.1),
                  "&:hover": {
                    backgroundColor: alpha("#fff", 0.2),
                    transform: "scale(1.05)",
                  },
                  transition: "all 0.2s ease-in-out",
                }}
                onClick={handleCreateCategory}
              >
                <MdAdd />
              </IconButton>
            </Tooltip>
            <Tooltip title="Refresh Data">
              <IconButton
                sx={{
                  color: "white",
                  backgroundColor: alpha("#fff", 0.1),
                  "&:hover": {
                    backgroundColor: alpha("#fff", 0.2),
                    transform: "scale(1.05)",
                  },
                  transition: "all 0.2s ease-in-out",
                }}
                onClick={() => handleRefresh('manual')}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>

      {/* Stats Cards - Styled like CompensationSettingsPage */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Total Categories */}
        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              height: '100%',
              background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
              border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: `0 8px 25px ${alpha(theme.palette.primary.main, 0.3)}`,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.4)}`
              }
            }}
          >
            <CardContent sx={{ p: 2 }}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    backgroundColor: theme.palette.primary.main,
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem'
                  }}
                >
                  <CategoryIcon sx={{ fontSize: 28 }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    Total Categories
                  </Typography>
                  <Typography variant="h6" fontWeight="bold" color={theme.palette.primary.main}>
                    {loading ? "..." : (Array.isArray(categories) ? categories.length : 0)}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        {/* Total Subcategories */}
        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              height: '100%',
              background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.1)} 0%, ${alpha(theme.palette.success.main, 0.05)} 100%)`,
              border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`,
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: `0 8px 25px ${alpha(theme.palette.success.main, 0.3)}`,
                border: `1px solid ${alpha(theme.palette.success.main, 0.4)}`
              }
            }}
          >
            <CardContent sx={{ p: 2 }}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    backgroundColor: theme.palette.success.main,
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem'
                  }}
                >
                  <AccountTreeIcon sx={{ fontSize: 28 }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    Total Subcategories
                  </Typography>
                  <Typography variant="h6" fontWeight="bold" color={theme.palette.success.main}>
                    {loading ? "..." : totalSubcategories}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        {/* Global Categories */}
        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              height: '100%',
              background: `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.1)} 0%, ${alpha(theme.palette.info.main, 0.05)} 100%)`,
              border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: `0 8px 25px ${alpha(theme.palette.info.main, 0.3)}`,
                border: `1px solid ${alpha(theme.palette.info.main, 0.4)}`
              }
            }}
          >
            <CardContent sx={{ p: 2 }}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    backgroundColor: theme.palette.info.main,
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem'
                  }}
                >
                  <TrendingUpIcon sx={{ fontSize: 28 }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    NIA Wide Categories
                  </Typography>
                  <Typography variant="h6" fontWeight="bold" color={theme.palette.info.main}>
                    {loading ? "..." : globalCategories}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        {/* Regional Categories */}
        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              height: '100%',
              background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.1)} 0%, ${alpha(theme.palette.warning.main, 0.05)} 100%)`,
              border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`,
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: `0 8px 25px ${alpha(theme.palette.warning.main, 0.3)}`,
                border: `1px solid ${alpha(theme.palette.warning.main, 0.4)}`
              }
            }}
          >
            <CardContent sx={{ p: 2 }}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    backgroundColor: theme.palette.warning.main,
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem'
                  }}
                >
                  <MdList size={24} style={{ color: 'white' }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    Regional Categories
                  </Typography>
                  <Typography variant="h6" fontWeight="bold" color={theme.palette.warning.main}>
                    {loading ? "..." : regionalCategories}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Information Alert - Always show helpful information */}
      <Alert
        severity="info"
        sx={{
          mb: 3,
          borderRadius: "16px",
          border: `2px solid ${alpha(theme.palette.info.main, 0.2)}`,
          bgcolor: `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.08)} 0%, ${alpha(theme.palette.info.main, 0.03)} 100%)`,
          "& .MuiAlert-icon": {
            color: theme.palette.info.main,
            fontSize: '1.5rem'
          },
          py: 2
        }}
        icon={<MdAttachMoney />}
      >
        <Typography variant="body1" fontWeight={600} sx={{ mb: 1 }}>
          Income Management System Guidelines
        </Typography>
        <Typography variant="body2" sx={{ mb: 2 }}>
          <strong>Simplified Workflow:</strong> Create income categories and add their subcategories directly in one form. 
          NIA Wide categories apply to <strong>"All Regions including Central Office"</strong>, while regional categories 
          are specific to selected regions only.
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip 
            size="small" 
            label="✓ NIA Wide Scope Available" 
            color="success" 
            variant="outlined"
          />
          <Chip 
            size="small" 
            label="✓ Regional Assignment" 
            color="primary" 
            variant="outlined"
          />
          <Chip 
            size="small" 
            label="✓ Multiple Subcategories" 
            color="secondary" 
            variant="outlined"
          />
        </Box>
      </Alert>

      {/* Error Alert with retry option */}
      {error && (
        <Alert 
          severity="error" 
          sx={{ 
            mb: 3, 
            borderRadius: 2,
            '& .MuiAlert-action': {
              alignItems: 'center'
            }
          }}
          action={
            <Button 
              color="inherit" 
              size="small" 
              onClick={() => handleRefresh('manual')}
              disabled={loading}
              startIcon={<RefreshIcon />}
            >
              Retry
            </Button>
          }
        >
          <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 0.5 }}>
            Connection Issue
          </Typography>
          <Typography variant="body2">
            {error}
          </Typography>
        </Alert>
      )}

      {/* Loading State */}
      {loading && (
        <Paper sx={{ p: 3, textAlign: 'center', mb: 3, borderRadius: 2 }}>
          <Typography>Loading income data...</Typography>
        </Paper>
      )}

      {/* Main Income Categories Table - Always show */}
      <Paper 
        sx={{ 
          borderRadius: "20px", 
          overflow: "hidden",
          boxShadow: `0 12px 40px ${alpha(theme.palette.primary.main, 0.15)}`,
          border: `2px solid ${alpha(theme.palette.primary.main, 0.08)}`,
          transition: 'box-shadow 0.3s ease-in-out'
        }}
      >
        <Box sx={{ 
          p: 3, 
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
          borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`
        }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" alignItems="center" spacing={2}>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: '12px',
                  backgroundColor: alpha(theme.palette.primary.main, 0.1),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <CategoryIcon sx={{ color: theme.palette.primary.main, fontSize: 24 }} />
              </Box>
              <Box>
                <Typography variant="h5" fontWeight="bold" color="primary" sx={{ mb: 0.5 }}>
                  Income Categories & Subcategories
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Comprehensive management of all income classifications with regional scope
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                startIcon={<MdAdd />}
                onClick={handleCreateCategory}
                sx={{ 
                  borderRadius: 3,
                  px: 3,
                  py: 1.5,
                  fontWeight: 'bold',
                  textTransform: 'none',
                  boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`,
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: `0 6px 20px ${alpha(theme.palette.primary.main, 0.4)}`
                  },
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                ADD
              </Button>
              <Tooltip title="Refresh Data">
                <IconButton
                  onClick={() => handleRefresh('manual')}
                  disabled={loading}
                  sx={{
                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                    color: theme.palette.primary.main,
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.primary.main, 0.2),
                      transform: 'scale(1.05)',
                    },
                    transition: 'all 0.2s ease-in-out',
                  }}
                >
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
        </Box>

        <IncomeCategoriesCustomPage
          key={refreshTrigger}
          dataListName="income-categories"
          schema={incomeCategoriesSchema}
          title=" "
          description=" "
          searchable={true}
          hasAdd={false}
          hasEdit={false}
          hasDelete={true}
          onDelete={handleDeleteCategory}
          additionalMenuOptions={[
            ({ row }) => (
              <MenuItem
                onClick={() => handleEditCategory(row)}
                disableRipple
                sx={{ 
                  display: "flex", 
                  gap: 1, 
                  color: "primary.main",
                  '&:hover': {
                    backgroundColor: 'rgba(25, 118, 210, 0.08)',
                  },
                }}
              >
                <MdEdit />
                Edit
              </MenuItem>
            ),
          ]}
          customEmptyMessage={
            loading ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <CircularProgress size={48} thickness={4} sx={{ mb: 2, color: theme.palette.primary.main }} />
                <Typography variant="h6" color="text.secondary" sx={{ mt: 2, mb: 1 }}>
                  Loading income categories...
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Please wait while we fetch your data
                </Typography>
              </Box>
            ) : (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <MdCategory size={64} color="#ccc" />
                <Typography variant="h6" color="text.secondary" sx={{ mt: 2, mb: 1 }}>
                  No Income Categories Found
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Create your first income category to get started with budget management.
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<MdAdd />}
                  onClick={handleCreateCategory}
                  sx={{ borderRadius: 2 }}
                >
                  Create First Category
                </Button>
              </Box>
            )
          }
        />
      </Paper>

      {/* Enhanced Category Create/Edit Dialog */}
      <Dialog 
        open={categoryDialogOpen} 
        onClose={() => setCategoryDialogOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '20px',
            overflow: 'hidden',
            boxShadow: `0 16px 50px ${alpha(theme.palette.primary.main, 0.2)}`
          }
        }}
      >
        <DialogTitle sx={{ 
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
          color: 'white',
          py: 3
        }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Box
              sx={{
                p: 1,
                borderRadius: '8px',
                backgroundColor: alpha('#fff', 0.15),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <MdCategory size={24} />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight="bold">
                {editingCategory ? 'Edit Income Category' : 'Create New Income Category'}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                {editingCategory ? 'Update category details and subcategories' : 'Add a new income category with subcategories'}
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ pt: 3, pb: 2 }}>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              {editingCategory ? (
                // When editing, show a regular TextField with the category name
                <TextField
                  fullWidth
                  label="Income Category Name"
                  value={categoryForm.incomeCategoryName}
                  onChange={(e) => setCategoryForm(prev => ({
                    ...prev,
                    incomeCategoryName: e.target.value
                  }))}
                  required
                  margin="normal"
                  sx={{ 
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2
                    }
                  }}
                  helperText="Category name (cannot be changed when editing)"
                />
              ) : (
                // When creating new, show Autocomplete to select from existing categories
                <Autocomplete
                  options={incomeCategories}
                  getOptionLabel={option => option.name || option.incomeCategoryName || ""}
                  value={selectedCategory}
                  onChange={(_, value) => {
                    setSelectedCategory(value);
                    if (value && value._id) {
                      setCategoryForm(prev => ({
                        ...prev,
                        incomeCategoryName: value.name || value.incomeCategoryName || '',
                        incomeSubcategories: [] // Clear selections for new category
                      }));
                    } else {
                      setCategoryForm(prev => ({
                        ...prev,
                        incomeCategoryName: '',
                        incomeSubcategories: []
                      }));
                    }
                  }}
                  renderInput={params => (
                    <TextField {...params} label="Income Category Name" required margin="normal" />
                  )}
                  fullWidth
                  freeSolo
                  onInputChange={(_, newInputValue) => {
                    setCategoryForm(prev => ({
                      ...prev,
                      incomeCategoryName: newInputValue
                    }));
                  }}
                />
              )}
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Description"
                value={categoryForm.description}
                required margin="normal"
                onChange={(e) => setCategoryForm(prev => ({
                  ...prev,
                  description: e.target.value
                }))}
                sx={{ 
                  mb: 3,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2
                  }
                }}
                multiline
                rows={1}
                helperText="Optional description for the category"
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom sx={{ mt: 2, mb: 1, fontWeight: 'bold' }}>
                Income Subcategories
              </Typography>
              {/* Multi-select dropdown for subcategories */}
              {(() => {
                // When editing, use the editing category ID, otherwise use selected category ID
                const categoryId = editingCategory?._id?.toString() || selectedCategory?._id?.toString();
                const filteredSubcategories = getFilteredSubcategories(categoryId, editingCategory);
                
                if (filteredSubcategories.length === 0) {
                  return (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        No existing subcategories found for this category.
                      </Typography>
                    </Box>
                  );
                }
                
                return (
                  <Box>
                    <FormControl fullWidth sx={{ mb: 2 }}>
                      <InputLabel id="subcategory-select-label">Select Subcategories</InputLabel>
                      <Select
                        labelId="subcategory-select-label"
                        multiple
                        value={categoryForm.incomeSubcategories}
                        onChange={e => {
                          setCategoryForm(prev => ({
                            ...prev,
                            incomeSubcategories: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value
                          }));
                        }}
                        renderValue={selected => selected.join(', ')}
                        label="Select Subcategories"
                      >
                        {filteredSubcategories.map(sub => (
                          <MenuItem key={sub._id} value={sub.name}>
                            <Checkbox checked={categoryForm.incomeSubcategories.includes(sub.name)} />
                            <ListItemText primary={sub.name} />
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    

                  </Box>
                );
              })()}
              
              {/* Show selected subcategories as chips */}
              {categoryForm.incomeSubcategories.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Selected subcategories:
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {categoryForm.incomeSubcategories.map((subcat, index) => (
                      <Chip
                        key={index}
                        label={subcat}
                        onDelete={() => {
                          setCategoryForm(prev => ({
                            ...prev,
                            incomeSubcategories: prev.incomeSubcategories.filter((_, i) => i !== index)
                          }));
                        }}
                        color="primary"
                        variant="outlined"
                        size="small"
                      />
                    ))}
                  </Stack>
                </Box>
              )}
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>Access Level</InputLabel>
                <Select
                  value={categoryForm.isGlobal}
                  onChange={(e) => setCategoryForm(prev => ({
                    ...prev,
                    isGlobal: e.target.value,
                    regions: e.target.value ? [] : prev.regions
                  }))}
                  label="Access Level"
                >
                  <MenuItem value={false}>Region Specific</MenuItem>
                  <MenuItem value={true}>NIA Wide (All Regions)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            {!categoryForm.isGlobal && (
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Select Regions</InputLabel>
                  <Select
                    multiple
                    value={categoryForm.regions}
                    onChange={(e) => setCategoryForm(prev => ({
                      ...prev,
                      regions: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value
                    }))}
                    input={<OutlinedInput label="Select Regions" />}
                    renderValue={(selected) => selected.join(', ')}
                  >
                    {(customSortRegions(availableRegions) || []).map((region) => {
                      const regionName = typeof region === 'string' ? region : (region.name || region.regionName || region);
                      return (
                        <MenuItem key={regionName} value={regionName}>
                          <Checkbox checked={categoryForm.regions.indexOf(regionName) > -1} />
                          <ListItemText primary={regionName} />
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ 
          p: 3, 
          bgcolor: alpha(theme.palette.grey[50], 0.5),
          borderTop: `1px solid ${alpha(theme.palette.grey[300], 0.5)}`
        }}>
          <Button 
            onClick={() => setCategoryDialogOpen(false)}
            sx={{ 
              borderRadius: 2,
              px: 3,
              color: 'text.secondary',
              '&:hover': {
                bgcolor: alpha(theme.palette.grey[500], 0.1)
              }
            }}
          >
            Cancel
          </Button>
          <Button 
            variant="contained"
            onClick={handleSubmitCategory}
            disabled={
              !categoryForm.incomeCategoryName.trim() ||
              categoryForm.incomeSubcategories.length === 0 ||
              (!categoryForm.isGlobal && categoryForm.regions.length === 0)
            }
            sx={{
              borderRadius: 2,
              px: 4,
              py: 1,
              fontWeight: 'bold',
              textTransform: 'none',
              boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`,
              '&:hover': {
                transform: 'translateY(-1px)',
                boxShadow: `0 6px 20px ${alpha(theme.palette.primary.main, 0.4)}`
              },
              '&:disabled': {
                bgcolor: alpha(theme.palette.grey[400], 0.5),
                color: 'text.disabled'
              },
              transition: 'all 0.2s ease-in-out'
            }}
          >
            {editingCategory ? 'Update Category' : 'Create Category'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Toast Notification - Alternative Implementation */}
      {toast.open && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            zIndex: 9999,
            maxWidth: 400
          }}
        >
          <Alert 
            onClose={() => setToast({ ...toast, open: false })} 
            severity={toast.severity}
            variant="filled"
            sx={{ mb: 1 }}
          >
            {toast.message}
          </Alert>
        </Box>
      )}
    </Box>
  );
};

export default IncomeManagementPage;
