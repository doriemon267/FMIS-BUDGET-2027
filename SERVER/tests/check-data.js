const mongoose = require('mongoose');
const Proposal = require('../models/Proposal');
const PersonnelService = require('../models/PersonnelServices');
const MooeProposal = require('../models/mooeProposals');
const CapitalOutlay = require('../models/CapitalOutlay');
const Income = require('../models/Income');

async function checkData() {
  try {
    await mongoose.connect('mongodb://172.16.4.98:27017/fmis_budget');

    console.log('=== CHECKING DATABASE CONNECTION ===');
    console.log('Connected to database:', mongoose.connection.db.databaseName);

    // List all databases
    const adminDb = mongoose.connection.db.admin();
    const dbList = await adminDb.listDatabases();
    console.log('Available databases:');
    dbList.databases.forEach(db => {
      console.log(`  - ${db.name}`);
    });

    // Check collections in current database
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\nCollections in current database:');
    collections.forEach(col => {
      console.log(`  - ${col.name}`);
    });

    console.log('\n=== CHECKING DATABASE DATA ===');

    console.log('\n1. Checking Proposals with originalLevel: DIVISION');
    const divisionProposals = await Proposal.find({ originalLevel: 'DIVISION' }).limit(3);
    console.log('Found', divisionProposals.length, 'division proposals');
    if (divisionProposals.length > 0) {
      console.log('Sample proposal:', {
        id: divisionProposals[0]._id,
        status: divisionProposals[0].status,
        workflowLevel: divisionProposals[0].workflowLevel,
        originalLevel: divisionProposals[0].originalLevel,
        region: divisionProposals[0].region,
        department: divisionProposals[0].department,
        division: divisionProposals[0].division,
        office: divisionProposals[0].office
      });
    }

    console.log('\n2. Checking PersonnelService with originalLevel: DIVISION');
    const divisionPersonnel = await PersonnelService.find({ originalLevel: 'DIVISION' }).limit(3);
    console.log('Found', divisionPersonnel.length, 'division personnel records');
    if (divisionPersonnel.length > 0) {
      console.log('Sample personnel:', {
        id: divisionPersonnel[0]._id,
        status: divisionPersonnel[0].status,
        workflowLevel: divisionPersonnel[0].workflowLevel,
        originalLevel: divisionPersonnel[0].originalLevel,
        region: divisionPersonnel[0].region,
        department: divisionPersonnel[0].department,
        division: divisionPersonnel[0].division,
        office: divisionPersonnel[0].office
      });
    }

    console.log('\n3. Checking for submitted statuses');
    const submittedStatuses = ['Division Submitted', 'DIVISION SUBMITTED', 'Department Verified', 'DEPARTMENT VERIFIED'];
    const submittedProposals = await Proposal.find({
      status: { $in: submittedStatuses }
    }).limit(3);
    console.log('Found', submittedProposals.length, 'submitted proposals');
    if (submittedProposals.length > 0) {
      console.log('Sample submitted:', {
        id: submittedProposals[0]._id,
        status: submittedProposals[0].status,
        workflowLevel: submittedProposals[0].workflowLevel,
        originalLevel: submittedProposals[0].originalLevel,
        region: submittedProposals[0].region,
        department: submittedProposals[0].department,
        division: submittedProposals[0].division
      });
    }

    console.log('\n4. Checking MOOE data');
    const mooeData = await MooeProposal.find({ originalLevel: 'DIVISION' }).limit(3);
    console.log('Found', mooeData.length, 'MOOE division records');

    console.log('\n5. Checking Capital Outlay data');
    const capitalData = await CapitalOutlay.find({ originalLevel: 'DIVISION' }).limit(3);
    console.log('Found', capitalData.length, 'Capital division records');

    console.log('\n7. Checking MOOE collection directly');
    const mooeCollection = mongoose.connection.db.collection('mooeproposals');
    const mooeRecords = await mooeCollection.find({}).limit(3).toArray();
    console.log('Found', mooeRecords.length, 'MOOE records in collection');
    if (mooeRecords.length > 0) {
      console.log('Sample MOOE:', {
        id: mooeRecords[0]._id,
        status: mooeRecords[0].status,
        workflowLevel: mooeRecords[0].workflowLevel,
        originalLevel: mooeRecords[0].originalLevel,
        region: mooeRecords[0].region,
        department: mooeRecords[0].department,
        division: mooeRecords[0].division
      });
    }

    console.log('\n8. Checking PersonnelServices collection directly');
    const personnelCollection = mongoose.connection.db.collection('personnelservices');
    const personnelRecords = await personnelCollection.find({}).limit(3).toArray();
    console.log('Found', personnelRecords.length, 'Personnel records in collection');
    if (personnelRecords.length > 0) {
      console.log('Sample Personnel:', {
        id: personnelRecords[0]._id,
        status: personnelRecords[0].status,
        workflowLevel: personnelRecords[0].workflowLevel,
        originalLevel: personnelRecords[0].originalLevel,
        region: personnelRecords[0].region,
        department: personnelRecords[0].department,
        division: personnelRecords[0].division
      });
    }

    console.log('\n9. Checking for Division Submitted status in MOOE');
    const submittedMooe = await mooeCollection.find({
      status: { $in: ['Division Submitted', 'DIVISION SUBMITTED'] }
    }).limit(3).toArray();
    console.log('Found', submittedMooe.length, 'Division Submitted MOOE records');
//Checking for Region Submitted status in ALL Proposals
console.log('\n10. Checking for Region Submitted status in ALL Proposals');
const submittedAllProposals = await Proposal.find({
  status: { $in: ['Region Submitted', 'REGION SUBMITTED'] }
}).limit(3);
console.log('Found', submittedAllProposals.length, 'Region Submitted Proposals');
    console.log('\n10. Checking for Division Submitted status in Personnel');
    const submittedPersonnel = await personnelCollection.find({
      status: { $in: ['Division Submitted', 'DIVISION SUBMITTED'] }
    }).limit(3).toArray();
    console.log('Found', submittedPersonnel.length, 'Division Submitted Personnel records');
  } catch (error) {
    console.error('Error:', error);
  }
}

checkData();