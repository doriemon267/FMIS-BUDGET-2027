const express = require('express');
const router = express.Router();
const checkToken = require('../middleware/checkToken');
const { getAllPersonnel, addPersonnel } = require('../controllers/personnelController');
// Apply authentication middleware to all routes in this router
router.use(checkToken);
router.get('/personnels', getAllPersonnel);
router.post('/addpersonnel', addPersonnel);
module.exports = router;