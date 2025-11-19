const Notification = require('../models/Notification');
const User = require('../models/User');

const normalizeRecipientId = (val) => {
  if (!val || typeof val !== 'string') return null;
  if (val.includes('@')) return null; // skip emails
  if (/^[0-9a-fA-F\-]{8,}$/.test(val)) return null; // likely UUID
  return val.trim().toUpperCase().replace(/\s+/g, '_').replace(/[\/\-]+/g, '_').replace(/[^A-Z0-9_]/g, '_');
};

/**
 * Create a new notification
 * @param {Object} notificationData - The notification data
 * @param {string} notificationData.userId - The recipient user ID
 * @param {string} notificationData.type - The notification type
 * @param {string} notificationData.title - The notification title
 * @param {string} notificationData.message - The notification message
 * @param {string} notificationData.relatedId - Related entity ID (optional)
 * @param {string} notificationData.relatedType - Related entity type (optional)
 * @param {Object} notificationData.metadata - Additional metadata (optional)
 * @returns {Promise<Object>} The created notification
 */
exports.createNotification = async (notificationData) => {
  try {
    // If unique key is provided in metadata, prevent duplicate UNREAD notifications for the same recipient
    const uniqueKey = notificationData.metadata?.uniqueKey;
    if (uniqueKey) {
      try {
        const existing = await Notification.findOne({
          recipientUserId: notificationData.userId,
          status: 'UNREAD',
          'metadata.uniqueKey': uniqueKey
        }).lean();
        if (existing) return existing;
      } catch (err) {
        console.warn('Notification dedupe check failed', err.message);
      }
    }
    

    const notification = new Notification({
      recipientUserId: notificationData.userId,
  recipientUserIdNormalized: normalizeRecipientId(notificationData.userId),
      recipientUserIdOriginal: notificationData.userId,
      type: notificationData.type || 'INFO',
      title: notificationData.title,
      message: notificationData.message,
      relatedEntityId: notificationData.relatedId,
      relatedEntityType: notificationData.relatedType,
      relatedLink: notificationData.relatedLink,
      metadata: notificationData.metadata || {},
      status: 'UNREAD',
      createdAt: new Date()
    });
    
    await notification.save();
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

/**
 * Create multiple notifications
 * @param {Array<Object>} notificationsData - Array of notification data objects
 * @returns {Promise<Array<Object>>} The created notifications
 */
exports.createNotifications = async (notificationsData) => {
  try {
    // Dedupe per recipient + uniqueKey if provided in metadata
    const notifications = [];
    for (const data of notificationsData) {
      const uniqueKey = data.metadata?.uniqueKey;
      if (uniqueKey) {
        try {
          const exists = await Notification.findOne({
            recipientUserId: data.userId,
            status: 'UNREAD',
            'metadata.uniqueKey': uniqueKey
          }).lean();
          if (exists) continue;
        } catch (err) {
          console.warn('Notification bulk dedupe check failed', err.message);
        }
      }
      // If data.userId looks like a role identifier (e.g., 'BUDGET_MANAGER', 'BUDGET MANAGER') expand it
      const recipientId = data.userId;
      const isRoleCandidate = (val) => {
        if (!val || typeof val !== 'string') return false;
        const v = val.trim();
        // Typical role strings are uppercase and may contain spaces or underscores
        if (/^[A-Z_\s]+$/.test(v) && v.length <= 64) return true;
        // Also support known role prefixes
        if (/BUDGET|OFFICER|REVIEWER|APPROVER|ANALYST|MANAGER/i.test(v)) return true;
        return false;
      };

      if (isRoleCandidate(recipientId)) {
        // Expand the role into user ids by querying User model
        try {
          const users = await User.find({ roles: { $in: [recipientId, recipientId.toUpperCase()] } }).select('userId');
          for (const u of users) {
            const uid = u.userId || String(u._id);
            const uniqueKeyPerRecipient = uniqueKey || null;
            if (uniqueKeyPerRecipient) {
              const exists = await Notification.findOne({ recipientUserId: uid, status: 'UNREAD', 'metadata.uniqueKey': uniqueKeyPerRecipient }).lean();
              if (exists) continue;
            }
            notifications.push({
              recipientUserId: uid,
              recipientUserIdNormalized: normalizeRecipientId(uid),
              recipientUserIdOriginal: uid,
              type: data.type || 'INFO',
              title: data.title,
              message: data.message,
              relatedEntityId: data.relatedId,
              relatedEntityType: data.relatedType,
              relatedLink: data.relatedLink,
              metadata: data.metadata || {},
              status: 'UNREAD',
              createdAt: new Date()
            });
          }
          continue; // skip the original push below because we've handled role expansion
        } catch (err) {
          console.warn('[createNotifications] Role expansion failed, proceeding to add original recipient', err.message);
        }
      }

      notifications.push({
        recipientUserId: data.userId,
        recipientUserIdNormalized: normalizeRecipientId(data.userId),
        recipientUserIdOriginal: data.userId,
        type: data.type || 'INFO',
        title: data.title,
        message: data.message,
        relatedEntityId: data.relatedId,
        relatedEntityType: data.relatedType,
        relatedLink: data.relatedLink,
        metadata: data.metadata || {},
        status: 'UNREAD',
        createdAt: new Date()
      });
    }

    const created = notifications.length > 0 ? await Notification.insertMany(notifications) : [];
    return created;
  } catch (error) {
    console.error('Error creating notifications:', error);
    throw error;
  }
};

/**
 * Get notifications for a user
 * @param {string} userId - The user ID
 * @param {Object} options - Query options
 * @returns {Promise<Array<Object>>} The notifications
 */
exports.getUserNotifications = async (userId, options = {}) => {
  try {
    const query = { recipientUserId: userId };
    
    if (options.status) {
      query.status = options.status;
    }
    
    if (options.type) {
      query.type = options.type;
    }
    
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(options.limit || 50)
      .lean();
    
    return notifications;
  } catch (error) {
    console.error('Error fetching notifications:', error);
    throw error;
  }
};

/**
 * Mark notification as read
 * @param {string} notificationId - The notification ID
 * @returns {Promise<Object>} The updated notification
 */
exports.markAsRead = async (notificationId) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      notificationId,
      { 
        status: 'READ',
        readAt: new Date()
      },
      { new: true }
    );
    
    return notification;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

/**
 * Mark multiple notifications as read
 * @param {Array<string>} notificationIds - Array of notification IDs
 * @returns {Promise<Object>} Update result
 */
exports.markMultipleAsRead = async (notificationIds) => {
  try {
    const result = await Notification.updateMany(
      { _id: { $in: notificationIds } },
      { 
        status: 'READ',
        readAt: new Date()
      }
    );
    
    return result;
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    throw error;
  }
};

/**
 * Delete a notification
 * @param {string} notificationId - The notification ID
 * @returns {Promise<Object>} Delete result
 */
exports.deleteNotification = async (notificationId) => {
  try {
    const result = await Notification.findByIdAndDelete(notificationId);
    return result;
  } catch (error) {
    console.error('Error deleting notification:', error);
    throw error;
  }
};