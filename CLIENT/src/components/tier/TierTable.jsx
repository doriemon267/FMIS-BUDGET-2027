import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
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

const SubRow = ({ item, name, rowIndex, allTierInputs, handleTierInputChange, descriptionKey, secondaryDescriptionKey, itemTier1 = 0, itemCorporateIncome = 0 }) => {
  const lineItemId = `${name}-${item.uacsCode || item._id || item.key || item.name || rowIndex}`;

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
  const baseTier1 = entered.hasOwnProperty('tier1') ? (entered.tier1 === '' ? 0 : Number(entered.tier1)) : (orig.tier1 !== undefined ? orig.tier1 : Number(itemTier1) || 0);
  const baseTier2 = entered.hasOwnProperty('tier2') ? (entered.tier2 === '' ? 0 : Number(entered.tier2)) : (orig.tier2 !== undefined ? orig.tier2 : 0);
  const rowTotal = (orig.total !== undefined && orig.total > 0) ? orig.total : (baseTier1 + baseTier2) || (Number(itemTier1) || 0);
  const displayTier1 = baseTier1;
  const displayTier2 = baseTier2;
  const totalValue = displayTier1 + displayTier2;

  const tier1Display = entered.hasOwnProperty('tier1')
    ? (entered.tier1 === '' ? '' : formatAmountForInput(entered.tier1))
    : formatAmountForInput(displayTier1) || '0.00';
  const tier2Display = entered.hasOwnProperty('tier2')
    ? (entered.tier2 === '' ? '' : formatAmountForInput(entered.tier2))
    : (orig.tier2 !== undefined && orig.tier2 !== '' ? formatAmountForInput(orig.tier2) : '');

  const handleTier1Change = (value) => {
    const num = value === '' ? 0 : Number(value);
    const tier2 = Math.max(0, rowTotal - num);
    handleTierInputChange(lineItemId, { tier1: value === '' ? '' : num, tier2 }, name);
  };
  const handleTier2Change = (value) => {
    const num = value === '' ? 0 : Number(value);
    const tier1 = Math.max(0, rowTotal - num);
    handleTierInputChange(lineItemId, { tier2: value === '' ? '' : num, tier1 }, name);
  };

  const cellSx = { width: COL.tier1, minWidth: COL.tier1, maxWidth: COL.tier1 };
  const cellSx2 = { width: COL.tier2, minWidth: COL.tier2, maxWidth: COL.tier2 };

  return (
    <TableRow>
      <TableCell sx={{ paddingLeft: '32px', pl: 4, verticalAlign: 'middle' }}>{item[descriptionKey] || item[secondaryDescriptionKey] || 'No Description'}</TableCell>
      <TableCell align="right" sx={{ width: COL.corporateIncome, minWidth: COL.corporateIncome }}>{formatCurrency(Number(itemCorporateIncome) || 0)}</TableCell>
      <TableCell align="right" sx={cellSx}>
        <TextField
          size="small"
          fullWidth
          type="text"
          inputProps={{ inputMode: 'decimal' }}
          InputProps={{ startAdornment: <InputAdornment position="start">₱</InputAdornment> }}
          value={tier1Display}
          onChange={(e) => {
            const v = e.target.value;
            const parsed = parseAmountFromInput(v);
            handleTier1Change(parsed === '' ? '' : parsed);
          }}
          onBlur={(e) => {
            const parsed = parseAmountFromInput(e.target.value);
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
          inputProps={{ inputMode: 'decimal' }}
          InputProps={{ startAdornment: <InputAdornment position="start">₱</InputAdornment> }}
          value={tier2Display}
          onChange={(e) => {
            const v = e.target.value;
            const parsed = parseAmountFromInput(v);
            handleTier2Change(parsed === '' ? '' : parsed);
          }}
          onBlur={(e) => {
            const parsed = parseAmountFromInput(e.target.value);
            handleTier2Change(parsed === '' ? '' : parsed);
          }}
          sx={{ '& .MuiInputBase-input': { textAlign: 'right' } }}
        />
      </TableCell>
      <TableCell align="right" sx={{ width: COL.total, minWidth: COL.total }}>{formatCurrency(totalValue)}</TableCell>
      <TableCell align="right" sx={{ width: COL.proposedBudget, minWidth: COL.proposedBudget }}>{formatCurrency(totalValue)}</TableCell>
    </TableRow>
  );
};

const CollapsibleUsesRow = ({ name, items, allTierInputs, handleTierInputChange, totals, descriptionKey, secondaryDescriptionKey, itemTier1Map = {}, corporateIncome = 0, getItemCorporateIncome }) => {
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

function TierTable({ fiscalYear, region, regionName, department, division, onTierDataChange }) {
  const [tierInputs, setTierInputs] = useState({});
  const [mooeOpen, setMooeOpen] = useState(false);
  const [incomeOpen, setIncomeOpen] = useState(false);

  // When region is "ALL", omit region filter to consolidate all regions.
  // effectiveRegion (ObjectId) for finalized data; regionName (string) for Capital Outlay & Income (DB stores region as string)
  const effectiveRegion = (region && region !== 'ALL') ? region : undefined;
  const baseParams = useMemo(() => {
    const params = { fiscalYear, budgetType: 'Initial' };
    if (regionName) params.region = regionName;
    if (department) params.department = department;
    if (division) params.division = division;
    return params;
  }, [fiscalYear, regionName, department, division]);

  const finalizedParams = useMemo(() => {
    const params = { fiscalYear };
    if (effectiveRegion) params.region = effectiveRegion;
    if (department) params.department = department;
    if (division) params.division = division;
    return params;
  }, [fiscalYear, effectiveRegion, department, division]);

  const hasRequiredParams = !!fiscalYear && !!region;

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
        queryFn: () => api.get('/mooe', { params: baseParams }).then(res => res.data.entries),
        enabled: hasRequiredParams,
      },
      {
        queryKey: ['capitalOutlay', fiscalYear, regionName, 'Initial'],
        queryFn: async () => {
          const params = { fiscalYear: String(fiscalYear || ''), budgetType: 'Initial' };
          if (regionName) params.regions = [regionName];
          const res = await api.get('/api/consolidated-reports/capital-outlay-data', { params });
          const data = res.data?.data || res.data || [];
          return Array.isArray(data) ? data.flatMap(r => r.items || r) : [];
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
        queryKey: ['chargedToIncomePersonnel', fiscalYear, regionName, 'Initial'],
        queryFn: async () => {
          const params = {
            fiscalYear: Number(fiscalYear),
            budgetType: 'Initial',
            chargedToIncomeEligible: true,
            limit: 1000,
            page: 1
          };
          if (regionName) params.region = regionName;
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
  const projectedSubsidyTier1 = Number(finalizedData?.projectedSubsidy) || 0;

  const personnelData = results[0].data || [];
  const mooeData = results[1].data || [];
  const capitalOutlayData = results[2].data || [];
  const incomeData = results[3].data || [];
  const chargedToIncomePersonnel = results[4].data || [];

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
      const key = item.sublineItem;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(item);
      return acc;
    }, {});
  }, [mooeData]);

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

  const { sourcesOfFunds, usesOfFunds, surplusDeficit, itemTier1Map, usesCorporateIncome, totalUsesCorporateIncome } = useMemo(() => {
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

      const enteredTier1 = entered.hasOwnProperty('tier1') ? entered.tier1 : undefined;
      const enteredTier2 = entered.hasOwnProperty('tier2') ? entered.tier2 : undefined;

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

    // MOOE - create a parent 'Maintenance and Other Operating Expenses' and compute its totals; keep sublines grouped in UI
    const mooeParent = 'Maintenance and Other Operating Expenses';
    if (!uses[mooeParent]) uses[mooeParent] = { tier1: 0, tier2: 0, total: 0 };
    Object.values(groupedMooeData).forEach(group => {
      group.forEach(item => {
        const { displayTier1, displayTier2, displayTotal } = processItem(mooeParent, item);
        uses[mooeParent].tier1 += displayTier1;
        uses[mooeParent].tier2 += displayTier2;
        uses[mooeParent].total += displayTotal;
      });
    });

    // Capital Outlay
    const capitalParent = 'Capital Outlay';
    if (!uses[capitalParent]) uses[capitalParent] = { tier1: 0, tier2: 0, total: 0 };
    capitalOutlayData.forEach(item => {
      const { displayTier1, displayTier2, displayTotal } = processItem(capitalParent, item);
      uses[capitalParent].tier1 += displayTier1;
      uses[capitalParent].tier2 += displayTier2;
      uses[capitalParent].total += displayTotal;
    });

    const totalUsesTier1 = Object.values(uses).reduce((s, u) => s + (u.tier1 || 0), 0);
    const totalUsesTier2 = Object.values(uses).reduce((s, u) => s + (u.tier2 || 0), 0);
    const totalUses = Object.values(uses).reduce((s, u) => s + (u.total || 0), 0);
    const subsidyTotal = totalUsesTier1 + totalUsesTier2;
    // PROJECTED CORPORATE INCOME from finalized (read-only). PROPOSED BUDGET = PROJECTED CORPORATE INCOME + TOTAL.
    const corporateIncome = projectedCorporateIncome;
    const totalSources = corporateIncome + subsidyTotal;
    const proposedBudget = totalSources;
    const surplus = totalSources - totalUses;

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
    };
  }, [tierInputs, projectedCorporateIncome, personnelData, mooeData, capitalOutlayData, groupedMooeData, chargedToIncomePersonnel]);

  const allData = useMemo(() => {
    const displayedItems = {};
    const getLineItemId = (name, item) => `${name}-${item.uacsCode || item._id || item.key || item.name}`;

    const processAndCollect = (name, item) => {
      const id = getLineItemId(name, item);
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

      const enteredTier1 = entered.hasOwnProperty('tier1') ? entered.tier1 : undefined;
      const enteredTier2 = entered.hasOwnProperty('tier2') ? entered.tier2 : undefined;

      const fallbackTier1 = itemTier1Map[id] ?? 0;
      const displayTier1 = enteredTier1 !== undefined ? (enteredTier1 === '' ? 0 : Number(enteredTier1)) : (orig.tier1 !== undefined ? orig.tier1 : fallbackTier1);
      const displayTier2 = enteredTier2 !== undefined ? (enteredTier2 === '' ? 0 : Number(enteredTier2)) : (orig.tier2 !== undefined ? orig.tier2 : 0);

      displayedItems[id] = { tier1: displayTier1, tier2: displayTier2, category: name };
    };

    // personnel categories
    personnelData.forEach(category => {
      const catName = category.name || category.key || 'Personnel Services';
      (category.items || []).forEach(item => processAndCollect(catName, item));
    });

    // mooe groups (keep parent 'Maintenance and Other Operating Expenses')
    Object.values(groupedMooeData).forEach(group => group.forEach(item => processAndCollect('Maintenance and Other Operating Expenses', item)));

    // capital outlay
    capitalOutlayData.forEach(item => processAndCollect('Capital Outlay', item));

    return {
        items: tierInputs,
        displayedItems,
    };
  }, [tierInputs, personnelData, groupedMooeData, capitalOutlayData, itemTier1Map]);

  // Build line items for report (PDF/Excel): category, description, corporateIncome, tier1, tier2, total
  const reportLineItems = useMemo(() => {
    const rows = [];
    const getLineItemId = (name, item) => `${name}-${item.uacsCode || item._id || item.key || item.name}`;
    const disp = allData.displayedItems || {};

    personnelData.forEach(category => {
      const catName = category.name || category.key || 'Personnel Services';
      (category.items || []).forEach(item => {
        const id = getLineItemId(catName, item);
        const d = disp[id] || {};
        const tier1 = Number(d.tier1) || 0;
        const tier2 = Number(d.tier2) || 0;
        const total = tier1 + tier2;
        const totalPS = usesOfFunds['Personnel Services']?.total || 0;
        const corpPS = usesCorporateIncome?.['Personnel Services'] || 0;
        const itemAmount = Number(item.amount) || Number(item.total) || 0;
        const corporateIncome = totalPS > 0 ? (itemAmount / totalPS) * corpPS : 0;
        rows.push({
          category: 'Personnel Services',
          subCategory: catName,
          description: item.name || item.employeeFullName || '—',
          corporateIncome,
          tier1,
          tier2,
          total,
        });
      });
    });

    Object.values(groupedMooeData).forEach(group => {
      group.forEach(item => {
        const id = getLineItemId('Maintenance and Other Operating Expenses', item);
        const d = disp[id] || {};
        const tier1 = Number(d.tier1) || 0;
        const tier2 = Number(d.tier2) || 0;
        rows.push({
          category: 'Maintenance and Other Operating Expenses',
          subCategory: item.sublineItem || '—',
          description: item.accountingTitle || item.sublineItem || item.uacsCode || '—',
          corporateIncome: Number(item?.income) || 0,
          tier1,
          tier2,
          total: tier1 + tier2,
        });
      });
    });

    capitalOutlayData.forEach(item => {
      const id = getLineItemId('Capital Outlay', item);
      const d = disp[id] || {};
      const tier1 = Number(d.tier1) || 0;
      const tier2 = Number(d.tier2) || 0;
      rows.push({
        category: 'Capital Outlay',
        subCategory: item.category?.categoryName || '—',
        description: item.particulars || item.accountingTitle || item.uacsCode || '—',
        corporateIncome: Number(item?.income) || 0,
        tier1,
        tier2,
        total: tier1 + tier2,
      });
    });

    return rows;
  }, [personnelData, groupedMooeData, capitalOutlayData, itemTier1Map, usesCorporateIncome, usesOfFunds, allData.displayedItems]);

  useEffect(() => {
    if (onTierDataChange) {
      onTierDataChange({
        ...allData,
        reportSummary: {
          sourcesOfFunds,
          usesOfFunds,
          surplusDeficit,
          usesCorporateIncome,
          lineItems: reportLineItems,
        },
      });
    }
  }, [allData, sourcesOfFunds, usesOfFunds, surplusDeficit, usesCorporateIncome, reportLineItems, onTierDataChange]);

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
              <TableCell align="right" colSpan={3}>PROJECTED SUBSIDY</TableCell>
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
              <TableCell>Budgetary Support (Tier 1 from finalized subsidy; Tier 2 editable)</TableCell>
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
                          {Object.entries(groupedMooeData).map(([subline, sublineItems]) => (
                            <React.Fragment key={subline}>
                              <TableRow>
                                <TableCell colSpan={6} style={{ fontWeight: 'bold' }}>{subline}</TableCell>
                              </TableRow>
                              {sublineItems.map((item, idx) => (
                                <SubRow
                                  key={item.uacsCode || item._id || idx}
                                  rowIndex={idx}
                                  item={item}
                                  name="Maintenance and Other Operating Expenses"
                                  allTierInputs={tierInputs}
                                  handleTierInputChange={handleTierInputChange}
                                  descriptionKey="accountingTitle"
                                  itemTier1={(itemTier1Map || {})[`Maintenance and Other Operating Expenses-${item.uacsCode || item._id || item.key || item.name || idx}`] ?? 0}
                                  itemCorporateIncome={Number(item?.income) || 0}
                                />
                              ))}
                            </React.Fragment>
                          ))}
                        </TableBody>
                      </Table>
                    </Box>
                  </Collapse>
                </TableCell>
              </TableRow>
            </React.Fragment>

            <CollapsibleUsesRow
              name="Capital Outlay"
              items={capitalOutlayData}
              allTierInputs={tierInputs}
              handleTierInputChange={handleTierInputChange}
              totals={usesOfFunds['Capital Outlay']}
              descriptionKey="particulars"
              secondaryDescriptionKey="accountingTitle"
              itemTier1Map={itemTier1Map || {}}
              corporateIncome={usesCorporateIncome?.['Capital Outlay'] ?? 0}
              getItemCorporateIncome={(item) => Number(item?.income) || 0}
            />

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