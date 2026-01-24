const { login, getUser, logout } = require("../controllers/auth_controller");
const check_token_dev = require("../middleware/check_token_dev");
const check_token_prod = require("../middleware/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");

const Router = require("express").Router;

const authRouter = Router();

const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;

authRouter.post("/login", login);
authRouter.get("/get-user", tokenMiddleware, getUser);
authRouter.get("/logout", logout);

module.exports = authRouter;