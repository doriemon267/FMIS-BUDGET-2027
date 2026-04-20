require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const UserActivityLog = require('../models/UserActivityLog');
const User = require('../models/User');
const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');

function getMongoUri() {
  return (
    process.env.MONGODB_URI ||
    process.env.MONGODB_URI_BUDGET ||
    process.env.MONGODB_BUDGET_URL ||
    process.env.MONGODB_URL ||
    process.env.DATABASE_URL ||
    'mongodb://127.0.0.1:27017/fmis_budget'
  );
}

function sanitizeUri(uri) {
  return String(uri || '').replace(/:\/\/([^:]+):([^@]+)@/, '://<redacted>@');
}

function looksLikeCode(value) {
  const text = String(value || '').trim();
  if (!text) return true;

  // Common patterns observed in logs: pure numeric IDs or short username codes.
  if (/^\d{4,}$/.test(text)) return true;
  if (/^[A-Za-z0-9._-]{4,}$/.test(text) && !/\s/.test(text)) return true;
  return false;
}

function pickDisplayName({ userDoc, huaDoc, fallbackId }) {
  const userName = String(userDoc?.name || '').trim();
  if (userName) return userName;

  const assignmentName = String(huaDoc?.userName || '').trim();
  if (assignmentName) return assignmentName;

  return String(fallbackId || '').trim();
}

async function connect() {
  const uri = getMongoUri();
  mongoose.set('strictQuery', false);
  await mongoose.connect(uri, { autoIndex: false });
  console.log('Connected to MongoDB:', sanitizeUri(uri));
}

async function runBackfill({ apply = false } = {}) {
  console.log('Starting auth username backfill. Mode:', apply ? 'APPLY' : 'DRY-RUN');

  const query = {
    resource: 'Auth',
    $or: [
      { userName: { $exists: false } },
      { userName: null },
      { userName: '' },
      { $expr: { $eq: ['$userName', '$userId'] } },
      { userName: { $regex: '^\\d{4,}$' } },
      { userName: { $regex: '^[A-Za-z0-9._-]{4,}$' } },
    ],
  };

  const candidates = await UserActivityLog.find(query)
    .select('_id userId userName action resource timestamp')
    .lean();

  // Extra safety: keep only rows that still look code-like after fetch.
  const filteredCandidates = candidates.filter((row) => looksLikeCode(row.userName));

  console.log('Candidate logs found:', candidates.length);
  console.log('Filtered code-like candidates:', filteredCandidates.length);

  if (filteredCandidates.length === 0) {
    console.log('Nothing to backfill.');
    return { matched: 0, updatable: 0, modified: 0 };
  }

  const userIds = Array.from(
    new Set(filteredCandidates.map((row) => String(row.userId || '').trim()).filter(Boolean))
  );

  const [userDocs, huaDocs] = await Promise.all([
    User.find({ userId: { $in: userIds } }).select('userId name').lean(),
    HierarchicalUserAssignment.find({ userId: { $in: userIds } }).select('userId userName').lean(),
  ]);

  const userById = new Map(userDocs.map((doc) => [String(doc.userId), doc]));
  const huaById = new Map(huaDocs.map((doc) => [String(doc.userId), doc]));

  const updates = [];
  for (const row of filteredCandidates) {
    const uid = String(row.userId || '').trim();
    if (!uid) continue;

    const nextName = pickDisplayName({
      userDoc: userById.get(uid),
      huaDoc: huaById.get(uid),
      fallbackId: uid,
    });

    if (!nextName || nextName === row.userName) continue;

    updates.push({
      updateOne: {
        filter: { _id: row._id },
        update: { $set: { userName: nextName } },
      },
    });
  }

  console.log('Logs with resolvable full name:', updates.length);

  if (!apply) {
    const preview = filteredCandidates.slice(0, 10).map((row) => {
      const uid = String(row.userId || '').trim();
      const previewName = pickDisplayName({
        userDoc: userById.get(uid),
        huaDoc: huaById.get(uid),
        fallbackId: uid,
      });
      return {
        id: String(row._id),
        action: row.action,
        before: row.userName,
        after: previewName,
      };
    });
    console.log('Preview (first 10):');
    console.table(preview);
    return { matched: filteredCandidates.length, updatable: updates.length, modified: 0 };
  }

  if (updates.length === 0) {
    console.log('No updates to apply.');
    return { matched: filteredCandidates.length, updatable: 0, modified: 0 };
  }

  const result = await UserActivityLog.bulkWrite(updates, { ordered: false });
  const modified = result?.modifiedCount || 0;

  console.log('Backfill applied successfully.');
  console.log('Modified rows:', modified);

  return { matched: filteredCandidates.length, updatable: updates.length, modified };
}

(async function main() {
  const apply = process.argv.includes('--apply');
  try {
    await connect();
    const summary = await runBackfill({ apply });
    console.log('Summary:', summary);
    if (!apply) {
      console.log('Run again with --apply to persist changes.');
    }
  } catch (error) {
    console.error('Backfill failed:', error?.message || error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB connection closed.');
  }
})();
