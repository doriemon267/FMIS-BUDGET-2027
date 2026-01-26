const express = require('express');
const router = express.Router();
const mssqlController = require('../controllers/mssqlController');
const checkToken = require('../middleware/check_token');
const check_token_dev = require("../middleware/check_token_dev");
const check_token_prod = require("../middleware/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;
// Apply authentication middleware to all routes in this router
router.use(tokenMiddleware);

// List / query
router.get('/', mssqlController.list);
router.get('/merged', mssqlController.listMerged);
// Get single
router.get('/:id', mssqlController.getById);
// Create
router.post('/', mssqlController.create);
// Update
router.put('/:id', mssqlController.update);
// Delete
router.delete('/:id', mssqlController.remove);

module.exports = router;
