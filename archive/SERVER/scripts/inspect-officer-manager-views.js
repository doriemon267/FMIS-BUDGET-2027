const mongoose = require('mongoose');
const path = require('path');

const MONGODB = process.env.MONGODB_BUDGET_URL || 'mongodb://localhost:27017/fmis_budget';
const deptQuery = process.argv[2] || 'CORPORATE PLANNING SERVICES';
const divisionQuery = process.argv[3] || 'MANAGEMENT INFORMATION DIVISION';

(async () => {
  try {
    await mongoose.connect(MONGODB, { useNewUrlParser: true, useUnifiedTopology: true });
    const Proposal = require(path.join(__dirname, '..', 'models', 'Proposal'));
    const PersonnelServices = require(path.join(__dirname, '..', 'models', 'PersonnelServices'));
    const MooeProposal = require(path.join(__dirname, '..', 'models', 'mooeProposals'));
    const CapitalOutlay = require(path.join(__dirname, '..', 'models', 'CapitalOutlay'));
    const Income = require(path.join(__dirname, '..', 'models', 'Income'));

    console.log('Inspecting department:', deptQuery, 'division:', divisionQuery);

    const propsByStatus = await Promise.all([
      Proposal.countDocuments({ department: deptQuery, status: 'Office Approved' }),
      Proposal.countDocuments({ department: deptQuery, status: 'Office Submitted' }),
      Proposal.countDocuments({ department: deptQuery, isConsolidated: true }),
      Proposal.find({ department: deptQuery }).limit(10).lean()
    ]);

    console.log('Proposal counts (Office Approved, Office Submitted, isConsolidated):', propsByStatus[0], propsByStatus[1], propsByStatus[2]);

    console.log('\nSample proposals:');
    propsByStatus[3].forEach(p => {
      console.log('---');
      console.log('id:', p._id);
      console.log('title:', p.title);
      console.log('status:', p.status);
      console.log('isConsolidated:', p.isConsolidated);
      console.log('department:', p.department);
      console.log('division:', p.division);
      console.log('consolidatedProposals.length:', (p.consolidatedProposals || []).length);
    });

    // Check entity collections for missing department/division
    const psMissing = await PersonnelServices.countDocuments({ department: { $exists: false } });
    const mooeMissing = await MooeProposal.countDocuments({ department: { $exists: false } });
    const coMissing = await CapitalOutlay.countDocuments({ department: { $exists: false } });
    const incMissing = await Income.countDocuments({ department: { $exists: false } });

    console.log('\nEntity docs missing department field counts:');
    console.log('PersonnelServices:', psMissing);
    console.log('MOOE:', mooeMissing);
    console.log('CapitalOutlay:', coMissing);
    console.log('Income:', incMissing);

    // Show sample entity docs for the department/division
    const psSamples = await PersonnelServices.find({ department: deptQuery }).limit(5).lean();
    console.log('\nSample PersonnelServices for department:');
    psSamples.forEach(d => console.log({ id: d._id, status: d.status, department: d.department, division: d.division }));

    const mooeSamples = await MooeProposal.find({ department: deptQuery }).limit(5).lean();
    console.log('\nSample MooeProposals for department:');
    mooeSamples.forEach(d => console.log({ id: d._id, status: d.status, department: d.department, division: d.division }));

    const coSamples = await CapitalOutlay.find({ department: deptQuery }).limit(5).lean();
    console.log('\nSample CapitalOutlay for department:');
    coSamples.forEach(d => console.log({ id: d._id, status: d.status, department: d.department, division: d.division }));

    const incSamples = await Income.find({ department: deptQuery }).limit(5).lean();
    console.log('\nSample Income for department:');
    incSamples.forEach(d => console.log({ id: d._id, status: d.status, department: d.department, division: d.division }));

    process.exit(0);
  } catch (err) {
    console.error('Inspect error:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();
