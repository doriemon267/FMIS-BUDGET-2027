const {
  getAllTests,
  addTest,
  editTest,
  deleteTest,
} = require("../controllers/test_controller");
const Router = require("express").Router;
const isAuth = require('../middleware/is_auth');

const testRouter = Router();
// Apply authentication middleware to all routes in this router
testRouter.use(tokentMiddleware);
// Get all tests
testRouter.get("/tests", getAllTests);
// Add a new test
testRouter.post("/tests", addTest);
// Edit an existing test
testRouter.put("/tests/:id", editTest);
// Delete a test
testRouter.delete("/tests/:id", deleteTest);
module.exports = testRouter;

