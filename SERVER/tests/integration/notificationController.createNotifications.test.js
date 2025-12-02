const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Notification = require('../../models/Notification');
const HierarchicalUserAssignment = require('../../models/HierarchicalUserAssignment');
const notificationController = require('../../controllers/notificationController');
const User = require('../../models/User');

describe('createNotifications region and NIA-wide expansion', () => {
  let mongoServer;
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    process.env.MONGODB_BUDGET_URL = uri;
    await mongoose.connect(uri, {});
  });
  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });
  afterEach(async () => {
    await Notification.deleteMany({});
    await HierarchicalUserAssignment.deleteMany({});
    await User.deleteMany({});
  });

  test('should expand by targetRegions to matching assignments', async () => {
    // Create assignments
    await HierarchicalUserAssignment.create({ userId: 'userA', userName: 'A', email: 'a@example.com', assignedRegions: ['CALABARZON'], isActive: true, assignmentLevel: 'REGION' });
    await HierarchicalUserAssignment.create({ userId: 'userB', userName: 'B', email: 'b@example.com', assignedRegions: ['MARIIS'], isActive: true, assignmentLevel: 'REGION' });

    const notifications = [{ userId: 'BUDGET MANAGER', title: 'Test', message: 'test', metadata: { targetRegions: ['CALABARZON'] } }];
    const created = await notificationController.createNotifications(notifications, {});
    expect(created.length).toBe(1);
    const notif = await Notification.findOne({ recipientUserId: 'userA' });
    expect(notif).toBeTruthy();
    expect(notif.recipientUserId).toBe('userA');
  });

  test('should require initiator with BRD-level for NIA-wide send', async () => {
    await HierarchicalUserAssignment.create({ userId: 'userA', userName: 'A', email: 'a@example.com', assignedRegions: ['CALABARZON'], isActive: true, assignmentLevel: 'REGION' });
    await HierarchicalUserAssignment.create({ userId: 'userB', userName: 'B', email: 'b@example.com', assignedRegions: ['MARIIS'], isActive: true, assignmentLevel: 'REGION' });
    // Create a non-BRD initiator
    await HierarchicalUserAssignment.create({ userId: 'initiator', userName: 'I', email: 'i@example.com', isActive: true, assignmentLevel: 'DIVISION' });

    const notifications = [{ userId: 'BUDGET MANAGER', title: 'Test NIA', message: 'test nia', metadata: { niaWide: true } }];
    const created = await notificationController.createNotifications(notifications, { initiatorUserId: 'initiator' });
    // Should be empty since initiator is not BRD-level
    expect(created.length).toBe(0);
  });

  test('NIA-wide send allowed for BRD initiator', async () => {
    await HierarchicalUserAssignment.create({ userId: 'userA', userName: 'A', email: 'a@example.com', assignedRegions: ['CALABARZON'], isActive: true, assignmentLevel: 'REGION' });
    await HierarchicalUserAssignment.create({ userId: 'userB', userName: 'B', email: 'b@example.com', assignedRegions: ['MARIIS'], isActive: true, assignmentLevel: 'REGION' });
    // Create a BRD initiator
    await HierarchicalUserAssignment.create({ userId: 'brd', userName: 'BRD', email: 'brd@example.com', isActive: true, assignmentLevel: 'BUDGET_AND_REVENUE_DIVISION', workflowRoles: ['budgetAnalyst'] });

    const notifications = [{ userId: 'BUDGET MANAGER', title: 'Test NIA', message: 'test nia', metadata: { niaWide: true } }];
    const created = await notificationController.createNotifications(notifications, { initiatorUserId: 'brd' });
    // both users should have notifications
    const all = await Notification.find({});
    expect(all.length).toBeGreaterThanOrEqual(2);
  });
});
