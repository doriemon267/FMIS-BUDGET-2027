require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const MooeProposal = require('../models/MooeProposal');

async function connectDatabase() {
  const defaultUri = 'mongodb://127.0.0.1:27017/fmis-budget-september';
  const uri = process.env.MONGODB_URI
    || process.env.MONGODB_URI_BUDGET
    || process.env.MONGODB_BUDGET_URL
    || process.env.MONGODB_URL
    || process.env.DATABASE_URL
    || defaultUri;

  if (!uri) {
    throw new Error('No MongoDB connection string found. Set MONGODB_URI, MONGODB_BUDGET_URL, or MONGODB_URL.');
  }

  mongoose.set('strictQuery', false);
  await mongoose.connect(uri, { autoIndex: false });
  
  // Sanitize URI for logging (remove credentials)
  const sanitizedUri = uri.replace(/:\/\/([^:]+):([^@]+)@/, '://<redacted>@');
  console.log(`✅ Connected to MongoDB: ${sanitizedUri}`);
}

async function backfillDivisionOrigin() {
  console.log('🔄 Starting backfill for division-origin MOOE proposals...');

  // Records that have a division but missing/incorrect original level metadata
  const divisionQuery = {
    division: { $exists: true, $nin: [null, ''] },
    $or: [
      { originalLevel: { $exists: false } },
      { originalLevel: null },
      { originalLevel: '' },
      { originalLevel: { $ne: 'DIVISION' } }
    ]
  };

  const workflowQuery = {
    division: { $exists: true, $nin: [null, ''] },
    $or: [
      { workflowLevel: { $exists: false } },
      { workflowLevel: { $nin: [null, '', 'DIVISION'] } }
    ]
  };

  const [divisionFixResult, workflowFixResult] = await Promise.all([
    MooeProposal.updateMany(divisionQuery, {
      $set: { originalLevel: 'DIVISION' }
    }),
    MooeProposal.updateMany(workflowQuery, {
      $set: { workflowLevel: 'DIVISION' }
    })
  ]);

  console.log('✅ Backfill complete. Summary:');
  console.log(`   • originalLevel updates applied to: ${divisionFixResult.modifiedCount}`);
  console.log(`   • workflowLevel updates applied to: ${workflowFixResult.modifiedCount}`);

  return { divisionFixResult, workflowFixResult };
}

(async function run() {
  try {
    await connectDatabase();
    await backfillDivisionOrigin();
  } catch (error) {
    console.error('❌ Backfill failed:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 MongoDB connection closed.');
  }
})();