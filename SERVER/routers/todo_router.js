// routes/todo_routes.js
const {
  getAllTodos,
  createTodo,
  updateTodo,
  deleteTodo,
  clearCompleted,
} = require("../controllers/todo_controller");
const Router = require("express").Router;
const checkToken = require('../middleware/check_token');
const check_token_dev = require("../middlewares/check_token_dev");
const check_token_prod = require("../middlewares/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;


const todoRouter = Router();

// Apply authentication middleware to all routes in this router
todoRouter.use(tokenMiddleware);

// GET /api/todos
todoRouter.get("/todos", getAllTodos);

// POST /api/todos
todoRouter.post("/todos", createTodo);

// PUT /api/todos/:id
todoRouter.put("/todos/:id", updateTodo);

// DELETE /api/todos/completed
todoRouter.delete("/todos/completed",  clearCompleted);

// DELETE /api/todos/:id
todoRouter.delete("/todos/:id",  deleteTodo);

module.exports = todoRouter;
