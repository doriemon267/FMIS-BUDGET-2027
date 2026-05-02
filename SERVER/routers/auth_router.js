const { login, getUser, logout } = require("../controllers/auth_controller");
const isAuth = require("../middleware/is_auth");
const { validateJoi, Joi } = require("../middleware/validateJoi");

const Router = require("express").Router;

const authRouter = Router();

const loginSchema = Joi.object({
  username: Joi.string().required().max(255),
  password: Joi.string().required().max(512),
  rememberMe: Joi.boolean().optional(),
});

authRouter.post("/login", validateJoi(loginSchema, { source: "body" }), login);
authRouter.get("/get-user", isAuth, getUser);
authRouter.get("/logout", logout);

module.exports = authRouter;
