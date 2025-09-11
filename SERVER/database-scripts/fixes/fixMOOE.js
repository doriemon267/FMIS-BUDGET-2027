// Quick fix for MOOE Chart of Accounts issue
const mongoose = require('mongoose');
// Load environment variables
require('dotenv').config();
// MongoDB connection string - update this with your actual connection string
const MONGODB_URI = process.env.MONGODB_URL || 'mongodb://localhost:27017/budget-fmis';
// Chart of Accounts schema (simplified)
const chartOfAccountsSchema = new mongoose.Schema({
  accountClass: String,
  lineItem: String,
  sublineItem: String,
  accountingTitle: String,
  uacsCode: String,
  normalBalance: String
});
const ChartOfAccounts = mongoose.model('ChartOfAccounts', chartOfAccountsSchema);
async function fixMOOEIssue() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    // Check existing Chart of Accounts
    const existingCount = await ChartOfAccounts.countDocuments();
    // Check MOOE specific records
    const mooeCount = await ChartOfAccounts.countDocuments({
      accountClass: "Expense",
      lineItem: "Maintenance and Other Operating Expenses"
    });
    if (mooeCount === 0) {
      const mooeEntries = [
        {
          accountClass: "Expense",
          lineItem: "Maintenance and Other Operating Expenses",
          sublineItem: "Traveling Expenses",
          accountingTitle: "Traveling Expenses - Local",
          uacsCode: "5-02-01-010",
          normalBalance: "Debit"
        },
        {
          accountClass: "Expense",
          lineItem: "Maintenance and Other Operating Expenses",
          sublineItem: "Traveling Expenses",
          accountingTitle: "Traveling Expenses - Foreign",
          uacsCode: "5-02-01-020",
          normalBalance: "Debit"
        },
        {
          accountClass: "Expense",
          lineItem: "Maintenance and Other Operating Expenses",
          sublineItem: "Training and Scholarship Expenses",
          accountingTitle: "Training Expenses",
          uacsCode: "5-02-02-010",
          normalBalance: "Debit"
        },
        {
          accountClass: "Expense",
          lineItem: "Maintenance and Other Operating Expenses",
          sublineItem: "Supplies and Materials Expenses",
          accountingTitle: "Office Supplies Expenses",
          uacsCode: "5-02-03-010",
          normalBalance: "Debit"
        },
        {
          accountClass: "Expense",
          lineItem: "Maintenance and Other Operating Expenses",
          sublineItem: "Supplies and Materials Expenses",
          accountingTitle: "Fuel, Oil and Lubricants Expenses",
          uacsCode: "5-02-03-050",
          normalBalance: "Debit"
        },
        {
          accountClass: "Expense",
          lineItem: "Maintenance and Other Operating Expenses",
          sublineItem: "Utilities Expenses",
          accountingTitle: "Water Expenses",
          uacsCode: "5-02-04-010",
          normalBalance: "Debit"
        },
        {
          accountClass: "Expense",
          lineItem: "Maintenance and Other Operating Expenses",
          sublineItem: "Utilities Expenses",
          accountingTitle: "Electricity Expenses",
          uacsCode: "5-02-04-020",
          normalBalance: "Debit"
        },
        {
          accountClass: "Expense",
          lineItem: "Maintenance and Other Operating Expenses",
          sublineItem: "Communication Expenses",
          accountingTitle: "Postage and Courier Services",
          uacsCode: "5-02-05-010",
          normalBalance: "Debit"
        },
        {
          accountClass: "Expense",
          lineItem: "Maintenance and Other Operating Expenses",
          sublineItem: "Communication Expenses",
          accountingTitle: "Telephone Expenses",
          uacsCode: "5-02-05-020",
          normalBalance: "Debit"
        },
        {
          accountClass: "Expense",
          lineItem: "Maintenance and Other Operating Expenses",
          sublineItem: "Communication Expenses",
          accountingTitle: "Internet Subscription Expenses",
          uacsCode: "5-02-05-030",
          normalBalance: "Debit"
        },
        {
          accountClass: "Expense",
          lineItem: "Maintenance and Other Operating Expenses",
          sublineItem: "Repairs and Maintenance",
          accountingTitle: "Repairs and Maintenance - Motor Vehicles",
          uacsCode: "5-02-13-010",
          normalBalance: "Debit"
        },
        {
          accountClass: "Expense",
          lineItem: "Maintenance and Other Operating Expenses",
          sublineItem: "Repairs and Maintenance",
          accountingTitle: "Repairs and Maintenance - Office Equipment",
          uacsCode: "5-02-13-020",
          normalBalance: "Debit"
        },
        {
          accountClass: "Expense",
          lineItem: "Maintenance and Other Operating Expenses",
          sublineItem: "Other Maintenance and Operating Expenses",
          accountingTitle: "Advertising Expenses",
          uacsCode: "5-02-99-010",
          normalBalance: "Debit"
        },
        {
          accountClass: "Expense",
          lineItem: "Maintenance and Other Operating Expenses",
          sublineItem: "Other Maintenance and Operating Expenses",
          accountingTitle: "Printing and Publication Expenses",
          uacsCode: "5-02-99-020",
          normalBalance: "Debit"
        },
        {
          accountClass: "Expense",
          lineItem: "Maintenance and Other Operating Expenses",
          sublineItem: "Other Maintenance and Operating Expenses",
          accountingTitle: "Representation Expenses",
          uacsCode: "5-02-99-030",
          normalBalance: "Debit"
        },
        {
          accountClass: "Expense",
          lineItem: "Maintenance and Other Operating Expenses",
          sublineItem: "Other Maintenance and Operating Expenses",
          accountingTitle: "Other MOOE",
          uacsCode: "5-02-99-990",
          normalBalance: "Debit"
        }
      ];
      // Insert the records
      const result = await ChartOfAccounts.insertMany(mooeEntries);
      // Verify insertion
      const newMooeCount = await ChartOfAccounts.countDocuments({
        accountClass: "Expense",
        lineItem: "Maintenance and Other Operating Expenses"
      });
      } else {
      }
    } catch (error) {
    console.error('❌ Error fixing MOOE:', error);
  } finally {
    await mongoose.disconnect();
    }
}
// Run the fix
fixMOOEIssue();