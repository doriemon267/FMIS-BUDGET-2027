async function ensureDatabaseIndexes(mongoose, logger = console) {
  const log = logger || console;

  try {
    const db = mongoose.connection.db;

    const dropMatchingUniqueIndexes = async (collectionName, shouldDrop) => {
      const collection = db.collection(collectionName);
      const indexes = await collection.indexes();

      for (const index of indexes) {
        if (!index?.unique || !shouldDrop(index)) continue;
        try {
          await collection.dropIndex(index.name);
          log.info?.(`[DB Indexes] Dropped legacy unique index ${collectionName}.${index.name}`);
        } catch (error) {
          log.warn?.(`[DB Indexes] Failed dropping ${collectionName}.${index.name}: ${error.message}`);
        }
      }

      return collection;
    };

    const mooeCollection = await dropMatchingUniqueIndexes("mooeproposals", (index) => {
      const key = index?.key || {};
      return key.uacsCode === 1 && key.fiscalYear === 1 && (!key.proposalId || key.proposalId !== 1);
    });

    try {
      await mooeCollection.createIndex(
        { proposalId: 1, uacsCode: 1, fiscalYear: 1, region: 1, department: 1, division: 1 },
        {
          background: true,
          name: "proposalId_1_uacsCode_1_fiscalYear_1_region_1_department_1_division_1",
          partialFilterExpression: {
            proposalId: { $exists: true },
            uacsCode: { $exists: true },
            fiscalYear: { $exists: true },
            region: { $exists: true },
          },
        }
      );
    } catch (error) {
      log.error?.(`[DB Indexes] Failed ensuring MOOE proposal lookup index: ${error.message}`);
    }

    const capitalOutlayCollection = await dropMatchingUniqueIndexes("capitaloutlays", (index) => {
      const key = index?.key || {};
      return (
        key.uacsCode === 1 &&
        key.region === 1 &&
        key.fiscalYear === 1 &&
        key.sublineItem === 1 &&
        (!key.category || !key.department)
      );
    });

    try {
      await capitalOutlayCollection.createIndex(
        { proposalId: 1, uacsCode: 1, region: 1, department: 1, fiscalYear: 1, sublineItem: 1, category: 1 },
        {
          unique: true,
          background: true,
          partialFilterExpression: {
            proposalId: { $exists: true },
            uacsCode: { $exists: true },
            region: { $exists: true },
            department: { $exists: true },
            fiscalYear: { $exists: true },
            sublineItem: { $exists: true },
            category: { $exists: true },
          },
        }
      );
    } catch (error) {
      if (error.code !== 85) {
        log.error?.(`[DB Indexes] Failed ensuring Capital Outlay unique index: ${error.message}`);
      }
    }

    try {
      const settingsCollection = mongoose.connection.db.collection("settings");
      const settingsIndexes = await settingsCollection.indexes();
      const hasUniqueFiscalYearOnly = settingsIndexes.some(
        (index) => index.key && index.key.fiscalYear === 1 && index.unique && !index.key.budgetType
      );

      if (hasUniqueFiscalYearOnly) {
        try {
          await settingsCollection.dropIndex("fiscalYear_1");
        } catch (error) {
          log.warn?.(`[DB Indexes] Failed dropping settings.fiscalYear_1: ${error.message}`);
        }
      }

      try {
        await settingsCollection.createIndex({ fiscalYear: 1, budgetType: 1 }, { unique: true, background: true });
      } catch (error) {
        if (error.code !== 85) {
          log.error?.(`[DB Indexes] Failed ensuring Settings unique index: ${error.message}`);
        }
      }
    } catch (error) {
      log.warn?.(`[DB Indexes] Settings index check skipped: ${error.message}`);
    }

    // --- SELF-HEALING BACKFILL FOR BULK-UPLOADED RECORDS ---
    // In some bulk uploads, proposalId is written but workflowRef is missing.
    // This backfills workflowRef so these records show up in consolidated/budgetary support reports.
    try {
      log.info?.("[DB Indexes] Starting self-healing backfill for bulk-uploaded workflowRefs...");
      const mongoose = require('mongoose');
      
      // 1. Capital Outlay
      const CapitalOutlayModel = mongoose.model('CapitalOutlay');
      const coRes = await CapitalOutlayModel.updateMany(
        { proposalId: { $ne: null }, $or: [{ workflowRef: null }, { workflowRef: { $exists: false } }] },
        [{ $set: { workflowRef: "$proposalId" } }]
      );
      if (coRes.modifiedCount > 0) {
        log.info?.(`[DB Indexes] Backfilled workflowRef for ${coRes.modifiedCount} CapitalOutlay records.`);
      }

      // 2. MOOE Proposals
      const MooeProposalModel = mongoose.model('MooeProposal');
      const mooeRes = await MooeProposalModel.updateMany(
        { proposalId: { $ne: null }, $or: [{ workflowRef: null }, { workflowRef: { $exists: false } }] },
        [{ $set: { workflowRef: "$proposalId" } }]
      );
      if (mooeRes.modifiedCount > 0) {
        log.info?.(`[DB Indexes] Backfilled workflowRef for ${mooeRes.modifiedCount} MooeProposal records.`);
      }

      // 3. Corporate Income
      const IncomeModel = mongoose.model('Income');
      const incomeRes = await IncomeModel.updateMany(
        { proposalId: { $ne: null }, $or: [{ workflowRef: null }, { workflowRef: { $exists: false } }] },
        [{ $set: { workflowRef: "$proposalId" } }]
      );
      if (incomeRes.modifiedCount > 0) {
        log.info?.(`[DB Indexes] Backfilled workflowRef for ${incomeRes.modifiedCount} Income records.`);
      }
      
      log.info?.("[DB Indexes] Self-healing backfill completed.");
    } catch (backfillError) {
      log.warn?.(`[DB Indexes] Self-healing backfill failed: ${backfillError.message}`);
    }

    log.info?.("[DB Indexes] Index verification completed.");
  } catch (error) {
    log.error?.(`[DB Indexes] Verification failed: ${error.message}`);
  }
}

module.exports = { ensureDatabaseIndexes };
