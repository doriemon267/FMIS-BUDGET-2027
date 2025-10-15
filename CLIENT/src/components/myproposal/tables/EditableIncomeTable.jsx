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
  TablePagination,
  Typography
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import RestoreIcon from '@mui/icons-material/Restore';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import { NumericFormat } from 'react-number-format';
import { useUser } from '../../../context/UserContext';

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

const EditableIncomeTable = ({ data = [], onChange }) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [expandedCategories, setExpandedCategories] = useState({});
  const { currentUser } = useUser();

  const canEditAmount = useMemo(() => {
    // Check primary roles
    const rawRoles = currentUser?.Roles;
    const rolesArray = Array.isArray(rawRoles) ? rawRoles : rawRoles ? [rawRoles] : [];

    const normalizedRoles = rolesArray.map((role) => {
      if (typeof role === 'string') {
        return role.toUpperCase();
      }
      if (role && typeof role === 'object') {
        const foundRole = role.roleName || role.name || role.RoleName;
        return foundRole ? String(foundRole).toUpperCase() : '';
      }
      return '';
    });

    const hasRolePermission = normalizedRoles.some((role) =>
      role.includes('BUDGET OFFICER') || role.includes('BUDGET MANAGER') || role.includes('BUDGET COORDINATOR') || role.includes('BUDGET ANALYST')
    );

    // Also check workflow roles for Budget Coordinators (divisionapprover) and Budget Analysts (divisioncreator)
    const workflowRoles = currentUser?.workflowRoles || [];
    const normalizedWorkflowRoles = workflowRoles.map(r => String(r || '').toLowerCase());
    const hasWorkflowPermission = normalizedWorkflowRoles.some(role => 
      role === 'divisionapprover' || role === 'divisioncreator' || role === 'officeconsolidator' || role === 'departmentconsolidator'
    );

    return hasRolePermission || hasWorkflowPermission;
  }, [currentUser]);

  // Initialize changeType for data items that don't have it
  useEffect(() => {
    const needsInitialization = data.some(item => !item.changeType);
    if (needsInitialization) {
      const initializedData = data.map(item => ({
        ...item,
        changeType: item.changeType || 'unchanged'
      }));
      onChange(initializedData);
    }
  }, [data, onChange]);

  const groupedData = useMemo(() => {
    const groups = {};
    data.forEach((item, index) => {
      const category = item.category || 'No category';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push({ ...item, originalIndex: index });
    });
    return groups;
  }, [data]);

  useEffect(() => {
    setExpandedCategories((prev) => {
      const next = { ...prev };
      let changed = false;

      Object.keys(groupedData).forEach((category) => {
        if (!(category in next)) {
          next[category] = true;
          changed = true;
        }
      });

      Object.keys(next).forEach((category) => {
        if (!groupedData[category]) {
          delete next[category];
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [groupedData]);

  const totalCount = useMemo(() => {
    return Object.entries(groupedData).reduce((count, [category, items]) => {
      const isExpanded = expandedCategories[category] !== false;
      return count + 1 + (isExpanded ? items.length : 0);
    }, 0);
  }, [groupedData, expandedCategories]);

  const pageStart = rowsPerPage === -1 ? 0 : page * rowsPerPage;

  useEffect(() => {
    if (rowsPerPage === -1) {
      if (page !== 0) {
        setPage(0);
      }
      return;
    }
    const maxPage = totalCount === 0 ? 0 : Math.max(0, Math.ceil(totalCount / rowsPerPage) - 1);
    if (page > maxPage) {
      setPage(maxPage);
    }
  }, [page, rowsPerPage, totalCount]);

  const handleFieldChange = (index, field, value) => {
    const newData = [...data];
    const target = newData[index] || {};
    const hasOriginalReference = Boolean(target.originalId || target._id || target.original?._id);
    const nextChangeType = hasOriginalReference ? 'modified' : 'added';
    const previousChangeType = target.changeType;
    const resolvedChangeType = previousChangeType === 'added' && !hasOriginalReference
      ? 'added'
      : nextChangeType;

    newData[index] = {
      ...target,
      [field]: value,
      changeType: resolvedChangeType
    };
    onChange(newData);
  };

  const handleAmountChange = (index, value) => {
    const numValue = parseFloat(value) || 0;
    handleFieldChange(index, 'amount', numValue);
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

  const handleDelete = (index) => {
    const newData = [...data];
    if (newData[index].originalId) {
      // Mark as deleted instead of removing
      newData[index] = {
        ...newData[index],
        changeType: 'deleted'
      };
    } else {
      // Remove if it's a new entry
      newData.splice(index, 1);
    }
    onChange(newData);
  };

  const handleRestore = (index) => {
    const newData = [...data];
    newData[index] = {
      ...newData[index],
      changeType: 'unchanged'
    };
    onChange(newData);
  };

  const handleAddRow = () => {
    const newRow = {
      source: '',
      category: '',
      subCategory: '',
      description: '',
      amount: 0,
      department: '',
      changeType: 'added'
    };
    onChange([...data, newRow]);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount || 0);
  };

  const getRowStyle = (item) => {
    if (item.changeType === 'deleted') {
      return { backgroundColor: '#ffebee', textDecoration: 'line-through', opacity: 0.6 };
    }
    if (item.changeType === 'added') {
      return { backgroundColor: '#e8f5e9' };
    }
    if (item.changeType === 'modified') {
      return { backgroundColor: '#fff3e0' };
    }
    return {};
  };

  const getGroupedPaginatedData = useMemo(() => {
    // Flatten grouped data for pagination
    const flattenedData = [];
    Object.entries(groupedData).forEach(([category, items]) => {
      const isExpanded = expandedCategories[category] !== false;
      flattenedData.push({ type: 'category', category, items, expanded: isExpanded });
      if (isExpanded) {
        items.forEach(item => {
          flattenedData.push({ type: 'item', category, item });
        });
      }
    });

    if (rowsPerPage === -1) {
      return flattenedData;
    }
    return flattenedData.slice(pageStart, pageStart + rowsPerPage);
  }, [groupedData, pageStart, rowsPerPage]);

  const toggleCategory = (category) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !(prev[category] !== false)
    }));
  };

  return (
    <Box>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Chip label={`Total: ${formatCurrency(data.reduce((sum, item) => sum + (item.changeType !== 'deleted' ? (item.amount || 0) : 0), 0))}`} color="primary" />
        </Box>
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={handleAddRow}
        >
          Add Income Entry
        </Button>
      </Box>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell><strong>CATEGORIES</strong></TableCell>
              <TableCell><strong>SUB-CATEGORIES</strong></TableCell>
              <TableCell align="right"><strong>AMOUNT</strong></TableCell>
              <TableCell><strong>STATUS</strong></TableCell>
              <TableCell align="center"><strong>ACTION</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {Object.keys(groupedData).length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Box sx={{ py: 3, color: 'text.secondary' }}>
                    No income entries. Click "Add Income Entry" to create one.
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              getGroupedPaginatedData.map((rowData) => {
                if (rowData.type === 'category') {
                  // Category Header Row
                  return (
                    <TableRow key={`category-${rowData.category}`} sx={{ backgroundColor: 'grey.100', '&:hover': { backgroundColor: 'grey.200' } }}>
                      <TableCell sx={{ fontWeight: 'bold', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 1 }}>
                        <IconButton
                          size="small"
                          onClick={() => toggleCategory(rowData.category)}
                          aria-label={rowData.expanded ? 'Collapse category' : 'Expand category'}
                        >
                          {rowData.expanded ? <KeyboardArrowDownIcon /> : <KeyboardArrowRightIcon />}
                        </IconButton>
                        <Box component="span">{rowData.category}</Box>
                      </TableCell>
                      <TableCell></TableCell>
                      <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>
                        {formatCurrency(rowData.items.reduce((sum, item) => sum + (item.changeType !== 'deleted' ? (item.amount || 0) : 0), 0))}
                      </TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  );
                } else {
                  // Sub-category Item Row
                  const item = rowData.item;
                  return (
                    <TableRow key={item.originalIndex} sx={getRowStyle(item)}>
                      <TableCell></TableCell>
                      <TableCell sx={{ pl: 4 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {item.subcategory || item.subCategory || 'No sub-category'}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ textAlign: 'right', paddingRight: 2 }}>
                        {canEditAmount ? (
                          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <TextField
                              value={item.amount || 0}
                              onChange={(e) => handleAmountChange(item.originalIndex, e.target.value)}
                              size="small"
                              variant="outlined"
                              disabled={item.changeType === 'deleted'}
                              InputProps={{ inputComponent: NumericFormatInput }}
                              inputProps={{ name: 'amount' }}
                              sx={{
                                width: '120px',
                                '& .MuiInputBase-root': { textAlign: 'right' },
                                '& .MuiInputBase-input': { textAlign: 'right' }
                              }}
                            />
                          </Box>
                        ) : (
                          <Typography variant="body2" sx={{ fontWeight: 500, textAlign: 'right' }}>
                            {formatCurrency(item.amount || 0)}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.changeType === 'added' && <Chip label="Added" size="small" color="success" />}
                        {item.changeType === 'modified' && <Chip label="Modified" size="small" color="warning" />}
                        {item.changeType === 'deleted' && <Chip label="Deleted" size="small" color="error" />}
                        {item.changeType === 'unchanged' && <Chip label="Unchanged" size="small" />}
                      </TableCell>
                      <TableCell align="center">
                        {item.changeType === 'deleted' ? (
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleRestore(item.originalIndex)}
                            title="Restore"
                          >
                            <RestoreIcon />
                          </IconButton>
                        ) : (
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDelete(item.originalIndex)}
                            title="Delete"
                          >
                            <DeleteIcon />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                }
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {totalCount > 0 && (
        <TablePagination
          component="div"
          count={totalCount}
          page={rowsPerPage === -1 ? 0 : page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[5, 10, 25, { value: -1, label: 'All' }]}
          labelRowsPerPage="Rows per page"
          showFirstButton
          showLastButton
        />
      )}
    </Box>
  );
};

export default EditableIncomeTable;