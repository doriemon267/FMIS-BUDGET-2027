const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Notification = require('../../models/Notification');
const normalizeRecipientIds = require('../../scripts/normalize-recipient-userids');

describe('Migration normalize-recipient-userids', () => {
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

  test('should normalize role-like recipientUserId values to recipientUserIdNormalized', async () => {
    // Insert documents directly via collection to bypass Mongoose hooks (simulate legacy rows)
    await Notification.collection.insertMany([
      { recipientUserId: 'BUDGET MANAGER', title: 'A', status: 'UNREAD', createdAt: new Date() },
      { recipientUserId: 'Budget_Manager', title: 'B', status: 'UNREAD', createdAt: new Date() },
      { recipientUserId: 'user-123', title: 'C', status: 'UNREAD', createdAt: new Date() }
    ]);

    const updated = await normalizeRecipientIds();
    expect(updated).toBeGreaterThanOrEqual(2);

  const docs = await Notification.find({}).lean();
    const normalized = docs.map(d => d.recipientUserIdNormalized);
    expect(normalized.filter(Boolean).length).toBeGreaterThanOrEqual(2);
  });
});
