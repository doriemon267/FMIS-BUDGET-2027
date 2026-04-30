const express = require('express');
const { login, getUser, logout } = require('../controllers/AuthController');
const authMiddleware = require("../middleware/authMiddleware");
const router = express.Router();
router.post('/login', login);
router.get('/get-user',authMiddleware, getUser);
router.get('/logout', logout);
module.exports = router;
