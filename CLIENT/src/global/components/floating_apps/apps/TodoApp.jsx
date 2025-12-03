// components/TodoApp.jsx
import { useState } from "react";
import {
  Box,
  TextField,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Checkbox,
  Typography,
  Button,
  Divider,
  Tooltip,
  CircularProgress,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Stack,
} from "@mui/material";
import { MdDelete, MdOutlineCheckCircle, MdAdd, MdEdit, MdMoreVert } from "react-icons/md";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../../../config/api";

// API Calls
const fetchTodos = () => api.get("/api/todos").then((res) => res.data.todos);
const createTodo = (data) =>
  api.post("/api/todos", data).then((res) => res.data.todo);
const updateTodo = ({ id, ...data }) =>
  api.put(`/api/todos/${id}`, data).then((res) => res.data.todo);
const deleteTodo = (id) => api.delete(`/api/todos/${id}`).then(() => id);
const clearCompleted = () => api.delete("/api/todos/completed");

// Priority configurations
const PRIORITIES = {
  low: { label: "Low", color: "#4caf50", bgColor: "rgba(76,175,80,0.1)" },
  medium: { label: "Medium", color: "#ff9800", bgColor: "rgba(255,152,0,0.1)" },
  high: { label: "High", color: "#f44336", bgColor: "rgba(244,67,54,0.1)" },
};

// Category configurations
const CATEGORIES = {
  work: { label: "Work", color: "#2196f3" },
  personal: { label: "Personal", color: "#9c27b0" },
  health: { label: "Health", color: "#4caf50" },
  shopping: { label: "Shopping", color: "#ff9800" },
  finance: { label: "Finance", color: "#673ab7" },
  other: { label: "Other", color: "#9e9e9e" },
};

// Recurring options
const RECURRING_OPTIONS = {
  none: "No Repeat",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

const TodoApp = () => {
  const [input, setInput] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [category, setCategory] = useState("work");
  const [recurring, setRecurring] = useState("none");
  const [estimatedTime, setEstimatedTime] = useState("");
  
  // Filtering & sorting
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [sortBy, setSortBy] = useState("dueDate"); // dueDate, priority, category
  const [showCompleted, setShowCompleted] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const queryClient = useQueryClient();

  // Fetch todos
  const { data: todos = [], isLoading } = useQuery({
    queryKey: ["todos"],
    queryFn: fetchTodos,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: createTodo,
    onSuccess: () => queryClient.invalidateQueries(["todos"]),
  });
  const updateMutation = useMutation({
    mutationFn: updateTodo,
    onSuccess: () => queryClient.invalidateQueries(["todos"]),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteTodo,
    onSuccess: () => queryClient.invalidateQueries(["todos"]),
  });
  const clearMutation = useMutation({
    mutationFn: clearCompleted,
    onSuccess: () => queryClient.invalidateQueries(["todos"]),
  });

  const addTodo = () => {
    if (!input.trim()) return;
    createMutation.mutate({ 
      text: input.trim(), 
      dueDate: dueDate || null,
      priority,
      category,
      recurring,
      estimatedTime: estimatedTime || null,
      subtasks: [],
    });
    setInput("");
    setDueDate("");
    setPriority("medium");
    setCategory("work");
    setRecurring("none");
    setEstimatedTime("");
  };

  const toggle = (id, done) => {
    updateMutation.mutate({ id, done: !done });
  };

  const remove = (id) => {
    deleteMutation.mutate(id);
  };

  // Filter and sort todos
  const filteredTodos = todos.filter((t) => {
    if (!showCompleted && t.done) return false;
    if (filterCategory !== "all" && t.category !== filterCategory) return false;
    if (filterPriority !== "all" && t.priority !== filterPriority) return false;
    return true;
  });

  const sortedTodos = [...filteredTodos].sort((a, b) => {
    if (sortBy === "priority") {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1);
    } else if (sortBy === "category") {
      return (a.category || "").localeCompare(b.category || "");
    } else if (sortBy === "dueDate") {
      const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return aDate - bDate;
    }
    return 0;
  });

  // Calculate statistics
  const stats = {
    total: todos.length,
    completed: todos.filter((t) => t.done).length,
    pending: todos.filter((t) => !t.done).length,
    overdue: todos.filter((t) => !t.done && t.dueDate && new Date(t.dueDate) < new Date()).length,
  };

  const completionPercentage = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;

  const handleKeyDown = (e) => {
    // Shift+Enter → new line, plain Enter → add todo
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      addTodo();
    }
  };

  const formatCreated = (d) =>
    new Date(d)
      .toLocaleString("en-US", {
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
      .replace(",", "");

  const formatDue = (d) =>
    d ? `Due: ${new Date(d).toLocaleDateString()}` : null;

  const isOverdue = (dueDate) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date() && new Date(dueDate).toDateString() !== new Date().toDateString();
  };

  return (
    <Box
      sx={{
        bgcolor: "rgba(20, 20, 20, 0.9)",
        boxShadow: "0 4px 15px rgba(0,0,0,0.5)",
        width: 360,
        p: 2.5,
        pt: 1.5,
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        transition: "all 0.3s ease",
        backdropFilter: "blur(6px)",
        position: "relative",
        zIndex: 1300,
        "&:hover": { boxShadow: "0 6px 20px rgba(0,0,0,0.6)" },
      }}
    >
      <Typography
        variant="h6"
        sx={{
          mb: 1.5,
          fontWeight: 800,
          color: "#6fcf97",
          fontFamily: "monospace",
          letterSpacing: "0.5px",
          textAlign: "center",
        }}
      >
        TODO LIST
      </Typography>

      {/* Completion Statistics */}
      <Box sx={{ mb: 2, p: 1, bgcolor: "rgba(111, 207, 151, 0.1)", borderRadius: 1 }}>
        <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
          <Typography variant="caption" sx={{ color: "#aaa" }}>
            {stats.completed}/{stats.total} completed
          </Typography>
          <Typography variant="caption" sx={{ color: stats.overdue > 0 ? "#ff6b6b" : "#6fcf97" }}>
            {stats.overdue > 0 ? `${stats.overdue} overdue` : "All on track"}
          </Typography>
        </Stack>
        <LinearProgress 
          variant="determinate" 
          value={completionPercentage} 
          sx={{ 
            height: 6, 
            borderRadius: 3,
            bgcolor: "rgba(255,255,255,0.1)",
            "& .MuiLinearProgress-bar": { bgcolor: "#6fcf97" }
          }} 
        />
      </Box>

      {/* ---------- MULTILINE INPUT ---------- */}
      <TextField
        fullWidth
        multiline
        rows={2}
        placeholder="Add a task... (Shift+Enter for new line)"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        sx={{
          mb: 1.5,
          "& .MuiOutlinedInput-root": {
            "& fieldset": { borderColor: "#6fcf97" },
            "&:hover fieldset": { borderColor: "#81e69a" },
            "&.Mui-focused fieldset": { borderColor: "#6fcf97" },
          },
          "& .MuiInputBase-input": {
            color: "#fff",
            fontSize: "0.9rem",
          },
        }}
      />

      {/* Priority, Category, Recurring, Time Estimate */}
      <Stack direction="row" spacing={1} sx={{ mb: 1.5, flexWrap: "wrap", gap: 1 }}>
        <FormControl size="small" sx={{ minWidth: 80 }}>
          <Select 
            value={priority} 
            onChange={(e) => setPriority(e.target.value)}
            MenuProps={{
              PaperProps: {
                sx: {
                  zIndex: 1400,
                },
              },
            }}
            sx={{ 
              fontSize: "0.8rem", 
              color: "#fff",
              "& .MuiOutlinedInput-notchedOutline": { borderColor: "#555" },
              "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#777" },
              "& .MuiSvgIcon-root": { color: "#fff" },
            }}
          >
            <MenuItem value="low">Low</MenuItem>
            <MenuItem value="medium">Medium</MenuItem>
            <MenuItem value="high">High</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 90 }}>
          <Select 
            value={category} 
            onChange={(e) => setCategory(e.target.value)}
            MenuProps={{
              PaperProps: {
                sx: {
                  zIndex: 1400,
                },
              },
            }}
            sx={{ 
              fontSize: "0.8rem", 
              color: "#fff",
              "& .MuiOutlinedInput-notchedOutline": { borderColor: "#555" },
              "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#777" },
              "& .MuiSvgIcon-root": { color: "#fff" },
            }}
          >
            {Object.entries(CATEGORIES).map(([key, val]) => (
              <MenuItem key={key} value={key}>{val.label}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 90 }}>
          <Select 
            value={recurring} 
            onChange={(e) => setRecurring(e.target.value)}
            MenuProps={{
              PaperProps: {
                sx: {
                  zIndex: 1400,
                },
              },
            }}
            sx={{ 
              fontSize: "0.8rem", 
              color: "#fff",
              "& .MuiOutlinedInput-notchedOutline": { borderColor: "#555" },
              "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#777" },
              "& .MuiSvgIcon-root": { color: "#fff" },
            }}
          >
            {Object.entries(RECURRING_OPTIONS).map(([key, label]) => (
              <MenuItem key={key} value={key}>{label}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          size="small"
          type="number"
          placeholder="Est. min"
          value={estimatedTime}
          onChange={(e) => setEstimatedTime(e.target.value)}
          inputProps={{ min: 0, max: 999 }}
          sx={{ 
            width: 70,
            "& input": { color: "#fff", fontSize: "0.8rem" },
            "& .MuiOutlinedInput-root": { "& fieldset": { borderColor: "#555" } }
          }}
        />
      </Stack>

      {/* Due Date */}
      <TextField
        fullWidth
        size="small"
        type="date"
        label="Due Date (optional)"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        onKeyDown={handleKeyDown}
        InputLabelProps={{ shrink: true }}
        sx={{
          input: { color: "#fff", fontSize: "0.9rem" },
          mb: 1.5,
          "& .MuiOutlinedInput-root": {
            "& fieldset": { borderColor: "#555" },
            "&:hover fieldset": { borderColor: "#777" },
          },
          "& .MuiInputLabel-root": { color: "#aaa" },
          "& input::-webkit-calendar-picker-indicator": { filter: "invert(1)" },
        }}
      />

      {/* Filter & Sort Controls */}
      <Stack direction="row" spacing={0.5} sx={{ mb: 1.5, flexWrap: "wrap", gap: 0.5 }}>
        <Chip 
          label="All" 
          size="small"
          onClick={() => setFilterCategory("all")}
          variant={filterCategory === "all" ? "filled" : "outlined"}
          sx={{ fontSize: "0.7rem", color: filterCategory === "all" ? "#000" : "#fff" }}
        />
        {Object.entries(CATEGORIES).map(([key, val]) => (
          <Chip
            key={key}
            label={val.label}
            size="small"
            onClick={() => setFilterCategory(key)}
            variant={filterCategory === key ? "filled" : "outlined"}
            sx={{ fontSize: "0.7rem", color: filterCategory === key ? "#fff" : "#fff", borderColor: filterCategory !== key ? "#666" : "transparent" }}
          />
        ))}
      </Stack>

      <Divider sx={{ width: "100%", mb: 1.5, borderColor: "rgba(255,255,255,0.1)" }} />

      {/* Sorting and Display Options */}
      <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: "wrap" }}>
        <FormControl size="small" sx={{ minWidth: 90 }}>
          <Select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            MenuProps={{
              PaperProps: {
                sx: {
                  zIndex: 1400,
                },
              },
            }}
            sx={{ 
              fontSize: "0.75rem", 
              color: "#fff",
              "& .MuiOutlinedInput-notchedOutline": { borderColor: "#555" },
              "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#777" },
              "& .MuiSvgIcon-root": { color: "#fff" },
            }}
          >
            <MenuItem value="dueDate">Sort: Due Date</MenuItem>
            <MenuItem value="priority">Sort: Priority</MenuItem>
            <MenuItem value="category">Sort: Category</MenuItem>
          </Select>
        </FormControl>

        <Button
          size="small"
          variant={showCompleted ? "contained" : "outlined"}
          onClick={() => setShowCompleted(!showCompleted)}
          sx={{ fontSize: "0.7rem", py: 0.3, color: "#fff" }}
        >
          {showCompleted ? "Hide" : "Show"} Done
        </Button>
      </Stack>

      {/* ---------- LIST ---------- */}
      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
          <CircularProgress size={24} sx={{ color: "#6fcf97" }} />
        </Box>
      ) : (
        <List
          dense
          sx={{
            width: "100%",
            flex: 1,
            maxHeight: 280,
            overflowY: "auto",
            pr: 0.5,
            mb: 1,
          }}
        >
          {sortedTodos.length === 0 ? (
            <ListItem>
              <ListItemText
                primary={filteredTodos.length === 0 && todos.length > 0 ? "No matching tasks" : "No tasks yet"}
                primaryTypographyProps={{
                  align: "center",
                  color: "#aaa",
                  fontStyle: "italic",
                }}
              />
            </ListItem>
          ) : (
            sortedTodos.map((todo) => (
              <Box key={todo._id}>
                <ListItem
                  disableGutters
                  sx={{
                    bgcolor: PRIORITIES[todo.priority]?.bgColor || PRIORITIES.medium.bgColor,
                    borderRadius: 1.2,
                    mb: 1,
                    py: 0.6,
                    px: 1.5,
                    transition: "background-color 0.25s",
                    borderLeft: `3px solid ${PRIORITIES[todo.priority]?.color || PRIORITIES.medium.color}`,
                    "&:hover": { bgcolor: "rgba(255,255,255,0.12)" },
                  }}
                  secondaryAction={
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title="Delete">
                        <IconButton
                          onClick={() => remove(todo._id)}
                          size="small"
                          sx={{ color: "#d66", "&:hover": { color: "#ff6b6b" } }}
                        >
                          <MdDelete size={16} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  }
                >
                  <Checkbox
                    checked={todo.done}
                    onChange={() => toggle(todo._id, todo.done)}
                    sx={{
                      color: "#6fcf97",
                      "&.Mui-checked": { color: "#6fcf97" },
                    }}
                  />

                  <Box sx={{ flexGrow: 1, overflow: "hidden" }}>
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", flexWrap: "wrap", gap: 0.5 }}>
                          <span style={{ textDecoration: todo.done ? "line-through" : "none", color: todo.done ? "#999" : "#fff" }}>
                            {todo.text}
                          </span>
                          <Chip 
                            label={CATEGORIES[todo.category]?.label || "Other"} 
                            size="small" 
                            sx={{ height: 18, fontSize: "0.65rem", color: "#fff" }} 
                          />
                          {todo.recurring && todo.recurring !== "none" && (
                            <Chip 
                              label={RECURRING_OPTIONS[todo.recurring]} 
                              size="small" 
                              variant="outlined"
                              sx={{ height: 18, fontSize: "0.65rem", color: "#fff", borderColor: "#666" }} 
                            />
                          )}
                        </Stack>
                      }
                      secondary={
                        <>
                          <span style={{ display: "block", color: "#aaa", fontSize: "0.75rem" }}>
                            {formatCreated(todo.startDate)}
                            {todo.estimatedTime && ` • ${todo.estimatedTime}min`}
                          </span>
                          {todo.dueDate && (
                            <span style={{ 
                              display: "block", 
                              color: isOverdue(todo.dueDate) ? "#ff6b6b" : "#aaa",
                              fontSize: "0.75rem",
                              fontWeight: isOverdue(todo.dueDate) ? "bold" : "normal",
                            }}>
                              {formatDue(todo.dueDate)}
                            </span>
                          )}
                        </>
                      }
                      primaryTypographyProps={{
                        sx: {
                          fontSize: "0.9rem",
                          fontWeight: 500,
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        },
                      }}
                      secondaryTypographyProps={{
                        component: "div",
                        sx: {
                          fontSize: "0.75rem",
                          fontFamily: "monospace",
                          lineHeight: 1.3,
                        },
                      }}
                    />
                  </Box>
                </ListItem>
              </Box>
            ))
          )}
        </List>
      )}

      {/* ---------- ACTION BUTTONS ---------- */}
      <Box sx={{ display: "flex", gap: 1, width: "100%", flexWrap: "wrap" }}>
        <Button
          fullWidth
          variant="contained"
          startIcon={<MdAdd />}
          onClick={addTodo}
          disabled={!input.trim() || createMutation.isPending}
          sx={{
            bgcolor: "#6fcf97",
            color: "#000",
            fontWeight: "bold",
            textTransform: "none",
            borderRadius: 1.5,
            fontSize: "0.85rem",
            "&:hover": { bgcolor: "#81e69a" },
            "&.Mui-disabled": { bgcolor: "#444", color: "#777" },
          }}
        >
          Add Task
        </Button>

        {todos.some((t) => t.done) && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<MdOutlineCheckCircle />}
            onClick={() => clearMutation.mutate()}
            disabled={clearMutation.isPending}
            sx={{
              borderColor: "#4e8c4d",
              color: "#6fcf97",
              textTransform: "none",
              fontWeight: "bold",
              borderRadius: 1.5,
              fontSize: "0.75rem",
              "&:hover": {
                borderColor: "#6fcf97",
                bgcolor: "rgba(111, 207, 151, 0.1)",
              },
            }}
          >
            Clear Done
          </Button>
        )}
      </Box>
    </Box>
  );
};

export default TodoApp;
