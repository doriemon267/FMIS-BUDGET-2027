const Status = require('../models/Status');


exports.getStatus = async (req, res) => {
  try {
    const status = await Status.find();
    res.status(200).json({status});
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while fetching status.' });
  }
};

// Get PositionTitle by ID
exports.getStatusById = async (req, res) => {
  try {
    const status = await Status.findById(req.params.id);
    
    if (!status) {
      return res.status(404).json({ error: 'Status not found' });
    }

    res.status(200).json(status);
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while fetching the status.' });
  }
};
