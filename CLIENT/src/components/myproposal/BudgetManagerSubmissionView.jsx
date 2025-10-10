import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  Paper,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from '@mui/material';

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
  buildColumn('Particulars', (item) => (
    item.particulars || item.Particulars || item.description || '—'
  )),
  buildColumn('UACS Code', (item) => (
    item.uacsCode || item.UACS || item.uacs || '—'
  )),
  buildColumn('Program / Project', (item) => (
    item.program || item.project || item.subProgram || '—'
  )),
  buildColumn('Submitted Amount', (item) => (
    item.amount ?? item.Amount ?? item.subsidy ?? 0
  ), { align: 'right', isCurrency: true })
]);

const deriveCapitalOutlayColumns = () => ([
  buildColumn('Category', (item) => (
    item.categoryName || item.category || '—'
  )),
  buildColumn('Particulars', (item) => (
    item.particulars || item.Particulars || '—'
  )),
  buildColumn('Implementation Schedule', (item) => (
    item.implementationSchedule || item.schedule || '—'
  )),
  buildColumn('Submitted Cost', (item) => (
    item.cost ?? item.totalCost ?? item.amount ?? 0
  ), { align: 'right', isCurrency: true })
]);

const computeTotal = (entries, getter) => entries.reduce((sum, item) => {
  const value = Number(getter(item) ?? 0);
  return sum + (Number.isFinite(value) ? value : 0);
}, 0);

const renderTableBody = (rows, columns) => {
  if (!rows.length) {
    return (
      <TableRow>
        <TableCell colSpan={columns.length} align="center" sx={{ py: 5, color: 'text.secondary' }}>
          No submitted records were found for this section.
        </TableCell>
      </TableRow>
    );
  }

  return rows.map((row, index) => {
    const key = row._id || row.id || row.originalId || `row-${index}`;
    return (
      <TableRow key={key} hover>
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
    );
  });
};

const BudgetManagerSubmissionView = ({ proposalData, proposal }) => {
  const [activeTab, setActiveTab] = useState(0);

  const datasets = useMemo(() => ({
    income: safeArray(proposalData?.income),
    personnelServices: safeArray(proposalData?.personnelServices),
    mooe: safeArray(proposalData?.mooe),
    capitalOutlay: safeArray(proposalData?.capitalOutlay)
  }), [proposalData]);

  const totals = useMemo(() => ({
    income: computeTotal(datasets.income, (item) => item.amount ?? item.Amount ?? item.totalAmount ?? 0),
    personnelServices: computeTotal(datasets.personnelServices, (item) => item.Total ?? item.totalCompensation ?? 0),
    mooe: computeTotal(datasets.mooe, (item) => item.amount ?? item.Amount ?? item.subsidy ?? 0),
    capitalOutlay: computeTotal(datasets.capitalOutlay, (item) => item.cost ?? item.totalCost ?? item.amount ?? 0)
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

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
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
            {renderTableBody(activeRows, activeTabConfig.columns)}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default BudgetManagerSubmissionView;
