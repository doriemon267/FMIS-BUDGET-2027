const { 
    getConsolidatedSummary,
    getConsolidatedCorporateIncome
} = require("../controllers/reports.controller");
const {
    exportConsolidatedIncomePDF,
    getConsolidatedIncomePreview
} = require("../controllers/consolidatedIncomePDFController");
const Router = require("express").Router;
const checkToken = require('../middleware/check_token');
const check_token_dev = require("../middlewares/check_token_dev");
const check_token_prod = require("../middlewares/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;

const { hierarchicalAccessControl } = require('../middleware/hierarchicalAccessControl');

const reportsRouter = Router();

// Apply authentication middleware to all routes in this router
reportsRouter.use(tokenMiddleware);

// Data endpoints
reportsRouter.get("/consolidated-summary", getConsolidatedSummary);
reportsRouter.get("/consolidated-corporate-income", getConsolidatedCorporateIncome);

// Secure PDF export endpoints with hierarchical access control
reportsRouter.post(
    "/consolidated-corporate-income/export-pdf", 
    hierarchicalAccessControl('read', { allowedFields: ['region'] }),
    exportConsolidatedIncomePDF
);
reportsRouter.get(
    "/consolidated-corporate-income/preview", 
    getConsolidatedIncomePreview
);

module.exports = reportsRouter;
