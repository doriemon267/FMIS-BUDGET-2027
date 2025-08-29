const PositionTitle = require('../models/PositionTitle');


exports.getAllPositionTitles = async (req, res) => {
  try {
    const positions = await PositionTitle.find();
    res.status(200).json({positions});
  } catch (error) {
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
