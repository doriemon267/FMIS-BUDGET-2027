const express = require('express');
const { login, getUser, logout } = require('../controllers/AuthController');
const router = express.Router();
router.post('/login', login);
router.get('/get-user', getUser);
router.get('/logout', logout);
module.exports = router;
