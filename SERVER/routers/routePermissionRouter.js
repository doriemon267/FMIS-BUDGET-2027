const Router = require("express").Router;
const isAuth = require("../middleware/is_auth");
const {
  getAll,
  getAllAdmin,
  create,
  update,
  updateByPath,
  deleteRoute,
  seed,
  resetToDefault,
} = require("../controllers/routePermissionController");

const routePermissionRouter = Router();

// GET  /api/route-permissions          – active routes only (used by frontend context)
routePermissionRouter.get("/route-permissions", isAuth, getAll);

// GET  /api/route-permissions/all      – all routes incl. inactive (admin view)
routePermissionRouter.get("/route-permissions/all", isAuth, getAllAdmin);

// POST /api/route-permissions          – create new route permission
routePermissionRouter.post("/route-permissions", isAuth, create);

// POST /api/route-permissions/seed     – seed defaults for missing paths
routePermissionRouter.post("/route-permissions/seed", isAuth, seed);

// PUT  /api/route-permissions/by-path  – update by path string
routePermissionRouter.put("/route-permissions/by-path", isAuth, updateByPath);

// PUT  /api/route-permissions/:id      – update by MongoDB _id
routePermissionRouter.put("/route-permissions/:id", isAuth, update);

// DELETE /api/route-permissions/:id    – delete route permission
routePermissionRouter.delete("/route-permissions/:id", isAuth, deleteRoute);

// POST /api/route-permissions/reset/:id – reset single record to seeded default
routePermissionRouter.post("/route-permissions/reset/:id", isAuth, resetToDefault);

module.exports = routePermissionRouter;
