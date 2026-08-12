const xlsx = require("xlsx");
const CapitalOutlay = require("../models/CapitalOutlay");
const CapitalOutlayDetails = require("../models/CapitalOutlayDetails");
const NewProposalWorkflow = require("../models/NewProposalWorkflow");
const Category = require("../models/Category");
const ChartOfAccounts = require("../models/chartOfAccounts");
const TitleMapping = require("../models/titleMapping");
const Settings = require("../models/Settings");
const { regionsMatch, normalizeRegionName } = require("../utils/regionUtils");
const {
  validateCapitalOutlayAccount,
  normalizeAccountLabel,
  findConfiguredCapitalOutlayCategory,
  selectCapitalOutlayMapping,
} = require("../utils/capitalOutlayAccountValidation");

const normalizeHeader = (value = "") => value.toString().trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");

const findColumn = (headers, candidates) => headers.find((header) => {
  const normalizedHeader = normalizeHeader(header);
  return candidates.some((candidate) => {
    const normalizedCandidate = normalizeHeader(candidate);
    return normalizedHeader === normalizedCandidate || normalizedHeader.includes(normalizedCandidate);
  });
});

const parseAmount = (value) => {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return value;
  const parsed = parseFloat(value.toString().replace(/,/g, "").replace(/₱/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeText = normalizeAccountLabel;

const resolveCapitalOutlayUacs = async ({
  title,
  sublineItem,
  accountingTitle,
  particulars,
  uacsCode,
  allowedSublineItems = [],
}) => {
  const exactSubline = sublineItem ? new RegExp(`^${escapeRegex(sublineItem)}$`, "i") : null;
  const exactAccountingTitle = accountingTitle ? new RegExp(`^${escapeRegex(accountingTitle)}$`, "i") : null;
  const exactTitle = title ? new RegExp(`^${escapeRegex(title)}$`, "i") : null;
  const preferredSubline = sublineItem || (allowedSublineItems.length === 1 ? allowedSublineItems[0] : "");

  let resolved = {
    uacsCode: uacsCode || null,
    sublineItem: preferredSubline,
    accountingTitle: accountingTitle || ""
  };

  // 1. Honor an explicitly supplied, valid Capital Outlay UACS code.
  if (uacsCode) {
    const exactUacs = new RegExp(`^${escapeRegex(uacsCode)}$`, "i");
    const matchingMappings = await TitleMapping.find({ uacsCode: exactUacs, isActive: true }).lean();
    const matchingAccounts = matchingMappings.length > 0
      ? []
      : await ChartOfAccounts.find({ uacsCode: exactUacs }).lean();
    const match = selectCapitalOutlayMapping(
      [...matchingMappings, ...matchingAccounts],
      { sublineItem: preferredSubline, accountingTitle, allowedSublineItems }
    );
    if (match) {
      if (!resolved.sublineItem) resolved.sublineItem = match.sublineItem;
      if (!resolved.accountingTitle) resolved.accountingTitle = match.accountingTitle;
    }
    return resolved;
  }

  // 2. Try exact match from TitleMapping. Never select 5-02 or semi-expendable mappings.
  if (exactTitle) {
    const exactQuery = {
      lineItem: exactTitle,
      isActive: true,
    };
    if (exactSubline) exactQuery.sublineItem = exactSubline;
    if (exactAccountingTitle) exactQuery.accountingTitle = exactAccountingTitle;

    let titleMappings = await TitleMapping.find(exactQuery)
      .sort({ accountingTitle: 1, sublineItem: 1 })
      .lean();

    // If the optional Excel labels did not exactly match the source database,
    // retry by TITLE and let the allowed category sublines choose the CO account.
    if (titleMappings.length === 0 && (exactSubline || exactAccountingTitle)) {
      titleMappings = await TitleMapping.find({ lineItem: exactTitle, isActive: true })
        .sort({ accountingTitle: 1, sublineItem: 1 })
        .lean();
    }

    const titleMapping = selectCapitalOutlayMapping(titleMappings, {
      sublineItem: preferredSubline,
      accountingTitle,
      allowedSublineItems,
    });

    if (titleMapping?.uacsCode) {
      resolved.uacsCode = titleMapping.uacsCode;
      if (!resolved.sublineItem) resolved.sublineItem = titleMapping.sublineItem;
      if (!resolved.accountingTitle) resolved.accountingTitle = titleMapping.accountingTitle;
      return resolved;
    }
  }

  // 3. SMART FALLBACK: If exact Title fails, try fuzzy match or keyword match
  const searchStr = `${title} ${particulars}`.toUpperCase();
  const keywords = [
    { key: "FURNITURE", match: /FURNITURE|FIXTURE|BOOK/i, defaultUacs: "5060407001", defaultSubline: "Furniture and Fixtures", defaultAcc: "Furniture and Fixtures" },
    { key: "INTANGIBLE", match: /INTANGIBLE|SOFTWARE|LICENSE|APP/i, defaultUacs: "5060601000", defaultSubline: "Computer Software", defaultAcc: "Computer Software" },
    { key: "MACHINERY", match: /MACHINERY|EQUIPMENT|IT|COMPUTER/i, defaultUacs: "5060405003", defaultSubline: "Machinery and Equipment", defaultAcc: "Information and Communication Technology Equipment" },
    { key: "TRANSPORTATION", match: /TRANSPORTATION|VEHICLE|CAR|MOTOR|TRUCK/i, defaultUacs: "5060406001", defaultSubline: "Motor Vehicles", defaultAcc: "Motor Vehicles" },
    { key: "LAND", match: /LAND|LOT|TITLING/i, defaultUacs: "5060101000", defaultSubline: "Land", defaultAcc: "Land" },
    { key: "CONSTRUCTION", match: /CONSTRUCTION|BUILDING|STRUCTURE|FACILITIES|REHABILITATION/i, defaultUacs: "5060404001", defaultSubline: "Buildings", defaultAcc: "Buildings" }
  ];

  for (const k of keywords) {
    if (k.match.test(searchStr)) {
      // Try TitleMapping first
      const fuzzyMappings = await TitleMapping.find({
        $or: [
          { lineItem: new RegExp(k.key, "i") },
          { sublineItem: new RegExp(k.key, "i") },
          { accountingTitle: new RegExp(k.key, "i") }
        ],
        isActive: true,
      }).sort({ accountingTitle: 1, sublineItem: 1 }).limit(100).lean();
      const fuzzyMapping = selectCapitalOutlayMapping(fuzzyMappings, {
        sublineItem: preferredSubline,
        accountingTitle,
        allowedSublineItems,
      });

      if (fuzzyMapping?.uacsCode) {
        resolved.uacsCode = fuzzyMapping.uacsCode;
        if (!resolved.sublineItem) resolved.sublineItem = fuzzyMapping.sublineItem;
        if (!resolved.accountingTitle) resolved.accountingTitle = fuzzyMapping.accountingTitle;
        console.log(`Smart Match (TitleMapping): Keyword "${k.key}" -> Resolved to ${resolved.uacsCode}`);
        return resolved;
      }

      // Try ChartOfAccounts fallback
      const chartAccounts = await ChartOfAccounts.find({
        $or: [
          { sublineItem: new RegExp(k.key, "i") },
          { accountingTitle: new RegExp(k.key, "i") }
        ]
      }).sort({ accountingTitle: 1, sublineItem: 1 }).limit(100).lean();
      const chartAccount = selectCapitalOutlayMapping(chartAccounts, {
        sublineItem: preferredSubline,
        accountingTitle,
        allowedSublineItems,
      });

      if (chartAccount?.uacsCode) {
        resolved.uacsCode = chartAccount.uacsCode;
        if (!resolved.sublineItem) resolved.sublineItem = chartAccount.sublineItem;
        if (!resolved.accountingTitle) resolved.accountingTitle = chartAccount.accountingTitle;
        console.log(`Smart Match (ChartOfAccounts): Keyword "${k.key}" -> Resolved to ${resolved.uacsCode}`);
        return resolved;
      }

      // FINAL HARDCODED FALLBACK
      resolved.uacsCode = k.defaultUacs;
      if (!resolved.sublineItem) {
        resolved.sublineItem = allowedSublineItems.length === 1
          ? allowedSublineItems[0]
          : k.defaultSubline;
      }
      if (!resolved.accountingTitle) resolved.accountingTitle = k.defaultAcc;
      console.log(`Hardcoded Fallback Used: Keyword "${k.key}" -> Resolved to ${resolved.uacsCode}`);
      return resolved;
    }
  }

  // 4. Diagnostics if all failed
  if (!resolved.uacsCode) {
    try {
      const allItems = await TitleMapping.find({ isActive: true }).distinct('lineItem');
      console.warn(`[DIAGNOSTIC] Could not resolve "${title}". Available Line Items in DB:`, allItems);
    } catch (e) {
      console.error("Diagnostic failed:", e.message);
    }
  }

  return resolved;
};

const getUploadOrgContext = async (req) => {
  const org = {
    region: req.submissionWorkflowData?.region || req.hierarchicalAccess?.accessibleRegions?.[0]?.regionName,
    department: req.hierarchicalAccess?.accessibleDepartments?.[0]?.departmentName,
    division: req.hierarchicalAccess?.accessibleDivisions?.[0],
  };

  try {
    if (req.user?.id) {
      const HierarchicalUserAssignment = require("../models/HierarchicalUserAssignment");
      const assignment = await HierarchicalUserAssignment.getUserPermissions(req.user.id);

      org.region = org.region || assignment?.regions?.[0]?.regionName;
      org.department = org.department || assignment?.departments?.[0]?.departmentName;
      org.division = org.division || (Array.isArray(assignment?.divisions) ? assignment.divisions[0] : assignment?.divisionName);
    }
  } catch (_) {
    // Best-effort only. Fallback values above are enough when assignment lookup is unavailable.
  }

  return org;
};

/**
 * Upload Capital Outlay data from Excel file.
 * Expected format mirrors the actual table columns:
 * TITLE | Subline Item | Accounting Title | UACS Code (optional) | Particulars | INCOME | SUBSIDY | TOTAL
 */
exports.uploadCapitalOutlay = async (req, res) => {
  // Drop the old index if it exists to prevent duplicate key errors with category
  try {
    const mongoose = require("mongoose");
    await mongoose.model("CapitalOutlay").collection.dropIndex("proposalId_1_uacsCode_1_region_1_fiscalYear_1_sublineItem_1");
    console.log("✅ Successfully dropped old CapitalOutlay unique index in upload controller.");
  } catch (err) {
    // Ignore if index doesn't exist or already dropped
  }
  try {
    const mongoose = require("mongoose");
    await mongoose.model("CapitalOutlay").collection.dropIndex("proposalId_1_uacsCode_1_region_1_department_1_fiscalYear_1_sublineItem_1_category_1");
    console.log("✅ Successfully dropped old CapitalOutlay unique index (with department but without division).");
  } catch (err) {
    // Ignore if index doesn't exist or already dropped
  }

  try {
    const activeSettings = await Settings.findOne({ isActive: true });
    if (!activeSettings) {
      return res.status(404).json({
        error: "No active settings found",
        message: "Please set active fiscal year and budget type before uploading"
      });
    }

    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const sheetData = xlsx.utils.sheet_to_json(worksheet, { defval: null });

    if (sheetData.length === 0) {
      return res.status(400).json({
        error: "Empty file",
        message: "The uploaded Excel file contains no data"
      });
    }

    const headers = Object.keys(sheetData[0]);

    const titleCol = findColumn(headers, ["TITLE", "Category"]);
    const sublineCol = findColumn(headers, ["Subline Item"]);
    const accountingCol = findColumn(headers, ["Accounting Title"]);
    const uacsCol = findColumn(headers, ["UACS Code", "UACS"]);
    const particularsCol = findColumn(headers, ["Particulars"]);
    const incomeCol = findColumn(headers, ["INCOME", "Income", "AMOUNT", "Amount"]);
    const subsidyCol = findColumn(headers, ["SUBSIDY", "Subsidy"]);

    // Hierarchy Identifiers
    const regionCol = findColumn(headers, ["REGION", "Region"]);
    const departmentCol = findColumn(headers, ["DEPARTMENT", "Department"]);
    const divisionCol = findColumn(headers, ["DIVISION", "Division"]);
    const rcCol = findColumn(headers, ["RESPONSIBILITY CENTER", "Responsibility Center", "RC", "rc"]);

    const missingColumns = [
      ["TITLE", titleCol],
    ]
      .filter(([, column]) => !column)
      .map(([label]) => label);

    if (missingColumns.length > 0) {
      return res.status(400).json({
        error: "Invalid format",
        message: `Missing required column: ${missingColumns.join(", ")}`
      });
    }

    // Fetch master data for auto-detecting Responsibility Center levels
    const RegionModel = require('../models/Region');
    const DepartmentModel = require('../models/Department');
    const allRegions = await RegionModel.find({}).lean();
    const allDepartments = await DepartmentModel.find({}).lean();
    const allCategories = await Category.find({})
      .select('_id categoryName sublineItems')
      .sort({ categoryName: 1 })
      .lean();

    if (allCategories.length === 0) {
      return res.status(400).json({
        error: "Capital Outlay categories are not configured",
        message: "Add the allowed Capital Outlay titles on the /categories page before uploading."
      });
    }

    const configuredCategoryNames = allCategories
      .map((category) => category.categoryName)
      .filter(Boolean);
    
    const knownRegions = allRegions.map(r => String(r.regionName || r.Region || '').toUpperCase().trim());
    const knownDepts = allDepartments.map(d => String(d.departmentName || d.DepartmentName || d.Department || '').toUpperCase().trim());

    console.log(`Processing Capital Outlay upload. Rows found: ${sheetData.length}`);
    const org = await getUploadOrgContext(req);
    const proposalId = req.body.proposalId || req.query.proposalId;
    let strictScope = null;
    if (proposalId) {
      const proposal = await NewProposalWorkflow.findById(proposalId).populate('region').lean();
      if (proposal) {
        let regionName = 'CENTRAL OFFICE';
        if (proposal.region) {
          if (typeof proposal.region === 'string') {
            // If it's an ObjectId string, find it in allRegions
            const matched = allRegions.find(r => String(r._id) === proposal.region);
            if (matched) {
              regionName = matched.Region || matched.regionName || matched.name || proposal.region;
            } else {
              regionName = proposal.region;
            }
          } else if (typeof proposal.region === 'object') {
            // Might be populated object, or just an ObjectId object
            const rId = proposal.region._id ? String(proposal.region._id) : String(proposal.region);
            const matched = allRegions.find(r => String(r._id) === rId);
            if (matched) {
              regionName = matched.Region || matched.regionName || matched.name || 'CENTRAL OFFICE';
            } else {
              regionName = proposal.region.Region || proposal.region.regionName || proposal.region.name || 'CENTRAL OFFICE';
            }
          }
        } else {
          // Fallback to legacy Proposal if NewProposalWorkflow has no region
          const ProposalModelFallback = require('../models/Proposal');
          const legacy = await ProposalModelFallback.findOne({ workflowRef: proposalId }).select('region').lean();
          if (legacy && legacy.region) {
            regionName = legacy.region;
          } else if (proposal.isCentralOffice) {
            regionName = 'CENTRAL OFFICE';
          }
        }
        
        strictScope = {
          region: regionName,
          department: proposal.department,
          division: proposal.division
        };
      }
    }
    
    // Find matching proposal as fallback linkage only if no explicit proposalId provided
    // We will resolve proposalId per-region dynamically inside the loop to support multi-region uploads
    const ProposalModel = require('../models/Proposal');
    const proposalCache = new Map();
    
    if (proposalId) {
       console.log(`[LINKAGE] Using explicit proposalId: ${proposalId}`);
    } else {
       console.log(`[LINKAGE] No explicit proposalId provided. Will attempt to link per-region automatically.`);
    }

    let success = 0, failed = 0, errors = [];
    let currentRegion = '';
    let currentDept = '';
    let currentRC = '';
    let currentTitle = '';
    let currentSubline = '';
    let currentAccountingTitle = '';

    for (const [index, row] of sheetData.entries()) {
      let rowRegionInput = regionCol ? row[regionCol]?.toString().trim() || '' : '';
      let rowDeptInput = departmentCol ? row[departmentCol]?.toString().trim() || '' : '';
      let rc = rcCol ? row[rcCol]?.toString().trim() || '' : '';
      
      let title = row[titleCol]?.toString().trim() || "";
      let sublineItem = row[sublineCol]?.toString().trim() || "";
      let accountingTitle = row[accountingCol]?.toString().trim() || "";
      const suppliedUacsCode = uacsCol ? row[uacsCol]?.toString().trim() || "" : "";
      const particulars = particularsCol ? row[particularsCol]?.toString().trim() || "" : "";
      const income = parseAmount(row[incomeCol]);
      const subsidy = parseAmount(row[subsidyCol]);
      const cost = income + subsidy;

      // Fill-down logic for grouped formatting
      let regionChanged = false;
      let deptChanged = false;

      if (rowRegionInput) {
        if (currentRegion && rowRegionInput !== currentRegion) regionChanged = true;
        currentRegion = rowRegionInput;
      } else {
        rowRegionInput = currentRegion;
      }

      if (rowDeptInput) {
        if ((currentDept && rowDeptInput !== currentDept) || regionChanged) {
          deptChanged = true;
          currentRC = ''; 
        }
        currentDept = rowDeptInput;
      } else {
        if (regionChanged) {
           currentDept = '';
           currentRC = '';
        }
        rowDeptInput = currentDept;
      }

      if (rc) {
        currentRC = rc;
      } else {
        if (deptChanged) {
          currentRC = '';
        }
        rc = currentRC;
      }

      if (title) {
        const titleChanged = currentTitle && normalizeText(currentTitle) !== normalizeText(title);
        currentTitle = title;
        if (titleChanged) {
          // A new category starts a new mapping group. Do not carry the previous
          // category's subline/accounting title into this row.
          currentSubline = '';
          currentAccountingTitle = '';
        }
      } else {
        title = currentTitle;
      }
      if (sublineItem) currentSubline = sublineItem; else sublineItem = currentSubline;
      if (accountingTitle) currentAccountingTitle = accountingTitle; else accountingTitle = currentAccountingTitle;

      if (!title && !sublineItem && !accountingTitle && income === 0 && subsidy === 0) {
        continue;
      }

      try {
        console.log(`Row ${index + 2}: Title="${title}", Particulars="${particulars}", Income=${income}`);

        if (!title) {
          console.warn(`Row ${index + 2} skipped: Missing TITLE`);
          throw new Error("TITLE (Category) is required");
        }

        const uploadedTitle = title;
        const categoryDoc = findConfiguredCapitalOutlayCategory(uploadedTitle, allCategories);
        if (!categoryDoc) {
          throw new Error(
            `TITLE "${uploadedTitle}" does not match any configured category from /categories. Allowed title(s): ${configuredCategoryNames.join('; ')}.`
          );
        }

        // Use the canonical title from /categories for this row and its
        // fill-down rows. Uploads must never create or persist a new title.
        title = categoryDoc.categoryName;
        currentTitle = title;

        const suppliedAccountValidation = validateCapitalOutlayAccount({
          uacsCode: suppliedUacsCode,
          sublineItem,
          accountingTitle,
        });
        if (!suppliedAccountValidation.valid) {
          throw new Error(suppliedAccountValidation.message);
        }

        const allowedSublineItems = (categoryDoc.sublineItems || [])
          .map((item) => String(item || '').trim())
          .filter(Boolean);
        const allowedSublineSet = new Set(allowedSublineItems.map(normalizeText));

        if (sublineItem && allowedSublineSet.size > 0 && !allowedSublineSet.has(normalizeText(sublineItem))) {
          throw new Error(
            `Subline Item "${sublineItem}" is not allowed for TITLE "${title}". Allowed value(s): ${allowedSublineItems.join(', ')}.`
          );
        }

        // When the category defines exactly one allowed subline (for example,
        // ACQUISITION OF MACHINERY AND EQUIPMENT -> Machinery and Equipment),
        // use it instead of guessing from unrelated Chart of Accounts entries.
        const preferredSubline = sublineItem || (allowedSublineItems.length === 1 ? allowedSublineItems[0] : '');

        const resolution = await resolveCapitalOutlayUacs({
          title,
          sublineItem: preferredSubline,
          accountingTitle,
          particulars,
          uacsCode: suppliedUacsCode,
          allowedSublineItems,
        });

        console.log(`Row ${index + 2} resolution: UACS=${resolution.uacsCode}, Subline=${resolution.sublineItem}`);

        if (!resolution.uacsCode) {
          throw new Error(`Unable to determine UACS code automatically for TITLE "${title}". Please provide Subline Item.`);
        }

        // Use resolved values if they were missing in Excel
        const finalSubline = preferredSubline || resolution.sublineItem;
        const finalAccountingTitle = accountingTitle || resolution.accountingTitle;
        const resolvedUacsCode = resolution.uacsCode;

        const resolvedAccountValidation = validateCapitalOutlayAccount({
          uacsCode: resolvedUacsCode,
          sublineItem: finalSubline,
          accountingTitle: finalAccountingTitle,
        });
        if (!resolvedAccountValidation.valid) {
          throw new Error(resolvedAccountValidation.message);
        }

        if (allowedSublineSet.size > 0 && !allowedSublineSet.has(normalizeText(finalSubline))) {
          throw new Error(
            `Resolved Subline Item "${finalSubline}" is not allowed for TITLE "${title}". Allowed value(s): ${allowedSublineItems.join(', ')}.`
          );
        }

        let targetRegion = rowRegionInput || org.region || null;
        let targetDepartment = rowDeptInput || org.department || null;
        let targetDivision = divisionCol ? row[divisionCol]?.toString().trim() || '' : org.division || null;
        let targetLevel = 'REGION';

        if (rc) {
          const rcUpper = rc.toUpperCase();
          if (knownRegions.includes(rcUpper) || rcUpper === 'CENTRAL OFFICE' || rcUpper === 'CO' || rcUpper.startsWith('REGION')) {
            targetRegion = rc;
            targetLevel = 'REGION';
          } else if (knownDepts.includes(rcUpper) || rcUpper.includes('DEPARTMENT') || rcUpper.includes('SERVICES')) {
            targetDepartment = rc;
            targetLevel = 'DEPARTMENT';
          } else {
            targetDivision = rc;
            targetLevel = 'DIVISION';
          }
        }

        const isSuperAdmin = req.user?.Roles?.includes('SUPER_ADMIN');

        // Enforce organizational scope for non-SuperAdmins
        if (!isSuperAdmin) {
          // 1. If linked to a proposal, it MUST match the proposal's scope
          if (strictScope) {
            // Check Region
            if (strictScope.region && targetRegion && !regionsMatch(targetRegion, strictScope.region)) {
              throw new Error(`Unauthorized: This proposal is for ${strictScope.region}. Row has ${targetRegion}.`);
            }
            // Check Department
            if (strictScope.department && targetDepartment && targetDepartment.toUpperCase() !== strictScope.department.toUpperCase()) {
              throw new Error(`Unauthorized: This proposal is for ${strictScope.department}. Row has ${targetDepartment}.`);
            }
            // Check Division
            if (strictScope.division && targetDivision && targetDivision.toUpperCase() !== strictScope.division.toUpperCase()) {
              throw new Error(`Unauthorized: This proposal is for ${strictScope.division}. Row has ${targetDivision}.`);
            }

            // Automatically ensure organizational context matches proposal if it was missing in Excel
            targetRegion = strictScope.region || targetRegion;
            targetDepartment = strictScope.department || targetDepartment;
            targetDivision = strictScope.division || targetDivision;
          } 
          // 2. If no proposal, check against user's assigned context
          else {
             if (org.department && targetDepartment && targetDepartment.toUpperCase() !== org.department.toUpperCase()) {
                throw new Error(`Unauthorized: You are assigned to ${org.department}. Row has ${targetDepartment}.`);
             }
             // Fallback to assigned context if missing
             if (!targetRegion) targetRegion = org.region;
             if (!targetDepartment) targetDepartment = org.department;
             if (!targetDivision) targetDivision = org.division;
          }
        }

        // FINAL VALIDATION: Prevent "Global" records that leak to other departments
        if (!targetRegion) throw new Error("Could not determine REGION for this record. Please specify in Excel or your profile.");
        if (!targetDepartment) {
          // If the user is a super admin and no dept in Excel, we might allow it, but for Preparers it's fatal.
          const userRoles = req.user?.roles || req.user?.Roles || [];
          if (!userRoles.includes('SUPER_ADMIN')) {
            throw new Error("Could not determine DEPARTMENT for this record. Data leak prevention triggered.");
          }
        }

        // Dynamically resolve proposal linkage for this row's region, department, and division
        let resolvedProposalId = proposalId;
        let resolvedWorkflowRef = null;
        if (!resolvedProposalId && targetRegion) {
          const cacheKey = `${targetRegion}_${targetDepartment || 'none'}_${targetDivision || 'none'}`;
          if (proposalCache.has(cacheKey)) {
            const cachedIds = proposalCache.get(cacheKey);
            resolvedProposalId = cachedIds.proposalId;
            resolvedWorkflowRef = cachedIds.workflowRef;
          } else {
            const query = {
              fiscalYear: activeSettings.fiscalYear.toString(),
              budgetType: activeSettings.budgetType,
              region: targetRegion
            };
            // Use regex for robust matching since Excel inputs might differ in case
            if (targetDepartment) query.department = new RegExp(`^${targetDepartment}$`, 'i');
            if (targetDivision) query.division = new RegExp(`^${targetDivision}$`, 'i');
            
            const matchingLegacy = await ProposalModel.findOne(query).select('_id').lean();
            const NewProposalWorkflow = require('../models/NewProposalWorkflow');
            const RegionModel = require('../models/Region');
            
            // Region in NewProposalWorkflow is an ObjectId, so we must resolve it first
            const regionDoc = await RegionModel.findOne({ Region: new RegExp(`^${targetRegion}$`, 'i') }).select('_id').lean();
            let matchingWorkflow = null;
            
            if (regionDoc) {
              const workflowQuery = { ...query, region: regionDoc._id };
              matchingWorkflow = await NewProposalWorkflow.findOne(workflowQuery).select('_id').lean();
            } else {
              // Fallback just in case some legacy string entries exist
              try {
                matchingWorkflow = await NewProposalWorkflow.findOne(query).select('_id').lean();
              } catch(e) {}
            }
            
            const legacyId = matchingLegacy ? matchingLegacy._id : null;
            const workflowId = matchingWorkflow ? matchingWorkflow._id : null;
            
            proposalCache.set(cacheKey, { proposalId: legacyId, workflowRef: workflowId });
            resolvedProposalId = legacyId;
            resolvedWorkflowRef = workflowId;
          }
        } else if (resolvedProposalId) {
            resolvedWorkflowRef = resolvedProposalId;
        }

        // Normalize targetDivision and targetDepartment so they are consistently null instead of empty strings
        if (!targetDivision || targetDivision.trim() === '') targetDivision = null;
        if (!targetDepartment || targetDepartment.trim() === '') targetDepartment = null;

        console.log(`Row ${index + 2} Tagging: Region=${targetRegion}, Dept=${targetDepartment}, Div=${targetDivision}, Proposal=${resolvedProposalId}, Workflow=${resolvedWorkflowRef}`);

        // 1. MASTER RECORD (CapitalOutlay): Find or Create
        // KEY: category._id is included so different titles (e.g. FURNITURE vs MACHINERY)
        // always get separate master records even if UACS resolves to the same code
        let masterRecord = await CapitalOutlay.findOne({
          category: categoryDoc._id,
          uacsCode: resolvedUacsCode,
          sublineItem: finalSubline,
          region: targetRegion,
          department: targetDepartment,
          division: targetDivision,
          fiscalYear: activeSettings.fiscalYear,
          budgetType: activeSettings.budgetType,
          proposalId: resolvedProposalId || null,
          workflowRef: resolvedWorkflowRef || null
        });

        if (!masterRecord) {
          masterRecord = await CapitalOutlay.create({
            category: categoryDoc._id,
            sublineItem: finalSubline,
            accountingTitle: finalAccountingTitle,
            uacsCode: resolvedUacsCode,
            region: targetRegion,
            department: targetDepartment,
            division: targetDivision,
            originalLevel: targetLevel,
            income: 0,
            subsidy: 0,
            cost: 0,
            fiscalYear: activeSettings.fiscalYear,
            fiscal_year: Number(activeSettings.fiscalYear),
            budgetType: activeSettings.budgetType,
            processBy: req.user?.username || req.user?.name || req.user?.id || "System",
            processDate: new Date(),
            createdBy: req.user?.id || req.user?.userId || "system",
            status: isSuperAdmin && !resolvedProposalId ? "System Upload" : "Draft",
            isSystemGenerated: isSuperAdmin && !resolvedProposalId,
            proposalId: resolvedProposalId || null,
            workflowRef: resolvedWorkflowRef || null
          });
        } else {
          // Backfill workflowRef if it was missing
          if (!masterRecord.workflowRef && resolvedWorkflowRef) {
            masterRecord.workflowRef = resolvedWorkflowRef;
          }
        }

        // 2. DETAIL RECORD (CapitalOutlayDetails) - Check for duplicates first
        // Link duplicate check to the masterRecord which contains the fiscalYear, budgetType, region, and proposalId context
        // const existingDetail = await CapitalOutlayDetails.findOne({
        //   capital_outlay_id: masterRecord._id,
        //   particulars: particulars || "Bulk Upload Item",
        //   income_amount: income,
        //   subsidy_amount: subsidy
        // });

        // if (existingDetail) {
        //   throw new Error('Duplicate entry: This item has already been uploaded.');
        // }

        const detailRecord = await CapitalOutlayDetails.create({
          capital_outlay_id: masterRecord._id,
          particulars: particulars || "Bulk Upload Item",
          income_amount: income,
          subsidy_amount: subsidy,
          processBy: req.user?.username || req.user?.name || req.user?.id || "System",
          processDate: new Date()
        });

        // 3. UPDATE MASTER TOTALS
        masterRecord.income += income;
        masterRecord.subsidy += subsidy;
        masterRecord.cost = masterRecord.income + masterRecord.subsidy;
        await masterRecord.save();

        console.log(`Row ${index + 2} SAVED: DetailID=${detailRecord._id} -> MasterID=${masterRecord._id}`);
        success++;
      } catch (error) {
        console.error(`Row ${index + 2} FAILED: ${error.message}`);
        failed++;
        errors.push({
          row: index + 2,
          title,
          sublineItem,
          uacsCode: suppliedUacsCode || undefined,
          region: org.region,
          error: error.message
        });
      }
    }

    console.log(`Upload complete. Success: ${success}, Failed: ${failed}`);

    return res.json({
      message: "Capital Outlay file processed successfully",
      success,
      savedCount: success,
      failed,
      failedCount: failed,
      totalRows: sheetData.length,
      errors,
      regions: [org.region],
      fiscalYear: activeSettings.fiscalYear,
      budgetType: activeSettings.budgetType,
      totalRecords: success + failed
    });
  } catch (error) {
    return res.status(500).json({
      error: "Internal server error",
      message: error.message
    });
  }
};

/**
 * Generate sample Capital Outlay template
 */
exports.getSampleCapitalOutlayTemplate = async (req, res) => {
  try {
    const sampleData = [
      {
        "REGION": "CENTRAL OFFICE",
        "DEPARTMENT": "ADMINISTRATIVE DEPARTMENT",
        "RESPONSIBILITY CENTER": "MANAGEMENT INFORMATION DIVISION",
        "TITLE": "ACQUISITION OF MACHINERY AND EQUIPMENT",
        "Subline Item": "Machinery and Equipment",
        "Accounting Title": "Information and Communication Technology Equipment",
        "UACS Code": "5060405003",
        "Particulars": "Desktop computers for operations",
        "INCOME": 500000,
        "SUBSIDY": 250000
      },
      {
        "REGION": "",
        "DEPARTMENT": "",
        "RESPONSIBILITY CENTER": "",
        "TITLE": "ACQUISITION OF MACHINERY AND EQUIPMENT",
        "Subline Item": "Machinery and Equipment",
        "Accounting Title": "Information and Communication Technology Equipment",
        "UACS Code": "5060405003",
        "Particulars": "Laptop computers for field personnel",
        "INCOME": 300000,
        "SUBSIDY": 150000
      },
      {
        "REGION": "",
        "DEPARTMENT": "",
        "RESPONSIBILITY CENTER": "",
        "TITLE": "ACQUISITION OF TRANSPORTATION EQUIPMENT",
        "Subline Item": "Transportation Equipment",
        "Accounting Title": "Transportation Equipment",
        "UACS Code": "5060406001",
        "Particulars": "Motorcycles for monitoring teams",
        "INCOME": 400000,
        "SUBSIDY": 200000
      }
    ];

    const worksheet = xlsx.utils.json_to_sheet(sampleData);
    
    worksheet["!cols"] = [
      { wch: 20 },
      { wch: 35 },
      { wch: 35 },
      { wch: 40 },
      { wch: 24 },
      { wch: 28 },
      { wch: 18 },
      { wch: 38 },
      { wch: 16 },
      { wch: 16 }
    ];

    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "Capital Outlay Template");

    // Return as buffer
    const buffer = xlsx.write(workbook, { bookType: "xlsx", type: "buffer" });
    res.set({
      "Content-Disposition": 'attachment; filename="capital_outlay_template.xlsx"',
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
    res.send(buffer);
  } catch (error) {
    return res.status(500).json({
      error: "Failed to generate template",
      message: error.message
    });
  }
};

/**
 * Export Capital Outlay data to Excel file (by fiscal year, budget type, and optional filters)
 */
exports.exportCapitalOutlayToExcel = async (req, res) => {
  try {
    const { fiscalYear, budgetType, region, category } = req.query;

    // Build query filters
    let query = {};
    if (fiscalYear) query.fiscalYear = fiscalYear;
    if (budgetType) query.budgetType = budgetType;
    if (region) query.region = region;
    if (category) query.categoryName = { $regex: category, $options: "i" };

    // Fetch Capital Outlay data
    const data = await CapitalOutlay.find(query)
      .select("categoryName sublineItem accountingTitle uacsCode region income subsidy cost")
      .lean();

    if (data.length === 0) {
      return res.status(400).json({
        error: "No data found",
        message: "No capital outlay records match the specified criteria"
      });
    }

    // Group by region and prepare for export
    const regionGroups = {};
    data.forEach(item => {
      if (!regionGroups[item.region]) {
        regionGroups[item.region] = [];
      }
      regionGroups[item.region].push({
        "Category": item.categoryName || "Other",
        "Subline Item": item.sublineItem || "",
        "Accounting Title": item.accountingTitle || "",
        "UACS Code": item.uacsCode || "",
        "Income": item.income || 0,
        "Subsidy": item.subsidy || 0,
        "Total Cost": item.cost || 0
      });
    });

    // Create worksheet with data organized by region
    let worksheet = xlsx.utils.json_to_sheet([]);
    let currentRow = 1;

    Object.entries(regionGroups).forEach(([region, items]) => {
      // Add region header
      worksheet[`A${currentRow}`] = { v: `${region}`, t: "s", s: { bold: true, fill: { fgColor: { rgb: "FFD9D9D9" } } } };
      currentRow++;

      // Add items for this region
      const regionSheet = xlsx.utils.json_to_sheet(items);
      const mergedData = xlsx.utils.sheet_to_json(regionSheet);
      
      mergedData.forEach((item, idx) => {
        Object.entries(item).forEach(([ key, value ]) => {
          const col = { A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6 }[String.fromCharCode(65 + Object.keys(item).indexOf(key))];
          worksheet[`${String.fromCharCode(65 + Object.keys(item).indexOf(key))}${currentRow + idx}`] = { v: value, t: typeof value === "number" ? "n" : "s" };
        });
      });

      currentRow += mergedData.length + 2;
    });

    worksheet["!cols"] = [
      { wch: 20 },
      { wch: 25 },
      { wch: 30 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 }
    ];

    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "Capital Outlay Export");

    const buffer = xlsx.write(workbook, { bookType: "xlsx", type: "buffer" });
    res.set({
      "Content-Disposition": `attachment; filename="capital_outlay_export_${fiscalYear}_${budgetType}.xlsx"`,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
    res.send(buffer);
  } catch (error) {
    return res.status(500).json({
      error: "Export failed",
      message: error.message
    });
  }
};
