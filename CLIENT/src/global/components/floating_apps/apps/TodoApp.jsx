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
} from "@mui/material";
import { MdDelete, MdOutlineCheckCircle, MdAdd } from "react-icons/md";
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

const TodoApp = () => {
  const [input, setInput] = useState("");
  const [dueDate, setDueDate] = useState("");

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
    createMutation.mutate({ text: input.trim(), dueDate: dueDate || null });
    setInput("");
    setDueDate("");
  };

  const toggle = (id, done) => {
    updateMutation.mutate({ id, done: !done });
  };

  const remove = (id) => {
    deleteMutation.mutate(id);
  };

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

  return (
    <Box
      sx={{
        bgcolor: "rgba(20, 20, 20, 0.9)",
        boxShadow: "0 4px 15px rgba(0,0,0,0.5)",
        width: 320,
        p: 2.5,
        pt: 1.5,
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        transition: "all 0.3s ease",
        backdropFilter: "blur(6px)",
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

      {/* ---------- MULTILINE INPUT ---------- */}
      <TextField
        fullWidth
        multiline
        rows={3}
        placeholder="Add a task... (Shift+Enter for new line)"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        sx={{
          mb: 2,
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

      {/* ---------- DUE DATE ---------- */}
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
          input: { color: "#8d8d8dff", fontSize: "0.9rem" },
          mb: 1.5,
          "& .MuiOutlinedInput-root": {
            "& fieldset": { borderColor: "#555" },
            "&:hover fieldset": { borderColor: "#777" },
          },
          "& .MuiInputLabel-root": { color: "#aaa" },
          "& input::-webkit-calendar-picker-indicator": { filter: "invert(1)" },
        }}
      />

      <Divider
        sx={{ width: "100%", mb: 1.5, borderColor: "rgba(255,255,255,0.1)" }}
      />

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
            maxHeight: 240,
            overflowY: "auto",
            pr: 0.5,
            mb: 1,
          }}
        >
          {todos.length === 0 ? (
            <ListItem>
              <ListItemText
                primary="No tasks yet"
                primaryTypographyProps={{
                  align: "center",
                  color: "#aaa",
                  fontStyle: "italic",
                }}
              />
            </ListItem>
          ) : (
            todos.map((todo) => (
              <ListItem
                key={todo._id}
                disableGutters
                sx={{
                  bgcolor: "rgba(255,255,255,0.05)",
                  borderRadius: 1.2,
                  mb: 1,
                  py: 0.6,
                  px: 1.5,
                  transition: "background-color 0.25s",
                  "&:hover": { bgcolor: "rgba(255,255,255,0.1)" },
                }}
                secondaryAction={
                  <Tooltip title="Delete">
                    <IconButton
                      onClick={() => remove(todo._id)}
                      sx={{ color: "#d66", "&:hover": { color: "#ff6b6b" } }}
                    >
                      <MdDelete />
                    </IconButton>
                  </Tooltip>
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

                {/* TEXT CONTAINER – full width, wraps long text */}
                <Box sx={{ flexGrow: 1, overflow: "hidden" }}>
                  <ListItemText
                    primary={todo.text}
                    secondary={
                      <>
                        <span style={{ display: "block", color: "#aaa" }}>
                          {formatCreated(todo.startDate)}
                        </span>
                        {todo.dueDate && (
                          <span style={{ display: "block", color: "#aaa" }}>
                            {formatDue(todo.dueDate)}
                          </span>
                        )}
                      </>
                    }
                    primaryTypographyProps={{
                      sx: {
                        textDecoration: todo.done ? "line-through" : "none",
                        color: todo.done ? "#999" : "#fff",
                        fontSize: "0.9rem",
                        fontWeight: 500,
                        whiteSpace: "pre-wrap", // ← wrap long lines
                        wordBreak: "break-word", // ← break very long words
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
            ))
          )}
        </List>
      )}

      {/* ---------- ACTION BUTTONS ---------- */}
      <Box sx={{ display: "flex", gap: 1, width: "100%" }}>
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
              "&:hover": {
                borderColor: "#6fcf97",
                bgcolor: "rgba(111, 207, 151, 0.1)",
              },
            }}
          >
            Clear
          </Button>
        )}
      </Box>
    </Box>
  );
};

export default TodoApp;
