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
          unique: true,
          background: true,
          partialFilterExpression: {
            proposalId: { $exists: true },
            uacsCode: { $exists: true },
            fiscalYear: { $exists: true },
            region: { $exists: true },
          },
        }
      );
    } catch (error) {
      if (error.code !== 85) {
        log.error?.(`[DB Indexes] Failed ensuring MOOE unique index: ${error.message}`);
      }
    }

    const capitalOutlayCollection = await dropMatchingUniqueIndexes("capitaloutlays", (index) => {
      const key = index?.key || {};
      return (
        key.uacsCode === 1 &&
        key.region === 1 &&
        key.fiscalYear === 1 &&
        key.sublineItem === 1 &&
        (!key.proposalId || key.proposalId !== 1)
      );
    });

    try {
      await capitalOutlayCollection.createIndex(
        { proposalId: 1, uacsCode: 1, region: 1, fiscalYear: 1, sublineItem: 1 },
        {
          unique: true,
          background: true,
          partialFilterExpression: {
            proposalId: { $exists: true },
            uacsCode: { $exists: true },
            region: { $exists: true },
            fiscalYear: { $exists: true },
            sublineItem: { $exists: true },
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

    log.info?.("[DB Indexes] Index verification completed.");
  } catch (error) {
    log.error?.(`[DB Indexes] Verification failed: ${error.message}`);
  }
}

module.exports = { ensureDatabaseIndexes };
