const Personnel = require('../models/personnelServices');
const MOOE = require('../models/mooeProposals');
const CapitalOutlay = require('../models/CapitalOutlay');
const Income = require('../models/Income');
const BudgetarySupport = require('../models/BudgetarySupport');

exports.getAllUserProposals = async (req, res) => {
  try {
    // Get the user's name and region from the query parameters
    const { processBy, region } = req.query;
    
    if (!processBy) {
      return res.status(400).json({ message: "processBy parameter is required" });
    }
    
    // CRITICAL: Region is REQUIRED for all proposal queries to prevent data leakage
    if (!region) {
      console.error("No region specified - cannot show proposals without region filter");
      return res.status(400).json({ 
        message: "Region filter is required to view proposals",
        error: "REGION_REQUIRED"
      });
    }
    
    console.log(`Fetching proposals for user: ${processBy}, region: ${region}`);
    
    // Create query that ALWAYS includes region filter
    const query = { 
      processBy,
      region  // ALWAYS enforce region filter
    };
    
    // Create a separate query specifically for draft items
    // This is a double-check to ensure drafts are strictly filtered by region
    const draftQuery = {
      processBy,
      region,
      status: "Draft"
    };
    
    console.log(`Using strict region filter for drafts: ${region}`);
    
    // Fetch all data with separate queries for draft and non-draft items
    // This ensures drafts are strictly filtered by region
    const [
      personnelDrafts, personnelNonDrafts,
      mooeDrafts, mooeNonDrafts,
      capitalOutlayDrafts, capitalOutlayNonDrafts,
      incomeDrafts, incomeNonDrafts,
      budgetarySupportDrafts, budgetarySupportNonDrafts
    ] = await Promise.all([
      // Draft items with strict region filtering
      Personnel.find({ ...draftQuery }).sort({ updatedAt: -1 }),
      Personnel.find({ ...query, status: { $ne: "Draft" } }).sort({ updatedAt: -1 }),
      
      MOOE.find({ ...draftQuery }).sort({ updatedAt: -1 }),
      MOOE.find({ ...query, status: { $ne: "Draft" } }).sort({ updatedAt: -1 }),
      
      CapitalOutlay.find({ ...draftQuery }).sort({ updatedAt: -1 }),
      CapitalOutlay.find({ ...query, status: { $ne: "Draft" } }).sort({ updatedAt: -1 }),
      
      Income.find({ ...draftQuery }).sort({ updatedAt: -1 }),
      Income.find({ ...query, status: { $ne: "Draft" } }).sort({ updatedAt: -1 }),
      
      BudgetarySupport.find({ ...draftQuery }).sort({ updatedAt: -1 }),
      BudgetarySupport.find({ ...query, status: { $ne: "Draft" } }).sort({ updatedAt: -1 })
    ]);
    
    // Combine draft and non-draft items
    const personnel = [...personnelDrafts, ...personnelNonDrafts];
    const mooe = [...mooeDrafts, ...mooeNonDrafts];
    const capitalOutlay = [...capitalOutlayDrafts, ...capitalOutlayNonDrafts];
    const income = [...incomeDrafts, ...incomeNonDrafts];
    const budgetarySupport = [...budgetarySupportDrafts, ...budgetarySupportNonDrafts];
    
    // Log the results
    console.log(`Found ${personnel.length} personnel services entries for region ${region}`);
    // console.log(`Found ${mooe.length} MOOE entries for region ${region}`);
    console.log(`Found ${capitalOutlay.length} capital outlay entries for region ${region}`);
    console.log(`Found ${income.length} income entries for region ${region}`);
    console.log(`Found ${budgetarySupport.length} budgetary support entries for region ${region}`);
    
    // Log the results with separate counts for draft items
    console.log(`Found ${personnelDrafts.length} draft and ${personnelNonDrafts.length} non-draft personnel services entries for region ${region}`);
    console.log(`Found ${mooeDrafts.length} draft and ${mooeNonDrafts.length} non-draft MOOE entries for region ${region}`);
    console.log(`Found ${capitalOutlayDrafts.length} draft and ${capitalOutlayNonDrafts.length} non-draft capital outlay entries for region ${region}`);
    console.log(`Found ${incomeDrafts.length} draft and ${incomeNonDrafts.length} non-draft income entries for region ${region}`);
    console.log(`Found ${budgetarySupportDrafts.length} draft and ${budgetarySupportNonDrafts.length} non-draft budgetary support entries for region ${region}`);
    
    // Double-check that all draft items have the correct region
    const allDrafts = [
      ...personnelDrafts, 
      ...mooeDrafts, 
      ...capitalOutlayDrafts, 
      ...incomeDrafts, 
      ...budgetarySupportDrafts
    ];
    
    const wrongRegionDrafts = allDrafts.filter(item => item.region !== region);
    if (wrongRegionDrafts.length > 0) {
      console.error(`WARNING: Found ${wrongRegionDrafts.length} draft items with incorrect region!`);
      console.error(`These items should have region ${region} but have different regions:`, 
        wrongRegionDrafts.map(item => ({ id: item._id, region: item.region }))
      );
    } else {
      console.log(`✅ All ${allDrafts.length} draft items have the correct region: ${region}`);
    }
    
    res.status(200).json({
      personnel,
      mooe,
      capitalOutlay,
      income,
      budgetarySupport,
      filters: { region, processBy } // Include the filters used in the response
    });
  } catch (error) {
    console.error("Error fetching all user proposals:", error);
    res.status(500).json({ message: "Failed to fetch proposals" });
  }
};

