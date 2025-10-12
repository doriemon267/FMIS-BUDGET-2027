const mongoose = require("mongoose");
const CapitalOutlayDetails = require("../models/CapitalOutlayDetails");
const CapitalOutlay = require("../models/CapitalOutlay");
// Get all details for a specific capital outlay
exports.getCapitalOutlayDetails = async (req, res) => {
  try {
    const { capitalOutlayId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(capitalOutlayId)) {
      return res.status(400).json({ error: "Invalid capital outlay ID" });
    }
    const details = await CapitalOutlayDetails.find({
      capital_outlay_id: capitalOutlayId,
    }).sort({ createdAt: 1 });
    res.status(200).json({
      success: true,
      details,
    });
  } catch (error) {
    console.error("Error fetching capital outlay details:", error);
    res.status(500).json({ error: "Failed to fetch capital outlay details" });
  }
};
// Helper to build a concise particulars summary for the main CapitalOutlay
const buildParticularsSummary = (detailsArr = []) => {
  try {
    const parts = (detailsArr || [])
      .map(d => (d && (d.particulars || '').toString().trim()))
      .filter(Boolean);
    if (parts.length === 0) return '';
    const uniq = Array.from(new Set(parts));
    const first = uniq.slice(0, 3).join(' • ');
    const more = uniq.length > 3 ? ` (+${uniq.length - 3} more)` : '';
    const summary = `${first}${more}`;
    return summary.length > 200 ? summary.slice(0, 197) + '…' : summary;
  } catch (e) {
    return '';
  }
};

// Save/Update details for a capital outlay
exports.saveCapitalOutlayDetails = async (req, res) => {
  try {
    const { capitalOutlayId } = req.params;
    const { details, processBy } = req.body;
    
    console.log("=== SAVE CAPITAL OUTLAY DETAILS ===");
    console.log("Capital Outlay ID:", capitalOutlayId);
    console.log("Process By:", processBy);
    console.log("Details count:", details?.length);
    console.log("Details:", JSON.stringify(details, null, 2));
    
    if (!mongoose.Types.ObjectId.isValid(capitalOutlayId)) {
      console.error("Invalid capital outlay ID format:", capitalOutlayId);
      return res.status(400).json({ error: "Invalid capital outlay ID" });
    }
    if (!Array.isArray(details)) {
      console.error("Details is not an array:", typeof details);
      return res.status(400).json({ error: "Details must be an array" });
    }
    // Validate each detail item
    for (const detail of details) {
      if (!detail.particulars || detail.particulars.trim() === "") {
        console.error("Validation failed: Missing particulars in detail:", detail);
        return res.status(400).json({ error: "Particulars is required for all items" });
      }
      if (detail.income_amount < 0 || detail.subsidy_amount < 0) {
        console.error("Validation failed: Negative amounts in detail:", detail);
        return res.status(400).json({ error: "Amounts cannot be negative" });
      }
    }
    // Delete existing details for this capital outlay
    console.log("Deleting existing details for capital outlay:", capitalOutlayId);
    const deleteResult = await CapitalOutlayDetails.deleteMany({ capital_outlay_id: capitalOutlayId });
    console.log("Deleted", deleteResult.deletedCount, "existing details");
    
    // Insert new details
    const detailsToInsert = details.map((detail) => ({
      capital_outlay_id: capitalOutlayId,
      particulars: detail.particulars.trim(),
      income_amount: parseFloat(detail.income_amount) || 0,
      subsidy_amount: parseFloat(detail.subsidy_amount) || 0,
      processBy: processBy || "System",
      processDate: new Date(),
    }));
    
    console.log("Inserting", detailsToInsert.length, "new details");
    const savedDetails = await CapitalOutlayDetails.insertMany(detailsToInsert);
    console.log("Successfully inserted", savedDetails.length, "details");
    
    // Calculate totals
    const totalIncome = detailsToInsert.reduce(
      (sum, detail) => sum + detail.income_amount,
      0
    );
    const totalSubsidy = detailsToInsert.reduce(
      (sum, detail) => sum + detail.subsidy_amount,
      0
    );
    const totalCost = totalIncome + totalSubsidy;
    
    console.log("Calculated totals - Income:", totalIncome, "Subsidy:", totalSubsidy, "Cost:", totalCost);
    
    // Compute a concise particulars summary for the main record
    const particularsSummary = buildParticularsSummary(detailsToInsert);

    // Update the main capital outlay record with calculated totals and particulars summary
    console.log("Updating main capital outlay record:", capitalOutlayId);
    const updatedCapitalOutlay = await CapitalOutlay.findByIdAndUpdate(
      capitalOutlayId,
      {
        particulars: particularsSummary,
        income: totalIncome,
        subsidy: totalSubsidy,
        cost: totalCost,
      },
      { new: true }
    );
    
    if (!updatedCapitalOutlay) {
      console.error("Capital outlay not found:", capitalOutlayId);
      return res.status(404).json({ error: "Capital outlay not found" });
    }
    
    console.log("Successfully updated capital outlay");
    console.log("=== SAVE COMPLETE ===");
    
    res.status(200).json({
      success: true,
      message: "Capital outlay details saved successfully",
      details: savedDetails,
      totals: {
        income: totalIncome,
        subsidy: totalSubsidy,
        cost: totalCost,
      },
    });
  } catch (error) {
    console.error("=== ERROR SAVING CAPITAL OUTLAY DETAILS ===");
    console.error("Error:", error);
    console.error("Stack:", error.stack);
    res.status(500).json({ error: "Failed to save capital outlay details", details: error.message });
  }
};
// Delete a specific detail item
exports.deleteCapitalOutlayDetail = async (req, res) => {
  try {
    const { detailId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(detailId)) {
      return res.status(400).json({ error: "Invalid detail ID" });
    }
    const detail = await CapitalOutlayDetails.findById(detailId);
    if (!detail) {
      return res.status(404).json({ error: "Detail not found" });
    }
    const capitalOutlayId = detail.capital_outlay_id;
    // Start a transaction
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      // Delete the detail
      await CapitalOutlayDetails.findByIdAndDelete(detailId, { session });
      // Recalculate totals for the remaining details
      const remainingDetails = await CapitalOutlayDetails.find(
        { capital_outlay_id: capitalOutlayId },
        null,
        { session }
      );
      const totalIncome = remainingDetails.reduce(
        (sum, detail) => sum + detail.income_amount,
        0
      );
      const totalSubsidy = remainingDetails.reduce(
        (sum, detail) => sum + detail.subsidy_amount,
        0
      );
      const totalCost = totalIncome + totalSubsidy;
      // Build particulars summary from remaining details
      const particularsSummary = buildParticularsSummary(remainingDetails);
      // Update the main capital outlay record
      await CapitalOutlay.findByIdAndUpdate(
        capitalOutlayId,
        {
          particulars: particularsSummary,
          income: totalIncome,
          subsidy: totalSubsidy,
          cost: totalCost,
        },
        { session }
      );
      await session.commitTransaction();
      res.status(200).json({
        success: true,
        message: "Detail deleted successfully",
        totals: {
          income: totalIncome,
          subsidy: totalSubsidy,
          cost: totalCost,
        },
      });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error("Error deleting capital outlay detail:", error);
    res.status(500).json({ error: "Failed to delete capital outlay detail" });
  }
};
// Get summary of all capital outlay details (for reporting)
exports.getCapitalOutlayDetailsSummary = async (req, res) => {
  try {
    const { region, fiscalYear, budgetType } = req.query;
    // Build match criteria for the aggregation
    const matchCriteria = {};
    if (region) matchCriteria["capitalOutlay.region"] = region;
    if (fiscalYear) matchCriteria["capitalOutlay.fiscalYear"] = fiscalYear;
    if (budgetType) matchCriteria["capitalOutlay.budgetType"] = budgetType;
    const summary = await CapitalOutlayDetails.aggregate([
      {
        $lookup: {
          from: "capitaloutlays",
          localField: "capital_outlay_id",
          foreignField: "_id",
          as: "capitalOutlay",
        },
      },
      {
        $unwind: "$capitalOutlay",
      },
      {
        $match: matchCriteria,
      },
      {
        $group: {
          _id: {
            accountingTitle: "$capitalOutlay.accountingTitle",
            region: "$capitalOutlay.region",
          },
          totalIncome: { $sum: "$income_amount" },
          totalSubsidy: { $sum: "$subsidy_amount" },
          totalCost: { $sum: { $add: ["$income_amount", "$subsidy_amount"] } },
          itemCount: { $sum: 1 },
          items: {
            $push: {
              particulars: "$particulars",
              income_amount: "$income_amount",
              subsidy_amount: "$subsidy_amount",
              processBy: "$processBy",
              processDate: "$processDate",
            },
          },
        },
      },
      {
        $sort: {
          "_id.region": 1,
          "_id.accountingTitle": 1,
        },
      },
    ]);
    res.status(200).json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error("Error fetching capital outlay details summary:", error);
    res.status(500).json({ error: "Failed to fetch capital outlay details summary" });
  }
};