const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;
let app;

const NewProposalWorkflow = require('../../models/NewProposalWorkflow');
const HierarchicalUserAssignment = require('../../models/HierarchicalUserAssignment');
const User = require('../../models/User');
const Region = require('../../models/Region');

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

  // Mount new proposal workflow endpoints under same path as production
  const newWorkflowRouter = require('../../routes/newProposalWorkflowRoutes');
  app.use('/api/allproposal', newWorkflowRouter);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

afterEach(async () => {
  await NewProposalWorkflow.deleteMany({});
  await HierarchicalUserAssignment.deleteMany({});
  await User.deleteMany({});
  await Region.deleteMany({});
});

describe('Monitoring view & direct submit behavior', () => {
  test('Monitoring returns non-draft proposals for Budget Manager', async () => {
    const region = await Region.create({ Region: 'R1', regionName: 'Region 1' });

    await NewProposalWorkflow.create({ title: 'P1', fiscalYear: 2026, modelType: 'Initial', createdBy: 'user-manager', createdByName: 'Manager', status: 'FORWARDED_TO_BRD_ANALYST', region: region._id });
    await NewProposalWorkflow.create({ title: 'P2', fiscalYear: 2026, modelType: 'Initial', createdBy: 'user-manager', createdByName: 'Manager', status: 'FINALIZED', region: region._id });
    await NewProposalWorkflow.create({ title: 'D1', fiscalYear: 2026, modelType: 'Initial', createdBy: 'user-prep', createdByName: 'Preparer', status: 'DRAFT', region: region._id });

    // Create manager user record (used by resolveUserIdentity)
    await User.create({ userId: 'man-1', email: 'man1@example.com', name: 'Manager One', roles: ['BUDGET MANAGER'], Roles: ['BUDGET MANAGER'], isActive: true });
    // Manager token
    const managerToken = jwt.sign({ Username: ['man-1'], username: 'man-1', roles: ['BUDGET_MANAGER'], FirstName: 'Man', LastName: 'One', id: 'man-1' }, process.env.JWT_SECRET_KEY);

    const res = await request(app)
      .get('/api/allproposal/proposals')
      .set('Authorization', `Bearer ${managerToken}`)
      .query({ view: 'monitoring' })
      .expect(200);

    // Should return only the two non-draft proposals
    expect(Array.isArray(res.body.proposals)).toBe(true);
    const titles = res.body.proposals.map(p => p.title);
    expect(titles).toContain('P1');
    expect(titles).toContain('P2');
    expect(titles).not.toContain('D1');

    // Metrics by status should include human-readable keys (Finalized etc.)
    expect(res.body.metrics).toBeDefined();
    const keys = Object.keys(res.body.metrics.byStatus || {});
    expect(keys.some(k => k.toLowerCase().includes('final'))).toBe(true);
  });

  test('Office-level preparer submits directly to approver; RC-level goes to reviewer', async () => {
    const region = await Region.create({ Region: 'R2', regionName: 'Region 2' });

    // Create Office-level preparer
    await HierarchicalUserAssignment.create({ userId: 'preparer-office', userName: 'Office Prep', workflowRoles: ['BUDGET PREPARER'], assignmentLevel: 'OFFICE', regionId: region._id, isActive: true });
    await User.create({ userId: 'preparer-office', email: 'officeprep@example.com', name: 'Office Prep', roles: ['BUDGET PREPARER'], Roles: ['BUDGET PREPARER'], isActive: true });

    // Create Department-level preparer
    await HierarchicalUserAssignment.create({ userId: 'preparer-dept', userName: 'Dept Prep', workflowRoles: ['BUDGET PREPARER'], assignmentLevel: 'DEPARTMENT', regionId: region._id, isActive: true });
    await User.create({ userId: 'preparer-dept', email: 'deptprep@example.com', name: 'Dept Prep', roles: ['BUDGET PREPARER'], Roles: ['BUDGET PREPARER'], isActive: true });

    const officeProposal = await NewProposalWorkflow.create({ title: 'Office Draft', fiscalYear: 2026, modelType: 'Initial', createdBy: 'preparer-office', createdByName: 'Office Prep', status: 'DRAFT', region: region._id });
    const deptProposal = await NewProposalWorkflow.create({ title: 'Dept Draft', fiscalYear: 2026, modelType: 'Initial', createdBy: 'preparer-dept', createdByName: 'Dept Prep', status: 'DRAFT', region: region._id });

    const officeToken = jwt.sign({ Username: ['preparer-office'], username: 'preparer-office', roles: ['BUDGET PREPARER'], FirstName: 'Of', LastName: 'Prep', id: 'preparer-office' }, process.env.JWT_SECRET_KEY);
    const deptToken = jwt.sign({ Username: ['preparer-dept'], username: 'preparer-dept', roles: ['BUDGET PREPARER'], FirstName: 'Dp', LastName: 'Prep', id: 'preparer-dept' }, process.env.JWT_SECRET_KEY);

    // Office-level preparer submits using 'submit-to-reviewer' (UI-friendly) but the server should map to submit-to-approver
    const officeRes = await request(app)
      .post(`/api/allproposal/proposals/${officeProposal._id}/action`)
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ action: 'submit-to-reviewer', comment: 'Office submit' })
      .expect(200);

    // Fetch proposal
    const refreshedOffice = await NewProposalWorkflow.findById(officeProposal._id).lean();
    expect(refreshedOffice.status).toBe('FORWARDED_TO_APPROVER');

    // Department-level preparer submits; should go to reviewer
    const deptRes = await request(app)
      .post(`/api/allproposal/proposals/${deptProposal._id}/action`)
      .set('Authorization', `Bearer ${deptToken}`)
      .send({ action: 'submit-to-reviewer', comment: 'Dept submit' })
      .expect(200);

    const refreshedDept = await NewProposalWorkflow.findById(deptProposal._id).lean();
    expect(refreshedDept.status).toBe('FORWARDED_TO_REVIEWER');

    // Department-level user tries to directly call submit-to-approver (should be blocked)
    const deptDirectRes = await request(app)
      .post(`/api/allproposal/proposals/${deptProposal._id}/action`)
      .set('Authorization', `Bearer ${deptToken}`)
      .send({ action: 'submit-to-approver', comment: 'attempt direct to approver' })
      .expect(403);
  });
});
