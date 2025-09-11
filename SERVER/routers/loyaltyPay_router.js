const Router = require("express").Router;
const checkToken = require('../middleware/checkToken');
const { getEligibleForLoyaltyPay } = require("../controllers/EmployeeListController");
const loyaltyPayRouter = Router();
// Apply authentication middleware to all routes in this router
loyaltyPayRouter.use(checkToken);
// Route to get employees eligible for loyalty pay
loyaltyPayRouter.get("/eligibleForLoyaltyPay", getEligibleForLoyaltyPay);
module.exports = loyaltyPayRouter;