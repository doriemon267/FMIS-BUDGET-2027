const express = require('express');
const router = express.Router();
const { 
  exportPermanentPersonnelPDF, 
  exportCasualPersonnelPDF,
  exportCOSPersonnelPDF
} = require('../controllers/personnelServicesPDFController');

const check_token_dev = require('../middleware/check_token_dev');
const check_token_prod = require('../middleware/check_token_prod');
const IS_PRODUCTION = require('../utils/IS_PRODUCTION');
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;

const { hierarchicalAccessControl } = require('../middleware/hierarchicalAccessControl');
const { logUserActivity } = require('../middleware/userLogs');

// Apply authentication middleware to all routes in this router
router.use(tokenMiddleware);

/**
 * @route   POST /api/personnel-services-pdf/export-permanent
 * @desc    Generate PDF report for Permanent Personnel Services
 * @access  Protected - Requires authentication and hierarchical access control
 */
router.post(
  '/export-permanent',
  hierarchicalAccessControl('read', { allowedFields: ['region', 'office'] }),
  logUserActivity({ 
    action: 'EXPORT', 
    resource: 'PersonnelServices', 
    getDetails: (req) => ({ 
      format: 'PDF',
      subAction: 'export-permanent',
      fiscalYear: req.body.fiscalYear,
      region: req.body.region
    }) 
  }),
  exportPermanentPersonnelPDF
);

/**
 * @route   POST /api/personnel-services-pdf/export-casual
 * @desc    Generate PDF report for Casual Personnel Services
 * @access  Protected - Requires authentication and hierarchical access control
 */
router.post(
  '/export-casual',
  hierarchicalAccessControl('read', { allowedFields: ['region', 'office'] }),
  logUserActivity({ 
    action: 'EXPORT', 
    resource: 'PersonnelServices', 
    getDetails: (req) => ({ 
      format: 'PDF',
      subAction: 'export-casual',
      fiscalYear: req.body.fiscalYear,
      region: req.body.region
    }) 
  }),
  exportCasualPersonnelPDF
);

/**
 * @route   POST /api/personnel-services-pdf/export-cos
 * @desc    Generate PDF report for COS (Contract of Service) Personnel Services
 * @access  Protected - Requires authentication and hierarchical access control
 */
router.post(
  '/export-cos',
  hierarchicalAccessControl('read', { allowedFields: ['region', 'office'] }),
  logUserActivity({ 
    action: 'EXPORT', 
    resource: 'COSPersonnel', 
    getDetails: (req) => ({ 
      format: 'PDF',
      subAction: 'export-cos',
      fiscalYear: req.body.fiscalYear,
      region: req.body.region
    }) 
  }),
  exportCOSPersonnelPDF
);

module.exports = router;
