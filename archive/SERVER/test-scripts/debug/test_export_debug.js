// Test script to debug the export controller
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const { exportBudgetSummaryPDF } = require('./controllers/exportController');
// Mock request and response objects
const mockReq = {
  body: {
    fiscalYear: '2024',
    budgetType: 'Proposed',
    region: 'Region I',
    dataCounts: {
      personnel: 0,
      cos: 0,
      mooe: 0,
      capital: 0,
      income: 0
    },
    budgetSummary: {
      personnelServices: '₱1,500,000.00',
      cosPersonnel: '₱800,000.00',
      mooe: '₱2,000,000.00',
      capitalOutlay: '₱3,500,000.00',
      income: '₱8,000,000.00',
      totalExpenses: '₱7,800,000.00',
      netIncome: '+₱200,000.00',
      grandTotal: '₱8,000,000.00'
    }
  },
  query: {}
};
const mockRes = {
  setHeader: () => {},
  status: (code) => ({
    json: (data) => {
      }
  }),
  end: () => {
    }
};
async function testExport() {
  try {
    if (process.env.MONGODB_URL) {
      await mongoose.connect(process.env.MONGODB_URL);
      } else {
      ...');
    }
    await exportBudgetSummaryPDF(mockReq, mockRes);
  } catch (error) {
    console.error('Test error:', error.message);
    // Try to run export function anyway to see debugging
    try {
      await exportBudgetSummaryPDF(mockReq, mockRes);
    } catch (exportError) {
      console.error('Export function error:', exportError.message);
    }
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      }
  }
}
testExport();