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

    // Get division, department, and budgetType from proposal (NEW FIELDS in NewProposalWorkflow)
    // Priority: NPW fields > legacy proposal > user assignment > region name fallback
    let division = proposalData.division;
    let department = proposalData.department;
    let budgetType = proposalData.budgetType || proposalData.modelType || 'Initial';
    
    console.log('[BRD_CONSOLIDATION] NPW org fields - Division:', division, 'Department:', department, 'IsCO:', proposalData.isCentralOffice);

    // Try to get more detailed info from linked legacy proposal if NPW fields are missing
    if (!division || !department) {
      try {
        const legacyProposalId = proposalData.workflowRef || proposalData.legacyProposalId;
        if (legacyProposalId) {
          const legacyProposal = await Proposal.findById(legacyProposalId).lean();
          if (legacyProposal) {
            console.log('[BRD_CONSOLIDATION] Found legacy proposal:', legacyProposalId);
            division = division || legacyProposal.division;
            department = department || legacyProposal.department;
          }
        }
      } catch (error) {
        console.log('[BRD_CONSOLIDATION] Could not fetch legacy proposal:', error.message);
      }
    }

    // If still missing, try to get from createdBy user's organizational assignment
    if (!division || !department || !proposalData.assignmentLevel) {
      try {
        if (proposalData.createdBy) {
          const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
          const userAssignment = await HierarchicalUserAssignment.findOne({ 
            userId: proposalData.createdBy 
          }).lean();
          
          if (userAssignment) {
            division = division || userAssignment.division;
            department = department || userAssignment.department;
            
            // If the proposal document itself is missing assignmentLevel, persist it for future use
            if (!proposalData.assignmentLevel && userAssignment.assignmentLevel) {
               await NewProposalWorkflow.updateOne(
                 { _id: proposalData._id }, 
                 { $set: { assignmentLevel: userAssignment.assignmentLevel } }
               );
               proposalData.assignmentLevel = userAssignment.assignmentLevel;
            }
            console.log('[BRD_CONSOLIDATION] Got org data from user assignment');
          }
        }
      } catch (error) {
        console.log('[BRD_CONSOLIDATION] Could not fetch user assignment:', error.message);
      }
    }

    // Final fallback: use region name if still missing
    division = division || regionName || 'General';
    department = department || regionName || 'General';

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

/** Normalize region for comparison — treat "Central Office" as CO regardless of flag */
const isCentralOfficeRecord = (record) =>
  record.isCentralOffice === true ||
  (record.region && String(record.region).trim().toLowerCase() === 'central office');

/**
 * Get all regions with their divisions and proposal counts
 * Excludes Central Office; only regional (non-CO) records appear here.
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

    let regionalRecords = await BRDConsolidation.find(query).lean();
    // Exclude any record that is effectively Central Office (e.g. region name "Central Office")
    regionalRecords = regionalRecords.filter((r) => !isCentralOfficeRecord(r));

    // Group by region -> division -> proposals (use fallbacks for missing region/division)
    const structure = {};
    regionalRecords.forEach(record => {
      const regionKey = record.region && String(record.region).trim() ? record.region : 'Unassigned Region';
      const divisionKey = record.division && String(record.division).trim() ? record.division : 'Unassigned Division';
      if (!structure[regionKey]) {
        structure[regionKey] = {
          region: regionKey,
          divisions: {}
        };
      }

      if (!structure[regionKey].divisions[divisionKey]) {
        structure[regionKey].divisions[divisionKey] = {
          division: divisionKey,
          consolidationId: null,
          proposalCount: 0,
          totalAmount: 0,
          proposals: []
        };
      }

      if (!structure[regionKey].divisions[divisionKey].consolidationId) {
        structure[regionKey].divisions[divisionKey].consolidationId = record._id.toString();
      }

      structure[regionKey].divisions[divisionKey].proposalCount++;
      structure[regionKey].divisions[divisionKey].totalAmount += record.proposalAmount || 0;
      structure[regionKey].divisions[divisionKey].proposals.push({
        proposalId: record.proposalId,
        title: record.proposalTitle,
        amount: record.proposalAmount || 0,
        modelType: record.modelType,
        budgetType: record.modelType,
        consolidationId: record._id.toString(),
        fiscalYear: record.fiscalYear,
        consolidatedAt: record.consolidatedAt,
        updatedAt: record.updatedAt,
        status: record.status,
        consolidationPath: record.consolidationPath,
        region: record.region,
        division: record.division,
        department: record.department
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
 * Includes only records that are Central Office (by flag or region name "Central Office").
 */
const getCentralOfficeStructure = async (fiscalYear = null) => {
  try {
    console.log('[BRD_CONSOLIDATION] Fetching Central Office structure');

    const query = { status: 'ACTIVE' };
    if (fiscalYear) {
      query.fiscalYear = fiscalYear;
    }

    let records = await BRDConsolidation.find(query).lean();
    // Include only Central Office: isCentralOffice true OR region is "Central Office"
    records = records.filter((r) => isCentralOfficeRecord(r));

    // Group by department (use 'Unassigned Department' when missing)
    const departments = {};
    records.forEach(record => {
      const deptKey = record.department && String(record.department).trim() ? record.department : 'Unassigned Department';
      if (!departments[deptKey]) {
        departments[deptKey] = {
          department: deptKey,
          consolidationId: null,
          proposalCount: 0,
          totalAmount: 0,
          proposals: []
        };
      }
      if (!departments[deptKey].consolidationId) {
        departments[deptKey].consolidationId = record._id.toString();
      }
      const amount = record.proposalAmount || 0;
      departments[deptKey].proposalCount++;
      departments[deptKey].totalAmount += amount;
      departments[deptKey].proposals.push({
        proposalId: record.proposalId,
        title: record.proposalTitle,
        amount,
        modelType: record.modelType,
        budgetType: record.modelType,
        consolidationId: record._id.toString(),
        fiscalYear: record.fiscalYear,
        consolidatedAt: record.consolidatedAt,
        updatedAt: record.updatedAt,
        status: record.status,
        consolidationPath: record.consolidationPath,
        region: record.region,
        division: record.division,
        department: record.department
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

    const regionalRecords = records.filter((r) => !isCentralOfficeRecord(r));
    const coRecords = records.filter((r) => isCentralOfficeRecord(r));
    const summary = {
      totalProposals: records.length,
      totalAmount: records.reduce((sum, r) => sum + (r.proposalAmount || 0), 0),
      regionalProposals: regionalRecords.length,
      centralOfficeProposals: coRecords.length,
      regionsCount: new Set(regionalRecords.map((r) => r.region)).size,
      departmentsCount: new Set(coRecords.map((r) => (r.department && String(r.department).trim()) ? r.department : 'Unassigned Department')).size,
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

    // Count by region (Central Office vs regional)
    records.forEach(record => {
      const region = isCentralOfficeRecord(record) ? 'Central Office' : record.region;
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

/**
 * Update organizational information for a consolidation record
 * Allows BRD analyst to correct division, department, and office assignment
 */
const updateOrganizationalInfo = async (consolidationId, { division, department, office, isCentralOffice }) => {
  try {
    console.log(`[BRD_CONSOLIDATION] Updating org info for consolidation: ${consolidationId}`);
    console.log(`[BRD_CONSOLIDATION] New values - Division: ${division}, Department: ${department}, Office: ${office}, IsCO: ${isCentralOffice}`);

    const updateData = {};
    if (division !== undefined) updateData.division = division;
    if (department !== undefined) updateData.department = department;
    if (office !== undefined) updateData.office = office;
    if (isCentralOffice !== undefined) updateData.isCentralOffice = isCentralOffice;

    // Regenerate consolidation path if division/department changed
    if (division || department) {
      const doc = await BRDConsolidation.findById(consolidationId);
      if (doc) {
        const newDivision = division || doc.division;
        const newDepartment = department || doc.department;
        const newPath = isCentralOffice || updateData.isCentralOffice 
          ? `Central Office/${newDepartment}`
          : `${doc.region}/${newDivision}`;
        updateData.consolidationPath = newPath;
        console.log(`[BRD_CONSOLIDATION] Updated path: ${updateData.consolidationPath}`);
      }
    }

    const updated = await BRDConsolidation.findByIdAndUpdate(
      consolidationId,
      updateData,
      { new: true, runValidators: true }
    );

    console.log(`[BRD_CONSOLIDATION] Successfully updated org info`);
    return updated;
  } catch (error) {
    console.error('[BRD_CONSOLIDATION] Error updating organizational info:', error);
    throw error;
  }
};

/**
 * Get consolidation record by ID for editing
 */
const getConsolidationRecord = async (consolidationId) => {
  try {
    const record = await BRDConsolidation.findById(consolidationId)
      .populate('proposalId', 'title modelType amount fiscalYear')
      .lean();
    return record;
  } catch (error) {
    console.error('[BRD_CONSOLIDATION] Error fetching consolidation record:', error);
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
  updateConsolidationStatus,
  updateOrganizationalInfo,
  getConsolidationRecord
};
