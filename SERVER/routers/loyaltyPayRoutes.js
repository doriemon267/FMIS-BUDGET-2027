const {
  createLoyaltyPay,
  getAllLoyaltyPays,
  updateLoyaltyPay,
  deleteLoyaltyPay,
  getLoyaltyPayStats,
} = require("../controllers/loyaltyPayController");
const Router = require("express").Router;
const checkToken = require('../middleware/checkToken');
const checkDueDate = require("../middleware/checkDueDate");
const loyaltyPayRouter = Router();
// Apply authentication middleware to all routes in this router
loyaltyPayRouter.use(checkToken);
loyaltyPayRouter.get("/loyalty-pay", getAllLoyaltyPays);
// Get loyalty pay statistics (must be before :id route)
loyaltyPayRouter.get("/loyalty-pay/stats", getLoyaltyPayStats);
loyaltyPayRouter.post("/loyalty-pay", checkDueDate, createLoyaltyPay);
loyaltyPayRouter.put("/loyalty-pay/:id", checkDueDate, updateLoyaltyPay);
loyaltyPayRouter.delete("/loyalty-pay/:id", checkDueDate, deleteLoyaltyPay);
module.exports = loyaltyPayRouter;