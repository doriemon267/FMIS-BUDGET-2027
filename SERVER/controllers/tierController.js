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
const {
  shouldShowDraftWatermark,
  drawMuhammaraDraftWatermark,
} = require('../utils/proposalPdfWatermark');
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

    // Reaching the BRD stage makes Tier data available, but it must remain
    // editable until the proposal itself is actually finalized.
    const hasFinalized = proposals.some(
      (proposal) => String(proposal.status || '').trim().toUpperCase() === 'FINALIZED'
    );
    const allFinalized = proposals.length > 0 && proposals.every(
      (proposal) => String(proposal.status || '').trim().toUpperCase() === 'FINALIZED'
    );

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
      hasFinalized,
      allFinalized,
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
const PS_STRUCTURE_GETTERS = {
  "Salaries - Regular (Authorized Positions)": (e) => {
    const app = String(e.statusOfAppointment || '').toUpperCase();
    return (app.includes('PERMANENT') || app.includes('REGULAR') || app.includes('PLANTILLA')) ? (Number(e.annualSalary)||0) : 0;
  },
  "Casual Personnel": (e) => {
    const app = String(e.statusOfAppointment || '').toUpperCase();
    return app.includes('CASUAL') ? (Number(e.annualSalary)||0) : 0;
  },
  "PERA": (e) => Number(e.PERA) || 0,
  "Representation Allowance": (e) => Number(e.RATA) || 0,
  "Uniform/Clothing Allowance": (e) => Number(e.uniformALLOWANCE) || 0,
  "Additional Medical Allowance": (e) => Number(e.additionalMedical) || 0,
  "Meal Allowances": (e) => Number(e.meal) || 0,
  "Longevity Pay (Loyalty Award)": (e) => Number(e.loyaltyAward) || 0,
  "Productivity Enhancement Incentive": (e) => Number(e.productivityIncentive) || 0,
  "Cash Gift": (e) => Number(e.cashGift) || 0,
  "Mid-Year and Year-End Bonus": (e) => (Number(e.midyearBonus)||0) + (Number(e.yearEndBonus)||0),
  "Hazard Pay": (e) => Number(e.hazardPay) || 0,
  "GSIS Ret. & Life Insurance Premium": (e) => Number(e.gsisPremium) || 0,
  "PAG-IBIG Contributions": (e) => Number(e.pagibigPremium) || 0,
  "PHILHEALTH Contributions": (e) => Number(e.philhealthPremium) || 0,
  "Employees Compensation Insurance Premium": (e) => Number(e.employeeCompensation) || 0,
  "Provident Fund": (e) => Number(e.providentFund) || 0,
  "Earned Leaves": (e) => Number(e.earnedLeaves) || 0,
};

/**
 * Get regional tier breakdown by aggregating source data (PS, MOOE, CO, Income)
 * per region using exact line-item structure matching.
 * Returns { regions: [regionName, ...], data: { regionName: { lineItemName: { tier1, tier2, total }, ... }, ... } }
 */
const getRegionalTierBreakdown = async (fiscalYear, department, division) => {
  const fyStr = String(fiscalYear);
  const buildQuery = (extraFields = {}) => {
    const q = { fiscalYear: fyStr, budgetType: 'Initial', ...extraFields };
    if (department) {
      const d = String(department).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      q.department = new RegExp('^' + d + '$', 'i');
    }
    if (division) {
      const dv = String(division).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      q.division = new RegExp('^' + dv + '$', 'i');
    }
    return q;
  };

  // Fetch all source data
  const PersonnelService = mongoose.connection.collection('personnelservices');
  const MooeProposal = mongoose.connection.collection('mooeproposals');
  const CapitalOutlayModel = require('../models/CapitalOutlay');
  const CapitalOutlayDetail = mongoose.connection.collection('capitaloutlaydetails');
  const Income = mongoose.connection.collection('incomes');

  const [psData, mooeData, coData, codData, incData] = await Promise.all([
    PersonnelService.find(buildQuery()).toArray(),
    MooeProposal.find(buildQuery()).toArray(),
    CapitalOutlayModel.find(buildQuery()).populate('category', 'categoryName').lean(),
    CapitalOutlayDetail.find().toArray(),
    Income.find(buildQuery()).toArray(),
  ]);

  const codByParent = {};
  (codData || []).forEach(d => {
    const parentId = String(d.capital_outlay_id || '');
    if (parentId) {
      if (!codByParent[parentId]) codByParent[parentId] = [];
      codByParent[parentId].push(d);
    }
  });

  // Collect all regions
  const regionSet = new Set();
  const addRegion = (items) => items.forEach(it => {
    const r = String(it.region || '').trim().toUpperCase();
    if (r && r !== 'ALL') regionSet.add(r);
  });
  addRegion(psData);
  addRegion(mooeData);
  addRegion(coData);
  addRegion(incData);

  const regions = Array.from(regionSet).sort();
  const data = {};
  const summaryTotals = {};

  regions.forEach(rName => {
    const regionData = {};
    const norm = (s) => String(s || '').trim().toUpperCase();

    let psTotal = 0;
    let mooeTotal = 0;
    let coTotal = 0;
    let incTotal = 0;

    // 1. Personnel Services items (aggregate per employee record into PS line items)
    psData.filter(it => norm(it.region) === rName).forEach(emp => {
      Object.entries(PS_STRUCTURE_GETTERS).forEach(([itemName, getter]) => {
        const val = getter(emp);
        if (val > 0) {
          psTotal += val;
          if (!regionData[itemName]) regionData[itemName] = { tier1: 0, tier2: 0, total: 0 };
          regionData[itemName].tier2 += val;
          regionData[itemName].total += val;
        }
      });
    });

    // 2. MOOE items (aggregate by accounting title / subline item)
    mooeData.filter(it => norm(it.region) === rName).forEach(it => {
      const title = it.accountingTitle || it.sublineItem || it.uacsCode || 'MOOE Item';
      const total = Number(it.amount || it.total || it.Total) || 0;
      if (total > 0) {
        mooeTotal += total;
        if (!regionData[title]) regionData[title] = { tier1: 0, tier2: 0, total: 0 };
        regionData[title].tier2 += total;
        regionData[title].total += total;
      }
    });

    // 3. Capital Outlay items (joined with capitaloutlaydetails)
    coData.filter(it => norm(it.region) === rName).forEach(it => {
      const parentId = String(it._id || '');
      const details = codByParent[parentId] || [];
      const parentTotal = Number(it.amount || it.total || it.Total) || 0;
      const catTitle = (it.category && typeof it.category === 'object' ? it.category.categoryName : null) || it.categoryName || 'Capital Outlay Item';

      if (details.length > 0) {
        details.forEach(det => {
          const t1 = Number(det.subsidy_amount) || 0;
          const inc = Number(det.income_amount) || 0;
          const total = t1 + inc;
          if (total > 0) {
            coTotal += total;
            const keysToStore = [catTitle, det.particulars, it.sublineItem, it.accountingTitle, it.uacsCode].filter(Boolean);
            keysToStore.forEach(k => {
              if (!regionData[k]) regionData[k] = { tier1: 0, tier2: 0, total: 0 };
              regionData[k].tier2 += total;
              regionData[k].total += total;
            });
          }
        });
      } else if (parentTotal > 0) {
        const keysToStore = [catTitle, it.sublineItem, it.accountingTitle, it.uacsCode].filter(Boolean);
        coTotal += parentTotal;
        keysToStore.forEach(k => {
          if (!regionData[k]) regionData[k] = { tier1: 0, tier2: 0, total: 0 };
          regionData[k].tier2 += parentTotal;
          regionData[k].total += parentTotal;
        });
      }
    });

    // 4. Income items
    incData.filter(it => norm(it.region) === rName).forEach(it => {
      const title = it.name || it.particulars || it.uacsCode || 'Income Item';
      const total = Number(it.amount || it.total || it.Total) || 0;
      if (total > 0) {
        incTotal += total;
        if (!regionData[title]) regionData[title] = { tier1: 0, tier2: 0, total: 0 };
        regionData[title].tier2 += total;
        regionData[title].total += total;
      }
    });

    const totalUses = psTotal + mooeTotal + coTotal;
    const bgtSupport = Math.max(0, totalUses - incTotal);

    summaryTotals[rName] = {
      CorpIncome: { inc: incTotal, t1: 0, t2: 0, tot: 0, bgt: incTotal },
      PS: { inc: 0, t1: 0, t2: psTotal, tot: psTotal, bgt: psTotal },
      MOOE: { inc: 0, t1: 0, t2: mooeTotal, tot: mooeTotal, bgt: mooeTotal },
      CO: { inc: 0, t1: 0, t2: coTotal, tot: coTotal, bgt: coTotal },
      TotalUses: { inc: 0, t1: 0, t2: totalUses, tot: totalUses, bgt: totalUses },
      BudgetSupport: { inc: 0, t1: 0, t2: bgtSupport, tot: bgtSupport, bgt: bgtSupport },
      TotalSources: { inc: incTotal, t1: 0, t2: bgtSupport, tot: totalUses, bgt: totalUses },
    };

    data[rName] = regionData;
  });

  return { regions, data, summaryTotals };
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

    const {
      fiscalYear,
      region,
      department,
      division,
      regionName,
      departmentName,
      divisionName,
      reportSummary,
      isFinalized: isFinalizedFromBody,
      version: versionFromBody,
    } = req.body || {};
    if (!reportSummary || !fiscalYear) {
      return res.status(400).json({ message: 'fiscalYear and reportSummary are required.' });
    }
    const regionDisplay = regionName || (region && typeof region === 'object' ? (region.RegionName || region.Region || region.regionName || region.name || 'All') : (region === 'ALL' || !region ? 'All' : region));
    const departmentDisplay = departmentName || (department && typeof department === 'object' ? (department.DepartmentName || department.name || 'All') : (department === 'ALL' || !department ? 'All' : department));
    const divisionDisplay = divisionName || (division && typeof division === 'object' ? (division.DivisionName || division.name || 'All') : (division === 'ALL' || !division ? 'All' : division));
    const version = versionFromBody != null ? Number(versionFromBody) : (await getCurrentVersionForScope(fiscalYear, region, department, division));

    const isAllRegions = regionDisplay.toLowerCase() === 'all';
    let regionalBreakdown = { regions: [], data: {}, summaryTotals: {} };
    if (isAllRegions) {
      regionalBreakdown = await getRegionalTierBreakdown(fiscalYear, department, division);
    }
    
    // Group logic
    // We will have: GRAND TOTAL, CENTRAL OFFICE, TOTAL REGIONS, REGION 1, REGION 2...
    const groups = ['GRAND TOTAL'];
    if (isAllRegions) {
       groups.push('CENTRAL OFFICE');
       groups.push('TOTAL REGIONS');
       regionalBreakdown.regions.forEach(r => {
          if (r !== 'CENTRAL OFFICE' && r !== 'TOTAL REGIONS') {
             groups.push(r);
          }
       });
    }

    const generateDocumentId = () => {
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substring(2, 8);
      return `TIER-${timestamp}-${random}`.toUpperCase();
    };
    const documentId = generateDocumentId();

    const filename = `Tier_Report_${fiscalYear}_${regionDisplay}_${departmentDisplay}_${divisionDisplay}.pdf`;
    const tmpFilePath = path.join(os.tmpdir(), `tier_report_${Date.now()}.pdf`);
    
    const recipe = new MuhammaraRecipe('new', tmpFilePath, {
      version: 1.6,
      author: 'FMIS-BUDGET',
      title: 'Tier Budget Report',
      subject: 'Tier Budget Report',
    });

    const SUB_COL_WIDTH = 78; 
    const GROUP_WIDTH = SUB_COL_WIDTH * 5; // Inc, Tier1, Tier2, Total, Bgt
    const colX = [40]; // Particular
    const borderX = [35, 240]; 
    const groupStartBorderX = [240]; 

    groups.forEach((g, i) => {
      const startX = 240 + (i * GROUP_WIDTH);
      colX.push(startX + 5); 
      colX.push(startX + SUB_COL_WIDTH + 5); 
      colX.push(startX + (SUB_COL_WIDTH * 2) + 5); 
      colX.push(startX + (SUB_COL_WIDTH * 3) + 5); 
      colX.push(startX + (SUB_COL_WIDTH * 4) + 5); 
      
      borderX.push(startX + SUB_COL_WIDTH);
      borderX.push(startX + (SUB_COL_WIDTH * 2));
      borderX.push(startX + (SUB_COL_WIDTH * 3));
      borderX.push(startX + (SUB_COL_WIDTH * 4));
      borderX.push(startX + GROUP_WIDTH);
      groupStartBorderX.push(startX + GROUP_WIDTH);
    });
    
    const TABLE_WIDTH = borderX[borderX.length - 1] - 35;
    const PAGE_WIDTH = Math.max(1008, TABLE_WIDTH + 70); 
    const PAGE_HEIGHT = 612;
    const showDraftWatermark = shouldShowDraftWatermark({ isFinalized: isFinalizedFromBody === true });

    recipe.createPage(PAGE_WIDTH, PAGE_HEIGHT);
    drawMuhammaraDraftWatermark(recipe, {
      show: showDraftWatermark,
      pageWidth: PAGE_WIDTH,
      pageHeight: PAGE_HEIGHT,
    });
    
    // Header Logo
    const resolveLogoPath = (name) => {
      const serverAsset = path.join(__dirname, `../assets/${name}`);
      if (fs.existsSync(serverAsset)) return serverAsset;
      const clientAsset = path.join(__dirname, `../../CLIENT/public/${name}`);
      if (fs.existsSync(clientAsset)) return clientAsset;
      return null;
    };
    try {
       const l = resolveLogoPath('logo.png');
       if (l) recipe.image(l, 40, 30, { width: 50, height: 50 });
    } catch (e) {}

    const title1 = "NATIONAL IRRIGATION ADMINISTRATION";
    const title2 = `TIER BUDGET REPORT FOR FY ${fiscalYear || 'ALL'}`;
    const title3 = `REGION: ${regionDisplay} | VERSION: ${version}`;
    
    recipe.text(title1, (PAGE_WIDTH / 2) - (title1.length * 4), 40, { color: [0, 0, 0], fontSize: 14, bold: true });
    recipe.text(title2, (PAGE_WIDTH / 2) - (title2.length * 3.5), 58, { color: [0, 0, 0], fontSize: 12, bold: true });
    recipe.text(title3, (PAGE_WIDTH / 2) - (title3.length * 3.5), 72, { color: [0, 0, 0], fontSize: 12, bold: true });
    
    let currentRowY = 100;

    const drawHeaders = (y) => {
      // Draw background for entire header (height 50)
      recipe.rectangle(35, y, TABLE_WIDTH, 50, { fill: '#eaeaea' });
      
      // "PARTICULAR" text, centered vertically in the 50px header
      recipe.text("PARTICULAR", 40, y + 25, { bold: true, fontSize: 10, color: [0, 0, 0] });
      
      groups.forEach((g, i) => {
        const startX = 240 + (i * GROUP_WIDTH);
        
        // Group Name (e.g. GRAND TOTAL) - Row 1
        const gWidth = recipe.textDimensions(g, { bold: true, fontSize: 8 }).width || (g.length * 4);
        recipe.text(g, startX + (GROUP_WIDTH / 2) - (gWidth / 2), y + 10, { bold: true, fontSize: 8, color: [0, 0, 0] });
        
        // Col 1: Projected Corporate Income [a]
        recipe.text("PROJECTED CORPORATE", startX + 5, y + 26, { bold: true, fontSize: 6, color: [0, 0, 0] });
        recipe.text("INCOME [a]", startX + 5, y + 34, { bold: true, fontSize: 6, color: [0, 0, 0] });
        
        // Col 2: Projected Subsidy (Spans 3 cols) - Row 2
        recipe.text("PROJECTED SUBSIDY", startX + SUB_COL_WIDTH + 5, y + 24, { bold: true, fontSize: 7, color: [0, 0, 0] });
        
        // Tier 1 - Row 3
        recipe.text("TIER 1", startX + SUB_COL_WIDTH + 5, y + 38, { bold: true, fontSize: 6, color: [0, 0, 0] });
        recipe.text("[b]", startX + SUB_COL_WIDTH + 5, y + 46, { bold: true, fontSize: 6, color: [0, 0, 0] });
        
        // Tier 2 - Row 3
        recipe.text("TIER 2", startX + (SUB_COL_WIDTH * 2) + 5, y + 38, { bold: true, fontSize: 6, color: [0, 0, 0] });
        recipe.text("[c]", startX + (SUB_COL_WIDTH * 2) + 5, y + 46, { bold: true, fontSize: 6, color: [0, 0, 0] });
        
        // Total - Row 3
        recipe.text("TOTAL", startX + (SUB_COL_WIDTH * 3) + 5, y + 38, { bold: true, fontSize: 6, color: [0, 0, 0] });
        recipe.text("[d = b + c]", startX + (SUB_COL_WIDTH * 3) + 5, y + 46, { bold: true, fontSize: 6, color: [0, 0, 0] });
        
        // Col 5: Proposed Budget [e = a + d]
        recipe.text("PROPOSED", startX + (SUB_COL_WIDTH * 4) + 5, y + 26, { bold: true, fontSize: 6, color: [0, 0, 0] });
        recipe.text("BUDGET [e = a + d]", startX + (SUB_COL_WIDTH * 4) + 5, y + 34, { bold: true, fontSize: 6, color: [0, 0, 0] });
        
        // Horizontal line under PROJECTED SUBSIDY (spans from Tier 1 to Total)
        recipe.rectangle(startX + SUB_COL_WIDTH, y + 30, SUB_COL_WIDTH * 3, 1, { fill: [0, 0, 0] });
        
        // Vertical lines for sub-columns
        // Between Corporate Income and Tier 1 (starts from y + 16, height 34)
        recipe.rectangle(startX + SUB_COL_WIDTH, y + 16, 1, 34, { fill: [0, 0, 0] });
        
        // Between Tier 1 and Tier 2 (starts from y + 30, height 20)
        recipe.rectangle(startX + (SUB_COL_WIDTH * 2), y + 30, 1, 20, { fill: [0, 0, 0] });
        
        // Between Tier 2 and Total (starts from y + 30, height 20)
        recipe.rectangle(startX + (SUB_COL_WIDTH * 3), y + 30, 1, 20, { fill: [0, 0, 0] });
        
        // Between Total and Proposed Budget (starts from y + 16, height 34)
        recipe.rectangle(startX + (SUB_COL_WIDTH * 4), y + 16, 1, 34, { fill: [0, 0, 0] });
      });

      // Group borders (vertical lines for each group) - height 50
      groupStartBorderX.forEach(x => {
        recipe.rectangle(x, y, 1, 50, { fill: [0, 0, 0] });
      });
      
      // Rightmost border for PARTICULAR column
      recipe.rectangle(240, y, 1, 50, { fill: [0, 0, 0] });
      
      // Top border of header
      recipe.rectangle(35, y, TABLE_WIDTH, 1, { fill: [0, 0, 0] });
      
      // Horizontal line under Group Names
      recipe.rectangle(240, y + 16, TABLE_WIDTH - 205, 1, { fill: [0, 0, 0] });
      
      // Bottom border of header
      recipe.rectangle(35, y + 50, TABLE_WIDTH, 1, { fill: [0, 0, 0] });
    };

    drawHeaders(currentRowY);
    currentRowY += 52;

    const getWrappedText = (text, maxLineLength) => {
      const words = String(text || '').split(' ');
      let lines = [];
      let currentLine = '';
      words.forEach(word => {
        if ((currentLine + ' ' + word).length > maxLineLength) {
          if (currentLine) lines.push(currentLine.trim());
          currentLine = word;
        } else {
          currentLine += (currentLine ? ' ' : '') + word;
        }
      });
      if (currentLine) lines.push(currentLine.trim());
      return lines;
    };

    const drawRow = (title, rowDataMap, isBold = false) => {
      const lines = getWrappedText(title, 32);
      const textHeight = Math.max(lines.length * 10, 10);
      const rowHeight = textHeight + 4; 

      if (currentRowY + rowHeight > PAGE_HEIGHT - 40) {
        recipe.endPage();
        recipe.createPage(PAGE_WIDTH, PAGE_HEIGHT);
        drawMuhammaraDraftWatermark(recipe, {
          show: showDraftWatermark,
          pageWidth: PAGE_WIDTH,
          pageHeight: PAGE_HEIGHT,
        });
        currentRowY = 40;
        drawHeaders(currentRowY);
        currentRowY += 52;
      }

      const rowBot = currentRowY + rowHeight;
      const textStartY = currentRowY + 2;

      lines.forEach((line, index) => {
        recipe.text(line, colX[0], textStartY + (index * 10), { bold: isBold, fontSize: 9, color: [0, 0, 0] });
      });
      
      let colIdx = 1;
      groups.forEach(g => {
         const data = rowDataMap[g] || { inc: 0, t1: 0, t2: 0, tot: 0, bgt: 0 };
         const incStr = data.inc ? formatTierCurrency(data.inc) : '-';
         const t1Str = data.t1 ? formatTierCurrency(data.t1) : '-';
         const t2Str = data.t2 ? formatTierCurrency(data.t2) : '-';
         const totStr = data.tot ? formatTierCurrency(data.tot) : '-';
         const bgtStr = data.bgt ? formatTierCurrency(data.bgt) : '-';
         
         const getStrWidth = (str) => {
            let w = 0;
            for (let i=0; i < str.length; i++) {
              if (str[i] === ',' || str[i] === '.' || str[i] === '-' || str[i] === ' ') w += 2.5;
              else w += 4.5;
            }
            return w;
         };

         recipe.text(incStr, borderX[colIdx + 1] - 5 - getStrWidth(incStr), textStartY, { fontSize: 8, color: [0, 0, 0], bold: isBold }); colIdx++;
         recipe.text(t1Str, borderX[colIdx + 1] - 5 - getStrWidth(t1Str), textStartY, { fontSize: 8, color: [0, 0, 0], bold: isBold }); colIdx++;
         recipe.text(t2Str, borderX[colIdx + 1] - 5 - getStrWidth(t2Str), textStartY, { fontSize: 8, color: [0, 0, 0], bold: isBold }); colIdx++;
         recipe.text(totStr, borderX[colIdx + 1] - 5 - getStrWidth(totStr), textStartY, { fontSize: 8, color: [0, 0, 0], bold: isBold }); colIdx++;
         recipe.text(bgtStr, borderX[colIdx + 1] - 5 - getStrWidth(bgtStr), textStartY, { fontSize: 8, color: [0, 0, 0], bold: isBold }); colIdx++;
      });
      
      recipe.rectangle(35, rowBot, TABLE_WIDTH, 0.5, { fill: [0, 0, 0] });
      borderX.forEach(x => {
        recipe.rectangle(x, currentRowY, 0.5, rowBot - currentRowY, { fill: [0, 0, 0] });
      });
      
      currentRowY = rowBot;
    };

    // Calculate aggregated rowDataMap
    const getRowDataMapForLineItem = (lineItem) => {
       const map = {};
       const getEmpty = () => ({ inc: 0, t1: 0, t2: 0, tot: 0, bgt: 0 });
       
       if (!isAllRegions) {
          map['GRAND TOTAL'] = {
             inc: Number(lineItem.corporateIncome) || 0,
             t1: Number(lineItem.tier1) || 0,
             t2: Number(lineItem.tier2) || 0,
             tot: Number(lineItem.total) || 0,
             bgt: Number(lineItem.proposedBudget || lineItem.total) || 0
          };
          return map;
       }
       
       // Central Office
       const coData = regionalBreakdown.data['CENTRAL OFFICE']?.[lineItem.lineItemId];
       if (coData) {
          map['CENTRAL OFFICE'] = {
             inc: 0,
             t1: Number(coData.tier1) || 0,
             t2: Number(coData.tier2) || 0,
             tot: Number(coData.total) || 0,
             bgt: Number(coData.total) || 0
          };
       } else {
          map['CENTRAL OFFICE'] = getEmpty();
       }
       
       // Total Regions
       let trT1 = 0, trT2 = 0, trTot = 0, trBgt = 0;
       regionalBreakdown.regions.forEach(r => {
          if (r !== 'CENTRAL OFFICE' && r !== 'TOTAL REGIONS') {
             const targetKeys = [
                String(lineItem.lineItemId || '').trim().toLowerCase().replace(/\s+/g, ' '),
                String(lineItem.description || '').trim().toLowerCase().replace(/\s+/g, ' '),
                String(lineItem.name || '').trim().toLowerCase().replace(/\s+/g, ' ')
             ];
             const rMap = regionalBreakdown.data[r] || {};
             const actualKey = Object.keys(rMap).find(k => {
                const normK = k.trim().toLowerCase().replace(/\s+/g, ' ');
                return targetKeys.some(tk => tk === normK || tk.endsWith('-' + normK) || normK.endsWith('-' + tk) || tk.includes(normK) || normK.includes(tk));
             });
             const rData = actualKey ? rMap[actualKey] : null;
             if (rData) {
                trT1 += Number(rData.tier1) || 0;
                trT2 += Number(rData.tier2) || 0;
                trTot += Number(rData.total) || 0;
                trBgt += Number(rData.total) || 0;
                map[r] = {
                   inc: 0,
                   t1: Number(rData.tier1) || 0,
                   t2: Number(rData.tier2) || 0,
                   tot: Number(rData.total) || 0,
                   bgt: Number(rData.total) || 0
                };
             } else {
                map[r] = getEmpty();
             }
          }
       });
       map['TOTAL REGIONS'] = { inc: 0, t1: trT1, t2: trT2, tot: trTot, bgt: trBgt };
       
       // GRAND TOTAL is sum of Central Office + Total Regions
       const coItem = map['CENTRAL OFFICE'] || getEmpty();
       map['GRAND TOTAL'] = {
          inc: coItem.inc,
          t1: coItem.t1 + trT1,
          t2: coItem.t2 + trT2,
          tot: coItem.tot + trTot,
          bgt: coItem.bgt + trBgt
       };
       
       return map;
    };

    // Calculate aggregated rowDataMap for summary
    const getRowDataMapForSummary = (summaryName) => {
       const map = {};
       const getEmpty = () => ({ inc: 0, t1: 0, t2: 0, tot: 0, bgt: 0 });
       const { sourcesOfFunds = {}, usesOfFunds = {}, usesCorporateIncome = {} } = reportSummary;
       const src = sourcesOfFunds;
       const bs = src.budgetarySupport || {};
       const ps = usesOfFunds['Personnel Services'] || {};
       const mooe = usesOfFunds['Maintenance and Other Operating Expenses'] || {};
       const co = usesOfFunds['Capital Outlay'] || {};
       
       let gTotal = getEmpty();
       if (summaryName === 'CorpIncome') {
          gTotal = { inc: src.corporateIncome || 0, t1: 0, t2: 0, tot: 0, bgt: src.corporateIncome || 0 };
       } else if (summaryName === 'BudgetSupport') {
          gTotal = { inc: 0, t1: bs.tier1 || 0, t2: bs.tier2 || 0, tot: bs.total || 0, bgt: bs.total || 0 };
       } else if (summaryName === 'TotalSources') {
          gTotal = { inc: src.corporateIncome || 0, t1: bs.tier1 || 0, t2: bs.tier2 || 0, tot: bs.total || 0, bgt: src.proposedBudget || src.total || 0 };
       } else if (summaryName === 'PS') {
          gTotal = { inc: usesCorporateIncome['Personnel Services'] || 0, t1: ps.tier1 || 0, t2: ps.tier2 || 0, tot: ps.total || 0, bgt: ps.proposedBudget || ps.total || 0 };
       } else if (summaryName === 'MOOE') {
          gTotal = { inc: usesCorporateIncome['Maintenance and Other Operating Expenses'] || 0, t1: mooe.tier1 || 0, t2: mooe.tier2 || 0, tot: mooe.total || 0, bgt: mooe.proposedBudget || mooe.total || 0 };
       } else if (summaryName === 'CO') {
          gTotal = { inc: usesCorporateIncome['Capital Outlay'] || 0, t1: co.tier1 || 0, t2: co.tier2 || 0, tot: co.total || 0, bgt: co.proposedBudget || co.total || 0 };
       } else if (summaryName === 'TotalUses') {
          const totInc = (usesCorporateIncome['Personnel Services'] || 0) + (usesCorporateIncome['Maintenance and Other Operating Expenses'] || 0) + (usesCorporateIncome['Capital Outlay'] || 0);
          gTotal = { inc: totInc, t1: usesOfFunds.tier1 || 0, t2: usesOfFunds.tier2 || 0, tot: usesOfFunds.total || 0, bgt: usesOfFunds.proposedBudget || usesOfFunds.total || 0 };
       }
       
       map['GRAND TOTAL'] = gTotal;
       if (!isAllRegions) return map;
       
       groups.forEach(g => {
          if (g === 'GRAND TOTAL') return;
          if (g === 'CENTRAL OFFICE') {
             map[g] = getEmpty();
          } else if (g === 'TOTAL REGIONS') {
             // Computed after all regions
          } else {
             const rSummary = regionalBreakdown.summaryTotals?.[g]?.[summaryName];
             map[g] = rSummary ? { ...rSummary } : getEmpty();
          }
       });
       
       // Calculate TOTAL REGIONS by summing all actual regions
       let trInc = 0, trT1 = 0, trT2 = 0, trTot = 0, trBgt = 0;
       groups.forEach(g => {
          if (g !== 'GRAND TOTAL' && g !== 'CENTRAL OFFICE' && g !== 'TOTAL REGIONS') {
             const item = map[g] || getEmpty();
             trInc += item.inc || 0;
             trT1 += item.t1 || 0;
             trT2 += item.t2 || 0;
             trTot += item.tot || 0;
             trBgt += item.bgt || 0;
          }
       });
       map['TOTAL REGIONS'] = { inc: trInc, t1: trT1, t2: trT2, tot: trTot, bgt: trBgt };
       
       // If CENTRAL OFFICE is empty/0, ensure GRAND TOTAL equals TOTAL REGIONS for consistency when filtering all regions
       const coItem = map['CENTRAL OFFICE'] || getEmpty();
       if (coItem.tot === 0 && coItem.inc === 0 && coItem.bgt === 0 && (trTot > 0 || trInc > 0)) {
          map['GRAND TOTAL'] = { inc: trInc, t1: trT1, t2: trT2, tot: trTot, bgt: trBgt };
       }
       
       return map;
    };

    drawRow('A. SOURCES OF FUNDS', {}, true);
    drawRow('Projected Corporate Income', getRowDataMapForSummary('CorpIncome'));
    drawRow('Budgetary Support', getRowDataMapForSummary('BudgetSupport'));
    drawRow('TOTAL SOURCES OF FUNDS', getRowDataMapForSummary('TotalSources'), true);
    
    drawRow('B. USES OF FUNDS', {}, true);
    
    const lineItems = reportSummary.lineItems || [];
    let currentCategory = '';
    lineItems.forEach(item => {
       const cat = item.category || '';
       if (cat !== currentCategory) {
          currentCategory = cat;
          drawRow(String(cat), {}, true);
       }
       // only draw if total > 0 or whatever logic
       const catTotal = Number(item.total) || (Number(item.tier1) || 0) + (Number(item.tier2) || 0);
       if ((cat === 'Maintenance and Other Operating Expenses' || cat === 'Capital Outlay') && catTotal <= 0) return;
       
       drawRow('  ' + (item.description || '—'), getRowDataMapForLineItem(item));
    });
    
    drawRow('TOTAL PERSONNEL SERVICES', getRowDataMapForSummary('PS'), true);
    drawRow('TOTAL MOOE', getRowDataMapForSummary('MOOE'), true);
    drawRow('TOTAL CAPITAL OUTLAY', getRowDataMapForSummary('CO'), true);
    drawRow('TOTAL USES OF FUNDS', getRowDataMapForSummary('TotalUses'), true);

    recipe.endPage().endPDF((err) => {
      if (err) {
        console.error('Error generating tier PDF:', err);
        return res.status(500).json({ message: 'Error generating PDF' });
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
      res.setHeader('X-Document-ID', documentId);
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-Document-ID');

      const readStream = fs.createReadStream(tmpFilePath);
      readStream.on('error', (streamErr) => {
        console.error('Error streaming tier PDF:', streamErr);
        if (!res.headersSent) res.status(500).json({ message: 'Failed to stream PDF' });
      });
      res.on('finish', () => { fs.unlink(tmpFilePath, () => {}); });
      readStream.pipe(res);
    });
  } catch (error) {
    console.error('Error generating tier PDF:', error?.message || error, error?.stack);
    if (!res.headersSent) res.status(500).json({ message: error.message || 'Error generating PDF' });
  }
};

const generateTierExcel = async (req, res) => {
  try {
    const ExcelJS = require('exceljs');
    const { fiscalYear, region, department, division, regionName, departmentName, divisionName, reportSummary, version: versionFromBody } = req.body || {};
    if (!reportSummary || !fiscalYear) return res.status(400).json({ message: 'fiscalYear and reportSummary are required.' });
    
    const regionDisplay = regionName || (region === 'ALL' || !region ? 'All' : region);
    const departmentDisplay = departmentName || (!department ? 'All' : department);
    const divisionDisplay = divisionName || (!division ? 'All' : division);
    const version = versionFromBody != null ? Number(versionFromBody) : (await getCurrentVersionForScope(fiscalYear, region, department, division));

    const isAllRegions = regionDisplay.toLowerCase() === 'all';
    let regionalBreakdown = { regions: [], data: {} };
    if (isAllRegions) {
      regionalBreakdown = await getRegionalTierBreakdown(fiscalYear, department, division);
    }
    
    const groups = ['GRAND TOTAL'];
    if (isAllRegions) {
       groups.push('CENTRAL OFFICE');
       groups.push('TOTAL REGIONS');
       regionalBreakdown.regions.forEach(r => {
          if (r !== 'CENTRAL OFFICE' && r !== 'TOTAL REGIONS') groups.push(r);
       });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'FMIS Budget System';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Tier Report', { views: [{ state: 'frozen', ySplit: 5 }] });
    
    const cols = [{ width: 42 }];
    groups.forEach(() => {
      cols.push({ width: 18 }); // Inc
      cols.push({ width: 16 }); // T1
      cols.push({ width: 16 }); // T2
      cols.push({ width: 16 }); // Tot
      cols.push({ width: 16 }); // Bgt
    });
    sheet.columns = cols;
    const maxCols = 1 + (groups.length * 5);
    const maxColLetter = sheet.getColumn(maxCols).letter;

    const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2e7d32' } };
    const headerFont = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    const titleFont = { bold: true, size: 14, color: { argb: 'FF1a472a' } };
    const numFormat = '#,##0.00';

    sheet.mergeCells(`A1:${maxColLetter}1`);
    sheet.getCell('A1').value = 'TIER BUDGET REPORT';
    sheet.getCell('A1').font = titleFont;
    sheet.getCell('A1').alignment = { horizontal: 'center' };
    sheet.addRow([`Fiscal Year: ${fiscalYear}  |  Region: ${regionDisplay}  |  Department: ${departmentDisplay}  |  Division: ${divisionDisplay}`]);
    sheet.mergeCells(`A2:${maxColLetter}2`);
    sheet.getCell('A2').alignment = { horizontal: 'center' };
    sheet.addRow([`Version ${version}`]);
    sheet.mergeCells(`A3:${maxColLetter}3`);
    sheet.getCell('A3').alignment = { horizontal: 'center' };
    sheet.getCell('A3').font = { italic: true, size: 9 };
    sheet.addRow([]);

    const drawHeaders = () => {
      const topRow = ['PARTICULAR'];
      groups.forEach(g => { topRow.push(g); topRow.push(''); topRow.push(''); topRow.push(''); topRow.push(''); });
      sheet.addRow(topRow);
      let cIdx = 2;
      groups.forEach(() => {
        sheet.mergeCells(sheet.lastRow.number, cIdx, sheet.lastRow.number, cIdx + 4);
        sheet.getCell(sheet.lastRow.number, cIdx).alignment = { horizontal: 'center' };
        cIdx += 5;
      });
      sheet.lastRow.eachCell(c => { c.font = headerFont; c.fill = headerFill; });
      
      const subRow = [''];
      groups.forEach(() => {
         subRow.push('PROJECTED CORPORATE INCOME [a]');
         subRow.push('TIER 1 [b]');
         subRow.push('TIER 2 [c]');
         subRow.push('TOTAL [d = b + c]');
         subRow.push('PROPOSED BUDGET [e = a + d]');
      });
      sheet.addRow(subRow);
      sheet.lastRow.eachCell(c => { c.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } }; c.fill = headerFill; c.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' }; });
      sheet.getRow(sheet.lastRow.number).height = 40;
    };

    drawHeaders();

    const addDataRow = (title, rowDataMap, isBold = false) => {
       const rowData = [title];
       groups.forEach(g => {
          const data = rowDataMap[g] || { inc: 0, t1: 0, t2: 0, tot: 0, bgt: 0 };
          rowData.push(data.inc || '');
          rowData.push(data.t1 || '');
          rowData.push(data.t2 || '');
          rowData.push(data.tot || '');
          rowData.push(data.bgt || '');
       });
       const row = sheet.addRow(rowData);
       row.eachCell(c => {
         if (isBold) c.font = { bold: true };
         if (c.col > 1 && typeof c.value === 'number') c.numFmt = numFormat;
         // Draw borders
         c.border = {
           top: {style:'thin'},
           left: {style:'thin'},
           bottom: {style:'thin'},
           right: {style:'thin'}
         };
       });
       if (isBold) {
         row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } }; });
       }
    };

    // Reuse the map builders
    const { sourcesOfFunds = {}, usesOfFunds = {}, usesCorporateIncome = {} } = reportSummary;
    const src = sourcesOfFunds;
    const bs = src.budgetarySupport || {};
    const ps = usesOfFunds['Personnel Services'] || {};
    const mooe = usesOfFunds['Maintenance and Other Operating Expenses'] || {};
    const co = usesOfFunds['Capital Outlay'] || {};
    const lineItems = reportSummary.lineItems || [];

    const getRowDataMapForLineItem = (lineItem) => {
       const map = {};
       const getEmpty = () => ({ inc: 0, t1: 0, t2: 0, tot: 0, bgt: 0 });
       map['GRAND TOTAL'] = {
          inc: Number(lineItem.corporateIncome) || 0,
          t1: Number(lineItem.tier1) || 0,
          t2: Number(lineItem.tier2) || 0,
          tot: Number(lineItem.total) || 0,
          bgt: Number(lineItem.proposedBudget || lineItem.total) || 0
       };
       if (!isAllRegions) return map;
       const coData = regionalBreakdown.data['CENTRAL OFFICE']?.[lineItem.lineItemId];
       if (coData) {
          map['CENTRAL OFFICE'] = { inc: 0, t1: Number(coData.tier1) || 0, t2: Number(coData.tier2) || 0, tot: Number(coData.total) || 0, bgt: Number(coData.total) || 0 };
       } else {
          map['CENTRAL OFFICE'] = getEmpty();
       }
       let trT1 = 0, trT2 = 0, trTot = 0, trBgt = 0;
       regionalBreakdown.regions.forEach(r => {
          if (r !== 'CENTRAL OFFICE' && r !== 'TOTAL REGIONS') {
             const targetKey = String(lineItem.lineItemId).trim().toLowerCase().replace(/\s+/g, ' ');
             const rMap = regionalBreakdown.data[r] || {};
             const actualKey = Object.keys(rMap).find(k => k.trim().toLowerCase().replace(/\s+/g, ' ') === targetKey);
             const rData = actualKey ? rMap[actualKey] : null;
             if (rData) {
                trT1 += Number(rData.tier1) || 0;
                trT2 += Number(rData.tier2) || 0;
                trTot += Number(rData.total) || 0;
                trBgt += Number(rData.total) || 0;
                map[r] = { inc: 0, t1: Number(rData.tier1) || 0, t2: Number(rData.tier2) || 0, tot: Number(rData.total) || 0, bgt: Number(rData.total) || 0 };
             } else {
                map[r] = getEmpty();
             }
          }
       });
       map['TOTAL REGIONS'] = { inc: 0, t1: trT1, t2: trT2, tot: trTot, bgt: trBgt };
       return map;
    };

    const getRowDataMapForSummary = (summaryName) => {
       const map = {};
       const getEmpty = () => ({ inc: 0, t1: 0, t2: 0, tot: 0, bgt: 0 });
       let gTotal = getEmpty();
       if (summaryName === 'CorpIncome') {
          gTotal = { inc: src.corporateIncome || 0, t1: 0, t2: 0, tot: 0, bgt: src.corporateIncome || 0 };
       } else if (summaryName === 'BudgetSupport') {
          gTotal = { inc: 0, t1: bs.tier1 || 0, t2: bs.tier2 || 0, tot: bs.total || 0, bgt: bs.total || 0 };
       } else if (summaryName === 'TotalSources') {
          gTotal = { inc: src.corporateIncome || 0, t1: bs.tier1 || 0, t2: bs.tier2 || 0, tot: bs.total || 0, bgt: src.proposedBudget || src.total || 0 };
       } else if (summaryName === 'PS') {
          gTotal = { inc: usesCorporateIncome['Personnel Services'] || 0, t1: ps.tier1 || 0, t2: ps.tier2 || 0, tot: ps.total || 0, bgt: ps.proposedBudget || ps.total || 0 };
       } else if (summaryName === 'MOOE') {
          gTotal = { inc: usesCorporateIncome['Maintenance and Other Operating Expenses'] || 0, t1: mooe.tier1 || 0, t2: mooe.tier2 || 0, tot: mooe.total || 0, bgt: mooe.proposedBudget || mooe.total || 0 };
       } else if (summaryName === 'CO') {
          gTotal = { inc: usesCorporateIncome['Capital Outlay'] || 0, t1: co.tier1 || 0, t2: co.tier2 || 0, tot: co.total || 0, bgt: co.proposedBudget || co.total || 0 };
       } else if (summaryName === 'TotalUses') {
          const totInc = (usesCorporateIncome['Personnel Services'] || 0) + (usesCorporateIncome['Maintenance and Other Operating Expenses'] || 0) + (usesCorporateIncome['Capital Outlay'] || 0);
          gTotal = { inc: totInc, t1: usesOfFunds.tier1 || 0, t2: usesOfFunds.tier2 || 0, tot: usesOfFunds.total || 0, bgt: usesOfFunds.proposedBudget || usesOfFunds.total || 0 };
       }
       map['GRAND TOTAL'] = gTotal;
       if (!isAllRegions) return map;
       
       const sumCategoryForRegion = (rName, categoryName) => {
          let t1 = 0, t2 = 0, tot = 0;
          lineItems.forEach(item => {
             if (categoryName && item.category !== categoryName) return;
             const targetKey2 = String(item.lineItemId).trim().toLowerCase().replace(/\s+/g, ' ');
             const rMap2 = regionalBreakdown.data[rName] || {};
             const actualKey2 = Object.keys(rMap2).find(k => k.trim().toLowerCase().replace(/\s+/g, ' ') === targetKey2);
             const data = actualKey2 ? rMap2[actualKey2] : null;
             if (data) {
                t1 += Number(data.tier1) || 0;
                t2 += Number(data.tier2) || 0;
                tot += Number(data.total) || 0;
             }
          });
          return { inc: 0, t1, t2, tot, bgt: tot }; 
       };
       
       groups.forEach(g => {
          if (g === 'GRAND TOTAL') return;
          if (summaryName === 'CorpIncome' || summaryName === 'BudgetSupport' || summaryName === 'TotalSources') {
             map[g] = getEmpty();
          } else if (summaryName === 'PS') {
             map[g] = sumCategoryForRegion(g, 'Personnel Services');
          } else if (summaryName === 'MOOE') {
             map[g] = sumCategoryForRegion(g, 'Maintenance and Other Operating Expenses');
          } else if (summaryName === 'CO') {
             map[g] = sumCategoryForRegion(g, 'Capital Outlay');
          } else if (summaryName === 'TotalUses') {
             map[g] = sumCategoryForRegion(g, null);
          }
       });
       
       if (summaryName === 'PS' || summaryName === 'MOOE' || summaryName === 'CO' || summaryName === 'TotalUses') {
          let trT1 = 0, trT2 = 0, trTot = 0;
          groups.forEach(g => {
             if (g !== 'GRAND TOTAL' && g !== 'CENTRAL OFFICE' && g !== 'TOTAL REGIONS') {
                trT1 += map[g].t1; trT2 += map[g].t2; trTot += map[g].tot;
             }
          });
          map['TOTAL REGIONS'] = { inc: 0, t1: trT1, t2: trT2, tot: trTot, bgt: trTot };
       }
       return map;
    };

    addDataRow('A. SOURCES OF FUNDS', {}, true);
    addDataRow('Projected Corporate Income', getRowDataMapForSummary('CorpIncome'));
    addDataRow('Budgetary Support', getRowDataMapForSummary('BudgetSupport'));
    addDataRow('TOTAL SOURCES OF FUNDS', getRowDataMapForSummary('TotalSources'), true);
    
    addDataRow('B. USES OF FUNDS', {}, true);
    let currentCategory = '';
    lineItems.forEach(item => {
       const cat = item.category || '';
       if (cat !== currentCategory) {
          currentCategory = cat;
          addDataRow(String(cat), {}, true);
       }
       const catTotal = Number(item.total) || (Number(item.tier1) || 0) + (Number(item.tier2) || 0);
       if ((cat === 'Maintenance and Other Operating Expenses' || cat === 'Capital Outlay') && catTotal <= 0) return;
       
       addDataRow('  ' + (item.description || '—'), getRowDataMapForLineItem(item));
    });
    
    addDataRow('TOTAL PERSONNEL SERVICES', getRowDataMapForSummary('PS'), true);
    addDataRow('TOTAL MOOE', getRowDataMapForSummary('MOOE'), true);
    addDataRow('TOTAL CAPITAL OUTLAY', getRowDataMapForSummary('CO'), true);
    addDataRow('TOTAL USES OF FUNDS', getRowDataMapForSummary('TotalUses'), true);

    const filename = `Tier_Report_${fiscalYear}_${regionDisplay}_${departmentDisplay}_${divisionDisplay}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error generating tier Excel:', error);
    if (!res.headersSent) res.status(500).json({ message: error.message || 'Error generating Excel' });
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
