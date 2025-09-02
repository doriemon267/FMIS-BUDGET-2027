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

// Save/Update details for a capital outlay
exports.saveCapitalOutlayDetails = async (req, res) => {
  try {
    const { capitalOutlayId } = req.params;
    const { details, processBy } = req.body;

    if (!mongoose.Types.ObjectId.isValid(capitalOutlayId)) {
      return res.status(400).json({ error: "Invalid capital outlay ID" });
    }

    if (!Array.isArray(details)) {
      return res.status(400).json({ error: "Details must be an array" });
    }

    // Validate each detail item
    for (const detail of details) {
      if (!detail.particulars || detail.particulars.trim() === "") {
        return res.status(400).json({ error: "Particulars is required for all items" });
      }
      if (detail.income_amount < 0 || detail.subsidy_amount < 0) {
        return res.status(400).json({ error: "Amounts cannot be negative" });
      }
    }

    // Delete existing details for this capital outlay
    await CapitalOutlayDetails.deleteMany({ capital_outlay_id: capitalOutlayId });

    // Insert new details
    const detailsToInsert = details.map((detail) => ({
      capital_outlay_id: capitalOutlayId,
      particulars: detail.particulars.trim(),
      income_amount: parseFloat(detail.income_amount) || 0,
      subsidy_amount: parseFloat(detail.subsidy_amount) || 0,
      processBy: processBy || "System",
      processDate: new Date(),
    }));

    const savedDetails = await CapitalOutlayDetails.insertMany(detailsToInsert);

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

    // Update the main capital outlay record with calculated totals
    await CapitalOutlay.findByIdAndUpdate(
      capitalOutlayId,
      {
        income: totalIncome,
        subsidy: totalSubsidy,
        cost: totalCost,
      },
      { new: true }
    );

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
    console.error("Error saving capital outlay details:", error);
    res.status(500).json({ error: "Failed to save capital outlay details" });
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

      // Update the main capital outlay record
      await CapitalOutlay.findByIdAndUpdate(
        capitalOutlayId,
        {
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