import assert from 'node:assert/strict';
import {
  MATRIX_FINANCIAL_COLUMNS,
  MATRIX_PARTICULARS_WIDTH,
  MATRIX_SUBCOLUMN_MIN_WIDTH,
  getMooeMatrixScreenMinimumWidth,
} from '../src/components/reports/mooeMatrixLayout.js';

const oneGroupWidth = MATRIX_FINANCIAL_COLUMNS.length * MATRIX_SUBCOLUMN_MIN_WIDTH;
const threeRegionWidth = getMooeMatrixScreenMinimumWidth(3);

assert.equal(
  getMooeMatrixScreenMinimumWidth(0),
  MATRIX_PARTICULARS_WIDTH + oneGroupWidth,
  'Regional Total must remain when no region has visible data'
);
assert.equal(
  getMooeMatrixScreenMinimumWidth(4),
  threeRegionWidth + oneGroupWidth,
  'Each future visible region must add one complete financial group'
);
assert.equal(
  getMooeMatrixScreenMinimumWidth(-1),
  getMooeMatrixScreenMinimumWidth(0),
  'Invalid negative counts must be clamped'
);

console.log('MOOE matrix screen layout checks passed.');
