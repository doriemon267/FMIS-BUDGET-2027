import React from 'react';
import {
  Box,
  ButtonBase,
  Chip,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import ConstructionOutlinedIcon from '@mui/icons-material/ConstructionOutlined';

const icons = {
  income: AccountBalanceOutlinedIcon,
  personnel: GroupsOutlinedIcon,
  mooe: ReceiptLongOutlinedIcon,
  capital: ConstructionOutlinedIcon,
};

const fullCurrency = value =>
  `₱${Number(value || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const compactCurrency = value =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number(value || 0));

const scopeLabel = (value, fields) => {
  if (!value) return '';
  if (typeof value !== 'object') return String(value);
  return String(fields.map(field => value[field]).find(Boolean) || '');
};

const NEPWorkspaceNavigation = ({
  proposal,
  modules,
  activeModule,
  onModuleChange,
  canEdit,
  summary,
}) => {
  const theme = useTheme();
  const active = modules.find(module => module.key === activeModule) || modules[0];
  const variance = Number(summary.proposed || 0) - Number(summary.initial || 0);
  const region = scopeLabel(proposal.region, ['Region', 'regionName', 'RegionName', 'name']);
  const responsibilityCenter =
    scopeLabel(proposal.division, ['Division', 'divisionName', 'DivisionName', 'name']) ||
    scopeLabel(proposal.department, ['Department', 'departmentName', 'DepartmentName', 'name']) ||
    'Consolidated';

  return (
    <>
      <Paper
        component="section"
        variant="outlined"
        sx={{
          mt: 2.5,
          px: { xs: 1.5, md: 2 },
          py: 1.35,
          bgcolor: theme.palette.mode === 'dark'
            ? alpha(theme.palette.info.dark, 0.16)
            : alpha(theme.palette.info.dark, 0.055),
          borderLeft: '4px solid',
          borderLeftColor: 'info.dark',
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          alignItems={{ xs: 'flex-start', md: 'center' }}
          justifyContent="space-between"
          gap={1.25}
        >
          <Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', fontWeight: 800, letterSpacing: 0.55 }}
            >
              {region || 'Region'} · {responsibilityCenter} · FY {proposal.fiscalYear}
            </Typography>
            <Typography variant="h6" sx={{ mt: 0.15, fontWeight: 850 }}>
              NEP Budget Proposal — {active.label}
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
            <Chip size="small" variant="outlined" label="Initial: Read-Only" sx={{ fontWeight: 750 }} />
            <Chip
              size="small"
              color={canEdit ? 'success' : 'default'}
              label={canEdit ? 'NEP Mode: Active' : 'NEP Mode: Read-Only'}
              sx={{ fontWeight: 750 }}
            />
          </Stack>
        </Stack>
      </Paper>

      <Box
        component="nav"
        aria-label="NEP proposal modules"
        sx={{
          mt: 1.5,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
          gap: 1,
        }}
      >
        {modules.map(module => {
          const selected = module.key === activeModule;
          const Icon = icons[module.key];
          return (
            <ButtonBase
              key={module.key}
              onClick={() => onModuleChange(module.key)}
              aria-pressed={selected}
              sx={{
                minHeight: 82,
                width: '100%',
                justifyContent: 'flex-start',
                p: 1.5,
                border: 1,
                borderColor: selected ? '#2d5016' : 'divider',
                borderBottomWidth: selected ? 5 : 1,
                borderRadius: 1.5,
                bgcolor: selected ? '#2d5016' : 'background.paper',
                color: selected ? 'common.white' : 'text.primary',
                textAlign: 'left',
                transition: 'transform 140ms ease, border-color 140ms ease, background-color 140ms ease',
                '&:hover': {
                  transform: 'translateY(-1px)',
                  borderColor: selected ? '#2d5016' : 'success.main',
                  bgcolor: selected
                    ? '#355f19'
                    : alpha(theme.palette.success.main, theme.palette.mode === 'dark' ? 0.1 : 0.035),
                },
                '&:focus-visible': {
                  outline: `3px solid ${alpha(theme.palette.warning.main, 0.75)}`,
                  outlineOffset: 2,
                },
              }}
            >
              <Icon sx={{ mr: 1.25, fontSize: 25, opacity: selected ? 1 : 0.72 }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 850, lineHeight: 1.2 }}>{module.label}</Typography>
                <Typography
                  variant="body2"
                  sx={{ mt: 0.55, opacity: selected ? 0.88 : 0.68, fontVariantNumeric: 'tabular-nums' }}
                >
                  NEP {compactCurrency(module.total)}
                </Typography>
              </Box>
            </ButtonBase>
          );
        })}
      </Box>

      <Paper
        component="section"
        aria-label={`${active.label} proposal summary`}
        variant="outlined"
        sx={{
          mt: 1.25,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' },
          overflow: 'hidden',
        }}
      >
        {[
          ['Initial Proposal', summary.initial, 'Locked'],
          ['NEP Proposal', summary.proposed, 'Proposed'],
          ['Variance', Math.abs(variance), variance === 0 ? 'No change' : variance > 0 ? 'Increase' : 'Decrease'],
        ].map(([label, value, helper], index) => (
          <Box
            key={label}
            sx={{
              px: 1.5,
              py: 1.2,
              borderRight: { xs: index % 2 === 0 ? 1 : 0, lg: 1 },
              borderBottom: { xs: index < 2 ? 1 : 0, lg: 0 },
              borderColor: 'divider',
              bgcolor:
                label === 'NEP Proposal'
                  ? alpha(theme.palette.success.main, theme.palette.mode === 'dark' ? 0.13 : 0.05)
                  : 'transparent',
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, textTransform: 'uppercase' }}>
              {label}
            </Typography>
            <Typography sx={{ mt: 0.2, fontWeight: 850, fontVariantNumeric: 'tabular-nums' }}>
              {fullCurrency(value)}
            </Typography>
            <Typography variant="caption" color="text.secondary">{helper}</Typography>
          </Box>
        ))}
        <Box sx={{ px: 1.5, py: 1.2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, textTransform: 'uppercase' }}>
            Ceiling Status
          </Typography>
          <Typography color={`${summary.ceilingTone || 'success'}.main`} sx={{ mt: 0.2, fontWeight: 850 }}>
            {summary.ceilingLabel}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {summary.ceilingHelper}
          </Typography>
        </Box>
      </Paper>
    </>
  );
};

export default NEPWorkspaceNavigation;
