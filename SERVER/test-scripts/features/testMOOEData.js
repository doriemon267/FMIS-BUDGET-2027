const mongoose = require('mongoose');
const mooeController = require('./controllers/mooeController');
// Mock request and response objects
const req = {};
const res = {
  status: function(statusCode) {
    // return this;
  },
  json: function(data) {
    // // Check if Financial Expenses exists in the data
    const financialExpenses = data.entries.filter(entry => 
      entry.sublineItem === 'Financial Expenses'
    );
    // // Count unique subline items
    const uniqueSublineItems = [...new Set(data.entries.map(entry => entry.sublineItem))];
    // mongoose.disconnect();
  }
};
// Connect to MongoDB and call the controller function
mongoose.connect('mongodb://localhost:27017/fmis')
  .then(() => {
    // mooeController.getMOOEData(req, res);
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
  });