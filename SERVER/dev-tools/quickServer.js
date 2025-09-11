// Quick server to test MOOE fix
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 5005;
// Middleware
app.use(cors({
  origin: ['http://localhost:3005', 'https://localhost:3005'],
  credentials: true
}));
app.use(express.json());
// Test endpoint
app.get('/test', (req, res) => {
  res.json({ message: 'Server is working!' });
});
// MOOE data endpoint with hardcoded data
app.get('/mooe-data', (req, res) => {
  try {
    // Comprehensive MOOE Chart of Accounts entries
    const chartOfAccounts = [
      // Traveling Expenses
      { sublineItem: "Traveling Expenses", accountingTitle: "Traveling Expenses - Local", uacsCode: "5-02-01-010" },
      { sublineItem: "Traveling Expenses", accountingTitle: "Traveling Expenses - Foreign", uacsCode: "5-02-01-020" },
      // Training and Scholarship Expenses
      { sublineItem: "Training and Scholarship Expenses", accountingTitle: "Training Expenses", uacsCode: "5-02-02-010" },
      { sublineItem: "Training and Scholarship Expenses", accountingTitle: "Scholarship Grants/Expenses", uacsCode: "5-02-02-020" },
      // Supplies and Materials Expenses
      { sublineItem: "Supplies and Materials Expenses", accountingTitle: "Office Supplies Expenses", uacsCode: "5-02-03-010" },
      { sublineItem: "Supplies and Materials Expenses", accountingTitle: "Accountable Forms Expenses", uacsCode: "5-02-03-020" },
      { sublineItem: "Supplies and Materials Expenses", accountingTitle: "Non-Accountable Forms Expenses", uacsCode: "5-02-03-030" },
      { sublineItem: "Supplies and Materials Expenses", accountingTitle: "Fuel, Oil and Lubricants Expenses", uacsCode: "5-02-03-050" },
      { sublineItem: "Supplies and Materials Expenses", accountingTitle: "Semi-Expendable Machinery and Equipment Expenses", uacsCode: "5-02-03-060" },
      { sublineItem: "Supplies and Materials Expenses", accountingTitle: "Textbooks and Instructional Materials Expenses", uacsCode: "5-02-03-070" },
      { sublineItem: "Supplies and Materials Expenses", accountingTitle: "Uniform and Clothing Expenses", uacsCode: "5-02-03-080" },
      { sublineItem: "Supplies and Materials Expenses", accountingTitle: "Drugs and Medicines Expenses", uacsCode: "5-02-03-090" },
      { sublineItem: "Supplies and Materials Expenses", accountingTitle: "Medical, Dental and Laboratory Supplies Expenses", uacsCode: "5-02-03-100" },
      { sublineItem: "Supplies and Materials Expenses", accountingTitle: "Chemical and Filtering Supplies Expenses", uacsCode: "5-02-03-110" },
      { sublineItem: "Supplies and Materials Expenses", accountingTitle: "Agricultural and Marine Supplies Expenses", uacsCode: "5-02-03-120" },
      { sublineItem: "Supplies and Materials Expenses", accountingTitle: "Other Supplies and Materials Expenses", uacsCode: "5-02-03-990" },
      // Utilities Expenses
      { sublineItem: "Utilities Expenses", accountingTitle: "Water Expenses", uacsCode: "5-02-04-010" },
      { sublineItem: "Utilities Expenses", accountingTitle: "Electricity Expenses", uacsCode: "5-02-04-020" },
      { sublineItem: "Utilities Expenses", accountingTitle: "Gas Expenses", uacsCode: "5-02-04-030" },
      { sublineItem: "Utilities Expenses", accountingTitle: "Other Utilities Expenses", uacsCode: "5-02-04-990" },
      // Communication Expenses
      { sublineItem: "Communication Expenses", accountingTitle: "Postage and Courier Services", uacsCode: "5-02-05-010" },
      { sublineItem: "Communication Expenses", accountingTitle: "Telephone Expenses", uacsCode: "5-02-05-020" },
      { sublineItem: "Communication Expenses", accountingTitle: "Internet Subscription Expenses", uacsCode: "5-02-05-030" },
      { sublineItem: "Communication Expenses", accountingTitle: "Cable, Satellite, Telegraph and Radio Expenses", uacsCode: "5-02-05-040" },
      { sublineItem: "Communication Expenses", accountingTitle: "Other Communication Expenses", uacsCode: "5-02-05-990" },
      // Professional Services
      { sublineItem: "Professional Services", accountingTitle: "Auditing Services", uacsCode: "5-02-11-010" },
      { sublineItem: "Professional Services", accountingTitle: "Consultancy Services", uacsCode: "5-02-11-020" },
      { sublineItem: "Professional Services", accountingTitle: "Other Professional Services", uacsCode: "5-02-11-990" },
      // General Services
      { sublineItem: "General Services", accountingTitle: "Janitorial Services", uacsCode: "5-02-12-010" },
      { sublineItem: "General Services", accountingTitle: "Security Services", uacsCode: "5-02-12-020" },
      { sublineItem: "General Services", accountingTitle: "Other General Services", uacsCode: "5-02-12-990" },
      // Repairs and Maintenance
      { sublineItem: "Repairs and Maintenance", accountingTitle: "Repairs and Maintenance - Land Improvements", uacsCode: "5-02-13-010" },
      { sublineItem: "Repairs and Maintenance", accountingTitle: "Repairs and Maintenance - Infrastructure Assets", uacsCode: "5-02-13-020" },
      { sublineItem: "Repairs and Maintenance", accountingTitle: "Repairs and Maintenance - Buildings and Other Structures", uacsCode: "5-02-13-030" },
      { sublineItem: "Repairs and Maintenance", accountingTitle: "Repairs and Maintenance - Machinery and Equipment", uacsCode: "5-02-13-040" },
      { sublineItem: "Repairs and Maintenance", accountingTitle: "Repairs and Maintenance - Transportation Equipment", uacsCode: "5-02-13-050" },
      { sublineItem: "Repairs and Maintenance", accountingTitle: "Repairs and Maintenance - Furniture and Fixtures", uacsCode: "5-02-13-060" },
      // Rent/Lease Expenses
      { sublineItem: "Rent/Lease Expenses", accountingTitle: "Rent - Building and Structures", uacsCode: "5-02-22-010" },
      { sublineItem: "Rent/Lease Expenses", accountingTitle: "Rent - Equipment", uacsCode: "5-02-22-020" },
      { sublineItem: "Rent/Lease Expenses", accountingTitle: "Rent - Motor Vehicles", uacsCode: "5-02-22-030" },
      { sublineItem: "Rent/Lease Expenses", accountingTitle: "Other Rent/Lease Expenses", uacsCode: "5-02-22-990" },
      // Other categories
      { sublineItem: "Advertising Expenses", accountingTitle: "Advertising Expenses", uacsCode: "5-02-18-010" },
      { sublineItem: "Printing and Publication Expenses", accountingTitle: "Printing and Publication Expenses", uacsCode: "5-02-19-010" },
      { sublineItem: "Representation Expenses", accountingTitle: "Representation Expenses", uacsCode: "5-02-20-010" },
      { sublineItem: "Transportation and Delivery Expenses", accountingTitle: "Transportation and Delivery Expenses", uacsCode: "5-02-21-010" },
      { sublineItem: "Membership Dues and Contributions to Organizations", accountingTitle: "Membership Dues and Contributions to Organizations", uacsCode: "5-02-23-010" },
      { sublineItem: "Subscription Expenses", accountingTitle: "Subscription Expenses", uacsCode: "5-02-24-010" },
      // Other Maintenance and Operating Expenses - Complete List
      { sublineItem: "Other Maintenance and Operating Expenses", accountingTitle: "Labor and Wages", uacsCode: "5-02-99-010" },
      { sublineItem: "Other Maintenance and Operating Expenses", accountingTitle: "Honoraria", uacsCode: "5-02-99-020" },
      { sublineItem: "Other Maintenance and Operating Expenses", accountingTitle: "Overtime and Night Pay", uacsCode: "5-02-99-030" },
      { sublineItem: "Other Maintenance and Operating Expenses", accountingTitle: "Hazard Pay", uacsCode: "5-02-99-040" },
      { sublineItem: "Other Maintenance and Operating Expenses", accountingTitle: "Longevity Pay", uacsCode: "5-02-99-050" },
      { sublineItem: "Other Maintenance and Operating Expenses", accountingTitle: "Other Compensation", uacsCode: "5-02-99-060" },
      { sublineItem: "Other Maintenance and Operating Expenses", accountingTitle: "Terminal Leave Benefits", uacsCode: "5-02-99-070" },
      { sublineItem: "Other Maintenance and Operating Expenses", accountingTitle: "Other Personnel Benefits", uacsCode: "5-02-99-080" },
      { sublineItem: "Other Maintenance and Operating Expenses", accountingTitle: "Lump-sum for Creation of New Positions", uacsCode: "5-02-99-090" },
      { sublineItem: "Other Maintenance and Operating Expenses", accountingTitle: "Lump-sum for Reclassification of Positions", uacsCode: "5-02-99-100" },
      { sublineItem: "Other Maintenance and Operating Expenses", accountingTitle: "Lump-sum for Step Increments", uacsCode: "5-02-99-110" },
      { sublineItem: "Other Maintenance and Operating Expenses", accountingTitle: "Lump-sum for Filling of Positions", uacsCode: "5-02-99-120" },
      { sublineItem: "Other Maintenance and Operating Expenses", accountingTitle: "Lump-sum for Equivalent Position", uacsCode: "5-02-99-130" },
      { sublineItem: "Other Maintenance and Operating Expenses", accountingTitle: "Lump-sum for Miscellaneous Personnel Benefits Fund", uacsCode: "5-02-99-140" },
      { sublineItem: "Other Maintenance and Operating Expenses", accountingTitle: "Year-end Bonus", uacsCode: "5-02-99-150" },
      { sublineItem: "Other Maintenance and Operating Expenses", accountingTitle: "Cash Gift", uacsCode: "5-02-99-160" },
      { sublineItem: "Other Maintenance and Operating Expenses", accountingTitle: "Productivity Enhancement Incentive", uacsCode: "5-02-99-170" },
      { sublineItem: "Other Maintenance and Operating Expenses", accountingTitle: "Mid-Year Bonus", uacsCode: "5-02-99-180" },
      { sublineItem: "Other Maintenance and Operating Expenses", accountingTitle: "Collective Negotiation Agreement Incentive", uacsCode: "5-02-99-190" },
      { sublineItem: "Other Maintenance and Operating Expenses", accountingTitle: "Performance-Based Bonus", uacsCode: "5-02-99-200" },
      { sublineItem: "Other Maintenance and Operating Expenses", accountingTitle: "Other Bonuses and Allowances", uacsCode: "5-02-99-210" },
      { sublineItem: "Other Maintenance and Operating Expenses", accountingTitle: "Confidential and Intelligence Expenses", uacsCode: "5-02-99-220" },
      { sublineItem: "Other Maintenance and Operating Expenses", accountingTitle: "Anti-Poverty Programs", uacsCode: "5-02-99-230" },
      { sublineItem: "Other Maintenance and Operating Expenses", accountingTitle: "Disaster Risk Reduction and Management Expenses", uacsCode: "5-02-99-240" },
      { sublineItem: "Other Maintenance and Operating Expenses", accountingTitle: "Contribution to Government Corporations", uacsCode: "5-02-99-250" },
      { sublineItem: "Other Maintenance and Operating Expenses", accountingTitle: "ICT Equipment, Software and Licenses", uacsCode: "5-02-99-260" },
      { sublineItem: "Other Maintenance and Operating Expenses", accountingTitle: "Website Development and Maintenance", uacsCode: "5-02-99-270" },
      { sublineItem: "Other Maintenance and Operating Expenses", accountingTitle: "Bank Charges", uacsCode: "5-02-99-280" },
      { sublineItem: "Other Maintenance and Operating Expenses", accountingTitle: "Commitment Fee", uacsCode: "5-02-99-290" },
      { sublineItem: "Other Maintenance and Operating Expenses", accountingTitle: "Other Maintenance and Operating Expenses", uacsCode: "5-02-99-990" }
    ];
    // Convert to entries format
    const entries = chartOfAccounts.map(row => ({
      id: null,
      sublineItem: row.sublineItem,
      accountingTitle: row.accountingTitle,
      uacsCode: row.uacsCode,
      income: "0",
      subsidy: "0",
      amount: "0"
    }));
    const response = {
      entries,
      status: "Draft",
      settings: {
        fiscalYear: "2026",
        budgetType: "Initial"
      }
    };
    res.status(200).json(response);
  } catch (error) {
    console.error('❌ Error in MOOE endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// MOOE save endpoint (dummy)
app.post('/mooe-save', (req, res) => {
  res.status(200).json({ message: 'Data saved successfully!' });
});
// Start server
app.listen(PORT, () => {
  });