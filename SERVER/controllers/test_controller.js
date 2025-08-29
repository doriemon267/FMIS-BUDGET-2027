const Test = require("../models/test");
const {
  numberFilter,
  dateFilter,
  textFilter,
  booleanFilter,
} = require("../utils/controller_get_process");

exports.getAllTests = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search, // Global search: searches across multiple fields
      orderBy,
      order = "asc",
      operator, // Used for numerical comparisons

      title,
      description,
      isPublish,
      likes,
      createdAt,
    } = req.query;

    let query = {};

    // **Global Search (Excluding Date)**
    if (search && search.split("-").length !== 3) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];

      // Numeric search: If `search` is a number, search for matching `likes`
      const searchNumber = !isNaN(Number(search)) ? Number(search) : null;
      if (searchNumber !== null) {
        query.$or.push({ likes: searchNumber }); // `likes` is a numeric field in the model
      }
    }

    // **Specific Field Search (Applied via Table Filters)**
    textFilter(query, { title, description });
    booleanFilter(query, { isPublish });
    numberFilter(query, { likes }, operator);
    dateFilter(query, { createdAt });

    // **Sorting**
    const sortByField = orderBy || "createdAt";
    const sortOrder = order.toLowerCase() === "desc" ? -1 : 1;
    const sortQuery = { [sortByField]: sortOrder };

    // **Pagination**
    const pageNum = Math.max(1, Number(page)); // Ensure page is at least 1
    const limitNum = Math.max(1, Number(limit)); // Ensure limit is at least 1
    const skip = (pageNum - 1) * limitNum;

    // **Fetch filtered, paginated, and sorted data**
    const tests = await Test.find(query)
      .skip(skip)
      .limit(limitNum)
      .sort(sortQuery);
    const totalRecords = await Test.countDocuments(query);

    return res.json({
      tests,
      totalPages: Math.ceil(totalRecords / limitNum),
      currentPage: pageNum,
      totalRecords,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Something went wrong." });
  }
};

// Create a new test entry
exports.addTest = async (req, res) => {
  try {
    const { title, description, likes, isPublish } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Title is required." });
    }

    const newTest = new Test({
      title,
      description,
      likes: likes || 0,
      isPublish: isPublish !== undefined ? isPublish : true,
    });

    await newTest.save();
    return res
      .status(201)
      .json({ message: "Test created successfully.", test: newTest });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to create test." });
  }
};

// Update an existing test entry
exports.editTest = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, likes, isPublish } = req.body;

    const updatedTest = await Test.findByIdAndUpdate(
      id,
      { title, description, likes, isPublish },
      { new: true, runValidators: true }
    );

    if (!updatedTest) {
      return res.status(404).json({ error: "Test not found." });
    }

    return res.json({
      message: "Test updated successfully.",
      test: updatedTest,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to update test." });
  }
};

// Delete a test entry
exports.deleteTest = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedTest = await Test.findByIdAndDelete(id);
    if (!deletedTest) {
      return res.status(404).json({ error: "Test not found." });
    }

    return res.json({ message: "Test deleted successfully." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to delete test." });
  }
};
