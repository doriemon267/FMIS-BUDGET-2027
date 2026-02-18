import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { displayUacs, getIndentLevelFromSubline } from '../../../utils/uacsDisplayHelper';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  IconButton,
  Chip,
  Box,
  Button,
  Tooltip,
  Typography,
  TablePagination
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import RestoreIcon from '@mui/icons-material/Restore';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { preventNegativeNumericKey, toNonNegativeNumber } from '../../../utils/preventNegativeInput';

const EditableMOOETable = ({ data, onChange }) => {
  const [expandedGroups, setExpandedGroups] = useState({});
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    setExpandedGroups((prev) => {
      const next = { ...prev };
      let changed = false;
      const currentKeys = new Set();

      (data || []).forEach((item) => {
        const key = (item?.sublineItem && item.sublineItem.trim()) || 'UNCATEGORIZED';
        currentKeys.add(key);
        if (typeof next[key] !== 'boolean') {
          next[key] = true;
          changed = true;
        }
      });

      Object.keys(next).forEach((key) => {
        if (!currentKeys.has(key)) {
          delete next[key];
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [data]);

  const groupedData = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return [];

    const map = new Map();
    data.forEach((item, index) => {
      const key = (item?.sublineItem && item.sublineItem.trim()) || 'UNCATEGORIZED';
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push({ item, index });
    });

    return Array.from(map.entries())
      .map(([key, entries]) => {
        const totals = entries.reduce(
          (acc, { item }) => {
            if (item.changeType === 'deleted') {
              return acc;
            }
            const income = Number(item.income || 0);
            const subsidy = Number(item.subsidy || 0);
            const amount = item.amount != null ? Number(item.amount) : income + subsidy;
            acc.income += income;
            acc.subsidy += subsidy;
            acc.amount += amount;
            return acc;
          },
          { income: 0, subsidy: 0, amount: 0 }
        );

        return {
          key,
          entries,
          totals,
        };
      })
      .sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true, sensitivity: 'base' }));
  }, [data]);

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

  const tableTotals = useMemo(() => {
    return groupedData.reduce(
      (acc, group) => {
        acc.income += group.totals.income;
        acc.subsidy += group.totals.subsidy;
        acc.amount += group.totals.amount;
        return acc;
      },
      { income: 0, subsidy: 0, amount: 0 }
    );
  }, [groupedData]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount || 0);
  };

  const formatNumber = (value) => {
    if (!value && value !== 0) return '';
    const num = Number(value);
    if (!Number.isFinite(num)) return '';
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const getRowStyle = (changeType) => {
    if (changeType === 'deleted') return { backgroundColor: '#ffebee', textDecoration: 'line-through', opacity: 0.6 };
    if (changeType === 'added') return { backgroundColor: '#e8f5e9' };
    if (changeType === 'modified') return { backgroundColor: '#fff3e0' };
    return {};
  };

  const handleFieldChange = (index, field, value) => {
    const newData = [...data];
    const target = { ...newData[index] };
    const numericFields = ['income', 'subsidy'];

    if (numericFields.includes(field)) {
      const numericValue = Number(value || 0);
      target[field] = numericValue;
      const income = field === 'income' ? numericValue : Number(target.income || 0);
      const subsidy = field === 'subsidy' ? numericValue : Number(target.subsidy || 0);
      target.amount = income + subsidy;
    } else {
      target[field] = value;
    }

    const hasOriginal = Boolean(target.originalId || target._id);
    target.changeType = hasOriginal ? 'modified' : 'added';

    newData[index] = target;
    if (onChange) onChange(newData);
  };

  const handleDelete = (index) => {
    const newData = [...data];
    const record = newData[index];
    if (record.originalId || record._id) {
      newData[index] = { ...record, changeType: 'deleted' };
    } else {
      newData.splice(index, 1);
    }
    if (onChange) onChange(newData);
  };

  const handleRestore = (index) => {
    const newData = [...data];
    const record = newData[index];
    newData[index] = { ...record, changeType: 'unchanged' };
    if (onChange) onChange(newData);
  };

  const toggleGroup = (groupKey) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupKey]: !(prev[groupKey] ?? true)
    }));
  };

  const expandAll = () => {
    const next = {};
    groupedData.forEach((group) => {
      next[group.key] = true;
    });
    setExpandedGroups(next);
  };

  const collapseAll = () => {
    const next = {};
    groupedData.forEach((group) => {
      next[group.key] = false;
    });
    setExpandedGroups(next);
  };

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
  const toggleAllLabel = allExpanded ? 'Collapse All' : 'Expand All';

  return (
    <Box>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            label={`Total Amount: ${formatCurrency(tableTotals.amount)}`}
            color="primary"
          />
          <Chip
            label={`Income: ${formatCurrency(tableTotals.income)}`}
            color="secondary"
            variant="outlined"
          />
          <Chip
            label={`Subsidy: ${formatCurrency(tableTotals.subsidy)}`}
            color="secondary"
            variant="outlined"
          />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title="Only Income and Subsidy fields are editable">
            <Chip label="Edit: Income & Subsidy" size="small" color="info" variant="outlined" />
          </Tooltip>
          <Button
            variant="outlined"
            size="small"
            onClick={allExpanded ? collapseAll : expandAll}
          >
            {toggleAllLabel}
          </Button>
        </Box>
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
              <TableCell><strong>Status</strong></TableCell>
              {onChange && <TableCell align="center"><strong>Actions</strong></TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {groupedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={onChange ? 9 : 8} align="center">
                  <Box sx={{ py: 3, color: 'text.secondary' }}>
                    No MOOE entries available.
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              paginatedGroups.map((group) => {
                const displayLabel = group.key === 'UNCATEGORIZED' ? 'Uncategorized' : group.key;
                const isExpanded = expandedGroups[group.key] !== false;
                const indentLevelGroup = getIndentLevelFromSubline(group.key);
                return (
                  <React.Fragment key={group.key}>
                    <TableRow sx={{ backgroundColor: '#eef2ff' }}>
                      <TableCell>
                        <IconButton size="small" onClick={() => toggleGroup(group.key)}>
                          {isExpanded ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
                        </IconButton>
                      </TableCell>
                      <TableCell colSpan={2} sx={{ fontWeight: 600 }}>
                        {displayLabel}
                        <Chip
                          label={`${group.entries.length} item${group.entries.length > 1 ? 's' : ''}`}
                          size="small"
                          sx={{ ml: 1 }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                        Group Totals
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(group.totals.income)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(group.totals.subsidy)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(group.totals.amount)}</TableCell>
                      <TableCell colSpan={2}></TableCell>
                    </TableRow>

                    {isExpanded && group.entries.map(({ item, index }) => {
                      const changeType = item.changeType || 'unchanged';
                      const amount = item.amount != null ? Number(item.amount) : Number(item.income || 0) + Number(item.subsidy || 0);
                      // Determine indent level per item using sublineItem/accountingTitle so nested "Other" variants indent
                      const indentLevel = getIndentLevelFromSubline(item.sublineItem || item.accountingTitle || group.key, item.uacsCode);
                      return (
                        <TableRow key={`${group.key}-${index}`} sx={getRowStyle(changeType)}>
                          <TableCell></TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {displayLabel}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ pl: indentLevel * 3 }}>
                            <Typography variant="body2" sx={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
                              {item.accountingTitle || '—'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                              {displayUacs(item.uacsCode, item.sublineItem)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right" sx={{ maxWidth: 140 }}>
                            {onChange ? (
                              <TextField
                                type="text"
                                value={formatNumber(item.income || 0)}
                                onKeyDown={preventNegativeNumericKey}
                                onChange={(e) => {
                                  const numValue = toNonNegativeNumber(e.target.value);
                                  handleFieldChange(index, 'income', numValue);
                                }}
                                size="small"
                                fullWidth
                                disabled={changeType === 'deleted'}
                                inputProps={{ step: 0.01, min: 0 }}
                                sx={{ '& .MuiInputBase-input': { textAlign: 'right' } }}
                              />
                            ) : (
                              <Typography variant="body2" sx={{ textAlign: 'right', fontWeight: 500 }}>
                                {formatCurrency(item.income || 0)}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="right" sx={{ maxWidth: 140 }}>
                            {onChange ? (
                              <TextField
                                type="text"
                                value={formatNumber(item.subsidy || 0)}
                                onKeyDown={preventNegativeNumericKey}
                                onChange={(e) => {
                                  const numValue = toNonNegativeNumber(e.target.value);
                                  handleFieldChange(index, 'subsidy', numValue);
                                }}
                                size="small"
                                fullWidth
                                disabled={changeType === 'deleted'}
                                inputProps={{ step: 0.01, min: 0 }}
                                sx={{ '& .MuiInputBase-input': { textAlign: 'right' } }}
                              />
                            ) : (
                              <Typography variant="body2" sx={{ textAlign: 'right', fontWeight: 500 }}>
                                {formatCurrency(item.subsidy || 0)}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                              {formatCurrency(amount)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {changeType === 'added' && <Chip label="Added" size="small" color="success" />}
                            {changeType === 'modified' && <Chip label="Modified" size="small" color="warning" />}
                            {changeType === 'deleted' && <Chip label="Deleted" size="small" color="error" />}
                            {changeType === 'unchanged' && <Chip label="Unchanged" size="small" />}
                          </TableCell>
                          {onChange && (
                            <TableCell align="center">
                              {changeType === 'deleted' ? (
                                <IconButton size="small" color="primary" onClick={() => handleRestore(index)}>
                                  <RestoreIcon fontSize="small" />
                                </IconButton>
                              ) : (
                                <IconButton size="small" color="error" onClick={() => handleDelete(index)}>
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              )}
                            </TableCell>
                          )}
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

export default EditableMOOETable;