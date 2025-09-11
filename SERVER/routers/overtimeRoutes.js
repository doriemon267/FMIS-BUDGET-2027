const {
  createOvertimePay,
  getAllOvertimePays,
  updateOvertimePay,
  deleteOvertimePay,
  getSumOfOvertimeAmount,
  getOvertimeByRegion,
} = require("../controllers/overtimePayController");
const Router = require("express").Router;
const checkToken = require('../middleware/checkToken');
const checkDueDate = require("../middleware/checkDueDate");
const overtimeRouter = Router();
// Apply authentication middleware to all routes in this router
overtimeRouter.use(checkToken);
overtimeRouter.get("/overtime-pay", getAllOvertimePays);
overtimeRouter.post("/overtime-pay", checkDueDate, createOvertimePay);
overtimeRouter.put("/overtime-pay/:id", checkDueDate, updateOvertimePay);
overtimeRouter.delete("/overtime-pay/:id", checkDueDate, deleteOvertimePay);
overtimeRouter.get("/overtime-pay/sum", getSumOfOvertimeAmount);
overtimeRouter.get("/overtime-pay/by-region", getOvertimeByRegion);
module.exports = overtimeRouter;