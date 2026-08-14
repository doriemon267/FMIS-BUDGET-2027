// One-time, create-before-drop migration for existing COS collections.
const mongoose = require('mongoose');
require('dotenv').config();

const LEGACY_INDEX = 'employeeNumber_1_fiscalYear_1';
const PROPOSAL_INDEX = 'workflowRef_1_employeeNumber_1_fiscalYear_1';

const isObjectId = (value) => value instanceof mongoose.Types.ObjectId
  || value?._bsontype === 'ObjectId';
const isObjectIdString = (value) => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value.trim());

const migrationError = (message, report) => {
  const error = new Error(message);
  error.code = 'COS_WORKFLOW_REF_AUDIT_FAILED';
  error.report = report;
  return error;
};

const migrateCOSProposalIndex = async (collection, {
  workflowCollection,
  logger = console,
} = {}) => {
  const indexes = await collection.indexes();
  const existingNames = new Set(indexes.map((index) => index.name));
  const rows = await collection.find(
    {},
    { projection: { _id: 1, workflowRef: 1, employeeNumber: 1, fiscalYear: 1 } }
  ).toArray();
  const legacyRows = rows.filter((row) => row.workflowRef == null);
  const stringRows = rows.filter((row) => typeof row.workflowRef === 'string');
  const invalidRows = rows.filter((row) => (
    row.workflowRef != null
    && typeof row.workflowRef !== 'string'
    && !isObjectId(row.workflowRef)
  ));
  const invalidStringRows = stringRows.filter((row) => !isObjectIdString(row.workflowRef));
  const report = {
    totalRows: rows.length,
    legacyNullOrMissing: legacyRows.length,
    validStringRefs: stringRows.length - invalidStringRows.length,
    invalidRefs: [...invalidRows, ...invalidStringRows].map((row) => String(row._id)),
    orphanRefs: [],
    logicalDuplicates: [],
    normalizedRows: 0,
  };

  if (report.invalidRefs.length > 0) {
    throw migrationError(
      `Found ${report.invalidRefs.length} COS rows with invalid workflowRef values; no changes were made.`,
      report
    );
  }

  const scopedRows = rows.filter((row) => row.workflowRef != null);
  const referencedIds = [...new Map(scopedRows.map((row) => {
    const objectId = isObjectId(row.workflowRef)
      ? new mongoose.Types.ObjectId(String(row.workflowRef))
      : new mongoose.Types.ObjectId(row.workflowRef.trim());
    return [objectId.toHexString(), objectId];
  })).values()];

  if (referencedIds.length > 0) {
    if (!workflowCollection) {
      throw migrationError('A workflow collection is required to validate COS workflowRef values.', report);
    }
    const workflows = await workflowCollection.find(
      { _id: { $in: referencedIds } },
      { projection: { _id: 1 } }
    ).toArray();
    const foundIds = new Set(workflows.map((workflow) => String(workflow._id)));
    report.orphanRefs = referencedIds
      .map((id) => id.toHexString())
      .filter((id) => !foundIds.has(id));
    if (report.orphanRefs.length > 0) {
      throw migrationError(
        `Found ${report.orphanRefs.length} workflowRef values without a NewProposalWorkflow; no changes were made.`,
        report
      );
    }
  }

  const logicalKeys = new Map();
  for (const row of scopedRows) {
    const workflowId = isObjectId(row.workflowRef)
      ? String(row.workflowRef)
      : new mongoose.Types.ObjectId(row.workflowRef.trim()).toHexString();
    const key = `${workflowId}|${String(row.employeeNumber ?? '')}|${String(row.fiscalYear ?? '')}`;
    const ids = logicalKeys.get(key) || [];
    ids.push(String(row._id));
    logicalKeys.set(key, ids);
  }
  report.logicalDuplicates = [...logicalKeys.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([key, ids]) => ({ key, ids }));
  if (report.logicalDuplicates.length > 0) {
    throw migrationError(
      `Found ${report.logicalDuplicates.length} logical duplicates after workflowRef normalization; no changes were made.`,
      report
    );
  }

  if (stringRows.length > 0) {
    await collection.bulkWrite(stringRows.map((row) => ({
      updateOne: {
        filter: { _id: row._id, workflowRef: row.workflowRef },
        update: { $set: { workflowRef: new mongoose.Types.ObjectId(row.workflowRef.trim()) } },
      },
    })), { ordered: true });
    report.normalizedRows = stringRows.length;
  }

  // Create the proposal constraint only after references are canonical and
  // verified. The legacy global constraint remains in place until this succeeds.
  if (!existingNames.has(PROPOSAL_INDEX)) {
    await collection.createIndex(
      { workflowRef: 1, employeeNumber: 1, fiscalYear: 1 },
      { unique: true, sparse: true, name: PROPOSAL_INDEX }
    );
  }

  if (existingNames.has(LEGACY_INDEX)) {
    await collection.dropIndex(LEGACY_INDEX);
  }
  if (legacyRows.length > 0) {
    logger.warn(`Retained ${legacyRows.length} legacy COS rows with null/missing workflowRef in the legacy namespace.`);
  }
  return report;
};

const run = async () => {
  const mongoUri = process.env.MONGODB_URI
    || process.env.MONGODB_BUDGET_URL
    || process.env.MONGODB_URL
    || process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('Set MONGODB_URI, MONGODB_BUDGET_URL, MONGODB_URL, or MONGO_URI.');
  }
  await mongoose.connect(mongoUri);
  try {
    const report = await migrateCOSProposalIndex(
      mongoose.connection.collection('cospersonnels'),
      { workflowCollection: mongoose.connection.collection('newproposalworkflows') }
    );
    console.log('Migration report:', report);
    console.log('COS proposal-aware unique index migration completed.');
  } finally {
    await mongoose.disconnect();
  }
};

if (require.main === module) {
  run().catch((error) => {
    console.error('COS index migration failed:', error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  LEGACY_INDEX,
  PROPOSAL_INDEX,
  isObjectIdString,
  migrateCOSProposalIndex,
};
