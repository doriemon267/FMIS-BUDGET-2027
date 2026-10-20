const mongoose = require('mongoose');
require('dotenv').config();
const ChartOfAccounts = require('../../models/chartOfAccounts');
// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URL || 'mongodb://localhost:27017/budget-fmis')
  .then(() => {
    addMissingChartOfAccounts();
  })
  .catch(err => {
    console.error('Error connecting to MongoDB:', err);
    process.exit(1);
  });

