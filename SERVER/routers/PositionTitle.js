const express = require('express');
const positionrouter = express.Router();
const checkToken = require('../middleware/check_token');
const check_token_dev = require("../middlewares/check_token_dev");
const check_token_prod = require("../middlewares/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;

const { getAllPositionTitles, getPositionTitleById  } = require('../controllers/PositionTitleController.js');
// Apply authentication to all position routes
positionrouter.use(tokenMiddleware);
positionrouter.get('/positions', getAllPositionTitles);
positionrouter.get('/byidpositions', getPositionTitleById);
module.exports = positionrouter;
