const { 
    getConsolidatedSummary,
    getConsolidatedCorporateIncome
} = require("../controllers/reports.controller");
const {
    exportConsolidatedIncomePDF,
    getConsolidatedIncomePreview
} = require("../controllers/consolidatedIncomePDFController");
const Router = require("express").Router;
const authMiddleware = require("../middleware/authMiddleware");

const { hierarchicalAccessControl } = require('../middleware/hierarchicalAccessControl');

const reportsRouter = Router();

// Apply authentication middleware to all routes in this router
reportsRouter.use(authMiddleware);

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
