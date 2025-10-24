import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  Typography,
  Collapse,
  List,
  ListItem,
  ListItemText,
  Divider,
  TablePagination
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import RestoreIcon from '@mui/icons-material/Restore';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { NumericFormat } from 'react-number-format';

const NumericFormatInput = React.forwardRef(function NumericFormatInput(props, ref) {
  const { onChange, name, ...other } = props;

  return (
    <NumericFormat
      {...other}
      getInputRef={ref}
      thousandSeparator
      decimalScale={2}
      fixedDecimalScale
      allowNegative={false}
      onValueChange={(values) => {
        onChange({
          target: {
            name,
            value: values.value
          }
        });
      }}
    />
  );
});

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

const normalizeTitle = (title) => {
  if (!title) return 'untitled';
  return title.trim().toLowerCase();
};

const EditableCapitalOutlayTable = ({ data = [], onChange }) => {
  const [expandedRows, setExpandedRows] = useState({});
  const [expandedGroups, setExpandedGroups] = useState({});
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  useEffect(() => {
    setExpandedRows((prev) => {
      const next = { ...prev };
      let changed = false;
      const keys = new Set();

      data.forEach((item, index) => {
        const rowKey = String(item?.originalId || item?._id || index);
        keys.add(rowKey);
        if (typeof next[rowKey] !== 'boolean') {
          next[rowKey] = false;
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
  }, [data]);

  const groups = useMemo(() => {
    const groupMap = new Map();

    data.forEach((item, index) => {
      const displayName = getTitleDisplay(item);
      const key = normalizeTitle(displayName);

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          key,
          displayName,
          items: [],
          totals: { income: 0, subsidy: 0, cost: 0 }
        });
      }

      const group = groupMap.get(key);
      if (displayName && !group.displayName) {
        group.displayName = displayName;
      }

      group.items.push({ item, index });

      if (item.changeType !== 'deleted') {
        const income = Number(item.income || 0);
        const subsidy = Number(item.subsidy || 0);
        const cost = item.cost != null ? Number(item.cost) : income + subsidy;
        group.totals.income += income;
        group.totals.subsidy += subsidy;
        group.totals.cost += cost;
      }
    });

    return Array.from(groupMap.values());
  }, [data]);

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

  const paginatedGroups = useMemo(() => {
    if (rowsPerPage === -1) {
      return groups;
    }
    return groups.slice(pageStart, pageStart + rowsPerPage);
  }, [groups, pageStart, rowsPerPage]);

  const decimalFormatter = useMemo(() => new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }), []);

  const formatAmount = useCallback((amount) => decimalFormatter.format(Number(amount) || 0), [decimalFormatter]);

  const formatCurrency = useCallback((amount) => `₱${formatAmount(amount)}`, [formatAmount]);

  const getRowStyle = (changeType) => {
    if (changeType === 'deleted') return { backgroundColor: '#ffebee', textDecoration: 'line-through', opacity: 0.6 };
    if (changeType === 'added') return { backgroundColor: '#e8f5e9' };
    if (changeType === 'modified') return { backgroundColor: '#fff3e0' };
    return {};
  };

  const snapshotRecord = (record) => ({
    particulars: record.particulars,
    income: record.income,
    subsidy: record.subsidy,
    cost: record.cost,
    categoryName: record.categoryName,
    sublineItem: record.sublineItem,
    accountingTitle: record.accountingTitle,
    uacsCode: record.uacsCode
  });

  const handleFieldChange = (index, field, value) => {
    const newData = [...data];
    const previous = newData[index];
    const updated = { ...previous };

    if (['income', 'subsidy', 'cost'].includes(field)) {
      const numericValue = Number(value || 0);
      updated[field] = numericValue;
      const income = field === 'income' ? numericValue : Number(updated.income || 0);
      const subsidy = field === 'subsidy' ? numericValue : Number(updated.subsidy || 0);
      updated.cost = income + subsidy;
    } else {
      updated[field] = value;
    }

    const hasOriginal = Boolean(updated.originalId || updated._id);
    const previousChange = previous.changeType || 'unchanged';
    updated.changeType = hasOriginal ? 'modified' : 'added';

    if (hasOriginal && updated.changeType === 'modified' && previousChange !== 'modified' && !updated.original) {
      updated.original = previous.original || snapshotRecord(previous);
    }

    newData[index] = updated;
    if (onChange) onChange(newData);
  };

  const handleDelete = (index) => {
    const newData = [...data];
    const record = newData[index];
    if (record.originalId || record._id) {
      const updated = {
        ...record,
        changeType: 'deleted',
        original: record.original || snapshotRecord(record)
      };
      newData[index] = updated;
    } else {
      newData.splice(index, 1);
    }
    if (onChange) onChange(newData);
  };

  const handleRestore = (index) => {
    const newData = [...data];
    const record = newData[index];

    if (record.original) {
      const restored = {
        ...record,
        ...record.original,
        changeType: 'unchanged'
      };
      delete restored.original;
      newData[index] = restored;
    } else {
      newData[index] = { ...record, changeType: 'unchanged' };
    }

    if (onChange) onChange(newData);
  };

  const handleAddRow = () => {
    const newRow = {
      categoryName: '',
      sublineItem: '',
      accountingTitle: '',
      uacsCode: '',
      particulars: '',
      income: 0,
      subsidy: 0,
      cost: 0,
      details: [],
      changeType: 'added'
    };
    if (onChange) onChange([...(data || []), newRow]);
  };

  const toggleRow = (key) => {
    setExpandedRows((prev) => ({
      ...prev,
      [key]: !(prev[key] ?? false)
    }));
  };

  const toggleGroup = useCallback((key) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [key]: !(prev[key] ?? true)
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

  const totals = useMemo(() => {
    return (data || []).reduce(
      (acc, item) => {
        if (item.changeType === 'deleted') return acc;
        const income = Number(item.income || 0);
        const subsidy = Number(item.subsidy || 0);
        const cost = item.cost != null ? Number(item.cost) : income + subsidy;
        acc.income += income;
        acc.subsidy += subsidy;
        acc.cost += cost;
        return acc;
      },
      { income: 0, subsidy: 0, cost: 0 }
    );
  }, [data]);

  return (
    <Box>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip label={`Total Cost: ${formatCurrency(totals.cost)}`} color="primary" />
          <Chip label={`Income: ${formatCurrency(totals.income)}`} color="secondary" variant="outlined" />
          <Chip label={`Subsidy: ${formatCurrency(totals.subsidy)}`} color="secondary" variant="outlined" />
        </Box>
        {onChange && (
          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={handleAddRow}>
            Add Capital Outlay Entry
          </Button>
        )}
      </Box>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell width={48}></TableCell>
              <TableCell><strong>Title</strong></TableCell>
              <TableCell><strong>Subline Item</strong></TableCell>
              <TableCell><strong>Accounting Title</strong></TableCell>
              <TableCell><strong>UACS Code</strong></TableCell>
              <TableCell align="right"><strong>Income</strong></TableCell>
              <TableCell align="right"><strong>Subsidy</strong></TableCell>
              <TableCell align="right"><strong>Total</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              {onChange && <TableCell align="center"><strong>Actions</strong></TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {(!groups || groups.length === 0) ? (
              <TableRow>
                <TableCell colSpan={onChange ? 10 : 9} align="center">
                  <Box sx={{ py: 3, color: 'text.secondary' }}>
                    No capital outlay entries{onChange ? '. Click "Add Capital Outlay Entry" to create one.' : '.'}
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              paginatedGroups.map((group) => {
                const groupKey = group.key;
                const groupExpanded = expandedGroups[groupKey] ?? true;

                return (
                  <React.Fragment key={groupKey}>
                    <TableRow sx={{ backgroundColor: '#eef2ff' }}>
                      <TableCell>
                        <IconButton size="small" onClick={() => toggleGroup(groupKey)}>
                          {groupExpanded ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
                        </IconButton>
                      </TableCell>
                      <TableCell colSpan={4} sx={{ py: 1.5 }}>
                        <Typography variant="subtitle1" fontWeight={600}>
                          {group.displayName || 'Untitled Title'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {group.items.length} entr{group.items.length === 1 ? 'y' : 'ies'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={600}>{formatAmount(group.totals.income)}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={600}>{formatAmount(group.totals.subsidy)}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={700}>{formatAmount(group.totals.cost)}</Typography>
                      </TableCell>
                      <TableCell colSpan={2} />
                    </TableRow>
                    {groupExpanded && group.items.map(({ item, index }) => {
                      const changeType = item.changeType || 'unchanged';
                      const rowKey = String(item.originalId || item._id || index);
                      const isExpanded = expandedRows[rowKey] ?? false;
                      const isNewRecord = !item.originalId && !item._id;
                      const isDeleted = changeType === 'deleted';
                      const totalCost = item.cost != null ? Number(item.cost) : Number(item.income || 0) + Number(item.subsidy || 0);

                      const renderMetaCell = (field, value, placeholder) => {
                        if (onChange && isNewRecord && !isDeleted) {
                          return (
                            <TextField
                              value={value || ''}
                              onChange={(e) => handleFieldChange(index, field, e.target.value)}
                              size="small"
                              fullWidth
                              placeholder={placeholder}
                            />
                          );
                        }
                        return (
                          <Typography
                            variant="body2"
                            sx={{ whiteSpace: 'normal', wordBreak: 'break-word', color: 'text.secondary' }}
                          >
                            {value || '—'}
                          </Typography>
                        );
                      };

                      return (
                        <React.Fragment key={rowKey}>
                          <TableRow sx={getRowStyle(changeType)}>
                            <TableCell>
                              <IconButton size="small" onClick={() => toggleRow(rowKey)}>
                                {isExpanded ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
                              </IconButton>
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, pl: 4 }}>
                              {renderMetaCell('categoryName', getTitleDisplay(item), 'Title')}
                            </TableCell>
                            <TableCell>{renderMetaCell('sublineItem', item.sublineItem, 'Subline Item')}</TableCell>
                            <TableCell>{renderMetaCell('accountingTitle', item.accountingTitle, 'Accounting Title')}</TableCell>
                            <TableCell>{renderMetaCell('uacsCode', item.uacsCode, 'UACS Code')}</TableCell>
                            <TableCell align="right" sx={{ maxWidth: 140 }}>
                              {onChange ? (
                                <TextField
                                  value={item.income ?? 0}
                                  onChange={(e) => handleFieldChange(index, 'income', e.target.value)}
                                  size="small"
                                  fullWidth
                                  disabled={isDeleted}
                                  InputProps={{ inputComponent: NumericFormatInput }}
                                  inputProps={{ name: 'income' }}
                                  sx={{ '& .MuiInputBase-input': { textAlign: 'right' } }}
                                />
                              ) : (
                                <Typography variant="body2" sx={{ textAlign: 'right', fontWeight: 500 }}>
                                  {formatAmount(item.income ?? 0)}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell align="right" sx={{ maxWidth: 140 }}>
                              {onChange ? (
                                <TextField
                                  value={item.subsidy ?? 0}
                                  onChange={(e) => handleFieldChange(index, 'subsidy', e.target.value)}
                                  size="small"
                                  fullWidth
                                  disabled={isDeleted}
                                  InputProps={{ inputComponent: NumericFormatInput }}
                                  inputProps={{ name: 'subsidy' }}
                                  sx={{ '& .MuiInputBase-input': { textAlign: 'right' } }}
                                />
                              ) : (
                                <Typography variant="body2" sx={{ textAlign: 'right', fontWeight: 500 }}>
                                  {formatAmount(item.subsidy ?? 0)}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                {formatAmount(totalCost)}
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
                          <TableRow>
                            <TableCell colSpan={onChange ? 10 : 9} sx={{ py: 0, borderBottom: '1px solid', borderColor: 'divider' }}>
                              <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                                <Box sx={{ p: 2, backgroundColor: '#f9fafb' }}>
                                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 2 }}>
                                    <Box>
                                      <Typography variant="subtitle2" gutterBottom>Particulars</Typography>
                                      {onChange ? (
                                        <TextField
                                          value={item.particulars || ''}
                                          onChange={(e) => handleFieldChange(index, 'particulars', e.target.value)}
                                          size="small"
                                          fullWidth
                                          multiline
                                          minRows={3}
                                          disabled={isDeleted}
                                          placeholder="Describe the particulars for this capital outlay item"
                                        />
                                      ) : (
                                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: 'text.secondary' }}>
                                          {item.particulars || 'No particulars provided'}
                                        </Typography>
                                      )}
                                    </Box>
                                    <Box>
                                      <Typography variant="subtitle2" gutterBottom>Computed Totals</Typography>
                                      <Typography variant="body2" color="text.secondary">Income: {formatCurrency(item.income || 0)}</Typography>
                                      <Typography variant="body2" color="text.secondary">Subsidy: {formatCurrency(item.subsidy || 0)}</Typography>
                                      <Typography variant="body2" color="text.secondary">Total Cost: {formatCurrency(totalCost)}</Typography>
                                      {item.details?.length ? (
                                        <Chip label={`${item.details.length} detail${item.details.length > 1 ? 's' : ''}`} size="small" sx={{ mt: 1 }} />
                                      ) : null}
                                    </Box>
                                  </Box>
                                  <Divider sx={{ my: 2 }} />
                                  <Typography variant="subtitle2" gutterBottom>Detailed Breakdown</Typography>
                                  {item.details && item.details.length > 0 ? (
                                    <List dense disablePadding>
                                      {item.details.map((detail, detailIdx) => (
                                        <ListItem key={`${rowKey}-detail-${detailIdx}`} disableGutters sx={{ alignItems: 'flex-start' }}>
                                          <ListItemText
                                            primary={detail.particulars || '—'}
                                            secondary={`Income: ${formatCurrency(detail.income_amount || 0)} • Subsidy: ${formatCurrency(detail.subsidy_amount || 0)}`}
                                            primaryTypographyProps={{ variant: 'body2', sx: { whiteSpace: 'normal', wordBreak: 'break-word' } }}
                                            secondaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                                          />
                                        </ListItem>
                                      ))}
                                    </List>
                                  ) : (
                                    <Typography variant="caption" color="text.secondary">
                                      No detailed records linked to this capital outlay entry.
                                    </Typography>
                                  )}
                                </Box>
                              </Collapse>
                            </TableCell>
                          </TableRow>
                        </React.Fragment>
                      );
                    })}
                  </React.Fragment>
                );
              })
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
          rowsPerPageOptions={[3, 5, 10, { value: -1, label: 'All' }]}
          labelRowsPerPage="Groups per page"
          showFirstButton
          showLastButton
        />
      )}
    </Box>
  );
};

export default EditableCapitalOutlayTable;