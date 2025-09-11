// Seed script for income_subcategories table
// Place this file in SERVER/SCRIPTS/ and run with: node seed_income_subcategories.js
// Make sure to adjust DB connection as needed
const { Sequelize, DataTypes } = require('sequelize');
// Update these values according to your DB config
const sequelize = new Sequelize('your_db_name', 'your_db_user', 'your_db_password', {
  host: 'localhost',
  dialect: 'mysql', // or 'postgres', 'sqlite', etc.
});
const IncomeSubcategory = sequelize.define('income_subcategories', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  category_id: { type: DataTypes.INTEGER, allowNull: false }, // adjust if your schema differs
}, {
  timestamps: false,
  freezeTableName: true,
});
// Replace these with your actual subcategories and category_id values
// Category IDs:
// 1 - Irrigation Service Fees
// 2 - Rent Income
// 3 - Water Service Fee
// 4 - Miscellaneous Income
// 5 - Others
const subcategories = [
  // Irrigation Service Fees
  { name: 'Current Account', category_id: 1 },
  { name: 'Back Accounts', category_id: 1 },
  // Rent Income
  { name: 'Rent Income', category_id: 2 },
  // Water Service Fee
  { name: 'Aya PSP', category_id: 3 },
  { name: 'NPC Energy Delivery', category_id: 3 },
  { name: 'Sun Asia Floating Solar', category_id: 3 },
  { name: 'DPJ Water Service Fee', category_id: 3 },
  { name: 'Mindoro Grid Corporation', category_id: 3 },
  { name: 'BHEP Power Generation', category_id: 3 },
  { name: 'MHEPP', category_id: 3 },
  { name: 'SN Aboitiz Power Inc.', category_id: 3 },
  { name: 'First Gen. Hydro Electric Plant', category_id: 3 },
  { name: 'Fresh River Lakes Corp (FRLC)', category_id: 3 },
  { name: 'Phil Hydro', category_id: 3 },
  { name: 'Bulk Water', category_id: 3 },
  { name: 'Balingasag', category_id: 3 },
  { name: 'Metropac', category_id: 3 },
  { name: 'Water Fees', category_id: 3 },
  { name: 'Eurohydro', category_id: 3 },
  { name: 'Global Banana Corp.', category_id: 3 },
  { name: 'Palm Oil', category_id: 3 },
  // Miscellaneous Income
  { name: 'Bid Forms', category_id: 4 },
  { name: 'Certification Fee/Verification Fee', category_id: 4 },
  { name: 'CIP/CIS/RIS Amortization & Equity', category_id: 4 },
  { name: 'Drainage Fee', category_id: 4 },
  { name: 'Interest Income', category_id: 4 },
  { name: 'Land Development', category_id: 4 },
  { name: 'Lodging', category_id: 4 },
  { name: 'Management Fees', category_id: 4 },
  { name: 'NIA Facilities', category_id: 4 },
  { name: 'Penalty on Back Accounts', category_id: 4 },
  { name: 'Pump Amortization & Equity', category_id: 4 },
  { name: 'Sales of Non Performing Assets', category_id: 4 },
  { name: 'Sales of Scrap', category_id: 4 },
  // Others
  { name: 'Balingasag - Crusher', category_id: 5 },
  { name: 'Drying Fee', category_id: 5 },
  { name: 'Filing Fee/ Inspection', category_id: 5 },
  { name: 'Fishery/Gate Pass', category_id: 5 },
  { name: 'FTC/PL resort', category_id: 5 },
  { name: 'Global (Banana Co.)', category_id: 5 },
  { name: 'Hydro/Portable Water', category_id: 5 },
  { name: 'Hydropower (CASECNAN)', category_id: 5 },
  { name: 'Income from NIA housing', category_id: 5 },
  { name: 'Income from RTC (Rental)', category_id: 5 },
  { name: 'Irrigation Development Cost', category_id: 5 },
  { name: 'Lab Analysis', category_id: 5 },
  { name: 'Lapanday Banana Plantation', category_id: 5 },
  { name: 'Lease property/Drainage Fee', category_id: 5 },
  { name: 'Mindoro Grid Corporation', category_id: 5 },
  { name: 'Other Fines and Penalties', category_id: 5 },
  { name: 'Printing & Xerox', category_id: 5 },
  { name: 'Space Rental of Pavilion/Building', category_id: 5 },
  { name: 'Use of Service Roads', category_id: 5 },
  { name: 'Water/Electrical/Housing', category_id: 5 },
  { name: 'Water Service Fee', category_id: 5 },
  { name: 'Miscellaneous/Others', category_id: 5 },
];
async function seed() {
  try {
    await sequelize.authenticate();
    for (const subcat of subcategories) {
      await IncomeSubcategory.create(subcat);
      }
    await sequelize.close();
  } catch (err) {
    console.error('Error:', err);
  }
}
seed();