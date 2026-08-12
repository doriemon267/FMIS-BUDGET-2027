export const MATRIX_FINANCIAL_COLUMNS = [
  { key: 'income', label: 'Income' },
  { key: 'subsidy', label: 'Subsidy' },
  { key: 'amount', label: 'Amount' },
];

export const MATRIX_PARTICULARS_WIDTH = 260;
export const MATRIX_SUBCOLUMN_MIN_WIDTH = 92;

export const getMooeMatrixScreenMinimumWidth = (regionCount) => (
  MATRIX_PARTICULARS_WIDTH +
  ((Math.max(0, Number(regionCount || 0)) + 1) * MATRIX_FINANCIAL_COLUMNS.length * MATRIX_SUBCOLUMN_MIN_WIDTH)
);
