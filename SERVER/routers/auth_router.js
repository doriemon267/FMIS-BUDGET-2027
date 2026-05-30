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

// DEV MOCK: Return a mock user directly when ALLOW_MOCK_AUTH=true and no JWT is present
// This prevents the frontend from being redirected to the NIA SSO login page during local dev.
authRouter.get("/get-user", (req, res, next) => {
  const isProduction = process.env.NODE_ENV === 'production' ||
    (process.env.PRODUCTION_MODE && String(process.env.PRODUCTION_MODE).trim().length > 0);
  const allowMock = !isProduction && (process.env.ALLOW_MOCK_AUTH === 'true' || process.env.DEBUG_MODE === 'true');

  if (allowMock) {
    const hasToken = !!(
      req.cookies?.jwtToken ||
      req.cookies?.authToken ||
      req.cookies?.jwt ||
      (req.headers.authorization || '').startsWith('Bearer ')
    );
    const hasDevHeader = !!(req.headers['x-dev-user-id'] || req.headers['X-Dev-User-Id']);

    // No JWT and no dev header → return mock user immediately (skip isAuth)
    if (!hasToken && !hasDevHeader) {
      const mockId = (process.env.SUPER_ADMIN_IDS || '').split(',').map(s => s.trim()).filter(Boolean)[0]
        || process.env.CLIENTOWNER_ID?.trim()
        || '909549';
      return res.json({
        user: {
          id: mockId,
          Id: mockId,
          userId: mockId,
          particularID: mockId,
          Username: [mockId],
          userName: mockId,
          DisplayName: `Dev User (${mockId})`,
          FirstName: 'Dev',
          LastName: `User`,
          Roles: ['SUPER_ADMIN'],
          isDev: true,
        }
      });
    }
  }

  return next();
}, isAuth, getUser);

authRouter.get("/logout", logout);

module.exports = authRouter;
