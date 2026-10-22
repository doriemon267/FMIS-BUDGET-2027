import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Breadcrumbs,
  Link,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  FormControl,
  Select,
  MenuItem,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
} from '@mui/material';
import {
  Home as HomeIcon,
  NavigateNext as NavigateNextIcon,
  AccountBalance as BudgetIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useRegion } from '../context/RegionContext';
import { isSuperAdmin } from '../utils/checkRole';
import CeilingManagement from '../components/workflow/CeilingManagement';
import BudgetComparisonView from '../components/workflow/BudgetComparisonView';
import { useQuery } from '@tanstack/react-query';
import api from '../config/api';

// Brand colors
const BRAND_COLORS = {
  darkGreen: '#375e38',
  deepGreen: '#2d5016',
  lightGreen: '#4CAF50',
};

const ALL_REGIONS_VALUE = '__ALL_REGIONS__';

const formatCurrency = amount =>
  `₱${(Number(amount) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const AllRegionsCeilingOverview = ({ fiscalYear, availableRegions, onSelectRegion }) => {
  const { data: ceilings = [], isLoading, isError } = useQuery({
    queryKey: ['budgetCeilings', 'allRegions', fiscalYear],
    queryFn: async () => {
      const response = await api.get(`/api/budget-ceiling/regions/${fiscalYear}`);
      return response.data?.data || [];
    },
    enabled: Boolean(fiscalYear),
  });

  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress sx={{ color: BRAND_COLORS.deepGreen }} /></Box>;
  }

  if (isError) {
    return <Paper sx={{ p: 3, color: 'error.main' }}>Hindi makuha ang initialized NEP ceilings. Subukan ulit buksan ang page.</Paper>;
  }

  return (
    <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
      <Box sx={{ p: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h6" sx={{ color: BRAND_COLORS.deepGreen, fontWeight: 700 }}>Initialized NEP Regions</Typography>
          <Typography variant="body2" color="text.secondary">
            FY {fiscalYear} · {ceilings.length} region{ceilings.length === 1 ? '' : 's'} initialized. Buksan ang isang region para pamahalaan ang allocations nito.
          </Typography>
        </Box>
        <Chip label={`${ceilings.length} initialized`} color="success" variant="outlined" />
      </Box>
      <TableContainer>
        <Table size="small" sx={{ minWidth: 850 }}>
          <TableHead>
            <TableRow sx={{ bgcolor: BRAND_COLORS.darkGreen }}>
              {['Region', 'Ceiling Status', 'Responsibility Centers', 'NEP Proposals', 'Initial Request', 'Ceiling Total', ''].map((label, index) => (
                <TableCell key={`${label}-${index}`} align={index > 1 && index < 6 ? 'right' : 'left'} sx={{ color: '#fff', fontWeight: 700, whiteSpace: 'nowrap' }}>{label}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {ceilings.map(ceiling => {
              const allocations = ceiling.allocations || [];
              const generatedCount = allocations.filter(allocation => allocation.nepProposalId).length;
              const finalizedCount = allocations.filter(allocation => String(allocation.nepProposalStatus || '').toUpperCase() === 'FINALIZED').length;
              const initialTotal = allocations.reduce((sum, allocation) => sum + (Number(allocation.initialRequestAmount) || 0), 0);
              const ceilingTotal = allocations.reduce((sum, allocation) => sum + (Number(allocation.ceilingAmount) || 0), 0);
              const region = availableRegions.find(item =>
                [item.name, item.Region, item.regionName].some(name => name && name === ceiling.region)
              );

              return (
                <TableRow key={`${ceiling.region}-${ceiling._id}`} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{ceiling.region}</TableCell>
                  <TableCell><Chip size="small" label={ceiling.status || 'Draft'} color={ceiling.status === 'Published' ? 'success' : ceiling.status === 'Locked' ? 'warning' : 'default'} /></TableCell>
                  <TableCell align="right">{allocations.length}</TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{generatedCount} / {allocations.length}</Typography>
                    {finalizedCount > 0 && <Typography variant="caption" color="success.main">{finalizedCount} finalized</Typography>}
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{formatCurrency(initialTotal)}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 700, color: BRAND_COLORS.deepGreen }}>{formatCurrency(ceilingTotal)}</TableCell>
                  <TableCell align="right">
                    <Button size="small" variant="outlined" disabled={!region} onClick={() => onSelectRegion(region)} sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}>
                      Manage Region
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {ceilings.length === 0 && (
              <TableRow><TableCell colSpan={7} align="center" sx={{ py: 5, color: 'text.secondary' }}>Wala pang region na may initialized NEP ceiling para sa fiscal year na ito.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};

/**
 * NEP Ceiling Management Page
 * 
 * Dedicated page for BRD staff (Budget Officer, Budget Manager) to:
 * - Initialize budget ceilings from finalized Initial proposals
 * - Set ceiling amounts per division/department
 * - Publish ceilings for division visibility
 * - Generate NEP proposals based on ceiling allocations
 * - Compare Initial vs NEP budgets
 */
const NEPCeilingPage = () => {
  const navigate = useNavigate();
  const { currentUser } = useUser();
  const { activeRegion, availableRegions, changeActiveRegion } = useRegion();
  const [activeView, setActiveView] = useState('ceiling'); // 'ceiling' | 'comparison'
  const [selectedFiscalYear, setSelectedFiscalYear] = useState(new Date().getFullYear());
  const [availableFiscalYears, setAvailableFiscalYears] = useState([]);

  // Resolve region
  const resolvedRegion = activeRegion && typeof activeRegion === 'object'
    ? (activeRegion._id || activeRegion.id || activeRegion.Region || activeRegion.regionName || activeRegion.name)
    : activeRegion;

  const resolvedRegionString = activeRegion && typeof activeRegion === 'object'
    ? (activeRegion.regionName || activeRegion.Region || activeRegion.name || activeRegion._id)
    : (activeRegion || 'No region');

  // Fetch active fiscal year
  const { data: activeSettings, isSuccess: isActiveSettingsLoaded } = useQuery({
    queryKey: ['activeSettings'],
    queryFn: async () => {
      try {
        const res = await api.get('/settings/active');
        return res.data;
      } catch (error) {
        console.error('Error fetching active settings:', error);
        return null;
      }
    },
  });

  useEffect(() => {
    if (isActiveSettingsLoaded && activeSettings?.fiscalYear) {
      setSelectedFiscalYear(activeSettings.fiscalYear);
    }
  }, [isActiveSettingsLoaded, activeSettings]);

  useEffect(() => {
    const initializeFiscalYears = async () => {
      try {
        const summaryRes = await api.get('/api/allproposal/consolidation/summary');
        const data = summaryRes.data?.data;
        if (data?.byFiscalYear && typeof data.byFiscalYear === 'object') {
          const years = Object.keys(data.byFiscalYear)
            .map(Number)
            .filter((n) => !Number.isNaN(n))
            .sort((a, b) => b - a);
          setAvailableFiscalYears(years);
        }
      } catch (err) {
        console.error('Error fetching available fiscal years:', err);
      }
    };
    initializeFiscalYears();
  }, []);

  const currentYear = new Date().getFullYear();
  const fallbackYears = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];
  const fiscalYearOptions = Array.from(new Set([...availableFiscalYears, ...fallbackYears])).sort((a, b) => b - a);

  // Check if user is BRD staff (includes Super Admin so they can see finalized proposals on NEP Ceiling)
  const isBRDStaff =
    isSuperAdmin(currentUser) ||
    currentUser?.Roles?.some((role) =>
      [
        'BUDGET_OFFICER', 'BUDGET OFFICER',
        'BUDGET_MANAGER', 'BUDGET MANAGER',
        'SUPER_ADMIN', 'SUPER ADMIN',
      ].includes(role)
    );

  const handleViewChange = (event, newView) => {
    if (newView !== null) {
      setActiveView(newView);
    }
  };

  return (
    <Box sx={{ p: 3, bgcolor: '#f5f5f5', minHeight: '100vh' }}>
      {/* Header Section */}
      <Paper
        elevation={0}
        sx={{
          background: `linear-gradient(135deg, ${BRAND_COLORS.deepGreen} 0%, ${BRAND_COLORS.darkGreen} 100%)`,
          borderRadius: 3,
          p: 3,
          mb: 3,
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background decorations */}
        <Box sx={{
          position: 'absolute',
          top: -50,
          right: -50,
          width: 200,
          height: 200,
          borderRadius: '50%',
          background: 'rgba(255, 0, 0, 0.05)',
        }} />
        <Box sx={{
          position: 'absolute',
          bottom: -30,
          left: '50%',
          width: 150,
          height: 150,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.03)',
        }} />

        {/* Breadcrumbs */}
        <Breadcrumbs
          separator={<NavigateNextIcon fontSize="small" sx={{ color: 'rgba(255,255,255,0.7)' }} />}
          sx={{ mb: 2 }}
        >
          <Link
            underline="hover"
            sx={{ display: 'flex', alignItems: 'center', color: 'rgba(255,255,255,0.8)', cursor: 'pointer' }}
            onClick={() => navigate('/dashboard')}
          >
            <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
            Dashboard
          </Link>
          <Link
            underline="hover"
            sx={{ display: 'flex', alignItems: 'center', color: 'rgba(255,255,255,0.8)', cursor: 'pointer' }}
            onClick={() => navigate('/allproposal')}
          >
            Budget Proposals
          </Link>
          <Typography sx={{ display: 'flex', alignItems: 'center', color: 'white', fontWeight: 600 }}>
            <BudgetIcon sx={{ mr: 0.5 }} fontSize="small" />
            NEP Ceiling Management
          </Typography>
        </Breadcrumbs>

        {/* Title */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, position: 'relative', zIndex: 1 }}>
          <Box sx={{
            width: 56,
            height: 56,
            borderRadius: 2,
            bgcolor: 'rgba(255,255,255,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Typography sx={{ fontSize: '2rem' }}>📊</Typography>
          </Box>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, letterSpacing: '-0.5px' }}>
              NEP Budget Ceiling
            </Typography>
            <Typography sx={{ opacity: 0.9, fontSize: '0.95rem' }}>
              Set and manage National Expenditure Program budget ceilings per division
            </Typography>
          </Box>
        </Box>

        {/* Info chips */}
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
          <FormControl size="small" variant="outlined" sx={{ minWidth: 120 }}>
            <Select
              value={selectedFiscalYear}
              onChange={(e) => setSelectedFiscalYear(Number(e.target.value))}
              displayEmpty
              sx={{
                bgcolor: 'rgba(255,255,255,0.2)',
                color: 'white',
                fontWeight: 600,
                borderRadius: 8,
                height: 32,
                '.MuiOutlinedInput-notchedOutline': { border: 'none' },
                '&:hover .MuiOutlinedInput-notchedOutline': { border: 'none' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { border: 'none' },
                '.MuiSelect-icon': { color: 'white' },
                '.MuiSelect-select': { py: 0.5, px: 2, display: 'flex', alignItems: 'center' },
              }}
              MenuProps={{
                PaperProps: {
                  sx: {
                    bgcolor: BRAND_COLORS.deepGreen,
                    color: 'white',
                    mt: 1,
                    '& .MuiMenuItem-root': {
                      '&:hover': {
                        bgcolor: 'rgba(255,255,255,0.1)'
                      },
                      '&.Mui-selected': {
                        bgcolor: 'rgba(255,255,255,0.2)'
                      }
                    }
                  }
                }
              }}
            >
              {fiscalYearOptions.map((year, idx) => (
                <MenuItem key={idx} value={year}>
                  {`FY ${year}`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {availableRegions && availableRegions.length > 1 ? (
            <FormControl size="small" variant="outlined" sx={{ minWidth: 150 }}>
              <Select
                value={!activeRegion && isBRDStaff ? ALL_REGIONS_VALUE : resolvedRegionString}
                onChange={(e) => {
                  if (e.target.value === ALL_REGIONS_VALUE) {
                    changeActiveRegion(null);
                    return;
                  }
                  const region = availableRegions.find(
                    (r) =>
                      r.name === e.target.value ||
                      r.Region === e.target.value ||
                      r.regionName === e.target.value
                  );
                  if (region) changeActiveRegion(region);
                }}
                displayEmpty
                sx={{
                  bgcolor: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  fontWeight: 600,
                  borderRadius: 8,
                  height: 32,
                  '.MuiOutlinedInput-notchedOutline': { border: 'none' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { border: 'none' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { border: 'none' },
                  '.MuiSelect-icon': { color: 'white' },
                  '.MuiSelect-select': { py: 0.5, px: 2, display: 'flex', alignItems: 'center' },
                }}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      bgcolor: BRAND_COLORS.deepGreen,
                      color: 'white',
                      mt: 1,
                      '& .MuiMenuItem-root': {
                        '&:hover': {
                          bgcolor: 'rgba(255,255,255,0.1)'
                        },
                        '&.Mui-selected': {
                          bgcolor: 'rgba(255,255,255,0.2)'
                        }
                      }
                    }
                  }
                }}
              >
                {isBRDStaff && <MenuItem value={ALL_REGIONS_VALUE}>All Regions</MenuItem>}
                {availableRegions.map((r, idx) => {
                  const name = r.name || r.Region || r.regionName;
                  return (
                    <MenuItem key={idx} value={name}>
                      {name}
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
          ) : (
            <Chip
              label={resolvedRegionString}
              sx={{
                bgcolor: 'rgba(255,255,255,0.2)',
                color: 'white',
                fontWeight: 600,
                '& .MuiChip-label': { px: 2 },
              }}
            />
          )}
          <Chip
            label={isBRDStaff ? '✓ BRD Access' : '⚠ Limited Access'}
            sx={{
              bgcolor: isBRDStaff ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255, 152, 0, 0.3)',
              color: 'white',
              fontWeight: 600,
              '& .MuiChip-label': { px: 2 },
            }}
          />
        </Box>
      </Paper>

      {/* View Toggle */}
      <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: 2, bgcolor: 'white' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, color: BRAND_COLORS.deepGreen }}>
              {activeView === 'ceiling' ? 'Ceiling Allocations' : 'Budget Comparison'}
            </Typography>
            <Typography sx={{ color: '#666', fontSize: '0.85rem' }}>
              {activeView === 'ceiling' 
                ? 'Manage budget ceiling per division and generate NEP proposals'
                : 'Compare Initial proposals vs NEP ceiling allocations'}
            </Typography>
          </Box>
          <ToggleButtonGroup
            value={activeView}
            exclusive
            onChange={handleViewChange}
            size="small"
            sx={{
              '& .MuiToggleButton-root': {
                px: 3,
                textTransform: 'none',
                fontWeight: 600,
                '&.Mui-selected': {
                  bgcolor: BRAND_COLORS.deepGreen,
                  color: 'white',
                  '&:hover': {
                    bgcolor: BRAND_COLORS.darkGreen,
                  },
                },
              },
            }}
          >
            <ToggleButton value="ceiling">
              📋 Ceiling Management
            </ToggleButton>
            <ToggleButton value="comparison">
              📊 Compare Initial vs NEP
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Paper>

      {/* Main Content */}
      <Box>
        {!activeRegion && isBRDStaff ? (
          <AllRegionsCeilingOverview
            fiscalYear={selectedFiscalYear}
            availableRegions={availableRegions || []}
            onSelectRegion={changeActiveRegion}
          />
        ) : activeView === 'ceiling' ? (
          <CeilingManagement
            fiscalYear={selectedFiscalYear}
            region={resolvedRegion}
            regionName={resolvedRegionString}
            onRefresh={() => {}}
          />
        ) : (
          <BudgetComparisonView
            fiscalYear={selectedFiscalYear}
            region={resolvedRegion}
            regionName={resolvedRegionString}
          />
        )}
      </Box>

      {/* Footer info */}
      <Paper elevation={0} sx={{ p: 2, mt: 3, borderRadius: 2, bgcolor: '#fff8e1', border: '1px solid #ffcc80' }}>
        <Typography sx={{ color: '#e65100', fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          💡 Workflow Guide
        </Typography>
        <Box component="ol" sx={{ m: 0, pl: 2.5, color: '#666', fontSize: '0.9rem', '& li': { mb: 0.5 } }}>
          <li><strong>Initialize:</strong> Pull finalized Initial proposals to create ceiling baseline</li>
          <li><strong>Set Ceilings:</strong> Adjust ceiling amounts per division based on budget pool</li>
          <li><strong>Publish:</strong> Make ceilings visible to divisions for their NEP preparation</li>
          <li><strong>Generate NEP:</strong> Create NEP proposals from ceiling allocations</li>
        </Box>
      </Paper>
    </Box>
  );
};

export default NEPCeilingPage;
