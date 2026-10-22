import React, { useMemo } from 'react';
import {
  Box,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { preventNegativeNumericKey, toNonNegativeNumber } from '../../../../utils/preventNegativeInput';
import {
  buildFinancialComparisonSections,
  getFinancialComparisonTotals,
} from './nepFinancialComparison';

const peso = value =>
  `₱${Number(value || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const numericCell = {
  minWidth: 142,
  textAlign: 'right',
  whiteSpace: 'nowrap',
  fontVariantNumeric: 'tabular-nums',
};

const NEPFinancialComparisonTable = ({
  moduleKey,
  initialItems = [],
  currentItems = [],
  canEdit = false,
  hasChanges = false,
  onEdit,
  emptyLabel,
}) => {
  const theme = useTheme();
  const isIncome = moduleKey === 'income';
  const sections = useMemo(
    () => buildFinancialComparisonSections({ moduleKey, initialItems, currentItems }),
    [currentItems, initialItems, moduleKey]
  );
  const totals = useMemo(
    () => getFinancialComparisonTotals(moduleKey, sections),
    [moduleKey, sections]
  );
  const lockedBg = alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.09 : 0.045);
  const editableBg = alpha(theme.palette.success.main, theme.palette.mode === 'dark' ? 0.12 : 0.055);
  const editedBg = alpha(theme.palette.warning.main, theme.palette.mode === 'dark' ? 0.2 : 0.13);
  const identitySx = {
    position: 'sticky',
    left: 0,
    zIndex: 2,
    bgcolor: 'background.paper',
    boxShadow: `5px 0 9px ${alpha(theme.palette.common.black, 0.1)}`,
  };
  const columnCount = isIncome ? 4 : 7;
  const hasFallbackBaseline = !totals.hasDurableBaseline && currentItems.length > 0;

  const input = (row, field, displayedValue, label) => (
    <TextField
      size="small"
      value={displayedValue || ''}
      placeholder="0.00"
      disabled={!canEdit || row.sourceIndices.length === 0}
      onKeyDown={preventNegativeNumericKey}
      onChange={event => onEdit(row.sourceIndices, toNonNegativeNumber(event.target.value), field)}
      aria-label={`${row.label} proposed ${label}`}
      InputProps={{ startAdornment: <InputAdornment position="start">₱</InputAdornment> }}
      inputProps={{ inputMode: 'decimal', style: { textAlign: 'right' } }}
      sx={{
        width: '100%',
        '& .MuiOutlinedInput-root': {
          bgcolor: hasChanges ? editedBg : editableBg,
          borderRadius: 1,
          '& fieldset': {
            borderColor: hasChanges
              ? theme.palette.warning.main
              : alpha(theme.palette.success.main, 0.5),
          },
          '&.Mui-focused fieldset': { borderColor: theme.palette.success.main, borderWidth: 2 },
        },
        '& input': { py: 0.7, px: 0.5, fontSize: '0.78rem' },
      }}
    />
  );

  return (
    <Box>
      {hasFallbackBaseline && (
        <Box
          sx={{
            display: 'flex',
            gap: 0.75,
            alignItems: 'flex-start',
            mb: 1.25,
            color: 'text.secondary',
          }}
        >
          <InfoOutlinedIcon sx={{ mt: 0.1, fontSize: 16, color: 'info.main' }} />
          <Typography variant="caption">
            The original Initial Proposal line items could not be loaded for this module. Locked
            values are shown as zero until the Initial Proposal source is available.
          </Typography>
        </Box>
      )}
      <TableContainer
        sx={{
          maxHeight: '62vh',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1.5,
          boxShadow: `0 3px 14px ${alpha(theme.palette.common.black, 0.07)}`,
        }}
      >
        <Table stickyHeader size="small" sx={{ minWidth: isIncome ? 720 : 1080 }}>
          <TableHead>
            <TableRow sx={{ height: 38 }}>
              <TableCell
                rowSpan={2}
                sx={{
                  position: 'sticky',
                  left: 0,
                  zIndex: 5,
                  minWidth: 310,
                  bgcolor: '#2d5016',
                  color: 'white',
                  fontWeight: 850,
                }}
              >
                Budget Line / Particulars
              </TableCell>
              <TableCell
                colSpan={isIncome ? 1 : 3}
                align="center"
                sx={{ bgcolor: '#626d68', color: 'white', fontWeight: 850 }}
              >
                <LockOutlinedIcon sx={{ fontSize: 14, mr: 0.75, verticalAlign: '-2px' }} />
                INITIAL PROPOSAL (LOCKED)
              </TableCell>
              <TableCell
                colSpan={isIncome ? 2 : 3}
                align="center"
                sx={{ bgcolor: '#2d6a52', color: 'white', fontWeight: 850 }}
              >
                <EditOutlinedIcon sx={{ fontSize: 14, mr: 0.75, verticalAlign: '-2px' }} />
                NEP PROPOSAL {canEdit ? '(EDITABLE FIELDS)' : '(READ-ONLY)'}
              </TableCell>
            </TableRow>
            <TableRow>
              {(isIncome
                ? ['Amount', 'Proposed Amount', 'Proposed Total']
                : ['Income', 'Subsidy', 'Initial Total', 'Income', 'Subsidy', 'Proposed Total']
              ).map((label, index) => (
                <TableCell
                  key={`${label}-${index}`}
                  align="right"
                  sx={{
                    top: 38,
                    minWidth: 142,
                    bgcolor: index < (isIncome ? 1 : 3) ? '#707b76' : '#367760',
                    color: 'white',
                    fontWeight: 800,
                  }}
                >
                  {label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {!currentItems.length ? (
              <TableRow>
                <TableCell colSpan={columnCount} align="center" sx={{ py: 7 }}>
                  <Typography sx={{ fontWeight: 800 }}>{emptyLabel}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Comparison values will appear when records are attached to this proposal.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              <>
                {sections.map(section => (
                  <React.Fragment key={section.title}>
                    <TableRow>
                      <TableCell
                        colSpan={columnCount}
                        sx={{
                          py: 0.75,
                          bgcolor: alpha(theme.palette.success.main, 0.1),
                          color: theme.palette.mode === 'dark' ? 'success.light' : '#23430f',
                          fontWeight: 850,
                        }}
                      >
                        {section.title}
                      </TableCell>
                    </TableRow>
                    {section.rows.map(row => {
                      const initialTotal = row.initialIncome + row.initialSubsidy;
                      const proposedTotal = isIncome
                        ? row.proposedAmount
                        : row.nepIncome + row.nepSubsidy;
                      return (
                        <TableRow key={row.mergeKey} hover>
                          <TableCell sx={{ ...identitySx, minWidth: 310 }}>
                            {moduleKey !== 'capital' && (
                              <>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                  {row.label}
                                </Typography>
                                {row.code && (
                                  <Typography variant="caption" color="text.secondary">
                                    UACS {row.code}
                                  </Typography>
                                )}
                              </>
                            )}
                          </TableCell>
                          {isIncome ? (
                            <>
                              <TableCell sx={{ ...numericCell, bgcolor: lockedBg }}>
                                {peso(row.initialAmount)}
                              </TableCell>
                              <TableCell sx={{ ...numericCell, bgcolor: editableBg, p: 0.65 }}>
                                {input(row, null, row.proposedAmount, 'amount')}
                              </TableCell>
                            </>
                          ) : (
                            <>
                              <TableCell sx={{ ...numericCell, bgcolor: lockedBg }}>
                                {peso(row.initialIncome)}
                              </TableCell>
                              <TableCell sx={{ ...numericCell, bgcolor: lockedBg }}>
                                {peso(row.initialSubsidy)}
                              </TableCell>
                              <TableCell sx={{ ...numericCell, bgcolor: lockedBg, fontWeight: 800 }}>
                                {peso(initialTotal)}
                              </TableCell>
                              <TableCell sx={{ ...numericCell, bgcolor: editableBg, p: 0.65 }}>
                                {input(row, 'income', row.nepIncome, 'Income')}
                              </TableCell>
                              <TableCell sx={{ ...numericCell, bgcolor: editableBg, p: 0.65 }}>
                                {input(row, 'subsidy', row.nepSubsidy, 'Subsidy')}
                              </TableCell>
                            </>
                          )}
                          <TableCell sx={{ ...numericCell, bgcolor: editableBg, fontWeight: 850 }}>
                            {peso(proposedTotal)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </React.Fragment>
                ))}
                <TableRow>
                  <TableCell
                    sx={{ ...identitySx, bgcolor: '#2d5016', color: 'white', fontWeight: 900 }}
                  >
                    GRAND TOTAL
                  </TableCell>
                  {isIncome ? (
                    <>
                      <TableCell sx={{ ...numericCell, bgcolor: '#2d5016', color: 'white', fontWeight: 900 }}>
                        {peso(totals.initial)}
                      </TableCell>
                      <TableCell sx={{ ...numericCell, bgcolor: '#2d5016', color: 'white', fontWeight: 900 }}>
                        {peso(totals.proposed)}
                      </TableCell>
                      <TableCell sx={{ ...numericCell, bgcolor: '#2d5016', color: 'white', fontWeight: 900 }}>
                        {peso(totals.proposed)}
                      </TableCell>
                    </>
                  ) : (
                    <>
                      {[totals.initialIncome, totals.initialSubsidy, totals.initial, totals.nepIncome, totals.nepSubsidy, totals.proposed].map(
                        (total, index) => (
                          <TableCell
                            key={index}
                            sx={{ ...numericCell, bgcolor: '#2d5016', color: 'white', fontWeight: 900 }}
                          >
                            {peso(total)}
                          </TableCell>
                        )
                      )}
                    </>
                  )}
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default NEPFinancialComparisonTable;
