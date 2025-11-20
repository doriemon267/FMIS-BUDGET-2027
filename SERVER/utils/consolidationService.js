/**
 * BRD Consolidation Service
 * Handles automatic folder structure creation and management for proposals at BRD level
 */

const mongoose = require('mongoose');
const BRDConsolidation = require('../models/BRDConsolidation');
const NewProposalWorkflow = require('../models/NewProposalWorkflow');
const Proposal = require('../models/Proposal');

/**
 * Generate consolidation path based on region and organizational unit
 * Format: "Region/Division" for regional or "Central Office/Department" for CO
 */
const generateConsolidationPath = (region, division, department, isCentralOffice) => {
  try {
    if (isCentralOffice) {
      const dept = department || 'Unassigned Department';
      return `Central Office/${dept}`.trim();
    }

    const reg = region || 'Unassigned Region';
    const div = division || 'Unassigned Division';
    return `${reg}/${div}`.trim();
  } catch (error) {
    console.error('[BRD_CONSOLIDATION] Error generating path:', error);
    throw error;
  }
};

/**
 * Create a consolidation record for a proposal reaching BRD level
 */
const createConsolidationRecord = async (proposalData) => {
  try {
    console.log('[BRD_CONSOLIDATION] Creating consolidation record for proposal:', proposalData._id);

    // Determine if Central Office
    const isCentralOffice = proposalData.isCentralOffice || 
                          (proposalData.region && proposalData.region.toString() === 'central-office');

    // Get region name - handle both populated object and ObjectId
    let regionName = 'Unknown Region';
    if (proposalData.region) {
      if (typeof proposalData.region === 'object' && proposalData.region._id) {
        // Populated region object
        regionName = proposalData.region.Region || proposalData.region.RegionName || 'Unknown Region';
      } else if (typeof proposalData.region === 'object' && proposalData.region.Region) {
        // Already has Region field
        regionName = proposalData.region.Region;
      } else if (typeof proposalData.region === 'string') {
        // String reference
        regionName = proposalData.region;
      }
    }

    console.log('[BRD_CONSOLIDATION] Extracted region name:', regionName);

    // Get division, department, and budgetType from proposal or linked legacy proposal
    // If division/department are not available, use region information
    let division = proposalData.division || regionName || 'General';
    let department = proposalData.department || regionName || 'General';
    let budgetType = proposalData.budgetType || proposalData.modelType || 'Initial';

    // Try to get more detailed info from linked legacy proposal or user assignment
    if (proposalData.workflowRef || proposalData.legacyProposalId) {
      try {
        const legacyProposalId = proposalData.workflowRef || proposalData.legacyProposalId;
        const legacyProposal = await Proposal.findById(legacyProposalId).lean();
        if (legacyProposal) {
          console.log('[BRD_CONSOLIDATION] Found legacy proposal:', legacyProposalId);
          division = legacyProposal.division || division;
          department = legacyProposal.department || department;
          budgetType = legacyProposal.budgetType || budgetType;
        }
      } catch (error) {
        console.log('[BRD_CONSOLIDATION] Could not fetch legacy proposal:', error.message);
      }
    }

    // If still "General", try to get from createdBy user's organizational assignment
    if (division === 'General' || division === regionName) {
      try {
        if (proposalData.createdBy) {
          const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
          const userAssignment = await HierarchicalUserAssignment.findOne({ 
            userId: proposalData.createdBy 
          }).lean();
          
          if (userAssignment && userAssignment.division) {
            division = userAssignment.division;
            console.log('[BRD_CONSOLIDATION] Got division from user assignment:', division);
          }
        }
      } catch (error) {
        console.log('[BRD_CONSOLIDATION] Could not fetch user assignment:', error.message);
      }
    }

    console.log('[BRD_CONSOLIDATION] Extracted data - Region:', regionName, 'Division:', division, 'Department:', department, 'BudgetType:', budgetType);

    // Generate consolidation path
    const consolidationPath = generateConsolidationPath(
      regionName,
      division,
      department,
      isCentralOffice
    );

    // Check if record already exists
    const existingRecord = await BRDConsolidation.findOne({ proposalId: proposalData._id });
    if (existingRecord) {
      console.log('[BRD_CONSOLIDATION] Record already exists for proposal:', proposalData._id);
      return existingRecord;
    }

    // Create new consolidation record
    const consolidationRecord = new BRDConsolidation({
      proposalId: proposalData._id,
      region: regionName,
      division: division,
      department: department,
      consolidationPath: consolidationPath,
      isCentralOffice: isCentralOffice,
      proposalTitle: proposalData.title || proposalData.proposalTitle,
      proposalAmount: proposalData.amount || proposalData.proposalAmount || 0,
      modelType: budgetType,
      fiscalYear: proposalData.fiscalYear,
      legacyProposalId: proposalData.workflowRef?.toString(),
      consolidatedBy: 'SYSTEM',
      status: 'ACTIVE',
      notes: `Automatically consolidated to BRD level on ${new Date().toISOString()}`
    });

    const savedRecord = await consolidationRecord.save();
    console.log('[BRD_CONSOLIDATION] Successfully created consolidation record:', savedRecord._id);
    console.log('[BRD_CONSOLIDATION] Path:', consolidationPath);

    return savedRecord;
  } catch (error) {
    console.error('[BRD_CONSOLIDATION] Error creating consolidation record:', error);
    throw error;
  }
};

/**
 * Get all consolidation folders (regions and central office)
 */
const getConsolidationFolders = async (fiscalYear = null) => {
  try {
    console.log('[BRD_CONSOLIDATION] Fetching consolidation folders');

    const query = { status: 'ACTIVE' };
    if (fiscalYear) {
      query.fiscalYear = fiscalYear;
    }

    const records = await BRDConsolidation.find(query).lean();

    // Group by consolidation path
    const folders = {};
    records.forEach(record => {
      if (!folders[record.consolidationPath]) {
        folders[record.consolidationPath] = {
          path: record.consolidationPath,
          region: record.region,
          division: record.division,
          department: record.department,
          isCentralOffice: record.isCentralOffice,
          proposalCount: 0,
          totalAmount: 0,
          proposals: []
        };
      }

      folders[record.consolidationPath].proposalCount++;
      folders[record.consolidationPath].totalAmount += record.proposalAmount || 0;
      folders[record.consolidationPath].proposals.push({
        proposalId: record.proposalId,
        title: record.proposalTitle,
        amount: record.proposalAmount,
        consolidatedAt: record.consolidatedAt
      });
    });

    const folderArray = Object.values(folders).sort((a, b) => 
      a.path.localeCompare(b.path)
    );

    console.log('[BRD_CONSOLIDATION] Found', folderArray.length, 'folders');
    return folderArray;
  } catch (error) {
    console.error('[BRD_CONSOLIDATION] Error fetching consolidation folders:', error);
    throw error;
  }
};

/**
 * Get proposals within a specific consolidation folder
 */
const getProposalsInFolder = async (consolidationPath) => {
  try {
    console.log('[BRD_CONSOLIDATION] Fetching proposals for path:', consolidationPath);

    const records = await BRDConsolidation.find({
      consolidationPath: consolidationPath,
      status: 'ACTIVE'
    }).populate('proposalId', 'title amount status fiscalYear modelType');

    console.log('[BRD_CONSOLIDATION] Found', records.length, 'proposals');
    return records;
  } catch (error) {
    console.error('[BRD_CONSOLIDATION] Error fetching proposals in folder:', error);
    throw error;
  }
};

/**
 * Get all regions with their divisions and proposal counts
 */
const getRegionStructure = async (fiscalYear = null) => {
  try {
    console.log('[BRD_CONSOLIDATION] Building region structure');

    const query = {
      status: 'ACTIVE',
      isCentralOffice: false
    };
    if (fiscalYear) {
      query.fiscalYear = fiscalYear;
    }

    const regionalRecords = await BRDConsolidation.find(query).lean();

    // Group by region -> division -> proposals
    const structure = {};
    regionalRecords.forEach(record => {
      if (!structure[record.region]) {
        structure[record.region] = {
          region: record.region,
          divisions: {}
        };
      }

      if (!structure[record.region].divisions[record.division]) {
        structure[record.region].divisions[record.division] = {
          division: record.division,
          proposalCount: 0,
          totalAmount: 0,
          proposals: []
        };
      }

      structure[record.region].divisions[record.division].proposalCount++;
      structure[record.region].divisions[record.division].totalAmount += record.proposalAmount || 0;
      structure[record.region].divisions[record.division].proposals.push({
        proposalId: record.proposalId,
        title: record.proposalTitle,
        amount: record.proposalAmount,
        modelType: record.modelType,
        budgetType: record.modelType
      });
    });

    // Convert to array format
    const regionArray = Object.values(structure).map(region => ({
      ...region,
      divisions: Object.values(region.divisions),
      divisionCount: Object.keys(region.divisions).length
    })).sort((a, b) => a.region.localeCompare(b.region));

    console.log('[BRD_CONSOLIDATION] Built structure for', regionArray.length, 'regions');
    return regionArray;
  } catch (error) {
    console.error('[BRD_CONSOLIDATION] Error building region structure:', error);
    throw error;
  }
};

/**
 * Get Central Office department structure
 */
const getCentralOfficeStructure = async (fiscalYear = null) => {
  try {
    console.log('[BRD_CONSOLIDATION] Fetching Central Office structure');

    const query = {
      status: 'ACTIVE',
      isCentralOffice: true
    };
    if (fiscalYear) {
      query.fiscalYear = fiscalYear;
    }

    const records = await BRDConsolidation.find(query).lean();

    // Group by department
    const departments = {};
    records.forEach(record => {
      if (!departments[record.department]) {
        departments[record.department] = {
          department: record.department,
          proposalCount: 0,
          totalAmount: 0,
          proposals: []
        };
      }

      departments[record.department].proposalCount++;
      departments[record.department].totalAmount += record.proposalAmount || 0;
      departments[record.department].proposals.push({
        proposalId: record.proposalId,
        title: record.proposalTitle,
        amount: record.proposalAmount,
        modelType: record.modelType,
        budgetType: record.modelType
      });
    });

    const deptArray = Object.values(departments).sort((a, b) =>
      a.department.localeCompare(b.department)
    );

    console.log('[BRD_CONSOLIDATION] Found', deptArray.length, 'Central Office departments');
    return deptArray;
  } catch (error) {
    console.error('[BRD_CONSOLIDATION] Error fetching Central Office structure:', error);
    throw error;
  }
};

/**
 * Get consolidation summary statistics
 */
const getConsolidationSummary = async (fiscalYear = null) => {
  try {
    console.log('[BRD_CONSOLIDATION] Calculating consolidation summary');

    // First, get all records to find available fiscal years
    const allRecords = await BRDConsolidation.find({ status: 'ACTIVE' }).lean();
    
    // Get unique fiscal years
    const fiscalYears = [...new Set(allRecords.map(r => r.fiscalYear))].sort((a, b) => b - a);

    const query = { status: 'ACTIVE' };
    if (fiscalYear) {
      query.fiscalYear = fiscalYear;
    }

    const records = await BRDConsolidation.find(query).lean();

    const summary = {
      totalProposals: records.length,
      totalAmount: records.reduce((sum, r) => sum + (r.proposalAmount || 0), 0),
      regionalProposals: records.filter(r => !r.isCentralOffice).length,
      centralOfficeProposals: records.filter(r => r.isCentralOffice).length,
      regionsCount: new Set(records.filter(r => !r.isCentralOffice).map(r => r.region)).size,
      departmentsCount: new Set(records.filter(r => r.isCentralOffice).map(r => r.department)).size,
      byModelType: {},
      byRegion: {},
      byFiscalYear: {}
    };

    // Count by fiscal year
    fiscalYears.forEach(fy => {
      const fyRecords = allRecords.filter(r => r.fiscalYear === fy);
      summary.byFiscalYear[fy] = fyRecords.length;
    });

    // Count by model type
    records.forEach(record => {
      const modelType = record.modelType || 'Initial';
      summary.byModelType[modelType] = (summary.byModelType[modelType] || 0) + 1;
    });

    // Count by region
    records.forEach(record => {
      const region = record.isCentralOffice ? 'Central Office' : record.region;
      summary.byRegion[region] = (summary.byRegion[region] || 0) + 1;
    });

    console.log('[BRD_CONSOLIDATION] Summary:', summary);
    return summary;
  } catch (error) {
    console.error('[BRD_CONSOLIDATION] Error calculating summary:', error);
    throw error;
  }
};

/**
 * Update consolidation record status
 */
const updateConsolidationStatus = async (proposalId, newStatus, notes = '') => {
  try {
    console.log('[BRD_CONSOLIDATION] Updating consolidation status for proposal:', proposalId);

    const updated = await BRDConsolidation.findOneAndUpdate(
      { proposalId: mongoose.Types.ObjectId.isValid(proposalId) ? proposalId : undefined },
      {
        status: newStatus,
        notes: notes || `Status updated to ${newStatus}`,
        updatedAt: Date.now()
      },
      { new: true }
    );

    if (updated) {
      console.log('[BRD_CONSOLIDATION] Successfully updated status to:', newStatus);
    }
    return updated;
  } catch (error) {
    console.error('[BRD_CONSOLIDATION] Error updating consolidation status:', error);
    throw error;
  }
};

module.exports = {
  createConsolidationRecord,
  generateConsolidationPath,
  getConsolidationFolders,
  getProposalsInFolder,
  getRegionStructure,
  getCentralOfficeStructure,
  getConsolidationSummary,
  updateConsolidationStatus
};
