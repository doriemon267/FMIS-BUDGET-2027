const {
  getAllTests,
  addTest,
  editTest,
  deleteTest,
} = require("../controllers/test_controller");
const Router = require("express").Router;
const checkToken = require('../middleware/check_token');
const check_token_dev = require("../middlewares/check_token_dev");
const check_token_prod = require("../middlewares/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;

const testRouter = Router();
// Apply authentication middleware to all routes in this router
testRouter.use(tokenMiddleware);
// Get all tests
testRouter.get("/tests", getAllTests);
// Add a new test
testRouter.post("/tests", addTest);
// Edit an existing test
testRouter.put("/tests/:id", editTest);
// Delete a test
testRouter.delete("/tests/:id", deleteTest);
module.exports = testRouter;
