const EmployeeCourtAppearance = require("../models/employeeCourtAppearance");
const Settings = require("../models/Settings");
const PersonnelServices = require('../models/PersonnelServices');
const {
  numberFilter,
  dateFilter,
  textFilter,
} = require("../utils/controller_get_process");
// GET all court appearances
exports.getAllAppearances = async (req, res) => {
  try {
    // Get user information from request
    const user = req.user;
    // Get region filter from query parameters
    const regionFilter = req.query.region;
    // Log access for monitoring purposes
    const activeSettings = await Settings.findOne({ isActive: true });
    if (!activeSettings || !activeSettings.fiscalYear) {
      return res.json({
        data: [],
        totalRecords: 0,
        currentPage: 1,
        totalPages: 1,
        region: regionFilter || 'All',
        message: "No active settings found."
      });
    }
    const fiscalYear = activeSettings.fiscalYear;
    const budgetType = activeSettings.budgetType;
    const rate = activeSettings.courtAppearance || 0;
    // Kumuha ng permanent personnel para sa active fiscal year at may status na "Not Submitted", "Returned", o "Draft"
    const personnelQuery = {
      statusOfAppointment: { $regex: /^permanent$/i },
      fiscalYear: fiscalYear,
      status: { $in: ["Not Submitted", "Returned", "Draft"] }
    };
    // Add region filter if provided
    if (regionFilter && regionFilter !== 'All') {
      personnelQuery.region = regionFilter;
    }
    // Only show LEGAL SERVICES personnel (but allow all users to access)
    const legalServicesQuery = {
      ...personnelQuery,
      $or: [
        { department: { $regex: /^LEGAL SERVICES$/i } },
        { Department: { $regex: /^LEGAL SERVICES$/i } }
      ]
    };
    let personnelList = await PersonnelServices.find(legalServicesQuery);
    // Kumuha ng existing court appearances with region filter if provided
    const appearanceQuery = { fiscalYear };
    if (regionFilter && regionFilter !== 'All') {
      appearanceQuery.region = regionFilter;
    }
    const appearanceRecords = await EmployeeCourtAppearance.find(appearanceQuery);
    // I-merge ang records at isama ang status mula sa personnel
    const merged = personnelList.map((emp) => {
      const record = appearanceRecords.find(
        (r) => r.employeeNumber === emp.employeeNumber
      );
      const noOfCourtAppearance = record?.noOfCourtAppearance || 0;
      const courtAppearanceAmount = rate * noOfCourtAppearance;
      return {
        _id: record?._id || `${emp._id}_temp`,
        employeeNumber: emp.employeeNumber,
        employeeFullName: emp.employeeFullName,
        positionTitle: emp.positionTitle,
        department: emp.department,
        division: emp.division,
        region: emp.region,
        noOfCourtAppearance,
        courtAppearanceAmount,
        fiscalYear,
        budgetType,
        processBy: record?.processBy || "",
        processDate: record?.processDate || "",
        status: emp.status, // Ipinapasa ang status (e.g., "Submitted", "Not Submitted")
      };
    });
    return res.json({
      data: merged,
      totalRecords: merged.length,
      currentPage: 1,
      totalPages: 1,
      region: regionFilter || 'All'
    });
  } catch (err) {
    console.error("getAllAppearances error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
// CREATE a new court appearance
exports.addAppearance = async (req, res) => {
  try {
    const {
      employeeNumber,
      employeeFullName,
      positionTitle,
      department,
      division,
      region,
      noOfCourtAppearance,
      processBy,
      processDate,
      budgetType,
    } = req.body;
    const activeSettings = await Settings.findOne({ isActive: true });
    if (!activeSettings || !activeSettings.courtAppearance) {
      return res
        .status(400)
        .json({ message: "Active settings with court appearance not found." });
    }
    // Gumamit ng budgetType mula sa request o settings
    const budgetTypeValue = budgetType || activeSettings.budgetType;
    if (!budgetTypeValue) {
      return res.status(400).json({ message: "Budget type is required." });
    }
    // Compute the court appearance amount using the active settings rate
    const courtAppearanceAmount =
      noOfCourtAppearance * activeSettings.courtAppearance;
    const fiscalYear = activeSettings.fiscalYear; // gamitin ang active fiscalYear
    const newEntry = new EmployeeCourtAppearance({
      employeeNumber,
      employeeFullName,
      positionTitle,
      department,
      division,
      region,
      noOfCourtAppearance,
      courtAppearanceAmount,
      processBy,
      processDate,
      fiscalYear,
      budgetType,
    });
    await newEntry.save();
    // Update Personnel record kung umiiral (para lamang sa napiling personnel)
    const personnelRecord = await PersonnelServices.findOne({
      employeeNumber: employeeNumber,
      fiscalYear: fiscalYear,
    });
    if (personnelRecord) {
      personnelRecord.courtAppearance = courtAppearanceAmount;
      await personnelRecord.save();
    }
    res.status(201).json({ message: "Record created successfully.", data: newEntry });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create record." });
  }
};
// UPDATE a court appearance
exports.editAppearance = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const activeSettings = await Settings.findOne({ isActive: true });
    if (updates.noOfCourtAppearance && activeSettings?.courtAppearance) {
      updates.courtAppearanceAmount = updates.noOfCourtAppearance * activeSettings.courtAppearance;
    }
    // Siguraduhin na ginagamit ang active fiscalYear
    if (activeSettings && activeSettings.fiscalYear) {
      updates.fiscalYear = activeSettings.fiscalYear;
    }
    if (updates.budgetType) {
      const budgetTypeValue = updates.budgetType || activeSettings.budgetType;
      if (!budgetTypeValue) {
        return res.status(400).json({ message: "Budget type is required." });
      }
    }
    const updated = await EmployeeCourtAppearance.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });
    if (!updated) return res.status(404).json({ error: "Record not found." });
    // Update the corresponding Personnel record kung umiiral
    const personnelRecord = await PersonnelServices.findOne({
      employeeNumber: updated.employeeNumber,
      fiscalYear: updated.fiscalYear,
    });
    if (personnelRecord) {
      personnelRecord.courtAppearance = updated.courtAppearanceAmount;
      await personnelRecord.save();
    }
    res.json({ message: "Record updated successfully.", data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update record." });
  }
};
// DELETE a court appearance
exports.deleteAppearance = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await EmployeeCourtAppearance.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: "Record not found." });
    res.json({ message: "Record deleted successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete record." });
  }
};
exports.getSumOfCourtAppearanceAmount = async (req, res) => {
  try {
    // Gamitin ang active fiscalYear sa pag‑sum
    const activeSettings = await Settings.findOne({ isActive: true });
    if (!activeSettings || !activeSettings.fiscalYear) {
      return res.json({ totalAmount: 0 });
    }
    const fiscalYear = activeSettings.fiscalYear;
    const result = await EmployeeCourtAppearance.aggregate([
      { $match: { fiscalYear } },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$courtAppearanceAmount" },
        },
      },
    ]);
    const totalAmount = result.length > 0 ? result[0].totalAmount : 0;
    res.json({ totalAmount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to calculate total amount." });
  }
};
