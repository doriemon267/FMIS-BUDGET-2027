const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;
let app;
const Event = require('../../models/Event');
const { initAgenda } = require('../../schedulers/agenda');

describe('Events integration tests', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    process.env.MONGODB_URI = uri;
    process.env.JWT_SECRET_KEY = 'test-secret';

    await mongoose.connect(uri, {});
    const express = require('express');
    app = express();
    app.use(express.json());
    const eventsRouter = require('../../routers/eventsRouter');
    app.use('/api/events', eventsRouter);
    agenda = await initAgenda({ mongoConnection: mongoose.connection });
  }, 30000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  afterEach(async () => {
    await Event.deleteMany({});
  });

  test('should create an event and return it', async () => {
    const token = jwt.sign({ Username: ['user-abc'], username: 'user-abc', roles: ['BUDGET_MANAGER'] }, process.env.JWT_SECRET_KEY);
    const dt = new Date(Date.now() + 60 * 1000).toISOString();
    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Test Event', dateTime: dt, preReminders: [1], notify: true })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.title).toBe('Test Event');
    // ensure saved in DB
    const saved = await Event.findById(res.body.data._id).lean();
    expect(saved).toBeTruthy();
    expect(saved.title).toBe('Test Event');
    expect(Array.isArray(saved.jobIds)).toBeTruthy();
    expect(saved.jobIds.length).toBeGreaterThanOrEqual(1);
  });

  test('should trigger notification job using agenda.now', async () => {
    const token = jwt.sign({ Username: ['user-abc'], username: 'user-abc', roles: ['BUDGET_MANAGER'] }, process.env.JWT_SECRET_KEY);
    const dt = new Date(Date.now() + 60 * 1000).toISOString();
    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Immediate Event', dateTime: dt, notify: true })
      .expect(200);

    const id = res.body.data._id;
    // Trigger the job immediately
    await agenda.now('calendar:send-notification', { eventId: id });

    // Wait for short time to let the job run and write Notification
    await new Promise((r) => setTimeout(r, 1000));

    const Notification = require('../../models/Notification');
    const docs = await Notification.find({ relatedEntityId: id }).lean();
    expect(docs.length).toBeGreaterThanOrEqual(1);
  }, 15000);

  test('should delete an event', async () => {
    const token = jwt.sign({ Username: ['user-abc'], username: 'user-abc', roles: ['BUDGET_MANAGER'] }, process.env.JWT_SECRET_KEY);
    const dt = new Date(Date.now() + 60 * 1000).toISOString();
    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Event to Delete', dateTime: dt, notify: true })
      .expect(200);

    const id = res.body.data._id;
    await request(app)
      .delete(`/api/events/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const doc = await Event.findById(id).lean();
    expect(doc).toBeNull();
  });
});
