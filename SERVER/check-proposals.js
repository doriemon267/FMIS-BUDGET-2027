require('dotenv').config();
const mongoose = require('mongoose');
const Proposal = require('./models/Proposal');
const HierarchicalUserAssignment = require('./models/HierarchicalUserAssignment');

mongoose.connect(process.env.MONGODB_BUDGET_URL)
  .then(async () => {
    console.log('Connected to database');
    
    // Check HierarchicalUserAssignment for user 345220
    const userAssignment = await HierarchicalUserAssignment.findOne({ userId: '345220' }).lean();
    console.log('\nHierarchicalUserAssignment for userId 345220:');
    if (userAssignment) {
      console.log('- userName:', userAssignment.userName);
      console.log('- email:', userAssignment.email);
      console.log('- userRole:', userAssignment.userRole);
    } else {
      console.log('- NOT FOUND');
    }
    
    const total = await Proposal.countDocuments({});
    console.log('\nTotal proposals:', total);
    
    if (total > 0) {
      const sample = await Proposal.findOne({}).lean();
      console.log('\nSample proposal:');
      console.log('- _id:', sample._id);
      console.log('- processBy:', sample.processBy, '(type:', typeof sample.processBy + ')');
      console.log('- status:', sample.status);
      console.log('- fiscalYear:', sample.fiscalYear);
      console.log('- budgetType:', sample.budgetType);
      console.log('- region:', sample.region);
      
      const withProcessBy = await Proposal.countDocuments({ processBy: { $exists: true } });
      console.log('\nProposals with processBy field:', withProcessBy);
      
      const processBy345220String = await Proposal.countDocuments({ processBy: "345220" });
      console.log('Proposals with processBy="345220" (string):', processBy345220String);
      
      const processByFrances = await Proposal.countDocuments({ processBy: "Frances Joshua Demafelez" });
      console.log('Proposals with processBy="Frances Joshua Demafelez":', processByFrances);
    } else {
      console.log('\nNo proposals found in database');
    }
    
    mongoose.connection.close();
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
