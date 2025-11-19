const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Notification = require('../../models/Notification');
const notificationController = require('../../controllers/notificationController');

describe('Notification controller createNotification', () => {
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
  });

  test('createNotification should set recipientUserIdNormalized and recipientUserIdOriginal', async () => {
    const n = await notificationController.createNotification({
      userId: 'Budget Manager',
      title: 'Test',
      message: 'Test message',
    });
    expect(n.recipientUserIdNormalized).toBe('BUDGET_MANAGER');
    expect(n.recipientUserIdOriginal).toBe('Budget Manager');
  });
});
