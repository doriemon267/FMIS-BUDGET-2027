import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  Collapse,
  List,
  ListItem,
  ListItemText,
  Divider,
  TablePagination
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import InfoIcon from '@mui/icons-material/Info';

const isObjectIdLike = (val) => typeof val === 'string' && /^[a-f0-9]{24}$/i.test(val.trim());

const getTitleDisplay = (item) => {
  if (!item) return 'Untitled Title';

  if (item.category && typeof item.category === 'object') {
    const populatedLabel = item.category.categoryName || item.category.name || item.category.title;
    if (populatedLabel && String(populatedLabel).trim()) {
      return String(populatedLabel).trim();
    }
  }

  const candidateFields = [
    item.categoryName,
    item.categoryLabel,
    item.categoryTitle,
    item.categoryText,
    item.category_display_name,
    item.capitalOutlayTitle,
    item.capitalOutlayCategory,
    item.title,
    item.Title
  ];

  const resolved = candidateFields.find((value) => value && String(value).trim());
  if (resolved) {
    return String(resolved).trim();
  }

  if (item.category && typeof item.category === 'string' && !isObjectIdLike(item.category) && item.category.trim()) {
    return item.category.trim();
  }

  const fallback = item.accountingTitle || item.particulars || item.sublineItem || item.uacsCode;
  if (fallback && String(fallback).trim()) {
    return String(fallback).trim();
  }

  return 'Untitled Title';
};
const normalizeTitle = (title) => (title ? title.trim().toLowerCase() : 'untitled');

const formatCurrency = (amount) => new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP'
}).format(amount || 0);

const ComparisonCapitalOutlayTable = ({ data }) => {
  const getCellStyle = (item, field) => {
    if (item.changeType === 'added') return { backgroundColor: '#e8f5e9', fontWeight: 'bold' };
    if (item.changeType === 'deleted') return { backgroundColor: '#ffebee', textDecoration: 'line-through', opacity: 0.7 };
    if (item.changeType === 'modified' && item.originalValues && item.originalValues[field] !== undefined) {
      const oldValue = item.originalValues[field];
      const newValue = item[field];
      const numericFields = ['quantity', 'unitCost', 'cost', 'income', 'subsidy'];
      if (numericFields.includes(field)) {
        if (Number(newValue || 0) > Number(oldValue || 0)) return { backgroundColor: '#e8f5e9', fontWeight: 'bold' };
        if (Number(newValue || 0) < Number(oldValue || 0)) return { backgroundColor: '#ffebee', fontWeight: 'bold' };
      } else if (oldValue !== newValue) {
        return { backgroundColor: '#fff3e0' };
      }
    }
    return {};
  };

  const renderComparisonCell = (item, field, { isCurrency = false, align = 'left', fallback = '—' } = {}) => {
    const cellStyle = getCellStyle(item, field);
    const currentValue = item[field];
    const hasValue = currentValue !== null && currentValue !== undefined;
    const displayValue = hasValue ? currentValue : fallback;

    if (item.changeType === 'modified' && item.originalValues && item.originalValues[field] !== undefined) {
      const oldValue = item.originalValues[field];
      if (oldValue !== currentValue) {
        return (
          <TableCell sx={cellStyle} align={align}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                {isCurrency ? (hasValue ? formatCurrency(currentValue) : '—') : displayValue}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ textDecoration: 'line-through' }}>
                Was: {isCurrency ? formatCurrency(oldValue ?? 0) : (oldValue ?? fallback)}
              </Typography>
            </Box>
          </TableCell>
        );
      }
    }

    return (
      <TableCell sx={cellStyle} align={align}>
        {isCurrency ? (hasValue ? formatCurrency(currentValue) : '—') : displayValue}
      </TableCell>
    );
  };

  const [expandedGroups, setExpandedGroups] = useState({});
  const [expandedRows, setExpandedRows] = useState({});
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  const groups = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return [];

    const groupMap = new Map();

    data.forEach((rawItem, index) => {
      const item = {
        ...rawItem,
        cost: rawItem.cost != null ? Number(rawItem.cost) : Number(rawItem.income || 0) + Number(rawItem.subsidy || 0),
        income: Number(rawItem.income || 0),
        subsidy: Number(rawItem.subsidy || 0)
      };

      const displayName = getTitleDisplay(item);
      const key = normalizeTitle(displayName);

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          key,
          displayName,
          items: [],
          totals: { income: 0, subsidy: 0, cost: 0 },
          counts: { added: 0, modified: 0, deleted: 0, unchanged: 0 }
        });
      }

      const group = groupMap.get(key);
      group.items.push({ item, index });

      const change = item.changeType || 'unchanged';
      group.counts[change] = (group.counts[change] || 0) + 1;

      if (change !== 'deleted') {
        group.totals.income += Number(item.income || 0);
        group.totals.subsidy += Number(item.subsidy || 0);
        group.totals.cost += Number(item.cost || 0);
      }
    });

    return Array.from(groupMap.values()).sort((a, b) =>
      a.displayName.localeCompare(b.displayName, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [data]);

  useEffect(() => {
    setExpandedGroups((prev) => {
      const next = { ...prev };
      let changed = false;
      const keys = new Set();

      groups.forEach((group) => {
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
  }, [groups]);

  useEffect(() => {
    setExpandedRows((prev) => {
      const next = { ...prev };
      let changed = false;
      const keys = new Set();

      groups.forEach((group) => {
        group.items.forEach(({ item, index }) => {
          const rowKey = String(item.originalId || item._id || `${group.key}-${index}`);
          keys.add(rowKey);
          if (typeof next[rowKey] !== 'boolean') {
            next[rowKey] = false;
            changed = true;
          }
        });
      });

      Object.keys(next).forEach((key) => {
        if (!keys.has(key)) {
          delete next[key];
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [groups]);

  const totals = useMemo(() => {
    return groups.reduce((acc, group) => {
      acc.income += group.totals.income;
      acc.subsidy += group.totals.subsidy;
      acc.cost += group.totals.cost;
      return acc;
    }, { income: 0, subsidy: 0, cost: 0 });
  }, [groups]);

  const totalGroups = groups.length;
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
      return groups;
    }
    return groups.slice(pageStart, pageStart + rowsPerPage);
  }, [groups, pageStart, rowsPerPage]);

  const toggleGroup = useCallback((groupKey) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupKey]: !(prev[groupKey] ?? true)
    }));
  }, []);

  const toggleRow = useCallback((rowKey) => {
    setExpandedRows((prev) => ({
      ...prev,
      [rowKey]: !(prev[rowKey] ?? false)
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

  const allExpanded = groups.length > 0 && groups.every((group) => expandedGroups[group.key] !== false);
  const toggleAll = () => {
    const next = {};
    groups.forEach((group) => {
      next[group.key] = !allExpanded;
    });
    setExpandedGroups(next);
  };

  // Determine which organizational column to display (Division preferred for Analyst context)
  const orgColumnLabel = useMemo(() => {
    if (Array.isArray(data) && data.some(d => d && d.division)) return 'Division';
    if (Array.isArray(data) && data.some(d => d && d.department)) return 'Department';
    return 'Organization';
  }, [data]);

  return (
    <Box>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip label={`Total Cost: ${formatCurrency(totals.cost)}`} color="primary" />
          <Chip label={`Income: ${formatCurrency(totals.income)}`} color="secondary" variant="outlined" />
          <Chip label={`Subsidy: ${formatCurrency(totals.subsidy)}`} color="secondary" variant="outlined" />
        </Box>
        {groups.length > 0 && (
          <Chip
            label={allExpanded ? 'Collapse All' : 'Expand All'}
            onClick={toggleAll}
            variant="outlined"
            sx={{ cursor: 'pointer' }}
          />
        )}
      </Box>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell width={48}></TableCell>
              <TableCell><strong>Title / Particulars</strong></TableCell>
              <TableCell><strong>Subline Item</strong></TableCell>
              <TableCell><strong>Accounting Title</strong></TableCell>
              <TableCell><strong>UACS Code</strong></TableCell>
              <TableCell align="right"><strong>Income</strong></TableCell>
              <TableCell align="right"><strong>Subsidy</strong></TableCell>
              <TableCell align="right"><strong>Total Cost</strong></TableCell>
              <TableCell><strong>{orgColumnLabel}</strong></TableCell>
              <TableCell><strong>Change Status</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {groups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} align="center">
                  <Box sx={{ py: 3, color: 'text.secondary' }}>
                    No capital outlay entries found.
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              paginatedGroups.map((group) => {
                const groupExpanded = expandedGroups[group.key] !== false;
                return (
                  <React.Fragment key={group.key}>
                    <TableRow sx={{ backgroundColor: '#eef2ff' }}>
                      <TableCell>
                        <IconButton size="small" onClick={() => toggleGroup(group.key)}>
                          {groupExpanded ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
                        </IconButton>
                      </TableCell>
                      <TableCell colSpan={4} sx={{ py: 1.5 }}>
                        <Typography variant="subtitle1" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {group.displayName}
                          <Chip label={`${group.items.length} entr${group.items.length === 1 ? 'y' : 'ies'}`} size="small" />
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(group.totals.income)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(group.totals.subsidy)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(group.totals.cost)}</TableCell>
                      <TableCell colSpan={2}>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          {group.counts.added > 0 && <Chip size="small" color="success" label={`+${group.counts.added}`} />}
                          {group.counts.modified > 0 && <Chip size="small" color="warning" label={`~${group.counts.modified}`} />}
                          {group.counts.deleted > 0 && <Chip size="small" color="error" label={`-${group.counts.deleted}`} />}
                        </Box>
                      </TableCell>
                    </TableRow>

                    {groupExpanded && group.items.map(({ item, index }) => {
                      const rowKey = String(item.originalId || item._id || `${group.key}-${index}`);
                      const isExpanded = expandedRows[rowKey] ?? false;
                      const hasDetails = Array.isArray(item.details) && item.details.length > 0;
                      const comparisonDetails = item.comparisonOriginal?.details;
                      const hasComparisonDetails = Array.isArray(comparisonDetails) && comparisonDetails.length > 0;
                      const showToggle = hasDetails || hasComparisonDetails;

                      return (
                        <React.Fragment key={rowKey}>
                          <TableRow>
                            <TableCell>
                              {showToggle ? (
                                <IconButton size="small" onClick={() => toggleRow(rowKey)}>
                                  {isExpanded ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
                                </IconButton>
                              ) : (
                                <IconButton size="small" disabled>
                                  <InfoIcon fontSize="small" color="disabled" />
                                </IconButton>
                              )}
                            </TableCell>
                            {renderComparisonCell(item, 'particulars')}
                            {renderComparisonCell(item, 'sublineItem')}
                            {renderComparisonCell(item, 'accountingTitle')}
                            {renderComparisonCell(item, 'uacsCode')}
                            {renderComparisonCell(item, 'income', { isCurrency: true, align: 'right' })}
                            {renderComparisonCell(item, 'subsidy', { isCurrency: true, align: 'right' })}
                            {renderComparisonCell(item, 'cost', { isCurrency: true, align: 'right' })}
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

                          {showToggle && (
                            <TableRow>
                              <TableCell colSpan={10} sx={{ py: 0, borderBottom: 'none' }}>
                                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                                  <Box sx={{ px: 3, py: 2, backgroundColor: '#fafafa' }}>
                                    <Typography variant="subtitle2" gutterBottom>
                                      Capital Outlay Details
                                    </Typography>
                                    <List dense disablePadding>
                                      {(item.details || []).map((detail, detailIndex) => (
                                        <React.Fragment key={`detail-${detailIndex}`}>
                                          <ListItem sx={{ py: 0.5 }}>
                                            <ListItemText
                                              primary={detail.particulars || '—'}
                                              secondary={`Income: ${formatCurrency(detail.income_amount || 0)} | Subsidy: ${formatCurrency(detail.subsidy_amount || 0)}`}
                                            />
                                          </ListItem>
                                          <Divider component="li" sx={{ my: 0.5 }} />
                                        </React.Fragment>
                                      ))}

                                      {(!item.details || item.details.length === 0) && hasComparisonDetails && (
                                        <ListItem>
                                          <ListItemText
                                            primary="No detailed breakdown in approved version"
                                            secondary="Showing original submission breakdown"
                                          />
                                        </ListItem>
                                      )}

                                      {(comparisonDetails || []).map((detail, detailIndex) => (
                                        <React.Fragment key={`comparison-${detailIndex}`}>
                                          <ListItem sx={{ py: 0.5 }}>
                                            <ListItemText
                                              primary={detail.particulars || '—'}
                                              secondary={`Original Income: ${formatCurrency(detail.income_amount || 0)} | Original Subsidy: ${formatCurrency(detail.subsidy_amount || 0)}`}
                                            />
                                          </ListItem>
                                          <Divider component="li" sx={{ my: 0.5 }} />
                                        </React.Fragment>
                                      ))}
                                    </List>
                                  </Box>
                                </Collapse>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </React.Fragment>
                );
              })
            )}

            {groups.length > 0 && (
              <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                <TableCell></TableCell>
                <TableCell colSpan={3} sx={{ fontWeight: 'bold' }}>Grand Total</TableCell>
                <TableCell></TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(totals.income)}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(totals.subsidy)}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(totals.cost)}</TableCell>
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

export default ComparisonCapitalOutlayTable;