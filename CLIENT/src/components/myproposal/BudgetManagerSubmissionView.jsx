import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  Collapse,
  IconButton,
  Paper,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableFooter,
  Typography
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';

// Helper to resolve Capital Outlay category to a friendly name
const isObjectIdLike = (val) => typeof val === 'string' && /^[a-f0-9]{24}$/i.test(val.trim());
const resolveCapitalOutlayCategory = (item) => {
  if (!item) return 'Uncategorized';
  // Populated object
  if (item.category && typeof item.category === 'object') {
    return item.category.categoryName || item.category.name || item.category.title || 'Uncategorized';
  }
  // Named fields commonly used
  const named = item.categoryName || item.category_label || item.categoryTitle || item.categoryText;
  if (named && String(named).trim()) return String(named).trim();
  // Raw category string that is not an ObjectId
  if (item.category && typeof item.category === 'string' && !isObjectIdLike(item.category) && item.category.trim()) {
    return item.category.trim();
  }
  // Fallbacks to other descriptive fields
  if (item.accountingTitle) return String(item.accountingTitle);
  if (item.particulars) return String(item.particulars);
  if (item.uacsCode) return String(item.uacsCode);
  return 'Uncategorized';
};

// Resolve a human-friendly particulars/description text
const resolveParticulars = (item, tabKey) => {
  const base = item.particulars || item.Particulars || item.description || item.itemDescription || item.uacsDescription || item.sublineItem || item.subLineItem || item.subline || '';
  if (base && String(base).trim()) return String(base).trim();
  // For Capital Outlay, sometimes particulars live inside details[]
  if (tabKey === 'capitalOutlay' && Array.isArray(item.details) && item.details.length) {
    const parts = item.details
      .map(d => d?.particulars || d?.description || d?.itemDescription || d?.uacsDescription || d?.Subline || d?.sublineItem || d?.subLineItem || d?.name || d?.title)
      .filter(Boolean)
      .map(String);
    if (parts.length) return parts.join(' / ');
  }
  return '—';
};

const formatCurrency = (raw) => {
  const value = Number(raw ?? 0);
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP'
  }).format(Number.isFinite(value) ? value : 0);
};

const safeArray = (maybeArray) => (Array.isArray(maybeArray) ? maybeArray : []);

const buildSummaryChip = (label, amount) => (
  <Chip
    key={label}
    label={`${label}: ${formatCurrency(amount)}`}
    size="small"
    color="primary"
    variant="outlined"
    sx={{ fontWeight: 600 }}
  />
);

const buildColumn = (label, accessor, options = {}) => ({
  label,
  accessor,
  align: options.align || 'left',
  isCurrency: options.isCurrency || false
});

const deriveIncomeColumns = () => ([
  buildColumn('Category', (item) => (
    item.category || item.categoryName || item.Category || '—'
  )),
  buildColumn('Sub-Category', (item) => (
    item.subCategory || item.subcategory || item['sub-category'] || item.subCategoryName || '—'
  )),
  buildColumn('Department / Office', (item) => (
    item.department || item.office || item.processBy || '—'
  )),
  buildColumn('Submitted Amount', (item) => (
    item.amount ?? item.Amount ?? item.totalAmount ?? 0
  ), { align: 'right', isCurrency: true })
]);

const derivePersonnelColumns = () => ([
  buildColumn('Employee Name', (item) => (
    item.employeeFullName || item.fullName || item.EmployeeName || '—'
  )),
  buildColumn('Position', (item) => (
    item.positionTitle || item.Position || '—'
  )),
  buildColumn('Appointment Status', (item) => (
    item.statusOfAppointment || item.appointmentStatus || '—'
  )),
  buildColumn('Monthly Salary', (item) => (
    item.monthlySalary ?? item.MonthlySalary ?? 0
  ), { align: 'right', isCurrency: true }),
  buildColumn('Annual Salary', (item) => (
    item.annualSalary ?? item.AnnualSalary ?? 0
  ), { align: 'right', isCurrency: true }),
  buildColumn('Total Compensation', (item) => (
    item.Total ?? item.totalCompensation ?? 0
  ), { align: 'right', isCurrency: true })
]);

const deriveMooeColumns = () => ([
  buildColumn('Category', (item) => (
    item.accountingTitle || item.category || item.categoryName || '—'
  )),
  buildColumn('Sub-line Item', (item) => resolveParticulars(item, 'mooe')),
  buildColumn('UACS Code', (item) => (
    item.uacsCode || item.UACS || item.uacs || '—'
  )),
  buildColumn('Income', (item) => (
    item.income ?? 0
  ), { align: 'right', isCurrency: true }),
  buildColumn('Subsidy', (item) => (
    item.subsidy ?? 0
  ), { align: 'right', isCurrency: true }),
  buildColumn('Total Amount', (item) => (
    (item.income ?? 0) + (item.subsidy ?? 0)
  ), { align: 'right', isCurrency: true })
]);

const deriveCapitalOutlayColumns = () => ([
  buildColumn('Category', (item) => resolveCapitalOutlayCategory(item)),
  buildColumn('Particulars', (item) => resolveParticulars(item, 'capitalOutlay')),
  buildColumn('Income', (item) => (
    item.income ?? 0
  ), { align: 'right', isCurrency: true }),
  buildColumn('Subsidy', (item) => (
    item.subsidy ?? 0
  ), { align: 'right', isCurrency: true }),
  buildColumn('Total Cost', (item) => (
    (item.income ?? 0) + (item.subsidy ?? 0)
  ), { align: 'right', isCurrency: true })
]);

const computeTotal = (entries, getter) => entries.reduce((sum, item) => {
  const value = Number(getter(item) ?? 0);
  return sum + (Number.isFinite(value) ? value : 0);
}, 0);

// Group items by category
const groupByCategory = (items, tabKey) => {
  if (tabKey === 'personnelServices') {
    // Personnel Services should not be grouped
    return items.map(item => ({ category: null, items: [item] }));
  }

  const groups = {};
  items.forEach(item => {
    let category;
    
    if (tabKey === 'mooe') {
      // For MOOE, use accountingTitle as category
      category = item.accountingTitle || item.category || item.categoryName || 'Uncategorized';
    } else if (tabKey === 'capitalOutlay') {
        // For Capital Outlay, resolve friendly category name
        category = resolveCapitalOutlayCategory(item) || 'Uncategorized';
    } else {
      // For Income and others
      category = item.categoryName || item.category || item.Category || 'Uncategorized';
    }
    
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(item);
  });

  return Object.entries(groups).map(([category, items]) => ({
    category,
    items
  }));
};

// Grouped Collapsible Row Component
const GroupedCollapsibleRow = ({ group, columns, groupIndex, tabKey, proposalStatus }) => {
  const [open, setOpen] = useState(false);
  const { category, items } = group;

  // Calculate group totals
  const getGroupTotal = (columnAccessor) => {
    return items.reduce((sum, item) => {
      const value = Number(columnAccessor(item) ?? 0);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
  };

  // Get all fields from an item for detailed view
  const getAllFields = (item) => {
    // Exclude technical/internal fields and workflow audit fields
    const excludeFields = [
      '_id', 'id', '__v', 'createdAt', 'updatedAt', 'originalId',
      'nis', 'cis', // NIS and CIS fields
      'workflowLevel', 'lastActionBy', 'lastActionDate',
      'departmentVerifiedBy', 'departmentVerifiedDate',
      'regionApprovedBy', 'regionApprovedDate',
      'rejectionReason', 'submittedDate',
      'divisionApproved', 'departmentConsolidated', 
      'departmentSubmitted', 'regionFinalVerified',
      'originalLevel', 'lastWorkflowTransition',
      'submittedToDepartmentAt', 'submittedToDepartmentBy',
      'submittedToRegionAt', 'submittedToRegionBy',
      'finalApprovedAt', 'finalApprovedBy',
      'submissionNote', 'approvalNote', 'finalNote',
      'date_process', 'username_process', 'processDate',
      'details' // Exclude details array (for Capital Outlay)
    ];
    
    // Define field order based on tab type - showing only relevant fields
    const fieldOrder = {
      income: ['status', 'category', 'categoryName', 'subCategory', 'subcategory', 'department', 'office', 'amount', 'totalAmount', 'fiscalYear', 'budgetType'],
      mooe: ['status', 'accountingTitle', 'sublineItem', 'uacsCode', 'income', 'subsidy', 'amount', 'department', 'division', 'region', 'processBy', 'fiscalYear', 'budgetType'],
      capitalOutlay: ['status', 'categoryName', 'category', 'particulars', 'uacsCode', 'sublineItem', 'accountingTitle', 'income', 'subsidy', 'cost', 'department', 'division', 'region', 'processBy', 'fiscalYear', 'budgetType'],
      personnelServices: ['status', 'employeeFullName', 'fullName', 'positionTitle', 'statusOfAppointment', 'monthlySalary', 'annualSalary', 'totalCompensation', 'Total', 'fiscalYear', 'budgetType']
    };
    
    const order = fieldOrder[tabKey] || [];
    
    // Get all entries and filter out excluded fields
    const allEntries = Object.entries(item)
      .filter(([key]) => !excludeFields.includes(key));
    
    // Sort entries based on field order
    const sortedEntries = allEntries.sort((a, b) => {
      const indexA = order.indexOf(a[0]);
      const indexB = order.indexOf(b[0]);
      
      // If both fields are in the order array, sort by their position
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      // If only A is in the order array, it comes first
      if (indexA !== -1) return -1;
      // If only B is in the order array, it comes first
      if (indexB !== -1) return 1;
      // If neither is in the order array, maintain original order
      return 0;
    });
    
    return sortedEntries.map(([key, value]) => {
      // Handle special formatting for different value types
      let displayValue;
      
      // Override status with proposal status if available
      if (key === 'status' && proposalStatus) {
        displayValue = proposalStatus;
      }
      // Handle objects (like populated category)
      else if (value && typeof value === 'object' && !Array.isArray(value)) {
        if (key === 'category') {
          displayValue = value.categoryName || value.name || '—';
        } else {
          // For other objects, try to get a meaningful string representation
          displayValue = value.name || value.title || JSON.stringify(value);
        }
      }
      // Handle arrays
      else if (Array.isArray(value)) {
        displayValue = `${value.length} items`;
      }
      // Handle currency fields
      else if (typeof value === 'number' && (
        key.toLowerCase().includes('amount') || 
        key.toLowerCase().includes('salary') || 
        key.toLowerCase().includes('cost') || 
        key.toLowerCase().includes('total') ||
        key.toLowerCase().includes('income') ||
        key.toLowerCase().includes('subsidy')
      )) {
        displayValue = formatCurrency(value);
      }
      // Handle other values
      else {
        displayValue = value?.toString() || '—';
      }
      
      const finalValue = (tabKey === 'capitalOutlay' && key === 'category') ? resolveCapitalOutlayCategory(item) : displayValue;
      return {
        key,
        label: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
        value: finalValue
      };
    });
  };

  return (
    <>
      <TableRow hover sx={{ '& > *': { borderBottom: 'unset' }, bgcolor: 'primary.50' }}>
        <TableCell sx={{ width: 50 }}>
          <IconButton
            size="small"
            onClick={() => setOpen(!open)}
            aria-label="expand group"
          >
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        {columns.map((column, columnIndex) => {
          if (columnIndex === 0) {
            // First column shows category name and count
            return (
              <TableCell key={`group-${groupIndex}-${columnIndex}`} sx={{ fontWeight: 700 }}>
                {category} ({items.length} {items.length === 1 ? 'item' : 'items'})
              </TableCell>
            );
          } else if (column.isCurrency) {
            // Currency columns show group totals
            const total = getGroupTotal(column.accessor);
            return (
              <TableCell
                key={`group-${groupIndex}-${columnIndex}`}
                align={column.align}
                sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}
              >
                {formatCurrency(total)}
              </TableCell>
            );
          } else {
            // Other columns are empty for group row
            return <TableCell key={`group-${groupIndex}-${columnIndex}`} />;
          }
        })}
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={columns.length + 1}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 2 }}>
              {items.map((item, itemIndex) => (
                <Paper key={item._id || item.id || `item-${itemIndex}`} sx={{ mb: 2, p: 2, bgcolor: 'grey.50' }}>
                  <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 700, mb: 2 }}>
                    Item {itemIndex + 1} Details
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 2 }}>
                    {getAllFields(item).map((field, idx) => (
                      <Box key={idx}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                          {field.label}
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                          {field.value}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Paper>
              ))}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

// Collapsible Row Component (for Personnel Services - no grouping)
const CollapsibleRow = ({ row, columns, rowIndex, tabKey, proposalStatus }) => {
  const [open, setOpen] = useState(false);
  const key = row._id || row.id || row.originalId || `row-${rowIndex}`;

  // Get all fields from the row for detailed view
  const getAllFields = () => {
    // Exclude technical/internal fields and workflow audit fields
    const excludeFields = [
      '_id', 'id', '__v', 'createdAt', 'updatedAt', 'originalId',
      'nis', 'cis', // NIS and CIS fields
      'workflowLevel', 'lastActionBy', 'lastActionDate',
      'departmentVerifiedBy', 'departmentVerifiedDate',
      'regionApprovedBy', 'regionApprovedDate',
      'rejectionReason', 'submittedDate',
      'divisionApproved', 'departmentConsolidated', 
      'departmentSubmitted', 'regionFinalVerified',
      'originalLevel', 'lastWorkflowTransition',
      'submittedToDepartmentAt', 'submittedToDepartmentBy',
      'submittedToRegionAt', 'submittedToRegionBy',
      'finalApprovedAt', 'finalApprovedBy',
      'submissionNote', 'approvalNote', 'finalNote',
      'date_process', 'username_process', 'processDate',
      'details' // Exclude details array (for Capital Outlay)
    ];
    
    // Define field order based on tab type - showing only relevant fields
    const fieldOrder = {
      income: ['status', 'category', 'categoryName', 'subCategory', 'subcategory', 'department', 'office', 'amount', 'totalAmount', 'fiscalYear', 'budgetType'],
      mooe: ['status', 'accountingTitle', 'sublineItem', 'uacsCode', 'income', 'subsidy', 'amount', 'department', 'division', 'region', 'processBy', 'fiscalYear', 'budgetType'],
      capitalOutlay: ['status', 'categoryName', 'category', 'particulars', 'uacsCode', 'sublineItem', 'accountingTitle', 'income', 'subsidy', 'cost', 'department', 'division', 'region', 'processBy', 'fiscalYear', 'budgetType'],
      personnelServices: ['status', 'employeeFullName', 'fullName', 'positionTitle', 'statusOfAppointment', 'monthlySalary', 'annualSalary', 'totalCompensation', 'Total', 'fiscalYear', 'budgetType']
    };
    
    const order = fieldOrder[tabKey] || [];
    
    // Get all entries and filter out excluded fields
    const allEntries = Object.entries(row)
      .filter(([key]) => !excludeFields.includes(key));
    
    // Sort entries based on field order
    const sortedEntries = allEntries.sort((a, b) => {
      const indexA = order.indexOf(a[0]);
      const indexB = order.indexOf(b[0]);
      
      // If both fields are in the order array, sort by their position
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      // If only A is in the order array, it comes first
      if (indexA !== -1) return -1;
      // If only B is in the order array, it comes first
      if (indexB !== -1) return 1;
      // If neither is in the order array, maintain original order
      return 0;
    });
    
    return sortedEntries.map(([key, value]) => {
      // Handle special formatting for different value types
      let displayValue;
      
      // Override status with proposal status if available
      if (key === 'status' && proposalStatus) {
        displayValue = proposalStatus;
      }
      // Handle objects (like populated category)
      else if (value && typeof value === 'object' && !Array.isArray(value)) {
        if (key === 'category') {
          displayValue = value.categoryName || value.name || '—';
        } else {
          // For other objects, try to get a meaningful string representation
          displayValue = value.name || value.title || JSON.stringify(value);
        }
      }
      // Handle arrays
      else if (Array.isArray(value)) {
        displayValue = `${value.length} items`;
      }
      // Handle currency fields
      else if (typeof value === 'number' && (
        key.toLowerCase().includes('amount') || 
        key.toLowerCase().includes('salary') || 
        key.toLowerCase().includes('cost') || 
        key.toLowerCase().includes('total') ||
        key.toLowerCase().includes('income') ||
        key.toLowerCase().includes('subsidy')
      )) {
        displayValue = formatCurrency(value);
      }
      // Handle other values
      else {
        displayValue = value?.toString() || '—';
      }
      
      const finalValue = (tabKey === 'capitalOutlay' && key === 'category') ? resolveCapitalOutlayCategory(row) : displayValue;
      return {
        key,
        label: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
        value: finalValue
      };
    });
  };

  return (
    <>
      <TableRow hover sx={{ '& > *': { borderBottom: 'unset' } }}>
        <TableCell sx={{ width: 50 }}>
          <IconButton
            size="small"
            onClick={() => setOpen(!open)}
            aria-label="expand row"
          >
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        {columns.map((column, columnIndex) => {
          const rawValue = column.accessor(row);
          const displayValue = column.isCurrency ? formatCurrency(rawValue) : (rawValue ?? '—');
          return (
            <TableCell
              key={`${key}-${columnIndex}`}
              align={column.align}
              sx={column.isCurrency ? { fontVariantNumeric: 'tabular-nums', fontWeight: 600 } : undefined}
            >
              {displayValue}
            </TableCell>
          );
        })}
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={columns.length + 1}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 700, mb: 2 }}>
                Complete Details
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 2 }}>
                {getAllFields().map((field, idx) => (
                  <Box key={idx}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                      {field.label}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {field.value}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

const renderTableBody = (rows, columns, tabKey, proposalStatus) => {
  if (!rows.length) {
    return (
      <TableRow>
        <TableCell colSpan={columns.length + 1} align="center" sx={{ py: 5, color: 'text.secondary' }}>
          No submitted records were found for this section.
        </TableCell>
      </TableRow>
    );
  }

  // For Personnel Services, use individual rows (no grouping)
  if (tabKey === 'personnelServices') {
    return rows.map((row, index) => (
      <CollapsibleRow
        key={row._id || row.id || row.originalId || `row-${index}`}
        row={row}
        columns={columns}
        rowIndex={index}
        tabKey={tabKey}
        proposalStatus={proposalStatus}
      />
    ));
  }

  // For Income, MOOE, and Capital Outlay, use grouped rows
  const groups = groupByCategory(rows, tabKey);
  return groups.map((group, index) => (
    <GroupedCollapsibleRow
      key={`group-${index}`}
      group={group}
      columns={columns}
      groupIndex={index}
      tabKey={tabKey}
      proposalStatus={proposalStatus}
    />
  ));
};

const BudgetManagerSubmissionView = ({ proposalData, proposal }) => {
  const [activeTab, setActiveTab] = useState(0);
  // Pagination state per tab key
  const [pagination, setPagination] = useState({
    income: { page: 0, rowsPerPage: 10 },
    personnelServices: { page: 0, rowsPerPage: 10 },
    mooe: { page: 0, rowsPerPage: 10 },
    capitalOutlay: { page: 0, rowsPerPage: 10 }
  });

  const datasets = useMemo(() => ({
    income: safeArray(proposalData?.income),
    personnelServices: safeArray(proposalData?.personnelServices),
    mooe: safeArray(proposalData?.mooe),
    capitalOutlay: safeArray(proposalData?.capitalOutlay)
  }), [proposalData]);

  const totals = useMemo(() => ({
    income: computeTotal(datasets.income, (item) => item.amount ?? item.Amount ?? item.totalAmount ?? 0),
    personnelServices: computeTotal(datasets.personnelServices, (item) => item.Total ?? item.totalCompensation ?? 0),
    mooe: computeTotal(datasets.mooe, (item) => (item.income ?? 0) + (item.subsidy ?? 0)),
    capitalOutlay: computeTotal(datasets.capitalOutlay, (item) => (item.income ?? 0) + (item.subsidy ?? 0))
  }), [datasets]);

  const tabMeta = useMemo(() => ([
    {
      key: 'income',
      label: `Income (${datasets.income.length})`,
      summary: totals.income,
      columns: deriveIncomeColumns()
    },
    {
      key: 'personnelServices',
      label: `Personnel (${datasets.personnelServices.length})`,
      summary: totals.personnelServices,
      columns: derivePersonnelColumns()
    },
    {
      key: 'mooe',
      label: `MOOE (${datasets.mooe.length})`,
      summary: totals.mooe,
      columns: deriveMooeColumns()
    },
    {
      key: 'capitalOutlay',
      label: `Capital Outlay (${datasets.capitalOutlay.length})`,
      summary: totals.capitalOutlay,
      columns: deriveCapitalOutlayColumns()
    }
  ]), [datasets, totals]);

  const handleTabChange = (_, next) => setActiveTab(next);

  const activeTabConfig = tabMeta[activeTab] || tabMeta[0];
  const activeRows = datasets[activeTabConfig?.key] || [];

  // Compute pagination derived values
  const { page, rowsPerPage } = pagination[activeTabConfig.key] || { page: 0, rowsPerPage: 10 };

  // For grouped tabs (income, mooe, capitalOutlay) we paginate by group; personnelServices paginates by rows
  const isGrouped = activeTabConfig.key !== 'personnelServices';
  const allGroups = isGrouped ? groupByCategory(activeRows, activeTabConfig.key) : [];
  const totalCount = isGrouped ? allGroups.length : activeRows.length;
  const pagedRows = !isGrouped ? activeRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage) : [];
  const pagedGroups = isGrouped ? allGroups.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage) : [];

  const handleChangePage = (_e, newPage) => {
    setPagination(prev => ({
      ...prev,
      [activeTabConfig.key]: { ...prev[activeTabConfig.key], page: newPage }
    }));
  };

  const handleChangeRowsPerPage = (e) => {
    const value = parseInt(e.target.value, 10);
    setPagination(prev => ({
      ...prev,
      [activeTabConfig.key]: { page: 0, rowsPerPage: value }
    }));
  };

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        <Typography variant="body2">
          <strong>Budget Manager Review:</strong> The tables below show the submitted values exactly as received from the consolidating office. No draft or analyst comparison data is displayed for this role.
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
          Current workflow status: {proposal?.status || '—'}
        </Typography>
      </Alert>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={activeTab} onChange={handleTabChange} variant="scrollable" allowScrollButtonsMobile>
          {tabMeta.map((tab, index) => (
            <Tab
              key={tab.key}
              value={index}
              label={
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <Typography variant="body2" sx={{ fontWeight: activeTab === index ? 700 : 500 }}>
                    {tab.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Total: {formatCurrency(tab.summary)}
                  </Typography>
                </Box>
              }
              sx={{ alignItems: 'flex-start', textTransform: 'none', minHeight: 64 }}
            />
          ))}
        </Tabs>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        {tabMeta.map((tab) => buildSummaryChip(tab.label.split(' (')[0], tab.summary))}
      </Box>

      <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 480 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 50 }} />
              {activeTabConfig.columns.map((column) => (
                <TableCell key={column.label} align={column.align}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {column.label}
                  </Typography>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {/* Paginate rows or groups depending on tab */}
            {isGrouped
              ? pagedGroups.map((group, index) => (
                  <GroupedCollapsibleRow
                    key={`group-${index}`}
                    group={group}
                    columns={activeTabConfig.columns}
                    groupIndex={index + page * rowsPerPage}
                    tabKey={activeTabConfig.key}
                    proposalStatus={proposal?.status}
                  />
                ))
              : renderTableBody(pagedRows, activeTabConfig.columns, activeTabConfig.key, proposal?.status)
            }
          </TableBody>
          <TableFooter>
            <TableRow>
              {/* Empty for expander */}
              <TableCell />
              {(() => {
                const cols = activeTabConfig.columns;
                const lastCurrencyIndex = [...cols].reduce((acc, col, idx) => col.isCurrency ? idx : acc, -1);
                const totalForTab = (() => {
                  switch (activeTabConfig.key) {
                    case 'income': return totals.income;
                    case 'personnelServices': return totals.personnelServices;
                    case 'mooe': return totals.mooe;
                    case 'capitalOutlay': return totals.capitalOutlay;
                    default: return 0;
                  }
                })();
                return cols.map((col, idx) => (
                  <TableCell key={`footer-${idx}`} align={col.align} sx={{ fontWeight: idx === lastCurrencyIndex ? 700 : 600 }}>
                    {idx === 0 ? 'Grand Total' : (idx === lastCurrencyIndex ? formatCurrency(totalForTab) : '')}
                  </TableCell>
                ));
              })()}
            </TableRow>
          </TableFooter>
        </Table>
        <TablePagination
          component="div"
          count={totalCount}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[5, 10, 20, 50, 100]}
        />
      </TableContainer>
    </Box>
  );
};

export default BudgetManagerSubmissionView;
