// MongoDB seed script for income_subcategories
// Place this file in SERVER/SCRIPTS/ and run with: node seed_income_subcategories_mongo.js
// Make sure to adjust MongoDB URI and collection names as needed
const mongoose = require('mongoose');
// Update this to your actual MongoDB connection string
const MONGO_URI = 'mongodb://172.16.4.98:27017/fmis_budget';
// Define category and subcategory schemas
const categorySchema = new mongoose.Schema({
  name: String,
}, { collection: 'income_categories' });
const subcategorySchema = new mongoose.Schema({
  name: String,
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'income_categories' },
}, { collection: 'income_subcategories' });
const Category = mongoose.model('income_categories', categorySchema);
const Subcategory = mongoose.model('income_subcategories', subcategorySchema);
// Categories and subcategories mapping
const categories = [
  { name: 'Irrigation Service Fees', subcategories: ['Current Account', 'Back Accounts'] },
  { name: 'Rent Income', subcategories: ['Rent Income'] },
  { name: 'Water Service Fee', subcategories: [
    'Aya PSP', 'NPC Energy Delivery', 'Sun Asia Floating Solar', 'DPJ Water Service Fee',
    'Mindoro Grid Corporation', 'BHEP Power Generation', 'MHEPP', 'SN Aboitiz Power Inc.',
    'First Gen. Hydro Electric Plant', 'Fresh River Lakes Corp (FRLC)', 'Phil Hydro',
    'Bulk Water', 'Balingasag', 'Metropac', 'Water Fees', 'Eurohydro', 'Global Banana Corp.', 'Palm Oil'
  ] },
  { name: 'Miscellaneous Income', subcategories: [
    'Bid Forms', 'Certification Fee/Verification Fee', 'CIP/CIS/RIS Amortization & Equity', 'Drainage Fee',
    'Interest Income', 'Land Development', 'Lodging', 'Management Fees', 'NIA Facilities',
    'Penalty on Back Accounts', 'Pump Amortization & Equity', 'Sales of Non Performing Assets', 'Sales of Scrap'
  ] },
  { name: 'Others', subcategories: [
    'Balingasag - Crusher', 'Drying Fee', 'Filing Fee/ Inspection', 'Fishery/Gate Pass', 'FTC/PL resort',
    'Global (Banana Co.)', 'Hydro/Portable Water', 'Hydropower (CASECNAN)', 'Income from NIA housing',
    'Income from RTC (Rental)', 'Irrigation Development Cost', 'Lab Analysis', 'Lapanday Banana Plantation',
    'Lease property/Drainage Fee', 'Mindoro Grid Corporation', 'Other Fines and Penalties', 'Printing & Xerox',
    'Space Rental of Pavilion/Building', 'Use of Service Roads', 'Water/Electrical/Housing', 'Water Service Fee', 'Miscellaneous/Others'
  ] },
];
async function seed() {
  await mongoose.connect(MONGO_URI);
  for (const cat of categories) {
    // Find category by name
    let categoryDoc = await Category.findOne({ name: cat.name });
    if (!categoryDoc) {
      categoryDoc = await Category.create({ name: cat.name });
      }
    for (const subcatName of cat.subcategories) {
      // Check if subcategory already exists
      let exists = await Subcategory.findOne({ name: subcatName, category: categoryDoc._id });
      if (!exists) {
        await Subcategory.create({ name: subcatName, category: categoryDoc._id });
        }
    }
  }
  await mongoose.disconnect();
  }
seed().catch(err => {
  console.error('Error:', err);
  mongoose.disconnect();
});