/**
 * Auto-consolidate Draft budget items into Proposal documents
 * This ensures each aggregated group has a single Proposal ID for workflow operations
 */

const PersonnelService = require('../models/PersonnelServices');
const MooeProposal = require('../models/MooeProposal');
const CapitalOutlay = require('../models/CapitalOutlay');
const Income = require('../models/Income');
const Proposal = require('../models/Proposal');

/**
 * Consolidate Draft items for a specific organizational unit
 * @param {Object} criteria - { fiscalYear, budgetType, processBy, region, division?, department? }
 * @returns {Promise<Object>} - The created/updated Proposal document
 */
async function consolidateDraftProposal(criteria) {
  try {
    const { fiscalYear, budgetType, processBy, region, division, department } = criteria;

    // Build query for Draft items
    const query = {
      status: 'Draft',
      fiscalYear,
      budgetType,
      processBy,
      region
    };

    if (division) query.division = division;
    if (department) query.department = department;

    // Fetch all Draft items matching criteria
    const [draftPersonnel, draftMooe, draftCapital, draftIncome] = await Promise.all([
      PersonnelService.find(query),
      MooeProposal.find(query),
      CapitalOutlay.find(query),
      Income.find(query)
    ]);

    // If no draft items exist, return null
    const totalItems = draftPersonnel.length + draftMooe.length + draftCapital.length + draftIncome.length;
    if (totalItems === 0) {
      return null;
    }

    // Calculate totals
    let totalPersonnelExpenses = 0;
    let totalMooeExpenses = 0;
    let totalCapitalExpenses = 0;
    let totalIncome = 0;

    // Personnel Services total
    if (draftPersonnel.length > 0) {
      totalPersonnelExpenses = draftPersonnel.reduce((sum, item) => {
        const itemTotal = [
          'annualSalary', 'RATA', 'PERA', 'uniformALLOWANCE', 'productivityIncentive',
          'medical', 'ChildrenAllowance', 'meal', 'cashGift', 'subsistenceAllowanceMDS',
          'subsistenceAllowanceST', 'midyearBonus', 'yearEndBonus', 'gsisPremium',
          'philhealthPremium', 'pagibigPremium', 'employeeCompensation', 'loyaltyAward',
          'overtimePay', 'earnedLeaves', 'retirementBenefits', 'terminalLeave', 'courtAppearance'
        ].reduce((itemSum, field) => itemSum + (Number(item[field]) || 0), 0);
        return sum + itemTotal;
      }, 0);
    }

    // MOOE total
    if (draftMooe.length > 0) {
      totalMooeExpenses = draftMooe.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    }

    // Capital Outlay total
    if (draftCapital.length > 0) {
      totalCapitalExpenses = draftCapital.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    }

    // Income total
    if (draftIncome.length > 0) {
      totalIncome = draftIncome.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    }

    const totalExpenses = totalPersonnelExpenses + totalMooeExpenses + totalCapitalExpenses;
    const proposedBudget = totalExpenses + totalIncome; // Budget = Expenses + Income
    const projectedSubsidy = totalExpenses; // Subsidy is the expense amount

    // Build proposal title
    const orgUnit = division || department || region;
    const title = `${orgUnit} - ${fiscalYear} ${budgetType} Budget Proposal`;

    // Build proposal filter (to find existing or create new)
    const proposalFilter = {
      fiscalYear,
      budgetType,
      processBy,
      region,
      status: 'Draft'
    };

    if (division) proposalFilter.division = division;
    if (department) proposalFilter.department = department;

    // Upsert the Proposal document
    const proposal = await Proposal.findOneAndUpdate(
      proposalFilter,
      {
        $set: {
          title,
          fiscalYear,
          budgetType,
          processBy,
          region,
          division: division || null,
          department: department || null,
          status: 'Draft',
          totalExpenses,
          totalIncome,
          proposedBudget,
          projectedCorporateIncome: totalIncome,
          projectedSubsidy,
          personnelCount: draftPersonnel.length,
          mooeCount: draftMooe.length,
          capitalCount: draftCapital.length,
          incomeCount: draftIncome.length,
          updatedAt: new Date()
        }
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );

    return proposal;

  } catch (error) {
    console.error('❌ Error consolidating draft proposal:', error);
    throw error;
  }
}

/**
 * Consolidate all Draft items across the system
 * Groups by fiscalYear, budgetType, processBy, region, division, department
 */
async function consolidateAllDrafts() {
  try {

    // Get all unique combinations of organizational criteria from Draft items
    const [personnelGroups, mooeGroups, capitalGroups, incomeGroups] = await Promise.all([
      PersonnelService.aggregate([
        { $match: { status: 'Draft' } },
        {
          $group: {
            _id: {
              fiscalYear: '$fiscalYear',
              budgetType: '$budgetType',
              processBy: '$processBy',
              region: '$region',
              division: '$division',
              department: '$department'
            }
          }
        }
      ]),
      MooeProposal.aggregate([
        { $match: { status: 'Draft' } },
        {
          $group: {
            _id: {
              fiscalYear: '$fiscalYear',
              budgetType: '$budgetType',
              processBy: '$processBy',
              region: '$region',
              division: '$division',
              department: '$department'
            }
          }
        }
      ]),
      CapitalOutlay.aggregate([
        { $match: { status: 'Draft' } },
        {
          $group: {
            _id: {
              fiscalYear: '$fiscalYear',
              budgetType: '$budgetType',
              processBy: '$processBy',
              region: '$region',
              division: '$division',
              department: '$department'
            }
          }
        }
      ]),
      Income.aggregate([
        { $match: { status: 'Draft' } },
        {
          $group: {
            _id: {
              fiscalYear: '$fiscalYear',
              budgetType: '$budgetType',
              processBy: '$processBy',
              region: '$region',
              division: '$division',
              department: '$department'
            }
          }
        }
      ])
    ]);

    // Combine all unique groups
    const allGroups = [...personnelGroups, ...mooeGroups, ...capitalGroups, ...incomeGroups];
    const uniqueGroups = new Map();

    allGroups.forEach(group => {
      const key = JSON.stringify(group._id);
      if (!uniqueGroups.has(key)) {
        uniqueGroups.set(key, group._id);
      }
    });

    // Consolidate each group
    const results = [];
    for (const criteria of uniqueGroups.values()) {
      const proposal = await consolidateDraftProposal(criteria);
      if (proposal) {
        results.push(proposal);
      }
    }

    return results;

  } catch (error) {
    console.error('❌ Error in consolidateAllDrafts:', error);
    throw error;
  }
}

module.exports = {
  consolidateDraftProposal,
  consolidateAllDrafts
};