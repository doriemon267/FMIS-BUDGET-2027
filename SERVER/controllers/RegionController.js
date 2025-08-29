const Region = require('../models/Region');
const { getAllRegionInfo } = require('../utils/regionUtils');

exports.getAllRegions = async (req, res) => {
  try {
    const regions = await Region.find();

    // Return the regions in their original MongoDB format to maintain consistency
    // Frontend can handle the display formatting
    res.status(200).json(regions);
  } catch (error) {
    console.error('Error fetching regions:', error);
    res.status(500).json({
      error: 'Failed to fetch regions from database',
      message: 'Please ensure regions are properly configured in the database'
    });
  }
};

// Get Region by ID
exports.getRegionById = async (req, res) => {
  try {
    const region = await Region.findById(req.params.id);
    
    if (!region) {
      return res.status(404).json({ error: 'Region not found' });
    }

    res.status(200).json(region);
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while fetching the region.' });
  }
};

// Create a new Region
exports.createRegion = async (req, res) => {
  try {
    const newRegion = new Region(req.body);
    const savedRegion = await newRegion.save();
    res.status(201).json(savedRegion);
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while creating the region.' });
  }
};

// Update a Region by ID
exports.updateRegion = async (req, res) => {
  try {
    const updatedRegion = await Region.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    
    if (!updatedRegion) {
      return res.status(404).json({ error: 'Region not found' });
    }

    res.status(200).json(updatedRegion);
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while updating the region.' });
  }
};

// Delete a Region by ID
exports.deleteRegion = async (req, res) => {
  try {
    const deletedRegion = await Region.findByIdAndDelete(req.params.id);
    
    if (!deletedRegion) {
      return res.status(404).json({ error: 'Region not found' });
    }

    res.status(200).json({ message: 'Region deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while deleting the region.' });
  }
};

/**
 * Get all region information including equivalences and special regions
 */
exports.getRegionInfo = async (req, res) => {
  try {
    const regionInfo = getAllRegionInfo();
    
    return res.status(200).json({
      success: true,
      regionInfo
    });
  } catch (error) {
    console.error('Error in getRegionInfo:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get region information'
    });
  }
};