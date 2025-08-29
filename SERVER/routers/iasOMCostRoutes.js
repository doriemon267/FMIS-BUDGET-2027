const { getIAsOMCost, saveIAsOMCost } = require("../controllers/iasOMCost.controller");

const Router = require("express").Router;
const checkToken = require('../middleware/checkToken');
const iasOMCostRouter = Router();

// Apply authentication to all IAs O&M Cost routes
iasOMCostRouter.use(checkToken);

// Get IAs O&M Cost data
iasOMCostRouter.get("/ias-om-cost", getIAsOMCost);

// Save IAs O&M Cost data
iasOMCostRouter.post("/ias-om-cost", saveIAsOMCost);

module.exports = iasOMCostRouter;