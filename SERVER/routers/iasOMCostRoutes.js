const { getIAsOMCost, saveIAsOMCost } = require("../controllers/iasOmCostController");
const Router = require("express").Router;
const isAuth = require('../middleware/is_auth');

const { strictHierarchicalControl, hierarchicalAccessControl } = require('../middleware/hierarchicalAccessControl');
const iasOMCostRouter = Router();
// Apply authentication to all IAs O&M Cost routes
iasOMCostRouter.use(isAuth);
// Get IAs O&M Cost data
iasOMCostRouter.get("/ias-om-cost", hierarchicalAccessControl('read', { allowedFields: ['region'] }), getIAsOMCost);
// Save IAs O&M Cost data
iasOMCostRouter.post("/ias-om-cost", saveIAsOMCost);
module.exports = iasOMCostRouter;
