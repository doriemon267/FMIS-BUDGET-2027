const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

jest.mock('../../models/COSPersonnel', () => ({ find: jest.fn() }));
jest.mock('../../models/PersonnelServices', () => ({}));
jest.mock('../../utils/pdfSignatureHelper', () => ({
  extractSignatoriesFromWorkflow: jest.fn(() => ({})),
  drawWorkflowSignatureBlock: jest.fn(),
  cleanupTempImages: jest.fn(),
  enrichSignatoriesWithPositionTitle: jest.fn(),
}));

const COSPersonnel = require('../../models/COSPersonnel');
const { exportCOSPersonnelPDF } = require('../../controllers/personnelServicesPDFController');
const {
  LEGACY_INDEX,
  PROPOSAL_INDEX,
  migrateCOSProposalIndex,
} = require('../../migrations/migrate-cos-proposal-index');

const createResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('COS premium route and persistence contracts', () => {
  beforeEach(() => jest.clearAllMocks());

  test('COS PDF combines workflowRef with the existing hierarchical scope', async () => {
    const proposalId = new mongoose.Types.ObjectId();
    COSPersonnel.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
    });
    const req = {
      body: { proposalId: proposalId.toHexString(), fiscalYear: '2026', region: 'Region A' },
      hierarchicalFilters: { department: 'Office A' },
    };
    const res = createResponse();
    await exportCOSPersonnelPDF(req, res);

    expect(COSPersonnel.find).toHaveBeenCalledWith({
      $and: [
        { department: 'Office A' },
        { workflowRef: proposalId, fiscalYear: '2026', region: 'Region A' },
      ],
    });
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('COS PDF refuses an unscoped export', async () => {
    const res = createResponse();
    await exportCOSPersonnelPDF({ body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(COSPersonnel.find).not.toHaveBeenCalled();
  });

  test('frontend keeps list and edit endpoints distinct and respects locked rows', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../../../CLIENT/src/components/jocos/PersonnelCustomPageTable.jsx'),
      'utf8'
    );
    const routerSource = fs.readFileSync(
      path.join(__dirname, '../../routers/cosPersonnelRoutes.js'),
      'utf8'
    );
    expect(source).toContain('const apiPath = `/${dataListName}`');
    expect(source).toContain('endpoint="/cos-personnel"');
    expect(source).toContain('disableEdit={locked ||');
    expect(routerSource).toContain('cosPersonnelRouter.put("/cos-personnel/:id"');
    expect(routerSource).toContain('cosPersonnelRouter.get("/cos-personnel/premium-settings"');
    expect(routerSource).toContain('cosPersonnelRouter.put("/cos-personnel/premium-settings/:proposalId"');
  });

  test('index migration creates proposal constraint before dropping the legacy index', async () => {
    const workflowId = new mongoose.Types.ObjectId();
    const rowId = new mongoose.Types.ObjectId();
    const collection = {
      indexes: jest.fn().mockResolvedValue([{ name: LEGACY_INDEX }]),
      find: jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue([{
          _id: rowId,
          workflowRef: workflowId.toHexString(),
          employeeNumber: 'EMP-001',
          fiscalYear: '2026',
        }]),
      }),
      bulkWrite: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      createIndex: jest.fn().mockResolvedValue(PROPOSAL_INDEX),
      dropIndex: jest.fn().mockResolvedValue({ ok: 1 }),
    };
    const workflowCollection = {
      find: jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue([{ _id: workflowId }]),
      }),
    };
    const report = await migrateCOSProposalIndex(collection, { workflowCollection, logger: { warn: jest.fn() } });
    expect(report.normalizedRows).toBe(1);
    expect(collection.bulkWrite).toHaveBeenCalledWith([
      {
        updateOne: {
          filter: { _id: rowId, workflowRef: workflowId.toHexString() },
          update: { $set: { workflowRef: workflowId } },
        },
      },
    ], { ordered: true });
    expect(collection.createIndex).toHaveBeenCalledWith(
      { workflowRef: 1, employeeNumber: 1, fiscalYear: 1 },
      { unique: true, sparse: true, name: PROPOSAL_INDEX }
    );
    expect(collection.dropIndex).toHaveBeenCalledWith(LEGACY_INDEX);
    expect(collection.createIndex.mock.invocationCallOrder[0])
      .toBeLessThan(collection.dropIndex.mock.invocationCallOrder[0]);
  });
});
