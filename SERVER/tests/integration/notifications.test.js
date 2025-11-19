const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;
let app;
const Notification = require('../../models/Notification');

describe('Notifications integration tests', () => {
  beforeAll(async () => {
  // Start in-memory MongoDB
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  process.env.MONGODB_BUDGET_URL = uri;
  process.env.MONGODB_MAIN_URL = uri;
  process.env.JWT_SECRET_KEY = 'test-secret';

  // Connect Mongoose and ensure lib models use this connection
  await mongoose.connect(uri, { });

  // Build a lightweight express app that mounts only the notification routes for isolated tests
  const express = require('express');
  app = express();
  app.use(express.json());
  // Mount the notification router
  const notifRouter = require('../../routers/notificationRoutes');
  app.use('/api', notifRouter);
  }, 30000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  afterEach(async () => {
  await Notification.deleteMany({});
  });

  test('should mark a notification as read using mark-read endpoint', async () => {
    // Create a test notification with recipientUserId= user-123
    const notif = await Notification.create({
      recipientUserId: 'user-123',
      type: 'PROPOSAL_SUBMITTED',
      title: 'Test Proposal',
      message: 'A test notification',
      status: 'UNREAD',
      metadata: { proposalId: 'proposal-1' },
      createdAt: new Date()
    });

    // Create JWT token for user-123
    const token = jwt.sign({ Username: ['user-123'], username: 'user-123', roles: ['BUDGET_MANAGER'] }, process.env.JWT_SECRET_KEY);

    // Call mark-read endpoint
    const res = await request(app)
      .post('/api/notifications/mark-read')
      .set('Authorization', `Bearer ${token}`)
      .send({ ids: [String(notif._id)] })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.modifiedCount > 0).toBeTruthy();
    expect(res.body.updatedIds.length).toBeGreaterThanOrEqual(1);

    // Verify in DB the notification is updated
    const updated = await Notification.findById(notif._id).lean();
    expect(updated.status).toBe('READ');
  });

  test('should mark all notifications for a proposal as read using mark-all-read', async () => {
    // Create another user and a role-targeted notification
    await Notification.insertMany([
      { recipientUserId: 'user-role-abc', recipientUserIdNormalized: 'BUDGET_MANAGER', type: 'PROPOSAL_SUBMITTED', title: 'P1', message: 'm', metadata: { proposalId: 'proposal-2' }, status: 'UNREAD', createdAt: new Date() },
      { recipientUserId: 'user-role-abc', recipientUserIdNormalized: 'BUDGET_MANAGER', type: 'PROPOSAL_SUBMITTED', title: 'P2', message: 'm', metadata: { proposalId: 'proposal-2' }, status: 'UNREAD', createdAt: new Date() },
      { recipientUserId: 'user-other', type: 'PROPOSAL_SUBMITTED', title: 'P3', message: 'm', metadata: { proposalId: 'proposal-3' }, status: 'UNREAD', createdAt: new Date() }
    ]);

    // JWT for BUDGET_MANAGER (role)
    const token = jwt.sign({ Username: ['manager-1'], username: 'manager-1', roles: ['BUDGET MANAGER'] }, process.env.JWT_SECRET_KEY);

    const res = await request(app)
      .post('/api/notifications/mark-all-read')
      .set('Authorization', `Bearer ${token}`)
      .send({ proposalId: 'proposal-2' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.modifiedCount).toBeGreaterThanOrEqual(2);

    // Verify DB: all notifications for proposal-2 are read
    const docs = await Notification.find({ 'metadata.proposalId': 'proposal-2' }).lean();
    expect(docs.every(d => d.status === 'READ')).toBeTruthy();
  });

  test('should clear role-targeted notifications using normalized roles with mark-all-read', async () => {
    // Insert role-like and normalized notifications via collection (simulate legacy/varied formats)
    await Notification.insertMany([
      { recipientUserId: 'BUDGET MANAGER', type: 'PROPOSAL_SUBMITTED', title: 'R1', message: 'm', metadata: { proposalId: 'proposal-X' }, status: 'UNREAD', createdAt: new Date() },
      { recipientUserId: 'BUDGET_MANAGER', type: 'PROPOSAL_SUBMITTED', title: 'R2', message: 'm', metadata: { proposalId: 'proposal-X' }, status: 'UNREAD', createdAt: new Date() },
      { recipientUserId: 'user-zzz', type: 'PROPOSAL_SUBMITTED', title: 'R3', message: 'm', metadata: { proposalId: 'proposal-Y' }, status: 'UNREAD', createdAt: new Date() }
    ]);

    // JWT for BUDGET_MANAGER (role)
    const token = jwt.sign({ Username: ['manager-1'], username: 'manager-1', roles: ['BUDGET MANAGER'] }, process.env.JWT_SECRET_KEY);

    const res = await request(app)
      .post('/api/notifications/mark-all-read')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.modifiedCount).toBeGreaterThanOrEqual(2);

    // Verify DB: notifications for BUDGET_MANAGER are read
    const docs = await Notification.find({ $or: [{ recipientUserId: 'BUDGET MANAGER' }, { recipientUserId: 'Budget_Manager' }] }).lean();
    expect(docs.every(d => d.status === 'READ')).toBeTruthy();
  });
});
