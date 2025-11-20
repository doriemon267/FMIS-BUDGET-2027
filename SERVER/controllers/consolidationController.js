/**
 * Consolidation Controller
 * Handles BRD level folder structure and proposal consolidation endpoints
 */

const consolidationService = require('../utils/consolidationService');

/**
 * Get all consolidation folders (both regional and central office)
 */
exports.getFolders = async (req, res) => {
  try {
    console.log('[CONSOLIDATION] Fetching all consolidation folders');
    
    const { fiscalYear } = req.query;
    const folders = await consolidationService.getConsolidationFolders(
      fiscalYear ? parseInt(fiscalYear) : null
    );

    res.json({
      success: true,
      data: folders,
      count: folders.length,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('[CONSOLIDATION] Error fetching folders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch consolidation folders',
      error: error.message
    });
  }
};

/**
 * Get proposals in a specific consolidation folder
 */
exports.getProposalsInFolder = async (req, res) => {
  try {
    const { path } = req.params;
    
    if (!path) {
      return res.status(400).json({
        success: false,
        message: 'Consolidation path is required'
      });
    }

    console.log('[CONSOLIDATION] Fetching proposals for path:', path);
    
    // Decode the path from URL encoding
    const decodedPath = decodeURIComponent(path);
    const proposals = await consolidationService.getProposalsInFolder(decodedPath);

    res.json({
      success: true,
      path: decodedPath,
      data: proposals,
      count: proposals.length,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('[CONSOLIDATION] Error fetching proposals in folder:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch proposals in folder',
      error: error.message
    });
  }
};

/**
 * Get regional structure with divisions and proposal counts
 */
exports.getRegionStructure = async (req, res) => {
  try {
    console.log('[CONSOLIDATION] Fetching region structure');
    
    const { fiscalYear } = req.query;
    const structure = await consolidationService.getRegionStructure(
      fiscalYear ? parseInt(fiscalYear) : null
    );

    res.json({
      success: true,
      data: structure,
      regionCount: structure.length,
      totalDivisions: structure.reduce((sum, r) => sum + r.divisionCount, 0),
      timestamp: new Date()
    });
  } catch (error) {
    console.error('[CONSOLIDATION] Error fetching region structure:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch region structure',
      error: error.message
    });
  }
};

/**
 * Get Central Office department structure
 */
exports.getCentralOfficeStructure = async (req, res) => {
  try {
    console.log('[CONSOLIDATION] Fetching Central Office structure');
    
    const { fiscalYear } = req.query;
    const structure = await consolidationService.getCentralOfficeStructure(
      fiscalYear ? parseInt(fiscalYear) : null
    );

    res.json({
      success: true,
      data: structure,
      departmentCount: structure.length,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('[CONSOLIDATION] Error fetching Central Office structure:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch Central Office structure',
      error: error.message
    });
  }
};

/**
 * Get consolidation summary and statistics
 */
exports.getSummary = async (req, res) => {
  try {
    console.log('[CONSOLIDATION] Fetching consolidation summary');
    
    const { fiscalYear } = req.query;
    const summary = await consolidationService.getConsolidationSummary(
      fiscalYear ? parseInt(fiscalYear) : null
    );

    res.json({
      success: true,
      data: summary,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('[CONSOLIDATION] Error fetching summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch consolidation summary',
      error: error.message
    });
  }
};
