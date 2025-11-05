const MooeProposal     = require('../models/mooeProposals');
const ChartOfAccounts  = require('../models/chartOfAccounts');
const EmployeeList     = require('../models/EmployeeList');
const COSPersonnel     = require('../models/COSPersonnel');
const Settings         = require('../models/Settings');
const mongoose         = require('mongoose');
const Proposal         = require('../models/Proposal');
const { recalculateAndSaveProposalTotals } = require('../utils/recalculateProposalTotals');
// New combined endpoint to fetch all data at once
exports.getMOOEData = async (req, res) => {
  try {
    // 1. Load active settings
    const activeSettings = await Settings.findOne({ isActive: true });
    // if (!activeSettings || activeSettings.fiscalYear == null) {
    //   return res.status(404).json({ error: 'No active fiscal year found' });
    // }
    const activeFiscalYear = activeSettings.fiscalYear;
    // // 2. Get region from request or user
    const region = req.query.region || req.user?.Region || req.headers['x-region'];
    // // 2. Fetch COA, MOOE proposals and COS personnel filtered by fiscal year and region
    // // Build the complete filter by combining base filter with hierarchical access control
    let filter = { fiscalYear: activeFiscalYear };
    // 🔄 DIRECT SUBMISSION WORKFLOW FIX - Copy exact logic from Personnel Services
    // Check if user is authenticated and get user info
    if (req.user && req.user.id) {
      try {
        const userRoles = req.user?.Roles || [];
        const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
        const assignment = await HierarchicalUserAssignment.getUserPermissions(req.user.id);
        
        // SUPER ADMIN can see all data without filtering
        if (userRoles.includes('SUPER ADMIN')) {
          // No additional filtering needed - keep base filter only
        } else if (assignment && assignment.assignmentLevel === 'DEPARTMENT') {
          // Get department name from assignment
          const userDept = assignment.departments?.[0]?.departmentName;
          const userRegion = assignment.regions?.[0]?.regionName;
          
          if (userDept) {
            // Department users can only see:
            // 1. Their own department MOOE (where division is null/empty)
            // 2. Division MOOE that has been submitted/approved
            filter = {
              $and: [
                {
                  department: userDept,
                  fiscalYear: activeFiscalYear,
                  region: userRegion || region
                },
                {
                  $or: [
                    // Department's own MOOE (no division specified)
                    {
                      $and: [
                        {
                          $or: [
                            { division: { $exists: false } },
                            { division: null },
                            { division: "" }
                          ]
                        }
                      ]
                    },
                    // Division MOOE that has been submitted
                    {
                      $and: [
                        {
                          division: { $exists: true, $ne: "" }
                        },
                        {
                          status: { $in: ["Submitted", "Approved", "Completed"] }
                        }
                      ]
                    }
                  ]
                }
              ]
            };
          }
        } else if (assignment && assignment.assignmentLevel === 'DIVISION') {
          // Division users see only their own division data
          const userDept = assignment.departments?.[0]?.departmentName;
          const userDiv = assignment.divisions?.[0];
          const userRegion = assignment.regions?.[0]?.regionName;
          
          if (userDept && userDiv) {
            filter = {
              department: userDept,
              division: userDiv,
              fiscalYear: activeFiscalYear,
              region: userRegion || region,
              $or: [
                { originalLevel: 'DIVISION' },
                { workflowLevel: 'DIVISION' },
                { originalLevel: { $exists: false } },
                { originalLevel: null },
                { originalLevel: '' }
              ]
            };
          }
        }
      } catch (error) {
        console.error('Error applying MOOE submission workflow:', error);
        // Fallback to basic region filtering
        if (region) {
          filter.region = region;
        }
      }
    } else {
      // Fallback to basic region filtering if no user context
      if (region) {
        filter.region = region;
      }
    }
    // First, let's check what Chart of Accounts data exists
    const totalCOA = await ChartOfAccounts.countDocuments();
    // if (totalCOA > 0) {
    //   const sampleCOA = await ChartOfAccounts.findOne().lean();
    //   // // Check different variations
    //   const expenseCount = await ChartOfAccounts.countDocuments({ accountClass: "Expense" });
    //   // const mooeCount = await ChartOfAccounts.countDocuments({
    //     lineItem: { $regex: /maintenance.*operating/i }
    //   });
    // }
    // Try to fetch Chart of Accounts, but use fallback if none found
    let chartOfAccounts = [];
    let mooeProposals = [];
    let cosPersonnels = [];
    try {
      const results = await Promise.all([
        ChartOfAccounts.find({
          $or: [
            {
              accountClass: "Expense",
              lineItem: "Maintenance and Other Operating Expenses"
            },
            {
              uacsCode: { $regex: /^5-02-99-990/ }
            }
          ]
        }).lean(),
        MooeProposal.find(filter).lean(), // Use the filter object that includes region if available
        COSPersonnel.find({
          statusOfAppointment: "COS",
          fiscalYear: activeFiscalYear,
          ...(region ? { region } : {}) // Add region filter if available
        }).lean()
      ]);
      chartOfAccounts = results[0];
      mooeProposals = results[1];
      cosPersonnels = results[2];
      // Add Financial Expenses entries to the Chart of Accounts data
      const financialExpensesEntries = [
        {
          sublineItem: "Financial Expenses",
          accountingTitle: "Interest Expenses",
          uacsCode: "5-02-30-010"
        },
        {
          sublineItem: "Financial Expenses",
          accountingTitle: "Bank Charges",
          uacsCode: "5-02-30-020"
        },
        {
          sublineItem: "Financial Expenses",
          accountingTitle: "Other Financial Expenses",
          uacsCode: "5-02-30-990"
        }
      ];
      // Add IAs O&M Cost entries to the Chart of Accounts data
      const iasOMCostEntries = [
        {
          sublineItem: "Irrigators' Associations (IAs) Operation & Maintenance Cost",
          accountingTitle: "National Irrigation System",
          uacsCode: "5-02-99-990-NIS"
        },
        {
          sublineItem: "Irrigators' Associations (IAs) Operation & Maintenance Cost",
          accountingTitle: "Communal Irrigation System",
          uacsCode: "5-02-99-990-CIS"
        }
      ];
      // Append the Financial Expenses and IAs O&M Cost entries to the Chart of Accounts data
      chartOfAccounts = [...chartOfAccounts, ...financialExpensesEntries, ...iasOMCostEntries];
      } catch (error) {
      console.error('❌ Database query error:', error);
      // Use empty arrays as fallback
      chartOfAccounts = [];
      mooeProposals = [];
      cosPersonnels = [];
    }
    // // // // // If no Chart of Accounts, create comprehensive MOOE entries
    // if (chartOfAccounts.length === 0) {
    //   chartOfAccounts = [
    //     // 5-02-01 - Traveling Expenses
    //     {
    //       sublineItem: "Traveling Expenses",
    //       accountingTitle: "Traveling Expenses - Local",
    //       uacsCode: "5-02-01-010"
    //     },
    //     {
    //       sublineItem: "Traveling Expenses",
    //       accountingTitle: "Traveling Expenses - Foreign",
    //       uacsCode: "5-02-01-020"
    //     },
    //     // 5-02-02 - Training and Scholarship Expenses
    //     {
    //       sublineItem: "Training and Scholarship Expenses",
    //       accountingTitle: "Training Expenses",
    //       uacsCode: "5-02-02-010"
    //     },
    //     {
    //       sublineItem: "Training and Scholarship Expenses",
    //       accountingTitle: "Scholarship Grants/Expenses",
    //       uacsCode: "5-02-02-020"
    //     },
    //     // 5-02-03 - Supplies and Materials Expenses
    //     {
    //       sublineItem: "Supplies and Materials Expenses",
    //       accountingTitle: "Office Supplies Expenses",
    //       uacsCode: "5-02-03-010"
    //     },
    //     {
    //       sublineItem: "Supplies and Materials Expenses",
    //       accountingTitle: "Accountable Forms Expenses",
    //       uacsCode: "5-02-03-020"
    //     },
    //     {
    //       sublineItem: "Supplies and Materials Expenses",
    //       accountingTitle: "Non-Accountable Forms Expenses",
    //       uacsCode: "5-02-03-030"
    //     },
    //     {
    //       sublineItem: "Supplies and Materials Expenses",
    //       accountingTitle: "Animal/Zoological Supplies Expenses",
    //       uacsCode: "5-02-03-040"
    //     },
    //     {
    //       sublineItem: "Supplies and Materials Expenses",
    //       accountingTitle: "Fuel, Oil and Lubricants Expenses",
    //       uacsCode: "5-02-03-050"
    //     },
    //     {
    //       sublineItem: "Supplies and Materials Expenses",
    //       accountingTitle: "Semi-Expendable Machinery and Equipment Expenses",
    //       uacsCode: "5-02-03-060"
    //     },
    //     {
    //       sublineItem: "Supplies and Materials Expenses",
    //       accountingTitle: "Textbooks and Instructional Materials Expenses",
    //       uacsCode: "5-02-03-070"
    //     },
    //     {
    //       sublineItem: "Supplies and Materials Expenses",
    //       accountingTitle: "Uniform and Clothing Expenses",
    //       uacsCode: "5-02-03-080"
    //     },
    //     {
    //       sublineItem: "Supplies and Materials Expenses",
    //       accountingTitle: "Drugs and Medicines Expenses",
    //       uacsCode: "5-02-03-090"
    //     },
    //     {
    //       sublineItem: "Supplies and Materials Expenses",
    //       accountingTitle: "Medical, Dental and Laboratory Supplies Expenses",
    //       uacsCode: "5-02-03-100"
    //     },
    //     {
    //       sublineItem: "Supplies and Materials Expenses",
    //       accountingTitle: "Chemical and Filtering Supplies Expenses",
    //       uacsCode: "5-02-03-110"
    //     },
    //     {
    //       sublineItem: "Supplies and Materials Expenses",
    //       accountingTitle: "Agricultural and Marine Supplies Expenses",
    //       uacsCode: "5-02-03-120"
    //     },
    //     {
    //       sublineItem: "Supplies and Materials Expenses",
    //       accountingTitle: "Other Supplies and Materials Expenses",
    //       uacsCode: "5-02-03-990"
    //     },
    //     // 5-02-04 - Utilities Expenses
    //     {
    //       sublineItem: "Utilities Expenses",
    //       accountingTitle: "Water Expenses",
    //       uacsCode: "5-02-04-010"
    //     },
    //     {
    //       sublineItem: "Utilities Expenses",
    //       accountingTitle: "Electricity Expenses",
    //       uacsCode: "5-02-04-020"
    //     },
    //     {
    //       sublineItem: "Utilities Expenses",
    //       accountingTitle: "Gas Expenses",
    //       uacsCode: "5-02-04-030"
    //     },
    //     {
    //       sublineItem: "Utilities Expenses",
    //       accountingTitle: "Other Utilities Expenses",
    //       uacsCode: "5-02-04-990"
    //     },
    //     // 5-02-05 - Communication Expenses
    //     {
    //       sublineItem: "Communication Expenses",
    //       accountingTitle: "Postage and Courier Services",
    //       uacsCode: "5-02-05-010"
    //     },
    //     {
    //       sublineItem: "Communication Expenses",
    //       accountingTitle: "Telephone Expenses",
    //       uacsCode: "5-02-05-020"
    //     },
    //     {
    //       sublineItem: "Communication Expenses",
    //       accountingTitle: "Internet Subscription Expenses",
    //       uacsCode: "5-02-05-030"
    //     },
    //     {
    //       sublineItem: "Communication Expenses",
    //       accountingTitle: "Cable, Satellite, Telegraph and Radio Expenses",
    //       uacsCode: "5-02-05-040"
    //     },
    //     {
    //       sublineItem: "Communication Expenses",
    //       accountingTitle: "Other Communication Expenses",
    //       uacsCode: "5-02-05-990"
    //     },
    //     // 5-02-06 - Awards and Rewards
    //     {
    //       sublineItem: "Awards and Rewards",
    //       accountingTitle: "Awards and Rewards Expenses",
    //       uacsCode: "5-02-06-010"
    //     },
    //     // 5-02-07 - Survey, Research, Exploration and Development Expenses
    //     {
    //       sublineItem: "Survey, Research, Exploration and Development Expenses",
    //       accountingTitle: "Survey Expenses",
    //       uacsCode: "5-02-07-010"
    //     },
    //     {
    //       sublineItem: "Survey, Research, Exploration and Development Expenses",
    //       accountingTitle: "Research Expenses",
    //       uacsCode: "5-02-07-020"
    //     },
    //     {
    //       sublineItem: "Survey, Research, Exploration and Development Expenses",
    //       accountingTitle: "Exploration Expenses",
    //       uacsCode: "5-02-07-030"
    //     },
    //     {
    //       sublineItem: "Survey, Research, Exploration and Development Expenses",
    //       accountingTitle: "Development Expenses",
    //       uacsCode: "5-02-07-040"
    //     },
    //     // 5-02-08 - Demolition and Relocation Expenses
    //     {
    //       sublineItem: "Demolition and Relocation Expenses",
    //       accountingTitle: "Demolition and Relocation Expenses",
    //       uacsCode: "5-02-08-010"
    //     },
    //     // 5-02-09 - Desilting Expenses
    //     {
    //       sublineItem: "Desilting Expenses",
    //       accountingTitle: "Desilting Expenses",
    //       uacsCode: "5-02-09-010"
    //     },
    //     // 5-02-10 - Extraordinary and Miscellaneous Expenses
    //     {
    //       sublineItem: "Extraordinary and Miscellaneous Expenses",
    //       accountingTitle: "Extraordinary and Miscellaneous Expenses",
    //       uacsCode: "5-02-10-010"
    //     },
    //     // 5-02-11 - Professional Services
    //     {
    //       sublineItem: "Professional Services",
    //       accountingTitle: "Auditing Services",
    //       uacsCode: "5-02-11-010"
    //     },
    //     {
    //       sublineItem: "Professional Services",
    //       accountingTitle: "Consultancy Services",
    //       uacsCode: "5-02-11-020"
    //     },
    //     {
    //       sublineItem: "Professional Services",
    //       accountingTitle: "Other Professional Services",
    //       uacsCode: "5-02-11-990"
    //     },
    //     // 5-02-12 - General Services
    //     {
    //       sublineItem: "General Services",
    //       accountingTitle: "Janitorial Services",
    //       uacsCode: "5-02-12-010"
    //     },
    //     {
    //       sublineItem: "General Services",
    //       accountingTitle: "Security Services",
    //       uacsCode: "5-02-12-020"
    //     },
    //     {
    //       sublineItem: "General Services",
    //       accountingTitle: "Other General Services",
    //       uacsCode: "5-02-12-990"
    //     },
    //     // 5-02-13 - Repairs and Maintenance
    //     {
    //       sublineItem: "Repairs and Maintenance",
    //       accountingTitle: "Repairs and Maintenance - Land Improvements",
    //       uacsCode: "5-02-13-010"
    //     },
    //     {
    //       sublineItem: "Repairs and Maintenance",
    //       accountingTitle: "Repairs and Maintenance - Infrastructure Assets",
    //       uacsCode: "5-02-13-020"
    //     },
    //     {
    //       sublineItem: "Repairs and Maintenance",
    //       accountingTitle: "Repairs and Maintenance - Buildings and Other Structures",
    //       uacsCode: "5-02-13-030"
    //     },
    //     {
    //       sublineItem: "Repairs and Maintenance",
    //       accountingTitle: "Repairs and Maintenance - Machinery and Equipment",
    //       uacsCode: "5-02-13-040"
    //     },
    //     {
    //       sublineItem: "Repairs and Maintenance",
    //       accountingTitle: "Repairs and Maintenance - Transportation Equipment",
    //       uacsCode: "5-02-13-050"
    //     },
    //     {
    //       sublineItem: "Repairs and Maintenance",
    //       accountingTitle: "Repairs and Maintenance - Furniture and Fixtures",
    //       uacsCode: "5-02-13-060"
    //     },
    //     {
    //       sublineItem: "Repairs and Maintenance",
    //       accountingTitle: "Repairs and Maintenance - Bio-assets",
    //       uacsCode: "5-02-13-070"
    //     },
    //     // 5-02-14 - Financial Assistance/Subsidy
    //     {
    //       sublineItem: "Financial Assistance/Subsidy",
    //       accountingTitle: "Financial Assistance/Subsidy",
    //       uacsCode: "5-02-14-010"
    //     },
    //     // 5-02-15 - Taxes, Duties and Licenses
    //     {
    //       sublineItem: "Taxes, Duties and Licenses",
    //       accountingTitle: "Taxes, Duties and Licenses",
    //       uacsCode: "5-02-15-010"
    //     },
    //     // 5-02-16 - Fidelity Bond Premiums
    //     {
    //       sublineItem: "Fidelity Bond Premiums",
    //       accountingTitle: "Fidelity Bond Premiums",
    //       uacsCode: "5-02-16-010"
    //     },
    //     // 5-02-17 - Insurance Expenses
    //     {
    //       sublineItem: "Insurance Expenses",
    //       accountingTitle: "Insurance Expenses",
    //       uacsCode: "5-02-17-010"
    //     },
    //     // 5-02-18 - Advertising Expenses
    //     {
    //       sublineItem: "Advertising Expenses",
    //       accountingTitle: "Advertising Expenses",
    //       uacsCode: "5-02-18-010"
    //     },
    //     // 5-02-19 - Printing and Publication Expenses
    //     {
    //       sublineItem: "Printing and Publication Expenses",
    //       accountingTitle: "Printing and Publication Expenses",
    //       uacsCode: "5-02-19-010"
    //     },
    //     // 5-02-20 - Representation Expenses
    //     {
    //       sublineItem: "Representation Expenses",
    //       accountingTitle: "Representation Expenses",
    //       uacsCode: "5-02-20-010"
    //     },
    //     // 5-02-21 - Transportation and Delivery Expenses
    //     {
    //       sublineItem: "Transportation and Delivery Expenses",
    //       accountingTitle: "Transportation and Delivery Expenses",
    //       uacsCode: "5-02-21-010"
    //     },
    //     // 5-02-22 - Rent/Lease Expenses
    //     {
    //       sublineItem: "Rent/Lease Expenses",
    //       accountingTitle: "Rent - Building and Structures",
    //       uacsCode: "5-02-22-010"
    //     },
    //     {
    //       sublineItem: "Rent/Lease Expenses",
    //       accountingTitle: "Rent - Equipment",
    //       uacsCode: "5-02-22-020"
    //     },
    //     {
    //       sublineItem: "Rent/Lease Expenses",
    //       accountingTitle: "Rent - Motor Vehicles",
    //       uacsCode: "5-02-22-030"
    //     },
    //     {
    //       sublineItem: "Rent/Lease Expenses",
    //       accountingTitle: "Other Rent/Lease Expenses",
    //       uacsCode: "5-02-22-990"
    //     },
    //     // 5-02-23 - Membership Dues and Contributions to Organizations
    //     {
    //       sublineItem: "Membership Dues and Contributions to Organizations",
    //       accountingTitle: "Membership Dues and Contributions to Organizations",
    //       uacsCode: "5-02-23-010"
    //     },
    //     // 5-02-24 - Subscription Expenses
    //     {
    //       sublineItem: "Subscription Expenses",
    //       accountingTitle: "Subscription Expenses",
    //       uacsCode: "5-02-24-010"
    //     },
    //     // 5-02-25 - Donations
    //     {
    //       sublineItem: "Donations",
    //       accountingTitle: "Donations",
    //       uacsCode: "5-02-25-010"
    //     },
    //     // 5-02-99 - Other Maintenance and Operating Expenses (Complete List)
    //     {
    //       sublineItem: "Other Maintenance and Operating Expenses",
    //       accountingTitle: "Labor and Wages",
    //       uacsCode: "5-02-99-010"
    //     },
    //     {
    //       sublineItem: "Other Maintenance and Operating Expenses",
    //       accountingTitle: "Honoraria",
    //       uacsCode: "5-02-99-020"
    //     },
    //     {
    //       sublineItem: "Other Maintenance and Operating Expenses",
    //       accountingTitle: "Overtime and Night Pay",
    //       uacsCode: "5-02-99-030"
    //     },
    //     {
    //       sublineItem: "Other Maintenance and Operating Expenses",
    //       accountingTitle: "Hazard Pay",
    //       uacsCode: "5-02-99-040"
    //     },
    //     {
    //       sublineItem: "Other Maintenance and Operating Expenses",
    //       accountingTitle: "Longevity Pay",
    //       uacsCode: "5-02-99-050"
    //     },
    //     {
    //       sublineItem: "Other Maintenance and Operating Expenses",
    //       accountingTitle: "Other Compensation",
    //       uacsCode: "5-02-99-060"
    //     },
    //     {
    //       sublineItem: "Other Maintenance and Operating Expenses",
    //       accountingTitle: "Terminal Leave Benefits",
    //       uacsCode: "5-02-99-070"
    //     },
    //     {
    //       sublineItem: "Other Maintenance and Operating Expenses",
    //       accountingTitle: "Other Personnel Benefits",
    //       uacsCode: "5-02-99-080"
    //     },
    //     {
    //       sublineItem: "Other Maintenance and Operating Expenses",
    //       accountingTitle: "Lump-sum for Creation of New Positions",
    //       uacsCode: "5-02-99-090"
    //     },
    //     {
    //       sublineItem: "Other Maintenance and Operating Expenses",
    //       accountingTitle: "Lump-sum for Reclassification of Positions",
    //       uacsCode: "5-02-99-100"
    //     },
    //     {
    //       sublineItem: "Other Maintenance and Operating Expenses",
    //       accountingTitle: "Lump-sum for Step Increments",
    //       uacsCode: "5-02-99-110"
    //     },
    //     {
    //       sublineItem: "Other Maintenance and Operating Expenses",
    //       accountingTitle: "Lump-sum for Filling of Positions",
    //       uacsCode: "5-02-99-120"
    //     },
    //     {
    //       sublineItem: "Other Maintenance and Operating Expenses",
    //       accountingTitle: "Lump-sum for Equivalent Position",
    //       uacsCode: "5-02-99-130"
    //     },
    //     {
    //       sublineItem: "Other Maintenance and Operating Expenses",
    //       accountingTitle: "Lump-sum for Miscellaneous Personnel Benefits Fund",
    //       uacsCode: "5-02-99-140"
    //     },
    //     {
    //       sublineItem: "Other Maintenance and Operating Expenses",
    //       accountingTitle: "Year-end Bonus",
    //       uacsCode: "5-02-99-150"
    //     },
    //     {
    //       sublineItem: "Other Maintenance and Operating Expenses",
    //       accountingTitle: "Cash Gift",
    //       uacsCode: "5-02-99-160"
    //     },
    //     {
    //       sublineItem: "Other Maintenance and Operating Expenses",
    //       accountingTitle: "Productivity Enhancement Incentive",
    //       uacsCode: "5-02-99-170"
    //     },
    //     {
    //       sublineItem: "Other Maintenance and Operating Expenses",
    //       accountingTitle: "Mid-Year Bonus",
    //       uacsCode: "5-02-99-180"
    //     },
    //     {
    //       sublineItem: "Other Maintenance and Operating Expenses",
    //       accountingTitle: "Collective Negotiation Agreement Incentive",
    //       uacsCode: "5-02-99-190"
    //     },
    //     {
    //       sublineItem: "Other Maintenance and Operating Expenses",
    //       accountingTitle: "Performance-Based Bonus",
    //       uacsCode: "5-02-99-200"
    //     },
    //     {
    //       sublineItem: "Other Maintenance and Operating Expenses",
    //       accountingTitle: "Other Bonuses and Allowances",
    //       uacsCode: "5-02-99-210"
    //     },
    //     {
    //       sublineItem: "Other Maintenance and Operating Expenses",
    //       accountingTitle: "Confidential and Intelligence Expenses",
    //       uacsCode: "5-02-99-220"
    //     },
    //     {
    //       sublineItem: "Other Maintenance and Operating Expenses",
    //       accountingTitle: "Anti-Poverty Programs",
    //       uacsCode: "5-02-99-230"
    //     },
    //     {
    //       sublineItem: "Other Maintenance and Operating Expenses",
    //       accountingTitle: "Disaster Risk Reduction and Management Expenses",
    //       uacsCode: "5-02-99-240"
    //     },
    //     {
    //       sublineItem: "Other Maintenance and Operating Expenses",
    //       accountingTitle: "Contribution to Government Corporations",
    //       uacsCode: "5-02-99-250"
    //     },
    //     {
    //       sublineItem: "Other Maintenance and Operating Expenses",
    //       accountingTitle: "ICT Equipment, Software and Licenses",
    //       uacsCode: "5-02-99-260"
    //     },
    //     {
    //       sublineItem: "Other Maintenance and Operating Expenses",
    //       accountingTitle: "Website Development and Maintenance",
    //       uacsCode: "5-02-99-270"
    //     },
    //     {
    //       sublineItem: "Other Maintenance and Operating Expenses",
    //       accountingTitle: "Bank Charges",
    //       uacsCode: "5-02-99-280"
    //     },
    //     {
    //       sublineItem: "Other Maintenance and Operating Expenses",
    //       accountingTitle: "Commitment Fee",
    //       uacsCode: "5-02-99-290"
    //     },
    //     {
    //       sublineItem: "Other Maintenance and Operating Expenses",
    //       accountingTitle: "Other Maintenance and Operating Expenses",
    //       uacsCode: "5-02-99-990"
    //     },
    //     // 5-02-30 - Financial Expenses
    //     {
    //       sublineItem: "Financial Expenses",
    //       accountingTitle: "Interest Expenses",
    //       uacsCode: "5-02-30-010"
    //     },
    //     {
    //       sublineItem: "Financial Expenses",
    //       accountingTitle: "Bank Charges",
    //       uacsCode: "5-02-30-020"
    //     },
    //     {
    //       sublineItem: "Financial Expenses",
    //       accountingTitle: "Other Financial Expenses",
    //       uacsCode: "5-02-30-990"
    //     },
    //     // IAs O&M Cost entries
    //     {
    //       sublineItem: "Irrigators' Associations (IAs) Operation & Maintenance Cost",
    //       accountingTitle: "National Irrigation System",
    //       uacsCode: "5-02-99-990-NIS"
    //     },
    //     {
    //       sublineItem: "Irrigators' Associations (IAs) Operation & Maintenance Cost",
    //       accountingTitle: "Communal Irrigation System",
    //       uacsCode: "5-02-99-990-CIS"
    //     }
    //   ];
    //   // Debug: Check if Financial Expenses entries are included
    //   const financialExpenses = chartOfAccounts.filter(item => item.sublineItem === 'Financial Expenses');
    // }
    // 3. Compute total COS personnel amount
    const totalPersonnelAmount = cosPersonnels
      .reduce((sum, p) => sum + (p.Total || 0), 0);
    // 4. Build lookup for MOOE amounts
    const mooeMap = Object.fromEntries(
      mooeProposals.map(row => [row.uacsCode, row])
    );
    // 5. Determine submission status
    const status = mooeProposals.length > 0
      ? mooeProposals[0].status || "Draft"
      : "Draft";
    // 6. Assemble entries array, including each proposal's _id as `id`
    const entries = chartOfAccounts.map(row => {
      const proposal = mooeMap[row.uacsCode];
      return {
        id:               proposal?._id?.toString() || null,
        sublineItem:      row.sublineItem,
        accountingTitle:  row.accountingTitle,
        uacsCode:         row.uacsCode,
        income:           proposal?.income?.toString() || "0",
        subsidy:          proposal?.subsidy?.toString() || "0",
        amount:           row.uacsCode === "5-02-99-990"
                          ? totalPersonnelAmount.toString()
                          : (proposal?.amount?.toString() || "0")
      };
    });
    // 7. Return payload
    const response = {
      entries,
      status,
      settings: {
        fiscalYear: activeFiscalYear,
        budgetType: activeSettings.budgetType
      }
    };
    // // // // // // Debug: Check if Financial Expenses entries are in the response
    const financialExpensesInResponse = response.entries.filter(item => item.sublineItem === 'Financial Expenses');
    // // Debug: List all unique subline items in the response
    const uniqueSublineItems = [...new Set(response.entries.map(item => item.sublineItem))];
    
    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching MOOE data', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
// Keep existing endpoints for backward compatibility
exports.getMOOEEntries = async (req, res) => {
  try {
    // 1. Load active settings
    const activeSettings = await Settings.findOne({ isActive: true });
    if (!activeSettings || activeSettings.fiscalYear == null) {
      return res.status(404).json({ error: 'No active fiscal year found' });
    }
    const activeFiscalYear = activeSettings.fiscalYear;
    // 2. Apply hierarchical filtering with submission workflow
    let filter = { fiscalYear: activeFiscalYear };
    
    // Apply sophisticated hierarchical filtering based on user access scope
    const accessScope = req.hierarchicalAccess?.scope;
    const accessibleRegionName = req.hierarchicalAccess?.accessibleRegions?.[0]?.regionName;
    
    // Add region filter based on access scope
    if (!filter.region) {
      if (accessScope && accessScope !== 'FULL' && accessibleRegionName) {
        filter.region = accessibleRegionName;
      }
    }
    
    // Add finer filters based on access scope
    if (accessScope === 'DIVISION') {
      // Division users: only their division within their department and region
      const deptName = req.hierarchicalAccess?.accessibleDepartments?.[0]?.departmentName;
      const divName = req.hierarchicalAccess?.accessibleDivisions?.[0];
      if (deptName) filter.department = deptName;
      if (divName) filter.division = divName;
    } else if (accessScope === 'DEPARTMENT') {
      // Department users: can see their department data + SUBMITTED division data ONLY
      const deptName = req.hierarchicalAccess?.accessibleDepartments?.[0]?.departmentName;
      if (deptName) {
        // CRITICAL SUBMISSION WORKFLOW LOGIC for MOOE
        const baseFilter = {
          department: deptName,
          fiscalYear: activeFiscalYear
        };
        
        // Apply region if available
        if (filter.region) baseFilter.region = filter.region;
        
        filter = {
          $and: [
            baseFilter,
            {
              $or: [
                // 1. Department-level data (no division or by department user)
                {
                  $and: [
                    { $or: [{ division: { $exists: false } }, { division: null }, { division: "" }] }
                  ]
                },
                // 2. Division data that has been SUBMITTED only
                {
                  $and: [
                    { division: { $exists: true, $ne: null, $ne: "" } },
                    { status: { $in: ["Submitted", "Approved", "Completed", "Department Submitted", "Region Verified", "Finalized"] } }
                  ]
                }
              ]
            }
          ]
        };
      }
    } else if (accessScope === 'REGION') {
      // Region-level users should ONLY see submitted department data
      filter.$and = [
        { fiscalYear: activeFiscalYear },
        { region: accessibleRegionName },
        {
          $or: [
            { department: { $exists: false } },
            { department: null },
            { department: "" },
            { 
              $and: [
                { department: { $exists: true, $ne: null, $ne: "" } },
                { status: { $in: ['Department Submitted', 'Region Verified', 'Approved', 'Finalized'] } }
              ]
            }
          ]
        }
      ];
    }
    
    // 3. Fetch COA, MOOE proposals and COS personnel with proper filtering
    const [chartOfAccounts, mooeProposals, cosPersonnels] = await Promise.all([
      ChartOfAccounts.find({
        accountClass: "Expense",
        lineItem:    "Maintenance and Other Operating Expenses"
      }).lean(),
      MooeProposal.find(filter).lean(), // Use filtered query with submission workflow
      COSPersonnel.find({
        statusOfAppointment: "COS",
        fiscalYear: activeFiscalYear
      }).lean()
    ]);
    // 3. Compute total COS personnel amount
    const totalPersonnelAmount = cosPersonnels
      .reduce((sum, p) => sum + (p.Total || 0), 0);
    // 4. Build a lookup for MOOE proposals
    const mooeMap = Object.fromEntries(
      mooeProposals.map(row => [row.uacsCode, row])
    );
    // 5. Assemble the final array with `id`
    const data = chartOfAccounts.map(row => {
      const proposal = mooeMap[row.uacsCode];
      return {
        id:               proposal?._id?.toString() || null,
        sublineItem:      row.sublineItem,
        accountingTitle:  row.accountingTitle,
        uacsCode:         row.uacsCode,
        income:           proposal?.income?.toString() || "0",
        subsidy:          proposal?.subsidy?.toString() || "0",
        amount:           row.uacsCode === "5-02-99-990"
                          ? totalPersonnelAmount.toString()
                          : (proposal?.amount?.toString() || "0")
      };
    });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching MOOE entries', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
// Optimized bulk save for MOOE entries
exports.bulkSaveMOOE = async (req, res) => {
  try {
    const { meta, entries } = req.body;
    
    console.log('📥 MOOE SAVE REQUEST');
    console.log('   Entries received:', entries?.length || 0);
    console.log('   Meta:', meta);
    console.log('   First entry sample:', entries?.[0]);
    
    // Resolve organizational ownership using submission workflow data (preferred)
    const workflowData = req.submissionWorkflowData || {};
    const ownerRegion = meta?.region ?? workflowData.region ?? req.body.region ?? req.user?.Region;
    const ownerDepartment = meta?.department ?? workflowData.department ?? req.body.department ?? null;
    // Division should be cleared for Department-origin records to avoid leaking into division scope
    let ownerDivision = meta?.division ?? workflowData.division ?? req.body.division ?? null;
    if (workflowData.userLevel === 'DEPARTMENT') {
      ownerDivision = null;
    }
    
    console.log('   Resolved ownership:', { ownerRegion, ownerDepartment, ownerDivision });
    // Determine level tagging
    const derivedOriginalLevel = workflowData.userLevel === 'DIVISION'
      ? 'DIVISION'
      : workflowData.userLevel === 'DEPARTMENT'
        ? 'DEPARTMENT'
        : workflowData.userLevel === 'REGION'
          ? 'REGION'
          : undefined;

    const resolveLevel = (preferredValue, fallbackValue) => {
      if (preferredValue !== undefined && preferredValue !== null) {
        return preferredValue;
      }
      if (fallbackValue !== undefined && fallbackValue !== null) {
        return fallbackValue;
      }
      return undefined;
    };

    const recordOriginalLevel = resolveLevel(workflowData.originalLevel ?? meta?.originalLevel ?? req.body.originalLevel, derivedOriginalLevel);
    const recordWorkflowLevel = resolveLevel(workflowData.workflowLevel ?? meta?.workflowLevel ?? req.body.workflowLevel, recordOriginalLevel);
    let processedEntries = [];
    if (entries && Array.isArray(entries)) {
      processedEntries = entries
        .map(item => {
          const hasUacsCode = item.uacsCode;
          if (!hasUacsCode) {
            return null;
          }

          // Derive draft stage tags from workflow level but keep base status as 'Draft' for compatibility
          const inferredDraftStage = (() => {
            if (recordOriginalLevel === 'RESPONSIBILITY_CENTER' || recordWorkflowLevel === 'RESPONSIBILITY_CENTER') {
              return 'RESPONSIBILITY_CENTER';
            }
            if (recordOriginalLevel === 'DIVISION' || recordWorkflowLevel === 'DIVISION') {
              return 'DIVISION';
            }
            if (recordOriginalLevel === 'DEPARTMENT' || recordWorkflowLevel === 'DEPARTMENT') {
              return 'DEPARTMENT';
            }
            if (recordOriginalLevel === 'REGION' || recordWorkflowLevel === 'REGION') {
              return 'REGION';
            }
            return null;
          })();

          const nextStatus = meta?.status || item.status || 'Draft';
          const nextDraftStage = meta?.draftStage || item.draftStage || inferredDraftStage;

          return {
            ...item,
            status: nextStatus,
            draftStage: nextDraftStage,
            originalLevel: item.originalLevel || recordOriginalLevel,
            workflowLevel: item.workflowLevel || recordWorkflowLevel,
            taggedByWorkflow: Boolean(recordOriginalLevel || recordWorkflowLevel)
          };
        })
        .filter(item => item !== null);
    } else if (Array.isArray(req.body)) {
      // Old format support
      processedEntries = req.body.flatMap(parentItem =>
        parentItem.children.filter(item => {
          const hasUacsCode = item.uacsCode;
          const hasIncomeValue = item.income !== null && item.income !== undefined && item.income !== "";
          const hasSubsidyValue = item.subsidy !== null && item.subsidy !== undefined && item.subsidy !== "";
          const hasId = item.id;
          return hasUacsCode && (hasId || hasIncomeValue || hasSubsidyValue);
        })
      );
    }
    console.log('   Processed entries after filtering:', processedEntries.length);
    console.log('   Processed entry sample:', processedEntries?.[0]);
    
    if (!processedEntries.length) {
      console.log('   ⚠️  No entries after processing - returning early');
      return res.status(200).json({ 
        message: 'No entries to save - this is normal if no values were entered',
        matchedCount: 0,
        modifiedCount: 0,
        upsertedCount: 0
      });
    }
    
    // Get the MooeProposal schema to check which fields are allowed
    const mooeProposalSchema = MooeProposal.schema.obj;
    const allowedFields = Object.keys(mooeProposalSchema);
    console.log('   Schema fields:', allowedFields.slice(0, 10), '...');
    
    const bulkOps = processedEntries
      // Only save entries that have actual values, are system entries, or are existing entries (with id)
      .filter(item => {
        const incomeAmount = Number(item.income) || 0;
        const subsidyAmount = Number(item.subsidy) || 0;
        const nisAmount = Number(item.nis) || 0;
        const cisAmount = Number(item.cis) || 0;
        
        // Check if ANY field has meaningful value (> 0)
        const hasAnyValue = incomeAmount > 0 || subsidyAmount > 0 || nisAmount > 0 || cisAmount > 0;
        const isSystemEntry = item.isSystemEntry;
        const hasExistingId = item.id && item.id !== "undefined" && item.id !== "";
        
        // Only keep entries with actual values > 0, system entries, or existing entries
        return hasAnyValue || isSystemEntry || hasExistingId;
      })
      .map(item => {
        // Create a filtered update object with only the fields that exist in the schema
        const updateObj = {};
        
        // Parse amounts and ensure they're numbers
        const incomeVal = Number(item.income) || 0;
        const subsidyVal = Number(item.subsidy) || 0;
        const nisVal = Number(item.nis) || 0;
        const cisVal = Number(item.cis) || 0;
        
        // Only set fields if they have meaningful values
        updateObj.income = incomeVal;
        updateObj.subsidy = subsidyVal;
        updateObj.amount = Number(item.amount) || (incomeVal + subsidyVal);
        updateObj.nis = nisVal;
        updateObj.cis = cisVal;
        updateObj.uacsCode = item.uacsCode;
        updateObj.sublineItem = item.sublineItem;
        updateObj.accountingTitle = item.accountingTitle;
        
        // Add metadata fields - ensure required fields are present
        updateObj.processBy = meta?.processBy || item.processBy || 'System';
        updateObj.processDate = meta?.processDate || item.processDate || new Date();
        updateObj.fiscalYear = meta?.fiscalYear || item.fiscalYear;
        updateObj.budgetType = meta?.budgetType || item.budgetType;
        updateObj.region = ownerRegion || meta?.region || item.region;
        
        // Validate required fields for bulkWrite filter
        if (!updateObj.fiscalYear) {
          console.warn('⚠️  Missing fiscalYear for item:', item.uacsCode);
          updateObj.fiscalYear = 'UNKNOWN'; // Fallback to prevent undefined filter
        }
        if (!updateObj.region) {
          console.warn('⚠️  Missing region for item:', item.uacsCode);
          updateObj.region = 'UNKNOWN'; // Fallback to prevent undefined filter
        }

        const hasExistingId = Boolean(item.id && item.id !== 'undefined' && item.id !== '');
        // Preserve stored department/division unless explicitly supplied or changed when updating
        if (!hasExistingId) {
          updateObj.department = ownerDepartment || meta?.department || item.department;
          updateObj.division = ownerDivision || meta?.division || item.division;
        } else {
          if (meta?.department || item.department) {
            updateObj.department = ownerDepartment || meta?.department || item.department;
          }
          if (meta?.division || item.division) {
            updateObj.division = ownerDivision || meta?.division || item.division;
          }
        }

        // Tag records with origin/workflow levels for consistent visibility rules
        if (!hasExistingId) {
          if (recordOriginalLevel) {
            updateObj.originalLevel = recordOriginalLevel;
          }
          if (recordWorkflowLevel) {
            updateObj.workflowLevel = recordWorkflowLevel;
          }
        } else {
          if (item.originalLevel) {
            updateObj.originalLevel = item.originalLevel;
          }
          if (item.workflowLevel) {
            updateObj.workflowLevel = item.workflowLevel;
          }
        }
        updateObj.status = meta?.status || item.status || "Draft";
        return {
        updateOne: {
          filter: hasExistingId && mongoose.Types.ObjectId.isValid(item.id) ? 
            { _id: new mongoose.Types.ObjectId(item.id) } : // Match by _id for existing records
            { 
              uacsCode: item.uacsCode,
              fiscalYear: updateObj.fiscalYear,
              region: updateObj.region,  // Add region to filter for proper isolation
              $or: [
                { status: { $exists: false } },  // New records
                // Allow editing when in editable states: Draft or Returned (including common variants)
                { status: { $in: [
                  "Draft",
                  "Returned",
                  "Division Draft",
                  "Responsibility Center Draft",
                  "DRAFT",
                  "RETURNED"
                ] } }
              ]
            },
          update: { $set: updateObj },
          upsert: !hasExistingId || !mongoose.Types.ObjectId.isValid(item.id) // Only upsert for new records or invalid IDs
        }
      };
    });
    // Check if any Financial Expenses entries are being saved
    const financialExpensesEntries = processedEntries.filter(item => 
      item.sublineItem === 'Financial Expenses'
    );
    if (financialExpensesEntries.length > 0) {
      // Log Financial Expenses entries
    }
    console.log('   BulkOps array:', bulkOps.length, 'operations');
    if (bulkOps.length > 0) {
      console.log('   First bulkOp sample:');
      console.log('     Filter:', bulkOps[0]?.updateOne?.filter);
      console.log('     Update:', bulkOps[0]?.updateOne?.update);
      console.log('     Upsert:', bulkOps[0]?.updateOne?.upsert);
    } else {
      console.log('   ❌ ERROR: No bulkOps generated - entries will not be saved!');
    }
    
    try {
      const result = await MooeProposal.bulkWrite(bulkOps);
      // Note: bulkWrite can be partially successful - some operations succeed before error occurs
      const operationStats = {
        upsertedCount: result.upsertedCount || 0,
        matchedCount: result.matchedCount || 0,
        modifiedCount: result.modifiedCount || 0,
        deletedCount: result.deletedCount || 0
      };
      
      console.log('✅ MOOE SAVE SUCCESSFUL:', operationStats);
      // Non-blocking: trigger Proposal totals recalculation for affected proposals
      try {
        // Collect unique key combos from processed entries (usually one set)
        const keySet = new Set();
        for (const e of processedEntries) {
          const k = JSON.stringify({
            fiscalYear: e.fiscalYear || meta?.fiscalYear,
            budgetType: e.budgetType || meta?.budgetType,
            region: ownerRegion || e.region || meta?.region,
            processBy: e.processBy || meta?.processBy
          });
          keySet.add(k);
        }

        const keyCombos = Array.from(keySet).map(s => JSON.parse(s));
        for (const keys of keyCombos) {
          if (!keys.fiscalYear || !keys.region) continue;
          // Try strict match first (with processBy if available)
          const strictQuery = {
            fiscalYear: keys.fiscalYear,
            budgetType: keys.budgetType,
            region: keys.region,
            ...(keys.processBy ? { processBy: keys.processBy } : {})
          };
          let proposals = await Proposal.find(strictQuery).select('_id').lean();
          // Fallback: relax processBy if nothing found
          if (!proposals.length) {
            const relaxedQuery = {
              fiscalYear: keys.fiscalYear,
              budgetType: keys.budgetType,
              region: keys.region
            };
            proposals = await Proposal.find(relaxedQuery).select('_id').lean();
          }
          // Trigger recalculation for each matching proposal
          if (proposals.length) {
            await Promise.allSettled(proposals.map(p => recalculateAndSaveProposalTotals({ proposalId: p._id })));
            console.log(`🔄 Recalculated totals for ${proposals.length} proposal(s)`, keys);
          } else {
            console.log('ℹ️ No matching Proposal found for recalculation using keys:', keys);
          }
        }
      } catch (recErr) {
        console.warn('⚠️ Proposal totals recalculation skipped due to error:', recErr?.message);
      }

      res.status(200).json({
        message: 'Bulk save completed',
        success: true,
        stats: operationStats
      });
    } catch (err) {
    console.error('❌ Bulk save encountered an error:', err);
    console.error('❌ Error details:', {
      name: err.name,
      message: err.message,
      code: err.code
    });
    
    // MongoDB errors often have partial success - check if data was persisted
    // This is normal behavior for bulkWrite with mixed operations
    if (err.code === 11000) {
      console.warn('⚠️  DUPLICATE KEY detected - some records may have been saved before this error');
      // Still return 200 since partial save likely succeeded
      res.status(200).json({ 
        message: 'Partial save completed - some records updated, some skipped due to existing entries',
        success: true,
        warning: 'Some MOOE entries were duplicates and were not overwritten',
        code: 'DUPLICATE_KEY_WARNING'
      });
    } else {
      // For other errors, also return 200 since bulkWrite may have partially succeeded
      res.status(200).json({ 
        message: 'Save operation completed with warnings',
        success: true,
        warning: err.message 
      });
    }
  }
  } catch (error) {
    console.error('Error in bulk save MOOE:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
exports.fixDatabaseIndex = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    const collection = db.collection('mooeproposals');
    // Get current indexes
    const indexes = await collection.indexes();
    // Find ALL problematic indexes
    const problematicIndexes = indexes.filter(idx => {
      // Remove old compound index without region
      const isOldCompoundIndex = idx.key && 
        idx.key.uacsCode === 1 && 
        idx.key.fiscalYear === 1 && 
        !idx.key.region;
      // Remove single uacsCode index that's causing conflicts
      const isSingleUacsIndex = idx.key && 
        Object.keys(idx.key).length === 1 && 
        idx.key.uacsCode === 1;
      return isOldCompoundIndex || isSingleUacsIndex;
    });
    let result = { message: 'Database index fix completed' };
    result.droppedIndexes = [];
    if (problematicIndexes.length > 0) {
      for (const idx of problematicIndexes) {
        try {
          await collection.dropIndex(idx.name);
          result.droppedIndexes.push(idx.name);
        } catch (error) {
          // Log error but continue
        }
      }
    } else {
      result.message += ' (no problematic indexes found)';
    }
    // Create new index
    try {
      await collection.createIndex(
        { uacsCode: 1, fiscalYear: 1, region: 1 }, 
        { unique: true, name: 'uacsCode_fiscalYear_region_unique' }
      );
      result.createdIndex = 'uacsCode_fiscalYear_region_unique';
    } catch (error) {
      if (error.code === 85) {
        result.indexStatus = 'already exists';
      } else {
        throw error;
      }
    }
    // Verify final state
    const finalIndexes = await collection.indexes();
    const hasRegionIndex = finalIndexes.some(idx => 
      idx.key && 
      idx.key.uacsCode === 1 && 
      idx.key.fiscalYear === 1 && 
      idx.key.region === 1
    );
    result.hasRegionIndex = hasRegionIndex;
    result.allIndexes = finalIndexes.map(idx => ({ name: idx.name, key: idx.key }));
    res.status(200).json(result);
  } catch (error) {
    console.error('❌ Manual database fix failed:', error);
    res.status(500).json({ 
      error: 'Database fix failed: ' + error.message,
      stack: error.stack 
    });
  }
};
exports.getMOOEStatus = async (req, res) => {
  try {
    const activeSettings = await Settings.findOne({ isActive: true });
    if (!activeSettings) {
      return res.status(404).json({ error: 'No active fiscal year found' });
    }
    const activeFiscalYear = activeSettings.fiscalYear;
    const mooeProposal     = await MooeProposal.findOne({ fiscalYear: activeFiscalYear });
    if (mooeProposal) {
      return res.status(200).json({ status: mooeProposal.status || "Draft" });
    } else {
      return res.status(200).json({ status: "Draft" });
    }
  } catch (error) {
    console.error('Error fetching MOOE Status:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
// get mooe proposal by fiscal year and budget type
exports.getMooeProposalByFiscalYearAndBudgetType = async (req, res) => {
  try {
    const { fiscalYear, budgetType } = req.params;
    const mooeProposal = await MooeProposal.findOne({ fiscalYear, budgetType });
    if (!mooeProposal) {
      return res.status(404).json({ error: 'MOOE proposal not found' });
    }
    return res.status(200).json(mooeProposal);
  } catch (error) {
    console.error('Error fetching MOOE proposal:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
exports.getMooeList = async (req, res) => {
  try {
    // Get region and fiscal year from query parameters
    const region = req.query.region;
    const fiscalYear = req.query.fiscalYear;
    
    // Create filter object - start with submission workflow filters if available
    let filter = {};
    
    // Use submission workflow filters if available (they already include hierarchical filtering)
    if (req.submissionWorkflowFilters) {
      filter = { ...req.submissionWorkflowFilters };
    } else {
      // Fallback to manual hierarchical filtering
      if (req.hierarchicalFilters && req.hierarchicalFilters.region) {
        filter.region = req.hierarchicalFilters.region;
      } else if (region) {
        filter.region = region;
      }
      
      // Apply manual submission workflow logic if hierarchical info available
      if (req.hierarchicalAccessInfo && req.hierarchicalAccessInfo.scope === 'DEPARTMENT') {
        const deptFilters = req.hierarchicalFilters || {};
        
        filter.$and = [
          deptFilters,
          {
            $or: [
              // Department's own MOOE (no division specified)
              {
                $and: [
                  {
                    $or: [
                      { division: { $exists: false } },
                      { division: null },
                      { division: "" }
                    ]
                  }
                ]
              },
              // Division MOOE that has been submitted
              {
                $and: [
                  {
                    division: { $exists: true, $ne: "" }
                  },
                  {
                    status: { $in: ["Submitted", "Approved", "Completed"] }
                  }
                ]
              }
            ]
          }
        ];
      }
    }
    
    // Add fiscal year filter if provided and not already in filters
    if (fiscalYear && !filter.fiscalYear) {
      filter.fiscalYear = fiscalYear;
    }
    
    const mooeProposals = await MooeProposal.find(filter);
    
    res.status(200).json(mooeProposals);
  } catch (error) {
    console.error('Error fetching MOOE list:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
// delete mooe proposal// sa mooeController.js
exports.deleteAllMooeProposals = async (req, res) => {
  try {
    // Get region from query or body
    const region = req.query.region || req.body.region;
    // (opsyonal) batay sa active fiscalYear lang:
    const activeSettings = await Settings.findOne({ isActive: true });
    const fy = activeSettings?.fiscalYear;
    // deleteMany kung gusto mo lahat ng docs, o filtered by fiscalYear at region:
    let filter = fy ? { fiscalYear: fy } : {};
    if (region) {
      filter.region = region;
    }
    const result = await MooeProposal.deleteMany(filter);
    return res
      .status(200)
      .json({ message: `Deleted ${result.deletedCount} MOOE proposals for region: ${region || 'ALL'}.` });
  } catch (error) {
    console.error('Error deleting all MOOE proposals:', error);
    return res
      .status(500)
      .json({ error: 'Internal Server Error' });
  }
};
// Get MOOE by parameters
exports.getMOOEByParams = async (req, res) => {
  try {
    const { proposalId, fiscalYear, budgetType, processBy, region, status, department, division } = req.query;
    const query = {};
    
    // ✅ Primary filter: if proposalId is provided, use it
    if (proposalId) {
      query.proposalId = proposalId;
    } else {
      // Fallback: use individual parameters
      if (fiscalYear) query.fiscalYear = fiscalYear;
      if (budgetType) query.budgetType = budgetType;
      if (processBy) query.processBy = processBy;
      if (region) query.region = region;
      if (status) query.status = status;
      if (department) query.department = department;
      if (division) query.division = division;
    }
    
    const mooe = await MooeProposal.find(query).lean();
    res.status(200).json(mooe);
  } catch (error) {
    console.error("Error fetching MOOE by params:", error);
    res.status(500).json({ message: "Failed to fetch MOOE data" });
  }
};
