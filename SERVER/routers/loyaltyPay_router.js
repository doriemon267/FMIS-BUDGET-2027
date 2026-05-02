const Router = require("express").Router;
const isAuth = require('../middleware/is_auth');

const { getEligibleForLoyaltyPay } = require("../controllers/EmployeeListController");
const loyaltyPayRouter = Router();
// Apply authentication middleware to all routes in this router
loyaltyPayRouter.use(isAuth);
// Route to get employees eligible for loyalty pay
loyaltyPayRouter.get("/eligibleForLoyaltyPay", getEligibleForLoyaltyPay);
module.exports = loyaltyPayRouter;
