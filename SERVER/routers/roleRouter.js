const {
  saveRole,
  updateRole,
  getAllRoles,
  assignRole, // <-- POST  /assign-role
  getAllAssignedRoles, // <-- GET   /assign-role
  reAssignRole, // <-- PUT   /assign-role/:id
} = require("../controllers/role_controller");

const Router = require("express").Router;
const isAuth = require('../middleware/is_auth');
const roleRouter = Router();

// ----- ROLE CRUD -----
roleRouter.post("/roles", isAuth, saveRole);
roleRouter.put("/roles/:id", isAuth, updateRole);
roleRouter.get("/roles", isAuth, getAllRoles);

// ----- ASSIGN ROLE -----
roleRouter.post("/assign-role", isAuth, assignRole); // create new
roleRouter.get("/assign-role", isAuth, getAllAssignedRoles); // list
roleRouter.put("/assign-role/:id", isAuth, reAssignRole); // re-assign

module.exports = roleRouter;

