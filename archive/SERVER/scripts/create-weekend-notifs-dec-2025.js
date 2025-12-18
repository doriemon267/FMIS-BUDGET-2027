/*
Usage:
  NODE_ENV=production node scripts/create-weekend-notifs-dec-2025.js --role=BUDGET_MANAGER --title="Weekend Work" --message="Please complete the assigned FMIS work" --dry-run=true

Options:
  --role=ROLE                (optional) Use a role as recipient. If provided, the notification creator will expand roles only if your system is configured to expand roles (same as app logic).
  --user=UID                 (optional) Specify a single userId. Can be a numeric string, email, or role-like string.
  --users=UID,UID2           (optional) Provide multiple comma-separated UIDs.
  --message="..."           (optional) Notification message content
  --title="..."             (optional) Notification title
  --dry-run=true|false       (default true) Do not insert into DB, just preview
  --insert-as-created        (default false) Set createdAt to scheduled date
*/

const path = require('path');
const dotenv = require('dotenv');
const connect = require('../config/mongo_db');
const Notification = require('../models/Notification');

// Load env from SERVER/.env
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const argvToObj = () => {
  const result = {};
  process.argv.slice(2).forEach(a => {
    const [k, ...rest] = a.split('=');
    const key = k.replace(/^--/, '');
    const value = rest.join('=') || 'true';
    result[key] = value;
  });
  return result;
};

const parseBool = (v, defaultV=false) => {
  if (v === undefined) return defaultV;
  const s = String(v).toLowerCase();
  if (s === 'true' || s === '1' || s === 'yes') return true;
  if (s === 'false' || s === '0' || s === 'no') return false;
  return defaultV;
};

(async () => {
  try {
    console.log('Connecting to MongoDB...');
    await connect();

    const opt = argvToObj();
    const dryRun = parseBool(opt['dry-run'], true);
    const recipients = [];
    if (opt.role) recipients.push(opt.role);
    if (opt.user) recipients.push(opt.user);
    if (opt.users) recipients.push(...opt.users.split(',').map(v => v.trim()).filter(Boolean));

    // Default recipient if none supplied
    if (!recipients.length) recipients.push('BUDGET_MANAGER');

    const title = opt.title || 'Specific Weekend Work';
    const message = opt.message || 'Please complete the assigned FMIS budget review tasks.';
    const insertAsCreated = parseBool(opt['insert-as-created'], false);

    // Saturdays and Sundays of December 2025
    const dates = [
      '2025-12-06','2025-12-07','2025-12-13','2025-12-14',
      '2025-12-20','2025-12-21','2025-12-27','2025-12-28'
    ];

    const now = new Date();
    const notifications = [];

    for (const d of dates) {
      const scheduled = new Date(d + 'T09:00:00Z'); // scheduled time set to 09:00 UTC by default

      for (const r of recipients) {
        const key = `weekend-2025-12-${d.replace(/-/g,'')}-${String(r).replace(/[^a-zA-Z0-9_-]/g,'')}`;
        const n = {
          recipientUserId: r,
          recipientUserIdOriginal: r,
          recipientUserIdNormalized: r, // controller will normalize again if needed
          title,
          message,
          metadata: {
            scheduledAt: scheduled,
            uniqueKey: key
          },
          createdBy: { userId: 'system', name: 'Weekend Scheduler Script' },
          createdAt: insertAsCreated ? scheduled : now
        };
        notifications.push(n);
      }
    }

    console.log(`Prepared ${notifications.length} notification(s).`);

    if (dryRun) {
      console.log('Dry-run mode: showing sample insert(s)');
      console.log(JSON.stringify(notifications.slice(0, Math.min(10, notifications.length)), null, 2));
      console.log('To insert into DB, run with --dry-run=false');
      process.exit(0);
    }

    // Do dedupe per recipient+uniqueKey similar to Notification controller logic
    const toInsert = [];
    for (const n of notifications) {
      try {
        const exists = await Notification.findOne({ recipientUserId: n.recipientUserId, 'metadata.uniqueKey': n.metadata.uniqueKey, status: 'UNREAD' }).lean();
        if (exists) {
          console.log('Skipping existing UNREAD notification for recipient:', n.recipientUserId, 'key:', n.metadata.uniqueKey);
          continue;
        }
      } catch (e) {
        console.warn('Dedupe check failed', e.message);
      }
      toInsert.push(n);
    }

    if (!toInsert.length) {
      console.log('No new notifications to insert. All existing or duplicate.');
      process.exit(0);
    }

    const inserted = await Notification.insertMany(toInsert);
    console.log(`Inserted ${inserted.length} notification(s).`);
    process.exit(0);

  } catch (err) {
    console.error('Failed', err?.message || err);
    process.exit(1);
  } finally {
    try { await require('mongoose').connection.close(); } catch (_) {}
  }
})();
