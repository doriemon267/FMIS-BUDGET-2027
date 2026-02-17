import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Breadcrumbs,
  Link,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
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

// Brand colors
const BRAND_COLORS = {
  darkGreen: '#375e38',
  deepGreen: '#2d5016',
  lightGreen: '#4CAF50',
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

  // Resolve region
  const resolvedRegion = activeRegion && typeof activeRegion === 'object'
    ? (activeRegion._id || activeRegion.id || activeRegion.Region || activeRegion.regionName || activeRegion.name)
    : activeRegion;

  const resolvedRegionString = activeRegion && typeof activeRegion === 'object'
    ? (activeRegion.regionName || activeRegion.Region || activeRegion.name || activeRegion._id)
    : (activeRegion || 'No region');

  // Current fiscal year (could be made dynamic)
  const currentFiscalYear = new Date().getFullYear();

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
          <Chip
            label={`FY ${currentFiscalYear}`}
            sx={{
              bgcolor: 'rgba(255,255,255,0.2)',
              color: 'white',
              fontWeight: 600,
              '& .MuiChip-label': { px: 2 },
            }}
          />
          <Chip
            label={resolvedRegionString}
            sx={{
              bgcolor: 'rgba(255,255,255,0.2)',
              color: 'white',
              fontWeight: 600,
              '& .MuiChip-label': { px: 2 },
            }}
          />
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
        {activeView === 'ceiling' ? (
          <CeilingManagement
            fiscalYear={currentFiscalYear}
            region={resolvedRegion}
            regionName={resolvedRegionString}
            onRefresh={() => {}}
          />
        ) : (
          <BudgetComparisonView
            fiscalYear={currentFiscalYear}
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
