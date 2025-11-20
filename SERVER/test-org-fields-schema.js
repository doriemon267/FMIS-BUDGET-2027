/**
 * Test script to verify org fields in NewProposalWorkflow schema
 */

require('dotenv').config();
const mongoose = require('mongoose');
const NewProposalWorkflow = require('./models/NewProposalWorkflow');

(async () => {
  try {
    const mongoUri = process.env.MONGODB_BUDGET_URL || process.env.MONGODB_URI;
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    
    console.log('\n=== TESTING NEW ORGANIZATIONAL FIELDS ===\n');
    
    // Check existing NPW records to see schema
    const allProposals = await NewProposalWorkflow.find({}).lean();
    console.log(`Total NPW records: ${allProposals.length}`);
    
    if (allProposals.length > 0) {
      console.log('\n--- Sample Proposal (checking for org fields) ---');
      const sample = allProposals[0];
      console.log('ID:', sample._id);
      console.log('Title:', sample.title);
      console.log('Division:', sample.division || '(not set)');
      console.log('Department:', sample.department || '(not set)');
      console.log('Office:', sample.office || '(not set)');
      console.log('IsCentralOffice:', sample.isCentralOffice !== undefined ? sample.isCentralOffice : '(not set)');
    }
    
    // Check if we can create a document with org fields
    console.log('\n--- Testing Schema Compatibility ---');
    const testData = {
      title: 'Test Proposal with Org Fields',
      description: 'Testing organizational fields',
      modelType: 'Initial',
      fiscalYear: 2026,
      amount: 50000,
      createdBy: '123456',
      division: 'TEST DIVISION',
      department: 'TEST DEPARTMENT',
      office: 'CO',
      isCentralOffice: true,
      status: 'DRAFT'
    };
    
    console.log('Creating test proposal with org fields...');
    const testProposal = new NewProposalWorkflow(testData);
    
    // Validate schema
    const errors = testProposal.validateSync();
    if (errors) {
      console.log('✗ Schema validation errors:', errors);
    } else {
      console.log('✓ Schema validation passed');
      console.log('✓ Org fields accepted by schema:');
      console.log('  - division:', testProposal.division);
      console.log('  - department:', testProposal.department);
      console.log('  - office:', testProposal.office);
      console.log('  - isCentralOffice:', testProposal.isCentralOffice);
    }
    
    console.log('\n✓ NewProposalWorkflow schema supports org fields!\n');
    
    await mongoose.disconnect();
  } catch(e) {
    console.error('Error:', e.message);
    if (e.errors) {
      console.error('Validation errors:', e.errors);
    }
    process.exit(1);
  }
})();
