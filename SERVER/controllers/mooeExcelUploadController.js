const xlsx = require("xlsx");
const MooeProposal = require("../models/mooeProposals"); // Use correct model
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

const resolveMooeMapping = async ({ sublineItem, accountingTitle }) => {
  // Hardcoded mappings for special categories that may not be in ChartOfAccounts
  const hardcodedMappings = [
    { sublineItem: "Financial Expenses", accountingTitle: "Interest Expenses", uacsCode: "5-02-30-010" },
    { sublineItem: "Financial Expenses", accountingTitle: "Bank Charges", uacsCode: "5-02-30-020" },
    { sublineItem: "Financial Expenses", accountingTitle: "Other Financial Expenses", uacsCode: "5-02-30-990" },
    { sublineItem: "Irrigators' Associations (IAs) Operation & Maintenance Cost", accountingTitle: "National Irrigation System", uacsCode: "5-02-99-990-NIS" },
    { sublineItem: "Irrigators' Associations (IAs) Operation & Maintenance Cost", accountingTitle: "Communal Irrigation System", uacsCode: "5-02-99-990-CIS" },
    { sublineItem: "Communication Expenses", accountingTitle: "Telephone Expenses-Mobile", uacsCode: "5-02-05-020-2" }
  ];

  if (sublineItem) {
    const match = hardcodedMappings.find(m => 
      m.sublineItem.toLowerCase() === sublineItem.toLowerCase() && 
      (!accountingTitle || m.accountingTitle.toLowerCase() === accountingTitle.toLowerCase())
    );
    if (match) {
      return {
        accountingTitle: accountingTitle || match.accountingTitle,
        uacsCode: match.uacsCode
      };
    }
  }

  const exactSubline = sublineItem ? new RegExp(`^${escapeRegex(sublineItem)}$`, "i") : null;
  const exactAccountingTitle = accountingTitle ? new RegExp(`^${escapeRegex(accountingTitle)}$`, "i") : null;

  if (exactSubline && exactAccountingTitle) {
    let chartAccount = await ChartOfAccounts.findOne({
      sublineItem: exactSubline,
      accountingTitle: exactAccountingTitle,
    }).lean();

    // Special case: "Other Maintenance and Operating Expenses" in Excel vs blank in DB
    if (!chartAccount && sublineItem.toLowerCase() === "other maintenance and operating expenses") {
      chartAccount = await ChartOfAccounts.findOne({
        $or: [{ sublineItem: null }, { sublineItem: "" }],
        accountingTitle: exactAccountingTitle,
        uacsCode: { $regex: /^5-02-99-990/ }
      }).lean();
    }

    if (chartAccount?.uacsCode) {
      return {
        accountingTitle: accountingTitle || chartAccount.accountingTitle,
        uacsCode: chartAccount.uacsCode,
      };
    }
  }

  if (exactSubline) {
    const chartAccount = await ChartOfAccounts.findOne({
      sublineItem: exactSubline,
    }).sort({ accountingTitle: 1 }).lean();

    if (chartAccount?.uacsCode) {
      return {
        accountingTitle: accountingTitle || chartAccount.accountingTitle,
        uacsCode: chartAccount.uacsCode,
      };
    }

    const titleMapping = await TitleMapping.findOne({
      sublineItem: exactSubline,
      isActive: true,
    }).sort({ accountingTitle: 1 }).lean();

    if (titleMapping?.uacsCode) {
      return {
        accountingTitle: accountingTitle || titleMapping.accountingTitle,
        uacsCode: titleMapping.uacsCode,
      };
    }
  }

  return null;
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
    // Best-effort only.
  }

  return org;
};

// Process Excel file for bulk MOOE upload using the same columns displayed in the table.
exports.uploadMooe = async (req, res) => {
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
      return res.status(400).json({ error: "Empty file", message: "The uploaded Excel file contains no data" });
    }

    const headers = Object.keys(sheetData[0]);
    const sublineCol = findColumn(headers, ["SUBLINE ITEM", "Subline Item", "CATEGORY"]);
    const accountingCol = findColumn(headers, ["ACCOUNTING TITLE", "Accounting Title"]);
    const incomeCol = findColumn(headers, ["INCOME", "Income"]);
    const subsidyCol = findColumn(headers, ["SUBSIDY", "Subsidy"]);

    // Hierarchy Identifiers
    const regionCol = findColumn(headers, ["REGION", "Region"]);
    const departmentCol = findColumn(headers, ["DEPARTMENT", "Department"]);
    const divisionCol = findColumn(headers, ["DIVISION", "Division"]);
    const rcCol = findColumn(headers, ["RESPONSIBILITY CENTER", "Responsibility Center", "RC"]);

    const missingColumns = [
      ["SUBLINE ITEM", sublineCol],
      ["ACCOUNTING TITLE", accountingCol],
    ].filter(([, value]) => !value).map(([label]) => label);

    if (missingColumns.length > 0) {
      return res.status(400).json({
        error: "Invalid format",
        message: `Missing required columns: ${missingColumns.join(', ')}`
      });
    }

    // Fetch master data for auto-detecting Responsibility Center levels
    const RegionModel = require('../models/Region');
    const DepartmentModel = require('../models/Department');
    const allRegions = await RegionModel.find({}).lean();
    const allDepartments = await DepartmentModel.find({}).lean();
    
    const knownRegions = allRegions.map(r => String(r.regionName || r.Region || '').toUpperCase().trim());
    const knownDepts = allDepartments.map(d => String(d.departmentName || d.DepartmentName || d.Department || '').toUpperCase().trim());

    const org = await getUploadOrgContext(req);
    let success = 0, failed = 0, errors = [];
    let currentRegion = '';
    let currentDept = '';
    let currentRC = '';
    let currentSubline = '';
    let currentAccountingTitle = '';

    for (const [index, row] of sheetData.entries()) {
      let rowRegionInput = regionCol ? row[regionCol]?.toString().trim() || '' : '';
      let rowDeptInput = departmentCol ? row[departmentCol]?.toString().trim() || '' : '';
      let rc = rcCol ? row[rcCol]?.toString().trim() || '' : '';
      
      let sublineItem = row[sublineCol]?.toString().trim() || '';
      let accountingTitle = row[accountingCol]?.toString().trim() || '';
      const income = parseAmount(row[incomeCol]);
      const subsidy = parseAmount(row[subsidyCol]);
      const amount = income + subsidy;

      // Fill-down logic for grouped formatting
      if (rowRegionInput) currentRegion = rowRegionInput; else rowRegionInput = currentRegion;
      if (rowDeptInput) currentDept = rowDeptInput; else rowDeptInput = currentDept;
      if (rc) currentRC = rc; else rc = currentRC;
      if (sublineItem) currentSubline = sublineItem; else sublineItem = currentSubline;
      if (accountingTitle) currentAccountingTitle = accountingTitle; else accountingTitle = currentAccountingTitle;

      if (!sublineItem && !accountingTitle && amount === 0) continue;

      try {
        if (!sublineItem) {
          throw new Error('SUBLINE ITEM is required');
        }

        const resolvedMapping = await resolveMooeMapping({ sublineItem, accountingTitle });
        if (!resolvedMapping?.uacsCode) {
          throw new Error(`Unable to determine UACS code automatically for subline item \"${sublineItem}\"`);
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

        if (!targetRegion && !targetDepartment && !targetDivision) {
          throw new Error('Mission region/organizational context. Please specify REGION or RESPONSIBILITY CENTER.');
        }

        await MooeProposal.create({
          sublineItem,
          accountingTitle: resolvedMapping.accountingTitle || accountingTitle,
          uacsCode: resolvedMapping.uacsCode,
          region: targetRegion,
          department: targetDepartment,
          division: targetDivision,
          originalLevel: targetLevel,
          income,
          subsidy,
          amount,
          fiscalYear: activeSettings.fiscalYear,
          budgetType: activeSettings.budgetType,
          processBy: req.user?.username || req.user?.name || req.user?.id || 'System',
          processDate: new Date(),
          createdBy: req.user?.id || req.user?.userId || 'system'
        });
        success++;
      } catch (error) {
        failed++;
        errors.push({ row: index + 2, sublineItem, region: org.region, error: error.message });
      }
    }

    return res.json({ message: "File processed successfully", success, failed, errors, regions: [org.region] });
  } catch (error) {
    return res.status(500).json({ error: "Internal server error", message: error.message });
  }
};

// Generate sample template for MOOE upload using the same columns shown in the table.
exports.getSampleMooeTemplate = async (req, res) => {
  try {
    const sampleData = [
      { 
        "REGION": "CENTRAL OFFICE",
        "DEPARTMENT": "ADMINISTRATIVE DEPARTMENT",
        "RESPONSIBILITY CENTER": "MEDICAL AND DENTAL SERVICES",
        "SUBLINE ITEM": "Office Supplies",
        "ACCOUNTING TITLE": "Office Supplies Expenses",
        "INCOME": 10000,
        "SUBSIDY": 5000
      },
      { 
        "REGION": "",
        "DEPARTMENT": "",
        "RESPONSIBILITY CENTER": "",
        "SUBLINE ITEM": "Travel Expenses",
        "ACCOUNTING TITLE": "Traveling Expenses - Local",
        "INCOME": 20000,
        "SUBSIDY": 8000
      },
      { 
        "REGION": "",
        "DEPARTMENT": "",
        "RESPONSIBILITY CENTER": "",
        "SUBLINE ITEM": "Other Maintenance and Operating Expenses",
        "ACCOUNTING TITLE": "Representation Expenses",
        "INCOME": 5000,
        "SUBSIDY": 2000
      },
      { 
        "REGION": "",
        "DEPARTMENT": "",
        "RESPONSIBILITY CENTER": "",
        "SUBLINE ITEM": "Financial Expenses",
        "ACCOUNTING TITLE": "Bank Charges",
        "INCOME": 1000,
        "SUBSIDY": 500
      },
      { 
        "REGION": "",
        "DEPARTMENT": "",
        "RESPONSIBILITY CENTER": "",
        "SUBLINE ITEM": "Irrigators' Associations (IAs) Operation & Maintenance Cost",
        "ACCOUNTING TITLE": "National Irrigation System",
        "INCOME": 50000,
        "SUBSIDY": 25000
      }
    ];
    const worksheet = xlsx.utils.json_to_sheet(sampleData);
    const wscols = [
      { wch: 20 },
      { wch: 35 },
      { wch: 35 },
      { wch: 28 },
      { wch: 32 },
      { wch: 16 },
      { wch: 16 }
    ];
    worksheet['!cols'] = wscols;
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, worksheet, 'MOOE');
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=mooe_template.xlsx');
    res.send(buf);
  } catch (error) {
    res.status(500).json({ error: "Internal server error", message: error.message });
  }
};
