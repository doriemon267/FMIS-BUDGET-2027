// controllers/todo_controller.js
const Todo = require("../models/todo");
const { searchFilter } = require("../utils/controller_get_process");

exports.getAllTodos = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search,
      done,
      orderBy = "startDate",
      order = "desc",
    } = req.query;

    const userId = req.user?.Username?.[0];

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Math.min(100, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    let query = { userId };

    // Filter by done status
    if (done !== undefined) {
      query.done = done === "true";
    }

    // Global search on text
    if (search) {
      searchFilter(query, search, ["text"]);
    }

    // Sorting
    const sortOrder = order.toLowerCase() === "asc" ? 1 : -1;
    const sortQuery = { [orderBy]: sortOrder };

    const todos = await Todo.find(query)
      .skip(skip)
      .limit(limitNum)
      .sort(sortQuery)
      .lean(); // Faster, plain JS objects

    const totalRecords = await Todo.countDocuments(query);

    return res.json({
      todos,
      totalPages: Math.ceil(totalRecords / limitNum),
      currentPage: pageNum,
      totalRecords,
    });
  } catch (e) {
    console.error("getAllTodos error:", e);
    return res.status(500).json({ error: "Failed to fetch todos." });
  }
};

exports.createTodo = async (req, res) => {
  try {
    const userId = req.user?.Username?.[0];
    const { text, dueDate } = req.body;

    if (!text?.trim()) {
      return res.status(400).json({ error: "Task text is required." });
    }

    const newTodo = new Todo({
      text: text.trim(),
      dueDate: dueDate ? new Date(dueDate) : null,
      userId,
    });

    await newTodo.save();

    return res.status(201).json({
      message: "Todo created successfully.",
      todo: newTodo,
    });
  } catch (e) {
    console.error("createTodo error:", e);
    return res.status(500).json({ error: "Failed to create todo." });
  }
};

exports.updateTodo = async (req, res) => {
  try {
    const { id } = req.params;
    const { text, done, dueDate } = req.body;

    const updates = {};
    if (text !== undefined) updates.text = text.trim();
    if (done !== undefined) updates.done = Boolean(done);
    if (dueDate !== undefined)
      updates.dueDate = dueDate ? new Date(dueDate) : null;

    const updated = await Todo.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res.status(404).json({ error: "Todo not found." });
    }

    return res.json({
      message: "Todo updated.",
      todo: updated,
    });
  } catch (e) {
    console.error("updateTodo error:", e);
    return res.status(500).json({ error: "Failed to update todo." });
  }
};

exports.deleteTodo = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await Todo.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: "Todo not found." });
    }

    return res.json({ message: "Todo deleted." });
  } catch (e) {
    console.error("deleteTodo error:", e);
    return res.status(500).json({ error: "Failed to delete todo." });
  }
};

exports.clearCompleted = async (req, res) => {
  try {
    const userId = req.user?.Username?.[0];
    await Todo.deleteMany({ done: true, userId });
    return res.json({
      message: `Cleared completed todo(s).`,
    });
  } catch (e) {
    console.error("clearCompleted error:", e);
    return res.status(500).json({ error: "Failed to clear completed todos." });
  }
};
