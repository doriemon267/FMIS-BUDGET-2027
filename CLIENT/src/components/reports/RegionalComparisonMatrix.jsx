import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TableRow,
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import { getRegionalMatrixView, sumRegionalMatrixRows } from './regionalMatrixView';

const formatMoney = (value) => `₱${Number(value || 0).toLocaleString(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

const FinancialCells = ({ values = {}, columns, strong = false, groupStart = false, backgroundColor = 'inherit' }) => (
  <>
    {columns.map(({ key }, index) => (
      <TableCell
        key={key}
        align="right"
        sx={{
          minWidth: 92,
          width: 92,
          px: 0.75,
          py: 0.45,
          whiteSpace: 'nowrap',
          fontSize: '0.7rem',
          fontWeight: strong ? 800 : 500,
          fontVariantNumeric: 'tabular-nums',
          bgcolor: backgroundColor,
          borderLeft: groupStart && index === 0 ? '2px solid #cbd5e1' : undefined,
        }}
      >
        {formatMoney(values[key])}
      </TableCell>
    ))}
  </>
);

const RegionalComparisonMatrix = ({
  matrix,
  columns,
  searchTerm = '',
  totalLabel = 'REGIONAL TOTAL',
  expandedSectionIds,
  onExpandedSectionIdsChange,
}) => {
  const view = useMemo(() => getRegionalMatrixView(matrix, columns, searchTerm), [matrix, columns, searchTerm]);
  const [internalExpanded, setInternalExpanded] = useState([]);
  const isControlled = Array.isArray(expandedSectionIds);
  const expanded = isControlled ? expandedSectionIds : internalExpanded;
  const setExpanded = (nextValue) => {
    const next = typeof nextValue === 'function' ? nextValue(expanded) : nextValue;
    if (!isControlled) setInternalExpanded(next);
    onExpandedSectionIdsChange?.(next);
  };

  useEffect(() => {
    if (!isControlled) setInternalExpanded((matrix?.sections || []).map((section) => section.id));
  }, [isControlled, matrix?.sections]);

  const { sections, rows: visibleRows } = view;
  const regions = matrix?.regions || [];
  const minimumWidth = 260 + ((regions.length + 1) * columns.length * 92);

  return (
    <>
      <Box className="report-no-print" sx={{ display: { xs: 'block', sm: 'none' }, px: 1.5, py: 0.75, bgcolor: '#f8fafc', color: 'text.secondary', fontSize: '0.72rem', borderBottom: '1px solid', borderColor: 'divider' }}>
        Swipe horizontally to compare regions. Particulars scrolls on narrow screens.
      </Box>
      <TableContainer className="report-table-container" sx={{ overflow: 'auto', maxHeight: { md: 'calc(100vh - 360px)' } }}>
        <Table stickyHeader size="small" aria-label="All Regions comparison matrix" sx={{ width: '100%', minWidth: `max(100%, ${minimumWidth}px)`, tableLayout: 'fixed', '& .regional-sticky': { position: 'sticky', left: 0, zIndex: 3, bgcolor: 'background.paper' }, '& thead .regional-sticky': { zIndex: 6, bgcolor: '#f4f7f5' }, '@media (max-width: 599.95px)': { '& .regional-sticky': { position: 'static', left: 'auto', zIndex: 'auto' } } }}>
          <TableHead>
            <TableRow sx={{ height: 30 }}>
              <TableCell className="regional-sticky" rowSpan={2} scope="col" sx={{ top: 0, width: 260, minWidth: 260, py: 0.5, fontWeight: 800, borderRight: '2px solid #94a3b8', borderBottom: '2px solid #94a3b8' }}>Particulars</TableCell>
              {[...regions, totalLabel].map((region) => (
                <TableCell key={region} colSpan={columns.length} scope="colgroup" align="center" sx={{ py: 0.5, bgcolor: region === totalLabel ? 'rgba(55,94,56,.1)' : '#f4f7f5', borderLeft: '2px solid #94a3b8', borderBottom: '1px solid #cbd5e1', fontSize: '0.7rem', fontWeight: 800 }}>{region}</TableCell>
              ))}
            </TableRow>
            <TableRow>
              {[...regions, totalLabel].flatMap((region) => columns.map((column, index) => (
                <TableCell key={`${region}-${column.key}`} scope="col" align="center" sx={{ top: 30, minWidth: 92, width: 92, px: 0.5, py: 0.4, bgcolor: region === totalLabel ? 'rgba(55,94,56,.1)' : '#f4f7f5', borderLeft: index === 0 ? '2px solid #94a3b8' : undefined, borderBottom: '2px solid #94a3b8', color: 'text.secondary', fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase' }}>{column.label}</TableCell>
              ))) }
            </TableRow>
          </TableHead>
          <TableBody>
            {sections.map((section) => {
              const isExpanded = expanded.includes(section.id);
              return (
                <React.Fragment key={section.id}>
                  <TableRow hover onClick={() => setExpanded((current) => isExpanded ? current.filter((id) => id !== section.id) : [...current, section.id])} sx={{ height: 34, cursor: 'pointer', bgcolor: 'rgba(55,94,56,.06)' }}>
                    <TableCell className="regional-sticky" sx={{ py: 0.55, fontWeight: 800, borderRight: '2px solid #cbd5e1', bgcolor: 'inherit' }}><Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><IconButton size="small" sx={{ p: 0.15 }}>{isExpanded ? <RemoveCircleOutlineIcon fontSize="small" /> : <AddCircleOutlineIcon fontSize="small" />}</IconButton>{section.name}</Box></TableCell>
                    {regions.map((region) => <FinancialCells key={region} columns={columns} values={sumRegionalMatrixRows(section.rows, region, columns)} strong groupStart />)}
                    <FinancialCells columns={columns} values={sumRegionalMatrixRows(section.rows, null, columns)} strong groupStart backgroundColor="rgba(55,94,56,.08)" />
                  </TableRow>
                  {section.rows.map((row) => (
                    <TableRow key={row.id} sx={{ display: isExpanded ? 'table-row' : 'none', height: 30 }}>
                      <TableCell className="regional-sticky" sx={{ pl: 4, py: 0.45, fontSize: '0.76rem', lineHeight: 1.3, borderRight: '2px solid #e2e8f0', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{row.particulars}</TableCell>
                      {regions.map((region) => <FinancialCells key={region} columns={columns} values={row.valuesByRegion?.[region]} groupStart />)}
                      <FinancialCells columns={columns} values={row.totals} strong groupStart backgroundColor="rgba(55,94,56,.035)" />
                    </TableRow>
                  ))}
                </React.Fragment>
              );
            })}
          </TableBody>
          <TableFooter><TableRow sx={{ height: 34 }}><TableCell className="regional-sticky" sx={{ py: 0.6, bgcolor: '#f4f7f5', fontWeight: 900, borderTop: '2px solid #64748b', borderRight: '2px solid #94a3b8' }}>{totalLabel}</TableCell>{regions.map((region) => <FinancialCells key={region} columns={columns} values={sumRegionalMatrixRows(visibleRows, region, columns)} strong groupStart backgroundColor="#f4f7f5" />)}<FinancialCells columns={columns} values={sumRegionalMatrixRows(visibleRows, null, columns)} strong groupStart backgroundColor="rgba(55,94,56,.1)" /></TableRow></TableFooter>
        </Table>
      </TableContainer>
    </>
  );
};

export default RegionalComparisonMatrix;
