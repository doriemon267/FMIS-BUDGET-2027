const {
  getAllRATAs,
  getRATAById,
  createRATA,
  updateRATA,
  deleteRATA,
} = require("../controllers/rataController");
const Router = require("express").Router;
const checkToken = require('../middleware/checkToken');
const rataRouter = Router();
// Apply authentication to all RATA routes
rataRouter.use(checkToken);
// Get all RATAs
rataRouter.get("/ratas", getAllRATAs);
// Get a RATA by ID
rataRouter.get("/ratas/:id", getRATAById);
// Add a new RATA
rataRouter.post("/ratas", createRATA);
// Edit an existing RATA
rataRouter.put("/ratas/:id", updateRATA);
// Delete a RATA
rataRouter.delete("/ratas/:id", deleteRATA);
module.exports = rataRouter;