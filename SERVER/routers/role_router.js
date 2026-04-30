const {
  saveRole,
  updateRole,
  getAllRoles,
  assignRole, // <-- POST  /assign-role
  getAllAssignedRoles, // <-- GET   /assign-role
  reAssignRole, // <-- PUT   /assign-role/:id
} = require("../controllers/role_controller");

const Router = require("express").Router;

const authMiddleware = require("../middleware/authMiddleware");

const roleRouter = Router();


// ----- ROLE CRUD -----
roleRouter.post("/roles", authMiddleware, saveRole);
roleRouter.put("/roles/:id", authMiddleware, updateRole);
roleRouter.get("/roles", authMiddleware, getAllRoles);

// ----- ASSIGN ROLE -----
roleRouter.post("/assign-role", authMiddleware, assignRole); // create new
roleRouter.get("/assign-role", authMiddleware, getAllAssignedRoles); // list
roleRouter.put("/assign-role/:id", authMiddleware, reAssignRole); // re-assign

module.exports = roleRouter;
