const Message = require('../models/Message');
const { resolveUserIdentity } = require('../utils/requestContext');

/**
 * Get recent conversations for current user (grouped by peer)
 */
async function getConversations(req, res) {
  try {
    const userId = (req.user && (req.user.Id || req.user.id || req.user.userId || (Array.isArray(req.user?.Username) ? req.user.Username[0] : req.user?.Username))) || req.query.userId || null;
    if (!userId) return res.status(400).json({ message: 'Missing user id' });
    if (process.env.DEBUG_MODE === 'true' || process.env.ALLOW_MOCK_AUTH === 'true') {
      // console.debug('[chatController] getConversations request userId:', userId, 'req.user:', req.user ? { Id: req.user.Id, id: req.user.id, userId: req.user.userId } : null);
    }
    // Pagination params
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.max(10, Math.min(100, parseInt(req.query.limit || '20', 10)));
    const skip = (page - 1) * limit;

    // Database connection diagnostic: check mongoose connection state
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      console.error('[chatController] getConversations: DB not connected (readyState=' + mongoose.connection.readyState + ').');
      // Return a graceful response for UI development so the client can display a message instead of throwing an axios 500.
      return res.json({ conversations: [], page, limit, dbConnected: false, message: 'Database not connected' });
    }

    // Aggregate last message by peer
    let peers = [];
    try {
      peers = await Message.aggregate([
      { $match: { 
        $or: [{ from: userId }, { to: userId }],
        deletedFor: { $ne: userId }
      }},
      { $sort: { createdAt: -1 } },
      {
        $project: {
          peer: { $cond: [{ $eq: ['$from', userId] }, '$to', '$from'] },
          from: 1,
          to: 1,
          text: 1,
          read: 1,
          createdAt: 1,
        },
      },
      {
        $group: {
          _id: '$peer',
          lastMessage: { $first: '$text' },
          lastAt: { $first: '$createdAt' },
          from: { $first: '$from' },
          to: { $first: '$to' },
          read: { $first: '$read' },
        },
      },
      { $sort: { lastAt: -1 } },
      { $skip: skip },
      { $limit: limit }
    ]);
    } catch (aggErr) {
      console.error('[chatController] Message.aggregate failed:', aggErr.stack || aggErr);
      // If aggregation fails due to DB issues, return a graceful response for dev
      if (aggErr.name && (aggErr.name.includes('Mongo') || aggErr.name.includes('MongoServer')) || (aggErr.message && aggErr.message.toLowerCase().includes('server selection'))) {
        return res.json({ conversations: [], page, limit, dbConnected: false, message: 'Database aggregation failed (not connected?)' });
      }
      throw aggErr; // rethrow for other unexpected errors
    }

    // Also compute unread counts per peer
    let unreadAgg = [];
    try {
      unreadAgg = await Message.aggregate([
      { $match: { to: userId, read: false } },
      { $group: { _id: '$from', unread: { $sum: 1 } } }
    ]);
    } catch (unreadErr) {
      console.error('[chatController] unread Message.aggregate failed:', unreadErr.stack || unreadErr);
      if (unreadErr.name && (unreadErr.name.includes('Mongo') || unreadErr.name.includes('MongoServer')) || (unreadErr.message && unreadErr.message.toLowerCase().includes('server selection'))) {
        return res.json({ conversations: [], page, limit, dbConnected: false, message: 'Database aggregation failed (not connected?)' });
      }
      throw unreadErr;
    }
    const unreadMap = unreadAgg.reduce((acc, cur) => { acc[cur._id] = cur.unread; return acc; }, {});

    // Enrich with user details (prefer hierarchical assignments for display names)
    const User = require('../models/User');
    const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
    const peerIds = (peers || []).map(p => String(p._id));
      // Separate peerIds into valid ObjectId values and non-ObjectId userIds
      const objectIdPeerIds = peerIds.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => mongoose.Types.ObjectId(id));
      const stringPeerIds = peerIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
      if (process.env.DEBUG_MODE === 'true' || process.env.ALLOW_MOCK_AUTH === 'true') {
        // console.debug('[chatController] peerIds split -> objectIdPeerIds:', objectIdPeerIds, 'stringPeerIds:', stringPeerIds);
      }
    if (!peerIds || peerIds.length === 0) {
      if (process.env.DEBUG_MODE === 'true' || process.env.ALLOW_MOCK_AUTH === 'true') 
        // console.debug('[chatController] getConversations: No peers found - returning empty conversations');
      return res.json({ conversations: [], page, limit });
    }
    // Debug logging
    if (process.env.DEBUG_MODE === 'true' || process.env.ALLOW_MOCK_AUTH === 'true') {
      // console.debug('[chatController] getConversations -> peerIds:', peerIds);
    }
      const assigns = await HierarchicalUserAssignment.find({ userId: { $in: peerIds } }).lean();
    if (!assigns || assigns.length === 0) {
      if (process.env.DEBUG_MODE === 'true' || process.env.ALLOW_MOCK_AUTH === 'true');
        //  console.debug('[chatController] getConversations: No assignments found for peerIds:', peerIds);
    }
    if (process.env.DEBUG_MODE === 'true' || process.env.ALLOW_MOCK_AUTH === 'true') {
      // console.debug('[chatController] assignments found for peerIds:', assigns.map(a => a.userId));
    }
    const assignMap = assigns.reduce((acc, a) => { acc[a.userId] = a; return acc; }, {});
      const userQueryOrs = [{ userId: { $in: stringPeerIds } }];
      if (objectIdPeerIds.length > 0) userQueryOrs.push({ _id: { $in: objectIdPeerIds } });
      const users = await User.find({ $or: userQueryOrs }).lean();
    if (!users || users.length === 0) {
      if (process.env.DEBUG_MODE === 'true' || process.env.ALLOW_MOCK_AUTH === 'true') ;
        // console.debug('[chatController] getConversations: No user documents found for peerIds:', peerIds);
    }
    const userMap = users.reduce((acc, u) => { acc[u.userId || String(u._id)] = u; return acc; }, {});
    if (process.env.DEBUG_MODE === 'true' || process.env.ALLOW_MOCK_AUTH === 'true') {
      // console.debug('[chatController] users mapped:', Object.keys(userMap));
    }
    // Build conversation list with resolved display names (try assign -> user -> resolveUserIdentity fallback)
    const conversations = [];
    for (const p of peers) {
      const uid = String(p._id);
      const user = userMap[uid] || {};
      const assign = assignMap[uid] || {};
      let name = assign.userName || user.name || null;
      let email = assign.email || user.email || null;
      // If name not available, attempt to resolve identity from directory/cache
      if (!name) {
        try {
          const identity = await resolveUserIdentity({ user: { userId: uid } });
          if (identity && identity.displayName) name = identity.displayName;
          if (!email && identity && identity.email) email = identity.email;
        } catch (e) {
          // ignore
        }
      }
      const finalName = name || uid;
      if (!assign && !user && process.env.DEBUG_MODE === 'true') {
        // console.debug('[chatController] getConversations: no assign/user for uid', uid, 'using fallback name', finalName);
      }
      conversations.push({ id: uid, lastMessage: p.lastMessage, lastAt: p.lastAt, unread: unreadMap[uid] || 0, name: finalName, email });
    }
    return res.json({ conversations, page, limit });
  } catch (error) {
    console.error('Error getConversations', error.stack || error);
    if (process.env.DEBUG_MODE === 'true') {
      // Provide more structured error info in dev
      return res.status(500).json({ message: 'Server error', error: error.message, stack: error.stack });
    }
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
}

/**
 * Get messages between current user and other user
 */
async function getMessagesWithUser(req, res) {
  try {
    const userId = (req.user && (req.user.Id || req.user.id || req.user.userId || req.user.Username)) || null;
    const otherId = req.params.userId;
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.max(10, Math.min(200, parseInt(req.query.limit || '50', 10)));
    const skip = (page - 1) * limit;
    if (!userId || !otherId) return res.status(400).json({ message: 'Missing user(s) id' });

    // Fetch latest messages first for pagination, then reverse so UI shows oldest->newest after insertion
    const messagesDesc = await Message.find({ $or: [{ from: userId, to: otherId }, { from: otherId, to: userId }] }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
    const messages = messagesDesc.reverse();
    const total = await Message.countDocuments({ $or: [{ from: userId, to: otherId }, { from: otherId, to: userId }] });
    const totalPages = Math.max(1, Math.ceil(total / limit));
    return res.json({ messages, page, limit, total, totalPages });
  } catch (error) {
    console.error('Error getMessagesWithUser', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
}

async function markMessagesRead(req, res) {
  try {
    const toUserId = (req.user && (req.user.Id || req.user.id || req.user.userId || req.user.Username)) || null;
    const fromUserId = req.params.userId;
    if (!toUserId || !fromUserId) return res.status(400).json({ message: 'Missing user(s) id' });
    const result = await Message.updateMany({ from: fromUserId, to: toUserId, read: false }, { $set: { read: true, readAt: new Date() } });
    // Emit read receipts
    try {
      if (global && global.io) {
        global.io.to(`user_${fromUserId}`).emit('message-read', { from: fromUserId, to: toUserId, count: result.nModified || result.modifiedCount || 0, lastReadAt: new Date() });
      }
    } catch (e) {
      console.warn('Could not emit message-read', e.message);
    }
    return res.json({ updated: result.nModified || result.modifiedCount || 0 });
  } catch (error) {
    console.error('Error markMessagesRead', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
}

async function searchContacts(req, res) {
  try {
    const q = String(req.query.q || '').trim();
    const limit = Math.max(10, Math.min(100, parseInt(req.query.limit || '20', 10)));
      const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
      if (!q) {
        // Return active assignments scoped for current user per current user's assignment scope
        const currentUserId = req.user && (req.user.Id || req.user.id || req.user.userId);
        let scopeFilter = { isActive: true };
        try {
          const myAssign = await HierarchicalUserAssignment.getUserPermissions(String(currentUserId));
          if (myAssign) {
            if (myAssign.regionId) scopeFilter.regionId = myAssign.regionId._id || myAssign.regionId;
            if (myAssign.departmentId) scopeFilter.departmentId = myAssign.departmentId._id || myAssign.departmentId;
            if (myAssign.divisionName) scopeFilter.divisionName = myAssign.divisionName;
          }
        } catch (e) {
          // fallback: return all active
        }
        const assignments = await HierarchicalUserAssignment.find(scopeFilter).limit(limit).lean();
        const contacts = assignments.map(a => ({ id: a.userId, name: a.userName, email: a.email }));
        return res.json({ contacts });
      }
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const currentUserId = req.user && (req.user.Id || req.user.id || req.user.userId);
      let scopeFilter = { isActive: true, $or: [{ userName: regex }, { userId: regex }, { email: regex }] };
      try {
        const myAssign = await HierarchicalUserAssignment.getUserPermissions(String(currentUserId));
        if (myAssign) {
          if (myAssign.regionId) scopeFilter.regionId = myAssign.regionId._id || myAssign.regionId;
          if (myAssign.departmentId) scopeFilter.departmentId = myAssign.departmentId._id || myAssign.departmentId;
          if (myAssign.divisionName) scopeFilter.divisionName = myAssign.divisionName;
        }
      } catch (e) {
        // ignore
      }
      const assignments = await HierarchicalUserAssignment.find(scopeFilter).limit(limit).lean();
    const contacts = assignments.map(a => ({ id: a.userId, name: a.userName, email: a.email }));
    return res.json({ contacts });
  } catch (error) {
    console.error('Error searchContacts', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
}

async function getPresence(req, res) {
  try {
    const ids = String(req.query.ids || '').split(',').map(s => s.trim()).filter(Boolean);
    if (process.env.DEBUG_MODE === 'true' || process.env.ALLOW_MOCK_AUTH === 'true') {
      // console.debug('[chatController] getPresence for ids:', ids);
    }
    const online = {};
    ids.forEach(id => {
      const info = (global.onlineUsers && global.onlineUsers.get(String(id))) || { count: 0, lastConnectedAt: null };
      online[id] = { online: info.count > 0, count: info.count, lastConnectedAt: info.lastConnectedAt };
    });
    if (process.env.DEBUG_MODE === 'true' || process.env.ALLOW_MOCK_AUTH === 'true') {
      // console.debug('[chatController] getPresence results:', online);
    }
    return res.json({ online });
  } catch (error) {
    console.error('Error getPresence', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
}

/**
 * Send a message from authenticated user to recipient
 */
async function sendMessage(req, res) {
  try {
    const userId = (req.user && (req.user.Id || req.user.id || req.user.userId || req.user.Username)) || null;
    const { to, text, metadata } = req.body || {};
    if (!userId || !to || !text) return res.status(400).json({ message: 'Missing fields' });

    const message = await Message.create({ from: userId, to, text, metadata });
    // Add sender's name to the message payload for client notification
    try {
      const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
      const User = require('../models/User');
      let fromName = null;
      const assign = await HierarchicalUserAssignment.findOne({ userId: String(userId) }).lean();
      if (assign?.userName) fromName = assign.userName;
      if (!fromName) {
        const u = await User.findOne({ userId: String(userId) }).lean();
        fromName = u?.name || null;
      }
      if (fromName) {
        message.metadata = message.metadata || {};
        message.metadata.fromName = fromName;
      }
    } catch (e) {
      // ignore
    }

    // Emit to recipient room
    try {
      if (global && global.io) {
        global.io.to(`user_${to}`).emit('chat-message', message);
        global.io.to(`user_${userId}`).emit('chat-message', message);
      }
    } catch (e) {
      console.warn('Could not emit socket message', e.message);
    }

    return res.status(201).json({ message });
  } catch (error) {
    console.error('Error sendMessage', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
}

// Delete message
async function deleteMessage(req, res) {
  try {
    const userId = (req.user && (req.user.Id || req.user.id || req.user.userId)) || req.query.userId;
    if (!userId) return res.status(400).json({ message: 'Missing user id' });
    const { messageId } = req.params;
    const { deleteForEveryone } = req.body;
    
    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: 'Message not found' });
    
    if (deleteForEveryone) {
      // Only the sender can delete for everyone
      if (String(message.from) !== String(userId)) {
        return res.status(403).json({ message: 'You can only delete your own messages for everyone' });
      }
      await Message.findByIdAndDelete(messageId);
      return res.json({ message: 'Message deleted for everyone' });
    } else {
      // Delete for current user only
      await Message.findByIdAndUpdate(messageId, {
        $addToSet: { deletedFor: String(userId) }
      });
      return res.json({ message: 'Message deleted for you' });
    }
  } catch (error) {
    console.error('Error deleteMessage', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
}

// Delete conversation
async function deleteConversation(req, res) {
  try {
    const userId = (req.user && (req.user.Id || req.user.id || req.user.userId)) || req.query.userId;
    if (!userId) return res.status(400).json({ message: 'Missing user id' });
    const { peerId } = req.params;
    const { deleteForEveryone } = req.body;
    
    if (deleteForEveryone) {
      // Delete all messages in this conversation permanently
      await Message.deleteMany({
        $or: [{ from: userId, to: peerId }, { from: peerId, to: userId }]
      });
      return res.json({ message: 'Conversation deleted for everyone' });
    } else {
      // Mark all messages with this peer as deleted for current user only
      await Message.updateMany(
        { $or: [{ from: userId, to: peerId }, { from: peerId, to: userId }] },
        { $addToSet: { deletedFor: String(userId) } }
      );
      return res.json({ message: 'Conversation deleted for you' });
    }
  } catch (error) {
    console.error('Error deleteConversation', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
}

module.exports = { getConversations, getMessagesWithUser, sendMessage, markMessagesRead, searchContacts, getPresence, deleteMessage, deleteConversation };
// Export debugDump as well (dev only)
module.exports.debugDump = debugDump;

// Debug: Dump presence and other small diagnostic info - dev only
async function debugDump(req, res) {
  try {
    const onlineMap = {};
    if (global && global.onlineUsers) {
      global.onlineUsers.forEach((info, userId) => { onlineMap[String(userId)] = info; });
    }
    const recentMessages = await Message.find().sort({ createdAt: -1 }).limit(30).lean();
    const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
    const assigns = await HierarchicalUserAssignment.find().limit(200).lean();
    return res.json({ online: onlineMap, recentMessages, assignments: assigns, count: Object.keys(onlineMap).length });
  } catch (e) {
    console.error('chat debug dump failed', e.message || e);
    return res.status(500).json({ message: 'Server error', error: e.message || e });
  }
}

module.exports.debugDump = debugDump;
