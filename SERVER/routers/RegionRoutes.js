const {
  getAllRegions,
  getRegionById,
  createRegion,
  updateRegion,
  deleteRegion,
} = require("../controllers/regionController");

const Router = require("express").Router;
const checkToken = require('../middleware/checkToken');

const regionRouter = Router();

// Apply authentication middleware to all routes in this router
regionRouter.use(checkToken);

// Get all regions
regionRouter.get("/regions", getAllRegions);

// Get a region by ID
regionRouter.get("/regions/:id", getRegionById);

// Add a new region
regionRouter.post("/postregions", createRegion);

// Edit an existing region
regionRouter.put("/regions/:id", updateRegion);

// Delete a region
regionRouter.delete("/regions/:id", deleteRegion);

module.exports = regionRouter;
