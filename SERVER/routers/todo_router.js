// routes/todo_routes.js
const {
  getAllTodos,
  createTodo,
  updateTodo,
  deleteTodo,
  clearCompleted,
} = require("../controllers/todo_controller");
const Router = require("express").Router;
const authMiddleware = require("../middleware/authMiddleware");


const todoRouter = Router();

// Apply authentication middleware to all routes in this router
todoRouter.use(authMiddleware);

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
