const {
  getAllGroups,
  getGroupById,
  createGroup,
  updateGroup,
  deleteGroup,
  getCategoriesByGroup,
  getGroupedCategoriesSummary,
} = require("../controllers/incomeCategoryGroupController");
const Router = require("express").Router;
const isAuth = require('../middleware/is_auth');

const incomeCategoryGroupRouter = Router();

// Apply authentication middleware to all routes
incomeCategoryGroupRouter.use(isAuth);

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
