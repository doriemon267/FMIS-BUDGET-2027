const Router = require('express').Router;
const { submissionWorkflowTransitions } = require('../middleware/submissionWorkflowControl');
const { submissionWorkflowControl } = require('../middleware/submissionWorkflowControl');
const { requirePermission } = require('../middleware/hierarchicalAssignmentMiddleware');
const { hasWorkflowRole } = require('../helpers/workflowRoleManager');
const checkToken = require('../middleware/check_token');
const check_token_dev = require("../middlewares/check_token_dev");
const check_token_prod = require("../middlewares/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;


const router = Router();

// Auth for all workflow routes
router.use(tokenMiddleware);

/**
 * Middleware to check workflow role permissions
 */
const requireWorkflowRole = (requiredRole) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const hasRole = await hasWorkflowRole(userId, requiredRole);
      if (!hasRole) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required workflow role: ${requiredRole}`,
          code: 'WORKFLOW_ROLE_REQUIRED',
          requiredRole
        });
      }
      next();
    } catch (error) {
      console.error('Workflow role check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error checking workflow permissions',
        error: error.message
      });
    }
  };
};

/**
 * Status Workflow Routes (Legacy/Compatibility)
 * These routes provide backward compatibility for the old status-workflow endpoints
 */

// Submit to office (Division/Department level submission)
router.post(
  '/submit-to-office',
  submissionWorkflowControl('update'),
  requireWorkflowRole('departmentConsolidator'),
  async (req, res) => {
    try {
      const { modelType, recordIds, submissionNote } = req.body;
      console.log('📨 Submit to office request:', { modelType, recordIds });

      // Map modelType to entity
      const entityMap = {
        'PersonnelService': 'personnel',
        'MooeProposal': 'mooe',
        'CapitalOutlay': 'capital',
        'Income': 'income'
      };
      const entity = entityMap[modelType] || 'personnel';
      const ids = recordIds || [];

      console.log('🔄 Processing submission:', { entity, ids: ids.length });

      const userId = req.user?.id || 'system';
      const Model = require('../models/PersonnelServices'); // Default to personnel for legacy

      // Convert string IDs to ObjectId if needed
      const objectIds = ids.map(id => {
        if (typeof id === 'string') {
          try {
            return require('mongoose').Types.ObjectId(id);
          } catch (e) {
            return id;
          }
        }
        return id;
      });

      // Update status to Division Submitted (legacy workflow)
      const result = await Model.updateMany(
        {
          _id: { $in: objectIds },
          status: { $in: ['Draft', 'Not Submitted', 'DRAFT', 'NOT SUBMITTED'] }
        },
        {
          $set: {
            status: 'Division Submitted',
            submittedAt: new Date(),
            submittedBy: userId,
            submittedByName: (req.user?.FirstName && req.user?.LastName) ? `${req.user.FirstName} ${req.user.LastName}` : (req.user?.name || req.user?.username || 'system'),
            submissionNote: submissionNote || '',
            workflowLevel: 'DEPARTMENT'
          }
        }
      );

      // Create notifications for Department consolidators
      try {
        console.log('🔄 Creating notifications for department submission...');
        const Notification = require('../models/Notification');
        const { getUsersWithWorkflowRole } = require('../helpers/workflowRoleManager');

        const sample = await Model.findOne({ _id: { $in: objectIds } })
          .select('region department division').lean();

        const deptUsers = await getUsersWithWorkflowRole('departmentConsolidator');
        console.log(`📋 Found ${deptUsers.length} department consolidators`);
        let recipients = deptUsers.filter(u => (
          (!sample?.region || String(u.region || '').trim().toUpperCase() === String(sample.region || '').trim().toUpperCase()) &&
          (!sample?.department || String(u.department || '').trim().toUpperCase() === String(sample.department || '').trim().toUpperCase())
        ));
        if (!recipients.length) recipients = deptUsers;
        console.log(`📋 Filtered to ${recipients.length} recipients`);

        if (recipients.length) {
          const creatorName = (req.user?.FirstName && req.user?.LastName)
            ? `${req.user.FirstName} ${req.user.LastName}`
            : (req.user?.name || req.user?.username || 'User');

          const pickRecipientId = (u) => {
            const candidates = [
              u.userId, u.UserId, u.UserID,
              u.Username, u.username,
              u.userCode, u.UserCode,
              u.employeeCode, u.EmployeeCode,
              u.empCode, u.EmpCode,
              u.id, u.Id, u.ID
            ].map(v => v != null ? String(v).trim() : '').filter(Boolean);
            return candidates[0] || String(u.id || '');
          };

          const docs = recipients.map(u => ({
            recipientUserId: pickRecipientId(u),
            title: 'New division submission for verification',
            message: `${creatorName} submitted ${objectIds.length} item(s) for Department verification.`,
            entity,
            recordIds: objectIds,
            org: { region: sample?.region || null, department: sample?.department || null, division: sample?.division || null },
            createdBy: { userId: req.user?.id, name: creatorName }
          }));
          console.log(`📧 Creating ${docs.length} notifications...`);
          await Notification.insertMany(docs);
          console.log('✅ Notifications created successfully');
        } else {
          console.log('⚠️ No recipients found for notifications');
        }
      } catch (notifyErr) {
        console.error('❌ Notify error (legacy submit):', notifyErr?.message);
      }

      return res.status(200).json({
        message: 'Successfully submitted to Department for verification',
        modified: result.modifiedCount
      });
    } catch (e) {
      return res.status(500).json({
        message: 'Submission failed',
        error: e.message
      });
    }
  }
);

// Verify by office (Department verification)
router.post(
  '/verify-by-office',
  submissionWorkflowControl('update'),
  requireWorkflowRole('departmentConsolidator'),
  async (req, res) => {
    try {
      const { modelType, recordIds, verificationNote, action } = req.body;
      console.log('📨 Verify by office request:', { modelType, recordIds, action });

      // Map modelType to entity
      const entityMap = {
        'PersonnelService': 'personnel',
        'MooeProposal': 'mooe',
        'CapitalOutlay': 'capital',
        'Income': 'income'
      };
      const entity = entityMap[modelType] || 'personnel';
      const ids = recordIds || [];

      console.log('🔄 Processing verification:', { entity, ids: ids.length });

      const userId = req.user?.id || 'system';
      const Model = require('../models/PersonnelServices');

      const objectIds = ids.map(id => {
        if (typeof id === 'string') {
          try {
            return require('mongoose').Types.ObjectId(id);
          } catch (e) {
            return id;
          }
        }
        return id;
      });

      const result = await Model.updateMany(
        {
          _id: { $in: objectIds },
          status: { $in: ['Division Submitted', 'DIVISION_SUBMITTED'] }
        },
        {
          $set: {
            status: 'Department Verified',
            verifiedAt: new Date(),
            verifiedBy: userId,
            verifiedByName: (req.user?.FirstName && req.user?.LastName) ? `${req.user.FirstName} ${req.user.LastName}` : (req.user?.name || req.user?.username || 'system'),
            verificationNote: verificationNote || '',
            workflowLevel: 'REGION'
          }
        }
      );

      // Create notifications for Region approvers
      try {
        const Notification = require('../models/Notification');
        const { getUsersWithWorkflowRole } = require('../helpers/workflowRoleManager');

        const sample = await Model.findOne({ _id: { $in: objectIds } })
          .select('region department division').lean();

        const regionUsers = await getUsersWithWorkflowRole('regionFinalVerifier');
        let recipients = regionUsers.filter(u => (
          (!sample?.region || String(u.region || '').trim().toUpperCase() === String(sample.region || '').trim().toUpperCase())
        ));
        if (!recipients.length) recipients = regionUsers;

        if (recipients.length) {
          const creatorName = (req.user?.FirstName && req.user?.LastName)
            ? `${req.user.FirstName} ${req.user.LastName}`
            : (req.user?.name || req.user?.username || 'User');

          const pickRecipientId = (u) => {
            const candidates = [
              u.userId, u.UserId, u.UserID,
              u.Username, u.username,
              u.userCode, u.UserCode,
              u.employeeCode, u.EmployeeCode,
              u.empCode, u.EmpCode,
              u.id, u.Id, u.ID
            ].map(v => v != null ? String(v).trim() : '').filter(Boolean);
            return candidates[0] || String(u.id || '');
          };

          const docs = recipients.map(u => ({
            recipientUserId: pickRecipientId(u),
            title: 'Department verified submissions ready for approval',
            message: `${creatorName} verified ${objectIds.length} item(s) at Department level. Ready for Region approval.`,
            entity,
            recordIds: objectIds,
            org: { region: sample?.region || null, department: sample?.department || null, division: sample?.division || null },
            createdBy: { userId: req.user?.id, name: creatorName }
          }));
          await Notification.insertMany(docs);
        }
      } catch (notifyErr) {
        console.error('Notify error (legacy verify):', notifyErr?.message);
      }

      return res.status(200).json({
        message: 'Successfully verified at Department level',
        modified: result.modifiedCount
      });
    } catch (e) {
      return res.status(500).json({
        message: 'Verification failed',
        error: e.message
      });
    }
  }
);

// Finalize proposals (Region finalization)
router.post(
  '/finalize-proposals',
  submissionWorkflowControl('update'),
  requireWorkflowRole('regionFinalVerifier'),
  async (req, res) => {
    try {
      const { modelType, recordIds, finalizationNote } = req.body;
      console.log('📨 Finalize proposals request:', { modelType, recordIds });

      // Map modelType to entity
      const entityMap = {
        'PersonnelService': 'personnel',
        'MooeProposal': 'mooe',
        'CapitalOutlay': 'capital',
        'Income': 'income'
      };
      const entity = entityMap[modelType] || 'personnel';
      const ids = recordIds || [];

      console.log('🔄 Processing finalization:', { entity, ids: ids.length });

      const userId = req.user?.id || 'system';
      const Model = require('../models/PersonnelServices');

      const objectIds = ids.map(id => {
        if (typeof id === 'string') {
          try {
            return require('mongoose').Types.ObjectId(id);
          } catch (e) {
            return id;
          }
        }
        return id;
      });

      const result = await Model.updateMany(
        {
          _id: { $in: objectIds },
          status: { $in: ['Department Verified', 'DEPARTMENT_VERIFIED', 'Department Submitted', 'DEPARTMENT_SUBMITTED'] }
        },
        {
          $set: {
            status: 'Finalized',
            finalizedAt: new Date(),
            finalizedBy: userId,
            finalizedByName: (req.user?.FirstName && req.user?.LastName) ? `${req.user.FirstName} ${req.user.LastName}` : (req.user?.name || req.user?.username || 'system'),
            finalizationNote: finalizationNote || '',
            workflowLevel: 'FINALIZED'
          }
        }
      );

      // Create notifications for submitters about finalization
      try {
        const Notification = require('../models/Notification');

        const sample = await Model.findOne({ _id: { $in: objectIds } })
          .select('region department division processBy').lean();

        if (sample?.processBy) {
          const User = require('../models/User');
          const submitter = await User.findOne({
            $or: [
              { _id: sample.processBy },
              { FirstName: { $regex: new RegExp(`^${sample.processBy.split(' ')[0]}$`, 'i') } },
              { username: sample.processBy },
              { userCode: sample.processBy }
            ]
          }).select('_id FirstName LastName').lean();

          if (submitter) {
            const finalizerName = (req.user?.FirstName && req.user?.LastName)
              ? `${req.user.FirstName} ${req.user.LastName}`
              : (req.user?.name || req.user?.username || 'User');

            const notificationDoc = {
              recipientUserId: submitter._id.toString(),
              title: 'Your proposal has been finalized',
              message: `${finalizerName} has finalized ${objectIds.length} of your submitted item(s). The budget proposal is now complete.`,
              entity,
              recordIds: objectIds,
              org: { region: sample?.region || null, department: sample?.department || null, division: sample?.division || null },
              createdBy: { userId: req.user?.id, name: finalizerName }
            };
            await Notification.create(notificationDoc);
          }
        }
      } catch (notifyErr) {
        console.error('Notify error (legacy finalize):', notifyErr?.message);
      }

      return res.status(200).json({
        message: 'Successfully finalized proposals',
        modified: result.modifiedCount
      });
    } catch (e) {
      return res.status(500).json({
        message: 'Finalization failed',
        error: e.message
      });
    }
  }
);

module.exports = router;