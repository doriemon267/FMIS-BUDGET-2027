const express = require('express');
const positionrouter = express.Router();
const isAuth = require('../middleware/is_auth');

const { getAllPositionTitles, getPositionTitleById  } = require('../controllers/PositionTitleController.js');
// Apply authentication to all position routes
positionrouter.use(isAuth);
positionrouter.get('/positions', getAllPositionTitles);
positionrouter.get('/byidpositions', getPositionTitleById);
module.exports = positionrouter;

