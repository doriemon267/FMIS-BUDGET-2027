const express = require('express');
const router = express.Router();
const mssqlController = require('../controllers/mssqlController');
const checkToken = require('../middleware/check_token');

// List / query
router.get('/', checkToken, mssqlController.list);
router.get('/merged', checkToken, mssqlController.listMerged);
// Get single
router.get('/:id', checkToken, mssqlController.getById);
// Create
router.post('/', checkToken, mssqlController.create);
// Update
router.put('/:id', checkToken, mssqlController.update);
// Delete
router.delete('/:id', checkToken, mssqlController.remove);

module.exports = router;
