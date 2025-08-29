const Category = require("../models/Annex");

// Get all annexes
exports.getAllAnnexes = async (req, res) => {
  try {
    const annexes = await Category.find({ AnnexName: { $exists: true, $ne: null } });
    res.status(200).json({ annexes });
  } catch (error) {
    console.error("Error fetching annexes:", error);
    res.status(500).json({ error: "Failed to retrieve annexes." });
  }
};

// Add a new annex
exports.addAnnex = async (req, res) => {
  try {
    const { employeeFullName, positionTitle, Department, Division, Amount, region, processBy, processDate, fiscalYear, status } = req.body;

    // Check if the same entry already exists
    const existingAnnex = await PS_Annexes.findOne({ employeeFullName, positionTitle, fiscalYear });
    if (existingAnnex) {
      return res.status(400).json({ field: "employeeFullName", message: "Annex entry for this employee and fiscal year already exists." });
    }

    // Create new Annex entry
    const newAnnex = new PS_Annexes({
      employeeFullName,
      positionTitle,
      Department,
      Division,
      Amount,
      region,
      processBy,
      processDate,
      fiscalYear,
      status: status || "Not Submitted",
    });

    await newAnnex.save();
    res.status(201).json(newAnnex);
    console.log(newAnnex);
  } catch (error) {
    console.error("Error adding annex:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

// Edit an existing annex
exports.editAnnex = async (req, res) => {
  try {
    const { id } = req.params;
    const { annexName } = req.body;

    if (!annexName) {
      return res.status(400).json({ error: "Annex name is required." });
    }

    const updatedAnnex = await Category.findByIdAndUpdate(
      id,
      { annexName },
      { new: true, runValidators: true }
    );

    if (!updatedAnnex) {
      return res.status(404).json({ error: "Annex not found." });
    }

    res.status(200).json({ message: "Annex updated successfully", annex: updatedAnnex });
  } catch (error) {
    console.error("Error updating annex:", error);
    res.status(500).json({ error: "Failed to update annex." });
  }
};

// Delete an annex
exports.deleteAnnex = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedAnnex = await Category.findByIdAndDelete(id);

    if (!deletedAnnex) {
      return res.status(404).json({ error: "Annex not found." });
    }

    res.status(200).json({ message: "Annex deleted successfully" });
  } catch (error) {
    console.error("Error deleting annex:", error);
    res.status(500).json({ error: "Failed to delete annex." });
  }
};
