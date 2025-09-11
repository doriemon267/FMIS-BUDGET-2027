// Test MOOE API endpoint
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 5006; // Use different port to avoid conflicts
// Middleware
app.use(cors());
app.use(express.json());
// Test MOOE endpoint with hardcoded data
app.get('/mooe-data', (req, res) => {
  // try {
    // Hardcoded Chart of Accounts for MOOE
    const chartOfAccounts = [
      {
        sublineItem: "Traveling Expenses",
        accountingTitle: "Traveling Expenses - Local",
        uacsCode: "5-02-01-010"
      },
      {
        sublineItem: "Training and Scholarship Expenses",
        accountingTitle: "Training Expenses",
        uacsCode: "5-02-02-010"
      },
      {
        sublineItem: "Supplies and Materials Expenses",
        accountingTitle: "Office Supplies Expenses",
        uacsCode: "5-02-03-010"
      },
      {
        sublineItem: "Supplies and Materials Expenses",
        accountingTitle: "Fuel, Oil and Lubricants Expenses",
        uacsCode: "5-02-03-050"
      },
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
        sublineItem: "Repairs and Maintenance",
        accountingTitle: "Repairs and Maintenance - Motor Vehicles",
        uacsCode: "5-02-13-010"
      },
      {
        sublineItem: "Repairs and Maintenance",
        accountingTitle: "Repairs and Maintenance - Office Equipment",
        uacsCode: "5-02-13-020"
      },
      {
        sublineItem: "Other Maintenance and Operating Expenses",
        accountingTitle: "Advertising Expenses",
        uacsCode: "5-02-99-010"
      },
      {
        sublineItem: "Other Maintenance and Operating Expenses",
        accountingTitle: "Printing and Publication Expenses",
        uacsCode: "5-02-99-020"
      },
      {
        sublineItem: "Other Maintenance and Operating Expenses",
        accountingTitle: "Representation Expenses",
        uacsCode: "5-02-99-030"
      },
      {
        sublineItem: "Other Maintenance and Operating Expenses",
        accountingTitle: "Other MOOE",
        uacsCode: "5-02-99-990"
      }
    ];
    // Create entries array
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
    // // // // res.status(200).json(response);
  } catch (error) {
    console.error('❌ Error in test endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// Start server
app.listen(PORT, () => {
  });