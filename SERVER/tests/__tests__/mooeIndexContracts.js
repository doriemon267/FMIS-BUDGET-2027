const fs = require('fs');
const path = require('path');

const { ensureDatabaseIndexes } = require('../../config/dbIndexes');

const MOOE_INDEX_NAME = 'proposalId_1_uacsCode_1_fiscalYear_1_region_1_department_1_division_1';

describe('MOOE proposal lookup index contract', () => {
  test('startup accepts the canonical non-unique proposal-scoped index', async () => {
    const collections = new Map();
    const getCollection = (name) => {
      if (!collections.has(name)) {
        collections.set(name, {
          indexes: jest.fn().mockResolvedValue([]),
          createIndex: jest.fn().mockResolvedValue(`${name}-index`),
          dropIndex: jest.fn().mockResolvedValue({ ok: 1 }),
        });
      }
      return collections.get(name);
    };
    const mongoose = {
      connection: {
        db: { collection: jest.fn(getCollection) },
      },
      model: jest.fn(() => ({
        updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
      })),
    };
    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    await ensureDatabaseIndexes(mongoose, logger);

    expect(getCollection('mooeproposals').createIndex).toHaveBeenCalledWith(
      { proposalId: 1, uacsCode: 1, fiscalYear: 1, region: 1, department: 1, division: 1 },
      {
        background: true,
        name: MOOE_INDEX_NAME,
        partialFilterExpression: {
          proposalId: { $exists: true },
          uacsCode: { $exists: true },
          fiscalYear: { $exists: true },
          region: { $exists: true },
        },
      }
    );
    expect(logger.error).not.toHaveBeenCalledWith(
      expect.stringContaining('MOOE proposal lookup index')
    );
  });

  test('model loading and bulk upload never drop the canonical index at runtime', () => {
    const modelSource = fs.readFileSync(
      path.join(__dirname, '../../models/MooeProposal.js'),
      'utf8'
    );
    const uploadSource = fs.readFileSync(
      path.join(__dirname, '../../controllers/mooeExcelUploadController.js'),
      'utf8'
    );

    expect(modelSource).not.toContain('.collection.dropIndex(');
    expect(uploadSource).not.toContain('.collection.dropIndex(');
    expect(modelSource).toContain(`name: '${MOOE_INDEX_NAME}'`);
  });
});
