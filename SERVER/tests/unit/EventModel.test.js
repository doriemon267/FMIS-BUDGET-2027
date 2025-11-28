const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { RRule } = require('rrule');

let mongoServer;
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  process.env.MONGODB_URI = uri;
  await mongoose.connect(uri, {});
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

test('Event.nextOccurrenceFrom should return next occurrence for rrule', async () => {
  const Event = require('../../models/Event');

  // Create event with recurrence daily
  const now = new Date();
  const dt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
  const rule = new RRule({ freq: RRule.DAILY, interval: 1, dtstart: dt });
  const ev = new Event({ owner: 'user-1', title: 'Recurring Test', dateTime: dt, timezone: 'UTC', recurrence: { rrule: rule.toString() } });
  await ev.save();

  // next occurrence should be dt + 1 day
  const from = new Date(dt.getTime() + 1000);
  const next = ev.nextOccurrenceFrom(from);
  expect(next).toBeTruthy();
  expect(next.getUTCDate()).toBe(new Date(dt.getTime() + 24 * 3600 * 1000).getUTCDate());
});
