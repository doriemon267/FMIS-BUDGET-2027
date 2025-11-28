const Agenda = require('agenda');
const mongoose = require('mongoose');
const Event = require('../models/Event');
const Notification = require('../models/Notification');
const { RRule } = require('rrule');

let agenda = null;

const initAgenda = async ({ mongoConnection } = {}) => {
  // If agenda already initialized, reuse
  if (agenda) return agenda;
  // Accept either a mongoose connection or a mongo connection string
  const mongo = (mongoConnection && mongoConnection.client) ? mongoConnection.client.s.url : process.env.MONGODB_URI;
  agenda = new Agenda({ db: { address: mongo || process.env.MONGODB_URI, collection: 'agendaJobs' }, processEvery: '1 minute' });

  // Define job: send main notification
  agenda.define('calendar:send-notification', async (job) => {
    const { eventId } = job.attrs.data || {};
    if (!eventId) return;
    const ev = await Event.findById(eventId);
    if (!ev) return;
    if (!ev.notify) return;
    if (ev.status === 'CANCELLED') return;

    // Emit via socket.io
    try {
      const payload = { type: 'event', event: { _id: String(ev._id), title: ev.title, description: ev.description, dateTime: ev.dateTime, timezone: ev.timezone } };
      if (global && global.io) {
        global.io.to(`user_${ev.owner}`).emit('calendar:event', payload);
      }
      // Persist in-app notification
      await Notification.create({ recipientUserId: ev.owner, title: `Event: ${ev.title}`, message: ev.description || '', relatedEntityId: String(ev._id), relatedEntityType: 'CALENDAR_EVENT', status: 'UNREAD', createdBy: ev.createdBy });
      // Mark event as triggered unless recurrence
      if (!ev.recurrence || !ev.recurrence.rrule) {
        ev.status = 'TRIGGERED';
      }
      ev.recurrence = ev.recurrence || {};
      ev.recurrence.lastTriggeredAt = new Date();
      await ev.save();

      // If recurrence, compute next occurrence and schedule another job
      if (ev.recurrence && ev.recurrence.rrule) {
        try {
          const rule = RRule.fromString(ev.recurrence.rrule);
          const next = rule.after(new Date(), false);
          if (next) {
            // schedule next event
            const newJob = await agenda.schedule(next, 'calendar:send-notification', { eventId: String(ev._id) });
            ev.jobIds = (ev.jobIds || []).concat(String(newJob.attrs._id));
            await ev.save();
          }
        } catch (e) {
          console.error('Failed to compute recurrence next occurrence', e.stack || e);
        }
      }
    } catch (err) {
      console.error('Failed to handle calendar notification job', err.stack || err);
    }
  });

  // Define job: send prereminder
  agenda.define('calendar:send-prereminder', async (job) => {
    const { eventId, minutesBefore } = job.attrs.data || {};
    if (!eventId) return;
    const ev = await Event.findById(eventId);
    if (!ev) return;
    if (!ev.notify) return;
    if (ev.status === 'CANCELLED') return;

    try {
      const payload = { type: 'prereminder', minutesBefore, event: { _id: String(ev._id), title: ev.title, dateTime: ev.dateTime, timezone: ev.timezone } };
      if (global && global.io) {
        global.io.to(`user_${ev.owner}`).emit('calendar:prereminder', payload);
      }
      await Notification.create({ recipientUserId: ev.owner, title: `Reminder: ${ev.title} in ${minutesBefore} minutes`, message: ev.description || '', relatedEntityId: String(ev._id), relatedEntityType: 'CALENDAR_EVENT', status: 'UNREAD', createdBy: ev.createdBy });
    } catch (err) {
      console.error('Failed to handle prereminder job', err.stack || err);
    }
  });

  await agenda.start();

  // On startup, ensure events with future times have jobs scheduled
  (async function scheduleUpcoming() {
    try {
      const now = new Date();
      const upcomingEvents = await Event.find({ dateTime: { $gte: now }, notify: true }).limit(500).lean();
      for (const ev of upcomingEvents) {
        // Skip if jobIds exist
        if (ev.jobIds && ev.jobIds.length) continue;
        // Schedule main job
        const savedEv = await Event.findById(ev._id);
        if (!savedEv) continue;
        const jobIds = [];
        const mainJob = await agenda.schedule(savedEv.dateTime, 'calendar:send-notification', { eventId: String(savedEv._id) });
        jobIds.push(String(mainJob.attrs._id));
        // pre reminders
        if (savedEv.preReminders && savedEv.preReminders.length) {
          for (const minutes of savedEv.preReminders) {
            const t = new Date(savedEv.dateTime.getTime() - minutes * 60000);
            if (t > now) {
              const pre = await agenda.schedule(t, 'calendar:send-prereminder', { eventId: String(savedEv._id), minutesBefore: Number(minutes) });
              jobIds.push(String(pre.attrs._id));
            }
          }
        }
        savedEv.jobIds = (savedEv.jobIds || []).concat(jobIds);
        await savedEv.save();
      }
    } catch (e) {
      console.error('Failed scheduling upcoming events', e.stack || e);
    }
  })();

  return agenda;
};

const scheduleEventJobs = async (event) => {
  if (!agenda) await initAgenda({ mongoConnection: mongoose.connection });
  const jobIds = [];
  // schedule main notification
  const mainJob = await agenda.schedule(event.dateTime, 'calendar:send-notification', { eventId: String(event._id) });
  jobIds.push(String(mainJob.attrs._id));
  // schedule pre reminders
  if (event.preReminders && event.preReminders.length) {
    for (const minutes of event.preReminders) {
      const when = new Date(event.dateTime.getTime() - minutes * 60000);
      if (when > new Date()) {
        const preJob = await agenda.schedule(when, 'calendar:send-prereminder', { eventId: String(event._id), minutesBefore: Number(minutes) });
        jobIds.push(String(preJob.attrs._id));
      }
    }
  }
  return jobIds;
};

const cancelEventJobs = async (eventId, jobIds = []) => {
  if (!agenda) await initAgenda({ mongoConnection: mongoose.connection });
  if (!Array.isArray(jobIds)) jobIds = [jobIds];
  for (const id of jobIds) {
    try {
      // Try canceling by _id (may be ObjectId in agenda collection)
      await agenda.cancel({ _id: id });
    } catch (e1) {
      // Try by string cast
      try {
        await agenda.cancel({ _id: String(id) });
      } catch (e2) {
        console.error('Failed to cancel agenda job', id, e2.stack || e2);
      }
    }
  }
  // Also attempt to cancel any jobs that were scheduled for this event via data property
  try {
    await agenda.cancel({ 'data.eventId': String(eventId) });
  } catch (e) {
    console.error('Failed to cancel jobs by eventId', e.stack || e);
  }
};

module.exports = { initAgenda, scheduleEventJobs, cancelEventJobs };
