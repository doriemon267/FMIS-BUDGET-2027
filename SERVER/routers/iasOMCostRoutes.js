const { getIAsOMCost, saveIAsOMCost } = require("../controllers/iasOMCost.controller");
const Router = require("express").Router;
const authMiddleware = require("../middleware/authMiddleware");

const { strictHierarchicalControl, hierarchicalAccessControl } = require('../middleware/hierarchicalAccessControl');
const iasOMCostRouter = Router();
// Apply authentication to all IAs O&M Cost routes
iasOMCostRouter.use(authMiddleware);
// Get IAs O&M Cost data
iasOMCostRouter.get("/ias-om-cost", hierarchicalAccessControl('read', { allowedFields: ['region'] }), getIAsOMCost);
// Save IAs O&M Cost data
iasOMCostRouter.post("/ias-om-cost", saveIAsOMCost);
module.exports = iasOMCostRouter;