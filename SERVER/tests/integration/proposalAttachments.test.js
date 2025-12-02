const request = require('supertest');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { MongoMemoryServer } = require('mongodb-memory-server');
const express = require('express');
const User = require('../../models/User');
const Proposal = require('../../models/Proposal');
const HierarchicalUserAssignment = require('../../models/HierarchicalUserAssignment');

// Helper to create temp file buffer for upload
const createTempFile = (name = 'test.pdf') => {
  const tmpPath = path.join(__dirname, name);
  fs.writeFileSync(tmpPath, 'Hello world');
  return tmpPath;
};

// Basic test plan:
// - Create a user with `BUDGET PREPARER` role
// - Create a proposal with the user set as processBy
// - Authenticate (mock token) so the app's checkToken accepts it
// - Upload a file and expect 201 and attachment metadata
// - Delete the attachment and expect 200

let server;
let app;
let mongoServer;

beforeAll(async () => {
  // Start in-memory MongoDB
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  process.env.MONGODB_BUDGET_URL = uri;
  process.env.MONGODB_MAIN_URL = uri;
  process.env.JWT_SECRET_KEY = 'test-secret';
  // Connect Mongoose
  await mongoose.connect(uri, {});

  // Create express app and mount router under /api
  app = express();
  app.use(express.json());
  const proposalRBACRouter = require('../../routers/proposalRoutesRBAC');
  app.use('/api', proposalRBACRouter);
  server = app;
  // Ensure uploads directory exists
  const uploadsPath = path.join(process.cwd(), 'uploads', 'proposal_attachments');
  if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath, { recursive: true });
});

afterAll(async () => {
  try {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  } catch (err) {
    console.error('cleanup error', err.message || err);
  }
});

describe('Proposal Attachments', () => {
  let user;
  let token;
  let proposal;

  beforeEach(async () => {
    // Create a test user
    user = await User.create({ userId: 'test-preparer', email: 'test-preparer@example.com', FirstName: 'Test', LastName: 'Preparer', name: 'Test Preparer', password: 'password', Roles: ['BUDGET_PREPARER'], isActive: true });
    // Simple mock token: generate JWT used by test helpers
    const jwt = require('jsonwebtoken');
    const payload = { Username: ['test-preparer'], username: 'test-preparer', roles: ['BUDGET_PREPARER'], FirstName: 'Test', LastName: 'Preparer', id: user.userId };
    token = jwt.sign(payload, process.env.JWT_SECRET_KEY || 'secret');

    // Create a proposal
    proposal = await Proposal.create({
      title: 'Test Attachment Proposal',
      description: 'Proposal for testing attachments',
      fiscalYear: '2025',
      budgetType: 'Test',
      region: 'Test Region',
      processBy: user.userId,
      status: 'Draft'
    });
  });

  afterEach(async () => {
    await User.deleteMany({ userId: 'test-preparer' });
    await Proposal.deleteMany({ title: 'Test Attachment Proposal' });
    // Remove files created during test
    const uploadDir = path.join(process.cwd(), 'uploads', 'proposal_attachments');
    if (fs.existsSync(uploadDir)) {
      fs.readdirSync(uploadDir).forEach(file => {
        if (/^test/.test(file)) fs.unlinkSync(path.join(uploadDir, file));
      });
    }
  });

  test('upload and delete attachment as owner preparer', async () => {
    const filePath = createTempFile('test.pdf');

    const res = await request(server)
      .post(`/api/proposals/${proposal._id}/attachments?module=mooe`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', filePath);

    expect(res.status).toBe(201);
    expect(res.body.attachment).toBeDefined();
    expect(res.body.attachment.module).toBe('mooe');
    expect(res.body.attachment.originalName).toBe('test.pdf');

    const attachmentId = res.body.attachment.attachmentId || res.body.attachment._id;

    // Delete
    const del = await request(server)
      .delete(`/api/proposals/${proposal._id}/attachments/${attachmentId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(del.status).toBe(200);
    expect(del.body.message).toMatch(/deleted/);

    // Clean up test temp file
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }, 20000);

  test('upload by non-owner should be forbidden (403)', async () => {
    const otherUser = await User.create({ userId: 'other-user', email: 'other-user@example.com', name: 'Other', Roles: ['BUDGET_PREPARER'], password: 'password', isActive: true });
    const jwt = require('jsonwebtoken');
    const otherToken = jwt.sign({ Username: ['other-user'], username: 'other-user', roles: ['BUDGET_PREPARER'], id: otherUser.userId }, process.env.JWT_SECRET_KEY);
    const filePath = createTempFile('test.pdf');

    const res = await request(server)
      .post(`/api/proposals/${proposal._id}/attachments?module=mooe`)
      .set('Authorization', `Bearer ${otherToken}`)
      .attach('file', filePath);

    expect(res.status).toBe(403);
    // cleanup
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }, 15000);

  test('upload invalid file type (txt) should be rejected (400)', async () => {
    const filePath = createTempFile('bad.txt');
    const res = await request(server)
      .post(`/api/proposals/${proposal._id}/attachments?module=mooe`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', filePath);

    expect(res.status).toBe(400);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }, 15000);

  test('upload file > 10MB should be rejected (400)', async () => {
    const largePath = path.join(__dirname, 'large-test.bin');
    const fd = fs.openSync(largePath, 'w');
    const chunk = Buffer.alloc(1024 * 1024, 'a'); // 1MB buffer
    for (let i = 0; i < 11; i++) fs.writeSync(fd, chunk, 0, chunk.length);
    fs.closeSync(fd);

    const res = await request(server)
      .post(`/api/proposals/${proposal._id}/attachments?module=mooe`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', largePath);

    expect(res.status).toBe(400);
    if (fs.existsSync(largePath)) fs.unlinkSync(largePath);
  }, 30000);
});
