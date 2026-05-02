const {
  getAllSetups,
  getSetupById,
  createSetup,
  updateSetup,
  deleteSetup,
} = require("../controllers/setupController");
const Router = require("express").Router;
const isAuth = require('../middleware/is_auth');

const setupRouter = Router();
// Apply authentication middleware to all routes in this router
setupRouter.use(isAuth);
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
