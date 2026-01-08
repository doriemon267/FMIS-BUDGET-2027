const express = require('express');
const positionrouter = express.Router();
const checkToken = require('../middleware/check_token');
const { getAllPositionTitles, getPositionTitleById  } = require('../controllers/PositionTitleController.js');
// Apply authentication to all position routes
positionrouter.use(checkToken);
positionrouter.get('/positions', getAllPositionTitles);
positionrouter.get('/byidpositions', getPositionTitleById);
module.exports = positionrouter;
