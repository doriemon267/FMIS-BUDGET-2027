import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import api from '../../config/api';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  TextField,
  InputAdornment,
  CircularProgress,
  Paper,
  Collapse,
  IconButton,
  Tooltip,
} from '@mui/material';
import { KeyboardArrowDown as KeyboardArrowDownIcon, KeyboardArrowUp as KeyboardArrowUpIcon, InfoOutlined as InfoOutlinedIcon } from '@mui/icons-material';

// Column widths for alignment (headers and cells must match)
const COL = {
  particulars: 'minmax(200px, 1fr)',
  corporateIncome: 160,
  tier1: 150,
  tier2: 150,
  total: 150,
  proposedBudget: 150,
};

const EMPTY_LIST = Object.freeze([]);
const MOOE_CATEGORY = 'Maintenance and Other Operating Expenses';
const getMooeChildLineItemId = (item, rowIndex) =>
  `${MOOE_CATEGORY}-${item.uacsCode || item._id || item.key || item.name || rowIndex}`;
const getMooeParentItemCode = (parentTitle) => `parent-${parentTitle}`;
const getMooeParentLineItemId = (parentTitle) =>
  `${MOOE_CATEGORY}-${getMooeParentItemCode(parentTitle)}`;

const getMooeSourceTiers = (item) => {
  const tier1Properties = [
    'tier1',
    'tier_1',
    'tierOne',
    'tier_one',
    't1',
    'tier1Amount',
    'tier_1_amount',
    'subsidyTier1',
    'subsidy_tier1',
  ];
  const tier2Properties = [
    'tier2',
    'tier_2',
    'tierTwo',
    'tier_two',
    't2',
    'tier2Amount',
    'tier_2_amount',
    'subsidyTier2',
    'subsidy_tier2',
  ];
  let tier1;
  let tier2;

  for (const property of tier1Properties) {
    if (Object.prototype.hasOwnProperty.call(item, property)) {
      tier1 = Number(item[property]) || 0;
      break;
    }
  }
  for (const property of tier2Properties) {
    if (Object.prototype.hasOwnProperty.call(item, property)) {
      tier2 = Number(item[property]) || 0;
      break;
    }
  }

  return {
    tier1: tier1 !== undefined ? tier1 : Number(item?.subsidy) || 0,
    tier2: tier2 !== undefined ? tier2 : 0,
  };
};

const formatCurrency = (value) => {
  const num = Number(value);
  if (isNaN(num)) return '₱0.00';
  return `₱${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatAmountForInput = (value) => {
  const num = Number(value);
  if (isNaN(num)) return '';
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const parseAmountFromInput = (str) => {
  if (!str || typeof str !== 'string') return '';
  const cleaned = str.replace(/,/g, '').trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? '' : parsed;
};

// Allow only digits and at most one decimal point — for live typing (no format so cursor doesn't jump)
const sanitizeNumericInput = (str) => {
  if (str === '' || str === undefined) return '';
  const s = String(str).replace(/,/g, '').replace(/[^0-9.]/g, '');
  const i = s.indexOf('.');
  if (i === -1) return s;
  return s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, '');
};

const SubRow = ({ item, name, rowIndex, allTierInputs, handleTierInputChange, descriptionKey, secondaryDescriptionKey, descriptionHelper, itemTier1 = 0, itemCorporateIncome = 0, disableTier2Balance = false, independentTierEditing = false, readOnly = false }) => {
  const lineItemId = `${name}-${item.uacsCode || item._id || item.key || item.name || rowIndex}`;

  // While focused: show raw string (no format) so cursor doesn't jump and user can clear to empty
  const [tier1Focused, setTier1Focused] = useState(false);
  const [tier2Focused, setTier2Focused] = useState(false);
  const [tier1Raw, setTier1Raw] = useState('');
  const [tier2Raw, setTier2Raw] = useState('');

  const getOriginalTiersLocal = (i) => {
    const t1Props = ['tier1','tier_1','tierOne','tier_one','t1','tier1Amount','tier_1_amount','subsidyTier1','subsidy_tier1'];
    const t2Props = ['tier2','tier_2','tierTwo','tier_two','t2','tier2Amount','tier_2_amount','subsidyTier2','subsidy_tier2'];
    const amountProps = ['amount','total','subtotal','Total','TotalAmount','cost','totalCost','expense'];
    let ot1, ot2;
    for (const p of t1Props) if (Object.prototype.hasOwnProperty.call(i, p)) { ot1 = Number(i[p]) || 0; break; }
    for (const p of t2Props) if (Object.prototype.hasOwnProperty.call(i, p)) { ot2 = Number(i[p]) || 0; break; }
    if (ot1 !== undefined || ot2 !== undefined) return { tier1: ot1 || 0, tier2: ot2 || 0, total: (ot1 || 0) + (ot2 || 0) };
    for (const p of amountProps) if (Object.prototype.hasOwnProperty.call(i, p)) return { tier1: undefined, tier2: undefined, total: Number(i[p]) || 0 };
    return { tier1: undefined, tier2: undefined, total: 0 };
  };

  const entered = allTierInputs[lineItemId] || {};
  const orig = getOriginalTiersLocal(item);
  const baseTier1 = Object.prototype.hasOwnProperty.call(entered, 'tier1') ? (entered.tier1 === '' ? 0 : Number(entered.tier1)) : (orig.tier1 !== undefined ? orig.tier1 : Number(itemTier1) || 0);
  const baseTier2 = Object.prototype.hasOwnProperty.call(entered, 'tier2') ? (entered.tier2 === '' ? 0 : Number(entered.tier2)) : (orig.tier2 !== undefined ? orig.tier2 : 0);
  const rowTotal = (orig.total !== undefined && orig.total > 0) ? orig.total : (baseTier1 + baseTier2) || (Number(itemTier1) || 0);
  const displayTier1 = baseTier1;
  const displayTier2 = baseTier2;

  const tier1DisplayFormatted = Object.prototype.hasOwnProperty.call(entered, 'tier1')
    ? (entered.tier1 === '' ? '' : formatAmountForInput(entered.tier1))
    : formatAmountForInput(displayTier1) || '0.00';
  const tier2DisplayFormatted = Object.prototype.hasOwnProperty.call(entered, 'tier2')
    ? (entered.tier2 === '' ? '' : formatAmountForInput(entered.tier2))
    : (orig.tier2 !== undefined && orig.tier2 !== '' ? formatAmountForInput(orig.tier2) : '');

  const handleTier1Change = (value) => {
    if (readOnly) return;
    const num = value === '' ? 0 : Number(value);
    if (independentTierEditing) {
      handleTierInputChange(lineItemId, { tier1: value === '' ? '' : num }, name);
      return;
    }
    // When clearing (''), only update that field so user can set back to 0 without value jumping to other field
    if (value === '') {
      handleTierInputChange(lineItemId, { tier1: '' }, name);
      return;
    }
    const tier2 = Math.max(0, rowTotal - num);
    handleTierInputChange(lineItemId, { tier1: num, tier2 }, name);
  };
  const handleTier2Change = (value) => {
    if (readOnly) return;
    const num = value === '' ? 0 : Number(value);
    if (independentTierEditing || disableTier2Balance) {
      handleTierInputChange(lineItemId, { tier2: value === '' ? '' : num }, name);
      return;
    }
    // When clearing (''), only update that field so user can set back to 0 without value jumping to other field
    if (value === '') {
      handleTierInputChange(lineItemId, { tier2: '' }, name);
      return;
    }
    const tier1 = Math.max(0, rowTotal - num);
    handleTierInputChange(lineItemId, { tier2: num, tier1 }, name);
  };

  const tier1Value = tier1Focused ? tier1Raw : tier1DisplayFormatted;
  const tier2Value = tier2Focused ? tier2Raw : tier2DisplayFormatted;
  const parsedT1Raw = tier1Focused ? parseAmountFromInput(tier1Raw) : null;
  const parsedT2Raw = tier2Focused ? parseAmountFromInput(tier2Raw) : null;
  const t1ForTotal = tier1Focused ? (parsedT1Raw === '' ? 0 : Number(parsedT1Raw)) : displayTier1;
  const t2ForTotal = tier2Focused ? (parsedT2Raw === '' ? 0 : Number(parsedT2Raw)) : displayTier2;
  const totalValueLive = (Object.prototype.hasOwnProperty.call(entered, 'tier1') || Object.prototype.hasOwnProperty.call(entered, 'tier2'))
    ? (t1ForTotal + t2ForTotal) 
    : (orig.total !== undefined && orig.total !== 0 ? orig.total : t1ForTotal + t2ForTotal);

  const onTier1Focus = () => {
    setTier1Focused(true);
    const fromEntered = Object.prototype.hasOwnProperty.call(entered, 'tier1');
    const raw = fromEntered
      ? (entered.tier1 === '' ? '' : String(entered.tier1))
      : (displayTier1 === 0 ? '' : String(displayTier1));
    setTier1Raw(raw);
  };
  const onTier2Focus = () => {
    setTier2Focused(true);
    const fromEntered = Object.prototype.hasOwnProperty.call(entered, 'tier2');
    const raw = fromEntered
      ? (entered.tier2 === '' ? '' : String(entered.tier2))
      : (displayTier2 === 0 ? '' : String(displayTier2));
    setTier2Raw(raw);
  };
  const onTier1Blur = (e) => {
    setTier1Focused(false);
    // Use e.target.value to avoid stale state when user clears and blurs quickly
    const currentValue = e?.target?.value ?? tier1Raw;
    const parsed = parseAmountFromInput(String(currentValue));
    handleTier1Change(parsed === '' ? '' : parsed);
  };
  const onTier2Blur = (e) => {
    setTier2Focused(false);
    const currentValue = e?.target?.value ?? tier2Raw;
    const parsed = parseAmountFromInput(String(currentValue));
    handleTier2Change(parsed === '' ? '' : parsed);
  };

  const cellSx = { width: COL.tier1, minWidth: COL.tier1, maxWidth: COL.tier1 };
  const cellSx2 = { width: COL.tier2, minWidth: COL.tier2, maxWidth: COL.tier2 };

  // Highlight row when current values differ from original (indicator for "changed")
  const origT1 = orig.tier1 !== undefined ? Number(orig.tier1) : (Number(itemTier1) || 0);
  const origT2 = orig.tier2 !== undefined ? Number(orig.tier2) : 0;
  const hasEntry = Object.prototype.hasOwnProperty.call(entered, 'tier1') || Object.prototype.hasOwnProperty.call(entered, 'tier2');
  const differs = (a, b) => Math.round((Number(a) || 0) * 100) !== Math.round((Number(b) || 0) * 100);
  const isChanged = hasEntry && (differs(baseTier1, origT1) || differs(baseTier2, origT2));

  return (
    <TableRow
      sx={isChanged ? { backgroundColor: 'warning.light' } : undefined}
      title={isChanged ? 'Modified from original' : undefined}
    >
      <TableCell sx={{ paddingLeft: '32px', pl: 4, verticalAlign: 'middle' }}>
        {item[descriptionKey] || item[secondaryDescriptionKey] || 'No Description'}
        {descriptionHelper && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
            {descriptionHelper}
          </Typography>
        )}
      </TableCell>
      <TableCell align="right" sx={{ width: COL.corporateIncome, minWidth: COL.corporateIncome }}>{formatCurrency(Number(itemCorporateIncome) || 0)}</TableCell>
      <TableCell align="right" sx={cellSx}>
        <TextField
          size="small"
          fullWidth
          type="text"
          inputProps={{ inputMode: readOnly ? undefined : 'decimal', readOnly: !!readOnly }}
          InputProps={{ startAdornment: <InputAdornment position="start">₱</InputAdornment>, readOnly: !!readOnly }}
          value={tier1Value}
          onFocus={readOnly ? undefined : onTier1Focus}
          onBlur={readOnly ? undefined : onTier1Blur}
          onChange={readOnly ? undefined : (e) => {
            const v = sanitizeNumericInput(e.target.value);
            setTier1Raw(v);
            const parsed = parseAmountFromInput(v);
            handleTier1Change(parsed === '' ? '' : parsed);
          }}
          sx={{ '& .MuiInputBase-input': { textAlign: 'right' } }}
        />
      </TableCell>
      <TableCell align="right" sx={cellSx2}>
        <TextField
          size="small"
          fullWidth
          type="text"
          inputProps={{ inputMode: readOnly ? undefined : 'decimal', readOnly: !!readOnly }}
          InputProps={{ startAdornment: <InputAdornment position="start">₱</InputAdornment>, readOnly: !!readOnly }}
          value={tier2Value}
          onFocus={readOnly ? undefined : onTier2Focus}
          onBlur={readOnly ? undefined : onTier2Blur}
          onChange={readOnly ? undefined : (e) => {
            const v = sanitizeNumericInput(e.target.value);
            setTier2Raw(v);
            const parsed = parseAmountFromInput(v);
            handleTier2Change(parsed === '' ? '' : parsed);
          }}
          sx={{ '& .MuiInputBase-input': { textAlign: 'right' } }}
        />
      </TableCell>
      <TableCell align="right" sx={{ width: COL.total, minWidth: COL.total }}>{formatCurrency(totalValueLive)}</TableCell>
      <TableCell align="right" sx={{ width: COL.proposedBudget, minWidth: COL.proposedBudget }}>{formatCurrency(totalValueLive)}</TableCell>
    </TableRow>
  );
};

const CollapsibleUsesRow = ({ name, items, allTierInputs, handleTierInputChange, totals, descriptionKey, secondaryDescriptionKey, itemTier1Map = {}, corporateIncome = 0, getItemCorporateIncome, independentTierEditing = false, readOnly = false }) => {
  const [open, setOpen] = useState(false);
  const getLineItemId = (n, i, idx) => `${n}-${i.uacsCode || i._id || i.key || i.name || idx}`;

  return (
    <React.Fragment>
      <TableRow>
        <TableCell>
          <IconButton aria-label="expand row" size="small" onClick={() => setOpen(!open)}>
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
          {name}
        </TableCell>
        <TableCell align="right">{formatCurrency(Number(corporateIncome) || 0)}</TableCell>
        <TableCell align="right">{formatCurrency(totals.tier1)}</TableCell>
        <TableCell align="right">{formatCurrency(totals.tier2)}</TableCell>
        <TableCell align="right">{formatCurrency(totals.total)}</TableCell>
        <TableCell align="right">{formatCurrency(totals.total)}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ padding: 0 }} colSpan={6}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box>
              <Table size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
                <colgroup>
                  <col style={{ width: '25%', minWidth: 200 }} />
                  <col style={{ width: COL.corporateIncome }} />
                  <col style={{ width: COL.tier1 }} />
                  <col style={{ width: COL.tier2 }} />
                  <col style={{ width: COL.total }} />
                  <col style={{ width: COL.proposedBudget }} />
                </colgroup>
                <TableBody>
                  {items.map((item, idx) => (
                    <SubRow
                      key={item._id || item.uacsCode || idx}
                      rowIndex={idx}
                      item={item}
                      name={name}
                      allTierInputs={allTierInputs}
                      handleTierInputChange={handleTierInputChange}
                      descriptionKey={descriptionKey}
                      secondaryDescriptionKey={secondaryDescriptionKey}
                      itemTier1={itemTier1Map[getLineItemId(name, item, idx)] ?? 0}
                      itemCorporateIncome={getItemCorporateIncome ? getItemCorporateIncome(item) : 0}
                      disableTier2Balance={name === 'Personnel Services'}
                      independentTierEditing={independentTierEditing}
                      readOnly={readOnly}
                    />
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </React.Fragment>
  );
};

function TierTable({ fiscalYear, region, regionName, department, division, departmentName, divisionName, onTierDataChange, onVersionChange, independentTierEditing = false, readOnly = false }) {
  const [tierInputs, setTierInputs] = useState({});
  const [mooeOpen, setMooeOpen] = useState(false);
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [capitalOutlayOpen, setCapitalOutlayOpen] = useState(false);
  const initializedScopeRef = useRef(null);
  const lastSyncedItemsRef = useRef(null);

  // Use names for API filters so backend can match proposals/documents (stored as names). Fallback to id when name not provided.
  const effectiveDept = departmentName != null && departmentName !== '' ? departmentName : (department || '');
  const effectiveDiv = divisionName != null && divisionName !== '' ? divisionName : (division || '');

  // When region is "ALL", omit region filter to consolidate all regions.
  // effectiveRegion (ObjectId) for finalized data; regionName (string) for Capital Outlay & Income (DB stores region as string)
  const effectiveRegion = (region && region !== 'ALL') ? region : undefined;
  const effectiveRegionName = (region && region !== 'ALL' && regionName !== 'ALL' && regionName !== 'All') ? regionName : undefined;
  const baseParams = useMemo(() => {
    const params = { fiscalYear, budgetType: 'Initial' };
    if (effectiveRegionName) params.region = effectiveRegionName;
    if (effectiveDept) params.department = effectiveDept;
    if (effectiveDiv) params.division = effectiveDiv;
    return params;
  }, [fiscalYear, effectiveRegionName, effectiveDept, effectiveDiv]);

  const finalizedParams = useMemo(() => {
    const params = { fiscalYear };
    if (effectiveRegion) params.region = effectiveRegion;
    if (effectiveDept) params.department = effectiveDept;
    if (effectiveDiv) params.division = effectiveDiv;
    return params;
  }, [fiscalYear, effectiveRegion, effectiveDept, effectiveDiv]);

  const hasRequiredParams = !!fiscalYear && !!region;
  const scopeKey = `${fiscalYear}|${region}|${effectiveDept}|${effectiveDiv}`;

  // Load saved Tier items (current version) so table shows saved values, not only "original" from API
  const savedItemsQuery = useQuery({
    queryKey: ['tierSavedItems', fiscalYear, region, effectiveDept, effectiveDiv],
    queryFn: () =>
      api
        .get('/api/tier/saved-items', {
          params: { fiscalYear, region, department: effectiveDept || '', division: effectiveDiv || '' },
        })
        .then((r) => r.data),
    enabled: hasRequiredParams && !!region && region !== 'ALL',
  });

  // Sync tierInputs from saved items when they load or when server data changes (e.g. after save or restore revision).
  // Use lastSyncedItemsRef so we re-apply when saved data actually changes (new version), not just on every refetch.
  useEffect(() => {
    const items = savedItemsQuery.data?.items;
    const version = savedItemsQuery.data?.version;
    // Report version to parent so it can display which version's data is currently loaded
    if (onVersionChange && version != null) {
      const normalizedVersion = Number(version);
      onVersionChange(Number.isFinite(normalizedVersion) && normalizedVersion > 0 ? normalizedVersion : null);
    }
    if (!Array.isArray(items) || items.length === 0) {
      if (savedItemsQuery.isFetched) {
        const emptySig = `${scopeKey}:empty`;
        if (lastSyncedItemsRef.current !== emptySig) {
          lastSyncedItemsRef.current = emptySig;
          initializedScopeRef.current = scopeKey;
          setTierInputs({});
          if (onVersionChange) onVersionChange(null);
        }
      }
      return;
    }
    const dataSig = `${scopeKey}:${JSON.stringify(items)}`;
    if (lastSyncedItemsRef.current === dataSig) return;
    lastSyncedItemsRef.current = dataSig;
    initializedScopeRef.current = scopeKey;
    const next = {};
    items.forEach((it) => {
      next[it.lineItemId] = {
        tier1: it.tier1,
        tier2: it.tier2,
        ...(it.category && { category: it.category }),
      };
    });
    setTierInputs(next);
  }, [savedItemsQuery.data, savedItemsQuery.isFetched, scopeKey, onVersionChange]);

  // BRD-level or finalized Initial proposals (PROJECTED CORPORATE INCOME and PROJECTED SUBSIDY → TIER 1). Tier is available once proposal is at BRD level so Tier saved here is what Budget Planning Analyst passes to Budget Officer until Budget Manager finalizes.
  const [finalizedQuery] = useQueries({
    queries: [
      {
        queryKey: ['tierFinalizedData', finalizedParams],
        queryFn: () => api.get('/api/tier/finalized-data', { params: finalizedParams }).then(res => res.data),
        enabled: hasRequiredParams,
      },
    ],
  });

  const results = useQueries({
    queries: [
      {
        queryKey: ['personnelServices', baseParams],
        queryFn: () => api.get('/api/consolidated-reports/personnel-services-data', { params: baseParams }).then(res => {
          // return categories structure so UI can render dynamic headings and subitems
          if (res.data.data && res.data.data.length > 0) {
            const regionData = res.data.data[0];
            return regionData.categories || [];
          }
          return [];
        }),
        enabled: hasRequiredParams,
      },
      {
        queryKey: ['mooe', baseParams],
        queryFn: async () => {
          try {
            const res = await api.get('/mooe/getByParams', { params: baseParams });
            return Array.isArray(res.data) ? res.data : [];
          } catch (_err) {
            return [];
          }
        },
        enabled: hasRequiredParams,
      },
      {
        queryKey: ['capitalOutlay', fiscalYear, regionName, effectiveDept, effectiveDiv, 'Initial'],
        queryFn: async () => {
          const params = { fiscalYear: String(fiscalYear || ''), budgetType: 'Initial' };
          if (regionName) params.regions = [regionName];
          if (effectiveDept) params.department = effectiveDept;
          if (effectiveDiv) params.division = effectiveDiv;
          const res = await api.get('/api/consolidated-reports/capital-outlay-data', { params });
          const data = res.data?.data || res.data || [];
          return Array.isArray(data) ? data.flatMap(r => {
            if (r.items && Array.isArray(r.items)) {
              return r.items.map(item => ({ ...item, categoryTitleFromGroup: r.category }));
            }
            return r;
          }) : [];
        },
        enabled: hasRequiredParams,
      },
      {
        queryKey: ['income', baseParams],
        queryFn: () => api.get('/income/getByParams', { params: baseParams }).then(res => res.data),
        enabled: hasRequiredParams,
      },
      {
        // Fetch charged-to-income eligible personnel for PROJECTED CORPORATE INCOME calculation
        queryKey: ['chargedToIncomePersonnel', fiscalYear, regionName, effectiveDept, effectiveDiv, 'Initial'],
        queryFn: async () => {
          const params = {
            fiscalYear: Number(fiscalYear),
            budgetType: 'Initial',
            chargedToIncomeEligible: true,
            limit: 1000,
            page: 1
          };
          if (regionName) params.region = regionName;
          if (effectiveDept) params.department = effectiveDept;
          if (effectiveDiv) params.division = effectiveDiv;
          const res = await api.get('/personnelServices', { params });
          return res.data?.personnelServices || res.data?.data || [];
        },
        enabled: hasRequiredParams,
      }
    ],
  });

  const isLoading = finalizedQuery?.isLoading || results.some(r => r.isLoading);
  const isError = results.some(r => r.isError);

  const finalizedData = finalizedQuery?.data || null;
  // Tier data is available once proposal is at BRD level (Analyst/Officer/Manager) or finalized
  const hasTierData = finalizedData?.hasTierData === true || finalizedData?.hasFinalized === true;
  const projectedCorporateIncome = Number(finalizedData?.projectedCorporateIncome) || 0;

  const personnelData = results[0].data || EMPTY_LIST;
  const rawMooeData = results[1].data || EMPTY_LIST;
  const mooeData = useMemo(() => {
    const map = new Map();
    rawMooeData.forEach(item => {
      const key = `${item.sublineItem || ''}-${item.accountingTitle || item.uacsCode || item.sublineItem || 'Unknown'}`;
      if (map.has(key)) {
        const existing = map.get(key);
        if (item.amount !== undefined) existing.amount = (Number(existing.amount) || 0) + (Number(item.amount) || 0);
        if (item.total !== undefined) existing.total = (Number(existing.total) || 0) + (Number(item.total) || 0);
        if (item.income !== undefined) existing.income = (Number(existing.income) || 0) + (Number(item.income) || 0);
        if (item.subsidy !== undefined) existing.subsidy = (Number(existing.subsidy) || 0) + (Number(item.subsidy) || 0);
        const t1Props = ['tier1','tier_1','tierOne','tier_one','t1','tier1Amount','tier_1_amount','subsidyTier1','subsidy_tier1'];
        const t2Props = ['tier2','tier_2','tierTwo','tier_two','t2','tier2Amount','tier_2_amount','subsidyTier2','subsidy_tier2'];
        for (const p of t1Props) if (item[p] !== undefined) existing[p] = (Number(existing[p]) || 0) + (Number(item[p]) || 0);
        for (const p of t2Props) if (item[p] !== undefined) existing[p] = (Number(existing[p]) || 0) + (Number(item[p]) || 0);
      } else {
        map.set(key, { ...item });
      }
    });
    return Array.from(map.values());
  }, [rawMooeData]);

  const rawCapitalOutlayData = results[2].data || EMPTY_LIST;
  const capitalOutlayData = useMemo(() => {
    const map = new Map();
    rawCapitalOutlayData.forEach(item => {
      let categoryName = "Other";
      if (item.categoryTitleFromGroup) categoryName = item.categoryTitleFromGroup;
      else if (item.categoryGroup) categoryName = item.categoryGroup;
      else if (item.categoryName) categoryName = item.categoryName;
      else if (item.category && typeof item.category === 'object' && item.category.categoryName) categoryName = item.category.categoryName;
      else if (item.category && typeof item.category === 'object' && item.category.name) categoryName = item.category.name;
      else if (typeof item.category === 'string' && item.category.trim() && !/^[0-9a-fA-F]{24}$/.test(item.category)) categoryName = item.category;
      else if (item.sublineItem) categoryName = item.sublineItem;
      else if (item.categoryTitle) categoryName = item.categoryTitle;
      else if (item.type) categoryName = item.type;
      else if (item.classification) categoryName = item.classification;
      else if (item.accountingTitle) categoryName = item.accountingTitle;
      else if (item.particulars) categoryName = item.particulars;
      
      categoryName = categoryName.trim() || "Other";
      const key = categoryName;
      if (map.has(key)) {
        const existing = map.get(key);
        if (item.amount !== undefined) existing.amount = (Number(existing.amount) || 0) + (Number(item.amount) || 0);
        if (item.total !== undefined) existing.total = (Number(existing.total) || 0) + (Number(item.total) || 0);
        if (item.income !== undefined) existing.income = (Number(existing.income) || 0) + (Number(item.income) || 0);
        if (item.subsidy !== undefined) existing.subsidy = (Number(existing.subsidy) || 0) + (Number(item.subsidy) || 0);
        const t1Props = ['tier1','tier_1','tierOne','tier_one','t1','tier1Amount','tier_1_amount','subsidyTier1','subsidy_tier1'];
        const t2Props = ['tier2','tier_2','tierTwo','tier_two','t2','tier2Amount','tier_2_amount','subsidyTier2','subsidy_tier2'];
        for (const p of t1Props) if (item[p] !== undefined) existing[p] = (Number(existing[p]) || 0) + (Number(item[p]) || 0);
        for (const p of t2Props) if (item[p] !== undefined) existing[p] = (Number(existing[p]) || 0) + (Number(item[p]) || 0);
      } else {
        map.set(key, { ...item, particulars: categoryName, accountingTitle: categoryName, uacsCode: categoryName, name: categoryName });
      }
    });
    return Array.from(map.values());
  }, [rawCapitalOutlayData]);
  const incomeData = results[3].data || EMPTY_LIST;
  const chargedToIncomePersonnel = results[4].data || EMPTY_LIST;

  // Group income by category for Projected Corporate Income sub-list
  const groupedIncomeData = useMemo(() => {
    if (!Array.isArray(incomeData) || incomeData.length === 0) return [];
    const byCategory = {};
    incomeData.forEach((item) => {
      const catName = item?.incomecategory?.name || item?.incomecategory?.incomeCategoryName || item?.category || item?.categoryName || 'Other Income';
      if (!byCategory[catName]) byCategory[catName] = { category: catName, items: [], subtotal: 0 };
      const amt = Number(item?.amount) || 0;
      byCategory[catName].items.push({ ...item, amount: amt, name: item?.particulars || item?.subcategory || 'Item' });
      byCategory[catName].subtotal += amt;
    });
    return Object.values(byCategory);
  }, [incomeData]);

  const groupedMooeData = useMemo(() => {
    return mooeData.reduce((acc, item) => {
      const key = String(
        item.sublineItem || item.parentAccount || item.accountingTitle || 'Other MOOE'
      ).trim();
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(item);
      return acc;
    }, {});
  }, [mooeData]);

  const mooeParentSummaries = useMemo(() => {
    return Object.entries(groupedMooeData).map(([parentTitle, childItems]) => {
      let originalTier1 = 0;
      let originalTier2 = 0;
      let legacyTier1 = 0;
      let legacyTier2 = 0;
      let corporateIncome = 0;

      childItems.forEach((item, rowIndex) => {
        const source = getMooeSourceTiers(item);
        const childInput = tierInputs[getMooeChildLineItemId(item, rowIndex)] || {};
        const childTier1 = Object.prototype.hasOwnProperty.call(childInput, 'tier1')
          ? childInput.tier1 === ''
            ? 0
            : Number(childInput.tier1) || 0
          : source.tier1;
        const childTier2 = Object.prototype.hasOwnProperty.call(childInput, 'tier2')
          ? childInput.tier2 === ''
            ? 0
            : Number(childInput.tier2) || 0
          : source.tier2;

        originalTier1 += source.tier1;
        originalTier2 += source.tier2;
        legacyTier1 += childTier1;
        legacyTier2 += childTier2;
        corporateIncome += Number(item?.income) || 0;
      });

      const lineItemId = getMooeParentLineItemId(parentTitle);
      const parentInput = tierInputs[lineItemId] || {};
      const tier1 = Object.prototype.hasOwnProperty.call(parentInput, 'tier1')
        ? parentInput.tier1 === ''
          ? 0
          : Number(parentInput.tier1) || 0
        : legacyTier1;
      const tier2 = Object.prototype.hasOwnProperty.call(parentInput, 'tier2')
        ? parentInput.tier2 === ''
          ? 0
          : Number(parentInput.tier2) || 0
        : legacyTier2;

      return {
        parentTitle,
        childItems,
        lineItemId,
        originalTier1,
        originalTier2,
        tier1,
        tier2,
        corporateIncome,
        parentItem: {
          uacsCode: getMooeParentItemCode(parentTitle),
          accountingTitle: parentTitle,
          tier1: originalTier1,
          tier2: originalTier2,
        },
      };
    });
  }, [groupedMooeData, tierInputs]);

  const mooeParentTierInputs = useMemo(() => {
    const parentInputs = { ...tierInputs };
    mooeParentSummaries.forEach((summary) => {
      parentInputs[summary.lineItemId] = {
        ...parentInputs[summary.lineItemId],
        tier1: summary.tier1,
        tier2: summary.tier2,
        category: MOOE_CATEGORY,
      };
    });
    return parentInputs;
  }, [tierInputs, mooeParentSummaries]);

  // All MOOE items for expand content (so expand always shows rows; user can edit zero values too).
  const groupedMooeDataForExpand = useMemo(() => {
    const result = {};
    Object.entries(groupedMooeData).forEach(([subline, sublineItems]) => {
      result[subline] = sublineItems.map((item, idx) => ({ item, originalIdx: idx }));
    });
    return result;
  }, [groupedMooeData]);

  // Capital Outlay: group by category (parent section, e.g. "Websites"); under it show subline rows (Websites, Operating System)
  const groupedCapitalOutlayByCategory = useMemo(() => {
    const result = {};
    (capitalOutlayData || []).forEach((item, idx) => {
      const categoryName = (item.categoryGroup || item.category?.categoryName || item.sublineItem || item.accountingTitle || 'Other').trim();
      if (!result[categoryName]) result[categoryName] = [];
      result[categoryName].push({ item, originalIdx: idx });
    });
    return result;
  }, [capitalOutlayData]);

  // Flatten personnel categories into items for rendering / processing.
  const personnelItems = useMemo(() => {
    if (Array.isArray(personnelData) && personnelData.length > 0 && personnelData[0] && (personnelData[0].items || personnelData[0].name)) {
      return personnelData.reduce((acc, category) => {
        if (Array.isArray(category.items)) return acc.concat(category.items);
        return acc;
      }, []);
    }
    return Array.isArray(personnelData) ? personnelData : [];
  }, [personnelData]);

  // Tier 1 and Tier 2 editable. When Tier 2 changes, Tier 1 = Total - Tier 2; when Tier 1 changes, Tier 2 = Total - Tier 1. Use batch update so both stay in sync.
  const handleTierInputChange = useCallback((lineItemId, fieldOrUpdates, valueOrCategory, categoryIfSingle) => {
    if (typeof fieldOrUpdates === 'object' && fieldOrUpdates !== null) {
      const updates = fieldOrUpdates;
      const cat = valueOrCategory;
      setTierInputs(prev => ({
        ...prev,
        [lineItemId]: {
          ...prev[lineItemId],
          ...(updates.tier1 !== undefined && { tier1: updates.tier1 }),
          ...(updates.tier2 !== undefined && { tier2: updates.tier2 }),
          category: cat,
        },
      }));
      return;
    }
    const field = fieldOrUpdates;
    const value = valueOrCategory;
    const category = categoryIfSingle;
    if (field !== 'tier1' && field !== 'tier2') return;
    const numValue = value === '' ? '' : parseFloat(value);
    setTierInputs(prev => ({
      ...prev,
      [lineItemId]: {
        ...prev[lineItemId],
        [field]: numValue,
        category,
      },
    }));
  }, []);

  const { sourcesOfFunds, usesOfFunds, surplusDeficit, itemTier1Map, usesCorporateIncome } = useMemo(() => {
    const uses = {
      'Personnel Services': { tier1: 0, tier2: 0, total: 0 },
      'Maintenance and Other Operating Expenses': { tier1: 0, tier2: 0, total: 0 },
      'Capital Outlay': { tier1: 0, tier2: 0, total: 0 },
    };

    const getLineItemId = (name, item) => `${name}-${item.uacsCode || item._id || item.key || item.name}`;

    const getOriginalTiers = (item) => {
      // try common per-tier properties
      const t1Props = ['tier1','tier_1','tierOne','tier_one','t1','tier1Amount','tier_1_amount','subsidyTier1','subsidy_tier1'];
      const t2Props = ['tier2','tier_2','tierTwo','tier_two','t2','tier2Amount','tier_2_amount','subsidyTier2','subsidy_tier2'];

      let origTier1;
      let origTier2;

      for (const p of t1Props) {
        if (Object.prototype.hasOwnProperty.call(item, p)) {
          origTier1 = Number(item[p]) || 0;
          break;
        }
      }
      for (const p of t2Props) {
        if (Object.prototype.hasOwnProperty.call(item, p)) {
          origTier2 = Number(item[p]) || 0;
          break;
        }
      }

      if (origTier1 !== undefined || origTier2 !== undefined) {
        return { tier1: origTier1 || 0, tier2: origTier2 || 0, total: (origTier1 || 0) + (origTier2 || 0) };
      }

      // fallback to amount-like fields
      const amountProps = ['amount', 'total', 'subtotal', 'Total', 'TotalAmount', 'cost', 'totalCost', 'expense'];
      for (const p of amountProps) {
        if (Object.prototype.hasOwnProperty.call(item, p)) {
          return { tier1: undefined, tier2: undefined, total: Number(item[p]) || 0 };
        }
      }

      return { tier1: undefined, tier2: undefined, total: 0 };
    };

    // Corporate income per category (needed for itemTier1Map and usesCorporateIncome)
    let corporateIncomePersonnel = 0;
    if (Array.isArray(chargedToIncomePersonnel) && chargedToIncomePersonnel.length > 0) {
      corporateIncomePersonnel = chargedToIncomePersonnel.reduce((s, p) => s + (Number(p?.chargedToIncomeAmount) || 0), 0);
    }
    let corporateIncomeMooe = 0;
    let corporateIncomeCapitalOutlay = 0;
    if (Array.isArray(mooeData)) {
      corporateIncomeMooe = mooeData.reduce((s, item) => s + (Number(item?.income) || 0), 0);
    }
    if (Array.isArray(capitalOutlayData)) {
      corporateIncomeCapitalOutlay = capitalOutlayData.reduce((s, item) => s + (Number(item?.income) || 0), 0);
    }
    const usesCorporateIncome = {
      'Personnel Services': corporateIncomePersonnel,
      'Maintenance and Other Operating Expenses': corporateIncomeMooe,
      'Capital Outlay': corporateIncomeCapitalOutlay,
    };
    const totalUsesCorporateIncome = corporateIncomePersonnel + corporateIncomeMooe + corporateIncomeCapitalOutlay;

    // helper to process an item for a category
    const processItem = (name, item) => {
      const id = getLineItemId(name, item);
      const entered = tierInputs[id] || {};
      const orig = getOriginalTiers(item);

      const enteredTier1 = Object.prototype.hasOwnProperty.call(entered, 'tier1') ? entered.tier1 : undefined;
      const enteredTier2 = Object.prototype.hasOwnProperty.call(entered, 'tier2') ? entered.tier2 : undefined;

      // When item has no tier1/tier2 in API, use itemTier1Map (subsidy / proportional) so Tier 1 is not 0
      const fallbackTier1 = itemTier1Map[id] ?? 0;
      const displayTier1 = enteredTier1 !== undefined ? (enteredTier1 === '' ? 0 : Number(enteredTier1)) : (orig.tier1 !== undefined ? orig.tier1 : fallbackTier1);
      const displayTier2 = enteredTier2 !== undefined ? (enteredTier2 === '' ? 0 : Number(enteredTier2)) : (orig.tier2 !== undefined ? orig.tier2 : 0);

      const displayTotal = (enteredTier1 !== undefined || enteredTier2 !== undefined)
        ? ( (enteredTier1 === '' ? 0 : (enteredTier1 || 0)) + (enteredTier2 === '' ? 0 : (enteredTier2 || 0)) )
        : (orig.total !== undefined ? orig.total : displayTier1 + displayTier2);

      return { displayTier1, displayTier2, displayTotal };
    };

    // Build itemTier1Map BEFORE processItem (using category totals from amounts)
    const personnelAmountTotal = personnelItems.reduce((s, item) => s + (getOriginalTiers(item).total || 0), 0);
    const personnelCategoryTier1 = Math.max(0, personnelAmountTotal - corporateIncomePersonnel);
    const itemTier1Map = {};
    personnelItems.forEach((item, idx) => {
      const id = getLineItemId('Personnel Services', item) || `Personnel Services-${item.uacsCode || item._id || item.key || item.name || idx}`;
      let itemAmount = 0;
      const amountProps = ['amount','total','subtotal','Total','TotalAmount','cost','totalCost','expense'];
      for (const p of amountProps) {
        if (Object.prototype.hasOwnProperty.call(item, p)) { itemAmount = Number(item[p]) || 0; break; }
      }
      itemTier1Map[id] = personnelAmountTotal > 0 ? (itemAmount / personnelAmountTotal) * personnelCategoryTier1 : 0;
    });
    Object.values(groupedMooeData).forEach(group => {
      group.forEach((item, idx) => {
        const id = getLineItemId('Maintenance and Other Operating Expenses', item) || `Maintenance and Other Operating Expenses-${item.uacsCode || item._id || item.key || item.name || idx}`;
        itemTier1Map[id] = Number(item?.subsidy) || 0;
      });
    });
    capitalOutlayData.forEach((item, idx) => {
      const id = getLineItemId('Capital Outlay', item) || `Capital Outlay-${item.uacsCode || item._id || item.key || item.name || idx}`;
      itemTier1Map[id] = Number(item?.subsidy) || 0;
    });

    // Personnel: use pre-flattened personnelItems (computed outside useMemo)
    personnelItems.forEach(item => {
      const { displayTier1, displayTier2, displayTotal } = processItem('Personnel Services', item);
      uses['Personnel Services'].tier1 += displayTier1;
      uses['Personnel Services'].tier2 += displayTier2;
      uses['Personnel Services'].total += displayTotal;
    });

    // NEP uses one editable aggregate per MOOE parent account. Regular Tier keeps
    // the existing accounting-title-level calculation.
    const mooeParent = MOOE_CATEGORY;
    if (!uses[mooeParent]) uses[mooeParent] = { tier1: 0, tier2: 0, total: 0 };
    if (independentTierEditing) {
      mooeParentSummaries.forEach((summary) => {
        uses[mooeParent].tier1 += summary.tier1;
        uses[mooeParent].tier2 += summary.tier2;
        uses[mooeParent].total += summary.tier1 + summary.tier2;
      });
    } else {
      Object.values(groupedMooeData).forEach(group => {
        group.forEach(item => {
          const { displayTier1, displayTier2, displayTotal } = processItem(mooeParent, item);
          if (displayTotal <= 0) return;
          uses[mooeParent].tier1 += displayTier1;
          uses[mooeParent].tier2 += displayTier2;
          uses[mooeParent].total += displayTotal;
        });
      });
    }

    // Capital Outlay (and per-category totals for itemized display)
    const capitalParent = 'Capital Outlay';
    const categoryTotalsCapitalOutlay = {};
    if (!uses[capitalParent]) uses[capitalParent] = { tier1: 0, tier2: 0, total: 0 };
    capitalOutlayData.forEach(item => {
      const { displayTier1, displayTier2, displayTotal } = processItem(capitalParent, item);
      const categoryName = (item.categoryGroup || item.category?.categoryName || item.sublineItem || item.accountingTitle || 'Other').trim();
      if (!categoryTotalsCapitalOutlay[categoryName]) categoryTotalsCapitalOutlay[categoryName] = { tier1: 0, tier2: 0, total: 0 };
      categoryTotalsCapitalOutlay[categoryName].tier1 += displayTier1;
      categoryTotalsCapitalOutlay[categoryName].tier2 += displayTier2;
      categoryTotalsCapitalOutlay[categoryName].total += displayTotal;
      uses[capitalParent].tier1 += displayTier1;
      uses[capitalParent].tier2 += displayTier2;
      uses[capitalParent].total += displayTotal;
    });

    const totalUsesTier1 = Object.values(uses).reduce((s, u) => s + (u.tier1 || 0), 0);
    const totalUsesTier2 = Object.values(uses).reduce((s, u) => s + (u.tier2 || 0), 0);
    const subsidyTotal = totalUsesTier1 + totalUsesTier2;
    // PROJECTED CORPORATE INCOME from finalized (read-only). PROPOSED BUDGET = PROJECTED CORPORATE INCOME + TOTAL.
    const corporateIncome = projectedCorporateIncome;
    const totalSources = corporateIncome + subsidyTotal;
    const proposedBudget = totalSources;

    return {
      itemTier1Map,
      usesCorporateIncome,
      totalUsesCorporateIncome,
      sourcesOfFunds: {
        corporateIncome,
        budgetarySupport: {
          tier1: totalUsesTier1,
          tier2: totalUsesTier2,
          total: subsidyTotal,
        },
        total: totalSources,
        proposedBudget,
      },
      usesOfFunds: {
        ...uses,
        total: subsidyTotal,
        totalTier1: totalUsesTier1,
        totalTier2: totalUsesTier2,
        totalCorporateIncome: totalUsesCorporateIncome,
        proposedBudget: totalUsesCorporateIncome + subsidyTotal,
      },
      // Surplus = Total Sources (Proposed Budget) - Total Uses (Proposed Budget)
      // Where Proposed Budget = Corporate Income + Subsidy Total
      surplusDeficit: totalSources - (totalUsesCorporateIncome + subsidyTotal),
      categoryTotalsCapitalOutlay,
    };
  }, [tierInputs, projectedCorporateIncome, personnelItems, mooeData, capitalOutlayData, groupedMooeData, chargedToIncomePersonnel, independentTierEditing, mooeParentSummaries]);

  const allData = useMemo(() => {
    const displayedItems = {};
    // Must match SubRow/CollapsibleUsesRow: same id = same row so save/restore works
    const getLineItemId = (name, item, rowIndex) => `${name}-${item.uacsCode || item._id || item.key || item.name || rowIndex}`;

    const processAndCollect = (name, item, rowIndex, options = {}) => {
      const { onlyIfHasValue = false } = options; // for MOOE: only add to displayedItems when tier1+tier2 > 0
      const id = getLineItemId(name, item, rowIndex);
      const entered = tierInputs[id] || {};
      const orig = (function(i) {
        const t1Props = ['tier1','tier_1','tierOne','tier_one','t1','tier1Amount','tier_1_amount','subsidyTier1','subsidy_tier1'];
        const t2Props = ['tier2','tier_2','tierTwo','tier_two','t2','tier2Amount','tier_2_amount','subsidyTier2','subsidy_tier2'];
        let ot1, ot2;
        for (const p of t1Props) if (Object.prototype.hasOwnProperty.call(i, p)) { ot1 = Number(i[p]) || 0; break; }
        for (const p of t2Props) if (Object.prototype.hasOwnProperty.call(i, p)) { ot2 = Number(i[p]) || 0; break; }
        if (ot1 !== undefined || ot2 !== undefined) return { tier1: ot1 || 0, tier2: ot2 || 0, total: (ot1 || 0) + (ot2 || 0) };
        if (i.amount !== undefined) return { tier1: undefined, tier2: undefined, total: Number(i.amount) || 0 };
        return { tier1: undefined, tier2: undefined, total: 0 };
      })(item);

      const enteredTier1 = Object.prototype.hasOwnProperty.call(entered, 'tier1') ? entered.tier1 : undefined;
      const enteredTier2 = Object.prototype.hasOwnProperty.call(entered, 'tier2') ? entered.tier2 : undefined;

      const fallbackTier1 = itemTier1Map[id] ?? 0;
      const displayTier1 = enteredTier1 !== undefined ? (enteredTier1 === '' ? 0 : Number(enteredTier1)) : (orig.tier1 !== undefined ? orig.tier1 : fallbackTier1);
      const displayTier2 = enteredTier2 !== undefined ? (enteredTier2 === '' ? 0 : Number(enteredTier2)) : (orig.tier2 !== undefined ? orig.tier2 : 0);

      if (onlyIfHasValue && (Number(displayTier1) || 0) + (Number(displayTier2) || 0) <= 0) return;
      displayedItems[id] = { tier1: displayTier1, tier2: displayTier2, category: name };
    };

    // Personnel: same order as CollapsibleUsesRow (personnelItems.map) so lineItemId matches
    personnelItems.forEach((item, idx) => processAndCollect('Personnel Services', item, idx));

    if (independentTierEditing) {
      // In NEP mode save only the parent-account aggregates. Keep zero-value
      // parents so a preparer can intentionally clear a former allocation.
      mooeParentSummaries.forEach((summary) => {
        displayedItems[summary.lineItemId] = {
          tier1: summary.tier1,
          tier2: summary.tier2,
          category: MOOE_CATEGORY,
        };
      });
    } else {
      // Regular Tier keeps accounting-title-level entries with a positive value.
      Object.entries(groupedMooeData).forEach(([, sublineItems]) => {
        sublineItems.forEach((item, idx) =>
          processAndCollect(MOOE_CATEGORY, item, idx, { onlyIfHasValue: true })
        );
      });
    }

    // Capital Outlay: same as table (capitalOutlayData.map(item, idx))
    capitalOutlayData.forEach((item, idx) => processAndCollect('Capital Outlay', item, idx));

    return {
        items: tierInputs,
        displayedItems,
    };
  }, [tierInputs, personnelItems, groupedMooeData, capitalOutlayData, itemTier1Map, independentTierEditing, mooeParentSummaries]);

  // Build line items for report (PDF/Excel): use same getLineItemId(name, item, rowIndex) as allData so keys match
  const reportLineItems = useMemo(() => {
    const rows = [];
    const getLineItemId = (name, item, rowIndex) => `${name}-${item.uacsCode || item._id || item.key || item.name || rowIndex}`;
    const disp = allData.displayedItems || {};

    personnelItems.forEach((item, idx) => {
      const id = getLineItemId('Personnel Services', item, idx);
      const d = disp[id] || {};
      const tier1 = Number(d.tier1) || 0;
      const tier2 = Number(d.tier2) || 0;
      const total = tier1 + tier2;
      const totalPS = usesOfFunds['Personnel Services']?.total || 0;
      const corpPS = usesCorporateIncome?.['Personnel Services'] || 0;
      const itemAmount = Number(item.amount) || Number(item.total) || 0;
      const corporateIncome = totalPS > 0 ? (itemAmount / totalPS) * corpPS : 0;
      const catName = item.categoryName || item.category?.name || 'Personnel Services';
      rows.push({
        lineItemId: id,
        category: 'Personnel Services',
        subCategory: catName,
        description: item.name || item.employeeFullName || '—',
        corporateIncome,
        tier1,
        tier2,
        total,
      });
    });

    if (independentTierEditing) {
      mooeParentSummaries.forEach((summary) => {
        if (summary.tier1 + summary.tier2 <= 0) return;
        rows.push({
          lineItemId: summary.lineItemId,
          category: MOOE_CATEGORY,
          subCategory: summary.parentTitle,
          description: summary.parentTitle,
          referenceNote: `${summary.childItems.length} accounting title${summary.childItems.length === 1 ? '' : 's'} consolidated`,
          corporateIncome: summary.corporateIncome,
          tier1: summary.tier1,
          tier2: summary.tier2,
          total: summary.tier1 + summary.tier2,
        });
      });
    } else {
      // Regular Tier reports the accounting-title-level MOOE rows.
      Object.entries(groupedMooeData).forEach(([subline, sublineItems]) => {
        sublineItems.forEach((item, idx) => {
          const id = getLineItemId(MOOE_CATEGORY, item, idx);
          const d = disp[id] || {};
          const tier1 = Number(d.tier1) || 0;
          const tier2 = Number(d.tier2) || 0;
          const total = tier1 + tier2;
          if (total <= 0) return;
          rows.push({
            lineItemId: id,
            category: MOOE_CATEGORY,
            subCategory: item.sublineItem || subline || '—',
            description: item.accountingTitle || item.sublineItem || item.uacsCode || '—',
            corporateIncome: Number(item?.income) || 0,
            tier1,
            tier2,
            total,
          });
        });
      });
    }

    // Capital Outlay: only include line items with total value > 0
    capitalOutlayData.forEach((item, idx) => {
      const id = getLineItemId('Capital Outlay', item, idx);
      const d = disp[id] || {};
      const tier1 = Number(d.tier1) || 0;
      const tier2 = Number(d.tier2) || 0;
      const total = tier1 + tier2;
      if (total <= 0) return;
      const catTitle = item.categoryTitleFromGroup || item.category?.categoryName || item.sublineItem || '—';
      rows.push({
        lineItemId: id,
        category: 'Capital Outlay',
        subCategory: catTitle,
        description: catTitle,
        corporateIncome: Number(item?.income) || 0,
        tier1,
        tier2,
        total,
      });
    });

    return rows;
  }, [personnelItems, groupedMooeData, capitalOutlayData, usesCorporateIncome, usesOfFunds, allData.displayedItems, independentTierEditing, mooeParentSummaries]);

  const lastTierDataJsonRef = useRef(null);
  useEffect(() => {
    if (onTierDataChange) {
      const payload = {
        ...allData,
        isFinalized: finalizedData?.allFinalized === true,
        reportSummary: {
          sourcesOfFunds,
          usesOfFunds,
          surplusDeficit,
          usesCorporateIncome,
          lineItems: reportLineItems,
        },
      };
      const sig = JSON.stringify(payload);
      if (sig !== lastTierDataJsonRef.current) {
        lastTierDataJsonRef.current = sig;
        onTierDataChange(payload);
      }
    }
  }, [allData, sourcesOfFunds, usesOfFunds, surplusDeficit, usesCorporateIncome, reportLineItems, finalizedData, onTierDataChange]);

  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  }
  if (isError) {
    return <Typography color="error">Error fetching data. Please try again.</Typography>;
  }

  const hasAnyData = personnelData.length || mooeData.length || capitalOutlayData.length || incomeData.length;

  // Tier data appears when there is an Initial proposal at BRD level or finalized for this scope (fiscal year + region/department/division).
  if (hasRequiredParams && !finalizedQuery?.isLoading && !hasTierData) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography variant="body1" color="textSecondary" gutterBottom>
          No Tier data for this scope.
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Tier will appear once the Initial proposal for the selected Region/Department/Division and fiscal year has reached BRD level (Budget Planning Analyst → Budget Officer → Budget Manager) or been finalized in New Proposal Workflow. The Tier you save here is what gets passed from Budget Planning Analyst to Budget Officer until the Budget Manager finalizes.
        </Typography>
      </Paper>
    );
  }

  if (!hasAnyData) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography>No Tier data available for the selected filters.</Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ overflow: 'hidden' }}>
      <TableContainer sx={{ overflowX: 'auto' }}>
        <Table size="medium" sx={{ minWidth: 800, tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '25%', minWidth: 200 }} />
            <col style={{ width: COL.corporateIncome }} />
            <col style={{ width: COL.tier1 }} />
            <col style={{ width: COL.tier2 }} />
            <col style={{ width: COL.total }} />
            <col style={{ width: COL.proposedBudget }} />
          </colgroup>
          <TableHead>
            <TableRow>
              <TableCell rowSpan={2} sx={{ width: '25%', minWidth: 200 }}>Particulars</TableCell>
              <TableCell align="right" rowSpan={2} sx={{ width: COL.corporateIncome }}>PROJECTED CORPORATE INCOME</TableCell>
              <TableCell align="center" colSpan={3}>PROJECTED SUBSIDY</TableCell>
              <TableCell align="right" rowSpan={2} sx={{ width: COL.proposedBudget }}>PROPOSED BUDGET</TableCell>
            </TableRow>
            <TableRow>
              <TableCell align="right" sx={{ width: COL.tier1 }}>Tier 1</TableCell>
              <TableCell align="right" sx={{ width: COL.tier2 }}>Tier 2</TableCell>
              <TableCell align="right" sx={{ width: COL.total }}>Total</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow sx={{ backgroundColor: 'primary.light' }}>
              <TableCell colSpan={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="h6">A. SOURCES OF FUNDS</Typography>
                  <Tooltip title={"Original values: per-item Tier1/Tier2 are used when available; otherwise the item amount is used as Total. 'Orig' helper indicates the source value."}>
                    <InfoOutlinedIcon fontSize="small" sx={{ opacity: 0.85 }} />
                  </Tooltip>
                </Box>
              </TableCell>
            </TableRow>

            {/* Projected Corporate Income - expandable sub-list by category */}
            <TableRow sx={{ '&:hover': { backgroundColor: 'action.hover' } }}>
              <TableCell>
                <IconButton aria-label="expand income" size="small" onClick={() => setIncomeOpen(!incomeOpen)} sx={{ mr: 0.5 }}>
                  {incomeOpen ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                </IconButton>
                Projected Corporate Income
              </TableCell>
              <TableCell align="right">{formatCurrency(sourcesOfFunds.corporateIncome)}</TableCell>
              <TableCell align="right">{formatCurrency(0)}</TableCell>
              <TableCell align="right">{formatCurrency(0)}</TableCell>
              <TableCell align="right">{formatCurrency(0)}</TableCell>
              <TableCell align="right">{formatCurrency(sourcesOfFunds.corporateIncome)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell style={{ padding: 0 }} colSpan={6}>
                <Collapse in={incomeOpen} timeout="auto" unmountOnExit>
                  <Box sx={{ pl: 5, pr: 2, pb: 1 }}>
                    {groupedIncomeData.length > 0 ? (
                      <Table size="small">
                        <TableBody>
                          {groupedIncomeData.map((group) => (
                            <React.Fragment key={group.category}>
                              <TableRow>
                                <TableCell sx={{ pl: 3, fontWeight: 600, color: 'text.secondary' }}>{group.category}</TableCell>
                                <TableCell align="right">{formatCurrency(0)}</TableCell>
                                <TableCell align="right">{formatCurrency(0)}</TableCell>
                                <TableCell align="right">{formatCurrency(0)}</TableCell>
                                <TableCell align="right">{formatCurrency(0)}</TableCell>
                                <TableCell align="right">{formatCurrency(0)}</TableCell>
                              </TableRow>
                              {(group.items || []).map((item, idx) => (
                                <TableRow key={item._id || idx}>
                                  <TableCell sx={{ pl: 5 }}>{item.name || item.particulars || '—'}</TableCell>
                                  <TableCell align="right">{formatCurrency(item.amount || 0)}</TableCell>
                                  <TableCell align="right">{formatCurrency(0)}</TableCell>
                                  <TableCell align="right">{formatCurrency(0)}</TableCell>
                                  <TableCell align="right">{formatCurrency(0)}</TableCell>
                                  <TableCell align="right">{formatCurrency(item.amount || 0)}</TableCell>
                                </TableRow>
                              ))}
                              <TableRow sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                                <TableCell sx={{ pl: 4, fontStyle: 'italic' }}>Subtotal ({group.category})</TableCell>
                                <TableCell align="right">{formatCurrency(group.subtotal || 0)}</TableCell>
                                <TableCell align="right">{formatCurrency(0)}</TableCell>
                                <TableCell align="right">{formatCurrency(0)}</TableCell>
                                <TableCell align="right">{formatCurrency(0)}</TableCell>
                                <TableCell align="right">{formatCurrency(group.subtotal || 0)}</TableCell>
                              </TableRow>
                            </React.Fragment>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <Typography variant="body2" color="textSecondary" sx={{ py: 2, pl: 3 }}>
                        No income breakdown available for this scope.
                      </Typography>
                    )}
                  </Box>
                </Collapse>
              </TableCell>
            </TableRow>

            <TableRow>
              <TableCell>Budgetary Support</TableCell>
              <TableCell align="right">{formatCurrency(0)}</TableCell>
              <TableCell align="right">{formatCurrency(sourcesOfFunds.budgetarySupport.tier1)}</TableCell>
              <TableCell align="right">{formatCurrency(sourcesOfFunds.budgetarySupport.tier2)}</TableCell>
              <TableCell align="right">{formatCurrency(sourcesOfFunds.budgetarySupport.total)}</TableCell>
              <TableCell align="right">{formatCurrency(sourcesOfFunds.budgetarySupport.total)}</TableCell>
            </TableRow>

            <TableRow sx={{ backgroundColor: 'primary.main', color: 'white' }}>
              <TableCell><Typography variant="h6" sx={{color: 'white'}}>TOTAL SOURCES OF FUNDS (PROPOSED BUDGET = PROJECTED CORPORATE INCOME + TOTAL)</Typography></TableCell>
              <TableCell align="right"><Typography variant="h6" sx={{color: 'white'}}>{formatCurrency(sourcesOfFunds.corporateIncome)}</Typography></TableCell>
              <TableCell align="right"><Typography variant="h6" sx={{color: 'white'}}>{formatCurrency(0)}</Typography></TableCell>
              <TableCell align="right"><Typography variant="h6" sx={{color: 'white'}}>{formatCurrency(0)}</Typography></TableCell>
              <TableCell align="right"><Typography variant="h6" sx={{color: 'white'}}>{formatCurrency(sourcesOfFunds.budgetarySupport.total)}</Typography></TableCell>
              <TableCell align="right"><Typography variant="h6" sx={{color: 'white'}}>{formatCurrency(sourcesOfFunds.proposedBudget)}</Typography></TableCell>
            </TableRow>

            <TableRow sx={{ backgroundColor: 'primary.light' }}>
              <TableCell colSpan={6}><Typography variant="h6">B. USES OF FUNDS</Typography></TableCell>
            </TableRow>

            {/* Render personnel categories dynamically */}
            <CollapsibleUsesRow 
              name="Personnel Services"
              items={personnelItems}
              allTierInputs={tierInputs}
              handleTierInputChange={handleTierInputChange}
              totals={usesOfFunds['Personnel Services']}
              descriptionKey="name"
              itemTier1Map={itemTier1Map || {}}
              corporateIncome={usesCorporateIncome?.['Personnel Services'] ?? 0}
              independentTierEditing={independentTierEditing}
              readOnly={readOnly}
              getItemCorporateIncome={(item) => {
                // Distribute corporate income proportionally based on item amount
                const totalPS = usesOfFunds['Personnel Services']?.total || 0;
                const corporateIncomePS = usesCorporateIncome?.['Personnel Services'] || 0;
                if (totalPS === 0) return 0;
                const amountProps = ['amount','total','subtotal','Total','TotalAmount','cost','totalCost','expense'];
                let itemAmount = 0;
                for (const p of amountProps) {
                  if (Object.prototype.hasOwnProperty.call(item, p)) {
                    itemAmount = Number(item[p]) || 0;
                    break;
                  }
                }
                return (itemAmount / totalPS) * corporateIncomePS;
              }}
            />
            
            <React.Fragment>
              <TableRow>
                <TableCell>
                  <IconButton aria-label="expand row" size="small" onClick={() => setMooeOpen(!mooeOpen)}>
                    {mooeOpen ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                  </IconButton>
                  Maintenance and Other Operating Expenses
                </TableCell>
                <TableCell align="right">{formatCurrency(usesCorporateIncome?.['Maintenance and Other Operating Expenses'] ?? 0)}</TableCell>
                <TableCell align="right">{formatCurrency(usesOfFunds['Maintenance and Other Operating Expenses'].tier1)}</TableCell>
                <TableCell align="right">{formatCurrency(usesOfFunds['Maintenance and Other Operating Expenses'].tier2)}</TableCell>
                <TableCell align="right">{formatCurrency(usesOfFunds['Maintenance and Other Operating Expenses'].total)}</TableCell>
                <TableCell align="right">{formatCurrency(usesOfFunds['Maintenance and Other Operating Expenses'].total)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell style={{ padding: 0 }} colSpan={6}>
                  <Collapse in={mooeOpen} timeout="auto" unmountOnExit>
                    <Box sx={{ py: 1, px: 2 }}>
                      {Object.keys(groupedMooeDataForExpand).length === 0 ? (
                        <Typography variant="body2" color="text.secondary">No MOOE data for this scope.</Typography>
                      ) : (
                        <Table size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
                          <colgroup>
                            <col style={{ width: '25%', minWidth: 200 }} />
                            <col style={{ width: COL.corporateIncome }} />
                            <col style={{ width: COL.tier1 }} />
                            <col style={{ width: COL.tier2 }} />
                            <col style={{ width: COL.total }} />
                            <col style={{ width: COL.proposedBudget }} />
                          </colgroup>
                          <TableBody>
                            {independentTierEditing ? (
                              <>
                                <TableRow>
                                  <TableCell colSpan={6}>
                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, py: 0.5 }}>
                                      <InfoOutlinedIcon color="primary" fontSize="small" sx={{ mt: 0.2 }} />
                                      <Typography variant="body2" color="text.secondary">
                                        NEP adjustment uses parent MOOE accounts. Each amount below already
                                        consolidates all accounting titles under that parent.
                                      </Typography>
                                    </Box>
                                  </TableCell>
                                </TableRow>
                                {mooeParentSummaries.map((summary, parentIndex) => (
                                  <SubRow
                                    key={summary.lineItemId}
                                    rowIndex={parentIndex}
                                    item={summary.parentItem}
                                    name={MOOE_CATEGORY}
                                    allTierInputs={mooeParentTierInputs}
                                    handleTierInputChange={handleTierInputChange}
                                    descriptionKey="accountingTitle"
                                    descriptionHelper={`${summary.childItems.length} accounting title${summary.childItems.length === 1 ? '' : 's'} consolidated`}
                                    itemCorporateIncome={summary.corporateIncome}
                                    independentTierEditing
                                    readOnly={readOnly}
                                  />
                                ))}
                              </>
                            ) : (
                              Object.entries(groupedMooeDataForExpand).map(([subline, entries]) => (
                                <React.Fragment key={subline}>
                                  <TableRow>
                                    <TableCell colSpan={6} style={{ fontWeight: 'bold' }}>{subline}</TableCell>
                                  </TableRow>
                                  {entries.map(({ item, originalIdx }) => (
                                    <SubRow
                                      key={item.uacsCode || item._id || originalIdx}
                                      rowIndex={originalIdx}
                                      item={item}
                                      name={MOOE_CATEGORY}
                                      allTierInputs={tierInputs}
                                      handleTierInputChange={handleTierInputChange}
                                      descriptionKey="accountingTitle"
                                      itemTier1={(itemTier1Map || {})[getMooeChildLineItemId(item, originalIdx)] ?? 0}
                                      itemCorporateIncome={Number(item?.income) || 0}
                                      independentTierEditing={independentTierEditing}
                                      readOnly={readOnly}
                                    />
                                  ))}
                                </React.Fragment>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      )}
                    </Box>
                  </Collapse>
                </TableCell>
              </TableRow>
            </React.Fragment>

            <React.Fragment>
              <TableRow>
                <TableCell>
                  <IconButton aria-label="expand row" size="small" onClick={() => setCapitalOutlayOpen(!capitalOutlayOpen)}>
                    {capitalOutlayOpen ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                  </IconButton>
                  Capital Outlay
                </TableCell>
                <TableCell align="right">{formatCurrency(usesCorporateIncome?.['Capital Outlay'] ?? 0)}</TableCell>
                <TableCell align="right">{formatCurrency(usesOfFunds['Capital Outlay'].tier1)}</TableCell>
                <TableCell align="right">{formatCurrency(usesOfFunds['Capital Outlay'].tier2)}</TableCell>
                <TableCell align="right">{formatCurrency(usesOfFunds['Capital Outlay'].total)}</TableCell>
                <TableCell align="right">{formatCurrency(usesOfFunds['Capital Outlay'].total)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell style={{ padding: 0 }} colSpan={6}>
                  <Collapse in={capitalOutlayOpen} timeout="auto" unmountOnExit>
                    <Box sx={{ py: 1, px: 2 }}>
                      {Object.keys(groupedCapitalOutlayByCategory).length === 0 ? (
                        <Typography variant="body2" color="text.secondary">No Capital Outlay data for this scope.</Typography>
                      ) : (
                        <Table size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
                          <colgroup>
                            <col style={{ width: '25%', minWidth: 200 }} />
                            <col style={{ width: COL.corporateIncome }} />
                            <col style={{ width: COL.tier1 }} />
                            <col style={{ width: COL.tier2 }} />
                            <col style={{ width: COL.total }} />
                            <col style={{ width: COL.proposedBudget }} />
                          </colgroup>
                          <TableBody>
                            {Object.entries(groupedCapitalOutlayByCategory).map(([categoryName, entries]) => {
                              return (
                                <React.Fragment key={categoryName}>
                                  {entries.map(({ item, originalIdx }) => (
                                    <SubRow
                                      key={item._id || item.uacsCode || originalIdx}
                                      rowIndex={originalIdx}
                                      item={item}
                                      name="Capital Outlay"
                                      allTierInputs={tierInputs}
                                      handleTierInputChange={handleTierInputChange}
                                      descriptionKey="particulars"
                                      secondaryDescriptionKey="accountingTitle"
                                      itemTier1={itemTier1Map[`Capital Outlay-${item.uacsCode || item._id || item.key || item.name || originalIdx}`] ?? 0}
                                      itemCorporateIncome={Number(item?.income) || 0}
                                      independentTierEditing={independentTierEditing}
                                      readOnly={readOnly}
                                    />
                                  ))}
                                </React.Fragment>
                              );
                            })}
                          </TableBody>
                        </Table>
                      )}
                    </Box>
                  </Collapse>
                </TableCell>
              </TableRow>
            </React.Fragment>

            <TableRow sx={{ backgroundColor: 'primary.main', color: 'white' }}>
              <TableCell><Typography variant="h6" sx={{color: 'white'}}>TOTAL USES OF FUNDS</Typography></TableCell>
              <TableCell align="right"><Typography variant="h6" sx={{color: 'white'}}>{formatCurrency(usesOfFunds.totalCorporateIncome ?? 0)}</Typography></TableCell>
              <TableCell align="right"><Typography variant="h6" sx={{color: 'white'}}>{formatCurrency(usesOfFunds.totalTier1)}</Typography></TableCell>
              <TableCell align="right"><Typography variant="h6" sx={{color: 'white'}}>{formatCurrency(usesOfFunds.totalTier2)}</Typography></TableCell>
              <TableCell align="right"><Typography variant="h6" sx={{color: 'white'}}>{formatCurrency(usesOfFunds.total)}</Typography></TableCell>
              <TableCell align="right"><Typography variant="h6" sx={{color: 'white'}}>{formatCurrency(usesOfFunds.proposedBudget ?? usesOfFunds.total)}</Typography></TableCell>
            </TableRow>

             <TableRow>
              <TableCell><Typography variant="h6">Surplus/(Deficit)</Typography></TableCell>
              <TableCell colSpan={4}></TableCell>
              <TableCell align="right"><Typography variant="h6">{formatCurrency(surplusDeficit)}</Typography></TableCell>
            </TableRow>

          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

export default TierTable;
