const Notification = require('../models/Notification');

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
    const notification = new Notification({
      recipientUserId: notificationData.userId,
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
    const notifications = notificationsData.map(data => ({
      recipientUserId: data.userId,
      type: data.type || 'INFO',
      title: data.title,
      message: data.message,
      relatedEntityId: data.relatedId,
      relatedEntityType: data.relatedType,
      relatedLink: data.relatedLink,
      metadata: data.metadata || {},
      status: 'UNREAD',
      createdAt: new Date()
    }));
    
    const created = await Notification.insertMany(notifications);
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