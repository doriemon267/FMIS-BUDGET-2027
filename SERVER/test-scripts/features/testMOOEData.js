const mongoose = require('mongoose');
const mooeController = require('./controllers/mooeController');

// Mock request and response objects
const req = {};
const res = {
  status: function(statusCode) {
    // console.log('Status:', statusCode);
    return this;
  },
  json: function(data) {
    // console.log('Response data:');
    
    // Check if Financial Expenses exists in the data
    const financialExpenses = data.entries.filter(entry => 
      entry.sublineItem === 'Financial Expenses'
    );
    
    // console.log('Financial Expenses entries:', financialExpenses);
    
    // Count unique subline items
    const uniqueSublineItems = [...new Set(data.entries.map(entry => entry.sublineItem))];
    // console.log('Unique subline items:', uniqueSublineItems);
    
    mongoose.disconnect();
  }
};

// Connect to MongoDB and call the controller function
mongoose.connect('mongodb://localhost:27017/fmis')
  .then(() => {
    // console.log('Connected to MongoDB');
    mooeController.getMOOEData(req, res);
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
  });