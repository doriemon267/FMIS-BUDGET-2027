#!/usr/bin/env node
/*
  Migration: Normalize recipientUserId values in notifications to a canonical form,
  and store it in `recipientUserIdNormalized` to avoid breaking data.
  This script is safe to re-run and will only add the normalized field.
*/
require('dotenv').config();
const mongoose = require('mongoose');
const connectToMongoDB = require('../config/mongo_db');
const Notification = require('../models/Notification');

const normalizeRole = (raw) => {
  if (!raw || typeof raw !== 'string') return raw;
  // Trim
  let s = raw.trim();
  // If it looks like email or UUID or numeric id, skip
  if (s.includes('@')) return null;
  if (/^[0-9a-fA-F\-]{8,}$/.test(s)) return null;
  // Normalize spaces, slashes and hyphens → underscores, uppercase
  s = s.toUpperCase().replace(/\s+/g, '_').replace(/[\/\-]+/g, '_').replace(/[^A-Z0-9_]/g, '_');
  return s;
};

async function normalizeRecipientIds() {
  try {
  await connectToMongoDB();
    console.log('Connected to MongoDB');
    let updated = 0;
    for await (const doc of Notification.find().cursor()) {
      const current = doc.recipientUserId;
      const normalized = normalizeRole(current);
      if (normalized && doc.recipientUserIdNormalized !== normalized) {
        await Notification.updateOne({ _id: doc._id }, { $set: { recipientUserIdNormalized: normalized, recipientUserIdOriginal: current } });
        updated++;
      }
  }
    console.log(`Migration done. Normalized ${updated} notification recipients.`);
    return updated;
  } catch (e) {
    console.error('Migration failed:', e);
    throw e;
  }
}

if (require.main === module) {
  normalizeRecipientIds().then((count) => process.exit(0)).catch(() => process.exit(1));
}

module.exports = normalizeRecipientIds;
