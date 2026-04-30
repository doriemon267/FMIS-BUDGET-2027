const router = require('express').Router();
const authMiddleware = require("../middleware/authMiddleware");

const Event = require('../models/Event');
const Notification = require('../models/Notification');
const { scheduleEventJobs, cancelEventJobs } = require('../schedulers/agenda');

// Protect routes
router.use(authMiddleware);

// List events for current user
router.get('/', async (req, res) => {
  try {
    const ownerId = req.user?.id || req.user?.userId;
    const events = await Event.find({ owner: ownerId }).sort({ dateTime: 1 }).lean();
    res.json({ success: true, data: events });
  } catch (e) {
    console.error('Failed to list events', e.stack || e);
    res.status(500).json({ success: false, message: e.message });
  }
});

// Create event
router.post('/', async (req, res) => {
  try {
    const ownerId = req.user?.id || req.user?.userId;
    const body = req.body || {};
    if (!body.title || !body.dateTime) return res.status(400).json({ success: false, message: 'title and dateTime are required' });
    // Ensure date parse
    const dt = new Date(body.dateTime);
    if (Number.isNaN(dt.getTime())) return res.status(400).json({ success: false, message: 'Invalid dateTime' });

    const eventDoc = new Event({
      owner: ownerId,
      title: body.title,
      description: body.description || '',
      dateTime: dt,
      timezone: body.timezone || 'UTC',
      notify: body.notify !== undefined ? !!body.notify : true,
      channels: Array.isArray(body.channels) ? body.channels : ['in-app'],
      preReminders: Array.isArray(body.preReminders) ? body.preReminders.map(Number) : [],
      recurrence: body.recurrence || null,
      createdBy: { userId: ownerId, name: req.user?.name }
    });
    const saved = await eventDoc.save();

    // schedule jobs if notify is true
    if (saved.notify) {
      try {
        const jobIds = await scheduleEventJobs(saved);
        if (jobIds && jobIds.length) {
          saved.jobIds = jobIds;
          await saved.save();
        }
      } catch (jobErr) {
        console.error('Failed to schedule event jobs for event', saved._id, jobErr.stack || jobErr);
      }
    }

    res.json({ success: true, data: saved });
  } catch (e) {
    console.error('Failed to create event', e.stack || e);
    res.status(500).json({ success: false, message: e.message });
  }
});

// Get a single event
router.get('/:id', async (req, res) => {
  try {
    const ownerId = req.user?.id || req.user?.userId;
    const ev = await Event.findOne({ _id: req.params.id, owner: ownerId }).lean();
    if (!ev) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: ev });
  } catch (e) {
    console.error('Failed to get event', e.stack || e);
    res.status(500).json({ success: false, message: e.message });
  }
});

// Update event
router.put('/:id', async (req, res) => {
  try {
    const ownerId = req.user?.id || req.user?.userId;
    const ev = await Event.findOne({ _id: req.params.id, owner: ownerId });
    if (!ev) return res.status(404).json({ success: false, message: 'Not found' });

    const body = req.body || {};
    if (body.title) ev.title = body.title;
    if (body.description !== undefined) ev.description = body.description;
    if (body.dateTime) {
      const d = new Date(body.dateTime);
      if (Number.isNaN(d.getTime())) return res.status(400).json({ success: false, message: 'Invalid dateTime' });
      ev.dateTime = d;
    }
    if (body.timezone) ev.timezone = body.timezone;
    if (body.notify !== undefined) ev.notify = !!body.notify;
    if (body.channels) ev.channels = Array.isArray(body.channels) ? body.channels : ev.channels;
    if (body.preReminders) ev.preReminders = Array.isArray(body.preReminders) ? body.preReminders.map(Number) : ev.preReminders;
    if (body.recurrence !== undefined) ev.recurrence = body.recurrence;

    await ev.save();

    // reschedule jobs: cancel existing then schedule new ones
    try {
      await cancelEventJobs(ev._id, ev.jobIds || []);
      ev.jobIds = [];
      if (ev.notify) {
        const jobIds = await scheduleEventJobs(ev);
        ev.jobIds = jobIds;
        await ev.save();
      }
    } catch (schErr) {
      console.error('Failed to reschedule jobs for event', ev._id, schErr.stack || schErr);
    }

    res.json({ success: true, data: ev });
  } catch (e) {
    console.error('Failed to update event', e.stack || e);
    res.status(500).json({ success: false, message: e.message });
  }
});

// Delete event
router.delete('/:id', async (req, res) => {
  try {
    const ownerId = req.user?.id || req.user?.userId;
    const ev = await Event.findOne({ _id: req.params.id, owner: ownerId });
    if (!ev) return res.status(404).json({ success: false, message: 'Not found' });

    try {
      await cancelEventJobs(ev._id, ev.jobIds || []);
    } catch (cErr) {
      console.error('Failed to cancel event jobs for event', ev._id, cErr.stack || cErr);
    }

    await Event.deleteOne({ _id: ev._id });
    res.json({ success: true });
  } catch (e) {
    console.error('Failed to delete event', e.stack || e);
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;
