const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;
let app;
const Notification = require('../../models/Notification');
const User = require('../../models/User');
const Proposal = require('../../models/Proposal');
const HierarchicalUserAssignment = require('../../models/HierarchicalUserAssignment');
const Region = require('../../models/Region');

describe('Workflow notifications reach hierarchical and User.roles recipients', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    process.env.MONGODB_BUDGET_URL = uri;
    process.env.MONGODB_MAIN_URL = uri;
    process.env.JWT_SECRET_KEY = 'test-secret';

    await mongoose.connect(uri, {});

    const express = require('express');
    app = express();
    app.use(express.json());
    // Mount full workflow routes so sendNotification is triggered
    const workflowRouter = require('../../routers/proposalWorkflowRoutes');
    app.use('/api/workflow', workflowRouter);
    const notifRouter = require('../../routers/notificationRoutes');
    app.use('/api', notifRouter);
  }, 30000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  afterEach(async () => {
    await Notification.deleteMany({});
    await User.deleteMany({});
    await Proposal.deleteMany({});
    await HierarchicalUserAssignment.deleteMany({});
    await Region.deleteMany({});
  });

  test('submit-to-reviewer creates notifications for hier-assignment and User.roles recipients', async () => {
    // Create region
    const region = await Region.create({ Region: 'TEST_REGION', regionName: 'Test Region' });

    // Create reviewer via HierarchicalUserAssignment
    await HierarchicalUserAssignment.create({
      userId: 'hier-1',
      userName: 'Hier User',
      email: 'hier@example.com',
      workflowRoles: ['BUDGET_REVIEWER'],
      assignmentLevel: 'FULL',
      regionId: region._id,
      isActive: true
    });

    // Create reviewer via User.roles only
  await User.create({ userId: 'role-1', email: 'role1@example.com', name: 'Role One', password: 'password', roles: ['BUDGET_REVIEWER'], Roles: ['BUDGET_REVIEWER'], isActive: true });

    // Create preparer user and the proposal
  await User.create({ userId: 'preparer-1', email: 'preparer@example.com', name: 'Prep One', password: 'password', roles: ['BUDGET PREPARER'], Roles: ['BUDGET PREPARER'], isActive: true });
    const proposal = await Proposal.create({ 
      title: 'Testing', 
      division: 'Test Division', 
      region: 'TEST_REGION', 
      status: 'Draft', 
      createdByUserId: 'preparer-1',
      processBy: 'preparer-1',
      budgetType: 'Initial',
      fiscalYear: '2026'
    });

    // JWT for preparer
    const token = jwt.sign({ Username: ['preparer-1'], username: 'preparer-1', roles: ['BUDGET PREPARER'], FirstName: 'Prep', LastName: 'One', id: 'preparer-1' }, process.env.JWT_SECRET_KEY);

    // Call submit endpoint which triggers sendNotification to role 'REVIEWER'
    const res = await request(app)
      .post('/api/workflow/submit')
      .set('Authorization', `Bearer ${token}`)
      .send({ proposalId: String(proposal._id), comment: 'please review' })
      .expect(200);

    // Validate Notification documents
    const docs = await Notification.find({ 'metadata.proposalId': String(proposal._id) }).lean();
    // Should include notifications for both hier-1 and role-1 (order not guaranteed)
    const recipientIds = docs.map(d => d.recipientUserId);
    expect(recipientIds).toContain('hier-1');
    expect(recipientIds).toContain('role-1');
  });

  test('analystReturn creates notifications for BUDGET_APPROVER via hierarchical and User.roles', async () => {
    // Create region
    const region = await Region.create({ Region: 'TEST_REGION', regionName: 'Test Region' });

    // Create approver via HierarchicalUserAssignment
    await HierarchicalUserAssignment.create({
      userId: 'approver-hier-1',
      userName: 'Hier Approver',
      email: 'approverhier@example.com',
      workflowRoles: ['BUDGET_APPROVER'],
      assignmentLevel: 'FULL',
      regionId: region._id,
      isActive: true
    });

    // Create approver via User.roles only
    await User.create({ userId: 'approver-role-1', email: 'approverrole@example.com', name: 'Role Approver', password: 'password', roles: ['BUDGET_APPROVER'], Roles: ['BUDGET_APPROVER'], isActive: true });

    // Create analyst user
    await User.create({ userId: 'analyst-1', email: 'analyst@example.com', name: 'Analyst One', password: 'password', roles: ['BUDGET_PLANNING_ANALYST'], Roles: ['BUDGET_PLANNING_ANALYST'], isActive: true });

    // Create proposal in correct status
    const proposal = await Proposal.create({ 
      title: 'Return Test Proposal', 
      division: 'Test Division', 
      region: 'TEST_REGION', 
      status: 'Forwarded to Budget Planning Analyst', 
      createdByUserId: 'analyst-1',
      processBy: 'analyst-1',
      budgetType: 'Initial',
      fiscalYear: '2026'
    });

    // JWT for analyst
    const token = jwt.sign({ Username: ['analyst-1'], username: 'analyst-1', roles: ['BUDGET_PLANNING_ANALYST'], FirstName: 'Analyst', LastName: 'One', id: 'analyst-1' }, process.env.JWT_SECRET_KEY);

    // Call analystReturn endpoint which triggers sendNotification to BUDGET_APPROVER
    const res = await request(app)
      .post('/api/workflow/analyst/return')
      .set('Authorization', `Bearer ${token}`)
      .send({ proposalId: String(proposal._id), comment: 'needs revision' })
      .expect(200);

    // Validate Notification documents
    const docs = await Notification.find({ 'metadata.proposalId': String(proposal._id) }).lean();
    // Should include notifications for both approver-hier-1 and approver-role-1
    const recipientIds = docs.map(d => d.recipientUserId);
    expect(recipientIds).toContain('approver-hier-1');
    expect(recipientIds).toContain('approver-role-1');
    expect(docs.length).toBeGreaterThanOrEqual(2);
  });
});
