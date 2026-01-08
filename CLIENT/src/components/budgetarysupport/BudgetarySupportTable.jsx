import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRegion } from '../../context/RegionContext';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  IconButton,
  CircularProgress,
  Alert,
  Chip,
  Tooltip,
  Card,
  CardContent,
  Menu,
  MenuItem
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import GetAppIcon from '@mui/icons-material/GetApp';
import VisibilityIcon from '@mui/icons-material/Visibility';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import InfoIcon from '@mui/icons-material/Info';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import api from '../../config/api';
import { toast } from 'react-toastify';
import { useUser } from '../../context/UserContext';

const normalizeName = (value) => {
  if (!value) return '';
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s\-()/]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*\(.*?\)\s*/g, '')
    .trim();
};

const toNumber = (value) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const cleaned = value.replace(/,/g, '').trim();
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

const BudgetarySupportTable = ({ fiscalYear, budgetType, proposalId, incomeGrandTotal = 0, groupedItems = {}, onChargedToIncomeChange = null, onNonChargedPersonnelServicesChange = null, onBudgetDeficitChange = null }) => {
  const [amount, setAmount] = useState(0);
  const [exportMenuAnchor, setExportMenuAnchor] = useState(null);
  const [compactView, setCompactView] = useState(false);
  const queryClient = useQueryClient();
  const { currentUser } = useUser();
  const { selectedRegion } = useRegion();

  // Extract region name properly - handle both string and object cases
  const regionName = useMemo(() => {
    if (!selectedRegion) return null;
    
    // If selectedRegion is already a string, use it
    if (typeof selectedRegion === 'string') {
      return selectedRegion;
    }
    
    // If selectedRegion is an object, extract the name
    if (typeof selectedRegion === 'object') {
      return selectedRegion.name || selectedRegion.regionName || selectedRegion.Region || null;
    }
    
    return null;
  }, [selectedRegion]);

  const normalizedSelectedRegion = useMemo(() => {
    if (!regionName) return '';
    const normalized = normalizeName(regionName);
    return normalized === 'all' ? '' : normalized;
  }, [regionName]);

  const hierarchicalAccess = useMemo(
    () => currentUser?.hierarchicalAccess || {},
    [currentUser]
  );

  const assignmentFilters = useMemo(() => {
    const toNormalizedList = (collection = [], possibleKeys = []) => {
      return collection
        .map((entry) => {
          if (!entry) return '';

          if (typeof entry === 'string') {
            return normalizeName(entry);
          }

          for (const key of possibleKeys) {
            const value = entry?.[key];
            if (value) {
              return normalizeName(value);
            }
          }

          if (entry?.name) {
            return normalizeName(entry.name);
          }

          return '';
        })
        .filter(Boolean);
    };

    const accessibleRegionNames = toNormalizedList(hierarchicalAccess.accessibleRegions, ['regionName', 'Region', 'name']);
    const accessibleDivisionNames = toNormalizedList(hierarchicalAccess.accessibleDivisions, ['divisionName', 'Division', 'name']);
    const accessibleDepartmentNames = toNormalizedList(hierarchicalAccess.accessibleDepartments, ['departmentName', 'Department', 'officeName', 'name']);
    const accessibleOfficeNames = toNormalizedList(hierarchicalAccess.accessibleOffices, ['officeName', 'Office', 'name']);
    const accessibleResponsibilityCenters = toNormalizedList(
      hierarchicalAccess.accessibleResponsibilityCenters,
      ['responsibilityCenterName', 'ResponsibilityCenter', 'name']
    );

    const departmentFilters = accessibleDepartmentNames.length > 0 ? accessibleDepartmentNames : accessibleOfficeNames;

    return {
      scope: hierarchicalAccess.scope || hierarchicalAccess.assignmentLevel || 'NONE',
      regions: normalizedSelectedRegion ? [normalizedSelectedRegion] : accessibleRegionNames,
      divisions: accessibleDivisionNames,
      departments: departmentFilters,
      responsibilityCenters: accessibleResponsibilityCenters
    };
  }, [hierarchicalAccess, normalizedSelectedRegion]);

  const hasAssignmentFilters = useMemo(() => {
    if (assignmentFilters.scope === 'FULL') {
      return Boolean(normalizedSelectedRegion);
    }

    return (
      assignmentFilters.regions.length > 0 ||
      assignmentFilters.divisions.length > 0 ||
      assignmentFilters.departments.length > 0 ||
      assignmentFilters.responsibilityCenters.length > 0
    );
  }, [assignmentFilters, normalizedSelectedRegion]);

  const matchesAssignmentScope = useCallback(
    (item) => {
      if (!item) return false;
      if (!hasAssignmentFilters) return true;

      const { scope, regions, divisions, departments, responsibilityCenters } = assignmentFilters;

      const extractValue = (source, keys) => {
        for (const key of keys) {
          const parts = key.split('.');
          let value = source;
          for (const part of parts) {
            if (!value) break;
            value = value?.[part];
          }

          if (typeof value === 'string' && value.trim()) {
            return value;
          }
        }
        return null;
      };

      const matchesList = (value, list) => {
        if (!list || list.length === 0) return true;
        const normalizedValue = normalizeName(value);
        return normalizedValue ? list.includes(normalizedValue) : false;
      };

      const regionValue = extractValue(item, ['region', 'Region', 'regionName', 'RegionName', 'meta.region', 'meta.Region', 'meta.regionName']);
      const divisionValue = extractValue(item, ['division', 'Division', 'divisionName', 'DivisionName', 'meta.division', 'meta.Division']);
      const departmentValue = extractValue(item, [
        'department',
        'Department',
        'departmentName',
        'DepartmentName',
        'office',
        'Office',
        'officeName',
        'meta.department',
        'meta.Department',
        'meta.office',
        'meta.Office'
      ]);
      const responsibilityCenterValue = extractValue(item, [
        'responsibilityCenter',
        'ResponsibilityCenter',
        'responsibilityCenterName',
        'responsibility_center',
        'meta.responsibilityCenter',
        'meta.ResponsibilityCenter'
      ]);

      switch (scope) {
        case 'FULL':
          if (normalizedSelectedRegion) {
            return matchesList(regionValue, [normalizedSelectedRegion]);
          }
          return true;
        case 'REGION':
          return matchesList(regionValue, regions);
        case 'DIVISION':
          return matchesList(divisionValue, divisions) && matchesList(regionValue, regions);
        case 'DEPARTMENT':
        case 'OFFICE':
          return matchesList(departmentValue, departments) && matchesList(divisionValue, divisions) && matchesList(regionValue, regions);
        case 'RESPONSIBILITY_CENTER':
          if (matchesList(responsibilityCenterValue, responsibilityCenters)) return true;
          return matchesList(departmentValue, departments) && matchesList(regionValue, regions);
        default:
          return matchesList(regionValue, regions);
      }
    },
    [assignmentFilters, hasAssignmentFilters, normalizedSelectedRegion]
  );

  // No custom formatting needed since amount is read-only

  // Check if we have valid fiscalYear and budgetType
  const hasValidParams = !!fiscalYear && !!budgetType;
  
  useEffect(() => {
    // console.log('DEBUG BudgetarySupportTable params:', { fiscalYear, budgetType, hasValidParams });
  }, [fiscalYear, budgetType, hasValidParams]);
  
  // Debug props removed for cleaner console
  // Fetch calculated budgetary support from the new endpoint
  const { data: calculatedBudgetarySupport, isLoading: isLoadingCalculated, error: errorCalculated } = useQuery({
    queryKey: ['calculated-budgetary-support', fiscalYear, budgetType], // Removed regionName from queryKey
    queryFn: async () => {
      if (!hasValidParams) return null;
      
      // Prepare parameters - let backend handle hierarchical filtering
      const params = { 
        fiscalYear: Number(fiscalYear), 
        budgetType: budgetType 
      };
      
      // Don't send region manually - let hierarchical access control handle it
      // The backend will automatically filter based on user's access scope (division/department/region)

      const response = await api.get('/budgetary-support/calculate', { params, timeout: 12000 });
      
      return response.data;
    },
    enabled: hasValidParams,
    retry: 2,
    retryDelay: 1000,
    onError: (error) => {
      console.error('❌ /budgetary-support/calculate failed:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url,
        params: error.config?.params
      });
    }
  });

  // Fetch Capital Outlay data to calculate subsidy total
  const { data: capitalOutlayData, isLoading: isLoadingCapitalOutlay, error: errorCapitalOutlay } = useQuery({
    queryKey: ['capital-outlays', fiscalYear, budgetType], // Removed regionName from queryKey
    queryFn: async () => {
      if (!hasValidParams) return [];
      
      // Prepare parameters - let backend handle hierarchical filtering
      const params = { 
        fiscalYear: Number(fiscalYear), 
        budgetType: budgetType 
      };
      
      // Single canonical endpoint. No fallbacks or alternative probes.
      const response = await api.get('/api/consolidated-reports/capital-outlay-data', { params });
      
      // Capital Outlay data comes directly as array or with data property
      const data = response.data?.data || response.data || [];
      return data;
    },
    enabled: hasValidParams,
    retry: 2,
    retryDelay: 1000,
    onError: (error) => {
      console.error('❌ /api/consolidated-reports/capital-outlay-data failed:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url,
        params: error.config?.params
      });
    }
  });

  // Fetch MOOE data to get actual income amounts
  const { data: mooeData, isLoading: isLoadingMOOE, error: errorMOOE } = useQuery({
    queryKey: ['mooe-list', fiscalYear, budgetType], // Removed regionName from queryKey
    queryFn: async () => {
      if (!hasValidParams) return [];
      
      try {
        // Build query string parameters - let backend handle hierarchical filtering
        const queryParams = [];
        if (fiscalYear) {
          queryParams.push(`fiscalYear=${encodeURIComponent(fiscalYear)}`);
        }
        if (budgetType) {
          queryParams.push(`budgetType=${encodeURIComponent(budgetType)}`);
        }
        // Don't send region manually - let hierarchical access control handle it
        
        const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
        const response = await api.get(`/mooe-list${queryString}`);
        
        // Response is directly an array like in ProposalCustomPage
        const data = response.data || [];
        
        return data;
      } catch (error) {
        console.error('❌ /mooe-list failed:', {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          url: error.config?.url
        });
        return [];
      }
    },
    enabled: hasValidParams,
    retry: 2,
    retryDelay: 1000
  });

  // Fetch Personnel Services data for Use of Funds breakdown (Combined Permanent + Casual)
  const { data: personalServicesData, error: personnelError, isLoading: isLoadingPersonnel } = useQuery({
    queryKey: ['personnel-services-combined', fiscalYear, budgetType], // Removed regionName from queryKey
    queryFn: async () => {
      if (!hasValidParams) return [];
      
      // Setup base parameters with proper data types and validation
      const baseParams = {
        fiscalYear: Number(fiscalYear), // Ensure fiscal year is a number
        budgetType: budgetType,
        limit: 1000,
        page: 1
      };

      // Clean and validate parameters - let backend handle hierarchical filtering
      if (regionName) {
        const cleanedRegion = regionName.trim().replace(/\s+/g, ' ');
        if (cleanedRegion) {
          // Don't send region parameters - let hierarchical access control handle filtering
          // baseParams.region = cleanedRegion; // REMOVED
          // baseParams.Region = cleanedRegion; // REMOVED
        }
      }

      try {
        // Fetch personnel data from all employment types in a single call
        
        const response = await api.get('/getpersonnels', { 
          params: { 
            ...baseParams
            // Don't send region manually - let hierarchical access control handle it
          } 
        });

        const personnelData = response.data || [];

        // Debug: Log field structure for personnel data
        if (personnelData.length > 0) {
          
          // Check appointment status distribution
          const statusCounts = {};
          personnelData.forEach(p => {
            const status = p.statusOfAppointment || 'Unknown';
            statusCounts[status] = (statusCounts[status] || 0) + 1;
          });
        }
        
        // Note: Alternative endpoint fallback removed since all endpoints now properly implement submission workflow filtering
        
        // If no data returned, try without explicit region filter (backend handles hierarchical filtering)
        if (personnelData.length === 0) {
          
          const paramsWithoutRegion = {
            fiscalYear: Number(fiscalYear),
            budgetType: budgetType,
            limit: 1000,
            page: 1
          };
          
          const responseNoRegion = await api.get('/getpersonnels', { params: paramsWithoutRegion });
          const dataNoRegion = responseNoRegion.data || [];

          // Backend hierarchical filtering will handle proper data isolation
          if (dataNoRegion.length > 0) {
            return dataNoRegion;
          }
        }

        // Ensure we have arrays
        if (!Array.isArray(personnelData)) {
          throw new Error('Personnel services data is not in the expected format');
        }
        
        return personnelData;
      } catch (error) {
        // Only log if it's not a 500 error to reduce console noise
        if (error.response?.status !== 500) {
          console.error('Personnel services error details:', {
            error: error,
            response: error.response?.data,
            status: error.response?.status,
            config: {
              url: error.config?.url,
              params: error.config?.params
            }
          });
        }

        // Try to get data from calculatedBudgetarySupport as fallback
        if (calculatedBudgetarySupport?.breakdown) {
          const psBreakdown = calculatedBudgetarySupport.breakdown.find(item => 
            item.source?.includes('PERSONNEL SERVICES') || 
            item.source?.includes('PS')
          );
          
          if (psBreakdown) {
            return [{
              Total: psBreakdown.amount,
              region: selectedRegion,
              employeeFullName: 'Consolidated PS',
              description: 'Total Personnel Services from Budgetary Support Calculation'
            }];
          }
        }

        // If no fallback data available, just return empty array
        return [];
      }
    },
    enabled: hasValidParams,
    retry: 2, // Increase retry attempts
    retryDelay: 2000, // Increase delay between retries to 2 seconds
    onError: (error) => {
      console.error('❌ /getpersonnels failed:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url,
        params: error.config?.params
      });
      toast.error(`Error: ${error.message}`);
    }
  });

  // Note: Corporate Income data is now received via callback from IncomeTable component
  // No need to fetch it separately here anymore

  // Use React Query for existing budgetary support data (for reference only)
  const {
    data,
    isLoading: isLoadingBudgetarySupport,
    error
  } = useQuery({
    queryKey: ['budgetary-support', fiscalYear, budgetType],
    queryFn: async () => {
      if (!hasValidParams) {
        // Missing required parameters
        return null;
      }

      // Fetching budgetary support - let backend handle hierarchical filtering
      const response = await api.get('/budgetary-support', {
        params: { fiscalYear, budgetType }
        // Don't send region manually - hierarchical access control will handle filtering
      });
      // Budgetary support loaded
      return response.data && response.data.length > 0 ? response.data[0] : null;
    },
    enabled: hasValidParams, // Only run query if we have valid params
    onError: (err) => {
      console.error('❌ /budgetary-support failed:', {
        message: err.message,
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
        url: err.config?.url,
        params: err.config?.params
      });
      toast.error(`Error loading budgetary support data: ${err.message}`);
    }
  });

  // Fetch Proposal record to get backend-calculated projectedSubsidy
  const { data: proposalData } = useQuery({
    queryKey: ['proposal', 'totals', proposalId],
    queryFn: async () => {
      try {
        if (proposalId) {
          // console.log('[BudgetarySupportTable] Fetching proposal totals by workflowRefId:', proposalId);
          const response = await api.get(`/api/allproposal/proposals/${proposalId}/totals`);
          // console.log('[BudgetarySupportTable] Proposal totals fetched:', {
            // projectedSubsidy: response.data?.data?.projectedSubsidy,
            // projectedCorporateIncome: response.data?.data?.projectedCorporateIncome
          // });
          return response.data?.data;
        }
        
        return null;
      } catch (err) {
        console.error('[BudgetarySupportTable] Error fetching proposal totals:', err.response?.status, err.message);
        return null;
      }
    },
    enabled: !!proposalId,
  });

  // Fetch charged-to-income personnel data for budget breakdown
  const { data: chargedToIncomeData, isLoading: isLoadingChargedToIncome, error: chargedToIncomeError } = useQuery({
    queryKey: ['personnelServices', 'chargedToIncome', proposalId, fiscalYear, budgetType],
    queryFn: async () => {
      if (!hasValidParams) {
        console.warn('⚠️ ChargedToIncome query skipped - hasValidParams is false');
        return [];
      }
      
      try {
        const baseParams = {
          ...(proposalId && { proposalId }), // CRITICAL: Filter by proposalId if available
          fiscalYear: Number(fiscalYear),
          budgetType: budgetType,
          chargedToIncomeEligible: true,
          limit: 1000,
          page: 1
        };

        // console.log('📡 Fetching chargedToIncomeData with params:', baseParams);
        const response = await api.get('/personnelServices', { params: baseParams });
        // console.log('📡 ChargedToIncomeData full response:', response.data);
        // console.log('📡 Response keys:', Object.keys(response.data || {}));
        
        const personnel = response.data?.personnelServices || response.data?.data || [];
        // console.log('📡 ChargedToIncomeData personnel array:', {
          // count: Array.isArray(personnel) ? personnel.length : 'not-array',
          // data: personnel
        // });
        return personnel;
      } catch (error) {
        console.error('❌ Error fetching charged-to-income personnel:', error.response?.data || error.message);
        return [];
      }
    },
    enabled: hasValidParams,
    retry: 1,
    staleTime: 30000
  });

  // Check authentication status for protected endpoints
  const { data: authTest } = useQuery({
    queryKey: ['auth-test', fiscalYear, budgetType],
    queryFn: async () => {
      try {
        const response = await api.get('/budgetary-support/calculate', {
          params: {
            fiscalYear: Number(fiscalYear) || 2025,
            budgetType: budgetType || 'CURRENT'
          }
        });
        return { status: 'authenticated', response: response.data };
      } catch (error) {
        if (error.response?.status === 401 || error.response?.status === 403) {
          console.error('❌ Authentication failed - user not logged in or token expired');
          return { status: 'unauthenticated', error: 'Please log in to access this data' };
        }

        console.error('❌ Authentication test failed with unexpected error:', {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText
        });
        return { status: 'error', error: error.message };
      }
    },
    enabled: hasValidParams,
    retry: false,
    staleTime: 60000
  });

  // Combined loading state for all queries - MUST be defined after all useQuery hooks
  const isLoading = isLoadingCalculated || isLoadingCapitalOutlay || isLoadingMOOE || isLoadingPersonnel || isLoadingBudgetarySupport || isLoadingChargedToIncome;

  // Timeout mechanism to prevent infinite loading
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        setLoadingTimeout(true);
      }, 15000);

      return () => clearTimeout(timer);
    }

    setLoadingTimeout(false);
  }, [isLoading]);

  // Use calculated budgetary support amount with better validation
  useEffect(() => {
    let newAmount = 0;

    if (calculatedBudgetarySupport?.totalSubsidy) {
      newAmount = Number(calculatedBudgetarySupport.totalSubsidy);
    } else if (calculatedBudgetarySupport?.amount) {
      newAmount = Number(calculatedBudgetarySupport.amount);
    } else if (data?.amount) {
      newAmount = Number(data.amount);
    } else {
      newAmount = 0;
    }
    
    // Validate the amount
    if (isNaN(newAmount) || newAmount < 0) {
      console.warn('⚠️ Invalid amount detected, setting to 0:', newAmount);
      newAmount = 0;
    }
    
    setAmount(newAmount);
  }, [calculatedBudgetarySupport, data]);

  // Amount is now auto-calculated, no manual changes allowed

  // Refresh data
  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries(['budgetary-support', fiscalYear, budgetType]);
    queryClient.invalidateQueries(['calculated-budgetary-support', fiscalYear, budgetType]); // Removed regionName
    queryClient.invalidateQueries(['capital-outlays', fiscalYear, budgetType]); // Removed regionName
    queryClient.invalidateQueries(['personnel-services-combined', fiscalYear, budgetType]); // Removed regionName
    
    // Note: Corporate income will refresh automatically when IncomeTable refreshes
    
    toast.info("Data refreshed");
  }, [queryClient, fiscalYear, budgetType]); // Removed regionName from dependencies

  // Fetch Income data to ensure we have the breakdown even if IncomeTable is not mounted
  const { data: incomeData } = useQuery({
    queryKey: ['income-items-budgetary', fiscalYear, budgetType, proposalId, regionName],
    queryFn: async () => {
      if (!hasValidParams) return [];
      const params = { 
        fiscalYear, 
        budgetType,
        proposalId, // Filter by proposalId to get correct items
        // Also filter by region to avoid cross-region data leakage
        region: regionName || undefined
      };
      const response = await api.get('/income/getByParams', { params });
      return response.data || [];
    },
    enabled: hasValidParams
  });

  // Fallback: If proposal-based query returns nothing, fetch by fiscalYear/budgetType/region
  const { data: incomeDataByFY } = useQuery({
    queryKey: ['income-items-budgetary-fallback', fiscalYear, budgetType, regionName],
    queryFn: async () => {
      if (!hasValidParams) return [];
      const params = {
        fiscalYear,
        budgetType,
        region: regionName || undefined
      };
      // console.log('[BudgetarySupportTable] Fallback /income params:', params);
      const response = await api.get('/income', { params });
      const items = response.data || [];
      // console.log('[BudgetarySupportTable] Fallback /income returned:', Array.isArray(items) ? items.length : 'not-array');
      if (Array.isArray(items) && items.length > 0) {
        // console.log('[BudgetarySupportTable] Sample income item:', {
          // amount: items[0]?.amount,
          // category: items[0]?.incomecategory?.incomeCategoryName || items[0]?.incomecategory?.name || items[0]?.category,
          // region: items[0]?.region || items[0]?.Region
        // });
      }
      return items;
    },
    enabled: hasValidParams && Array.isArray(incomeData) && incomeData.length === 0
  });

  // Calculate grouped items and subtotal locally
  const localIncomeStats = useMemo(() => {
    const items = (incomeData && incomeData.length > 0) ? incomeData : (incomeDataByFY || []);
    // Debug counts for income items used to compute corporate subtotal
    // console.log('[BudgetarySupportTable] Corporate Income subtotal source counts:', {
      // proposalItems: Array.isArray(incomeData) ? incomeData.length : 0,
      // fyRegionItems: Array.isArray(incomeDataByFY) ? incomeDataByFY.length : 0
    // });
    const grouped = {
      'Irrigation Service Fees': { subtotal: 0 },
      'Rent Income': { subtotal: 0 },
      'Water Service Fee': { subtotal: 0 },
      'Miscellaneous Income': { subtotal: 0 }
    };
    let total = 0;

    items.forEach(item => {
      // Handle populated incomecategory object or string
      const categoryName = item.incomecategory?.name || item.incomecategory?.incomeCategoryName || item.category || '';
      const amount = Number(item.amount || 0);
      
      // Map to display categories
      let displayCategory = 'Miscellaneous Income';
      if (categoryName.includes('Irrigation')) displayCategory = 'Irrigation Service Fees';
      else if (categoryName.includes('Rent')) displayCategory = 'Rent Income';
      else if (categoryName.includes('Water')) displayCategory = 'Water Service Fee';
      else if (categoryName.includes('Miscellaneous')) displayCategory = 'Miscellaneous Income';
      else displayCategory = 'Miscellaneous Income'; // Default to Misc for others
      
      if (grouped[displayCategory]) {
        grouped[displayCategory].subtotal += amount;
      }
      total += amount;
    });

    return { grouped, total };
  }, [incomeData]);

  // Use local stats if props are missing (which happens when IncomeTable is not mounted)
  // Prefer props from IncomeTable, but if they are present with zero total, fall back to local stats
  const propsTotal = useMemo(() => {
    try {
      return Object.values(groupedItems || {}).reduce((sum, g) => sum + (Number(g?.subtotal) || 0), 0);
    } catch {
      return 0;
    }
  }, [groupedItems]);

  const effectiveGroupedItems = (Object.keys(groupedItems).length > 0 && propsTotal > 0)
    ? groupedItems
    : localIncomeStats.grouped;
  const effectiveIncomeGrandTotal = (incomeGrandTotal > 0)
    ? incomeGrandTotal
    : (propsTotal > 0 ? propsTotal : localIncomeStats.total);

  // console.log('[BudgetarySupportTable] Effective corporate income totals:', {
    // propsTotal,
    // localTotal: localIncomeStats.total,
    // using: (Object.keys(groupedItems).length > 0 && propsTotal > 0) ? 'props' : 'local'
  // });

  // Helper function to get corporate income from actual data sources
  const getCorporateIncomeFromBreakdown = useCallback((category) => {
    let totalIncome = 0;

    if (category === 'MOOE') {
      if (mooeData && Array.isArray(mooeData)) {
        const filteredMooe = hasAssignmentFilters
          ? mooeData.filter((item) => matchesAssignmentScope(item))
          : mooeData;

        totalIncome = filteredMooe.reduce((sum, item) => sum + toNumber(item?.income), 0);
        // console.log(`🔍 MOOE: Found ${mooeData.length} records, ${filteredMooe.length} after filter, total income: ₱${totalIncome.toLocaleString()}`);
      } else if (mooeData && mooeData.formattedData && Array.isArray(mooeData.formattedData)) {
        const filteredRows = mooeData.formattedData
          .map((row) => {
            const rowRegion = row?.region || row?.Region;
            const children = (row.children || []).filter((child) => {
              const childRegion = child?.region || child?.Region || rowRegion;
              if (!hasAssignmentFilters) return true;
              return matchesAssignmentScope({ ...child, region: childRegion });
            });
            return { ...row, children };
          })
          .filter((row) => row.children && row.children.length > 0);

        totalIncome = filteredRows.reduce(
          (sum, row) =>
            sum + (row.children || []).reduce((childSum, child) => childSum + toNumber(child?.income), 0),
          0
        );
        // console.log(`🔍 MOOE (nested): Found formatted data, ${filteredRows.length} rows after filter, total income: ₱${totalIncome.toLocaleString()}`);
      } else {
        // console.log(`⚠️ MOOE: No valid data structure found`, { mooeData });
      }

      if (totalIncome === 0 && calculatedBudgetarySupport?.breakdown) {
        const mooeItems = calculatedBudgetarySupport.breakdown.filter((item) =>
          item.source?.includes('MOOE') ||
          item.source?.includes('IAs O&M') ||
          item.source?.includes('MAINTENANCE')
        );

        mooeItems.forEach((item) => {
          if (!hasAssignmentFilters || matchesAssignmentScope(item)) {
            const incomeValue = item.income || item.corporateIncome || item.regionalIncome || 0;
            totalIncome += toNumber(incomeValue);
          }
        });
      }
    } else if (category === 'CAPITAL_OUTLAY') {
      if (capitalOutlayData && Array.isArray(capitalOutlayData)) {
        const allItems = capitalOutlayData.flatMap((regionData) => regionData.items || []);

        const regionFilteredData = hasAssignmentFilters
          ? allItems.filter((item) => matchesAssignmentScope(item))
          : allItems;

        totalIncome = regionFilteredData.reduce((sum, item) => sum + toNumber(item?.income), 0);

        // console.log(
          // `🔍 CAPITAL OUTLAY: Found ${allItems.length} total items, ${regionFilteredData.length} after region filter, total income: ₱${totalIncome.toLocaleString()}`
        // );
        if (allItems.length > 0) {
          // console.log(
            // `🔍 CAPITAL OUTLAY: Sample items:`,
            // allItems.slice(0, 2).map((item) => ({ region: item.region, income: item.income }))
          // );
        }
      } else {
        // console.log(`⚠️ CAPITAL OUTLAY: No valid data structure found`, { capitalOutlayData });
      }

      if (totalIncome === 0 && calculatedBudgetarySupport?.breakdown) {
        const coItems = calculatedBudgetarySupport.breakdown.filter((item) =>
          item.source?.includes('CAPITAL OUTLAY') ||
          item.source?.includes('Capital Outlay') ||
          item.source?.includes('CAPITAL OUTLAYS') ||
          item.source?.includes('CO')
        );

        coItems.forEach((item) => {
          if (!hasAssignmentFilters || matchesAssignmentScope(item)) {
            const incomeValue = item.income || item.corporateIncome || item.regionalIncome || 0;
            totalIncome += toNumber(incomeValue);
          }
        });
      }
    }

    // console.log(`✅ ${category}: Returning total income: ₱${totalIncome.toLocaleString()}`);
    return totalIncome;
  }, [calculatedBudgetarySupport, capitalOutlayData, mooeData, matchesAssignmentScope, hasAssignmentFilters]);
  const useOfFundsBreakdown = useMemo(() => {
    // A.1 CORPORATE INCOME - Sum of grouped items to ensure consistency with displayed rows
    const corporateIncome = Object.values(effectiveGroupedItems || {}).reduce((sum, item) => sum + (item.subtotal || 0), 0);

    // B.1.1 Personnel Services - Use Total field approach like Budget Summary cards
    let personalServices = 0;
    if (personalServicesData && Array.isArray(personalServicesData)) {
      const statusBreakdown = {};
      personalServicesData.forEach((p) => {
        const status = p?.statusOfAppointment || 'Unknown';
        if (!statusBreakdown[status]) statusBreakdown[status] = 0;
        statusBreakdown[status]++;
      });

      const filteredPersonnel = hasAssignmentFilters
        ? personalServicesData.filter((p) => matchesAssignmentScope(p))
        : personalServicesData;

      const uniquePersonnel = [];
      const seen = new Set();

      filteredPersonnel.forEach((p) => {
        if (!p) return;
        const key =
          p._id ||
          p.employeeNumber ||
          [
            normalizeName(p.employeeFullName || p.EmployeeName),
            normalizeName(p.positionTitle || p.PositionTitle),
            normalizeName(p.department || p.Department),
            normalizeName(p.division || p.Division),
            normalizeName(p.region || p.Region || p.regionName || p.RegionName)
          ].join('|');

        if (!seen.has(key)) {
          seen.add(key);
          uniquePersonnel.push(p);
        }
      });

      personalServices = uniquePersonnel.reduce((sum, p) => {
        if (!p) return sum;
        return sum + toNumber(p.Total ?? p.total ?? p.amount ?? p.annualSalary ?? p.TotalAmount);
      }, 0);

    }

    // B.1.2 MOOE - Split income vs subsidy from MOOE records
    let maintenanceAndOperatingIncome = 0;
    let maintenanceAndOperatingSubsidy = 0;
    if (mooeData && Array.isArray(mooeData)) {
      const filteredMooe = hasAssignmentFilters
        ? mooeData.filter((item) => matchesAssignmentScope(item))
        : mooeData;
      
      filteredMooe.forEach((item) => {
        maintenanceAndOperatingIncome += toNumber(item?.income || 0);
        maintenanceAndOperatingSubsidy += toNumber(item?.subsidy || item?.totalSubsidy || 0);
      });
    }

    const maintenanceAndOperating = maintenanceAndOperatingIncome + maintenanceAndOperatingSubsidy;

    // B.2 CAPITAL OUTLAYS - Use TOTAL expenses from capitalOutlayData, NOT just subsidies
    let capitalOutlays = 0;
    if (capitalOutlayData && Array.isArray(capitalOutlayData)) {
      const allItems = capitalOutlayData.flatMap((regionData) => regionData.items || []);
      const filteredCapitalOutlay = hasAssignmentFilters
        ? allItems.filter((item) => matchesAssignmentScope(item))
        : allItems;
      
      capitalOutlays = filteredCapitalOutlay.reduce((sum, item) => {
        return sum + toNumber(item?.totalCost || item?.cost || item?.amount || item?.expense || 0);
      }, 0);
    }

    // Operating Requirements Total
    const operatingRequirements = personalServices + maintenanceAndOperatingIncome + maintenanceAndOperatingSubsidy + capitalOutlays;
    
    // Charged to Income Totals
    let chargedToIncomeAmount = 0;
    let chargedToIncomeSubsidy = 0;
    if (chargedToIncomeData && Array.isArray(chargedToIncomeData)) {
      // console.log('DEBUG useOfFundsBreakdown - chargedToIncomeData found:', {
        // count: chargedToIncomeData.length,
        // sample: chargedToIncomeData[0],
        // sampleKeys: chargedToIncomeData[0] ? Object.keys(chargedToIncomeData[0]) : []
      // });
      
      const filteredChargedToIncome = hasAssignmentFilters
        ? chargedToIncomeData.filter((p) => matchesAssignmentScope(p))
        : chargedToIncomeData;
      
      // console.log('DEBUG useOfFundsBreakdown - filtered data:', {
        // originalCount: chargedToIncomeData.length,
        // filteredCount: filteredChargedToIncome.length
      // });
      
      chargedToIncomeAmount = filteredChargedToIncome.reduce((sum, p) => {
        const amount = toNumber(p.chargedToIncomeAmount || 0);
        if (amount > 0) {
          // console.log('DEBUG - Found chargedToIncomeAmount:', {
            // employeeName: p.employeeFullName,
            // amount: amount
          // });
        }
        return sum + amount;
      }, 0);
      
      chargedToIncomeSubsidy = filteredChargedToIncome.reduce((sum, p) => {
        return sum + toNumber(p.chargedToIncomeSubsidyAmount || 0);  // Use chargedToIncomeSubsidyAmount, NOT subsidyAmount
      }, 0);
    } else {
      // console.log('DEBUG useOfFundsBreakdown - chargedToIncomeData missing or not array:', {
        // isArray: Array.isArray(chargedToIncomeData),
        // isNull: chargedToIncomeData === null,
        // isUndefined: chargedToIncomeData === undefined,
        // type: typeof chargedToIncomeData
      // });
    }
    
    // DEBUG: Log charged-to-income calculations
    // console.log('DEBUG BudgetarySupportTable - Charged to Income Totals:', {
      // count: chargedToIncomeData?.length || 0,
      // amount: chargedToIncomeAmount,
      // subsidy: chargedToIncomeSubsidy,
      // willRender: chargedToIncomeAmount > 0
    // });
    
    return {
      corporateIncome,
      personalServices,
      maintenanceAndOperating,
      maintenanceAndOperatingIncome,
      maintenanceAndOperatingSubsidy,
      capitalOutlays,
      operatingRequirements,
      chargedToIncomeAmount,
      chargedToIncomeSubsidy
    };
  }, [mooeData, capitalOutlayData, personalServicesData, chargedToIncomeData, effectiveGroupedItems, matchesAssignmentScope, hasAssignmentFilters]);

  useEffect(() => {
    if (onChargedToIncomeChange && useOfFundsBreakdown.chargedToIncomeAmount !== undefined) {
      onChargedToIncomeChange(useOfFundsBreakdown.chargedToIncomeAmount);
    }
    
    if (onNonChargedPersonnelServicesChange && useOfFundsBreakdown.personalServices !== undefined) {
      const nonChargedPersonnelServices = useOfFundsBreakdown.personalServices - useOfFundsBreakdown.chargedToIncomeAmount;
      onNonChargedPersonnelServicesChange(nonChargedPersonnelServices);
    }
  }, [useOfFundsBreakdown.chargedToIncomeAmount, useOfFundsBreakdown.personalServices, onChargedToIncomeChange, onNonChargedPersonnelServicesChange]);


  const handleExportToExcel = useCallback(() => {
    // Calculate values for export using the helper function
    const mooeIncomeFromRegion = getCorporateIncomeFromBreakdown('MOOE');
    const coIncomeFromRegion = getCorporateIncomeFromBreakdown('CAPITAL_OUTLAY');

    const exportData = [
      {
        'Description': 'Budgetary Support Total',
        'Amount': parseFloat(amount || 0),
        'Fiscal Year': fiscalYear,
        'Budget Type': budgetType,
        'Region': selectedRegion || '',
        'Last Updated': new Date().toLocaleString(),
        'Status': 'Auto-calculated'
      },
      {
        'Description': 'A.1 CORPORATE INCOME',
        'Amount': parseFloat(useOfFundsBreakdown.corporateIncome || 0),
        'Fiscal Year': fiscalYear,
        'Budget Type': budgetType,
        'Region': selectedRegion || '',
        'Last Updated': new Date().toLocaleString(),
        'Status': 'Auto-calculated'
      },
      {
        'Description': 'B.1.1 Personnel Services',
        'Projected Corporate Income': 0,
        'Projected Subsidy': parseFloat(useOfFundsBreakdown.personalServices || 0),
        'Proposed Budget': parseFloat(useOfFundsBreakdown.personalServices || 0),
        'Fiscal Year': fiscalYear,
        'Budget Type': budgetType,
        'Region': selectedRegion || '',
        'Last Updated': new Date().toLocaleString(),
        'Status': 'Auto-calculated'
      },
      {
        'Description': 'B.1.2 MAINTENANCE AND OTHER OPERATING EXPENSES',
        'Projected Corporate Income': parseFloat(useOfFundsBreakdown.maintenanceAndOperatingIncome || 0),
        'Projected Subsidy': parseFloat(useOfFundsBreakdown.maintenanceAndOperatingSubsidy || 0),
        'Proposed Budget': parseFloat((Number(useOfFundsBreakdown.maintenanceAndOperatingIncome) + Number(useOfFundsBreakdown.maintenanceAndOperatingSubsidy)) || 0),
        'Fiscal Year': fiscalYear,
        'Budget Type': budgetType,
        'Region': selectedRegion || '',
        'Last Updated': new Date().toLocaleString(),
        'Status': 'Auto-calculated'
      },
      {
        'Description': 'B.2 CAPITAL OUTLAYS',
        'Projected Corporate Income': parseFloat(coIncomeFromRegion || 0),
        'Projected Subsidy': parseFloat(useOfFundsBreakdown.capitalOutlays || 0),
        'Proposed Budget': parseFloat((Number(coIncomeFromRegion) + Number(useOfFundsBreakdown.capitalOutlays)) || 0),
        'Fiscal Year': fiscalYear,
        'Budget Type': budgetType,
        'Region': selectedRegion || '',
        'Last Updated': new Date().toLocaleString(),
        'Status': 'Auto-calculated'
      },
      {
        'Description': 'TOTAL USES OF FUNDS',
        'Projected Corporate Income': parseFloat((Number(mooeIncomeFromRegion) + Number(coIncomeFromRegion)) || 0),
        'Projected Subsidy': parseFloat(useOfFundsBreakdown.operatingRequirements || 0),
        'Proposed Budget': parseFloat((Number(mooeIncomeFromRegion) + Number(coIncomeFromRegion) + Number(useOfFundsBreakdown.operatingRequirements)) || 0),
        'Fiscal Year': fiscalYear,
        'Budget Type': budgetType,
        'Region': selectedRegion || '',
        'Last Updated': new Date().toLocaleString(),
        'Status': 'Auto-calculated'
      },
      {
        'Description': 'TOTAL SOURCES OF FUNDS',
        'Projected Corporate Income': parseFloat((Number(mooeIncomeFromRegion) + Number(coIncomeFromRegion)) || 0),
        'Projected Subsidy': parseFloat(useOfFundsBreakdown.operatingRequirements || 0),
        'Proposed Budget': parseFloat((Number(mooeIncomeFromRegion) + Number(coIncomeFromRegion) + Number(useOfFundsBreakdown.operatingRequirements)) || 0),
        'Fiscal Year': fiscalYear,
        'Budget Type': budgetType,
        'Region': selectedRegion || '',
        'Last Updated': new Date().toLocaleString(),
        'Status': 'Auto-calculated'
      }
    ];

    // Create CSV content
    const headers = Object.keys(exportData[0]);
    const csvContent = [
      headers.join(','),
      ...exportData.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
    ].join('\n');

    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Budgetary_Support_UseOfFunds_Enhanced_${fiscalYear}_${budgetType}_${regionName || 'All'}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast.success("Enhanced budgetary support and use of funds data exported successfully!");
    setExportMenuAnchor(null);
  }, [amount, fiscalYear, budgetType, selectedRegion, regionName, useOfFundsBreakdown, getCorporateIncomeFromBreakdown]);

  // No add/edit functionality - amount is auto-calculated

  // Show summary for A.1.1 IRRIGATION SERVICE FEES (Corporate Income)
  const irrigationServiceFees = useOfFundsBreakdown.corporateIncome || 0;

  const corporateIncomeFromMOOE = useMemo(
    () => Number(useOfFundsBreakdown.maintenanceAndOperatingIncome || 0),
    [useOfFundsBreakdown.maintenanceAndOperatingIncome]
  );

  const corporateIncomeFromCapitalOutlay = useMemo(
    () => getCorporateIncomeFromBreakdown('CAPITAL_OUTLAY'),
    [getCorporateIncomeFromBreakdown]
  );

  // Separate the "Corporate Income" subtotal (from the list) from the "Total Projected Income" (Grand Total)
  const corporateIncomeSubtotal = Number(useOfFundsBreakdown.corporateIncome || 0);
  
  // Use ONLY the Corporate Income subtotal for Sources (separate from uses)
  // Always use the displayed subtotal from category breakdown to keep UI consistent
  const totalCorporateIncomeSources = corporateIncomeSubtotal;
  
  const totalCorporateIncomeUses = corporateIncomeFromMOOE + corporateIncomeFromCapitalOutlay + Number(useOfFundsBreakdown.chargedToIncomeAmount || 0);

  // Prefer provided projectedSubsidy when truthy; otherwise fall back to subsidy-only needs (PS + MOOE subsidy + CO)
  const calculatedSubsidyNeed =
    (Number(useOfFundsBreakdown.personalServices || 0) - Number(useOfFundsBreakdown.chargedToIncomeAmount || 0)) +
    Number(useOfFundsBreakdown.maintenanceAndOperatingSubsidy || 0) +
    Number(useOfFundsBreakdown.capitalOutlays || 0);
  
  // IMPORTANT: Always use calculated value for both SOURCES and USES to keep them in sync
  // This ensures that when line items are updated, both sides reflect the same total
  const totalSubsidySources = calculatedSubsidyNeed;
  const totalSubsidyUses = calculatedSubsidyNeed;

  // TOTAL SOURCES: Projected Corporate Income should reflect ONLY TOTAL CORPORATE INCOME
  const totalProjectedCorporateIncomeSources = totalCorporateIncomeSources;
  // Proposed Budget Sources = Total Corporate Income + Total Subsidy Sources
  const totalProposedBudgetSources = totalProjectedCorporateIncomeSources + totalSubsidySources;
  const totalProposedBudgetUses = totalCorporateIncomeUses + totalSubsidyUses;

  const surplusDeficit = {
    corporateIncome: totalCorporateIncomeSources - totalCorporateIncomeUses,
    subsidy: totalSubsidySources - totalSubsidyUses,
    proposedBudget: totalProposedBudgetSources - totalProposedBudgetUses
  };

  useEffect(() => {
    if (onBudgetDeficitChange) {
      const hasDeficit = surplusDeficit.proposedBudget < 0;
      onBudgetDeficitChange({
        hasDeficit,
        amount: Math.abs(surplusDeficit.proposedBudget),
        corporateIncomeDeficit: surplusDeficit.corporateIncome < 0,
        subsidyDeficit: surplusDeficit.subsidy < 0,
        totalSources: totalProposedBudgetSources,
        totalUses: totalProposedBudgetUses
      });
    }
  }, [surplusDeficit.proposedBudget, surplusDeficit.corporateIncome, surplusDeficit.subsidy, totalProposedBudgetSources, totalProposedBudgetUses, onBudgetDeficitChange]);

  if (!hasValidParams) {
    return (
      <Box sx={{ width: '100%', mb: 4 }}>
        <Card sx={{ mb: 2, p: 2, background: '#f5f5f5' }}>
          <Typography variant="h6" color="primary">
            A.1.1 IRRIGATION SERVICE FEES = {irrigationServiceFees.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Typography>
          {regionName && (
            <Typography variant="body2" color="textSecondary">
              Region: {regionName}
            </Typography>
          )}
        </Card>
        <Alert severity="warning">
          Cannot load budgetary support data: Missing fiscal year or budget type.
        </Alert>
      </Box>
    );
  }

  // Show authentication warning if user is not logged in
  if (authTest?.status === 'unauthenticated') {
    return (
      <Box sx={{ width: '100%', mb: 4 }}>
        <Alert severity="warning">
          You need to be logged in to view budgetary support data. Please log in and try again.
        </Alert>
      </Box>
    );
  }

  // Show auth error if there's an unexpected authentication issue
  if (authTest?.status === 'error') {
    return (
      <Box sx={{ width: '100%', mb: 4 }}>
        <Alert severity="error">
          Authentication check failed: {authTest.error}
        </Alert>
      </Box>
    );
  }

  if (loadingTimeout) {
    return (
      <Box sx={{ width: '100%', mb: 4 }}>
        <Alert severity="warning">
          Loading is taking longer than expected. Please check your connection and try refreshing the page.
        </Alert>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box sx={{ width: '100%', mb: 4, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', p: 3 }}>
        <CircularProgress size={40} sx={{ mb: 2 }} />
        <Typography variant="body1" color="textSecondary">
          Loading budgetary support data...
        </Typography>
        <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {isLoadingCalculated && <Typography variant="body2" color="textSecondary">• Calculating budgetary support...</Typography>}
          {isLoadingCapitalOutlay && <Typography variant="body2" color="textSecondary">• Loading capital outlay data...</Typography>}
          {isLoadingMOOE && <Typography variant="body2" color="textSecondary">• Loading MOOE data...</Typography>}
          {isLoadingPersonnel && <Typography variant="body2" color="textSecondary">• Loading personnel data...</Typography>}
          {isLoadingBudgetarySupport && <Typography variant="body2" color="textSecondary">• Loading existing budgetary support...</Typography>}
        </Box>
      </Box>
    );
  }

  // Combined error state for all queries
  const combinedError = errorCalculated || errorCapitalOutlay || errorMOOE || personnelError || error;

  // Debug error states

  if (combinedError) {
    return (
      <Box sx={{ width: '100%', mb: 4 }}>
        <Alert severity="error">
          Failed to load budgetary support data. Please try again.
          {errorCalculated && <div>Calculated data error: {errorCalculated.message}</div>}
          {errorCapitalOutlay && <div>Capital outlay error: {errorCapitalOutlay.message}</div>}
          {errorMOOE && <div>MOOE error: {errorMOOE.message}</div>}
          {personnelError && <div>Personnel error: {personnelError.message}</div>}
          {error && <div>Budgetary support error: {error.message}</div>}
        </Alert>
      </Box>
    );
  }

  // Enhanced toolbar component
  const renderEnhancedToolbar = () => (
    <Box sx={{ mb: 3 }}>
      {/* Top Row - Main Controls */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box display="flex" alignItems="center" gap={2}>
          {/* Info chip showing auto-calculation removed */}
        </Box>

        <Box display="flex" alignItems="center" gap={1}>
          {/* Export button */}
          <Tooltip title="Export data">
            <IconButton
              onClick={(e) => setExportMenuAnchor(e.currentTarget)}
              color="primary"
            >
              <GetAppIcon />
            </IconButton>
          </Tooltip>

          {/* Refresh button */}
          <Tooltip title="Refresh data">
            <IconButton onClick={handleRefresh} color="primary">
              <RefreshIcon />
            </IconButton>
          </Tooltip>

          {/* Force refresh button for stuck loading */}
          {isLoading && (
            <Tooltip title="Force refresh (if stuck loading)">
              <IconButton 
                onClick={() => {
                  // Force invalidate all queries
                  queryClient.invalidateQueries();
                  toast.info("Force refreshing all data...");
                }} 
                color="secondary"
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          )}

          {/* View toggle */}
          <Tooltip title="Toggle compact view">
            <IconButton
              onClick={() => setCompactView(!compactView)}
              color={compactView ? "primary" : "default"}
            >
              <VisibilityIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ width: '100%', mb: 4 }}>
      {/* Enhanced Toolbar */}
      {renderEnhancedToolbar()}

      {/* Use of Funds Table */}
      <Card sx={{ mb: 3, bgcolor: '#fff', boxShadow: 3, borderRadius: 3 }}>
        <CardContent sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1976d2', letterSpacing: 0.5 }}>
            A. SOURCES OF FUNDS
          </Typography>
          <Box display="flex" alignItems="center" gap={1}>
           
           
          </Box>
        </Box>
        <TableContainer sx={{ mb: 3, boxShadow: 2, borderRadius: 2, border: '1px solid #e0e0e0' }}>
          <Table size={compactView ? 'small' : 'medium'}>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#1976d2' }}>
                <TableCell sx={{ fontWeight: 'bold', color: 'white', width: '40%', fontSize: compactView ? '0.95rem' : '1.05rem', letterSpacing: 0.5, py: 2 }}>
                  CORPORATE INCOME
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold', color: 'white', width: '20%', fontSize: compactView ? '0.95rem' : '1.05rem', letterSpacing: 0.5, py: 2 }}>
                  PROJECTED CORPORATE INCOME
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold', color: 'white', width: '20%', fontSize: compactView ? '0.95rem' : '1.05rem', letterSpacing: 0.5, py: 2 }}>
                  PROJECTED SUBSIDY
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold', color: 'white', width: '20%', fontSize: compactView ? '0.95rem' : '1.05rem', letterSpacing: 0.5, py: 2 }}>
                  PROPOSED BUDGET
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {[
                { label: 'IRRIGATION SERVICE FEES', key: 'Irrigation Service Fees' },
                { label: 'RENT INCOME', key: 'Rent Income' },
                { label: 'WATER SERVICE FEE', key: 'Water Service Fee' },
                { label: 'MISCELLENEOUS INCOME', key: 'Miscellaneous Income' }
              ].map((row, idx) => (
                <TableRow key={row.key} sx={{ 
                  backgroundColor: idx % 2 === 0 ? '#f9f9f9' : '#fff',
                  '&:hover': { backgroundColor: '#f0f4f8' }
                }}>
                  <TableCell sx={{ pl: 3, py: 2, fontSize: compactView ? '0.95rem' : '1rem', verticalAlign: 'middle' }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, letterSpacing: 0.2 }}>
                      {row.label}
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ pr: 3, py: 2, fontSize: compactView ? '0.95rem' : '1rem', verticalAlign: 'middle' }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, color: '#1565c0', letterSpacing: 0.2 }}>
                      ₱{(effectiveGroupedItems?.[row.key]?.subtotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ pr: 3, py: 2, fontSize: compactView ? '0.95rem' : '1rem', verticalAlign: 'middle' }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.secondary', letterSpacing: 0.2 }}>
                      -
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ pr: 3, py: 2, fontSize: compactView ? '0.95rem' : '1rem', verticalAlign: 'middle' }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, color: '#1565c0', letterSpacing: 0.2 }}>
                      ₱{(effectiveGroupedItems?.[row.key]?.subtotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}

              <TableRow sx={{ 
                backgroundColor: '#e3f2fd',
                borderTop: '2px solid #1976d2'
              }}>
                <TableCell sx={{ pl: 3, py: 2 }}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="body2" fontWeight="bold" sx={{ fontSize: compactView ? '1rem' : '1.05rem', color: '#1976d2', letterSpacing: 0.5 }}>
                      TOTAL CORPORATE INCOME
                    </Typography>
                    <Chip label={`Items: ${Object.values(effectiveGroupedItems || {}).reduce((acc, g) => acc + ((g.items && Array.isArray(g.items)) ? g.items.length : 0), 0)}`}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.7rem' }} />
                  </Box>
                </TableCell>
                <TableCell align="right" sx={{ pr: 3, py: 2 }}>
                  <Typography variant="body2" fontWeight="bold" sx={{ fontSize: compactView ? '1rem' : '1.05rem', letterSpacing: 0.5, color: '#1565c0' }}>
                    ₱{corporateIncomeSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={{ pr: 3, py: 2 }}>
                  <Typography variant="body2" fontWeight="bold" sx={{ fontSize: compactView ? '1rem' : '1.05rem', color: 'text.secondary', letterSpacing: 0.5 }}>
                    -
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={{ pr: 3, py: 2 }}>
                  <Typography variant="body2" fontWeight="bold" sx={{ fontSize: compactView ? '1rem' : '1.05rem', letterSpacing: 0.5, color: '#1565c0' }}>
                    ₱{corporateIncomeSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>

   <TableContainer sx={{ mb: 3, boxShadow: 2, borderRadius: 2, border: '1px solid #e0e0e0' }}>
            <Table size={compactView ? 'small' : 'medium'}>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#1976d2' }}>
                  <TableCell sx={{ fontWeight: 'bold', color: 'white', width: '40%', fontSize: compactView ? '0.95rem' : '1.05rem', letterSpacing: 0.5, py: 2 }}>
                    BUDGETARY SUPPORT
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: 'white', width: '20%', fontSize: compactView ? '0.95rem' : '1.05rem', letterSpacing: 0.5, py: 2 }}>
                    PROJECTED CORPORATE INCOME
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: 'white', width: '20%', fontSize: compactView ? '0.95rem' : '1.05rem', letterSpacing: 0.5, py: 2 }}>
                    PROJECTED SUBSIDY
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: 'white', width: '20%', fontSize: compactView ? '0.95rem' : '1.05rem', letterSpacing: 0.5, py: 2 }}>
                    PROPOSED BUDGET
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow sx={{ 
                  backgroundColor: '#f9f9f9',
                  '&:hover': { backgroundColor: '#f0f4f8' }
                }}>
                  <TableCell sx={{ pl: 3, py: 2, fontSize: compactView ? '0.95rem' : '1rem', verticalAlign: 'middle' }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, letterSpacing: 0.2 }}>
                      Subsidy to the National Irrigation Administration:
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ pr: 3, py: 2, fontSize: compactView ? '0.95rem' : '1rem', verticalAlign: 'middle' }}>
                    <Typography variant="body2" color="text.secondary">
                      -
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ pr: 3, py: 2, fontSize: compactView ? '0.95rem' : '1rem', verticalAlign: 'middle' }}>
                    <Typography variant="body2" color="text.secondary">
                      -
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ pr: 3, py: 2, fontSize: compactView ? '0.95rem' : '1rem', verticalAlign: 'middle' }}>
                    <Typography variant="body2" color="text.secondary">
                      -
                    </Typography>
                  </TableCell>
                </TableRow>
                <TableRow sx={{ 
                  backgroundColor: '#fff',
                  '&:hover': { backgroundColor: '#f0f4f8' }
                }}>
                  <TableCell sx={{ pl: 3, py: 2, fontSize: compactView ? '0.95rem' : '1rem' }}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        a. Operating Requirements
                      </Typography>
                      <Chip
                        label="Auto-calculated"
                        size="small"
                        color="info"
                        sx={{ fontSize: '0.75rem' }}
                      />
                    </Box>
                  </TableCell>
                  <TableCell align="right" sx={{ pr: 3, py: 2, fontSize: compactView ? '0.95rem' : '1rem', verticalAlign: 'middle' }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.secondary', letterSpacing: 0.2 }}>
                      -
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ pr: 3, py: 2, fontSize: compactView ? '0.95rem' : '1rem', verticalAlign: 'middle' }}>
                    <Typography sx={{ fontWeight: 'medium', fontSize: compactView ? '0.95rem' : '1rem', color: '#2e7d32' }}>
                      ₱{totalSubsidySources.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ pr: 3, py: 2, fontSize: compactView ? '0.95rem' : '1rem', verticalAlign: 'middle' }}>
                    <Typography sx={{ fontWeight: 'medium', fontSize: compactView ? '0.95rem' : '1rem', color: '#1565c0' }}>
                      ₱{(totalCorporateIncomeUses + totalSubsidySources).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Typography>
                  </TableCell>
                </TableRow>
                <TableRow sx={{ 
                  background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
                  borderTop: '2px solid #1976d2'
                }}>
                  <TableCell sx={{ fontWeight: 'bold', fontSize: compactView ? '0.95rem' : '1.05rem', pl: 3, py: 2 }}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <TrendingUpIcon color="primary" fontSize="small" />
                      <Typography variant="body2" fontWeight="bold" sx={{ color: '#1976d2' }}>
                        TOTAL BUDGETARY SUPPORT
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: compactView ? '0.95rem' : '1.05rem', pr: 3, py: 2 }}>
                    <Typography variant="body2" fontWeight="bold" color="text.secondary">
                      -
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: compactView ? '0.95rem' : '1.05rem', pr: 3, py: 2 }}>
                    <Typography variant="body2" fontWeight="bold" sx={{ color: '#2e7d32' }}>
                      ₱{totalSubsidySources.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: compactView ? '0.95rem' : '1.05rem', pr: 3, py: 2 }}>
                    <Typography variant="body2" fontWeight="bold" sx={{ color: '#1976d2' }}>
                      ₱{(totalCorporateIncomeUses + totalSubsidySources).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Typography>
                  </TableCell>
                </TableRow>

                {/* TOTAL SOURCES OF FUNDS ROW */}
                <TableRow sx={{ 
                  backgroundColor: '#1b4e2c',
                  borderTop: '2px solid #2e7d32'
                }}>
                  <TableCell sx={{ fontWeight: 'bold', fontSize: compactView ? '0.95rem' : '1.05rem', pl: 3, py: 2 }}>
                    <Typography variant="body2" fontWeight="bold" sx={{ color: 'white' }}>
                      TOTAL SOURCES OF FUNDS
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: compactView ? '0.95rem' : '1.05rem', pr: 3, py: 2 }}>
                    <Typography variant="body2" fontWeight="bold" sx={{ color: 'white' }}>
                      ₱{totalProjectedCorporateIncomeSources.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: compactView ? '0.95rem' : '1.05rem', pr: 3, py: 2 }}>
                    <Typography variant="body2" fontWeight="bold" sx={{ color: 'white' }}>
                      ₱{totalSubsidySources.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: compactView ? '0.95rem' : '1.05rem', pr: 3, py: 2 }}>
                    <Typography variant="body2" fontWeight="bold" sx={{ color: 'white' }}>
                      ₱{totalProposedBudgetSources.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Typography>
                  </TableCell>
                </TableRow>
            </TableBody>
          </Table>
        </TableContainer>


      </CardContent>
    </Card>

   
      <Card sx={{ mb: 3, bgcolor: '#fff', boxShadow: 3, borderRadius: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1976d2', letterSpacing: 0.5 }}>
              B. USES OF FUNDS
            </Typography>
            <Box display="flex" alignItems="center" gap={1}>
             
              
            </Box>
          </Box>
          <TableContainer sx={{ mb: 3, boxShadow: 2, borderRadius: 2, border: '1px solid #e0e0e0' }}>
            <Table size={compactView ? 'small' : 'medium'}>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#1976d2' }}>
                  <TableCell sx={{ fontWeight: 'bold', color: 'white', width: '40%', fontSize: compactView ? '0.95rem' : '1.05rem', letterSpacing: 0.5, py: 2 }}>
                    USE OF FUNDS
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: 'white', width: '20%', fontSize: compactView ? '0.95rem' : '1.05rem', letterSpacing: 0.5, py: 2 }}>
                    PROJECTED CORPORATE INCOME
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: 'white', width: '20%', fontSize: compactView ? '0.95rem' : '1.05rem', letterSpacing: 0.5, py: 2 }}>
                    PROJECTED SUBSIDY
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: 'white', width: '20%', fontSize: compactView ? '0.95rem' : '1.05rem', letterSpacing: 0.5, py: 2 }}>
                    PROPOSED BUDGET
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
              {/* B.1.1 Personnel Services - Split between corporate income (charged) and subsidy (non-charged) */}
              <TableRow sx={{ 
                backgroundColor: '#f9f9f9',
                '&:hover': { backgroundColor: '#f0f4f8' }
              }}>
                <TableCell sx={{ pl: 3, py: 2, fontSize: compactView ? '0.95rem' : '1rem', verticalAlign: 'middle' }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, letterSpacing: 0.2 }}>
                    PERSONNEL SERVICES
                  </Typography>
                  
                </TableCell>
                <TableCell align="right" sx={{ pr: 3, py: 2, fontSize: compactView ? '0.95rem' : '1rem', verticalAlign: 'middle' }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, color: '#d32f2f', letterSpacing: 0.2 }}>
                    ₱{Number(useOfFundsBreakdown.chargedToIncomeAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={{ pr: 3, py: 2, fontSize: compactView ? '0.95rem' : '1rem', verticalAlign: 'middle' }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, color: '#2e7d32', letterSpacing: 0.2 }}>
                    ₱{Number((useOfFundsBreakdown.personalServices || 0) - (useOfFundsBreakdown.chargedToIncomeAmount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={{ pr: 3, py: 2, fontSize: compactView ? '0.95rem' : '1rem', verticalAlign: 'middle' }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, color: '#1976d2', letterSpacing: 0.2 }}>
                    ₱{Number(useOfFundsBreakdown.personalServices || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </TableCell>
              </TableRow>



              {/* B.1.2 MAINTENANCE AND OTHER OPERATING EXPENSES - Has both CORPORATE INCOME and SUBSIDY */}
              <TableRow sx={{ 
                backgroundColor: '#fff',
                '&:hover': { backgroundColor: '#f0f4f8' }
              }}>
                <TableCell sx={{ pl: 3, py: 2, fontSize: compactView ? '0.95rem' : '1rem', verticalAlign: 'middle' }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, letterSpacing: 0.2 }}>
                    MAINTENANCE AND OTHER OPERATING EXPENSES
                  </Typography>
              
                </TableCell>
                <TableCell align="right" sx={{ pr: 3, py: 2, fontSize: compactView ? '0.95rem' : '1rem', verticalAlign: 'middle' }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, color: '#d32f2f', letterSpacing: 0.2 }}>
                    ₱{Number(useOfFundsBreakdown.maintenanceAndOperatingIncome || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={{ pr: 3, py: 2, fontSize: compactView ? '0.95rem' : '1rem', verticalAlign: 'middle' }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, color: '#2e7d32', letterSpacing: 0.2 }}>
                    ₱{Number(useOfFundsBreakdown.maintenanceAndOperatingSubsidy || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={{ pr: 3, py: 2, fontSize: compactView ? '0.95rem' : '1rem', verticalAlign: 'middle' }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, color: '#1976d2', letterSpacing: 0.2 }}>
                    ₱{(Number(useOfFundsBreakdown.maintenanceAndOperatingIncome || 0) + Number(useOfFundsBreakdown.maintenanceAndOperatingSubsidy || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </TableCell>
              </TableRow>

              {/* B.2 CAPITAL OUTLAYS - Has both CORPORATE INCOME and SUBSIDY */}
              <TableRow sx={{ 
                backgroundColor: '#f9f9f9',
                '&:hover': { backgroundColor: '#f0f4f8' }
              }}>
                <TableCell sx={{ pl: 3, py: 2, fontSize: compactView ? '0.95rem' : '1rem', verticalAlign: 'middle' }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, letterSpacing: 0.2 }}>
                    CAPITAL OUTLAYS
                  </Typography>
               
                </TableCell>
                <TableCell align="right" sx={{ pr: 3, py: 2, fontSize: compactView ? '0.95rem' : '1rem', verticalAlign: 'middle' }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, color: '#d32f2f', letterSpacing: 0.2 }}>
                    ₱{corporateIncomeFromCapitalOutlay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={{ pr: 3, py: 2, fontSize: compactView ? '0.95rem' : '1rem', verticalAlign: 'middle' }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, color: '#2e7d32', letterSpacing: 0.2 }}>
                    ₱{Number(useOfFundsBreakdown.capitalOutlays || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={{ pr: 3, py: 2, fontSize: compactView ? '0.95rem' : '1rem', verticalAlign: 'middle' }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, color: '#1976d2', letterSpacing: 0.2 }}>
                    ₱{(corporateIncomeFromCapitalOutlay + Number(useOfFundsBreakdown.capitalOutlays || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </TableCell>
              </TableRow>

              {/* TOTAL ROW */}
              <TableRow sx={{ 
                background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
                borderTop: '2px solid #1976d2'
              }}>
                <TableCell sx={{ pl: 3, py: 2 }}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <TrendingUpIcon color="primary" fontSize="small" />
                    <Typography variant="body2" fontWeight="bold" sx={{ fontSize: compactView ? '1rem' : '1.05rem', color: '#1976d2', letterSpacing: 0.5 }}>
                      TOTAL USES OF FUNDS
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell align="right" sx={{ pr: 3, py: 2 }}>
                  <Typography variant="body2" fontWeight="bold" sx={{ fontSize: compactView ? '1rem' : '1.05rem', letterSpacing: 0.5, color: '#d32f2f' }}>
                    ₱{totalCorporateIncomeUses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={{ pr: 3, py: 2 }}>
                  <Typography variant="body2" fontWeight="bold" sx={{ fontSize: compactView ? '1rem' : '1.05rem', letterSpacing: 0.5, color: '#2e7d32' }}>
                    ₱{totalSubsidyUses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={{ pr: 3, py: 2 }}>
                  <Typography variant="body2" fontWeight="bold" sx={{ fontSize: compactView ? '1rem' : '1.05rem', letterSpacing: 0.5, color: '#1976d2' }}>
                    ₱{totalProposedBudgetUses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </TableCell>
              </TableRow>

              {/* SURPLUS/DEFICIT ROW */}
              <TableRow sx={{ 
                background: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)',
                borderTop: '2px solid #f57c00'
              }}>
                <TableCell sx={{ pl: 3, py: 2 }}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="body2" fontWeight="bold" sx={{ fontSize: compactView ? '1rem' : '1.05rem', color: '#f57c00', letterSpacing: 0.5 }}>
                      SURPLUS/DEFICIT
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell align="right" sx={{ pr: 3, py: 2 }}>
                  <Typography variant="body2" fontWeight="bold" sx={{ fontSize: compactView ? '1rem' : '1.05rem', letterSpacing: 0.5, color: '#f57c00' }}>
                    ₱{surplusDeficit.corporateIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={{ pr: 3, py: 2 }}>
                  <Typography variant="body2" fontWeight="bold" sx={{ fontSize: compactView ? '1rem' : '1.05rem', letterSpacing: 0.5, color: '#f57c00' }}>
                    ₱{surplusDeficit.subsidy.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={{ pr: 3, py: 2 }}>
                  <Typography variant="body2" fontWeight="bold" sx={{ fontSize: compactView ? '1rem' : '1.05rem', letterSpacing: 0.5, color: '#f57c00' }}>
                    ₱{surplusDeficit.proposedBudget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
        </CardContent>
      </Card>


      {/* Export Menu */}
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
    </Box>
  );
};

export default BudgetarySupportTable;

