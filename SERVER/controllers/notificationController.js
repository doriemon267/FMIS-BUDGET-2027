const Notification = require('../models/Notification');
const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
const Region = require('../models/Region');
const User = require('../models/User');
const { sendNotificationEmail } = require('../utils/emailNotification');

/** Escape for HTML text content (defense-in-depth before sanitize-html) */
const escapeHtml = (str) => {
  if (str == null) return '';
  const s = String(str);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

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

    // Try to send email notification if recipient has an email in HierarchicalUserAssignment and email is enabled
    try {
      const assignment = await HierarchicalUserAssignment.findOne({ userId: notificationData.userId }).select('email').lean();
      const user = await User.findOne({ userId: notificationData.userId }).select('emailPreferences').lean();
      
      console.log('[Notification Email Debug] userId:', notificationData.userId, 'assignment:', assignment, 'user prefs:', user?.emailPreferences);
      
      if (assignment && assignment.email) {
        // Check email preferences
        const userPrefs = user?.emailPreferences || {};
        const emailEnabled = userPrefs.enabled !== false;
        const proposalMuted = notificationData.metadata?.proposalId && userPrefs.mutedProposals && userPrefs.mutedProposals.includes(notificationData.metadata.proposalId);
        const notificationTypeEnabled = userPrefs.notificationTypes?.workflow !== false;
        
        if (!emailEnabled) {
          console.log('[Notification Email Debug] Email disabled for userId:', notificationData.userId);
        } else if (proposalMuted) {
          console.log('[Notification Email Debug] Proposal muted for userId:', notificationData.userId, 'proposalId:', notificationData.metadata?.proposalId);
        } else if (!notificationTypeEnabled) {
          console.log('[Notification Email Debug] Workflow notifications disabled for userId:', notificationData.userId);
        } else {
          const safeTitle = escapeHtml(notificationData.title || 'FMIS - OSBPIS Notification');
          const safeMessage = escapeHtml(notificationData.message || '');
          const md = notificationData.metadata || {};
          const html = `
            <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"max-width:600px;margin:auto;font-family:Arial,sans-serif;background:#f9f9f9;\">
              <tr>
                <td>
                  <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">
                    <tr>
                      <td style=\"background-color:#375e38;color:#fff;padding:18px 24px;font-size:1.3em;font-weight:bold;\">
                        ${safeTitle}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr><td style=\"padding:24px;background:#fff;\">
                <p>Dear Recipient,</p>
                <p>${safeMessage}</p>
                <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#fafafa;border-left:4px solid #375e38;margin:18px 0 18px 0;\">
                  <tr><td style=\"padding:16px;\">
                    <span style=\"font-weight:bold;color:#375e38;\">Proposal Details:</span><br>
                    <span style=\"font-weight:bold;\">Title:</span> ${escapeHtml(md.title || '')}<br>
                    <span style=\"font-weight:bold;\">Fiscal Year:</span> ${escapeHtml(md.fiscalYear || '')}<br>
                    <span style=\"font-weight:bold;\">Budget Type:</span> ${escapeHtml(md.budgetType || '')}<br>
                    <span style=\"font-weight:bold;\">Region:</span> ${escapeHtml(md.region || '')}<br>
                    <span style=\"font-weight:bold;\">Department:</span> ${escapeHtml(md.department || '')}<br>
                    <span style=\"font-weight:bold;\">Division:</span> ${escapeHtml(md.division || '')}
                  </td></tr>
                </table>
                <p style=\"margin:18px 0 0 0;\"><span style=\"font-weight:bold;color:#375e38;\">Action Required:</span> Please log in to the system to view and process this proposal.</p>
                <hr style=\"margin:24px 0;border:none;border-top:1px solid #e0e0e0;\">
                <p style=\"color:#d32f2f;\">&#9888; <span style=\"color:#375e38;font-weight:bold;\">Note:</span> This is an automated message. Please do not reply to this email.</p>
                <p style=\"color:#375e38;font-weight:bold;\">FMIS - NIA</p>
              </td></tr>
            </table>
          `;
          await sendNotificationEmail(
            assignment.email,
            notificationData.title || 'New Notification',
            notificationData.message || '',
            html
          );
          console.log('[Notification Email Debug] Email sent to:', assignment.email);
        }
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
/**
 * Create multiple notifications
 * @param {Array<Object>} notificationsData - Array of notification data objects
 * @param {Object} options - Optional parameters: { initiatorUserId }
 */
exports.createNotifications = async (notificationsData, options = {}) => {
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
      // allow passing initiator for permission checks (e.g., NIA-wide sends)
      const initiatorUserId = options?.initiatorUserId || options?.initiator || null;
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
      // Region-based expansion: check metadata.targetRegions
      const targetRegions = (data.metadata?.targetRegions || []).filter(Boolean).map(r => String(r).trim().toUpperCase());
      const niaWideFlag = data.metadata?.niaWide === true;
      // If targetRegions is provided or niaWide is true, expand recipients accordingly
      if ((Array.isArray(targetRegions) && targetRegions.length > 0) || niaWideFlag) {
        // Handle niaWide: confirm initiator has BRD-level permission
        if (niaWideFlag) {
          // If no initiator provided, skip expanding NIA-wide
          if (!initiatorUserId) {
            console.warn('[createNotifications] NIA-wide expansion requested but no initiator provided; skipping');
          } else {
            try {
              const initiatorAssign = await HierarchicalUserAssignment.getUserPermissions(String(initiatorUserId));
              const isBudgetAndRevenue = initiatorAssign && typeof initiatorAssign.isBudgetAndRevenueUser === 'function' ? initiatorAssign.isBudgetAndRevenueUser() : false;
              const isAdmin = (initiatorAssign && (Array.isArray(initiatorAssign.userRoles) && initiatorAssign.userRoles.some(r => ['SUPER_ADMIN','ADMIN','BUDGET_ADMIN','BUDGET ADMIN'].includes(r))) || initiatorAssign.userRole === 'ADMIN');
              if (!isBudgetAndRevenue && !isAdmin) {
                console.warn('[createNotifications] Initiator is not authorized to perform NIA-wide send, skipping NIA-wide expansion for initiator:', initiatorUserId);
              } else {
                // Expand to all active users
                const allAssigns = await HierarchicalUserAssignment.find({ isActive: true }).select('userId').lean();
                for (const a of allAssigns) {
                  const uid = a.userId || String(a._id);
                  if (data.metadata?.proposalId && mutedByProposal[data.metadata.proposalId] && mutedByProposal[data.metadata.proposalId].has(uid)) continue;
                  if (uniqueKey) {
                    const exists = await Notification.findOne({ recipientUserId: uid, status: 'UNREAD', 'metadata.uniqueKey': uniqueKey }).lean();
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
                // continue to next data item
                continue;
              }
            } catch (err) {
              console.warn('[createNotifications] NIA-wide permission check failed', err?.message || err);
            }
          }
        }
        // Handle region-based expansion (targetRegions)
        if (Array.isArray(targetRegions) && targetRegions.length > 0) {
          try {
            // Find region ids by Region.Region equals code
            const regionDocs = await Region.find({ Region: { $in: targetRegions } }).select('_id Region').lean();
            const regionIds = regionDocs.map(r => String(r._id));
            // Find assignments with matching assignedRegions OR regionId in ids OR isNIAWide true
            const assignments = await HierarchicalUserAssignment.find({
              isActive: true,
              $or: [
                { assignedRegions: { $in: targetRegions } },
                { regionId: { $in: regionIds } },
                { isNIAWide: true }
              ]
            }).select('userId').lean();
            for (const a of assignments) {
              const uid = a.userId || String(a._id);
              if (data.metadata?.proposalId && mutedByProposal[data.metadata.proposalId] && mutedByProposal[data.metadata.proposalId].has(uid)) continue;
              if (uniqueKey) {
                const exists = await Notification.findOne({ recipientUserId: uid, status: 'UNREAD', 'metadata.uniqueKey': uniqueKey }).lean();
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
            // Skip further processing for this data (we've expanded)
            continue;
          } catch (err) {
            console.warn('[createNotifications] Region expansion failed:', err?.message || err);
          }
        }
      }
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
          // If targetRegions is specified, narrow the role users to those in the regions
          let regionFilterUserIds = null;
          if (Array.isArray(targetRegions) && targetRegions.length > 0) {
            try {
              const regionDocs = await Region.find({ Region: { $in: targetRegions } }).select('_id Region').lean();
              const regionIds = regionDocs.map(r => String(r._id));
              const assigns = await HierarchicalUserAssignment.find({ isActive: true, $or: [ { assignedRegions: { $in: targetRegions } }, { regionId: { $in: regionIds } }, { isNIAWide: true } ] }).select('userId').lean();
              regionFilterUserIds = new Set(assigns.map(a => String(a.userId || a._id)));
            } catch (err) { /* ignore region filter if it fails */ }
          }
            for (const u of users) {
              // If region filter exists, skip users not in the region filter
              if (regionFilterUserIds && !regionFilterUserIds.has(String(u.userId || u._id))) continue;
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
      
      // Fetch user assignments and email preferences
      const assignments = await HierarchicalUserAssignment.find({ userId: { $in: candidates } }).select('userId email').lean();
      const users = await User.find({ userId: { $in: candidates } }).select('userId emailPreferences').lean();
      
      console.log('[Notification Email Debug] Found assignments:', assignments.length, 'users:', users.length);
      const assignmentEmailMap = {};
      const userPreferencesMap = {};
      
      assignments.forEach(a => { if (a.email) assignmentEmailMap[String(a.userId)] = a.email; });
      users.forEach(u => { userPreferencesMap[String(u.userId)] = u.emailPreferences; });
      
      console.log('[Notification Email Debug] Assignment email map:', assignmentEmailMap);
      console.log('[Notification Email Debug] User preferences map:', userPreferencesMap);

      for (const n of created) {
        let email = assignmentEmailMap[n.recipientUserId] || assignmentEmailMap[String(n.recipientUserId)] || assignmentEmailMap[Number(n.recipientUserId)] || null;
        const userPrefs = userPreferencesMap[n.recipientUserId] || userPreferencesMap[String(n.recipientUserId)] || userPreferencesMap[Number(n.recipientUserId)] || {};
        
        // Check email preferences
        const emailEnabled = userPrefs.enabled !== false; // default true
        const proposalMuted = n.metadata?.proposalId && userPrefs.mutedProposals && userPrefs.mutedProposals.includes(n.metadata.proposalId);
        const notificationTypeEnabled = userPrefs.notificationTypes?.workflow !== false; // default true
        
        console.log('[Notification Email Debug] userId:', n.recipientUserId, 'email:', email, 'enabled:', emailEnabled, 'muted:', proposalMuted, 'typeEnabled:', notificationTypeEnabled);
        
        if (!email || !emailEnabled || proposalMuted || !notificationTypeEnabled) {
          if (!email) console.warn('[Notification Email Debug] No email found for userId:', n.recipientUserId);
          if (!emailEnabled) console.log('[Notification Email Debug] Email disabled for userId:', n.recipientUserId);
          if (proposalMuted) console.log('[Notification Email Debug] Proposal muted for userId:', n.recipientUserId, 'proposalId:', n.metadata?.proposalId);
          if (!notificationTypeEnabled) console.log('[Notification Email Debug] Workflow notifications disabled for userId:', n.recipientUserId);
          continue;
        }
        
        // Fallback: try to fetch assignment again with flexible matching
        if (!email) {
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
            const safeTitleBulk = escapeHtml(n.title || 'FMIS - OSBPIS Notification');
            const safeMessageBulk = escapeHtml(n.message || '');
            const safeLink = n.relatedLink && /^\/[a-zA-Z0-9\/\-_.?=&]*$/.test(String(n.relatedLink)) ? String(n.relatedLink) : '';
            const html = `
              <div style=\"max-width:600px;margin:auto;font-family:Arial,sans-serif;\">
                <div style=\"background-color:#375e38;color:#fff;padding:20px 24px;border-radius:8px 8px 0 0;\">
                  <h2 style=\"margin:0;font-size:1.5em;\">${safeTitleBulk}</h2>
                </div>
                <div style=\"background:#fff;padding:24px;border-radius:0 0 8px 8px;box-shadow:0 2px 8px rgba(55,94,56,0.08);\">
                  <p>Dear Recipient,</p>
                  <p>${safeMessageBulk}</p>
                  ${safeLink ? `<a href='https://your-app.com${safeLink}' style='color:#375e38;text-decoration:underline;font-weight:bold;'>View Proposal</a>` : ''}
                  <div style=\"margin:16px 0;\">
                    <span style=\"color:#375e38;font-weight:bold;\">&#9888; Action Required:</span>
                    <span> Please log in to the system to view and process this proposal.</span>
                  </div>
                  <div style=\"margin:16px 0;\">
                    <span style=\"color:#375e38;font-weight:bold;\">&#x1F514; Note:</span>
                    <span> This is an automated message. Please do not reply to this email.</span>
                  </div>
                  <p style=\"color:#888;\">FMIS - NIA</p>
                </div>
              </div>
            `;
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