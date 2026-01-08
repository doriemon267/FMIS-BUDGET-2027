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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  //Snackbar,
} from "@mui/material";
import CustomSnackbar from "../../CustomSnackbar";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useRef, useContext } from "react";
import { FiCalendar, FiChevronLeft, FiChevronRight, FiDownload, FiFilter } from "react-icons/fi";
import api from "../../../../config/api";
import io from 'socket.io-client';
import { useUser } from '../../../../context/UserContext';
import { STATIC_EVENTS } from "../utils/events";

// Reuse same fetch function
const fetchTodos = () => api.get("/api/todos").then((res) => res.data.todos);

const CalendarApp = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [hoveredDate, setHoveredDate] = useState(null);
  const [events, setEvents] = useState([]);
  const { currentUser } = useUser();
  const socketRef = useRef(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", date: null, time: "09:00", description: "", type: "event", notify: true, category: "work" });
  const [snack, setSnack] = useState({ open: false, message: "" });
  const checkIntervalRef = useRef(null);
  const scheduledTimersRef = useRef({});
  
  // New enhancements
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("calendarTheme") || "light";
    } catch { return "light"; }
  });
  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem("calendarViewMode") || "month";
    } catch { return "month"; }
  });
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  
  // Event categories with colors
  const eventCategories = {
    work: { color: "#1976d2", label: "Work" },
    personal: { color: "#d32f2f", label: "Personal" },
    meeting: { color: "#f57c00", label: "Meeting" },
    deadline: { color: "#c2185b", label: "Deadline" },
    holiday: { color: "#ffd700", label: "Holiday" },
    birthday: { color: "#9c27b0", label: "Birthday" },
  };

  // Save theme preference
  useEffect(() => {
    try {
      localStorage.setItem("calendarTheme", theme);
    } catch (e) {
      console.warn("Failed to save theme preference", e);
    }
  }, [theme]);

  // Save view mode preference
  useEffect(() => {
    try {
      localStorage.setItem("calendarViewMode", viewMode);
    } catch (e) {
      console.warn("Failed to save view mode preference", e);
    }
  }, [viewMode]);

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
    // If user is logged in, fetch server-side events
    const fetchEvents = async () => {
      try {
        const res = await api.get('/api/events');
        if (res?.data?.data) {
          // Map to local format
          const list = (res.data.data || []).map((ev) => ({
            id: String(ev._id),
            title: ev.title,
            description: ev.description,
            dateTime: new Date(ev.dateTime).toISOString(),
            notify: !!ev.notify,
            preReminders: ev.preReminders || [],
          }));
          setEvents(list);
          return;
        }
      } catch (e) {
        // fallback to localStorage if server fetch fails
      }

      try {
        const raw = localStorage.getItem(EVENTS_KEY);
        if (raw) setEvents(JSON.parse(raw));
      } catch (e) {
        console.warn("Failed to load calendar events", e);
        setEvents([]);
      }
    };

    fetchEvents();
  }, [currentUser]);

  useEffect(() => {
    try {
      localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
    } catch (e) {
      console.warn("Failed to persist calendar events", e);
    }
  }, [events]);

  // Use local scheduling to trigger notifications at precise times (fallback if socket not present)
  useEffect(() => {
    // Clear previous timers
    Object.values(scheduledTimersRef.current || {}).forEach((t) => clearTimeout(t));
    scheduledTimersRef.current = {};

    const now = Date.now();
    events.forEach((ev) => {
      try {
        const dt = new Date(ev.dateTime);
        const timeUntil = dt.getTime() - now;
        if (timeUntil > 0 && timeUntil < 7 * 24 * 3600 * 1000) { // schedule only within 7 days to avoid huge timeouts
          const id = setTimeout(() => {
            setSnack({ open: true, message: `${ev.title} is due now` });
            try {
              if (window.Notification && Notification.permission === 'granted') {
                new Notification(ev.title, { body: ev.description || '' });
              }
            } catch (_e) {}
          }, timeUntil);
          scheduledTimersRef.current[String(ev.id)] = id;
        }
        // schedule pre reminders
        if (Array.isArray(ev.preReminders) && ev.preReminders.length) {
          for (const minutes of ev.preReminders) {
            const tms = dt.getTime() - minutes * 60000 - now;
            if (tms > 0 && tms < 7 * 24 * 3600 * 1000) {
              const prerid = setTimeout(() => {
                setSnack({ open: true, message: `Reminder: ${ev.title} in ${minutes} minutes` });
              }, tms);
              scheduledTimersRef.current[`pre-${ev.id}-${minutes}`] = prerid;
            }
          }
        }
      } catch (e) {
        // ignore invalid dates
      }
    });

    return () => {
      Object.values(scheduledTimersRef.current || {}).forEach((t) => clearTimeout(t));
      scheduledTimersRef.current = {};
    };
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

  // Socket & server notifications hookup
  useEffect(() => {
    if (!currentUser) return;
    try {
      const baseUrl = import.meta.env.VITE_SERVER_URL || import.meta.env.VITE_API_BASE_URL || window.location.origin;
      const s = io(baseUrl, { path: '/socket.io', transports: ['polling', 'websocket'] });
      socketRef.current = s;
      const userId = (currentUser?.Id || currentUser?.id || currentUser?.userId || (Array.isArray(currentUser?.Username) ? currentUser.Username[0] : currentUser?.Username));
      if (userId) s.emit('join-user-room', userId);

      s.on('calendar:event', (payload) => {
        if (!payload) return;
        setSnack({ open: true, message: `Event: ${payload.event?.title}` });
        try {
          if (window.Notification && Notification.permission === 'granted') {
            new Notification(payload.event?.title || 'Event', { body: payload.event?.description || '' });
          }
        } catch (_e) {}
      });

      s.on('calendar:prereminder', (payload) => {
        if (!payload) return;
        setSnack({ open: true, message: `Reminder: ${payload.event?.title} (${payload.minutesBefore} min)` });
      });

      return () => {
        try { s.disconnect(); } catch (e) { /* ignore */ }
      };
    } catch (err) {
      console.warn('Failed to initialize socket for calendar', err?.message || err);
    }
  }, [currentUser]);

  const addEvent = async ({ title, date, time, description, type = "event", notify = true, category = "work" }) => {
    // Create a local date using year/month/day/hours/minutes to avoid timezone shift issues
    const dateObj = typeof date === "string" ? new Date(date) : date;
    const year = dateObj.getFullYear();
    const monthIndex = dateObj.getMonth();
    const day = dateObj.getDate();
    let dateTime;
    if (time) {
      // time is in format HH:mm (24h) or 'HH:MM AM/PM' — prefer to parse HH:mm
      const parts = time.includes(":") ? time.split(":") : ["09", "00"];
      const hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1] || "0", 10);
      dateTime = new Date(year, monthIndex, day, hours, minutes, 0);
    } else {
      dateTime = new Date(year, monthIndex, day, 0, 0, 0);
    }
    const payload = { title, description, dateTime: dateTime.toISOString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, notify, preReminders: [], category };
    if (currentUser) {
      try {
        const res = await api.post('/api/events', payload);
        if (res?.data?.data) {
          const ev = res.data.data;
          const mapped = { id: String(ev._id), title: ev.title, description: ev.description, dateTime: new Date(ev.dateTime).toISOString(), notify: !!ev.notify, category: ev.category || "work" };
          setEvents((prev) => [...prev, mapped]);
          return mapped;
        }
      } catch (e) {
        console.error('Failed to create event on server', e);
      }
    }
    const newEv = { id: `ev-${Date.now()}`, title, description, type, dateTime: dateTime.toISOString(), notified: false, notify, category };
    setEvents((prev) => [...prev, newEv]);
    return newEv;
  };

  const removeEvent = async (id) => {
    if (currentUser && id && String(id).startsWith('ev-') === false) {
      try {
        await api.delete(`/api/events/${id}`);
      } catch (e) {
        console.warn('Failed to delete event on server', e?.message || e);
      }
    }
    setEvents((prev) => prev.filter((p) => p.id !== id));
  };

  const getEventsForDate = (date) => {
    // Compare events by local date (year, month, day) to avoid timezone mismatch
    const y = date.getFullYear();
    const m = date.getMonth();
    const d = date.getDate();
    return events.filter((e) => {
      try {
        const evDate = new Date(e.dateTime);
        return (
          evDate.getFullYear() === y &&
          evDate.getMonth() === m &&
          evDate.getDate() === d
        );
      } catch (_err) {
        return false;
      }
    });
  };

  const openCreateDialogForDate = (date) => {
    setForm({ title: "", date: date?.toISOString().split("T")[0] || new Date().toISOString().split("T")[0], time: "09:00", description: "", type: "event", notify: true });
    setCreating(true);
  };

  const handleCreateSubmit = () => {
    try {
      addEvent({ title: form.title || "Untitled", date: form.date, time: form.time, description: form.description, type: form.type, notify: form.notify, category: form.category });
      setSnack({ open: true, message: "Event added" });
      setCreating(false);
      setForm({ title: "", date: null, time: "09:00", description: "", type: "event", notify: true, category: "work" });
    } catch (e) {
      console.error(e);
      setSnack({ open: true, message: "Failed to add event" });
    }
  };

  // Export events to iCal format
  const exportToICalendar = () => {
    let ical = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//FMIS Calendar//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:FMIS Calendar
X-WR-TIMEZONE:${Intl.DateTimeFormat().resolvedOptions().timeZone}
`;
    
    events.forEach((ev) => {
      try {
        const dt = new Date(ev.dateTime);
        const dtStart = dt.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
        const dtEnd = new Date(dt.getTime() + 3600000).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
        
        ical += `BEGIN:VEVENT
UID:${ev.id}@fmis-calendar
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z
DTSTART:${dtStart}
DTEND:${dtEnd}
SUMMARY:${ev.title || "Untitled"}
DESCRIPTION:${(ev.description || "").replace(/\n/g, "\\n")}
END:VEVENT
`;
      } catch (e) {
        console.warn("Failed to export event", e);
      }
    });
    
    ical += `END:VCALENDAR`;
    
    const blob = new Blob([ical], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `calendar-${new Date().toISOString().split("T")[0]}.ics`;
    a.click();
    URL.revokeObjectURL(url);
    setSnack({ open: true, message: "Calendar exported to iCal" });
  };

  // Export events to CSV format
  const exportToCSV = () => {
    const headers = ["Title", "Date", "Time", "Description", "Category", "Type", "Notify"];
    const rows = events.map((ev) => {
      const dt = new Date(ev.dateTime);
      return [
        ev.title,
        dt.toLocaleDateString(),
        dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        ev.description || "",
        ev.category || "work",
        ev.type || "event",
        ev.notify ? "Yes" : "No",
      ];
    });
    
    const csv = [
      headers.join(","),
      ...rows.map((r) => r.map((v) => `"${v}"`).join(",")),
    ].join("\n");
    
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `calendar-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setSnack({ open: true, message: "Calendar exported to CSV" });
  };

  // Get week of the month for the selected date
  const getWeekView = () => {
    if (!selectedDate) return [];
    const start = new Date(selectedDate);
    start.setDate(start.getDate() - start.getDay()); // Start of week (Sunday)
    const week = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      week.push(d);
    }
    return week;
  };

  const themeBg = theme === "dark" ? "rgba(20, 20, 20, 0.95)" : "rgba(255, 255, 255, 0.95)";
  const themeText = theme === "dark" ? "#fff" : "#000";
  const themeBorder = theme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.3)";

  // Filter events based on category and type
  const filteredEvents = events.filter((e) => {
    if (categoryFilter !== "all" && e.category !== categoryFilter) return false;
    if (typeFilter !== "all" && e.type !== typeFilter) return false;
    return true;
  });

  return (
    <Box
      sx={{
        width: 360,
        p: 2,
        bgcolor: themeBg,
        backdropFilter: "blur(12px)",
        border: `1px solid ${themeBorder}`,
        userSelect: "none",
        fontFamily: "monospace",
        position: "relative",
        minHeight: 400,
        color: themeText,
        zIndex: 1300,
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
        mb={1}
        sx={{ flexWrap: "wrap", gap: 1 }}
      >
        <IconButton onClick={goToPrevMonth} size="small">
          <FiChevronLeft />
        </IconButton>

        <Typography
          variant="h6"
          sx={{
            fontWeight: "bold",
            color: theme === "dark" ? "#90caf9" : "#8e24aa",
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

      {/* Controls Row */}
      <Stack direction="row" spacing={1} mb={1} sx={{ flexWrap: "wrap", gap: 0.5 }}>
        <Tooltip title="Toggle theme">
          <Button 
            size="small" 
            variant="outlined"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            sx={{ fontSize: "0.7rem", py: 0.3, color: themeText, borderColor: themeText }}
          >
            {theme === "light" ? "🌙" : "☀️"}
          </Button>
        </Tooltip>
        
        <Tooltip title="Jump to month">
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <Select 
              value={month} 
              onChange={(e) => setCurrentDate(new Date(year, e.target.value, 1))}
              sx={{ 
                fontSize: "0.8rem", 
                py: 0.3,
                color: themeText,
                "& .MuiOutlinedInput-notchedOutline": { borderColor: themeText },
                "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: themeText },
                "& .MuiSvgIcon-root": { color: themeText },
              }}
              MenuProps={{
                PaperProps: {
                  sx: {
                    bgcolor: theme === "dark" ? "rgba(20, 20, 20, 0.95)" : "#fff",
                    zIndex: 1400,
                    "& .MuiMenuItem-root": {
                      color: themeText,
                      "&:hover": {
                        bgcolor: theme === "dark" ? "rgba(111, 207, 151, 0.2)" : "rgba(0,0,0,0.05)",
                      },
                      "&.Mui-selected": {
                        bgcolor: theme === "dark" ? "rgba(111, 207, 151, 0.3)" : "rgba(0,0,0,0.1)",
                      },
                    },
                  },
                },
              }}
            >
              <MenuItem value={0}>January</MenuItem>
              <MenuItem value={1}>February</MenuItem>
              <MenuItem value={2}>March</MenuItem>
              <MenuItem value={3}>April</MenuItem>
              <MenuItem value={4}>May</MenuItem>
              <MenuItem value={5}>June</MenuItem>
              <MenuItem value={6}>July</MenuItem>
              <MenuItem value={7}>August</MenuItem>
              <MenuItem value={8}>September</MenuItem>
              <MenuItem value={9}>October</MenuItem>
              <MenuItem value={10}>November</MenuItem>
              <MenuItem value={11}>December</MenuItem>
            </Select>
          </FormControl>
        </Tooltip>

        <Tooltip title="Export calendar">
          <IconButton 
            size="small" 
            onClick={() => exportToICalendar()}
            sx={{ fontSize: "0.7rem" }}
          >
            <FiDownload size={14} />
          </IconButton>
        </Tooltip>

        <Tooltip title="Filter events">
          <IconButton 
            size="small"
            sx={{ fontSize: "0.7rem" }}
          >
            <FiFilter size={14} />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* Filter Chips */}
      <Stack direction="row" spacing={0.5} mb={1} sx={{ flexWrap: "wrap" }}>
        <Chip 
          label="All Categories" 
          size="small"
          onClick={() => setCategoryFilter("all")}
          variant={categoryFilter === "all" ? "filled" : "outlined"}
          sx={{ fontSize: "0.7rem", color: categoryFilter === "all" ? "#fff" : themeText }}
        />
        {Object.entries(eventCategories).map(([key, val]) => (
          <Chip
            key={key}
            label={val.label}
            size="small"
            onClick={() => setCategoryFilter(key)}
            variant={categoryFilter === key ? "filled" : "outlined"}
            sx={{ 
              fontSize: "0.7rem", 
              bgcolor: categoryFilter === key ? val.color : "transparent",
              color: categoryFilter === key ? "#fff" : themeText,
              borderColor: categoryFilter !== key ? themeText : "transparent"
            }}
          />
        ))}
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
              color: theme === "dark" ? "#aaa" : "#555",
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

      <Stack direction="row" justifyContent="center" mt={2} gap={1}>
        <Tooltip title="Go to Today" placement="top">
          <IconButton
            onClick={goToToday}
            size="small"
            sx={{
              bgcolor: theme === "dark" ? "#1976d2" : "#8e24aa",
              color: "white",
              "&:hover": { bgcolor: theme === "dark" ? "#1565c0" : "#6a1b9a" },
            }}
          >
            <FiCalendar size={16} />
          </IconButton>
        </Tooltip>
        
        <Button 
          size="small" 
          variant="outlined"
          onClick={exportToCSV}
          sx={{ fontSize: "0.75rem" }}
        >
          Export CSV
        </Button>
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
          
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel>Category</InputLabel>
            <Select
              value={form.category}
              label="Category"
              onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
            >
              {Object.entries(eventCategories).map(([key, val]) => (
                <MenuItem key={key} value={key}>{val.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <FormControlLabel control={<Checkbox checked={form.notify} onChange={(e) => setForm((p) => ({ ...p, notify: e.target.checked }))} />} label="Notify when due" sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreating(false)}>Cancel</Button>
          <Button onClick={handleCreateSubmit} variant="contained">Create</Button>
        </DialogActions>
      </Dialog>

      {/* Custom Snack (replaces MUI Snackbar to avoid ownerState warnings) */}
      <CustomSnackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack((s) => ({ ...s, open: false }))} message={snack.message} />
    </Box>
  );
};

export default CalendarApp;
