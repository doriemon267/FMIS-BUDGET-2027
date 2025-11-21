const Notification = require('../models/Notification');
const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
const { sendNotificationEmail } = require('../utils/emailNotification');

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

    // Try to send email notification if recipient has an email in HierarchicalUserAssignment
    try {
      const assignment = await HierarchicalUserAssignment.findOne({ userId: notificationData.userId }).select('email').lean();
      console.log('[Notification Email Debug] userId:', notificationData.userId, 'assignment:', assignment);
      if (assignment && assignment.email) {
        const html = `<h2 style='color:#1976d2;'>${notificationData.title || 'Notification'}</h2>
          <p>${notificationData.message || ''}</p>
          ${notificationData.relatedLink ? `<a href='https://your-app.com${notificationData.relatedLink}' style='color:#1976d2;text-decoration:underline;'>View Proposal</a>` : ''}`;
        await sendNotificationEmail(
          assignment.email,
          notificationData.title || 'New Notification',
          notificationData.message || '',
          html
        );
        console.log('[Notification Email Debug] Email sent to:', assignment.email);
      } else {
        console.warn('[Notification Email Debug] No email found for userId:', notificationData.userId);
      }
    } catch (emailErr) {
      console.warn('Email notification failed:', emailErr.message);
    }

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
    // If payload has a proposalId, gather a set of userIds who have muted this proposal
    const allProposalIds = [...new Set(notificationsData.map(n => n.metadata?.proposalId).filter(Boolean))];
    const mutedByProposal = {};
    if (allProposalIds.length > 0) {
      const usersWithMuted = await User.find({ 'notificationPreferences.mutedProposals': { $in: allProposalIds } }).select('userId notificationPreferences.mutedProposals').lean();
      usersWithMuted.forEach(u => {
        u.notificationPreferences?.mutedProposals?.forEach(pid => {
          mutedByProposal[pid] = mutedByProposal[pid] || new Set();
          mutedByProposal[pid].add(u.userId || String(u._id));
        });
      });
    }

  const expandRolesGlobally = String(process.env.NOTIFICATIONS_EXPAND_ROLE_TO_USERS || 'true').toLowerCase() === 'true';
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

  const expandRoleFlag = data.metadata?.expandRoleToUsers;
  const expandRoleFinal = expandRoleFlag === undefined ? expandRolesGlobally : !!expandRoleFlag;
  if (isRoleCandidate(recipientId) && expandRoleFinal) {
        // Expand the role into user ids by querying User model
  try {
          const users = await User.find({ roles: { $in: [recipientId, recipientId.toUpperCase()] } }).select('userId');
          for (const u of users) {
            const uid = u.userId || String(u._id);
            const uniqueKeyPerRecipient = uniqueKey || null;
            // If this user has muted the proposal referenced in metadata, skip
            if (data.metadata?.proposalId && mutedByProposal[data.metadata.proposalId] && mutedByProposal[data.metadata.proposalId].has(uid)) {
              continue;
            }
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

      // If a user is explicitly provided (not a role)
      if (data.metadata?.proposalId && mutedByProposal[data.metadata.proposalId] && mutedByProposal[data.metadata.proposalId].has(data.userId)) {
        // Skip this recipient: they have muted the proposal
        continue;
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

    // Send email notifications to each recipient using HierarchicalUserAssignment
    if (created && created.length > 0) {
      // Improved: Try to match userId as string, number, and ObjectId string
      const userIds = created.map(n => n.recipientUserId);
      const candidates = [];
      userIds.forEach(uid => {
        candidates.push(uid);
        if (!isNaN(Number(uid))) candidates.push(Number(uid));
        candidates.push(String(uid));
      });
      console.log('[Notification Email Debug] Candidate userIds for email mapping:', candidates);
      const assignments = await HierarchicalUserAssignment.find({ userId: { $in: candidates } }).select('userId email').lean();
      console.log('[Notification Email Debug] Found assignments:', assignments);
      const assignmentEmailMap = {};
      assignments.forEach(a => { if (a.email) assignmentEmailMap[String(a.userId)] = a.email; });
      console.log('[Notification Email Debug] Assignment email map:', assignmentEmailMap);

      for (const n of created) {
        let email = assignmentEmailMap[n.recipientUserId] || assignmentEmailMap[String(n.recipientUserId)] || assignmentEmailMap[Number(n.recipientUserId)] || null;
        // Forced debug log for every notification
        console.log('[Notification Email Debug] Attempting email for userId:', n.recipientUserId, 'initial email:', email);
        if (!email) {
          // Fallback: try to fetch assignment again with flexible matching
          try {
            const fallbackAssignment = await HierarchicalUserAssignment.findOne({
              $or: [
                { userId: n.recipientUserId },
                { userId: String(n.recipientUserId) },
                { userId: Number(n.recipientUserId) }
              ]
            }).select('userId email').lean();
            if (fallbackAssignment && fallbackAssignment.email) {
              email = fallbackAssignment.email;
              console.log('[Notification Email Debug] Fallback assignment found for userId:', n.recipientUserId, 'email:', email);
            } else {
              console.warn('[Notification Email Debug] Fallback: No email found for userId:', n.recipientUserId);
            }
          } catch (fallbackErr) {
            console.warn('[Notification Email Debug] Fallback assignment error for userId:', n.recipientUserId, fallbackErr.message);
          }
        }
        if (email) {
          try {
            const html = `<h2 style='color:#1976d2;'>${n.title || 'Notification'}</h2>
              <p>${n.message || ''}</p>
              ${n.relatedLink ? `<a href='https://your-app.com${n.relatedLink}' style='color:#1976d2;text-decoration:underline;'>View Proposal</a>` : ''}`;
            await sendNotificationEmail(
              email,
              n.title || 'New Notification',
              n.message || '',
              html
            );
            console.log('[Notification Email Debug] Bulk email sent to:', email);
          } catch (emailErr) {
            console.warn('Email notification failed for', email, emailErr.message);
          }
        } else {
          console.warn('[Notification Email Debug] No email found for bulk userId:', n.recipientUserId);
        }
      }
    }
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