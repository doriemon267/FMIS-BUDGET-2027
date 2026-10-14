/*
 Backfill Office notifications for existing Responsibility Center submissions.
 - Mirrors current creation logic in submissionWorkflowControl (RC → Office).
 - Groups pending items by entity and org (region/department), then creates one
   notification per recipient per group.
 - Skips creating duplicates if a recent backfill notification already exists.

 Usage:
   NODE_ENV=production node database-scripts/backfill_notifications_office_submit.js
   (Ensure SERVER/.env has MONGODB_URL and any required config.)
*/

const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables from SERVER/.env
const envPath = path.join(__dirname, '..', '.env');
dotenv.config({ path: envPath });

const connect = require('../config/mongo_db');
const Notification = require('../models/Notification');
const { getUsersWithWorkflowRole } = require('../helpers/workflowRoleManager');

// Keep entity mapping consistent with submissionWorkflowControl.js
const getModelByEntity = (entity) => {
  switch (entity) {
    case 'personnel':
      return require('../models/personnelServices');
    case 'mooe':
      return require('../models/MooeProposal');
    case 'capital':
      return require('../models/CapitalOutlay');
    case 'income':
      return require('../models/Income');
    case 'budgetarySupport':
      return require('../models/BudgetarySupport');
    default:
      return require('../models/personnelServices');
  }
};

// Normalize string for org matching
const norm = (v) => (v == null ? '' : String(v).trim().toUpperCase());

// Use same candidate picking priority as runtime creation
const pickRecipientId = (u) => {
  const first = (v) => Array.isArray(v) ? v[0] : v;
  const candidates = [
    u.userId, u.UserId, u.UserID,
    first(u.Username), u.username,
    u.userCode, u.UserCode,
    u.employeeCode, u.EmployeeCode,
    u.empCode, u.EmpCode,
    u.id, u.Id, u.ID
  ].map(v => v != null ? String(v).trim() : '').filter(Boolean);
  return candidates[0] || String(u.id || '');
};

// Status variants that indicate items are at Office for verification
const RC_SUBMITTED_VARIANTS = [
  'Responsibility Center Submitted',
  'RESPONSIBILITY_CENTER SUBMITTED',
  'RESPONSIBILITY_CENTER_SUBMITTED'
];

(async () => {
  try {
    console.log('Connecting to MongoDB...');
    await connect();

    const entities = ['personnel', 'mooe', 'capital', 'income', 'budgetarySupport'];
    const now = new Date();

    let totalGroups = 0;
    let totalRecipients = 0;
    let totalInserted = 0;

    for (const entity of entities) {
      const Model = getModelByEntity(entity);
      // Find items that appear to be pending at Office verification stage
      const pending = await Model.find({
        status: { $in: RC_SUBMITTED_VARIANTS }
      }).select('region department division').lean();

      if (!pending.length) {
        console.log(`[${entity}] No pending items found.`);
        continue;
      }

      // Group ids by org (region + department). Division optional and carried over.
      const groups = new Map();
      for (const d of pending) {
        const key = `${norm(d.region)}|${norm(d.department)}`;
        const entry = groups.get(key) || { ids: [], sample: d };
        entry.ids.push(d._id);
        // Prefer the first non-empty division
        if (!entry.sample.division && d.division) entry.sample.division = d.division;
        groups.set(key, entry);
      }

      console.log(`[${entity}] Found ${groups.size} org group(s) for pending items.`);
      totalGroups += groups.size;

      // Fetch office consolidators (new + legacy naming)
      const officePrimary = await getUsersWithWorkflowRole('officeConsolidator');
      const officeLegacy = await getUsersWithWorkflowRole('departmentConsolidator');
      const officeUsers = [...officePrimary, ...officeLegacy];

      for (const [key, { ids, sample }] of groups.entries()) {
        const reg = norm(sample?.region);
        const dep = norm(sample?.department);

        // Filter recipients by org
        let recipients = officeUsers.filter(u =>
          (!reg || norm(u.region) === reg) && (!dep || norm(u.department) === dep)
        );
        if (!recipients.length) {
          // Fallback: all office consolidators if org match fails
          recipients = officeUsers;
        }
        if (!recipients.length) continue;

        totalRecipients += recipients.length;

        // Create notifications per recipient with dedupe check
        const toInsert = [];
        for (const u of recipients) {
          const recipientUserId = pickRecipientId(u);
          if (!recipientUserId) continue;

          // Deduplicate: skip if a recent backfill notification for same recipient+entity+org exists
          const recentSince = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000); // 14 days
          const existing = await Notification.findOne({
            recipientUserId,
            entity,
            'org.region': sample?.region || null,
            'org.department': sample?.department || null,
            title: { $regex: /^Pending Responsibility Center submissions \(backfill\)/i },
            createdAt: { $gte: recentSince }
          }).lean();
          if (existing) continue;

          toInsert.push({
            recipientUserId,
            title: 'Pending Responsibility Center submissions (backfill)',
            message: `${ids.length} item(s) require Office verification.`,
            entity,
            recordIds: ids.slice(0, 1000), // guard: cap to reasonable size
            org: {
              region: sample?.region || null,
              department: sample?.department || null,
              division: sample?.division || null
            },
            createdBy: { userId: 'system', name: 'Backfill Script' }
          });
        }

        if (toInsert.length) {
          const res = await Notification.insertMany(toInsert, { ordered: false });
          totalInserted += res.length;
          console.log(`Inserted ${res.length} notification(s) for group ${key}.`);
        }
      }
    }

    console.log('Backfill complete:', { totalGroups, totalRecipients, totalInserted });
  } catch (err) {
    console.error('Backfill failed:', err?.message);
    process.exitCode = 1;
  } finally {
    try { await mongoose.connection.close(); } catch (_) {}
  }
})();