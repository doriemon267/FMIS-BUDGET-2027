const {
  getAllSetups,
  getSetupById,
  createSetup,
  updateSetup,
  deleteSetup,
} = require("../controllers/setupController");
const Router = require("express").Router;
const checkToken = require('../middleware/check_token');
const check_token_dev = require("../middlewares/check_token_dev");
const check_token_prod = require("../middlewares/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;

const setupRouter = Router();
// Apply authentication middleware to all routes in this router
setupRouter.use(tokenMiddleware);
// Get all setups
setupRouter.get("/setups", getAllSetups);
// Get a single setup by ID
setupRouter.get("/setups/:id", getSetupById);
// Create a new setup
setupRouter.post("/setups", createSetup);
// Update a setup by ID
setupRouter.put("/setups/:id", updateSetup);
// Delete a setup
setupRouter.delete("/setups/:id", deleteSetup);
module.exports = setupRouter;