const Setup = require("../models/setup");

// Get all setups
exports.getAllSetups = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      orderBy,
      order = "asc",
      operator,
      proposalType,
      year,
      currentYear,
      fromDate,
      toDate,
      isFinished,
    } = req.query;

    let query = {};

    // Global Search (Excluding Date)
    if (search && search.split("-").length !== 3) {
      query.$or = [{ proposalType: { $regex: search, $options: "i" } }];

      const searchNumber = !isNaN(Number(search)) ? Number(search) : null;
      if (searchNumber !== null) {
        query.$or.push({ year: searchNumber });
      }
    }

    // Specific Field Search (Applied via Table Filters)
    // For proposalType - case-insensitive search
    if (proposalType) {
      query.proposalType = { $regex: proposalType, $options: "i" };
    }

    // For currentYear - convert query value from string to boolean
    if (currentYear !== undefined) {
      query.currentYear = currentYear === "true";
    }

    // For year - number filter with operator support
    if (year) {
      const numYear = Number(year);
      if (operator === "=" || !operator) {
        query.year = numYear;
      } else if (operator === ">") {
        query.year = { $gt: numYear };
      } else if (operator === "<") {
        query.year = { $lt: numYear };
      } else if (operator === ">=") {
        query.year = { $gte: numYear };
      } else if (operator === "<=") {
        query.year = { $lte: numYear };
      }
    }

    // Date filter applied on the deadlines array
    // If any of the date fields or isFinished flag is provided,
    // we check if at least one element in the deadlines array matches.
    if (fromDate || toDate || isFinished !== undefined) {
      const elemMatch = {};
      if (fromDate) {
        elemMatch.fromDate = { $gte: new Date(fromDate) };
      }
      if (toDate) {
        elemMatch.toDate = { $lte: new Date(toDate) };
      }
      if (isFinished !== undefined) {
        elemMatch.isFinished = isFinished === "true";
      }
      query.deadlines = { $elemMatch: elemMatch };
    }

    // Sorting - default sort field can be adjusted if needed
    const sortByField = orderBy || "createdAt";
    const sortOrder = order.toLowerCase() === "desc" ? -1 : 1;
    const sortQuery = { [sortByField]: sortOrder };

    // Pagination calculations
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const skip = (pageNum - 1) * limitNum;

    // Fetch filtered, paginated, and sorted data
    const setups = await Setup.find(query)
      .skip(skip)
      .limit(limitNum)
      .sort(sortQuery);
    const totalRecords = await Setup.countDocuments(query);

    return res.json({
      setups,
      totalPages: Math.ceil(totalRecords / limitNum),
      currentPage: pageNum,
      totalRecords,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Something went wrong." });
  }
};

// Get a single setup by ID
exports.getSetupById = async (req, res) => {
  try {
    const setup = await Setup.findById(req.params.id);
    if (!setup) return res.status(404).json({ message: "Setup not found" });
    res.status(200).json(setup);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a new setup
exports.createSetup = async (req, res) => {
  try {
    const { proposalType, year, currentYear, deadlines } = req.body;

    if (!proposalType || !year) {
      return res
        .status(400)
        .json({ error: "Proposal type and year are required." });
    }

    if (currentYear) {
      // Set currentYear to false for all other records
      await Setup.updateMany({}, { currentYear: false });
    }

    const newSetup = new Setup({
      proposalType,
      year,
      currentYear: currentYear !== undefined ? currentYear : false,
      deadlines,
    });

    await newSetup.save();
    return res
      .status(201)
      .json({ message: "Setup created successfully.", setup: newSetup });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to create setup." });
  }
};

// Update a setup by ID
exports.updateSetup = async (req, res) => {
  try {
    const { id } = req.params;
    const { proposalType, year, currentYear, deadlines } = req.body;

    if (currentYear) {
      // Set currentYear to false for all other records
      await Setup.updateMany({ _id: { $ne: id } }, { currentYear: false });
    }

    const updatedSetup = await Setup.findByIdAndUpdate(
      id,
      { proposalType, year, currentYear, deadlines },
      { new: true, runValidators: true }
    );

    if (!updatedSetup) {
      return res.status(404).json({ error: "Setup not found." });
    }

    return res.json({
      message: "Setup updated successfully.",
      setup: updatedSetup,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to update setup." });
  }
};

// Delete a setup by ID
exports.deleteSetup = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedSetup = await Setup.findByIdAndDelete(id);
    if (!deletedSetup) {
      return res.status(404).json({ error: "Setup not found." });
    }

    return res.json({ message: "Setup deleted successfully." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to delete setup." });
  }
};
