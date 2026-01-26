const { getIAsOMCost, saveIAsOMCost } = require("../controllers/iasOMCost.controller");
const Router = require("express").Router;
const checkToken = require('../middleware/check_token');
const check_token_dev = require("../middleware/check_token_dev");
const check_token_prod = require("../middleware/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;

const { strictHierarchicalControl, hierarchicalAccessControl } = require('../middleware/hierarchicalAccessControl');
const iasOMCostRouter = Router();
// Apply authentication to all IAs O&M Cost routes
iasOMCostRouter.use(tokenMiddleware);
// Get IAs O&M Cost data
iasOMCostRouter.get("/ias-om-cost", hierarchicalAccessControl('read', { allowedFields: ['region'] }), getIAsOMCost);
// Save IAs O&M Cost data
iasOMCostRouter.post("/ias-om-cost", saveIAsOMCost);
module.exports = iasOMCostRouter;