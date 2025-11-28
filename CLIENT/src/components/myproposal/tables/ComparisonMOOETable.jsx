import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { shouldHideGenericOtherUacs, getIndentLevelFromSubline } from '../../../utils/uacsDisplayHelper';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Box,
  Typography,
  IconButton,
  Tooltip,
  TablePagination
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';

const ComparisonMOOETable = ({ data }) => {
  const isEqual = (a, b) => {
    if (a === b) return true;
    if (a == null || b == null) return a === b;
    if (typeof a === 'number' && typeof b === 'string') return a === Number(b);
    if (typeof a === 'string' && typeof b === 'number') return Number(a) === b;
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!isEqual(a[i], b[i])) return false;
      }
      return true;
    }
    if (typeof a === 'object' && typeof b === 'object') {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      if (keysA.length !== keysB.length) return false;
      for (const key of keysA) {
        if (!keysB.includes(key) || !isEqual(a[key], b[key])) return false;
      }
      return true;
    }
    return false;
  };
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount || 0);
  };

  const getCellStyle = (item, field) => {
    if (item.changeType === 'added') return { backgroundColor: '#e8f5e9', fontWeight: 'bold' };
    if (item.changeType === 'deleted') return { backgroundColor: '#ffebee', textDecoration: 'line-through', opacity: 0.7 };
    if (item.changeType === 'modified' && item.originalValues && item.originalValues[field] !== undefined) {
      const oldValue = item.originalValues[field];
      const newValue = item[field];
      if (field === 'amount') {
        if (newValue > oldValue) return { backgroundColor: '#e8f5e9', fontWeight: 'bold' };
        if (newValue < oldValue) return { backgroundColor: '#ffebee', fontWeight: 'bold' };
      } else if (!isEqual(oldValue, newValue)) {
        return { backgroundColor: '#fff3e0' };
      }
    }
    return {};
  };

  const renderComparisonCell = (item, field, { isCurrency = false, align = 'left', sx = {} } = {}) => {
    const cellStyle = getCellStyle(item, field);
    // Hide generic 'Other' UACS code for Other Maintenance and Operating Expenses
    if (field === 'uacsCode' && shouldHideGenericOtherUacs(item.uacsCode, item.sublineItem)) {
      return (
        <TableCell sx={cellStyle} align={align}>
          {''}
        </TableCell>
      );
    }
    const currentValue = item[field];
    const displayValue = currentValue ?? (isCurrency ? 0 : '—');
    
    if (item.changeType === 'modified' && item.originalValues && item.originalValues[field] !== undefined) {
      const oldValue = item.originalValues[field];
      if (!isEqual(oldValue, currentValue)) {
        return (
          <TableCell sx={{ ...cellStyle, ...sx }} align={align}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                {isCurrency ? formatCurrency(displayValue) : displayValue}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ textDecoration: 'line-through' }}>
                {isCurrency ? formatCurrency(oldValue ?? 0) : (oldValue ?? '—')}
              </Typography>
            </Box>
          </TableCell>
        );
      }
    }
    
    return (
      <TableCell sx={{ ...cellStyle, ...sx }} align={align}>
        {isCurrency ? formatCurrency(displayValue) : displayValue}
      </TableCell>
    );
  };

  const [expandedGroups, setExpandedGroups] = useState({});
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const groupedData = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return [];

    const map = new Map();

    data.forEach((rawItem, index) => {
      const item = {
        ...rawItem,
        amount: rawItem.amount != null
          ? Number(rawItem.amount)
          : Number(rawItem.income || 0) + Number(rawItem.subsidy || 0)
      };

      const key = (item?.sublineItem && item.sublineItem.trim()) || 'UNCATEGORIZED';
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push({ item, index });
    });

    return Array.from(map.entries())
      .map(([key, entries]) => {
        const counts = entries.reduce((acc, { item }) => {
          const change = item.changeType || 'unchanged';
          acc[change] = (acc[change] || 0) + 1;
          if (change !== 'deleted') {
            acc.income += Number(item.income || 0);
            acc.subsidy += Number(item.subsidy || 0);
            acc.amount += Number(item.amount || 0);
          }
          return acc;
        }, { added: 0, modified: 0, deleted: 0, unchanged: 0, income: 0, subsidy: 0, amount: 0 });

        return {
          key,
          displayName: key === 'UNCATEGORIZED' ? 'Uncategorized' : key,
          entries,
          totals: {
            income: counts.income,
            subsidy: counts.subsidy,
            amount: counts.amount
          },
          counts
        };
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { numeric: true, sensitivity: 'base' }));
  }, [data]);

  const tableTotals = useMemo(() => {
    return groupedData.reduce((acc, group) => {
      acc.income += group.totals.income;
      acc.subsidy += group.totals.subsidy;
      acc.amount += group.totals.amount;
      return acc;
    }, { income: 0, subsidy: 0, amount: 0 });
  }, [groupedData]);

  useEffect(() => {
    setExpandedGroups((prev) => {
      const next = { ...prev };
      let changed = false;
      const keys = new Set();

      groupedData.forEach((group) => {
        keys.add(group.key);
        if (typeof next[group.key] !== 'boolean') {
          next[group.key] = true;
          changed = true;
        }
      });

      Object.keys(next).forEach((key) => {
        if (!keys.has(key)) {
          delete next[key];
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [groupedData]);

  const totalGroups = groupedData.length;
  const pageStart = rowsPerPage === -1 ? 0 : page * rowsPerPage;

  useEffect(() => {
    if (rowsPerPage === -1) {
      if (page !== 0) {
        setPage(0);
      }
      return;
    }
    const maxPage = totalGroups === 0 ? 0 : Math.max(0, Math.ceil(totalGroups / rowsPerPage) - 1);
    if (page > maxPage) {
      setPage(maxPage);
    }
  }, [page, rowsPerPage, totalGroups]);

  const paginatedGroups = useMemo(() => {
    if (rowsPerPage === -1) {
      return groupedData;
    }
    return groupedData.slice(pageStart, pageStart + rowsPerPage);
  }, [groupedData, pageStart, rowsPerPage]);


  // Determine which organizational column to display (Division preferred for Analyst context)
  const orgColumnLabel = useMemo(() => {
    if (Array.isArray(data) && data.some(d => d && d.division)) return 'Division';
    if (Array.isArray(data) && data.some(d => d && d.department)) return 'Department';
    return 'Organization';
  }, [data]);

  const toggleGroup = useCallback((groupKey) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupKey]: !(prev[groupKey] ?? true)
    }));
  }, []);

  const handleChangePage = useCallback((event, newPage) => {
    if (rowsPerPage === -1) {
      return;
    }
    setPage(newPage);
  }, [rowsPerPage]);

  const handleChangeRowsPerPage = useCallback((event) => {
    const nextValue = parseInt(event.target.value, 10);
    setRowsPerPage(nextValue);
    setPage(0);
  }, []);

  const allExpanded = groupedData.length > 0 && groupedData.every((group) => expandedGroups[group.key] !== false);
  const toggleAll = () => {
    const next = {};
    groupedData.forEach((group) => {
      next[group.key] = !allExpanded;
    });
    setExpandedGroups(next);
  };

  return (
    <Box>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip label={`Total Amount: ${formatCurrency(tableTotals.amount)}`} color="primary" />
          <Chip label={`Income: ${formatCurrency(tableTotals.income)}`} color="secondary" variant="outlined" />
          <Chip label={`Subsidy: ${formatCurrency(tableTotals.subsidy)}`} color="secondary" variant="outlined" />
        </Box>
        {groupedData.length > 0 && (
          <Tooltip title={allExpanded ? 'Collapse all groups' : 'Expand all groups'}>
            <Chip
              label={allExpanded ? 'Collapse All' : 'Expand All'}
              onClick={toggleAll}
              sx={{ cursor: 'pointer' }}
              variant="outlined"
            />
          </Tooltip>
        )}
      </Box>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell width={48}></TableCell>
              <TableCell><strong>Subline Item</strong></TableCell>
              <TableCell><strong>Accounting Title</strong></TableCell>
              <TableCell><strong>UACS Code</strong></TableCell>
              <TableCell align="right"><strong>Income</strong></TableCell>
              <TableCell align="right"><strong>Subsidy</strong></TableCell>
              <TableCell align="right"><strong>Amount</strong></TableCell>
                  <TableCell><strong>{orgColumnLabel}</strong></TableCell>
              <TableCell><strong>Change Status</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {groupedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  <Box sx={{ py: 3, color: 'text.secondary' }}>
                    No MOOE entries found.
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              paginatedGroups.map((group) => {
                const isExpanded = expandedGroups[group.key] !== false;
                return (
                  <React.Fragment key={group.key}>
                    <TableRow sx={{ backgroundColor: '#eef2ff' }}>
                      <TableCell>
                        <IconButton size="small" onClick={() => toggleGroup(group.key)}>
                          {isExpanded ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
                        </IconButton>
                      </TableCell>
                      <TableCell colSpan={2} sx={{ fontWeight: 600 }}>
                        {group.displayName}
                        <Chip label={`${group.entries.length} item${group.entries.length > 1 ? 's' : ''}`} size="small" sx={{ ml: 1 }} />
                      </TableCell>
                      <TableCell sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                        Group Totals
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(group.totals.income)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(group.totals.subsidy)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(group.totals.amount)}</TableCell>
                      <TableCell colSpan={2}>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          {group.counts.added > 0 && <Chip size="small" color="success" label={`+${group.counts.added}`} />}
                          {group.counts.modified > 0 && <Chip size="small" color="warning" label={`~${group.counts.modified}`} />}
                          {group.counts.deleted > 0 && <Chip size="small" color="error" label={`-${group.counts.deleted}`} />}
                        </Box>
                      </TableCell>
                    </TableRow>

                    {isExpanded && group.entries.map(({ item }, idx) => {
                      const rowKey = `${group.key}-${idx}`;
                      const indentLevel = getIndentLevelFromSubline(item.sublineItem || item.accountingTitle || group.key, item.uacsCode);
                      return (
                        <TableRow key={rowKey}>
                          <TableCell></TableCell>
                          {renderComparisonCell(item, 'sublineItem')}
                          {renderComparisonCell(item, 'accountingTitle', { sx: { pl: indentLevel * 3 } })}
                          {renderComparisonCell(item, 'uacsCode')}
                          {renderComparisonCell(item, 'income', { isCurrency: true, align: 'right' })}
                          {renderComparisonCell(item, 'subsidy', { isCurrency: true, align: 'right' })}
                          {renderComparisonCell(item, 'amount', { isCurrency: true, align: 'right' })}
                        <TableCell>
                                                    {item.division || item.department || '—'}
                                                  </TableCell>
                          <TableCell>
                            {item.changeType === 'added' && <Chip label="Added" size="small" color="success" />}
                            {item.changeType === 'modified' && <Chip label="Modified" size="small" color="warning" />}
                            {item.changeType === 'deleted' && <Chip label="Deleted" size="small" color="error" />}
                            {item.changeType === 'unchanged' && <Chip label="Unchanged" size="small" />}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </React.Fragment>
                );
              })
            )}

            {groupedData.length > 0 && (
              <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                <TableCell></TableCell>
                <TableCell colSpan={2} sx={{ fontWeight: 'bold' }}>Grand Total</TableCell>
                <TableCell></TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(tableTotals.income)}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(tableTotals.subsidy)}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(tableTotals.amount)}</TableCell>
                <TableCell colSpan={2}></TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {totalGroups > 0 && (
        <TablePagination
          component="div"
          count={totalGroups}
          page={rowsPerPage === -1 ? 0 : page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[5, 10, 25, { value: -1, label: 'All' }]}
          labelRowsPerPage="Groups per page"
          showFirstButton
          showLastButton
        />
      )}
    </Box>
  );
};

export default ComparisonMOOETable;