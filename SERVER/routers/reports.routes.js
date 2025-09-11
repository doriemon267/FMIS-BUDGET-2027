const { 
    getConsolidatedSummary,
    getConsolidatedCorporateIncome
} = require("../controllers/reports.controller");
const Router = require("express").Router;
const checkToken = require('../middleware/checkToken');
const reportsRouter = Router();
// Apply authentication middleware to all routes in this router
reportsRouter.use(checkToken);
reportsRouter.get("/consolidated-summary", getConsolidatedSummary);
reportsRouter.get("/consolidated-corporate-income", getConsolidatedCorporateIncome);
module.exports = reportsRouter;