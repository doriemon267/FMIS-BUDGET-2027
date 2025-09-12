import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRegion } from '../../context/RegionContext';
import {
  Box,
  Paper,
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
  Grid,
  Menu,
  MenuItem,
  Fade,
  Zoom
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import GetAppIcon from '@mui/icons-material/GetApp';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import InfoIcon from '@mui/icons-material/Info';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import api from '../../config/api';
import { toast } from 'react-toastify';
import { useUser } from '../../context/UserContext';

const BudgetarySupportTable = ({ fiscalYear, budgetType, incomeGrandTotal = 0, groupedItems = {} }) => {
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

  // No custom formatting needed since amount is read-only

  // Check if we have valid fiscalYear and budgetType
  const hasValidParams = !!fiscalYear && !!budgetType;
  
  // Debug props
  console.log('📋 BudgetarySupportTable props:', { fiscalYear, budgetType, hasValidParams });
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

      console.log('🔍 Calling /budgetary-support/calculate with params:', params);
      const startTime = Date.now();
      const response = await api.get('/budgetary-support/calculate', { params, timeout: 12000 });
      const endTime = Date.now();
      console.log('✅ calculateBudgetarySupport response:', response.data);
      console.log(`⏱️ /budgetary-support/calculate took ${endTime - startTime}ms`);
      
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
      console.log('🔍 Calling /api/consolidated-reports/capital-outlay-data with params:', params);
      const startTime = Date.now();
      const response = await api.get('/api/consolidated-reports/capital-outlay-data', { params });
      const endTime = Date.now();
      console.log('✅ capital-outlay-data response received');
      console.log(`⏱️ /api/consolidated-reports/capital-outlay-data took ${endTime - startTime}ms`);
      
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
        console.log('🔍 Calling /mooe-list with query:', queryString);
        const startTime = Date.now();
        const response = await api.get(`/mooe-list${queryString}`);
        const endTime = Date.now();
        console.log('✅ mooe-list response received');
        console.log(`⏱️ /mooe-list took ${endTime - startTime}ms`);
        
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

  // Fetch Personal Services data for Use of Funds breakdown (Combined Permanent + Casual)
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
        
        console.log('🔍 Calling /getpersonnels with params:', { 
          ...baseParams
          // Don't send region manually - let hierarchical access control handle it
        });
        const startTime = Date.now();
        const response = await api.get('/getpersonnels', { 
          params: { 
            ...baseParams
            // Don't send region manually - let hierarchical access control handle it
          } 
        });
        const endTime = Date.now();
        console.log('✅ /getpersonnels response received');
        console.log(`⏱️ /getpersonnels took ${endTime - startTime}ms`);

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
        
        // If no data returned, try alternative endpoint names
        if (personnelData.length === 0) {
          
          const alternativeEndpoints = [
            '/personnelServices',
            '/personnel-services',
            '/personnel_services', 
            '/personnel',
            '/employees',
            '/personnel-service'
          ];
          
          for (const endpoint of alternativeEndpoints) {
            try {
              const testResponse = await api.get(endpoint, { params: { limit: 5 } });
              
              if (testResponse.data && (Array.isArray(testResponse.data) || testResponse.data.length > 0)) {
                // Try with our actual parameters
                const actualResponse = await api.get(endpoint, { params: baseParams });
                const actualData = actualResponse.data?.personnelServices || actualResponse.data || [];
                
                if (actualData.length > 0) {
                  return actualData;
                }
              }
            } catch (err) {
            }
          }
        }
        
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
            item.source?.includes('PERSONAL SERVICES') || 
            item.source?.includes('PS')
          );
          
          if (psBreakdown) {
            return [{
              Total: psBreakdown.amount,
              region: selectedRegion,
              employeeFullName: 'Consolidated PS',
              description: 'Total Personal Services from Budgetary Support Calculation'
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
      console.log('🔍 Calling /budgetary-support with params:', { fiscalYear, budgetType });
      const startTime = Date.now();
      const response = await api.get('/budgetary-support', {
        params: { fiscalYear, budgetType }
        // Don't send region manually - hierarchical access control will handle filtering
      });
      const endTime = Date.now();
      console.log('✅ /budgetary-support response received');
      console.log(`⏱️ /budgetary-support took ${endTime - startTime}ms`);
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

  // Combined loading state for all queries - MUST be defined after all useQuery hooks
  const isLoading = isLoadingCalculated || isLoadingCapitalOutlay || isLoadingMOOE || isLoadingPersonnel || isLoadingBudgetarySupport;

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

  // Helper function to get corporate income from actual data sources
  const getCorporateIncomeFromBreakdown = useCallback((category) => {
    let totalIncome = 0;
    
    if (category === 'MOOE') {
      // Get MOOE income from the actual MOOE data first
      // The breakdown data doesn't have income - we need the actual data
      if (mooeData && Array.isArray(mooeData)) {
        // If mooeData is a flat array (like from /mooe-list)
        totalIncome = mooeData.reduce((sum, item) => {
          const incomeValue = Number(item.income) || 0;
          return sum + incomeValue;
        }, 0);
      } else if (mooeData && mooeData.formattedData && Array.isArray(mooeData.formattedData)) {
        // If mooeData has nested structure with formattedData
        totalIncome = mooeData.formattedData.reduce((sum, row) => {
          return sum + (row.children || []).reduce((childSum, child) => {
            const incomeValue = Number(child.income) || 0;
            return childSum + incomeValue;
          }, 0);
        }, 0);
      }
      
      // Fallback: Check breakdown data (unlikely to have income but check anyway)
      if (totalIncome === 0 && calculatedBudgetarySupport?.breakdown) {
        const mooeItems = calculatedBudgetarySupport.breakdown.filter(item => 
          item.source?.includes('MOOE') || 
          item.source?.includes('IAs O&M') ||
          item.source?.includes('MAINTENANCE')
        );
        
        mooeItems.forEach(item => {
          // Look for income property in the breakdown data
          const incomeValue = item.income || item.corporateIncome || item.regionalIncome || 0;
          totalIncome += Number(incomeValue);
        });
      }
      
    } else if (category === 'CAPITAL_OUTLAY') {
      // Get Capital Outlay income from the actual Capital Outlay data
      // The breakdown data doesn't have income - we need the actual data
      if (capitalOutlayData && Array.isArray(capitalOutlayData)) {
        // Filter by current region and sum totalIncome (not income)
        const regionFilteredData = capitalOutlayData.filter(item => {
          // Handle different region name formats
          if (!regionName || regionName === 'All') return true;
          
          // Match region names (handle variations)
          const itemRegion = item.region?.toLowerCase();
          const currentRegion = regionName.toLowerCase();
          
          return itemRegion === currentRegion || 
                 itemRegion === currentRegion.replace(' region', '') ||
                 currentRegion === 'central office' && itemRegion === 'central region';
        });
        
        totalIncome = regionFilteredData.reduce((sum, item) => {
          // Use totalIncome property instead of income
          const incomeValue = Number(item.totalIncome) || Number(item.income) || 0;
          return sum + incomeValue;
        }, 0);
      }
      
      // Fallback: Check if breakdown has income data (unlikely but check anyway)
      if (totalIncome === 0 && calculatedBudgetarySupport?.breakdown) {
        const coItems = calculatedBudgetarySupport.breakdown.filter(item => 
          item.source?.includes('CAPITAL OUTLAY') || 
          item.source?.includes('Capital Outlay') ||
          item.source?.includes('CAPITAL OUTLAYS') ||
          item.source?.includes('CO')
        );
        
        coItems.forEach(item => {
          const incomeValue = item.income || item.corporateIncome || item.regionalIncome || 0;
          totalIncome += Number(incomeValue);
        });
      }
    }
    
    return totalIncome;
  }, [calculatedBudgetarySupport, capitalOutlayData, mooeData]);
  const useOfFundsBreakdown = useMemo(() => {
    // A.1 CORPORATE INCOME - Direct copy from IncomeTable
    const corporateIncome = incomeGrandTotal || 0;

    // Debug: Log calculatedBudgetarySupport structure
    if (calculatedBudgetarySupport?.breakdown) {
      console.log('🔍 calculatedBudgetarySupport breakdown:', calculatedBudgetarySupport.breakdown);
      calculatedBudgetarySupport.breakdown.forEach((item, index) => {
        console.log(`Breakdown ${index + 1}:`, item.source, '=', item.amount);
      });
    } else {
      console.log('❌ No calculatedBudgetarySupport.breakdown found:', calculatedBudgetarySupport);
    }

    // B.1.1 PERSONAL SERVICES - Use Total field approach like Budget Summary cards
    let personalServices = 0;
    if (personalServicesData && Array.isArray(personalServicesData)) {
      
      // Check for duplicate data by appointment status
      const statusBreakdown = {};
      personalServicesData.forEach(p => {
        const status = p.statusOfAppointment || 'Unknown';
        if (!statusBreakdown[status]) statusBreakdown[status] = 0;
        statusBreakdown[status]++;
      });
      
      // Filter by region if needed (in case API didn't filter properly)
      const filteredPersonnel = regionName 
        ? personalServicesData.filter(p => (p.region || p.Region) === regionName)
        : personalServicesData;

      // Check for duplicates - if we have both PERMANENT and CASUAL with similar names/amounts, we may be double-counting
      const uniquePersonnel = [];
      const seen = new Set();
      
      filteredPersonnel.forEach(p => {
        // Create a unique key based on employee details
        const key = `${p.employeeFullName}_${p.positionTitle}_${p.department}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniquePersonnel.push(p);
        } else {
        }
      });

      if (uniquePersonnel.length > 0) {
      }
      
      // Use Total field approach (matches Budget Summary cards in Proposal pages)
      personalServices = uniquePersonnel.reduce((sum, p) => {
        if (!p) return sum;
        return sum + (Number(p.Total) || Number(p.total) || 0);
      }, 0);

      // Show sample Total field values for verification
      if (uniquePersonnel.length > 0 && uniquePersonnel.length <= 5) {
        uniquePersonnel.forEach((p, index) => {
          const totalValue = Number(p.Total) || Number(p.total) || 0;
        });
      }
    } else {
    }

    // B.1.2 MOOE - Direct from server calculation
    const maintenanceAndOperating = calculatedBudgetarySupport?.breakdown?.find(item => 
      item.source?.includes('MOOE') || 
      item.source?.includes('IAs O&M') ||
      item.source?.includes('B.1.2 - MOOE') ||
      item.source?.includes('MAINTENANCE AND OTHER OPERATING')
    )?.amount || 0;

    // Debug MOOE calculation
    console.log('🔍 MOOE Debug:');
    console.log('- calculatedBudgetarySupport exists:', !!calculatedBudgetarySupport);
    console.log('- breakdown exists:', !!calculatedBudgetarySupport?.breakdown);
    console.log('- breakdown length:', calculatedBudgetarySupport?.breakdown?.length || 0);
    console.log('- maintenanceAndOperating value:', maintenanceAndOperating);
    
    if (calculatedBudgetarySupport?.breakdown) {
      const mooeItem = calculatedBudgetarySupport.breakdown.find(item => 
        item.source?.includes('MOOE') || 
        item.source?.includes('IAs O&M') ||
        item.source?.includes('B.1.2 - MOOE') ||
        item.source?.includes('MAINTENANCE AND OTHER OPERATING')
      );
      console.log('- Found MOOE breakdown item:', mooeItem);
    }

    // B.2 CAPITAL OUTLAYS - Get from server breakdown 
    let capitalOutlays = 0;
    if (calculatedBudgetarySupport?.breakdown) {
      const coFromBreakdown = calculatedBudgetarySupport.breakdown.find(item => 
        item.source?.includes('CAPITAL OUTLAY') || 
        item.source?.includes('Capital Outlay') ||
        item.source?.includes('CAPITAL OUTLAYS') ||
        item.source?.includes('Capital Outlays') ||
        item.source?.includes('CO')
      );
      
      if (coFromBreakdown) {
        capitalOutlays = coFromBreakdown.amount || 0;
      }
    }

    // Operating Requirements Total
    const operatingRequirements =  personalServices + maintenanceAndOperating + capitalOutlays;
    
    return {
      corporateIncome,
      personalServices,
      maintenanceAndOperating,
      capitalOutlays,
      operatingRequirements
    };
  }, [capitalOutlayData, personalServicesData, calculatedBudgetarySupport, selectedRegion, incomeGrandTotal]);

  // Enhanced export functionality
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
        'Description': 'B.1.1 PERSONAL SERVICES',
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
        'Projected Corporate Income': parseFloat(mooeIncomeFromRegion || 0),
        'Projected Subsidy': parseFloat(useOfFundsBreakdown.maintenanceAndOperating || 0),
        'Proposed Budget': parseFloat((Number(mooeIncomeFromRegion) + Number(useOfFundsBreakdown.maintenanceAndOperating)) || 0),
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
  }, [amount, fiscalYear, budgetType, selectedRegion, regionName, useOfFundsBreakdown, calculatedBudgetarySupport, getCorporateIncomeFromBreakdown]);

  // No add/edit functionality - amount is auto-calculated

  // Show summary for A.1.1 IRRIGATION SERVICE FEES (Corporate Income)
  const irrigationServiceFees = useOfFundsBreakdown.corporateIncome || 0;

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

  // Simple connectivity test
  const { data: connectivityTest, isLoading: isTestingConnectivity } = useQuery({
    queryKey: ['connectivity-test'],
    queryFn: async () => {
      try {
        console.log('🔍 Testing backend connectivity...');
        const startTime = Date.now();
        const response = await api.get('/test');
        const endTime = Date.now();
        console.log('✅ Backend connectivity test successful');
        console.log(`⏱️ Connectivity test took ${endTime - startTime}ms`);
        return { status: 'connected', response: response.data };
      } catch (error) {
        console.error('❌ Backend connectivity test failed:', {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          url: error.config?.url
        });
        return { status: 'disconnected', error: error.message };
      }
    },
    enabled: hasValidParams, // Only test when we have valid params
    retry: false,
    staleTime: 30000
  });

  // Check authentication status
  const { data: authTest, isLoading: isTestingAuth } = useQuery({
    queryKey: ['auth-test'],
    queryFn: async () => {
      try {
        console.log('🔍 Testing authentication...');
        const startTime = Date.now();
        // Try to access a protected endpoint that requires authentication
        const response = await api.get('/budgetary-support/calculate', { 
          params: { fiscalYear: Number(fiscalYear) || 2025, budgetType: budgetType || 'CURRENT' }
        });
        const endTime = Date.now();
        console.log('✅ Authentication test successful');
        console.log(`⏱️ Auth test took ${endTime - startTime}ms`);
        return { status: 'authenticated', response: response.data };
      } catch (error) {
        if (error.response?.status === 401 || error.response?.status === 403) {
          console.error('❌ Authentication failed - user not logged in or token expired');
          return { status: 'unauthenticated', error: 'Please log in to access this data' };
        } else {
          console.error('❌ Authentication test failed with unexpected error:', {
            message: error.message,
            status: error.response?.status,
            statusText: error.response?.statusText
          });
          return { status: 'error', error: error.message };
        }
      }
    },
    enabled: hasValidParams, // Only test when we have valid params
    retry: false,
    staleTime: 60000 // Cache for 1 minute
  });

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

  // Debug loading states
  console.log('🔄 Loading states:', {
    calculated: isLoadingCalculated,
    capitalOutlay: isLoadingCapitalOutlay,
    mooe: isLoadingMOOE,
    personnel: isLoadingPersonnel,
    budgetarySupport: isLoadingBudgetarySupport,
    combined: isLoading
  });

  // Timeout mechanism to prevent infinite loading
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  
  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        setLoadingTimeout(true);
      }, 15000); // 15 seconds timeout to surface issues faster
      
      return () => clearTimeout(timer);
    } else {
      setLoadingTimeout(false);
    }
  }, [isLoading]);

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
  console.log('❌ Error states:', {
    calculated: errorCalculated?.message,
    capitalOutlay: errorCapitalOutlay?.message,
    mooe: errorMOOE?.message,
    personnel: personnelError?.message,
    budgetarySupport: error?.message,
    combined: combinedError?.message
  });

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
            <Chip
              label="Auto-calculated from available data"
              size="small"
              color="info"
              variant="outlined"
            />
            <Tooltip title="PROJECTED CORPORATE INCOME comes from income data. PROJECTED SUBSIDY is government funding. PROPOSED BUDGET is the total requirement.">
              <IconButton size="small">
                <InfoIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        <TableContainer sx={{ mb: 3, boxShadow: 2, borderRadius: 2, border: '1px solid #e0e0e0' }}>
          <Table size={compactView ? 'small' : 'medium'}>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#1976d2' }}>
                <TableCell sx={{ fontWeight: 'bold', color: 'white', width: '40%', fontSize: compactView ? '0.95rem' : '1.05rem', letterSpacing: 0.5, py: 2 }}>
                  1. CORPORATE INCOME
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
                { label: 'A.1.1 IRRIGATION SERVICE FEES', key: 'Irrigation Service Fees' },
                { label: 'A.1.2 RENT INCOME', key: 'Rent Income' },
                { label: 'A.1.3 WATER SERVICE FEE', key: 'Water Service Fee' },
                { label: 'A.1.4 MISCELLENEOUS INCOME', key: 'Miscellaneous Income' }
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
                      ₱{(groupedItems?.[row.key]?.subtotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ pr: 3, py: 2, fontSize: compactView ? '0.95rem' : '1rem', verticalAlign: 'middle' }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.secondary', letterSpacing: 0.2 }}>
                      -
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ pr: 3, py: 2, fontSize: compactView ? '0.95rem' : '1rem', verticalAlign: 'middle' }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, color: '#1565c0', letterSpacing: 0.2 }}>
                      ₱{(groupedItems?.[row.key]?.subtotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow sx={{ 
                backgroundColor: '#e3f2fd',
                borderTop: '2px solid #1976d2'
              }}>
                <TableCell sx={{ pl: 3, py: 2 }}>
                  <Typography variant="body2" fontWeight="bold" sx={{ fontSize: compactView ? '1rem' : '1.05rem', color: '#1976d2', letterSpacing: 0.5 }}>
                    TOTAL CORPORATE INCOME
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={{ pr: 3, py: 2 }}>
                  <Typography variant="body2" fontWeight="bold" sx={{ fontSize: compactView ? '1rem' : '1.05rem', letterSpacing: 0.5, color: '#1565c0' }}>
                    ₱{(
                      ["Irrigation Service Fees", "Rent Income", "Water Service Fee", "Miscellaneous Income"]
                        .map(cat => groupedItems?.[cat]?.subtotal || 0)
                        .reduce((a, b) => a + b, 0)
                      || incomeGrandTotal
                    ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={{ pr: 3, py: 2 }}>
                  <Typography variant="body2" fontWeight="bold" sx={{ fontSize: compactView ? '1rem' : '1.05rem', color: 'text.secondary', letterSpacing: 0.5 }}>
                    -
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={{ pr: 3, py: 2 }}>
                  <Typography variant="body2" fontWeight="bold" sx={{ fontSize: compactView ? '1rem' : '1.05rem', letterSpacing: 0.5, color: '#1565c0' }}>
                    ₱{(
                      ["Irrigation Service Fees", "Rent Income", "Water Service Fee", "Miscellaneous Income"]
                        .map(cat => groupedItems?.[cat]?.subtotal || 0)
                        .reduce((a, b) => a + b, 0)
                      || incomeGrandTotal
                    ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
              2. BUDGETARY SUPPORT
            </Typography>
            <Box display="flex" alignItems="center" gap={1}>
              <Chip
                label="Auto-calculated subsidy requirements"
                size="small"
                color="success"
                variant="outlined"
              />
              <Tooltip title="PROJECTED CORPORATE INCOME comes from region-specific income data. PROJECTED SUBSIDY is government funding. PROPOSED BUDGET is the total requirement.">
                <IconButton size="small">
                  <InfoIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
          <TableContainer sx={{ mb: 3, boxShadow: 2, borderRadius: 2, border: '1px solid #e0e0e0' }}>
            <Table size={compactView ? 'small' : 'medium'}>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#1976d2' }}>
                  <TableCell sx={{ fontWeight: 'bold', color: 'white', width: '40%', fontSize: compactView ? '0.95rem' : '1.05rem', letterSpacing: 0.5, py: 2 }}>
                    2. BUDGETARY SUPPORT
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
                    <Typography variant="body2" color="text.secondary">
                      -
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ pr: 3, py: 2, fontSize: compactView ? '0.95rem' : '1rem', verticalAlign: 'middle' }}>
                    <Typography sx={{ fontWeight: 'medium', fontSize: compactView ? '0.95rem' : '1rem', color: '#2e7d32' }}>
                      ₱{useOfFundsBreakdown.operatingRequirements.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ pr: 3, py: 2, fontSize: compactView ? '0.95rem' : '1rem', verticalAlign: 'middle' }}>
                    <Typography sx={{ fontWeight: 'medium', fontSize: compactView ? '0.95rem' : '1rem', color: '#1565c0' }}>
                      ₱{useOfFundsBreakdown.operatingRequirements.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                    <Typography variant="body2" fontWeight="bold" sx={{ color: '#666' }}>
                      -
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: compactView ? '0.95rem' : '1.05rem', pr: 3, py: 2 }}>
                    <Typography variant="body2" fontWeight="bold" sx={{ color: '#2e7d32' }}>
                      ₱{useOfFundsBreakdown.operatingRequirements.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: compactView ? '0.95rem' : '1.05rem', pr: 3, py: 2 }}>
                    <Typography variant="body2" fontWeight="bold" sx={{ color: '#1976d2' }}>
                      ₱{useOfFundsBreakdown.operatingRequirements.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                      ₱{(getCorporateIncomeFromBreakdown('MOOE') + getCorporateIncomeFromBreakdown('CAPITAL_OUTLAY')).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: compactView ? '0.95rem' : '1.05rem', pr: 3, py: 2 }}>
                    <Typography variant="body2" fontWeight="bold" sx={{ color: 'white' }}>
                      ₱{(
                        useOfFundsBreakdown.operatingRequirements + 
                        0 // TOTAL CORPORATE INCOME PROJECTED SUBSIDY is 0 (dash)
                      ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: compactView ? '0.95rem' : '1.05rem', pr: 3, py: 2 }}>
                    <Typography variant="body2" fontWeight="bold" sx={{ color: 'white' }}>
                      ₱{(
                        getCorporateIncomeFromBreakdown('MOOE') + 
                        getCorporateIncomeFromBreakdown('CAPITAL_OUTLAY') + 
                        useOfFundsBreakdown.operatingRequirements +
                        0 // TOTAL CORPORATE INCOME PROJECTED SUBSIDY is 0 (dash)
                      ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
              <Chip
                label="Region-based CORPORATE INCOME and SUBSIDY breakdown"
                size="small"
                color="info"
                variant="outlined"
              />
              <Tooltip title="PROJECTED CORPORATE INCOME comes from region-specific income data. PROJECTED SUBSIDY is government funding. PROPOSED BUDGET is the total requirement.">
                <IconButton size="small">
                  <InfoIcon fontSize="small" />
                </IconButton>
              </Tooltip>
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
              {/* B.1.1 PERSONAL SERVICES - Only PROJECTED SUBSIDY (no corporate income allocated) */}
              <TableRow sx={{ 
                backgroundColor: '#f9f9f9',
                '&:hover': { backgroundColor: '#f0f4f8' }
              }}>
                <TableCell sx={{ pl: 3, py: 2, fontSize: compactView ? '0.95rem' : '1rem', verticalAlign: 'middle' }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, letterSpacing: 0.2 }}>
                    B.1.1 PERSONAL SERVICES
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontStyle: 'italic' }}>
                    (100% Subsidy - No corporate income allocation)
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={{ pr: 3, py: 2, fontSize: compactView ? '0.95rem' : '1rem', verticalAlign: 'middle' }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, color: '#666', letterSpacing: 0.2 }}>
                    -
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={{ pr: 3, py: 2, fontSize: compactView ? '0.95rem' : '1rem', verticalAlign: 'middle' }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, color: '#2e7d32', letterSpacing: 0.2 }}>
                    ₱{Number(useOfFundsBreakdown.personalServices || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                    B.1.2 MAINTENANCE AND OTHER OPERATING EXPENSES
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontStyle: 'italic' }}>
                    (Mixed funding: Regional income + Subsidy)
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={{ pr: 3, py: 2, fontSize: compactView ? '0.95rem' : '1rem', verticalAlign: 'middle' }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, color: '#d32f2f', letterSpacing: 0.2 }}>
                    ₱{getCorporateIncomeFromBreakdown('MOOE').toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={{ pr: 3, py: 2, fontSize: compactView ? '0.95rem' : '1rem', verticalAlign: 'middle' }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, color: '#2e7d32', letterSpacing: 0.2 }}>
                    ₱{Number(useOfFundsBreakdown.maintenanceAndOperating || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={{ pr: 3, py: 2, fontSize: compactView ? '0.95rem' : '1rem', verticalAlign: 'middle' }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, color: '#1976d2', letterSpacing: 0.2 }}>
                    ₱{(getCorporateIncomeFromBreakdown('MOOE') + Number(useOfFundsBreakdown.maintenanceAndOperating || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                    B.2 CAPITAL OUTLAYS
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontStyle: 'italic' }}>
                    (Mixed funding: Regional income + Subsidy)
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={{ pr: 3, py: 2, fontSize: compactView ? '0.95rem' : '1rem', verticalAlign: 'middle' }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, color: '#d32f2f', letterSpacing: 0.2 }}>
                    ₱{getCorporateIncomeFromBreakdown('CAPITAL_OUTLAY').toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={{ pr: 3, py: 2, fontSize: compactView ? '0.95rem' : '1rem', verticalAlign: 'middle' }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, color: '#2e7d32', letterSpacing: 0.2 }}>
                    ₱{Number(useOfFundsBreakdown.capitalOutlays || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={{ pr: 3, py: 2, fontSize: compactView ? '0.95rem' : '1rem', verticalAlign: 'middle' }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, color: '#1976d2', letterSpacing: 0.2 }}>
                    ₱{(getCorporateIncomeFromBreakdown('CAPITAL_OUTLAY') + Number(useOfFundsBreakdown.capitalOutlays || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                    ₱{(getCorporateIncomeFromBreakdown('MOOE') + getCorporateIncomeFromBreakdown('CAPITAL_OUTLAY')).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={{ pr: 3, py: 2 }}>
                  <Typography variant="body2" fontWeight="bold" sx={{ fontSize: compactView ? '1rem' : '1.05rem', letterSpacing: 0.5, color: '#2e7d32' }}>
                    ₱{useOfFundsBreakdown.operatingRequirements.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={{ pr: 3, py: 2 }}>
                  <Typography variant="body2" fontWeight="bold" sx={{ fontSize: compactView ? '1rem' : '1.05rem', letterSpacing: 0.5, color: '#1976d2' }}>
                    ₱{(
                      getCorporateIncomeFromBreakdown('MOOE') + 
                      getCorporateIncomeFromBreakdown('CAPITAL_OUTLAY') + 
                      useOfFundsBreakdown.operatingRequirements
                    ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                    ₱{(0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={{ pr: 3, py: 2 }}>
                  <Typography variant="body2" fontWeight="bold" sx={{ fontSize: compactView ? '1rem' : '1.05rem', letterSpacing: 0.5, color: '#f57c00' }}>
                    ₱{(0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={{ pr: 3, py: 2 }}>
                  <Typography variant="body2" fontWeight="bold" sx={{ fontSize: compactView ? '1rem' : '1.05rem', letterSpacing: 0.5, color: '#f57c00' }}>
                    ₱{(0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

