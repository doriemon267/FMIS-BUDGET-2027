const PositionTitle = require('../models/PositionTitle');
exports.getAllPositionTitles = async (req, res) => {
  try {
    const { page = 1, limit = 0, search = "", orderBy = "PositionTitle", order = "asc" } = req.query;

    const query = {};
    if (search) {
      query.$or = [
        { PositionTitle: { $regex: search, $options: "i" } },
        { JG: { $regex: search, $options: "i" } },
        { PG: { $regex: search, $options: "i" } }
      ];
      if (!isNaN(search)) {
        query.$or.push({ SG: Number(search) });
      }
    }

    const sortOrder = order === "desc" ? -1 : 1;
    const sortOptions = {};
    if (orderBy) {
       sortOptions[orderBy] = sortOrder;
    } else {
       sortOptions.PositionTitle = 1;
    }

    const totalRecords = await PositionTitle.countDocuments(query);
    
    let positionsQuery = PositionTitle.find(query).sort(sortOptions);
    
    const limitNum = Number(limit);
    if (limitNum > 0) {
      const skip = (Number(page) - 1) * limitNum;
      positionsQuery = positionsQuery.skip(skip).limit(limitNum);
    }
    
    const positions = await positionsQuery;
    
    res.status(200).json({
      positions,
      totalRecords,
      totalPages: limitNum > 0 ? Math.ceil(totalRecords / limitNum) : 1,
      currentPage: Number(page)
    });
  } catch (error) {
    console.error("Error in getAllPositionTitles:", error);
    res.status(500).json({ error: 'An error occurred while fetching positions.' });
  }
};
// Get PositionTitle by ID
exports.getPositionTitleById = async (req, res) => {
  try {
    const position = await PositionTitle.findById(req.params.id);
    if (!position) {
      return res.status(404).json({ error: 'Position not found' });
    }
    res.status(200).json({position});
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while fetching the position.' });
  }
};

// Create a new PositionTitle
exports.createPositionTitle = async (req, res) => {
  try {
    const { PositionTitle: title, SG, JG, PG } = req.body;
    
    // Check if position already exists
    const existingPosition = await PositionTitle.findOne({ PositionTitle: title });
    if (existingPosition) {
      return res.status(400).json({ error: 'Position Title already exists.' });
    }

    const position = new PositionTitle({ PositionTitle: title, SG, JG, PG });
    await position.save();
    res.status(201).json({ position, message: 'Position Title created successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while creating the position.' });
  }
};

// Update an existing PositionTitle
exports.updatePositionTitle = async (req, res) => {
  try {
    const { PositionTitle: title, SG, JG, PG } = req.body;
    const position = await PositionTitle.findByIdAndUpdate(
      req.params.id,
      { PositionTitle: title, SG, JG, PG },
      { new: true, runValidators: true }
    );
    if (!position) {
      return res.status(404).json({ error: 'Position not found' });
    }
    res.status(200).json({ position, message: 'Position Title updated successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while updating the position.' });
  }
};

// Delete a PositionTitle
exports.deletePositionTitle = async (req, res) => {
  try {
    const position = await PositionTitle.findByIdAndDelete(req.params.id);
    if (!position) {
      return res.status(404).json({ error: 'Position not found' });
    }
    res.status(200).json({ message: 'Position Title deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while deleting the position.' });
  }
};