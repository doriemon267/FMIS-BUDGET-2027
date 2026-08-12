const ExcelJS = require('exceljs');

jest.mock('../../models/mooeProposals', () => ({ find: jest.fn() }));

const consolidatedReportsController = require('../../controllers/consolidatedReportsController');
const { getFolioPageSize, isAllRegionsSelection } = require('../../utils/reportPageLayout');
const { getRegionsWithReportEntries } = require('../../utils/reportRegionSelection');
const {
  _private: { buildReportWorkflowVisibilityConditions }
} = require('../../controllers/comprehensiveReportsController');

const createResponse = () => ({
  headers: {},
  statusCode: 200,
  body: null,
  setHeader(name, value) {
    this.headers[name] = value;
    return this;
  },
  status(code) {
    this.statusCode = code;
    return this;
  },
  send(payload) {
    this.body = payload;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  }
});

describe('Consolidated report PDF orientation', () => {
  test('uses Folio landscape for All Regions selections', () => {
    expect(isAllRegionsSelection({ consolidationType: 'all' })).toBe(true);
    expect(isAllRegionsSelection({ selectedRegions: 'all' })).toBe(true);
    expect(getFolioPageSize(true)).toEqual({ width: 936, height: 612 });
  });

  test('keeps a single-region report in Folio portrait', () => {
    expect(isAllRegionsSelection({ regions: ['Region IV-A'] })).toBe(false);
    expect(getFolioPageSize(false)).toEqual({ width: 612, height: 936 });
  });
});

describe('Consolidated MOOE region matrix contract', () => {
  test('aggregates stable accounting rows by region without omitting financial measures', () => {
    const { buildMooeRegionMatrix } = consolidatedReportsController._private;
    const matrix = buildMooeRegionMatrix([
      {
        region: 'Region III',
        category: 'Traveling Expenses',
        items: [{ uacsCode: '50201010-00', accountingTitle: 'Traveling Expenses - Local', income: 10, subsidy: 20, amount: 30 }]
      },
      {
        region: 'Region IV-A',
        category: 'Traveling Expenses',
        items: [{ uacsCode: '50201010-00', accountingTitle: 'Traveling Expenses - Local', income: 5, subsidy: 15, amount: 25 }]
      },
      {
        region: 'Region IV-A',
        category: 'Traveling Expenses',
        items: [{ uacsCode: '50201010-00', accountingTitle: 'Traveling Expenses - Local', income: 2, subsidy: 3, amount: 4 }]
      }
    ]);

    expect(matrix.regions).toEqual(['Region III', 'Region IV-A']);
    expect(matrix.rows).toHaveLength(1);
    expect(matrix.rows[0].valuesByRegion['Region III']).toEqual({ income: 10, subsidy: 20, amount: 30, total: 60 });
    expect(matrix.rows[0].valuesByRegion['Region IV-A']).toEqual({ income: 7, subsidy: 18, amount: 29, total: 54 });
    expect(matrix.rows[0].totals).toEqual({ income: 17, subsidy: 38, amount: 59, total: 114 });
    expect(matrix.regionalTotal).toEqual(matrix.rows[0].totals);
  });

  test('excludes regions and rows that have no visible financial values', () => {
    const { buildMooeRegionMatrix } = consolidatedReportsController._private;
    const matrix = buildMooeRegionMatrix([
      { region: 'Empty Region', category: 'Supplies', items: [{ uacsCode: '1', accountingTitle: 'Paper', income: 0, subsidy: 0, amount: 0 }] },
      { region: '', category: 'Supplies', items: [{ uacsCode: '2', accountingTitle: 'Ink', amount: 100 }] }
    ]);

    expect(matrix.regions).toEqual([]);
    expect(matrix.rows).toEqual([]);
    expect(matrix.regionalTotal).toEqual({ income: 0, subsidy: 0, amount: 0, total: 0 });
  });

  test('automatically includes and orders future regions when visible proposal values arrive', () => {
    const { buildMooeRegionMatrix } = consolidatedReportsController._private;
    const regionNames = ['Future Region Z', 'Region II', 'Future Region A', 'Region IV-A'];
    const matrix = buildMooeRegionMatrix(regionNames.map((region, index) => ({
      region,
      category: 'Traveling Expenses',
      items: [{
        uacsCode: `50201010-0${index}`,
        accountingTitle: `Visible proposal ${index + 1}`,
        amount: (index + 1) * 100,
      }],
    })));

    expect(matrix.regions).toEqual([
      'Future Region A',
      'Future Region Z',
      'Region II',
      'Region IV-A',
    ]);
    expect(matrix.regions).toHaveLength(regionNames.length);
  });

  test('renders exactly three true financial subcolumns in canonical order', () => {
    const { getMatrixFinancialColumns } = consolidatedReportsController._private;

    expect(getMatrixFinancialColumns({ income: 10, subsidy: 20, amount: 30 })).toEqual([
      { key: 'income', label: 'INCOME', compactLabel: 'I', value: 10 },
      { key: 'subsidy', label: 'SUBSIDY', compactLabel: 'S', value: 20 },
      { key: 'amount', label: 'AMOUNT', compactLabel: 'A', value: 30 }
    ]);
  });

  test('uses full PDF subheaders when columns fit and compact labels only when required', () => {
    const { getMooeMatrixPdfSubheaders } = consolidatedReportsController._private;

    expect(getMooeMatrixPdfSubheaders(50)).toEqual(['INCOME', 'SUBSIDY', 'AMOUNT']);
    expect(getMooeMatrixPdfSubheaders(40)).toEqual(['I', 'S', 'A']);
  });

  test('calculates a continuation chunk total independently from the all-region total', () => {
    const { sumFinancialValues } = consolidatedReportsController._private;

    expect(sumFinancialValues([
      { income: 10, subsidy: 20, amount: 30 },
      { income: 1, subsidy: 2, amount: 3 }
    ])).toEqual({ income: 11, subsidy: 22, amount: 33, total: 66 });
  });

  test('uses only the currently active budget stage in the report title', () => {
    const { getConsolidatedMooeTitle } = consolidatedReportsController._private;

    expect(getConsolidatedMooeTitle('INITIAL')).toBe('Consolidated MOOE – INITIAL BUDGET PROPOSAL');
    expect(getConsolidatedMooeTitle('NEP')).toBe('Consolidated MOOE – NEP BUDGET PROPOSAL');
  });

  test.each([1, 2, 3])('fills the PDF content width for a %i-region matrix chunk', (regionCount) => {
    const { getMooeMatrixPdfLayout } = consolidatedReportsController._private;
    const contentLeft = 18;
    const contentWidth = 900;
    const layout = getMooeMatrixPdfLayout({ contentLeft, contentWidth, regionCount });

    expect(layout.regionXs).toHaveLength(regionCount);
    expect(layout.particularsX).toBe(contentLeft);
    expect(layout.right).toBe(contentLeft + contentWidth);
    expect(layout.financialGroupWidth).toBeCloseTo(layout.subcolumnWidth * 3, 8);
    expect(layout.totalX + (layout.subcolumnWidth * 3)).toBeCloseTo(layout.right, 8);
    expect(layout).not.toHaveProperty('uacsX');
    expect(layout).not.toHaveProperty('categoryX');
  });

  test('keeps financial columns readable at the computed maximum chunk size', () => {
    const { getMooeMatrixPdfLayout, getMooeMatrixRegionsPerPage } = consolidatedReportsController._private;
    const contentWidth = 900;
    const regionCount = getMooeMatrixRegionsPerPage(contentWidth);
    const layout = getMooeMatrixPdfLayout({ contentWidth, regionCount });

    expect(regionCount).toBe(3);
    expect(layout.particularsWidth).toBe(300);
    expect(layout.subcolumnWidth).toBeGreaterThanOrEqual(50);
  });

  test('partitions every dynamic region into the expected PDF page chunks without omission', () => {
    const { chunkMooeMatrixRegions, getMooeMatrixRegionsPerPage } = consolidatedReportsController._private;
    const regions = Array.from({ length: 8 }, (_, index) => `Region ${index + 1}`);
    const capacity = getMooeMatrixRegionsPerPage(900);
    const chunks = chunkMooeMatrixRegions(regions, capacity);

    expect(capacity).toBe(3);
    expect(chunks.map((chunk) => chunk.length)).toEqual([3, 3, 2]);
    expect(chunks).toHaveLength(Math.ceil(regions.length / capacity));
    expect(chunks.flat()).toEqual(regions);
    expect(new Set(chunks.flat()).size).toBe(regions.length);
  });

  test('uses compact one-line PDF rows and grows exactly with wrapped Particulars', () => {
    const { getMooeMatrixPdfDetailHeight } = consolidatedReportsController._private;

    expect(getMooeMatrixPdfDetailHeight(1)).toBe(17);
    expect(getMooeMatrixPdfDetailHeight(2)).toBeCloseTo(20.8, 8);
    expect(getMooeMatrixPdfDetailHeight(4)).toBeCloseTo(35.6, 8);
    expect(getMooeMatrixPdfDetailHeight(4)).toBeGreaterThan(getMooeMatrixPdfDetailHeight(2));
  });
});

describe('Consolidated Corporate Income region selection', () => {
  test('includes only unique regions that have matching proposal entries', () => {
    expect(getRegionsWithReportEntries([
      { region: 'Region IV-A' },
      { region: ' Region III ' },
      { region: 'region iv-a' },
      { region: '' },
      {}
    ])).toEqual([
      { Region: 'Region III' },
      { Region: 'Region IV-A' }
    ]);
  });
});

describe('Consolidated report Excel export', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('downloads an xlsx workbook with numeric proposal values and a Regional Total', async () => {
    jest.spyOn(consolidatedReportsController, 'getConsolidatedData').mockImplementation(async (_req, res) => (
      res.status(200).json({
        success: true,
        data: [
          {
            region: 'Region IV-A',
            category: 'Traveling Expenses',
            items: [
              {
                uacsCode: '50201010-00',
                accountingTitle: 'Traveling Expenses - Local',
                income: 100,
                subsidy: 200,
                amount: 50,
                nis: 0,
                cis: 0
              }
            ]
          }
        ],
        summary: { totalRegions: 1, totalCategories: 1, totalEntries: 1, grandTotal: 350 }
      })
    ));

    const req = {
      query: {
        format: 'xlsx',
        fiscalYear: '2027',
        budgetType: 'INITIAL',
        regions: 'Region IV-A'
      }
    };
    const res = createResponse();

    await consolidatedReportsController.exportConsolidatedData(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(res.headers['Content-Disposition']).toContain('Consolidated_MOOE_2027_INITIAL.xlsx');
    expect(Buffer.isBuffer(res.body)).toBe(true);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(res.body);
    const worksheet = workbook.getWorksheet('Budget Proposals');

    expect(worksheet.getCell('A1').value).toBe('Consolidated MOOE – INITIAL BUDGET PROPOSAL');
    expect(worksheet.getCell('A5').value).toBe('Region');
    expect(worksheet.getCell('E6').value).toBe(100);
    expect(worksheet.getCell('H6').value).toBe(350);
    expect(worksheet.getCell('A7').value).toBe('REGIONAL TOTAL');
    expect(worksheet.getCell('H7').value).toBe(350);
  });

  test('rejects unsupported export formats', async () => {
    const dataSpy = jest.spyOn(consolidatedReportsController, 'getConsolidatedData');
    const res = createResponse();

    await consolidatedReportsController.exportConsolidatedData(
      { query: { format: 'csv' } },
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/unsupported export format/i);
    expect(dataSpy).not.toHaveBeenCalled();
  });
});

describe('Budget Summary draft visibility', () => {
  test('adds Draft only when an owning Budget Preparer id is supplied', () => {
    const withoutOwner = buildReportWorkflowVisibilityConditions({ allowedMergedIds: ['merged-1'] });
    const withOwner = buildReportWorkflowVisibilityConditions({
      allowedMergedIds: ['merged-1'],
      draftOwnerId: 'preparer-123'
    });

    expect(withoutOwner).toHaveLength(2);
    expect(withoutOwner).not.toContainEqual(expect.objectContaining({ status: 'DRAFT' }));
    expect(withOwner).toContainEqual({ status: 'DRAFT', createdBy: 'preparer-123' });
  });
});
