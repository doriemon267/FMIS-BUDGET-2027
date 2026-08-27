const express = require('express');
const positionrouter = express.Router();
const isAuth = require('../middleware/is_auth');
const requireDynamicPermission = require('../middleware/requireDynamicPermission');

const { 
  getAllPositionTitles, 
  getPositionTitleById,
  createPositionTitle,
  updatePositionTitle,
  deletePositionTitle
} = require('../controllers/PositionTitleController.js');
// Apply authentication to all position routes
positionrouter.use(isAuth);
positionrouter.get('/positions', getAllPositionTitles);
positionrouter.get('/positions/:id', getPositionTitleById);
positionrouter.post('/positions', requireDynamicPermission('/position-titles'), createPositionTitle);
positionrouter.put('/positions/:id', requireDynamicPermission('/position-titles'), updatePositionTitle);
positionrouter.delete('/positions/:id', requireDynamicPermission('/position-titles'), deletePositionTitle);
module.exports = positionrouter;
