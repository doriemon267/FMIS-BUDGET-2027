const xlsx = require("xlsx");
const CapitalOutlay = require("../models/CapitalOutlay");
const CapitalOutlayDetails = require("../models/CapitalOutlayDetails");
const Category = require("../models/Category");
const ChartOfAccounts = require("../models/chartOfAccounts");
const TitleMapping = require("../models/titleMapping");
const Settings = require("../models/Settings");

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

const resolveCapitalOutlayUacs = async ({ title, sublineItem, accountingTitle, particulars }) => {
  const exactSubline = sublineItem ? new RegExp(`^${escapeRegex(sublineItem)}$`, "i") : null;
  const exactAccountingTitle = accountingTitle ? new RegExp(`^${escapeRegex(accountingTitle)}$`, "i") : null;
  const exactTitle = title ? new RegExp(`^${escapeRegex(title)}$`, "i") : null;

  let resolved = {
    uacsCode: null,
    sublineItem: sublineItem || "",
    accountingTitle: accountingTitle || ""
  };

  // 1. Try exact match from TitleMapping if we have the Title
  if (exactTitle) {
    const titleMapping = await TitleMapping.findOne({
      lineItem: exactTitle,
      isActive: true,
    }).sort({ accountingTitle: 1, sublineItem: 1 }).lean();

    if (titleMapping?.uacsCode) {
      resolved.uacsCode = titleMapping.uacsCode;
      if (!resolved.sublineItem) resolved.sublineItem = titleMapping.sublineItem;
      if (!resolved.accountingTitle) resolved.accountingTitle = titleMapping.accountingTitle;
      return resolved;
    }
  }

  // 2. SMART FALLBACK: If exact Title fails, try fuzzy match or keyword match
  const searchStr = `${title} ${particulars}`.toUpperCase();
  const keywords = [
    { key: "FURNITURE", match: /FURNITURE|FIXTURE|BOOK/i, defaultUacs: "5060407001", defaultSubline: "Furniture and Fixtures", defaultAcc: "Furniture and Fixtures" },
    { key: "MACHINERY", match: /MACHINERY|EQUIPMENT|IT|COMPUTER|SOFTWARE/i, defaultUacs: "5060405003", defaultSubline: "IT Equipment", defaultAcc: "Information and Communication Technology Equipment" },
    { key: "TRANSPORTATION", match: /TRANSPORTATION|VEHICLE|CAR|MOTOR|TRUCK/i, defaultUacs: "5060406001", defaultSubline: "Motor Vehicles", defaultAcc: "Motor Vehicles" },
    { key: "LAND", match: /LAND|LOT|TITLING/i, defaultUacs: "5060101000", defaultSubline: "Land", defaultAcc: "Land" },
    { key: "CONSTRUCTION", match: /CONSTRUCTION|BUILDING|STRUCTURE|FACILITIES|REHABILITATION/i, defaultUacs: "5060404001", defaultSubline: "Buildings", defaultAcc: "Buildings" }
  ];

  for (const k of keywords) {
    if (k.match.test(searchStr)) {
      // Try TitleMapping first
      const fuzzyMapping = await TitleMapping.findOne({
        $or: [
          { lineItem: new RegExp(k.key, "i") },
          { sublineItem: new RegExp(k.key, "i") },
          { accountingTitle: new RegExp(k.key, "i") }
        ]
      }).sort({ isActive: -1 }).lean();

      if (fuzzyMapping?.uacsCode) {
        resolved.uacsCode = fuzzyMapping.uacsCode;
        if (!resolved.sublineItem) resolved.sublineItem = fuzzyMapping.sublineItem;
        if (!resolved.accountingTitle) resolved.accountingTitle = fuzzyMapping.accountingTitle;
        console.log(`Smart Match (TitleMapping): Keyword "${k.key}" -> Resolved to ${resolved.uacsCode}`);
        return resolved;
      }

      // Try ChartOfAccounts fallback
      const chartAccount = await ChartOfAccounts.findOne({
        $or: [
          { sublineItem: new RegExp(k.key, "i") },
          { accountingTitle: new RegExp(k.key, "i") }
        ]
      }).lean();

      if (chartAccount?.uacsCode) {
        resolved.uacsCode = chartAccount.uacsCode;
        if (!resolved.sublineItem) resolved.sublineItem = chartAccount.sublineItem;
        if (!resolved.accountingTitle) resolved.accountingTitle = chartAccount.accountingTitle;
        console.log(`Smart Match (ChartOfAccounts): Keyword "${k.key}" -> Resolved to ${resolved.uacsCode}`);
        return resolved;
      }

      // FINAL HARDCODED FALLBACK
      resolved.uacsCode = k.defaultUacs;
      if (!resolved.sublineItem) resolved.sublineItem = k.defaultSubline;
      if (!resolved.accountingTitle) resolved.accountingTitle = k.defaultAcc;
      console.log(`Hardcoded Fallback Used: Keyword "${k.key}" -> Resolved to ${resolved.uacsCode}`);
      return resolved;
    }
  }

  // 3. Diagnostics if all failed
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
 * TITLE | Subline Item | Accounting Title | Particulars | INCOME | SUBSIDY | TOTAL
 */
exports.uploadCapitalOutlay = async (req, res) => {
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
    
    const knownRegions = allRegions.map(r => String(r.regionName || r.Region || '').toUpperCase().trim());
    const knownDepts = allDepartments.map(d => String(d.departmentName || d.DepartmentName || d.Department || '').toUpperCase().trim());

    console.log(`Processing Capital Outlay upload. Rows found: ${sheetData.length}`);
    const org = await getUploadOrgContext(req);
    
    // Find matching proposal to link records correctly
    const ProposalModel = require('../models/Proposal');
    const targetProposal = await ProposalModel.findOne({
      fiscalYear: activeSettings.fiscalYear.toString(),
      budgetType: activeSettings.budgetType,
      region: org.region
    }).select('_id').lean();

    if (targetProposal) {
      console.log(`[LINKAGE] Found matching proposal: ${targetProposal._id} for Region: ${org.region}`);
    } else {
      console.warn(`[LINKAGE] No matching proposal found for Region: ${org.region}, FY: ${activeSettings.fiscalYear}. Records will be unlinked.`);
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
      const particulars = particularsCol ? row[particularsCol]?.toString().trim() || "" : "";
      const income = parseAmount(row[incomeCol]);
      const subsidy = parseAmount(row[subsidyCol]);
      const cost = income + subsidy;

      // Fill-down logic for grouped formatting
      if (rowRegionInput) currentRegion = rowRegionInput; else rowRegionInput = currentRegion;
      if (rowDeptInput) currentDept = rowDeptInput; else rowDeptInput = currentDept;
      if (rc) currentRC = rc; else rc = currentRC;
      if (title) currentTitle = title; else title = currentTitle;
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

        // Auto-create category if it doesn't exist yet
        // This ensures all Excel title categories (FURNITURE, MACHINERY, etc.) are saved
        const categoryDoc = await Category.findOneAndUpdate(
          { categoryName: new RegExp(`^${escapeRegex(title)}$`, 'i') },
          { $setOnInsert: { categoryName: title.toUpperCase() } },
          { upsert: true, new: true, lean: true }
        );
        if (!categoryDoc) {
          throw new Error(`Failed to find or create Category for title "${title}"`);
        }

        const resolution = await resolveCapitalOutlayUacs({
          title,
          sublineItem,
          accountingTitle,
          particulars
        });

        console.log(`Row ${index + 2} resolution: UACS=${resolution.uacsCode}, Subline=${resolution.sublineItem}`);

        if (!resolution.uacsCode) {
          throw new Error(`Unable to determine UACS code automatically for TITLE "${title}". Please provide Subline Item.`);
        }

        // Use resolved values if they were missing in Excel
        const finalSubline = sublineItem || resolution.sublineItem;
        const finalAccountingTitle = accountingTitle || resolution.accountingTitle;
        const resolvedUacsCode = resolution.uacsCode;

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

        // FINAL VALIDATION: Prevent "Global" records that leak to other departments
        if (!targetRegion) throw new Error("Could not determine REGION for this record. Please specify in Excel or your profile.");
        if (!targetDepartment) {
          // If the user is a super admin and no dept in Excel, we might allow it, but for Preparers it's fatal.
          const userRoles = req.user?.roles || req.user?.Roles || [];
          if (!userRoles.includes('SUPER_ADMIN')) {
            throw new Error("Could not determine DEPARTMENT for this record. Data leak prevention triggered.");
          }
        }

        console.log(`Row ${index + 2} Tagging: Region=${targetRegion}, Dept=${targetDepartment}, Div=${targetDivision}`);

        // 1. MASTER RECORD (CapitalOutlay): Find or Create
        // KEY: category._id is included so different titles (e.g. FURNITURE vs MACHINERY)
        // always get separate master records even if UACS resolves to the same code
        let masterRecord = await CapitalOutlay.findOne({
          category: categoryDoc._id,
          uacsCode: resolvedUacsCode,
          sublineItem: finalSubline,
          region: targetRegion,
          department: targetDepartment,
          fiscalYear: activeSettings.fiscalYear,
          budgetType: activeSettings.budgetType
        });

        const isSuperAdmin = req.user?.Roles?.includes('SUPER_ADMIN');

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
            status: isSuperAdmin ? "System Upload" : "Draft",
            isSystemGenerated: isSuperAdmin,
            proposalId: targetProposal?._id
          });
        }

        // 2. DETAIL RECORD (CapitalOutlayDetails)
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
          region: org.region,
          error: error.message
        });
      }
    }

    console.log(`Upload complete. Success: ${success}, Failed: ${failed}`);

    return res.json({
      message: "Capital Outlay file processed successfully",
      success,
      failed,
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
        "Subline Item": "Service Vehicles",
        "Accounting Title": "Motor Vehicles",
        "Particulars": "One service vehicle for field operations",
        "INCOME": 500000,
        "SUBSIDY": 250000
      },
      {
        "REGION": "",
        "DEPARTMENT": "",
        "RESPONSIBILITY CENTER": "",
        "TITLE": "ACQUISITION OF MACHINERY AND EQUIPMENT",
        "Subline Item": "Office Equipment",
        "Accounting Title": "Furniture and Fixtures",
        "Particulars": "Replacement of workstations and cabinets",
        "INCOME": 300000,
        "SUBSIDY": 150000
      },
      {
        "REGION": "",
        "DEPARTMENT": "",
        "RESPONSIBILITY CENTER": "",
        "TITLE": "ACQUISITION OF TRANSPORTATION EQUIPMENT",
        "Subline Item": "Motorcycles",
        "Accounting Title": "Transportation Equipment",
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
