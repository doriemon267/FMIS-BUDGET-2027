const Router = require('express').Router;

const check_token_dev = require("../middleware/check_token_dev");
const check_token_prod = require("../middleware/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;

const { getConversations, getMessagesWithUser, sendMessage, markMessagesRead, searchContacts, getPresence, deleteMessage, deleteConversation, debugDump } = require('../controllers/chatController');

const router = Router();

// All chat routes require authentication
router.use(tokenMiddleware);

router.get('/conversations', getConversations);
router.get('/messages/:userId', getMessagesWithUser);
router.post('/messages/:userId/read', markMessagesRead);
router.get('/contacts', searchContacts);
router.get('/presence', getPresence);
router.post('/messages', sendMessage);
router.delete('/messages/:messageId', deleteMessage);
router.delete('/conversations/:peerId', deleteConversation);

// Dev / debug-only: return server presence map
if (process.env.DEBUG_MODE === 'true' || process.env.ALLOW_MOCK_AUTH === 'true') {
	router.get('/debug/online', (req, res) => {
		try {
			const onlineMap = {};
			if (global && global.onlineUsers) {
				global.onlineUsers.forEach((info, userId) => {
					onlineMap[String(userId)] = info;
				});
			}
			return res.json({ online: onlineMap, count: Object.keys(onlineMap).length });
		} catch (e) {
			console.error('chatRoutes debug/online error', e?.message || e);
			return res.status(500).json({ message: 'Server error', error: e?.message || e });
		}
	});

	router.get('/debug/dump', debugDump);
}

module.exports = router;
