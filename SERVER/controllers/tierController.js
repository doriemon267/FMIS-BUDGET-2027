const mongoose = require('mongoose');
const Tier = require('../models/Tier');
const TierRevision = require('../models/TierRevision');
const User = require('../models/User');
const PersonnelServices = require('../models/PersonnelServices');
const CapitalOutlay = require('../models/CapitalOutlay');
const mooeProposals = require('../models/mooeProposals');
const NewProposalWorkflow = require('../models/NewProposalWorkflow');
const fs = require('fs');
const os = require('os');
const path = require('path');
let MuhammaraRecipe;
try {
  MuhammaraRecipe = require('muhammara').Recipe;
} catch (e) {
  MuhammaraRecipe = null;
}

/**
 * Build a broad TierRevision query that matches region, department, and division by both name and ObjectId
 * (handles docs stored either way — e.g. region saved as name in one save, ObjectId in another).
 * Returns { query, normalizedScope } — use `query` for TierRevision lookups, `normalizedScope` for new doc creation.
 */
const buildRevisionQuery = async (fiscalYear, region, department, division) => {
  const scope = await normalizeTierScope(fiscalYear, region, department, division);
  const rawRegion = String(region || '');
  const rawDepartment = String(department ?? '');
  const rawDivision = String(division ?? '');

  // --- Region: match by normalized name AND raw value AND any ObjectId for that region name ---
  const regionValues = [scope.region].filter(Boolean);
  if (rawRegion && !regionValues.includes(rawRegion)) regionValues.push(rawRegion);
  try {
    const Region = require('../models/Region');
    if (rawRegion && mongoose.Types.ObjectId.isValid(rawRegion) && rawRegion.length === 24) {
      const r = await Region.findById(rawRegion).select('Region').lean();
      if (r && r.Region && !regionValues.includes(String(r.Region))) regionValues.push(String(r.Region));
    }
    if (scope.region) {
      const ids = await Region.find({ Region: scope.region }).select('_id').lean();
      ids.forEach((r) => { const s = String(r._id); if (s && !regionValues.includes(s)) regionValues.push(s); });
    }
  } catch (e) { /* ignore */ }

  const regionFilter = regionValues.length === 0
    ? { region: scope.region || rawRegion }
    : regionValues.length === 1 ? { region: regionValues[0] } : { region: { $in: regionValues } };

  // --- Department: match by normalized name AND raw value AND any ObjectId for that dept name ---
  let departmentFilter;
  if (!scope.department && !rawDepartment) {
    // No department filter — match empty, null, or missing
    departmentFilter = { $or: [{ department: '' }, { department: null }, { department: { $exists: false } }] };
  } else {
    const deptValues = [scope.department].filter(Boolean);
    if (rawDepartment && !deptValues.includes(rawDepartment)) deptValues.push(rawDepartment);
    try {
      const Department = require('../models/Department');
      // If raw value is an ObjectId, resolve to name and add
      if (rawDepartment && mongoose.Types.ObjectId.isValid(rawDepartment) && rawDepartment.length === 24) {
        const d = await Department.findById(rawDepartment).select('Department').lean();
        if (d && d.Department && !deptValues.includes(String(d.Department))) deptValues.push(String(d.Department));
      }
      // Also collect ObjectIds for the normalized name (docs stored with ObjectId)
      if (scope.department) {
        const ids = await Department.find({ Department: scope.department }).select('_id').lean();
        ids.forEach((d) => { const s = String(d._id); if (s && !deptValues.includes(s)) deptValues.push(s); });
      }
    } catch (e) { /* ignore */ }
    departmentFilter = deptValues.length === 1 ? { department: deptValues[0] } : { department: { $in: deptValues } };
  }

  // --- Division: match by normalized value AND raw value (no collection, but include both) ---
  let divisionFilter;
  if (!scope.division && !rawDivision) {
    // No division filter — match empty, null, or missing
    divisionFilter = { $or: [{ division: '' }, { division: null }, { division: { $exists: false } }] };
  } else {
    const divValues = [scope.division].filter(Boolean);
    if (rawDivision && !divValues.includes(rawDivision)) divValues.push(rawDivision);
    divisionFilter = divValues.length === 1 ? { division: divValues[0] } : { division: { $in: divValues } };
  }

  const fiscalYearStr = String(scope.fiscalYear || '');

  // Merge filters — avoid duplicate $or keys by wrapping with $and when needed
  const filters = [regionFilter, departmentFilter, divisionFilter].filter(Boolean);
  const hasMultipleOrFilters = filters.filter((f) => f.$or).length > 1;

  let query;
  if (hasMultipleOrFilters) {
    // Use $and to combine multiple $or clauses
    const orFilters = filters.filter((f) => f.$or);
    const plainFilters = filters.filter((f) => !f.$or).reduce((acc, f) => ({ ...acc, ...f }), {});
    query = { fiscalYear: fiscalYearStr, ...plainFilters, $and: orFilters };
  } else {
    query = { fiscalYear: fiscalYearStr, ...filters.reduce((acc, f) => ({ ...acc, ...f }), {}) };
  }

  return { query, normalizedScope: scope };
};

/**
 * Normalize tier scope so save and getRevisions match whether user filtered by Region only, Department, or Division.
 * Resolves region/department/division IDs to canonical names; query logic then matches both name and any stored IDs.
 */
const normalizeTierScope = async (fiscalYear, region, department, division) => {
  const fy = String(fiscalYear || '');
  let regionVal = String(region || '');
  let dept = String(department ?? '');
  let div = String(division ?? '');

  try {
    const Region = require('../models/Region');
    let regionDoc = null;
    if (regionVal && mongoose.Types.ObjectId.isValid(regionVal) && regionVal.length === 24) {
      regionDoc = await Region.findById(regionVal).select('Region').lean();
    }
    if (!regionDoc && regionVal) {
      regionDoc = await Region.findOne({
        $or: [{ Region: regionVal }, { regionName: regionVal }, { name: regionVal }],
      }).select('Region').lean();
    }
    if (regionDoc && regionDoc.Region) regionVal = String(regionDoc.Region);
  } catch (e) {
    if (process.env.DEBUG_LOGS === 'true') console.debug('normalizeTierScope region lookup failed:', e?.message);
  }

  try {
    const Department = require('../models/Department');
    if (dept && mongoose.Types.ObjectId.isValid(dept) && dept.length === 24) {
      const deptDoc = await Department.findById(dept).select('Department').lean();
      if (deptDoc && deptDoc.Department) dept = String(deptDoc.Department);
    } else if (dept) {
      const deptDoc = await Department.findOne({
        $or: [{ Department: dept }, { Department: new RegExp(`^${String(dept).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }],
      }).select('Department').lean();
      if (deptDoc && deptDoc.Department) dept = String(deptDoc.Department);
    }
  } catch (e) {
    if (process.env.DEBUG_LOGS === 'true') console.debug('normalizeTierScope department lookup failed:', e?.message);
  }

  return { fiscalYear: fy, region: regionVal, department: dept, division: div };
};

/**
 * GET /api/tier/finalized-data
 * Returns PROJECTED CORPORATE INCOME and PROJECTED SUBSIDY (→ TIER 1) from Initial proposals at BRD level or finalized.
 * Tier is available once the proposal reaches BRD (Budget Planning Analyst → Budget Officer → Budget Manager) so that
 * Tier data saved here is what gets passed along until the Budget Manager finalizes.
 * Strictly filtered by fiscalYear (from current settings), region, department, division.
 */
const BRD_OR_FINALIZED_STATUSES = [
  'FINALIZED',
  'Finalized',
  'FORWARDED_TO_BRD_ANALYST',
  'FORWARDED_TO_BRD_OFFICER',
  'FORWARDED_TO_BRD_MANAGER',
];

/**
 * Resolve createdBy (User _id) and createdByName from req.user.
 * req.user.id may be SSO userId string (not MongoDB ObjectId); we look up User by userId when possible.
 */
const resolveCreatedBy = async (req) => {
  const uid = req.user?.id ?? req.user?.userId ?? req.user?._id ?? req.user?.Id;
  const displayName = req.user?.particular ?? req.user?.name ?? (req.user?.FirstName && req.user?.LastName ? `${req.user.FirstName} ${req.user.LastName}`.trim() : null) ?? req.user?.Username?.[0] ?? (uid != null ? String(uid) : '');
  let userObjectId = null;
  if (uid != null && uid !== '') {
    const uidStr = String(uid).trim();
    if (mongoose.Types.ObjectId.isValid(uidStr) && uidStr.length === 24) {
      userObjectId = new mongoose.Types.ObjectId(uidStr);
    }
    if (!userObjectId) {
      try {
        const userDoc = await User.findOne({ userId: uidStr }).select('_id name').lean();
        if (userDoc) {
          userObjectId = userDoc._id;
          return { createdBy: userObjectId, createdByName: userDoc.name || displayName || '' };
        }
      } catch (e) {
        if (process.env.DEBUG_LOGS === 'true') console.debug('TierRevision resolveCreatedBy User lookup failed:', e?.message);
      }
    } else {
      try {
        const userDoc = await User.findById(userObjectId).select('name').lean();
        if (userDoc) return { createdBy: userObjectId, createdByName: userDoc.name || displayName || '' };
      } catch (e) {
        if (process.env.DEBUG_LOGS === 'true') console.debug('TierRevision resolveCreatedBy User findById failed:', e?.message);
      }
    }
  }
  return { createdBy: userObjectId, createdByName: displayName || '' };
};

const getFinalizedData = async (req, res) => {
  try {
    const { fiscalYear, region, department, division } = req.query;

    if (!fiscalYear) {
      return res.status(400).json({
        success: false,
        message: 'fiscalYear is required (use current settings fiscal year).',
      });
    }

    const fy = parseInt(String(fiscalYear), 10);
    if (isNaN(fy)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid fiscalYear.',
      });
    }

    const query = {
      modelType: 'Initial',
      status: { $in: BRD_OR_FINALIZED_STATUSES },
      fiscalYear: fy,
    };

    if (region) {
      if (mongoose.Types.ObjectId.isValid(region)) {
        query.region = new mongoose.Types.ObjectId(region);
      } else {
        // Try to find region by name/string
        const Region = require('../models/Region');
        const regionDoc = await Region.findOne({
          $or: [
            { regionName: region },
            { Region: region },
            { name: region },
          ],
        });
        if (regionDoc) {
          query.region = regionDoc._id;
        } else {
          // If no match found, log warning and skip region filter
          console.warn(`Region not found for value: ${region}, proceeding without region filter`);
        }
      }
    }

    if (department) {
      // department is stored as a plain String — use case-insensitive regex to avoid case-mismatch misses
      query.department = new RegExp(`^${String(department).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    }

    if (division) {
      // division is stored as a plain String — use case-insensitive regex
      query.division = new RegExp(`^${String(division).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    }

    console.log('getFinalizedData query:', JSON.stringify(query, null, 2));
    const proposals = await NewProposalWorkflow.find(query).lean();
    console.log(`getFinalizedData found ${proposals.length} proposals`);

    const projectedCorporateIncome = proposals.reduce(
      (sum, p) => sum + (Number(p.projectedCorporateIncome) || 0),
      0
    );
    const projectedSubsidy = proposals.reduce(
      (sum, p) => sum + (Number(p.projectedSubsidy) || 0),
      0
    );

    res.json({
      success: true,
      hasFinalized: proposals.length > 0,
      hasTierData: proposals.length > 0,
      projectedCorporateIncome,
      projectedSubsidy,
      proposalCount: proposals.length,
      proposals: proposals.map((p) => ({
        _id: p._id,
        status: p.status,
        division: p.division,
        department: p.department,
        projectedCorporateIncome: p.projectedCorporateIncome,
        projectedSubsidy: p.projectedSubsidy,
      })),
    });
  } catch (error) {
    console.error('Error in getFinalizedData:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch finalized tier data.',
    });
  }
};

const getTierData = async (req, res) => {
  try {
    const { fiscalYear, region, department, division } = req.query;
    let queryConditions = { fiscalYear };
    if (region) queryConditions.region = region;
    if (department) queryConditions.department = department;
    if (division) queryConditions.division = division;

    const personnelServices = await PersonnelServices.find(queryConditions);
    const capitalOutlays = await CapitalOutlay.find(queryConditions);
    const mooeData = await mooeProposals.find(queryConditions);

    const tierDoc = await Tier.findOne(queryConditions);

    const getTierValue = (lineItemId, field) => {
      if (!tierDoc) return 0;
      const item = tierDoc.items.find(i => i.lineItemId.toString() === lineItemId.toString());
      return item ? item[field] : 0;
    };

    const personnelItems = personnelServices.map(p => ({
      _id: p._id,
      description: p.employeeFullName,
      tier1: getTierValue(p._id, 'tier1'),
      tier2: getTierValue(p._id, 'tier2'),
    }));

    const mooeItems = mooeData.map(m => ({
      _id: m._id,
      description: m.uacsCode, // Or another descriptive field
      tier1: getTierValue(m._id, 'tier1'),
      tier2: getTierValue(m._id, 'tier2'),
    }));

    const capitalOutlayItems = capitalOutlays.map(c => ({
      _id: c._id,
      description: c.description,
      tier1: getTierValue(c._id, 'tier1'),
      tier2: getTierValue(c._id, 'tier2'),
    }));

    res.json({
      personnelServices: personnelItems,
      mooe: mooeItems,
      capitalOutlay: capitalOutlayItems,
    });

  } catch (error) {
    console.error('Error in getTierData:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/tier/saved-items?fiscalYear=&region=&department=&division=
 * Returns the saved Tier document's items (lineItemId, tier1, tier2) so the client
 * can show the current version's values instead of "original" API values.
 * Uses same region-matching as getRevisions (ID + name) so we find Tier saved with either.
 */
const getTierSavedItems = async (req, res) => {
  try {
    const { fiscalYear, region, department, division } = req.query;
    if (!fiscalYear || !region) {
      return res.status(400).json({ message: 'fiscalYear and region are required.' });
    }
    const scope = await normalizeTierScope(fiscalYear, region, department, division);
    const rawRegion = String(region || '');
    const regionValues = [scope.region].filter(Boolean);
    if (rawRegion && !regionValues.includes(rawRegion)) regionValues.push(rawRegion);
    try {
      const Region = require('../models/Region');
      if (rawRegion && mongoose.Types.ObjectId.isValid(rawRegion) && rawRegion.length === 24) {
        const regionById = await Region.findById(rawRegion).select('Region').lean();
        if (regionById && regionById.Region && !regionValues.includes(regionById.Region)) {
          regionValues.push(String(regionById.Region));
        }
      }
      if (scope.region) {
        const regionIds = await Region.find({ Region: scope.region }).select('_id').lean();
        (regionIds || []).forEach((r) => {
          const idStr = String(r._id);
          if (idStr && !regionValues.includes(idStr)) regionValues.push(idStr);
        });
      }
    } catch (e) { /* ignore */ }
    const regionFilter = regionValues.length === 0
      ? { region: scope.region || rawRegion }
      : regionValues.length === 1 ? { region: regionValues[0] } : { region: { $in: regionValues } };

    let departmentFilter = { department: scope.department };
    if (scope.department) {
      try {
        const Department = require('../models/Department');
        const deptIds = await Department.find({ Department: scope.department }).select('_id').lean();
        const ids = (deptIds || []).map((d) => String(d._id)).filter(Boolean);
        if (ids.length) departmentFilter = { $or: [{ department: scope.department }, { department: { $in: ids } }] };
      } catch (e) { /* ignore */ }
    }
    const fiscalYearStr = String(scope.fiscalYear || '');
    let queryConditions = { fiscalYear: fiscalYearStr, ...regionFilter, ...departmentFilter, division: scope.division };
    let tierDoc = await Tier.findOne(queryConditions).select('items').lean();
    if (!tierDoc && fiscalYearStr) {
      const fyNum = Number(fiscalYearStr);
      if (Number.isFinite(fyNum)) {
        tierDoc = await Tier.findOne({
          $or: [{ fiscalYear: fiscalYearStr }, { fiscalYear: fyNum }],
          ...regionFilter,
          ...departmentFilter,
          division: scope.division,
        }).select('items').lean();
      }
    }
    const items = Array.isArray(tierDoc?.items) ? tierDoc.items : [];
    // Find the version number of the data currently in Tier (latest TierRevision for this scope)
    let version = 0;
    if (tierDoc) {
      try {
        const latestRev = await TierRevision.findOne(queryConditions).sort({ version: -1 }).select('version').lean();
        if (latestRev) version = latestRev.version || 0;
      } catch (e) { /* ignore */ }
    }
    res.json({ items, version });
  } catch (error) {
    console.error('Error in getTierSavedItems:', error);
    res.status(500).json({ message: error.message });
  }
};

const saveTierData = async (req, res) => {
  try {
    const { fiscalYear, region, department, division, items, revisionComment, createNewVersion } = req.body;

    // Use broad query (matches region stored as name OR ObjectId) to find existing revisions.
    // Use normalizedScope for creating new documents so future lookups are consistent.
    const { query: broadQuery, normalizedScope } = await buildRevisionQuery(fiscalYear, region, department, division);
    const queryConditions = normalizedScope; // used for new doc creation only

    const { createdBy: userObjectId, createdByName } = await resolveCreatedBy(req);

    let tierDoc = await Tier.findOne(broadQuery);

    const VALID_CATEGORIES = ['Personnel', 'MOOE', 'Capital Outlay'];
    const itemsToSave = Array.isArray(items) ? items : [];
    const revisionItems = itemsToSave.map((item) => {
      let cat = item.category;
      if (!VALID_CATEGORIES.includes(cat)) cat = 'MOOE';
      return {
        lineItemId: item.lineItemId,
        description: item.description || '',
        category: cat,
        tier1: item.tier1 || 0,
        tier2: item.tier2 || 0,
      };
    });

    // Find the latest existing revision for this scope using broad query (handles region stored as name or ObjectId)
    const latestRevision = await TierRevision.findOne(broadQuery).sort({ version: -1 }).catch(() => null);
    let savedVersion;

    if (createNewVersion) {
      // Explicitly creating a new version — increment and save as new TierRevision
      const nextVersion = latestRevision ? (latestRevision.version || 0) + 1 : 1;
      await TierRevision.create({
        ...queryConditions,
        version: nextVersion,
        comment: revisionComment || `Version ${nextVersion}`,
        items: revisionItems,
        createdBy: userObjectId,
        createdByName: createdByName || undefined,
      });
      await pruneRevisionsForScope(queryConditions.fiscalYear, queryConditions.region, queryConditions.department, queryConditions.division);
      savedVersion = nextVersion;
    } else if (latestRevision) {
      // Save = update current version in-place (no new version created)
      latestRevision.items = revisionItems;
      if (revisionComment && revisionComment.trim()) latestRevision.comment = revisionComment.trim();
      if (userObjectId) latestRevision.createdBy = userObjectId;
      if (createdByName) latestRevision.createdByName = createdByName;
      await latestRevision.save();
      savedVersion = latestRevision.version;
    } else {
      // No revision exists yet — create the first one (version 1)
      await TierRevision.create({
        ...queryConditions,
        version: 1,
        comment: revisionComment || 'Version 1',
        items: revisionItems,
        createdBy: userObjectId,
        createdByName: createdByName || undefined,
      });
      savedVersion = 1;
    }

    if (tierDoc) {
      itemsToSave.forEach((newItem) => {
        const existingItem = tierDoc.items.find((i) => String(i.lineItemId) === String(newItem.lineItemId));
        if (existingItem) {
          existingItem.tier1 = newItem.tier1;
          existingItem.tier2 = newItem.tier2;
          if (newItem.description) existingItem.description = newItem.description;
        } else {
          tierDoc.items.push({
            lineItemId: newItem.lineItemId,
            category: newItem.category,
            tier1: newItem.tier1 || 0,
            tier2: newItem.tier2 || 0,
            description: newItem.description || '',
          });
        }
      });
      if (userObjectId) tierDoc.updatedBy = userObjectId;
    } else {
      tierDoc = new Tier({
        ...queryConditions,
        items: itemsToSave.map((item) => ({
          lineItemId: item.lineItemId,
          category: item.category,
          tier1: item.tier1 || 0,
          tier2: item.tier2 || 0,
          description: item.description || '',
        })),
        createdBy: userObjectId,
      });
    }

    const savedTier = await tierDoc.save();
    res.status(200).json({ ...savedTier.toObject(), version: savedVersion });
  } catch (error) {
    console.error('Error in saveTierData:', error);
    res.status(500).json({ message: error.message });
  }
};

const MAX_REVISIONS_TO_KEEP = 3;

/**
 * Get current (latest) version number for a scope. Returns 0 if no revisions.
 * Uses same region-matching as getRevisions (ID + name) so we find docs stored with either.
 */
const getCurrentVersionForScope = async (fiscalYear, region, department, division) => {
  const scope = await normalizeTierScope(fiscalYear, region, department, division);
  const rawRegion = String(region || '');
  const regionValues = [scope.region].filter(Boolean);
  if (rawRegion && !regionValues.includes(rawRegion)) regionValues.push(rawRegion);
  try {
    const Region = require('../models/Region');
    if (rawRegion && mongoose.Types.ObjectId.isValid(rawRegion) && rawRegion.length === 24) {
      const regionById = await Region.findById(rawRegion).select('Region').lean();
      if (regionById && regionById.Region && !regionValues.includes(regionById.Region)) {
        regionValues.push(String(regionById.Region));
      }
    }
    if (scope.region) {
      const regionIds = await Region.find({ Region: scope.region }).select('_id').lean();
      (regionIds || []).forEach((r) => {
        const idStr = String(r._id);
        if (idStr && !regionValues.includes(idStr)) regionValues.push(idStr);
      });
    }
  } catch (e) { /* ignore */ }
  const regionFilter = regionValues.length === 0
    ? { region: scope.region || rawRegion }
    : regionValues.length === 1 ? { region: regionValues[0] } : { region: { $in: regionValues } };

  let departmentFilter = { department: scope.department };
  if (scope.department) {
    try {
      const Department = require('../models/Department');
      const deptIds = await Department.find({ Department: scope.department }).select('_id').lean();
      const ids = (deptIds || []).map((d) => String(d._id)).filter(Boolean);
      if (ids.length) departmentFilter = { $or: [{ department: scope.department }, { department: { $in: ids } }] };
    } catch (e) { /* ignore */ }
  }
  const fiscalYearStr = String(scope.fiscalYear || '');
  let query = { fiscalYear: fiscalYearStr, ...regionFilter, ...departmentFilter, division: scope.division };
  let latest = await TierRevision.findOne(query).sort({ version: -1 }).select('version').lean();
  if (!latest && fiscalYearStr) {
    const fyNum = Number(fiscalYearStr);
    if (Number.isFinite(fyNum)) {
      latest = await TierRevision.findOne({
        $or: [{ fiscalYear: fiscalYearStr }, { fiscalYear: fyNum }],
        ...regionFilter,
        ...departmentFilter,
        division: scope.division,
      }).sort({ version: -1 }).select('version').lean();
    }
  }
  if (!latest) {
    latest = await TierRevision.findOne(regionFilter).sort({ version: -1 }).select('version').lean();
  }
  return latest ? (latest.version || 0) : 0;
};

/**
 * Keep only the latest MAX_REVISIONS_TO_KEEP revisions for the scope; delete older ones.
 * Uses buildRevisionQuery so it finds revisions regardless of whether region was stored as name or ObjectId.
 */
const pruneRevisionsForScope = async (fiscalYear, region, department, division) => {
  const { query } = await buildRevisionQuery(fiscalYear, region, department, division);
  const idsToRemove = await TierRevision.find(query)
    .sort({ version: -1 })
    .skip(MAX_REVISIONS_TO_KEEP)
    .select('_id')
    .lean();
  if (idsToRemove.length > 0) {
    await TierRevision.deleteMany({ _id: { $in: idsToRemove.map((r) => r._id) } });
  }
};

/**
 * GET /api/tier/current-version?fiscalYear=&region=&department=&division=
 * Returns { version: N } for the given scope (latest revision number, or 0).
 */
const getCurrentVersion = async (req, res) => {
  try {
    const { fiscalYear, region, department, division } = req.query;
    if (!fiscalYear || !region) {
      return res.status(400).json({ message: 'fiscalYear and region are required.' });
    }
    const version = await getCurrentVersionForScope(fiscalYear, region, department, division);
    res.json({ version });
  } catch (error) {
    console.error('Error in getCurrentVersion:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/tier/revisions?fiscalYear=&region=&department=&division=
 * List revisions for the given scope (newest first). Limited to 3.
 */
const getRevisions = async (req, res) => {
  try {
    const { fiscalYear, region, department, division } = req.query;
    if (!fiscalYear || !region) {
      return res.status(400).json({ message: 'fiscalYear and region are required.' });
    }
    const rawRegion = String(region || '');
    const rawDepartment = String(department ?? '');
    const rawDivision = String(division ?? '');
    const scope = await normalizeTierScope(fiscalYear, region, department, division);

    // Region: match normalized name OR any Region _id with that name OR exact value from client.
    // TierRevision stores region as Region name (from normalizeTierScope on save). If client sends region ID,
    // we must include both ID and name in regionValues so we find documents stored with name.
    const regionValues = [scope.region].filter(Boolean);
    if (rawRegion && !regionValues.includes(rawRegion)) regionValues.push(rawRegion);
    try {
      const Region = require('../models/Region');
      // When client sends region ID, resolve to name so we match docs stored with region name
      if (rawRegion && mongoose.Types.ObjectId.isValid(rawRegion) && rawRegion.length === 24) {
        const regionById = await Region.findById(rawRegion).select('Region').lean();
        if (regionById && regionById.Region && !regionValues.includes(regionById.Region)) {
          regionValues.push(String(regionById.Region));
        }
      }
      if (scope.region && Region.find) {
        const regionIds = await Region.find({
          $or: [
            { Region: scope.region },
            { Region: new RegExp(`^${String(scope.region).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
          ],
        }).select('_id').lean();
        (regionIds || []).forEach((r) => {
          const idStr = String(r._id);
          if (idStr && !regionValues.includes(idStr)) regionValues.push(idStr);
        });
      }
    } catch (e) {
      if (process.env.DEBUG_LOGS === 'true') console.debug('getRevisions region ids lookup failed:', e?.message);
    }
    // Ensure we always have at least rawRegion so we can match docs stored with region ID or name
    if (rawRegion && !regionValues.includes(rawRegion)) regionValues.push(rawRegion);
    const regionFilter = regionValues.length === 0
      ? {} // no region filter if somehow empty (fallback will still run)
      : regionValues.length === 1 ? { region: regionValues[0] } : { region: { $in: regionValues } };

    // Department: match normalized name OR any Department _id with that name OR exact value from client (when filter is by Department)
    const departmentValues = [scope.department];
    if (rawDepartment && !departmentValues.includes(rawDepartment)) departmentValues.push(rawDepartment);
    if (scope.department) {
      try {
        const Department = require('../models/Department');
        const deptIds = await Department.find({
          $or: [
            { Department: scope.department },
            { Department: new RegExp(`^${String(scope.department).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
          ],
        }).select('_id').lean();
        (deptIds || []).forEach((d) => {
          const idStr = String(d._id);
          if (idStr && !departmentValues.includes(idStr)) departmentValues.push(idStr);
        });
      } catch (e) {
        if (process.env.DEBUG_LOGS === 'true') console.debug('getRevisions department ids lookup failed:', e?.message);
      }
    }
    const departmentFilter = !scope.department
      ? { $or: [{ department: '' }, { department: null }, { department: { $exists: false } }] }
      : departmentValues.length <= 1 ? { department: scope.department } : { department: { $in: departmentValues } };

    // Division: match normalized value OR exact value from client (when filter is by Division; no Division collection)
    const divisionValues = [scope.division];
    if (rawDivision && !divisionValues.includes(rawDivision)) divisionValues.push(rawDivision);
    const divisionFilter = !scope.division
      ? { $or: [{ division: '' }, { division: null }, { division: { $exists: false } }] }
      : divisionValues.length <= 1 ? { division: scope.division } : { division: { $in: divisionValues } };

    // Always use string fiscalYear so we match DB (TierRevision stores fiscalYear as string)
    const fiscalYearStr = String(scope.fiscalYear || '');
    const baseQuery = { fiscalYear: fiscalYearStr, ...regionFilter };
    const query = { ...baseQuery, ...departmentFilter, ...divisionFilter };
    let list = await TierRevision.find(query)
      .sort({ version: -1 })
      .limit(MAX_REVISIONS_TO_KEEP)
      .select('version comment createdAt createdBy createdByName')
      .populate('createdBy', 'username name email')
      .lean();
    // Fallback 1: same region, any department/division (scope might differ)
    if (list.length === 0) {
      list = await TierRevision.find(baseQuery)
        .sort({ version: -1 })
        .limit(MAX_REVISIONS_TO_KEEP)
        .select('version comment createdAt createdBy createdByName')
        .populate('createdBy', 'username name email')
        .lean();
    }
    // Fallback 2: match fiscalYear as string or number (DB might have stored number)
    if (list.length === 0 && fiscalYearStr) {
      const fyNum = Number(fiscalYearStr);
      const fyQuery = Number.isFinite(fyNum)
        ? { $or: [{ fiscalYear: fiscalYearStr }, { fiscalYear: fyNum }] }
        : { fiscalYear: fiscalYearStr };
      list = await TierRevision.find({ ...fyQuery, ...regionFilter, ...departmentFilter, ...divisionFilter })
        .sort({ version: -1 })
        .limit(MAX_REVISIONS_TO_KEEP)
        .select('version comment createdAt createdBy createdByName')
        .populate('createdBy', 'username name email')
        .lean();
    }
    // Fallback 3: same region only (any fiscal year) so we show something when DB has revisions for this region
    if (list.length === 0 && Object.keys(regionFilter).length > 0) {
      list = await TierRevision.find(regionFilter)
        .sort({ version: -1 })
        .limit(MAX_REVISIONS_TO_KEEP)
        .select('version comment createdAt createdBy createdByName fiscalYear')
        .populate('createdBy', 'username name email')
        .lean();
    }
    // Fallback 4: any revisions in collection (confirm we're hitting the right DB; show latest 5)
    if (list.length === 0) {
      list = await TierRevision.find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .select('version comment createdAt createdBy createdByName fiscalYear region')
        .populate('createdBy', 'username name email')
        .lean();
    }
    res.json(list);
  } catch (error) {
    console.error('Error in getRevisions:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/tier/revisions/:id
 * Get a single revision by _id (full items).
 */
const getRevisionById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid revision id.' });
    }
    const rev = await TierRevision.findById(id).populate('createdBy', 'name username email').lean();
    if (!rev) return res.status(404).json({ message: 'Revision not found.' });
    res.json(rev);
  } catch (error) {
    console.error('Error in getRevisionById:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * POST /api/tier/revisions/:id/restore
 * Copy this revision's items to Tier (current) and optionally create a new revision entry "Restored from vX".
 */
const restoreRevision = async (req, res) => {
  try {
    const { id } = req.params;
    const { saveAsNewRevision = true } = req.body || {};
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid revision id.' });
    }
    const rev = await TierRevision.findById(id).lean();
    if (!rev) return res.status(404).json({ message: 'Revision not found.' });

    const queryConditions = {
      fiscalYear: rev.fiscalYear,
      region: rev.region,
      department: rev.department || '',
      division: rev.division || '',
    };
    const { createdBy: userObjectId, createdByName } = await resolveCreatedBy(req);

    let tierDoc = await Tier.findOne(queryConditions);
    if (!tierDoc) {
      tierDoc = new Tier({
        ...queryConditions,
        items: rev.items.map((i) => ({
          lineItemId: i.lineItemId,
          category: i.category,
          tier1: i.tier1 || 0,
          tier2: i.tier2 || 0,
          description: i.description || '',
        })),
        createdBy: userObjectId,
      });
    } else {
      // Replace items with the chosen revision's data (so table shows that version, not "original")
      const restoredItems = Array.isArray(rev.items) && rev.items.length > 0
        ? rev.items.map((i) => ({
            lineItemId: i.lineItemId,
            description: i.description || '',
            category: i.category,
            tier1: Number(i.tier1) || 0,
            tier2: Number(i.tier2) || 0,
          }))
        : [];
      tierDoc.items = restoredItems;
      tierDoc.markModified('items');
      if (userObjectId) tierDoc.updatedBy = userObjectId;
    }
    await tierDoc.save();

    if (saveAsNewRevision) {
      const nextVersion = await TierRevision.findOne(queryConditions)
        .sort({ version: -1 })
        .select('version')
        .lean()
        .then((r) => (r ? (r.version || 0) + 1 : 1))
        .catch(() => 1);
      await TierRevision.create({
        ...queryConditions,
        version: nextVersion,
        comment: `Restored from revision v${rev.version}`,
        items: tierDoc.items.map((i) => ({
          lineItemId: i.lineItemId,
          description: i.description,
          category: i.category,
          tier1: i.tier1,
          tier2: i.tier2,
        })),
        createdBy: userObjectId,
        createdByName: createdByName || undefined,
      });
      await pruneRevisionsForScope(queryConditions.fiscalYear, queryConditions.region, queryConditions.department, queryConditions.division);
    }
    res.status(200).json({ success: true, tier: tierDoc, restoredFromVersion: rev.version });
  } catch (error) {
    console.error('Error in restoreRevision:', error);
    res.status(500).json({ message: error.message });
  }
};

// Use "Php " in PDF (Helvetica does not support ₱; some viewers show it as ±)
const formatTierCurrency = (amount) => {
  const n = Number(amount);
  
  // Check kung valid number, pag hindi, default sa 0.00
  if (isNaN(n) || !Number.isFinite(n)) return '0.00';
  
  return n.toLocaleString('en-PH', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
};
const safeNum = (val, fallback = 0) => {
  const n = Number(val);
  return (n !== undefined && n !== null && !isNaN(n) && Number.isFinite(n)) ? n : fallback;
};

/**
 * Generate Tier Report PDF from reportSummary (view-only; inline disposition).
 * Accepts POST body: { fiscalYear, region, department, division, reportSummary }.
 */
const generateTierPDF = async (req, res) => {
  try {
    if (!MuhammaraRecipe) {
      return res.status(500).json({ message: 'PDF generation library (muhammara) is not installed on the server.' });
    }

    const { fiscalYear, region, department, division, regionName, departmentName, divisionName, reportSummary, version: versionFromBody } = req.body || {};
    if (!reportSummary || !fiscalYear) {
      return res.status(400).json({ message: 'fiscalYear and reportSummary are required.' });
    }
    const regionDisplay = regionName || (region === 'ALL' || !region ? 'All' : region);
    const departmentDisplay = departmentName || (!department ? 'All' : department);
    const divisionDisplay = divisionName || (!division ? 'All' : division);
    const version = versionFromBody != null ? Number(versionFromBody) : (await getCurrentVersionForScope(fiscalYear, region, department, division));

    const { sourcesOfFunds = {}, usesOfFunds = {}, usesCorporateIncome = {}, surplusDeficit = 0, lineItems: rawLineItems = [] } = reportSummary;
    // MOOE and Capital Outlay: show only line items with total value > 0
    const lineItems = rawLineItems.filter((item) => {
      const cat = (item.category || '').toString();
      const total = Number(item.total) || (Number(item.tier1) || 0) + (Number(item.tier2) || 0);
      if (cat === 'Maintenance and Other Operating Expenses' || cat === 'Capital Outlay') return total > 0;
      return true;
    });

    const filename = `Tier_Report_${fiscalYear}_${regionDisplay}_${departmentDisplay}_${divisionDisplay}.pdf`;
    const tmpFilePath = path.join(os.tmpdir(), `tier_report_${Date.now()}.pdf`);
    const pdfDoc = new MuhammaraRecipe('new', tmpFilePath, {
      version: 1.6,
      author: 'FMIS-BUDGET',
      title: 'Tier Budget Report',
      subject: 'Tier Budget Report',
    });

    const PAGE_WIDTH = 842;
    const PAGE_HEIGHT = 595;
    const MARGIN = 40;
    const MARGIN_TOP = 50;
    const MARGIN_BOTTOM = 60;
    const LINE_HEIGHT = 14;
    const CONTENT_LEFT = MARGIN + 5;
    const CONTENT_RIGHT = PAGE_WIDTH - MARGIN - 5;
    const pageW = PAGE_WIDTH - 80;

    let currentY = MARGIN_TOP;
    let currentPage = 1;
    const rowH = 16;
    const descColWidth = 230;
    const col1 = CONTENT_LEFT;
    const numAreaLeft = col1 + descColWidth + 6;
    const numColStep = (CONTENT_RIGHT - numAreaLeft) / 5;
    const col2 = numAreaLeft + numColStep;
    const col3 = numAreaLeft + 2 * numColStep;
    const col4 = numAreaLeft + 3 * numColStep;
    const col5 = numAreaLeft + 4 * numColStep;
    const col6 = CONTENT_RIGHT;

    const textOpt = (opts = {}) => ({ color: '#000000', ...opts });
    const drawBorder = () => {
      pdfDoc.rectangle(MARGIN, MARGIN, PAGE_WIDTH - MARGIN * 2, PAGE_HEIGHT - MARGIN * 2, {
        stroke: '#000000',
        lineWidth: 1.2
      });
    };
    const drawFooter = () => {
      pdfDoc.text('Tier Budget Report', CONTENT_LEFT, PAGE_HEIGHT - MARGIN - 15, textOpt({ fontSize: 8 }));
      pdfDoc.text(`Page ${currentPage}`, CONTENT_RIGHT - 45, PAGE_HEIGHT - MARGIN - 15, textOpt({ fontSize: 8 }));
    };
    const resolveLogoPath = (name) => {
      const serverAsset = path.join(__dirname, `../assets/${name}`);
      if (fs.existsSync(serverAsset)) return serverAsset;
      const clientAsset = path.join(__dirname, `../../CLIENT/public/${name}`);
      if (fs.existsSync(clientAsset)) return clientAsset;
      return null;
    };
    const startNewPage = (continued = false) => {
      if (currentPage > 1 || currentY !== MARGIN_TOP) {
        drawFooter();
        pdfDoc.endPage();
        currentPage += 1;
      }
      pdfDoc.createPage(842, 595);
      currentY = MARGIN_TOP;
      drawBorder();

      const sealPath = resolveLogoPath('Seal.png');
      const logoPath = resolveLogoPath('logo.png');
      const bagongPath = resolveLogoPath('Bagong_Pilipinas.png');
      const logoY = currentY + 3;
      try {
        if (sealPath) pdfDoc.image(sealPath, CONTENT_LEFT, logoY, { width: 34, height: 34 });
        if (logoPath) pdfDoc.image(logoPath, CONTENT_LEFT + 38, logoY, { width: 34, height: 34 });
        if (bagongPath) pdfDoc.image(bagongPath, CONTENT_RIGHT - 34, logoY, { width: 34, height: 34 });
      } catch (e) {
        console.warn('Tier header logo load failed:', e.message);
      }

      const centerX = PAGE_WIDTH / 2;
      pdfDoc.text('TIER BUDGET REPORT', centerX, currentY + 6, textOpt({ fontSize: 12, bold: true, align: 'center' }));
      pdfDoc.text(`Fiscal Year: ${fiscalYear} | Region: ${regionDisplay} | Department: ${departmentDisplay} | Division: ${divisionDisplay}`, centerX, currentY + 20, textOpt({ fontSize: 8, align: 'center' }));
      pdfDoc.text(`Version ${Number.isFinite(Number(version)) ? version : 0}${continued ? ' (continued)' : ''}`, centerX, currentY + 31, textOpt({ fontSize: 8, align: 'center' }));
      pdfDoc.text('ANNEX A', CONTENT_RIGHT - 45, currentY + 39, textOpt({ fontSize: 9, bold: true }));
      currentY += 52;
    };
    const ensureSpace = (lines = 1) => {
      if (currentY + lines * LINE_HEIGHT > PAGE_HEIGHT - MARGIN_BOTTOM) {
        startNewPage(true);
      }
    };
    const drawRow = (cells, bold = false, fontSize = 8) => {
      ensureSpace(1);
      const safe = (v) => (v == null ? '—' : String(v));
      pdfDoc.text(safe(cells[0]), col1, currentY, textOpt({ fontSize, bold }));
      pdfDoc.text(safe(cells[1]), col2, currentY, textOpt({ fontSize, bold, align: 'right' }));
      pdfDoc.text(safe(cells[2]), col3, currentY, textOpt({ fontSize, bold, align: 'right' }));
      pdfDoc.text(safe(cells[3]), col4, currentY, textOpt({ fontSize, bold, align: 'right' }));
      pdfDoc.text(safe(cells[4]), col5, currentY, textOpt({ fontSize, bold, align: 'right' }));
      pdfDoc.text(safe(cells[5]), col6, currentY, textOpt({ fontSize, bold, align: 'right' }));
      currentY += rowH;
    };

    startNewPage(false);

    const src = sourcesOfFunds;
    const bs = src.budgetarySupport || {};
    const ps = usesOfFunds['Personnel Services'];
    const mooe = usesOfFunds['Maintenance and Other Operating Expenses'];
    const co = usesOfFunds['Capital Outlay'];
    const tot = usesOfFunds;
    const totalCorp = (usesCorporateIncome['Personnel Services'] || 0)
      + (usesCorporateIncome['Maintenance and Other Operating Expenses'] || 0)
      + (usesCorporateIncome['Capital Outlay'] || 0);

    pdfDoc.text('A. SOURCES OF FUNDS', CONTENT_LEFT, currentY, textOpt({ fontSize: 10, bold: true }));
    currentY += LINE_HEIGHT;
    drawRow(['Particulars', 'Projected Corporate Income', 'Tier 1', 'Tier 2', 'Total', 'Proposed Budget'], true);
    pdfDoc.rectangle(col1, currentY - 4, pageW, 0.5, { stroke: '#000000', lineWidth: 0.5 });
    drawRow(['Projected Corporate Income', formatTierCurrency(src.corporateIncome), '—', '—', '—', formatTierCurrency(src.corporateIncome)]);
    drawRow(['Budgetary Support (Tier 1 + Tier 2)', '—', formatTierCurrency(bs.tier1), formatTierCurrency(bs.tier2), formatTierCurrency(bs.total), formatTierCurrency(bs.total)]);
    drawRow(['TOTAL SOURCES OF FUNDS', formatTierCurrency(src.corporateIncome), formatTierCurrency(bs.tier1), formatTierCurrency(bs.tier2), formatTierCurrency(bs.total), formatTierCurrency(src.proposedBudget || src.total)], true);
    currentY += 6;

    pdfDoc.text('B. USES OF FUNDS', CONTENT_LEFT, currentY, textOpt({ fontSize: 10, bold: true }));
    currentY += LINE_HEIGHT;
    drawRow(['Particulars', 'Projected Corporate Income', 'Tier 1', 'Tier 2', 'Total', 'Proposed Budget'], true);
    pdfDoc.rectangle(col1, currentY - 4, pageW, 0.5, { stroke: '#000000', lineWidth: 0.5 });

    let currentCategory = '';
    for (const item of lineItems) {
      const cat = item.category || '';
      if (cat !== currentCategory) {
        currentCategory = cat;
        ensureSpace(2);
        pdfDoc.text(String(cat), col1, currentY, textOpt({ fontSize: 9, bold: true }));
        currentY += 12;
      }
      drawRow([
        item.description || '—',
        formatTierCurrency(item.corporateIncome),
        formatTierCurrency(item.tier1),
        formatTierCurrency(item.tier2),
        formatTierCurrency(item.total),
        formatTierCurrency((Number(item.corporateIncome) || 0) + (Number(item.total) || 0)),
      ]);
    }

    currentY += 3;
    pdfDoc.rectangle(col1, currentY, pageW, 0.5, { stroke: '#000000', lineWidth: 0.5 });
    currentY += 6;
    drawRow(['Personnel Services', formatTierCurrency(usesCorporateIncome['Personnel Services']), formatTierCurrency(ps?.tier1), formatTierCurrency(ps?.tier2), formatTierCurrency(ps?.total), formatTierCurrency((Number(usesCorporateIncome['Personnel Services']) || 0) + (Number(ps?.total) || 0))], true);
    drawRow(['Maintenance and Other Operating Expenses', formatTierCurrency(usesCorporateIncome['Maintenance and Other Operating Expenses']), formatTierCurrency(mooe?.tier1), formatTierCurrency(mooe?.tier2), formatTierCurrency(mooe?.total), formatTierCurrency((Number(usesCorporateIncome['Maintenance and Other Operating Expenses']) || 0) + (Number(mooe?.total) || 0))], true);
    drawRow(['Capital Outlay', formatTierCurrency(usesCorporateIncome['Capital Outlay']), formatTierCurrency(co?.tier1), formatTierCurrency(co?.tier2), formatTierCurrency(co?.total), formatTierCurrency((Number(usesCorporateIncome['Capital Outlay']) || 0) + (Number(co?.total) || 0))], true);
    drawRow(['TOTAL USES OF FUNDS', formatTierCurrency(tot.totalCorporateIncome ?? totalCorp), formatTierCurrency(tot.totalTier1), formatTierCurrency(tot.totalTier2), formatTierCurrency((Number(tot.totalTier1) || 0) + (Number(tot.totalTier2) || 0)), formatTierCurrency(tot.proposedBudget)], true);

    currentY += 8;
    ensureSpace(1);
    pdfDoc.text(`Surplus/(Deficit): ${formatTierCurrency(surplusDeficit)}`, CONTENT_LEFT, currentY, textOpt({ fontSize: 10, bold: true }));

    drawFooter();
    pdfDoc.endPage().endPDF((err) => {
      if (err) {
        console.error('Error generating tier PDF:', err);
        return res.status(500).json({ message: 'Error generating PDF' });
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

      const readStream = fs.createReadStream(tmpFilePath);
      readStream.on('error', (streamErr) => {
        console.error('Error streaming tier PDF:', streamErr);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Failed to stream PDF' });
        }
      });
      res.on('finish', () => {
        fs.unlink(tmpFilePath, () => {});
      });
      readStream.pipe(res);
    });
  } catch (error) {
    console.error('Error generating tier PDF:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: error.message || 'Error generating PDF' });
    }
  }
};

/**
 * Generate Tier Report Excel from reportSummary.
 * POST body: { fiscalYear, region, department, division, reportSummary }.
 */
const generateTierExcel = async (req, res) => {
  try {
    const ExcelJS = require('exceljs');
    const { fiscalYear, region, department, division, regionName, departmentName, divisionName, reportSummary, version: versionFromBody } = req.body || {};
    if (!reportSummary || !fiscalYear) {
      return res.status(400).json({ message: 'fiscalYear and reportSummary are required.' });
    }
    const regionDisplay = regionName || (region === 'ALL' || !region ? 'All' : region);
    const departmentDisplay = departmentName || (!department ? 'All' : department);
    const divisionDisplay = divisionName || (!division ? 'All' : division);
    const version = versionFromBody != null ? Number(versionFromBody) : (await getCurrentVersionForScope(fiscalYear, region, department, division));

    const { sourcesOfFunds = {}, usesOfFunds = {}, usesCorporateIncome = {}, surplusDeficit = 0, lineItems: rawLineItems = [] } = reportSummary;
    // MOOE and Capital Outlay: show only line items with total value > 0
    const lineItems = rawLineItems.filter((item) => {
      const cat = (item.category || '').toString();
      const total = Number(item.total) || (Number(item.tier1) || 0) + (Number(item.tier2) || 0);
      if (cat === 'Maintenance and Other Operating Expenses' || cat === 'Capital Outlay') return total > 0;
      return true;
    });
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'FMIS Budget System';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Tier Report', { views: [{ state: 'frozen', ySplit: 4 }] });
    sheet.columns = [
      { width: 42 },
      { width: 18 },
      { width: 16 },
      { width: 16 },
      { width: 16 },
    ];

    const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2e7d32' } };
    const headerFont = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    const titleFont = { bold: true, size: 14, color: { argb: 'FF1a472a' } };
    const numFormat = '#,##0.00';

    sheet.mergeCells('A1:E1');
    sheet.getCell('A1').value = 'TIER BUDGET REPORT';
    sheet.getCell('A1').font = titleFont;
    sheet.getCell('A1').alignment = { horizontal: 'center' };
    sheet.addRow([`Fiscal Year: ${fiscalYear}  |  Region: ${regionDisplay}  |  Department: ${departmentDisplay}  |  Division: ${divisionDisplay}`]);
    sheet.mergeCells('A2:E2');
    sheet.getCell('A2').alignment = { horizontal: 'center' };
    sheet.addRow([`Version ${version}`]);
    sheet.mergeCells('A3:E3');
    sheet.getCell('A3').alignment = { horizontal: 'center' };
    sheet.getCell('A3').font = { italic: true, size: 9 };
    sheet.addRow([]);

    const src = sourcesOfFunds;
    const bs = src.budgetarySupport || {};
    sheet.addRow(['A. SOURCES OF FUNDS']).getCell(1).font = { bold: true };
    sheet.addRow(['Particulars', 'Projected Corporate Income', 'Tier 1', 'Tier 2', 'Total']);
    sheet.lastRow.eachCell(c => { c.fill = headerFill; c.font = headerFont; });
    sheet.addRow(['Projected Corporate Income', Number(src.corporateIncome) || 0, '', '', Number(src.corporateIncome) || 0]);
    sheet.addRow(['Budgetary Support', '', Number(bs.tier1) || 0, Number(bs.tier2) || 0, Number(bs.total) || 0]);
    sheet.addRow(['TOTAL SOURCES OF FUNDS', Number(src.corporateIncome) || 0, Number(bs.tier1) || 0, Number(bs.tier2) || 0, Number(src.proposedBudget || src.total) || 0]);
    sheet.lastRow.eachCell(c => { c.font = { bold: true }; if (c.col > 1) c.numFmt = numFormat; });
    sheet.addRow([]);

    sheet.addRow(['B. USES OF FUNDS']).getCell(1).font = { bold: true };
    sheet.addRow(['Particulars', 'Projected Corporate Income', 'Tier 1', 'Tier 2', 'Total']);
    sheet.lastRow.eachCell(c => { c.fill = headerFill; c.font = headerFont; });

    let currentCategory = '';
    for (const item of lineItems) {
      if ((item.category || '') !== currentCategory) {
        currentCategory = item.category || '';
        sheet.addRow([currentCategory]).getCell(1).font = { bold: true };
      }
      const row = sheet.addRow([
        item.description || '—',
        Number(item.corporateIncome) || 0,
        Number(item.tier1) || 0,
        Number(item.tier2) || 0,
        Number(item.total) || 0,
      ]);
      row.getCell(2).numFmt = numFormat;
      row.getCell(3).numFmt = numFormat;
      row.getCell(4).numFmt = numFormat;
      row.getCell(5).numFmt = numFormat;
    }

    const ps = usesOfFunds['Personnel Services'];
    const mooe = usesOfFunds['Maintenance and Other Operating Expenses'];
    const co = usesOfFunds['Capital Outlay'];
    const tot = usesOfFunds;
    sheet.addRow(['Personnel Services', Number(usesCorporateIncome['Personnel Services']) || 0, Number(ps?.tier1) || 0, Number(ps?.tier2) || 0, Number(ps?.total) || 0]);
    sheet.lastRow.eachCell(c => { c.font = { bold: true }; if (c.col > 1) c.numFmt = numFormat; });
    sheet.addRow(['Maintenance and Other Operating Expenses', Number(usesCorporateIncome['Maintenance and Other Operating Expenses']) || 0, Number(mooe?.tier1) || 0, Number(mooe?.tier2) || 0, Number(mooe?.total) || 0]);
    sheet.lastRow.eachCell(c => { c.font = { bold: true }; if (c.col > 1) c.numFmt = numFormat; });
    sheet.addRow(['Capital Outlay', Number(usesCorporateIncome['Capital Outlay']) || 0, Number(co?.tier1) || 0, Number(co?.tier2) || 0, Number(co?.total) || 0]);
    sheet.lastRow.eachCell(c => { c.font = { bold: true }; if (c.col > 1) c.numFmt = numFormat; });
    sheet.addRow(['TOTAL USES OF FUNDS', Number(tot.totalCorporateIncome) || 0, Number(tot.totalTier1) || 0, Number(tot.totalTier2) || 0, Number(tot.proposedBudget) || 0]);
    sheet.lastRow.eachCell(c => { c.fill = headerFill; c.font = headerFont; if (c.col > 1) c.numFmt = numFormat; });
    sheet.addRow([]);
    sheet.addRow(['Surplus/(Deficit)', Number(surplusDeficit) || 0]).getCell(1).font = { bold: true };
    sheet.lastRow.getCell(2).numFmt = numFormat;

    const filename = `Tier_Report_${fiscalYear}_${regionDisplay}_${departmentDisplay}_${divisionDisplay}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const buffer = await workbook.xlsx.writeBuffer();
    res.send(buffer);
  } catch (error) {
    console.error('Error generating tier Excel:', error);
    res.status(500).json({ message: error.message });
  }
};


module.exports = {
  getFinalizedData,
  getTierData,
  getTierSavedItems,
  saveTierData,
  getCurrentVersion,
  getRevisions,
  getRevisionById,
  restoreRevision,
  generateTierPDF,
  generateTierExcel,
};