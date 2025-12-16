const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const express = require('express');

const NewProposalWorkflow = require('../../models/NewProposalWorkflow');
const PersonnelServices = require('../../models/PersonnelServices');
const MooeProposal = require('../../models/mooeProposals');
const CapitalOutlay = require('../../models/CapitalOutlay');
const Income = require('../../models/Income');
const Notification = require('../../models/Notification');
const Proposal = require('../../models/Proposal');
const User = require('../../models/User');

let app;
let server;
let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  process.env.MONGODB_BUDGET_URL = uri;
  process.env.MONGODB_MAIN_URL = uri;
  process.env.JWT_SECRET_KEY = 'test-secret';
  await mongoose.connect(uri, {});

  app = express();
  app.use(express.json());
  const newProposalRouter = require('../../routes/newProposalWorkflowRoutes');
  app.use('/api/allproposal', newProposalRouter);
  server = app;
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

describe('New Proposal cascading delete by SUPER ADMIN', () => {
  let superToken;
  let otherUserId;
  let workflow;

  beforeEach(async () => {
    await NewProposalWorkflow.deleteMany({});
    await PersonnelServices.deleteMany({});
    await MooeProposal.deleteMany({});
    await CapitalOutlay.deleteMany({});
    await Income.deleteMany({});
    await Notification.deleteMany({});
    await Proposal.deleteMany({});
    await User.deleteMany({});

    // Create a SUPER ADMIN user token
    const jwt = require('jsonwebtoken');
    const superUser = await User.create({ userId: 'super-1', email: 'super@example.com', name: 'Super Admin', roles: ['SUPER ADMIN'], Roles: ['SUPER ADMIN'], isActive: true, password: 'password' });
    superToken = jwt.sign({ Username: ['super-1'], username: 'super-1', roles: ['SUPER ADMIN'], id: superUser.userId }, process.env.JWT_SECRET_KEY || 'secret');

    // Create another user as creator
    const other = await User.create({ userId: 'creator-1', email: 'creator@example.com', name: 'Creator', roles: ['BUDGET_PREPARER'], Roles: ['BUDGET_PREPARER'], isActive: true, password: 'password' });
    otherUserId = other.userId;

    // Create workflow
    workflow = await NewProposalWorkflow.create({ title: 'CascadeDeleteTest', fiscalYear: 2026, modelType: 'Initial', createdBy: otherUserId, createdByName: 'Creator', status: 'FINALIZED' });

    // Create child docs referencing workflowRef
    await PersonnelServices.create([{
      employeeFullName: 'Emp One',
      positionTitle: 'Pos',
      processBy: otherUserId,
      processDate: new Date(),
      DateOfAppointment: new Date('2020-01-01'),
      DateOfBirth: new Date('1990-01-01'),
      fiscalYear: '2026',
      department: 'D',
      region: 'R',
      status: 'Draft',
      workflowRef: workflow._id,
      employeeStatus: 'Active',
      statusOfAppointment: 'Permanent',
      monthlySalary: 10000,
      noOfDependent: 0,
      hazardPay: 0,
      subsistenceAllowance: 0,
      honoraria: 0,
      annualSalary: 120000,
      RATA: 0,
      PERA: 0,
      uniformALLOWANCE: 0,
      productivityIncentive: 0,
      medical: 0,
      childrenAllowance: 0,
      midyearBonus: 0,
      cashGift: 0,
      subsistenceAllowanceMDS: 0,
      subsistenceAllowanceST: 0,
      yearEndBonus: 0,
      gsisPremium: 0,
      philhealthPremium: 0,
      pagibigPremium: 0,
      employeeCompensation: 0,
      Total: 120000
    }]);
    await MooeProposal.create([{ uacsCode: 'U1', accountingTitle: 'Acc', processBy: otherUserId, workflowRef: workflow._id }]);
    // Create required category for CapitalOutlay
    const Category = require('../../models/Category');
    const cat = await Category.create({ categoryName: 'Test Category' });
    await CapitalOutlay.create([{ particulars: 'Item', cost: 100, processBy: otherUserId, workflowRef: workflow._id, sublineItem: 'SL1', processDate: new Date(), category: cat._id }]);
    // Create IncomeCategory for Income
    const IncomeCategory = require('../../models/IncomeCategory');
    const incCat = await IncomeCategory.create({ incomeCategoryName: 'Test Income Cat', description: 'desc' });
    await Income.create([{ particulars: 'Inc', amount: 50, incomecategory: incCat._id, fiscalYear: '2026', budgetType: 'Initial', processBy: otherUserId, workflowRef: workflow._id }]);

    // Notification referencing proposal
    await Notification.create({ recipientUserId: 'super-1', message: 'test', relatedEntityId: String(workflow._id), relatedEntityType: 'PROPOSAL', metadata: { proposalId: String(workflow._id) } });

    // Legacy Proposal referencing workflowRef
    await Proposal.create({ title: 'Legacy', fiscalYear: '2026', processBy: otherUserId, workflowRef: workflow._id, status: 'Draft', region: 'R', budgetType: 'Initial' });
  });

  afterEach(async () => {
    await NewProposalWorkflow.deleteMany({});
    await PersonnelServices.deleteMany({});
    await MooeProposal.deleteMany({});
    await CapitalOutlay.deleteMany({});
    await Income.deleteMany({});
    await Notification.deleteMany({});
    await Proposal.deleteMany({});
    await User.deleteMany({});
  });

  test('SUPER ADMIN can delete workflow and related records', async () => {
    const res = await request(server)
      .delete(`/api/allproposal/proposals/${workflow._id}`)
      .set('Authorization', `Bearer ${superToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Check that related collections are cleaned
    const remainingPersonnel = await PersonnelServices.countDocuments({ workflowRef: workflow._id });
    const remainingMooe = await MooeProposal.countDocuments({ workflowRef: workflow._id });
    const remainingCapital = await CapitalOutlay.countDocuments({ workflowRef: workflow._id });
    const remainingIncome = await Income.countDocuments({ workflowRef: workflow._id });
    const remainingNotifs = await Notification.countDocuments({ 'metadata.proposalId': String(workflow._id) });
    const remainingLegacy = await Proposal.countDocuments({ workflowRef: workflow._id });

    expect(remainingPersonnel).toBe(0);
    expect(remainingMooe).toBe(0);
    expect(remainingCapital).toBe(0);
    expect(remainingIncome).toBe(0);
    expect(remainingNotifs).toBe(0);
    expect(remainingLegacy).toBe(0);
  });
});
