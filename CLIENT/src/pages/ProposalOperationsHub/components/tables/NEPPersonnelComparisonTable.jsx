import React, { useMemo } from 'react';
import { NumericFormat } from 'react-number-format';
import {
  Box,
  Chip,
  InputAdornment,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { preventNegativeNumericKey, toNonNegativeNumber } from '../../../../utils/preventNegativeInput';
import {
  buildPersonnelComparisonRows,
  getPersonnelComparisonTotals,
} from './nepPersonnelComparison';

const peso = value =>
  `₱${Number(value || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const amountCell = {
  minWidth: 150,
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
};

const NEPPersonnelComparisonTable = ({
  personnel = [],
  canEdit = false,
  hasChanges = false,
  onAllocationChange,
}) => {
  const theme = useTheme();
  const sections = useMemo(() => buildPersonnelComparisonRows(personnel), [personnel]);
  const grandTotal = useMemo(() => getPersonnelComparisonTotals(sections), [sections]);
  const identityColumnCount = 2;
  const itemLeft = 0;
  const particularsLeft = 72;
  const particularsWidth = 310;
  const isDark = theme.palette.mode === 'dark';
  const initialCellBg = isDark
    ? alpha(theme.palette.common.white, 0.07)
    : theme.palette.grey[100];
  const initialSubtotalBg = isDark
    ? alpha(theme.palette.common.white, 0.12)
    : theme.palette.grey[200];
  const editableCellBg = alpha(theme.palette.info.main, isDark ? 0.12 : 0.06);
  const editableSubtotalBg = alpha(theme.palette.info.main, isDark ? 0.22 : 0.14);
  const unsavedBg = alpha(theme.palette.warning.main, isDark ? 0.2 : 0.12);
  const sectionBg = alpha(theme.palette.success.main, isDark ? 0.18 : 0.1);
  const sectionText = isDark ? theme.palette.success.light : '#23430f';
  const identityBodySx = {
    position: 'sticky',
    zIndex: 2,
    bgcolor: 'background.paper',
    backgroundImage: 'none',
  };

  const renderInput = (row, funding, value, label) => {
    if (!row.sourceSlots.length) {
      return (
        <Tooltip title="No existing personnel value is available for this budget line.">
          <Box
            component="span"
            sx={{ color: 'text.disabled', fontSize: '0.72rem', fontStyle: 'italic' }}
          >
            Not available
          </Box>
        </Tooltip>
      );
    }

    return (
      <Tooltip title="This total is distributed proportionally across contributing personnel records.">
        <Box component="span" sx={{ display: 'block' }}>
          <NumericFormat
            customInput={TextField}
            thousandSeparator=","
            decimalScale={2}
            fixedDecimalScale
            allowNegative={false}
            size="small"
            value={value || ''}
            placeholder="0.00"
            disabled={!canEdit}
            onKeyDown={preventNegativeNumericKey}
            onValueChange={(values, sourceInfo) => {
              if (sourceInfo.source === 'event') {
                onAllocationChange(row, funding, toNonNegativeNumber(values.floatValue ?? 0));
              }
            }}
            aria-label={`${row.label} NEP ${label}`}
            InputProps={{
              startAdornment: <InputAdornment position="start">₱</InputAdornment>,
            }}
            inputProps={{
              inputMode: 'decimal',
              style: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
            }}
            sx={{
              width: '100%',
              '& .MuiOutlinedInput-root': {
                bgcolor: hasChanges ? unsavedBg : editableCellBg,
                borderRadius: 1,
                '& fieldset': {
                  borderColor: hasChanges
                    ? theme.palette.warning.main
                    : alpha(theme.palette.info.main, 0.55),
                },
                '&.Mui-focused fieldset': {
                  borderColor: theme.palette.info.main,
                  borderWidth: 2,
                },
              },
              '& .MuiInputAdornment-root': { color: 'text.secondary', mr: 0.25 },
              '& input': { py: 0.75, px: 0.5, fontSize: '0.78rem' },
            }}
          />
        </Box>
      </Tooltip>
    );
  };

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', md: 'center' }}
        gap={1.5}
        sx={{ mb: 1.5 }}
      >
        <Box>
          <Typography
            variant="overline"
            sx={{ display: 'block', fontWeight: 900, color: 'text.secondary', lineHeight: 1.2 }}
          >
            Proposal phase worksheet
          </Typography>
          <Typography
            variant="subtitle1"
            sx={{ fontWeight: 800, color: isDark ? 'success.light' : '#2d5016' }}
          >
            Personnel Services Proposal Comparison
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Review the approved baseline and allocate each NEP line item between Income and Subsidy.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip
            size="small"
            icon={<LockOutlinedIcon />}
            label="Initial Proposal · read-only"
            sx={{ bgcolor: initialSubtotalBg, color: 'text.primary', fontWeight: 700 }}
          />
          <Chip
            size="small"
            icon={<EditOutlinedIcon />}
            label={canEdit ? 'NEP Proposal · editable' : 'NEP Proposal · read-only'}
            sx={{ bgcolor: editableSubtotalBg, color: 'text.primary', fontWeight: 700 }}
          />
          {hasChanges && (
            <Chip size="small" label="Unsaved changes" color="warning" sx={{ fontWeight: 700 }} />
          )}
        </Stack>
      </Stack>

      {canEdit && personnel.length > 0 && (
        <Stack
          direction="row"
          spacing={0.75}
          alignItems="center"
          sx={{ mb: 1.25, color: 'text.secondary' }}
        >
          <InfoOutlinedIcon sx={{ fontSize: 16, color: 'info.main' }} />
          <Typography variant="caption">
            Editing an available line distributes its total proportionally across the personnel
            records contributing to that line. Unavailable lines cannot create new benefits.
          </Typography>
        </Stack>
      )}

      <TableContainer
        sx={{
          maxHeight: '65vh',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1.5,
          boxShadow: isDark
            ? `0 2px 12px ${alpha(theme.palette.common.black, 0.35)}`
            : '0 2px 10px rgba(26, 56, 22, 0.08)',
        }}
      >
        <Table
          stickyHeader
          size="small"
          sx={{ minWidth: 1282, tableLayout: 'fixed' }}
        >
          <TableHead>
            <TableRow sx={{ height: 38 }}>
              <TableCell
                rowSpan={2}
                sx={{
                  position: 'sticky',
                  left: itemLeft,
                  zIndex: 5,
                  width: 72,
                  bgcolor: '#2d5016',
                  color: 'white',
                  fontWeight: 800,
                }}
              >
                Item No.
              </TableCell>
              <TableCell
                rowSpan={2}
                sx={{
                  position: 'sticky',
                  left: particularsLeft,
                  zIndex: 5,
                  width: particularsWidth,
                  bgcolor: '#2d5016',
                  color: 'white',
                  fontWeight: 800,
                  boxShadow: `5px 0 8px ${alpha(theme.palette.common.black, 0.16)}`,
                }}
              >
                Particulars
              </TableCell>
              <TableCell
                colSpan={3}
                align="center"
                sx={{ bgcolor: '#5f6964', color: 'white', fontWeight: 900 }}
              >
                <LockOutlinedIcon sx={{ fontSize: 14, mr: 0.75, verticalAlign: '-2px' }} />
                INITIAL PROPOSAL (LOCKED)
              </TableCell>
              <TableCell
                colSpan={3}
                align="center"
                sx={{ bgcolor: '#2d6a63', color: 'white', fontWeight: 900 }}
              >
                <EditOutlinedIcon sx={{ fontSize: 14, mr: 0.75, verticalAlign: '-2px' }} />
                NEP PROPOSAL {canEdit ? '(EDITABLE FIELDS)' : '(READ-ONLY)'}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell
                align="center"
                sx={{ top: 38, bgcolor: '#68716c', color: 'white', fontWeight: 800 }}
              >
                Income
              </TableCell>
              <TableCell
                align="center"
                sx={{ top: 38, bgcolor: '#68716c', color: 'white', fontWeight: 800 }}
              >
                Subsidy
              </TableCell>
              <TableCell
                align="center"
                sx={{ top: 38, bgcolor: '#68716c', color: 'white', fontWeight: 800 }}
              >
                Initial Total
              </TableCell>
              <TableCell
                align="center"
                sx={{ top: 38, bgcolor: '#2d6a63', color: 'white', fontWeight: 800 }}
              >
                Income
              </TableCell>
              <TableCell
                align="center"
                sx={{ top: 38, bgcolor: '#2d6a63', color: 'white', fontWeight: 800 }}
              >
                Subsidy
              </TableCell>
              <TableCell
                align="center"
                sx={{ top: 38, bgcolor: '#2d6a63', color: 'white', fontWeight: 800 }}
              >
                Proposed Total
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!personnel.length ? (
              <TableRow>
                <TableCell
                  colSpan={identityColumnCount + 6}
                  align="center"
                  sx={{ py: 7, bgcolor: 'background.paper' }}
                >
                  <Typography sx={{ fontWeight: 800, mb: 0.5 }}>
                    No Personnel Services line items available
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Initial and NEP Income/Subsidy values will appear here when personnel records
                    are attached to this proposal.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              <>
                {sections.map(section => {
                  const subtotal = getPersonnelComparisonTotals([{ rows: section.rows }]);
                  return (
                    <React.Fragment key={section.code}>
                      <TableRow>
                        <TableCell
                          colSpan={identityColumnCount + 6}
                          sx={{
                            py: 0.75,
                            bgcolor: sectionBg,
                            color: sectionText,
                            fontWeight: 900,
                            borderTop: `2px solid ${alpha(theme.palette.success.main, 0.4)}`,
                          }}
                        >
                          {section.code} &nbsp; {section.title}
                        </TableCell>
                      </TableRow>
                      {section.rows.map(row => (
                        <TableRow key={row.code} hover>
                          <TableCell
                            sx={{
                              ...identityBodySx,
                              left: itemLeft,
                              width: 72,
                              fontWeight: 700,
                            }}
                          >
                            {row.code}
                          </TableCell>
                          <TableCell
                            sx={{
                              ...identityBodySx,
                              left: particularsLeft,
                              width: particularsWidth,
                              fontSize: '0.8rem',
                              boxShadow: `5px 0 8px ${alpha(theme.palette.common.black, 0.1)}`,
                            }}
                          >
                            {row.label}
                          </TableCell>
                          <TableCell
                            sx={{ ...amountCell, bgcolor: initialCellBg, color: 'text.secondary' }}
                          >
                            {peso(row.initialIncome)}
                          </TableCell>
                          <TableCell
                            sx={{ ...amountCell, bgcolor: initialCellBg, color: 'text.secondary' }}
                          >
                            {peso(row.initialSubsidy)}
                          </TableCell>
                          <TableCell
                            sx={{ ...amountCell, bgcolor: initialCellBg, fontWeight: 800 }}
                          >
                            {peso(row.initialIncome + row.initialSubsidy)}
                          </TableCell>
                          <TableCell sx={{ ...amountCell, bgcolor: editableCellBg, p: 0.65 }}>
                            {renderInput(row, 'income', row.nepIncome, 'Income')}
                          </TableCell>
                          <TableCell sx={{ ...amountCell, bgcolor: editableCellBg, p: 0.65 }}>
                            {renderInput(row, 'subsidy', row.nepSubsidy, 'Subsidy')}
                          </TableCell>
                          <TableCell
                            sx={{ ...amountCell, bgcolor: editableCellBg, fontWeight: 850 }}
                          >
                            {peso(row.nepIncome + row.nepSubsidy)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell
                          colSpan={2}
                          sx={{
                            position: 'sticky',
                            left: itemLeft,
                            zIndex: 2,
                            fontWeight: 900,
                            bgcolor: initialCellBg,
                            boxShadow: `5px 0 8px ${alpha(theme.palette.common.black, 0.1)}`,
                          }}
                        >
                          Subtotal: {section.code} {section.title}
                        </TableCell>
                        {[
                          ['initialIncome', subtotal.initialIncome],
                          ['initialSubsidy', subtotal.initialSubsidy],
                          ['initialTotal', subtotal.initialIncome + subtotal.initialSubsidy],
                          ['nepIncome', subtotal.nepIncome],
                          ['nepSubsidy', subtotal.nepSubsidy],
                          ['nepTotal', subtotal.nepIncome + subtotal.nepSubsidy],
                        ].map(([key, value]) => (
                          <TableCell
                            key={key}
                            sx={{
                              ...amountCell,
                              fontWeight: 900,
                              bgcolor: key.startsWith('nep')
                                ? editableSubtotalBg
                                : initialSubtotalBg,
                            }}
                          >
                            {peso(value)}
                          </TableCell>
                        ))}
                      </TableRow>
                    </React.Fragment>
                  );
                })}
                <TableRow>
                  <TableCell
                    colSpan={identityColumnCount}
                    sx={{
                      position: 'sticky',
                      left: 0,
                      zIndex: 3,
                      bgcolor: '#2d5016',
                      color: 'white',
                      fontWeight: 900,
                      fontSize: '0.9rem',
                      boxShadow: `5px 0 8px ${alpha(theme.palette.common.black, 0.18)}`,
                    }}
                  >
                    GRAND TOTAL · PERSONNEL SERVICES
                  </TableCell>
                  {[
                    ['initialIncome', grandTotal.initialIncome],
                    ['initialSubsidy', grandTotal.initialSubsidy],
                    ['initialTotal', grandTotal.initialIncome + grandTotal.initialSubsidy],
                    ['nepIncome', grandTotal.nepIncome],
                    ['nepSubsidy', grandTotal.nepSubsidy],
                    ['nepTotal', grandTotal.nepIncome + grandTotal.nepSubsidy],
                  ].map(([key, value]) => (
                    <TableCell
                      key={key}
                      sx={{ ...amountCell, bgcolor: '#2d5016', color: 'white', fontWeight: 900 }}
                    >
                      {peso(value)}
                    </TableCell>
                  ))}
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default NEPPersonnelComparisonTable;
