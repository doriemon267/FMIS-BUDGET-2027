// src/components/apps/CalendarApp.jsx
import {
  Box,
  CircularProgress,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControlLabel,
  Checkbox,
  Snackbar,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { FiCalendar, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import api from "../../../../config/api";
import { STATIC_EVENTS } from "../utils/events";

// Reuse same fetch function
const fetchTodos = () => api.get("/api/todos").then((res) => res.data.todos);

const CalendarApp = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [hoveredDate, setHoveredDate] = useState(null);
  const [events, setEvents] = useState([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", date: null, time: "09:00", description: "", type: "event", notify: true });
  const [snack, setSnack] = useState({ open: false, message: "" });
  const checkIntervalRef = useRef(null);

  const { data: todos = [], isLoading } = useQuery({
    queryKey: ["todos"],
    queryFn: fetchTodos,
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = new Date();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarDays = [];
  const prevMonthDays = new Date(year, month, 0).getDate();

  for (let i = firstDay - 1; i >= 0; i--) {
    calendarDays.push({
      day: prevMonthDays - i,
      isCurrentMonth: false,
      date: new Date(year, month - 1, prevMonthDays - i),
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push({
      day,
      isCurrentMonth: true,
      date: new Date(year, month, day),
    });
  }

  const totalSlots = Math.ceil(calendarDays.length / 7) * 7;
  const nextMonthDays = totalSlots - calendarDays.length;
  for (let day = 1; day <= nextMonthDays; day++) {
    calendarDays.push({
      day,
      isCurrentMonth: false,
      date: new Date(year, month + 1, day),
    });
  }

  const goToPrevMonth = () => setCurrentDate(new Date(year, month - 1));
  const goToNextMonth = () => setCurrentDate(new Date(year, month + 1));
  const goToToday = () => setCurrentDate(new Date());

  const handleDateClick = (date) => {
    setSelectedDate(date);
  };

  const isToday = (date) =>
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  const isSelected = (date) =>
    selectedDate && selectedDate.toDateString() === date.toDateString();

  const getTodosForDate = (date) => {
    if (isLoading || !todos.length) return [];
    const dateStr = date.toISOString().split("T")[0];
    return todos.filter((t) => {
      if (t.dueDate && t.dueDate.startsWith(dateStr)) return true;
      if (t.startDate && t.startDate.startsWith(dateStr)) return true;
      return false;
    });
  };

  const getStaticEventsForDate = (date) => {
    const monthStr = String(date.getMonth() + 1).padStart(2, "0");
    const dayStr = String(date.getDate()).padStart(2, "0");
    const key = `${monthStr}-${dayStr}`;
    return STATIC_EVENTS.filter((e) => e.date === key);
  };

  const EVENTS_KEY = "fmis_calendar_events_v1";

  useEffect(() => {
    try {
      const raw = localStorage.getItem(EVENTS_KEY);
      if (raw) setEvents(JSON.parse(raw));
    } catch (e) {
      console.warn("Failed to load calendar events", e);
      setEvents([]);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
    } catch (e) {
      console.warn("Failed to persist calendar events", e);
    }
  }, [events]);

  useEffect(() => {
    const checkDueEvents = () => {
      const now = new Date();
      const pending = events.filter((ev) => !ev.notified && ev.notify && new Date(ev.dateTime) <= now);
      pending.forEach((ev) => {
        setSnack({ open: true, message: `${ev.title} is due now` });
        try {
          if (window.Notification && Notification.permission === "granted") {
            new Notification(ev.title, { body: ev.description || "" });
          }
        } catch (_e) { /* ignore */ }
      });
      if (pending.length > 0) {
        setEvents((prev) => prev.map((ev) => (pending.some((p) => p.id === ev.id) ? { ...ev, notified: true } : ev)));
      }
    };
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
    checkIntervalRef.current = setInterval(checkDueEvents, 20 * 1000);
    checkDueEvents();
    return () => clearInterval(checkIntervalRef.current);
  }, [events]);

  const addEvent = ({ title, date, time, description, type = "event", notify = true }) => {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    const dateTime = time ? new Date(`${dateObj.toISOString().split("T")[0]}T${time}:00`) : dateObj;
    const newEv = { id: `ev-${Date.now()}`, title, description, type, dateTime: dateTime.toISOString(), notified: false, notify };
    setEvents((prev) => [...prev, newEv]);
    return newEv;
  };

  const removeEvent = (id) => setEvents((prev) => prev.filter((p) => p.id !== id));

  const getEventsForDate = (date) => {
    const dateStr = date.toISOString().split("T")[0];
    return events.filter((e) => e.dateTime.startsWith(dateStr));
  };

  const openCreateDialogForDate = (date) => {
    setForm({ title: "", date: date?.toISOString().split("T")[0] || new Date().toISOString().split("T")[0], time: "09:00", description: "", type: "event", notify: true });
    setCreating(true);
  };

  const handleCreateSubmit = () => {
    try {
      addEvent({ title: form.title || "Untitled", date: form.date, time: form.time, description: form.description, type: form.type, notify: form.notify });
      setSnack({ open: true, message: "Event added" });
      setCreating(false);
      setForm({ title: "", date: null, time: "09:00", description: "", type: "event", notify: true });
    } catch (e) {
      console.error(e);
      setSnack({ open: true, message: "Failed to add event" });
    }
  };

  return (
    <Box
      sx={{
        width: 340,
        p: 2,
        bgcolor: "rgba(255, 255, 255, 0.95)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.3)",
        userSelect: "none",
        fontFamily: "monospace",
        position: "relative",
        minHeight: 400,
      }}
    >
      {isLoading && (
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "rgba(255,255,255,0.8)",
            zIndex: 10,
          }}
        >
          <CircularProgress size={32} sx={{ color: "#8e24aa" }} />
        </Box>
      )}

      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        mb={2}
      >
        <IconButton onClick={goToPrevMonth} size="small">
          <FiChevronLeft />
        </IconButton>

        <Typography
          variant="h6"
          sx={{
            fontWeight: "bold",
            color: "#8e24aa",
            letterSpacing: "1px",
          }}
        >
          {currentDate.toLocaleString("default", {
            month: "long",
            year: "numeric",
          })}
        </Typography>

        <IconButton onClick={goToNextMonth} size="small">
          <FiChevronRight />
        </IconButton>
      </Stack>

      <Stack direction="row" spacing={0.5} mb={1}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <Box
            key={day}
            sx={{
              flex: 1,
              textAlign: "center",
              fontSize: "0.75rem",
              fontWeight: "bold",
              color: "#555",
              py: 0.5,
            }}
          >
            {day}
          </Box>
        ))}
      </Stack>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 0.5,
        }}
      >
        {calendarDays.map((item, index) => {
          const dateTodos = getTodosForDate(item.date);
          const staticEvents = getStaticEventsForDate(item.date);
          const localEvents = getEventsForDate(item.date);
          const hasTodos = dateTodos.length > 0;
          const hasEvents = staticEvents.length > 0 || localEvents.length > 0;
          const hasLocalEvents = localEvents.length > 0;
          const hasContent = hasTodos || hasEvents;
          const dateStr = item.date.toISOString().split("T")[0];
          const eventColor = hasEvents ? (staticEvents[0]?.color || (hasLocalEvents ? '#1976d2' : null)) : null;

          // Only show tooltip if there's content
          const tooltipContent = hasContent ? (
            <Box sx={{ p: 1, maxWidth: 300 }}>
              {/* Static Events */}
              {hasEvents && (
                <Box sx={{ mb: hasTodos ? 1 : 0 }}>
                  <Typography
                    variant="subtitle2"
                    sx={{ color: "#ffd700", mb: 0.5 }}
                  >
                    {String(hasEvents)} Holiday{hasEvents > 1 ? "s" : ""}
                  </Typography>
                  {staticEvents.map((event) => (
                    <Box key={event.id} sx={{ mb: 0.8 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 600,
                          color: event.color,
                          fontSize: "0.85rem",
                        }}
                      >
                        {event.title}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: "#ccc", fontSize: "0.7rem" }}
                      >
                        {event.description}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}

              {/* Local Events */}
              {localEvents.length > 0 && (
                <Box sx={{ mb: hasTodos ? 1 : 0 }}>
                  <Typography variant="subtitle2" sx={{ color: "#90caf9", mb: 0.5 }}>
                    {String(localEvents.length)} Event{localEvents.length > 1 ? "s" : ""}
                  </Typography>
                  {localEvents.map((event) => (
                    <Box key={event.id} sx={{ mb: 0.8 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: "#90caf9", fontSize: "0.85rem" }}>
                        {event.title}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "#ccc", fontSize: "0.7rem" }}>
                        {event.description}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}

              {/* Todos */}
              {hasTodos && (
                <Box>
                  <Typography
                    variant="subtitle2"
                    sx={{ color: "#6fcf97", mb: 0.5 }}
                  >
                    {String(dateTodos.length)} Task
                    {dateTodos.length > 1 ? "s" : ""}
                  </Typography>
                  {dateTodos.map((todo) => {
                    const isDueDate =
                      todo.dueDate && todo.dueDate.startsWith(dateStr);
                    const displayDate = isDueDate
                      ? todo.dueDate
                      : todo.startDate;
                    const label = isDueDate ? "Due" : "Started";

                    return (
                      <Box key={todo._id} sx={{ mb: 0.5 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 500,
                            textDecoration: todo.done ? "line-through" : "none",
                            color: todo.done ? "#aaa" : "#fff",
                          }}
                        >
                          {todo.text}
                        </Typography>
                        {displayDate && (
                          <Typography
                            variant="caption"
                            sx={{ color: "#aaa", fontSize: "0.7rem" }}
                          >
                            {label}:{" "}
                            {new Date(displayDate).toLocaleDateString()}
                          </Typography>
                        )}
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Box>
          ) : null; // ← FIX: null instead of ""

          return (
            <Tooltip
              key={index}
              open={
                !isLoading &&
                hoveredDate?.toDateString() === item.date.toDateString() &&
                hasContent
              }
              title={tooltipContent}
              placement="top"
              arrow
              disableHoverListener={!hasContent} // ← Prevents empty tooltip
              PopperProps={{
                sx: {
                  "& .MuiTooltip-tooltip": {
                    bgcolor: "rgba(30, 30, 30, 0.97)",
                    color: "#fff",
                    border: "1px solid #555",
                    borderRadius: 2,
                    fontFamily: "monospace",
                    fontSize: "0.8rem",
                    maxWidth: 320,
                    boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
                  },
                  "& .MuiTooltip-arrow": { color: "rgba(30, 30, 30, 0.97)" },
                },
              }}
            >
              <Box
                onMouseEnter={() => setHoveredDate(item.date)}
                onMouseLeave={() => setHoveredDate(null)}
                onClick={() =>
                  item.isCurrentMonth && handleDateClick(item.date)
                }
                sx={{
                  aspectRatio: "1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 2,
                  fontSize: "0.9rem",
                  fontWeight: isToday(item.date) ? "bold" : "medium",
                  bgcolor: isSelected(item.date)
                    ? "#8e24aa"
                    : isToday(item.date)
                    ? "#e1bee7"
                    : hasEvents
                    ? eventColor + "33"
                    : hasTodos
                    ? dateTodos.some(
                        (t) => t.dueDate && t.dueDate.startsWith(dateStr)
                      )
                      ? "rgba(255, 99, 71, 0.2)" // red bg for due-date
                      : "rgba(111, 207, 151, 0.2)" // green bg for start-date
                    : "transparent",
                  color:
                    isSelected(item.date) || isToday(item.date)
                      ? "#fff"
                      : hasEvents
                      ? eventColor
                      : "inherit",
                  cursor: item.isCurrentMonth ? "pointer" : "default",
                  position: "relative",
                  transition: "all 0.2s",
                  "&:hover": {
                    bgcolor: item.isCurrentMonth
                      ? hasEvents
                        ? eventColor + "55"
                        : hasTodos
                        ? dateTodos.some(
                            (t) => t.dueDate && t.dueDate.startsWith(dateStr)
                          )
                          ? "rgba(255, 99, 71, 0.3)" // hover red
                          : "rgba(111, 207, 151, 0.3)" // hover green
                        : "rgba(142, 36, 170, 0.2)"
                      : "transparent",
                    transform: item.isCurrentMonth ? "scale(1.1)" : "none",
                  },
                  "&::after": hasTodos
                    ? {
                        content: '""',
                        position: "absolute",
                        bottom: 4,
                        width: 5,
                        height: 5,
                        bgcolor: dateTodos.some(
                          (t) => t.dueDate && t.dueDate.startsWith(dateStr)
                        )
                          ? "#ff3b30" // red dot
                          : "#6fcf97", // green dot
                        borderRadius: "50%",
                        zIndex: 1,
                      }
                    : {},
                }}
              >
                {item.day}
              </Box>
            </Tooltip>
          );
        })}
      </Box>

      <Stack direction="row" justifyContent="center" mt={2}>
        <Tooltip title="Go to Today" placement="top">
          <IconButton
            onClick={goToToday}
            size="small"
            sx={{
              bgcolor: "#8e24aa",
              color: "white",
              "&:hover": { bgcolor: "#6a1b9a" },
            }}
          >
            <FiCalendar size={16} />
          </IconButton>
        </Tooltip>
      </Stack>
      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', gap: 1 }}>
        <Button size="small" onClick={() => openCreateDialogForDate(selectedDate || new Date())}>Create Task/Event</Button>
        {selectedDate && (
          <Button size="small" onClick={() => openCreateDialogForDate(selectedDate)}>Add to Selected Date</Button>
        )}
      </Box>

      {/* Selected date events list */}
      {selectedDate && (
        <Box sx={{ mt: 2, p: 1, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Items on {selectedDate.toLocaleDateString()}</Typography>
          {getStaticEventsForDate(selectedDate).map((ev) => (
            <Box key={`static-${ev.id}`} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" sx={{ color: ev.color }}>{ev.title}</Typography>
              <Typography variant="caption" sx={{ color: '#aaa' }}>{ev.description}</Typography>
            </Box>
          ))}
          {getTodosForDate(selectedDate).map((todo) => (
            <Box key={todo._id} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" sx={{ textDecoration: todo.done ? 'line-through' : 'none' }}>{todo.text}</Typography>
              <Typography variant="caption" sx={{ color: '#aaa' }}>{todo.dueDate ? new Date(todo.dueDate).toLocaleTimeString() : ''}</Typography>
            </Box>
          ))}
          {getEventsForDate(selectedDate).map((ev) => (
            <Box key={ev.id} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2">{ev.title}</Typography>
              <Box>
                <Typography variant="caption" sx={{ color: '#aaa' }}>{new Date(ev.dateTime).toLocaleTimeString()}</Typography>
                <Button size="small" sx={{ ml: 1 }} onClick={() => removeEvent(ev.id)}>Remove</Button>
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {/* Create Dialog */}
      <Dialog open={creating} onClose={() => setCreating(false)}>
        <DialogTitle>Create Task / Event</DialogTitle>
        <DialogContent>
          <TextField label="Title" fullWidth sx={{ mt: 1 }} value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
          <TextField label="Date" type="date" fullWidth sx={{ mt: 1 }} value={form.date || ''} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
          <TextField label="Time" type="time" fullWidth sx={{ mt: 1 }} value={form.time} onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))} />
          <TextField label="Description" fullWidth sx={{ mt: 1 }} multiline rows={3} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          <FormControlLabel control={<Checkbox checked={form.notify} onChange={(e) => setForm((p) => ({ ...p, notify: e.target.checked }))} />} label="Notify when due" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreating(false)}>Cancel</Button>
          <Button onClick={handleCreateSubmit} variant="contained">Create</Button>
        </DialogActions>
      </Dialog>

      {/* Snack */}
      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack((s) => ({ ...s, open: false }))} message={snack.message} />
    </Box>
  );
};

export default CalendarApp;
