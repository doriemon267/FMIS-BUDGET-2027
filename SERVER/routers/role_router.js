const {
  saveRole,
  updateRole,
  getAllRoles,
  assignRole, // <-- POST  /assign-role
  getAllAssignedRoles, // <-- GET   /assign-role
  reAssignRole, // <-- PUT   /assign-role/:id
} = require("../controllers/role_controller");

const Router = require("express").Router;

const check_token_dev = require("../middleware/check_token_dev");
const check_token_prod = require("../middleware/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");

const roleRouter = Router();

const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;

// ----- ROLE CRUD -----
roleRouter.post("/roles", tokenMiddleware, saveRole);
roleRouter.put("/roles/:id", tokenMiddleware, updateRole);
roleRouter.get("/roles", tokenMiddleware, getAllRoles);

// ----- ASSIGN ROLE -----
roleRouter.post("/assign-role", tokenMiddleware, assignRole); // create new
roleRouter.get("/assign-role", tokenMiddleware, getAllAssignedRoles); // list
roleRouter.put("/assign-role/:id", tokenMiddleware, reAssignRole); // re-assign

module.exports = roleRouter;
