const PersonnelServices = require("../models/PersonnelServices");
// Get personnel by parameters
const getPersonnelByParams = async (req, res) => {
  try {
    const { fiscalYear, budgetType, processBy, region, status } = req.query;
    const query = {};
    if (fiscalYear) query.fiscalYear = fiscalYear;
    if (budgetType) query.budgetType = budgetType;
    if (processBy) query.processBy = processBy;
    if (region) query.region = region;
    if (status) query.status = status;
    const personnel = await PersonnelServices.find(query).lean();
    res.status(200).json(personnel);
  } catch (error) {
    console.error("Error fetching personnel by params:", error);
    res.status(500).json({ message: "Failed to fetch personnel data" });
  }
};
module.exports = {
  getPersonnelByParams
};