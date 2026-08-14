/**
 * Consolidation Controller
 * Handles BRD level folder structure and proposal consolidation endpoints
 */

const consolidationService = require('../utils/consolidationService');
const consoProposalExportService = require('../utils/consoProposalExportService');

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

/**
 * Get a specific consolidation record for editing
 */
exports.getConsolidationRecord = async (req, res) => {
  try {
    const { consolidationId } = req.params;
    
    if (!consolidationId) {
      return res.status(400).json({
        success: false,
        message: 'Consolidation ID is required'
      });
    }

    console.log('[CONSOLIDATION] Fetching consolidation record:', consolidationId);
    
    const record = await consolidationService.getConsolidationRecord(consolidationId);
    
    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Consolidation record not found'
      });
    }

    res.json({
      success: true,
      data: record,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('[CONSOLIDATION] Error fetching consolidation record:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch consolidation record',
      error: error.message
    });
  }
};

/**
 * Update organizational information for a consolidation record
 * Allows BRD analyst to correct division, department, office assignment
 */
exports.updateOrganizationalInfo = async (req, res) => {
  try {
    const { consolidationId } = req.params;
    const { division, department, office, isCentralOffice } = req.body;
    
    if (!consolidationId) {
      return res.status(400).json({
        success: false,
        message: 'Consolidation ID is required'
      });
    }

    console.log('[CONSOLIDATION] Updating org info for consolidation:', consolidationId);
    console.log('[CONSOLIDATION] Updates:', { division, department, office, isCentralOffice });
    
    const updated = await consolidationService.updateOrganizationalInfo(
      consolidationId,
      { division, department, office, isCentralOffice }
    );
    
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Consolidation record not found'
      });
    }

    res.json({
      success: true,
      message: 'Organizational information updated successfully',
      data: updated,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('[CONSOLIDATION] Error updating organizational info:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update organizational information',
      error: error.message
    });
  }
};

exports.exportConsoProposalExcel = async (req, res) => {
  try {
    const { fiscalYear } = req.query;
    const buffer = await consoProposalExportService.generateConsoProposalExcel(fiscalYear);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=CONSO_PROPOSAL_${fiscalYear || 'ALL'}.xlsx`);
    res.send(buffer);
  } catch (error) {
    console.error('[CONSOLIDATION] Error exporting excel:', error);
    res.status(500).json({ success: false, message: 'Failed to generate Excel report', error: error.message });
  }
};

exports.exportConsoProposalPdf = async (req, res) => {
  try {
    const { fiscalYear, regions } = req.query;
    const selectedRegions = consoProposalExportService._private.normalizeSelectedRegions(regions);
    if (selectedRegions.length > 64 || selectedRegions.some((region) => region.length > 120)) {
      return res.status(400).json({
        success: false,
        message: 'The selected region list is invalid or exceeds the allowed report scope.',
      });
    }
    const buffer = await consoProposalExportService.generateConsoProposalPdf(fiscalYear, {
      selectedRegions,
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=CONSO_PROPOSAL_${fiscalYear || 'ALL'}.pdf`);
    res.send(buffer);
  } catch (error) {
    console.error('[CONSOLIDATION] Error exporting pdf:', error);
    const statusCode = Number(error.statusCode) || 500;
    res.status(statusCode).json({ success: false, message: 'Failed to generate PDF report', error: error.message });
  }
};
