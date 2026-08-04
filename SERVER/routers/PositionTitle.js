const express = require('express');
const positionrouter = express.Router();
const isAuth = require('../middleware/is_auth');

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
positionrouter.post('/positions', createPositionTitle);
positionrouter.put('/positions/:id', updatePositionTitle);
positionrouter.delete('/positions/:id', deletePositionTitle);
module.exports = positionrouter;
