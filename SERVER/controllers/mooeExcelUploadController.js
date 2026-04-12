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
  const exactSubline = sublineItem ? new RegExp(`^${escapeRegex(sublineItem)}$`, "i") : null;
  const exactAccountingTitle = accountingTitle ? new RegExp(`^${escapeRegex(accountingTitle)}$`, "i") : null;

  if (exactSubline && exactAccountingTitle) {
    const chartAccount = await ChartOfAccounts.findOne({
      sublineItem: exactSubline,
      accountingTitle: exactAccountingTitle,
    }).lean();

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

    const missingColumns = [
      ["SUBLINE ITEM", sublineCol],
      ["ACCOUNTING TITLE", accountingCol],
      ["INCOME", incomeCol],
      ["SUBSIDY", subsidyCol],
    ].filter(([, value]) => !value).map(([label]) => label);

    if (missingColumns.length > 0) {
      return res.status(400).json({
        error: "Invalid format",
        message: `Missing required columns: ${missingColumns.join(', ')}`
      });
    }

    const org = await getUploadOrgContext(req);
    if (!org.region) {
      return res.status(400).json({
        error: "Missing region context",
        message: "Unable to determine the target region for this upload. Open the proposal in the correct scope and try again."
      });
    }

    let success = 0, failed = 0, errors = [];

    for (const [index, row] of sheetData.entries()) {
      const sublineItem = row[sublineCol]?.toString().trim() || '';
      const accountingTitle = row[accountingCol]?.toString().trim() || '';
      const income = parseAmount(row[incomeCol]);
      const subsidy = parseAmount(row[subsidyCol]);
      const amount = income + subsidy;

      if (!sublineItem && !accountingTitle && amount === 0) continue;

      try {
        if (!sublineItem) {
          throw new Error('SUBLINE ITEM is required');
        }

        const resolvedMapping = await resolveMooeMapping({ sublineItem, accountingTitle });
        if (!resolvedMapping?.uacsCode) {
          throw new Error(`Unable to determine UACS code automatically for subline item \"${sublineItem}\"`);
        }

        await MooeProposal.create({
          sublineItem,
          accountingTitle: resolvedMapping.accountingTitle || accountingTitle,
          uacsCode: resolvedMapping.uacsCode,
          region: org.region,
          department: org.department,
          division: org.division,
          income,
          subsidy,
          amount,
          fiscalYear: activeSettings.fiscalYear,
          budgetType: activeSettings.budgetType,
          processBy: req.user?.username || req.user?.name || 'System',
          processDate: new Date(),
          createdBy: req.user?.id || 'system'
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
        "SUBLINE ITEM": "Office Supplies",
        "ACCOUNTING TITLE": "Supplies Expenses",
        "INCOME": 10000,
        "SUBSIDY": 5000,
        "AMOUNT": 15000
      },
      { 
        "SUBLINE ITEM": "Travel Expenses",
        "ACCOUNTING TITLE": "Traveling Expenses",
        "INCOME": 20000,
        "SUBSIDY": 8000,
        "AMOUNT": 28000
      }
    ];
    const worksheet = xlsx.utils.json_to_sheet(sampleData);
    const wscols = [
      { wch: 28 },
      { wch: 32 },
      { wch: 16 },
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
