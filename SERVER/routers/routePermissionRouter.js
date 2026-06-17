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
  sync,
  resetToDefault,
  bulkUpdateRole,
  saveDefaults,
  restoreDefaults,
} = require("../controllers/routePermissionController");

const routePermissionRouter = Router();
const requireDynamicPermission = require("../middleware/requireDynamicPermission");

// GET  /api/route-permissions          – active routes only (used by frontend context)
routePermissionRouter.get("/route-permissions", isAuth, getAll);

// GET  /api/route-permissions/all      – all routes incl. inactive (admin view)
routePermissionRouter.get("/route-permissions/all", isAuth, requireDynamicPermission('/route-permissions'), getAllAdmin);

// POST /api/route-permissions          – create new route permission
routePermissionRouter.post("/route-permissions", isAuth, requireDynamicPermission('/route-permissions'), create);

// POST /api/route-permissions/seed     – seed defaults for missing paths
routePermissionRouter.post("/route-permissions/seed", isAuth, requireDynamicPermission('/route-permissions'), seed);

// POST /api/route-permissions/sync     – sync dynamic frontend routes
routePermissionRouter.post("/route-permissions/sync", isAuth, requireDynamicPermission('/route-permissions'), sync);

// POST /api/route-permissions/save-defaults - Save current config as default
routePermissionRouter.post("/route-permissions/save-defaults", isAuth, requireDynamicPermission('/route-permissions'), saveDefaults);

// POST /api/route-permissions/restore-defaults - Restore config from default
routePermissionRouter.post("/route-permissions/restore-defaults", isAuth, requireDynamicPermission('/route-permissions'), restoreDefaults);

// POST /api/route-permissions/bulk-update - Bulk assign or remove a role from multiple routes
routePermissionRouter.post("/route-permissions/bulk-update", isAuth, requireDynamicPermission('/route-permissions'), bulkUpdateRole);

// PUT  /api/route-permissions/by-path  – update by path string
routePermissionRouter.put("/route-permissions/by-path", isAuth, requireDynamicPermission('/route-permissions'), updateByPath);

// PUT  /api/route-permissions/:id      – update by MongoDB _id
routePermissionRouter.put("/route-permissions/:id", isAuth, requireDynamicPermission('/route-permissions'), update);

// DELETE /api/route-permissions/:id    – delete route permission
routePermissionRouter.delete("/route-permissions/:id", isAuth, requireDynamicPermission('/route-permissions'), deleteRoute);

// POST /api/route-permissions/reset/:id – reset single record to seeded default
routePermissionRouter.post("/route-permissions/reset/:id", isAuth, requireDynamicPermission('/route-permissions'), resetToDefault);

module.exports = routePermissionRouter;
