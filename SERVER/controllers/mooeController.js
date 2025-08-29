const MooeProposal     = require('../models/mooeProposals');
const ChartOfAccounts  = require('../models/chartOfAccounts');
const EmployeeList     = require('../models/EmployeeList');
const COSPersonnel     = require('../models/COSPersonnel');
const Settings         = require('../models/Settings');

// New combined endpoint to fetch all data at once
exports.getMOOEData = async (req, res) => {
  try {
    console.log('🔧 getMOOEData called');

    // 1. Load active settings
    const activeSettings = await Settings.findOne({ isActive: true });
    // console.log('Active settings found:', activeSettings);

    if (!activeSettings || activeSettings.fiscalYear == null) {
      // console.log('❌ No active fiscal year found');
      return res.status(404).json({ error: 'No active fiscal year found' });
    }
    const activeFiscalYear = activeSettings.fiscalYear;
    // console.log('✅ Active fiscal year:', activeFiscalYear);    // 2. Get region from request or user
    const region = req.query.region || req.user?.Region || req.headers['x-region'];
    // console.log('🌍 Region:', region);

    // 2. Fetch COA, MOOE proposals and COS personnel filtered by fiscal year and region
    // console.log('🔍 Fetching data for region:', region);

    const filter = {
      fiscalYear: activeFiscalYear
    };
    
    if (region) {
      filter.region = region;
    }

    // First, let's check what Chart of Accounts data exists
    const totalCOA = await ChartOfAccounts.countDocuments();
    // console.log('📊 Total Chart of Accounts records:', totalCOA);

    if (totalCOA > 0) {
      const sampleCOA = await ChartOfAccounts.findOne().lean();
      // console.log('📋 Sample COA record:', {
      //   accountClass: sampleCOA.accountClass,
      //   lineItem: sampleCOA.lineItem,
      //   sublineItem: sampleCOA.sublineItem,
      //   uacsCode: sampleCOA.uacsCode
      // });

      // Check different variations
      const expenseCount = await ChartOfAccounts.countDocuments({ accountClass: "Expense" });
      // console.log('💰 Expense records:', expenseCount);

      const mooeCount = await ChartOfAccounts.countDocuments({
        lineItem: { $regex: /maintenance.*operating/i }
      });
      // console.log('🔧 MOOE-like records:', mooeCount);
    }

    // Try to fetch Chart of Accounts, but use fallback if none found
    let chartOfAccounts = [];
    let mooeProposals = [];
    let cosPersonnels = [];

    try {
      const results = await Promise.all([
        ChartOfAccounts.find({
          accountClass: "Expense",
          lineItem:    "Maintenance and Other Operating Expenses"
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
      console.log('✅ Added Financial Expenses and IAs O&M Cost entries to Chart of Accounts data');
      
    } catch (error) {
      console.error('❌ Database query error:', error);
      // Use empty arrays as fallback
      chartOfAccounts = [];
      mooeProposals = [];
      cosPersonnels = [];
    }

    // console.log('📊 Data fetched:');
    // console.log('- Chart of Accounts:', chartOfAccounts.length);
    // console.log('- MOOE Proposals:', mooeProposals.length);
    // console.log('- COS Personnel:', cosPersonnels.length);

    // If no Chart of Accounts, create comprehensive MOOE entries
    if (chartOfAccounts.length === 0) {
      console.log('⚠️ No Chart of Accounts found! Using comprehensive MOOE entries...');

      chartOfAccounts = [
        // 5-02-01 - Traveling Expenses
        {
          sublineItem: "Traveling Expenses",
          accountingTitle: "Traveling Expenses - Local",
          uacsCode: "5-02-01-010"
        },
        {
          sublineItem: "Traveling Expenses",
          accountingTitle: "Traveling Expenses - Foreign",
          uacsCode: "5-02-01-020"
        },

        // 5-02-02 - Training and Scholarship Expenses
        {
          sublineItem: "Training and Scholarship Expenses",
          accountingTitle: "Training Expenses",
          uacsCode: "5-02-02-010"
        },
        {
          sublineItem: "Training and Scholarship Expenses",
          accountingTitle: "Scholarship Grants/Expenses",
          uacsCode: "5-02-02-020"
        },

        // 5-02-03 - Supplies and Materials Expenses
        {
          sublineItem: "Supplies and Materials Expenses",
          accountingTitle: "Office Supplies Expenses",
          uacsCode: "5-02-03-010"
        },
        {
          sublineItem: "Supplies and Materials Expenses",
          accountingTitle: "Accountable Forms Expenses",
          uacsCode: "5-02-03-020"
        },
        {
          sublineItem: "Supplies and Materials Expenses",
          accountingTitle: "Non-Accountable Forms Expenses",
          uacsCode: "5-02-03-030"
        },
        {
          sublineItem: "Supplies and Materials Expenses",
          accountingTitle: "Animal/Zoological Supplies Expenses",
          uacsCode: "5-02-03-040"
        },
        {
          sublineItem: "Supplies and Materials Expenses",
          accountingTitle: "Fuel, Oil and Lubricants Expenses",
          uacsCode: "5-02-03-050"
        },
        {
          sublineItem: "Supplies and Materials Expenses",
          accountingTitle: "Semi-Expendable Machinery and Equipment Expenses",
          uacsCode: "5-02-03-060"
        },
        {
          sublineItem: "Supplies and Materials Expenses",
          accountingTitle: "Textbooks and Instructional Materials Expenses",
          uacsCode: "5-02-03-070"
        },
        {
          sublineItem: "Supplies and Materials Expenses",
          accountingTitle: "Uniform and Clothing Expenses",
          uacsCode: "5-02-03-080"
        },
        {
          sublineItem: "Supplies and Materials Expenses",
          accountingTitle: "Drugs and Medicines Expenses",
          uacsCode: "5-02-03-090"
        },
        {
          sublineItem: "Supplies and Materials Expenses",
          accountingTitle: "Medical, Dental and Laboratory Supplies Expenses",
          uacsCode: "5-02-03-100"
        },
        {
          sublineItem: "Supplies and Materials Expenses",
          accountingTitle: "Chemical and Filtering Supplies Expenses",
          uacsCode: "5-02-03-110"
        },
        {
          sublineItem: "Supplies and Materials Expenses",
          accountingTitle: "Agricultural and Marine Supplies Expenses",
          uacsCode: "5-02-03-120"
        },
        {
          sublineItem: "Supplies and Materials Expenses",
          accountingTitle: "Other Supplies and Materials Expenses",
          uacsCode: "5-02-03-990"
        },

        // 5-02-04 - Utilities Expenses
        {
          sublineItem: "Utilities Expenses",
          accountingTitle: "Water Expenses",
          uacsCode: "5-02-04-010"
        },
        {
          sublineItem: "Utilities Expenses",
          accountingTitle: "Electricity Expenses",
          uacsCode: "5-02-04-020"
        },
        {
          sublineItem: "Utilities Expenses",
          accountingTitle: "Gas Expenses",
          uacsCode: "5-02-04-030"
        },
        {
          sublineItem: "Utilities Expenses",
          accountingTitle: "Other Utilities Expenses",
          uacsCode: "5-02-04-990"
        },

        // 5-02-05 - Communication Expenses
        {
          sublineItem: "Communication Expenses",
          accountingTitle: "Postage and Courier Services",
          uacsCode: "5-02-05-010"
        },
        {
          sublineItem: "Communication Expenses",
          accountingTitle: "Telephone Expenses",
          uacsCode: "5-02-05-020"
        },
        {
          sublineItem: "Communication Expenses",
          accountingTitle: "Internet Subscription Expenses",
          uacsCode: "5-02-05-030"
        },
        {
          sublineItem: "Communication Expenses",
          accountingTitle: "Cable, Satellite, Telegraph and Radio Expenses",
          uacsCode: "5-02-05-040"
        },
        {
          sublineItem: "Communication Expenses",
          accountingTitle: "Other Communication Expenses",
          uacsCode: "5-02-05-990"
        },

        // 5-02-06 - Awards and Rewards
        {
          sublineItem: "Awards and Rewards",
          accountingTitle: "Awards and Rewards Expenses",
          uacsCode: "5-02-06-010"
        },

        // 5-02-07 - Survey, Research, Exploration and Development Expenses
        {
          sublineItem: "Survey, Research, Exploration and Development Expenses",
          accountingTitle: "Survey Expenses",
          uacsCode: "5-02-07-010"
        },
        {
          sublineItem: "Survey, Research, Exploration and Development Expenses",
          accountingTitle: "Research Expenses",
          uacsCode: "5-02-07-020"
        },
        {
          sublineItem: "Survey, Research, Exploration and Development Expenses",
          accountingTitle: "Exploration Expenses",
          uacsCode: "5-02-07-030"
        },
        {
          sublineItem: "Survey, Research, Exploration and Development Expenses",
          accountingTitle: "Development Expenses",
          uacsCode: "5-02-07-040"
        },

        // 5-02-08 - Demolition and Relocation Expenses
        {
          sublineItem: "Demolition and Relocation Expenses",
          accountingTitle: "Demolition and Relocation Expenses",
          uacsCode: "5-02-08-010"
        },

        // 5-02-09 - Desilting Expenses
        {
          sublineItem: "Desilting Expenses",
          accountingTitle: "Desilting Expenses",
          uacsCode: "5-02-09-010"
        },

        // 5-02-10 - Extraordinary and Miscellaneous Expenses
        {
          sublineItem: "Extraordinary and Miscellaneous Expenses",
          accountingTitle: "Extraordinary and Miscellaneous Expenses",
          uacsCode: "5-02-10-010"
        },

        // 5-02-11 - Professional Services
        {
          sublineItem: "Professional Services",
          accountingTitle: "Auditing Services",
          uacsCode: "5-02-11-010"
        },
        {
          sublineItem: "Professional Services",
          accountingTitle: "Consultancy Services",
          uacsCode: "5-02-11-020"
        },
        {
          sublineItem: "Professional Services",
          accountingTitle: "Other Professional Services",
          uacsCode: "5-02-11-990"
        },

        // 5-02-12 - General Services
        {
          sublineItem: "General Services",
          accountingTitle: "Janitorial Services",
          uacsCode: "5-02-12-010"
        },
        {
          sublineItem: "General Services",
          accountingTitle: "Security Services",
          uacsCode: "5-02-12-020"
        },
        {
          sublineItem: "General Services",
          accountingTitle: "Other General Services",
          uacsCode: "5-02-12-990"
        },

        // 5-02-13 - Repairs and Maintenance
        {
          sublineItem: "Repairs and Maintenance",
          accountingTitle: "Repairs and Maintenance - Land Improvements",
          uacsCode: "5-02-13-010"
        },
        {
          sublineItem: "Repairs and Maintenance",
          accountingTitle: "Repairs and Maintenance - Infrastructure Assets",
          uacsCode: "5-02-13-020"
        },
        {
          sublineItem: "Repairs and Maintenance",
          accountingTitle: "Repairs and Maintenance - Buildings and Other Structures",
          uacsCode: "5-02-13-030"
        },
        {
          sublineItem: "Repairs and Maintenance",
          accountingTitle: "Repairs and Maintenance - Machinery and Equipment",
          uacsCode: "5-02-13-040"
        },
        {
          sublineItem: "Repairs and Maintenance",
          accountingTitle: "Repairs and Maintenance - Transportation Equipment",
          uacsCode: "5-02-13-050"
        },
        {
          sublineItem: "Repairs and Maintenance",
          accountingTitle: "Repairs and Maintenance - Furniture and Fixtures",
          uacsCode: "5-02-13-060"
        },
        {
          sublineItem: "Repairs and Maintenance",
          accountingTitle: "Repairs and Maintenance - Bio-assets",
          uacsCode: "5-02-13-070"
        },

        // 5-02-14 - Financial Assistance/Subsidy
        {
          sublineItem: "Financial Assistance/Subsidy",
          accountingTitle: "Financial Assistance/Subsidy",
          uacsCode: "5-02-14-010"
        },

        // 5-02-15 - Taxes, Duties and Licenses
        {
          sublineItem: "Taxes, Duties and Licenses",
          accountingTitle: "Taxes, Duties and Licenses",
          uacsCode: "5-02-15-010"
        },





        // 5-02-16 - Fidelity Bond Premiums
        {
          sublineItem: "Fidelity Bond Premiums",
          accountingTitle: "Fidelity Bond Premiums",
          uacsCode: "5-02-16-010"
        },


        // 5-02-17 - Insurance Expenses
        {
          sublineItem: "Insurance Expenses",
          accountingTitle: "Insurance Expenses",
          uacsCode: "5-02-17-010"
        },

        // 5-02-18 - Advertising Expenses
        {
          sublineItem: "Advertising Expenses",
          accountingTitle: "Advertising Expenses",
          uacsCode: "5-02-18-010"
        },

        // 5-02-19 - Printing and Publication Expenses
        {
          sublineItem: "Printing and Publication Expenses",
          accountingTitle: "Printing and Publication Expenses",
          uacsCode: "5-02-19-010"
        },

        // 5-02-20 - Representation Expenses
        {
          sublineItem: "Representation Expenses",
          accountingTitle: "Representation Expenses",
          uacsCode: "5-02-20-010"
        },

        // 5-02-21 - Transportation and Delivery Expenses
        {
          sublineItem: "Transportation and Delivery Expenses",
          accountingTitle: "Transportation and Delivery Expenses",
          uacsCode: "5-02-21-010"
        },

        // 5-02-22 - Rent/Lease Expenses
        {
          sublineItem: "Rent/Lease Expenses",
          accountingTitle: "Rent - Building and Structures",
          uacsCode: "5-02-22-010"
        },
        {
          sublineItem: "Rent/Lease Expenses",
          accountingTitle: "Rent - Equipment",
          uacsCode: "5-02-22-020"
        },
        {
          sublineItem: "Rent/Lease Expenses",
          accountingTitle: "Rent - Motor Vehicles",
          uacsCode: "5-02-22-030"
        },
        {
          sublineItem: "Rent/Lease Expenses",
          accountingTitle: "Other Rent/Lease Expenses",
          uacsCode: "5-02-22-990"
        },

        // 5-02-23 - Membership Dues and Contributions to Organizations
        {
          sublineItem: "Membership Dues and Contributions to Organizations",
          accountingTitle: "Membership Dues and Contributions to Organizations",
          uacsCode: "5-02-23-010"
        },

        // 5-02-24 - Subscription Expenses
        {
          sublineItem: "Subscription Expenses",
          accountingTitle: "Subscription Expenses",
          uacsCode: "5-02-24-010"
        },

        // 5-02-25 - Donations
        {
          sublineItem: "Donations",
          accountingTitle: "Donations",
          uacsCode: "5-02-25-010"
        },

        // 5-02-99 - Other Maintenance and Operating Expenses (Complete List)
        {
          sublineItem: "Other Maintenance and Operating Expenses",
          accountingTitle: "Labor and Wages",
          uacsCode: "5-02-99-010"
        },
        {
          sublineItem: "Other Maintenance and Operating Expenses",
          accountingTitle: "Honoraria",
          uacsCode: "5-02-99-020"
        },
        {
          sublineItem: "Other Maintenance and Operating Expenses",
          accountingTitle: "Overtime and Night Pay",
          uacsCode: "5-02-99-030"
        },
        {
          sublineItem: "Other Maintenance and Operating Expenses",
          accountingTitle: "Hazard Pay",
          uacsCode: "5-02-99-040"
        },
        {
          sublineItem: "Other Maintenance and Operating Expenses",
          accountingTitle: "Longevity Pay",
          uacsCode: "5-02-99-050"
        },
        {
          sublineItem: "Other Maintenance and Operating Expenses",
          accountingTitle: "Other Compensation",
          uacsCode: "5-02-99-060"
        },
        {
          sublineItem: "Other Maintenance and Operating Expenses",
          accountingTitle: "Terminal Leave Benefits",
          uacsCode: "5-02-99-070"
        },
        {
          sublineItem: "Other Maintenance and Operating Expenses",
          accountingTitle: "Other Personnel Benefits",
          uacsCode: "5-02-99-080"
        },
        {
          sublineItem: "Other Maintenance and Operating Expenses",
          accountingTitle: "Lump-sum for Creation of New Positions",
          uacsCode: "5-02-99-090"
        },
        {
          sublineItem: "Other Maintenance and Operating Expenses",
          accountingTitle: "Lump-sum for Reclassification of Positions",
          uacsCode: "5-02-99-100"
        },
        {
          sublineItem: "Other Maintenance and Operating Expenses",
          accountingTitle: "Lump-sum for Step Increments",
          uacsCode: "5-02-99-110"
        },
        {
          sublineItem: "Other Maintenance and Operating Expenses",
          accountingTitle: "Lump-sum for Filling of Positions",
          uacsCode: "5-02-99-120"
        },
        {
          sublineItem: "Other Maintenance and Operating Expenses",
          accountingTitle: "Lump-sum for Equivalent Position",
          uacsCode: "5-02-99-130"
        },
        {
          sublineItem: "Other Maintenance and Operating Expenses",
          accountingTitle: "Lump-sum for Miscellaneous Personnel Benefits Fund",
          uacsCode: "5-02-99-140"
        },
        {
          sublineItem: "Other Maintenance and Operating Expenses",
          accountingTitle: "Year-end Bonus",
          uacsCode: "5-02-99-150"
        },
        {
          sublineItem: "Other Maintenance and Operating Expenses",
          accountingTitle: "Cash Gift",
          uacsCode: "5-02-99-160"
        },
        {
          sublineItem: "Other Maintenance and Operating Expenses",
          accountingTitle: "Productivity Enhancement Incentive",
          uacsCode: "5-02-99-170"
        },
        {
          sublineItem: "Other Maintenance and Operating Expenses",
          accountingTitle: "Mid-Year Bonus",
          uacsCode: "5-02-99-180"
        },
        {
          sublineItem: "Other Maintenance and Operating Expenses",
          accountingTitle: "Collective Negotiation Agreement Incentive",
          uacsCode: "5-02-99-190"
        },
        {
          sublineItem: "Other Maintenance and Operating Expenses",
          accountingTitle: "Performance-Based Bonus",
          uacsCode: "5-02-99-200"
        },
        {
          sublineItem: "Other Maintenance and Operating Expenses",
          accountingTitle: "Other Bonuses and Allowances",
          uacsCode: "5-02-99-210"
        },
        {
          sublineItem: "Other Maintenance and Operating Expenses",
          accountingTitle: "Confidential and Intelligence Expenses",
          uacsCode: "5-02-99-220"
        },
        {
          sublineItem: "Other Maintenance and Operating Expenses",
          accountingTitle: "Anti-Poverty Programs",
          uacsCode: "5-02-99-230"
        },
        {
          sublineItem: "Other Maintenance and Operating Expenses",
          accountingTitle: "Disaster Risk Reduction and Management Expenses",
          uacsCode: "5-02-99-240"
        },
        {
          sublineItem: "Other Maintenance and Operating Expenses",
          accountingTitle: "Contribution to Government Corporations",
          uacsCode: "5-02-99-250"
        },
        {
          sublineItem: "Other Maintenance and Operating Expenses",
          accountingTitle: "ICT Equipment, Software and Licenses",
          uacsCode: "5-02-99-260"
        },
        {
          sublineItem: "Other Maintenance and Operating Expenses",
          accountingTitle: "Website Development and Maintenance",
          uacsCode: "5-02-99-270"
        },
        {
          sublineItem: "Other Maintenance and Operating Expenses",
          accountingTitle: "Bank Charges",
          uacsCode: "5-02-99-280"
        },
        {
          sublineItem: "Other Maintenance and Operating Expenses",
          accountingTitle: "Commitment Fee",
          uacsCode: "5-02-99-290"
        },
        {
          sublineItem: "Other Maintenance and Operating Expenses",
          accountingTitle: "Other Maintenance and Operating Expenses",
          uacsCode: "5-02-99-990"
        },

        // 5-02-30 - Financial Expenses
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
        },

        // IAs O&M Cost entries
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

      console.log('✅ Using', chartOfAccounts.length, 'comprehensive MOOE entries - COMPLETE!');
    
    // Debug: Check if Financial Expenses entries are included
    const financialExpenses = chartOfAccounts.filter(item => item.sublineItem === 'Financial Expenses');
    // console.log('Financial Expenses entries:', financialExpenses.length);
    }

    // 3. Compute total COS personnel amount
    const totalPersonnelAmount = cosPersonnels
      .reduce((sum, p) => sum + (p.Total || 0), 0);

    // 4. Build lookup for MOOE amounts
    const mooeMap = Object.fromEntries(
      mooeProposals.map(row => [row.uacsCode, row])
    );

    // 5. Determine submission status
    const status = mooeProposals.length > 0
      ? mooeProposals[0].status
      : "Not Submitted";

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

    // console.log('📤 Sending response:');
    // console.log('- Entries count:', response.entries.length);
    // console.log('- Status:', response.status);
    // console.log('- Settings:', response.settings);
    // console.log('- Sample entry:', response.entries[0]);

    // Debug: Check if Financial Expenses entries are in the response
    const financialExpensesInResponse = response.entries.filter(item => item.sublineItem === 'Financial Expenses');
    // console.log('Financial Expenses in response:', financialExpensesInResponse.length);

    // Debug: List all unique subline items in the response
    const uniqueSublineItems = [...new Set(response.entries.map(item => item.sublineItem))];
    // console.log('Unique subline items in response:', uniqueSublineItems);

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

    // 2. Fetch COA, MOOE proposals and COS personnel
    const [chartOfAccounts, mooeProposals, cosPersonnels] = await Promise.all([
      ChartOfAccounts.find({
        accountClass: "Expense",
        lineItem:    "Maintenance and Other Operating Expenses"
      }).lean(),

      MooeProposal.find({ fiscalYear: activeFiscalYear }).lean(),

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
    console.log('🔧 bulkSaveMOOE called');
    // console.log('📦 Request body:', JSON.stringify(req.body, null, 2));

    const { meta, entries } = req.body;

    // console.log('📋 Meta:', meta);
    // console.log('📊 Entries count:', entries ? entries.length : 'No entries');

    let processedEntries = [];
    if (entries && Array.isArray(entries)) {
      // Only include entries with a valid UACS code that have actual values > 0
      processedEntries = entries.filter(item => {
        const hasUacsCode = item.uacsCode;
        const incomeValue = Number(item.income) || 0;
        const subsidyValue = Number(item.subsidy) || 0;
        const hasActualValues = incomeValue > 0 || subsidyValue > 0;
        const hasExistingId = item.id && item.id !== "undefined" && item.id !== "";
        const isSystemEntry = item.isSystemEntry;

        console.log(`Entry check: ${item.uacsCode} - hasUacsCode: ${hasUacsCode}, income: ${incomeValue}, subsidy: ${subsidyValue}, hasActualValues: ${hasActualValues}, hasExistingId: ${hasExistingId}, isSystemEntry: ${isSystemEntry}`);

        // Only save if it has actual values > 0 OR it's an existing record with ID OR it's a system entry
        return hasUacsCode && (hasActualValues || hasExistingId || isSystemEntry);
      });

      console.log(`Processing ${processedEntries.length} entries out of ${entries.length} total entries`);
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

    if (!processedEntries.length) {
      console.log('ℹ️ No valid entries to save - all entries filtered out (this is normal if no values were entered)');
      console.log('📋 Sample of original entries:', entries ? entries.slice(0, 3) : 'No entries');
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
    
    console.log('Allowed fields in schema:', allowedFields);    const bulkOps = processedEntries
      // Only save entries that have actual values, are system entries, or are existing entries (with id)
      .filter(item => {
        const totalAmount = (Number(item.income) || 0) +
                          (Number(item.subsidy) || 0) +
                          (Number(item.nis) || 0) +
                          (Number(item.cis) || 0);
        const isSystemEntry = item.isSystemEntry;
        const hasExistingId = item.id && item.id !== "undefined" && item.id !== "";
        // Keep if may value, system entry, or existing entry (kahit zero na)
        return totalAmount > 0 || isSystemEntry || hasExistingId;
      })
      .map(item => {
        // Create a filtered update object with only the fields that exist in the schema
        const updateObj = {};
        
        // Always include these core fields
        updateObj.income = Number(item.income) || 0;
        updateObj.subsidy = Number(item.subsidy) || 0;
        updateObj.amount = Number(item.amount) || (Number(item.income) || 0) + (Number(item.subsidy) || 0);
        updateObj.nis = Number(item.nis) || 0;
        updateObj.cis = Number(item.cis) || 0;
        updateObj.uacsCode = item.uacsCode;
        updateObj.sublineItem = item.sublineItem;
        updateObj.accountingTitle = item.accountingTitle;

        console.log(`Preparing update for ${item.uacsCode} in region [${meta?.region || item.region}]: income=${updateObj.income}, subsidy=${updateObj.subsidy}, amount=${updateObj.amount}`);
        
        // Add metadata fields
        updateObj.processBy = meta?.processBy || item.processBy;
        updateObj.processDate = meta?.processDate || item.processDate || new Date();
        updateObj.fiscalYear = meta?.fiscalYear || item.fiscalYear;
        updateObj.budgetType = meta?.budgetType || item.budgetType;
        updateObj.region = meta?.region || item.region;
        updateObj.status = meta?.status || item.status;

        console.log(`Filter will use: uacsCode=${item.uacsCode}, fiscalYear=${updateObj.fiscalYear}, region=${updateObj.region}`);
      
      return {
        updateOne: {
          filter: { 
            uacsCode: item.uacsCode,
            fiscalYear: updateObj.fiscalYear,
            region: updateObj.region  // Add region to filter for proper isolation
          },
          update: { $set: updateObj },
          upsert: true
        }
      };
    });

    // Check if any Financial Expenses entries are being saved
    const financialExpensesEntries = processedEntries.filter(item => 
      item.sublineItem === 'Financial Expenses'
    );
    
    if (financialExpensesEntries.length > 0) {
      // console.log('Saving Financial Expenses entries:', financialExpensesEntries);
    }
    
    const result = await MooeProposal.bulkWrite(bulkOps);
    console.log('Bulk write result:', {
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      upsertedCount: result.upsertedCount
    });
    
    res.status(200).json({
      message: 'Bulk save successful'
    });
  } catch (err) {
    console.error('❌ Bulk save failed:', err);
    console.error('❌ Error stack:', err.stack);
    console.error('❌ Error details:', {
      name: err.name,
      message: err.message,
      code: err.code
    });
    
    // Handle MongoDB duplicate key error (code 11000)
    if (err.code === 11000) {
      console.error('❌ DUPLICATE KEY ERROR - This is caused by old database index');
      console.error('🔧 SOLUTION: Run the fix script: node fixDatabaseIndex.js');
      console.error('🔧 OR restart your Node.js server to auto-create new index');
      
      res.status(500).json({ 
        error: 'Database index conflict - same UACS code already exists for this fiscal year. Please run fixDatabaseIndex.js script to resolve.',
        code: 'DUPLICATE_KEY_ERROR',
        solution: 'Run: node fixDatabaseIndex.js'
      });
    } else {
      res.status(500).json({ error: 'Bulk save failed: ' + err.message });
    }
  }
};

exports.fixDatabaseIndex = async (req, res) => {
  try {
    console.log('🔧 MANUAL DATABASE INDEX FIX REQUESTED');
    
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    const collection = db.collection('mooeproposals');
    
    // Get current indexes
    const indexes = await collection.indexes();
    console.log('Current indexes:', indexes.map(idx => ({ name: idx.name, key: idx.key })));
    
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
      console.log('🗑️ Found problematic indexes:', problematicIndexes.map(idx => idx.name));
      
      for (const idx of problematicIndexes) {
        try {
          await collection.dropIndex(idx.name);
          console.log('✅ Dropped problematic index:', idx.name);
          result.droppedIndexes.push(idx.name);
        } catch (error) {
          console.log('⚠️ Could not drop index:', idx.name, error.message);
        }
      }
    } else {
      console.log('ℹ️ No problematic indexes found');
      result.message += ' (no problematic indexes found)';
    }
    
    // Create new index
    try {
      await collection.createIndex(
        { uacsCode: 1, fiscalYear: 1, region: 1 }, 
        { unique: true, name: 'uacsCode_fiscalYear_region_unique' }
      );
      console.log('✅ Created new region-aware index');
      result.createdIndex = 'uacsCode_fiscalYear_region_unique';
    } catch (error) {
      if (error.code === 85) {
        console.log('ℹ️ Index already exists');
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
    
    console.log('🎉 DATABASE INDEX FIX COMPLETE:', result);
    
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
      return res.status(200).json({ status: mooeProposal.status });
    } else {
      return res.status(200).json({ status: "Not Submitted" });
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
    
    // Create filter object
    const filter = {};
    
    // Add region filter if provided
    if (region) {
      filter.region = region;
    }
    
    // Add fiscal year filter if provided
    if (fiscalYear) {
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
