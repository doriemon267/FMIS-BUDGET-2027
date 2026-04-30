const express = require('express');
const positionrouter = express.Router();
const authMiddleware = require("../middleware/authMiddleware");

const { getAllPositionTitles, getPositionTitleById  } = require('../controllers/PositionTitleController.js');
// Apply authentication to all position routes
positionrouter.use(authMiddleware);
positionrouter.get('/positions', getAllPositionTitles);
positionrouter.get('/byidpositions', getPositionTitleById);
module.exports = positionrouter;
