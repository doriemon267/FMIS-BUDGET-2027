const xlsx = require("xlsx");
const CapitalOutlay = require("../models/CapitalOutlay");
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

const resolveCapitalOutlayUacs = async ({ title, sublineItem, accountingTitle }) => {
  const exactSubline = sublineItem ? new RegExp(`^${escapeRegex(sublineItem)}$`, "i") : null;
  const exactAccountingTitle = accountingTitle ? new RegExp(`^${escapeRegex(accountingTitle)}$`, "i") : null;
  const exactTitle = title ? new RegExp(`^${escapeRegex(title)}$`, "i") : null;

  if (exactTitle) {
    const titleMapping = await TitleMapping.findOne({
      lineItem: exactTitle,
      isActive: true,
    }).sort({ accountingTitle: 1, sublineItem: 1 }).lean();

    if (titleMapping?.uacsCode) {
      return titleMapping.uacsCode;
    }
  }

  if (exactSubline && exactAccountingTitle) {
    const chartAccount = await ChartOfAccounts.findOne({
      sublineItem: exactSubline,
      accountingTitle: exactAccountingTitle,
    }).lean();

    if (chartAccount?.uacsCode) {
      return chartAccount.uacsCode;
    }
  }

  if (exactSubline) {
    const chartAccount = await ChartOfAccounts.findOne({
      sublineItem: exactSubline,
    }).sort({ accountingTitle: 1 }).lean();

    if (chartAccount?.uacsCode) {
      return chartAccount.uacsCode;
    }
  }

  if (exactAccountingTitle) {
    const chartAccount = await ChartOfAccounts.findOne({
      accountingTitle: exactAccountingTitle,
    }).lean();

    if (chartAccount?.uacsCode) {
      return chartAccount.uacsCode;
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
    const incomeCol = findColumn(headers, ["INCOME", "Income"]);
    const subsidyCol = findColumn(headers, ["SUBSIDY", "Subsidy"]);

    const missingColumns = [
      ["TITLE", titleCol],
      ["Subline Item", sublineCol],
      ["Accounting Title", accountingCol],
      ["INCOME", incomeCol],
      ["SUBSIDY", subsidyCol],
    ]
      .filter(([, column]) => !column)
      .map(([label]) => label);

    if (missingColumns.length > 0) {
      return res.status(400).json({
        error: "Invalid format",
        message: `Missing required columns: ${missingColumns.join(", ")}`
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
      const title = row[titleCol]?.toString().trim() || "";
      const sublineItem = row[sublineCol]?.toString().trim() || "";
      const accountingTitle = row[accountingCol]?.toString().trim() || "";
      const particulars = particularsCol ? row[particularsCol]?.toString().trim() || "" : "";
      const income = parseAmount(row[incomeCol]);
      const subsidy = parseAmount(row[subsidyCol]);
      const cost = income + subsidy;

      if (!title && !sublineItem && !accountingTitle && income === 0 && subsidy === 0) {
        continue;
      }

      try {
        if (!title || !sublineItem) {
          throw new Error("TITLE and Subline Item are required");
        }

        const categoryDoc = await Category.findOne({ categoryName: new RegExp(`^${escapeRegex(title)}$`, "i") });
        if (!categoryDoc) {
          throw new Error(`Category/TITLE \"${title}\" was not found in Capital Outlay categories`);
        }

        const resolvedUacsCode = await resolveCapitalOutlayUacs({
          title,
          sublineItem,
          accountingTitle,
        });

        if (!resolvedUacsCode) {
          throw new Error(`Unable to determine UACS code automatically for TITLE \"${title}\"`);
        }

        await CapitalOutlay.create({
          category: categoryDoc._id,
          particulars,
          sublineItem,
          accountingTitle,
          uacsCode: resolvedUacsCode,
          region: org.region,
          department: org.department,
          division: org.division,
          income,
          subsidy,
          cost,
          fiscalYear: activeSettings.fiscalYear,
          budgetType: activeSettings.budgetType,
          processBy: req.user?.username || req.user?.name || "System",
          processDate: new Date(),
          createdBy: req.user?.id || "system",
        });

        success++;
      } catch (error) {
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
        "TITLE": "ACQUISITION OF MACHINERY AND EQUIPMENT",
        "Subline Item": "Service Vehicles",
        "Accounting Title": "Motor Vehicles",
        "Particulars": "One service vehicle for field operations",
        "INCOME": 500000,
        "SUBSIDY": 250000,
        "TOTAL": 750000
      },
      {
        "TITLE": "ACQUISITION OF MACHINERY AND EQUIPMENT",
        "Subline Item": "Office Equipment",
        "Accounting Title": "Furniture and Fixtures",
        "Particulars": "Replacement of workstations and cabinets",
        "INCOME": 300000,
        "SUBSIDY": 150000,
        "TOTAL": 450000
      },
      {
        "TITLE": "ACQUISITION OF TRANSPORTATION EQUIPMENT",
        "Subline Item": "Motorcycles",
        "Accounting Title": "Transportation Equipment",
        "Particulars": "Motorcycles for monitoring teams",
        "INCOME": 400000,
        "SUBSIDY": 200000,
        "TOTAL": 600000
      }
    ];

    const worksheet = xlsx.utils.json_to_sheet(sampleData);
    
    worksheet["!cols"] = [
      { wch: 40 },
      { wch: 24 },
      { wch: 28 },
      { wch: 38 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
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
