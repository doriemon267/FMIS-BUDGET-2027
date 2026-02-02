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

const formatCurrency = (value) => {
  const num = Number(value);
  if (isNaN(num)) return '₱0.00';
  return `₱${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const SubRow = ({ item, name, rowIndex, allTierInputs, handleTierInputChange, descriptionKey, secondaryDescriptionKey }) => {
  const lineItemId = `${name}-${item.uacsCode || item._id || item.key || item.name || rowIndex}`;

  const getOriginalTiersLocal = (i) => {
    const t1Props = ['tier1','tier_1','tierOne','tier_one','t1','tier1Amount','tier_1_amount','subsidyTier1','subsidy_tier1'];
    const t2Props = ['tier2','tier_2','tierTwo','tier_two','t2','tier2Amount','tier_2_amount','subsidyTier2','subsidy_tier2'];
    let ot1, ot2;
    for (const p of t1Props) if (Object.prototype.hasOwnProperty.call(i, p)) { ot1 = Number(i[p]) || 0; break; }
    for (const p of t2Props) if (Object.prototype.hasOwnProperty.call(i, p)) { ot2 = Number(i[p]) || 0; break; }
    if (ot1 !== undefined || ot2 !== undefined) return { tier1: ot1 || 0, tier2: ot2 || 0, total: (ot1 || 0) + (ot2 || 0) };
    if (i.amount !== undefined) return { tier1: undefined, tier2: undefined, total: Number(i.amount) || 0 };
    return { tier1: undefined, tier2: undefined, total: 0 };
  };

  const entered = allTierInputs[lineItemId] || {};
  const orig = getOriginalTiersLocal(item);
  // TIER 1 is read-only from finalized (0 per line); only TIER 2 is editable. TOTAL = TIER 1 + TIER 2 per line.
  const displayTier2 = entered.hasOwnProperty('tier2') ? (entered.tier2 === '' ? 0 : entered.tier2) : (orig.tier2 !== undefined ? orig.tier2 : '');
  const totalValue = Number(displayTier2) || 0;

  return (
    <TableRow>
      <TableCell style={{ paddingLeft: '32px' }}>{item[descriptionKey] || item[secondaryDescriptionKey] || 'No Description'}</TableCell>
      <TableCell></TableCell>
      <TableCell>
        <TextField
          size="small"
          type="number"
          inputProps={{ min: 0, step: 0.01, readOnly: true }}
          InputProps={{ startAdornment: <InputAdornment position="start">₱</InputAdornment>, readOnly: true }}
          value={0}
          sx={{ maxWidth: 160, '& .MuiInputBase-input': { backgroundColor: 'action.hover' } }}
        />
      </TableCell>
      <TableCell>
        <TextField
          size="small"
          type="number"
          inputProps={{ min: 0, step: 0.01 }}
          InputProps={{ startAdornment: <InputAdornment position="start">₱</InputAdornment> }}
          value={allTierInputs[lineItemId]?.tier2 ?? (orig.tier2 !== undefined ? orig.tier2 : '')}
          onChange={(e) => handleTierInputChange(lineItemId, 'tier2', e.target.value, name)}
          helperText={orig.tier2 !== undefined ? `Orig: ${formatCurrency(orig.tier2)}` : ''}
          sx={{ maxWidth: 160 }}
        />
      </TableCell>
      <TableCell align="right">{formatCurrency(totalValue)}</TableCell>
      <TableCell align="right">{formatCurrency(totalValue)}</TableCell>
    </TableRow>
  );
};

const CollapsibleUsesRow = ({ name, items, allTierInputs, handleTierInputChange, totals, descriptionKey, secondaryDescriptionKey }) => {
  const [open, setOpen] = useState(false);

  return (
    <React.Fragment>
      <TableRow>
        <TableCell>
          <IconButton aria-label="expand row" size="small" onClick={() => setOpen(!open)}>
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
          {name}
        </TableCell>
        <TableCell></TableCell>
        <TableCell align="right">{formatCurrency(totals.tier1)}</TableCell>
        <TableCell align="right">{formatCurrency(totals.tier2)}</TableCell>
        <TableCell align="right">{formatCurrency(totals.total)}</TableCell>
        <TableCell align="right">{formatCurrency(totals.total)}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ padding: 0 }} colSpan={6}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box>
              <Table size="small">
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

function TierTable({ fiscalYear, region, department, division, onTierDataChange }) {
  const [tierInputs, setTierInputs] = useState({});
  const [mooeOpen, setMooeOpen] = useState(false);

  const baseParams = useMemo(() => {
    const params = { fiscalYear, budgetType: 'Initial' };
    if (region) params.region = region;
    if (department) params.department = department;
    if (division) params.division = division;
    return params;
  }, [fiscalYear, region, department, division]);

  const finalizedParams = useMemo(() => {
    const params = { fiscalYear };
    if (region) params.region = region;
    if (department) params.department = department;
    if (division) params.division = division;
    return params;
  }, [fiscalYear, region, department, division]);

  const hasRequiredParams = !!fiscalYear;

  // Finalized Initial proposals for this scope (PROJECTED CORPORATE INCOME and PROJECTED SUBSIDY → TIER 1). Tier data appears when hasFinalized for the selected Region/Department/Division.
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
        queryKey: ['capitalOutlay', baseParams],
        queryFn: () => api.get('/capital-outlays', { params: baseParams }).then(res => res.data.capitalOutlays),
        enabled: hasRequiredParams,
      },
      {
        queryKey: ['income', baseParams],
        queryFn: () => api.get('/income/getByParams', { params: baseParams }).then(res => res.data),
        enabled: hasRequiredParams,
      }
    ],
  });

  const isLoading = finalizedQuery?.isLoading || results.some(r => r.isLoading);
  const isError = results.some(r => r.isError);

  const finalizedData = finalizedQuery?.data || null;
  const hasFinalized = finalizedData?.hasFinalized === true;
  const projectedCorporateIncome = Number(finalizedData?.projectedCorporateIncome) || 0;
  const projectedSubsidyTier1 = Number(finalizedData?.projectedSubsidy) || 0;

  const personnelData = results[0].data || [];
  const mooeData = results[1].data || [];
  const capitalOutlayData = results[2].data || [];
  const incomeData = results[3].data || [];

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

  // Only TIER 2 is editable; TIER 1 comes from finalized (PROJECTED SUBSIDY).
  const handleTierInputChange = useCallback((lineItemId, field, value, category) => {
    if (field !== 'tier2') return;
    const numValue = value === '' ? '' : parseFloat(value) || 0;
    setTierInputs(prev => ({
      ...prev,
      [lineItemId]: {
        ...prev[lineItemId],
        tier2: numValue,
        category,
      },
    }));
  }, []);

  const { sourcesOfFunds, usesOfFunds, surplusDeficit } = useMemo(() => {
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

      // fallback to amount only
      if (item.amount !== undefined) {
        return { tier1: undefined, tier2: undefined, total: Number(item.amount) || 0 };
      }

      return { tier1: undefined, tier2: undefined, total: 0 };
    };

    // helper to process an item for a category
    const processItem = (name, item) => {
      const id = getLineItemId(name, item);
      const entered = tierInputs[id] || {};
      const orig = getOriginalTiers(item);

      const enteredTier1 = entered.hasOwnProperty('tier1') ? entered.tier1 : undefined;
      const enteredTier2 = entered.hasOwnProperty('tier2') ? entered.tier2 : undefined;

      const displayTier1 = enteredTier1 !== undefined ? (enteredTier1 === '' ? 0 : enteredTier1) : (orig.tier1 !== undefined ? orig.tier1 : 0);
      const displayTier2 = enteredTier2 !== undefined ? (enteredTier2 === '' ? 0 : enteredTier2) : (orig.tier2 !== undefined ? orig.tier2 : 0);

      const displayTotal = (enteredTier1 !== undefined || enteredTier2 !== undefined)
        ? ( (enteredTier1 === '' ? 0 : (enteredTier1 || 0)) + (enteredTier2 === '' ? 0 : (enteredTier2 || 0)) )
        : (orig.total !== undefined ? orig.total : 0);

      return { displayTier1, displayTier2, displayTotal };
    };

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

    const totalUsesTier2 = Object.values(uses).reduce((s, u) => s + (u.tier2 || 0), 0);
    const totalUses = Object.values(uses).reduce((s, u) => s + (u.total || 0), 0);
    // TIER 1 total from finalized (PROJECTED SUBSIDY); TIER 2 from editable inputs. TOTAL = TIER 1 + TIER 2.
    const totalUsesTier1 = projectedSubsidyTier1;
    const subsidyTotal = totalUsesTier1 + totalUsesTier2;
    // PROJECTED CORPORATE INCOME from finalized (read-only). PROPOSED BUDGET = PROJECTED CORPORATE INCOME + TOTAL.
    const corporateIncome = projectedCorporateIncome;
    const totalSources = corporateIncome + subsidyTotal;
    const proposedBudget = totalSources;
    const surplus = totalSources - totalUses;

    return {
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
      },
      surplusDeficit: totalSources - subsidyTotal,
    };
  }, [tierInputs, projectedCorporateIncome, projectedSubsidyTier1, personnelData, mooeData, capitalOutlayData, groupedMooeData]);

  const allData = useMemo(() => {
    // prepare displayedItems map including fallback to original values when user hasn't entered values
    const displayedItems = {};

    const processAndCollect = (name, item) => {
      const id = `${name}-${item.uacsCode || item._id || item.key || item.name}`;
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

      const displayTier1 = enteredTier1 !== undefined ? (enteredTier1 === '' ? 0 : enteredTier1) : (orig.tier1 !== undefined ? orig.tier1 : 0);
      const displayTier2 = enteredTier2 !== undefined ? (enteredTier2 === '' ? 0 : enteredTier2) : (orig.tier2 !== undefined ? orig.tier2 : 0);

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
  }, [tierInputs, personnelData, groupedMooeData, capitalOutlayData]);

  useEffect(() => {
    if (onTierDataChange) {
      onTierDataChange(allData);
    }
  }, [allData, onTierDataChange]);

  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  }
  if (isError) {
    return <Typography color="error">Error fetching data. Please try again.</Typography>;
  }

  const hasAnyData = personnelData.length || mooeData.length || capitalOutlayData.length || incomeData.length;

  // Tier data appears only when there are finalized Initial proposals for this scope (fiscal year + region/department/division). Page is for all levels (Region/Department/Division), not BRD-only.
  if (hasRequiredParams && !finalizedQuery?.isLoading && !hasFinalized) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography variant="body1" color="textSecondary" gutterBottom>
          No finalized data for this scope.
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Tier data will appear once Initial proposals for the selected Region/Department/Division and fiscal year (current settings) have been finalized in New Proposal Workflow.
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
    <Paper>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell rowSpan={2}>Particulars</TableCell>
              <TableCell align="center" rowSpan={2}>PROJECTED CORPORATE INCOME</TableCell>
              <TableCell align="center" colSpan={3}>PROJECTED SUBSIDY</TableCell>
              <TableCell align="center" rowSpan={2}>PROPOSED BUDGET</TableCell>
            </TableRow>
            <TableRow>
              <TableCell align="center">Tier 1</TableCell>
              <TableCell align="center">Tier 2</TableCell>
              <TableCell align="center">Total</TableCell>
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

            <TableRow>
              <TableCell>Projected Corporate Income</TableCell>
              <TableCell align="right">{formatCurrency(sourcesOfFunds.corporateIncome)}</TableCell>
              <TableCell></TableCell>
              <TableCell></TableCell>
              <TableCell></TableCell>
              <TableCell align="right">{formatCurrency(sourcesOfFunds.corporateIncome)}</TableCell>
            </TableRow>

            <TableRow>
              <TableCell>Budgetary Support (Tier 1 from finalized subsidy; Tier 2 editable)</TableCell>
              <TableCell></TableCell>
              <TableCell align="right">{formatCurrency(sourcesOfFunds.budgetarySupport.tier1)}</TableCell>
              <TableCell align="right">{formatCurrency(sourcesOfFunds.budgetarySupport.tier2)}</TableCell>
              <TableCell align="right">{formatCurrency(sourcesOfFunds.budgetarySupport.total)}</TableCell>
              <TableCell align="right">{formatCurrency(sourcesOfFunds.budgetarySupport.total)}</TableCell>
            </TableRow>

            <TableRow sx={{ backgroundColor: 'primary.main', color: 'white' }}>
              <TableCell><Typography variant="h6" sx={{color: 'white'}}>TOTAL SOURCES OF FUNDS (PROPOSED BUDGET = PROJECTED CORPORATE INCOME + TOTAL)</Typography></TableCell>
              <TableCell align="right"><Typography variant="h6" sx={{color: 'white'}}>{formatCurrency(sourcesOfFunds.corporateIncome)}</Typography></TableCell>
              <TableCell></TableCell>
              <TableCell></TableCell>
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
            />
            
            <React.Fragment>
              <TableRow>
                <TableCell>
                  <IconButton aria-label="expand row" size="small" onClick={() => setMooeOpen(!mooeOpen)}>
                    {mooeOpen ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                  </IconButton>
                  Maintenance and Other Operating Expenses
                </TableCell>
                  <TableCell></TableCell>
                <TableCell align="right">{formatCurrency(usesOfFunds['Maintenance and Other Operating Expenses'].tier1)}</TableCell>
                <TableCell align="right">{formatCurrency(usesOfFunds['Maintenance and Other Operating Expenses'].tier2)}</TableCell>
                <TableCell align="right">{formatCurrency(usesOfFunds['Maintenance and Other Operating Expenses'].total)}</TableCell>
                <TableCell align="right">{formatCurrency(usesOfFunds['Maintenance and Other Operating Expenses'].total)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell style={{ padding: 0 }} colSpan={6}>
                  <Collapse in={mooeOpen} timeout="auto" unmountOnExit>
                    <Box>
                      <Table size="small">
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
            />

            <TableRow sx={{ backgroundColor: 'primary.main', color: 'white' }}>
              <TableCell><Typography variant="h6" sx={{color: 'white'}}>TOTAL USES OF FUNDS</Typography></TableCell>
              <TableCell></TableCell>
              <TableCell align="right"><Typography variant="h6" sx={{color: 'white'}}>{formatCurrency(usesOfFunds.totalTier1)}</Typography></TableCell>
              <TableCell align="right"><Typography variant="h6" sx={{color: 'white'}}>{formatCurrency(usesOfFunds.totalTier2)}</Typography></TableCell>
              <TableCell align="right"><Typography variant="h6" sx={{color: 'white'}}>{formatCurrency(usesOfFunds.total)}</Typography></TableCell>
              <TableCell align="right"><Typography variant="h6" sx={{color: 'white'}}>{formatCurrency(usesOfFunds.total)}</Typography></TableCell>
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