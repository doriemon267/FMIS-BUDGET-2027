const {
  getAllGroups,
  getGroupById,
  createGroup,
  updateGroup,
  deleteGroup,
  getCategoriesByGroup,
  getGroupedCategoriesSummary,
} = require("../controllers/IncomeCategoryGroupController");
const Router = require("express").Router;
const checkToken = require("../middleware/check_token");
const check_token_dev = require("../middlewares/check_token_dev");
const check_token_prod = require("../middlewares/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;

const incomeCategoryGroupRouter = Router();

// Apply authentication middleware to all routes
incomeCategoryGroupRouter.use(tokenMiddleware);

// Get grouped categories summary (for frontend display)
incomeCategoryGroupRouter.get("/income-category-groups/summary", getGroupedCategoriesSummary);

// Get all groups with pagination
incomeCategoryGroupRouter.get("/income-category-groups", getAllGroups);

// Get group by ID with its categories
incomeCategoryGroupRouter.get("/income-category-groups/:id", getGroupById);

// Get categories in a specific group
incomeCategoryGroupRouter.get("/income-category-groups/:id/categories", getCategoriesByGroup);

// Create new group
incomeCategoryGroupRouter.post("/income-category-groups", createGroup);

// Update group
incomeCategoryGroupRouter.put("/income-category-groups/:id", updateGroup);

// Delete group
incomeCategoryGroupRouter.delete("/income-category-groups/:id", deleteGroup);

module.exports = incomeCategoryGroupRouter;