const PersonnelServicesAnnexes = require("../models/PsAnnex");
const PersonnelService = require('../models/PersonnelServices');
const AnnexName = require("../models/Annex");
exports.getAllPersonnelServicesAnnexes = async (req, res) => {
    try {
        const { page = 1, search, orderBy, order = "asc" } = req.query;
        let query = {};
        if (search) {
            query.employeeFullName = { $regex: search, $options: "i" };
        }
        const sortQuery = { [orderBy || "createdAt"]: order === "desc" ? -1 : 1 };
        const [personnelServicesAnnexes, totalRecords] = await Promise.all([
            PersonnelServicesAnnexes.find(query)
                .populate({
                    path: "AnnexName",
                    select: "name _id",
                    options: { strictPopulate: false },
                })
                .sort(sortQuery)
                .skip((page - 1) * 100) // Adjust the skip value if needed
                .exec(),
            PersonnelServicesAnnexes.countDocuments(query),
        ]);
        const formattedAnnexes = personnelServicesAnnexes.map((annex) => ({
            ...annex.toObject(),
            AnnexName: annex.AnnexName
                ? {
                        _id: annex.AnnexName._id.toString(),
                        name: annex.AnnexName.name,
                    }
                : null,
        }));
        res.status(200).json({
            personnelServicesAnnexes: formattedAnnexes,
            totalPages: Math.ceil(totalRecords / 100), // Adjust the totalPages calculation if needed
            currentPage: parseInt(page),
            totalRecords,
        });
    } catch (error) {
        console.error("Error fetching PsAnnex:", error);
        res.status(500).json({ error: "Failed to retrieve PsAnnex." });
    }
};
// Add a new PS_Annex
exports.addPersonnelServicesAnnex = async (req, res) => {
    try {
        const { employeeFullName, positionTitle, department, division, Amount, status, region, processBy, processDate, fiscalYear, annexNameId } = req.body;
        const newOutlay = new PsAnnex({
            employeeFullName,
            positionTitle,
            department,
            division,
            Amount,
            status,
            region,
            processBy,
            processDate,
            fiscalYear,
            AnnexName: annexNameId,
        });
        await newOutlay.save();
        res.status(201).json({ message: "PS Annex added successfully", annex: newOutlay });
    } catch (error) {
        console.error("Error adding PS_Annex:", error);
        res.status(500).json({ error: "Failed to add PS_Annex." });
    }
};
exports.editPersonnelServicesAnnex = async (req, res) => {
  try {
    const { id } = req.params;
    const { employeeFullName, positionTitle, department, division, Amount, status, region, processBy, processDate, fiscalYear, annexNameId } = req.body;
    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid PS_Annex ID." });
    }
    // Validate annexName ID format if provided
    if (annexNameId && !mongoose.Types.ObjectId.isValid(annexNameId)) {
      return res.status(400).json({ error: "Invalid annexName ID." });
    }
    // Fetch annex name details from AnnexName
    const annexName = await AnnexName.findById(annexNameId);
    if (!annexName) {
      return res.status(404).json({ message: "Annex name not found" });
    }
    const updatedPS_Annex = await PsAnnex.findByIdAndUpdate(
      id,
      { employeeFullName, positionTitle, department, division, Amount, status, region, processBy, processDate, fiscalYear, AnnexName: annexName._id },
      { new: true }
    ).populate('annexName');
    res.status(200).json(updatedPS_Annex);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
exports.deletePersonnelServicesAnnex = async (req, res) => {
  try {
    await PsAnnex.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "PS_Annex deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
//Fetch EmployeeName from PersonnelServices
exports.getPersonnelServices = async (req, res) => {
    try {
        const personnelServices = await PersonnelServices.find({}, 'employeeFullName positionTitle department division');
        res.status(200).json({ personnelServices });
    } catch (error) {
        console.error("Error fetching personnel services:", error);
        res.status(500).json({ error: "Failed to retrieve personnel services." });
    }
};
exports.getPersonnelServicesLegal = async (_, res) => {
  try {
    const personnelServices = await PersonnelServices.find(
      {
        department: { $regex: /^legal services$/i },
        statusOfAppointment: { $regex: /^permanent$/i },
      },
      "employeeFullName positionTitle department division"
    );
    res.status(200).json({ personnelServices });
  } catch (error) {
    console.error("Error fetching personnel services:", error);
    res.status(500).json({ error: "Failed to retrieve personnel services." });
  }
};
